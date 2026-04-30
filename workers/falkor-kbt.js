// falkor-kbt v2.0.0 — KBT Live Trivia Game Engine
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

const VERSION = '2.0.0';
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

    // Health
    if (path === '/health') {
      let dbOk = false;
      try { await env.KBT_DB.prepare('SELECT 1').run(); dbOk = true; } catch {}
      return json({ ok: true, worker: WORKER_NAME, version: VERSION, db: dbOk ? 'ok' : 'error' });
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

    return json({ error: 'Not found', path }, 404);
  },
};
