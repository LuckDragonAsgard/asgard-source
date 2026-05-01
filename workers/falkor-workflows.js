// falkor-workflows v2.0.0 — Scheduled workflows + Jarvis-level autonomy
// Cron: 0 21 * * * (7am AEST), 30 21 * * * (7:30am AEST), 0 */2 * * * (every 2h)
//
// Scheduled jobs:
//   1. PE Weather Alert (7:00am AEST) — Williamstown Primary conditions
//   2. Daily Falkor Briefing (7:30am AEST) — top priorities + weather + AFL + tipping
//   3. Smart Proactive Rules (every 2h daytime) — game day, race day, KBT, momentum
//
// REST endpoints:
//   POST /email                  — send ad-hoc email via Resend
//   POST /workflow/trigger       — manually trigger a named workflow
//   GET  /workflow/runs          — recent run log
//   POST /smart-alerts/trigger   — run smart alerts now
//   GET  /health                 — version + bindings status
//
// Bindings: DB (asgard-prod), PROJECTS_DB (project-hub-db), RESEND_API_KEY, AGENT_PIN

const VERSION = '2.0.0';
const WORKER_NAME = 'falkor-workflows';
const PUSH_URL = 'https://falkor-push.luckdragon.io';
const SPORT_URL = 'https://falkor-sport.luckdragon.io';
const CALENDAR_URL = 'https://falkor-calendar.luckdragon.io';

const WPS_LAT = -37.8594;
const WPS_LON = 144.8750;
const PADDY_EMAIL = 'pgallivan@outlook.com';
const FROM_EMAIL = 'Falkor <workflows@luckdragon.io>';
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
  const body = { from: FROM_EMAIL, to: [to || PADDY_EMAIL], subject, html: html || '<p>' + (text||'') + '</p>' };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.RESEND_API_KEY },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('Resend ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const d = await r.json();
  return { ok: true, id: d.id };
}

// ─── Push notification ────────────────────────────────────────────────────────
async function sendPush(env, { title, body, url = 'https://falkor.luckdragon.io', tag = 'falkor' }) {
  try {
    await fetch(PUSH_URL + '/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Pin': env.AGENT_PIN },
      body: JSON.stringify({ title, body, url, tag }),
    });
  } catch (e) { console.warn('sendPush failed:', e.message); }
}

// ─── Weather fetch ────────────────────────────────────────────────────────────
async function getWeather(env, lat, lon) {
  const pin = env.AGENT_PIN || '';
  const r = await fetch(AI_URL + '/weather?lat=' + lat + '&lon=' + lon, { headers: { 'X-Pin': pin } });
  if (!r.ok) throw new Error('Weather fetch failed: ' + r.status);
  return r.json();
}

// ─── Venture priorities from project-hub-db ───────────────────────────────────
async function getTopVentures(env, limit = 5) {
  if (!env.PROJECTS_DB) return [];
  try {
    const rows = await env.PROJECTS_DB.prepare(
      'SELECT name, status, next, y1, income_priority, last_updated FROM project_hub WHERE income_priority <= 3 AND status NOT IN (\'archived\', \'paused\') ORDER BY income_priority ASC, y1 DESC LIMIT ?'
    ).bind(limit).all();
    return rows.results || [];
  } catch (e) { console.warn('getTopVentures:', e.message); return []; }
}

// ─── Log workflow run to D1 ───────────────────────────────────────────────────
async function logRun(env, workflow, result, error = null) {
  if (!env.DB) return;
  try {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS falkor_workflow_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, workflow TEXT NOT NULL, result TEXT, error TEXT, ran_at INTEGER DEFAULT (unixepoch()))').run();
    await env.DB.prepare('INSERT INTO falkor_workflow_runs (workflow, result, error) VALUES (?, ?, ?)').bind(workflow, JSON.stringify(result).slice(0, 1000), error?.slice(0, 500) || null).run();
  } catch (e) { console.error('Log run error:', e?.message); }
}

