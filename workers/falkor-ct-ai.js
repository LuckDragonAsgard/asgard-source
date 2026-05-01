// falkor-ct-ai v1.0.0
// Backend AI for Carnival Timing — race summaries, time flagging, heat suggestions
// Deploy to: falkor-ct-ai.luckdragon.io

const VERSION = '1.0.0';
const AGENT_URL = 'https://falkor-agent.luckdragon.io';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Pin',
};

function corsJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

async function askFalkor(prompt, env) {
  const pin = env.AGENT_PIN || '';
  const resp = await fetch(`${AGENT_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Pin': pin,
      'X-User-Id': 'falkor-ct-ai',
    },
    body: JSON.stringify({
      text: prompt,
      model: 'haiku',
      productContext: 'Carnival Timing school sport race timing platform',
    }),
  });
  if (!resp.ok) throw new Error(`Agent error ${resp.status}`);
  const data = await resp.json();
  return data.reply || '';
}

async function handleSummarize(body, env) {
  const { event, carnival, results } = body;
  if (!event || !Array.isArray(results) || results.length === 0) {
    return corsJson({ error: 'event and results[] required' }, 400);
  }
  const sorted = [...results].filter(r => r.time).sort((a, b) => a.time - b.time);
  const resultLines = sorted
    .map((r, i) => `  ${i + 1}. ${r.athlete || 'Unknown'} (${r.school || 'Unknown school'}) — ${r.time.toFixed(2)}s`)
    .join('\n');
  const prompt = `You are the announcer for a school athletics carnival. Write a short, enthusiastic summary (3-5 sentences) for this race result. Use Australian English. Mention the winner by name and their time. Keep it positive and suitable for kids and parents.\n\nEvent: ${event}${carnival ? `\nCarnival: ${carnival}` : ''}\nResults:\n${resultLines}\n\nWrite the summary now:`;
  const summary = await askFalkor(prompt, env);
  return corsJson({ summary });
}

async function handleFlagTimes(body, env) {
  const { event, results } = body;
  if (!event || !Array.isArray(results) || results.length === 0) {
    return corsJson({ error: 'event and results[] required' }, 400);
  }
  const resultLines = results.map(r => {
    const splitsStr = Array.isArray(r.splits) ? r.splits.join(', ') : 'none';
    return `  Lane ${r.lane} - ${r.athlete || 'Unknown'} (${r.school || 'Unknown'}): splits=[${splitsStr}], published=${r.published ?? 'none'}`;
  }).join('\n');
  const prompt = `You are a timing analyst for a school athletics carnival. Review these race results and flag any suspicious times. Look for: outlier splits (one timer much faster/slower), unusually fast/slow published times, large spread between splits (>0.5s), or missing data.\n\nEvent: ${event}\nLane results:\n${resultLines}\n\nReturn ONLY a JSON array of flags (empty [] if none) in this format:\n[{"lane": 1, "athlete": "Name", "issue": "description", "severity": "info|warn|error"}]`;
  let flagsRaw = await askFalkor(prompt, env);
  let flags = [];
  try {
    const match = flagsRaw.match(/\[[\s\S]*\]/);
    if (match) flags = JSON.parse(match[0]);
  } catch (e) {
    flags = [];
  }
  return corsJson({ flags });
}

async function handleSuggestHeats(body, env) {
  const { event, athletes, lanesPerHeat = 8 } = body;
  if (!event || !Array.isArray(athletes) || athletes.length === 0) {
    return corsJson({ error: 'event and athletes[] required' }, 400);
  }
  const numHeats = Math.ceil(athletes.length / lanesPerHeat);
  const athleteLines = athletes
    .map((a, i) => `  ${i + 1}. ${a.name || 'Unknown'} (${a.school || 'Unknown'})${a.seedTime ? ' — seed: ' + a.seedTime + 's' : ''}`)
    .join('\n');
  const prompt = `You are a school carnival draw coordinator. Create heat assignments for this event.\n\nRules:\n- Max ${lanesPerHeat} athletes per heat\n- ${numHeats} heat(s) needed\n- If seed times provided: group similar abilities together (slowest early heats, fastest in final heat)\n- If no seed times: spread schools evenly so same-school athletes don't all clash\n- Number lanes 1-${lanesPerHeat} within each heat\n\nEvent: ${event}\nAthletes (${athletes.length} total):\n${athleteLines}\n\nReturn ONLY a JSON object in this format:\n{"heats": [[{"name": "Alex Smith", "school": "Williamstown PS", "lane": 1}]], "rationale": "One sentence explaining grouping logic."}`;
  let raw = await askFalkor(prompt, env);
  let heats = [], rationale = '';
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      heats = parsed.heats || [];
      rationale = parsed.rationale || '';
    }
  } catch (e) {
    rationale = 'Could not parse AI response';
  }
  return corsJson({ heats, rationale });
}

async function handleCommentary(body, env) {
  const { event, carnival, topResults } = body;
  if (!event || !Array.isArray(topResults) || topResults.length === 0) {
    return corsJson({ error: 'event and topResults[] required' }, 400);
  }
  const top3 = topResults.slice(0, 3);
  const lines = top3.map(r => `  ${r.place}. ${r.athlete} (${r.school}) ${r.time}s`).join('\n');
  const prompt = `Write ONE punchy line (max 20 words) to display on a live results board at a school athletics carnival. Celebrate the winner. Fun for kids.\n\nEvent: ${event}${carnival ? ` at ${carnival}` : ''}\nTop 3:\n${lines}\n\nOne line only:`;
  const commentary = await askFalkor(prompt, env);
  return corsJson({ commentary: commentary.trim() });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (path === '/health') {
      return corsJson({ status: 'ok', version: VERSION, worker: 'falkor-ct-ai' });
    }
    if (request.method !== 'POST') {
      return corsJson({ error: 'POST required' }, 405);
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return corsJson({ error: 'Invalid JSON' }, 400);
    }
    try {
      if (path === '/summarize')     return await handleSummarize(body, env);
      if (path === '/flag-times')    return await handleFlagTimes(body, env);
      if (path === '/suggest-heats') return await handleSuggestHeats(body, env);
      if (path === '/commentary')    return await handleCommentary(body, env);
      return corsJson({ error: 'Not found' }, 404);
    } catch (err) {
      console.error('falkor-ct-ai error:', err.message);
      return corsJson({ error: err.message }, 500);
    }
  },
};
