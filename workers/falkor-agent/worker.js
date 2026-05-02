
// falkor-agent v1.9.1 — fix wsConn→ws bug (DO 1101 crash), add WORKFLOWS_SERVICE binding
// v1.7.0 adds:
//   1. Live context pre-loader — fetches weather/calendar/sport/tips before first reply
//   2. Auto-memory — every 5 turns, Haiku extracts memorable facts → falkor-brain
//   3. Action handlers — "email me X", "note this", "remind me about X" → real actions

const BRAIN_URL    = 'https://falkor-brain.luckdragon.io';
const CALENDAR_URL = 'https://falkor-calendar.luckdragon.io';
const SPORT_URL    = 'https://falkor-sport.luckdragon.io';
const WEATHER_URL  = 'https://asgard-ai.luckdragon.io';
const PUSH_URL     = 'https://falkor-push.luckdragon.io';
const WORKFLOWS_URL = 'https://falkor-workflows.luckdragon.io';

// WPS coordinates (Williamstown Primary School)
const WPS_LAT = -37.8594;
const WPS_LON = 144.8750;

// Context bundle TTL: 10 minutes (don't re-fetch every message)
const CONTEXT_TTL_MS = 10 * 60 * 1000;

// Auto-memory: extract facts every N assistant turns
const MEMORY_EXTRACT_INTERVAL = 5;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Pin, Upgrade, Connection',
};

// ── User context builder ──────────────────────────────────────────────────────
function buildUserContext(userId) {
  const profiles = {
    paddy: {
      name: 'Paddy',
      desc: "a PE teacher at Williamstown Primary School (WPS). He runs Kow Brainer Trivia (KBT), loves AFL (Essendon), runs family footy tips and racing tipping comps, and manages three sports products: Carnival Timing, School Sport Portal, and SportCarnival.",
      interests: ['AFL', 'Essendon', 'KBT trivia', 'PE', 'WPS school', 'footy tips', 'TAB racing', 'family'],
      email: 'pgallivan@outlook.com',
    },
    jacky: {
      name: 'Jacky',
      desc: "a family member who uses Falkor for footy tips, racing, and general queries.",
      interests: ['footy tips', 'racing', 'family'],
      email: null,
    },
    george: {
      name: 'George',
      desc: "a family member who uses Falkor for footy tips, racing, and general queries.",
      interests: ['footy tips', 'racing', 'family'],
      email: null,
    },
  };
  return profiles[userId] || { name: userId || 'there', desc: 'a Falkor user.', interests: [], email: null };
}

function corsJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// ── A2A Sub-agent Registry ────────────────────────────────────────────────────
const AGENTS = {
  sport:     SPORT_URL,
  kbt:       'https://falkor-kbt.luckdragon.io',
  brain:     BRAIN_URL,
  workflows: WORKFLOWS_URL,
  school:    'https://falkor-school.luckdragon.io',
  web:       'https://falkor-web.luckdragon.io',
  code:      'https://falkor-code.luckdragon.io',
};

const AGENT_MODEL_OVERRIDES = { sport: 'haiku', kbt: 'haiku', web: 'haiku' };

