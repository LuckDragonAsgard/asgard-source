// falkor-agent v1.8.0 — Phase 80: Image Generation + Model Badges
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
  image:     'https://asgard-ai.luckdragon.io',
};

const AGENT_MODEL_OVERRIDES = { sport: 'haiku', kbt: 'haiku' };

function routeIntent(text) {
  const t = text.toLowerCase();
  if (/\b(afl|footy|football|ladder|tip|tipping|squiggle|racing|horse|race|round|score|fixture|essendon|collingwood|hawks|bombers|cats|demons|carlton|richmond|western bulldogs|fremantle|geelong|hawthorn|melbourne|port adelaide|gold coast|gws|brisbane|sydney|west coast|st kilda|north melbourne|adelaide)\b/.test(t))
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
  // Image generation
  if (/\b(generate|draw|paint|create|make|design|illustrate)\b.{0,60}\b(image|picture|photo|illustration|poster|logo|artwork|graphic|portrait|painting|drawing)\b/i.test(t) ||
      /\b(generate|draw|create|make|paint)\b\s+(me\s+)?(a|an)\b.{0,50}\b(image|picture|photo|illustration|artwork|logo|poster|drawing)\b/i.test(t))
    return { agent: 'image', action: 'generate' };
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
      case 'image': {
        const imgResp = await fetch(`${AGENTS.image}/image/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Pin': aiPin || pin },
          body: JSON.stringify({ prompt: text, model: 'gpt-image-1', size: '1024x1024', quality: 'medium' }),
        });
        return imgResp.ok ? imgResp.json() : null;
      }
      default: return null;
    }
  } catch { return null; }
}

// ── Action handler — detect and execute Jarvis-style actions ─────────────────
function detectAction(text) {
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
  return null;
}

async function executeAction(action, userId, userCtx, pin, env) {
  switch (action.type) {
    case 'email': {
      // Send email via falkor-workflows /send-email
      const email = userCtx.email || 'pgallivan@outlook.com';
      try {
        await fetch(`${WORKFLOWS_URL}/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Pin': pin },
          body: JSON.stringify({
            to: email,
            subject: action.subject,
            html: `<p>${action.body}</p>`,
          }),
        });
      } catch { /* non-fatal */ }
      return `I'll send that to ${email}. Give me a moment.`;
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
  }
  return null;
}

// ── Live context pre-loader ───────────────────────────────────────────────────
// Fetches weather + calendar + sport + tips in parallel, returns a context string
async function loadLiveContext(pin, aiPin) {
  const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));

  const safe = (p) => Promise.race([p, timeout(4000)]).catch(() => null);

  const [weather, calToday, calTomorrow, sport] = await Promise.all([
    safe(fetch(`${WEATHER_URL}/weather?lat=${WPS_LAT}&lon=${WPS_LON}`, { headers: { 'X-Pin': aiPin } }).then(r => r.ok ? r.json() : null)),
    safe(fetch(`${CALENDAR_URL}/today`,    { headers: { 'X-Pin': pin } }).then(r => r.ok ? r.json() : null)),
    safe(fetch(`${CALENDAR_URL}/tomorrow`, { headers: { 'X-Pin': pin } }).then(r => r.ok ? r.json() : null)),
    safe(fetch(`${SPORT_URL}/summary`,     { headers: { 'X-Pin': pin } }).then(r => r.ok ? r.json() : null)),
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

  // Sport
  if (sport) {
    if (sport.ladder) {
      const top3 = (sport.ladder || []).slice(0, 3).map(t => t.name || t.team).filter(Boolean).join(', ');
      if (top3) lines.push(`AFL LADDER TOP 3: ${top3}`);
    }
    if (sport.round) lines.push(`AFL ROUND: ${JSON.stringify(sport.round).slice(0, 120)}`);
    if (sport.tips_leader) lines.push(`FOOTY TIPS LEADER: ${sport.tips_leader}`);
  }

  lines.push('=== END LIVE CONTEXT ===');

  // Only return something meaningful if we got real data
  if (lines.length <= 2) return '';
  return '\n\n' + lines.join('\n');
}

// ── Auto-memory extractor ─────────────────────────────────────────────────────
// Every MEMORY_EXTRACT_INTERVAL assistant turns, extract memorable facts via Haiku
async function maybeExtractMemory(history, userId, pin, aiUrl) {
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
        version: '1.8.0',
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
        // If it was purely an action (note/remind), respond directly
        if (action.type === 'note' || action.type === 'remind') {
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

    // ── 3a. Image generation — early return, no LLM call needed ─────────────
    if (intent && intent.agent === 'image') {
      const imgData = await callSubAgent('image', 'generate', text, pin, aiPin);
      if (imgData && imgData.url) {
        history.push({ role: 'user', content: text, ts: Date.now() });
        history.push({ role: 'assistant', content: '[image] ' + imgData.url, ts: Date.now() });
        await this.state.storage.put('history', JSON.stringify(history.slice(-200)));
        this.broadcast({ type: 'image_reply', url: imgData.url, prompt: text, revised_prompt: imgData.revised_prompt || '' });
        return imgData.url;
      }
      // If image gen failed, fall through to regular chat with an explanation
    }

    if (intent && intent.agent !== 'image') {
      if (AGENT_MODEL_OVERRIDES[intent.agent]) model = AGENT_MODEL_OVERRIDES[intent.agent];
      const agentData = await callSubAgent(intent.agent, intent.action, text, pin, aiPin);
      if (agentData) {
        pendingAgentCtx = '\n\nLive data from falkor-' + intent.agent + ':\n' +
          JSON.stringify(agentData, null, 2).slice(0, 1500);
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
      `You are Falkor, ${userCtx.name}'s intelligent personal AI assistant — like Jarvis.`,
      `${userCtx.name} is ${userCtx.desc}`,
      `Always address ${userCtx.name} by name. Be concise, specific, and proactive.`,
      `You already know what's happening in ${userCtx.name}'s world today — use the live context below to give immediate, useful answers without needing to be asked.`,
      systemExtra,
      liveContext,
      ragContext,
      productCtxStr,
    ].filter(Boolean).join('\n');

    // ── 6. Call asgard-ai router ──────────────────────────────────────────────
    let reply = '';
    let modelUsed = model;
    let providerUsed = '';
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
        // Capture which model was actually used (for UI badge)
        modelUsed = data.model_key || data.model || model;
        providerUsed = data.provider || '';
      } else {
        const errBody = await resp.text().catch(() => '');
        reply = '[AI error: ' + resp.status + (errBody ? ': ' + errBody.slice(0, 100) : '') + ']';
      }
    } catch (err) {
      reply = '[Connection error: ' + err.message + ']';
    }

    // ── 7. Save to history ────────────────────────────────────────────────────
    history.push({ role: 'user', content: text, ts: Date.now() });
    history.push({ role: 'assistant', content: reply, ts: Date.now() });
    await this.state.storage.put('history', JSON.stringify(history.slice(-200)));

    // ── 8. Auto-memory extraction (every 5 turns, fire-and-forget) ────────────
    maybeExtractMemory(history, userId, pin, aiUrl).catch(() => {});

    this.broadcast({ type: 'assistant_reply', text: reply, model: modelUsed, provider: providerUsed });
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
      return Response.json({ status: 'ok', version: '1.8.0', worker: 'falkor-agent' });
    }

    const userId = request.headers.get('X-User-Id') || url.searchParams.get('uid') || 'paddy';
    const id = env.AGENT.idFromName(userId);
    const stub = env.AGENT.get(id);
    return stub.fetch(request);
  },
};