// ─── Dedup alert tracking ─────────────────────────────────────────────────────
async function checkAlertFired(env, key, windowMs = 86400000 * 2) {
  if (!env.DB) return false;
  try {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS falkor_smart_alerts (id TEXT PRIMARY KEY, fired_at INTEGER)').run();
    const row = await env.DB.prepare('SELECT id FROM falkor_smart_alerts WHERE id = ? AND fired_at > ?').bind(key, Date.now() - windowMs).first();
    return !!row;
  } catch { return false; }
}
async function markAlertFired(env, key) {
  if (!env.DB) return;
  try {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS falkor_smart_alerts (id TEXT PRIMARY KEY, fired_at INTEGER)').run();
    await env.DB.prepare('INSERT OR REPLACE INTO falkor_smart_alerts (id, fired_at) VALUES (?, ?)').bind(key, Date.now()).run();
  } catch {}
}

// ─── Workflow 1: PE Weather Alert ─────────────────────────────────────────────
async function runPEWeatherAlert(env) {
  const weather = await getWeather(env, WPS_LAT, WPS_LON);
  const c = weather.current;
  const today = weather.today;

  const issues = [];
  if (c.uv >= 9) issues.push('☀️ UV Index ' + c.uv + ' (extreme — sun protection mandatory)');
  if (c.temp > 36) issues.push('🌡️ Temperature ' + c.temp + '°C (too hot for vigorous activity)');
  if (c.temp < 8) issues.push('🥶 Temperature ' + c.temp + '°C (cold — move indoors or warm up extended)');
  if (c.wind_kmh > 40) issues.push('💨 Wind ' + c.wind_kmh + ' km/h (too windy for outdoor games)');
  if ((today.rain_mm || 0) > 5) issues.push('🌧️ Rain ' + today.rain_mm + 'mm expected (wet conditions)');
  if (c.rain_chance > 60) issues.push('🌦️ ' + c.rain_chance + '% chance of rain');

  const suitable = issues.length === 0;

  await fetch(BRAIN_URL + '/remember', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Pin': env.AGENT_PIN || '' },
    body: JSON.stringify({
      text: 'PE Weather check ' + new Date().toLocaleDateString('en-AU') + ': ' + c.temp + '°C, ' + c.condition + ', UV ' + c.uv + ', wind ' + c.wind_kmh + 'km/h. ' + (suitable ? 'Suitable for outdoor PE.' : 'Issues: ' + issues.join('; ')),
      category: 'weather', tags: ['pe', 'weather', 'wps'],
    }),
  }).catch(() => {});

  if (!suitable) {
    const html = '<h2>⚠️ PE Weather Alert — Williamstown Primary</h2>' +
      '<p><strong>Date:</strong> ' + new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Australia/Melbourne' }) + '</p>' +
      '<h3>Current Conditions</h3><ul>' +
      '<li>🌡️ Temperature: ' + c.temp + '°C (feels like ' + c.feels_like + '°C)</li>' +
      '<li>🌤️ Conditions: ' + c.condition + '</li>' +
      '<li>☀️ UV Index: ' + c.uv + '</li>' +
      '<li>💨 Wind: ' + c.wind_kmh + ' km/h</li>' +
      '<li>🌧️ Rain chance: ' + c.rain_chance + '%</li>' +
      '</ul><h3>Issues Detected</h3><ul>' +
      issues.map(function(i) { return '<li>' + i + '</li>'; }).join('') +
      '</ul><p><em>Falkor Workflows — falkor-workflows.luckdragon.io</em></p>';

    await sendEmail(env, { to: PADDY_EMAIL, subject: '⚠️ PE Alert: ' + issues[0], html });
    await sendPush(env, { title: '⚠️ PE Alert: ' + issues[0], body: 'Check conditions before outdoor PE. ' + issues.join(', '), tag: 'pe-weather' });
    return { sent: true, issues, temp: c.temp, uv: c.uv };
  }
  return { sent: false, suitable: true, temp: c.temp, uv: c.uv, condition: c.condition };
}