function routeIntent(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/\b(afl|footy|football|ladder|tip|tipping|squiggle|racing|horse|race|round|score|fixture|essendon|collingwood|hawks|bombers|cats|demons|carlton|richmond|western bulldogs|fremantle|geelong|hawthorn|melbourne|port adelaide|gold coast|gws|brisbane|sydney|west coast|st kilda|north melbourne|adelaide|nrl|rugby league|panthers|warriors|roosters|rabbitohs|bulldogs|broncos|sharks|dragons|tigers|eels|knights|sea eagles|raiders|cowboys|titans|dolphins|storm)\b/.test(t))
    return { agent: 'sport', action: 'summary' };
  if (/\b(trivia|kbt|kow|brainer|quiz|question|pub quiz|game|host|players|leaderboard|event tonight|next event)\b/.test(t))
    return { agent: 'kbt', action: 'query' };
  if (/\b(deploy|fix worker|broken worker|fleet|falkor-code|self.heal|redeploy|worker health|which workers|code agent)\b/.test(t))
    return { agent: 'code', action: 'summary' };
  if (/\b(pe|physical education|lesson plan|sports day|cross.country|carnival|students|wps|williamstown primary|outdoor|weather for school|athletics|sprint|house points)\b/.test(t))
    return { agent: 'school', action: 'query' };
  if (/\b(weather|temperature|forecast|rain|uv|wind|celsius|degrees|conditions)\b/.test(t) && !/school|pe|lesson/.test(t))
    return { agent: 'workflows', action: 'weather' };
  if (/\b(remember|recall|what do you know|brain|memory|stored|learned|told you|history of)\b/.test(t))
    return { agent: 'brain', action: 'recall' };
  if (/\b(search|look up|find|google|what is|who is|latest|news|current|today's|recent)\b/.test(t) && t.length < 200)
    return { agent: 'web', action: 'search' };
  return null;
}

async function callSubAgent(agentKey, action, text, pin, aiPin) {
  const baseUrl = AGENTS[agentKey];
  if (!baseUrl) return null;
  try {
    switch (agentKey) {
      case 'sport':
        return fetch(`${baseUrl}/summary`, { headers: { 'X-Pin': pin } }).then(r => r.ok ? r.json() : null);
      case 'kbt':
        return fetch(`${baseUrl}/summary`, { headers: { 'X-Pin': pin } }).then(r => r.ok ? r.json() : null);
      case 'code':
        return fetch(`${baseUrl}/summary`, { headers: { 'X-Pin': pin } }).then(r => r.ok ? r.json() : null);
      case 'brain':
        return fetch(`${baseUrl}/recall`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Pin': pin },
          body: JSON.stringify({ query: text, top_k: 5, answer: true }),
        }).then(r => r.ok ? r.json() : null);
      case 'workflows':
        return fetch(`${WEATHER_URL}/weather?lat=${WPS_LAT}&lon=${WPS_LON}`, {
          headers: { 'X-Pin': aiPin || pin },
        }).then(r => r.ok ? r.json() : null);
      case 'school':
        return fetch(`${baseUrl}/summary`, { headers: { 'X-Pin': pin } }).then(r => r.ok ? r.json() : null);
      case 'web':
        return fetch(`${baseUrl}/search`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Pin': pin },
          body: JSON.stringify({ query: text }),
        }).then(r => r.ok ? r.json() : null);
      default: return null;
    }
  } catch { return null; }
}

// ── Action handler — detect and execute Jarvis-style actions ─────────────────
function detectAction(text) {
  if (!text) return null;
  const t = text.toLowerCase().trim();
  // Email actions
  if (/\b(email me|send me|email summary|send (a )?summary|mail me)\b/.test(t))
    return { type: 'email', subject: 'Falkor summary', body: text };
  // Note / save actions
  if (/^(note|save|remember|log|jot)[\s:]+/.test(t) || /\b(note this|save this|log this|jot this|remember this)\b/.test(t))
    return { type: 'note', content: text.replace(/^(note|save|remember|log|jot)[\s:]+/i, '').trim() };
  // Remind actions
  const remindMatch = t.match(/remind me (about |to )?(.+?)( on | at | tomorrow| next week)?$/);
  if (remindMatch && /\b(remind)\b/.test(t))
    return { type: 'remind', content: remindMatch[2], original: text };
  // Task / background research intent
  const taskKeywords = /^(research|find out|look into|investigate|queue[:\s]+|overnight[:\s]+|background[:\s]+|do this later[:\s]+)/i;
  const taskAmbient = /\b(overnight|do this later|queue this|background task|run this later)\b/i;
  if (taskKeywords.test(t) || taskAmbient.test(t)) {
    const query = text.replace(/^(research|find out|look into|investigate|queue[:\s]+|overnight[:\s]+|background[:\s]+|do this later[:\s]+)/i, '').trim();
    let taskType = 'research';
    if (/\b(tipping|tips|standings|leaderboard)\b/i.test(text)) taskType = 'tipping_report';
    else if (/\b(venture|priorities|projects|dashboard)\b/i.test(text)) taskType = 'venture_report';
    else if (/\b(kbt|trivia|quiz|questions)\b/i.test(text)) taskType = 'kbt_prep';
    return { type: 'task', taskType, query: query || text, title: (query || text).slice(0, 80) };
  }
  return null;
}

