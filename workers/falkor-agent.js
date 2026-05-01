// falkor-agent v1.6.0 — Durable Object per user
// Phase 2 of the Falkor rebuild (formerly Asgard)
// Persistent WebSocket hub + chat history + per-user memory
// One DO instance per user (keyed by userId)
// v1.3.0-a2a: Added falkor-code A2A routing
// v1.4.0: Haiku model override for sport/KBT queries (prevent Groq hallucinations on structured data)
// v1.6.0: CORS on all responses, productContext param for widget embeds

const BRAIN_URL = 'https://falkor-brain.luckdragon.io';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Pin, Upgrade, Connection',
};

// ── User context builder ──────────────────────────────────────────────────────
function buildUserContext(userId, userName) {
  const profiles = {
    paddy: {
      name: 'Paddy',
      desc: "a PE teacher at Williamstown Primary School (WPS). He runs Kow Brainer Trivia (KBT), loves AFL (Essendon), does family footy tips and racing tipping comps, and manages three sports products: Carnival Timing, School Sport Portal, and SportCarnival.",
      interests: ['AFL', 'Essendon', 'KBT trivia', 'PE', 'WPS school', 'footy tips', 'TAB racing', 'family'],
    },
    jacky: {
      name: 'Jacky',
      desc: "a family member who uses Falkor for footy tips, racing, and general queries.",
      interests: ['footy tips', 'racing', 'family'],
    },
    george: {
      name: 'George',
      desc: "a family member who uses Falkor for footy tips, racing, and general queries.",
      interests: ['footy tips', 'racing', 'family'],
    },
  };
  const profile = profiles[userId] || { name: userName || 'there', desc: 'a Falkor user.', interests: [] };
  return profile;
}



function corsJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// ── A2A Sub-agent Registry ────────────────────────────────────────────────────
const AGENTS = {
  sport:     'https://falkor-sport.luckdragon.io',
  kbt:       'https://falkor-kbt.luckdragon.io',
  brain:     'https://falkor-brain.luckdragon.io',
  workflows: 'https://falkor-workflows.luckdragon.io',
  school:    'https://falkor-school.luckdragon.io',
  web:       'https://falkor-web.luckdragon.io',
  code:      'https://falkor-code.luckdragon.io',
};

// Models that should be used for specific agent types
// sport/kbt return structured data — Groq can hallucinate; Haiku is more faithful
const AGENT_MODEL_OVERRIDES = {
  sport: 'haiku',
  kbt:   'haiku',
};