// ─── Workflow 2: Daily Falkor Briefing v2 ─────────────────────────────────────
async function runDailySummary(env) {
  const pin = env.AGENT_PIN || '';
  const date = new Date().toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Australia/Melbourne'
  });

  const [weather, kbtSummary, sportSummary, ventures] = await Promise.allSettled([
    getWeather(env, WPS_LAT, WPS_LON),
    fetch(KBT_URL + '/summary', { headers: { 'X-Pin': pin } }).then(function(r) { return r.json(); }),
    fetch(SPORT_URL + '/summary', { headers: { 'X-Pin': pin } }).then(function(r) { return r.json(); }),
    getTopVentures(env, 5),
  ]);

  const w = weather.status === 'fulfilled' ? weather.value : null;
  const kbt = kbtSummary.status === 'fulfilled' ? kbtSummary.value : null;
  const sport = sportSummary.status === 'fulfilled' ? sportSummary.value : null;
  const topVentures = ventures.status === 'fulfilled' ? ventures.value : [];

  const sections = [];

  // ── Weather ──
  if (w) {
    const c = w.current;
    const peNote = w.pe_note || (c.uv >= 9 ? 'High UV today — hats mandatory.' : c.temp > 30 ? 'Hot one today — consider indoor PE.' : 'All clear for outdoor PE.');
    sections.push(
      '<h3>🌤️ Weather — Williamstown</h3>' +
      '<p>' + c.condition + ', <strong>' + c.temp + '°C</strong> (feels ' + c.feels_like + '°C) · UV <strong>' + c.uv + '</strong> · Wind ' + c.wind_kmh + 'km/h · Rain ' + c.rain_chance + '%</p>' +
      '<p><em>' + peNote + '</em></p>'
    );
  }

  // ── Top Venture Priorities ──
  if (topVentures.length > 0) {
    var rows = topVentures.map(function(v) {
      var age = v.last_updated ? Math.round((Date.now() - new Date(v.last_updated).getTime()) / 86400000) : null;
      var staleness = age !== null && age > 14 ? ' <span style=\"color:#e67e22\">(no activity ' + age + ' days)</span>' : '';
      return '<tr><td><strong>' + v.name + '</strong>' + staleness + '</td><td>' + (v.status || '') + '</td><td>$' + ((v.y1 || 0) / 1000).toFixed(0) + 'k</td><td>' + (v.next || '—') + '</td></tr>';
    }).join('');
    sections.push(
      '<h3>🎯 Top Priorities</h3>' +
      '<table style=\"border-collapse:collapse;width:100%\">' +
      '<tr style=\"background:#f0f0f0\"><th style=\"text-align:left;padding:4px 8px\">Venture</th><th>Status</th><th>Y1</th><th>Next action</th></tr>' +
      rows + '</table>'
    );
  }

  // ── AFL & Tipping ──
  if (sport && sport.ok) {
    const tipping = sport.tipping_summary || {};
    sections.push(
      '<h3>🏈 AFL & Tipping</h3>' +
      '<p>' + (sport.round_description || 'Season in progress') + '</p>' +
      (tipping.leader ? '<p>Leaderboard: <strong>' + tipping.leader + '</strong> leads with ' + tipping.leader_points + ' pts</p>' : '')
    );
  }

  // ── KBT ──
  if (kbt && kbt.ok) {
    sections.push(
      '<h3>🎮 KBT Trivia</h3>' +
      '<p>Upcoming events: <strong>' + kbt.upcoming_events + '</strong> · Bank: <strong>' + kbt.question_bank_size + '</strong> questions</p>'
    );
  }

  const html = '<h2>🐉 Good morning, Paddy! — ' + date + '</h2>' +
    sections.join('\n') +
    '<hr/><p><em>Falkor · <a href=\"https://falkor.luckdragon.io\">falkor.luckdragon.io</a></em></p>';

  await sendEmail(env, { to: PADDY_EMAIL, subject: '🐉 Falkor Daily — ' + date, html });
  await sendPush(env, { title: '🐉 Falkor — ' + date, body: 'Morning briefing: weather, priorities, AFL & KBT ready.', tag: 'daily-summary' });
  return { sent: true, date, sections: sections.length, ventures: topVentures.length };
}

