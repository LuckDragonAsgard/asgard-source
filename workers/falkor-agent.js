// falkor-agent v1.1.0-rag — Durable Object per user
// Phase 2 of the Falkor rebuild (formerly Asgard)
// Persistent WebSocket hub + chat history + per-user memory
// One DO instance per user (keyed by userId)

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
      const { text, model } = await request.json();
      const reply = await this.processChat(text, model || 'groq-fast', null);
      return Response.json({ reply });
    }

    if (path === '/history' && request.method === 'GET') {
      return Response.json(await this.getHistory());
    }

    if (path === '/history' && request.method === 'DELETE') {
      await this.resetHistory();
      return Response.json({ ok: true });
    }

    if (path === '/memory' && request.method === 'GET') {
      return Response.json(await this.getMemory());
    }

    if (path === '/memory' && request.method === 'POST') {
      const { key, value } = await request.json();
      await this.saveMemory(key, value);
      return Response.json({ ok: true });
    }

    if (path === '/memory' && request.method === 'DELETE') {
      await this.clearMemory();
      return Response.json({ ok: true });
    }

    if (path === '/status') {
      const history = await this.getHistory();
      const memory = await this.getMemory();
      return Response.json({
        version: '1.1.0-rag',
        activeSessions: this.sessions.size,
        historyLength: history.length,
        memoryKeys: Object.keys(memory).length,
      });
    }

    return new Response('Not found', { status: 404 });
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

    server.addEventListener('close', () => {
      this.sessions.delete(wsId);
    });

    server.addEventListener('error', () => {
      this.sessions.delete(wsId);
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  async processChat(text, model, ws) {
    // Load existing history
    const history = await this.getHistory();

    // Load per-user memory facts for system prompt enrichment
    const memory = await this.getMemory();
    const memoryLines = Object.entries(memory)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    const systemExtra = memoryLines
      ? '\n\nUser facts you remember:\n' + memoryLines
      : '';

    // Build context array for history (last 40 messages = 20 exchanges)
    const context = history.slice(-40).map(h => ({ role: h.role, content: h.content }));

    // Broadcast user message to all WS sessions
    this.broadcast({ type: 'user_message', text, model });

    // Fetch relevant context from falkor-brain (RAG)
    let ragContext = '';
    try {
      const ragResp = await fetch(`${brainUrl || 'https://falkor-brain.luckdragon.io'}/recall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Pin': this.env.AGENT_PIN || '' },
        body: JSON.stringify({ query: text, top_k: 3, answer: false }),
      });
      if (ragResp.ok) {
        const ragData = await ragResp.json();
        const matches = (ragData.matches || []).filter(m => m.score > 0.5);
        if (matches.length > 0) {
          ragContext = '\n\nRelevant context from memory:\n' + matches.map((m, i) => `${i+1}. [${m.category}] ${m.content}`).join('\n');
        }
      }
    } catch (e) { /* brain unavailable — continue without */ }

    // Call asgard-ai router
    // API format: { message: string, context: [...], model, max_tokens, system }
    let reply = '';
    try {
      const aiUrl = this.env.AI_WORKER_URL || 'https://asgard-ai.luckdragon.io';
      const brainUrl = 'https://falkor-brain.luckdragon.io';
      const resp = await fetch(`${aiUrl}/chat/smart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Pin': this.env.AGENT_PIN || '',
        },
        body: JSON.stringify({
          message: text,
          context,
          system: 'You are Falkor, an intelligent personal AI assistant for Paddy.' + systemExtra + ragContext,
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

    // Save to history (keep last 200 messages = 100 exchanges)
    history.push({ role: 'user', content: text, ts: Date.now() });
    history.push({ role: 'assistant', content: reply, ts: Date.now() });
    const trimmed = history.slice(-200);
    await this.state.storage.put('history', JSON.stringify(trimmed));

    // Broadcast reply to all WS sessions
    this.broadcast({ type: 'assistant_reply', text: reply, model });

    return reply;
  }

  broadcast(msg) {
    const payload = JSON.stringify(msg);
    for (const [id, ws] of this.sessions) {
      try {
        ws.send(payload);
      } catch {
        this.sessions.delete(id);
      }
    }
  }

  async getHistory() {
    const raw = await this.state.storage.get('history');
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }

  async resetHistory() {
    await this.state.storage.delete('history');
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

  async clearMemory() {
    await this.state.storage.delete('memory');
  }
}

// Router — auth via X-Pin, then dispatch to user's DO instance
export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Pin, Upgrade, Connection',
        },
      });
    }

    const url = new URL(request.url);

    // Auth check (skip for health endpoint)
    if (url.pathname !== '/health') {
      const pin = request.headers.get('X-Pin') || url.searchParams.get('pin');
      const validPin = env.AGENT_PIN;
      if (!pin || !validPin || pin !== validPin) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Health check (no auth needed)
    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', version: '1.1.0-rag', worker: 'falkor-agent' });
    }

    // Route to user's Durable Object (one per user, keyed by userId)
    const userId = request.headers.get('X-User-Id') || url.searchParams.get('uid') || 'paddy';
    const id = env.AGENT.idFromName(userId);
    const stub = env.AGENT.get(id);

    return stub.fetch(request);
  },
};
