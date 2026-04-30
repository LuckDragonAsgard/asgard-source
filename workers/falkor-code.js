// falkor-code v1.2.0 -- Self-healing orchestrator for Falkor fleet
// v1.1.0: CF API health checks, GitHub source fetch, auto-redeploy, AI fix gen, 10-min cron
// v1.2.0: GitHub push webhook (/webhook) — auto-deploy changed workers on push to main
//         Fixed FLEET paths (flat workers/*.js, not workers/*/index.js)

const VERSION = '1.2.0';
const VAULT_URL = 'https://asgard-vault.pgallivan.workers.dev';
const GITHUB_REPO = 'LuckDragonAsgard/asgard-source';
const DEPLOY_URL = 'https://asgard-tools.luckdragon.io/admin/deploy';

// Map GitHub file path → CF worker name
const WORKER_PATH_MAP = {
  'workers/falkor-agent.js':     'falkor-agent',
  'workers/falkor-kbt.js':       'falkor-kbt',
  'workers/falkor-brain.js':     'falkor-brain',
  'workers/falkor-workflows.js': 'falkor-workflows',
  'workers/falkor-school.js':    'falkor-school',
  'workers/falkor-web.js':       'falkor-web',
  'workers/falkor-sport.js':     'falkor-sport',
  'workers/falkor-ui.js':        'falkor-ui',
  'workers/falkor-code.js':      'falkor-code',
  'workers/asgard-ai.js':        'asgard-ai',
  'workers/asgard-tools.js':     'asgard-tools',
  'workers/asgard.js':           'asgard',
};

const FLEET = [
  { name: 'falkor-agent',     url: 'https://falkor-agent.luckdragon.io',     path: 'workers/falkor-agent.js',     critical: true  },
  { name: 'falkor-kbt',       url: 'https://falkor-kbt.luckdragon.io',       path: 'workers/falkor-kbt.js',       critical: false },
  { name: 'falkor-brain',     url: 'https://falkor-brain.luckdragon.io',     path: 'workers/falkor-brain.js',     critical: true  },
  { name: 'falkor-workflows', url: 'https://falkor-workflows.luckdragon.io', path: 'workers/falkor-workflows.js', critical: false },
  { name: 'falkor-school',    url: 'https://falkor-school.luckdragon.io',    path: 'workers/falkor-school.js',    critical: false },
  { name: 'falkor-web',       url: 'https://falkor-web.luckdragon.io',       path: 'workers/falkor-web.js',       critical: false },
  { name: 'falkor-sport',     url: 'https://falkor-sport.luckdragon.io',     path: 'workers/falkor-sport.js',     critical: false },
  { name: 'falkor-ui',        url: 'https://falkor.luckdragon.io',           path: 'workers/falkor-ui.js',        critical: true  },
  { name: 'asgard-ai',        url: 'https://asgard-ai.luckdragon.io',        path: 'workers/asgard-ai.js',        critical: true  },
];

const STALE_THRESHOLD_DAYS = 30;

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

// CF API health check — checks worker deployment status (avoids CF-to-CF 522s)
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
    if (!scriptMap) return { ...worker, healthy: null, error: 'CF API unavailable', deployed_at: null };
    const script = scriptMap[worker.name];
    if (!script) return { ...worker, healthy: false, error: 'Not found in CF', deployed_at: null };
    const daysSince = (now - new Date(script.modified_on).getTime()) / 86400000;
    const stale = daysSince > STALE_THRESHOLD_DAYS;
    return { ...worker, healthy: !stale, deployed_at: script.modified_on, days_since_deploy: Math.floor(daysSince), stale, error: stale ? `Stale: ${Math.floor(daysSince)}d since deploy` : null };
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

async function getGitHubFile(path, token) {
  const r = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
    headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': `falkor-code/${VERSION}` },
  });
  if (!r.ok) return null;
  const data = await r.json();
  return data.content ? atob(data.content.replace(/\n/g, '')) : null;
}

async function deployWorker(workerName, sourceCode, pin) {
  const code_b64 = btoa(unescape(encodeURIComponent(sourceCode)));
  const r = await fetch(DEPLOY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Pin': pin, 'User-Agent': 'Mozilla/5.0 (falkor-code) Chrome/124.0.0.0' },
    body: JSON.stringify({ worker_name: workerName, code_b64 }),
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

async function selfHeal(env) {
  const token = await getSecret(env, 'GITHUB_TOKEN');
  const pin = env.AGENT_PIN;
  const results = await checkAllWorkers(env);
  const broken = results.filter(w => w.healthy === false);
  const healed = [], failed = [];
  for (const worker of broken) {
    if (!token) { failed.push({ worker: worker.name, reason: 'No GitHub token' }); continue; }
    const source = await getGitHubFile(worker.path, token);
    if (!source) { failed.push({ worker: worker.name, reason: `No source at ${worker.path}` }); continue; }
    const deploy = await deployWorker(worker.name, source, pin);
    if (deploy.ok) healed.push({ worker: worker.name });
    else failed.push({ worker: worker.name, reason: `Deploy failed ${deploy.status}` });
    await logRun(env.DB, 'self-heal', worker.name, deploy.ok ? 'healed' : 'failed', { error: worker.error });
  }
  return { ok: true, checked: results.length, healthy: results.filter(w => w.healthy !== false).length, broken: broken.length, healed, failed, workers: results.map(w => ({ name: w.name, healthy: w.healthy, deployed_at: w.deployed_at, days_since: w.days_since_deploy, error: w.error || null, critical: w.critical })) };
}

// ── GitHub Webhook Handler ────────────────────────────────────────────────────
// Verifies X-Hub-Signature-256 HMAC, parses push event, deploys changed workers
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

  // Verify signature if secret is configured
  if (webhookSecret) {
    const valid = await verifyGitHubSignature(request, body, webhookSecret);
    if (!valid) return json({ error: 'Invalid signature' }, 401);
  }

  if (event === 'ping') return json({ ok: true, message: 'pong' });
  if (event !== 'push') return json({ ok: true, message: `Ignored event: ${event}` });

  let payload;
  try { payload = JSON.parse(body); } catch { return json({ error: 'Invalid JSON' }, 400); }

  // Only act on pushes to main/master
  const ref = payload.ref || '';
  if (ref !== 'refs/heads/main' && ref !== 'refs/heads/master') {
    return json({ ok: true, message: `Ignored ref: ${ref}` });
  }

  // Collect all changed worker files from all commits
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

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });
    const url = new URL(request.url);
    const path = url.pathname;

    // GitHub webhook — no X-Pin auth, uses HMAC signature instead
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
      const health = entry ? await httpHealthCheck(entry.url) : null;
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
      return json({ ok: true, fleet_health: `${healthy}/${results.length} workers deployed`, broken_workers: broken.map(w => w.name), critical_broken: broken.filter(w => w.critical).map(w => w.name) });
    }

    return json({ error: 'Not found' }, 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(selfHeal(env));
  },
};
