// sly-app v5.4 — standalone serve + Squiggle proxy + Fund tab patches
// Updated 2026-05-03: serve-time Fund tab patch (OUTSTANDING col + JS)
export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    const p = u.pathname;
    if (p.includes('service-worker') || (p.includes('sw') && p.endsWith('.js'))) return new Response('', {status:404});
    if (p.startsWith('/api/') && req.method === 'OPTIONS') return new Response(null, {status:204, headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PATCH,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization'}});

    if (p === '/api/login' && req.method === 'POST') {
      try {
        const bd = await req.json().catch(() => ({}));
        const cid = bd.coach_id || bd.coachId || bd.id;
        const pin = String(bd.pin || bd.password || '');
        if (!cid || !pin) return new Response(JSON.stringify({ok:false,error:'Missing coach_id or pin'}), {status:400, headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}});
        const vr = await fetch('https://sly-api.luckdragon.io/api/coaches/'+cid+'/pin', {method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({current_pin:pin, new_pin:pin})});
        const vd = await vr.json();
        if (vd.ok) {
          const cs = await (await fetch('https://sly-api.luckdragon.io/api/coaches')).json();
          const coach = Array.isArray(cs) ? cs.find(c => String(c.id) === String(cid)) : null;
          return new Response(JSON.stringify({ok:true, coach}), {headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}});
        }
        return new Response(JSON.stringify({ok:false,error:vd.error||'Invalid PIN'}), {status:401, headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}});
      } catch (e) { return new Response(JSON.stringify({ok:false,error:String(e)}), {status:500}); }
    }

    if (p === '/api/squiggle') {
      const q = u.searchParams;
      const url = `https://api.squiggle.com.au/?q=games;year=${q.get('year')||'2026'};round=${q.get('round')||''}`;
      try {
        const r = await fetch(url, {headers:{'User-Agent':'SLY-Fantasy-AFL/1.0 (sly-app worker; paddy@luckdragon.io)'}});
        const text = await r.text();
        return new Response(text, {status:r.status, headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Cache-Control':'public, max-age=60'}});
      } catch (e) {
        return new Response(JSON.stringify({error:String(e)}), {status:502, headers:{'Content-Type':'application/json'}});
      }
    }

    if ((p === '/api/banter' || p === '/api/chat') && (req.method === 'GET' || req.method === 'POST')) {
      const r = await fetch('https://sly-api.luckdragon.io/api/messages'+u.search, {method:req.method, headers:req.headers, body:req.method==='POST'?req.body:undefined});
      return new Response(await r.text(), {status:r.status, headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}});
    }

    if (p.startsWith('/api/')) {
      return fetch('https://sly-api.luckdragon.io'+p+u.search, {method:req.method, headers:req.headers, body:req.body});
    }

    let html = await env.SLY_STATIC.get('standalone-index.html');
    if (!html) return new Response('Standalone HTML not in KV', {status:500});

    // === Fund tab patches (applied at serve time) ===
    // Patch 1: Add OUTSTANDING column to fund summary card
    html = html.replace(
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.75rem">\n                <div><div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:0.2rem">COLLECTED</div><div id="fundCollected" style="font-size:2rem;font-weight:800;color:var(--accent2)">$0</div></div>\n                <div style="text-align:right"><div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:0.2rem">BALANCE</div><div id="fundBalance" style="font-size:2rem;font-weight:800;color:var(--accent)">$0</div></div>\n            </div>',
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.75rem"><div><div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:0.2rem">COLLECTED</div><div id="fundCollected" style="font-size:1.8rem;font-weight:800;color:var(--accent2)">$0</div></div><div style="text-align:center"><div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:0.2rem">OUTSTANDING</div><div id="fundOutstanding" style="font-size:1.8rem;font-weight:800;color:#e74c3c">$800</div></div><div style="text-align:right"><div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:0.2rem">BALANCE</div><div id="fundBalance" style="font-size:1.8rem;font-weight:800;color:var(--accent)">$0</div></div></div>'
    );
    // Patch 2: Update loadSlushFund to compute and set OUTSTANDING
    html = html.replace(
      "document.getElementById('fundProgressLabel').textContent = `${paidCount} of ${pList.length} paid`;",
      "document.getElementById('fundProgressLabel').textContent = `${paidCount} of ${pList.length} paid`;const _outEl=document.getElementById('fundOutstanding');if(_outEl)_outEl.textContent='$'+(total-collected);"
    );
    // Patch 3: Clear fixtures cache after recalc so scores update
    html = html.replace(
      "    renderFixtures();\n    renderStats();\n    loadAdminScores();",
      "    _slyFixturesCache={};\n    renderFixtures();\n    renderStats();\n    loadAdminScores();"
    );
    // === End Fund tab patches ===

    return new Response(html, {headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache, no-store, must-revalidate, max-age=0'}});
  }
};
