// falkor-code v1.3.0 — Self-healing orchestrator for ALL Falkor ventures
// v1.0.0: CF API health checks, GitHub source fetch, auto-redeploy, AI fix gen, 10-min cron
// v1.2.0: GitHub push webhook (/webhook) — auto-deploy changed workers on push to main
// v1.2.1: Fixed encoding bug + skip_auto_commit to prevent webhook→deploy→commit loop
// v1.3.0: Extended fleet to all ventures (CT, SSP, SC) + email alerts + /ventures endpoint

const VERSION = '1.3.0';
const VAULT_URL = 'https://asgard-vault.pgallivan.workers.dev';
const GITHUB_REPO = 'LuckDragonAsgard/asgard-source';
const DEPLOY_URL = 'https://asgard-tools.luckdragon.io/admin/deploy';
const WORKFLOWS_URL = 'https://falkor-workflows.luckdragon.io';
const ALERT_EMAIL = 'pgallivan@outlook.com';

// Map GitHub file path → CF worker name (for webhook auto-deploy)
const WORKER_PATH_MAP = {
  'workers/falkor-agent.js':             'falkor-agent',
  'workers/falkor-kbt.js':               'falkor-kbt',
  'workers/falkor-brain.js':             'falkor-brain',
  'workers/falkor-workflows.js':         'falkor-workflows',
  'workers/falkor-school.js':            'falkor-school',
  'workers/falkor-web.js':               'falkor-web',
  'workers/falkor-sport.js':             'falkor-sport',
  'workers/falkor-ui.js':                'falkor-ui',
  'workers/falkor-code.js':              'falkor-code',
  'workers/asgard-ai.js':               'asgard-ai',
  'workers/asgard-tools.js':            'asgard-tools',
  'workers/asgard.js':                  'asgard',
  // Product AI backends — auto-deployable from asgard-source
  'workers/falkor-ct-ai.js':            'falkor-ct-ai',
  'workers/falkor-ssp-ai.js':           'falkor-ssp-ai',
  'workers/falkor-sportcarnival-ai.js': 'falkor-sportcarnival-ai',
  'workers/falkor-widget.js':           'falkor-widget',
};

