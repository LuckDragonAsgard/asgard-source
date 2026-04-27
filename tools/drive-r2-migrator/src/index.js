// drive-r2-migrator — pulls files from Google Drive (via SA) and writes to R2.
// Endpoints:
//   GET  /list?folder=<id>&account=<email>      walk folder, return {files:[...], totalSize, count}
//   POST /migrate    body {files:[{id,path,mimeType,size,md5,isGoogleNative}], account}
//   GET  /verify?key=<r2-key>                   confirm R2 has it, return size + etag
//   GET  /status                                running totals
//   POST /reset                                 clear status counters
//   GET  /                                      readme
//
// All endpoints require ?token=<MIGRATION_TOKEN> matching the env secret. Cheap auth.

import { getAccessToken } from './google-auth.js';
import {
  listFolder,
  walkFolder,
  downloadFile,
  exportFile,
  exportMimeFor,
  extensionFor,
} from './drive.js';

// In-memory status (per Worker isolate). Persisted snapshots written to MANIFEST bucket.
const status = {
  startedAt: null,
  filesAttempted: 0,
  filesMigrated: 0,
  filesFailed: 0,
  bytesMoved: 0,
  errors: [],
  lastBatch: null,
};

function json(obj, init = {}) {
  return new Response(JSON.stringify(obj, null, 2), {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

function authed(request, env) {
  const u = new URL(request.url);
  const token = u.searchParams.get('token') || request.headers.get('x-migration-token');
  return token && env.MIGRATION_TOKEN && token === env.MIGRATION_TOKEN;
}

async function handleList(request, env) {
  const u = new URL(request.url);
  const folderId = u.searchParams.get('folder');
  const account = u.searchParams.get('account') || 'unknown';
  if (!folderId) return json({ error: 'folder param required' }, { status: 400 });

  const accessToken = await getAccessToken(env.GOOGLE_SA_JSON);
  const files = await walkFolder(accessToken, folderId);
  const totalSize = files.reduce((a, f) => a + (f.size || 0), 0);

  // Save manifest snapshot
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const key = `_manifest/list_${account}_${folderId}_${ts}.json`;
  await env.MANIFEST.put(key, JSON.stringify({ folderId, account, files }, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });

  return json({
    folderId,
    account,
    count: files.length,
    totalSize,
    googleNativeCount: files.filter((f) => f.isGoogleNative).length,
    manifestKey: key,
    files,
  });
}


async function handleListShallow(request, env) {
  const u = new URL(request.url);
  const folderId = u.searchParams.get('folder');
  const account = u.searchParams.get('account') || 'unknown';
  if (!folderId) return json({ error: 'folder param required' }, { status: 400 });

  const accessToken = await getAccessToken(env.GOOGLE_SA_JSON);
  const children = await listFolder(accessToken, folderId);
  const folders = children.filter((c) => c.mimeType === 'application/vnd.google-apps.folder')
                          .map((c) => ({ id: c.id, name: c.name, modifiedTime: c.modifiedTime }));
  const files = children.filter((c) => c.mimeType !== 'application/vnd.google-apps.folder')
                        .map((c) => ({
                          id: c.id, path: c.name, name: c.name, mimeType: c.mimeType,
                          size: c.size ? Number(c.size) : null, md5: c.md5Checksum || null,
                          modifiedTime: c.modifiedTime,
                          isGoogleNative: c.mimeType.startsWith('application/vnd.google-apps.'),
                        }));
  const totalSize = files.reduce((a, f) => a + (f.size || 0), 0);
  return json({ folderId, account, folderCount: folders.length, fileCount: files.length, totalSize, folders, files });
}


// If a key already exists in R2 with a DIFFERENT driveId, append the file's id-suffix to keep both.
async function dedupeR2Key(env, baseKey, file) {
  try {
    const head = await env.ARCHIVE.head(baseKey);
    if (!head) return baseKey; // free
    if (head.customMetadata && head.customMetadata.driveId === file.id) return baseKey; // same file (idempotent overwrite OK)
    // Collision: insert -<id8> before the extension.
    const idx = baseKey.lastIndexOf('.');
    const stem = idx > 0 ? baseKey.slice(0, idx) : baseKey;
    const ext = idx > 0 ? baseKey.slice(idx) : '';
    return `${stem}-${file.id.slice(-8)}${ext}`;
  } catch {
    return baseKey;
  }
}

async function migrateOne(file, account, env, accessToken) {
  // Build R2 key
  const baseKey = `${account}/${file.path}`.replace(/\\/g, '/');
  let r2Key = baseKey;
  let mimeForStore = file.mimeType;

  let body, contentLength;
  if (file.isGoogleNative) {
    const exportMime = exportMimeFor(file.mimeType);
    const ext = extensionFor(exportMime);
    if (!r2Key.toLowerCase().endsWith(`.${ext}`)) r2Key = `${r2Key}.${ext}`;
    const resp = await exportFile(accessToken, file.id, exportMime);
    body = await resp.arrayBuffer();
    contentLength = body.byteLength;
    mimeForStore = exportMime;
  } else {
    const resp = await downloadFile(accessToken, file.id);
    body = await resp.arrayBuffer();
    contentLength = body.byteLength;
  }

  r2Key = await dedupeR2Key(env, r2Key, file);
  await env.ARCHIVE.put(r2Key, body, {
    httpMetadata: { contentType: mimeForStore },
    customMetadata: {
      driveId: file.id,
      driveOwner: account,
      driveMime: file.mimeType,
      driveModified: file.modifiedTime || '',
      driveMd5: file.md5 || '',
    },
  });

  return { r2Key, bytes: contentLength };
}

async function handleMigrate(request, env, ctx) {
  const body = await request.json();
  const { files, account } = body;
  if (!files || !Array.isArray(files)) {
    return json({ error: 'files array required' }, { status: 400 });
  }
  const acc = account || 'unknown';

  const accessToken = await getAccessToken(env.GOOGLE_SA_JSON);
  status.startedAt ||= new Date().toISOString();
  const batchResults = [];

  for (const file of files) {
    status.filesAttempted++;
    try {
      const result = await migrateOne(file, acc, env, accessToken);
      status.filesMigrated++;
      status.bytesMoved += result.bytes;
      batchResults.push({ id: file.id, ok: true, r2Key: result.r2Key, bytes: result.bytes });
    } catch (e) {
      status.filesFailed++;
      const errMsg = e.message || String(e);
      status.errors.push({ id: file.id, path: file.path, error: errMsg });
      if (status.errors.length > 100) status.errors.shift();
      batchResults.push({ id: file.id, ok: false, error: errMsg });
    }
  }

  status.lastBatch = new Date().toISOString();

  // Append batch result to manifest
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const manifestKey = `_manifest/migrate_${acc}_${ts}.json`;
  ctx.waitUntil(
    env.MANIFEST.put(manifestKey, JSON.stringify({ account: acc, results: batchResults }, null, 2))
  );

  return json({
    batchSize: files.length,
    succeeded: batchResults.filter((r) => r.ok).length,
    failed: batchResults.filter((r) => !r.ok).length,
    manifestKey,
    results: batchResults,
  });
}

async function handleVerify(request, env) {
  const u = new URL(request.url);
  const key = u.searchParams.get('key');
  if (!key) return json({ error: 'key param required' }, { status: 400 });
  const obj = await env.ARCHIVE.head(key);
  if (!obj) return json({ exists: false }, { status: 404 });
  return json({
    exists: true,
    key,
    size: obj.size,
    etag: obj.etag,
    uploaded: obj.uploaded,
    customMetadata: obj.customMetadata,
  });
}

async function handleStatus() {
  return json(status);
}

async function handleReset() {
  status.startedAt = null;
  status.filesAttempted = 0;
  status.filesMigrated = 0;
  status.filesFailed = 0;
  status.bytesMoved = 0;
  status.errors = [];
  status.lastBatch = null;
  return json({ reset: true });
}

const README = `drive-r2-migrator
==================

GET  /list?folder=<id>&account=<email>&token=<X>
POST /migrate?token=<X>     body: {"account": "...", "files": [...]}
GET  /verify?key=<r2-key>&token=<X>
GET  /status?token=<X>
POST /reset?token=<X>

Service account: kbt-slides@asgard-493906.iam.gserviceaccount.com
R2 bucket: asgard-archive (binding: ARCHIVE)
Manifest bucket: asgard-archive-manifest (binding: MANIFEST)

Drive folders must be shared with the SA email above (Viewer role).
`;

export default {
  async fetch(request, env, ctx) {
    const u = new URL(request.url);

    if (u.pathname === '/' || u.pathname === '') {
      return new Response(README, { headers: { 'content-type': 'text/plain' } });
    }
    if (!authed(request, env)) {
      return json({ error: 'unauthorized — pass ?token=<MIGRATION_TOKEN>' }, { status: 401 });
    }

    try {
      if (u.pathname === '/list' && request.method === 'GET') return handleList(request, env);
      if (u.pathname === '/list-shallow' && request.method === 'GET') return handleListShallow(request, env);
      if (u.pathname === '/migrate' && request.method === 'POST')
        return handleMigrate(request, env, ctx);
      if (u.pathname === '/verify' && request.method === 'GET') return handleVerify(request, env);
      if (u.pathname === '/status' && request.method === 'GET') return handleStatus();
      if (u.pathname === '/reset' && request.method === 'POST') return handleReset();
      return json({ error: 'not found' }, { status: 404 });
    } catch (e) {
      return json({ error: e.message || String(e), stack: e.stack }, { status: 500 });
    }
  },
};
