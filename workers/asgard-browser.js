// asgard-browser v1.1.0 — Cloudflare Browser Rendering REST API proxy
// PIN-gated. Calls the Browser Rendering REST API server-side using CF_API_TOKEN_FULLOPS (Browser:Edit).

const VERSION = '1.1.1-pin-rotation';
const ACCT = 'a6f47c17811ee2f8b6caeb8f38768c20';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Pin'
};
function jsonResp(data, status, extra) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, CORS, extra || {})
  });
}
function pinOk(req, env) { return req.headers.get('X-Pin') === (env.PADDY_PIN || ''); }

async function brCall(env, op, body) {
  const tok = env.CF_API_TOKEN_FULLOPS || env.CF_API_TOKEN;
  if (!tok) throw new Error('CF_API_TOKEN_FULLOPS missing');
  return fetch('https://api.cloudflare.com/client/v4/accounts/' + ACCT + '/browser-rendering/' + op, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok },
    body: JSON.stringify(body)
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (path === '/health') return jsonResp({ ok: true, worker: 'asgard-browser', version: VERSION, routes: ['/health','/screenshot','/content','/markdown','/json','/links','/scrape','/snapshot','/pdf'] });
    if (!pinOk(request, env)) return jsonResp({ ok: false, error: 'Unauthorized — X-Pin required' }, 401);
    if (request.method !== 'POST') return jsonResp({ ok: false, error: 'POST only' }, 405);
    let body = {};
    try { body = await request.json(); } catch (e) { return jsonResp({ ok: false, error: 'Invalid JSON' }, 400); }

    try {
      if (path === '/screenshot') {
        const r = await brCall(env, 'screenshot', { url: body.url, viewport: body.viewport, screenshotOptions: body.options || { fullPage: !!body.full_page } });
        if (!r.ok) return jsonResp({ ok: false, error: 'CF ' + r.status, detail: (await r.text()).slice(0, 500) }, r.status);
        const ab = await r.arrayBuffer();
        const u8 = new Uint8Array(ab);
        let bin = '';
        for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
        return jsonResp({ ok: true, url: body.url, image_data_url: 'data:image/png;base64,' + btoa(bin), size: u8.length });
      }
      if (path === '/content') {
        const r = await brCall(env, 'content', { url: body.url });
        if (!r.ok) return jsonResp({ ok: false, error: 'CF ' + r.status, detail: (await r.text()).slice(0, 500) }, r.status);
        const j = await r.json();
        const html = j.result || '';
        return jsonResp({ ok: true, url: body.url, html: String(html).substring(0, 100000), length: String(html).length });
      }
      if (path === '/markdown') {
        const r = await brCall(env, 'markdown', { url: body.url });
        if (!r.ok) return jsonResp({ ok: false, error: 'CF ' + r.status, detail: (await r.text()).slice(0, 500) }, r.status);
        const j = await r.json();
        return jsonResp({ ok: true, url: body.url, markdown: String(j.result || '').substring(0, 100000) });
      }
      if (path === '/json') {
        const r = await brCall(env, 'json', { url: body.url, prompt: body.prompt, response_format: body.response_format });
        if (!r.ok) return jsonResp({ ok: false, error: 'CF ' + r.status, detail: (await r.text()).slice(0, 500) }, r.status);
        return jsonResp(await r.json());
      }
      if (path === '/links') {
        const r = await brCall(env, 'links', { url: body.url });
        if (!r.ok) return jsonResp({ ok: false, error: 'CF ' + r.status, detail: (await r.text()).slice(0, 500) }, r.status);
        const j = await r.json();
        return jsonResp({ ok: true, url: body.url, links: j.result || [] });
      }
      if (path === '/scrape') {
        const r = await brCall(env, 'scrape', { url: body.url, elements: body.elements || [{ selector: body.selector }] });
        if (!r.ok) return jsonResp({ ok: false, error: 'CF ' + r.status, detail: (await r.text()).slice(0, 500) }, r.status);
        const j = await r.json();
        return jsonResp({ ok: true, url: body.url, results: j.result || j });
      }
      if (path === '/snapshot') {
        const r = await brCall(env, 'snapshot', { url: body.url, actions: body.actions, viewport: body.viewport });
        if (!r.ok) return jsonResp({ ok: false, error: 'CF ' + r.status, detail: (await r.text()).slice(0, 500) }, r.status);
        return jsonResp(await r.json());
      }
      if (path === '/pdf') {
        const r = await brCall(env, 'pdf', { url: body.url });
        if (!r.ok) return jsonResp({ ok: false, error: 'CF ' + r.status, detail: (await r.text()).slice(0, 500) }, r.status);
        const ab = await r.arrayBuffer();
        const u8 = new Uint8Array(ab);
        let bin = '';
        for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
        return jsonResp({ ok: true, url: body.url, pdf_data_url: 'data:application/pdf;base64,' + btoa(bin), size: u8.length });
      }
      return jsonResp({ ok: false, error: 'Not found', path }, 404);
    } catch (e) {
      return jsonResp({ ok: false, error: e.message, stack: e.stack ? e.stack.slice(0, 500) : null }, 500);
    }
  }
};