// ── FALKOR FLEET ──────────────────────────────────────────────────────────────
// autoHeal: true = pull from asgard-source GitHub and redeploy automatically
// autoHeal: false = monitor only — email alert if down, manual fix required
const FLEET = [
  // Core Falkor infrastructure
  { name: 'falkor-agent',     url: 'https://falkor-agent.luckdragon.io',     path: 'workers/falkor-agent.js',     critical: true,  autoHeal: true,  group: 'falkor' },
  { name: 'falkor-kbt',       url: 'https://falkor-kbt.luckdragon.io',       path: 'workers/falkor-kbt.js',       critical: false, autoHeal: true,  group: 'falkor' },
  { name: 'falkor-brain',     url: 'https://falkor-brain.luckdragon.io',     path: 'workers/falkor-brain.js',     critical: true,  autoHeal: true,  group: 'falkor' },
  { name: 'falkor-workflows', url: 'https://falkor-workflows.luckdragon.io', path: 'workers/falkor-workflows.js', critical: false, autoHeal: true,  group: 'falkor' },
  { name: 'falkor-school',    url: 'https://falkor-school.luckdragon.io',    path: 'workers/falkor-school.js',    critical: false, autoHeal: true,  group: 'falkor' },
  { name: 'falkor-web',       url: 'https://falkor-web.luckdragon.io',       path: 'workers/falkor-web.js',       critical: false, autoHeal: true,  group: 'falkor' },
  { name: 'falkor-sport',     url: 'https://falkor-sport.luckdragon.io',     path: 'workers/falkor-sport.js',     critical: false, autoHeal: true,  group: 'falkor' },
  { name: 'falkor-ui',        url: 'https://falkor.luckdragon.io',           path: 'workers/falkor-ui.js',        critical: true,  autoHeal: true,  group: 'falkor' },
  { name: 'asgard-ai',        url: 'https://asgard-ai.luckdragon.io',        path: 'workers/asgard-ai.js',        critical: true,  autoHeal: true,  group: 'falkor' },
  // Product AI backends — in asgard-source, auto-healable
  { name: 'falkor-widget',            url: 'https://falkor-widget.luckdragon.io',            path: 'workers/falkor-widget.js',           critical: true,  autoHeal: true,  group: 'shared'   },
  { name: 'falkor-ct-ai',             url: 'https://falkor-ct-ai.luckdragon.io',             path: 'workers/falkor-ct-ai.js',            critical: false, autoHeal: true,  group: 'ct'       },
  { name: 'falkor-ssp-ai',            url: 'https://falkor-ssp-ai.luckdragon.io',            path: 'workers/falkor-ssp-ai.js',           critical: false, autoHeal: true,  group: 'ssp'      },
  { name: 'falkor-sportcarnival-ai',  url: 'https://falkor-sportcarnival-ai.luckdragon.io',  path: 'workers/falkor-sportcarnival-ai.js', critical: false, autoHeal: true,  group: 'sc'       },
  // Carnival Timing — complex workers, alert only
  { name: 'carnival-timing-html', url: 'https://carnivaltiming.com',    path: null, critical: true,  autoHeal: false, group: 'ct',  note: 'Python multipart PUT deploy to CF API' },
  { name: 'carnival-timing-ws',   url: null,                             path: null, critical: true,  autoHeal: false, group: 'ct',  note: 'DO worker — needs CF API deploy with bindings' },
  { name: 'ct-access',             url: 'https://ct-access.luckdragon.io', path: null, critical: false, autoHeal: false, group: 'ct',  note: 'Paywall validation worker' },
  { name: 'carnival-results',      url: null,                             path: null, critical: false, autoHeal: false, group: 'ct',  note: 'D1 results worker' },
  // School Sport Portal
  { name: 'ssp-portal',        url: 'https://schoolsportportal.com.au', path: null, critical: true,  autoHeal: false, group: 'ssp', note: 'GitHub proxy — edit schoolsportportal/index.html to update' },
  // SportCarnival
  { name: 'sportcarnival-hub', url: 'https://sportcarnival.com.au',     path: null, critical: true,  autoHeal: false, group: 'sc',  note: 'CF Pages — push to sportcarnival-hub GitHub repo' },
];

const STALE_THRESHOLD_DAYS = 30;

// ── Utilities ─────────────────────────────────────────────────────────────────
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Pin, X-Hub-Signature-256',
  };
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders() } });
}
async function getSecret(env, key) {
  if (env[key]) return env[key];
  try {
    const r = await fetch(`${VAULT_URL}/secret/${key}`, { headers: { 'X-Pin': env.AGENT_PIN } });
    if (r.ok) return await r.text();
  } catch {}
  return null;
}