// Keyword → agent routing (fast, no LLM needed)
function routeIntent(text) {
  const t = text.toLowerCase();
  // Sport / AFL / Racing
  if (/\b(afl|footy|football|ladder|tip|tipping|squiggle|racing|horse|race|round|score|fixture|essendon|collingwood|hawks|bombers|cats|demons|carlton|richmond|western bulldogs|fremantle|geelong|hawthorn|melbourne|port adelaide|gold coast|gws|brisbane|sydney|west coast|st kilda|north melbourne|adelaide)\b/.test(t))
    return { agent: 'sport', action: 'summary' };
  // KBT Trivia
  if (/\b(trivia|kbt|kow|brainer|quiz|question|pub quiz|game|host|players|leaderboard|event tonight|next event)\b/.test(t))
    return { agent: 'kbt', action: 'query' };
  // Fleet / Code
  if (/\b(deploy|fix worker|broken worker|fleet|falkor-code|self.heal|redeploy|worker health|which workers|code agent)\b/.test(t))
    return { agent: 'code', action: 'summary' };
  // School / PE
  if (/\b(pe|physical education|lesson plan|sports day|cross.country|carnival|students|wps|williamstown primary|outdoor|weather for school|athletics|sprint|house points)\b/.test(t))
    return { agent: 'school', action: 'query' };
  // Weather (non-school)
  if (/\b(weather|temperature|forecast|rain|uv|wind|celsius|degrees|conditions)\b/.test(t) && !/school|pe|lesson/.test(t))
    return { agent: 'workflows', action: 'weather' };
  // Memory / Brain
  if (/\b(remember|recall|what do you know|brain|memory|stored|learned|told you|history of)\b/.test(t))
    return { agent: 'brain', action: 'recall' };
  // Web search
  if (/\b(search|look up|find|google|what is|who is|latest|news|current|today's|recent)\b/.test(t) && t.length < 200)
    return { agent: 'web', action: 'search' };
  return null; // general AI
}

// Call a sub-agent and get its response
async function callSubAgent(agentKey, action, text, pin) {
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
        return fetch(`https://asgard-ai.luckdragon.io/weather?lat=-37.86&lon=144.9`, {
          headers: { 'X-Pin': pin },
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

export class FalkorAgent {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map(); // wsId -> WebSocket
    this.wsCount = 0;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    // REST endpoints
    if (path === '/chat' && request.method === 'POST') {
      const body = await request.json();
        const { text, model, productContext } = body;
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

    if (path === '/status') {
      const history = await this.getHistory();
      const memory = await this.getMemory();
      return corsJson({
        version: '1.5.0',
        activeSessions: this.sessions.size,
        historyLength: history.length,
        memoryKeys: Object.keys(memory).length,
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
          await this.processChat(msg.text, msg.model || 'groq-fast', server);
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
        }
      } catch (err) {
        server.send(JSON.stringify({ type: 'error', message: err.message }));
      }
    });

    server.addEventListener('close', () => { this.sessions.delete(wsId); });
    server.addEventListener('error', () => { this.sessions.delete(wsId); });

    return new Response(null, { status: 101, webSocket: client });
  }

  async processChat(text, model, ws, productContext, userId) {
    const history = await this.getHistory();
    const memory = await this.getMemory();
    const memoryLines = Object.entries(memory).map(([k, v]) => `${k}: ${v}`).join('\n');
    const systemExtra = memoryLines ? '\n\nUser facts you remember:\n' + memoryLines : '';
    const context = history.slice(-40).map(h => ({ role: h.role, content: h.content }));
    const pin = this.env.AGENT_PIN || '';

    this.broadcast({ type: 'user_message', text, model });

    // ── A2A Intent routing ────────────────────────────────────────────────────
    let pendingAgentCtx = '';
    const intent = routeIntent(text);
    if (intent) {
      // Override model to haiku for sport/KBT — prevents Groq hallucinating on structured data
      if (AGENT_MODEL_OVERRIDES[intent.agent]) {
        model = AGENT_MODEL_OVERRIDES[intent.agent];
      }
      const agentData = await callSubAgent(intent.agent, intent.action, text, pin);
      if (agentData) {
        pendingAgentCtx = '\n\nLive data from falkor-' + intent.agent + ':\n' +
          JSON.stringify(agentData, null, 2).slice(0, 1500);
        // Store sport/KBT snapshots in brain for memory continuity
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

    // ── RAG: fetch relevant context from falkor-brain ─────────────────────────
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
    } catch { /* brain unavailable — continue without */ }
    if (pendingAgentCtx) ragContext += pendingAgentCtx;

    // ── Product context (widget embed) ────────────────────────────────────────
    const productCtxStr = productContext
      ? '\n\nContext: You are embedded in ' + productContext + '. Tailor your answers to this context.'
      : '';

    // ── Call asgard-ai router ─────────────────────────────────────────────────
    let reply = '';
    try {
      const aiUrl = this.env.AI_WORKER_URL || 'https://asgard-ai.luckdragon.io';
      const resp = await fetch(`${aiUrl}/chat/smart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Pin': pin },
        body: JSON.stringify({
          message: text,
          context,
          system: (function() {
          const uCtx = buildUserContext(userId || 'paddy', userId);
          return 'You are Falkor, ' + uCtx.name + "'s intelligent personal AI. " + uCtx.name + ' is ' + uCtx.desc + ' You have real-time access to AFL/sport data (falkor-sport), KBT trivia (falkor-kbt), PE weather alerts (falkor-workflows), web search (falkor-web), and personal memory (falkor-brain). Use live data in context to give specific, actionable answers. Always address ' + uCtx.name + ' by name.' + systemExtra + ragContext + productCtxStr;
        })(),
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

    // Save to history (keep last 200 messages)
    history.push({ role: 'user', content: text, ts: Date.now() });
    history.push({ role: 'assistant', content: reply, ts: Date.now() });
    await this.state.storage.put('history', JSON.stringify(history.slice(-200)));

    this.broadcast({ type: 'assistant_reply', text: reply, model });
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
  async resetHistory() { await this.state.storage.delete('history'); }
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

// Router — auth via X-Pin, then dispatch to user's DO instance
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
      return Response.json({ status: 'ok', version: '1.5.0', worker: 'falkor-agent' });
    }

    const userId = request.headers.get('X-User-Id') || url.searchParams.get('uid') || 'paddy';
    const id = env.AGENT.idFromName(userId);
    const stub = env.AGENT.get(id);
    return stub.fetch(request);
  },
};