async function executeAction(action, userId, userCtx, pin, env) {
  switch (action.type) {
    case 'email': {
      const toAddr = action.to || userCtx.email || 'pgallivan@outlook.com';
      const resendKey = (env && env.RESEND_API_KEY) || '';
      if (resendKey) {
        try {
          const r = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + resendKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'Falkor <falkor@luckdragon.io>',
              to: [toAddr],
              subject: action.subject || 'Message from Falkor',
              text: action.body || action.content || '',
            }),
          });
          const rd = await r.json().catch(() => ({}));
          if (rd.id) return `Sent to ${toAddr} ✓`;
          return `Couldn't send — Resend said: ${JSON.stringify(rd).slice(0,100)}`;
        } catch(e) {
          return `Email failed: ${e.message}`;
        }
      }
      // Fallback: log via workflows
      try {
        await fetch(`${WORKFLOWS_URL}/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Pin': pin },
          body: JSON.stringify({ to: toAddr, subject: action.subject, html: `<p>${action.body || action.content}</p>` }),
        });
      } catch { /* non-fatal */ }
      return `Queued to ${toAddr} — no direct send key available.`;
    }
    case 'note': {
      try {
        await fetch(`${BRAIN_URL}/remember`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Pin': pin },
          body: JSON.stringify({
            text: `[${userCtx.name}] ${action.content}`,
            category: 'note', tags: ['note', userId],
          }),
        });
      } catch { /* non-fatal */ }
      return `Got it — I've saved that note: "${action.content}"`;
    }
    case 'remind': {
      try {
        await fetch(`${BRAIN_URL}/remember`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Pin': pin },
          body: JSON.stringify({
            text: `[REMINDER for ${userCtx.name}] ${action.content} — original: ${action.original}`,
            category: 'reminder', tags: ['reminder', userId],
          }),
        });
      } catch { /* non-fatal */ }
      return `Reminder saved: "${action.content}". I'll surface this when relevant.`;
    }
    case 'task': {
      try {
        // Use WORKFLOWS_SERVICE binding if available on env (injected from DO env)
        const wfUrl = 'https://falkor-workflows.luckdragon.io/tasks';
        const wfReq = new Request(wfUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Pin': pin },
          body: JSON.stringify({
            title: action.title || action.query,
            type: action.taskType || 'research',
            query: action.query,
            notify: 1,
          }),
        });
        const tRes = (env && env.WORKFLOWS_SERVICE)
          ? await env.WORKFLOWS_SERVICE.fetch(wfReq)
          : await fetch(wfReq);
        const d = await tRes.json().catch(() => ({}));
        if (d.ok) {
          return `✅ Queued task #${d.id}: "${action.title}". I'll handle it in the background and notify you when done.`;
        }
        return `Couldn't queue task: ${d.error || 'unknown error'}`;
      } catch(e) {
        return `Task queue error: ${e.message}`;
      }
    }
  }
  return null;
}