// ── Email Alert ───────────────────────────────────────────────────────────────
async function sendAlert(subject, html) {
  try {
    await fetch(`${WORKFLOWS_URL}/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Pin': '535554' },
      body: JSON.stringify({ to: ALERT_EMAIL, subject, html }),
    });
  } catch {}
}

// ── CF API Health Check ───────────────────────────────────────────────────────
async function cfApiHealthCheck(env) {
  const cfToken = await getSecret(env, 'CF_API_TOKEN');
  const cfAccount = env.CF_ACCOUNT_ID || 'a6f47c17811ee2f8b6caeb8f38768c20';
  if (!cfToken) return null;
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccount}/workers/scripts`, {
    headers: { 'Authorization': `Bearer ${cfToken}`, 'User-Agent': `falkor-code/${VERSION}` },
  });
  if (!r.ok) return null;
  const data = await r.json();
  return (data.result || []).reduce((map, s) => { map[s.id] = s; return map; }, {});
}

async function checkAllWorkers(env) {
  const scriptMap = await cfApiHealthCheck(env);
  const now = Date.now();
  return FLEET.map(worker => {
    // Skip workers with no CF script (e.g., CF Pages workers tracked differently)
    if (!scriptMap) return { ...worker, healthy: null, error: 'CF API unavailable', deployed_at: null };
    const script = scriptMap[worker.name];
    if (!script) return { ...worker, healthy: false, error: 'Not found in CF', deployed_at: null };
    const daysSince = (now - new Date(script.modified_on).getTime()) / 86400000;
    const stale = daysSince > STALE_THRESHOLD_DAYS;
    return {
      ...worker,
      healthy: !stale,
      deployed_at: script.modified_on,
      days_since_deploy: Math.floor(daysSince),
      stale,
      error: stale ? `Stale: ${Math.floor(daysSince)}d since deploy` : null,
    };
  });
}

async function httpHealthCheck(workerUrl) {
  try {
    const r = await fetch(`${workerUrl}/health`, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': `falkor-code/${VERSION}` } });
    if (!r.ok) return { healthy: false, error: `HTTP ${r.status}` };
    const data = await r.json().catch(() => ({}));
    return { healthy: data.ok === true || data.status === 'ok', version: data.version, data };
  } catch (err) { return { healthy: false, error: err.message }; }
}

// ── GitHub Utilities ──────────────────────────────────────────────────────────
async function getGitHubFile(path, token) {
  const r = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
    headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': `falkor-code/${VERSION}` },
  });
  if (!r.ok) return null;
  const data = await r.json();
  if (!data.content) return null;
  const b64 = data.content.replace(/\n/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

async function deployWorker(workerName, sourceCode, pin) {
  const enc = new TextEncoder();
  const bytes = enc.encode(sourceCode);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const code_b64 = btoa(bin);
  const r = await fetch(DEPLOY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Pin': pin, 'User-Agent': 'Mozilla/5.0 (falkor-code) Chrome/124.0.0.0' },
    body: JSON.stringify({ worker_name: workerName, code_b64, skip_auto_commit: true }),
  });
  return { ok: r.ok, status: r.status, result: await r.json().catch(() => ({ error: 'invalid JSON' })) };
}

async function generateFix(workerName, sourceCode, errorDescription, anthropicKey) {
  const prompt = `Fix Cloudflare Worker "${workerName}". Error: ${errorDescription}\nSource:\n${sourceCode.slice(0, 3000)}\nReturn ONLY corrected JavaScript, no markdown.`;
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 4096, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!r.ok) return null;
  const data = await r.json();
  return data.content?.[0]?.text || null;
}

// ── D1 Logging ────────────────────────────────────────────────────────────────
async function logRun(db, action, worker, status, details) {
  if (!db) return;
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS falkor_code_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT, worker TEXT, status TEXT, details TEXT, ts INTEGER)`).run();
    await db.prepare('INSERT INTO falkor_code_runs (action, worker, status, details, ts) VALUES (?, ?, ?, ?, ?)').bind(action, worker || '', status, JSON.stringify(details).slice(0, 2000), Date.now()).run();
  } catch {}
}

async function getRuns(db) {
  if (!db) return [];
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS falkor_code_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT, worker TEXT, status TEXT, details TEXT, ts INTEGER)`).run();
    const { results } = await db.prepare('SELECT * FROM falkor_code_runs ORDER BY ts DESC LIMIT 20').all();
    return results || [];
  } catch { return []; }
}

