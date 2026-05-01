// falkor-dashboard v1.0.0 — Ventures status dashboard
// Serves a PIN-protected live dashboard for all Falkor ventures
// Deploy to: falkor-dashboard.luckdragon.io

const VERSION = '1.0.0';
const PIN = '535554';
const FALKOR_CODE_URL = 'https://falkor-code.luckdragon.io';

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>🐉 Falkor Dashboard</title>
<style>
  :root {
    --bg: #0f172a;
    --surface: #1e293b;
    --surface2: #273549;
    --border: rgba(255,255,255,.08);
    --text: #e2e8f0;
    --muted: #94a3b8;
    --green: #22c55e;
    --red: #ef4444;
    --yellow: #f59e0b;
    --indigo: #6366f1;
    --accent: #6366f1;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; min-height: 100vh; }

  /* PIN screen */
  #pin-screen { display: flex; align-items: center; justify-content: center; min-height: 100vh; flex-direction: column; gap: 16px; }
  #pin-screen h1 { font-size: 2rem; }
  #pin-input { background: var(--surface); border: 1px solid var(--border); color: var(--text); border-radius: 12px; padding: 12px 16px; font-size: 1.1rem; width: 200px; text-align: center; letter-spacing: .2em; outline: none; }
  #pin-input:focus { border-color: var(--accent); }
  #pin-error { color: var(--red); font-size: .9rem; display: none; }

  /* Main dashboard */
  #dashboard { display: none; }
  .top-bar { background: var(--surface); border-bottom: 1px solid var(--border); padding: 14px 20px; display: flex; align-items: center; gap: 12px; position: sticky; top: 0; z-index: 10; }
  .top-bar h1 { font-size: 1.1rem; font-weight: 700; flex: 1; }
  .top-bar .meta { font-size: .78rem; color: var(--muted); }
  .refresh-btn { background: var(--surface2); border: 1px solid var(--border); color: var(--text); padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: .85rem; }
  .refresh-btn:hover { background: var(--accent); border-color: var(--accent); }

  .main { padding: 20px; max-width: 1100px; margin: 0 auto; }

  /* Status strip */
  .status-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; }
  .stat-card .label { font-size: .72rem; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 4px; }
  .stat-card .value { font-size: 1.5rem; font-weight: 800; }
  .stat-card .sub { font-size: .78rem; color: var(--muted); margin-top: 2px; }
  .green { color: var(--green); }
  .red { color: var(--red); }
  .yellow { color: var(--yellow); }

  /* Ventures grid */
  .ventures-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .venture-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; }
  .venture-header { padding: 14px 16px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--border); }
  .venture-header .name { font-weight: 700; flex: 1; font-size: .95rem; }
  .venture-header a { color: var(--muted); text-decoration: none; font-size: .75rem; }
  .venture-header a:hover { color: var(--text); }
  .status-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .dot-green { background: var(--green); box-shadow: 0 0 6px var(--green); }
  .dot-red { background: var(--red); box-shadow: 0 0 6px var(--red); }
  .dot-yellow { background: var(--yellow); }
  .dot-grey { background: #475569; }
  .worker-list { padding: 10px 16px; }
  .worker-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px solid var(--border); font-size: .83rem; }
  .worker-row:last-child { border-bottom: none; }
  .worker-name { flex: 1; color: var(--muted); }
  .worker-name.healthy { color: var(--text); }
  .worker-badge { font-size: .7rem; padding: 2px 6px; border-radius: 4px; }
  .badge-auto { background: rgba(99,102,241,.2); color: #a5b4fc; }
  .badge-manual { background: rgba(148,163,184,.1); color: #64748b; }
  .worker-days { font-size: .72rem; color: var(--muted); }

  /* Activity log */
  .section-title { font-size: .8rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); margin-bottom: 10px; }
  .activity-log { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; }
  .activity-row { display: flex; align-items: flex-start; gap: 12px; padding: 10px 16px; border-bottom: 1px solid var(--border); font-size: .83rem; }
  .activity-row:last-child { border-bottom: none; }
  .act-icon { font-size: 1rem; flex-shrink: 0; margin-top: 1px; }
  .act-body { flex: 1; }
  .act-action { font-weight: 600; }
  .act-worker { color: var(--indigo); }
  .act-status { padding: 1px 7px; border-radius: 4px; font-size: .72rem; font-weight: 700; }
  .status-ok { background: rgba(34,197,94,.15); color: var(--green); }
  .status-fail { background: rgba(239,68,68,.15); color: var(--red); }
  .act-time { font-size: .72rem; color: var(--muted); white-space: nowrap; }

  .loading { color: var(--muted); padding: 40px; text-align: center; font-size: .9rem; }
  .error-msg { color: var(--red); padding: 16px; font-size: .85rem; }

  /* Quick links */
  .quick-links { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 24px; }
  .quick-link { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 8px 14px; text-decoration: none; color: var(--text); font-size: .83rem; display: flex; align-items: center; gap: 6px; }
  .quick-link:hover { border-color: var(--accent); background: rgba(99,102,241,.1); }

  @media (max-width: 600px) {
    .main { padding: 12px; }
    .status-strip { grid-template-columns: 1fr 1fr; }
  }
</style>
</head>
<body>

<!-- PIN Screen -->
<div id="pin-screen">
  <div style="font-size:2.5rem">🐉</div>
  <h1>Falkor Dashboard</h1>
  <input id="pin-input" type="password" placeholder="Enter PIN" maxlength="10" autocomplete="off" />
  <div id="pin-error">Incorrect PIN</div>
</div>

<!-- Dashboard -->
<div id="dashboard">
  <div class="top-bar">
    <span style="font-size:1.3rem">🐉</span>
    <h1>Falkor Dashboard</h1>
    <span class="meta" id="last-refresh">Loading…</span>
    <button class="refresh-btn" onclick="loadAll()">⟳ Refresh</button>
  </div>
  <div class="main">
    <!-- Quick links -->
    <div class="quick-links">
      <a class="quick-link" href="https://falkor.luckdragon.io" target="_blank">💬 Falkor Chat</a>
      <a class="quick-link" href="https://carnivaltiming.com" target="_blank">⏱ Carnival Timing</a>
      <a class="quick-link" href="https://schoolsportportal.com.au" target="_blank">🏫 School Sport Portal</a>
      <a class="quick-link" href="https://sportcarnival.com.au" target="_blank">🏅 SportCarnival</a>
      <a class="quick-link" href="https://falkor-code.luckdragon.io/workers?pin=535554" target="_blank">🔧 Fleet API</a>
    </div>

    <!-- Stats strip -->
    <div class="status-strip" id="stats-strip">
      <div class="stat-card"><div class="label">Fleet</div><div class="value loading-val">—</div><div class="sub">workers monitored</div></div>
      <div class="stat-card"><div class="label">Healthy</div><div class="value loading-val green">—</div><div class="sub">all systems</div></div>
      <div class="stat-card"><div class="label">Auto-heal</div><div class="value loading-val">—</div><div class="sub">workers covered</div></div>
      <div class="stat-card"><div class="label">Ventures</div><div class="value loading-val">4</div><div class="sub">products running</div></div>
    </div>

    <!-- Ventures -->
    <div class="section-title">Ventures</div>
    <div class="ventures-grid" id="ventures-grid">
      <div class="loading">Loading fleet status…</div>
    </div>

    <!-- Activity log -->
    <div class="section-title">Recent Activity</div>
    <div class="activity-log" id="activity-log">
      <div class="loading">Loading activity…</div>
    </div>
  </div>
</div>

<script>
const CORRECT_PIN = '${PIN}';
const API = 'https://falkor-code.luckdragon.io';

// ── PIN Auth ──────────────────────────────────────────────────────────────────
function checkPin() {
  const val = document.getElementById('pin-input').value;
  if (val === CORRECT_PIN) {
    localStorage.setItem('falkor_dashboard_pin', val);
    document.getElementById('pin-screen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    loadAll();
  } else {
    document.getElementById('pin-error').style.display = 'block';
    document.getElementById('pin-input').value = '';
  }
}
document.getElementById('pin-input').addEventListener('keydown', e => { if (e.key === 'Enter') checkPin(); });

// Check stored PIN
const stored = localStorage.getItem('falkor_dashboard_pin');
if (stored === CORRECT_PIN) {
  document.getElementById('pin-screen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  loadAll();
}

// ── Load all data ─────────────────────────────────────────────────────────────
async function loadAll() {
  const [ventures, runs] = await Promise.all([
    fetch(API + '/ventures?pin=' + CORRECT_PIN).then(r => r.json()).catch(() => null),
    fetch(API + '/runs?pin=' + CORRECT_PIN).then(r => r.json()).catch(() => null),
  ]);
  if (ventures) renderVentures(ventures.ventures);
  if (runs) renderActivity(runs.runs);
  document.getElementById('last-refresh').textContent = 'Updated ' + new Date().toLocaleTimeString('en-AU');
}

// ── Ventures ──────────────────────────────────────────────────────────────────
function renderVentures(ventures) {
  if (!ventures) { document.getElementById('ventures-grid').innerHTML = '<div class="error-msg">Could not load fleet status</div>'; return; }

  let totalWorkers = 0, totalHealthy = 0, totalAuto = 0;

  const cards = Object.values(ventures).map(v => {
    const allOk = v.status.startsWith('✅');
    totalWorkers += v.total;
    totalHealthy += v.healthy;
    totalAuto += v.workers.filter(w => w.autoHeal).length;

    const workerRows = v.workers.map(w => \`
      <div class="worker-row">
        <div class="status-dot \${w.healthy === false ? 'dot-red' : w.healthy === null ? 'dot-grey' : 'dot-green'}"></div>
        <div class="worker-name \${w.healthy !== false ? 'healthy' : ''}">\${w.name}</div>
        <span class="worker-badge \${w.autoHeal ? 'badge-auto' : 'badge-manual'}">\${w.autoHeal ? 'auto' : 'manual'}</span>
        <span class="worker-days">\${w.days_since != null ? w.days_since + 'd' : '—'}</span>
      </div>
    \`).join('');

    return \`
      <div class="venture-card">
        <div class="venture-header">
          <div class="status-dot \${allOk ? 'dot-green' : 'dot-red'}"></div>
          <div class="name">\${v.name}</div>
          \${v.url ? \`<a href="\${v.url}" target="_blank">↗ open</a>\` : ''}
        </div>
        <div class="worker-list">\${workerRows}</div>
      </div>
    \`;
  }).join('');

  document.getElementById('ventures-grid').innerHTML = cards;

  // Update stats
  const strip = document.getElementById('stats-strip');
  strip.innerHTML = \`
    <div class="stat-card"><div class="label">Fleet</div><div class="value">\${totalWorkers}</div><div class="sub">workers monitored</div></div>
    <div class="stat-card"><div class="label">Healthy</div><div class="value \${totalHealthy === totalWorkers ? 'green' : 'red'}">\${totalHealthy}/\${totalWorkers}</div><div class="sub">all systems</div></div>
    <div class="stat-card"><div class="label">Auto-heal</div><div class="value">\${totalAuto}</div><div class="sub">workers covered</div></div>
    <div class="stat-card"><div class="label">Ventures</div><div class="value green">4</div><div class="sub">products live</div></div>
  \`;
}

// ── Activity ──────────────────────────────────────────────────────────────────
function renderActivity(runs) {
  if (!runs || !runs.length) {
    document.getElementById('activity-log').innerHTML = '<div class="loading">No recent activity</div>';
    return;
  }

  const actionIcon = a => ({
    'self-heal': '🔧', 'self-heal-manual': '🔧',
    'webhook-deploy': '🚀', 'deploy': '🚀',
    'ai-fix': '🤖', 'alert': '⚠️',
  }[a] || '📋');

  const rows = runs.slice(0, 15).map(r => {
    const ok = r.status && (r.status.includes('heal') || r.status.includes('deploy') || r.status.includes('healthy') || r.status.includes('success') || r.status.includes('fixed'));
    const fail = r.status && (r.status.includes('fail') || r.status.includes('down'));
    const ago = r.ts ? timeAgo(r.ts) : '';
    return \`
      <div class="activity-row">
        <span class="act-icon">\${actionIcon(r.action)}</span>
        <div class="act-body">
          <span class="act-action">\${r.action || '—'}</span>
          \${r.worker ? \` · <span class="act-worker">\${r.worker}</span>\` : ''}
          <span class="act-status \${ok ? 'status-ok' : fail ? 'status-fail' : ''}">\${r.status || ''}</span>
        </div>
        <span class="act-time">\${ago}</span>
      </div>
    \`;
  }).join('');
  document.getElementById('activity-log').innerHTML = rows;
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

// Auto-refresh every 60 seconds
setInterval(loadAll, 60000);
</script>
</body>
</html>`;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, version: VERSION, worker: 'falkor-dashboard' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(HTML, {
      headers: { 'Content-Type': 'text/html;charset=UTF-8' }
    });
  }
};
