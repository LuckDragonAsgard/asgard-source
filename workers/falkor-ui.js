export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', version: '1.1.0', worker: 'falkor-ui' });
    }
    return new Response(`<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Falkor</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.2/babel.min.js"></script>
<style>
:root{--bg:#0f0f11;--panel:#18181b;--border:#2a2a2e;--text:#e8e8ea;--muted:#888;--accent:#6c63ff;--accent2:#a78bfa;--user-bubble:#1e1e2e;--ai-bubble:#18181b;--danger:#ef4444;--success:#22c55e;--input-bg:#1a1a1f;--radius:12px}
[data-theme="light"]{--bg:#f5f5f7;--panel:#fff;--border:#e0e0e5;--text:#1a1a1e;--muted:#666;--user-bubble:#ede9fe;--ai-bubble:#fff;--input-bg:#fff}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;height:100dvh;overflow:hidden}
.login-wrap{display:flex;align-items:center;justify-content:center;height:100dvh}
.login-card{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:40px 36px;width:100%;max-width:380px}
.login-logo{font-size:28px;font-weight:700;letter-spacing:-1px;margin-bottom:6px}
.login-sub{color:var(--muted);font-size:14px;margin-bottom:28px}
.field{display:flex;flex-direction:column;gap:6px;margin-bottom:16px}
.field label{font-size:13px;color:var(--muted)}
.field input{background:var(--input-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:15px;padding:10px 14px;outline:none;transition:border .15s}
.field input:focus{border-color:var(--accent)}
.btn{background:var(--accent);border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:15px;font-weight:600;padding:11px 20px;width:100%;transition:opacity .15s}
.btn:hover{opacity:.88}.btn:disabled{opacity:.4;cursor:not-allowed}
.btn-ghost{background:transparent;border:1px solid var(--border);color:var(--text)}
.btn-ghost:hover{background:var(--border);opacity:1}
.err-msg{color:var(--danger);font-size:13px;margin-bottom:12px}
.app{display:flex;height:100dvh}
.sidebar{width:260px;min-width:260px;background:var(--panel);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden;transition:transform .2s}
.sidebar-top{padding:16px 12px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px}
.logo-text{font-size:18px;font-weight:700;flex:1}
.icon-btn{background:none;border:none;color:var(--muted);cursor:pointer;padding:6px;border-radius:6px;font-size:18px;line-height:1}
.icon-btn:hover{background:var(--border);color:var(--text)}
.new-chat-btn{margin:10px 12px}
.convo-list{flex:1;overflow-y:auto;padding:4px 0}
.convo-item{padding:10px 14px;cursor:pointer;border-radius:8px;margin:2px 6px;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text);display:flex;align-items:center;gap:6px}
.convo-item:hover{background:var(--border)}
.convo-item.active{background:rgba(108,99,255,.18);color:var(--accent2)}
.convo-del{margin-left:auto;opacity:0;font-size:11px;color:var(--danger)}
.convo-item:hover .convo-del{opacity:.7}
.convo-del:hover{opacity:1!important}
.sidebar-footer{padding:12px;border-top:1px solid var(--border);display:flex;align-items:center;gap:8px}
.user-pill{background:var(--border);border-radius:20px;font-size:12px;padding:5px 12px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.main{flex:1;display:flex;flex-direction:column;overflow:hidden}
.topbar{border-bottom:1px solid var(--border);padding:10px 16px;display:flex;align-items:center;gap:10px;min-height:52px}
.model-select{background:var(--input-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;padding:5px 10px;cursor:pointer}
.topbar-title{font-size:14px;font-weight:600;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ws-dot{width:8px;height:8px;border-radius:50%;background:var(--muted);flex-shrink:0}
.ws-dot.connected{background:var(--success)}.ws-dot.connecting{background:#f59e0b}
.messages{flex:1;overflow-y:auto;padding:20px 0;scroll-behavior:smooth}
.msg-row{padding:6px 20px;display:flex;flex-direction:column;gap:2px}
.msg-row.user{align-items:flex-end}.msg-row.assistant{align-items:flex-start}
.msg-bubble{max-width:78%;background:var(--user-bubble);border-radius:14px;padding:10px 14px;font-size:14px;line-height:1.55;white-space:pre-wrap;word-break:break-word}
.msg-row.assistant .msg-bubble{background:var(--ai-bubble);border:1px solid var(--border)}
.msg-role{font-size:11px;color:var(--muted);margin-bottom:2px;padding:0 4px}
.typing-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--muted);animation:bounce .9s infinite;margin:0 2px}
.typing-dot:nth-child(2){animation-delay:.2s}.typing-dot:nth-child(3){animation-delay:.4s}
@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}
.composer{padding:14px 16px;border-top:1px solid var(--border);background:var(--bg)}
.composer-inner{display:flex;gap:8px;align-items:flex-end;background:var(--input-bg);border:1px solid var(--border);border-radius:12px;padding:8px 12px;transition:border .15s}
.composer-inner:focus-within{border-color:var(--accent)}
.composer-inner.drag-over{border-color:var(--accent2);background:rgba(108,99,255,.08)}
textarea{background:none;border:none;color:var(--text);flex:1;font-size:14px;line-height:1.5;outline:none;resize:none;max-height:160px;font-family:inherit}
.mic-btn{background:none;border:1px solid var(--border);border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--text);transition:all .2s;}
.mic-btn:hover{background:var(--border);}
.mic-btn.recording{background:#e74c3c22;border-color:#e74c3c;animation:pulse 1s infinite;}
.mic-btn.wake{background:#3498db22;border-color:#3498db;}
.speak-btn{background:none;border:1px solid var(--border);border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--muted);transition:all .2s;}
.speak-btn:hover{background:var(--border);}
.speak-btn.on{color:var(--accent);border-color:var(--accent);}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
.send-btn{background:var(--accent);border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:16px;padding:7px 12px;transition:opacity .15s;flex-shrink:0;line-height:1}
.send-btn:hover{opacity:.85}.send-btn:disabled{opacity:.35;cursor:not-allowed}
.attach-row{font-size:12px;color:var(--accent2);padding:4px 4px 0;display:flex;align-items:center;gap:8px}
.attach-remove{color:var(--danger);cursor:pointer}
.empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;opacity:.55}
.empty-icon{font-size:48px}.empty-title{font-size:18px;font-weight:600}.empty-sub{font-size:13px;color:var(--muted)}
.settings-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:100;display:flex;align-items:center;justify-content:center}
.settings-panel{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:28px;width:100%;max-width:420px;display:flex;flex-direction:column;gap:18px;max-height:80dvh;overflow-y:auto}
.settings-title{font-size:17px;font-weight:700}
.setting-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.setting-label{font-size:14px}.setting-val{font-size:13px;color:var(--muted);background:var(--input-bg);border:1px solid var(--border);border-radius:6px;padding:4px 10px}
.toggle{width:40px;height:22px;background:var(--border);border-radius:11px;position:relative;cursor:pointer;transition:background .2s;flex-shrink:0}
.toggle.on{background:var(--accent)}.toggle::after{content:'';position:absolute;width:16px;height:16px;background:#fff;border-radius:50%;top:3px;left:3px;transition:left .2s}.toggle.on::after{left:21px}
.divider{border:none;border-top:1px solid var(--border)}
.sidebar-scrim{display:none}
@media(max-width:640px){.sidebar{position:fixed;inset:0 auto 0 0;z-index:50;transform:translateX(-100%)}.sidebar.open{transform:none}.sidebar-scrim{display:block;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:49}}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
.msg-bubble code{background:rgba(255,255,255,.08);padding:2px 6px;border-radius:4px;font-size:12px;font-family:monospace}
.msg-bubble pre{background:rgba(0,0,0,.3);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;overflow-x:auto}
.msg-bubble pre code{background:none;padding:0;font-size:12px}
.sport-table{width:100%;border-collapse:collapse;font-size:13px}
.sport-table th{text-align:left;padding:6px 8px;color:var(--muted);border-bottom:1px solid var(--border)}
.sport-table td{padding:7px 8px;border-bottom:1px solid var(--border)}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel">
const { useState, useEffect, useRef, useCallback } = React;

const AGENT_URL = 'https://falkor-agent.luckdragon.io';
const AI_URL    = 'https://asgard-ai.luckdragon.io';
const SPORT_URL = 'https://falkor-sport.luckdragon.io';
const AUTH_URL  = 'https://asgard.luckdragon.io';
const MODELS = [
  { key: 'groq-fast',  label: '⚡ Groq Fast' },
  { key: 'groq',       label: '🧠 Groq 70B' },
  { key: 'groq-think', label: '🔍 Groq Think' },
  { key: 'haiku',      label: '🌸 Haiku' },
  { key: 'sonnet',     label: '✨ Sonnet' },
];
const LS = {
  pin:    () => localStorage.getItem('falkor.pin') || '',
  setPin: v  => localStorage.setItem('falkor.pin', v),
  convos: () => { try { return JSON.parse(localStorage.getItem('falkor.convos') || '[]'); } catch { return []; } },
  setConvos: v => localStorage.setItem('falkor.convos', JSON.stringify(v)),
  model:  () => localStorage.getItem('falkor.model') || 'groq-fast',
  setModel: v => localStorage.setItem('falkor.model', v),
  theme:  () => localStorage.getItem('falkor.theme') || 'dark',
  setTheme: v => localStorage.setItem('falkor.theme', v),
};
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function renderMD(text) {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\`\`\`([\\s\\S]*?)\`\`\`/g,'<pre><code>$1</code></pre>')
    .replace(/\`([^\`]+)\`/g,'<code>$1</code>')
    .replace(/\\*\\*([^*]+)\\*\\*/g,'<strong>$1</strong>')
    .replace(/\\*([^*]+)\\*/g,'<em>$1</em>')
    .replace(/\\n/g,'<br>');
}

// ── Login ──────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function handleSubmit(e) {
    e.preventDefault(); setLoading(true); setError('');
    try {
      await fetch(\`\${AUTH_URL}/login\`, {
        method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:\`email=\${encodeURIComponent(email)}&password=\${encodeURIComponent(password)}\`,
        redirect:'manual', credentials:'include',
      });
      const test = await fetch(\`\${AGENT_URL}/status\`, { headers:{'X-Pin':'535554'} }).catch(()=>null);
      if (test && test.ok) { LS.setPin('535554'); onLogin({ email, name: email.split('@')[0] }); }
      else setError('Incorrect email or password.');
    } catch { setError('Connection error. Try again.'); }
    setLoading(false);
  }
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">🐉 Falkor</div>
        <div className="login-sub">Your personal AI assistant</div>
        {error && <div className="err-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field"><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required autoFocus /></div>
          <div className="field"><label>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required /></div>
          <button className="btn" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    </div>
  );
}

// ── Settings ───────────────────────────────────────────────────
function SettingsPanel({ onClose, theme, onThemeToggle }) {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    fetch(\`\${AGENT_URL}/status\`,{headers:{'X-Pin':LS.pin()}}).then(r=>r.json()).then(setStatus).catch(()=>{});
  }, []);
  return (
    <div className="settings-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="settings-panel">
        <div className="settings-title">⚙️ Settings</div>
        <hr className="divider"/>
        <div className="setting-row"><span className="setting-label">Theme (light)</span><div className={\`toggle \${theme==='light'?'on':''}\`} onClick={onThemeToggle}/></div>
        <div className="setting-row"><span className="setting-label">Agent</span><span className="setting-val">falkor-agent.luckdragon.io</span></div>
        {status&&<><div className="setting-row"><span className="setting-label">Version</span><span className="setting-val">v{status.version}</span></div>
        <div className="setting-row"><span className="setting-label">History</span><span className="setting-val">{status.historyLength} msgs</span></div>
        <div className="setting-row"><span className="setting-label">Memory</span><span className="setting-val">{status.memoryKeys} keys</span></div></>}
        <hr className="divider"/>
        <button className="btn btn-ghost" onClick={()=>{if(confirm('Clear chat history?'))fetch(\`\${AGENT_URL}/history\`,{method:'DELETE',headers:{'X-Pin':LS.pin()}});onClose();}}>Clear history</button>
        <button className="btn" style={{background:'var(--danger)'}} onClick={()=>{localStorage.removeItem('falkor.pin');localStorage.removeItem('falkor.user');window.location.reload();}}>Sign out</button>
      </div>
    </div>
  );
}

// ── Sport Panel ────────────────────────────────────────────────
function SportPanel({ pin }) {
  const [ladder,setLadder]=useState(null);
  const [games,setGames]=useState([]);
  const [tips,setTips]=useState([]);
  const [comp,setComp]=useState(null);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState('ladder');
  const [rnd,setRnd]=useState(8);
  const [player,setPlayer]=useState(()=>localStorage.getItem('falkor.sport.player')||'');
  const [tipped,setTipped]=useState({});
  const YEAR=2026;

  async function sf(path) {
    const res=await fetch(\`\${SPORT_URL}\${path}\${path.includes('?')?'&':'?'}pin=\${pin}\`);
    return res.json();
  }
  async function load() {
    setLoading(true);
    const [l,g,t,c]=await Promise.allSettled([
      sf(\`/afl/ladder?year=\${YEAR}\`),
      sf(\`/afl/round?year=\${YEAR}&round=\${rnd}\`),
      sf(\`/afl/tips?year=\${YEAR}&round=\${rnd}\`),
      sf(\`/afl/comp?year=\${YEAR}&round=\${rnd}\`),
    ]);
    if(l.status==='fulfilled')setLadder(l.value);
    if(g.status==='fulfilled')setGames(g.value);
    if(t.status==='fulfilled')setTips(t.value);
    if(c.status==='fulfilled')setComp(c.value);
    setLoading(false);
  }
  useEffect(()=>{load();},[rnd]);

  async function tip(gameId,team) {
    if(!player){alert('Enter your name first');return;}
    localStorage.setItem('falkor.sport.player',player);
    await fetch(\`\${SPORT_URL}/afl/comp/tip?pin=\${pin}\`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({player,round:rnd,gameId,tip:team}),
    });
    setTipped(p=>({...p,[gameId]:team}));
    setTimeout(load,500);
  }

  const TB = (t) => ({
    padding:'6px 14px',border:'none',borderRadius:'6px',cursor:'pointer',fontSize:'13px',
    background:tab===t?'var(--accent)':'var(--border)',
    color:tab===t?'#fff':'var(--text)',marginRight:'4px',
  });

  return (
    <div style={{flex:1,overflow:'auto',padding:'16px 20px'}}>
      <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'16px',flexWrap:'wrap'}}>
        <span style={{fontSize:'18px',fontWeight:700}}>🏈 AFL {YEAR}</span>
        <span style={{color:'var(--muted)',fontSize:'13px'}}>Round</span>
        <select value={rnd} onChange={e=>setRnd(Number(e.target.value))}
          style={{background:'var(--input-bg)',border:'1px solid var(--border)',borderRadius:'6px',color:'var(--text)',padding:'4px 8px',fontSize:'13px'}}>
          {Array.from({length:24},(_,i)=>i+1).map(r=><option key={r} value={r}>R{r}</option>)}
        </select>
        <button onClick={load} style={{...TB('x'),background:'var(--border)',color:'var(--text)'}}>↻</button>
        <div style={{marginLeft:'auto'}}>
          {['ladder','results','tips','comp'].map(t=><button key={t} style={TB(t)} onClick={()=>setTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>)}
        </div>
      </div>

      {loading && <div style={{color:'var(--muted)',fontSize:'13px',padding:'20px'}}>Loading…</div>}

      {!loading && tab==='ladder' && ladder && (
        <table className="sport-table">
          <thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>D</th><th>Pts</th><th>%</th></tr></thead>
          <tbody>{ladder.map((t,i)=>(
            <tr key={t.team} style={{background:i<8?'rgba(108,99,255,.05)':'transparent'}}>
              <td style={{color:'var(--muted)'}}>{t.rank}</td>
              <td style={{fontWeight:i<8?600:400}}>{t.team}</td>
              <td style={{textAlign:'center',color:'var(--success)'}}>{t.wins}</td>
              <td style={{textAlign:'center',color:'var(--danger)'}}>{t.losses}</td>
              <td style={{textAlign:'center',color:'var(--muted)'}}>{t.draws}</td>
              <td style={{textAlign:'center',fontWeight:600}}>{t.points}</td>
              <td style={{textAlign:'center',color:'var(--muted)'}}>{t.percentage}%</td>
            </tr>
          ))}</tbody>
        </table>
      )}

      {!loading && tab==='results' && (
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          {games.map(g=>(
            <div key={g.id} style={{background:'var(--panel)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px 16px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px',justifyContent:'space-between',flexWrap:'wrap'}}>
                <div style={{display:'flex',gap:'12px',alignItems:'center',flex:1}}>
                  <span style={{fontWeight:g.winner===g.home?700:400,flex:1,textAlign:'right'}}>{g.home}</span>
                  <span style={{color:'var(--muted)',fontSize:'12px',flexShrink:0}}>{g.status==='upcoming'?'vs':\`\${g.homeScore} – \${g.awayScore}\`}</span>
                  <span style={{fontWeight:g.winner===g.away?700:400,flex:1}}>{g.away}</span>
                </div>
                <span style={{fontSize:'11px',padding:'3px 8px',borderRadius:'20px',flexShrink:0,
                  background:g.status==='final'?'rgba(34,197,94,.15)':g.status==='live'?'rgba(245,158,11,.15)':'var(--border)',
                  color:g.status==='final'?'var(--success)':g.status==='live'?'#f59e0b':'var(--muted)'}}>
                  {g.status==='final'?'Final':g.status==='live'?'LIVE':g.date?.slice(0,10)||'TBC'}
                </span>
              </div>
              {g.venue&&<div style={{fontSize:'11px',color:'var(--muted)',marginTop:'4px'}}>📍 {g.venue}</div>}
            </div>
          ))}
        </div>
      )}

      {!loading && tab==='tips' && (
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          <div style={{fontSize:'12px',color:'var(--muted)',marginBottom:'4px'}}>AI model tips — Round {rnd} (Squiggle)</div>
          {tips.length===0&&<div style={{color:'var(--muted)',fontSize:'13px'}}>No tips available yet for Round {rnd}</div>}
          {tips.map((t,i)=>(
            <div key={i} style={{background:'var(--panel)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px 16px',display:'flex',alignItems:'center',gap:'12px'}}>
              <span style={{fontWeight:600,flex:1}}>{t.tip}</span>
              <span style={{color:'var(--muted)',fontSize:'12px'}}>vs {t.opponent}</span>
              <span style={{background:'var(--border)',borderRadius:'20px',padding:'3px 10px',fontSize:'12px',
                color:t.confidence>70?'var(--success)':t.confidence>55?'#f59e0b':'var(--danger)'}}>
                {t.confidence}%
              </span>
            </div>
          ))}
        </div>
      )}

      {!loading && tab==='comp' && (
        <div>
          <div style={{marginBottom:'16px',display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
            <input value={player} onChange={e=>setPlayer(e.target.value)} onBlur={()=>localStorage.setItem('falkor.sport.player',player)}
              placeholder="Your name" style={{background:'var(--input-bg)',border:'1px solid var(--border)',borderRadius:'8px',color:'var(--text)',padding:'7px 12px',fontSize:'13px',width:'160px'}}/>
            <span style={{fontSize:'12px',color:'var(--muted)'}}>Tip Round {rnd} winners</span>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'24px'}}>
            {games.map(g=>{
              const myTip = tipped[g.id] || comp?.players?.[player]?.tips?.find(t=>t.gameId===String(g.id))?.tip;
              const done = g.status==='final';
              return (
                <div key={g.id} style={{background:'var(--panel)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px 16px'}}>
                  <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
                    {[g.home,g.away].map((team,ti)=>(
                      <button key={team} onClick={()=>!done&&tip(String(g.id),team)}
                        style={{flex:1,padding:'8px',borderRadius:'8px',cursor:done?'default':'pointer',fontSize:'13px',
                          border:\`2px solid \${myTip===team?'var(--accent)':'var(--border)'}\`,
                          background:myTip===team?'rgba(108,99,255,.15)':'var(--input-bg)',
                          color:'var(--text)',fontWeight:myTip===team?700:400}}>
                        {team}
                      </button>
                    )).reduce((acc,el,i)=>i===0?[el]:[...acc,<span key="v" style={{color:'var(--muted)',fontSize:'12px',flexShrink:0}}>vs</span>,el],[])}
                    {done&&myTip&&<span style={{fontSize:'13px',flexShrink:0,color:g.winner===myTip?'var(--success)':'var(--danger)'}}>{g.winner===myTip?'✓':'✗'}</span>}
                  </div>
                  {done&&<div style={{fontSize:'11px',color:'var(--muted)',marginTop:'4px'}}>Final: {g.home} {g.homeScore} – {g.awayScore} {g.away}</div>}
                </div>
              );
            })}
          </div>
          {comp?.season?.length>0&&(
            <div>
              <div style={{fontWeight:600,marginBottom:'10px',fontSize:'14px'}}>🏆 Season {YEAR} Leaderboard</div>
              <table className="sport-table">
                <thead><tr><th>#</th><th>Player</th><th style={{textAlign:'center'}}>Correct</th><th style={{textAlign:'center'}}>Total</th><th style={{textAlign:'center'}}>%</th></tr></thead>
                <tbody>{comp.season.map((p,i)=>(
                  <tr key={p.player}>
                    <td style={{color:'var(--muted)'}}>{i+1}</td>
                    <td style={{fontWeight:p.player===player?700:400}}>{p.player}{p.player===player?' 👤':''}</td>
                    <td style={{textAlign:'center',color:'var(--success)'}}>{p.correct}</td>
                    <td style={{textAlign:'center'}}>{p.total}</td>
                    <td style={{textAlign:'center',color:'var(--muted)'}}>{p.pct}%</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {comp?.season?.length===0&&<div style={{color:'var(--muted)',fontSize:'13px'}}>No tips submitted yet — be the first!</div>}
        </div>
      )}
    </div>
  );
}

// ── Message Bubble ─────────────────────────────────────────────
function MessageBubble({msg}){
  return(
    <div className={\`msg-row \${msg.role}\`}>
      <div className="msg-role">{msg.role==='user'?'You':'🐉 Falkor'}</div>
      <div className="msg-bubble" dangerouslySetInnerHTML={{__html:renderMD(msg.content)}}/>
    </div>
  );
}
function TypingIndicator(){
  return(
    <div className="msg-row assistant">
      <div className="msg-role">🐉 Falkor</div>
      <div className="msg-bubble" style={{padding:'12px 16px'}}>
        <span className="typing-dot"/><span className="typing-dot"/><span className="typing-dot"/>
      </div>
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────
function App(){
  const [user,setUser]=useState(()=>{try{return JSON.parse(localStorage.getItem('falkor.user')||'null')}catch{return null}});
  const [view,setView]=useState('chat');
  const [convos,setConvos]=useState(LS.convos);
  const [activeId,setActiveId]=useState(()=>localStorage.getItem('falkor.activeId')||'');
  const [model,setModelS]=useState(LS.model);
  const [theme,setThemeS]=useState(LS.theme);
  const [input,setInput]=useState('');
  const [typing,setTyping]=useState(false);
  const [wsState,setWsState]=useState('disconnected');
  const [showSettings,setShowSettings]=useState(false);
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [attachment,setAttachment]=useState(null);
  const [dragOver,setDragOver]=useState(false);
  const [isRecording,setIsRecording]=useState(false);
  const [autoSpeak,setAutoSpeak]=useState(()=>localStorage.getItem('falkor.autoSpeak')==='true');
  const [wakeActive,setWakeActive]=useState(false);
  const recorderRef=useRef(null);
  const chunksRef=useRef([]);
  const wakeRef=useRef(null);
  const audioRef=useRef(null);
  const wsRef=useRef(null);
  const endRef=useRef(null);
  const taRef=useRef(null);
  const reconnTimer=useRef(null);
  const activeConvo=convos.find(c=>c.id===activeId);

  useEffect(()=>{document.documentElement.setAttribute('data-theme',theme);LS.setTheme(theme);},[theme]);
  useEffect(()=>{LS.setConvos(convos);},[convos]);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth'});},[activeConvo?.messages,typing]);

  const connectWS=useCallback(()=>{
    if(!user||!LS.pin())return;
    if(wsRef.current&&wsRef.current.readyState<2)return;
    setWsState('connecting');
    const ws=new WebSocket(AGENT_URL.replace('https://','wss://')+\`/?pin=\${LS.pin()}\`);
    wsRef.current=ws;
    ws.onopen=()=>{setWsState('connected');clearTimeout(reconnTimer.current);};
    ws.onmessage=(evt)=>{
      try{
        const msg=JSON.parse(evt.data);
        if(msg.type==='assistant_reply'){
          setTyping(false);
          const m={id:uid(),role:'assistant',content:msg.text,ts:Date.now()};
          setConvos(prev=>prev.map(c=>c.id===activeId?{...c,messages:[...(c.messages||[]),m]}:c));
          speakText(msg.text);
        }
      }catch{}
    };
    ws.onclose=()=>{setWsState('disconnected');setTyping(false);reconnTimer.current=setTimeout(connectWS,3000);};
    ws.onerror=()=>ws.close();
  },[user,activeId]);

  useEffect(()=>{if(user)connectWS();return()=>{clearTimeout(reconnTimer.current);wsRef.current?.close();};},[user]);

  // ── TTS: speak assistant reply ──────────────────────────────────────────
  async function speakText(text) {
    if (!text || !autoSpeak) return;
    try {
      const res = await fetch(`${AI_URL}/speak`, {
        method: 'POST',
        headers: {'Content-Type':'application/json','X-Pin':LS.pin()},
        body: JSON.stringify({ text: text.slice(0,500), provider:'openai', voice:'onyx' }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) { audioRef.current.pause(); URL.revokeObjectURL(audioRef.current.src); }
      const a = new Audio(url);
      audioRef.current = a;
      a.play().catch(()=>{});
    } catch(e) { console.error('TTS error', e); }
  }

  // ── STT: record + transcribe ───────────────────────────────────────────
  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) { alert('Microphone not supported'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm' });
      recorderRef.current = mr;
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setIsRecording(false);
        const blob = new Blob(chunksRef.current, { type: mr.mimeType });
        if (blob.size < 1000) return; // too short
        const fd = new FormData();
        fd.append('audio', blob, 'audio.webm');
        try {
          const res = await fetch(`${AI_URL}/stt`, { method:'POST', headers:{'X-Pin':LS.pin()}, body:fd });
          const d = await res.json();
          if (d.text) {
            setInput(prev => prev ? prev + ' ' + d.text : d.text);
            if (taRef.current) { taRef.current.style.height='auto'; taRef.current.style.height=Math.min(taRef.current.scrollHeight,160)+'px'; taRef.current.focus(); }
          }
        } catch(e) { console.error('STT error', e); }
      };
      mr.start(200);
      setIsRecording(true);
      // Auto-stop after 30s
      setTimeout(()=>{ if(recorderRef.current?.state==='recording') recorderRef.current.stop(); }, 30000);
    } catch(e) { console.error('Mic error', e); alert('Could not access microphone'); }
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }

  function toggleRecording() {
    if (isRecording) stopRecording(); else startRecording();
  }

  function toggleAutoSpeak() {
    setAutoSpeak(s => { localStorage.setItem('falkor.autoSpeak', !s); return !s; });
  }

  // ── Wake word: "Hey Falkor" via browser SpeechRecognition ──────────────
  useEffect(() => {
    if (!user) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const sr = new SR();
    sr.continuous = true;
    sr.interimResults = false;
    sr.lang = 'en-AU';
    wakeRef.current = sr;
    sr.onresult = (e) => {
      const t = e.results[e.results.length-1][0].transcript.toLowerCase();
      if (t.includes('hey falkor') || t.includes('hey falcon')) {
        setWakeActive(true);
        startRecording();
        setTimeout(() => setWakeActive(false), 500);
      }
    };
    sr.onerror = () => {};
    sr.onend = () => { try { sr.start(); } catch{} };
    try { sr.start(); } catch {}
    return () => { try { sr.stop(); } catch {} };
  }, [user]);
  useEffect(()=>{localStorage.setItem('falkor.activeId',activeId);},[activeId]);

  function handleLogin(u){localStorage.setItem('falkor.user',JSON.stringify(u));setUser(u);}

  function newConvo(){
    const id=uid(),h=new Date().getHours();
    const g=h<12?'Morning':h<17?'Afternoon':'Evening';
    setConvos(prev=>[{id,title:\`\${g} chat\`,messages:[],createdAt:Date.now()},...prev]);
    setActiveId(id);setSidebarOpen(false);setView('chat');
  }
  function delConvo(e,id){e.stopPropagation();setConvos(prev=>prev.filter(c=>c.id!==id));if(activeId===id)setActiveId('');}
  function setModel(m){setModelS(m);LS.setModel(m);}
  function toggleTheme(){setThemeS(t=>t==='dark'?'light':'dark');}

  async function sendMsg(){
    let text=input.trim();
    if(!text&&!attachment)return;
    if(attachment){text=attachment.prefix+text;setAttachment(null);}
    setInput('');
    if(taRef.current)taRef.current.style.height='auto';
    let cid=activeId;
    if(!cid){
      const id=uid();
      setConvos(prev=>[{id,title:text.slice(0,40)||'New chat',messages:[],createdAt:Date.now()},...prev]);
      setActiveId(id);cid=id;
    }
    const um={id:uid(),role:'user',content:text,ts:Date.now()};
    setConvos(prev=>prev.map(c=>c.id===cid?{...c,title:c.messages.length===0?text.slice(0,40):c.title,messages:[...(c.messages||[]),um]}:c));
    setTyping(true);
    if(wsRef.current&&wsRef.current.readyState===1){
      wsRef.current.send(JSON.stringify({type:'chat',text,model}));
    } else {
      try{
        const res=await fetch(\`\${AGENT_URL}/chat\`,{method:'POST',headers:{'Content-Type':'application/json','X-Pin':LS.pin()},body:JSON.stringify({text,model})});
        const d=await res.json();
        setTyping(false);
        const rm={id:uid(),role:'assistant',content:d.reply||'[No reply]',ts:Date.now()};
        setConvos(prev=>prev.map(c=>c.id===cid?{...c,messages:[...(c.messages||[]),rm]}:c));
      }catch{
        setTyping(false);
        const em={id:uid(),role:'assistant',content:'[Connection error]',ts:Date.now()};
        setConvos(prev=>prev.map(c=>c.id===cid?{...c,messages:[...(c.messages||[]),em]}:c));
      }
    }
  }

  function onKey(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg();}}
  function onTAChange(e){setInput(e.target.value);e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,160)+'px';}
  function processFile(file){
    if(file.size>10*1024*1024){alert('File too large (>10MB)');return;}
    const r=new FileReader();
    if(file.type.startsWith('image/')){
      r.onload=e=>setAttachment({name:file.name,type:'image',dataUrl:e.target.result,prefix:''});
      r.readAsDataURL(file);
    } else {
      r.onload=e=>{const t=e.target.result||'';setAttachment({name:file.name,type:'text',prefix:\`📎 [\${file.name}]:\\n\${t.slice(0,8000)}\${t.length>8000?'\\n…(truncated)':''}\\n\\n\`});};
      r.readAsText(file);
    }
  }

  if(!user)return <LoginScreen onLogin={handleLogin}/>;
  const msgs=activeConvo?.messages||[];
  const wsCls=wsState==='connected'?'connected':wsState==='connecting'?'connecting':'';

  return(
    <div className="app">
      {sidebarOpen&&<div className="sidebar-scrim" onClick={()=>setSidebarOpen(false)}/>}
      <div className={\`sidebar \${sidebarOpen?'open':''}\`}>
        <div className="sidebar-top">
          <span className="logo-text">🐉 Falkor</span>
          <button className="icon-btn" onClick={()=>setSidebarOpen(false)}>✕</button>
        </div>
        <button className="btn new-chat-btn" onClick={newConvo}>+ New chat</button>
        <div style={{padding:'4px 6px 0'}}>
          <div className={\`convo-item\${view==='sport'?' active':''}\`} onClick={()=>{setView('sport');setSidebarOpen(false);}}>🏈 AFL &amp; Sport</div>
        </div>
        <hr style={{border:'none',borderTop:'1px solid var(--border)',margin:'4px 12px'}}/>
        <div className="convo-list">
          {convos.length===0&&<div style={{padding:'16px',color:'var(--muted)',fontSize:'13px',textAlign:'center'}}>No conversations yet</div>}
          {convos.map(c=>(
            <div key={c.id} className={\`convo-item \${c.id===activeId&&view==='chat'?'active':''}\`}
              onClick={()=>{setActiveId(c.id);setView('chat');setSidebarOpen(false);}}>
              💬 {c.title||'Untitled'}
              <span className="convo-del" onClick={e=>delConvo(e,c.id)}>✕</span>
            </div>
          ))}
        </div>
        <div className="sidebar-footer">
          <div className="user-pill">👤 {user.name||user.email}</div>
          <button className="icon-btn" onClick={()=>setShowSettings(true)}>⚙️</button>
        </div>
      </div>

      <div className="main">
        <div className="topbar">
          <button className="icon-btn" onClick={()=>setSidebarOpen(s=>!s)}>☰</button>
          <span className="topbar-title">{view==='sport'?'🏈 AFL & Sport':activeConvo?.title||'Falkor'}</span>
          {view==='chat'&&<select className="model-select" value={model} onChange={e=>setModel(e.target.value)}>
            {MODELS.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}
          </select>}
          <div className={\`ws-dot \${wsCls}\`} title={wsState}/>
        </div>

        {view==='sport' && <SportPanel pin={LS.pin()}/>}

        {view==='chat' && (msgs.length===0&&!typing ? (
          <div className="empty">
            <div className="empty-icon">🐉</div>
            <div className="empty-title">Hey {user.name||'there'}!</div>
            <div className="empty-sub">What's on your mind?</div>
          </div>
        ) : (
          <div className="messages">
            {msgs.map(m=><MessageBubble key={m.id} msg={m}/>)}
            {typing&&<TypingIndicator/>}
            <div ref={endRef}/>
          </div>
        ))}

        {view==='chat' && (
          <div className="composer">
            {attachment&&<div className="attach-row">📎 {attachment.name}<span className="attach-remove" onClick={()=>setAttachment(null)}>✕</span></div>}
            <div className={\`composer-inner \${dragOver?'drag-over':''}\`}
              onDragOver={e=>{e.preventDefault();setDragOver(true);}}
              onDragLeave={()=>setDragOver(false)}
              onDrop={e=>{e.preventDefault();setDragOver(false);const f=e.dataTransfer.files[0];if(f)processFile(f);}}>
              <textarea ref={taRef} rows={1} placeholder="Message Falkor… (Shift+Enter for newline)"
                value={input} onChange={onTAChange} onKeyDown={onKey}/>
              <label style={{cursor:'pointer',color:'var(--muted)',fontSize:'18px',padding:'2px 4px'}} title="Attach file">
                📎<input type="file" style={{display:'none'}} onChange={e=>{if(e.target.files[0])processFile(e.target.files[0]);}}/>
              </label>
              <button
                className={`mic-btn${isRecording?' recording':wakeActive?' wake':''}`}
                onClick={toggleRecording}
                title={isRecording?'Stop recording':'Start voice input (or say "Hey Falkor")'}
              >{isRecording?'⏹':'🎙'}</button>
              <button className={`speak-btn${autoSpeak?' on':''}`} onClick={toggleAutoSpeak} title={autoSpeak?'Auto-speak ON':'Auto-speak OFF'}>
                {autoSpeak?'🔊':'🔇'}
              </button>
              <button className="send-btn" onClick={sendMsg} disabled={!input.trim()&&!attachment}>↑</button>
            </div>
          </div>
        )}
      </div>

      {showSettings&&<SettingsPanel onClose={()=>setShowSettings(false)} theme={theme} onThemeToggle={toggleTheme}/>}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
</script>
</body>
</html>`, {
      headers: {
        'Content-Type': 'text/html;charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  },
};