// ── Self-Heal ─────────────────────────────────────────────────────────────────
async function selfHeal(env) {
  const token = await getSecret(env, 'GITHUB_TOKEN');
  const pin = env.AGENT_PIN;
  const results = await checkAllWorkers(env);
  const broken = results.filter(w => w.healthy === false);

  const healed = [], failed = [], alerted = [];

  for (const worker of broken) {
    if (worker.autoHeal && worker.path) {
      // Auto-healable — pull from asgard-source and redeploy
      if (!token) { failed.push({ worker: worker.name, reason: 'No GitHub token' }); continue; }
      const source = await getGitHubFile(worker.path, token);
      if (!source) { failed.push({ worker: worker.name, reason: `No source at ${worker.path}` }); continue; }
      const deploy = await deployWorker(worker.name, source, pin);
      if (deploy.ok) {
        healed.push({ worker: worker.name });
        await logRun(env.DB, 'self-heal', worker.name, 'healed', { error: worker.error });
      } else {
        failed.push({ worker: worker.name, reason: `Deploy failed ${deploy.status}` });
        await logRun(env.DB, 'self-heal', worker.name, 'failed', { error: worker.error });
        // Send alert for auto-heal failures on critical workers
        if (worker.critical) {
          await sendAlert(
            `🚨 Falkor: ${worker.name} down & auto-heal FAILED`,
            `<p>Worker <strong>${worker.name}</strong> is down and auto-heal failed.</p><p>Error: ${worker.error}</p><p>Group: ${worker.group}</p><p>Manual fix needed. Check: <a href="${worker.url}">${worker.url}</a></p>`
          );
        }
      }
    } else {
      // Non-auto-healable — log and email alert
      alerted.push({ worker: worker.name, note: worker.note });
      await logRun(env.DB, 'alert', worker.name, 'down-manual-fix-needed', { error: worker.error, note: worker.note });
      if (worker.critical) {
        await sendAlert(
          `⚠️ Falkor: ${worker.name} needs attention`,
          `<p>Worker <strong>${worker.name}</strong> appears down or stale.</p><p>Error: ${worker.error}</p><p>Group: ${worker.group}</p><p>Note: ${worker.note || 'Manual fix required'}</p>${worker.url ? `<p>URL: <a href="${worker.url}">${worker.url}</a></p>` : ''}`
        );
      }
    }
  }

  return {
    ok: true,
    checked: results.length,
    healthy: results.filter(w => w.healthy !== false).length,
    broken: broken.length,
    healed,
    failed,
    alerted,
    workers: results.map(w => ({
      name: w.name, healthy: w.healthy, group: w.group,
      deployed_at: w.deployed_at, days_since: w.days_since_deploy,
      error: w.error || null, critical: w.critical, autoHeal: w.autoHeal,
    })),
  };
}

// ── Ventures Summary ──────────────────────────────────────────────────────────
async function getVenturesSummary(env) {
  const results = await checkAllWorkers(env);

  const groups = {
    falkor: { name: 'Falkor (Personal AI)', url: 'https://falkor.luckdragon.io', workers: [] },
    ct:     { name: 'Carnival Timing',       url: 'https://carnivaltiming.com',    workers: [] },
    ssp:    { name: 'School Sport Portal',   url: 'https://schoolsportportal.com.au', workers: [] },
    sc:     { name: 'SportCarnival',         url: 'https://sportcarnival.com.au',  workers: [] },
    shared: { name: 'Shared Infrastructure', url: null,                            workers: [] },
  };

  for (const w of results) {
    if (groups[w.group]) {
      groups[w.group].workers.push({
        name: w.name, healthy: w.healthy,
        days_since: w.days_since_deploy, autoHeal: w.autoHeal,
        error: w.error || null,
      });
    }
  }

  const summary = {};
  for (const [key, g] of Object.entries(groups)) {
    const total = g.workers.length;
    const healthy = g.workers.filter(w => w.healthy !== false).length;
    summary[key] = {
      name: g.name, url: g.url,
      status: healthy === total ? '✅ all healthy' : `⚠️ ${total - healthy}/${total} down`,
      total, healthy,
      workers: g.workers,
    };
  }

  return summary;
}