// ── Live context pre-loader ───────────────────────────────────────────────────
// Fetches weather + calendar + sport + tips in parallel, returns a context string
async function loadLiveContext(pin, aiPin) {
  const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));

  const safe = (p) => Promise.race([p, timeout(4000)]).catch(() => null);

  const nrlSeason = new Date().getFullYear();
  const [weather, calToday, calTomorrow, sport, nrlDraw, nrlLb] = await Promise.all([
    safe(fetch(`${WEATHER_URL}/weather?lat=${WPS_LAT}&lon=${WPS_LON}`, { headers: { 'X-Pin': aiPin } }).then(r => r.ok ? r.json() : null)),
    safe(fetch(`${CALENDAR_URL}/today`,    { headers: { 'X-Pin': pin } }).then(r => r.ok ? r.json() : null)),
    safe(fetch(`${CALENDAR_URL}/tomorrow`, { headers: { 'X-Pin': pin } }).then(r => r.ok ? r.json() : null)),
    safe(fetch(`${SPORT_URL}/summary`,     { headers: { 'X-Pin': pin } }).then(r => r.ok ? r.json() : null)),
    safe(fetch(`${SPORT_URL}/nrl/draw?season=${nrlSeason}`, { headers: { 'X-Pin': pin } }).then(r => r.ok ? r.json() : null)),
    safe(fetch(`${SPORT_URL}/nrl/leaderboard?season=${nrlSeason}`, { headers: { 'X-Pin': pin } }).then(r => r.ok ? r.json() : null)),
  ]);

  const lines = ['=== LIVE CONTEXT (fetched now) ==='];

  // Weather
  if (weather) {
    const w = weather.current || weather;
    const uv = w.uv ?? w.uv_index ?? w.uvi ?? '?';
    const temp = w.temp ?? w.temperature ?? '?';
    const rain = w.rain_chance ?? w.pop ?? '?';
    const desc = w.condition ?? w.description ?? w.weather?.[0]?.description ?? '';
    const peSuitable = weather.pe_suitable !== undefined ? (weather.pe_suitable ? '✅ suitable for outdoor PE' : '❌ not suitable for outdoor PE') : '';
    lines.push(`WEATHER (WPS): ${temp}°C, UV ${uv}, rain ${typeof rain === 'number' ? Math.round(rain * 100) : rain}%, ${desc}. ${peSuitable}`.trim());
  }

  // Calendar
  const fmtEvents = (data, label) => {
    if (!data) return;
    const events = data.events || data.items || [];
    if (events.length === 0) { lines.push(`CALENDAR ${label}: nothing scheduled`); return; }
    lines.push(`CALENDAR ${label}: ` + events.slice(0, 5).map(e => e.summary || e.title || e.name).join(', '));
  };
  fmtEvents(calToday, 'TODAY');
  fmtEvents(calTomorrow, 'TOMORROW');

  // Sport — AFL
  if (sport) {
    if (sport.ladder) {
      const top3 = (sport.ladder || []).slice(0, 3).map(t => t.name || t.team).filter(Boolean).join(', ');
      if (top3) lines.push(`AFL LADDER TOP 3: ${top3}`);
    }
    if (sport.round) lines.push(`AFL ROUND: ${JSON.stringify(sport.round).slice(0, 120)}`);
    if (sport.tips_leader) lines.push(`FOOTY TIPS LEADER: ${sport.tips_leader}`);
  }

  // Sport — NRL
  if (nrlDraw && nrlDraw.round) {
    lines.push(`NRL ROUND: ${nrlDraw.round}`);
    const upcomingNRL = (nrlDraw.fixtures || []).filter(g => g.matchMode !== 'Post').slice(0, 3);
    if (upcomingNRL.length) {
      lines.push('NRL UPCOMING: ' + upcomingNRL.map(g => `${g.homeTeam} vs ${g.awayTeam}`).join(', '));
    }
  }
  if (nrlLb && nrlLb.leaderboard && nrlLb.leaderboard.length > 0) {
    const nrlTop = nrlLb.leaderboard[0];
    lines.push(`NRL TIPS LEADER: ${nrlTop.player} — ${nrlTop.correct}/${nrlTop.total} (${nrlTop.pct}%)`);
  }

  lines.push('=== END LIVE CONTEXT ===');

  // Only return something meaningful if we got real data
  if (lines.length <= 2) return '';
  return '\n\n' + lines.join('\n');
}

