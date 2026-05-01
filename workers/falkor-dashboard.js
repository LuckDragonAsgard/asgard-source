// falkor-dashboard v2.0.0 — Luck Dragon Ventures Dashboard
// 50 projects, $7M Y5 pipeline, server-side PIN auth

const VERSION = '2.0.0';
const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>🐉 Luck Dragon Ventures</title>
<style>
:root{--bg:#0a0f1a;--surface:#111827;--surface2:#1e2a3a;--border:rgba(255,255,255,.07);--text:#e2e8f0;--muted:#64748b;--green:#22c55e;--red:#ef4444;--yellow:#f59e0b;--indigo:#6366f1;--blue:#0ea5e9;--accent:#6366f1}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh}
#pin-screen{display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:20px;background:radial-gradient(ellipse at center,#1a0a2e 0%,var(--bg) 70%)}
.pin-logo{font-size:4rem}.pin-title{font-size:1.6rem;font-weight:800;letter-spacing:-.02em}
.pin-sub{color:var(--muted);font-size:.9rem;margin-top:4px}
#pin-input{background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:12px;padding:14px 20px;font-size:1.1rem;width:260px;text-align:center;letter-spacing:.3em;outline:none;transition:border .2s}
#pin-input:focus{border-color:var(--accent)}
#pin-btn{background:var(--accent);color:#fff;border:none;border-radius:12px;padding:14px 32px;font-size:1rem;font-weight:700;cursor:pointer;width:260px;transition:opacity .2s}
#pin-btn:hover{opacity:.85}
#pin-error{color:var(--red);font-size:.85rem;display:none}
#main{display:none}
.topbar{background:var(--surface);border-bottom:1px solid var(--border);padding:14px 24px;display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:20}
.topbar-logo{font-size:1.3rem;font-weight:800;flex:1}.topbar-logo span{color:var(--accent)}
.ts{text-align:right}.ts-val{font-size:1.1rem;font-weight:800;color:var(--green)}.ts-label{font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.topbar-stats{display:flex;gap:20px}
.topbar-search{background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px 14px;font-size:.88rem;width:220px;outline:none}
.topbar-search::placeholder{color:var(--muted)}
.summary{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;padding:20px 24px 0}
.sum-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 16px}
.sum-card .yr{font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
.sum-card .val{font-size:1.3rem;font-weight:800;color:var(--green)}
.filters{padding:16px 24px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.filter-btn{background:var(--surface2);border:1px solid var(--border);color:var(--muted);border-radius:20px;padding:5px 14px;font-size:.8rem;cursor:pointer;transition:all .15s}
.filter-btn:hover,.filter-btn.active{background:var(--accent);border-color:var(--accent);color:#fff}
.projects{padding:0 24px 40px;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;cursor:pointer;transition:transform .15s,border-color .15s}
.card:hover{transform:translateY(-2px);border-color:var(--accent)}
.card-header{display:flex;align-items:flex-start;gap:10px;margin-bottom:8px}
.card-name{font-weight:700;font-size:.95rem;flex:1;line-height:1.3}
.card-status{font-size:.68rem;font-weight:700;padding:3px 8px;border-radius:20px;text-transform:uppercase;white-space:nowrap}
.card-cat{font-size:.75rem;color:var(--muted);margin-bottom:8px}
.card-desc{font-size:.8rem;color:#94a3b8;line-height:1.5;margin-bottom:10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.card-revenue{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px}
.rev-item{background:var(--surface2);border-radius:7px;padding:6px 8px;text-align:center}
.rev-yr{font-size:.65rem;color:var(--muted);text-transform:uppercase}
.rev-val{font-size:.85rem;font-weight:800;color:var(--green)}
.card-progress{height:3px;background:var(--surface2);border-radius:2px;margin-bottom:8px}
.card-progress-bar{height:100%;border-radius:2px;background:var(--accent)}
.card-footer{display:flex;align-items:center;justify-content:space-between}
.card-pct{font-size:.75rem;color:var(--muted)}
.card-link{font-size:.75rem;color:var(--accent);text-decoration:none}
.live-dot{width:7px;height:7px;border-radius:50%;background:var(--green);display:inline-block;margin-right:5px;box-shadow:0 0 6px var(--green)}
.no-results{grid-column:1/-1;text-align:center;padding:60px;color:var(--muted)}
#modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:100;align-items:center;justify-content:center;padding:20px}
#modal-overlay.open{display:flex}
.modal{background:var(--surface);border:1px solid var(--border);border-radius:18px;width:100%;max-width:600px;max-height:85vh;overflow-y:auto;padding:28px}
.modal-close{float:right;background:none;border:none;color:var(--muted);font-size:1.4rem;cursor:pointer;margin-top:-8px}
.modal-close:hover{color:var(--text)}
.modal h2{font-size:1.4rem;font-weight:800;margin-bottom:4px}
.modal-cat{font-size:.8rem;color:var(--muted);margin-bottom:16px}
.modal-rev-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:20px}
.modal-rev{background:var(--surface2);border-radius:9px;padding:10px;text-align:center}
.modal-rev .yr{font-size:.68rem;color:var(--muted);text-transform:uppercase}
.modal-rev .amt{font-size:1rem;font-weight:800;color:var(--green)}
.modal section{margin-bottom:16px}
.modal section h3{font-size:.8rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:6px}
.modal section p,.modal section a{font-size:.88rem;line-height:1.6}
.modal section a{color:var(--accent)}
.prog-row{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.prog-bar{flex:1;height:8px;background:var(--surface2);border-radius:4px}
.prog-fill{height:100%;border-radius:4px;background:var(--accent)}
.prog-pct{font-size:.85rem;font-weight:700;color:var(--accent);width:36px;text-align:right}
@media(max-width:700px){.summary{grid-template-columns:repeat(3,1fr)}.projects{grid-template-columns:1fr}.topbar-stats{display:none}.topbar-search{width:130px}.modal-rev-grid{grid-template-columns:repeat(3,1fr)}}
</style>
</head>
<body>
<div id="pin-screen">
  <div class="pin-logo">🐉</div>
  <div class="pin-title">Luck Dragon Ventures</div>
  <div class="pin-sub">50 projects &middot; $7M pipeline</div>
  <input id="pin-input" type="password" placeholder="Enter PIN" maxlength="30" autocomplete="off">
  <button id="pin-btn" onclick="checkPin()">Unlock</button>
  <div id="pin-error">Incorrect PIN. Try again.</div>
</div>
<div id="main">
  <div class="topbar">
    <div class="topbar-logo">🐉 Luck Dragon <span>Ventures</span></div>
    <div class="topbar-stats">
      <div class="ts"><div class="ts-val" id="stat-y1">-</div><div class="ts-label">Y1</div></div>
      <div class="ts"><div class="ts-val" id="stat-y3">-</div><div class="ts-label">Y3</div></div>
      <div class="ts"><div class="ts-val" id="stat-y5">-</div><div class="ts-label">Y5</div></div>
    </div>
    <input class="topbar-search" id="search" type="text" placeholder="Search projects..." oninput="renderGrid()">
  </div>
  <div class="summary" id="sum"></div>
  <div class="filters" id="filters"></div>
  <div class="projects" id="grid"></div>
</div>
<div id="modal-overlay" onclick="closeModal(event)"><div class="modal" id="modal-body"></div></div>
<script>
const PROJECTS=[{"id":53,"project_name":"Family Hub","category":"Social / Family","status":"in_progress","live_url":"https://family-hub.pgallivan.workers.dev","description":"Private family social network \\u2014 replaces WhatsApp/Instagram for families. Baby spam posts, family & personal chats, birthday/presents tracking, holiday photos, Christmas KK (Secret Santa), shared expense tracking (who owes who for presents, insurance, etc.), shared IDs/documents.","progress_pct":80,"revenue_y1":0,"revenue_y2":0,"revenue_y3":0,"revenue_y4":0,"revenue_y5":0,"income_priority":50,"next_action":"Send invite links to family \\u2014 each person clicks their link, picks a password, and they are in. Then test all v2 features end-to-end (chats, stories, events, transfers, vault).","key_features":"Family feed (baby spam / holiday photos), group & 1:1 chats, birthday + gift tracking, Christmas KK draw, shared expense ledger (presents / insurance / bills), secure ID/document vault","cash_spent":0,"cash_earned":0},{"id":39,"project_name":"Thats Fine Banh Mi","category":"domain","status":"idea","live_url":"https://thatsfinebahnmi.com","description":"Banh mi food business website. Online ordering, catering.","progress_pct":0,"revenue_y1":2000,"revenue_y2":3000,"revenue_y3":4000,"revenue_y4":5200,"revenue_y5":6400,"income_priority":12,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":11,"project_name":"School Sport Portal","category":"School / SaaS","status":"live","live_url":"https://schoolsportportal.com.au","description":"Combined institutional sport platform for Australian schools \\u2014 Williamstown District -> VIC -> national. Includes carnival management (athletics, swimming, cross country, multi-day), district-to-state pathway, real-time timing, results, house points, Stripe payments. Unifies prior District Sport, SportCarnival, SSV Sport Takeover, WPS Athletics 2026 into one product. Pricing: $1/student/year. AU TAM = 3.6M students (~$3.6M ceiling).","progress_pct":95,"revenue_y1":36000,"revenue_y2":180000,"revenue_y3":540000,"revenue_y4":1260000,"revenue_y5":2160000,"income_priority":10,"next_action":"VIC pilot rollout \\u2014 36k students ($1 each) Y1, scale to 5%, 15%, 35%, 60% of AU 3.6M by Y5","key_features":null,"cash_spent":0,"cash_earned":0},{"id":35,"project_name":"Going To Training","category":"domain","status":"idea","live_url":"https://goingtotraining.com","description":"Team sports training attendance and scheduling. One-tap RSVP.","progress_pct":0,"revenue_y1":4000,"revenue_y2":12000,"revenue_y3":24000,"revenue_y4":31200,"revenue_y5":38400,"income_priority":10,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":13,"project_name":"Hobsons Bay Dental App","category":"web app","status":"live","live_url":"https://v0-dental-loyalty-app.vercel.app","description":"Patient loyalty PWA. Dashboard, rewards, trivia quiz (40Q), health hub, HBD Express booking, referral system.","progress_pct":95,"revenue_y1":2400,"revenue_y2":6000,"revenue_y3":12000,"revenue_y4":15600,"revenue_y5":19200,"income_priority":10,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":34,"project_name":"Carousel","category":"domain","status":"idea","live_url":"https://clothescarousel.com","description":"Rotating wardrobe subscription. Rent, swap, subscribe to curated clothing.","progress_pct":0,"revenue_y1":6000,"revenue_y2":18000,"revenue_y3":36000,"revenue_y4":46800,"revenue_y5":57600,"income_priority":9,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":43,"project_name":"My Betting HQ","category":"web app","status":"idea","live_url":null,"description":"Universal betting bankroll manager and session tracker. Sport-agnostic.","progress_pct":0,"revenue_y1":6000,"revenue_y2":15000,"revenue_y3":30000,"revenue_y4":39000,"revenue_y5":48000,"income_priority":8,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":10,"project_name":"Long Range Tipping","category":"web app","status":"live","live_url":"https://longrangetipping.com","description":"AFL tipping platform \\u2014 198 games pre-round-1. Free, ad-free, auto-updating scores.","progress_pct":100,"revenue_y1":0,"revenue_y2":5000,"revenue_y3":24000,"revenue_y4":31200,"revenue_y5":38400,"income_priority":8,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":40,"project_name":"Judys Kitchen","category":"web app","status":"idea","live_url":null,"description":"Community recipe sharing platform. Recipe request marketplace.","progress_pct":0,"revenue_y1":0,"revenue_y2":5000,"revenue_y3":20000,"revenue_y4":26000,"revenue_y5":32000,"income_priority":8,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":32,"project_name":"Rooney Golf Tours","category":"web app","status":"live","live_url":"https://rooneygolftours.com.au","description":"Golf tours website.","progress_pct":100,"revenue_y1":18000,"revenue_y2":30000,"revenue_y3":54000,"revenue_y4":70200,"revenue_y5":86400,"income_priority":7,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":38,"project_name":"Practice Interview","category":"domain","status":"idea","live_url":"https://practiceinterview.com.au","description":"AI-powered mock interview platform for Australian job seekers. STAR method coaching.","progress_pct":0,"revenue_y1":8000,"revenue_y2":20000,"revenue_y3":40000,"revenue_y4":52000,"revenue_y5":64000,"income_priority":7,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":33,"project_name":"Booth Me Up","category":"domain","status":"idea","live_url":"https://boothmeup.com","description":"Photo booth hire and event booking platform. QR gallery sharing.","progress_pct":0,"revenue_y1":18000,"revenue_y2":36000,"revenue_y3":54000,"revenue_y4":70200,"revenue_y5":86400,"income_priority":6,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":21,"project_name":"WPS Staff Hub (CRT app \\u2014 parked)","category":"web app","status":"parked","live_url":"https://wps-staff-hub.pgallivan.workers.dev (broken snapshot)","description":"Original CRT/absence booking app for Williamstown Primary. Express server, Turso libSQL, SMS/email notifications. Was on Render \\u2192 Vercel \\u2192 snapshot to CF Worker. Backend currently non-functional; resurrect on Railway when needed.","progress_pct":90,"revenue_y1":1000,"revenue_y2":5040,"revenue_y3":23760,"revenue_y4":30888,"revenue_y5":38016,"income_priority":6,"next_action":"Rotate leaked Turso token on Turso dashboard (token was stripped from public repo HEAD on 2026-04-27 but still in git history). If reviving: railway up via existing Dockerfile + railway.json, set env vars, point custom domain.","key_features":"absence reporting, CRT booking, SMS via Twilio, email via SendGrid, JWT auth, web-push notifications, .docx upload","cash_spent":0,"cash_earned":0},{"id":37,"project_name":"Only Fans Trivia","category":"domain","status":"merged","live_url":"https://onlyfanstrivia.com","description":"Trivia subscription platform. Premium weekly packs. Creator program.","progress_pct":0,"revenue_y1":10000,"revenue_y2":20000,"revenue_y3":40000,"revenue_y4":52000,"revenue_y5":64000,"income_priority":5,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":4,"project_name":"Bulldogs Boat","category":"web app","status":"live","live_url":"https://bulldogsboat.com.au","description":"Western Bulldogs fan boat service to Marvel Stadium. Admin panel, Stripe payment links, passenger passport PDF.","progress_pct":100,"revenue_y1":6000,"revenue_y2":12000,"revenue_y3":18000,"revenue_y4":23400,"revenue_y5":28800,"income_priority":5,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":18,"project_name":"WCYMS Footy Club Hub","category":"web app","status":"archived","live_url":null,"description":"Williamstown CYMS footy club platform. PWA installable.","progress_pct":100,"revenue_y1":12700,"revenue_y2":80000,"revenue_y3":180000,"revenue_y4":234000,"revenue_y5":288000,"income_priority":3,"next_action":"Do not revive without fresh spec; see asgard-handovers/wcyms.md","key_features":null,"cash_spent":0,"cash_earned":0},{"id":17,"project_name":"Timing","category":"web app","status":"live","live_url":"https://carnivaltiming.com","description":"Standalone live timing app. Athletics, swimming, cross country, fun runs. Works offline. Real-time via Firebase.","progress_pct":80,"revenue_y1":15000,"revenue_y2":60000,"revenue_y3":150000,"revenue_y4":195000,"revenue_y5":240000,"income_priority":3,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":44,"project_name":"The Local","category":"web app","status":"live","live_url":"https://paddygallivan.github.io/TheLocal/","description":"Hyperlocal community platform for Williamstown. TheBoard, PackLeader, TableRoulette, NeedAHand.","progress_pct":100,"revenue_y1":8000,"revenue_y2":20000,"revenue_y3":50000,"revenue_y4":65000,"revenue_y5":80000,"income_priority":3,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":24,"project_name":"LessonLab","category":"web app","status":"live","live_url":"https://lessonlab.com.au","description":"931 lessons across 9 subjects. VIC Curriculum 2.0 F-6. Auth, cloud save, tier gating $12/mo.","progress_pct":85,"revenue_y1":20800,"revenue_y2":84000,"revenue_y3":216000,"revenue_y4":280800,"revenue_y5":345600,"income_priority":2,"next_action":"(1) Get PI + Cyber insurance \\u2014 BizCover. (2) Lodge Q1 BAS by 28 Jul 2026. (3) Trademark LessonLab on IP Australia ~$250 class 41. (4) Verify CF zone lessonlab.com.au activates. (5) Monitor first Stripe checkout has GST on invoice.","key_features":null,"cash_spent":0,"cash_earned":0},{"id":22,"project_name":"Save My Seat","category":"web app","status":"live","live_url":"https://www.savemyseat.au","description":"Stadium seat-holding PWA for footy fans. Scan QR/NFC on your seat.","progress_pct":100,"revenue_y1":8000,"revenue_y2":40000,"revenue_y3":120000,"revenue_y4":156000,"revenue_y5":192000,"income_priority":1,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":25,"project_name":"Sport Portal","category":"web app","status":"merged","live_url":"https://wps-athletics-2026.pages.dev","description":"School sport administration platform for Victorian schools. Eliminates $8.36M/yr in manual admin across 1,600 schools, 232 districts, 55 divisions, 16 regions. Four tools: SchoolSportPortal, SportCarnival, CarnivalTiming, SportPortal. $1/student/yr + $150/250/500 coordinator tiers.","progress_pct":80,"revenue_y1":512000,"revenue_y2":868000,"revenue_y3":1400000,"revenue_y4":2000000,"revenue_y5":3000000,"income_priority":0,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":14,"project_name":"SportCarnival","category":"web app","status":"merged","live_url":"https://sportcarnival.com.au","description":"School carnival management app. Athletics, swimming, cross country. Upsell into School Sport Portal.","progress_pct":60,"revenue_y1":10000,"revenue_y2":40000,"revenue_y3":100000,"revenue_y4":130000,"revenue_y5":160000,"income_priority":0,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":1,"project_name":"Project Hub","category":"tools","status":"merged","live_url":"https://paddygallivan.github.io/project-hub/","description":"Central project tracker. Database with 30+ projects. HTML dashboard auto-refreshes from live data.","progress_pct":85,"revenue_y1":0,"revenue_y2":0,"revenue_y3":0,"revenue_y4":0,"revenue_y5":0,"income_priority":0,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":2,"project_name":"Bomber Boat","category":null,"status":"live","live_url":"https://bomberboat.com.au","description":"Fan charter cruise for Essendon supporters to Marvel Stadium. v9.18. 3 vessel options, booking + payment via Stripe. Staff/Captain/Admin roles. DNS fixed (apex CNAME \\u2192 CF Pages). Round 8 active: Essendon v Brisbane Lions Sat 2 May 12:35pm. Register-interest section for future games. 8 home games in DB.","progress_pct":72,"revenue_y1":0,"revenue_y2":0,"revenue_y3":0,"revenue_y4":0,"revenue_y5":0,"income_priority":0,"next_action":"Instagram setup (upload bomberboat-profile.png, post bomberboat-post.png). FB group post Thu/Fri for Round 8. Liability insurance quotes (BizCover, Aon, CoverHero). Lawyer review ToS. Cancel sole trader ABN 78 312 753 967.","key_features":null,"cash_spent":0,"cash_earned":0},{"id":3,"project_name":"Thor","category":"historical","status":"archived","live_url":"https://thor.pgallivan.workers.dev","description":"Boss AI orchestrator. 24 tools. Strategic decisions.","progress_pct":100,"revenue_y1":0,"revenue_y2":0,"revenue_y3":0,"revenue_y4":0,"revenue_y5":0,"income_priority":0,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":5,"project_name":"Thunder-Dispatch (Teddy)","category":"historical","status":"archived","live_url":"https://teddy.pgallivan.workers.dev","description":"Gatekeeper AI \\u2014 handles routine, escalates strategic.","progress_pct":100,"revenue_y1":0,"revenue_y2":0,"revenue_y3":0,"revenue_y4":0,"revenue_y5":0,"income_priority":0,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":6,"project_name":"Thunder-Dev","category":"historical","status":"archived","live_url":"https://thunder-dev.pgallivan.workers.dev","description":"Dev AI \\u2014 code, deploys, bug checks across all projects.","progress_pct":100,"revenue_y1":0,"revenue_y2":0,"revenue_y3":0,"revenue_y4":0,"revenue_y5":0,"income_priority":0,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":7,"project_name":"KBT Platform","category":null,"status":"live","live_url":"https://kbt-trial.vercel.app/admin-app","description":"Consolidated KBT project: trivia tools, question development, host app. Includes KBT Web Apps, KBT Question Dev, KBT Tools, and Morris (KBT v2).","progress_pct":88,"revenue_y1":0,"revenue_y2":0,"revenue_y3":0,"revenue_y4":0,"revenue_y5":0,"income_priority":0,"next_action":"Test generateGoogleSlides() with event code TEST-002 in real browser (needs OAuth popup). Slide Gen pipeline verified against DB \\u2014 just needs user gesture.","key_features":null,"cash_spent":0,"cash_earned":0},{"id":8,"project_name":"Thunder-Watch","category":"historical","status":"archived","live_url":"https://thunder-watch.pgallivan.workers.dev","description":"Uptime monitoring AI. Telegram alerts.","progress_pct":100,"revenue_y1":0,"revenue_y2":0,"revenue_y3":0,"revenue_y4":0,"revenue_y5":0,"income_priority":0,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":9,"project_name":"KBT Question Development","category":"tools","status":"merged","live_url":"https://kbt-trial.vercel.app/question-dev","description":"Multimedia question asset pipeline for KBT. 6 of 9 tools built. Mascot Generator in development.","progress_pct":65,"revenue_y1":0,"revenue_y2":0,"revenue_y3":0,"revenue_y4":0,"revenue_y5":0,"income_priority":0,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":12,"project_name":"Thunder-Revenue","category":"historical","status":"archived","live_url":"https://thunder-revenue.pgallivan.workers.dev","description":"Revenue tracking AI. Cost vs income alerts.","progress_pct":100,"revenue_y1":0,"revenue_y2":0,"revenue_y3":0,"revenue_y4":0,"revenue_y5":0,"income_priority":0,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":15,"project_name":"Thunder-Inbox","category":"historical","status":"archived","live_url":"https://thunder-inbox.pgallivan.workers.dev","description":"Inbox AI. Flags, drafts replies.","progress_pct":100,"revenue_y1":0,"revenue_y2":0,"revenue_y3":0,"revenue_y4":0,"revenue_y5":0,"income_priority":0,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":16,"project_name":"Falkor (Legacy)","category":"historical","status":"archived","live_url":"https://falkor-app-steel.vercel.app","description":"Original AI assistant. Superseded by Thor + Thunder network.","progress_pct":100,"revenue_y1":0,"revenue_y2":0,"revenue_y3":0,"revenue_y4":0,"revenue_y5":0,"income_priority":0,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":19,"project_name":"District Sport (merged into School Sport Portal)","category":"web app","status":"merged","live_url":"https://paddygallivan.github.io/district-sport/","description":"Williamstown District Primary Schools sport management.","progress_pct":97,"revenue_y1":0,"revenue_y2":0,"revenue_y3":0,"revenue_y4":0,"revenue_y5":0,"income_priority":0,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":20,"project_name":"Lady Thor","category":"historical","status":"archived","live_url":"https://lady-thor.pgallivan.workers.dev","description":"Jacky Rooney PWA manager portal. Norse-themed. Teddy the Gatekeeper.","progress_pct":100,"revenue_y1":0,"revenue_y2":0,"revenue_y3":0,"revenue_y4":0,"revenue_y5":0,"income_priority":0,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":23,"project_name":"Family Footy Tipping","category":"web app","status":"live","live_url":"https://paddygallivan.github.io/family-footy-tipping/","description":"Family & friends AFL tipping. PWA dashboard, live scores, ESPN scrape, payment tracker.","progress_pct":100,"revenue_y1":0,"revenue_y2":0,"revenue_y3":0,"revenue_y4":0,"revenue_y5":0,"income_priority":0,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":26,"project_name":"WPS Athletics Carnival 2026 (now feeds School Sport Portal)","category":"tools","status":"merged","live_url":"https://wps-athletics-2026.pages.dev","description":"Multi-device athletics carnival tool. 272 students. Real-time Firebase, house points, district qualifier.","progress_pct":100,"revenue_y1":0,"revenue_y2":0,"revenue_y3":0,"revenue_y4":0,"revenue_y5":0,"income_priority":0,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":27,"project_name":"ON ICE / Only Fans Trivia","category":"web app","status":"early stage","live_url":null,"description":"Combined project: ON ICE live entertainment trivia + Only Fans Trivia adult content trivia game.","progress_pct":15,"revenue_y1":0,"revenue_y2":0,"revenue_y3":0,"revenue_y4":0,"revenue_y5":0,"income_priority":0,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":28,"project_name":"Personal Finance","category":"tools","status":"live","live_url":"https://pj-budget.vercel.app","description":"Budget dashboard, net worth tracker, 18-account balance monitor. $1.15M net worth tracking.","progress_pct":100,"revenue_y1":0,"revenue_y2":0,"revenue_y3":0,"revenue_y4":0,"revenue_y5":0,"income_priority":0,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":29,"project_name":"Ideas","category":"planning","status":"active","live_url":null,"description":"Master ideas list. SSV Trivia pitch deck, revenue models.","progress_pct":40,"revenue_y1":0,"revenue_y2":0,"revenue_y3":0,"revenue_y4":0,"revenue_y5":0,"income_priority":0,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":30,"project_name":"Super League","category":null,"status":"live","live_url":"https://superleague.streamlinewebapps.com","description":"Fantasy AFL league platform for 16 coaches. v4 fully rebuilt on Cloudflare Workers + D1. 791 players, 358 draft picks, R7 active, ladder R1-R6 migrated. Extras widget: Rosters, Activity, Swaps, Change PIN. sly-app proxy + sly-api worker. Custom domain superleague.streamlinewebapps.com.","progress_pct":82,"revenue_y1":0,"revenue_y2":0,"revenue_y3":0,"revenue_y4":0,"revenue_y5":0,"income_priority":0,"next_action":"Wire frontend gaps in Lovable (rosters tab, change-PIN, activity-feed, swap history). Migrate historical team_selections R1\\u2013R6 (2,288 rows). Move to luckdragon.io domain. Revoke temp CF token (expires 2026-04-26).","key_features":null,"cash_spent":0,"cash_earned":0},{"id":31,"project_name":"Super League Yeah","category":"web app","status":"live","live_url":"https://superleague.streamlinewebapps.com","description":"Parallel React Fantasy AFL. Emoji reactions, push notifications, coach aliases.","progress_pct":97,"revenue_y1":0,"revenue_y2":0,"revenue_y3":0,"revenue_y4":0,"revenue_y5":0,"income_priority":0,"next_action":"Opp matchup multiplier fixed (teamConceded via Squiggle history, parallel fetch). Monitor accuracy over R8-R9. Vault PIN unknown - get from Paddy and rotate.","key_features":null,"cash_spent":0,"cash_earned":0},{"id":36,"project_name":"Horse Race Tipping","category":"domain","status":"in_dev","live_url":"https://horseracetipping.com","description":"Race-day tipping competition. $20 entry. Flemington and Royal Randwick.","progress_pct":50,"revenue_y1":0,"revenue_y2":0,"revenue_y3":0,"revenue_y4":0,"revenue_y5":0,"income_priority":0,"next_action":"Scrape TAB fields Wed/Thu before race day (auto or manual via admin panel); set up Stripe product page for pub signups; test full punter flow end-to-end","key_features":null,"cash_spent":0,"cash_earned":0},{"id":41,"project_name":"KBT Tools (Fixed)","category":"web app","status":"merged","live_url":"https://kbt-tools-fixed.pages.dev","description":"KBT Tools platform.","progress_pct":100,"revenue_y1":0,"revenue_y2":0,"revenue_y3":0,"revenue_y4":0,"revenue_y5":0,"income_priority":0,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":42,"project_name":"Like Umm","category":"web app","status":"idea","live_url":null,"description":"Phone pings when you overuse like or umm.","progress_pct":0,"revenue_y1":0,"revenue_y2":0,"revenue_y3":0,"revenue_y4":0,"revenue_y5":0,"income_priority":0,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":45,"project_name":"Streamline","category":"web app","status":"live","live_url":"https://huvfgenbcaiicatvtxak.supabase.co/functions/v1/streamline","description":"Idea submission platform. Community votes. AI builds. Commission forever. Tiers $29/$99/$299.","progress_pct":99,"revenue_y1":0,"revenue_y2":0,"revenue_y3":0,"revenue_y4":0,"revenue_y5":0,"income_priority":0,"next_action":"Monitor real submissions. Edge fn secrets set 2026-05-01: SERVICE_ROLE_KEY + STRIPE_SECRET_KEY. Note: Supabase blocks SUPABASE_ prefix \\u2014 fn uses SERVICE_ROLE_KEY.","key_features":null,"cash_spent":0,"cash_earned":0},{"id":46,"project_name":"Asgard","category":null,"status":"live","live_url":"https://asgard.pgallivan.workers.dev","description":"Personal OS / command centre. 6-worker mesh: asgard, asgard-ai, asgard-auth, asgard-vault, asgard-memory, asgard-comms. D1 projects DB, KV vault. Dashboard v5.8.0: project management, AI chat, Rankings, file uploads per project. PIN-gated security on all secret endpoints.","progress_pct":88,"revenue_y1":0,"revenue_y2":0,"revenue_y3":0,"revenue_y4":0,"revenue_y5":0,"income_priority":0,"next_action":"File upload from chat (attach files directly in Asgard chat \\u2192 auto-link to current project). Email to hello@luckdragon.io. AI model bubble. Spend tracker. Remove Stripe tile. Feature-request via email not Slack.","key_features":null,"cash_spent":0,"cash_earned":0},{"id":47,"project_name":"Morris (KBT v2)","category":"tools","status":"merged","live_url":"https://huvfgenbcaiicatvtxak.supabase.co/functions/v1/morris","description":"KBT API replacement for broken kbt-integration worker. 13 public endpoints, 4 admin. Auditing all calls.","progress_pct":100,"revenue_y1":0,"revenue_y2":0,"revenue_y3":0,"revenue_y4":0,"revenue_y5":0,"income_priority":0,"next_action":null,"key_features":null,"cash_spent":0,"cash_earned":0},{"id":51,"project_name":"WPS Hub v3 (school management)","category":"School / SaaS","status":"live","live_url":"https://wps.carnivaltiming.com","description":"iDoceo replacement for primary schools. Full classroom management: CSV class lists from Compass, roll marking, gradebook, random picker, lesson planner, week timetable, school-wide notices + bell times via shared D1. Sell-to-schools play.","progress_pct":30,"revenue_y1":0,"revenue_y2":0,"revenue_y3":0,"revenue_y4":0,"revenue_y5":0,"income_priority":0,"next_action":"Get Mat Montebello to start using it; gather feedback; (a) CSV import for class rolls, (b) per-school admin onboarding flow, (c) move custom domain to a school-neutral name (currently on carnivaltiming.com which is wrong for a school product). Also rotate WPS_ADMIN_PIN from 9999.","key_features":"Google sign-in, CSV class import, per-class roll, gradebook, groups, random picker, week planner, school-wide notices, bell times, admin PIN gate, D1 sync, role-based writes","cash_spent":0,"cash_earned":0},{"id":52,"project_name":"Clubhouse","category":"platform","status":"idea","live_url":null,"description":"Multi-tenant platform for sport clubs. Players, coaches, sponsors, supporters, volunteers, parents \\u2014 everything a club needs.","progress_pct":5,"revenue_y1":0,"revenue_y2":0,"revenue_y3":0,"revenue_y4":0,"revenue_y5":0,"income_priority":0,"next_action":"Write product brief in docs/PRODUCT-BRIEF.md, decide subdomain vs path tenancy, decide auth method","key_features":"Roster, Fixtures & Results, Comms, Sponsors, Role-based logins (player/coach/committee/sponsor/supporter/parent)","cash_spent":0,"cash_earned":0}];
const SC={live:'#22c55e',active:'#22c55e',in_progress:'#6366f1',in_dev:'#6366f1','early stage':'#f59e0b',idea:'#64748b',parked:'#64748b',merged:'#0ea5e9',archived:'#334155',historical:'#334155'};
function fmt(n){if(!n)return'-';if(n>=1e6)return'$'+(n/1e6).toFixed(1)+'M';if(n>=1e3)return'$'+(n/1e3).toFixed(0)+'k';return'$'+n;}
function fmtFull(n){return n?'$'+Number(n).toLocaleString():'-';}
let activeFilter='all';
function visible(){
  const q=(document.getElementById('search').value||'').toLowerCase();
  return PROJECTS.filter(p=>{
    if(activeFilter!=='all'&&p.status!==activeFilter)return false;
    if(!q)return true;
    return(p.project_name||'').toLowerCase().includes(q)||(p.description||'').toLowerCase().includes(q)||(p.category||'').toLowerCase().includes(q);
  });
}
function renderSum(){
  const tots=[1,2,3,4,5].map(y=>PROJECTS.reduce((s,p)=>s+(p['revenue_y'+y]||0),0));
  document.getElementById('stat-y1').textContent=fmt(tots[0]);
  document.getElementById('stat-y3').textContent=fmt(tots[2]);
  document.getElementById('stat-y5').textContent=fmt(tots[4]);
  const live=PROJECTS.filter(p=>p.status==='live'||p.status==='active').length;
  const inprog=PROJECTS.filter(p=>['in_progress','in_dev','early stage'].includes(p.status)).length;
  document.getElementById('sum').innerHTML=[1,2,3,4,5].map((y,i)=>
    '<div class="sum-card"><div class="yr">Year '+y+'</div><div class="val">'+fmt(tots[i])+'</div></div>'
  ).join('')+'<div class="sum-card"><div class="yr">Live</div><div class="val" style="color:var(--green)">'+live+'</div><div style="font-size:.72rem;color:var(--muted)">'+inprog+' in prog</div></div>';
}
function renderFilters(){
  const ss=[...new Set(PROJECTS.map(p=>p.status).filter(Boolean))].sort();
  const cnt={};ss.forEach(s=>cnt[s]=PROJECTS.filter(p=>p.status===s).length);
  const all=[{s:'all',l:'All ('+PROJECTS.length+')'},...ss.map(s=>({s,l:s+' ('+cnt[s]+')'}))];
  document.getElementById('filters').innerHTML='<span style="font-size:.78rem;color:var(--muted)">Filter: </span>'+all.map(b=>'<button class="filter-btn'+(activeFilter===b.s?' active':'')+'" onclick="setFilter(\\''+b.s+'\\')">'+b.l+'</button>').join('');
}
function setFilter(s){activeFilter=s;renderGrid();}
function renderGrid(){
  renderSum();renderFilters();
  const ps=visible();
  if(!ps.length){document.getElementById('grid').innerHTML='<div class="no-results">No projects match</div>';return;}
  document.getElementById('grid').innerHTML=ps.map(p=>{
    const sc=SC[p.status]||'#64748b';
    const isLive=p.status==='live'||p.status==='active';
    const dot=isLive?'<span class="live-dot"></span>':'';
    return '<div class="card" onclick="openModal('+p.id+')">'+
      '<div class="card-header"><div class="card-name">'+dot+p.project_name+'</div>'+
      '<div class="card-status" style="background:'+sc+'22;color:'+sc+'">'+p.status+'</div></div>'+
      '<div class="card-cat">'+(p.category||'—')+'</div>'+
      '<div class="card-desc">'+(p.description||'')+'</div>'+
      '<div class="card-revenue">'+
        '<div class="rev-item"><div class="rev-yr">Y1</div><div class="rev-val">'+fmt(p.revenue_y1)+'</div></div>'+
        '<div class="rev-item"><div class="rev-yr">Y3</div><div class="rev-val">'+fmt(p.revenue_y3)+'</div></div>'+
        '<div class="rev-item"><div class="rev-yr">Y5</div><div class="rev-val">'+fmt(p.revenue_y5)+'</div></div>'+
      '</div>'+
      '<div class="card-progress"><div class="card-progress-bar" style="width:'+(p.progress_pct||0)+'%"></div></div>'+
      '<div class="card-footer"><span class="card-pct">'+(p.progress_pct||0)+'% complete</span>'+
      (p.live_url?'<a class="card-link" href="'+p.live_url+'" target="_blank" onclick="event.stopPropagation()">→ Live</a>':'')+
      '</div></div>';
  }).join('');
}
function openModal(id){
  const p=PROJECTS.find(x=>x.id===id);if(!p)return;
  const sc=SC[p.status]||'#64748b';
  let html='<button class="modal-close" onclick="document.getElementById(\\'modal-overlay\\').classList.remove(\\'open\\')">✕</button>'+
    '<h2>'+p.project_name+'</h2>'+
    '<div class="modal-cat">'+(p.category||'—')+' · <span style="color:'+sc+'">'+p.status+'</span></div>'+
    '<div class="prog-row"><div class="prog-bar"><div class="prog-fill" style="width:'+(p.progress_pct||0)+'%"></div></div>'+
    '<div class="prog-pct">'+(p.progress_pct||0)+'%</div></div>'+
    '<div class="modal-rev-grid">'+[1,2,3,4,5].map(y=>'<div class="modal-rev"><div class="yr">Y'+y+'</div><div class="amt">'+fmt(p['revenue_y'+y])+'</div></div>').join('')+'</div>';
  if(p.description)html+='<section><h3>Description</h3><p>'+p.description+'</p></section>';
  if(p.key_features)html+='<section><h3>Key Features</h3><p>'+p.key_features+'</p></section>';
  if(p.next_action)html+='<section><h3>Next Action</h3><p>'+p.next_action+'</p></section>';
  if(p.live_url)html+='<section><h3>Live URL</h3><a href="'+p.live_url+'" target="_blank">'+p.live_url+'</a></section>';
  html+='<section><h3>Revenue Projections</h3><p>Y1: '+fmtFull(p.revenue_y1)+' · Y2: '+fmtFull(p.revenue_y2)+' · Y3: '+fmtFull(p.revenue_y3)+' · Y4: '+fmtFull(p.revenue_y4)+' · Y5: '+fmtFull(p.revenue_y5)+'</p></section>';
  document.getElementById('modal-body').innerHTML=html;
  document.getElementById('modal-overlay').classList.add('open');
}
function closeModal(e){if(e.target.id==='modal-overlay')document.getElementById('modal-overlay').classList.remove('open');}
document.addEventListener('keydown',e=>{
  if(e.key==='Escape')document.getElementById('modal-overlay').classList.remove('open');
  if(e.key==='Enter'&&document.getElementById('pin-screen').style.display!=='none')checkPin();
});
async function checkPin(){
  const val=document.getElementById('pin-input').value;
  document.getElementById('pin-btn').textContent='Checking...';
  try{
    const r=await fetch('/api/verify-pin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:val})});
    const d=await r.json();
    if(d.ok){
      document.getElementById('pin-screen').style.display='none';
      document.getElementById('main').style.display='block';
      renderGrid();
    }else{
      document.getElementById('pin-error').style.display='block';
      document.getElementById('pin-btn').textContent='Unlock';
    }
  }catch{document.getElementById('pin-error').style.display='block';document.getElementById('pin-btn').textContent='Unlock';}
}
</script>
</body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, version: VERSION, worker: 'falkor-dashboard', projects: 50 }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (url.pathname === '/api/verify-pin' && request.method === 'POST') {
      try {
        const { pin } = await request.json();
        const correct = env.AGENT_PIN || '';
        return new Response(JSON.stringify({ ok: pin === correct }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch {
        return new Response(JSON.stringify({ ok: false }), { headers: { 'Content-Type': 'application/json' } });
      }
    }
    return new Response(HTML, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
  }
};
