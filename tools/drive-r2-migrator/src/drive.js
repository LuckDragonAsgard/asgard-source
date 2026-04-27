// Drive API helpers. All take (accessToken, ...).
// SA can only see files explicitly shared with kbt-slides@asgard-493906.iam.gserviceaccount.com.

const DRIVE = 'https://www.googleapis.com/drive/v3';

async function driveGet(accessToken, path, params = {}) {
  const url = new URL(`${DRIVE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error(`Drive ${path} → ${r.status}: ${await r.text()}`);
  return r.json();
}

// List immediate children of a folder. Paginates internally.
export async function listFolder(accessToken, folderId) {
  const all = [];
  let pageToken = '';
  do {
    const params = {
      q: `'${folderId}' in parents`,
      fields: 'nextPageToken, files(id, name, mimeType, size, md5Checksum, modifiedTime, parents)',
      pageSize: '1000',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    };
    if (pageToken) params.pageToken = pageToken;
    const data = await driveGet(accessToken, '/files', params);
    all.push(...(data.files || []));
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return all;
}

// Walk a folder recursively, returning every leaf file with its full path.
// Skips Google-native types (Docs/Sheets/Slides) — they require export, handled separately.
export async function walkFolder(accessToken, rootFolderId, rootName = '') {
  const out = [];
  const stack = [{ id: rootFolderId, path: rootName }];
  while (stack.length) {
    const { id, path } = stack.pop();
    const children = await listFolder(accessToken, id);
    for (const child of children) {
      const childPath = path ? `${path}/${child.name}` : child.name;
      if (child.mimeType === 'application/vnd.google-apps.folder') {
        stack.push({ id: child.id, path: childPath });
      } else {
        out.push({
          id: child.id,
          path: childPath,
          name: child.name,
          mimeType: child.mimeType,
          size: child.size ? Number(child.size) : null,
          md5: child.md5Checksum || null,
          modifiedTime: child.modifiedTime,
          isGoogleNative: child.mimeType.startsWith('application/vnd.google-apps.'),
        });
      }
    }
  }
  return out;
}

// Stream-download a file's bytes. Returns a Response.
// For Google-native types, the caller should switch to /export.
export async function downloadFile(accessToken, fileId) {
  const r = await fetch(`${DRIVE}/files/${fileId}?alt=media&supportsAllDrives=true`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error(`download ${fileId} → ${r.status}: ${await r.text()}`);
  return r;
}

// Export a Google-native file (Doc → docx, Sheet → xlsx, Slides → pptx).
const EXPORT_MAP = {
  'application/vnd.google-apps.document':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.google-apps.spreadsheet':
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.google-apps.presentation':
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.google-apps.drawing': 'image/png',
  'application/vnd.google-apps.script': 'application/vnd.google-apps.script+json',
};

export function exportMimeFor(mimeType) {
  return EXPORT_MAP[mimeType] || 'application/pdf';
}

export async function exportFile(accessToken, fileId, exportMime) {
  const url = new URL(`${DRIVE}/files/${fileId}/export`);
  url.searchParams.set('mimeType', exportMime);
  const r = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error(`export ${fileId} → ${r.status}: ${await r.text()}`);
  return r;
}

export function extensionFor(exportMime) {
  return (
    {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'image/png': 'png',
      'application/pdf': 'pdf',
      'application/vnd.google-apps.script+json': 'json',
    }[exportMime] || 'bin'
  );
}
