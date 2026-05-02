// falkor-desktop v1.0.0 - Desktop control command queue
const VERSION = '1.0.0';
const CORS = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,X-Pin'};
function jsonr(obj,status=200){return new Response(JSON.stringify(obj),{status,headers:{...CORS,'Content-Type':'application/json'}});}
function pinOk(req,env){const p=req.headers.get('X-Pin')||'';if(!env.AGENT_PIN)return true;return p===env.AGENT_PIN;}
async function initDB(env){
  await env.DESKTOP_DB.exec(`CREATE TABLE IF NOT EXISTS desktop_commands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    command TEXT NOT NULL,
    intent TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    result TEXT DEFAULT '',
    error TEXT DEFAULT '',
    requested_by TEXT DEFAULT 'falkor',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
}
const SETUP_SCRIPT = "#!/usr/bin/env python3\\n# falkor-desktop local agent - polls falkor-desktop.luckdragon.io and runs commands\\n# Install: pip install pyautogui pillow requests\\nimport time, subprocess\\nimport requests\\n\\nFALKOR_DESKTOP_URL = 'https://falkor-desktop.luckdragon.io'\\nAGENT_PIN = 'YOUR_AGENT_PIN_HERE'  # replace with your actual AGENT_PIN\\nPOLL_INTERVAL = 3\\n\\ndef execute_command(cmd, intent):\\n    try:\\n        import pyautogui\\n        c = cmd.lower()\\n        if 'screenshot' in c or intent == 'screenshot':\\n            import datetime\\n            f = 'screenshot_' + datetime.datetime.now().strftime('%H%M%S') + '.png'\\n            pyautogui.screenshot(f)\\n            return {'ok': True, 'result': 'Screenshot saved: ' + f}\\n        elif c.startswith('open '):\\n            subprocess.Popen(['start', c[5:].strip()], shell=True)\\n            return {'ok': True, 'result': 'Opened: ' + c[5:].strip()}\\n        elif c.startswith('type '):\\n            import time as t; t.sleep(0.5)\\n            pyautogui.typewrite(cmd[5:], interval=0.05)\\n            return {'ok': True, 'result': 'Typed text'}\\n        else:\\n            r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)\\n            return {'ok': True, 'result': (r.stdout or r.stderr or 'Done').strip()}\\n    except Exception as e:\\n        return {'ok': False, 'error': str(e)}\\n\\nprint('falkor-desktop agent running. Ctrl+C to stop.')\\nwhile True:\\n    try:\\n        r = requests.get(FALKOR_DESKTOP_URL + '/pending',\\n            headers={'X-Pin': AGENT_PIN}, timeout=10)\\n        if r.ok:\\n            for c in r.json().get('commands', []):\\n                print('Executing [' + str(c['id']) + ']: ' + c['command'])\\n                res = execute_command(c['command'], c.get('intent', ''))\\n                requests.post(FALKOR_DESKTOP_URL + '/result/' + str(c['id']),\\n                    json=res, headers={'X-Pin': AGENT_PIN})\\n    except Exception as e:\\n        print('Poll error:', e)\\n    time.sleep(POLL_INTERVAL)";
export default {
  async fetch(req,env){
    const url=new URL(req.url);
    const path=url.pathname;
    const method=req.method;
    if(method==='OPTIONS')return new Response(null,{headers:CORS});
    await initDB(env).catch(()=>{});
    if(path==='/health'){
      const s=await env.DESKTOP_DB.prepare('SELECT COUNT(*) as total,SUM(CASE WHEN status="pending" THEN 1 ELSE 0 END) as pending FROM desktop_commands').first().catch(()=>({total:0,pending:0}));
      return jsonr({ok:true,worker:'falkor-desktop',version:VERSION,...s});
    }
    if(path==='/setup'){return new Response(SETUP_SCRIPT,{headers:{...CORS,'Content-Type':'text/plain','Content-Disposition':'attachment; filename="falkor-desktop-agent.py"'}});}
    if(!pinOk(req,env))return jsonr({error:'Unauthorized'},401);
    if(path==='/command'&&method==='POST'){
      const b=await req.json().catch(()=>({}));
      if(!b.command)return jsonr({error:'command required'},400);
      const r=await env.DESKTOP_DB.prepare('INSERT INTO desktop_commands (command,intent,requested_by) VALUES (?,?,?)').bind(b.command,b.intent||'',b.requested_by||'falkor').run();
      return jsonr({ok:true,id:r.meta?.last_row_id,command:b.command,status:'pending'});
    }
    if(path==='/pending'){
      const rows=await env.DESKTOP_DB.prepare('SELECT id,command,intent FROM desktop_commands WHERE status="pending" ORDER BY created_at ASC LIMIT 5').all();
      if(rows.results&&rows.results.length>0){const ids=rows.results.map(r=>r.id).join(',');await env.DESKTOP_DB.exec('UPDATE desktop_commands SET status="running",updated_at=CURRENT_TIMESTAMP WHERE id IN ('+ids+')')}
      return jsonr({commands:rows.results||[]});
    }
    const rm=path.match(/^\/result\/(\d+)$/);
    if(rm&&method==='POST'){
      const id=parseInt(rm[1]);
      const b=await req.json().catch(()=>({}));
      await env.DESKTOP_DB.prepare('UPDATE desktop_commands SET status=?,result=?,error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(b.ok!==false?'done':'error',b.result||'',b.error||'',id).run();
      return jsonr({ok:true});
    }
    if(path==='/commands'){
      if(method==='DELETE'){await env.DESKTOP_DB.exec('DELETE FROM desktop_commands WHERE status IN ("done","error")');return jsonr({ok:true});}
      const limit=parseInt(url.searchParams.get('limit')||'20');
      const rows=await env.DESKTOP_DB.prepare('SELECT id,command,intent,status,result,error,requested_by,created_at FROM desktop_commands ORDER BY created_at DESC LIMIT ?').bind(limit).all();
      return jsonr({commands:rows.results||[]});
    }
    return jsonr({error:'Not found',path},404);
  }
};