// ── Auto-memory extractor ─────────────────────────────────────────────────────
// Every MEMORY_EXTRACT_INTERVAL assistant turns, extract memorable facts via Haiku
async function maybeExtractMemory(history, userId, pin, aiPin, aiUrl) {
  // Count assistant turns
  const assistantTurns = history.filter(h => h.role === 'assistant').length;
  if (assistantTurns === 0 || assistantTurns % MEMORY_EXTRACT_INTERVAL !== 0) return;

  // Only look at the last 10 messages (the recent conversation)
  const recent = history.slice(-10);
  const convoText = recent.map(h => `${h.role === 'user' ? 'User' : 'Falkor'}: ${h.content}`).join('\n');

  try {
    const resp = await fetch(`${aiUrl}/chat/smart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Pin': aiPin },
      body: JSON.stringify({
        message: `Extract memorable facts from this conversation that should be saved for future reference. Focus on: specific dates/events, names, preferences, decisions, and important context about the user's life/work. Return as JSON array of strings like ["fact1", "fact2"]. Return empty array [] if nothing worth saving. Conversation:\n${convoText}`,
        context: [],
        system: 'You are a memory extraction assistant. Extract only genuinely useful, durable facts. Ignore small talk and temporary state. Return valid JSON only.',
        model: 'haiku',
        max_tokens: 300,
      }),
    });

    if (!resp.ok) return;
    const data = await resp.json();
    const raw = (data.reply || data.content || '').trim();

    // Parse facts from response
    const match = raw.match(/\[.*\]/s);
    if (!match) return;
    const facts = JSON.parse(match[0]);
    if (!Array.isArray(facts) || facts.length === 0) return;

    // Save each fact to falkor-brain (fire and forget)
    for (const fact of facts.slice(0, 5)) {
      if (typeof fact !== 'string' || fact.length < 10) continue;
      fetch(`${BRAIN_URL}/remember`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Pin': pin },
        body: JSON.stringify({
          text: `[auto-memory for ${userId}] ${fact}`,
          category: 'auto-memory',
          tags: ['auto', userId],
        }),
      }).catch(() => {});
    }
  } catch { /* non-fatal */ }
}

// ─────────────────────────────────────────────────────────────────────────────

export class FalkorAgent {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.wsCount = 0;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    if (path === '/chat' && request.method === 'POST') {
      const body = await request.json();
      const { model, productContext } = body;
      const text = body.text || body.message || '';
      const userId = request.headers.get('X-User-Id') || body.userId || 'paddy';
      const reply = await this.processChat(text, model || 'groq-fast', null, productContext, userId);
      return corsJson({ reply });
    }

    if (path === '/history' && request.method === 'GET') {
      return corsJson(await this.getHistory());
    }
    if (path === '/history' && request.method === 'DELETE') {
      await this.resetHistory();
      return corsJson({ ok: true });
    }
    if (path === '/memory' && request.method === 'GET') {
      return corsJson(await this.getMemory());
    }
    if (path === '/memory' && request.method === 'POST') {
      const { key, value } = await request.json();
      await this.saveMemory(key, value);
      return corsJson({ ok: true });
    }
    if (path === '/memory' && request.method === 'DELETE') {
      await this.clearMemory();
      return corsJson({ ok: true });
    }
    if (path === '/context/refresh' && request.method === 'POST') {
      // Force-refresh the live context bundle
      await this.state.storage.delete('liveContext');
      await this.state.storage.delete('liveContextTs');
      return corsJson({ ok: true, message: 'Context cache cleared — will refresh on next message' });
    }
    if (path === '/status') {
      const history = await this.getHistory();
      const memory = await this.getMemory();
      const ctxTs = await this.state.storage.get('liveContextTs');
      return corsJson({
        version: '1.9.3',
        activeSessions: this.sessions.size,
        historyLength: history.length,
        memoryKeys: Object.keys(memory).length,
        liveContextAge: ctxTs ? Math.round((Date.now() - ctxTs) / 1000) + 's' : 'not loaded',
      });
    }

