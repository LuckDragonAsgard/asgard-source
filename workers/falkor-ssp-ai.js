// falkor-ssp-ai v1.0.0
// Backend AI for School Sport Portal
// Endpoints: /sport-plan, /event-description, /house-summary, /qualifier-message, /carnival-program, /health

const VERSION = '1.0.0';
const AGENT_URL = 'https://falkor-agent.luckdragon.io';
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
    headers: { 'Content-Type': 'application/json', 'X-Pin': env.AGENT_PIN || '', 'X-User-Id': 'falkor-ssp-ai' },
    body: JSON.stringify({ text: prompt, model: 'haiku', productContext: 'School Sport Portal school sport management platform' }),
  });
  if (!resp.ok) throw new Error(`Agent error ${resp.status}`);
  return (await resp.json()).reply || '';
}
async function handleSportPlan(body, env) {
  const { school, yearLevel, term, sport, weeksAvailable = 8, focus } = body;
  if (!school || !yearLevel || !sport) return corsJson({ error: 'school, yearLevel, sport required' }, 400);
  const prompt = `You are a PE coordinator helping an Australian primary school plan their sport program.\n\nCreate a ${weeksAvailable}-week sport program for:\n- School: ${school}\n- Year Level: Year ${yearLevel}\n- Term: ${term || 'Term 2'}\n- Sport/Activity: ${sport}\n${focus ? `- Focus areas: ${focus}` : ''}\n\nFormat as a numbered week-by-week plan. Each week: one line with the session focus and a key activity. Keep it practical, age-appropriate, and aligned with Australian Curriculum Health and Physical Education. End with 2-3 assessment ideas.`;
  return corsJson({ plan: await askFalkor(prompt, env) });
}
async function handleEventDescription(body, env) {
  const { event, ageGroup, format, school, carnival } = body;
  if (!event || !ageGroup) return corsJson({ error: 'event and ageGroup required' }, 400);
  const prompt = `Write a short, engaging description (2-3 sentences) for a school carnival event program. Use Australian English. Suitable for parents and students.\n\nEvent: ${event}\nAge Group: ${ageGroup}\n${format ? `Format: ${format}\n` : ''}${school ? `School: ${school}\n` : ''}${carnival ? `Carnival: ${carnival}\n` : ''}\nWrite the event description now:`;
  return corsJson({ description: (await askFalkor(prompt, env)).trim() });
}
async function handleHouseSummary(body, env) {
  const { carnival, houses } = body;
  if (!Array.isArray(houses) || houses.length === 0) return corsJson({ error: 'houses[] required' }, 400);
  const sorted = [...houses].sort((a, b) => b.points - a.points);
  const houseLines = sorted.map((h, i) => `  ${i + 1}. ${h.name} — ${h.points} points${h.events ? ' (won: ' + h.events.map(e => e.name).join(', ') + ')' : ''}`).join('\n');
  const prompt = `Write a short, celebratory house competition summary (3-4 sentences) for a school sport carnival newsletter. Use Australian English. Congratulate the winner, acknowledge all houses.\n\n${carnival ? `Carnival: ${carnival}\n` : ''}House results:\n${houseLines}\n\nWrite the summary now:`;
  return corsJson({ summary: await askFalkor(prompt, env) });
}
async function handleQualifierMessage(body, env) {
  const { student, school, event, time, place, district } = body;
  if (!student || !event) return corsJson({ error: 'student and event required' }, 400);
  const prompt = `Write a short congratulations message (2-3 sentences) to a student who has qualified for the next level of competition. Enthusiastic and encouraging. Australian English.\n\nStudent: ${student}\nSchool: ${school || 'their school'}\nEvent: ${event}\n${place ? `Place: ${place}\n` : ''}${time ? `Time/Result: ${time}\n` : ''}${district ? `Qualifying for: ${district}\n` : 'Qualifying for district level\n'}\nWrite the message now:`;
  return corsJson({ message: (await askFalkor(prompt, env)).trim() });
}
async function handleCarnivalProgram(body, env) {
  const { school, date, events, houses } = body;
  if (!school || !Array.isArray(events)) return corsJson({ error: 'school and events[] required' }, 400);
  const eventList = events.map((e, i) => `  ${i + 1}. ${e.name} (${e.ageGroup}${e.format ? ', ' + e.format : ''})`).join('\n');
  const prompt = `Write a welcoming introduction paragraph for a school athletics carnival program. Australian English. Warm, inclusive, exciting for students and families.\n\nSchool: ${school}\nDate: ${date || 'upcoming carnival'}\n${houses ? `Houses: ${houses.join(', ')}\n` : ''}Events:\n${eventList}\n\nWrite a 3-4 sentence welcome introduction for the program booklet:`;
  return corsJson({ program: (await askFalkor(prompt, env)).trim() });
}
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (path === '/health') return corsJson({ status: 'ok', version: VERSION, worker: 'falkor-ssp-ai' });
    if (request.method !== 'POST') return corsJson({ error: 'POST required' }, 405);
    let body; try { body = await request.json(); } catch { return corsJson({ error: 'Invalid JSON' }, 400); }
    try {
      if (path === '/sport-plan') return await handleSportPlan(body, env);
      if (path === '/event-description') return await handleEventDescription(body, env);
      if (path === '/house-summary') return await handleHouseSummary(body, env);
      if (path === '/qualifier-message') return await handleQualifierMessage(body, env);
      if (path === '/carnival-program') return await handleCarnivalProgram(body, env);
      return corsJson({ error: 'Not found' }, 404);
    } catch (err) { return corsJson({ error: err.message }, 500); }
  },
};
