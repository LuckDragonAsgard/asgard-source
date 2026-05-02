// falkor-kbt v2.4.0 — KBT Live Trivia Game Engine
// Durable Objects: KBTGame (one per live session, keyed by game code)
// D1: kbt-integration-db (events, questions, teams, scores)
// Routes:
//   POST /game/create          — create game session, returns { code, hostToken }
//   WS   /game/host/:code      — host WebSocket (control panel)
//   WS   /game/play/:code      — player WebSocket (join by phone)
//   GET  /game/:code           — game state (REST)
//   POST /questions/generate   — AI-generate questions for a round
//   GET  /questions/bank       — browse question bank
//   POST /questions/add        — add question to bank
//   POST /music/prompt         — generate Suno music prompt for an event theme
//   GET  /events               — list events
//   POST /events               — create event
//   GET  /health               — version + DB check

const VERSION = '2.4.0';
const WORKER_NAME = 'falkor-kbt';
const DB_ID = '7c6ee10f-93d4-475e-889d-cade0dbfd076';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Pin, X-Host-Token',
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
function err(msg, status = 400) { return json({ ok: false, error: msg }, status); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function gameCode() {
  // 6-char alphanumeric, easy to read/type on phone
  const chars = 'BCDFGHJKLMNPQRSTVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function pinOk(request, env) {
  const pin = request.headers.get('X-Pin') || '';
  if (!env.AGENT_PIN) return true; // no pin set = open (dev mode)
  return pin === env.AGENT_PIN;
}

// ─── Durable Object: KBTGame ─────────────────────────────────────────────────
// One DO instance per live game session (keyed by game code).
// Handles all WebSocket connections for that game.

export class KBTGame {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map(); // sessionId → { ws, role:'host'|'player', teamName }
    this.hostToken = null;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const role = url.searchParams.get('role') || 'player';
    const teamName = url.searchParams.get('name') || 'Anonymous';
    const token = url.searchParams.get('token') || '';

    if (request.headers.get('Upgrade') !== 'websocket') {
      return this.handleRest(request, url);
    }

    // WebSocket upgrade
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();

    const sessionId = uid();
    let isHost = false;

    if (role === 'host') {
      const storedToken = await this.state.storage.get('hostToken');
      if (!storedToken || token !== storedToken) {
        server.close(4001, 'Invalid host token');
        return new Response(null, { status: 101, webSocket: client });
      }
      isHost = true;
    }

    this.sessions.set(sessionId, { ws: server, role: isHost ? 'host' : 'player', teamName, score: 0, answered: false });

    // Welcome message
    server.send(JSON.stringify({
      type: 'connected',
      sessionId,
      role: isHost ? 'host' : 'player',
      gameState: await this.getPublicState(),
    }));

    // Broadcast player join (if player)
    if (!isHost) {
      this.broadcast({ type: 'player_joined', teamName, playerCount: this.playerCount() }, 'host');
      this.broadcast({ type: 'player_joined', teamName, playerCount: this.playerCount() }, 'player', sessionId);
    }

    server.addEventListener('message', async (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        await this.handleMessage(sessionId, isHost, msg, server);
      } catch (e) { console.error('KBTGame message error:', e?.message); }
    });

    server.addEventListener('close', () => {
      const sess = this.sessions.get(sessionId);
      this.sessions.delete(sessionId);
      if (!isHost && sess) {
        this.broadcast({ type: 'player_left', teamName: sess.teamName, playerCount: this.playerCount() });
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  async handleRest(request, url) {
    const path = url.pathname;
    if (path.endsWith('/state')) {
      return json(await this.getPublicState());
    }
    return json({ error: 'Not found' }, 404);
  }

  async handleMessage(sessionId, isHost, msg, ws) {
    const state = await this.getState();

    if (isHost) {
      // Host commands
      switch (msg.type) {
        case 'start_game':
          await this.state.storage.put('status', 'active');
          await this.state.storage.put('currentRound', 1);
          await this.state.storage.put('currentQuestion', 0);
          this.broadcast({ type: 'game_started', totalQuestions: (state.questions || []).length });
          break;

        case 'next_question': {
          const questions = state.questions || [];
          const qi = (state.currentQuestion || 0) + 1;
          if (qi > questions.length) {
            await this.state.storage.put('status', 'finished');
            const leaderboard = await this.buildLeaderboard();
            this.broadcast({ type: 'game_over', leaderboard });
          } else {
            await this.state.storage.put('currentQuestion', qi);
            await this.state.storage.put('questionStart', Date.now());
            await this.state.storage.put('answerRevealed', false);
            // Reset player answered flags
            for (const [sid, sess] of this.sessions) { sess.answered = false; }
            const q = questions[qi - 1];
            this.broadcast({
              type: 'question',
              number: qi,
              total: questions.length,
              text: q.question,
              category: q.category,
              points: q.points || 1,
              timeLimit: msg.timeLimit || 30,
            });
          }
          break;
        }

        case 'reveal_answer': {
          const questions = state.questions || [];
          const qi = state.currentQuestion || 0;
          const q = questions[qi - 1];
          if (!q) break;
          await this.state.storage.put('answerRevealed', true);
          const leaderboard = await this.buildLeaderboard();
          this.broadcast({ type: 'answer_revealed', answer: q.answer, fun_fact: q.fun_fact || '', leaderboard });
          break;
        }

        case 'award_points': {
          // Host manually awards points to a team
          const { teamId, points } = msg;
          const scores = (await this.state.storage.get('scores')) || {};
          scores[teamId] = (scores[teamId] || 0) + (points || 1);
          await this.state.storage.put('scores', scores);
          const leaderboard = await this.buildLeaderboard();
          this.broadcast({ type: 'scores_updated', leaderboard });
          break;
        }

        case 'set_questions':
          await this.state.storage.put('questions', msg.questions);
          ws.send(JSON.stringify({ type: 'questions_set', count: msg.questions.length }));
          break;

        case 'end_game':
          await this.state.storage.put('status', 'finished');
          const leaderboard = await this.buildLeaderboard();
          this.broadcast({ type: 'game_over', leaderboard });
          break;

        default:
          ws.send(JSON.stringify({ type: 'error', error: 'Unknown host command: ' + msg.type }));
      }

    } else {
      // Player commands
      const sess = this.sessions.get(sessionId);

      switch (msg.type) {
        case 'submit_answer': {
          if (!sess || sess.answered) break;
          sess.answered = true;
          const state2 = await this.getState();
          const qi = state2.currentQuestion || 0;
          const q = (state2.questions || [])[qi - 1];
          if (!q) break;
          // Simple answer checking (lowercase trim)
          const correct = q.answer.toLowerCase().trim() === (msg.answer || '').toLowerCase().trim();
          if (correct) {
            const scores = (await this.state.storage.get('scores')) || {};
            const key = sess.teamName;
            const pts = q.points || 1;
            // Bonus for speed
            const timeTaken = (Date.now() - (state2.questionStart || Date.now())) / 1000;
            const speedBonus = timeTaken < 5 ? 1 : 0;
            scores[key] = (scores[key] || 0) + pts + speedBonus;
            await this.state.storage.put('scores', scores);
          }
          ws.send(JSON.stringify({ type: 'answer_received', correct, waiting: true }));
          // Tell host someone answered
          this.broadcast({
            type: 'player_answered',
            teamName: sess.teamName,
            correct,
            answeredCount: [...this.sessions.values()].filter(s => s.role === 'player' && s.answered).length,
            totalPlayers: this.playerCount(),
          }, 'host');
          break;
        }

        case 'get_state':
          ws.send(JSON.stringify({ type: 'state', ...await this.getPublicState() }));
          break;

        default:
          ws.send(JSON.stringify({ type: 'error', error: 'Unknown command: ' + msg.type }));
      }
    }
  }

  async getState() {
    const [status, questions, currentQuestion, currentRound, scores, questionStart, answerRevealed] = await Promise.all([
      this.state.storage.get('status'),
      this.state.storage.get('questions'),
      this.state.storage.get('currentQuestion'),
      this.state.storage.get('currentRound'),
      this.state.storage.get('scores'),
      this.state.storage.get('questionStart'),
      this.state.storage.get('answerRevealed'),
    ]);
    return { status: status || 'lobby', questions: questions || [], currentQuestion: currentQuestion || 0, currentRound: currentRound || 1, scores: scores || {}, questionStart, answerRevealed };
  }

  async getPublicState() {
    const s = await this.getState();
    return {
      status: s.status,
      currentQuestion: s.currentQuestion,
      totalQuestions: s.questions.length,
      currentRound: s.currentRound,
      leaderboard: await this.buildLeaderboard(),
      playerCount: this.playerCount(),
    };
  }

  async buildLeaderboard() {
    const scores = (await this.state.storage.get('scores')) || {};
    return Object.entries(scores)
      .map(([team, score]) => ({ team, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
  }

  playerCount() {
    return [...this.sessions.values()].filter(s => s.role === 'player').length;
  }

  broadcast(msg, toRole = null, excludeSessionId = null) {
    const text = JSON.stringify(msg);
    for (const [sid, sess] of this.sessions) {
      if (excludeSessionId && sid === excludeSessionId) continue;
      if (toRole && sess.role !== toRole) continue;
      try { sess.ws.send(text); } catch {}
    }
  }
}

// ─── Main Worker ──────────────────────────────────────────────────────────────


// ─── KBT Slide Builder (Phase 28B) ───────────────────────────────────────────

// Google Service Account JWT auth
function b64url(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function b64urlBytes(bytes) {
  let binary = '';
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
async function getGoogleToken(env) {
  if (env.GOOGLE_ACCESS_TOKEN) return env.GOOGLE_ACCESS_TOKEN;
  const email = env.GOOGLE_CLIENT_EMAIL;
  let pem = env.GOOGLE_PRIVATE_KEY;
  if (!email || !pem) return null;
  pem = pem.replace(/\\n/g, '\n');
  const pemBody = pem.replace('-----BEGIN PRIVATE KEY-----','')
    .replace('-----END PRIVATE KEY-----','').replace(/\s/g,'');
  const derBytes = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', derBytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/presentations https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600, iat: now,
  }));
  const sigInput = new TextEncoder().encode(header + '.' + payload);
  const sigBytes = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, sigInput);
  const sig = b64urlBytes(sigBytes);
  const jwt = header + '.' + payload + '.' + sig;
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt,
  });
  const data = await resp.json();
  return data.access_token || null;
}

async function buildSlides(env, { topic = 'general knowledge', count = 10, gameTitle = 'Kow Brainer Trivia', token = null }) {
  const pin = env.AGENT_PIN || '';
  const BRAIN_URL = 'https://falkor-brain.luckdragon.io';

  // 1. Generate questions from falkor-kbt /generate
  let questions = [];
  try {
    const genResp = await fetch('https://falkor-kbt.luckdragon.io/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Pin': pin },
      body: JSON.stringify({ topic, count }),
    });
    if (genResp.ok) {
      const genData = await genResp.json();
      questions = genData.questions || [];
    }
  } catch(e) { console.warn('generate failed:', e.message); }

  if (questions.length === 0) {
    return { ok: false, error: 'Could not generate questions for: ' + topic };
  }

  // 2. Build HTML slide deck (always available)
  const accentColors = ['#6c63ff','#f59e0b','#ef4444','#22c55e','#3b82f6','#a855f7','#ec4899'];
  const slideHtml = questions.map(function(q, i) {
    var accent = accentColors[i % accentColors.length];
    var qText = typeof q === 'string' ? q : (q.question || q.q || JSON.stringify(q));
    var aText = typeof q === 'object' ? (q.answer || q.a || '') : '';
    var cat = typeof q === 'object' ? (q.category || q.cat || topic) : topic;
    return '<div class="slide" style="background:#fff;border-radius:16px;padding:40px 48px;margin-bottom:20px;box-shadow:0 4px 20px rgba(0,0,0,.08);border-left:6px solid '+accent+';page-break-after:always">' +
      '<div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:'+accent+';font-weight:700;margin-bottom:16px">Q' + (i+1) + ' · ' + cat + '</div>' +
      '<div style="font-size:22px;font-weight:800;color:#1a1a2e;line-height:1.4;margin-bottom:' + (aText ? '24px' : '0') + '">' + qText + '</div>' +
      (aText ? '<div style="background:'+accent+'15;border-radius:10px;padding:12px 20px;border:1px solid '+accent+'33"><span style="font-size:12px;font-weight:700;color:'+accent+';text-transform:uppercase;letter-spacing:1px">Answer: </span><span style="font-size:16px;font-weight:600;color:#1a1a2e">' + aText + '</span></div>' : '') +
      '</div>';
  }).join('');

  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + gameTitle + ' — ' + topic + '</title>' +
    '<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f4f4f8;margin:0;padding:24px}' +
    '.header{background:linear-gradient(135deg,#6c63ff,#a78bfa);color:#fff;border-radius:16px;padding:32px 40px;margin-bottom:24px}' +
    '.header h1{margin:0 0 8px;font-size:28px;font-weight:900}' +
    '.header p{margin:0;opacity:.85;font-size:14px}' +
    '@media print{body{padding:0}.slide{box-shadow:none;border-radius:0;margin:0;page-break-after:always}}' +
    '</style></head><body>' +
    '<div class="header"><div style="font-size:32px;margin-bottom:8px">🐉 Kow Brainer Trivia</div>' +
    '<h1>' + gameTitle + '</h1><p>' + questions.length + ' questions · Topic: ' + topic + '</p></div>' +
    slideHtml +
    '</body></html>';

  const result = { ok: true, topic, count: questions.length, questions, html };

  // 3. Google Slides API — activate if token available
  const gToken = token || await getGoogleToken(env).catch(() => null) || '';
  const DRIVE_TEMPLATE_FOLDER = '1-z8QMj_9YAGrqJhzHNoBMRFg3t6JanZa';

  if (gToken) {
    try {
      // Find a suitable template in the Drive folder
      const listResp = await fetch(
        'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent("'" + DRIVE_TEMPLATE_FOLDER + "' in parents and trashed=false") + '&pageSize=5&fields=files(id,name)',
        { headers: { 'Authorization': 'Bearer ' + gToken } }
      );
      if (listResp.ok) {
        const listData = await listResp.json();
        const templates = listData.files || [];
        if (templates.length > 0) {
          const template = templates[0];
          // Copy the template
          const copyResp = await fetch('https://www.googleapis.com/drive/v3/files/' + template.id + '/copy', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + gToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: gameTitle + ' — ' + topic + ' (' + new Date().toLocaleDateString('en-AU') + ')' }),
          });
          if (copyResp.ok) {
            const copyData = await copyResp.json();
            const slidesId = copyData.id;
            const slidesUrl = 'https://docs.google.com/presentation/d/' + slidesId + '/edit';

            // Get slides to find text placeholders
            const slidesResp = await fetch(
              'https://slides.googleapis.com/v1/presentations/' + slidesId,
              { headers: { 'Authorization': 'Bearer ' + gToken } }
            );
            if (slidesResp.ok) {
              const pres = await slidesResp.json();
              const slides = pres.slides || [];
              const requests = [];

              // Replace [answer_text] placeholders with actual answers
              for (var i = 0; i < slides.length && i < questions.length; i++) {
                var q2 = questions[i];
                var aText2 = typeof q2 === 'object' ? (q2.answer || q2.a || '') : '';
                if (aText2) {
                  requests.push({
                    replaceAllText: {
                      containsText: { text: '[answer_text]', matchCase: false },
                      replaceText: aText2,
                      pageObjectIds: [slides[i].objectId],
                    }
                  });
                }
              }

              if (requests.length > 0) {
                await fetch('https://slides.googleapis.com/v1/presentations/' + slidesId + ':batchUpdate', {
                  method: 'POST',
                  headers: { 'Authorization': 'Bearer ' + gToken, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ requests }),
                });
              }

              result.slides_url = slidesUrl;
              result.slides_id = slidesId;
              result.template_used = template.name;
            }
          }
        }
      }
    } catch(e2) { result.slides_error = e2.message; }
  } else {
    result.slides_note = 'To enable: add GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY secrets from Google Service Account JSON';
  }

  return result;
}



