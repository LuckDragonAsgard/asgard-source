// asgard-backup v1.2.0 — nightly D1 snapshot + worker inventory to GitHub
// Cron: daily 18:00 UTC (4am AEST)
// Bindings: PADDY_PIN (secret), GITHUB_TOKEN (secret), DB (D1 → asgard-brain)

const VERSION = '1.2.0';
const GITHUB_REPO = 'PaddyGallivan/asgard-backups';

// Tables backed up in FULL (project/operational data — no secrets)
const TABLES_FULL = [
  'products', 'feature_flags', 'global_rules', 'project_rules',
  'hub_config', 'metrics', 'spend_log', 'deployments', 'builds',
  'rollbacks', 'project_events', 'project_files', 'feature_requests',
  'msg_groups', 'msg_inbox', 'msg_read_receipts', 'audit_log', 'errors'
];

// Tables where only row count is stored (AI memory / chat — may contain user content with tokens)
const TABLES_COUNT_ONLY = [
  'conversations', 'messages', 'facts', 'memory', 'claude_sessions',
  'comms_log', 'system_docs', 'decisions', 'patterns', 'anomalies',
  'project_chat', 'project_rules', 'email_products'
];

// Workers to inventory (just note which ones exist in CF account)
const CF_WORKERS = [
  'asgard', 'asgard-ai', 'asgard-tools', 'asgard-brain', 'asgard-vault',
  'asgard-backup', 'racetipping-api', 'sly-app', 'wps-hub-v3',
  'thor', 'lady-thor', 'thunder-dev', 'thunder-dispatch',
  'thunder-inbox', 'thunder-revenue', 'thunder-watch', 'gh-push'
];

async function githubPush(token, path, content, message) {
  const enc = new TextEncoder();
  const bytes = enc.encode(content);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin);

  let sha = null;
  try {
    const r = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
      headers: { Authorization: `token ${token}`, 'User-Agent': 'asgard-backup/1.2' }
    });
    if (r.ok) sha = (await r.json()).sha;
  } catch {}

  const body = { message, content: b64 };
  if (sha) body.sha = sha;

  const resp = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`, 'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'asgard-backup/1.2'
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`GitHub push failed for ${path}: ${resp.status} ${err.substring(0, 300)}`);
  }
  return true;
}

async function backupD1(db, token, dateStr) {
  const fullData = {};
  const countData = {};
  const errors = [];

  // Full backup for safe tables
  for (const table of TABLES_FULL) {
    try {
      const { results } = await db.prepare(`SELECT * FROM ${table} LIMIT 10000`).all();
      fullData[table] = { count: results.length, rows: results };
    } catch (e) {
      errors.push(`${table}: ${e.message}`);
    }
  }

  // Count-only for sensitive tables
  for (const table of TABLES_COUNT_ONLY) {
    try {
      const { results } = await db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).all();
      countData[table] = { count: results[0]?.cnt ?? 0, rows: 'redacted — may contain sensitive content' };
    } catch (e) {
      errors.push(`${table}_count: ${e.message}`);
    }
  }

  const content = JSON.stringify({
    backup_date: dateStr,
    note: 'Full rows: operational tables only. Sensitive tables (facts/convos/memory etc) show count only.',
    tables_full: fullData,
    tables_count_only: countData,
    errors
  }, null, 2);

  await githubPush(token, `d1/${dateStr}.json`, content,
    `D1 backup ${dateStr} — ${Object.keys(fullData).length} full, ${Object.keys(countData).length} counted, ${errors.length} errors`);
  await githubPush(token, 'd1/latest.json', content, `D1 latest ${dateStr}`);

  return {
    tables_full: Object.keys(fullData).length,
    tables_counted: Object.keys(countData).length,
    errors
  };
}

async function inventoryWorkers(db, token, dateStr) {
  // Record expected workers — we know these exist (confirmed at deploy time).
  // Can't probe via HTTP (same-zone 1042). Just record the known list with timestamp.
  const inventory = {};
  CF_WORKERS.forEach(w => { inventory[w] = 'expected'; });

  // Also check D1 deployments table for recent deploys
  let recentDeploys = [];
  try {
    const { results } = await db.prepare(
      'SELECT worker_name, deployed_at, version FROM deployments ORDER BY deployed_at DESC LIMIT 20'
    ).all();
    recentDeploys = results;
  } catch {}

  const content = JSON.stringify({
    snapshot_date: dateStr,
    note: 'Worker existence check via HTTP is blocked (CF same-zone 1042). Listing known workers.',
    expected_workers: inventory,
    recent_deploys: recentDeploys
  }, null, 2);

  await githubPush(token, `workers/inventory-${dateStr}.json`, content,
    `Worker inventory ${dateStr}`);

  return { workers: Object.keys(inventory).length };
}

async function runBackup(env) {
  const pin = env.PADDY_PIN;
  const token = env.GITHUB_TOKEN;
  const db = env.DB;

  if (!pin || !token) throw new Error('Missing PADDY_PIN or GITHUB_TOKEN');
  if (!db) throw new Error('Missing DB binding — add D1 binding in CF dashboard');

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timestamp = now.toISOString();

  console.log(`[asgard-backup] Starting ${VERSION} backup at ${timestamp}`);

  const [d1Result, workerResult] = await Promise.allSettled([
    backupD1(db, token, dateStr),
    inventoryWorkers(db, token, dateStr)
  ]);

  const summary = {
    timestamp, version: VERSION,
    d1: d1Result.status === 'fulfilled' ? d1Result.value : { error: d1Result.reason?.message },
    workers: workerResult.status === 'fulfilled' ? workerResult.value : { error: workerResult.reason?.message },
    status: d1Result.status === 'fulfilled' ? 'ok' : 'partial'
  };

  await githubPush(token, `logs/backup-${dateStr}.json`,
    JSON.stringify(summary, null, 2), `Backup log ${dateStr} — ${summary.status}`);

  console.log('[asgard-backup] Done:', JSON.stringify(summary));
  return summary;
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runBackup(env).catch(e => console.error('[asgard-backup] FAILED:', e)));
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return Response.json({ ok: true, worker: 'asgard-backup', version: VERSION,
        schedule: 'daily 18:00 UTC', repo: GITHUB_REPO,
        bindings: { db: !!env.DB, pin: !!env.PADDY_PIN, token: !!env.GITHUB_TOKEN } });
    }
    if (url.pathname === '/run') {
      const pin = request.headers.get('X-Pin') || url.searchParams.get('pin');
      if (pin !== env.PADDY_PIN) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      try {
        return Response.json({ ok: true, ...(await runBackup(env)) });
      } catch (e) {
        return Response.json({ ok: false, error: e.message }, { status: 500 });
      }
    }
    return Response.json({ error: 'Not found', routes: ['/health', '/run'] }, { status: 404 });
  }
};
