// falkor-workflows v1.0.0 — Scheduled workflows + email + PE alerts
// Cron: 0 21 * * * (9pm UTC = 7am AEST), 30 21 * * * (7:30am AEST)
//
// Scheduled jobs:
//   1. PE Weather Alert (7:00am AEST) — check Williamstown Primary conditions
//   2. Daily Falkor Summary (7:30am AEST) — KBT events + AFL round + weather
//   3. KBT Pre-event reminder (dynamic — check upcoming events)
//
// REST endpoints:
//   POST /email               — send ad-hoc email via Resend
//   POST /workflow/trigger    — manually trigger a named workflow
//   GET  /workflow/runs       — recent workflow run log
//   GET  /health              — version + last run times
//
// Bindings: DB (asgard-prod), RESEND_API_KEY (secret), AGENT_PIN (secret)

const VERSION = '1.2.0';
const WORKER_NAME = 'falkor-workflows';
const PUSH_URL = 'https://falkor-push.luckdragon.io';
const SPORT_URL = 'https://falkor-sport.luckdragon.io';
const CALENDAR_URL = 'https://falkor-calendar.luckdragon.io';

// Williamstown Primary School coordinates
const WPS_LAT = -37.8594;
const WPS_LON = 144.8750;

const PADDY_EMAIL = 'pgallivan@outlook.com';
const FROM_EMAIL = 'Falkor Workflows <workflows@luckdragon.io>';

const AI_URL = 'https://asgard-ai.luckdragon.io';
const KBT_URL = 'https://falkor-kbt.luckdragon.io';
const BRAIN_URL = 'https://falkor-brain.luckdragon.io';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Pin',
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
}
function err(msg, status = 400) { return json({ ok: false, error: msg }, status); }

function pinOk(request, env) {
  const pin = request.headers.get('X-Pin') || '';
  if (!env.AGENT_PIN) return true;
  return pin === env.AGENT_PIN;
}

// ─── Email via Resend ─────────────────────────────────────────────────────────
async function sendEmail(env, { to, subject, html, text }) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY missing');
  const body = { from: FROM_EMAIL, to: [to || PADDY_EMAIL], subject, html: html || `<p>${text}</p>` };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  return { ok: true, id: d.id };
}

// ─── Weather fetch ────────────────────────────────────────────────────────────
async function getWeather(env, lat, lon) {
  const pin = env.AGENT_PIN || '';
  const r = await fetch(`${AI_URL}/weather?lat=${lat}&lon=${lon}`, { headers: { 'X-Pin': pin } });
  if (!r.ok) throw new Error('Weather fetch failed: ' + r.status);
  return r.json();
}

// ─── Log workflow run to D1 ───────────────────────────────────────────────────
async function logRun(env, workflow, result, error = null) {
  if (!env.DB) return;
  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS falkor_workflow_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workflow TEXT NOT NULL,
        result TEXT,
        error TEXT,
        ran_at INTEGER DEFAULT (unixepoch())
      )
    `).run();
    await env.DB.prepare(
      `INSERT INTO falkor_workflow_runs (workflow, result, error) VALUES (?, ?, ?)`
    ).bind(workflow, JSON.stringify(result).slice(0, 1000), error?.slice(0, 500) || null).run();
  } catch (e) { console.error('Log run error:', e?.message); }
}

// ─── Workflow 1: PE Weather Alert ─────────────────────────────────────────────
async function runPEWeatherAlert(env) {
  const weather = await getWeather(env, WPS_LAT, WPS_LON);
  const c = weather.current;
  const today = weather.today;

  // Build PE suitability assessment
  const issues = [];
  if (c.uv >= 9) issues.push(`☀️ UV Index ${c.uv} (extreme — sun protection mandatory)`);
  if (c.temp > 36) issues.push(`🌡️ Temperature ${c.temp}°C (too hot for vigorous activity)`);
  if (c.temp < 8) issues.push(`🥶 Temperature ${c.temp}°C (cold — move indoors or warm up extended)`);
  if (c.wind_kmh > 40) issues.push(`💨 Wind ${c.wind_kmh} km/h (too windy for outdoor games)`);
  if ((today.rain_mm || 0) > 5) issues.push(`🌧️ Rain ${today.rain_mm}mm expected (wet conditions)`);
  if (c.rain_chance > 60) issues.push(`🌦️ ${c.rain_chance}% chance of rain`);

  const suitable = issues.length === 0;

  // Always store in brain for context
  await fetch(`${BRAIN_URL}/remember`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Pin': env.AGENT_PIN || '' },
    body: JSON.stringify({
      text: `PE Weather check ${new Date().toLocaleDateString('en-AU')}: ${c.temp}°C, ${c.condition}, UV ${c.uv}, wind ${c.wind_kmh}km/h. ${suitable ? 'Suitable for outdoor PE.' : 'Issues: ' + issues.join('; ')}`,
      category: 'weather',
      tags: ['pe', 'weather', 'wps'],
    }),
  }).catch(() => {});

  // Only email if there are issues (don't spam on good days)
  if (!suitable) {
    const html = `
