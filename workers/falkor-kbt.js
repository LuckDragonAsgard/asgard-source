// falkor-kbt v1.0.0 — Kow Brainer Trivia platform worker
// Routes: /health, /questions/generate, /questions/list, /event/create,
//         /event/get, /event/list, /event/start, /event/answer,
//         /event/scores, /music/generate, /summary

const AI_URL = 'https://asgard-ai.luckdragon.io';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Pin',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
function err(msg, status = 400) { return json({ error: msg }, status); }

function authOk(request, env) {
  const pin = request.headers.get('X-Pin') || new URL(request.url).searchParams.get('pin');
  return pin === (env.KBT_PIN || env.AGENT_PIN || '535554');
}

// ── Question generation via asgard-ai ──────────────────────────
async function generateQuestions(env, { topic, category, difficulty = 'medium', count = 10, style = 'multiple_choice' }) {
  const prompt = `Generate ${count} trivia questions for a live pub quiz (Kow Brainer Trivia).
Topic: ${topic || 'General Knowledge'}
Category: ${category || 'Mixed'}
Difficulty: ${difficulty} (easy=everyone knows, medium=half the table, hard=specialist)
Style: ${style}

Rules:
- Each question must have exactly 4 options (A, B, C, D)
- Only one correct answer
- Make questions fun and engaging for an Australian audience
- Avoid overly obscure answers
- For multiple_choice, mark correct answer clearly

Respond with ONLY valid JSON array, no markdown:
[
  {
    "id": 1,
    "question": "...",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "answer": "A",
    "answer_text": "...",
    "category": "...",
    "difficulty": "medium",
    "fun_fact": "..."
  }
]`;

  const res = await fetch(`${AI_URL}/chat/smart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Pin': env.AGENT_PIN || '535554' },
    body: JSON.stringify({ text: prompt, model: 'groq', system: 'You are a professional pub quiz writer. Return ONLY valid JSON, no markdown, no explanation.' }),
  });

  const data = await res.json();
  const reply = data.reply || data.text || '';

  // extract JSON array from reply
  const match = reply.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON array in AI response');
  return JSON.parse(match[0]);
}

// ── D1 helpers ─────────────────────────────────────────────────
async function dbRun(env, sql, ...params) {
  return env.KBT_DB.prepare(sql).bind(...params).run();
}
async function dbAll(env, sql, ...params) {
  return env.KBT_DB.prepare(sql).bind(...params).all();
}
async function dbFirst(env, sql, ...params) {
  return env.KBT_DB.prepare(sql).bind(...params).first();
}

// ── Init DB ────────────────────────────────────────────────────
async function initDB(env) {
  await env.KBT_DB.exec(`
    CREATE TABLE IF NOT EXISTS kbt_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic TEXT, category TEXT, difficulty TEXT,
      question TEXT NOT NULL, options TEXT NOT NULL,
      answer TEXT NOT NULL, answer_text TEXT,
      fun_fact TEXT, created_at INTEGER DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS kbt_events (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL, venue TEXT, date TEXT,
      status TEXT DEFAULT 'draft',
      current_round INTEGER DEFAULT 0,
      current_question INTEGER DEFAULT 0,
      question_ids TEXT DEFAULT '[]',
      created_at INTEGER DEFAULT (unixepoch()),
      started_at INTEGER, ended_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS kbt_teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL, team_name TEXT NOT NULL,
      score INTEGER DEFAULT 0, answers TEXT DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS kbt_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL, team_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL, answer TEXT,
      correct INTEGER DEFAULT 0, points INTEGER DEFAULT 0,
      answered_at INTEGER DEFAULT (unixepoch())
    );
  `);
  return { ok: true, message: 'KBT database initialised' };
}

// ── Main handler ───────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

    // ── Health (no auth) ──
    if (path === '/health') {
      return json({ status: 'ok', version: '1.0.0', worker: 'falkor-kbt', service: 'Kow Brainer Trivia' });
    }

    // ── Init DB (no auth needed for setup) ──
    if (path === '/init' && method === 'POST') {
      try { return json(await initDB(env)); }
      catch (e) { return err(e.message, 500); }
    }

    // ── Auth check ──
    if (!authOk(request, env)) return err('Unauthorized', 401);

    // ── GET /questions/list ──
    if (path === '/questions/list' && method === 'GET') {
      try {
        const category = url.searchParams.get('category');
        const difficulty = url.searchParams.get('difficulty');
        const limit = parseInt(url.searchParams.get('limit') || '50');
        let sql = 'SELECT * FROM kbt_questions';
        const params = [];
        const wheres = [];
        if (category) { wheres.push('category = ?'); params.push(category); }
        if (difficulty) { wheres.push('difficulty = ?'); params.push(difficulty); }
        if (wheres.length) sql += ' WHERE ' + wheres.join(' AND ');
        sql += ' ORDER BY created_at DESC LIMIT ?';
        params.push(limit);
        const res = await env.KBT_DB.prepare(sql).bind(...params).all();
        const questions = (res.results || []).map(q => ({
          ...q,
          options: JSON.parse(q.options || '[]'),
        }));
        return json({ questions, count: questions.length });
      } catch (e) { return err(e.message, 500); }
    }

    // ── POST /questions/generate ──
    if (path === '/questions/generate' && method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const { topic, category, difficulty, count = 10, style, save = true } = body;
        const questions = await generateQuestions(env, { topic, category, difficulty, count, style });

        if (save && env.KBT_DB) {
          for (const q of questions) {
            await env.KBT_DB.prepare(
              'INSERT INTO kbt_questions (topic,category,difficulty,question,options,answer,answer_text,fun_fact) VALUES (?,?,?,?,?,?,?,?)'
            ).bind(
              topic || 'General', q.category || category || 'Mixed',
              q.difficulty || difficulty || 'medium',
              q.question, JSON.stringify(q.options),
              q.answer, q.answer_text || '', q.fun_fact || ''
            ).run();
          }
        }
        return json({ questions, count: questions.length, saved: save });
      } catch (e) { return err(e.message, 500); }
    }

    // ── POST /event/create ──
    if (path === '/event/create' && method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const { name, venue, date, question_ids = [] } = body;
        if (!name) return err('name required');
        const id = 'kbt_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
        await dbRun(env,
          'INSERT INTO kbt_events (id,name,venue,date,question_ids) VALUES (?,?,?,?,?)',
          id, name, venue || '', date || new Date().toISOString().slice(0,10), JSON.stringify(question_ids)
        );
        return json({ id, name, venue, date, status: 'draft', question_ids });
      } catch (e) { return err(e.message, 500); }
    }

    // ── GET /event/list ──
    if (path === '/event/list' && method === 'GET') {
      try {
        const res = await dbAll(env, 'SELECT * FROM kbt_events ORDER BY created_at DESC LIMIT 20');
        const events = (res.results || []).map(e => ({
          ...e,
          question_ids: JSON.parse(e.question_ids || '[]'),
        }));
        return json({ events });
      } catch (e) { return err(e.message, 500); }
    }

    // ── GET /event/get?id=... ──
    if (path === '/event/get' && method === 'GET') {
      try {
        const id = url.searchParams.get('id');
        if (!id) return err('id required');
        const event = await dbFirst(env, 'SELECT * FROM kbt_events WHERE id = ?', id);
        if (!event) return err('Event not found', 404);
        const teams = await dbAll(env, 'SELECT * FROM kbt_teams WHERE event_id = ? ORDER BY score DESC', id);
        const qIds = JSON.parse(event.question_ids || '[]');
        let currentQ = null;
        if (qIds.length > 0 && event.current_question < qIds.length) {
          currentQ = await dbFirst(env, 'SELECT * FROM kbt_questions WHERE id = ?', qIds[event.current_question]);
          if (currentQ) currentQ.options = JSON.parse(currentQ.options || '[]');
        }
        return json({
          ...event,
          question_ids: qIds,
          teams: teams.results || [],
          current_question_data: currentQ,
          total_questions: qIds.length,
        });
      } catch (e) { return err(e.message, 500); }
    }

    // ── POST /event/start ──
    if (path === '/event/start' && method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const { id } = body;
        if (!id) return err('id required');
        await dbRun(env,
          'UPDATE kbt_events SET status=?, started_at=unixepoch(), current_question=0 WHERE id=?',
          'live', id
        );
        return json({ ok: true, id, status: 'live' });
      } catch (e) { return err(e.message, 500); }
    }

    // ── POST /event/next ──
    if (path === '/event/next' && method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const { id } = body;
        if (!id) return err('id required');
        const event = await dbFirst(env, 'SELECT * FROM kbt_events WHERE id = ?', id);
        if (!event) return err('Event not found', 404);
        const qIds = JSON.parse(event.question_ids || '[]');
        const nextQ = event.current_question + 1;
        if (nextQ >= qIds.length) {
          await dbRun(env, 'UPDATE kbt_events SET status=?, ended_at=unixepoch() WHERE id=?', 'finished', id);
          return json({ ok: true, finished: true, id });
        }
        await dbRun(env, 'UPDATE kbt_events SET current_question=? WHERE id=?', nextQ, id);
        const q = await dbFirst(env, 'SELECT * FROM kbt_questions WHERE id = ?', qIds[nextQ]);
        if (q) q.options = JSON.parse(q.options || '[]');
        return json({ ok: true, current_question: nextQ, question: q, total: qIds.length });
      } catch (e) { return err(e.message, 500); }
    }

    // ── POST /event/answer ──
    if (path === '/event/answer' && method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const { event_id, team_id, question_id, answer } = body;
        if (!event_id || !team_id || !question_id || !answer) return err('event_id, team_id, question_id, answer required');
        const q = await dbFirst(env, 'SELECT * FROM kbt_questions WHERE id = ?', question_id);
        if (!q) return err('Question not found', 404);
        const correct = answer.toUpperCase() === q.answer.toUpperCase() ? 1 : 0;
        const points = correct ? 1 : 0;
        await dbRun(env,
          'INSERT OR REPLACE INTO kbt_answers (event_id,team_id,question_id,answer,correct,points) VALUES (?,?,?,?,?,?)',
          event_id, team_id, question_id, answer, correct, points
        );
        if (correct) {
          await dbRun(env, 'UPDATE kbt_teams SET score = score + 1 WHERE id = ?', team_id);
        }
        return json({ ok: true, correct: correct === 1, points, answer: q.answer, answer_text: q.answer_text, fun_fact: q.fun_fact });
      } catch (e) { return err(e.message, 500); }
    }

    // ── POST /event/team/join ──
    if (path === '/event/team/join' && method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const { event_id, team_name } = body;
        if (!event_id || !team_name) return err('event_id, team_name required');
        const existing = await dbFirst(env, 'SELECT * FROM kbt_teams WHERE event_id = ? AND team_name = ?', event_id, team_name);
        if (existing) return json({ team: existing, joined: false, message: 'Already in event' });
        const res = await dbRun(env, 'INSERT INTO kbt_teams (event_id,team_name) VALUES (?,?)', event_id, team_name);
        return json({ team: { id: res.meta?.last_row_id, event_id, team_name, score: 0 }, joined: true });
      } catch (e) { return err(e.message, 500); }
    }

    // ── GET /event/scores ──
    if (path === '/event/scores' && method === 'GET') {
      try {
        const id = url.searchParams.get('id');
        if (!id) return err('id required');
        const teams = await dbAll(env, 'SELECT * FROM kbt_teams WHERE event_id = ? ORDER BY score DESC', id);
        return json({ event_id: id, scores: teams.results || [] });
      } catch (e) { return err(e.message, 500); }
    }

    // ── POST /music/generate ──
    if (path === '/music/generate' && method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const { theme = 'trivia night', style = 'upbeat pub quiz' } = body;
        // Suno API integration (future - return placeholder for now)
        // When Suno API key is available, wire it up here
        const prompt = `Generate a short, upbeat ${style} music prompt for a "${theme}" themed trivia event. Keep it energetic and fun.`;
        const res = await fetch(`${AI_URL}/chat/smart`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Pin': env.AGENT_PIN || '535554' },
          body: JSON.stringify({ text: prompt, model: 'groq-fast' }),
        });
        const data = await res.json();
        return json({
          prompt: data.reply || 'Upbeat trivia night anthem',
          theme, style,
          note: 'Suno API integration ready — add SUNO_API_KEY to enable actual music generation',
        });
      } catch (e) { return err(e.message, 500); }
    }

    // ── GET /summary ── (for falkor-agent context)
    if (path === '/summary' && method === 'GET') {
      try {
        const eventCount = await dbFirst(env, 'SELECT COUNT(*) as c FROM kbt_events');
        const questionCount = await dbFirst(env, 'SELECT COUNT(*) as c FROM kbt_questions');
        const liveEvents = await dbAll(env, "SELECT id,name,venue,date FROM kbt_events WHERE status='live' LIMIT 3");
        const recentEvents = await dbAll(env, "SELECT id,name,venue,date,status FROM kbt_events ORDER BY created_at DESC LIMIT 5");
        return json({
          summary: `Kow Brainer Trivia: ${eventCount?.c || 0} events, ${questionCount?.c || 0} questions in bank`,
          total_events: eventCount?.c || 0,
          total_questions: questionCount?.c || 0,
          live_events: liveEvents.results || [],
          recent_events: recentEvents.results || [],
        });
      } catch (e) {
        return json({ summary: 'KBT platform ready', total_events: 0, total_questions: 0, live_events: [], recent_events: [] });
      }
    }

    return err('Not found', 404);
  },
};

// Durable Object stub — preserves existing DO bindings
export class KBTGame {
  constructor(state, env) { this.state = state; this.env = env; }
  async fetch(request) {
    return new Response(JSON.stringify({ status: 'ok', class: 'KBTGame' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
