// falkor-desktop v1.1.0 — Screenshot → base64 vision loop
const VERSION = '1.1.0';
const CORS = {
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type,X-Pin'
};
function jsonr(obj,status=200){return new Response(JSON.stringify(obj),{status,headers:{...CORS,'Content-Type':'application/json'}});}
function pinOk(req,env){const p=req.headers.get('X-Pin')||'';if(!env.AGENT_PIN)return true;return p===env.AGENT_PIN;}

const CREATE_SQL = `CREATE TABLE IF NOT EXISTS desktop_commands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command TEXT NOT NULL,
  intent TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  result TEXT DEFAULT '',
  image_b64 TEXT DEFAULT '',
  image_mime TEXT DEFAULT 'image/png',
  error TEXT DEFAULT '',
  requested_by TEXT DEFAULT 'falkor',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`;

const ADD_IMAGE_COL_SQL = `ALTER TABLE desktop_commands ADD COLUMN image_b64 TEXT DEFAULT ''`;
const ADD_MIME_COL_SQL  = `ALTER TABLE desktop_commands ADD COLUMN image_mime TEXT DEFAULT 'image/png'`;

// Updated Python agent — includes base64 screenshot encoding with Pillow resize
const SETUP_SCRIPT = `#!/usr/bin/env python3
# falkor-desktop local agent v1.1.0 - polls and runs commands from Falkor
# Install: pip install pyautogui pillow requests
import time, subprocess, base64, io
import requests

URL  = 'https://falkor-desktop.luckdragon.io'
PIN  = 'YOUR_AGENT_PIN_HERE'
POLL = 3   # seconds between polls

def capture_screenshot():
    """Capture screen, resize to max 1280x720, JPEG 85%, return base64."""
    try:
        import pyautogui
        from PIL import Image
        ss = pyautogui.screenshot()
        # Resize if larger than 1280x720 to keep base64 under 400KB
        max_w, max_h = 1280, 720
        if ss.width > max_w or ss.height > max_h:
            ss.thumbnail((max_w, max_h), Image.LANCZOS)
        buf = io.BytesIO()
        ss.save(buf, format='JPEG', quality=80)
        b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        return {'ok': True, 'result': f'Screenshot {ss.width}x{ss.height}', 'image_b64': b64, 'image_mime': 'image/jpeg'}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

def run(cmd, intent):
    try:
        import pyautogui
        c = cmd.lower()
        if 'screenshot' in c or intent in ('screenshot', 'vision', 'screen'):
            return capture_screenshot()
        elif c.startswith('open '):
            subprocess.Popen(['start', c[5:].strip()], shell=True)
            return {'ok': True, 'result': 'Opened: ' + c[5:].strip()}
        else:
            r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
            return {'ok': True, 'result': (r.stdout or r.stderr or 'Done').strip()}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

print('Falkor desktop agent v1.1.0 running. Ctrl+C to stop.')
while True:
    try:
        r = requests.get(URL + '/pending', headers={'X-Pin': PIN}, timeout=10)
        if r.ok:
            for c in r.json().get('commands', []):
                print(f'[{c["id"]}] {c["command"]}')
                res = run(c['command'], c.get('intent', ''))
                requests.post(URL + '/result/' + str(c['id']), json=res, headers={'X-Pin': PIN})
    except Exception as e:
        print('Error:', e)
    time.sleep(POLL)
`;

async function initDB(env) {
  await env.DESKTOP_DB.exec(CREATE_SQL);
  // Try to add new columns if they don't exist (idempotent)
  try { await env.DESKTOP_DB.exec(ADD_IMAGE_COL_SQL); } catch(e) { /* already exists */ }
  try { await env.DESKTOP_DB.exec(ADD_MIME_COL_SQL);  } catch(e) { /* already exists */ }
}

// Poll D1 until command status is done/error, or timeout (ms)
async function pollResult(env, id, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const row = await env.DESKTOP_DB
      .prepare('SELECT status,result,image_b64,image_mime,error FROM desktop_commands WHERE id=?')
      .bind(id).first();
    if (!row) return null;
    if (row.status === 'done' || row.status === 'error') return row;
    await new Promise(r => setTimeout(r, 1500));
  }
  return null; // timeout
}