<h2>⚠️ PE Weather Alert — Williamstown Primary</h2>
<p><strong>Date:</strong> ${new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Australia/Melbourne' })}</p>
<h3>Current Conditions</h3>
<ul>
  <li>🌡️ Temperature: ${c.temp}°C (feels like ${c.feels_like}°C)</li>
  <li>🌤️ Conditions: ${c.condition}</li>
  <li>☀️ UV Index: ${c.uv}</li>
  <li>💨 Wind: ${c.wind_kmh} km/h</li>
  <li>🌧️ Rain chance: ${c.rain_chance}%</li>
  <li>📅 Today: ${today.min}°C – ${today.max}°C, ${today.rain_mm || 0}mm rain</li>
  <li>🌅 Sunset: ${today.sunset?.split('T')[1]?.slice(0,5) || 'n/a'}</li>
</ul>
<h3>Issues Detected</h3>
<ul>${issues.map(i => `<li>${i}</li>`).join('')}</ul>
<p><em>Sent by Falkor Workflows — falkor-workflows.luckdragon.io</em></p>
    `;
    await sendEmail(env, {
      to: PADDY_EMAIL,
      subject: `⚠️ PE Alert: ${issues[0]}`,
      html,
    });
    await sendPush(env, {
      title: '⚠️ PE Alert: ' + issues[0],
      body: 'Check conditions before outdoor PE today. ' + issues.join(', '),
      url: 'https://falkor.luckdragon.io',
      tag: 'pe-weather',
    });
        return { sent: true, issues, temp: c.temp, uv: c.uv };
  }

  return { sent: false, suitable: true, temp: c.temp, uv: c.uv, condition: c.condition };
}

// ─── Workflow 2: Daily Falkor Summary ─────────────────────────────────────────
async function runDailySummary(env) {
  const pin = env.AGENT_PIN || '';
  const date = new Date().toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Australia/Melbourne'
  });

  // Fetch all data in parallel
  const [weather, kbtSummary, sportSummary] = await Promise.allSettled([
    getWeather(env, WPS_LAT, WPS_LON),
    fetch(`${KBT_URL}/summary`, { headers: { 'X-Pin': pin } }).then(r => r.json()),
    fetch(`${SPORT_URL}/summary`, { headers: { 'X-Pin': pin } }).then(r => r.json()),
  ]);

  const w = weather.status === 'fulfilled' ? weather.value : null;
  const kbt = kbtSummary.status === 'fulfilled' ? kbtSummary.value : null;
  const sport = sportSummary.status === 'fulfilled' ? sportSummary.value : null;

  const sections = [];

  // Weather section
  if (w) {
    const c = w.current;
    sections.push(`
<h3>🌤️ Weather — Williamstown (WPS)</h3>
<p>${c.condition}, ${c.temp}°C (feels ${c.feels_like}°C) • UV ${c.uv} • Wind ${c.wind_kmh}km/h • Rain ${c.rain_chance}%</p>
<p>${w.pe_note}</p>`);
  }

  // KBT section
  if (kbt?.ok) {
    sections.push(`
<h3>🎯 KBT Trivia</h3>
<p>Upcoming events: <strong>${kbt.upcoming_events}</strong> • Question bank: <strong>${kbt.question_bank_size}</strong> questions</p>`);
  }

  // Sport section
  if (sport?.ok) {
    const tipping = sport.tipping_summary || {};
    sections.push(`
<h3>🏈 AFL & Sport</h3>
<p>${sport.round_description || 'Season in progress'}</p>
${tipping.leader ? `<p>Tipping leader: <strong>${tipping.leader}</strong> (${tipping.leader_points} pts)</p>` : ''}`);
  }

  const html = `
<h2>🐉 Good morning, Paddy! — ${date}</h2>
${sections.join('\n')}
<hr/>
<p><em>Sent by Falkor — <a href="https://falkor.luckdragon.io">falkor.luckdragon.io</a></em></p>
  `;

  await sendEmail(env, {
    to: PADDY_EMAIL,
    subject: `🐉 Falkor Daily — ${date}`,
    html,
  });

  await sendPush(env, {
    title: '🐉 Falkor Daily — ' + date,
    body: 'Your morning briefing is ready. Weather, AFL, calendar & more.',
    url: 'https://falkor.luckdragon.io',
    tag: 'daily-summary',
  });
    return { sent: true, date, sections: sections.length };
}

// ─── Cron dispatcher ─────────────────────────────────────────────────────────

// ─── Push notification helper ─────────────────────────────────────────────────
async function sendPush(env, { title, body, url = 'https://falkor.luckdragon.io', tag = 'falkor' }) {
  try {
    await fetch(PUSH_URL + '/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Pin': env.AGENT_PIN },
      body: JSON.stringify({ title, body, url, tag }),
    });
  } catch (e) {
    console.warn('sendPush failed:', e.message);
  }
}


// ─── Smart Proactive Rules Engine ────────────────────────────────────────────
// Runs every 2 hours during AEST daytime. Fires push+email only once per event.

async function runSmartAlerts(env) {
  const fired = [];
  const now = Date.now();
  const aestHour = new Date(now).getUTCHours() + 10; // rough AEST (no DST handling needed)

  // Only run during daylight hours: 6am–8pm AEST
  const h = aestHour % 24;
  if (h < 6 || h > 20) return { skipped: true, reason: 'outside hours', h };

  // ── Rule 1: Cross country / school event in next 2 days with rain forecast ──
  try {
    const calResp = await fetch(CALENDAR_URL + '/week', {
      headers: { 'X-Pin': env.AGENT_PIN }
    }).catch(() => null);

    if (calResp && calResp.ok) {
      const calData = await calResp.json();
      const events = calData.events || [];
      const today = new Date(now);
      const keywords = ['cross country', 'carnival', 'athletics', 'sports day', 'district'];

      for (const evt of events) {
        const evtDate = new Date(evt.start || evt.date);
        const daysAway = Math.round((evtDate - today) / 86400000);
        const name = (evt.summary || '').toLowerCase();
        const isSchoolEvent = keywords.some(k => name.includes(k));

        if (isSchoolEvent && daysAway >= 0 && daysAway <= 2) {
          // Check weather for that day
          const weatherResp = await fetch(
            'https://api.open-meteo.com/v1/forecast?latitude=-37.86&longitude=144.90&daily=precipitation_probability_max&timezone=Australia%2FMelbourne&forecast_days=3'
          ).catch(() => null);

          if (weatherResp && weatherResp.ok) {
            const wx = await weatherResp.json();
            const rainChance = (wx.daily?.precipitation_probability_max || [])[daysAway] || 0;

            if (rainChance >= 60) {
              const alertKey = 'school_event_rain_' + evt.summary + '_' + evtDate.toDateString();
              const alreadyFired = await checkAlertFired(env, alertKey);
              if (!alreadyFired) {
                const title = '⛈️ ' + (evt.summary || 'School event') + ' — rain likely!';
                const body = daysAway === 0
                  ? 'Today: ' + rainChance + '% chance of rain. Consider a backup plan.'
                  : 'In ' + daysAway + ' day' + (daysAway > 1 ? 's' : '') + ': ' + rainChance + '% rain chance. Plan ahead!';
                await sendPush(env, { title, body, url: 'https://falkor.luckdragon.io', tag: 'school-weather' });
                await sendEmail(env, {
                  to: PADDY_EMAIL,
                  subject: title,
                  html: '<p>' + body + '</p><p>Event: <strong>' + (evt.summary||'') + '</strong> on ' + evtDate.toDateString() + '</p>',
                });
                await markAlertFired(env, alertKey);
                fired.push({ rule: 'school_event_rain', event: evt.summary, rain: rainChance });
              }
            }
          }
        }
      }
    }
  } catch (e) { console.warn('Smart rule 1 failed:', e.message); }

  // ── Rule 2: KBT event reminder (event in calendar tomorrow) ──────────────
  try {
    const calResp = await fetch(CALENDAR_URL + '/tomorrow', {
      headers: { 'X-Pin': env.AGENT_PIN }
    }).catch(() => null);

    if (calResp && calResp.ok) {
      const calData = await calResp.json();
      const events = calData.events || [];
      const kbtKeywords = ['kbt', 'trivia', 'kow brainer', 'quiz night'];

      for (const evt of events) {
        const name = (evt.summary || '').toLowerCase();
        if (kbtKeywords.some(k => name.includes(k))) {
          const alertKey = 'kbt_reminder_' + evt.summary;
          const alreadyFired = await checkAlertFired(env, alertKey);
          if (!alreadyFired) {
            await sendPush(env, {
              title: '🎮 KBT tomorrow: ' + (evt.summary || 'Trivia night'),
              body: 'Don\'t forget to prep your trivia questions!',
              url: 'https://falkor.luckdragon.io',
              tag: 'kbt-reminder',
            });
            await markAlertFired(env, alertKey);
            fired.push({ rule: 'kbt_reminder', event: evt.summary });
          }
        }
      }
    }
  } catch (e) { console.warn('Smart rule 2 failed:', e.message); }

  return { fired, total: fired.length };
}

async function checkAlertFired(env, key) {
  if (!env.DB) return false;
  try {
    // Check smart_alert_log in falkor-push-db via API since we don't have that D1 binding
    // Instead use a simple KV-style check via D1 asgard-prod if available
    const row = await env.DB.prepare(
      'SELECT id FROM falkor_smart_alerts WHERE id = ? AND fired_at > ?'
    ).bind(key, Date.now() - 86400000 * 2).first(); // fired in last 2 days
    return !!row;
  } catch {
    // Table might not exist yet — create it
    try {
      await env.DB.prepare(
        'CREATE TABLE IF NOT EXISTS falkor_smart_alerts (id TEXT PRIMARY KEY, fired_at INTEGER)'
      ).run();
    } catch {}
    return false;
  }
}

async function markAlertFired(env, key) {
  if (!env.DB) return;
  try {
    await env.DB.prepare(
      'INSERT OR REPLACE INTO falkor_smart_alerts (id, fired_at) VALUES (?, ?)'
    ).bind(key, Date.now()).run();
  } catch {}
}

async function runScheduled(cron, env) {
  const hour = new Date().getUTCHours(); // 21 = 7am AEST (UTC+10)
  const minute = new Date().getUTCMinutes();

  // Run smart proactive rules every 2 hours
  await runSmartAlerts(env).catch(e => console.warn('smart alerts failed:', e.message));

  // 9pm UTC (7am AEST) → PE Weather Alert
  if (hour === 21 && minute < 15) {
    const result = await runPEWeatherAlert(env);
    await logRun(env, 'pe_weather_alert', result);
    return result;
  }

  // 9:30pm UTC (7:30am AEST) → Daily Summary
  if (hour === 21 && minute >= 30) {
    const result = await runDailySummary(env);
    await logRun(env, 'daily_summary', result);
    return result;
  }

  return { skipped: true, hour, minute };
}

// ─── Main Worker ──────────────────────────────────────────────────────────────
export default {
  // Scheduled trigger (CF Cron)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduled(event.cron, env).catch(e => {
      console.error('Scheduled error:', e?.message);
      logRun(env, 'cron', null, e?.message);
    }));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    if (path === '/health') {
      let dbOk = false;
      try { if (env.DB) { await env.DB.prepare('SELECT 1').run(); dbOk = true; } } catch {}
      return json({ ok: true, worker: WORKER_NAME, version: VERSION, db: dbOk, resend: !!env.RESEND_API_KEY });
    }

    if (!pinOk(request, env)) return err('Unauthorized', 401);

    // Manual workflow trigger
    if (path === '/workflow/trigger' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const { workflow } = body;
      let result;
      try {
        switch (workflow) {
          case 'pe_weather_alert':  result = await runPEWeatherAlert(env); break;
          case 'daily_summary':     result = await runDailySummary(env); break;
          default: return err(`Unknown workflow: ${workflow}. Options: pe_weather_alert, daily_summary`);
        }
        await logRun(env, workflow, result);
        return json({ ok: true, workflow, result });
      } catch (e) {
        await logRun(env, workflow, null, e?.message);
        return err('Workflow failed: ' + e?.message, 500);
      }
    }

    if (path === '/smart-alerts/trigger' && method === 'POST') {
      const pin = request.headers.get('X-Pin');
      if (pin !== env.AGENT_PIN) return err('Unauthorized', 401);
      const result = await runSmartAlerts(env).catch(e => ({ error: e.message }));
      return json({ ok: true, result });
    }

    // Send ad-hoc email
    if (path === '/email' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const { to, subject, text, html } = body;
      if (!subject) return err('subject required');
      if (!text && !html) return err('text or html required');
      try {
        const result = await sendEmail(env, { to, subject, text, html });
        return json({ ok: true, ...result });
      } catch (e) {
        return err('Email failed: ' + e?.message, 500);
      }
    }

    // Workflow run log
    if (path === '/workflow/runs' && method === 'GET') {
      if (!env.DB) return err('DB not bound', 500);
      try {
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS falkor_workflow_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, workflow TEXT, result TEXT, error TEXT, ran_at INTEGER DEFAULT (unixepoch()))`).run();
        const rows = await env.DB.prepare(
          `SELECT workflow, result, error, ran_at FROM falkor_workflow_runs ORDER BY ran_at DESC LIMIT 20`
        ).all();
        return json({ ok: true, runs: rows.results });
      } catch (e) { return err(e?.message, 500); }
    }

    return json({ error: 'Not found', path }, 404);
  },
};