// ── GitHub Webhook Handler ────────────────────────────────────────────────────
async function verifyGitHubSignature(request, body, secret) {
  const sig = request.headers.get('X-Hub-Signature-256');
  if (!sig || !secret) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const sigBytes = new Uint8Array(sig.replace('sha256=', '').match(/.{2}/g).map(b => parseInt(b, 16)));
  return await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(body));
}

async function handleWebhook(request, env) {
  const event = request.headers.get('X-GitHub-Event');
  const body = await request.text();
  const webhookSecret = env.WEBHOOK_SECRET;

  if (webhookSecret) {
    const valid = await verifyGitHubSignature(request, body, webhookSecret);
    if (!valid) return json({ error: 'Invalid signature' }, 401);
  }

  if (event === 'ping') return json({ ok: true, message: 'pong' });
  if (event !== 'push') return json({ ok: true, message: `Ignored event: ${event}` });

  let payload;
  try { payload = JSON.parse(body); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const ref = payload.ref || '';
  if (ref !== 'refs/heads/main' && ref !== 'refs/heads/master') {
    return json({ ok: true, message: `Ignored ref: ${ref}` });
  }

  const changedFiles = new Set();
  for (const commit of (payload.commits || [])) {
    const files = [...(commit.added || []), ...(commit.modified || [])];
    for (const f of files) {
      if (WORKER_PATH_MAP[f]) changedFiles.add(f);
    }
  }

  if (changedFiles.size === 0) return json({ ok: true, message: 'No worker files changed' });

  const token = await getSecret(env, 'GITHUB_TOKEN');
  if (!token) return json({ error: 'No GitHub token' }, 500);

  const deployed = [], failed = [];
  for (const filePath of changedFiles) {
    const workerName = WORKER_PATH_MAP[filePath];
    const source = await getGitHubFile(filePath, token);
    if (!source) { failed.push({ file: filePath, worker: workerName, reason: 'Source fetch failed' }); continue; }
    const deploy = await deployWorker(workerName, source, env.AGENT_PIN);
    if (deploy.ok) deployed.push({ file: filePath, worker: workerName });
    else failed.push({ file: filePath, worker: workerName, reason: `Deploy ${deploy.status}` });
    await logRun(env.DB, 'webhook-deploy', workerName, deploy.ok ? 'deployed' : 'failed', { ref, commit: payload.after?.slice(0, 7) });
  }

  return json({ ok: true, ref, commit: payload.after?.slice(0, 7), changed: [...changedFiles], deployed, failed });
}

// ── Router ────────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/webhook' && request.method === 'POST') {
      return handleWebhook(request, env);
    }

    if (path !== '/health') {
      const pin = request.headers.get('X-Pin') || url.searchParams.get('pin');
      if (!pin || pin !== env.AGENT_PIN) return json({ error: 'Unauthorized' }, 401);
    }

    if (path === '/health') return json({ ok: true, worker: 'falkor-code', version: VERSION, webhook: '/webhook' });

    if (path === '/workers') {
      const results = await checkAllWorkers(env);
      const healthy = results.filter(w => w.healthy !== false).length;
      return json({ ok: true, total: results.length, healthy, broken: results.filter(w => w.healthy === false).length, workers: results });
    }

    if (path === '/ventures') {
      const summary = await getVenturesSummary(env);
      return json({ ok: true, ventures: summary });
    }

    if (path === '/self-heal' && request.method === 'POST') {
      const result = await selfHeal(env);
      await logRun(env.DB, 'self-heal-manual', null, result.broken === 0 ? 'all-healthy' : 'healed', result);
      return json(result);
    }

    if (path === '/deploy' && request.method === 'POST') {
      const { worker_name, source } = await request.json();
      if (!worker_name) return json({ error: 'worker_name required' }, 400);
      let code = source;
      if (!code) {
        const token = await getSecret(env, 'GITHUB_TOKEN');
        if (!token) return json({ error: 'No GitHub token' }, 500);
        const entry = FLEET.find(w => w.name === worker_name);
        code = await getGitHubFile(entry?.path || `workers/${worker_name}.js`, token);
        if (!code) return json({ error: 'Source not found on GitHub' }, 404);
      }
      const deploy = await deployWorker(worker_name, code, env.AGENT_PIN);
      await logRun(env.DB, 'deploy', worker_name, deploy.ok ? 'success' : 'failed', deploy.result);
      return json({ ok: deploy.ok, worker: worker_name, result: deploy.result });
    }

    if (path === '/fix' && request.method === 'POST') {
      const { worker_name, error: errorDesc } = await request.json();
      if (!worker_name) return json({ error: 'worker_name required' }, 400);
      const token = await getSecret(env, 'GITHUB_TOKEN');
      const anthropicKey = await getSecret(env, 'ANTHROPIC_API_KEY');
      if (!token || !anthropicKey) return json({ error: 'Missing secrets' }, 500);
      const entry = FLEET.find(w => w.name === worker_name);
      const source = await getGitHubFile(entry?.path || `workers/${worker_name}.js`, token);
      if (!source) return json({ error: 'Source not found' }, 404);
      const fixed = await generateFix(worker_name, source, errorDesc || 'Health check failing', anthropicKey);
      if (!fixed) return json({ error: 'AI fix generation failed' }, 500);
      const deploy = await deployWorker(worker_name, fixed, env.AGENT_PIN);
      await logRun(env.DB, 'ai-fix', worker_name, deploy.ok ? 'fixed' : 'failed', { error: errorDesc, deployed: deploy.ok });
      return json({ ok: deploy.ok, worker: worker_name, fix_generated: true, deployed: deploy.ok });
    }

    if (path === '/runs') return json({ ok: true, runs: await getRuns(env.DB) });

    if (path === '/analyze' && request.method === 'POST') {
      const { worker_name } = await request.json();
      if (!worker_name) return json({ error: 'worker_name required' }, 400);
      const token = await getSecret(env, 'GITHUB_TOKEN');
      if (!token) return json({ error: 'No GitHub token' }, 500);
      const entry = FLEET.find(w => w.name === worker_name);
      const source = await getGitHubFile(entry?.path || `workers/${worker_name}.js`, token);
      if (!source) return json({ error: 'Source not found' }, 404);
      const health = entry?.url ? await httpHealthCheck(entry.url) : null;
      const anthropicKey = await getSecret(env, 'ANTHROPIC_API_KEY');
      let analysis = null;
      if (anthropicKey) {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 512, messages: [{ role: 'user', content: `Analyze Worker "${worker_name}". Health: ${health?.healthy ? 'OK' : 'FAILING'}.\nSource:\n${source.slice(0, 2000)}\n3-5 bullet points on issues/improvements.` }] }),
        });
        if (r.ok) { const d = await r.json(); analysis = d.content?.[0]?.text; }
      }
      return json({ ok: true, worker: worker_name, healthy: health?.healthy, version: health?.version, source_chars: source.length, analysis });
    }

    if (path === '/summary') {
      const results = await checkAllWorkers(env);
      const healthy = results.filter(w => w.healthy !== false).length;
      const broken = results.filter(w => w.healthy === false);
      const ventureHealth = {};
      for (const w of results) {
        if (!ventureHealth[w.group]) ventureHealth[w.group] = { healthy: 0, total: 0 };
        ventureHealth[w.group].total++;
        if (w.healthy !== false) ventureHealth[w.group].healthy++;
      }
      return json({
        ok: true,
        fleet_health: `${healthy}/${results.length} workers deployed`,
        broken_workers: broken.map(w => w.name),
        critical_broken: broken.filter(w => w.critical).map(w => w.name),
        ventures: Object.entries(ventureHealth).map(([k, v]) => `${k}: ${v.healthy}/${v.total}`),
      });
    }

    return json({ error: 'Not found' }, 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(selfHeal(env));
  },
};