export default {
  async fetch(req, env) {
    const url    = new URL(req.url);
    const path   = url.pathname;
    const method = req.method;
    if (method === 'OPTIONS') return new Response(null, { headers: CORS });

    try { await initDB(env); } catch(e) {}

    // ── Health ────────────────────────────────────────────────────────────────
    if (path === '/health') {
      let total = 0, pending = 0;
      try { const s = await env.DESKTOP_DB.prepare('SELECT COUNT(*) as n FROM desktop_commands').first(); total = s?.n || 0; } catch(e) {}
      try { const s = await env.DESKTOP_DB.prepare('SELECT COUNT(*) as n FROM desktop_commands WHERE status="pending"').first(); pending = s?.n || 0; } catch(e) {}
      return jsonr({ ok:true, worker:'falkor-desktop', version:VERSION, total, pending, vision_enabled:true });
    }

    // ── Setup script download (no auth) ──────────────────────────────────────
    if (path === '/setup') {
      return new Response(SETUP_SCRIPT, {
        headers: { ...CORS, 'Content-Type': 'text/plain', 'Content-Disposition': 'attachment; filename="falkor-desktop-agent.py"' }
      });
    }

    if (!pinOk(req, env)) return jsonr({ error: 'Unauthorized' }, 401);

    // ── Queue a command ──────────────────────────────────────────────────────
    if (path === '/command' && method === 'POST') {
      try {
        const b = await req.json().catch(() => ({}));
        if (!b.command) return jsonr({ error: 'command required' }, 400);
        const r = await env.DESKTOP_DB
          .prepare('INSERT INTO desktop_commands (command,intent,requested_by) VALUES (?,?,?)')
          .bind(b.command, b.intent || '', b.requested_by || 'falkor')
          .run();
        return jsonr({ ok:true, id:r.meta?.last_row_id, command:b.command, status:'pending' });
      } catch(e) { return jsonr({ error:e.message }, 500); }
    }

    // ── Screenshot endpoint — queue + synchronously poll for result ───────────
    if (path === '/screenshot' && method === 'POST') {
      try {
        const b = await req.json().catch(() => ({}));
        const prompt = b.prompt || 'Describe this screenshot.';
        // Queue the screenshot command
        const r = await env.DESKTOP_DB
          .prepare('INSERT INTO desktop_commands (command,intent,requested_by) VALUES (?,?,?)')
          .bind('take screenshot', 'screenshot', 'falkor-vision')
          .run();
        const cmdId = r.meta?.last_row_id;
        // Wait for result (up to 15s)
        const result = await pollResult(env, cmdId);
        if (!result) {
          return jsonr({ ok:false, error:'Screenshot timeout — is the desktop agent running?', cmd_id:cmdId });
        }
        if (result.status === 'error') {
          return jsonr({ ok:false, error:result.error || 'Screenshot failed', cmd_id:cmdId });
        }
        return jsonr({
          ok: true,
          cmd_id: cmdId,
          result: result.result,
          image_b64: result.image_b64 || '',
          image_mime: result.image_mime || 'image/jpeg',
          prompt,
        });
      } catch(e) { return jsonr({ error:e.message }, 500); }
    }

    // ── Poll for pending commands (used by local agent) ────────────────────
    if (path === '/pending') {
      try {
        const rows = await env.DESKTOP_DB
          .prepare('SELECT id,command,intent FROM desktop_commands WHERE status="pending" ORDER BY created_at ASC LIMIT 5')
          .all();
        const res = rows.results || [];
        if (res.length > 0) {
          const ids = res.map(r => r.id).join(',');
          await env.DESKTOP_DB.exec(`UPDATE desktop_commands SET status='running',updated_at=CURRENT_TIMESTAMP WHERE id IN (${ids})`);
        }
        return jsonr({ commands: res });
      } catch(e) { return jsonr({ commands: [], error: e.message }); }
    }

    // ── Post result back from local agent ─────────────────────────────────
    const rm = path.match(/^\/result\/(\d+)$/);
    if (rm && method === 'POST') {
      try {
        const id = parseInt(rm[1]);
        const b  = await req.json().catch(() => ({}));
        await env.DESKTOP_DB
          .prepare('UPDATE desktop_commands SET status=?,result=?,image_b64=?,image_mime=?,error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
          .bind(b.ok !== false ? 'done' : 'error', b.result || '', b.image_b64 || '', b.image_mime || 'image/png', b.error || '', id)
          .run();
        return jsonr({ ok:true });
      } catch(e) { return jsonr({ error:e.message }, 500); }
    }

    // ── Commands list / clear ─────────────────────────────────────────────
    if (path === '/commands') {
      try {
        if (method === 'DELETE') {
          await env.DESKTOP_DB.exec('DELETE FROM desktop_commands WHERE status IN ("done","error")');
          return jsonr({ ok:true });
        }
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const rows = await env.DESKTOP_DB
          .prepare('SELECT id,command,intent,status,result,error,requested_by,created_at FROM desktop_commands ORDER BY created_at DESC LIMIT ?')
          .bind(limit).all();
        return jsonr({ commands: rows.results || [] });
      } catch(e) { return jsonr({ error:e.message }, 500); }
    }

    return jsonr({ error:'Not found', path }, 404);
  }
};
