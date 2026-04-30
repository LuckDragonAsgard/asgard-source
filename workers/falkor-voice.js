// falkor-voice v1.0.0
// Phase 5 — Voice pipeline for Falkor
//
// Routes:
//   POST /transcribe   — STT via asgard-ai /stt (multipart audio → transcript)
//   POST /speak        — TTS via asgard-ai /speak (text → audio/mpeg)
//   GET  /health       — status
//   WS   /live         — Gemini Flash Live bidirectional audio (Durable Object)
//
// Env secrets (copy from asgard-ai via CF dashboard):
//   VOICE_PIN          — same PIN as rest of Falkor
//   AI_URL             — https://asgard-ai.luckdragon.io
//   GEMINI_API_KEY     — Google AI key
//   ELEVENLABS_API_KEY — ElevenLabs key
//   ELEVENLABS_VOICE_ID — default: pNInz6obpgDQGcFmaJgB (Adam), swap for Paddy's clone

// ── Durable Object — Gemini Live Session ─────────────────────────────────────

export class GeminiLiveSession {
  constructor(state, env) {
    this.state = state;
    this.env   = env;
    this.clientWs  = null; // browser connection
    this.geminiWs  = null; // Gemini upstream
    this.sessionId = null;
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('WebSocket required', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.clientWs = server;

    // Connect to Gemini BidiGenerateContent
    const model  = 'models/gemini-2.0-flash-exp';
    const apiKey = this.env.GEMINI_API_KEY || '';
    const geminiUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

    try {
      const geminiPair = new WebSocketPair();
      // Note: CF Workers can't open outbound WS directly yet in all plans
      // Use polling proxy approach instead
      this._startGeminiPolling(server);
    } catch (e) {
      server.send(JSON.stringify({ type: 'error', message: 'Gemini Live: ' + e.message }));
    }

    server.addEventListener('message', async (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        await this._handleClientMessage(msg, server);
      } catch (e) {
        server.send(JSON.stringify({ type: 'error', message: e.message }));
      }
    });

    server.addEventListener('close', () => {
      this.clientWs = null;
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  async _handleClientMessage(msg, ws) {
    // msg types from browser:
    //   {type:'setup', systemPrompt, voice}   — init session
    //   {type:'audio', data: base64_pcm}       — audio chunk
    //   {type:'text',  text: string}            — text turn
    //   {type:'interrupt'}                      — cancel current reply

    if (msg.type === 'setup') {
      this.systemPrompt = msg.systemPrompt || 'You are Falkor, a friendly AI assistant for Paddy. Be concise and conversational.';
      this.voice = msg.voice || 'Puck';
      ws.send(JSON.stringify({ type: 'ready', message: 'Gemini Live session ready' }));
      return;
    }

    if (msg.type === 'text') {
      // REST-based Gemini for text (reliable fallback)
      const reply = await this._geminiTextTurn(msg.text);
      ws.send(JSON.stringify({ type: 'transcript', text: msg.text, role: 'user' }));
      ws.send(JSON.stringify({ type: 'reply', text: reply, role: 'assistant' }));
      return;
    }

    if (msg.type === 'audio') {
      // Transcribe audio chunk via asgard-ai, then send to Gemini
      ws.send(JSON.stringify({ type: 'processing', message: 'transcribing...' }));
      try {
        const transcript = await this._transcribeB64Audio(msg.data, msg.mimeType || 'audio/webm;codecs=opus');
        if (transcript) {
          ws.send(JSON.stringify({ type: 'transcript', text: transcript, role: 'user' }));
          const reply = await this._geminiTextTurn(transcript);
          ws.send(JSON.stringify({ type: 'reply', text: reply, role: 'assistant' }));
        }
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', message: 'Voice turn failed: ' + e.message }));
      }
      return;
    }
  }

  async _transcribeB64Audio(b64data, mimeType) {
    const aiUrl = this.env.AI_URL || 'https://asgard-ai.luckdragon.io';
    const pin   = this.env.VOICE_PIN || '';

    const binary = atob(b64data);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const formData = new FormData();
    const blob = new Blob([bytes], { type: mimeType });
    formData.append('audio', blob, 'audio.webm');

    const res = await fetch(`${aiUrl}/stt`, {
      method: 'POST',
      headers: { 'X-Pin': pin },
      body: formData,
    });
    const data = await res.json();
    return data.transcript || data.text || '';
  }

  async _geminiTextTurn(userText) {
    const apiKey = this.env.GEMINI_API_KEY || '';
    const system = this.systemPrompt || 'You are Falkor, a helpful AI assistant for Paddy.';

    if (!this.history) this.history = [];
    this.history.push({ role: 'user', parts: [{ text: userText }] });

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: this.history.slice(-20),
          generationConfig: { maxOutputTokens: 512, temperature: 0.9 },
        }),
      }
    );
    const data = await res.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '[no reply]';
    this.history.push({ role: 'model', parts: [{ text: reply }] });
    return reply;
  }

  _startGeminiPolling(ws) {
    // Placeholder — full BidiGenerateContent WS needs outbound WS support
    ws.send(JSON.stringify({
      type: 'ready',
      message: 'Gemini Live session ready (text+audio mode)',
    }));
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Pin, Upgrade, Connection',
  };
}

