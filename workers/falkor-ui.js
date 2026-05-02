const PUSH_URL = 'https://falkor-push.luckdragon.io';

const JSON_MANIFEST = JSON.stringify({
  name: 'Falkor',
  short_name: 'Falkor',
  description: 'Your personal AI assistant',
  start_url: '/',
  display: 'standalone',
  background_color: '#0f0f11',
  theme_color: '#6c63ff',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
  ],
  shortcuts: [
    { name: 'AFL & Ladder', short_name: 'AFL', description: 'Check the AFL ladder', url: '/?intent=afl', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
    { name: 'My Tips', short_name: 'Tips', description: 'Submit your footy tips', url: '/?intent=tips', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
    { name: 'Daily Briefing', short_name: 'Briefing', description: 'Get your daily briefing', url: '/?intent=briefing', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
    { name: 'Start Trivia', short_name: 'Trivia', description: 'Launch KBT trivia', url: '/?intent=trivia', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
    { name: 'Racing Tips', short_name: 'Racing', description: 'Pick your racing tips', url: '/?intent=racing', icons: [{ src: '/icon-192.png', sizes: '192x192' }] }
  ]
});

const SW_CODE = `
const CACHE = 'falkor-v9.6.0';
const CACHE_URLS = ['/'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

self.addEventListener('push', e => {
  if (!e.data) return;
  try {
    const d = e.data.json();
    e.waitUntil(self.registration.showNotification(d.title || 'Falkor', {
      body: d.body || '',
      icon: d.icon || '/icon-192.png',
      badge: '/icon-192.png',
      tag: d.tag || 'falkor',
      data: { url: d.url || 'https://falkor.luckdragon.io' },
      requireInteraction: false,
      actions: d.actions || [],
    }));
  } catch(err) {}
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = e.action === 'snooze' ? '/?intent=briefing' : (e.notification.data?.url || 'https://falkor.luckdragon.io');
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) {
      if (c.url.includes('falkor.luckdragon.io') && 'focus' in c) return c.focus();
    }
    return clients.openWindow(target);
  }));
});

function openOfflineDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('falkor-offline', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
    req.onsuccess = e => res(e.target.result);
    req.onerror = rej;
  });
}
async function getOfflineQueue() {
  const db = await openOfflineDB();
  return new Promise((res, rej) => { const tx = db.transaction('queue','readonly'); const req = tx.objectStore('queue').getAll(); req.onsuccess = () => res(req.result); req.onerror = rej; });
}
async function clearOfflineQueue() {
  const db = await openOfflineDB();
  return new Promise((res, rej) => { const tx = db.transaction('queue','readwrite'); tx.objectStore('queue').clear(); tx.oncomplete = res; tx.onerror = rej; });
}

self.addEventListener('sync', e => {
  if (e.tag === 'falkor-chat-sync') {
    e.waitUntil(getOfflineQueue().then(async items => {
      if (!items.length) return;
      for (const item of items) {
        await fetch('https://falkor-agent.luckdragon.io/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Pin': item.pin },
          body: JSON.stringify({ message: item.message, userId: item.userId, model: item.model }),
        });
      }
      await clearOfflineQueue();
      const allClients = await self.clients.matchAll({ type: 'window' });
      for (const c of allClients) c.postMessage({ type: 'sync_complete' });
    }));
  }
});
`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({status:'ok',version:'9.6.0',worker:'falkor-ui'}), {
        headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}
      });
    }
    if (url.pathname === '/manifest.json') {
      return new Response(JSON_MANIFEST, {
        headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=86400' }
      });
    }
    if (url.pathname === '/sw.js') {
      return new Response(SW_CODE, {
        headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-cache' }
      });
    }
    const HTML = String.raw`<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Falkor</title>
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#6c63ff">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Falkor">

<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.2/babel.min.js"></script>
<style>
:root{
  --bg:#0f0f11;--panel:#18181b;--panel2:#1e1e24;--border:#2a2a2e;
  --text:#e8e8ea;--muted:#72728a;--accent:#6c63ff;--accent2:#a78bfa;
  --user-bubble:#1e1e2e;--ai-bubble:#18181b;--danger:#ef4444;--success:#22c55e;
  --warning:#f59e0b;--input-bg:#1a1a1f;--radius:12px;
  --sidebar-w:260px;
  --shadow:0 4px 24px rgba(0,0,0,.4);
}
[data-theme="light"]{
  --bg:#f4f4f8;--panel:#fff;--panel2:#f9f9fc;--border:#e0e0ea;
  --text:#1a1a1e;--muted:#7070a0;--user-bubble:#ede9fe;--ai-bubble:#fff;
  --input-bg:#fff;--shadow:0 4px 24px rgba(0,0,0,.08);
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100dvh;overflow:hidden}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.5}

/* ── Scrollbars ── */
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:99px}

/* ── Login ── */
.login-wrap{display:flex;align-items:center;justify-content:center;height:100dvh;background:var(--bg)}
.login-card{background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:40px 36px;width:100%;max-width:380px;box-shadow:var(--shadow)}
.login-logo{font-size:28px;font-weight:800;letter-spacing:-1px;margin-bottom:6px;background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.login-sub{color:var(--muted);font-size:14px;margin-bottom:28px}
.field{display:flex;flex-direction:column;gap:6px;margin-bottom:16px}
.field label{font-size:13px;color:var(--muted);font-weight:500}
.field input{background:var(--input-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:15px;padding:10px 14px;outline:none;transition:border .15s}
.field input:focus{border-color:var(--accent)}
.btn{width:100%;padding:11px;border:none;border-radius:9px;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:15px;font-weight:600;cursor:pointer;transition:opacity .15s;letter-spacing:.01em}
.btn:disabled{opacity:.45;cursor:not-allowed}
.btn:not(:disabled):hover{opacity:.88}
.btn-ghost{background:transparent;border:1px solid var(--border);color:var(--text)}
.btn-ghost:hover{background:var(--border) !important;opacity:1 !important}

/* ── User select ── */
.user-select{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100dvh;gap:24px;padding:24px}
.user-cards{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;max-width:420px}
.user-card{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:22px 28px;text-align:center;cursor:pointer;transition:transform .15s,border-color .15s,box-shadow .15s;min-width:120px}
.user-card:hover{transform:translateY(-2px);border-color:var(--accent);box-shadow:0 0 0 2px rgba(108,99,255,.2)}
.avatar{font-size:42px;margin-bottom:8px}
.uname{font-weight:700;font-size:16px;margin-bottom:2px}
.urole{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}

/* ── App layout ── */
.app{display:flex;height:100dvh;position:relative;overflow:hidden}
.sidebar{position:fixed;left:0;top:0;bottom:0;width:var(--sidebar-w);background:var(--panel);border-right:1px solid var(--border);display:flex;flex-direction:column;z-index:100;transform:translateX(-100%);transition:transform .22s cubic-bezier(.4,0,.2,1)}
.sidebar.open{transform:translateX(0);box-shadow:var(--shadow)}
@media(min-width:900px){
  .sidebar{transform:translateX(0)}
  .main{margin-left:var(--sidebar-w)}
  .sidebar-scrim{display:none !important}
}
.sidebar-scrim{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99;backdrop-filter:blur(2px)}
.sidebar-top{display:flex;align-items:center;justify-content:space-between;padding:16px 14px 12px}
.logo-text{font-size:18px;font-weight:800;letter-spacing:-0.5px;background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.new-chat-btn{margin:0 10px 8px;padding:9px;font-size:14px;border-radius:8px;background:rgba(108,99,255,.15);border:1px solid rgba(108,99,255,.25);color:var(--accent);font-weight:600}
.new-chat-btn:hover{background:rgba(108,99,255,.25);opacity:1}

/* Sidebar search */
.sidebar-search{margin:0 10px 6px;position:relative}
.sidebar-search input{width:100%;padding:7px 10px 7px 30px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none}
.sidebar-search input:focus{border-color:var(--accent)}
.sidebar-search-icon{position:absolute;left:9px;top:50%;transform:translateY(-50%);font-size:13px;color:var(--muted);pointer-events:none}

.convo-list{flex:1;overflow-y:auto;padding:2px 6px}
.convo-item{display:flex;align-items:center;gap:6px;padding:9px 10px;border-radius:8px;cursor:pointer;font-size:13px;color:var(--text);transition:background .1s;position:relative;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.convo-item:hover{background:rgba(255,255,255,.06)}
.convo-item.active{background:rgba(108,99,255,.15);color:var(--accent2);font-weight:500}
.convo-icon{flex-shrink:0;font-size:14px}
.convo-title{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.convo-del{margin-left:auto;opacity:0;font-size:12px;color:var(--muted);padding:2px 5px;border-radius:4px;flex-shrink:0;transition:opacity .1s}
.convo-item:hover .convo-del{opacity:.7}
.convo-del:hover{opacity:1 !important;color:var(--danger)}

.sidebar-footer{padding:10px 12px;border-top:1px solid var(--border);display:flex;align-items:center;gap:8px}
.user-pill{flex:1;font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.icon-btn{background:none;border:none;cursor:pointer;color:var(--muted);font-size:18px;padding:5px 7px;border-radius:7px;line-height:1;transition:background .1s,color .1s;flex-shrink:0}
.icon-btn:hover{background:rgba(255,255,255,.08);color:var(--text)}

/* ── Main ── */
.main{flex:1;display:flex;flex-direction:column;height:100dvh;min-width:0}
.topbar{display:flex;align-items:center;gap:6px;padding:10px 14px;background:var(--panel);border-bottom:1px solid var(--border);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);position:sticky;top:0;z-index:50;flex-shrink:0}
.topbar-title{flex:1;font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--text)}
.topbar-badge{font-size:11px;padding:2px 7px;border-radius:20px;background:rgba(108,99,255,.15);color:var(--accent2);font-weight:600;flex-shrink:0}
.model-select{background:var(--input-bg);border:1px solid var(--border);border-radius:7px;color:var(--text);font-size:12px;padding:5px 8px;outline:none;cursor:pointer;flex-shrink:0;max-width:130px}
.ws-dot{width:8px;height:8px;border-radius:50%;background:var(--border);flex-shrink:0;transition:background .3s}
.ws-dot.connected{background:var(--success);box-shadow:0 0 6px rgba(34,197,94,.5)}
.ws-dot.connecting{background:var(--warning);animation:pulse-dot 1s infinite}
@keyframes pulse-dot{0%,100%{opacity:.4}50%{opacity:1}}
.nav-btn{background:none;border:none;cursor:pointer;padding:5px 8px;border-radius:7px;font-size:13px;color:var(--muted);font-weight:500;transition:background .1s,color .1s;white-space:nowrap;flex-shrink:0}
.nav-btn:hover{background:rgba(255,255,255,.08);color:var(--text)}
.nav-btn.active{background:rgba(108,99,255,.15);color:var(--accent2);font-weight:600}
.nav-sep{width:1px;height:18px;background:var(--border);flex-shrink:0}
.bell-btn{background:none;border:none;cursor:pointer;font-size:17px;padding:5px 6px;border-radius:7px;color:var(--muted);line-height:1;transition:color .2s}
.bell-btn:hover{color:var(--text)}
.bell-btn.active{color:var(--accent2)}

/* ── Messages ── */
.messages{flex:1;overflow-y:auto;padding:20px 16px;display:flex;flex-direction:column;gap:6px}
.msg-row{display:flex;flex-direction:column;gap:3px;max-width:840px;width:100%}
.msg-row.user{align-self:flex-end;align-items:flex-end}
.msg-row.assistant{align-self:flex-start;align-items:flex-start}
.msg-role{font-size:11px;color:var(--muted);padding:0 4px;font-weight:500}
.msg-bubble{padding:11px 15px;border-radius:14px;font-size:14px;line-height:1.65;word-break:break-word;position:relative}
.msg-row.user .msg-bubble{background:var(--user-bubble);border-bottom-right-radius:4px;max-width:min(420px,88vw)}
.msg-row.assistant .msg-bubble{background:var(--ai-bubble);border:1px solid var(--border);border-bottom-left-radius:4px;max-width:min(680px,96vw)}
.msg-bubble pre{background:var(--panel2);border:1px solid var(--border);border-radius:8px;padding:12px;margin:8px 0;overflow-x:auto;font-size:13px;position:relative}
.msg-bubble code{background:var(--panel2);padding:1px 5px;border-radius:4px;font-size:13px;font-family:'Fira Code',monospace}
.msg-bubble pre code{background:none;padding:0;border-radius:0}
.msg-bubble a{color:var(--accent2);text-decoration:underline;text-underline-offset:2px}
.msg-bubble strong{font-weight:700}
.msg-bubble em{font-style:italic;color:var(--muted)}
.msg-bubble table{border-collapse:collapse;width:100%;margin:8px 0;font-size:13px}
.msg-bubble th{background:var(--panel2);padding:7px 12px;text-align:left;font-weight:600;border:1px solid var(--border)}
.msg-bubble td{padding:6px 12px;border:1px solid var(--border)}
.msg-bubble tr:nth-child(even) td{background:rgba(255,255,255,.02)}
.msg-timestamp{font-size:10px;color:var(--muted);padding:0 4px;opacity:0;transition:opacity .15s}
.msg-row:hover .msg-timestamp{opacity:.7}
.copy-code-btn{position:absolute;top:6px;right:8px;background:var(--border);border:none;border-radius:5px;color:var(--muted);font-size:11px;padding:3px 8px;cursor:pointer;opacity:0;transition:opacity .15s}
.msg-bubble pre:hover .copy-code-btn{opacity:1}
.copy-code-btn:hover{background:var(--accent);color:#fff}
.typing-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--muted);margin:0 2px;animation:typing-bounce .9s ease-in-out infinite}
.typing-dot:nth-child(2){animation-delay:.15s}
.typing-dot:nth-child(3){animation-delay:.3s}
@keyframes typing-bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}

/* ── Empty state ── */
.empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:24px;text-align:center}
.empty-icon{font-size:56px;filter:drop-shadow(0 0 24px rgba(108,99,255,.5));margin-bottom:4px}
.empty-title{font-size:22px;font-weight:700;background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.empty-sub{color:var(--muted);font-size:14px}
.chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:16px;max-width:600px}
.chip{padding:8px 16px;border-radius:20px;border:1px solid var(--border);background:var(--panel2);color:var(--text);font-size:13px;cursor:pointer;transition:border-color .15s,background .15s,transform .1s}
.chip:hover{border-color:var(--accent);background:rgba(108,99,255,.1);transform:translateY(-1px)}

/* ── Composer ── */
.composer{padding:10px 14px 12px;border-top:1px solid var(--border);background:var(--panel);flex-shrink:0}
.composer-inner{display:flex;align-items:flex-end;gap:6px;background:var(--input-bg);border:1px solid var(--border);border-radius:12px;padding:8px 10px;transition:border-color .15s}
.composer-inner:focus-within{border-color:var(--accent)}
.composer-inner.drag-over{border-color:var(--accent2);background:rgba(167,139,250,.08)}
.composer-inner textarea{flex:1;background:none;border:none;outline:none;color:var(--text);font-size:14px;resize:none;max-height:180px;line-height:1.5;min-height:22px;font-family:inherit}
.composer-inner textarea::placeholder{color:var(--muted)}
.attach-row{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);margin-bottom:6px;padding:5px 10px;background:var(--panel2);border-radius:7px;border:1px solid var(--border)}
.attach-remove{margin-left:auto;cursor:pointer;color:var(--danger);font-size:13px;padding:1px 4px;border-radius:3px}
.attach-remove:hover{background:rgba(239,68,68,.15)}
.send-btn{background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;border-radius:8px;color:#fff;font-size:16px;padding:7px 10px;cursor:pointer;flex-shrink:0;line-height:1;transition:opacity .15s}
.send-btn:disabled{opacity:.35;cursor:not-allowed}
.send-btn:not(:disabled):hover{opacity:.85}

/* ── Voice overlay ── */
.voice-overlay{position:fixed;inset:0;background:rgba(0,0,0,.9);backdrop-filter:blur(12px);z-index:300;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px}
.voice-close{position:absolute;top:22px;right:22px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);color:var(--text);border-radius:9px;padding:8px 18px;cursor:pointer;font-size:14px}
.voice-dragon{font-size:64px;filter:drop-shadow(0 0 32px rgba(108,99,255,.8));animation:float 3s ease-in-out infinite}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.voice-status{font-size:16px;color:var(--muted);min-height:24px;letter-spacing:.04em}
.voice-transcript{font-size:15px;color:var(--muted);max-width:600px;text-align:center;font-style:italic;padding:0 24px}
.voice-reply{font-size:16px;color:var(--text);max-width:600px;text-align:center;padding:0 24px;line-height:1.6}
.voice-mic-btn{width:90px;height:90px;border-radius:50%;border:none;cursor:pointer;font-size:36px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--accent),var(--accent2));position:relative;transition:background .3s;box-shadow:0 0 32px rgba(108,99,255,.4)}
.voice-mic-btn.listening{background:linear-gradient(135deg,#ef4444,#f97316);box-shadow:0 0 40px rgba(239,68,68,.4)}
.voice-mic-btn.listening::before{content:'';position:absolute;inset:-10px;border-radius:50%;border:2px solid #ef4444;animation:pulse-ring 1.1s ease-out infinite}
.voice-mic-btn.speaking{background:linear-gradient(135deg,var(--success),#10b981);box-shadow:0 0 40px rgba(34,197,94,.4)}
.voice-mic-btn:disabled{cursor:not-allowed;opacity:.5}
.waveform{display:flex;align-items:center;gap:3px;height:44px}
.waveform-bar{width:4px;border-radius:2px;background:var(--accent2);transition:height .05s ease}

/* ── Driving mode ── */
.driving-overlay{position:fixed;inset:0;background:#050508;z-index:500;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;overflow:hidden}
.driving-dragon{font-size:80px;line-height:1;filter:drop-shadow(0 0 40px rgba(108,99,255,.8));animation:float 3s ease-in-out infinite}
.driving-name{font-size:32px;font-weight:800;letter-spacing:2px;background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.driving-status{font-size:20px;color:var(--muted);min-height:28px;letter-spacing:.03em}
.driving-transcript{font-size:18px;color:var(--muted);max-width:700px;text-align:center;min-height:54px;line-height:1.5;padding:0 32px;font-style:italic}
.driving-reply{font-size:20px;color:var(--text);max-width:700px;text-align:center;min-height:60px;line-height:1.5;padding:0 32px}
.driving-mic{width:110px;height:110px;border-radius:50%;border:none;cursor:pointer;font-size:44px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--accent),var(--accent2));position:relative;transition:background .3s;box-shadow:0 0 40px rgba(108,99,255,.4)}
.driving-mic.listening{background:linear-gradient(135deg,#ef4444,#f97316);box-shadow:0 0 50px rgba(239,68,68,.5)}
.driving-mic.listening::before{content:'';position:absolute;inset:-12px;border-radius:50%;border:3px solid #ef4444;animation:pulse-ring 1s ease-out infinite}
.driving-mic.speaking{background:linear-gradient(135deg,var(--success),#10b981);box-shadow:0 0 50px rgba(34,197,94,.4)}
.driving-mic:disabled{cursor:not-allowed;opacity:.6}
.driving-exit{position:absolute;top:28px;right:28px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);color:var(--text);border-radius:10px;padding:10px 22px;cursor:pointer;font-size:15px;letter-spacing:.02em}
.driving-exit:hover{background:rgba(255,255,255,.14)}
@keyframes pulse-ring{0%{transform:scale(1);opacity:.8}100%{transform:scale(1.35);opacity:0}}

/* ── Settings overlay ── */
.settings-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(6px);z-index:200;display:flex;align-items:flex-end;justify-content:flex-end}
.settings-panel{background:var(--panel);border-left:1px solid var(--border);border-top:1px solid var(--border);width:min(340px,100vw);height:100dvh;padding:28px 24px;overflow-y:auto;display:flex;flex-direction:column;gap:12px}
.settings-title{font-size:16px;font-weight:700;margin-bottom:4px}
.divider{border:none;border-top:1px solid var(--border);margin:4px 0}
.setting-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:4px 0}
.setting-label{font-size:13px;color:var(--text)}
.setting-val{font-size:12px;color:var(--muted);text-align:right}
.toggle{width:42px;height:24px;border-radius:12px;background:var(--border);cursor:pointer;position:relative;transition:background .2s;flex-shrink:0}
.toggle::after{content:'';position:absolute;left:3px;top:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform .2s;box-shadow:0 1px 4px rgba(0,0,0,.3)}
.toggle.on{background:var(--accent)}
.toggle.on::after{transform:translateX(18px)}

/* ── Toast ── */
.toast-container{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:999;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none}
.toast{background:var(--panel);border:1px solid var(--border);border-radius:9px;padding:10px 20px;font-size:13px;color:var(--text);box-shadow:0 4px 20px rgba(0,0,0,.4);animation:toast-in .2s ease;max-width:360px;text-align:center;font-weight:500}
@keyframes toast-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

/* ── Sport ── */
.sport-table{width:100%;border-collapse:collapse;font-size:13px}
.sport-table th{font-size:11px;color:var(--muted);padding:7px 10px;text-align:left;border-bottom:1px solid var(--border);font-weight:600;text-transform:uppercase;letter-spacing:.06em}
.sport-table td{padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.04)}
.sport-table tr:last-child td{border-bottom:none}
.sport-table tbody tr:hover td{background:rgba(108,99,255,.05)}

/* ── Calendar ── */
.cal-event{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:12px 16px;display:flex;flex-direction:column;gap:4px}
.cal-event-time{font-size:11px;color:var(--accent2);font-weight:600;letter-spacing:.04em}
.cal-event-title{font-size:14px;font-weight:600;color:var(--text)}
.cal-event-desc{font-size:12px;color:var(--muted)}
.cal-day-header{font-size:12px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.08em;padding:16px 0 8px;border-bottom:1px solid var(--border);margin-bottom:10px}

/* ── Connection banner ── */
.conn-banner{text-align:center;padding:6px;font-size:12px;background:rgba(245,158,11,.12);color:var(--warning);border-bottom:1px solid rgba(245,158,11,.2);display:flex;align-items:center;justify-content:center;gap:6px;animation:pulse-banner 2s infinite}
@keyframes pulse-banner{0%,100%{opacity:.8}50%{opacity:1}}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel">
const { useState, useEffect, useRef, useCallback, useMemo } = React;

const AGENT_URL    = 'https://falkor-agent.luckdragon.io';
const SPORT_URL    = 'https://falkor-sport.luckdragon.io';
const AUTH_URL     = 'https://asgard.luckdragon.io';
const AI_URL       = 'https://asgard-ai.luckdragon.io';
const USERS_URL    = 'https://falkor-push.luckdragon.io';
const CALENDAR_URL = 'https://falkor-calendar.luckdragon.io';

const MODELS = [
  { key: 'groq-fast',  label: '⚡ Groq Fast' },
  { key: 'groq',       label: '🧠 Groq 70B' },
  { key: 'groq-think', label: '🔍 Groq Think' },
  { key: 'haiku',      label: '🌸 Haiku' },
  { key: 'sonnet',     label: '✨ Sonnet' },
];

const QUICK_CHIPS = [
  "What's on today?",
  "AFL ladder",
  "Check the weather",
  "What did I work on recently?",
  "Any new ideas?",
  "Set a reminder",
];

const LS = {
  pin:       () => localStorage.getItem('falkor.pin') || '',
  setPin:    v  => localStorage.setItem('falkor.pin', v),
  convos:    () => { try { return JSON.parse(localStorage.getItem('falkor.convos') || '[]'); } catch { return []; } },
  setConvos: v  => localStorage.setItem('falkor.convos', JSON.stringify(v)),
  model:     () => localStorage.getItem('falkor.model') || 'groq-fast',
  setModel:  v  => localStorage.setItem('falkor.model', v),
  theme:     () => localStorage.getItem('falkor.theme') || 'dark',
  setTheme:  v  => localStorage.setItem('falkor.theme', v),
  voice:     () => localStorage.getItem('falkor.voice') !== 'off',
  setVoice:  v  => localStorage.setItem('falkor.voice', v ? 'on' : 'off'),
  agentPin:  () => localStorage.getItem('falkor.agentPin') || '',
  setAgentPin: v => localStorage.setItem('falkor.agentPin', v),
  userId:    () => { try { return JSON.parse(localStorage.getItem('falkor.user') || '{}').id || ''; } catch { return ''; } },
};

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function renderMD(text) {
  if (!text) return '';
  var BK = '\x60';
  var codeBlockRe = new RegExp(BK+BK+BK+'(\\w*)\\n?([\\s\\S]*?)'+BK+BK+BK, 'g');
  var inlineCodeRe = new RegExp(BK+'([^'+BK+']+)'+BK, 'g');
  var s = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(codeBlockRe, function(_, lang, code) {
      return '<pre><button class="copy-code-btn" onclick="window.copyCode(this)">Copy</button><code class="lang-'+(lang||'')+'">' + code.trim() + '</code></pre>';
    })
    .replace(inlineCodeRe, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/^### (.+)$/gm, '<strong style="font-size:1.05em;display:block;margin:6px 0 2px">$1</strong>')
    .replace(/^## (.+)$/gm, '<strong style="font-size:1.1em;display:block;margin:8px 0 3px">$1</strong>')
    .replace(/^# (.+)$/gm, '<strong style="font-size:1.2em;display:block;margin:10px 0 4px">$1</strong>')
    .replace(/^[-*] (.+)$/gm, '<div style="padding-left:14px;margin:1px 0">• $1</div>')
    .replace(/^(\d+)\. (.+)$/gm, '<div style="padding-left:14px;margin:1px 0">$1. $2</div>')
    .replace(/\n/g, '<br>');
  return s;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let _toastId = 0, _setToasts = null;
function toast(msg, duration) {
  if (!_setToasts) return;
  const d = duration || 3000, id = ++_toastId;
  _setToasts(p => [...p, { id, msg }]);
  setTimeout(() => _setToasts(p => p.filter(t => t.id !== id)), d);
}
function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => { _setToasts = setToasts; return () => { _setToasts = null; }; }, []);
  if (!toasts.length) return null;
  return <div className="toast-container">{toasts.map(t => <div key={t.id} className="toast">{t.msg}</div>)}</div>;
}

// ─── VoiceWaveform ────────────────────────────────────────────────────────────
function VoiceWaveform({ analyserRef, active }) {
  const barsRef = useRef([]);
  const rafRef  = useRef(null);
  const NUM = 18;
  useEffect(() => {
    if (!active || !analyserRef.current) { barsRef.current.forEach(b => b && (b.style.height = '4px')); return; }
    const a = analyserRef.current, d = new Uint8Array(a.frequencyBinCount);
    const step = Math.floor(d.length / NUM);
    function draw() {
      a.getByteFrequencyData(d);
      barsRef.current.forEach((bar, i) => { if (!bar) return; bar.style.height = Math.max(4, (d[i * step] / 255) * 44) + 'px'; });
      rafRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);
  return (
    <div className="waveform">
      {Array.from({ length: NUM }, (_, i) => <div key={i} className="waveform-bar" ref={el => barsRef.current[i] = el} style={{ height: '4px' }}/>)}
    </div>
  );
}

// ─── VoiceModal ───────────────────────────────────────────────────────────────
function VoiceModal({ voiceState, transcript, reply, analyserRef, onMicClick, onClose }) {
  const statusMap = { idle:'🎙️ Tap mic to speak', listening:'🔴 Listening…', processing:'⚙️ Processing…', speaking:'🔊 Speaking…' };
  return (
    <div className="voice-overlay">
      <button className="voice-close" onClick={onClose}>✕ Close</button>
      <div className="voice-dragon">🐉</div>
      <div className="voice-status">{statusMap[voiceState] || ''}</div>
      <VoiceWaveform analyserRef={analyserRef} active={voiceState === 'listening' || voiceState === 'speaking'}/>
      {transcript && <div className="voice-transcript">"{transcript}"</div>}
      {reply && <div className="voice-reply">{reply}</div>}
      <button className={'voice-mic-btn ' + voiceState} onClick={onMicClick}
        disabled={voiceState === 'processing' || voiceState === 'speaking'}>
        {voiceState === 'listening' ? '⏹' : voiceState === 'speaking' ? '🔊' : '🎤'}
      </button>
    </div>
  );
}

// ─── UserSelectScreen ─────────────────────────────────────────────────────────
const USER_AVATARS = { paddy:'🏃', jacky:'⚡', george:'🎯', default:'👤' };

function UserSelectScreen({ onLogin }) {
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [pin, setPinVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(USERS_URL + '/user/list')
      .then(r => r.json())
      .then(d => setUsers(d.users || []))
      .catch(() => setUsers([{ id:'paddy', name:'Paddy', role:'admin' }]));
  }, []);

  async function handleVerify(e) {
    e.preventDefault();
    if (!selected || !pin) return;
    setLoading(true); setError('');
    try {
      const r = await fetch(USERS_URL + '/user/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selected.id, pin }),
      });
      const d = await r.json();
      if (d.success) { LS.setPin(pin); if (d.agentPin) LS.setAgentPin(d.agentPin); onLogin(d.user); }
      else { setError('Wrong PIN. Try again.'); setPinVal(''); }
    } catch { setError('Connection error. Try again.'); }
    setLoading(false);
  }

  if (selected) return (
    <div className="login-wrap">
      <div className="login-card" style={{ maxWidth:320 }}>
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <div style={{ fontSize:48 }}>{USER_AVATARS[selected.id] || USER_AVATARS.default}</div>
          <div className="login-logo" style={{ marginTop:8 }}>{selected.name}</div>
          <div className="login-sub">Enter your PIN to continue</div>
        </div>
        <form onSubmit={handleVerify}>
          <div className="field">
            <input type="password" inputMode="numeric" maxLength={8} placeholder="PIN"
              value={pin} onChange={e => setPinVal(e.target.value)} autoFocus
              style={{ textAlign:'center', letterSpacing:8, fontSize:22 }}/>
          </div>
          {error && <div style={{ color:'var(--danger)', fontSize:13, marginBottom:12, textAlign:'center' }}>{error}</div>}
          <button className="btn" disabled={loading || !pin}>{loading ? 'Checking…' : 'Enter'}</button>
        </form>
        <button onClick={() => { setSelected(null); setPinVal(''); setError(''); }}
          style={{ marginTop:14, background:'none', border:'none', color:'var(--muted)', cursor:'pointer', width:'100%', fontSize:13 }}>← Back</button>
      </div>
    </div>
  );

  return (
    <div className="user-select">
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:4 }}>🐉</div>
        <h2 style={{ fontSize:22, fontWeight:800, background:'linear-gradient(135deg,var(--accent),var(--accent2))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Who's this?</h2>
      </div>
      <div className="user-cards">
        {users.map(u => (
          <div key={u.id} className="user-card" onClick={() => setSelected(u)}>
            <div className="avatar">{USER_AVATARS[u.id] || USER_AVATARS.default}</div>
            <div className="uname">{u.name}</div>
            <div className="urole">{u.role === 'admin' ? 'Admin' : 'Member'}</div>
          </div>
        ))}
      </div>
      <div className="login-sub" style={{ textAlign:'center' }}>Select your profile to continue</div>
    </div>
  );
}

// ─── SettingsPanel ────────────────────────────────────────────────────────────
function SettingsPanel({ onClose, theme, onThemeToggle, voiceEnabled, onVoiceToggle }) {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    fetch(AGENT_URL + '/status', { headers: { 'X-Pin': LS.pin() } })
      .then(r => r.json()).then(setStatus).catch(() => {});
  }, []);
  return (
    <div className="settings-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="settings-panel">
        <div className="settings-title">⚙️ Settings</div>
        <hr className="divider"/>
        <div className="setting-row"><span className="setting-label">☀️ Light theme</span><div className={'toggle '+(theme==='light'?'on':'')} onClick={onThemeToggle}/></div>
        <div className="setting-row"><span className="setting-label">🎙️ Voice replies</span><div className={'toggle '+(voiceEnabled?'on':'')} onClick={onVoiceToggle}/></div>
        <div className="setting-row"><span className="setting-label" style={{fontSize:12,color:'var(--muted)'}}>Say "Hey Falkor" to activate voice</span></div>
        <hr className="divider"/>
        <div className="setting-row"><span className="setting-label">Agent</span><span className="setting-val">falkor-agent</span></div>
        {status && <>
          <div className="setting-row"><span className="setting-label">Version</span><span className="setting-val">v{status.version}</span></div>
          <div className="setting-row"><span className="setting-label">History</span><span className="setting-val">{status.historyLength} msgs</span></div>
          <div className="setting-row"><span className="setting-label">Memory</span><span className="setting-val">{status.memoryKeys} keys</span></div>
        </>}
        <hr className="divider"/>
        <button className="btn btn-ghost" onClick={() => { if (confirm('Clear chat history?')) fetch(AGENT_URL + '/history', { method:'DELETE', headers:{'X-Pin':LS.pin()} }); onClose(); }}>Clear history</button>
        <button className="btn" style={{ background:'var(--danger)', marginTop:6 }}
          onClick={() => { localStorage.removeItem('falkor.pin'); localStorage.removeItem('falkor.user'); window.location.reload(); }}>Sign out</button>
      </div>
    </div>
  );
}

// ─── SportPanel ───────────────────────────────────────────────────────────────


function NRLPanel({pin}){
  var SPORT_URL='https://falkor-sport.luckdragon.io';
  var YEAR=new Date().getFullYear();
  var [draw,setDraw]=React.useState(null);
  var [lb,setLb]=React.useState([]);
  var [standings,setStandings]=React.useState([]);
  var [tab,setTab]=React.useState('tips');
  var [tipped,setTipped]=React.useState({});
  var [loading,setLoading]=React.useState(true);
  var [player,setPlayer]=React.useState(function(){
    try{var u=JSON.parse(localStorage.getItem('falkor.user')||'null');if(u&&u.name)return u.name;}catch{}
    return localStorage.getItem('falkor.sport.player')||'';
  });
  var loggedInName=(function(){try{var u=JSON.parse(localStorage.getItem('falkor.user')||'null');return u&&u.name?u.name:null;}catch{return null;}}());

  async function load(){
    setLoading(true);
    try{
      var [dr,lb2,ldr]=await Promise.all([
        fetch(SPORT_URL+'/nrl/draw?season='+YEAR+'&pin='+pin).then(r=>r.json()),
        fetch(SPORT_URL+'/nrl/leaderboard?pin='+pin).then(r=>r.json()),
        fetch(SPORT_URL+'/nrl/ladder?season='+YEAR+'&pin='+pin).then(r=>r.json()),
      ]);
      setDraw(dr);
      setLb(lb2.leaderboard||[]);
      setStandings(ldr.ladder||[]);
      // load existing tips
      if(player&&dr.round){
        var tr=await fetch(SPORT_URL+'/nrl/tips?season='+YEAR+'&round='+dr.round+'&pin='+pin).then(r=>r.json());
        var t={};
        (tr.tips||[]).forEach(function(tip){if(tip.player===player)t[tip.game_id]=tip.tip;});
        setTipped(t);
      }
    }catch(e){}
    setLoading(false);
  }

  React.useEffect(function(){load();},[]);

  async function submitTip(game){
    var pName=loggedInName||player;
    if(!pName){if(typeof toast==='function')toast('Enter your name first');return;}
    var sel=tipped[game.id];
    if(!sel)return;
    await fetch(SPORT_URL+'/nrl/tip?pin='+pin,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({player:pName,season:YEAR,round:draw.round,gameId:game.id,homeTeam:game.homeTeam,awayTeam:game.awayTeam,tip:sel})
    });
    if(typeof toast==='function')toast('Tip saved: '+sel+' ✅');
    setTimeout(load,400);
  }

  var TB2=function(t){return{padding:'5px 12px',border:'none',borderRadius:'7px',cursor:'pointer',fontSize:'12px',fontWeight:tab===t?700:400,background:tab===t?'rgba(108,99,255,.15)':'transparent',color:tab===t?'var(--accent2)':'var(--muted)',marginRight:'4px'};};

  if(loading)return React.createElement('div',{style:{padding:'24px',color:'var(--muted)'}},'⏳ Loading NRL...');

  return React.createElement('div',{style:{flex:1,overflow:'auto',padding:'16px 20px'}},
    React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'10px',marginBottom:'16px',flexWrap:'wrap'}},
      React.createElement('span',{style:{fontSize:'18px',fontWeight:800}},'🏹 NRL '+YEAR),
      draw&&React.createElement('span',{style:{fontSize:'13px',color:'var(--muted)'}},draw.fixtures&&draw.fixtures[0]&&draw.fixtures[0].roundTitle||'Round '+draw.round),
      React.createElement('button',{onClick:load,style:{fontSize:'11px',padding:'3px 9px',background:'var(--input-bg)',border:'1px solid var(--border)',borderRadius:'6px',cursor:'pointer',color:'var(--muted)',marginLeft:'auto'}},'↺ Refresh')
    ),
    React.createElement('div',{style:{marginBottom:'14px'}},
      React.createElement('button',{style:TB2('tips'),onClick:function(){setTab('tips');}},'🎯 My Tips'),
      React.createElement('button',{style:TB2('ladder'),onClick:function(){setTab('ladder');}},'🏆 Leaderboard'),
      React.createElement('button',{style:TB2('standings'),onClick:function(){setTab('standings');}},'🏟 NRL Ladder')
    ),
    tab==='tips'&&React.createElement('div',null,
      !loggedInName&&React.createElement('input',{value:player,onChange:function(e){setPlayer(e.target.value);localStorage.setItem('falkor.sport.player',e.target.value);},placeholder:'Your name',style:{background:'var(--input-bg)',border:'1px solid var(--border)',borderRadius:'8px',padding:'8px 12px',color:'var(--text)',fontSize:'13px',width:'180px',marginBottom:'12px'}}),
      loggedInName&&React.createElement('div',{style:{display:'inline-flex',alignItems:'center',gap:'6px',background:'rgba(108,99,255,.1)',border:'1px solid var(--accent)',borderRadius:'20px',padding:'4px 12px',fontSize:'12px',color:'var(--accent2)',marginBottom:'12px'}},'🎳 ',loggedInName),
      draw&&(draw.fixtures||[]).map(function(game){
        return React.createElement('div',{key:game.id,style:{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px 14px',marginBottom:'8px'}},
          React.createElement('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'8px'}},
            React.createElement('div',{style:{fontSize:'13px',fontWeight:600,minWidth:'60px',textAlign:'center',flex:1}},game.homeTeam,(game.homeScore!==null&&game.homeScore!==undefined)&&React.createElement('span',{style:{fontSize:'12px',color:'var(--muted)',marginLeft:'4px'}},game.homeScore)),
            React.createElement('div',{style:{display:'flex',gap:'6px',flexShrink:0}},
              ['home','away'].map(function(side){
                var teamName=side==='home'?game.homeTeam:game.awayTeam;
                var picked=tipped[game.id]===teamName;
                var correct=game.winner&&game.winner===teamName;
                var wrong=game.winner&&game.winner!==teamName&&picked;
                return React.createElement('button',{key:side,onClick:function(){
                  if(game.matchMode==='Post')return;
                  setTipped(function(p){var n=Object.assign({},p);n[game.id]=teamName;return n;});
                },style:{padding:'5px 10px',borderRadius:'6px',border:'1px solid',fontSize:'11px',cursor:game.matchMode==='Post'?'default':'pointer',fontWeight:picked?700:400,borderColor:correct?'var(--green)':wrong?'var(--red)':picked?'var(--accent)':'var(--border)',background:correct?'rgba(34,197,94,.1)':wrong?'rgba(239,68,68,.1)':picked?'rgba(108,99,255,.12)':'transparent',color:correct?'var(--green)':wrong?'var(--red)':picked?'var(--accent2)':'var(--muted)'}},side==='home'?'←':'',game.matchMode!=='Post'&&(side==='home'?'Home':'Away'));
              })
            ),
            React.createElement('div',{style:{fontSize:'13px',fontWeight:600,minWidth:'60px',textAlign:'center',flex:1}},game.awayTeam,(game.awayScore!==null&&game.awayScore!==undefined)&&React.createElement('span',{style:{fontSize:'12px',color:'var(--muted)',marginLeft:'4px'}},game.awayScore)),
            game.matchMode!=='Post'&&tipped[game.id]&&React.createElement('button',{onClick:function(){submitTip(game);},style:{padding:'4px 10px',background:'var(--accent)',color:'#fff',border:'none',borderRadius:'6px',fontSize:'11px',cursor:'pointer',flexShrink:0}},'Save'),
            game.matchMode==='Post'&&React.createElement('span',{style:{fontSize:'11px',color:'var(--muted)'}},'✔ FT')
          )
        );
      })
    ),
    tab==='ladder'&&React.createElement('div',null,
      lb.length===0&&React.createElement('div',{style:{color:'var(--muted)',fontSize:'13px',padding:'20px 0'}},'No tips scored yet this season.'),
      lb.map(function(row){
        return React.createElement('div',{key:row.player,style:{display:'flex',alignItems:'center',gap:'12px',padding:'10px 14px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'10px',marginBottom:'6px'}},
          React.createElement('span',{style:{fontSize:'16px',fontWeight:700,width:'24px',color:row.rank===1?'#fbbf24':row.rank===2?'#9ca3af':row.rank===3?'#cd7c2f':'var(--muted)'}},row.rank===1?'🥇':row.rank===2?'🥈':row.rank===3?'🥉':row.rank),
          React.createElement('span',{style:{flex:1,fontWeight:600,fontSize:'14px'}},row.player),
          React.createElement('span',{style:{fontSize:'13px',color:'var(--green)',fontWeight:700}},row.correct,React.createElement('span',{style:{fontWeight:400,color:'var(--muted)'}},'/'+row.total)),
          React.createElement('span',{style:{fontSize:'12px',color:'var(--muted)'}},row.pct+'%')
        );
      })
    ),
    tab==='standings'&&React.createElement('div',null,
      standings.length===0&&React.createElement('div',{style:{color:'var(--muted)',fontSize:'13px',padding:'20px 0'}},'⏳ Loading ladder...'),
      React.createElement('div',{style:{overflowX:'auto'}},
        React.createElement('table',{style:{width:'100%',borderCollapse:'collapse',fontSize:'13px'}},
          React.createElement('thead',null,
            React.createElement('tr',null,
              ['#','Team','P','W','L','D','PF','PA','Diff','Pts','Form'].map(function(h){
                return React.createElement('th',{key:h,style:{padding:'6px 8px',textAlign:h==='Team'?'left':'center',color:'var(--muted)',fontWeight:600,borderBottom:'1px solid var(--border)',whiteSpace:'nowrap'}},h);
              })
            )
          ),
          React.createElement('tbody',null,
            standings.map(function(t){
              var diff=t.pointsDiff>0?'+'+t.pointsDiff:t.pointsDiff;
              return React.createElement('tr',{key:t.position,style:{borderBottom:'1px solid var(--border)',background:t.position<=8?'rgba(108,99,255,.03)':'transparent'}},
                React.createElement('td',{style:{padding:'7px 8px',textAlign:'center',fontWeight:700,color:t.position<=8?'var(--accent2)':'var(--muted)'}},t.position),
                React.createElement('td',{style:{padding:'7px 8px',fontWeight:600}},t.team),
                React.createElement('td',{style:{padding:'7px 8px',textAlign:'center'}},t.played),
                React.createElement('td',{style:{padding:'7px 8px',textAlign:'center',color:'var(--green)',fontWeight:600}},t.wins),
                React.createElement('td',{style:{padding:'7px 8px',textAlign:'center',color:'var(--red)'}},t.losses),
                React.createElement('td',{style:{padding:'7px 8px',textAlign:'center'}},t.draws),
                React.createElement('td',{style:{padding:'7px 8px',textAlign:'center'}},t.pointsFor),
                React.createElement('td',{style:{padding:'7px 8px',textAlign:'center'}},t.pointsAgainst),
                React.createElement('td',{style:{padding:'7px 8px',textAlign:'center',color:t.pointsDiff>0?'var(--green)':t.pointsDiff<0?'var(--red)':'var(--muted)'}},diff),
                React.createElement('td',{style:{padding:'7px 8px',textAlign:'center',fontWeight:700}},t.points),
                React.createElement('td',{style:{padding:'7px 8px',textAlign:'center',color:'var(--muted)',fontSize:'12px'}},t.form)
              );
            })
          )
        )
      )
    )
  );
}


function RacingPanel({pin}){
  var [meetings,setMeetings]=React.useState([]);
  var [selMeeting,setSelMeeting]=React.useState(null);
  var [races,setRaces]=React.useState([]);
  var [myTips,setMyTips]=React.useState({});
  var [leaderboard,setLeaderboard]=React.useState([]);
  var [loading,setLoading]=React.useState(true);
  var [tab,setTab]=React.useState('pick');
  var [player,setPlayer]=React.useState(function(){try{var u=JSON.parse(localStorage.getItem('falkor.user')||'null');if(u&&u.name){localStorage.setItem('falkor.sport.player',u.name);return u.name;}}catch{}return localStorage.getItem('falkor.sport.player')||'';});
  var loggedInName=(function(){try{var u=JSON.parse(localStorage.getItem('falkor.user')||'null');return u&&u.name?u.name:null;}catch{return null;}})();
  var today=new Date().toISOString().slice(0,10);
  var RURL='https://falkor-sport.luckdragon.io';
  function rsf(path){var sep=path.includes('?')?'&':'?';return fetch(RURL+path+sep+'pin='+pin).then(function(r){return r.json();});}
  function rLoad(){
    setLoading(true);
    Promise.allSettled([rsf('/racing/meetings?date='+today),rsf('/racing/leaderboard'),rsf('/racing/comp?date='+today)]).then(function(res){
      if(res[0].status==='fulfilled') setMeetings(res[0].value.meetings||[]);
      if(res[1].status==='fulfilled') setLeaderboard(res[1].value.leaderboard||[]);
      if(res[2].status==='fulfilled'){var ex={};(res[2].value.tips||[]).forEach(function(t){if(t.player===player)ex[t.race_id]=t.selection;});setMyTips(ex);}
      setLoading(false);
    });
  }
  function rLoadRaces(m){
    setSelMeeting(m);setRaces([]);
    rsf('/racing/races?date='+today+'&venue='+encodeURIComponent(m.id||m.name)+'&type='+(m.type||'R')).then(function(d){setRaces(d.races||[]);});
  }
  function rPick(raceId,raceName,horse){
    var pName=loggedInName||player;
    if(!pName){alert('Enter your name first');return;}
    if(!loggedInName) localStorage.setItem('falkor.sport.player',pName);
    setMyTips(function(prev){var n=Object.assign({},prev);n[raceId]=horse;return n;});
    fetch(RURL+'/racing/comp/tip?pin='+pin,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({player:pName,date:today,raceId:raceId,raceName:raceName,selection:horse})});
  }
  useEffect(function(){rLoad();},[]);
  var RTB=function(t){return {padding:'6px 14px',border:'none',borderRadius:'7px',cursor:'pointer',fontSize:'13px',fontWeight:tab===t?600:400,background:tab===t?'rgba(108,99,255,.15)':'transparent',color:tab===t?'var(--accent2)':'var(--muted)',marginRight:'4px'};};
  return (
    <div style={{flex:1,overflow:'auto',padding:'16px 20px'}}>
      <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'16px',flexWrap:'wrap'}}>
        <span style={{fontSize:'18px',fontWeight:800}}>Racing Tips</span>
        <span style={{fontSize:'12px',color:'var(--muted)'}}>{today}</span>
        <div style={{marginLeft:'auto'}}>
          {['pick','leaderboard'].map(function(t){return <button key={t} style={RTB(t)} onClick={function(){setTab(t);}}>{t==='pick'?'Pick Tips':'Board'}</button>;})}
        </div>
      </div>
      <div style={{marginBottom:'12px',display:'flex',gap:'8px',alignItems:'center'}}>
        {loggedInName ? <span style={{background:'rgba(108,99,255,.12)',border:'1px solid var(--accent)',borderRadius:'20px',color:'var(--accent2)',padding:'5px 14px',fontSize:'13px',fontWeight:600}}>🏇 {loggedInName}</span> : <input value={player} onChange={function(e){setPlayer(e.target.value);}} onBlur={function(){localStorage.setItem('falkor.sport.player',player);}} placeholder='Your name' style={{background:'var(--input-bg)',border:'1px solid var(--border)',borderRadius:'8px',color:'var(--text)',padding:'7px 12px',fontSize:'13px',width:'160px'}}/>}
        <span style={{fontSize:'12px',color:'var(--muted)'}}>Pick a winner each race</span>
      </div>
      {loading && <div style={{color:'var(--muted)',fontSize:'13px',padding:'20px'}}>Loading meetings...</div>}
      {!loading && tab==='pick' && (
        <div>
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'16px'}}>
            {meetings.length===0 && <div style={{color:'var(--muted)',fontSize:'13px'}}>No race meetings today. Check back on race day!</div>}
            {meetings.map(function(m){return (
              <button key={m.id} onClick={function(){rLoadRaces(m);}} style={{padding:'8px 14px',borderRadius:'8px',border:'2px solid '+(selMeeting&&selMeeting.id===m.id?'var(--accent)':'var(--border)'),background:selMeeting&&selMeeting.id===m.id?'rgba(108,99,255,.15)':'var(--input-bg)',color:'var(--text)',cursor:'pointer',fontSize:'13px'}}>
                {m.type==='R'?'Thoroughbred':m.type==='G'?'Greyhound':m.type==='H'?'Harness':'Race'} - {m.name}
              </button>
            );})}
          </div>
          {selMeeting&&races.length===0 && <div style={{color:'var(--muted)',fontSize:'13px'}}>Loading race card...</div>}
          {races.map(function(race){
            var rId=(selMeeting.id||selMeeting.name)+'_'+(selMeeting.type||'R')+'_'+race.id;
            var myPick=myTips[rId];
            var done=race.status==='Final'||race.status==='Interim'||race.status==='Closed';
            return (
              <div key={race.id} style={{background:'var(--panel)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px 16px',marginBottom:'10px'}}>
                <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px'}}>
                  <span style={{fontWeight:700}}>Race {race.id}</span>
                  {race.name && <span style={{color:'var(--muted)',fontSize:'12px'}}>{race.name}</span>}
                  {race.distance && <span style={{color:'var(--muted)',fontSize:'11px'}}>{race.distance}m</span>}
                  <span style={{marginLeft:'auto',fontSize:'11px',padding:'2px 8px',borderRadius:'20px',background:done?'rgba(34,197,94,.12)':'var(--border)',color:done?'var(--success)':'var(--muted)',fontWeight:600}}>{race.status||'Open'}</span>
                </div>
                {myPick && <div style={{fontSize:'12px',color:'var(--accent2)',marginBottom:'6px'}}>Your pick: <strong>{myPick}</strong></div>}
                <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
                  {race.runners.length===0 && <div style={{color:'var(--muted)',fontSize:'12px'}}>Runners not yet available</div>}
                  {race.runners.map(function(r){return (
                    <button key={r.num} onClick={function(){if(!done)rPick(rId,race.name||('Race '+race.id),r.name);}} style={{padding:'6px 12px',borderRadius:'8px',border:'2px solid '+(myPick===r.name?'var(--accent)':'var(--border)'),background:myPick===r.name?'rgba(108,99,255,.15)':'var(--input-bg)',color:'var(--text)',cursor:done?'default':'pointer',fontSize:'12px',fontWeight:myPick===r.name?700:400}}>
                      <span style={{color:'var(--muted)'}}>{r.num}. </span>{r.name}
                    </button>
                  );})}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!loading && tab==='leaderboard' && (
        <div>
          {leaderboard.length===0 && <div style={{color:'var(--muted)',fontSize:'13px'}}>No results yet - get your tips in on race day!</div>}
          {leaderboard.length>0 && (
            <table className="sport-table">
              <thead><tr><th>#</th><th>Player</th><th style={{textAlign:'center'}}>Wins</th><th style={{textAlign:'center'}}>Tips</th><th style={{textAlign:'center'}}>Days</th><th style={{textAlign:'center'}}>%</th></tr></thead>
              <tbody>{leaderboard.map(function(p,i){return (
                <tr key={p.player} style={{fontWeight:p.player===player?700:400}}>
                  <td style={{color:'var(--muted)'}}>{i+1}</td>
                  <td>{p.player}{p.player===player && ' You'}</td>
                  <td style={{textAlign:'center',color:'var(--success)',fontWeight:600}}>{p.wins}</td>
                  <td style={{textAlign:'center'}}>{p.total}</td>
                  <td style={{textAlign:'center',color:'var(--muted)'}}>{p.days}</td>
                  <td style={{textAlign:'center',color:'var(--muted)'}}>{p.pct}%</td>
                </tr>
              );})}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function SportPanel({ pin, initialTab, onLiveCount }) {
  const [ladder, setLadder] = useState(null);
  const [games, setGames] = useState([]);
  const [tips, setTips] = useState([]);
  const [comp, setComp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(initialTab || 'ladder');
  const [rnd, setRnd] = useState(8);
  const [player, setPlayer] = useState(() => localStorage.getItem('falkor.sport.player') || '');
  const [tipped, setTipped] = useState({});
  const YEAR = 2026;

  async function sf(path) {
    const sep = path.includes('?') ? '&' : '?';
    const res = await fetch(SPORT_URL + path + sep + 'pin=' + pin);
    return res.json();
  }
  async function load() {
    setLoading(true);
    const [l, g, t, c] = await Promise.allSettled([
      sf('/afl/ladder?year=' + YEAR),
      sf('/afl/round?year=' + YEAR + '&round=' + rnd),
      sf('/afl/tips?year=' + YEAR + '&round=' + rnd),
      sf('/afl/comp?year=' + YEAR + '&round=' + rnd),
    ]);
    if (l.status === 'fulfilled') setLadder(Array.isArray(l.value) ? l.value : l.value?.ladder || []);
    if (g.status === 'fulfilled') setGames(Array.isArray(g.value) ? g.value : g.value?.games || []);
    if (t.status === 'fulfilled') setTips(Array.isArray(t.value) ? t.value : t.value?.tips || []);
    if (c.status === 'fulfilled') setComp(c.value?.error ? null : c.value);
    setLoading(false);
  }
  useEffect(() => { load(); }, [rnd]);
  const [liveCount, setLiveCount] = React.useState(0);
  useEffect(() => {
    const lc = games.filter(g => g.status === 'live').length;
    setLiveCount(lc);
    if (onLiveCount) onLiveCount(lc);
    if (!lc) return;
    const iv = setInterval(load, 90000);
    return () => clearInterval(iv);
  }, [games]);

  async function tip(gameId, team) {
    if (!player) { toast('Enter your name first'); return; }
    localStorage.setItem('falkor.sport.player', player);
    await fetch(SPORT_URL + '/afl/comp/tip?pin=' + pin, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ player, round:rnd, gameId, tip:team }),
    });
    setTipped(p => ({ ...p, [gameId]:team }));
    setTimeout(load, 500);
  }

  const TB = (t) => ({
    padding:'6px 14px', border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'13px', fontWeight:tab===t?600:400,
    background: tab === t ? 'rgba(108,99,255,.15)' : 'transparent',
    color: tab === t ? 'var(--accent2)' : 'var(--muted)',
    marginRight:'4px', transition:'background .1s,color .1s',
  });

  return (
    <div style={{ flex:1, overflow:'auto', padding:'16px 20px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px', flexWrap:'wrap' }}>
        <span style={{ fontSize:'18px', fontWeight:800 }}>🏈 AFL {YEAR}</span>
        <span style={{ color:'var(--muted)', fontSize:'13px' }}>Round</span>
        <select value={rnd} onChange={e => setRnd(Number(e.target.value))} style={{ background:'var(--input-bg)', border:'1px solid var(--border)', borderRadius:'7px', color:'var(--text)', padding:'4px 8px', fontSize:'13px' }}>
          {Array.from({ length:24 }, (_, i) => i + 1).map(r => <option key={r} value={r}>R{r}</option>)}
        </select>
        <button onClick={load} style={{ background:'var(--border)', border:'none', borderRadius:'7px', color:'var(--text)', padding:'5px 10px', cursor:'pointer', fontSize:'14px' }}>↻</button>
        <div style={{ marginLeft:'auto', display:'flex', flexWrap:'wrap' }}>
          {['ladder','results','tips','comp'].map(t => <button key={t} style={TB(t)} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>)}
        </div>
      </div>

      {loading && <div style={{ color:'var(--muted)', fontSize:'13px', padding:'20px' }}>Loading…</div>}

      {!loading && tab === 'ladder' && ladder && (
        <table className="sport-table">
          <thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>D</th><th>Pts</th><th>%</th></tr></thead>
          <tbody>{ladder.map((t, i) => (
            <tr key={t.team} style={{ background:i < 8 ? 'rgba(108,99,255,.04)' : 'transparent' }}>
              <td style={{ color:'var(--muted)', fontWeight:500 }}>{t.rank}</td>
              <td style={{ fontWeight:i < 8 ? 700 : 400 }}>{t.team}</td>
              <td style={{ textAlign:'center', color:'var(--success)', fontWeight:600 }}>{t.wins}</td>
              <td style={{ textAlign:'center', color:'var(--danger)' }}>{t.losses}</td>
              <td style={{ textAlign:'center', color:'var(--muted)' }}>{t.draws}</td>
              <td style={{ textAlign:'center', fontWeight:700 }}>{t.points}</td>
              <td style={{ textAlign:'center', color:'var(--muted)' }}>{t.percentage}%</td>
            </tr>
          ))}</tbody>
        </table>
      )}

      {!loading && tab === 'results' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {games.map(g => (
            <div key={g.id} style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:'10px', padding:'12px 16px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px', justifyContent:'space-between', flexWrap:'wrap' }}>
                <div style={{ display:'flex', gap:'12px', alignItems:'center', flex:1 }}>
                  <span style={{ fontWeight:g.winner===g.home?700:400, flex:1, textAlign:'right' }}>{g.home}</span>
                  <span style={{ color:'var(--muted)', fontSize:'12px', flexShrink:0 }}>{g.status==='upcoming'?'vs':g.homeScore+' – '+g.awayScore}</span>
                  <span style={{ fontWeight:g.winner===g.away?700:400, flex:1 }}>{g.away}</span>
                </div>
                <span style={{ fontSize:'11px', padding:'3px 8px', borderRadius:'20px', flexShrink:0,
                  background:g.status==='final'?'rgba(34,197,94,.12)':g.status==='live'?'rgba(245,158,11,.12)':'var(--border)',
                  color:g.status==='final'?'var(--success)':g.status==='live'?'var(--warning)':'var(--muted)', fontWeight:600 }}>
                  {g.status === 'live' ? React.createElement('span',{style:{color:'var(--danger)',fontWeight:700}},'LIVE') : g.status==='final'?'Final':g.date?.slice(0,10)||'TBC'}
                </span>
              </div>
              {g.venue && <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'4px' }}>📍 {g.venue}</div>}
            </div>
          ))}
        </div>
      )}

      {!loading && tab === 'tips' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          <div style={{ fontSize:'12px', color:'var(--muted)', marginBottom:'4px' }}>AI model tips — Round {rnd}</div>
          {tips.length === 0 && <div style={{ color:'var(--muted)', fontSize:'13px' }}>No tips available yet for Round {rnd}</div>}
          {tips.map((t, i) => (
            <div key={i} style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:'10px', padding:'12px 16px', display:'flex', alignItems:'center', gap:'12px' }}>
              <span style={{ fontWeight:700, flex:1 }}>{t.tip}</span>
              <span style={{ color:'var(--muted)', fontSize:'12px' }}>vs {t.opponent}</span>
              <span style={{ background:t.confidence>70?'rgba(34,197,94,.12)':t.confidence>55?'rgba(245,158,11,.12)':'rgba(239,68,68,.12)', borderRadius:'20px', padding:'3px 10px', fontSize:'12px', color:t.confidence>70?'var(--success)':t.confidence>55?'var(--warning)':'var(--danger)', fontWeight:600 }}>{t.confidence}%</span>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === 'comp' && (
        <div>
          <div style={{ marginBottom:'16px', display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
            <input value={player} onChange={e => setPlayer(e.target.value)} onBlur={() => localStorage.setItem('falkor.sport.player', player)}
              placeholder="Your name" style={{ background:'var(--input-bg)', border:'1px solid var(--border)', borderRadius:'8px', color:'var(--text)', padding:'7px 12px', fontSize:'13px', width:'160px' }}/>
            <span style={{ fontSize:'12px', color:'var(--muted)' }}>Tip Round {rnd} winners</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'24px' }}>
            {games.map(g => {
              const myTip = tipped[g.id] || comp?.players?.[player]?.tips?.find(t => t.gameId===String(g.id))?.tip;
              const done = g.status === 'final';
              return (
                <div key={g.id} style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:'10px', padding:'12px 16px' }}>
                  <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                    {[g.home, g.away].map((team, ti) => (
                      <React.Fragment key={team}>
                        {ti > 0 && <span style={{ color:'var(--muted)', fontSize:'12px', flexShrink:0 }}>vs</span>}
                        <button onClick={() => !done && tip(String(g.id), team)} style={{ flex:1, padding:'8px', borderRadius:'8px', cursor:done?'default':'pointer', fontSize:'13px', border:'2px solid '+(myTip===team?'var(--accent)':'var(--border)'), background:myTip===team?'rgba(108,99,255,.15)':'var(--input-bg)', color:'var(--text)', fontWeight:myTip===team?700:400 }}>{team}</button>
                      </React.Fragment>
                    ))}
                    {done && myTip && <span style={{ fontSize:'14px', flexShrink:0, color:g.winner===myTip?'var(--success)':'var(--danger)' }}>{g.winner===myTip?'✓':'✗'}</span>}
                  </div>
                  {done && <div style={{ fontSize:'11px', color:'var(--muted)', marginTop:'4px' }}>Final: {g.home} {g.homeScore} – {g.awayScore} {g.away}</div>}
                </div>
              );
            })}
          </div>
          {comp?.season?.length > 0 && (
            <div>
              <div style={{ fontWeight:700, marginBottom:'10px', fontSize:'14px' }}>🏆 Season {YEAR} Leaderboard</div>
              <table className="sport-table">
                <thead><tr><th>#</th><th>Player</th><th style={{textAlign:'center'}}>Correct</th><th style={{textAlign:'center'}}>Total</th><th style={{textAlign:'center'}}>%</th></tr></thead>
                <tbody>{comp.season.map((p, i) => (
                  <tr key={p.player}>
                    <td style={{ color:'var(--muted)' }}>{i + 1}</td>
                    <td style={{ fontWeight:p.player===player?700:400 }}>{p.player}{p.player===player?' 👤':''}</td>
                    <td style={{ textAlign:'center', color:'var(--success)', fontWeight:600 }}>{p.correct}</td>
                    <td style={{ textAlign:'center' }}>{p.total}</td>
                    <td style={{ textAlign:'center', color:'var(--muted)' }}>{p.pct}%</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {!comp?.season?.length && <div style={{ color:'var(--muted)', fontSize:'13px' }}>No tips submitted yet — be the first!</div>}
        </div>
      )}
    </div>
  );
}

// ─── SitesPanel ───────────────────────────────────────────────────────────────
function SitesPanel() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch('https://falkor-dashboard.luckdragon.io/api/projects')
      .then(r => r.json())
      .then(d => { setProjects(d.projects || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const CATS = ['all', ...[...new Set(projects.map(p => p.category).filter(Boolean))]];
  const live = projects.filter(p => {
    const q = search.toLowerCase();
    return (!q || (p.name||'').toLowerCase().includes(q) || (p.desc||'').toLowerCase().includes(q))
      && (filter === 'all' || p.category === filter);
  });

  const statusColor = s => s==='live'?'#22c55e':s==='building'?'#f59e0b':s==='idea'?'#a78bfa':'#72728a';

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'16px', background:'var(--bg)' }}>
      <div style={{ marginBottom:'12px', display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sites…"
          style={{ flex:1, minWidth:'160px', padding:'7px 12px', borderRadius:'8px', border:'1px solid var(--border)', background:'var(--panel)', color:'var(--text)', fontSize:'13px', outline:'none' }}/>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          style={{ padding:'7px 10px', borderRadius:'8px', border:'1px solid var(--border)', background:'var(--panel)', color:'var(--text)', fontSize:'13px', outline:'none' }}>
          {CATS.map(c => <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>)}
        </select>
      </div>
      {loading && <p style={{ color:'var(--muted)', textAlign:'center', marginTop:'40px' }}>Loading sites…</p>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'12px' }}>
        {live.map(p => (
          <div key={p.id || p.name} style={{ background:'var(--panel)', borderRadius:'12px', padding:'14px', border:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:'8px', transition:'border-color .15s' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px' }}>
              <span style={{ fontWeight:700, fontSize:'14px', lineHeight:'1.3' }}>{p.name}</span>
              <span style={{ fontSize:'11px', padding:'2px 8px', borderRadius:'20px', background:statusColor(p.status)+'20', color:statusColor(p.status), whiteSpace:'nowrap', flexShrink:0, fontWeight:600 }}>{p.status||'?'}</span>
            </div>
            {p.desc && <p style={{ fontSize:'12px', color:'var(--muted)', margin:0, lineHeight:'1.5' }}>{p.desc}</p>}
            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginTop:'auto', paddingTop:'4px' }}>
              {p.url && <a href={p.url} target="_blank" rel="noopener" style={{ fontSize:'12px', padding:'4px 10px', borderRadius:'6px', background:'var(--accent)', color:'#fff', textDecoration:'none', fontWeight:600 }}>🌐 Visit</a>}
              {p.github && <a href={p.github} target="_blank" rel="noopener" style={{ fontSize:'12px', padding:'4px 10px', borderRadius:'6px', background:'var(--border)', color:'var(--text)', textDecoration:'none' }}>GitHub</a>}
              {!p.url && !p.github && <span style={{ fontSize:'11px', color:'var(--muted)', fontStyle:'italic' }}>No links yet</span>}
            </div>
          </div>
        ))}
      </div>
      {!loading && live.length === 0 && <p style={{ color:'var(--muted)', textAlign:'center', marginTop:'40px' }}>No matches</p>}
    </div>
  );
}

// ─── CalendarPanel ────────────────────────────────────────────────────────────
function CalendarPanel({ pin }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('upcoming'); // upcoming | today | week

  useEffect(() => {
    setLoading(true);
    setError(null);
    const path = view === 'today' ? '/today' : view === 'week' ? '/week' : '/upcoming';
    fetch(CALENDAR_URL + path, { headers: { 'X-Pin': pin } })
      .then(r => r.json())
      .then(d => { setEvents(d.events || d || []); setLoading(false); })
      .catch(err => { setError('Could not load calendar'); setLoading(false); });
  }, [view, pin]);

  function formatTime(ts) {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleTimeString('en-AU', { hour:'2-digit', minute:'2-digit', hour12:true });
    } catch { return ts; }
  }
  function formatDate(ts) {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      const today = new Date();
      const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
      if (d.toDateString() === today.toDateString()) return 'Today';
      if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
      return d.toLocaleDateString('en-AU', { weekday:'long', month:'short', day:'numeric' });
    } catch { return ts; }
  }

  // Group events by day
  const grouped = useMemo(() => {
    if (!Array.isArray(events)) return [];
    const groups = {};
    events.forEach(ev => {
      const key = formatDate(ev.start || ev.date || ev.time);
      if (!groups[key]) groups[key] = [];
      groups[key].push(ev);
    });
    return Object.entries(groups);
  }, [events]);

  const TB = t => ({
    padding:'6px 14px', border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'13px', fontWeight:view===t?600:400,
    background:view===t?'rgba(108,99,255,.15)':'transparent',
    color:view===t?'var(--accent2)':'var(--muted)', transition:'background .1s', marginRight:'4px',
  });

  return (
    <div style={{ flex:1, overflow:'auto', padding:'16px 20px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px', flexWrap:'wrap' }}>
        <span style={{ fontSize:'18px', fontWeight:800 }}>📅 Calendar</span>
        <div style={{ marginLeft:'auto' }}>
          {['today','upcoming','week'].map(t => <button key={t} style={TB(t)} onClick={() => setView(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>)}
        </div>
      </div>

      {loading && <div style={{ color:'var(--muted)', fontSize:'13px', padding:'20px' }}>Loading events…</div>}
      {error && <div style={{ color:'var(--muted)', fontSize:'13px', padding:'20px', textAlign:'center' }}>
        <div style={{ fontSize:32, marginBottom:8 }}>📅</div>
        <div>{error}</div>
        <div style={{ fontSize:'12px', marginTop:4 }}>Make sure your calendar is connected at falkor-calendar.luckdragon.io</div>
      </div>}

      {!loading && !error && grouped.length === 0 && (
        <div style={{ color:'var(--muted)', fontSize:'13px', textAlign:'center', padding:'40px 0' }}>
          <div style={{ fontSize:32, marginBottom:8 }}>🎉</div>
          Nothing scheduled {view === 'today' ? 'today' : 'upcoming'}
        </div>
      )}

      {!loading && !error && grouped.map(([day, dayEvents]) => (
        <div key={day} style={{ marginBottom:'20px' }}>
          <div className="cal-day-header">{day}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {dayEvents.map((ev, i) => (
              <div key={i} className="cal-event">
                {(ev.start || ev.time) && <div className="cal-event-time">{formatTime(ev.start || ev.time)}{ev.end && ' – ' + formatTime(ev.end)}</div>}
                <div className="cal-event-title">{ev.title || ev.summary || ev.name || 'Event'}</div>
                {ev.description && <div className="cal-event-desc">{ev.description}</div>}
                {ev.location && <div className="cal-event-desc">📍 {ev.location}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── HistoryPanel ─────────────────────────────────────────────────────────────
function HistoryPanel({ convos, onOpen }) {
  const [search, setSearch] = React.useState('');
  const filtered = search
    ? convos.filter(c =>
        (c.title||'').toLowerCase().includes(search.toLowerCase()) ||
        (c.messages||[]).some(m => (m.content||'').toLowerCase().includes(search.toLowerCase()))
      )
    : convos;
  const grouped = filtered.reduce((acc, c) => {
    const d = new Date(c.ts || Date.now());
    const today = new Date(); const yesterday = new Date(today); yesterday.setDate(today.getDate()-1);
    let key;
    if (d.toDateString() === today.toDateString()) key = 'Today';
    else if (d.toDateString() === yesterday.toDateString()) key = 'Yesterday';
    else key = d.toLocaleDateString('en-AU', { weekday:'long', month:'short', day:'numeric' });
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});
  return (
    <div style={{ flex:1, overflow:'auto', padding:'16px 20px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px' }}>
        <span style={{ fontSize:'18px', fontWeight:800 }}>📖 History</span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations…"
          style={{ flex:1, padding:'7px 12px', borderRadius:'8px', border:'1px solid var(--border)', background:'var(--panel)', color:'var(--text)', fontSize:'13px', outline:'none' }}/>
      </div>
      {filtered.length === 0 && <div style={{ color:'var(--muted)', textAlign:'center', padding:'40px 0' }}>No conversations found</div>}
      {Object.entries(grouped).map(([day, dayConvos]) => (
        <div key={day} style={{ marginBottom:'20px' }}>
          <div style={{ fontSize:'12px', color:'var(--muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', padding:'12px 0 8px', borderBottom:'1px solid var(--border)', marginBottom:'10px' }}>{day}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
            {dayConvos.map(c => {
              const lastMsg = (c.messages||[]).slice(-1)[0];
              const preview = (lastMsg?.content||'No messages').slice(0,80);
              const count = (c.messages||[]).length;
              return (
                <div key={c.id} onClick={() => onOpen(c.id)}
                  style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:'10px', padding:'12px 16px', cursor:'pointer', transition:'border-color .15s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor='var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px', marginBottom:'4px' }}>
                    <span style={{ fontWeight:600, fontSize:'14px' }}>{c.title || 'New chat'}</span>
                    <span style={{ fontSize:'11px', color:'var(--muted)', flexShrink:0 }}>{count} msgs</span>
                  </div>
                  <div style={{ fontSize:'12px', color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{preview}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── MessageBubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg }) {
  const time = msg.ts ? new Date(msg.ts).toLocaleTimeString('en-AU', { hour:'2-digit', minute:'2-digit', hour12:true }) : '';
  return (
    <div className={'msg-row ' + msg.role}>
      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
        <div className="msg-role">{msg.role === 'user' ? 'You' : '🐉 Falkor'}</div>
        {time && <div className="msg-timestamp">{time}</div>}
      </div>
      {msg.imageData && (
        <div className="msg-bubble" style={{ padding:'6px' }}>
          <img src={msg.imageData} alt="attached" style={{ maxWidth:'260px', maxHeight:'200px', borderRadius:'8px', display:'block' }}/>
        </div>
      )}
      {msg.content && <div className="msg-bubble" dangerouslySetInnerHTML={{ __html: renderMD(msg.content || '') }}/>}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="msg-row assistant">
      <div className="msg-role">🐉 Falkor</div>
      <div className="msg-bubble" style={{ padding:'12px 16px' }}>
        <span className="typing-dot"/><span className="typing-dot"/><span className="typing-dot"/>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('falkor.user') || 'null'); } catch { return null; } });
  const [view, setView] = useState('chat');
  const [convos, setConvos] = useState(LS.convos);
  const [activeId, setActiveId] = useState(() => localStorage.getItem('falkor.activeId') || '');
  const [model, setModelS] = useState(LS.model);
  const [theme, setThemeS] = useState(LS.theme);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [wsState, setWsState] = useState('disconnected');
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [voiceEnabled, setVoiceEnabledS] = useState(LS.voice);
  const [showVoice, setShowVoice] = useState(false);
  const [voiceState, setVoiceState] = useState('idle');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceReply, setVoiceReply] = useState('');
  const [drivingMode, setDrivingMode] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');

  const analyserRef      = useRef(null);
  const audioCtxRef      = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const silenceTimerRef  = useRef(null);
  const wsRef            = useRef(null);
  const endRef           = useRef(null);
  const taRef            = useRef(null);
  const reconnTimer      = useRef(null);
  const voiceEnabledRef  = useRef(voiceEnabled);
  const showVoiceRef     = useRef(showVoice);
  const drivingModeRef   = useRef(drivingMode);
  const activeIdRef      = useRef(activeId);
  const streamTimerRef   = useRef(null);

  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);
  useEffect(() => { showVoiceRef.current = showVoice; }, [showVoice]);
  useEffect(() => { drivingModeRef.current = drivingMode; }, [drivingMode]);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  const activeConvo = convos.find(c => c.id === activeId);
  const filteredConvos = sidebarSearch ? convos.filter(c => (c.title||'').toLowerCase().includes(sidebarSearch.toLowerCase())) : convos;

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); LS.setTheme(theme); }, [theme]);
  useEffect(() => { LS.setConvos(convos); }, [convos]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }); }, [convos, typing]);
  useEffect(() => { if (user && convos.length === 0) newConvo(); }, [user]);

  // Intent URL param handler
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const intent = params.get('intent');
    if (!intent) return;
    window.history.replaceState({}, '', '/');
    if (intent === 'afl' || intent === 'sport') setView('sport');
    else if (intent === 'tips') setView('tips');
    else if (intent === 'history') setView('history');
    else if (intent === 'briefing') { setView('chat'); setTimeout(() => sendMessage("Give me today's briefing", null), 600); }
    else if (intent === 'trivia') { setView('chat'); setTimeout(() => sendMessage("Let's play KBT trivia", null), 600); }
  }, [user]);

  useEffect(() => {
    const handler = () => toast('📨 Queued messages sent!');
    window.addEventListener('falkor-sync-complete', handler);
    return () => window.removeEventListener('falkor-sync-complete', handler);
  }, []);
  useEffect(() => { localStorage.setItem('falkor.activeId', activeId); }, [activeId]);

  useEffect(() => {
    if (drivingMode) { setTimeout(startListening, 400); } else { stopRecording(); }
  }, [drivingMode]);

  // ── WebSocket ──
  const connectWS = useCallback(() => {
    if (!user || (!LS.pin() && !LS.agentPin())) return;
    if (wsRef.current && wsRef.current.readyState < 2) return;
    setWsState('connecting');
    const ws = new WebSocket(AGENT_URL.replace('https://','wss://') + '/?pin=' + (LS.agentPin() || LS.pin()));
    wsRef.current = ws;
    ws.onopen  = () => { setWsState('connected'); clearTimeout(reconnTimer.current); };
    ws.onmessage = evt => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'assistant_reply') {
          setTyping(false);
          const fullText = msg.text || '';
          const msgId = uid();
          const cid = activeIdRef.current;
          setConvos(prev => prev.map(c => c.id === cid ? { ...c, messages:[...(c.messages||[]), { id:msgId, role:'assistant', content:'', ts:Date.now() }] } : c));
          let i = 0;
          if (streamTimerRef.current) clearInterval(streamTimerRef.current);
          streamTimerRef.current = setInterval(() => {
            i++;
            setConvos(prev => prev.map(c => c.id === cid ? { ...c, messages:(c.messages||[]).map(m => m.id === msgId ? { ...m, content:fullText.slice(0,i) } : m) } : c));
            if (i >= fullText.length) {
              clearInterval(streamTimerRef.current); streamTimerRef.current = null;
              if (drivingModeRef.current) { setVoiceReply(fullText); speakText(fullText); }
              else if (voiceEnabledRef.current && !showVoiceRef.current) speakText(fullText);
            }
          }, 18);
        }
      } catch {}
    };
    ws.onclose = () => { setWsState('disconnected'); setTyping(false); reconnTimer.current = setTimeout(connectWS, 3000); };
    ws.onerror = () => ws.close();
  }, [user]);

  useEffect(() => { if (user) connectWS(); return () => { clearTimeout(reconnTimer.current); wsRef.current?.close(); }; }, [user]);

  // ── Wake word ──
  useEffect(() => {
    if (!user) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const recog = new SR();
    recog.continuous = true; recog.interimResults = false; recog.lang = 'en-AU';
    recog.onresult = e => {
      const t = Array.from(e.results).slice(-1)[0]?.[0]?.transcript?.toLowerCase() || '';
      if (t.includes('hey falkor') && !showVoiceRef.current && !drivingModeRef.current) {
        setShowVoice(true); toast("🐉 Hey! I'm listening…");
      }
    };
    recog.onerror = () => {}; recog.onend = () => { try { recog.start(); } catch {} };
    try { recog.start(); } catch {}
    return () => { try { recog.stop(); } catch {}; };
  }, [user]);

  // ── speakText ──
  async function speakText(text) {
    try {
      setVoiceState('speaking');
      const res = await fetch(AI_URL + '/speak', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ text, model:'tts-1', voice:'nova' }),
      });
      if (!res.ok) { setVoiceState('idle'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      try {
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') audioCtxRef.current = new AudioContext();
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') await ctx.resume();
        const analyser = ctx.createAnalyser(); analyser.fftSize = 256; analyserRef.current = analyser;
        const src = ctx.createMediaElementSource(audio); src.connect(analyser); analyser.connect(ctx.destination);
      } catch {}
      audio.onended = () => { setVoiceState('idle'); URL.revokeObjectURL(url); if (drivingModeRef.current) setTimeout(() => { if (drivingModeRef.current) startListening(); }, 600); };
      audio.onerror = () => { setVoiceState('idle'); if (drivingModeRef.current) setTimeout(() => { if (drivingModeRef.current) startListening(); }, 600); };
      audio.play().catch(() => { setVoiceState('idle'); if (drivingModeRef.current) setTimeout(() => { if (drivingModeRef.current) startListening(); }, 600); });
    } catch { setVoiceState('idle'); if (drivingModeRef.current) setTimeout(() => { if (drivingModeRef.current) startListening(); }, 600); }
  }

  // ── startListening ──
  async function startListening() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();
      const analyser = ctx.createAnalyser(); analyser.fftSize = 256; analyserRef.current = analyser;
      const src = ctx.createMediaStreamSource(stream); src.connect(analyser);
      const mr = new MediaRecorder(stream, { mimeType:'audio/webm' });
      mediaRecorderRef.current = mr; chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setVoiceState('processing');
        const blob = new Blob(chunksRef.current, { type:'audio/webm' });
        try {
          const fd = new FormData(); fd.append('audio', blob, 'audio.webm');
          const res = await fetch(AI_URL + '/stt', { method:'POST', body:fd });
          const data = await res.json();
          const text = (data.text || data.transcript || '').trim();
          if (text) { setVoiceTranscript(text); sendMessage(text, null); setVoiceState('idle'); }
          else { setVoiceState('idle'); if (drivingModeRef.current) setTimeout(() => { if (drivingModeRef.current) startListening(); }, 500); }
        } catch { setVoiceState('idle'); if (drivingModeRef.current) setTimeout(() => { if (drivingModeRef.current) startListening(); }, 500); }
      };
      mr.start(); setVoiceState('listening'); setVoiceTranscript(''); setVoiceReply('');
      const detect = () => {
        if (!mr || mr.state !== 'recording') return;
        const d2 = new Uint8Array(analyser.frequencyBinCount); analyser.getByteFrequencyData(d2);
        const avg = d2.reduce((a, b) => a + b, 0) / d2.length;
        if (avg < 4) {
          if (!silenceTimerRef.current) silenceTimerRef.current = setTimeout(() => { if (mr.state === 'recording') mr.stop(); silenceTimerRef.current = null; }, 1800);
        } else { if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; } }
        if (mr.state === 'recording') requestAnimationFrame(detect);
      };
      requestAnimationFrame(detect);
    } catch { toast('Microphone access denied'); setVoiceState('idle'); }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') { try { mediaRecorderRef.current.stop(); } catch {} }
    clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null;
  }

  function handleMicClick() { if (voiceState === 'listening') stopRecording(); else startListening(); }

  // ── sendMessage ──
  function sendMessage(text, fileContent) {
    if (!text.trim() && !fileContent) return;
    if (wsRef.current?.readyState !== 1) { toast('Reconnecting…'); return; }
    let cid = activeIdRef.current;
    const exists = convos.find(c => c.id === cid);
    if (!cid || !exists) {
      cid = uid();
      const nc = { id:cid, title:text.slice(0,40), messages:[], ts:Date.now() };
      setConvos(prev => [nc, ...prev]);
      setActiveId(cid); activeIdRef.current = cid;
    }
    const m = { id:uid(), role:'user', content:text, ts:Date.now() };
    setConvos(prev => prev.map(c => c.id === cid ? { ...c, messages:[...(c.messages||[]), m], title:c.title||text.slice(0,40) } : c));
    setInput(''); setAttachment(null); setTyping(true);
    wsRef.current.send(JSON.stringify({ type:'chat', text:text, content:text, model, userId:LS.userId(), ...(fileContent ? {file:fileContent} : {}) }));
  }

  async function doSend() {
    if (!input.trim() && !attachment) return;

    // ── Image attachment → vision endpoint ──────────────────────────────────
    if (attachment && attachment.type && attachment.type.startsWith('image/')) {
      const userText = input.trim() || 'What is this?';
      const imageDataUrl = await new Promise((res, rej) => {
        const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(attachment);
      }).catch(() => null);
      if (!imageDataUrl) { toast('Could not read image'); return; }

      // Strip data: prefix to get raw base64
      const b64 = imageDataUrl.split(',')[1];
      const mime = attachment.type;

      // Add user message with image to chat
      let cid = activeIdRef.current;
      const exists = convos.find(c => c.id === cid);
      if (!cid || !exists) {
        cid = uid();
        const nc = { id:cid, title:userText.slice(0,40), messages:[], ts:Date.now() };
        setConvos(prev => [nc, ...prev]);
        setActiveId(cid); activeIdRef.current = cid;
      }
      const userMsg = { id:uid(), role:'user', content:userText, imageData:imageDataUrl, ts:Date.now() };
      setConvos(prev => prev.map(c => c.id === cid
        ? { ...c, messages:[...(c.messages||[]), userMsg], title:c.title||userText.slice(0,40) } : c));
      setInput(''); setAttachment(null); setTyping(true);

      // Call vision endpoint
      try {
        const res = await fetch(AGENT_URL + '/vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Pin': LS.agentPin() || LS.pin() },
          body: JSON.stringify({ image_b64: b64, mime_type: mime, prompt: userText, userId: LS.userId() })
        });
        const d = await res.json().catch(() => ({}));
        const reply = d.reply || d.content || (d.ok === false ? 'Vision unavailable — ' + (d.error || 'unknown error') : 'No response');
        const botMsg = { id:uid(), role:'assistant', content:reply, ts:Date.now() };
        setConvos(prev => prev.map(c => c.id === cid
          ? { ...c, messages:[...(c.messages||[]), botMsg] } : c));
      } catch (e) {
        const errMsg = { id:uid(), role:'assistant', content:'Vision error: ' + e.message, ts:Date.now() };
        setConvos(prev => prev.map(c => c.id === cid
          ? { ...c, messages:[...(c.messages||[]), errMsg] } : c));
      }
      setTyping(false);
      return;
    }

    // ── Regular text or non-image file → WebSocket ──────────────────────────
    let fc = null;
    if (attachment) fc = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(attachment); }).catch(() => null);
    sendMessage(input, fc);
  }

  function newConvo() {
    const id = uid();
    setConvos(prev => [{ id, title:'', messages:[], ts:Date.now() }, ...prev]);
    setActiveId(id); activeIdRef.current = id; setSidebarOpen(false);
  }

  function deleteConvo(id) {
    setConvos(prev => prev.filter(c => c.id !== id));
    if (activeId === id) {
      const rem = convos.filter(c => c.id !== id);
      if (rem.length) setActiveId(rem[0].id);
      else { const nid = uid(); setConvos([{ id:nid, title:'', messages:[], ts:Date.now() }]); setActiveId(nid); }
    }
  }

  function handleDrop(e) { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) setAttachment(f); }
  function handleFileInput(e) { const f = e.target.files[0]; if (f) setAttachment(f); e.target.value = ''; }

  if (!user) return <UserSelectScreen onLogin={u => { localStorage.setItem('falkor.user', JSON.stringify(u)); setUser(u); }}/>;

  return (
    <div className="app">

      {/* Driving mode overlay */}
      {drivingMode && (
        <div className="driving-overlay">
          <button className="driving-exit" onClick={() => setDrivingMode(false)}>✕ Exit Driving Mode</button>
          <div className="driving-dragon">🐉</div>
          <div className="driving-name">Falkor</div>
          <VoiceWaveform analyserRef={analyserRef} active={voiceState==='listening'||voiceState==='speaking'}/>
          <div className="driving-status">{voiceState==='listening'?'🔴 Listening…':voiceState==='processing'?'⚙️ Thinking…':voiceState==='speaking'?'🔊 Speaking…':'Tap to speak'}</div>
          {voiceTranscript ? <div className="driving-transcript">"{voiceTranscript}"</div> : null}
          {voiceReply ? <div className="driving-reply">{voiceReply}</div> : null}
          <button className={'driving-mic '+(voiceState==='listening'?'listening':voiceState==='speaking'?'speaking':'')}
            onClick={handleMicClick} disabled={voiceState==='processing'||voiceState==='speaking'}>
            {voiceState==='listening'?'⏹':voiceState==='speaking'?'🔊':'🎤'}
          </button>
        </div>
      )}

      {/* Sidebar scrim */}
      {sidebarOpen && <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)}/>}

      {/* Sidebar */}
      <aside className={'sidebar' + (sidebarOpen ? ' open' : '')}>
        <div className="sidebar-top">
          <span className="logo-text">🐉 Falkor</span>
          <button className="icon-btn" onClick={() => setSidebarOpen(false)} style={{display:'none'}} id="sidebar-close">✕</button>
        </div>
        <button className="btn new-chat-btn" onClick={newConvo}>＋ New Chat</button>

        {/* Sidebar search */}
        <div className="sidebar-search">
          <span className="sidebar-search-icon">🔍</span>
          <input value={sidebarSearch} onChange={e => setSidebarSearch(e.target.value)} placeholder="Search conversations…"/>
        </div>

        <div className="convo-list">
          {filteredConvos.map(c => (
            <div key={c.id} className={'convo-item' + (c.id === activeId ? ' active' : '')}
              onClick={() => { setActiveId(c.id); setSidebarOpen(false); }}>
              <span className="convo-icon">💬</span>
              <span className="convo-title">{c.title || 'New chat'}</span>
              <span className="convo-del" onClick={e => { e.stopPropagation(); deleteConvo(c.id); }}>✕</span>
            </div>
          ))}
        </div>
        <div className="sidebar-footer">
          <span className="user-pill">{user?.email || user?.name || 'User'}</span>
          <button className="icon-btn" onClick={() => setShowSettings(true)}>⚙️</button>
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        {/* Connection banner */}
        {wsState === 'connecting' && <div className="conn-banner">⚡ Connecting to Falkor…</div>}
        {wsState === 'disconnected' && <div className="conn-banner" style={{background:'rgba(239,68,68,.1)',color:'var(--danger)',borderColor:'rgba(239,68,68,.2)'}}>⚠️ Disconnected — reconnecting…</div>}

        <div className="topbar"><button id="install-btn" onclick="installApp()" title="Install Falkor" style="display:none;align-items:center;gap:6px;background:#d97757;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:13px;font-weight:600;cursor:pointer;"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 110 20A10 10 0 0112 2zm0 5v6m0 0l-3-3m3 3l3-3M7 17h10"/></svg>Install</button>
          <button className="icon-btn" onClick={() => setSidebarOpen(true)}>☰</button>
          <span className="topbar-title">{activeConvo?.title || 'Falkor'}</span>

          {/* Nav */}
          <div className="nav-sep"/>
          <button className={'nav-btn'+(view==='chat'?' active':'')} onClick={() => setView('chat')}>💬 Chat</button>
          <button className={'nav-btn'+(view==='sport'?' active':'')} onClick={() => setView('sport')}>🏈</button>
          <button className={'nav-btn'+(view==='calendar'?' active':'')} onClick={() => setView('calendar')}>📅</button>
          <button className={'nav-btn'+(view==='sites'?' active':'')} onClick={() => setView('sites')}>🌐</button>
          <button className={'nav-btn'+(view==='tips'?' active':'')} onClick={() => setView('tips')}>🏆</button>
          <button className={'nav-btn'+(view==='history'?' active':'')} onClick={() => setView('history')}>📖</button>
            <button className={'nav-btn'+(view==='racing'?' active':'')} onClick={() => setView('racing')}>Racing</button>
          <button className={'nav-btn'+(view==='nrl'?' active':'')} onClick={() => setView('nrl')}>NRL</button>
          <div className="nav-sep"/>

          <select className="model-select" value={model} onChange={e => { setModelS(e.target.value); LS.setModel(e.target.value); }}>
            {MODELS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>

          <div className={'ws-dot' + (wsState==='connected'?' connected':wsState==='connecting'?' connecting':'')}/>
          <button className={'bell-btn' + (false?' active':'')} id="bell-btn" onClick={() => typeof togglePush==='function'&&togglePush()} title="Notifications">🔔</button>
          <button className="icon-btn" style={{ fontSize:'15px' }} onClick={() => setShowVoice(true)} title="Voice">🎤</button>
          <button className="icon-btn" style={{ fontSize:'15px' }} onClick={() => setDrivingMode(true)} title="Driving mode">🚗</button>
          <button className="icon-btn" onClick={() => setShowSettings(true)}>⚙️</button>
        </div>

        {view === 'sport'    && <SportPanel pin={LS.agentPin() || LS.pin()}/>}
        {view === 'tips'     && <SportPanel pin={LS.agentPin() || LS.pin()} initialTab="comp"/>}
        {view === 'racing'   && <RacingPanel pin={LS.agentPin() || LS.pin()}/>}
        {view === 'nrl'      && <NRLPanel pin={LS.agentPin() || LS.pin()}/>}
        {view === 'sites'    && <SitesPanel/>}
        {view === 'calendar' && <CalendarPanel pin={LS.agentPin() || LS.pin()}/>}
        {view === 'history'  && <HistoryPanel convos={convos} onOpen={id => { setActiveId(id); setView('chat'); }}/>}

        {view === 'chat' && (
          <>
            {!activeConvo ? (
              <div className="empty">
                <div className="empty-icon">🐉</div>
                <div className="empty-title">Hey {user?.name || 'there'}!</div>
                <div className="empty-sub">What's on your mind?</div>
                <button className="btn" style={{ width:'auto', padding:'10px 24px', marginTop:'8px' }} onClick={newConvo}>Start chat</button>
              </div>
            ) : (activeConvo.messages || []).length === 0 ? (
              <div className="empty">
                <div className="empty-icon">🐉</div>
                <div className="empty-title">Hey {user?.name || 'there'}!</div>
                <div className="empty-sub">What's on your mind?</div>
                <div className="chips">
                  {QUICK_CHIPS.map(chip => (
                    <button key={chip} className="chip" onClick={() => { setInput(chip); taRef.current?.focus(); }}>
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="messages">
                {(activeConvo.messages || []).map(m => <MessageBubble key={m.id} msg={m}/>)}
                {typing && <TypingIndicator/>}
                <div ref={endRef}/>
              </div>
            )}

            <div className="composer">
              {attachment && (
                <div className="attach-row">
                  {attachment.type && attachment.type.startsWith('image/') ? (
                    <img src={URL.createObjectURL(attachment)} alt="preview"
                      style={{ height:'40px', borderRadius:'5px', objectFit:'cover' }}/>
                  ) : '📎'}
                  <span style={{ fontSize:'11px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'160px' }}>
                    {attachment.name || 'image'}
                  </span>
                  <span className="attach-remove" onClick={() => setAttachment(null)}>✕</span>
                </div>
              )}
              <div className={'composer-inner' + (dragOver ? ' drag-over' : '')}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}>
                <textarea ref={taRef} value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); } }}
                  placeholder="Message Falkor…" rows={1}
                  onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                  onPaste={e => {
                    const items = e.clipboardData && e.clipboardData.items;
                    if (!items) return;
                    for (const item of items) {
                      if (item.type.startsWith('image/')) {
                        e.preventDefault();
                        const file = item.getAsFile();
                        if (file) setAttachment(file);
                        return;
                      }
                    }
                  }}
                />
                <input id="file-input" type="file" accept="image/*,*/*" style={{ display:'none' }} onChange={handleFileInput}/>
                <button className="icon-btn" onClick={() => document.getElementById('file-input').click()} title="Attach">📎</button>
                <button className={'icon-btn'+(voiceEnabled?' active':'')} style={{ fontSize:'15px' }} onClick={() => setShowVoice(true)} title="Voice">🎤</button>
                <button className="send-btn" onClick={doSend}
                  disabled={(!input.trim() && !attachment) || wsState !== 'connected'}>➤</button>
              </div>
            </div>
          </>
        )}
      </main>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} theme={theme} onThemeToggle={() => setThemeS(t => t === 'dark' ? 'light' : 'dark')} voiceEnabled={voiceEnabled} onVoiceToggle={() => { const v = !voiceEnabled; setVoiceEnabledS(v); LS.setVoice(v); }}/>}
      {showVoice && <VoiceModal voiceState={voiceState} transcript={voiceTranscript} reply={voiceReply} analyserRef={analyserRef} onMicClick={handleMicClick} onClose={() => { setShowVoice(false); stopRecording(); setVoiceState('idle'); }}/>}
      <ToastContainer/>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
</script>

<script>
// ── Service Worker + Push ──────────────────────────────────────────────────
const PUSH_URL_SW = 'https://falkor-push.luckdragon.io';
const VAPID_PUB = 'BBR12QaqhEyIeIZkENXgDmJDCgIFQgEjSDgTxrPPp6hkdf-MfCC9X6Qp1Q6fU0sX8HAmiklVJciQPLLWbgkC_UU';

function urlB64ToUint8(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

let swRegistration = null;

window.copyCode = function(btn) {
  var code = btn.closest('pre').querySelector('code');
  var t = code ? code.innerText : '';
  if (!t) return;
  navigator.clipboard.writeText(t).then(function() {
    btn.textContent = '✓ Copied';
    setTimeout(function() { btn.textContent = 'Copy'; }, 1500);
  }).catch(function() {});
};

async function togglePush() {
  if (!('Notification' in window) || !swRegistration) {
    alert('Notifications not supported on this browser/device.'); return;
  }
  const btn = document.getElementById('bell-btn');
  const existing = await swRegistration.pushManager.getSubscription();
  if (existing) {
    await existing.unsubscribe();
    await fetch(PUSH_URL_SW + '/unsubscribe', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ endpoint: existing.endpoint })
    });
    if (btn) { btn.style.color = ''; btn.title = 'Enable notifications'; }
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') { alert('Please allow notifications to enable push alerts.'); return; }
  try {
    const sub = await swRegistration.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:urlB64ToUint8(VAPID_PUB) });
    const p256dh = btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
    const auth   = btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
    let deviceId = localStorage.getItem('falkor-device-id');
    if (!deviceId) { deviceId = crypto.randomUUID(); localStorage.setItem('falkor-device-id', deviceId); }
    await fetch(PUSH_URL_SW + '/subscribe', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ endpoint:sub.endpoint, keys:{ p256dh, auth }, deviceId })
    });
    if (btn) { btn.style.color = 'var(--accent2)'; btn.title = 'Notifications ON (tap to disable)'; }
    new Notification('Falkor notifications enabled!', { body:"You'll get alerts for briefings and updates." });
  } catch(e) { alert('Push subscription failed: ' + e.message); }
}

async function checkPushState() {
  if (!swRegistration) return;
  const sub = await swRegistration.pushManager.getSubscription().catch(() => null);
  const btn = document.getElementById('bell-btn');
  if (sub && btn) { btn.style.color = 'var(--accent2)'; btn.title = 'Notifications ON (tap to disable)'; }
}

window.addEventListener('load', async () => {
  if (!('serviceWorker' in navigator)) return;
  try {
    swRegistration = await navigator.serviceWorker.register('/sw.js');
    window._swReg = swRegistration;
    await checkPushState();
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data && e.data.type === 'sync_complete') {
        window.dispatchEvent(new CustomEvent('falkor-sync-complete'));
      }
    });
  } catch(e) { console.warn('SW failed:', e); }
});

// PWA install prompt
let _deferredInstall=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();_deferredInstall=e;const btn=document.getElementById('install-btn');if(btn){btn.style.display='flex';}});
window.addEventListener('appinstalled',()=>{const btn=document.getElementById('install-btn');if(btn)btn.style.display='none';_deferredInstall=null;});
function installApp(){if(_deferredInstall){_deferredInstall.prompt();_deferredInstall.userChoice.then(()=>{_deferredInstall=null;const btn=document.getElementById('install-btn');if(btn)btn.style.display='none';});}}
</script>
</body>
</html>
`;
    return new Response(HTML, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      }
    });
  }
};

