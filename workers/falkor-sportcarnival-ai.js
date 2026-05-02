// falkor-sportcarnival-ai v1.1.0
// Backend AI for SportCarnival — draw explanations, result summaries, ladder commentary, team selection, news blurbs

const VERSION = '1.1.0';
const AGENT_URL = 'https://falkor-agent.luckdragon.io';
const SC_DRAW_URL = 'https://sportcarnival.com.au/api/draw';
const SC_RESULTS_URL = 'https://sportcarnival.com.au/api/results';

async function getLiveSheetData(type) {
  const url = type === 'results' ? SC_RESULTS_URL : SC_DRAW_URL;
  try {
    const r = await fetch(url, { cf: { cacheEverything: true, cacheTtl: 120 } });
    if (!r.ok) return null;
    const d = await r.json();
    return d.error ? null : d;
  } catch { return null; }
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Pin',
};
function corsJson(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
}
async function askFalkor(prompt, env) {
  const resp = await fetch(`${AGENT_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Pin': env.AGENT_PIN || '', 'X-User-Id': 'falkor-sportcarnival-ai' },
    body: JSON.stringify({ text: prompt, model: 'haiku', productContext: 'SportCarnival district school sport competition platform' }),
  });
  if (!resp.ok) throw new Error(`Agent error ${resp.status}`);
  return (await resp.json()).reply || '';
}
async function handleDrawExplanation(body, env) {
  const { competition, round, fixtures, drawMethod } = body;
  if (!competition || !Array.isArray(fixtures)) return corsJson({ error: 'competition and fixtures[] required' }, 400);
  const fixtureLines = fixtures.map((f, i) => `  ${i + 1}. ${f.homeTeam} vs ${f.awayTeam}${f.venue ? ' @ ' + f.venue : ''}${f.time ? ' (' + f.time + ')' : ''}`).join('\n');
  const prompt = `Write a short, clear explanation (2-3 sentences) of how this draw was made for a school sport competition. Australian English. Friendly for school admin and parents.\n\nCompetition: ${competition}\n${round ? `Round: ${round}\n` : ''}Draw method: ${drawMethod || 'random draw'}\nFixtures:\n${fixtureLines}\n\nExplain how the draw works:`;
  return corsJson({ explanation: (await askFalkor(prompt, env)).trim() });
}
async function handleResultSummary(body, env) {
  const { competition, round, results } = body;
  if (!competition || !Array.isArray(results) || results.length === 0) return corsJson({ error: 'competition and results[] required' }, 400);
  const resultLines = results.map(r => {
    const winner = r.homeScore > r.awayScore ? r.homeTeam : r.homeScore < r.awayScore ? r.awayTeam : 'Draw';
    return `  ${r.homeTeam} ${r.homeScore} – ${r.awayScore} ${r.awayTeam} (${winner === 'Draw' ? 'Draw' : winner + ' won'})`;
  }).join('\n');
  const prompt = `Write an engaging results wrap-up (3-5 sentences) for a school sport competition newsletter. Australian English. Highlight standout results, close games, big wins.\n\nCompetition: ${competition}\n${round ? `Round: ${round}\n` : ''}Results:\n${resultLines}\n\nWrite the results summary now:`;
  return corsJson({ summary: await askFalkor(prompt, env) });
}
async function handleLadderCommentary(body, env) {
  const { competition, ladder } = body;
  if (!competition || !Array.isArray(ladder) || ladder.length === 0) return corsJson({ error: 'competition and ladder[] required' }, 400);
  const ladderLines = ladder.slice(0, 5).map(t => `  ${t.position}. ${t.team} — ${t.points}pts (W${t.wins} D${t.draws || 0} L${t.losses})`).join('\n');
  const prompt = `Write a brief ladder update commentary (3-4 sentences) for a school sport competition newsletter. Australian English. Mention top teams and interesting battles.\n\nCompetition: ${competition}\nCurrent ladder (top 5):\n${ladderLines}\n\nWrite the ladder commentary:`;
  return corsJson({ commentary: await askFalkor(prompt, env) });
}
async function handleTeamSelection(body, env) {
  const { sport, squad, teamSize = 12, selectionCriteria } = body;
  if (!sport || !Array.isArray(squad)) return corsJson({ error: 'sport and squad[] required' }, 400);
  const squadLines = squad.map((p, i) => `  ${i + 1}. ${p.name} (${p.school || 'Unknown'})${p.position ? ' — ' + p.position : ''}${p.stats ? ' — ' + p.stats : ''}`).join('\n');
  const prompt = `You are a school sport selection coordinator. Select the best team of ${teamSize} players from this squad.\n\nSport: ${sport}\nCriteria: ${selectionCriteria || 'balance of positions, school representation, performance'}\nSquad (${squad.length}):\n${squadLines}\n\nReturn ONLY JSON: {"team": [{"name": "...", "school": "...", "position": "..."}], "rationale": "Two sentences."}`;
  let raw = await askFalkor(prompt, env);
  let team = [], rationale = '';
  try { const m = raw.match(/\{[\s\S]*\}/); if (m) { const p = JSON.parse(m[0]); team = p.team || []; rationale = p.rationale || ''; } } catch { rationale = 'Could not parse'; }
  return corsJson({ team, rationale });
}
async function handleNewsBlurb(body, env) {
  const { competition, highlights, week } = body;
  if (!competition || !Array.isArray(highlights)) return corsJson({ error: 'competition and highlights[] required' }, 400);
  const hlLines = highlights.map(h => `  - ${h}`).join('\n');
  const prompt = `Write a short school newsletter news item (3-4 sentences) about a school sport competition. Australian English. Upbeat and community-friendly.\n\nCompetition: ${competition}\n${week ? `Week: ${week}\n` : ''}Key highlights:\n${hlLines}\n\nWrite the newsletter blurb:`;
  return corsJson({ blurb: (await askFalkor(prompt, env)).trim() });
}
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (path === '/health') return corsJson({ status: 'ok', version: VERSION, worker: 'falkor-sportcarnival-ai' });
    if (request.method !== 'POST') return corsJson({ error: 'POST required' }, 405);
    let body; try { body = await request.json(); } catch { return corsJson({ error: 'Invalid JSON' }, 400); }
    try {
      if (path === '/draw-explanation') return await handleDrawExplanation(body, env);
      if (path === '/result-summary') return await handleResultSummary(body, env);
      if (path === '/ladder-commentary') return await handleLadderCommentary(body, env);
      if (path === '/team-selection') return await handleTeamSelection(body, env);
      if (path === '/news-blurb') return await handleNewsBlurb(body, env);
      // Live draw from Google Sheet (Phase 34)
  if (path === '/draw-live' && method === 'POST') {
    const body = await req.json().catch(() => ({}));
    const sheetData = await getLiveSheetData('draw');
    if (!sheetData || !sheetData.rows || !sheetData.rows.length) {
      return corsJson({ error: 'No draw data available. Set GSHEET_ID on sportcarnival-hub.', hint: 'Share your Google Sheet publicly (File > Share > Publish) and set the GSHEET_ID secret.' }, 503);
    }
    const rows = sheetData.rows;
    const headers = sheetData.headers || [];
    const tableText = [headers.join(' | ')].concat(rows.slice(0,50).map(r => headers.map(h => r[h]||'').join(' | '))).join('
');
    const competition = body.competition || 'District Carnival';
    const prompt = 'You have live draw data from a Google Sheet for the ' + competition + '. Explain the draw in a clear, friendly way for parents and athletes. Highlight key matchups, timing, and what to expect.

Draw data:
' + tableText.slice(0, 2000);
    return await askFalkor(prompt, env);
  }

  if (path === '/results-live' && method === 'POST') {
    const body = await req.json().catch(() => ({}));
    const sheetData = await getLiveSheetData('results');
    if (!sheetData || !sheetData.rows || !sheetData.rows.length) {
      return corsJson({ error: 'No results data available. Check GSHEET_ID and ensure Results sheet exists.' }, 503);
    }
    const rows = sheetData.rows;
    const headers = sheetData.headers || [];
    const tableText = [headers.join(' | ')].concat(rows.slice(0,50).map(r => headers.map(h => r[h]||'').join(' | '))).join('
');
    const competition = body.competition || 'District Carnival';
    const prompt = 'You have live results data from a Google Sheet for the ' + competition + '. Summarise the results clearly — highlight winners, top performances, and any notable moments.

Results data:
' + tableText.slice(0, 2000);
    return await askFalkor(prompt, env);
  }

  if (path === '/sheet-data' && method === 'GET') {
    const type = new URL(req.url).searchParams.get('type') || 'draw';
    const data = await getLiveSheetData(type);
    if (!data) return corsJson({ error: 'No data — check GSHEET_ID secret and sheet publish settings.' }, 503);
    return corsJson({ ok: true, ...data });
  }

  return corsJson({ error: 'Not found' }, 404);
    } catch (err) { return corsJson({ error: err.message }, 500); }
  },
};