// ─── Smart Proactive Rules Engine v2 ─────────────────────────────────────────
async function runSmartAlerts(env) {
  const fired = [];
  const now = Date.now();
  const utcHour = new Date(now).getUTCHours();
  const aestHour = (utcHour + 10) % 24;
  const dayOfWeek = new Date(now).getUTCDay(); // 0=Sun, 6=Sat

  if (aestHour < 6 || aestHour > 21) return { skipped: true, reason: 'outside hours', h: aestHour };

  // ── Rule 1: School sport event + rain forecast ───────────────────────────
  try {
    const calResp = await fetch(CALENDAR_URL + '/week', { headers: { 'X-Pin': env.AGENT_PIN } }).catch(() => null);
    if (calResp && calResp.ok) {
      const calData = await calResp.json();
      const events = calData.events || [];
      const today = new Date(now);
      const keywords = ['cross country', 'carnival', 'athletics', 'sports day', 'district'];

      for (var i = 0; i < events.length; i++) {
        var evt = events[i];
        var evtDate = new Date(evt.start || evt.date);
        var daysAway = Math.round((evtDate - today) / 86400000);
        var name = (evt.summary || '').toLowerCase();
        var isSchoolEvent = keywords.some(function(k) { return name.includes(k); });

        if (isSchoolEvent && daysAway >= 0 && daysAway <= 2) {
          var weatherResp = await fetch(
            'https://api.open-meteo.com/v1/forecast?latitude=-37.86&longitude=144.90&daily=precipitation_probability_max&timezone=Australia%2FMelbourne&forecast_days=3'
          ).catch(() => null);
          if (weatherResp && weatherResp.ok) {
            var wx = await weatherResp.json();
            var rainChance = ((wx.daily && wx.daily.precipitation_probability_max) || [])[daysAway] || 0;
            if (rainChance >= 60) {
              var alertKey = 'school_event_rain_' + evt.summary + '_' + evtDate.toDateString();
              if (!(await checkAlertFired(env, alertKey))) {
                var title = '⛈️ ' + (evt.summary || 'School event') + ' — rain likely!';
                var body = daysAway === 0
                  ? 'Today: ' + rainChance + '% rain. Consider a backup plan.'
                  : 'In ' + daysAway + 'd: ' + rainChance + '% rain chance. Plan ahead!';
                await sendPush(env, { title, body, tag: 'school-weather' });
                await sendEmail(env, { to: PADDY_EMAIL, subject: title, html: '<p>' + body + '</p><p>Event: <strong>' + (evt.summary||'') + '</strong></p>' });
                await markAlertFired(env, alertKey);
                fired.push({ rule: 'school_event_rain', event: evt.summary, rain: rainChance });
              }
            }
          }
        }
      }
    }
  } catch (e) { console.warn('Rule 1 failed:', e.message); }

  // ── Rule 2: KBT event tomorrow ───────────────────────────────────────────
  try {
    const calResp = await fetch(CALENDAR_URL + '/tomorrow', { headers: { 'X-Pin': env.AGENT_PIN } }).catch(() => null);
    if (calResp && calResp.ok) {
      const calData = await calResp.json();
      const events = calData.events || [];
      const kbtKeywords = ['kbt', 'trivia', 'kow brainer', 'quiz night'];
      for (var i = 0; i < events.length; i++) {
        var evt = events[i];
        var nm = (evt.summary || '').toLowerCase();
        if (kbtKeywords.some(function(k) { return nm.includes(k); })) {
          var alertKey = 'kbt_reminder_' + evt.summary;
          if (!(await checkAlertFired(env, alertKey))) {
            await sendPush(env, { title: '🎮 KBT tomorrow: ' + (evt.summary || 'Trivia night'), body: 'Prep your questions!', tag: 'kbt-reminder' });
            await markAlertFired(env, alertKey);
            fired.push({ rule: 'kbt_reminder', event: evt.summary });
          }
        }
      }
    }
  } catch (e) { console.warn('Rule 2 failed:', e.message); }

  // ── Rule 3: AFL game-day mode (Melbourne Demons) ─────────────────────────
  try {
    const sportResp = await fetch(SPORT_URL + '/today', { headers: { 'X-Pin': env.AGENT_PIN } }).catch(() => null);
    if (sportResp && sportResp.ok) {
      const sportData = await sportResp.json();
      const games = sportData.games || [];
      for (var i = 0; i < games.length; i++) {
        var g = games[i];
        var teams = ((g.hteam || '') + ' ' + (g.ateam || '')).toLowerCase();
        if (teams.includes('melbourne') || teams.includes('demons')) {
          var alertKey = 'afl_gameday_' + g.id;
          if (!(await checkAlertFired(env, alertKey, 86400000))) {
            var kickoff = g.localtime ? new Date(g.localtime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: 'Australia/Melbourne' }) : 'today';
            var opponent = teams.includes('melbourne') ? (g.hteam === 'Melbourne' ? g.ateam : g.hteam) : '?';
            await sendPush(env, {
              title: '🏈 Dees on today vs ' + opponent,
              body: 'Kick-off ' + kickoff + ' — go Demons!',
              url: 'https://falkor.luckdragon.io',
              tag: 'afl-gameday',
            });
            await markAlertFired(env, alertKey);
            fired.push({ rule: 'afl_gameday', game: g.hteam + ' v ' + g.ateam });
          }
        }
      }
    }
  } catch (e) { console.warn('Rule 3 failed:', e.message); }

  // ── Rule 4: Saturday tipping reminder (8am–10am AEST) ────────────────────
  if (dayOfWeek === 6 && aestHour >= 8 && aestHour <= 10) {
    try {
      const alertKey = 'tipping_reminder_' + new Date(now).toDateString();
      if (!(await checkAlertFired(env, alertKey, 86400000))) {
        const sportResp = await fetch(SPORT_URL + '/tipping', { headers: { 'X-Pin': env.AGENT_PIN } }).catch(() => null);
        var tippingOpen = true;
        if (sportResp && sportResp.ok) {
          const td = await sportResp.json();
          tippingOpen = td.round_open !== false;
        }
        if (tippingOpen) {
          await sendPush(env, {
            title: '🏈 Have you tipped yet?',
            body: 'AFL tips are open — get in before lockout!',
            url: 'https://falkor.luckdragon.io',
            tag: 'tipping-reminder',
          });
          await markAlertFired(env, alertKey);
          fired.push({ rule: 'tipping_reminder' });
        }
      }
    } catch (e) { console.warn('Rule 4 failed:', e.message); }
  }

  // ── Rule 5: Racing day alert (Melbourne Cup Carnival + feature races) ─────
  try {
    const sportResp = await fetch(SPORT_URL + '/racing/today', { headers: { 'X-Pin': env.AGENT_PIN } }).catch(() => null);
    if (sportResp && sportResp.ok) {
      const raceData = await sportResp.json();
      const featureRaces = (raceData.feature_races || []).filter(function(r) { return r.is_feature; });
      for (var i = 0; i < featureRaces.length; i++) {
        var race = featureRaces[i];
        var alertKey = 'race_day_' + (race.name || 'feature') + '_' + new Date(now).toDateString();
        if (!(await checkAlertFired(env, alertKey, 86400000))) {
          await sendPush(env, {
            title: '🏇 ' + (race.name || 'Feature race') + ' today!',
            body: (race.venue || 'Track') + ' · ' + (race.time || '') + (race.favourite ? ' · Fav: ' + race.favourite : ''),
            url: 'https://falkor.luckdragon.io',
            tag: 'race-day',
          });
          await markAlertFired(env, alertKey);
          fired.push({ rule: 'race_day', race: race.name });
        }
      }
    }
  } catch (e) { console.warn('Rule 5 failed:', e.message); }

  // ── Rule 6: Venture momentum nudge (high-priority, inactive 14+ days) ────
  if (aestHour >= 9 && aestHour <= 10) {
    try {
      var ventures = await getTopVentures(env, 10);
      var staleVentures = ventures.filter(function(v) {
        if (!v.last_updated) return false;
        var daysSince = (Date.now() - new Date(v.last_updated).getTime()) / 86400000;
        return daysSince >= 14;
      });
      if (staleVentures.length > 0) {
        var top = staleVentures[0];
        var daysSince = Math.round((Date.now() - new Date(top.last_updated).getTime()) / 86400000);
        var alertKey = 'venture_nudge_' + top.name + '_' + new Date(now).toDateString();
        if (!(await checkAlertFired(env, alertKey, 86400000 * 7))) {
          await sendPush(env, {
            title: '💡 ' + top.name + ' needs attention',
            body: daysSince + ' days since last update. Next: ' + (top.next || 'check dashboard'),
            url: 'https://falkor-dashboard.luckdragon.io',
            tag: 'venture-nudge',
          });
          await markAlertFired(env, alertKey);
          fired.push({ rule: 'venture_nudge', venture: top.name, days: daysSince });
        }
      }
    } catch (e) { console.warn('Rule 6 failed:', e.message); }
  }

  return { fired, total: fired.length };
}