// ─── Public Player Interface (Phase 39) ─────────────────────────────────────
function buildPlayerHTML(initialCode) {
  const code = (initialCode || '').toUpperCase();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>Kow Brainer Trivia${code ? ' — ' + code : ''}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f0f1a;color:#f0f0ff;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px}
.screen{width:100%;max-width:480px;display:none;flex-direction:column;align-items:center;gap:20px}
.screen.active{display:flex}
.logo{font-size:48px;margin-bottom:4px}
.title{font-size:22px;font-weight:900;color:#a78bfa;letter-spacing:-0.5px}
.sub{font-size:14px;color:#8888aa;text-align:center}
input[type=text]{width:100%;padding:14px 18px;border:2px solid #2d2d4e;border-radius:12px;background:#1a1a30;color:#f0f0ff;font-size:18px;font-weight:700;letter-spacing:2px;text-align:center;text-transform:uppercase;outline:none;transition:border .2s}
input[type=text]:focus{border-color:#7c3aed}
input.ni{letter-spacing:0;font-weight:600;font-size:16px}
.btn{width:100%;padding:16px;border:none;border-radius:14px;font-size:18px;font-weight:800;cursor:pointer;transition:all .15s}
.bp{background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff}
.bp:active{transform:scale(.97)}
.lobby-box{width:100%;background:#1a1a30;border:1px solid #2d2d4e;border-radius:16px;padding:24px;text-align:center}
.pc{font-size:36px;font-weight:900;color:#a78bfa}
.pulse{animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
.qn{font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#7c3aed;font-weight:700}
.qc{display:inline-block;padding:4px 12px;border-radius:20px;background:#7c3aed22;color:#a78bfa;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px}
.qt{font-size:22px;font-weight:800;line-height:1.4;color:#f0f0ff;text-align:center}
.tb{width:100%;height:6px;background:#1a1a30;border-radius:3px;overflow:hidden}
.tf{height:100%;background:linear-gradient(90deg,#7c3aed,#ec4899);border-radius:3px}
.ai{letter-spacing:0;text-transform:none;font-size:18px}
.fb{width:100%;padding:20px;border-radius:14px;text-align:center;font-size:24px;font-weight:900}
.fb.ok{background:#16a34a22;border:2px solid #16a34a;color:#4ade80}
.fb.no{background:#dc262622;border:2px solid #dc2626;color:#f87171}
.fb.wt{background:#1a1a30;border:2px solid #2d2d4e;color:#8888aa;font-size:18px}
.rb{width:100%;padding:20px;background:#7c3aed22;border:2px solid #7c3aed44;border-radius:14px;text-align:center}
.rl{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#7c3aed;font-weight:700;margin-bottom:8px}
.rv{font-size:22px;font-weight:900;color:#a78bfa}
.ff{width:100%;padding:14px 18px;background:#1a1a30;border-radius:12px;font-size:14px;color:#8888aa;line-height:1.5;border-left:3px solid #7c3aed}
.lb{width:100%;background:#1a1a30;border-radius:14px;overflow:hidden}
.lbh{padding:12px 18px;background:#7c3aed22;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#7c3aed;font-weight:700}
.lbr{display:flex;align-items:center;padding:10px 18px;border-top:1px solid #2d2d4e}
.lbp{width:28px;font-size:16px;font-weight:900;color:#8888aa}
.g1{color:#fbbf24}.g2{color:#94a3b8}.g3{color:#b45309}
.lbt{flex:1;font-weight:700;font-size:15px}
.lbs{font-size:16px;font-weight:900;color:#a78bfa}
.lbme{background:#7c3aed11}
.got{font-size:32px;font-weight:900;text-align:center}
.disc{width:100%;max-width:480px;padding:10px 16px;background:#7f1d1d;border-radius:10px;text-align:center;font-size:14px;color:#fca5a5;display:none;position:fixed;top:16px;left:50%;transform:translateX(-50%)}
</style>
</head>
<body>
<div class="disc" id="disc">Reconnecting... ⚡</div>
<div class="screen active" id="sE">
  <div class="logo">🐉</div>
  <div class="title">Kow Brainer Trivia</div>
  <div class="sub">Enter your game code to join</div>
  <input type="text" id="cIn" placeholder="GAME CODE" maxlength="6" value="${code}" autocomplete="off" autocapitalize="characters" spellcheck="false">
  <input type="text" class="ni" id="nIn" placeholder="Your team name" maxlength="24" autocomplete="off" spellcheck="false">
  <button class="btn bp" onclick="joinGame()">JOIN GAME 🚀</button>
  <div class="sub" id="eErr" style="color:#f87171;min-height:20px"></div>
</div>
<div class="screen" id="sL">
  <div class="logo pulse">🐉</div>
  <div class="title" id="lCode"></div>
  <div class="lobby-box">
    <div style="font-size:13px;color:#8888aa;margin-bottom:8px">PLAYERS JOINED</div>
    <div class="pc" id="pCnt">0</div>
    <div style="font-size:13px;color:#8888aa;margin-top:8px">Waiting for host to start...</div>
  </div>
  <div class="sub" id="lName"></div>
</div>
<div class="screen" id="sQ">
  <div style="display:flex;justify-content:space-between;align-items:center;width:100%">
    <span class="qn" id="qNum">Q 1/10</span>
    <span class="qc" id="qCat">Trivia</span>
  </div>
  <div class="tb"><div class="tf" id="tFill" style="width:100%"></div></div>
  <div class="qt" id="qTxt"></div>
  <input type="text" class="ai" id="aIn" placeholder="Your answer..." autocomplete="off" spellcheck="false">
  <button class="btn bp" id="subBtn" onclick="subAns()">SUBMIT ✓</button>
</div>
<div class="screen" id="sA">
  <div class="qt" id="aQTxt" style="font-size:18px;color:#8888aa"></div>
  <div class="fb" id="aFb">⏳ Answer submitted...</div>
</div>
<div class="screen" id="sR">
  <div class="qt" id="rQTxt" style="font-size:18px;color:#8888aa"></div>
  <div class="rb"><div class="rl">The answer was</div><div class="rv" id="rAns"></div></div>
  <div class="ff" id="rFF" style="display:none"></div>
  <div class="lb"><div class="lbh">🏆 Leaderboard</div><div id="rLb"></div></div>
  <div class="sub" style="color:#8888aa">Next question coming up...</div>
</div>
<div class="screen" id="sGO">
  <div class="got">🏆 Game Over!</div>
  <div class="sub">Final Results</div>
  <div class="lb"><div class="lbh">FINAL LEADERBOARD</div><div id="fLb"></div></div>
  <div class="sub" style="color:#8888aa;margin-top:8px">Thanks for playing Kow Brainer Trivia! 🐉</div>
</div>
<script>
var ws=null,myName='',myCode='',curQ=null,tInt=null,answered=false;
var SS=['sE','sL','sQ','sA','sR','sGO'];
function show(id){SS.forEach(function(s){document.getElementById(s).classList.remove('active');});document.getElementById(id).classList.add('active');}
function joinGame(){
  var c=document.getElementById('cIn').value.trim().toUpperCase();
  var n=document.getElementById('nIn').value.trim();
  if(c.length<4){document.getElementById('eErr').textContent='Please enter a valid game code';return;}
  if(!n){document.getElementById('nIn').focus();document.getElementById('eErr').textContent='Please enter your team name';return;}
  myCode=c;myName=n;document.getElementById('eErr').textContent='';connect();
}
function connect(){
  var p=location.protocol==='https:'?'wss:':'ws:';
  ws=new WebSocket(p+'//'+location.host+'/game/play/'+myCode+'?name='+encodeURIComponent(myName));
  ws.onopen=function(){document.getElementById('disc').style.display='none';};
  ws.onmessage=function(e){handle(JSON.parse(e.data));};
  ws.onerror=function(){document.getElementById('disc').style.display='block';};
  ws.onclose=function(){document.getElementById('disc').style.display='block';setTimeout(function(){if(myCode)connect();},3000);};
}
function handle(m){
  switch(m.type){
    case 'connected':
      show('sL');
      document.getElementById('lCode').textContent=myCode;
      document.getElementById('lName').textContent='Playing as: '+myName;
      var gs=m.gameState||{};
      document.getElementById('pCnt').textContent=gs.playerCount||0;
      if(gs.status==='active')show('sQ');
      if(gs.status==='finished')show('sGO');
      break;
    case 'player_joined':document.getElementById('pCnt').textContent=m.playerCount||0;break;
    case 'game_started':show('sL');break;
    case 'question':
      curQ=m;answered=false;
      document.getElementById('qNum').textContent='Q '+m.number+'/'+(m.total||'?');
      document.getElementById('qCat').textContent=m.category||'Trivia';
      document.getElementById('qTxt').textContent=m.text;
      document.getElementById('aIn').value='';
      document.getElementById('subBtn').disabled=false;
      document.getElementById('subBtn').textContent='SUBMIT ✓';
      startT(m.timeLimit||30);show('sQ');
      setTimeout(function(){document.getElementById('aIn').focus();},100);
      break;
    case 'answer_received':
      clearT();
      document.getElementById('aQTxt').textContent=curQ?curQ.text:'';
      var fb=document.getElementById('aFb');
      if(m.correct===true){fb.className='fb ok';fb.textContent='✅ Correct! Well done!';}
      else if(m.correct===false){fb.className='fb no';fb.textContent='❌ Wrong — wait for the answer...';}
      else{fb.className='fb wt';fb.textContent='⏳ Answer submitted — waiting for results...';}
      show('sA');break;
    case 'answer_revealed':
      clearT();
      document.getElementById('rQTxt').textContent=curQ?curQ.text:'';
      document.getElementById('rAns').textContent=m.answer||'';
      var ff=document.getElementById('rFF');
      if(m.fun_fact){ff.textContent='💡 '+m.fun_fact;ff.style.display='block';}else{ff.style.display='none';}
      rLb('rLb',m.leaderboard||[]);show('sR');break;
    case 'scores_updated':rLb('rLb',m.leaderboard||[]);break;
    case 'game_over':clearT();rLb('fLb',m.leaderboard||[]);show('sGO');break;
  }
}
function rLb(id,lb){
  var M=['🥇','🥈','🥉'],C=['g1','g2','g3'],h='';
  lb.forEach(function(r,i){
    var me=r.team===myName;
    h+='<div class="lbr'+(me?' lbme':'')+'"><div class="lbp '+(C[i]||'')+'">'+(M[i]||(i+1))+'</div><div class="lbt">'+r.team+(me?' 👉you':'')+'</div><div class="lbs">'+r.score+' pts</div></div>';
  });
  document.getElementById(id).innerHTML=h||'<div class="lbr"><div style="color:#8888aa;font-size:14px;padding:4px">No scores yet</div></div>';
}
function subAns(){
  if(answered)return;
  var a=document.getElementById('aIn').value.trim();if(!a)return;
  answered=true;document.getElementById('subBtn').disabled=true;document.getElementById('subBtn').textContent='Submitted!';
  ws.send(JSON.stringify({type:'submit_answer',answer:a}));
}
function startT(sec){
  clearT();var fill=document.getElementById('tFill'),s=Date.now();
  fill.style.transition='none';fill.style.width='100%';
  tInt=setInterval(function(){
    var p=Math.max(0,100-((Date.now()-s)/sec/1000*100));
    fill.style.transition='width .5s linear';fill.style.width=p+'%';
    if(p<=0){clearT();if(!answered){answered=true;ws&&ws.send(JSON.stringify({type:'submit_answer',answer:''}));}}
  },500);
}
function clearT(){if(tInt){clearInterval(tInt);tInt=null;}}
document.getElementById('aIn').addEventListener('keydown',function(e){if(e.key==='Enter')subAns();});
window.addEventListener('load',function(){if(document.getElementById('cIn').value.length>=4)document.getElementById('nIn').focus();});
</script>
</body>
</html>`;
}



// ─── Host Control Panel (Phase 40) ───────────────────────────────────────────
function buildHostHTML(initialCode) {
  const code = (initialCode || '').toUpperCase();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>KBT Host${code ? ' — ' + code : ''}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f0f1a;color:#f0f0ff;min-height:100vh;padding:16px}
.hdr{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid #2d2d4e;margin-bottom:20px}
.hdr h1{font-size:18px;font-weight:900;color:#a78bfa}
.badge{padding:4px 10px;border-radius:20px;font-size:12px;font-weight:700}
.badge.live{background:#16a34a22;color:#4ade80;border:1px solid #16a34a}
.badge.lobby{background:#7c3aed22;color:#a78bfa;border:1px solid #7c3aed}
.card{background:#1a1a30;border:1px solid #2d2d4e;border-radius:14px;padding:20px;margin-bottom:16px}
.card h2{font-size:14px;text-transform:uppercase;letter-spacing:1px;color:#7c3aed;font-weight:700;margin-bottom:12px}
.stat-row{display:flex;gap:16px;margin-bottom:4px}
.stat{flex:1;text-align:center;padding:12px;background:#0f0f1a;border-radius:10px}
.stat .n{font-size:28px;font-weight:900;color:#a78bfa}
.stat .l{font-size:11px;color:#8888aa;margin-top:2px}
input[type=text],select,textarea{width:100%;padding:10px 14px;border:1px solid #2d2d4e;border-radius:10px;background:#0f0f1a;color:#f0f0ff;font-size:14px;outline:none;margin-bottom:10px}
textarea{min-height:80px;resize:vertical;font-size:13px}
.btn{width:100%;padding:14px;border:none;border-radius:12px;font-size:16px;font-weight:800;cursor:pointer;margin-bottom:8px;transition:all .1s}
.btn:active{transform:scale(.97)}
.btn-g{background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff}
.btn-b{background:#1a1a30;border:1px solid #2d2d4e;color:#f0f0ff}
.btn-r{background:#dc262622;border:1px solid #dc2626;color:#f87171}
.btn-gr{background:#16a34a22;border:1px solid #16a34a;color:#4ade80}
.btn:disabled{opacity:.4;cursor:not-allowed}
.q-list{max-height:200px;overflow-y:auto}
.q-item{padding:10px 12px;border-bottom:1px solid #2d2d4e;font-size:13px;display:flex;align-items:flex-start;gap:8px}
.q-item .qn{font-size:11px;color:#7c3aed;font-weight:700;white-space:nowrap;padding-top:2px}
.q-item .qt{flex:1;line-height:1.4}
.q-item .qa{font-size:12px;color:#8888aa;margin-top:2px}
.cur-q{background:#7c3aed22;border:1px solid #7c3aed;border-radius:10px;padding:16px;margin-bottom:12px}
.cur-q .label{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#7c3aed;font-weight:700;margin-bottom:8px}
.cur-q .text{font-size:16px;font-weight:700;line-height:1.4}
.cur-q .ans{font-size:13px;color:#4ade80;margin-top:6px}
.lb-row{display:flex;align-items:center;padding:8px 12px;border-bottom:1px solid #2d2d4e}
.lb-pos{width:24px;font-size:14px;font-weight:900;color:#8888aa}
.g1{color:#fbbf24}.g2{color:#94a3b8}.g3{color:#b45309}
.lb-team{flex:1;font-size:14px;font-weight:700}
.lb-sc{font-size:14px;font-weight:900;color:#a78bfa}
.share-box{background:#0f0f1a;border:1px solid #2d2d4e;border-radius:8px;padding:10px 14px;font-size:13px;color:#a78bfa;word-break:break-all;margin-bottom:8px}
.msg{padding:8px 12px;border-radius:8px;font-size:13px;margin-bottom:8px;display:none}
.msg.ok{background:#16a34a22;color:#4ade80;display:block}
.msg.err{background:#dc262622;color:#f87171;display:block}
</style>
</head>
<body>
<div class="hdr">
  <h1>🐉 KBT Host${code ? ' — ' + code : ''}</h1>
  <span class="badge lobby" id="statusBadge">LOBBY</span>
</div>

<!-- Setup: enter code + token if not in URL -->
<div id="setupCard" class="card" style="${code ? 'display:none' : ''}">
  <h2>Connect to Game</h2>
  <input type="text" id="setupCode" placeholder="Game code (e.g. ABCD12)" value="${code}" autocapitalize="characters">
  <input type="text" id="setupToken" placeholder="Host token (from /game/create response)">
  <button class="btn btn-g" onclick="connectHost()">CONNECT AS HOST</button>
  <div class="msg" id="setupMsg"></div>
</div>

<!-- Stats row -->
<div class="card" id="statsCard" style="${code ? '' : 'display:none'}">
  <div class="stat-row">
    <div class="stat"><div class="n" id="statPlayers">0</div><div class="l">Players</div></div>
    <div class="stat"><div class="n" id="statQ">0/0</div><div class="l">Question</div></div>
    <div class="stat"><div class="n" id="statAnswered">0</div><div class="l">Answered</div></div>
  </div>
  <div style="margin-top:12px">
    <div class="share-box" id="joinUrl"></div>
    <button class="btn btn-b" onclick="copyJoin()">📋 Copy Player Join Link</button>
  </div>
</div>

<!-- Load Questions -->
<div class="card" id="loadQCard" style="${code ? '' : 'display:none'}">
  <h2>Load Questions</h2>
  <input type="text" id="genTopic" placeholder="Topic (e.g. Australian Sport, 90s Music)">
  <select id="genCount">
    <option value="5">5 questions</option>
    <option value="10" selected>10 questions</option>
    <option value="15">15 questions</option>
    <option value="20">20 questions</option>
  </select>
  <button class="btn btn-g" id="genBtn" onclick="generateQs()">🤖 Generate AI Questions</button>
  <div class="msg" id="genMsg"></div>
  <div id="qList" class="q-list" style="display:none"></div>
  <button class="btn btn-gr" id="sendQBtn" style="display:none;margin-top:8px" onclick="sendQsToGame()">✓ Load into Game</button>
</div>

<!-- Game Controls -->
<div class="card" id="ctrlCard" style="${code ? '' : 'display:none'}">
  <h2>Game Controls</h2>
  <div class="cur-q" id="curQBox" style="display:none">
    <div class="label" id="curQLabel">Current Question</div>
    <div class="text" id="curQText"></div>
    <div class="ans" id="curQAns" style="display:none"></div>
  </div>
  <button class="btn btn-gr" id="startBtn" onclick="startGame()">▶ START GAME</button>
  <button class="btn btn-g" id="nextBtn" onclick="nextQ()" style="display:none">NEXT QUESTION →</button>
  <button class="btn btn-b" id="revealBtn" onclick="revealAns()" style="display:none">REVEAL ANSWER 👁</button>
  <button class="btn btn-r" id="endBtn" onclick="endGame()" style="display:none">END GAME</button>
</div>

<!-- Leaderboard -->
<div class="card" id="lbCard" style="${code ? '' : 'display:none'}">
  <h2>Live Leaderboard</h2>
  <div id="lbList"><div style="color:#8888aa;font-size:13px">No scores yet</div></div>
</div>

<script>
var ws=null, myCode='${code}', myToken='', gameState=null, loadedQs=[], answered=0, totalPlayers=0, qIndex=0, totalQs=0;

window.addEventListener('load', function() {
  var params = new URLSearchParams(location.search);
  var t = params.get('token');
  if(t) { myToken = t; }
  if(myCode && myToken) connectHost();
  else if(myCode) { document.getElementById('setupCode').value = myCode; document.getElementById('setupCard').style.display = 'block'; }
  document.getElementById('joinUrl').textContent = location.origin + '/join/' + (myCode||'GAMECODE');
});

function connectHost() {
  var c = document.getElementById('setupCode').value.trim().toUpperCase();
  var t = document.getElementById('setupToken').value.trim() || myToken;
  if(!c || !t) { showMsg('setupMsg','Code and token required','err'); return; }
  myCode = c; myToken = t;
  document.getElementById('joinUrl').textContent = location.origin + '/join/' + myCode;
  var p = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(p+'//'+location.host+'/game/host/'+myCode+'?role=host&token='+encodeURIComponent(myToken));
  ws.onopen = function() {
    document.getElementById('setupCard').style.display = 'none';
    showCards(true);
  };
  ws.onmessage = function(e) { handle(JSON.parse(e.data)); };
  ws.onerror = function() { showMsg('setupMsg','Connection failed — check code and token','err'); };
  ws.onclose = function() { document.getElementById('statusBadge').className = 'badge'; document.getElementById('statusBadge').textContent = 'DISCONNECTED'; };
}

function showCards(v) {
  ['statsCard','loadQCard','ctrlCard','lbCard'].forEach(function(id) {
    document.getElementById(id).style.display = v ? '' : 'none';
  });
}

function handle(m) {
  switch(m.type) {
    case 'connected':
      gameState = m.gameState || {};
      updateStatus(gameState.status || 'lobby');
      updateLb(gameState.leaderboard || []);
      totalQs = gameState.totalQuestions || 0;
      qIndex = gameState.currentQuestion || 0;
      updateQStat();
      break;
    case 'player_joined':
      totalPlayers = m.playerCount || totalPlayers + 1;
      document.getElementById('statPlayers').textContent = totalPlayers;
      break;
    case 'player_left':
      totalPlayers = m.playerCount || Math.max(0, totalPlayers - 1);
      document.getElementById('statPlayers').textContent = totalPlayers;
      break;
    case 'player_answered':
      answered = m.answeredCount || answered + 1;
      document.getElementById('statAnswered').textContent = answered + '/' + m.totalPlayers;
      break;
    case 'questions_set':
      showMsg('genMsg', m.count + ' questions loaded into game!', 'ok');
      document.getElementById('startBtn').style.display = '';
      document.getElementById('nextBtn').style.display = 'none';
      break;
    case 'game_started':
      updateStatus('active');
      document.getElementById('startBtn').style.display = 'none';
      document.getElementById('nextBtn').style.display = '';
      document.getElementById('endBtn').style.display = '';
      break;
    case 'question':
      qIndex = m.number; totalQs = m.total;
      updateQStat();
      answered = 0;
      document.getElementById('statAnswered').textContent = '0';
      showCurQ(m.text, m.category, '', false);
      document.getElementById('revealBtn').style.display = '';
      document.getElementById('nextBtn').style.display = 'none';
      break;
    case 'answer_revealed':
      updateLb(m.leaderboard || []);
      var curQ2 = loadedQs[qIndex-1];
      if(curQ2) showCurQ(curQ2.question, curQ2.category, m.answer, true);
      document.getElementById('revealBtn').style.display = 'none';
      document.getElementById('nextBtn').style.display = '';
      break;
    case 'scores_updated':
      updateLb(m.leaderboard || []);
      break;
    case 'game_over':
      updateStatus('finished');
      updateLb(m.leaderboard || []);
      document.getElementById('nextBtn').style.display = 'none';
      document.getElementById('revealBtn').style.display = 'none';
      document.getElementById('endBtn').style.display = 'none';
      // Phase 55: auto-send Telegram summary
      setTimeout(function() {
        fetch('/game/' + myCode + '/summarize', {
          method: 'POST',
          headers: { 'X-Pin': myToken, 'Content-Type': 'application/json' }
        }).then(function(r) { return r.json(); }).then(function(d) {
          var statusEl = document.getElementById('statusBadge');
          if (statusEl) statusEl.title = d.sent ? 'Summary sent to Telegram' : (d.reason || 'Summary not sent');
        }).catch(function(){});
      }, 2000);
      break;
  }
}

function updateStatus(s) {
  var b = document.getElementById('statusBadge');
  if(s === 'active') { b.className = 'badge live'; b.textContent = 'LIVE'; }
  else if(s === 'finished') { b.className = 'badge'; b.textContent = 'DONE'; b.style.background='#1a1a30'; }
  else { b.className = 'badge lobby'; b.textContent = 'LOBBY'; }
}

function updateQStat() {
  document.getElementById('statQ').textContent = qIndex + '/' + totalQs;
}

function updateLb(lb) {
  var M=['🥇','🥈','🥉'], C=['g1','g2','g3'], h='';
  lb.forEach(function(r,i) {
    h += '<div class="lb-row"><div class="lb-pos '+(C[i]||'')+'">'+(M[i]||(i+1))+'</div><div class="lb-team">'+r.team+'</div><div class="lb-sc">'+r.score+' pts</div></div>';
  });
  document.getElementById('lbList').innerHTML = h || '<div style="color:#8888aa;font-size:13px">No scores yet</div>';
}

function showCurQ(text, cat, ans, revealed) {
  var box = document.getElementById('curQBox');
  box.style.display = '';
  document.getElementById('curQLabel').textContent = 'Q' + qIndex + '/' + totalQs + (cat ? ' — ' + cat : '');
  document.getElementById('curQText').textContent = text;
  var aEl = document.getElementById('curQAns');
  if(revealed && ans) { aEl.textContent = 'Answer: ' + ans; aEl.style.display = ''; }
  else { aEl.style.display = 'none'; }
}

async function generateQs() {
  var topic = document.getElementById('genTopic').value.trim() || 'general knowledge';
  var count = parseInt(document.getElementById('genCount').value);
  document.getElementById('genBtn').disabled = true;
  document.getElementById('genBtn').textContent = 'Generating...';
  showMsg('genMsg','Asking the AI... give it a few seconds','ok');
  try {
    var resp = await fetch('/questions/generate', {
      method:'POST',
      headers:{'Content-Type':'application/json','X-Pin': prompt('Enter host PIN') || ''},
      body: JSON.stringify({category: topic, count: count, theme: topic})
    });
    var d = await resp.json();
    if(!d.ok) { showMsg('genMsg', d.error || 'Generation failed', 'err'); return; }
    loadedQs = d.questions;
    renderQList(loadedQs);
    showMsg('genMsg', d.count + ' questions ready — click Load into Game', 'ok');
    document.getElementById('sendQBtn').style.display = '';
  } catch(e) { showMsg('genMsg', 'Error: '+e.message, 'err'); }
  finally { document.getElementById('genBtn').disabled=false; document.getElementById('genBtn').textContent='🤖 Generate AI Questions'; }
}

function renderQList(qs) {
  var list = document.getElementById('qList');
  list.style.display = '';
  list.innerHTML = qs.map(function(q,i) {
    return '<div class="q-item"><div class="qn">Q'+(i+1)+'</div><div class="qt">'+q.question+'<div class="qa">→ '+q.answer+'</div></div></div>';
  }).join('');
}

function sendQsToGame() {
  if(!ws || !loadedQs.length) return;
  ws.send(JSON.stringify({type:'set_questions', questions: loadedQs}));
  totalQs = loadedQs.length;
  updateQStat();
}

function startGame() { ws && ws.send(JSON.stringify({type:'start_game'})); }
function nextQ(tl) { ws && ws.send(JSON.stringify({type:'next_question', timeLimit: tl||30})); }
function revealAns() { ws && ws.send(JSON.stringify({type:'reveal_answer'})); }
function endGame() { if(confirm('End game?')) ws && ws.send(JSON.stringify({type:'end_game'})); }

function copyJoin() {
  var txt = document.getElementById('joinUrl').textContent;
  navigator.clipboard.writeText(txt).then(function() { alert('Copied: ' + txt); });
}

function showMsg(id, msg, type) {
  var el = document.getElementById(id);
  el.textContent = msg; el.className = 'msg ' + type;
}

// PIN prompt replacement — use query param if provided
(function() {
  var params = new URLSearchParams(location.search);
  var pin = params.get('pin');
  if(pin) {
    var orig = window.fetch;
    window.fetch = function(url, opts) {
      opts = opts || {};
      opts.headers = opts.headers || {};
      if(!opts.headers['X-Pin']) opts.headers['X-Pin'] = pin;
      return orig(url, opts);
    };
    // Override prompt
    window.prompt = function(msg, def) { return pin; };
  }
})();
</script>
</body>
</html>`;
}


export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

    // Health
    if (path === '/google-auth-test') {
      if (!pinOk(request, env)) return err('Unauthorized', 401);
      const tok = await getGoogleToken(env).catch(e => null);
      if (!tok) return json({ ok: false, msg: 'No token — add GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY secrets' });
      const FOLDER_ID = '1-z8QMj_9YAGrqJhzHNoBMRFg3t6JanZa';
      const listResp = await fetch(
        'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent("'" + FOLDER_ID + "' in parents") + '&fields=files(id,name)',
        { headers: { Authorization: 'Bearer ' + tok } }
      );
      const listData = await listResp.json();
      return json({ ok: true, token_prefix: tok.substring(0, 20) + '...', folder_files: listData.files || listData.error });
    }
    if (path === '/health') {
      let dbOk = false;
      try { await env.KBT_DB.prepare('SELECT 1').run(); dbOk = true; } catch {}
      return json({ ok: true, worker: WORKER_NAME, version: VERSION, db: dbOk ? 'ok' : 'error' });
    }


    // ── DB init (Phase 55: add kbt_game_results table) ───────────────────────
    if (path === '/init' && method === 'POST') {
      if (!pinOk(request, env)) return err('Unauthorized', 401);
      try {
        await env.KBT_DB.prepare(`CREATE TABLE IF NOT EXISTS kbt_game_results (
          id TEXT PRIMARY KEY,
          code TEXT NOT NULL,
          winner TEXT,
          leaderboard TEXT,
          player_count INTEGER DEFAULT 0,
          question_count INTEGER DEFAULT 0,
          ended_at TEXT,
          telegram_sent INTEGER DEFAULT 0
        )`).run();
        return json({ ok: true, message: 'DB initialised' });
      } catch(e) { return err('Init failed: ' + e.message); }
    }

    // ── Recent game results (Phase 55) ────────────────────────────────────────
    if (path === '/game/results' && method === 'GET') {
      if (!pinOk(request, env)) return err('Unauthorized', 401);
      try {
        // Auto-create table if needed
        await env.KBT_DB.prepare(`CREATE TABLE IF NOT EXISTS kbt_game_results (id TEXT PRIMARY KEY, code TEXT NOT NULL, winner TEXT, leaderboard TEXT, player_count INTEGER DEFAULT 0, question_count INTEGER DEFAULT 0, ended_at TEXT, telegram_sent INTEGER DEFAULT 0)`).run().catch(()=>{});
        const rows = await env.KBT_DB.prepare(`SELECT * FROM kbt_game_results ORDER BY ended_at DESC LIMIT 20`).all();
        return json({ ok: true, results: rows.results || [] });
      } catch(e) { return err(e.message); }
    }

    // ── Post-game Telegram summary (Phase 55) ─────────────────────────────────
    if (path.startsWith('/game/') && path.endsWith('/summarize') && method === 'POST') {
      if (!pinOk(request, env)) return err('Unauthorized', 401);
      const parts = path.split('/');
      const code = parts[2]?.toUpperCase();
      if (!code) return err('code required');

      // 1. Fetch DO game state
      const stub = env.GAME.get(env.GAME.idFromName(code));
      const stateResp = await stub.fetch(new Request(new URL('/state', request.url).toString()));
      const state = await stateResp.json().catch(() => ({}));

      if (state.status !== 'finished') {
        return json({ ok: false, reason: 'Game not finished yet (status: ' + (state.status || 'unknown') + ')' });
      }

      const leaderboard = state.leaderboard || [];
      const winner = leaderboard[0]?.team || 'Unknown';
      const playerCount = leaderboard.length;
      const questionCount = state.questions?.length || state.currentQuestion || 0;

      // 2. Persist to D1 (idempotent)
      const resultId = 'kbt_' + code + '_' + Date.now();
      try {
        await env.KBT_DB.prepare(`CREATE TABLE IF NOT EXISTS kbt_game_results (id TEXT PRIMARY KEY, code TEXT NOT NULL, winner TEXT, leaderboard TEXT, player_count INTEGER DEFAULT 0, question_count INTEGER DEFAULT 0, ended_at TEXT, telegram_sent INTEGER DEFAULT 0)`).run().catch(()=>{});
        const existing = await env.KBT_DB.prepare('SELECT id, telegram_sent FROM kbt_game_results WHERE code = ? ORDER BY ended_at DESC LIMIT 1').bind(code).first().catch(()=>null);
        if (existing && existing.telegram_sent) {
          return json({ ok: true, sent: false, reason: 'Summary already sent for this game', winner, playerCount });
        }
        if (!existing) {
          await env.KBT_DB.prepare('INSERT INTO kbt_game_results (id, code, winner, leaderboard, player_count, question_count, ended_at, telegram_sent) VALUES (?,?,?,?,?,?,?,0)')
            .bind(resultId, code, winner, JSON.stringify(leaderboard), playerCount, questionCount, new Date().toISOString()).run().catch(()=>{});
        }
      } catch(e) { console.warn('D1 save failed:', e.message); }

      // 3. Build leaderboard text
      const lbText = leaderboard.slice(0, 8).map((p, i) => {
        const medal = i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : (i+1) + 'th';
        return medal + ': ' + p.team + ' — ' + p.score + ' pts';
      }).join('\n');

      // 4. AI commentary using Anthropic directly
      let commentary = '';
      try {
        const aiPrompt = 'You are Falkor, Jarvis-style AI assistant. A KBT trivia game just finished. Winner: ' + winner + '. ' + playerCount + ' teams played, ' + questionCount + ' questions answered. Leaderboard: ' + leaderboard.slice(0,5).map((p,i)=>(i+1)+'. '+p.team+' ('+p.score+'pts)').join(', ') + '. Write a single punchy post-game Jarvis-style sentence (no emojis, no bullet points, max 20 words) congratulating the winner and noting the competition.';
        const aiResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 80, messages: [{ role: 'user', content: aiPrompt }] }),
        });
        if (aiResp.ok) {
          const aiData = await aiResp.json();
          commentary = (aiData.content?.[0]?.text || '').trim();
        }
      } catch(e) { console.warn('AI commentary failed:', e.message); }

      if (!commentary) commentary = winner + ' takes the crown in a hard-fought ' + playerCount + '-team battle.';

      // 5. Send Telegram
      const msg = '<b>KBT Game ' + code + ' — Results</b>\n\n' + commentary + '\n\n' + lbText + '\n\nHost another: falkor-kbt.luckdragon.io';
      let tgSent = false;
      try {
        const tgResp = await fetch('https://falkor-telegram.luckdragon.io/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Pin': env.AGENT_PIN || '' },
          body: JSON.stringify({ text: msg, parse_mode: 'HTML' }),
        });
        tgSent = tgResp.ok;
      } catch(e) { console.warn('Telegram send failed:', e.message); }

      // 6. Mark as notified
      if (tgSent) {
        await env.KBT_DB.prepare('UPDATE kbt_game_results SET telegram_sent = 1 WHERE code = ?').bind(code).run().catch(()=>{});
      }

      return json({ ok: true, sent: tgSent, winner, playerCount, questionCount, code });
    }

    // ── Game creation (PIN required) ──────────────────────────────────────────
    if (path === '/game/create' && method === 'POST') {
      if (!pinOk(request, env)) return err('Unauthorized', 401);
      const body = await request.json().catch(() => ({}));
      const code = gameCode();
      const hostToken = uid() + uid();
      const eventId = body.event_id || null;

      // Store game metadata in D1
      const gameId = uid();
      try {
        await env.KBT_DB.prepare(
          `INSERT INTO kbt_events (id, title, event_date, venue, status) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING`
        ).bind(gameId, body.title || 'Live Trivia Game', new Date().toISOString().slice(0,10), body.venue || 'TBD', 'live').run();
      } catch (e) { /* non-fatal */ }

      // Init DO with hostToken
      const stub = env.GAME.get(env.GAME.idFromName(code));
      const initResp = await stub.fetch(new Request('http://internal/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostToken, gameId, eventId }),
      }));

      return json({ ok: true, code, hostToken, gameId, ws_host: `/game/host/${code}`, ws_play: `/game/play/${code}` });
    }

    // ── WebSocket endpoints ───────────────────────────────────────────────────
    if (path.startsWith('/game/host/') || path.startsWith('/game/play/')) {
      const isHost = path.startsWith('/game/host/');
      const code = path.split('/').pop().toUpperCase();
      const stub = env.GAME.get(env.GAME.idFromName(code));
      const newUrl = new URL(request.url);
      newUrl.searchParams.set('role', isHost ? 'host' : 'player');
      return stub.fetch(new Request(newUrl.toString(), request));
    }

    // ── Game state (REST) ─────────────────────────────────────────────────────
    if (path.startsWith('/game/') && method === 'GET') {
      const code = path.split('/')[2]?.toUpperCase();
      if (!code) return err('code required');
      const stub = env.GAME.get(env.GAME.idFromName(code));
      return stub.fetch(new Request(new URL('/state', request.url).toString()));
    }

    // ── Question Bank ─────────────────────────────────────────────────────────
    if (path === '/questions/bank' && method === 'GET') {
      if (!pinOk(request, env)) return err('Unauthorized', 401);
      const category = url.searchParams.get('category') || null;
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const difficulty = url.searchParams.get('difficulty') || null;
      let q = `SELECT * FROM kbt_question_bank WHERE 1=1`;
      const params = [];
      if (category) { q += ` AND category = ?`; params.push(category); }
      if (difficulty) { q += ` AND difficulty = ?`; params.push(difficulty); }
      q += ` ORDER BY RANDOM() LIMIT ?`;
      params.push(limit);
      const rows = await env.KBT_DB.prepare(q).bind(...params).all();
      return json({ ok: true, questions: rows.results, count: rows.results.length });
    }

    if (path === '/questions/add' && method === 'POST') {
      if (!pinOk(request, env)) return err('Unauthorized', 401);
      const body = await request.json().catch(() => ({}));
      const { question, answer, category, difficulty, fun_fact, points } = body;
      if (!question || !answer) return err('question and answer required');
      await env.KBT_DB.prepare(
        `INSERT INTO kbt_question_bank (question, answer, category, difficulty, fun_fact, points) VALUES (?,?,?,?,?,?)`
      ).bind(question, answer, category || 'General Knowledge', difficulty || 'medium', fun_fact || null, points || 1).run();
      return json({ ok: true });
    }

    // ── AI Question Generation ────────────────────────────────────────────────
    if (path === '/questions/generate' && method === 'POST') {
      if (!pinOk(request, env)) return err('Unauthorized', 401);
      const body = await request.json().catch(() => ({}));
      const { category, count = 5, theme, difficulty = 'medium' } = body;

      if (!env.ANTHROPIC_API_KEY) return err('ANTHROPIC_API_KEY missing', 500);

      const prompt = `Generate ${count} trivia questions for a pub quiz event${theme ? ` with theme: "${theme}"` : ''}.
${category ? `Category: ${category}` : 'Mix of categories: Sport, Pop Culture, Science, History, Geography, Food & Drink, Music, Film & TV'}
Difficulty: ${difficulty}

Rules:
- Questions must be suitable for a mixed pub audience (ages 20-65)
- Single, unambiguous answers
- Answers should be 1-4 words max
- Include a fun follow-up fact for each

Return ONLY a JSON array:
[{"question":"...","answer":"...","category":"...","difficulty":"${difficulty}","fun_fact":"...","points":${difficulty === 'hard' ? 2 : 1}}]`;

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!resp.ok) return err('AI generation failed: ' + resp.status, 502);
      const data = await resp.json();
      const text = data.content?.[0]?.text || '[]';
      let questions = [];
      try {
        const match = text.match(/\[[\s\S]*\]/);
        questions = JSON.parse(match ? match[0] : text);
      } catch { return err('Failed to parse AI response'); }

      // Optionally save to bank
      if (body.save_to_bank) {
        for (const q of questions) {
          try {
            await env.KBT_DB.prepare(
              `INSERT INTO kbt_question_bank (question, answer, category, difficulty, fun_fact, points) VALUES (?,?,?,?,?,?)`
            ).bind(q.question, q.answer, q.category || category || 'General Knowledge', q.difficulty || difficulty, q.fun_fact || null, q.points || 1).run();
          } catch {}
        }
      }

      return json({ ok: true, questions, count: questions.length, saved: body.save_to_bank || false });
    }

    // ── Suno Music Prompt Generator ───────────────────────────────────────────
    if (path === '/music/prompt' && method === 'POST') {
      if (!pinOk(request, env)) return err('Unauthorized', 401);
      const body = await request.json().catch(() => ({}));
      const { event_type = 'pub trivia', theme, venue, mood = 'upbeat fun' } = body;

      if (!env.ANTHROPIC_API_KEY) return err('ANTHROPIC_API_KEY missing', 500);

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          messages: [{ role: 'user', content:
            `Generate 3 Suno AI music prompts for a "${event_type}" event${theme ? ` with theme: ${theme}` : ''}${venue ? ` at ${venue}` : ''}.
Mood: ${mood}
Each prompt should be 1-2 sentences describing the musical style for Suno.
Include: genre, instruments, tempo, vibe.
Format: numbered list. Keep each prompt under 30 words.`
          }],
        }),
      });

      const data = await resp.json();
      const text = data.content?.[0]?.text || '';
      return json({ ok: true, prompts: text, instructions: 'Paste any of these into suno.com → Create → Custom → Style of Music field' });
    }

    // ── Events ────────────────────────────────────────────────────────────────
    if (path === '/events' && method === 'GET') {
      if (!pinOk(request, env)) return err('Unauthorized', 401);
      const rows = await env.KBT_DB.prepare(
        `SELECT * FROM kbt_events ORDER BY event_date DESC LIMIT 20`
      ).all();
      return json({ ok: true, events: rows.results });
    }

    if (path === '/events' && method === 'POST') {
      if (!pinOk(request, env)) return err('Unauthorized', 401);
      const body = await request.json().catch(() => ({}));
      const id = uid();
      await env.KBT_DB.prepare(
        `INSERT INTO kbt_events (id, title, event_date, venue, status, max_teams, entry_fee) VALUES (?,?,?,?,?,?,?)`
      ).bind(id, body.title || 'KBT Event', body.date || new Date().toISOString().slice(0,10),
        body.venue || 'TBD', 'upcoming', body.max_teams || 8, body.entry_fee || 0).run();
      return json({ ok: true, id });
    }

    // ── Summary for Falkor agent context ─────────────────────────────────────
    if (path === '/summary' && method === 'GET') {
      if (!pinOk(request, env)) return err('Unauthorized', 401);
      const [events, qCount] = await Promise.all([
        env.KBT_DB.prepare(`SELECT count(*) as c FROM kbt_events WHERE status = 'upcoming'`).first(),
        env.KBT_DB.prepare(`SELECT count(*) as c FROM kbt_question_bank`).first(),
      ]);
      return json({
        ok: true,
        upcoming_events: events?.c || 0,
        question_bank_size: qCount?.c || 0,
        live_games: 0, // DO-based count not easily available
        endpoints: ['/game/create', '/game/host/:code (WS)', '/game/play/:code (WS)', '/questions/bank', '/questions/generate', '/events', '/music/prompt'],
      });
    }

    if (path === '/build-slides' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const slideToken = request.headers.get('X-Google-Token') || '';
      const result = await buildSlides(env, { topic: b.topic || 'general knowledge', count: b.count || 10, gameTitle: b.gameTitle || 'Kow Brainer Trivia', token: slideToken });
      return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }



    // Phase 40 — Host Control Panel
    if (path === '/host' || path.startsWith('/host/')) {
      const parts = path.split('/').filter(Boolean);
      const code = parts.length >= 2 ? parts[1].toUpperCase() : '';
      return new Response(buildHostHTML(code), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8', ...CORS_HEADERS }
      });
    }

    // Phase 39 — Public Player Join Interface
    if (path === '/join' || path.startsWith('/join/')) {
      const parts = path.split('/').filter(Boolean);
      const code = parts.length >= 2 ? parts[1].toUpperCase() : '';
      return new Response(buildPlayerHTML(code), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8', ...CORS_HEADERS }
      });
    }

    return json({ error: 'Not found', path }, 404);
  },
};