// ── Main router ───────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors() });
    }

    const url  = new URL(request.url);
    const path = url.pathname;
    const pin  = request.headers.get('X-Pin') || url.searchParams.get('pin') || '';
    const validPin = env.VOICE_PIN || '535554';
    const aiUrl    = env.AI_URL || 'https://asgard-ai.luckdragon.io';

    // Health — no auth
    if (path === '/health') {
      return json({
        status: 'ok',
        version: '1.0.0',
        worker: 'falkor-voice',
        features: ['stt', 'tts', 'gemini-live'],
      });
    }

    // Auth
    if (pin !== validPin) {
      return json({ error: 'Unauthorized' }, 401);
    }

    // ── POST /transcribe — proxy to asgard-ai /stt ────────────────────────────
    if (path === '/transcribe' && request.method === 'POST') {
      try {
        const contentType = request.headers.get('Content-Type') || '';
        let body, headers = { 'X-Pin': pin };

        if (contentType.includes('multipart/form-data')) {
          // Pass through as-is
          body = request.body;
          headers['Content-Type'] = contentType;
        } else if (contentType.includes('application/json')) {
          // {audio_b64, mimeType} format — convert to multipart
          const { audio_b64, mimeType = 'audio/webm' } = await request.json();
          const binary = atob(audio_b64);
          const bytes  = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const formData = new FormData();
          formData.append('audio', new Blob([bytes], { type: mimeType }), 'audio.webm');
          body = formData;
        } else {
          // Raw audio bytes — wrap in FormData
          const bytes = await request.arrayBuffer();
          const formData = new FormData();
          formData.append('audio', new Blob([bytes], { type: contentType || 'audio/webm' }), 'audio.webm');
          body = formData;
        }

        const res = await fetch(`${aiUrl}/stt`, { method: 'POST', headers, body });
        const data = await res.json();

        return json({
          ok: true,
          transcript: data.transcript || data.text || '',
          confidence: data.confidence || null,
          words: data.words || [],
          duration: data.duration || null,
          raw: data,
        });
      } catch (e) {
        return json({ ok: false, error: e.message }, 500);
      }
    }

    // ── POST /speak — proxy to asgard-ai /speak → returns audio/mpeg ─────────
    if (path === '/speak' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { text, voice_id, model, stability, similarity } = body;
        if (!text) return json({ error: 'text required' }, 400);

        const payload = {
          text,
          voice_id:   voice_id   || env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB',
          model:      model      || 'eleven_turbo_v2_5',
          stability:  stability  || 0.5,
          similarity: similarity || 0.8,
        };

        const res = await fetch(`${aiUrl}/speak`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Pin': pin },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.text();
          return json({ ok: false, error: err }, res.status);
        }

        // Return audio directly
        const audio = await res.arrayBuffer();
        return new Response(audio, {
          headers: {
            'Content-Type': 'audio/mpeg',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache',
          },
        });
      } catch (e) {
        return json({ ok: false, error: e.message }, 500);
      }
    }

    // ── WS /live — Gemini Live Durable Object ─────────────────────────────────
    if (path === '/live' && request.headers.get('Upgrade') === 'websocket') {
      const sessionId = url.searchParams.get('session') || pin;
      const id  = env.LIVE.idFromName(sessionId);
      const obj = env.LIVE.get(id);
      return obj.fetch(request);
    }

    // ── POST /live/text — simple text turn through Gemini (no WS needed) ─────
    if (path === '/live/text' && request.method === 'POST') {
      try {
        const { text, history = [], system } = await request.json();
        if (!text) return json({ error: 'text required' }, 400);

        const apiKey = env.GEMINI_API_KEY || '';
        const systemPrompt = system || 'You are Falkor, a smart friendly AI assistant for Paddy Gallivan. Be concise and warm.';

        const contents = [
          ...history.map(h => ({ role: h.role, parts: [{ text: h.content }] })),
          { role: 'user', parts: [{ text }] },
        ];

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: systemPrompt }] },
              contents,
              generationConfig: { maxOutputTokens: 1024, temperature: 0.9 },
            }),
          }
        );

        const data = await res.json();
        if (!res.ok) return json({ ok: false, error: data }, res.status);
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '[no reply]';
        return json({ ok: true, reply, model: 'gemini-2.0-flash-exp' });
      } catch (e) {
        return json({ ok: false, error: e.message }, 500);
      }
    }

    return json({ error: 'Not found', path }, 404);
  },
};
