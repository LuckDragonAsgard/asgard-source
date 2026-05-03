const H={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,PUT,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization,Accept','Access-Control-Max-Age':'86400'};
const J=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:H});
const E=(m,s=400)=>J({error:m},s);
const R=async r=>{try{return await r.json()}catch{return{}}};
const addStatus=r=>{const now=new Date();return{...r,status:r.is_complete?'completed':(r.lock_time&&new Date(r.lock_time)<=now)?'live':'open'}};
export default {async fetch(req,env){
if(req.method==='OPTIONS')return new Response(null,{headers:H});
const u=new URL(req.url),p=u.pathname.replace(/\/+$/,'')||'/',m=req.method;
const db=env.DB||env.SLY||env.SLY_DB||env.D1;
if(!db)return E('D1 binding missing',500);
try{
if(p==='/api/health'){const r=await db.prepare('SELECT COUNT(*) AS n FROM coaches').first();return J({ok:true,ts:Date.now(),coaches:r?.n??0})}
if(p==='/api/coaches'&&m==='GET'){const{results}=await db.prepare('SELECT id,name,team_name,color,avatar_emoji,logo_url,email FROM coaches ORDER BY id').all();return J(results)}
if(p==='/api/coaches/login'&&m==='POST'){const{coach_id,pin}=await R(req);if(!coach_id||!pin)return E('coach_id and pin required');const row=await db.prepare('SELECT id,name,team_name,color,avatar_emoji,logo_url FROM coaches WHERE id=? AND pin=?').bind(coach_id,String(pin)).first();if(!row)return E('Invalid credentials',401);return J({ok:true,coach:row,token:btoa(`${row.id}:${Date.now()}`)})}
const cm=p.match(/^\/api\/coaches\/(\d+)$/);if(cm){const id=+cm[1];if(m==='GET'){const row=await db.prepare('SELECT id,name,team_name,color,avatar_emoji,logo_url,email FROM coaches WHERE id=?').bind(id).first();if(!row)
return E('Not found',404);return J(row)}if(m==='PATCH'){const b=await R(req);const a=['team_name','color','avatar_emoji','logo_url','email'];const s=[],v=[];for(const k of a)if(k in b){s.push(`${k}=?`);v.push(b[k])}if(!s.length)return E('No fields');v.push(id);await db.prepare(`UPDATE coaches SET ${s.join(',')} WHERE id=?`).bind(...v).run();return J({ok:true})}}
const pinm=p.match(/^\/api\/coaches\/(\d+)\/pin$/);if(pinm&&m==='PATCH'){const id=+pinm[1];const{current_pin,new_pin}=await R(req);if(!new_pin||String(new_pin).length<4)return E('PIN must be at least 4 chars');const row=await db.prepare('SELECT id FROM coaches WHERE id=? AND pin=?').bind(id,String(current_pin)).first();if(!row)return E('Current PIN incorrect',401);await db.prepare('UPDATE coaches SET pin=? WHERE id=?').bind(String(new_pin),id).run();return J({ok:true})}
// FIXED: /api/rounds now includes computed status field
if(p==='/api/rounds'&&m==='GET'){const cur=await db.prepare('SELECT round_number FROM rounds WHERE is_complete=0 ORDER BY round_number ASC LIMIT 1').first();const max=(cur?.round_number??0)+1;const{results}=await db.prepare('SELECT id,name,round_number,is_complete,lock_time FROM rounds WHERE round_number<=? ORDER BY round_number').bind(max).all();return J(results.map(addStatus))}
// FIXED: /api/rounds/current includes status
if(p==='/api/rounds/current'&&m==='GET'){const r=await db.prepare('SELECT id,name,round_number,is_complete,lock_time FROM rounds WHERE is_complete=0 ORDER BY round_number ASC LIMIT 1').first();return J(r?addStatus(r):null)}
if(p==='/api/players'&&m==='GET'){const{results}=await db.prepare('SELECT * FROM players ORDER BY name LIMIT 1000').all();return J(results)}
const plm=p.match(/^\/api\/players\/([\w-]+)$/);if(plm){if(m==='GET'){const row=await db.prepare('SELECT * FROM players WHERE id=?').bind(plm[1]).first();if(!row)
return E('Not found',404);return J(row)}if(m==='PATCH'){const b=await R(req);const a=['name','team','position','photo_url','coach_id','champid'];const s=[],v=[];for(const k of a)if(k in b){s.push(`${k}=?`);v.push(b[k])}if(!s.length)return E('No fields');v.push(plm[1]);await db.prepare(`UPDATE players SET ${s.join(',')} WHERE id=?`).bind(...v).run();return J({ok:true})}}
// FIXED: /api/picks accepts round_id and coach_id; filters on rp.round_id directly
if(p==='/api/picks'){if(m==='GET'){const rd=+u.searchParams.get('round_id')||0,rn=+u.searchParams.get('round')||0,co=+u.searchParams.get('coach_id')||+u.searchParams.get('coach')||0;let q='SELECT rp.id,rp.coach_id,r.round_number,r.id AS round_id,rp.player_id,rp.slot,rp.banter,rp.created_at FROM round_picks rp JOIN rounds r ON r.id=rp.round_id WHERE 1=1';const ps=[];if(rd){q+=' AND rp.round_id=?';ps.push(rd)}else if(rn){q+=' AND r.round_number=?';ps.push(rn)}if(co){q+=' AND rp.coach_id=?';ps.push(co)}q+=' ORDER BY rp.coach_id,rp.slot';const{results}=await db.prepare(q).bind(...ps).all();return J(results)}if(m==='POST'){const b=await R(req);const rn=+b.round_number,ci=+b.coach_id;if(!rn||!ci||!Array.isArray(b.picks))return E('round_number,coach_id,picks[] required');const r=await db.prepare('SELECT id,lock_time FROM rounds WHERE round_number=?').bind(rn).first();if(!r)return E('Round not found',404);if(r.lock_time&&new Date(r.lock_time)<new Date())return E('Round is locked',423);await db.prepare('DELETE FROM round_picks WHERE round_id=? AND coach_id=?').bind(r.id,ci).run();for(const pk of b.picks){await db.prepare('INSERT INTO round_picks (coach_id,round_id,player_id,slot,banter) VALUES (?,?,?,?,?)').bind(ci,r.id,pk.player_id,pk.slot,pk.banter||'').run()}return J({ok:true,count:b.picks.length})}}
// FIXED: /api/ladder adds coach_id alias so frontend can find coaches
if(p==='/api/ladder'&&m==='GET'){const{results}=await db.prepare("SELECT c.id, c.id AS coach_id, c.name,c.team_name,c.color,c.avatar_emoji,c.logo_url,COUNT(s.id) AS played,COALESCE(SUM(CASE WHEN s.result='W' THEN 1 ELSE 0 END),0) AS wins,COALESCE(SUM(CASE WHEN s.result='L' THEN 1 ELSE 0 END),0) AS losses,COALESCE(SUM(CASE WHEN s.result='D' THEN 1 ELSE 0 END),0) AS draws,COALESCE(SUM(CASE WHEN s.result='W' THEN 4 WHEN s.result='D' THEN 2 ELSE 0 END),0) AS points,COALESCE(ROUND(SUM(s.points),1),0) AS points_for,COALESCE(ROUND(SUM(COALESCE(s.points_against,0)),1),0) AS points_against,COALESCE(ROUND(AVG(s.points),1),0) AS avg_score FROM coaches c LEFT JOIN scores s ON s.coach_id=c.id LEFT JOIN rounds r ON r.id=s.round_id AND r.round_number>0 WHERE s.id IS NULL OR r.id IS NOT NULL GROUP BY c.id ORDER BY points DESC,avg_score DESC,points_for DESC").all();return J(results)}
if(p==='/api/scores'&&m==='GET'){const rd=+u.searchParams.get('round')||+u.searchParams.get('round_id')||0;let q='SELECT s.id,s.coach_id,r.id AS round_id,r.round_number,s.points,s.opponent_id,s.result,s.match_name,COALESCE(s.points_against,0) AS points_against,COALESCE(s.max_score,0) AS max_score FROM scores s JOIN rounds r ON r.id=s.round_id';const ps=[];if(rd){const useRoundId=new URL(req.url).searchParams.has('round_id');if(useRoundId){q+=' WHERE s.round_id=?';ps.push(rd)}else{q+=' WHERE r.round_number=?';ps.push(rd)}}q+=' ORDER BY r.round_number,s.points DESC';const{results}=await db.prepare(q).bind(...ps).all();return J(results)}
if(p==='/api/scores'&&m==='POST'){const b=await R(req);const{coach_id,round_id,points,result,opponent_id,points_against,max_score}=b;if(!coach_id||!round_id||points==null)return E('coach_id,round_id,points required');await db.prepare('INSERT OR REPLACE INTO scores (coach_id,round_id,points,result,opponent_id,points_against,max_score) VALUES (?,?,?,?,?,?,?)').bind(coach_id,round_id,points,result||null,opponent_id||null,points_against??0,max_score??0).run();return J({ok:true})}
// FIXED: auto_pick - opponent multiplier now uses actual pts conceded per AFL team
if(p==='/api/auto_pick'&&m==='GET'){
  const cid=+u.searchParams.get('coach_id')||0;
  const rid=+u.searchParams.get('round_id')||0;
  if(!cid||!rid)return E('coach_id and round_id required');
  const round=await db.prepare("SELECT id,round_number FROM rounds WHERE id=?").bind(rid).first();
  if(!round)return E('round not found');
  const{results:roster}=await db.prepare("SELECT p.id,p.name,p.team,p.position,p.champid,p.coach_id,p.active FROM players p WHERE p.coach_id=? AND COALESCE(p.active,1)=1").bind(cid).all();
  const{results:stats}=await db.prepare("SELECT prs.player_id,prs.round_id,prs.fantasy_pts FROM player_round_stats prs WHERE prs.round_id<? AND prs.player_id IN (SELECT id FROM players WHERE coach_id=?) ORDER BY prs.round_id DESC").bind(rid,cid).all();
  const{results:injuriesAll}=await db.prepare("SELECT player_id,injury,estimated_return FROM injury_list").all();
  const injured=new Set();
  for(const i of injuriesAll){if(i.injury&&!/test/i.test(i.estimated_return||''))injured.add(i.player_id)}
  // === AFL fixture filter + opponent strength ===
  // Pull Squiggle fixtures for this round
  const sqResp=await fetch('https://api.squiggle.com.au/?q=games;year=2026;round='+round.round_number,{headers:{'User-Agent':'SLY-Auto-Pick/1.0'}});
  const sqJson=sqResp.ok?await sqResp.json().catch(()=>({})):{};
  const games=Array.isArray(sqJson.games)?sqJson.games:[];
  // Normalise team names: map shorthand to canonical
  const teamCanon={'CARL':'Carlton','FRE':'Fremantle','HAW':'Hawthorn','MELB':'Melbourne','NM':'North Melbourne','PA':'Port Adelaide','RICH':'Richmond','WB':'Western Bulldogs','WCE':'West Coast Eagles','GWS GIANTS':'Greater Western Sydney','GWS':'Greater Western Sydney','Gold Coast SUNS':'Gold Coast','Sydney Swans':'Sydney','Adelaide Crows':'Adelaide','Brisbane Lions':'Brisbane','Geelong Cats':'Geelong','West Coast Eagles':'West Coast','Western Bulldogs':'Western Bulldogs'};
  const canon=name=>teamCanon[name]||name;
  // Build playing-this-round + opponent map
  const teamOpp={};const playingTeams=new Set();
  for(const g of games){
    const h=canon(g.hteam||''),a=canon(g.ateam||'');
    if(h){playingTeams.add(h);teamOpp[h]=a;}
    if(a){playingTeams.add(a);teamOpp[a]=h;}
  }
  // FIXED: Compute teamConceded = avg fantasy pts scored BY players AGAINST each AFL team
  // Fetch Squiggle fixtures for all past rounds in parallel to build a round->opponent map
  const currentRoundNum=round.round_number;
  const pastRoundNums=[];for(let r=1;r<currentRoundNum;r++)pastRoundNums.push(r);
  let teamConceded={},overallConceded=60;
  if(pastRoundNums.length>0){
    const fixtureReqs=pastRoundNums.map(r=>fetch('https://api.squiggle.com.au/?q=games;year=2026;round='+r,{headers:{'User-Agent':'SLY-Auto-Pick/1.0'}}).then(res=>res.ok?res.json().catch(()=>({})):{}).then(d=>({rnd:r,games:Array.isArray(d.games)?d.games:[]})));
    const allFix=await Promise.all(fixtureReqs);
    const roundOpp={};
    for(const{rnd,games:gs} of allFix){roundOpp[rnd]={};for(const g of gs){const h=canon(g.hteam||''),a=canon(g.ateam||'');if(h){roundOpp[rnd][h]=a;}if(a){roundOpp[rnd][a]=h;}}}
    const{results:allHistStats}=await db.prepare("SELECT prs.player_id,prs.fantasy_pts,r.round_number,p.team FROM player_round_stats prs JOIN rounds r ON r.id=prs.round_id JOIN players p ON p.id=prs.player_id WHERE r.round_number<?").bind(currentRoundNum).all();
    const cSum={},cCnt={};
    for(const s of allHistStats){const opp=roundOpp[s.round_number]&&roundOpp[s.round_number][canon(s.team||'')];if(!opp)continue;cSum[opp]=(cSum[opp]||0)+(s.fantasy_pts||0);cCnt[opp]=(cCnt[opp]||0)+1;}
    for(const t of Object.keys(cSum)){teamConceded[t]=cCnt[t]?cSum[t]/cCnt[t]:0;}
    const cv=Object.values(teamConceded);if(cv.length)overallConceded=cv.reduce((a,b)=>a+b,0)/cv.length;
  }
  const byP={};
  for(const s of stats){
    if(!byP[s.player_id])byP[s.player_id]={recent:[],all:[]};
    byP[s.player_id].all.push(s.fantasy_pts||0);
    if(byP[s.player_id].recent.length<3)byP[s.player_id].recent.push(s.fantasy_pts||0);
  }
  function expectedPts(p){
    const d=byP[p.id];if(!d||!d.all.length)return 30;
    const recentAvg=d.recent.length?d.recent.reduce((a,b)=>a+b,0)/d.recent.length:0;
    const careerAvg=d.all.reduce((a,b)=>a+b,0)/d.all.length;
    let base=recentAvg*0.7+careerAvg*0.3;
    // FIXED: use teamConceded (pts scored AGAINST each team) not teamAvg
    // High conceded ratio = weak defense = boost player; mult > 1 when opponent concedes more than avg
    const opp=teamOpp[canon(p.team||'')];
    if(opp&&teamConceded[opp]){const ratio=teamConceded[opp]/overallConceded;const mult=1+(ratio-1)*0.15;return base*Math.max(0.85,Math.min(1.15,mult));}
    return base;
  }
  const fwd=p=>['KEY_FORWARD','MEDIUM_FORWARD','MIDFIELDER_FORWARD'].includes(p.position);
  const mid=p=>['MIDFIELDER','MID','MIDFIELDER_FORWARD'].includes(p.position);
  const def=p=>['KEY_DEFENDER','MEDIUM_DEFENDER'].includes(p.position);
  const ruck=p=>p.position==='RUCK';
  const elig={SG:fwd,G1:fwd,G2:fwd,R:ruck,M:mid,T:mid,D1:def,D2:def,E1:p=>true,E2:p=>true,E3:p=>true};
  const SLOTS=['SG','G1','G2','R','M','T','D1','D2','E1','E2','E3'];
  // Eligible: not injured AND their AFL team is playing this round
  const eligibleRoster=roster.filter(p=>{
    if(injured.has(p.id))return false;
    if(games.length===0)return true;
    return playingTeams.has(canon(p.team||''));
  });
  const ranked=eligibleRoster.map(p=>({p,score:expectedPts(p)})).sort((a,b)=>b.score-a.score);
  const lineup={},used=new Set();
  for(const slot of SLOTS.filter(s=>!s.startsWith('E'))){
    for(const{p,score} of ranked){
      if(used.has(p.id))continue;
      if(elig[slot](p)){lineup[slot]={player_id:p.id,name:p.name,position:p.position,team:p.team,opponent:teamOpp[canon(p.team||'')]||null,expected:Math.round(score*10)/10,slot};used.add(p.id);break;}
    }
  }
  let emCount=0;
  for(const{p,score} of ranked){
    if(used.has(p.id))continue;
    if(emCount>=3)break;
    const slot='E'+(emCount+1);
    lineup[slot]={player_id:p.id,name:p.name,position:p.position,team:p.team,opponent:teamOpp[canon(p.team||'')]||null,expected:Math.round(score*10)/10,slot};
    used.add(p.id);emCount++;
  }
  const total=Object.values(lineup).reduce((a,l)=>a+(l?.expected||0),0);
  const injuredOnRoster=roster.filter(p=>injured.has(p.id)).map(p=>({player_id:p.id,name:p.name,position:p.position}));
  const onByeOnRoster=roster.filter(p=>!injured.has(p.id)&&games.length>0&&!playingTeams.has(canon(p.team||''))).map(p=>({player_id:p.id,name:p.name,team:p.team}));
  return J({ok:true,coach_id:cid,round_id:rid,lineup,projected_total:Math.round(total*10)/10,roster_size:roster.length,available:eligibleRoster.length,injured_excluded:injuredOnRoster,not_playing_excluded:onByeOnRoster,fixtures_count:games.length,used:used.size});
}
if(p==='/api/auto_pick'&&m==='POST'){
  const b=await R(req);
  const cid=+b.coach_id,rid=+b.round_id;
  if(!cid||!rid)return E('coach_id and round_id required');
  const eng=await fetch(new URL('/api/auto_pick?coach_id='+cid+'&round_id='+rid,u.origin).toString());
  const data=await eng.json();
  if(!data.ok)return J(data);
  const stmts=[db.prepare('DELETE FROM round_picks WHERE round_id=? AND coach_id=?').bind(rid,cid)];
  for(const slot of Object.keys(data.lineup)){
    const l=data.lineup[slot];
    if(!l)continue;
    stmts.push(db.prepare('INSERT INTO round_picks (coach_id,round_id,player_id,slot,banter) VALUES (?,?,?,?,?)').bind(cid,rid,l.player_id,slot,'auto'));
  }
  await db.batch(stmts);
  return J({ok:true,coach_id:cid,round_id:rid,picks_saved:Object.keys(data.lineup).length,lineup:data.lineup,projected_total:data.projected_total})
}
if(p==='/api/coaches/auto_pick'&&m==='PATCH'){
  const b=await R(req);
  if(!b.coach_id)return E('coach_id required');
  await db.prepare('UPDATE coaches SET auto_pick_enabled=? WHERE id=?').bind(b.enabled?1:0,b.coach_id).run();
  return J({ok:true})
}
if(p==='/api/_admin/replace'&&m==='POST'){const b=await R(req);const{table,delete_all=false,delete_where=null,rows=[]}=b;if(!table||!rows.length)return E('table and rows[] required');const allowed=['activity_feed','draft_picks','swap_requests','round_picks','player_round_stats','sly_fixtures','team_selection_meta','injury_list'];if(!allowed.includes(table))return E('table not allowed');const cols=Object.keys(rows[0]);const stmts=[];if(delete_all){stmts.push(db.prepare('DELETE FROM '+table))}else if(delete_where){stmts.push(db.prepare('DELETE FROM '+table+' WHERE '+delete_where))}for(const r of rows){const vals=cols.map(c=>r[c]);const placeholders=cols.map(()=>'?').join(',');stmts.push(db.prepare('INSERT OR REPLACE INTO '+table+' ('+cols.join(',')+') VALUES ('+placeholders+')').bind(...vals))}await db.batch(stmts);return J({ok:true,table,inserted:rows.length})}
if(p==='/api/picks/_bulk'&&m==='POST'){const b=await R(req);const rows=Array.isArray(b)?b:(Array.isArray(b.rows)?b.rows:[]);if(!rows.length)return E('rows[] required (round_id,coach_id,player_id,slot)');const byKey={};for(const r of rows){if(!r.round_id||!r.coach_id||!r.player_id||!r.slot)continue;const k=r.round_id+'|'+r.coach_id;byKey[k]=byKey[k]||[];byKey[k].push(r)}const stmts=[];for(const k of Object.keys(byKey)){const[rid,cid]=k.split('|');stmts.push(db.prepare('DELETE FROM round_picks WHERE round_id=? AND coach_id=?').bind(+rid,+cid))}for(const r of rows){if(!r.round_id||!r.coach_id||!r.player_id||!r.slot)continue;stmts.push(db.prepare('INSERT INTO round_picks (coach_id,round_id,player_id,slot,banter) VALUES (?,?,?,?,?)').bind(r.coach_id,r.round_id,r.player_id,r.slot,r.banter||''))}await db.batch(stmts);return J({ok:true,inserted:rows.length,groups:Object.keys(byKey).length})}
if(p==='/api/stats'&&m==='POST'){const b=await R(req);const rows=Array.isArray(b)?b:(Array.isArray(b.rows)?b.rows:[b]);if(!rows.length)return E('rows[] required');const stmts=rows.filter(r=>r.player_id&&r.round_id).map(r=>db.prepare('INSERT OR REPLACE INTO player_round_stats (player_id,round_id,goals,behinds,marks,tackles,hitouts,disposals,fantasy_pts) VALUES (?,?,?,?,?,?,?,?,?)').bind(r.player_id,r.round_id,r.goals||0,r.behinds||0,r.marks||0,r.tackles||0,r.hitouts||0,r.disposals||0,r.fantasy_pts||0));await db.batch(stmts);return J({ok:true,inserted:stmts.length})}
if(p==='/api/stats'&&m==='GET'){const rd=+u.searchParams.get('round_id')||0,rn=+u.searchParams.get('round')||0,pl=u.searchParams.get('player');let q='SELECT * FROM player_round_stats WHERE 1=1';const ps=[];if(rd){q+=' AND round_id=?';ps.push(rd)}else if(rn){const rr=await db.prepare('SELECT id FROM rounds WHERE round_number=?').bind(rn).first();if(rr){q+=' AND round_id=?';ps.push(rr.id)}}if(pl){q+=' AND player_id=?';ps.push(pl)}q+=' LIMIT 5000';const{results}=await db.prepare(q).bind(...ps).all();return J(results)}
if(p==='/api/config'&&m==='GET'){const DEFAULTS={'sly_gold':{price:50,features:['Auto-submit team each week','Auto-draft for you','AI recommendations','Best-for-team sort','Gold badge ⭐','Early access']}};const key=u.searchParams.get('key');if(key){let row=null;try{row=await db.prepare('SELECT value FROM config WHERE key=?').bind(key).first()}catch(e){}if(!row)try{row=await db.prepare('SELECT value FROM sly_config WHERE key=?').bind(key).first()}catch(e){}if(row?.value){try{return J({key,value:JSON.parse(row.value)})}catch(e){return J({key,value:row.value})}}return J(DEFAULTS[key]?{key,value:DEFAULTS[key]}:null)}let cfg={...DEFAULTS};try{const a=await db.prepare('SELECT key,value FROM config').all();for(const r of(a.results||[]))cfg[r.key]=r.value}catch(e){}try{const b=await db.prepare('SELECT key,value FROM sly_config').all();for(const r of(b.results||[]))cfg[r.key]=r.value}catch(e){}return J(cfg)}
if(p==='/api/injuries'&&m==='GET'){const row=await db.prepare("SELECT value FROM config WHERE key='injuries'").first();if(!row?.value)return J([]);try{return J(JSON.parse(row.value))}catch{return J([])}}
if(p==='/api/payments'&&m==='GET'){const{results}=await db.prepare("SELECT c.id,c.id AS coach_id,c.name,c.team_name,c.color,c.avatar_emoji,c.logo_url,COALESCE(p.paid,0) AS paid,COALESCE(p.amount,50) AS amount,COALESCE(p.tier,'base') AS tier,COALESCE(p.gold_balance,0) AS gold_balance,p.note,p.updated_at FROM coaches c LEFT JOIN payments p ON p.coach_id=c.id ORDER BY c.id").all();return J(results)}
const paym=p.match(/^\/api\/payments\/(\d+)$/);if(paym&&m==='PATCH'){const ci=+paym[1];const b=await R(req);const s=[],v=[];for(const k of ['paid','amount','note','tier','gold_balance'])if(k in b){s.push(`${k}=?`);v.push(b[k])}if(!s.length)return E('No fields');s.push("updated_at=datetime('now')");v.push(ci);await db.prepare('INSERT OR IGNORE INTO payments (coach_id,paid,amount) VALUES (?,0,50)').bind(ci).run();await db.prepare(`UPDATE payments SET ${s.join(',')} WHERE coach_id=?`).bind(...v).run();return J({ok:true})}
if(p==='/api/trades'&&m==='GET'){const{results}=await db.prepare('SELECT t.*,p.name AS proposer_name,tg.name AS target_name FROM trades t LEFT JOIN coaches p ON p.id=t.proposer_id LEFT JOIN coaches tg ON tg.id=t.target_id ORDER BY t.created_at DESC').all();for(const t of results||[]){const tp=await db.prepare('SELECT * FROM trade_players WHERE trade_id=?').bind(t.id).all();t.players=tp.results||[];t.trade_players=tp.results||[]}return J(results)}
const tradm=p.match(/^\/api\/trades\/(\d+)$/);if(tradm&&m==='PATCH'){const id=+tradm[1];const b=await R(req);if(!b.status)return E('status required');await db.prepare('UPDATE trades SET status=? WHERE id=?').bind(b.status,id).run();return J({ok:true})}
if(p==='/api/trades'&&m==='POST'){const b=await R(req);const{proposer_id,target_id,outgoing=[],incoming=[],message}=b;if(!proposer_id||!target_id)return E('proposer_id,target_id required');const tr=await db.prepare("INSERT INTO trades (proposer_id,target_id,status,message,created_at) VALUES (?,?,'pending',?,datetime('now'))").bind(proposer_id,target_id,message||'').run();const tid=tr.meta?.last_row_id;for(const pid of outgoing)await db.prepare('INSERT INTO trade_players (trade_id,player_id,direction) VALUES (?,?,?)').bind(tid,pid,'outgoing').run();for(const pid of incoming)await db.prepare('INSERT INTO trade_players (trade_id,player_id,direction) VALUES (?,?,?)').bind(tid,pid,'incoming').run();return J({ok:true,id:tid})}
if(p==='/api/messages'&&m==='GET'){const rm=+u.searchParams.get('room')||1;const{results}=await db.prepare("SELECT m.*,c.name AS coach_name,c.team_name,c.color FROM messages m LEFT JOIN coaches c ON c.id=m.coach_id WHERE m.room_id=? ORDER BY m.created_at DESC LIMIT 200").bind(rm).all();return J(results)}
if(p==='/api/messages'&&m==='POST'){const b=await R(req);const{coach_id,content,room_id=1}=b;if(!coach_id||!content)return E('coach_id,content required');await db.prepare("INSERT INTO messages (coach_id,room_id,content,created_at) VALUES (?,?,?,datetime('now'))").bind(coach_id,room_id,content).run();return J({ok:true})}
const msgRxm=p.match(/^\/api\/messages\/reactions$/);if(msgRxm&&m==='GET'){const ids=(u.searchParams.get('message_ids')||'').split(',').map(Number).filter(Boolean);if(!ids.length)return J([]);const ph=ids.map(()=>'?').join(',');const{results}=await db.prepare(`SELECT * FROM message_reactions WHERE message_id IN (${ph})`).bind(...ids).all();return J(results||[])}
const msgRm=p.match(/^\/api\/messages\/(\d+)\/reactions$/);if(msgRm&&m==='POST'){const mid=+msgRm[1];const{coach_id,emoji}=await R(req);if(!coach_id||!emoji)return E('coach_id,emoji required');const ex=await db.prepare('SELECT id FROM message_reactions WHERE message_id=? AND coach_id=? AND emoji=?').bind(mid,coach_id,emoji).first();if(ex){await db.prepare('DELETE FROM message_reactions WHERE id=?').bind(ex.id).run()}else{await db.prepare("INSERT INTO message_reactions (message_id,coach_id,emoji,created_at) VALUES (?,?,?,datetime('now'))").bind(mid,coach_id,emoji).run()}return J({ok:true})}
// FIXED: /api/sly-fixtures now returns home_score and away_score
if(p.startsWith('/api/sly-fixtures')){
  const sfm=p.match(/^\/api\/sly-fixtures\/(\d+)$/);
  if(sfm&&m==='PATCH'){const id=+sfm[1];const b=await R(req);const s=[],v=[];for(const k of ['match_name'])if(k in b){s.push(`${k}=?`);v.push(b[k])}if(!s.length)return E('No fields');v.push(id);await db.prepare(`UPDATE sly_fixtures SET ${s.join(',')} WHERE id=?`).bind(...v).run();return J({ok:true})}
  if(m==='GET'){
    const rid=+u.searchParams.get('round_id')||0,rn=+u.searchParams.get('round')||0,ci=+u.searchParams.get('coach_id')||+u.searchParams.get('coach')||0;
    let roundNum=rn;
    if(rid&&!rn){const rr=await db.prepare('SELECT round_number FROM rounds WHERE id=?').bind(rid).first();if(rr)roundNum=rr.round_number}
    let q='SELECT f.id,f.round_number,f.home_coach_id,f.away_coach_id,f.match_name,h.name AS home_name,h.team_name AS home_team,h.color AS home_color,h.logo_url AS home_logo,a.name AS away_name,a.team_name AS away_team,a.color AS away_color,a.logo_url AS away_logo,(SELECT s.points FROM scores s JOIN rounds rr ON rr.id=s.round_id WHERE s.coach_id=f.home_coach_id AND rr.round_number=f.round_number) AS home_score,(SELECT s.points FROM scores s JOIN rounds rr ON rr.id=s.round_id WHERE s.coach_id=f.away_coach_id AND rr.round_number=f.round_number) AS away_score FROM sly_fixtures f LEFT JOIN coaches h ON h.id=f.home_coach_id LEFT JOIN coaches a ON a.id=f.away_coach_id';
    const ps=[];const conds=[];
    if(roundNum){conds.push('f.round_number=?');ps.push(roundNum)}
    if(ci){conds.push('(f.home_coach_id=? OR f.away_coach_id=?)');ps.push(ci,ci)}
    if(conds.length)q+=' WHERE '+conds.join(' AND ');
    q+=' ORDER BY f.round_number,f.id';
    const{results}=await db.prepare(q).bind(...ps).all();return J(results)
  }
}
if(p==='/api/draft-picks'&&m==='GET'){const co=+u.searchParams.get('coach')||+u.searchParams.get('coach_id')||0;let q='SELECT dp.*,p.name AS player_name,p.team AS player_team,p.position AS player_position FROM draft_picks dp LEFT JOIN players p ON p.id=dp.player_id';const ps=[];if(co){q+=' WHERE dp.coach_id=?';ps.push(co)}q+=' ORDER BY dp.overall_pick';const{results}=await db.prepare(q).bind(...ps).all();return J(results)}
if(p==='/api/activity-feed'&&m==='GET'){const lm=+u.searchParams.get('limit')||100;const{results}=await db.prepare('SELECT a.*,c.name AS actor_name,c.team_name,c.color,c.avatar_emoji FROM activity_feed a LEFT JOIN coaches c ON c.id=a.actor_id ORDER BY a.created_at DESC LIMIT ?').bind(lm).all();return J(results||[])}
if(p==='/api/swap-requests'&&m==='GET'){const{results}=await db.prepare('SELECT s.*,c.name AS coach_name,c.team_name FROM swap_requests s LEFT JOIN coaches c ON c.id=s.coach_id ORDER BY s.created_at DESC').all();return J(results||[])}

if(p==='/api/rooms'){
  if(m==='GET'){
    const cid=+u.searchParams.get('coach_id')||0;
    if(!cid)return E('coach_id required');
    const{results}=await db.prepare("SELECT r.id,r.name,r.type,r.created_by,r.encryption_enabled,(SELECT COUNT(*) FROM room_members WHERE room_id=r.id) AS member_count,(SELECT m.content FROM messages m WHERE m.room_id=r.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,(SELECT m.created_at FROM messages m WHERE m.room_id=r.id ORDER BY m.created_at DESC LIMIT 1) AS last_at FROM chat_rooms r JOIN room_members rm ON rm.room_id=r.id WHERE rm.coach_id=? ORDER BY last_at DESC,r.id").bind(cid).all();
    return J(results)
  }
  if(m==='POST'){
    const b=await R(req);
    const{name,type='group',created_by,member_ids=[],encryption_enabled=0}=b;
    if(!created_by)return E('created_by required');
    const r=await db.prepare("INSERT INTO chat_rooms (name,type,created_by,encryption_enabled) VALUES (?,?,?,?)").bind(name||null,type,created_by,encryption_enabled?1:0).run();
    const rid=r.meta?.last_row_id;
    const all=[created_by,...member_ids.filter(x=>x!=created_by)];
    for(const cid of all){await db.prepare("INSERT OR IGNORE INTO room_members (room_id,coach_id) VALUES (?,?)").bind(rid,cid).run()}
    return J({ok:true,id:rid})
  }
}
const rmm=p.match(/^\/api\/rooms\/(\d+)\/members$/);
if(rmm&&m==='GET'){const rid=+rmm[1];const{results}=await db.prepare("SELECT rm.coach_id,c.name,c.team_name,c.color,c.logo_url,c.avatar_emoji FROM room_members rm JOIN coaches c ON c.id=rm.coach_id WHERE rm.room_id=?").bind(rid).all();return J(results)}
if(rmm&&m==='POST'){const rid=+rmm[1];const b=await R(req);const cids=Array.isArray(b.coach_ids)?b.coach_ids:[b.coach_id];for(const cid of cids){await db.prepare("INSERT OR IGNORE INTO room_members (room_id,coach_id) VALUES (?,?)").bind(rid,cid).run()}return J({ok:true,added:cids.length})}
const rmd=p.match(/^\/api\/rooms\/(\d+)\/members\/(\d+)$/);
if(rmd&&m==='DELETE'){await db.prepare("DELETE FROM room_members WHERE room_id=? AND coach_id=?").bind(+rmd[1],+rmd[2]).run();return J({ok:true})}
const dmm=p.match(/^\/api\/dm\/(\d+)\/(\d+)$/);
if(dmm&&m==='GET'){const a=+dmm[1],b=+dmm[2];if(a===b)return E('cannot DM yourself');const lo=Math.min(a,b),hi=Math.max(a,b);const dmName='dm:'+lo+':'+hi;let row=await db.prepare("SELECT id FROM chat_rooms WHERE type='private' AND name=?").bind(dmName).first();if(!row){const r=await db.prepare("INSERT INTO chat_rooms (name,type,created_by,encryption_enabled) VALUES (?,?,?,1)").bind(dmName,'private',a).run();const rid=r.meta?.last_row_id;await db.prepare("INSERT INTO room_members (room_id,coach_id) VALUES (?,?)").bind(rid,a).run();await db.prepare("INSERT INTO room_members (room_id,coach_id) VALUES (?,?)").bind(rid,b).run();row={id:rid}}return J({ok:true,room_id:row.id})}
if(p==='/api/coach_keys'){if(m==='GET'){const{results}=await db.prepare("SELECT coach_id,public_key FROM coach_keys").all();return J(results)}if(m==='POST'){const b=await R(req);if(!b.coach_id||!b.public_key)return E('coach_id,public_key required');await db.prepare("INSERT OR REPLACE INTO coach_keys (coach_id,public_key) VALUES (?,?)").bind(b.coach_id,b.public_key).run();return J({ok:true})}}
const ckm=p.match(/^\/api\/coach_keys\/(\d+)$/);
if(ckm&&m==='GET'){const row=await db.prepare("SELECT coach_id,public_key FROM coach_keys WHERE coach_id=?").bind(+ckm[1]).first();return J(row||null)}

if(p==='/api/picks/rollover'&&m==='POST'){
  const b=await R(req);
  const rn=+b.round_number;
  if(!rn)return E('round_number required');
  const auth=(req.headers.get('Authorization')||'').replace('Bearer ','');
  const migTok=env.MIGRATION_TOKEN||'SLY_MIGRATION_2026_04_25';
  if(auth!==migTok)return E('Unauthorized',401);
  const round=await db.prepare('SELECT id,round_number FROM rounds WHERE round_number=?').bind(rn).first();
  if(!round)return E('Round not found',404);
  const prevRound=await db.prepare('SELECT id FROM rounds WHERE round_number=?').bind(rn-1).first();
  if(!prevRound)return E('Previous round not found',404);
  const{results:coaches}=await db.prepare('SELECT id,name FROM coaches').all();
  const{results:existingPicks}=await db.prepare('SELECT DISTINCT coach_id FROM round_picks WHERE round_id=?').bind(round.id).all();
  const hasPicksSet=new Set(existingPicks.map(pk=>pk.coach_id));
  const missing=coaches.filter(c=>!hasPicksSet.has(c.id));
  if(!missing.length)return J({ok:true,message:'All coaches already have picks',rolledover:[]});
  const rolledover=[];const stmts=[];
  for(const coach of missing){
    const{results:prevPicks}=await db.prepare('SELECT player_id,slot FROM round_picks WHERE round_id=? AND coach_id=?').bind(prevRound.id,coach.id).all();
    if(!prevPicks.length){rolledover.push({coach_id:coach.id,name:coach.name,status:'no_prev_picks',count:0});continue;}
    for(const pk of prevPicks){stmts.push(db.prepare('INSERT OR IGNORE INTO round_picks (coach_id,round_id,player_id,slot,banter) VALUES (?,?,?,?,?)').bind(coach.id,round.id,pk.player_id,pk.slot,'auto-rollover'));}
    rolledover.push({coach_id:coach.id,name:coach.name,status:'rolledover',count:prevPicks.length});
  }
  if(stmts.length)await db.batch(stmts);
  return J({ok:true,round_number:rn,rolledover,total_rolledover:rolledover.filter(r=>r.status==='rolledover').length});
}
return E('Not found',404)
}catch(e){return E(e.message||String(e),500)}
}};