// ─── Cron dispatcher ──────────────────────────────────────────────────────────
async function runScheduled(cron, env) {
  const hour = new Date().getUTCHours();
  const minute = new Date().getUTCMinutes();

  // Smart rules run every cron tick
  await runSmartAlerts(env).catch(function(e) { console.warn('smart alerts:', e.message); });

  // 9pm UTC = 7am AEST → PE Weather Alert
  if (hour === 21 && minute < 15) {
    const result = await runPEWeatherAlert(env);
    await logRun(env, 'pe_weather_alert', result);
    return result;
  }

  // 9:30pm UTC = 7:30am AEST → Daily Briefing
  if (hour === 21 && minute >= 30) {
    const result = await runDailySummary(env);
    await logRun(env, 'daily_summary', result);
    return result;
  }

  return { skipped: true, hour, minute };
}

// ─── Main Worker ──────────────────────────────────────────────────────────────
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduled(event.cron, env).catch(function(e) {
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
      let dbOk = false, projectsDbOk = false;
      try { if (env.DB) { await env.DB.prepare('SELECT 1').run(); dbOk = true; } } catch {}
      try { if (env.PROJECTS_DB) { await env.PROJECTS_DB.prepare('SELECT 1').run(); projectsDbOk = true; } } catch {}
      return json({ ok: true, worker: WORKER_NAME, version: VERSION, db: dbOk, projects_db: projectsDbOk, resend: !!env.RESEND_API_KEY });
    }

    if (!pinOk(request, env)) return err('Unauthorized', 401);

    if (path === '/workflow/trigger' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const { workflow } = body;
      let result;
      try {
        switch (workflow) {
          case 'pe_weather_alert': result = await runPEWeatherAlert(env); break;
          case 'daily_summary':    result = await runDailySummary(env); break;
          case 'smart_alerts':     result = await runSmartAlerts(env); break;
          default: return err('Unknown workflow: ' + workflow + '. Options: pe_weather_alert, daily_summary, smart_alerts');
        }
        await logRun(env, workflow, result);
        return json({ ok: true, workflow, result });
      } catch (e) {
        await logRun(env, workflow, null, e?.message);
        return err('Workflow failed: ' + e?.message, 500);
      }
    }

    if (path === '/smart-alerts/trigger' && method === 'POST') {
      const result = await runSmartAlerts(env).catch(function(e) { return { error: e.message }; });
      return json({ ok: true, result });
    }

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

    if (path === '/workflow/runs' && method === 'GET') {
      if (!env.DB) return err('DB not bound', 500);
      try {
        await env.DB.prepare('CREATE TABLE IF NOT EXISTS falkor_workflow_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, workflow TEXT, result TEXT, error TEXT, ran_at INTEGER DEFAULT (unixepoch()))').run();
        const rows = await env.DB.prepare('SELECT workflow, result, error, ran_at FROM falkor_workflow_runs ORDER BY ran_at DESC LIMIT 20').all();
        return json({ ok: true, runs: rows.results });
      } catch (e) { return err(e?.message, 500); }
    }

    return json({ error: 'Not found', path }, 404);
  },
};