    return new Response('Not found', { status: 404, headers: CORS_HEADERS });
  }

  async handleWebSocket(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    const wsId = String(++this.wsCount);
    this.sessions.set(wsId, server);

    server.addEventListener('message', async (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'chat') {
          const userId = msg.userId || 'paddy';
          await this.processChat(msg.text, msg.model || 'groq-fast', server, msg.productContext, userId);
        } else if (msg.type === 'ping') {
          server.send(JSON.stringify({ type: 'pong' }));
        } else if (msg.type === 'history') {
          const history = await this.getHistory();
          server.send(JSON.stringify({ type: 'history', history }));
        } else if (msg.type === 'memory_get') {
          const memory = await this.getMemory();
          server.send(JSON.stringify({ type: 'memory', memory }));
        } else if (msg.type === 'memory_set') {
          await this.saveMemory(msg.key, msg.value);
          server.send(JSON.stringify({ type: 'memory_saved', key: msg.key }));
        } else if (msg.type === 'context_refresh') {
          await this.state.storage.delete('liveContext');
          await this.state.storage.delete('liveContextTs');
          server.send(JSON.stringify({ type: 'context_refreshed' }));
        }
      } catch (err) {
        server.send(JSON.stringify({ type: 'error', message: err.message }));
      }
    });

    server.addEventListener('close', () => { this.sessions.delete(wsId); });
    server.addEventListener('error', () => { this.sessions.delete(wsId); });

    return new Response(null, { status: 101, webSocket: client });
  }

  // ── Get or refresh live context bundle (cached 10 min) ────────────────────
  async getLiveContext(pin) {
    const now = Date.now();
    const cachedTs = await this.state.storage.get('liveContextTs');
    if (cachedTs && (now - cachedTs) < CONTEXT_TTL_MS) {
      return (await this.state.storage.get('liveContext')) || '';
    }
    // Load fresh
    const ctx = await loadLiveContext(pin, this.aiPin || pin);
    await this.state.storage.put('liveContext', ctx);
    await this.state.storage.put('liveContextTs', now);
    return ctx;
  }

  async processChat(text, model, ws, productContext, userId) {
    const history = await this.getHistory();
    const memory = await this.getMemory();
    const pin = this.env.AGENT_PIN || '';
    // asgard-ai uses per-user PINs (PADDY_PIN etc), not the service AGENT_PIN
    const aiPin = this.env.AI_WORKER_PIN || this.env.AGENT_PIN || '';
    this.aiPin = aiPin; // cache for getLiveContext
    const aiUrl = this.env.AI_WORKER_URL || 'https://asgard-ai.luckdragon.io';
    const userCtx = buildUserContext(userId);

    const memoryLines = Object.entries(memory).map(([k, v]) => `${k}: ${v}`).join('\n');
    const systemExtra = memoryLines ? '\n\nUser facts you remember:\n' + memoryLines : '';

    this.broadcast({ type: 'user_message', text, model });

    // ── 1. Check for action intents FIRST ────────────────────────────────────
    const action = detectAction(text);
    if (action) {
      const actionReply = await executeAction(action, userId, userCtx, pin, this.env);
      if (actionReply) {
        // If it was purely an action (note/remind/task), respond directly without AI
        if (action.type === 'note' || action.type === 'remind' || action.type === 'task') {
          history.push({ role: 'user', content: text, ts: Date.now() });
          history.push({ role: 'assistant', content: actionReply, ts: Date.now() });
          await this.state.storage.put('history', JSON.stringify(history.slice(-200)));
          this.broadcast({ type: 'assistant_reply', text: actionReply, model });
          return actionReply;
        }
        // For email, acknowledge then continue to also answer with AI
        this.broadcast({ type: 'action_taken', action: action.type, message: actionReply });
      }
    }

    // ── 2. Get live context (cached, 10 min TTL) ──────────────────────────────
    // Load in background on first message; subsequent messages use cache
    const liveContext = await this.getLiveContext(pin);

    // ── 3. A2A Intent routing ─────────────────────────────────────────────────
    let pendingAgentCtx = '';
    const intent = routeIntent(text);
    if (intent) {
      if (AGENT_MODEL_OVERRIDES[intent.agent]) model = AGENT_MODEL_OVERRIDES[intent.agent];
      const agentData = await callSubAgent(intent.agent, intent.action, text, pin, aiPin);
      if (agentData) {
        // Special handling for web search: use the answer field prominently
        if (intent.agent === 'web' && agentData.answer) {
          const snippets = (agentData.results || []).slice(0, 3)
            .map(r => `- ${r.title}: ${r.snippet || ''}`.slice(0, 120)).join('\n');
          pendingAgentCtx = `\n\n## Web Search Results for "${text}"\nAnswer: ${agentData.answer}\n${snippets}\n\n(Use these results to answer the user — do not say you cannot search.)`;
        } else {
          pendingAgentCtx = '\n\nLive data from falkor-' + intent.agent + ':\n' +
            JSON.stringify(agentData, null, 2).slice(0, 1500);
        }
        if (intent.agent === 'sport' || intent.agent === 'kbt') {
          fetch(`${BRAIN_URL}/remember`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Pin': pin },
            body: JSON.stringify({
              text: 'Live data from ' + intent.agent + ': ' + JSON.stringify(agentData).slice(0, 500),
              category: intent.agent, tags: [intent.agent, 'live'],
            }),
          }).catch(() => {});
        }
      }
    }

    // ── 4. RAG: fetch relevant context from falkor-brain ─────────────────────
    let ragContext = '';
    try {
      const ragResp = await fetch(`${BRAIN_URL}/recall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Pin': pin },
        body: JSON.stringify({ query: text, top_k: 3, answer: false }),
      });
      if (ragResp.ok) {
        const ragData = await ragResp.json();
        const matches = (ragData.matches || []).filter(m => m.score > 0.5);
        if (matches.length > 0) {
          ragContext = '\n\nRelevant context from memory:\n' +
            matches.map((m, i) => `${i + 1}. [${m.category}] ${m.content}`).join('\n');
        }
      }
    } catch { /* brain unavailable */ }

    if (pendingAgentCtx) ragContext += pendingAgentCtx;

    const productCtxStr = productContext
      ? '\n\nContext: You are embedded in ' + productContext + '. Tailor your answers to this context.'
      : '';

    // ── 5. Build system prompt with live context injected ────────────────────
    const contextHistory = history.slice(-40).map(h => ({ role: h.role, content: h.content }));

    const systemPrompt = [
      `You are Falkor — ${userCtx.name}'s personal AI. Think Jarvis from Iron Man: sharp, warm, occasionally dry, always useful. You are not a generic assistant. You are ${userCtx.name}'s AI.`,
      `About ${userCtx.name}: ${userCtx.desc}`,
      `## Personality rules (never break these):`,
      `- Address ${userCtx.name} by first name naturally — not every sentence, but often enough that it feels personal`,
      `- Be concise. No padding, no "Certainly!", no "Great question!". Get to the point.`,
      `- Dry wit is welcome. A well-timed quip beats a paragraph of explanation.`,
      `- Be confident. Don't hedge everything. If you know, say it. If you don't, say that briefly.`,
      `- When you can DO something (send email, set reminder, check scores), do it — don't just explain how.`,
      `- If you notice something important in the live context that ${userCtx.name} hasn't asked about, mention it.`,
      `- Never start a reply with "I" as the first word. Vary your openings.`,
      `- When web search results are provided in your context (marked "## Web Search Results"), USE them to answer — never say you cannot search or browse the internet. The results are already fetched for you.`,
      `- Short replies are almost always better. Match the energy of the message.`,
      `## What ${userCtx.name} cares about most:`,
      `${userCtx.interests.join(', ')}`,
      systemExtra,
      liveContext,
      ragContext,
      productCtxStr,
    ].filter(Boolean).join('\n');

    // ── 6. Call asgard-ai router (streaming when ws present) ────────────
    let reply = '';
    const msgId = 'msg_' + Date.now();

    if (ws) {
      // ── Streaming path: SSE → WS tokens ──────────────────────────────────
      try {
        const resp = await fetch(`${aiUrl}/chat/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Pin': aiPin },
          body: JSON.stringify({
            messages: [...contextHistory, { role: 'user', content: text }],
            system: systemPrompt,
            model,
            max_tokens: 2048,
          }),
        });
        if (resp.ok) {
          const reader = resp.body.getReader();
          const decoder = new TextDecoder();
          let buf = '';
          let accumulated = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop();
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const raw = trimmed.slice(5).trim();
              try {
                const parsed = JSON.parse(raw);
                if (parsed.t) {
                  accumulated += parsed.t;
                  // Broadcast token to all connected WS sessions
                  this.broadcast({ type: 'token', msgId, text: accumulated });
                }
              } catch {}
            }
          }
          reply = accumulated;
        } else {
          const errBody = await resp.text().catch(() => '');
          reply = '[AI error: ' + resp.status + (errBody ? ': ' + errBody.slice(0, 80) : '') + ']';
        }
      } catch (err) {
        reply = '[Stream error: ' + err.message + ']';
      }
    } else {
      // ── Non-streaming path (REST /chat endpoint, widget, etc.) ───────────
      try {
        const resp = await fetch(`${aiUrl}/chat/smart`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Pin': aiPin },
          body: JSON.stringify({
            message: text,
            context: contextHistory,
            system: systemPrompt,
            model,
            max_tokens: 2048,
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          reply = data.reply || data.content || '';
        } else {
          const errBody = await resp.text().catch(() => '');
          reply = '[AI error: ' + resp.status + (errBody ? ': ' + errBody.slice(0, 100) : '') + ']';
        }
      } catch (err) {
        reply = '[Connection error: ' + err.message + ']';
      }
    }

    // ── 7. Save to history ────────────────────────────────────────────────────
    history.push({ role: 'user', content: text, ts: Date.now() });
    history.push({ role: 'assistant', content: reply, ts: Date.now() });
    await this.state.storage.put('history', JSON.stringify(history.slice(-200)));

    // ── 8. Auto-memory extraction (every 5 turns, fire-and-forget) ────────────
    maybeExtractMemory(history, userId, pin, aiPin, aiUrl).catch(() => {});

    // Final reply broadcast (UI uses msgId to finalize streaming bubble)
    this.broadcast({ type: 'assistant_reply', msgId, text: reply, model });
    return reply;
  }

  broadcast(msg) {
    const payload = JSON.stringify(msg);
    for (const [id, ws] of this.sessions) {
      try { ws.send(payload); } catch { this.sessions.delete(id); }
    }
  }

  async getHistory() {
    const raw = await this.state.storage.get('history');
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }
  async resetHistory() {
    await this.state.storage.delete('history');
    await this.state.storage.delete('liveContext');
    await this.state.storage.delete('liveContextTs');
  }
  async getMemory() {
    const raw = await this.state.storage.get('memory');
    if (!raw) return {};
    try { return JSON.parse(raw); } catch { return {}; }
  }
  async saveMemory(key, value) {
    const memory = await this.getMemory();
    memory[key] = value;
    await this.state.storage.put('memory', JSON.stringify(memory));
  }
  async clearMemory() { await this.state.storage.delete('memory'); }
}

// ── Router ────────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (url.pathname !== '/health') {
      const pin = request.headers.get('X-Pin') || url.searchParams.get('pin');
      if (!pin || !env.AGENT_PIN || pin !== env.AGENT_PIN) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }
    }

    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', version: '1.9.3', worker: 'falkor-agent' });
    }

    // ── /tasks proxy → falkor-workflows via service binding (no 522 loopback) ──
    if (url.pathname === '/tasks') {
      const method = request.method;
      const pin = env.AGENT_PIN || '';
      try {
        const proxyTarget = `https://falkor-workflows.luckdragon.io/tasks`;
        const proxyReq = new Request(proxyTarget, {
          method,
          headers: { 'Content-Type': 'application/json', 'X-Pin': pin },
          body: method === 'POST' ? request.body : undefined,
        });
        // Use service binding if available (avoids CF loopback 522)
        const r = env.WORKFLOWS_SERVICE
          ? await env.WORKFLOWS_SERVICE.fetch(proxyReq)
          : await fetch(proxyReq);
        const d = await r.json().catch(() => ({}));
        return new Response(JSON.stringify(d), {
          status: r.status,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      } catch(e) {
        return new Response(JSON.stringify({ ok: false, error: e.message }), {
          status: 502, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }
    }

    const userId = request.headers.get('X-User-Id') || url.searchParams.get('uid') || 'paddy';
    const id = env.AGENT.idFromName(userId);
    const stub = env.AGENT.get(id);
    return stub.fetch(request);
  },
};

