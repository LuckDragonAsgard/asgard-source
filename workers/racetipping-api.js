var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// fixed.js
var __defProp2 = Object.defineProperty;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Pin, Authorization"
};
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS } });
}
__name(json, "json");
__name2(json, "json");
function err(msg, status = 400) {
  return json({ error: msg }, status);
}
__name(err, "err");
__name2(err, "err");
function html(content) {
  return new Response(content, { headers: { "Content-Type": "text/html", ...CORS } });
}
__name(html, "html");
__name2(html, "html");
var SCORE_MAP = { 1: 6, 2: 4, 3: 2, 4: 1 };
function calcScore(barrier, result) {
  if (!result) return 0;
  if (result.pos1_barrier == barrier) return SCORE_MAP[1];
  if (result.pos2_barrier == barrier) return SCORE_MAP[2];
  if (result.pos3_barrier == barrier) return SCORE_MAP[3];
  if (result.pos4_barrier == barrier) return SCORE_MAP[4];
  return 0;
}
__name(calcScore, "calcScore");
__name2(calcScore, "calcScore");
function calcOdds(barrier, result) {
  if (!result) return 0;
  let c = 0;
  if (result.pos1_barrier == barrier) {
    c += result.pos1_win_odds || 0;
    c += result.pos1_place_odds || 0;
  } else if (result.pos2_barrier == barrier) c += result.pos2_place_odds || 0;
  else if (result.pos3_barrier == barrier) c += result.pos3_place_odds || 0;
  return Math.round(c * 100) / 100;
}
__name(calcOdds, "calcOdds");
__name2(calcOdds, "calcOdds");
async function hashPassword(pw) {
  const salt = crypto.randomUUID();
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + pw));
  const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return salt + ":" + hex;
}
__name(hashPassword, "hashPassword");
__name2(hashPassword, "hashPassword");
async function verifyPassword(pw, stored) {
  const [salt, hash] = stored.split(":");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + pw));
  const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === hash;
}
__name(verifyPassword, "verifyPassword");
__name2(verifyPassword, "verifyPassword");
async function createSession(db, orgId) {
  const token = crypto.randomUUID() + "-" + crypto.randomUUID();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3).toISOString();
  await db.prepare(`INSERT INTO org_sessions (token, org_id, expires_at) VALUES (?,?,?)`).bind(token, orgId, expires).run();
  return token;
}
__name(createSession, "createSession");
__name2(createSession, "createSession");
async function validateSession(db, token, orgId) {
  if (!token) return false;
  const s = await db.prepare(`SELECT token FROM org_sessions WHERE token=? AND org_id=? AND expires_at>datetime('now')`).bind(token, orgId).first();
  return !!s;
}
__name(validateSession, "validateSession");
__name2(validateSession, "validateSession");
async function createTipperSession(db, tipperId, orgId) {
  const token = crypto.randomUUID() + "-" + crypto.randomUUID();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString();
  await db.prepare(`INSERT INTO tipper_sessions (token, tipper_id, org_id, expires_at) VALUES (?,?,?,?)`).bind(token, tipperId, orgId, expires).run();
  return token;
}
__name(createTipperSession, "createTipperSession");
__name2(createTipperSession, "createTipperSession");
async function validateTipperSession(db, token, orgId) {
  if (!token) return null;
  const s = await db.prepare(`SELECT ts.tipper_id, t.name, t.email, t.motto FROM tipper_sessions ts JOIN tippers t ON ts.tipper_id=t.id WHERE ts.token=? AND ts.org_id=? AND ts.expires_at>datetime('now')`).bind(token, orgId).first();
  return s || null;
}
__name(validateTipperSession, "validateTipperSession");
__name2(validateTipperSession, "validateTipperSession");
async function getOrg(db, slug) {
  return db.prepare(`SELECT * FROM organisations WHERE slug=? AND is_active=1`).bind(slug).first();
}
__name(getOrg, "getOrg");
__name2(getOrg, "getOrg");
function stripeEncode(obj, prefix = "") {
  const parts = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (typeof item === "object" && item !== null) parts.push(...stripeEncode(item, `${key}[${i}]`));
        else parts.push([`${key}[${i}]`, String(item)]);
      });
    } else if (typeof v === "object" && v !== null) {
      parts.push(...stripeEncode(v, key));
    } else {
      parts.push([key, String(v)]);
    }
  }
  return parts;
}
__name(stripeEncode, "stripeEncode");
__name2(stripeEncode, "stripeEncode");
async function stripe(env, method, path, body) {
  if (!env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY not configured");
  const opts = {
    method,
    headers: { "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}` }
  };
  if (body) {
    const pairs = stripeEncode(body);
    opts.headers["Content-Type"] = "application/x-www-form-urlencoded";
    opts.body = pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  }
  const r = await fetch(`https://api.stripe.com/v1${path}`, opts);
  return r.json();
}
__name(stripe, "stripe");
__name2(stripe, "stripe");

async function sendEmail(env, to, subject, html) {
  if (!env.RESEND_API_KEY || !to) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Horse Race Tipping <hello@horseracetipping.com>", to: [to], subject, html })
    });
  } catch {}
}
__name(sendEmail, "sendEmail");
__name2(sendEmail, "sendEmail");

async function notifyResultsEntered(db, env, org, raceId) {
  try {
    const race = await db.prepare(`SELECT r.race_number, v.track_name, v.code FROM races r JOIN venues v ON r.venue_id=v.id WHERE r.id=?`).bind(raceId).first();
    if (!race) return;
    const rd = await db.prepare(`SELECT * FROM race_days WHERE is_active=1 AND org_id=? LIMIT 1`).bind(org.id).first();
    if (!rd) return;
    const tippers = (await db.prepare(`SELECT DISTINCT t.name, t.email FROM tippers t JOIN tips tip ON t.id=tip.tipper_id JOIN races r ON tip.race_id=r.id WHERE r.venue_id=(SELECT venue_id FROM races WHERE id=?) AND t.email IS NOT NULL AND t.org_id=?`).bind(raceId, org.id).all()).results;
    const lbUrl = `https://horseracetipping.com/${org.slug}`;
    for (const tipper of tippers) {
      if (!tipper.email) continue;
      await sendEmail(env, tipper.email,
        `Result entered: ${race.track_name} Race ${race.race_number} — ${org.name}`,
        `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f1923;color:#e8e8e8;padding:32px;border-radius:12px">
          <h2 style="color:#c9a227;margin:0 0 16px">🏇 Result In — ${race.track_name} R${race.race_number}</h2>
          <p style="color:#b0bec5;margin:0 0 24px">Hi ${tipper.name}, a result has been entered for <strong>${race.track_name} Race ${race.race_number}</strong> in the ${org.name} tipping competition.</p>
          <a href="${lbUrl}" style="display:inline-block;background:#c9a227;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">View Leaderboard →</a>
          <p style="color:#4a5e72;font-size:0.8rem;margin-top:24px">18+ only. <a href="https://horseracetipping.com/terms" style="color:#4a5e72">Terms</a></p>
        </div>`
      );
    }
  } catch {}
}
__name(notifyResultsEntered, "notifyResultsEntered");
__name2(notifyResultsEntered, "notifyResultsEntered");
async function verifyStripeSignature(payload, sigHeader, secret) {
  if (!sigHeader) return false;
  const tsPart = sigHeader.split(",").find((p) => p.startsWith("t="));
  const v1Part = sigHeader.split(",").find((p) => p.startsWith("v1="));
  if (!tsPart || !v1Part) return false;
  const timestamp = tsPart.slice(2);
  const signature = v1Part.slice(3);
  if (Math.abs(Date.now() / 1e3 - parseInt(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const computed = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return computed === signature;
}
__name(verifyStripeSignature, "verifyStripeSignature");
__name2(verifyStripeSignature, "verifyStripeSignature");
async function doScrapeAllResults(env) {
  const rds = await env.DB.prepare(`SELECT * FROM race_days WHERE is_active=1`).all();
  for (const rd of rds.results) await doScrapeResultsForRD(env, rd);
}
__name(doScrapeAllResults, "doScrapeAllResults");
__name2(doScrapeAllResults, "doScrapeAllResults");
async function doScrapeResultsForRD(env, rdRow) {
  const TAB = "https://api.beta.tab.com.au/v1/tab-info-service/racing";
  let meetings;
  try {
    // Try multiple jurisdictions and merge - TAB blocks direct CF fetches sometimes
    const jurisList = ["NSW", "VIC", "QLD", "SA", "WA"];
    const allMeetings = [];
    for (const jur of jurisList) {
      try {
        const r = await fetch(`${TAB}/dates/${rdRow.date}/meetings?jurisdiction=${jur}`, { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" } });
        if (!r.ok) continue;
        const text = await r.text();
        if (!text.startsWith("{") && !text.startsWith("[")) continue; // skip HTML responses
        const parsed = JSON.parse(text);
        const rMeetings = (parsed.meetings || []).filter((m) => m.raceType === "R");
        for (const m of rMeetings) {
          if (!allMeetings.find((x) => x.meetingName === m.meetingName)) allMeetings.push(m);
        }
      } catch {}
    }
    meetings = allMeetings;
    if (!meetings.length) return { error: "No meetings found from TAB API" };
  } catch (e) {
    return { error: e.message };
  }
  const venues = (await env.DB.prepare(`SELECT * FROM venues WHERE race_day_id=? AND is_active=1`).bind(rdRow.id).all()).results;
  const summary = [];
  for (const v of venues) {
    const tl = v.track_name.toLowerCase().replace(/\s*\(.*?\)\s*/g, "").trim();
    const mtg = meetings.find((m) => {
      const n = m.meetingName.toLowerCase().replace(/\s*\(.*?\)\s*/g, "").trim();
      return n === tl || n.includes(tl) || tl.includes(n);
    });
    if (!mtg) {
      summary.push({ venue: v.code, status: "no_meeting" });
      continue;
    }
    const enc = encodeURIComponent(mtg.meetingName);
    const races = (await env.DB.prepare(`SELECT * FROM races WHERE venue_id=? ORDER BY race_number`).bind(v.id).all()).results;
    let imp = 0, pend = 0;
    for (const race of races) {
      if (await env.DB.prepare(`SELECT id FROM race_results WHERE race_id=?`).bind(race.id).first()) {
        imp++;
        continue;
      }
      let rd2;
      try {
        const r2 = await fetch(`${TAB}/dates/${rdRow.date}/meetings/R/${enc}/races/${race.race_number}?jurisdiction=NSW&fixedOdds=true`, { headers: { Accept: "application/json" } });
        if (!r2.ok) {
          pend++;
          continue;
        }
        rd2 = await r2.json();
      } catch (e) {
        pend++;
        continue;
      }
      if (!rd2 || rd2.error) {
        pend++;
        continue;
      }
      const pg = rd2.placeGetters;
      const st = (rd2.raceStatus || "").toLowerCase();
      const done = pg && pg.length > 0 || st === "paying" || st === "final" || st === "resulted";
      if (!done) {
        pend++;
        continue;
      }
      let pos = [null, null, null, null];
      if (pg && pg.length > 0) {
        for (let i = 0; i < Math.min(4, pg.length); i++) pos[i] = { n: pg[i].runnerNumber, w: pg[i].returnWin || pg[i].fixedOdds?.returnWin || null, p: pg[i].returnPlace || pg[i].fixedOdds?.returnPlace || null };
      } else {
        const fin = (rd2.runners || []).filter((r) => r.finishingPosition >= 1).sort((a, b) => a.finishingPosition - b.finishingPosition);
        for (let i = 0; i < Math.min(4, fin.length); i++) pos[i] = { n: fin[i].runnerNumber, w: fin[i].fixedOdds?.returnWin || null, p: fin[i].fixedOdds?.returnPlace || null };
      }
      if (!pos[0]) {
        pend++;
        continue;
      }
      await env.DB.prepare(`INSERT OR REPLACE INTO race_results (race_id,pos1_barrier,pos1_win_odds,pos1_place_odds,pos2_barrier,pos2_place_odds,pos3_barrier,pos3_place_odds,pos4_barrier) VALUES (?,?,?,?,?,?,?,?,?)`).bind(race.id, pos[0]?.n, pos[0]?.w, pos[0]?.p, pos[1]?.n || null, pos[1]?.p || null, pos[2]?.n || null, pos[2]?.p || null, pos[3]?.n || null).run();
      imp++;
    }
    summary.push({ venue: v.code, status: "ok", results_imported: imp, races_pending: pend });
  }
  return { date: rdRow.date, results: summary };
}
__name(doScrapeResultsForRD, "doScrapeResultsForRD");
__name2(doScrapeResultsForRD, "doScrapeResultsForRD");
async function doScrapeFields(env, orgId) {
  const rdRow = await env.DB.prepare(`SELECT * FROM race_days WHERE is_active=1 AND org_id=? ORDER BY id DESC LIMIT 1`).bind(orgId).first();
  if (!rdRow) return { error: "No active race day" };
  const TAB = "https://api.beta.tab.com.au/v1/tab-info-service/racing";
  let meetings;
  try {
    // Try multiple jurisdictions and merge - TAB blocks direct CF fetches sometimes
    const jurisList = ["NSW", "VIC", "QLD", "SA", "WA"];
    const allMeetings = [];
    for (const jur of jurisList) {
      try {
        const r = await fetch(`${TAB}/dates/${rdRow.date}/meetings?jurisdiction=${jur}`, { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" } });
        if (!r.ok) continue;
        const text = await r.text();
        if (!text.startsWith("{") && !text.startsWith("[")) continue; // skip HTML responses
        const parsed = JSON.parse(text);
        const rMeetings = (parsed.meetings || []).filter((m) => m.raceType === "R");
        for (const m of rMeetings) {
          if (!allMeetings.find((x) => x.meetingName === m.meetingName)) allMeetings.push(m);
        }
      } catch {}
    }
    meetings = allMeetings;
    if (!meetings.length) return { error: "No meetings found from TAB API" };
  } catch (e) {
    return { error: e.message };
  }
  const venues = (await env.DB.prepare(`SELECT * FROM venues WHERE race_day_id=? AND is_active=1`).bind(rdRow.id).all()).results;
  const summary = [];
  for (const v of venues) {
    const tl = v.track_name.toLowerCase().replace(/\s*\(.*?\)\s*/g, "").trim();
    const mtg = meetings.find((m) => {
      const n = m.meetingName.toLowerCase().replace(/\s*\(.*?\)\s*/g, "").trim();
      return n === tl || n.includes(tl) || tl.includes(n);
    });
    if (!mtg) {
      summary.push({ venue: v.code, track: v.track_name, status: "no_meeting_found" });
      continue;
    }
    const enc = encodeURIComponent(mtg.meetingName);
    let imp = 0, skip = 0, r1start = null;
    for (let rn = 1; rn <= v.num_races; rn++) {
      let race = await env.DB.prepare(`SELECT * FROM races WHERE venue_id=? AND race_number=?`).bind(v.id, rn).first();
      if (!race) {
        await env.DB.prepare(`INSERT OR IGNORE INTO races (venue_id,race_number) VALUES (?,?)`).bind(v.id, rn).run();
        race = await env.DB.prepare(`SELECT * FROM races WHERE venue_id=? AND race_number=?`).bind(v.id, rn).first();
      }
      if (!race) continue;
      let rd;
      try {
        const r2 = await fetch(`${TAB}/dates/${rdRow.date}/meetings/R/${enc}/races/${rn}?jurisdiction=${mtg.location || "NSW"}&fixedOdds=true`, { headers: { Accept: "application/json" } });
        if (!r2.ok) {
          skip++;
          continue;
        }
        const t2 = await r2.text();
        if (!t2.startsWith("{") && !t2.startsWith("[")) { skip++; continue; }
        rd = JSON.parse(t2);
      } catch (e) {
        skip++;
        continue;
      }
      if (!rd || rd.error) {
        skip++;
        continue;
      }
      const rname = rd.raceName || rd.raceClassConditions || null;
      if (rname) await env.DB.prepare(`UPDATE races SET race_name=? WHERE id=?`).bind(rname, race.id).run();
      if (rn === 1 && rd.raceStartTime) r1start = rd.raceStartTime;
      await env.DB.prepare(`DELETE FROM horses WHERE race_id=?`).bind(race.id).run();
      for (const runner of rd.runners || []) {
        if (runner.vacantBox || runner.emergency) continue;
        const rnum = runner.runnerNumber, rname2 = runner.runnerName || `Runner ${rnum}`;
        const scr = runner.fixedOdds?.bettingStatus === "Scratched" ? 1 : 0;
        await env.DB.prepare(`INSERT OR REPLACE INTO horses (race_id,barrier_number,horse_name,is_scratched,is_top_weight,win_odds,place_odds) VALUES (?,?,?,?,?,?,?)`).bind(race.id, rnum, rname2, scr, rnum === 1 ? 1 : 0, runner.fixedOdds?.returnWin || null, runner.fixedOdds?.returnPlace || null).run();
        imp++;
      }
    }
    if (r1start) await env.DB.prepare(`UPDATE venues SET race1_start=? WHERE id=?`).bind(r1start, v.id).run();
    summary.push({ venue: v.code, track: v.track_name, meeting: mtg.meetingName, status: "ok", runners_imported: imp, races_skipped: skip });
  }
  return { date: rdRow.date, results: summary };
}
__name(doScrapeFields, "doScrapeFields");
__name2(doScrapeFields, "doScrapeFields");
async function handleAPI(request, env, url, path, method) {
  const db = env.DB;
  let body = {};
  if (method === "POST" || method === "PUT") {
    try {
      body = await request.json();
    } catch {
    }
  }
  const superPin = !!env.SUPER_PIN && request.headers.get("X-Admin-Pin") === env.SUPER_PIN;
  const bearerToken = request.headers.get("Authorization")?.replace("Bearer ", "") || "";
  const parts = path.split("/").filter(Boolean);
  if (path === "/api/signup" && method === "POST") {
    const { name, slug: slug2, admin_email, admin_password, settings = {} } = body;
    if (!name || !slug2 || !admin_email || !admin_password) return err("name, slug, admin_email, admin_password required");
    if (!/^[a-z0-9-]+$/.test(slug2)) return err("Slug: lowercase letters, numbers, hyphens only");
    if (await db.prepare(`SELECT id FROM organisations WHERE slug=?`).bind(slug2).first()) return err("That URL is already taken \u2014 try another");
    const ph = await hashPassword(admin_password);
    const s = JSON.stringify({ entryFee: settings.entryFee || "$10", prize: settings.prize || "Winner takes all", welcomeMsg: settings.welcomeMsg || "Good luck picking your winners! \u{1F3C7}", primaryColor: settings.primaryColor || "#1a7a3c", accentColor: settings.accentColor || "#c9a227", tagline: settings.tagline || name + " Race Tipping" });
    const res = await db.prepare(`INSERT INTO organisations (name,slug,admin_email,admin_password_hash,settings) VALUES (?,?,?,?,?)`).bind(name, slug2, admin_email, ph, s).run();
    const token = await createSession(db, res.meta.last_row_id);
    return json({ ok: true, slug: slug2, token });
  }
  const slug = parts[1];
  if (!slug) return err("Not found", 404);
  if (parts[2] === "auth" && parts[3] === "login" && method === "POST") {
    const org2 = await getOrg(db, slug);
    if (!org2) return err("Comp not found", 404);
    const { pin, email, password } = body;
    const settings = JSON.parse(org2.settings || "{}");
    if (pin && ((env.SUPER_PIN && pin === env.SUPER_PIN) || pin === settings.adminPin)) {
      return json({ ok: true, token: await createSession(db, org2.id), org_name: org2.name });
    }
    if (email && password) {
      if (email !== org2.admin_email) return err("Invalid credentials", 401);
      if (!org2.admin_password_hash) return err("No password set", 401);
      if (!await verifyPassword(password, org2.admin_password_hash)) return err("Invalid credentials", 401);
      return json({ ok: true, token: await createSession(db, org2.id), org_name: org2.name });
    }
    return err("PIN or email+password required", 401);
  }
  if (parts.length === 2 && method === "GET") {
    const org2 = await getOrg(db, slug);
    if (!org2) return err("Not found", 404);
    const s = JSON.parse(org2.settings || "{}");
    return json({ id: org2.id, name: org2.name, slug: org2.slug, settings: s });
  }
  if (slug === "stripe" && parts[2] === "webhook" && method === "POST") {
    if (!env.STRIPE_WEBHOOK_SECRET) return err("Webhook not configured", 500);
    const rawBody = await request.text();
    const valid = await verifyStripeSignature(rawBody, request.headers.get("stripe-signature") || "", env.STRIPE_WEBHOOK_SECRET);
    if (!valid) return err("Invalid signature", 400);
    let event;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return err("Invalid JSON", 400);
    }
    if (event.type === "checkout.session.completed") {
      const s = event.data.object;
      const orgSlug = s.metadata?.org_slug || s.client_reference_id;
      if (orgSlug) await db.prepare(`UPDATE organisations SET subscription_status='active',stripe_customer_id=?,stripe_subscription_id=? WHERE slug=?`).bind(s.customer || null, s.subscription || null, orgSlug).run();
    }
    if (event.type === "customer.subscription.deleted") {
      const s = event.data.object;
      await db.prepare(`UPDATE organisations SET subscription_status='suspended',stripe_subscription_id=NULL WHERE stripe_subscription_id=?`).bind(s.id).run();
    }
    if (event.type === "customer.subscription.updated") {
      const s = event.data.object;
      if (s.status === "active" || s.status === "trialing") {
        await db.prepare(`UPDATE organisations SET subscription_status='active' WHERE stripe_subscription_id=?`).bind(s.id).run();
      } else if (s.status === "canceled" || s.status === "unpaid" || s.status === "past_due") {
        await db.prepare(`UPDATE organisations SET subscription_status='suspended' WHERE stripe_subscription_id=?`).bind(s.id).run();
      }
    }
    if (event.type === "invoice.payment_succeeded") {
      const s = event.data.object;
      if (s.subscription) await db.prepare(`UPDATE organisations SET subscription_status='active' WHERE stripe_subscription_id=?`).bind(s.subscription).run();
    }
    return json({ received: true });
  }
  // Super-admin routes — must be before getOrg so slug="super" doesn't 404
  if (slug === "super" && parts[2] === "orgs" && method === "GET") {
    if (!superPin) return err("Unauthorised", 401);
    const orgs = await db.prepare(`SELECT id,name,slug,admin_email,is_active,subscription_status,race_days_used,stripe_customer_id,created_at FROM organisations ORDER BY created_at DESC`).all();
    return json(orgs.results);
  }
  if (slug === "super" && parts[2] === "activate" && method === "POST") {
    if (!superPin) return err("Unauthorised", 401);
    const { org_slug, status = "active" } = body;
    if (!org_slug) return err("org_slug required");
    await db.prepare(`UPDATE organisations SET subscription_status=? WHERE slug=?`).bind(status, org_slug).run();
    return json({ ok: true, org_slug, status });
  }
  const org = await getOrg(db, slug);
  if (!org) return err("Comp not found", 404);
  const isAdmin = superPin || await validateSession(db, bearerToken, org.id);
  const sub = "/" + parts.slice(2).join("/");
  if (sub === "/raceday/current" && method === "GET") {
    const rd = await db.prepare(`SELECT * FROM race_days WHERE is_active=1 AND org_id=? ORDER BY id DESC LIMIT 1`).bind(org.id).first();
    if (!rd) return json(null);
    const venues = await db.prepare(`SELECT * FROM venues WHERE race_day_id=? AND is_active=1`).bind(rd.id).all();
    return json({ ...rd, venues: venues.results });
  }
  if (sub === "/admin/raceday" && method === "POST") {
    if (!isAdmin) return err("Unauthorised", 401);
    if (org.subscription_status === "trial" && (org.race_days_used || 0) >= 2)
      return err("TRIAL_ENDED", 402);
    if (org.subscription_status === "suspended")
      return err("SUSPENDED", 402);
    const { name, date, entry_fee = 10 } = body;
    if (!name || !date) return err("name and date required");
    await db.prepare(`UPDATE race_days SET is_active=0 WHERE org_id=?`).bind(org.id).run();
    const res = await db.prepare(`INSERT INTO race_days (name,date,entry_fee,is_active,org_id) VALUES (?,?,?,1,?)`).bind(name, date, entry_fee, org.id).run();
    await db.prepare(`UPDATE organisations SET race_days_used=race_days_used+1 WHERE id=?`).bind(org.id).run();
    return json({ id: res.meta.last_row_id, name, date, entry_fee });
  }
  if (sub === "/admin/venue" && method === "POST") {
    if (!isAdmin) return err("Unauthorised", 401);
    const { race_day_id, code, track_name, num_races = 10, race1_start } = body;
    if (!race_day_id || !code || !track_name) return err("race_day_id, code, track_name required");
    const res = await db.prepare(`INSERT INTO venues (race_day_id,code,track_name,num_races,race1_start,org_id) VALUES (?,?,?,?,?,?)`).bind(race_day_id, code.toUpperCase(), track_name, num_races, race1_start || null, org.id).run();
    const vid = res.meta.last_row_id;
    const stmts = [];
    for (let i = 1; i <= num_races; i++) stmts.push(db.prepare(`INSERT OR IGNORE INTO races (venue_id,race_number) VALUES (?,?)`).bind(vid, i));
    await db.batch(stmts);
    return json({ id: vid, code, track_name, num_races });
  }
  if (sub.match(/^\/admin\/venue\/\d+$/) && method === "PUT") {
    if (!isAdmin) return err("Unauthorised", 401);
    const vid = sub.split("/")[3];
    const { track_name, race1_start, num_races } = body;
    await db.prepare(`UPDATE venues SET track_name=COALESCE(?,track_name),race1_start=COALESCE(?,race1_start),num_races=COALESCE(?,num_races) WHERE id=? AND org_id=?`).bind(track_name || null, race1_start || null, num_races || null, vid, org.id).run();
    return json({ ok: true });
  }
  if (sub.match(/^\/venue\/\d+\/races$/) && method === "GET") {
    const vid = sub.split("/")[2];
    const races = await db.prepare(`SELECT r.*,v.code,v.track_name FROM races r JOIN venues v ON r.venue_id=v.id WHERE r.venue_id=? ORDER BY r.race_number`).bind(vid).all();
    return json(races.results);
  }
  if (sub.match(/^\/race\/\d+\/horses$/) && method === "GET") {
    const rid = sub.split("/")[2];
    const horses = await db.prepare(`SELECT * FROM horses WHERE race_id=? ORDER BY barrier_number`).bind(rid).all();
    return json(horses.results);
  }
  if (sub.match(/^\/venues\/\d+$/) && method === "GET") {
    const rdid = sub.split("/")[2];
    const rows = await db.prepare(`SELECT v.*,COUNT(r.id) as race_count FROM venues v LEFT JOIN races r ON r.venue_id=v.id WHERE v.race_day_id=? AND v.org_id=? GROUP BY v.id ORDER BY v.code`).bind(rdid, org.id).all();
    return json(rows.results);
  }
  if (sub === "/tippers" && method === "GET") {
    const rdId = url.searchParams.get("race_day_id");
    if (rdId) {
      const rows2 = await db.prepare(`SELECT DISTINCT t.id, t.name, t.email, t.motto, t.created_at, t.org_id, v.code as venue_code, p.paid FROM tippers t JOIN tips tip ON t.id=tip.tipper_id JOIN races r ON tip.race_id=r.id JOIN venues v ON r.venue_id=v.id LEFT JOIN payments p ON t.id=p.tipper_id AND p.race_day_id=? AND p.venue_code=v.code WHERE t.org_id=? AND v.race_day_id=? ORDER BY t.name`).bind(rdId, org.id, rdId).all();
      return json(rows2.results);
    }
    const rows = await db.prepare(`SELECT id, name, email, motto, created_at, org_id FROM tippers WHERE org_id=? ORDER BY name`).bind(org.id).all();
    return json(rows.results);
  }
  if (sub === "/tippers" && method === "POST") {
    const { name, email, motto } = body;
    if (!name) return err("name required");
    let tipper = await db.prepare(`SELECT * FROM tippers WHERE name=? COLLATE NOCASE AND org_id=?`).bind(name, org.id).first();
    if (!tipper) {
      const res = await db.prepare(`INSERT INTO tippers (name,email,motto,org_id) VALUES (?,?,?,?)`).bind(name, email || null, motto || null, org.id).run();
      tipper = { id: res.meta.last_row_id, name, email, motto };
    } else {
      if (motto || email) await db.prepare(`UPDATE tippers SET motto=COALESCE(?,motto),email=COALESCE(?,email) WHERE id=?`).bind(motto || null, email || null, tipper.id).run();
    }
    return json(tipper);
  }
  if (sub === "/admin/payment" && method === "POST") {
    if (!isAdmin) return err("Unauthorised", 401);
    const { tipper_id, race_day_id, venue_code, paid } = body;
    await db.prepare(`INSERT OR REPLACE INTO payments (tipper_id,race_day_id,venue_code,paid) VALUES (?,?,?,?)`).bind(tipper_id, race_day_id, venue_code.toUpperCase(), paid ? 1 : 0).run();
    return json({ ok: true });
  }
  if (sub === "/tips" && method === "POST") {
    const { tipper_id, tips } = body;
    if (!tipper_id || !Array.isArray(tips)) return err("tipper_id and tips[] required");
    if (tips.length > 0) {
      const fc = await db.prepare(`SELECT v.race1_start FROM races r JOIN venues v ON r.venue_id=v.id WHERE r.id=?`).bind(tips[0].race_id).first();
      if (fc?.race1_start && /* @__PURE__ */ new Date() > new Date(fc.race1_start)) return err("Tips are closed \u2014 Race 1 has started!", 403);
    }
    await db.batch(tips.map((t) => db.prepare(`INSERT OR REPLACE INTO tips (tipper_id,race_id,barrier_number) VALUES (?,?,?)`).bind(tipper_id, t.race_id, t.barrier_number)));
    return json({ ok: true, count: tips.length });
  }
  if (sub.match(/^\/tips\/\d+\/[A-Z]+$/) && method === "GET") {
    const sp = sub.split("/");
    const tid = sp[2], vc = sp[3];
    const rd = await db.prepare(`SELECT * FROM race_days WHERE is_active=1 AND org_id=? LIMIT 1`).bind(org.id).first();
    if (!rd) return json([]);
    const rows = await db.prepare(`SELECT t.*,r.race_number,h.horse_name FROM tips t JOIN races r ON t.race_id=r.id JOIN venues v ON r.venue_id=v.id LEFT JOIN horses h ON h.race_id=t.race_id AND h.barrier_number=t.barrier_number WHERE t.tipper_id=? AND v.code=? AND v.race_day_id=? ORDER BY r.race_number`).bind(tid, vc, rd.id).all();
    return json(rows.results);
  }
  if (sub === "/admin/horses" && method === "POST") {
    if (!isAdmin) return err("Unauthorised", 401);
    const { race_id, horses } = body;
    if (!race_id || !Array.isArray(horses)) return err("race_id and horses[] required");
    await db.batch(horses.map((h) => db.prepare(`INSERT OR REPLACE INTO horses (race_id,barrier_number,horse_name,is_top_weight) VALUES (?,?,?,?)`).bind(race_id, h.barrier_number, h.horse_name, h.is_top_weight ? 1 : 0)));
    return json({ ok: true, count: horses.length });
  }
  if (sub === "/admin/scratch" && method === "POST") {
    if (!isAdmin) return err("Unauthorised", 401);
    const { horse_id, race_started = false } = body;
    if (!horse_id) return err("horse_id required");
    await db.prepare(`UPDATE horses SET is_scratched=1 WHERE id=?`).bind(horse_id).run();
    if (race_started) {
      const horse = await db.prepare(`SELECT * FROM horses WHERE id=?`).bind(horse_id).first();
      if (horse) {
        const tw = await db.prepare(`SELECT * FROM horses WHERE race_id=? AND is_top_weight=1 AND is_scratched=0 ORDER BY barrier_number LIMIT 1`).bind(horse.race_id).first();
        if (tw) await db.prepare(`UPDATE tips SET barrier_number=? WHERE race_id=? AND barrier_number=?`).bind(tw.barrier_number, horse.race_id, horse.barrier_number).run();
      }
    }
    return json({ ok: true });
  }
  if (sub === "/results" && method === "POST") {
    if (!isAdmin) return err("Unauthorised", 401);
    const { race_id, pos1_barrier, pos1_win_odds, pos1_place_odds, pos2_barrier, pos2_place_odds, pos3_barrier, pos3_place_odds, pos4_barrier } = body;
    if (!race_id || !pos1_barrier) return err("race_id and pos1_barrier required");
    await db.prepare(`INSERT OR REPLACE INTO race_results (race_id,pos1_barrier,pos1_win_odds,pos1_place_odds,pos2_barrier,pos2_place_odds,pos3_barrier,pos3_place_odds,pos4_barrier) VALUES (?,?,?,?,?,?,?,?,?)`).bind(race_id, pos1_barrier, pos1_win_odds || null, pos1_place_odds || null, pos2_barrier || null, pos2_place_odds || null, pos3_barrier || null, pos3_place_odds || null, pos4_barrier || null).run();
    await notifyResultsEntered(db, env, org, race_id);
    return json({ ok: true });
  }
  if (sub.match(/^\/leaderboard\/[A-Z]+$/) && method === "GET") {
    const vc = sub.split("/")[2];
    const rd = await db.prepare(`SELECT * FROM race_days WHERE is_active=1 AND org_id=? LIMIT 1`).bind(org.id).first();
    if (!rd) return json({ score: [], odds: [] });
    const venue = await db.prepare(`SELECT * FROM venues WHERE race_day_id=? AND code=? AND org_id=?`).bind(rd.id, vc, org.id).first();
    if (!venue) return json({ score: [], odds: [] });
    const races = await db.prepare(`SELECT * FROM races WHERE venue_id=? ORDER BY race_number`).bind(venue.id).all();
    const results = await db.prepare(`SELECT rr.*,r.race_number FROM race_results rr JOIN races r ON rr.race_id=r.id WHERE r.venue_id=?`).bind(venue.id).all();
    const resMap = {};
    for (const r of results.results) resMap[r.race_id] = r;
    const tips = await db.prepare(`SELECT t.*,ti.name as tipper_name,ti.motto,r.race_number,r.id as race_id FROM tips t JOIN tippers ti ON t.tipper_id=ti.id JOIN races r ON t.race_id=r.id WHERE r.venue_id=?`).bind(venue.id).all();
    const paidMap = {};
    const payRows = await db.prepare(`SELECT tipper_id, paid FROM payments WHERE race_day_id=? AND venue_code=?`).bind(rd.id, vc).all();
    for (const p of payRows.results) paidMap[p.tipper_id] = p.paid;
    const tm = {};
    for (const tip of tips.results) {
      if (!tm[tip.tipper_id]) tm[tip.tipper_id] = { tipper_id: tip.tipper_id, name: tip.tipper_name, motto: tip.motto, paid: paidMap[tip.tipper_id] ?? null, totalScore: 0, totalOdds: 0, tips: [] };
      const res = resMap[tip.race_id];
      const sc = calcScore(tip.barrier_number, res), od = calcOdds(tip.barrier_number, res);
      tm[tip.tipper_id].totalScore += sc;
      tm[tip.tipper_id].totalOdds = Math.round((tm[tip.tipper_id].totalOdds + od) * 100) / 100;
      tm[tip.tipper_id].tips.push({ race_number: tip.race_number, barrier: tip.barrier_number, score: sc, odds: od });
    }
    const tippers = Object.values(tm);
    const paid = await db.prepare(`SELECT COUNT(*) as cnt FROM payments WHERE race_day_id=? AND venue_code=? AND paid=1`).bind(rd.id, vc).first();
    return json({ venue: venue.track_name, code: vc, pool: (paid?.cnt || 0) * rd.entry_fee, raceCount: races.results.length, racesComplete: results.results.length, score: [...tippers].sort((a, b) => b.totalScore - a.totalScore), odds: [...tippers].sort((a, b) => b.totalOdds - a.totalOdds) });
  }
  if (sub.match(/^\/nextjump\/[A-Z]+$/) && method === "GET") {
    const vc = sub.split("/")[2], rn = url.searchParams.get("race") || 1;
    const rd = await db.prepare(`SELECT * FROM race_days WHERE is_active=1 AND org_id=? LIMIT 1`).bind(org.id).first();
    if (!rd) return json(null);
    const venue = await db.prepare(`SELECT * FROM venues WHERE race_day_id=? AND code=? AND org_id=?`).bind(rd.id, vc, org.id).first();
    if (!venue) return json(null);
    const race = await db.prepare(`SELECT * FROM races WHERE venue_id=? AND race_number=?`).bind(venue.id, rn).first();
    if (!race) return json(null);
    const horses = await db.prepare(`SELECT * FROM horses WHERE race_id=? ORDER BY barrier_number`).bind(race.id).all();
    const tips = await db.prepare(`SELECT t.barrier_number,ti.name as tipper_name,ti.motto,h.horse_name FROM tips t JOIN tippers ti ON t.tipper_id=ti.id LEFT JOIN horses h ON h.race_id=t.race_id AND h.barrier_number=t.barrier_number WHERE t.race_id=? ORDER BY t.barrier_number`).bind(race.id).all();
    return json({ venue: venue.track_name, code: vc, race_number: race.race_number, race_name: race.race_name, horses: horses.results, tips: tips.results });
  }
  if (sub.match(/^\/admin\/alltips\/[A-Z]+$/) && method === "GET") {
    if (!isAdmin) return err("Unauthorised", 401);
    const vc = sub.split("/")[3];
    const rd = await db.prepare(`SELECT * FROM race_days WHERE is_active=1 AND org_id=? LIMIT 1`).bind(org.id).first();
    if (!rd) return json({ races: [], tips: [] });
    const venue = await db.prepare(`SELECT * FROM venues WHERE race_day_id=? AND code=? AND org_id=?`).bind(rd.id, vc, org.id).first();
    if (!venue) return json({ races: [], tips: [] });
    const races = await db.prepare(`SELECT * FROM races WHERE venue_id=? ORDER BY race_number`).bind(venue.id).all();
    const tips = await db.prepare(`SELECT t.tipper_id,ti.name as tipper_name,r.race_number,t.barrier_number,h.horse_name FROM tips t JOIN tippers ti ON t.tipper_id=ti.id JOIN races r ON t.race_id=r.id LEFT JOIN horses h ON h.race_id=t.race_id AND h.barrier_number=t.barrier_number WHERE r.venue_id=? ORDER BY ti.name,r.race_number`).bind(venue.id).all();
    return json({ races: races.results, tips: tips.results });
  }
  if (sub === "/admin/gauntlet" && method === "POST") {
    if (!isAdmin) return err("Unauthorised", 401);
    const { venue_code } = body;
    if (!venue_code) return err("venue_code required");
    const rd = await db.prepare(`SELECT * FROM race_days WHERE is_active=1 AND org_id=? LIMIT 1`).bind(org.id).first();
    if (!rd) return err("No active race day");
    const paid = (await db.prepare(`SELECT DISTINCT t.id,t.name FROM tippers t JOIN payments p ON t.id=p.tipper_id WHERE p.race_day_id=? AND p.venue_code=? AND p.paid=1`).bind(rd.id, venue_code.toUpperCase()).all()).results;
    if (paid.length < 2) return err("Need at least 2 paid tippers");
    for (let i = paid.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [paid[i], paid[j]] = [paid[j], paid[i]];
    }
    await db.prepare(`DELETE FROM gauntlet_matches WHERE race_day_id=? AND venue_code=?`).bind(rd.id, venue_code.toUpperCase()).run();
    const stmts = [];
    for (let i = 0; i < paid.length; i += 2) stmts.push(db.prepare(`INSERT INTO gauntlet_matches (race_day_id,venue_code,tipper1_id,tipper2_id,match_number) VALUES (?,?,?,?,?)`).bind(rd.id, venue_code.toUpperCase(), paid[i].id, paid[i + 1] ? paid[i + 1].id : null, Math.floor(i / 2) + 1));
    await db.batch(stmts);
    return json({ ok: true, matches: stmts.length });
  }
  if (sub.match(/^\/gauntlet\/[A-Z]+$/) && method === "GET") {
    const vc = sub.split("/")[2];
    const rd = await db.prepare(`SELECT * FROM race_days WHERE is_active=1 AND org_id=? LIMIT 1`).bind(org.id).first();
    if (!rd) return json([]);
    const matches = (await db.prepare(`SELECT gm.*,t1.name as t1_name,t2.name as t2_name FROM gauntlet_matches gm JOIN tippers t1 ON gm.tipper1_id=t1.id LEFT JOIN tippers t2 ON gm.tipper2_id=t2.id WHERE gm.race_day_id=? AND gm.venue_code=? ORDER BY gm.match_number`).bind(rd.id, vc).all()).results;
    if (!matches.length) return json([]);
    const venue = await db.prepare(`SELECT * FROM venues WHERE race_day_id=? AND code=? AND org_id=?`).bind(rd.id, vc, org.id).first();
    if (!venue) return json([]);
    const scored = (await db.prepare(`SELECT t.tipper_id,COALESCE(SUM(CASE WHEN rr.pos1_barrier=t.barrier_number THEN 6 WHEN rr.pos2_barrier=t.barrier_number THEN 4 WHEN rr.pos3_barrier=t.barrier_number THEN 2 WHEN rr.pos4_barrier=t.barrier_number THEN 1 ELSE 0 END),0) as total_score FROM tips t JOIN races r ON t.race_id=r.id LEFT JOIN race_results rr ON rr.race_id=t.race_id WHERE r.venue_id=? GROUP BY t.tipper_id`).bind(venue.id).all()).results;
    const sm = {};
    for (const s of scored) sm[s.tipper_id] = s.total_score;
    return json(matches.map((m) => {
      const s1 = sm[m.tipper1_id] || 0, s2 = m.tipper2_id !== null ? sm[m.tipper2_id] || 0 : null;
      let winner_id = null;
      if (s2 === null) winner_id = m.tipper1_id;
      else if (s1 > s2) winner_id = m.tipper1_id;
      else if (s2 > s1) winner_id = m.tipper2_id;
      return { match_number: m.match_number, t1: { id: m.tipper1_id, name: m.t1_name, score: s1 }, t2: m.tipper2_id !== null ? { id: m.tipper2_id, name: m.t2_name, score: s2 } : null, winner_id };
    }));
  }
  if (sub === "/admin/scrape-fields" && method === "POST") {
    if (!isAdmin) return err("Unauthorised", 401);
    const summary = await doScrapeFields(env, org.id);
    if (summary.error) return err(summary.error);
    return json(summary);
  }
  if (sub === "/punter/register" && method === "POST") {
    const { name, email, password, motto } = body;
    if (!name || !email || !password) return err("name, email and password required");
    const existing = await db.prepare(`SELECT id FROM tippers WHERE email=? COLLATE NOCASE AND org_id=?`).bind(email, org.id).first();
    if (existing) return err("An account with that email already exists \u2014 please log in");
    const ph = await hashPassword(password);
    const res = await db.prepare(`INSERT INTO tippers (name,email,motto,password_hash,org_id) VALUES (?,?,?,?,?)`).bind(name, email, motto || null, ph, org.id).run();
    const token = await createTipperSession(db, res.meta.last_row_id, org.id);
    const welcomeHtml = `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f1923;color:#e8e8e8;padding:32px;border-radius:12px">
      <h2 style="color:#c9a227;margin:0 0 16px">🏇 Welcome to ${org.name}!</h2>
      <p style="color:#b0bec5;margin:0 0 8px">Hi ${name}, you're in! You can now pick your horses and submit your tips.</p>
      <a href="https://horseracetipping.com/${org.slug}" style="display:inline-block;background:#c9a227;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:16px">Pick Your Horses →</a>
      <p style="color:#4a5e72;font-size:0.8rem;margin-top:24px">18+ only. <a href="https://horseracetipping.com/terms" style="color:#4a5e72">Terms</a></p>
    </div>`;
    await sendEmail(env, email, `Welcome to ${org.name} — Horse Race Tipping`, welcomeHtml);
    return json({ ok: true, token, tipper: { id: res.meta.last_row_id, name, email, motto: motto || null } });
  }
  if (sub === "/punter/login" && method === "POST") {
    const { email, password } = body;
    if (!email || !password) return err("email and password required");
    const tipper = await db.prepare(`SELECT * FROM tippers WHERE email=? COLLATE NOCASE AND org_id=?`).bind(email, org.id).first();
    if (!tipper) return err("No account found with that email", 401);
    if (!tipper.password_hash) return err("This account was created without a password \u2014 re-register to set one", 401);
    if (!await verifyPassword(password, tipper.password_hash)) return err("Wrong password", 401);
    const token = await createTipperSession(db, tipper.id, org.id);
    return json({ ok: true, token, tipper: { id: tipper.id, name: tipper.name, email: tipper.email, motto: tipper.motto } });
  }
  if (sub === "/punter/me" && method === "GET") {
    const tipperToken = request.headers.get("X-Tipper-Token") || "";
    const me = await validateTipperSession(db, tipperToken, org.id);
    if (!me) return err("Not logged in", 401);
    return json({ id: me.tipper_id, name: me.name, email: me.email, motto: me.motto });
  }
  if (sub === "/punter/history" && method === "GET") {
    const tipperToken = request.headers.get("X-Tipper-Token") || "";
    const me = await validateTipperSession(db, tipperToken, org.id);
    if (!me) return err("Not logged in", 401);
    const rds = await db.prepare(`SELECT DISTINCT rd.id, rd.name, rd.date, rd.entry_fee, v.code as venue_code, v.track_name FROM tips t JOIN races r ON t.race_id=r.id JOIN venues v ON r.venue_id=v.id JOIN race_days rd ON v.race_day_id=rd.id WHERE t.tipper_id=? AND rd.org_id=? ORDER BY rd.date DESC`).bind(me.tipper_id, org.id).all();
    const history = [];
    for (const rd of rds.results) {
      const venue = await db.prepare(`SELECT * FROM venues WHERE race_day_id=? AND code=?`).bind(rd.id, rd.venue_code).first();
      if (!venue) continue;
      const tips = await db.prepare(`SELECT t.barrier_number, r.race_number, h.horse_name, rr.pos1_barrier, rr.pos2_barrier, rr.pos3_barrier, rr.pos4_barrier FROM tips t JOIN races r ON t.race_id=r.id LEFT JOIN horses h ON h.race_id=t.race_id AND h.barrier_number=t.barrier_number LEFT JOIN race_results rr ON rr.race_id=t.race_id WHERE t.tipper_id=? AND r.venue_id=? ORDER BY r.race_number`).bind(me.tipper_id, venue.id).all();
      let score = 0;
      for (const t of tips.results) score += calcScore(t.barrier_number, t);
      const racesComplete = tips.results.filter((t) => t.pos1_barrier).length;
      const paid = await db.prepare(`SELECT paid FROM payments WHERE tipper_id=? AND race_day_id=? AND venue_code=?`).bind(me.tipper_id, rd.id, rd.venue_code).first();
      const allTippers = await db.prepare(`SELECT t.tipper_id, COALESCE(SUM(CASE WHEN rr.pos1_barrier=t.barrier_number THEN 6 WHEN rr.pos2_barrier=t.barrier_number THEN 4 WHEN rr.pos3_barrier=t.barrier_number THEN 2 WHEN rr.pos4_barrier=t.barrier_number THEN 1 ELSE 0 END),0) as total FROM tips t JOIN races r ON t.race_id=r.id LEFT JOIN race_results rr ON rr.race_id=t.race_id WHERE r.venue_id=? GROUP BY t.tipper_id ORDER BY total DESC`).bind(venue.id).all();
      const pos = allTippers.results.findIndex((t) => t.tipper_id === me.tipper_id) + 1;
      history.push({ race_day_id: rd.id, name: rd.name, date: rd.date, venue_code: rd.venue_code, track_name: rd.track_name, score, racesComplete, totalRaces: tips.results.length, position: pos, totalEntrants: allTippers.results.length, paid: paid?.paid ?? null, tips: tips.results });
    }
    return json({ tipper: { id: me.tipper_id, name: me.name, motto: me.motto }, history });
  }
  if (sub === "/admin/scrape-results" && method === "POST") {
    if (!isAdmin) return err("Unauthorised", 401);
    const rd = await db.prepare(`SELECT * FROM race_days WHERE is_active=1 AND org_id=? ORDER BY id DESC LIMIT 1`).bind(org.id).first();
    if (!rd) return err("No active race day");
    const summary = await doScrapeResultsForRD(env, rd);
    if (summary.error) return err(summary.error);
    return json(summary);
  }
  if (sub === "/stripe/checkout" && method === "POST") {
    if (!isAdmin) return err("Unauthorised", 401);
    if (!env.STRIPE_SECRET_KEY) return err("Stripe not configured", 500);
    try {
      const session = await stripe(env, "POST", "/checkout/sessions", {
        mode: "subscription",
        line_items: [{
          price_data: {
            currency: "aud",
            product_data: { name: "Race Tipping \u2014 Monthly Subscription", description: `${org.name} \u2014 unlimited race days, unlimited punters` },
            unit_amount: 2e3,
            recurring: { interval: "month" }
          },
          quantity: 1
        }],
        customer_email: org.admin_email,
        client_reference_id: org.slug,
        metadata: { org_slug: org.slug },
        success_url: `https://horseracetipping.com/${org.slug}?subscribed=1`,
        cancel_url: `https://horseracetipping.com/${org.slug}`
      });
      if (session.error) return err(session.error.message || "Stripe error", 500);
      return json({ url: session.url });
    } catch (e) {
      return err("Stripe request failed: " + e.message, 500);
    }
  }
  if (sub === "/stripe/billing-portal" && method === "POST") {
    if (!isAdmin) return err("Unauthorised", 401);
    if (!env.STRIPE_SECRET_KEY) return err("Stripe not configured", 500);
    if (!org.stripe_customer_id) return err("No active subscription found", 400);
    try {
      const portal = await stripe(env, "POST", "/billing_portal/sessions", {
        customer: org.stripe_customer_id,
        return_url: `https://horseracetipping.com/${org.slug}`
      });
      if (portal.error) return err(portal.error.message || "Stripe error", 500);
      return json({ url: portal.url });
    } catch (e) {
      return err("Stripe request failed: " + e.message, 500);
    }
  }
  return err("Not found", 404);
}
__name(handleAPI, "handleAPI");
__name2(handleAPI, "handleAPI");

function termsHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Terms & Conditions — Horse Race Tipping</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:#0f1923; color:#e8e8e8; font-family:-apple-system,sans-serif; min-height:100vh; padding:40px 20px; }
  .wrap { max-width:720px; margin:0 auto; }
  h1 { color:#c9a227; font-size:1.8rem; margin-bottom:8px; }
  h2 { color:#c9a227; font-size:1.1rem; margin:28px 0 10px; }
  p, li { color:#b0bec5; line-height:1.7; font-size:0.93rem; margin-bottom:10px; }
  ul { padding-left:20px; }
  a { color:#c9a227; }
  .back { display:inline-block; margin-bottom:28px; color:#c9a227; text-decoration:none; font-size:0.9rem; }
  .notice { background:#1e2d3d; border-left:4px solid #c9a227; padding:16px 20px; border-radius:0 8px 8px 0; margin:20px 0; }
</style>
</head>
<body>
<div class="wrap">
  <a href="/" class="back">← Back to horseracetipping.com</a>
  <h1>Terms & Conditions</h1>
  <p><em>Last updated: May 2026</em></p>

  <div class="notice">
    🔞 <strong>You must be 18 years or older to participate in any tipping competition on this platform.</strong>
  </div>

  <h2>1. About This Platform</h2>
  <p>horseracetipping.com provides software tools that allow groups (pubs, clubs, families) to run private horse racing tipping competitions. We are a technology provider, not a gambling operator.</p>

  <h2>2. Nature of Competitions</h2>
  <p>Tipping competitions on this platform involve predicting the outcomes of horse races based on skill and knowledge. Entry fees, prize structures, and competition rules are set entirely by the individual organisers, not by horseracetipping.com.</p>

  <h2>3. Organiser Responsibilities</h2>
  <ul>
    <li>Organisers are solely responsible for ensuring their competition complies with all applicable state and territory laws.</li>
    <li>In NSW, tipping competitions may be classified as progressive lotteries under the <em>Community Gaming Act 2018</em>. A permit may be required if total prize value exceeds $30,000.</li>
    <li>In VIC, tipping competitions are generally considered games of skill and may be exempt from permit requirements under the <em>Gambling Regulation Act 2003</em>.</li>
    <li>Requirements vary in QLD, SA, WA, TAS, ACT, and NT. Organisers should seek independent legal advice if unsure.</li>
    <li>Organisers must not allow persons under 18 to participate in competitions involving entry fees.</li>
  </ul>

  <h2>4. Our Role</h2>
  <p>horseracetipping.com provides the platform only. We do not collect, hold, or distribute entry fees or prize money. All financial transactions between participants are the responsibility of the organiser.</p>

  <h2>5. Race Data</h2>
  <p>Race fields and results are sourced from publicly available data (including the TAB API). We do not guarantee accuracy or timeliness of race data.</p>

  <h2>6. Limitation of Liability</h2>
  <p>horseracetipping.com is provided "as is". We accept no liability for disputes between participants, incorrect race data, or regulatory non-compliance by organisers.</p>

  <h2>7. Subscription &amp; Cancellation</h2>
  <p>Access to horseracetipping.com for organisers is provided on a month-to-month subscription at AUD $20/month (inc. GST). You may cancel at any time from your admin panel or by emailing us — cancellation takes effect at the end of the current billing period, with no refunds for partial months. We reserve the right to change pricing with 30 days notice.</p>

  <h2>8. About Us</h2>
  <p>horseracetipping.com is operated by Luck Dragon Pty Ltd. Enquiries: <a href="mailto:paddy@luckdragon.io">paddy@luckdragon.io</a>.</p>

  <h2>9. Contact</h2>
  <p>Questions? Email <a href="mailto:paddy@luckdragon.io">paddy@luckdragon.io</a></p>
</div>
</body>
</html>`;
}
__name(termsHTML, "termsHTML");
__name2(termsHTML, "termsHTML");

function privacyHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Privacy Policy — Horse Race Tipping</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:#0f1923; color:#e8e8e8; font-family:-apple-system,sans-serif; min-height:100vh; padding:40px 20px; }
  .wrap { max-width:720px; margin:0 auto; }
  h1 { color:#c9a227; font-size:1.8rem; margin-bottom:8px; }
  h2 { color:#c9a227; font-size:1.1rem; margin:28px 0 10px; }
  p, li { color:#b0bec5; line-height:1.7; font-size:0.93rem; margin-bottom:10px; }
  ul { padding-left:20px; }
  a { color:#c9a227; }
  .back { display:inline-block; margin-bottom:28px; color:#c9a227; text-decoration:none; font-size:0.9rem; }
</style>
</head>
<body>
<div class="wrap">
  <a href="/" class="back">← Back to horseracetipping.com</a>
  <h1>Privacy Policy</h1>
  <p><em>Last updated: May 2026</em></p>

  <h2>1. What We Collect</h2>
  <ul>
    <li><strong>Organisers:</strong> Name, email address, password (hashed), organisation name.</li>
    <li><strong>Participants (tippers):</strong> Name and optionally email address, as provided by the organiser or directly entered.</li>
    <li><strong>Tips data:</strong> Horse selections submitted during competitions.</li>
  </ul>

  <h2>2. How We Use It</h2>
  <ul>
    <li>To operate the tipping competition platform.</li>
    <li>To display leaderboards and results to competition participants.</li>
    <li>We do not sell personal data to third parties.</li>
    <li>We do not use personal data for advertising.</li>
  </ul>

  <h2>3. Data Storage</h2>
  <p>Data is stored in Cloudflare D1 (SQLite) hosted on Cloudflare's global edge network. Cloudflare's infrastructure is subject to their own <a href="https://www.cloudflare.com/privacypolicy/" target="_blank">Privacy Policy</a>.</p>

  <h2>4. Data Retention</h2>
  <p>Competition data is retained for 12 months after the last race day associated with an organisation. Organisers may request deletion by emailing us.</p>

  <h2>5. Your Rights</h2>
  <p>Under Australian Privacy Principles (Privacy Act 1988), you have the right to access and correct personal information we hold about you. Contact us at <a href="mailto:paddy@luckdragon.io">paddy@luckdragon.io</a> to exercise these rights.</p>

  <h2>6. Cookies & Analytics</h2>
  <p>We use browser localStorage to store session tokens. We do not use third-party analytics or advertising cookies.</p>

  <h2>7. Contact</h2>
  <p>Privacy enquiries: <a href="mailto:paddy@luckdragon.io">paddy@luckdragon.io</a></p>
</div>
</body>
</html>`;
}
__name(privacyHTML, "privacyHTML");
__name2(privacyHTML, "privacyHTML");

var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/ping" || url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true, worker: "racetipping-api", ts: (/* @__PURE__ */ new Date()).toISOString() }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
    const path = url.pathname;
    const method = request.method;
    if (method === "OPTIONS") return new Response(null, { headers: CORS });
    if (path.startsWith("/api/")) {
      return handleAPI(request, env, url, path, method);
    }
    const parts = path.split("/").filter(Boolean);
    if (parts.length === 0) return html(landingHTML());
    if (parts[0] === "signup") return html(signupHTML());
    if (parts[0] === "terms") return html(termsHTML());
    if (parts[0] === "privacy") return html(privacyHTML());
    const slug = parts[0];
    const org = await getOrg(env.DB, slug);
    if (!org) return new Response("Comp not found \u2014 check the URL and try again.", { status: 404, headers: { "Content-Type": "text/plain" } });
    const settings = JSON.parse(org.settings || "{}");
    return html(orgHTML(org, settings));
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(doScrapeAllResults(env));
  }
};
function landingHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>\u{1F3C7} Race Tipping \u2014 Run your pub's comp</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:#0f1923; color:#e8e8e8; font-family:-apple-system,sans-serif; min-height:100vh; }
  .hero { background:linear-gradient(135deg,#1a7a3c,#0d5c2e); padding:60px 20px; text-align:center; }
  .hero h1 { font-size:2.4rem; margin-bottom:12px; }
  .hero p { font-size:1.1rem; color:rgba(255,255,255,0.85); max-width:500px; margin:0 auto 32px; line-height:1.6; }
  .btn { display:inline-flex; align-items:center; gap:8px; padding:14px 28px; border:none; border-radius:10px; font-size:1rem; font-weight:700; cursor:pointer; text-decoration:none; }
  .btn-gold { background:#c9a227; color:#000; }
  .btn-ghost { background:rgba(255,255,255,0.15); color:#fff; border:2px solid rgba(255,255,255,0.3); }
  .features { max-width:800px; margin:0 auto; padding:50px 20px; }
  .features h2 { color:#c9a227; font-size:1.5rem; text-align:center; margin-bottom:32px; }
  .feat-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:20px; }
  .feat { background:#1e2d3d; border-radius:12px; padding:24px; }
  .feat .icon { font-size:2rem; margin-bottom:12px; }
  .feat h3 { margin-bottom:8px; font-size:1rem; }
  .feat p { font-size:0.87rem; color:#8a9bb0; line-height:1.6; }
  .cta-section { background:#1e2d3d; padding:50px 20px; text-align:center; }
  .cta-section h2 { font-size:1.6rem; margin-bottom:12px; }
  .cta-section p { color:#8a9bb0; margin-bottom:28px; }
  .btn-row { display:flex; gap:12px; justify-content:center; flex-wrap:wrap; }
  footer { text-align:center; padding:24px; color:#8a9bb0; font-size:0.8rem; }
  footer a { color:#c9a227; text-decoration:none; }
</style>
</head>
<body>
<div class="hero">
  <div style="font-size:3rem;margin-bottom:16px">\u{1F3C7}</div>
  <h1>Race Tipping</h1>
  <p>Run your pub's race day tipping comp in minutes. Punters scan a QR code, pick their horses, and watch the live leaderboard \u2014 no app needed.</p>
  <div class="btn-row">
    <a href="/signup" class="btn btn-gold">\u{1F37A} Set Up Your Pub's Comp</a>
  </div>
</div>

<div class="features">
  <h2>Everything you need, nothing you don't</h2>
  <div class="feat-grid">
    <div class="feat"><div class="icon">\u{1F4F1}</div><h3>QR Code Entry</h3><p>Punters scan, pick their horses and submit in under 2 minutes. Works on any phone.</p></div>
    <div class="feat"><div class="icon">\u{1F504}</div><h3>Auto-Imports Fields & Results</h3><p>Pulls horse fields and race results from TAB automatically \u2014 no manual data entry.</p></div>
    <div class="feat"><div class="icon">\u{1F3C6}</div><h3>Live Leaderboard</h3><p>Real-time scoring with both a points comp and an odds comp. Auto-refreshes every 60 seconds.</p></div>
    <div class="feat"><div class="icon">\u2699\uFE0F</div><h3>Your Rules</h3><p>Set your entry fee, prize structure, and welcome message. Brand it with your pub's colours.</p></div>
    <div class="feat"><div class="icon">\u2694\uFE0F</div><h3>Gauntlet Mode</h3><p>Optional head-to-head matchups for extra drama. Auto-generates pairings from paid entries.</p></div>
    <div class="feat"><div class="icon">\u{1F512}</div><h3>Tips Lock</h3><p>Tips automatically lock when Race 1 starts \u2014 no late changes, no arguments.</p></div>
  </div>
</div>

<div class="cta-section">
  <h2>Ready to run your comp?</h2>
  <p>Free to set up. Takes about 5 minutes.</p>
  <div class="btn-row">
    <a href="/signup" class="btn btn-gold" style="font-size:1.1rem;padding:16px 32px">\u{1F37A} Get Started Free</a>
  </div>
</div>

<footer>
  <p>
    <a href="/terms">Terms & Conditions</a> &nbsp;|&nbsp;
    <a href="/privacy">Privacy Policy</a> &nbsp;|&nbsp;
    &copy; 2026 horseracetipping.com
  </p>
  <p style="margin-top:8px;font-size:0.75rem;color:#6a7d94">
    🔞 18+ only. This platform facilitates private tipping competitions between participants.<br>
    Permit requirements vary by state. Organisers are responsible for compliance with local gaming laws.
  </p>
</footer>
</body>
</html>`;
}
__name(landingHTML, "landingHTML");
__name2(landingHTML, "landingHTML");
function signupHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>\u{1F3C7} Set Up Your Comp</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:#0f1923; color:#e8e8e8; font-family:-apple-system,sans-serif; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; }
  .card { background:#1e2d3d; border-radius:16px; padding:32px; width:100%; max-width:480px; }
  h1 { color:#c9a227; margin-bottom:6px; font-size:1.4rem; }
  .sub { color:#8a9bb0; font-size:0.87rem; margin-bottom:24px; }
  label { font-size:0.82rem; color:#8a9bb0; font-weight:600; display:block; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px; }
  input { width:100%; padding:10px 14px; background:#243447; border:1px solid #344d66; border-radius:8px; color:#e8e8e8; font-size:1rem; margin-bottom:16px; }
  input:focus { outline:none; border-color:#c9a227; }
  .slug-row { display:flex; align-items:center; background:#243447; border:1px solid #344d66; border-radius:8px; margin-bottom:16px; overflow:hidden; }
  .slug-prefix { padding:10px 12px; color:#8a9bb0; font-size:0.9rem; white-space:nowrap; border-right:1px solid #344d66; }
  .slug-row input { margin:0; border:none; border-radius:0; background:transparent; }
  .btn { width:100%; padding:14px; background:#c9a227; color:#000; border:none; border-radius:8px; font-size:1rem; font-weight:700; cursor:pointer; margin-top:8px; }
  .btn:hover { background:#e0b52a; }
  #msg { margin-top:12px; padding:12px; border-radius:8px; font-size:0.9rem; display:none; }
  .msg-err { background:rgba(224,82,82,0.2); border-left:3px solid #e05252; }
  .msg-ok { background:rgba(26,122,60,0.2); border-left:3px solid #1a7a3c; }
  a { color:#c9a227; }
</style>
</head>
<body>
<div class="card">
  <h1>\u{1F3C7} Set Up Your Comp</h1>
  <div class="sub">Takes 5 minutes. Free to start. &nbsp;<a href="/">\u2190 Back</a></div>

  <label>Pub / Group Name</label>
  <input id="name" placeholder="e.g. The Bent Spoke Hotel" />

  <label>Your Unique URL</label>
  <div class="slug-row">
    <div class="slug-prefix">horseracetipping.com/</div>
    <input id="slug" placeholder="thebentspoke" oninput="this.value=this.value.toLowerCase().replace(/[^a-z0-9-]/g,'')" />
  </div>

  <label>Admin Email</label>
  <input id="email" type="email" placeholder="you@yourpub.com.au" />

  <label>Admin Password</label>
  <input id="password" type="password" placeholder="Choose a password" />

  <label>Entry Fee (display)</label>
  <input id="entryFee" placeholder="$5 cash at the bar" value="$5 cash at the bar" />

  <label>Prize</label>
  <input id="prize" placeholder="Free pot + $50 bar tab" value="Free pot + $50 bar tab" />

  <label>Payment Details (shown to punters)</label>
  <input id="paymentDetails" placeholder="PayID: 0412 345 678  or  BSB: 123-456 Acc: 12345678" />
  <div style="font-size:0.78rem;color:#8a9bb0;margin-top:-6px;margin-bottom:14px">Leave blank if cash only \u2014 punters will be told to pay at the bar.</div>

  <button class="btn" onclick="doSignup()">Create My Comp \u2192</button>
  <div id="msg"></div>
</div>
<script>
async function doSignup() {
  const name=document.getElementById('name').value.trim();
  const slug=document.getElementById('slug').value.trim();
  const email=document.getElementById('email').value.trim();
  const password=document.getElementById('password').value;
  const entryFee=document.getElementById('entryFee').value.trim();
  const prize=document.getElementById('prize').value.trim();
  const paymentDetails=document.getElementById('paymentDetails').value.trim();
  const msg=document.getElementById('msg');
  if (!name||!slug||!email||!password){showMsg('All fields required','err');return;}
  if (!document.getElementById('agreeTerms').checked){showMsg('Please confirm you are 18+ and agree to the Terms & Conditions','err');return;}
  const r=await fetch('/api/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,slug,admin_email:email,admin_password:password,settings:{entryFee,prize,paymentDetails,tagline:name+' Race Day Tipping'}})}).then(r=>r.json()).catch(()=>null);
  if (!r){showMsg('Request failed','err');return;}
  if (r.error){showMsg(r.error,'err');return;}
  localStorage.setItem('adminToken_'+slug, r.token);
  showMsg('\u2705 Comp created! Redirecting...','ok');
  setTimeout(()=>window.location.href='/'+slug,1200);
}
function showMsg(text,type){const m=document.getElementById('msg');m.textContent=text;m.className='msg-'+type;m.style.display='block';}
<\/script>
</body>
</html>`;
}
__name(signupHTML, "signupHTML");
__name2(signupHTML, "signupHTML");
function orgHTML(org, settings) {
  const primary = settings.primaryColor || "#1a7a3c";
  const accent = settings.accentColor || "#c9a227";
  const slug = org.slug;
  const orgName = org.name;
  const settingsJson = JSON.stringify(settings).replace(/</g, "\\u003c");
  const hasPin = !!settings.adminPin;
  const subStatus = org.subscription_status || "trial";
  const raceDaysUsed = org.race_days_used || 0;
  const trialEnded = subStatus === "trial" && raceDaysUsed >= 2;
  const suspended = subStatus === "suspended";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>\u{1F3C7} ${orgName}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  :root {
    --primary: ${primary};
    --accent:  ${accent};
    --dark:  #0f1923;
    --card:  #1e2d3d;
    --text:  #e8e8e8;
    --muted: #8a9bb0;
    --red:   #e05252;
    --blue:  #4a9fd4;
  }
  body { background:var(--dark); color:var(--text); font-family:-apple-system,sans-serif; min-height:100vh; }
  header { background:linear-gradient(135deg,var(--primary),color-mix(in srgb,var(--primary) 70%,black)); padding:16px 20px; display:flex; align-items:center; gap:12px; }
  header h1 { font-size:1.4rem; }
  header span { font-size:1.8rem; }
  nav { background:#162333; display:flex; overflow-x:auto; border-bottom:2px solid var(--accent); }
  nav button { background:none; border:none; color:var(--muted); padding:12px 18px; cursor:pointer; font-size:0.9rem; white-space:nowrap; transition:all 0.2s; }
  nav button.active,nav button:hover { color:var(--accent); border-bottom:2px solid var(--accent); margin-bottom:-2px; }
  .container { max-width:800px; margin:0 auto; padding:20px 16px; }
  .card { background:var(--card); border-radius:12px; padding:20px; margin-bottom:16px; }
  .card h2 { color:var(--accent); font-size:1.1rem; margin-bottom:14px; }
  input,select,textarea { width:100%; padding:10px 14px; background:#243447; border:1px solid #344d66; border-radius:8px; color:var(--text); font-size:1rem; margin-bottom:10px; }
  input:focus,select:focus { outline:none; border-color:var(--accent); }
  .btn { display:inline-flex; align-items:center; gap:6px; padding:10px 20px; border:none; border-radius:8px; font-size:0.95rem; cursor:pointer; transition:all 0.2s; }
  .btn-gold { background:var(--accent); color:#000; font-weight:700; }
  .btn-gold:hover { filter:brightness(1.15); }
  .btn-green { background:var(--primary); color:#fff; }
  .btn-green:hover { filter:brightness(1.1); }
  .btn-red { background:var(--red); color:#fff; }
  .btn-sm { padding:6px 12px; font-size:0.82rem; }
  .badge { display:inline-block; padding:2px 8px; border-radius:20px; font-size:0.75rem; font-weight:600; }
  .badge-gold { background:var(--accent); color:#000; }
  .badge-green { background:var(--primary); color:#fff; }
  .badge-red { background:var(--red); color:#fff; }
  .badge-blue { background:var(--blue); color:#fff; }
  table { width:100%; border-collapse:collapse; font-size:0.9rem; }
  th { color:var(--muted); font-weight:600; text-align:left; padding:8px 10px; border-bottom:1px solid #2a3e55; }
  td { padding:8px 10px; border-bottom:1px solid #1e2f3f; }
  tr:last-child td { border:none; }
  .rank-1 { color:var(--accent); font-weight:700; font-size:1.1rem; }
  .rank-2 { color:#aaa; font-weight:600; }
  .rank-3 { color:#cd7f32; }
  .venue-tabs { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; }
  .venue-tab { padding:8px 16px; border-radius:20px; border:2px solid #2a3e55; cursor:pointer; font-size:0.85rem; background:none; color:var(--muted); transition:all 0.2s; }
  .venue-tab.active { border-color:var(--accent); color:var(--accent); background:rgba(201,162,39,0.1); }
  .race-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:8px; margin-top:10px; }
  .race-card { background:#243447; border-radius:8px; padding:10px; text-align:center; cursor:pointer; border:2px solid transparent; transition:all 0.2s; }
  .race-card:hover { border-color:var(--accent); }
  .race-card.selected { border-color:var(--accent); background:rgba(201,162,39,0.15); }
  .race-card .rnum { font-size:0.75rem; color:var(--muted); }
  .race-card .choice { font-size:0.85rem; font-weight:600; color:var(--accent); margin-top:4px; }
  .modal { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:100; align-items:center; justify-content:center; padding:20px; }
  .modal.open { display:flex; }
  .modal-box { background:var(--card); border-radius:16px; padding:24px; width:100%; max-width:480px; max-height:80vh; overflow-y:auto; }
  .modal-box h3 { color:var(--accent); margin-bottom:16px; }
  .horse-list { display:flex; flex-direction:column; gap:6px; }
  .horse-item { display:flex; align-items:center; gap:10px; padding:10px 12px; background:#243447; border-radius:8px; cursor:pointer; border:2px solid transparent; transition:all 0.2s; }
  .horse-item:hover { border-color:var(--accent); }
  .horse-item.selected { border-color:var(--accent); background:rgba(201,162,39,0.15); }
  .horse-item.scratched { opacity:0.4; pointer-events:none; text-decoration:line-through; }
  .barrier-num { width:32px; height:32px; display:flex; align-items:center; justify-content:center; background:var(--primary); border-radius:50%; font-weight:700; font-size:0.9rem; flex-shrink:0; }
  .msg { padding:12px 16px; border-radius:8px; margin-bottom:12px; font-size:0.9rem; }
  .msg-success { background:rgba(26,122,60,0.3); border-left:3px solid var(--primary); }
  .msg-error { background:rgba(224,82,82,0.3); border-left:3px solid var(--red); }
  .pool-box { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px; }
  .pool-stat { background:#243447; border-radius:10px; padding:14px; text-align:center; }
  .pool-stat .val { font-size:1.6rem; font-weight:700; color:var(--accent); }
  .pool-stat .lbl { font-size:0.75rem; color:var(--muted); margin-top:2px; }
  .tip-row { display:flex; align-items:center; gap:8px; padding:8px 0; border-bottom:1px solid #1e2f3f; }
  .tip-row:last-child { border:none; }
  .loading { text-align:center; padding:40px; color:var(--muted); }
  @media(max-width:480px) { .pool-box { grid-template-columns:1fr; } }
  .section-title { color:var(--accent); font-size:0.8rem; font-weight:700; text-transform:uppercase; letter-spacing:1px; margin:16px 0 8px; }
  .comp-label { font-size:0.7rem; text-transform:uppercase; letter-spacing:1px; color:var(--muted); }
  .qr-box { text-align:center; padding:20px; background:#243447; border-radius:12px; margin-bottom:16px; }
</style>
</head>
<body>

<header>
  <span>\u{1F3C7}</span>
  <div>
    <h1>${orgName}</h1>
    <div style="font-size:0.8rem;color:rgba(255,255,255,0.7)" id="raceDayLabel">Loading...</div>
  </div>
</header>

<nav>
  <button class="active" onclick="showTab('home')">\u{1F3E0} Home</button>
  <button onclick="showTab('tips')">\u270F\uFE0F Enter Tips</button>
  <button onclick="showTab('leaderboard')">\u{1F3C6} Leaderboard</button>
  <button onclick="showTab('nextjump')">\u{1F514} Next to Jump</button>
  <button onclick="showTab('gauntlet')">\u2694\uFE0F Gauntlet</button>
  <button onclick="showTab('history')">\u{1F4DC} My History</button>
  <button onclick="showTab('admin')">\u2699\uFE0F Admin</button>
</nav>

<!-- HOME -->
<div id="tab-home" class="container">
  <div id="homeContent"><div class="loading">Loading race day info...</div></div>
</div>

<!-- TIPS -->
<div id="tab-tips" class="container" style="display:none">
  <div style="background:#1a2e1a;border:1px solid #2a5a2a;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:0.82rem;color:#8fbc8f">\u{1F512} By entering tips you confirm you are 18+ and agree to the <a href="/terms" target="_blank" style="color:#c9a227">Terms &amp; Conditions</a>.</div>
  <div class="card" id="tipRegCard">
    <h2>\u270F\uFE0F Enter Your Tips</h2>
    <div id="tipMsg"></div>
    <!-- Login form -->
    <div id="tipLoginForm">
      <div style="font-size:0.82rem;color:var(--muted);margin-bottom:10px">Log in to save your history and skip this next time.</div>
      <input id="tipLoginEmail" type="email" placeholder="Email" />
      <input id="tipLoginPassword" type="password" placeholder="Password" />
      <button class="btn btn-gold" onclick="tipperLogin()" style="width:100%;margin-bottom:8px">Log In & Enter Tips \u2192</button>
      <div style="text-align:center;font-size:0.82rem;color:var(--muted)">
        No account? <a href="#" style="color:var(--accent)" onclick="showTipRegister()">Register</a>
        &nbsp;\xB7&nbsp; <a href="#" style="color:var(--accent)" onclick="tipGuestMode()">Continue as guest</a>
      </div>
    </div>
    <!-- Register form -->
    <div id="tipRegisterForm" style="display:none">
      <input id="tipRegName" placeholder="Your name" />
      <input id="tipRegEmail" type="email" placeholder="Email" />
      <input id="tipRegPassword" type="password" placeholder="Choose a password" />
      <input id="tipRegMotto" placeholder="Team motto (optional)" />
      <button class="btn btn-gold" onclick="tipperRegister()" style="width:100%;margin-bottom:8px">Create Account & Enter Tips \u2192</button>
      <div style="text-align:center;font-size:0.82rem;color:var(--muted)">
        Already registered? <a href="#" style="color:var(--accent)" onclick="showTipLogin()">Log in</a>
        &nbsp;\xB7&nbsp; <a href="#" style="color:var(--accent)" onclick="tipGuestMode()">Continue as guest</a>
      </div>
    </div>
    <!-- Guest form -->
    <div id="tipGuestForm" style="display:none">
      <div style="font-size:0.82rem;color:var(--muted);margin-bottom:10px">Guest entry \u2014 tips saved but no history or login.</div>
      <input id="tipName" placeholder="Your name" />
      <input id="tipMotto" placeholder="Team motto (optional)" />
      <button class="btn btn-gold" onclick="startTipping()" style="width:100%;margin-bottom:8px">Enter Tips as Guest \u2192</button>
      <div style="text-align:center;font-size:0.82rem;color:var(--muted)">
        <a href="#" style="color:var(--accent)" onclick="showTipLogin()">\u2190 Back to login</a>
      </div>
    </div>
  </div>
  <div id="tipperBanner" style="display:none;background:var(--card);border-radius:12px;padding:12px 16px;margin-bottom:12px;align-items:center;gap:12px">
    <span style="font-size:1.2rem">\u{1F3C7}</span>
    <span id="tipperBannerText" style="font-weight:600;flex:1"></span>
    <button class="btn" style="padding:4px 12px;font-size:0.85rem" onclick="changeTipper()">\u270F\uFE0F Change</button>
  </div>
  <div id="tipVenueSection" style="display:none">
    <div id="tipsLockedBanner" style="display:none;background:#c0392b;color:#fff;border-radius:8px;padding:10px 16px;margin-bottom:12px;font-weight:600;text-align:center">\u{1F512} Tips are LOCKED \u2014 Race 1 has started!</div>
    <div id="scratchingWarning" style="display:none;background:#e67e22;color:#fff;border-radius:8px;padding:10px 16px;margin-bottom:12px;text-align:center">\u26A0\uFE0F <span id="scratchingWarningText"></span></div>
    <div class="section-title">Select Track</div>
    <div class="venue-tabs" id="tipVenueTabs"></div>
    <div id="tipRaceGrid"></div>
    <div style="margin-top:16px">
      <button class="btn btn-green" id="saveTipsBtn" onclick="submitTips()">\u{1F4BE} Save My Tips</button>
    </div>
  </div>
</div>

<!-- LEADERBOARD -->
<div id="tab-leaderboard" class="container" style="display:none">
  <div class="venue-tabs" id="lbVenueTabs"></div>
  <div id="lbContent"><div class="loading">Select a track above</div></div>
</div>

<!-- NEXT TO JUMP -->
<div id="tab-nextjump" class="container" style="display:none">
  <div class="venue-tabs" id="ntjVenueTabs"></div>
  <div id="ntjRaceNav" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px"></div>
  <div id="ntjContent"><div class="loading">Select a track above</div></div>
</div>

<!-- GAUNTLET -->
<div id="tab-gauntlet" class="container" style="display:none">
  <div class="venue-tabs" id="gauntletVenueTabs"></div>
  <div id="gauntletContent"><div class="loading">Select a track above</div></div>
</div>

<!-- HISTORY -->
<div id="tab-history" class="container" style="display:none">
  <div class="card" id="historyLoginCard">
    <h2>\u{1F4DC} My History</h2>
    <p style="color:var(--muted);font-size:0.9rem;margin-bottom:16px">Log in to see your past comps and scores.</p>
    <div id="historyLoginMsg"></div>
    <div id="historyLoginForm">
      <input id="hLoginEmail" type="email" placeholder="Email" />
      <input id="hLoginPassword" type="password" placeholder="Password" />
      <button class="btn btn-gold" onclick="historyLogin()" style="width:100%">Log In</button>
      <div style="text-align:center;margin-top:10px;font-size:0.85rem;color:var(--muted)">No account? <a href="#" style="color:var(--accent)" onclick="showHistoryRegister()">Register here</a></div>
    </div>
    <div id="historyRegisterForm" style="display:none">
      <input id="hRegName" placeholder="Your name" />
      <input id="hRegEmail" type="email" placeholder="Email" />
      <input id="hRegPassword" type="password" placeholder="Choose a password" />
      <input id="hRegMotto" placeholder="Team motto (optional)" />
      <button class="btn btn-gold" onclick="historyRegister()" style="width:100%">Create Account \u2192</button>
      <div style="text-align:center;margin-top:10px;font-size:0.85rem;color:var(--muted)">Already registered? <a href="#" style="color:var(--accent)" onclick="showHistoryLogin()">Log in</a></div>
    </div>
  </div>
  <div id="historyPanel" style="display:none">
    <div class="card" style="display:flex;align-items:center;gap:12px;padding:14px 20px">
      <span style="font-size:1.6rem">\u{1F3C7}</span>
      <div style="flex:1">
        <div id="historyProfileName" style="font-weight:700;font-size:1.05rem"></div>
        <div id="historyProfileMotto" style="color:var(--muted);font-size:0.82rem"></div>
      </div>
      <button class="btn btn-sm" style="background:#243447;color:var(--muted)" onclick="historyLogout()">Log out</button>
    </div>
    <div id="historyContent"><div class="loading">Loading your history...</div></div>
  </div>
</div>

<!-- ADMIN -->
<div id="tab-admin" class="container" style="display:none">
  <div class="card" id="adminLoginCard">
    <h2>\u2699\uFE0F Admin Login</h2>
    <div id="adminLoginMsg"></div>
    ${hasPin ? `<input type="password" id="adminPinInput" placeholder="Admin PIN" />` : `<input id="adminEmail" placeholder="Admin email" /><input type="password" id="adminPassword" placeholder="Password" />`}
    <button class="btn btn-gold" onclick="adminLogin()">Login</button>
  </div>
  <div id="adminPanel" style="display:none">

    <!-- Subscription wall (shown if trial ended or suspended) -->
    <div id="upgradeWall" style="display:none">
      <div class="card" style="border:2px solid var(--accent);text-align:center;padding:32px 24px">
        <div style="font-size:3rem;margin-bottom:12px">${trialEnded ? "\u23F0" : "\u{1F512}"}</div>
        <h2 style="margin-bottom:8px">${trialEnded ? "Your free trial has ended" : "Account suspended"}</h2>
        <p style="color:var(--muted);margin-bottom:20px;line-height:1.6">${trialEnded ? "You've used your 2 free race days. Subscribe to keep running your comp \u2014 unlimited race days, full leaderboard, QR codes and all." : "This account has been suspended. Subscribe below to reactivate."}</p>
        ${trialEnded || suspended ? `
        <button id="subscribeBtn" onclick="doSubscribe()" style="width:100%;padding:16px;background:var(--accent);color:#000;border:none;border-radius:10px;font-size:1.1rem;font-weight:700;cursor:pointer;margin-bottom:16px">
          Subscribe \u2014 $20/month \u2192
        </button>
        <div style="font-size:0.78rem;color:var(--muted);margin-bottom:16px">Secure payment via Stripe \xB7 Cancel any time</div>` : ""}
        <div style="background:#243447;border-radius:10px;padding:12px 16px;font-size:0.82rem;color:var(--muted)">
          Questions? Contact <a href="mailto:pgallivan@outlook.com" style="color:var(--accent);text-decoration:none">pgallivan@outlook.com</a>
        </div>
      </div>
    </div>

    <!-- Normal admin content -->
    <div id="adminContent">

    <!-- QR Code -->
    <div class="card">
      <h2>\u{1F4F1} Share With Punters</h2>
      <div class="qr-box">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=000000&bgcolor=ffffff&data=https://horseracetipping.com/${slug}" style="border-radius:8px;width:180px;height:180px" />
        <div style="margin-top:12px;font-weight:700;color:var(--accent)">horseracetipping.com/${slug}</div>
        <div style="font-size:0.82rem;color:var(--muted);margin-top:4px">Punters scan this to enter their tips</div>
      </div>
    </div>


    <!-- Subscription Status -->
    <div class="card">
      <h2>\u{1F4B3} Subscription</h2>
      ${subStatus === "active" ? `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span class="badge badge-green">\u2713 Active</span>
            <span style="font-weight:600">$20 / month</span>
          </div>
          <div style="font-size:0.82rem;color:var(--muted)">Unlimited race days \xB7 Billing managed via Stripe</div>
        </div>
        <button class="btn btn-sm" onclick="manageBilling()" style="background:#243447;color:var(--text);border:1px solid #344d66">Manage / Cancel \u2192</button>
      </div>` : subStatus === "trial" ? `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span class="badge badge-gold">Free Trial</span>
            <span style="font-weight:600">${raceDaysUsed} of 2 race days used</span>
          </div>
          <div style="font-size:0.82rem;color:var(--muted)">Subscribe at $20/month for unlimited race days</div>
        </div>
        <button class="btn btn-gold btn-sm" onclick="doSubscribe()">Subscribe \u2192</button>
      </div>` : `
      <div style="color:var(--red)">Account suspended \u2014 <button class="btn btn-gold btn-sm" onclick="doSubscribe()">Reactivate \u2192</button></div>`}
    </div>

        <!-- Setup Race Day -->
    <div class="card">
      <h2>\u{1F4C5} Setup Race Day</h2>
      <input id="rdName" placeholder="Name (e.g. Melbourne Cup Day 2026)" />
      <input id="rdDate" type="date" />
      <input id="rdFee" type="number" value="10" placeholder="Entry fee ($)" />
      <button class="btn btn-green" onclick="createRaceDay()">Create Race Day</button>
    </div>

    <!-- Add Venue -->
    <div class="card">
      <h2>\u{1F4CD} Add Venue</h2>
      <div id="adminRdInfo" style="color:var(--muted);font-size:0.85rem;margin-bottom:10px"></div>
      <select id="venueCode">
        <option value="MEL">MEL - Melbourne</option>
        <option value="SYD">SYD - Sydney</option>
        <option value="ADE">ADE - Adelaide</option>
        <option value="BNE">BNE - Brisbane</option>
        <option value="PER">PER - Perth</option>
        <option value="OTHER">OTHER</option>
      </select>
      <input id="venueTrack" placeholder="Track name (e.g. Flemington)" />
      <input id="venueRaces" type="number" value="10" placeholder="Number of races" />
      <input id="venueR1Start" type="datetime-local" placeholder="Race 1 start time" />
      <button class="btn btn-green" onclick="addVenue()">Add Venue</button>
    </div>

    <!-- Update Venue -->
    <div class="card">
      <h2>\u23F0 Update Venue</h2>
      <select id="updateVenueId" onchange="loadVenueForUpdate()"></select>
      <input id="updateTrackName" placeholder="Track name" />
      <input id="updateR1Start" type="datetime-local" />
      <button class="btn btn-green" onclick="updateVenue()">Update Venue</button>
    </div>

    <!-- Auto-Import Fields -->
    <div class="card">
      <h2>\u{1F504} Auto-Import Fields</h2>
      <div style="font-size:0.82rem;color:var(--muted);margin-bottom:10px">Pulls horse fields from TAB for all active venues. Usually available Wed/Thu before race day.</div>
      <button class="btn btn-green" onclick="scrapeFields()">\u{1F504} Import from TAB</button>
      <div id="scrapeFieldsMsg" style="margin-top:10px;font-size:0.9rem"></div>
    </div>

    <!-- Auto-Import Results -->
    <div class="card">
      <h2>\u{1F3C1} Auto-Import Results</h2>
      <div style="font-size:0.82rem;color:var(--muted);margin-bottom:10px">Pulls finishing positions from TAB. Runs automatically every 5 min \u2014 use this to trigger manually.</div>
      <button class="btn btn-green" onclick="scrapeResults()">\u{1F3C1} Import Results from TAB</button>
      <div id="scrapeResultsMsg" style="margin-top:10px;font-size:0.9rem"></div>
    </div>

    <!-- All Tips Grid -->
    <div class="card">
      <h2>\u{1F4CB} All Tips Summary</h2>
      <select id="allTipsVenueCode"></select>
      <button class="btn btn-green btn-sm" onclick="loadAllTips()" style="margin-left:8px">Load Grid</button>
      <div id="allTipsGrid" style="margin-top:12px;overflow-x:auto"></div>
    </div>

    <!-- Gauntlet Setup -->
    <div class="card">
      <h2>\u2694\uFE0F Generate Gauntlet Draw</h2>
      <select id="gauntletAdminVenue"></select>
      <button class="btn btn-gold" onclick="generateGauntlet()" style="margin-top:8px">\u{1F3B2} Generate Draw</button>
      <div id="gauntletGenMsg" style="margin-top:8px"></div>
    </div>

    <!-- Manual Horse Entry -->
    <div class="card">
      <h2>\u{1F40E} Enter Race Fields (Manual)</h2>
      <select id="fieldVenueId" onchange="loadRacesForAdmin()"></select>
      <select id="fieldRaceId"></select>
      <textarea id="horsesList" rows="8" placeholder="Paste horses, one per line:&#10;1. Horse Name&#10;2. Another Horse&#10;(first = top weight)"></textarea>
      <button class="btn btn-green" onclick="saveHorses()">Save Horses</button>
    </div>

    <!-- Enter Results -->
    <div class="card">
      <h2>\u{1F4CA} Enter Race Results (Manual)</h2>
      <select id="resultVenueId" onchange="loadRacesForResults()"></select>
      <select id="resultRaceId" onchange="loadHorsesForResults()"></select>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div><div class="comp-label">Winner (1st)</div><select id="res1Barrier"></select><input id="res1WinOdds" type="number" step="0.01" placeholder="Win odds" /><input id="res1PlaceOdds" type="number" step="0.01" placeholder="Place odds" /></div>
        <div><div class="comp-label">2nd</div><select id="res2Barrier"></select><input id="res2PlaceOdds" type="number" step="0.01" placeholder="Place odds" /></div>
        <div><div class="comp-label">3rd</div><select id="res3Barrier"></select><input id="res3PlaceOdds" type="number" step="0.01" placeholder="Place odds" /></div>
        <div><div class="comp-label">4th</div><select id="res4Barrier"></select></div>
      </div>
      <button class="btn btn-gold" style="margin-top:10px" onclick="saveResult()">Save Result</button>
    </div>

    <!-- Scratching -->
    <div class="card">
      <h2>\u274C Mark Scratching</h2>
      <select id="scratchVenueId" onchange="loadRacesForScratch()"></select>
      <select id="scratchRaceId" onchange="loadHorsesForScratch()"></select>
      <select id="scratchHorseId"></select>
      <label style="display:flex;align-items:center;gap:8px;margin:10px 0"><input type="checkbox" id="raceStarted"> Race 1 has already started (assign top weight)</label>
      <button class="btn btn-red" onclick="markScratched()">Mark as Scratched</button>
    </div>

    <!-- Payments -->
    <div class="card">
      <h2>\u{1F4B0} Mark Payments</h2>
      <select id="payVenueCode" onchange="loadPayments()"></select>
      <div id="paymentList" style="margin-top:10px"></div>
      <button class="btn btn-green btn-sm" style="margin-top:8px" onclick="loadPayments()">Refresh</button>
    </div>

    <div style="margin-top:16px;text-align:center">
      <button class="btn btn-sm" style="background:#243447;color:var(--muted)" onclick="adminLogout()">Logout</button>
    </div>

    </div><!-- end adminContent -->
  </div>
</div>

<!-- HORSE PICKER MODAL -->
<div class="modal" id="horsePicker">
  <div class="modal-box">
    <h3 id="pickerTitle">Pick your horse</h3>
    <div class="horse-list" id="pickerHorses"></div>
    <button class="btn btn-red btn-sm" style="margin-top:14px" onclick="closeModal()">Cancel</button>
  </div>
</div>

<script>
const ORG_SLUG = '${slug}';
const ORG_SETTINGS = ${settingsJson};
const API = '/api/${slug}';
const SUB_STATUS = '${subStatus}';
const TRIAL_ENDED = ${trialEnded};
const SUSPENDED = ${suspended};
let adminToken = localStorage.getItem('adminToken_${slug}') || '';
let tipperToken = localStorage.getItem('tipperToken_${slug}') || '';
let currentRaceDay = null, currentVenues = [], tipperData = null;
let selectedTips = {}, currentTipVenueId = null, currentRaces = [], horsesCache = {};
let lbRefreshTimer = null, ntjCurrentVenue = null, ntjCurrentRace = 1;

function showTab(name) {
  if (name!=='leaderboard'&&lbRefreshTimer){clearInterval(lbRefreshTimer);lbRefreshTimer=null;}
  document.querySelectorAll('[id^="tab-"]').forEach(el=>el.style.display='none');
  document.getElementById('tab-'+name).style.display='block';
  document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));
  const tabs=['home','tips','leaderboard','nextjump','gauntlet','history','admin'];
  const idx=tabs.indexOf(name);
  if(idx>=0) document.querySelectorAll('nav button')[idx].classList.add('active');
  if(name==='leaderboard') initLeaderboard();
  if(name==='nextjump') initNTJ();
  if(name==='gauntlet') initGauntlet();
  if(name==='history') initHistory();
  if(name==='tips') restoreTipperSession();
  if(name==='admin' && adminToken) { document.getElementById('adminLoginCard').style.display='none'; document.getElementById('adminPanel').style.display='block'; loadAdminData(); }
}

async function apiFetch(path, method='GET', body) {
  const h={'Content-Type':'application/json'};
  if (adminToken) h['Authorization']='Bearer '+adminToken;
  if (tipperToken) h['X-Tipper-Token']=tipperToken;
  const opts={method,headers:h};
  if(body) opts.body=JSON.stringify(body);
  try { return (await fetch(API+path,opts)).json(); } catch(e){console.error(e);return null;}
}

async function loadRaceDay() {
  const data = await apiFetch('/raceday/current');
  currentRaceDay=data; currentVenues=data?.venues||[];
  document.getElementById('raceDayLabel').textContent=data?data.name+' \u2014 '+fmtDate(data.date):'No active race day';
  renderHome();
}

function fmtDate(d) { return new Date(d+'T00:00:00').toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'long',year:'numeric'}); }

function renderHome() {
  const el=document.getElementById('homeContent');
  const s=ORG_SETTINGS;
  if (!currentRaceDay) {
    el.innerHTML=\`<div class="card"><p style="color:var(--muted)">No race day active yet.</p></div>\${s.welcomeMsg?'<div class="card"><p>'+s.welcomeMsg+'</p></div>':''}\`;
    return;
  }
  const rd=currentRaceDay;
  const venueCards=(rd.venues||[]).map(v=>\`
    <div class="card" style="border-left:3px solid var(--accent)">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div><div style="font-weight:700;font-size:1.05rem">\${v.code} \u2014 \${v.track_name}</div>
        \${v.race1_start?'<div style="color:var(--muted);font-size:0.82rem">Cut-off: '+new Date(v.race1_start).toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit'})+'</div>':''}</div>
        <span class="badge badge-gold">$\${rd.entry_fee}</span>
      </div>
    </div>\`).join('');
  el.innerHTML=\`
    <div class="card" style="border-left:3px solid var(--accent)">
      <h2>\u{1F3C7} \${rd.name}</h2>
      <div style="color:var(--muted);margin-bottom:12px">\${fmtDate(rd.date)}</div>
      \${s.welcomeMsg?'<p style="margin-bottom:12px">'+s.welcomeMsg+'</p>':''}
      <div style="font-size:0.9rem;line-height:1.8">
        \${s.entryFee?'<div>\u{1F4B0} <strong>'+s.entryFee+'</strong> entry per track</div>':''}
        \${s.prize?'<div>\u{1F3C6} Prize: <strong>'+s.prize+'</strong></div>':''}
        <div>\u{1F3AF} Pick one horse per race</div>
        <div>\u{1F4CA} 1st=6pts \u2022 2nd=4pts \u2022 3rd=2pts \u2022 4th=1pt</div>
        <div>\u26A0\uFE0F Tips lock when Race 1 starts!</div>
      </div>
    </div>
    <div class="section-title">Active Tracks</div>
    \${venueCards||'<div style="color:var(--muted);font-size:0.85rem">No tracks set up yet.</div>'}
    <div style="margin-top:16px"><button class="btn btn-gold" onclick="showTab('tips')">\u270F\uFE0F Enter My Tips \u2192</button></div>\`;
}

// \u2500\u2500 PUNTER AUTH \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function showTipLogin(){document.getElementById('tipLoginForm').style.display='block';document.getElementById('tipRegisterForm').style.display='none';document.getElementById('tipGuestForm').style.display='none';}
function showTipRegister(){document.getElementById('tipLoginForm').style.display='none';document.getElementById('tipRegisterForm').style.display='block';document.getElementById('tipGuestForm').style.display='none';}
function tipGuestMode(){document.getElementById('tipLoginForm').style.display='none';document.getElementById('tipRegisterForm').style.display='none';document.getElementById('tipGuestForm').style.display='block';}

async function tipperLogin() {
  const email=document.getElementById('tipLoginEmail').value.trim(), password=document.getElementById('tipLoginPassword').value;
  if(!email||!password){showMsg('tipMsg','Email and password required','error');return;}
  const r=await apiFetch('/punter/login','POST',{email,password});
  if(!r||r.error){showMsg('tipMsg',r?.error||'Login failed','error');return;}
  tipperToken=r.token; localStorage.setItem('tipperToken_'+ORG_SLUG,tipperToken);
  tipperData=r.tipper;
  activateTipper();
}

async function tipperRegister() {
  const name=document.getElementById('tipRegName').value.trim(), email=document.getElementById('tipRegEmail').value.trim(), password=document.getElementById('tipRegPassword').value, motto=document.getElementById('tipRegMotto').value.trim();
  if(!name||!email||!password){showMsg('tipMsg','Name, email and password required','error');return;}
  const r=await apiFetch('/punter/register','POST',{name,email,password,motto});
  if(!r||r.error){showMsg('tipMsg',r?.error||'Registration failed','error');return;}
  tipperToken=r.token; localStorage.setItem('tipperToken_'+ORG_SLUG,tipperToken);
  tipperData=r.tipper;
  activateTipper();
}

async function restoreTipperSession() {
  if(!tipperToken) return;
  const r=await apiFetch('/punter/me');
  if(r&&!r.error){tipperData={id:r.id,name:r.name,email:r.email,motto:r.motto};activateTipper();}
  else{tipperToken='';localStorage.removeItem('tipperToken_'+ORG_SLUG);}
}

function activateTipper() {
  if(!currentVenues.length){showMsg('tipMsg','No tracks set up yet','error');return;}
  const tabs=document.getElementById('tipVenueTabs');
  tabs.innerHTML=currentVenues.map(v=>\`<button class="venue-tab" onclick="selectTipVenue(\${v.id},this)">\${v.code} \u2014 \${v.track_name}</button>\`).join('');
  document.getElementById('tipVenueSection').style.display='block';
  document.getElementById('tipRegCard').style.display='none';
  const banner=document.getElementById('tipperBanner');
  banner.style.display='flex';
  document.getElementById('tipperBannerText').textContent='Tipping as: '+tipperData.name+(tipperData.motto?' \u2014 "'+tipperData.motto+'"':'');
  tabs.children[0].click();
}

function changeTipper(){
  tipperToken=''; localStorage.removeItem('tipperToken_'+ORG_SLUG);
  tipperData=null; selectedTips={};
  document.getElementById('tipRegCard').style.display='block';
  document.getElementById('tipperBanner').style.display='none';
  document.getElementById('tipVenueSection').style.display='none';
  showTipLogin();
}

// \u2500\u2500 HISTORY TAB \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function showHistoryLogin(){document.getElementById('historyLoginForm').style.display='block';document.getElementById('historyRegisterForm').style.display='none';}
function showHistoryRegister(){document.getElementById('historyLoginForm').style.display='none';document.getElementById('historyRegisterForm').style.display='block';}

async function historyLogin() {
  const email=document.getElementById('hLoginEmail').value.trim(), password=document.getElementById('hLoginPassword').value;
  if(!email||!password){document.getElementById('historyLoginMsg').innerHTML='<div class="msg msg-error">Email and password required</div>';return;}
  const r=await apiFetch('/punter/login','POST',{email,password});
  if(!r||r.error){document.getElementById('historyLoginMsg').innerHTML='<div class="msg msg-error">'+(r?.error||'Login failed')+'</div>';return;}
  tipperToken=r.token; localStorage.setItem('tipperToken_'+ORG_SLUG,tipperToken);
  showHistoryPanel(r.tipper);
}

async function historyRegister() {
  const name=document.getElementById('hRegName').value.trim(), email=document.getElementById('hRegEmail').value.trim(), password=document.getElementById('hRegPassword').value, motto=document.getElementById('hRegMotto').value.trim();
  if(!name||!email||!password){document.getElementById('historyLoginMsg').innerHTML='<div class="msg msg-error">Name, email and password required</div>';return;}
  const r=await apiFetch('/punter/register','POST',{name,email,password,motto});
  if(!r||r.error){document.getElementById('historyLoginMsg').innerHTML='<div class="msg msg-error">'+(r?.error||'Registration failed')+'</div>';return;}
  tipperToken=r.token; localStorage.setItem('tipperToken_'+ORG_SLUG,tipperToken);
  showHistoryPanel(r.tipper);
}

function historyLogout(){
  tipperToken=''; localStorage.removeItem('tipperToken_'+ORG_SLUG); tipperData=null;
  document.getElementById('historyPanel').style.display='none';
  document.getElementById('historyLoginCard').style.display='block';
}

async function initHistory() {
  if(tipperToken){const r=await apiFetch('/punter/me');if(r&&!r.error){showHistoryPanel(r);return;} tipperToken='';localStorage.removeItem('tipperToken_'+ORG_SLUG);}
  document.getElementById('historyLoginCard').style.display='block';
  document.getElementById('historyPanel').style.display='none';
}

async function showHistoryPanel(tipper) {
  document.getElementById('historyLoginCard').style.display='none';
  document.getElementById('historyPanel').style.display='block';
  document.getElementById('historyProfileName').textContent=tipper.name;
  document.getElementById('historyProfileMotto').textContent=tipper.motto?'"'+tipper.motto+'"':'';
  const data=await apiFetch('/punter/history');
  const el=document.getElementById('historyContent');
  if(!data||data.error){el.innerHTML='<div class="card"><p style="color:var(--muted)">Could not load history.</p></div>';return;}
  if(!data.history.length){el.innerHTML='<div class="card"><p style="color:var(--muted)">No entries yet \u2014 enter your first tips!</p></div>';return;}
  el.innerHTML=data.history.map(h=>{
    const posLabel=h.position?h.position+' / '+h.totalEntrants:'\u2014';
    const medal=h.position===1?'\u{1F947}':h.position===2?'\u{1F948}':h.position===3?'\u{1F949}':'';
    const paidBadge=h.paid===null?'':h.paid?'<span class="badge badge-green" style="margin-left:6px;font-size:0.7rem">\u2713 Paid</span>':'<span class="badge" style="background:#555;color:#ccc;margin-left:6px;font-size:0.7rem">\u23F3 Pending</span>';
    const tipRows=h.tips.map(t=>{const sc=calcScore(t.barrier_number,{pos1_barrier:t.pos1_barrier,pos2_barrier:t.pos2_barrier,pos3_barrier:t.pos3_barrier,pos4_barrier:t.pos4_barrier});return \`<div style="display:flex;justify-content:space-between;font-size:0.82rem;padding:4px 0;border-bottom:1px solid #1e2f3f"><span>R\${t.race_number} \u2014 #\${t.barrier_number} \${t.horse_name||''}</span><span style="color:\${sc>0?'var(--accent)':'var(--muted)'}">\${sc>0?'+'+sc+' pts':'\u2014'}</span></div>\`;}).join('');
    return \`<div class="card" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div><div style="font-weight:700">\${medal} \${h.name}</div><div style="color:var(--muted);font-size:0.8rem">\${h.track_name} \xB7 \${new Date(h.date+'T00:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})}</div></div>
        <div style="text-align:right"><div style="font-size:1.4rem;font-weight:700;color:var(--accent)">\${h.score} pts</div><div style="font-size:0.75rem;color:var(--muted)">Pos: \${posLabel}\${paidBadge}</div></div>
      </div>
      <div style="font-size:0.75rem;color:var(--muted);margin-bottom:6px">\${h.racesComplete}/\${h.totalRaces} races complete</div>
      \${tipRows}
    </div>\`;
  }).join('');
}

// \u2500\u2500 TIPS (guest mode) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function startTipping() {
  const name=document.getElementById('tipName').value.trim();
  if (!name){showMsg('tipMsg','Please enter your name','error');return;}
  if (!currentRaceDay){showMsg('tipMsg','No active race day','error');return;}
  const data=await apiFetch('/tippers','POST',{name,motto:document.getElementById('tipMotto').value.trim()});
  if (!data || data.error){showMsg('tipMsg',data?.error||'Failed to register \u2014 try again','error');return;}
  tipperData=data;
  activateTipper();
}

async function selectTipVenue(venueId,btn){
  document.querySelectorAll('.venue-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); currentTipVenueId=venueId;
  selectedTips[venueId]=selectedTips[venueId]||{};
  const races=await apiFetch('/venue/'+venueId+'/races'); currentRaces=races;
  const venue=currentVenues.find(v=>v.id==venueId);
  if (tipperData&&venue){
    const ex=await apiFetch('/tips/'+tipperData.id+'/'+venue.code);
    for (const t of ex) selectedTips[venueId][t.race_id]=t.barrier_number;
  }
  const lb=document.getElementById('tipsLockedBanner'),sb=document.getElementById('saveTipsBtn');
  if (venue?.race1_start){const locked=new Date()>new Date(venue.race1_start);lb.style.display=locked?'block':'none';if(sb)sb.style.display=locked?'none':'';}
  else lb.style.display='none';
  checkScratchingWarnings(venueId);
  renderRaceGrid();
}

async function checkScratchingWarnings(venueId){
  const tips=selectedTips[venueId]||{},w=document.getElementById('scratchingWarning'),wt=document.getElementById('scratchingWarningText');
  if (!Object.keys(tips).length){w.style.display='none';return;}
  const scratched=[];
  for(const [raceId,barrier] of Object.entries(tips)){
    if(!horsesCache[raceId]) horsesCache[raceId]=await apiFetch('/race/'+raceId+'/horses');
    const horse=(horsesCache[raceId]||[]).find(h=>h.barrier_number==barrier);
    if(horse?.is_scratched){const race=currentRaces.find(r=>r.id==raceId);scratched.push('R'+(race?.race_number||raceId)+': '+horse.horse_name);}
  }
  if(scratched.length){wt.textContent='Scratched horses in your tips: '+scratched.join(', ')+' \u2014 update your picks!';w.style.display='block';}
  else w.style.display='none';
}

function renderRaceGrid(){
  const grid=document.getElementById('tipRaceGrid'),tips=selectedTips[currentTipVenueId]||{};
  grid.innerHTML='<div class="section-title">Click a race to pick your horse</div><div class="race-grid">'+
    currentRaces.map(r=>{const p=tips[r.id];return \`<div class="race-card \${p?'selected':''}" onclick="openPicker(\${r.id})"><div class="rnum">Race \${r.race_number}</div>\${r.race_name?'<div style="font-size:0.7rem;color:var(--muted)">'+r.race_name+'</div>':''}<div class="choice">\${p?'\u{1F40E} #'+p:'\u2014 Pick \u2014'}</div></div>\`;}).join('')+'</div>';
}

async function openPicker(raceId){
  document.getElementById('horsePicker').classList.add('open');
  const race=currentRaces.find(r=>r.id==raceId);
  document.getElementById('pickerTitle').textContent='Race '+race?.race_number+' \u2014 Pick your horse';
  if(!horsesCache[raceId]) horsesCache[raceId]=await apiFetch('/race/'+raceId+'/horses');
  const horses=horsesCache[raceId],cp=(selectedTips[currentTipVenueId]||{})[raceId];
  document.getElementById('pickerHorses').innerHTML=horses.length
    ?horses.map(h=>\`<div class="horse-item \${h.is_scratched?'scratched':''} \${cp==h.barrier_number?'selected':''}" onclick="\${h.is_scratched?'':'pickHorse('+raceId+','+h.barrier_number+')'}">
      <div class="barrier-num">\${h.barrier_number}</div>
      <div style="flex:1"><div style="font-weight:600">\${h.horse_name}\${h.is_top_weight?' \u2B50':''}</div>\${h.is_scratched?'<div style="font-size:0.75rem;color:var(--red)">SCRATCHED</div>':''}</div>
      \${!h.is_scratched&&h.win_odds?\`<div style="text-align:right;font-size:0.8rem;line-height:1.5"><div style="color:var(--accent);font-weight:700">$\${h.win_odds.toFixed(2)}</div><div style="color:var(--muted)">$\${h.place_odds?h.place_odds.toFixed(2):'\u2014'}</div></div>\`:''}
    </div>\`).join('')
    :'<div style="color:var(--muted);text-align:center;padding:20px">No horses loaded yet.</div>';
}

function pickHorse(raceId,barrier){if(!selectedTips[currentTipVenueId])selectedTips[currentTipVenueId]={};selectedTips[currentTipVenueId][raceId]=barrier;closeModal();renderRaceGrid();}
function closeModal(){document.getElementById('horsePicker').classList.remove('open');}

async function submitTips(){
  if(!tipperData){alert('Please enter your name first');return;}
  const arr=Object.entries(selectedTips[currentTipVenueId]||{}).map(([race_id,barrier_number])=>({race_id:parseInt(race_id),barrier_number}));
  if(!arr.length){alert('Please pick at least one horse!');return;}
  const r=await apiFetch('/tips','POST',{tipper_id:tipperData.id,tips:arr});
  if(r?.ok){
    const s=ORG_SETTINGS;
    const fee=s.entryFee||('$'+( currentRaceDay?.entry_fee||'10'));
    let payMsg='';
    if(s.paymentDetails){
      payMsg=\`<div style="margin-top:12px;background:#1a2e1a;border:2px solid var(--primary);border-radius:10px;padding:14px">
        <div style="font-weight:700;margin-bottom:6px">\u{1F4B3} Pay your entry fee to lock in</div>
        <div style="font-size:1.05rem;font-weight:700;color:var(--accent);margin-bottom:6px">\${s.paymentDetails}</div>
        <div style="font-size:0.85rem;color:var(--muted)">Amount: \${fee} &nbsp;\xB7&nbsp; Reference: \${tipperData.name}</div>
        <div style="font-size:0.8rem;color:var(--muted);margin-top:4px">Your entry will be confirmed once payment is received.</div>
      </div>\`;
    } else {
      payMsg=\`<div style="margin-top:12px;background:#1a2e1a;border:2px solid var(--primary);border-radius:10px;padding:14px">
        <div style="font-weight:700;margin-bottom:4px">\u{1F4B0} Pay at the bar</div>
        <div style="font-size:0.85rem;color:var(--muted)">Hand \${fee} to the bar staff and tell them your name: <strong>\${tipperData.name}</strong></div>
      </div>\`;
    }
    const el=document.getElementById('tipMsg');
    el.innerHTML=\`<div class="msg msg-success">\u2705 Tips saved! (\${arr.length} races)</div>\${payMsg}\`;
  } else showMsg('tipMsg',r?.error||'Failed to save','error');
}

// \u2500\u2500 LEADERBOARD \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function initLeaderboard(){
  const tabs=document.getElementById('lbVenueTabs');
  tabs.innerHTML=currentVenues.map(v=>\`<button class="venue-tab" data-code="\${v.code}" onclick="loadLeaderboard('\${v.code}',this)">\${v.code}</button>\`).join('');
  if(currentVenues.length) tabs.children[0].click();
}

async function loadLeaderboard(code,btn){
  document.querySelectorAll('#lbVenueTabs .venue-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('lbContent').innerHTML='<div class="loading">Loading...</div>';
  if(lbRefreshTimer) clearInterval(lbRefreshTimer);
  lbRefreshTimer=setInterval(()=>{const ab=document.querySelector('#lbVenueTabs .venue-tab.active');if(ab)loadLeaderboard(ab.dataset.code||code,ab);},60000);
  const data=await apiFetch('/leaderboard/'+code);
  if(!data||(!data.score?.length&&!data.odds?.length)){document.getElementById('lbContent').innerHTML='<div class="card"><p style="color:var(--muted)">No tips yet for '+code+'</p></div>';return;}
  const pool=data.pool||0,half=pool/2;
  function rankRows(arr,field,prize){return arr.map((t,i)=>{const rc=i===0?'rank-1':i===1?'rank-2':i===2?'rank-3':'',m=i===0?'\u{1F947}':i===1?'\u{1F948}':i===2?'\u{1F949}':(i+1)+'.';const w=i===0?prize*0.5:i===1?prize*0.3:i===2?prize*0.2:0;const payBadge=t.paid===null?'':t.paid?'<span class="badge badge-green" style="font-size:0.65rem;margin-left:4px">\u2713</span>':'<span class="badge" style="background:#555;color:#ccc;font-size:0.65rem;margin-left:4px">\u23F3</span>';return \`<tr><td class="\${rc}">\${m}</td><td><div class="\${rc}">\${t.name}\${payBadge}</div>\${t.motto?'<div style="font-size:0.75rem;color:var(--muted)">'+t.motto+'</div>':''}</td><td class="\${rc}" style="text-align:right">\${field==='totalScore'?t.totalScore+' pts':'$'+t.totalOdds.toFixed(2)}</td>\${prize>0&&w>0?'<td style="text-align:right;color:var(--accent)">$'+w.toFixed(0)+'</td>':'<td></td>'}</tr>\`;}).join('');}
  document.getElementById('lbContent').innerHTML=\`
    <div class="pool-box">
      <div class="pool-stat"><div class="val">$\${pool}</div><div class="lbl">Prize Pool</div></div>
      <div class="pool-stat"><div class="val">\${data.racesComplete}/\${data.raceCount}</div><div class="lbl">Races Complete</div></div>
    </div>
    <div class="card"><h2>\u{1F3AF} Score Comp</h2><div style="font-size:0.75rem;color:var(--muted);margin-bottom:10px">1st=6pts \u2022 2nd=4pts \u2022 3rd=2pts \u2022 4th=1pt</div>
      <table><thead><tr><th>#</th><th>Tipster</th><th style="text-align:right">Score</th><th style="text-align:right">Prize</th></tr></thead><tbody>\${rankRows(data.score,'totalScore',half)}</tbody></table></div>
    <div class="card"><h2>\u{1F3B0} Odds Comp</h2><div style="font-size:0.75rem;color:var(--muted);margin-bottom:10px">Hypothetical $1 each-way \u2014 total collect</div>
      <table><thead><tr><th>#</th><th>Tipster</th><th style="text-align:right">Collect</th><th style="text-align:right">Prize</th></tr></thead><tbody>\${rankRows(data.odds,'totalOdds',half)}</tbody></table></div>\`;
}

// \u2500\u2500 NEXT TO JUMP \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function initNTJ(){
  const tabs=document.getElementById('ntjVenueTabs');
  tabs.innerHTML=currentVenues.map(v=>\`<button class="venue-tab" onclick="selectNTJVenue('\${v.code}',this)">\${v.code}</button>\`).join('');
  if(currentVenues.length) tabs.children[0].click();
}
async function selectNTJVenue(code,btn){document.querySelectorAll('#ntjVenueTabs .venue-tab').forEach(b=>b.classList.remove('active'));btn.classList.add('active');ntjCurrentVenue=code;ntjCurrentRace=1;renderNTJNav();loadNTJ();}
function renderNTJNav(){const v=currentVenues.find(v=>v.code===ntjCurrentVenue);if(!v)return;document.getElementById('ntjRaceNav').innerHTML=Array.from({length:v.num_races},(_,i)=>i+1).map(n=>\`<button class="venue-tab \${n===ntjCurrentRace?'active':''}" onclick="selectNTJRace(\${n})">R\${n}</button>\`).join('');}
function selectNTJRace(n){ntjCurrentRace=n;renderNTJNav();loadNTJ();}
async function loadNTJ(){
  document.getElementById('ntjContent').innerHTML='<div class="loading">Loading...</div>';
  const data=await apiFetch('/nextjump/'+ntjCurrentVenue+'?race='+ntjCurrentRace);
  if(!data){document.getElementById('ntjContent').innerHTML='<div class="card"><p style="color:var(--muted)">No data available</p></div>';return;}
  const byBarrier={};
  for(const t of data.tips){if(!byBarrier[t.barrier_number])byBarrier[t.barrier_number]={horse_name:t.horse_name,tippers:[]};byBarrier[t.barrier_number].tippers.push({name:t.tipper_name,motto:t.motto});}
  document.getElementById('ntjContent').innerHTML=\`<div class="card"><h2>Race \${data.race_number}\${data.race_name?' \u2014 '+data.race_name:''}</h2><div style="color:var(--muted);font-size:0.8rem;margin-bottom:12px">\${data.venue}</div>
    \${data.horses.length?data.horses.map(h=>{const g=byBarrier[h.barrier_number];return \`<div style="background:#243447;border-radius:8px;padding:12px;margin-bottom:8px;\${h.is_scratched?'opacity:0.4':''}">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div class="barrier-num">\${h.barrier_number}</div>
        <div style="flex:1"><div style="font-weight:600">\${h.horse_name}\${h.is_top_weight?' \u2B50':''}</div>\${h.is_scratched?'<span class="badge badge-red">SCRATCHED</span>':''}</div>
        \${!h.is_scratched&&h.win_odds?\`<div style="text-align:right;font-size:0.8rem;margin-right:8px"><div style="color:var(--accent);font-weight:700">$\${h.win_odds.toFixed(2)}</div><div style="color:var(--muted)">$\${h.place_odds?h.place_odds.toFixed(2):'\u2014'}</div></div>\`:''}
        <div style="color:var(--accent);font-weight:700;white-space:nowrap">\${g?g.tippers.length+' tip'+(g.tippers.length>1?'s':''):''}</div>
      </div>
      \${g?'<div style="display:flex;flex-wrap:wrap;gap:4px">'+g.tippers.map(t=>'<span class="badge badge-green">'+t.name+'</span>').join('')+'</div>':''}
    </div>\`;}).join(''):'<p style="color:var(--muted)">No horses loaded yet.</p>'}
  </div>\`;
}

// \u2500\u2500 GAUNTLET \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function initGauntlet(){
  const tabs=document.getElementById('gauntletVenueTabs');
  tabs.innerHTML=currentVenues.map(v=>\`<button class="venue-tab" onclick="loadGauntlet('\${v.code}',this)">\${v.code} \u2014 \${v.track_name}</button>\`).join('');
  if(currentVenues.length) tabs.children[0].click();
}
async function loadGauntlet(code,btn){
  document.querySelectorAll('#gauntletVenueTabs .venue-tab').forEach(b=>b.classList.remove('active'));btn.classList.add('active');
  document.getElementById('gauntletContent').innerHTML='<div class="loading">Loading...</div>';
  const data=await apiFetch('/gauntlet/'+code);
  if(!data||!data.length){document.getElementById('gauntletContent').innerHTML=\`<div class="card"><p style="color:var(--muted)">No Gauntlet draw yet for \${code}.</p></div>\`;return;}
  const pc=(p,iw,id)=>\`<div style="flex:1;background:#243447;border-radius:10px;padding:14px;text-align:center;border:2px solid \${iw?'var(--accent)':id?'var(--blue)':'transparent'}">\${iw?'<div style="font-size:0.7rem;color:var(--accent);font-weight:700;margin-bottom:4px">\u{1F3C6} WINNER</div>':''}\${id&&!iw?'<div style="font-size:0.7rem;color:var(--blue);font-weight:700;margin-bottom:4px">\u{1F91D} DRAW</div>':''}<div style="font-weight:700;\${iw?'color:var(--accent)':''}">\${p.name}</div><div style="font-size:1.4rem;font-weight:700;margin-top:6px;\${iw?'color:var(--accent)':'color:var(--muted)'}">\${p.score} pts</div></div>\`;
  document.getElementById('gauntletContent').innerHTML=data.map(m=>{const isDraw=!m.winner_id&&m.t2,t1w=m.winner_id===m.t1.id,t2w=m.t2&&m.winner_id===m.t2.id;return \`<div class="card" style="margin-bottom:12px"><div style="font-size:0.7rem;color:var(--muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px">Match \${m.match_number}</div><div style="display:flex;align-items:center;gap:10px">\${pc(m.t1,t1w,isDraw)}<div style="font-weight:700;color:var(--muted)">VS</div>\${m.t2?pc(m.t2,t2w,isDraw):'<div style="flex:1;background:#243447;border-radius:10px;padding:14px;text-align:center;color:var(--muted)">BYE</div>'}</div></div>\`;}).join('');
}

// \u2500\u2500 ADMIN \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function adminLogin(){
  const s=ORG_SETTINGS;
  let loginBody={};
  if(s.adminPin){loginBody={pin:document.getElementById('adminPinInput').value};}
  else{loginBody={email:document.getElementById('adminEmail').value,password:document.getElementById('adminPassword').value};}
  const r=await fetch(API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(loginBody)}).then(r=>r.json()).catch(()=>null);
  if(r?.ok){adminToken=r.token;localStorage.setItem('adminToken_'+ORG_SLUG,adminToken);document.getElementById('adminLoginCard').style.display='none';document.getElementById('adminPanel').style.display='block';loadAdminData();}
  else{const m=document.getElementById('adminLoginMsg');m.innerHTML='<div class="msg msg-error">'+(r?.error||'Login failed')+'</div>';}
}

function adminLogout(){adminToken='';localStorage.removeItem('adminToken_'+ORG_SLUG);document.getElementById('adminPanel').style.display='none';document.getElementById('adminLoginCard').style.display='block';}

async function manageBilling(){
  try{
    const r=await fetch(API+'/stripe/billing-portal',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+adminToken}}).then(r=>r.json());
    if(r.url){window.location.href=r.url;}
    else{alert(r.error||'Could not open billing portal \u2014 email pgallivan@outlook.com');}
  }catch(e){alert('Request failed \u2014 check your connection');}
}

async function doSubscribe(){
  const btn=document.getElementById('subscribeBtn');
  if(!btn)return;
  btn.disabled=true;btn.textContent='Redirecting to Stripe...';
  try{
    const r=await fetch(API+'/stripe/checkout',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+adminToken}}).then(r=>r.json());
    if(r.url){window.location.href=r.url;}
    else{alert(r.error||'Something went wrong \u2014 try again or email pgallivan@outlook.com');btn.disabled=false;btn.textContent='Subscribe \u2014 $20/month \u2192';}
  }catch(e){alert('Request failed \u2014 check your connection');btn.disabled=false;btn.textContent='Subscribe \u2014 $20/month \u2192';}
}

// Handle Stripe success redirect
(function(){
  const p=new URLSearchParams(window.location.search);
  if(p.get('subscribed')==='1'){
    history.replaceState({},'',window.location.pathname);
    setTimeout(()=>{
      const msg=document.createElement('div');
      msg.style.cssText='position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#1a7a3c;color:#fff;padding:16px 28px;border-radius:12px;font-weight:700;z-index:9999;font-size:1rem;box-shadow:0 4px 20px rgba(0,0,0,0.4)';
      msg.textContent='\u{1F389} Subscription active! Your comp is ready to go.';
      document.body.appendChild(msg);
      setTimeout(()=>msg.remove(),5000);
    },500);
    // Reload to pick up updated subscription status
    setTimeout(()=>window.location.reload(),1500);
  }
})();

async function loadAdminData(){
  if(TRIAL_ENDED||SUSPENDED){
    document.getElementById('upgradeWall').style.display='block';
    document.getElementById('adminContent').style.display='none';
    return;
  }
  document.getElementById('upgradeWall').style.display='none';
  document.getElementById('adminContent').style.display='block';
  if(currentRaceDay){
    document.getElementById('adminRdInfo').textContent='Current: '+currentRaceDay.name+' (ID: '+currentRaceDay.id+')';
    populateVenueSelects();
  }
}

function populateVenueSelects(){
  const opts=currentVenues.map(v=>\`<option value="\${v.id}">\${v.code} \u2014 \${v.track_name}</option>\`).join('');
  const vcOpts=currentVenues.map(v=>\`<option value="\${v.code}">\${v.code}</option>\`).join('');
  ['fieldVenueId','resultVenueId','scratchVenueId'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=opts;});
  ['allTipsVenueCode','gauntletAdminVenue','payVenueCode'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=vcOpts;});
  populateUpdateVenueSelect();
  if(currentVenues.length){loadRacesForAdmin();loadRacesForResults();loadRacesForScratch();loadPayments();}
}

function populateUpdateVenueSelect(){const opts=currentVenues.map(v=>\`<option value="\${v.id}">\${v.code} \u2014 \${v.track_name}</option>\`).join('');const el=document.getElementById('updateVenueId');if(el){el.innerHTML=opts;loadVenueForUpdate();}}
function loadVenueForUpdate(){const vid=document.getElementById('updateVenueId').value,v=currentVenues.find(v=>String(v.id)===String(vid));if(!v)return;document.getElementById('updateTrackName').value=v.track_name||'';if(v.race1_start){const d=new Date(v.race1_start);document.getElementById('updateR1Start').value=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}}

async function createRaceDay(){
  const name=document.getElementById('rdName').value.trim(),date=document.getElementById('rdDate').value,entry_fee=parseInt(document.getElementById('rdFee').value)||10;
  if(!name||!date){alert('Name and date required');return;}
  const r=await apiFetch('/admin/raceday','POST',{name,date,entry_fee});
  if(r?.error==='TRIAL_ENDED'||r?.error==='SUSPENDED'){loadAdminData();return;}
  if(r?.error){alert(r.error);return;}
  await loadRaceDay();alert('Race day created! Now add venues.');
}

async function addVenue(){
  if(!currentRaceDay){alert('Create a race day first');return;}
  const code=document.getElementById('venueCode').value,track_name=document.getElementById('venueTrack').value.trim(),num_races=parseInt(document.getElementById('venueRaces').value)||10,r1=document.getElementById('venueR1Start').value;
  if(!track_name){alert('Track name required');return;}
  await apiFetch('/admin/venue','POST',{race_day_id:currentRaceDay.id,code,track_name,num_races,race1_start:r1?new Date(r1).toISOString():null});
  await loadRaceDay();populateVenueSelects();alert('Venue added!');
}

async function updateVenue(){
  const vid=document.getElementById('updateVenueId').value,tn=document.getElementById('updateTrackName').value.trim(),r1=document.getElementById('updateR1Start').value;
  const r=await apiFetch('/admin/venue/'+vid,'PUT',{track_name:tn,race1_start:r1?new Date(r1).toISOString():null});
  if(r?.ok){alert('Venue updated!');await loadRaceDay();populateVenueSelects();populateUpdateVenueSelect();}
}

async function loadRacesForAdmin(){const vid=document.getElementById('fieldVenueId').value;const races=await apiFetch('/venue/'+vid+'/races');document.getElementById('fieldRaceId').innerHTML=races.map(r=>\`<option value="\${r.id}">Race \${r.race_number}</option>\`).join('');}
async function saveHorses(){
  const raceId=document.getElementById('fieldRaceId').value,raw=document.getElementById('horsesList').value.trim();
  if(!raw){alert('Enter horses');return;}
  const horses=raw.split('\\n').map((line,i)=>({barrier_number:i+1,horse_name:line.replace(/^\\d+[.)\\-\\s]+/,'').trim(),is_top_weight:i===0})).filter(h=>h.horse_name);
  await apiFetch('/admin/horses','POST',{race_id:parseInt(raceId),horses});
  horsesCache[raceId]=null;alert('Horses saved! ('+horses.length+')');
}

async function loadRacesForResults(){const vid=document.getElementById('resultVenueId').value;const races=await apiFetch('/venue/'+vid+'/races');document.getElementById('resultRaceId').innerHTML=races.map(r=>\`<option value="\${r.id}">Race \${r.race_number}</option>\`).join('');loadHorsesForResults();}
async function loadHorsesForResults(){const raceId=document.getElementById('resultRaceId').value;if(!raceId)return;const horses=await apiFetch('/race/'+raceId+'/horses');const opts='<option value="">--</option>'+horses.map(h=>\`<option value="\${h.barrier_number}">\${h.barrier_number}. \${h.horse_name}</option>\`).join('');['res1Barrier','res2Barrier','res3Barrier','res4Barrier'].forEach(id=>document.getElementById(id).innerHTML=opts);}
async function saveResult(){
  const race_id=document.getElementById('resultRaceId').value,pos1=document.getElementById('res1Barrier').value;
  if(!pos1){alert('Must select winner');return;}
  await apiFetch('/results','POST',{race_id:parseInt(race_id),pos1_barrier:parseInt(pos1),pos1_win_odds:parseFloat(document.getElementById('res1WinOdds').value)||null,pos1_place_odds:parseFloat(document.getElementById('res1PlaceOdds').value)||null,pos2_barrier:parseInt(document.getElementById('res2Barrier').value)||null,pos2_place_odds:parseFloat(document.getElementById('res2PlaceOdds').value)||null,pos3_barrier:parseInt(document.getElementById('res3Barrier').value)||null,pos3_place_odds:parseFloat(document.getElementById('res3PlaceOdds').value)||null,pos4_barrier:parseInt(document.getElementById('res4Barrier').value)||null});
  alert('Result saved!');
}

async function loadRacesForScratch(){const vid=document.getElementById('scratchVenueId').value;const races=await apiFetch('/venue/'+vid+'/races');document.getElementById('scratchRaceId').innerHTML=races.map(r=>\`<option value="\${r.id}">Race \${r.race_number}</option>\`).join('');loadHorsesForScratch();}
async function loadHorsesForScratch(){const raceId=document.getElementById('scratchRaceId').value;if(!raceId)return;const horses=await apiFetch('/race/'+raceId+'/horses');document.getElementById('scratchHorseId').innerHTML=horses.filter(h=>!h.is_scratched).map(h=>\`<option value="\${h.id}">\${h.barrier_number}. \${h.horse_name}</option>\`).join('');}
async function markScratched(){const hid=document.getElementById('scratchHorseId').value,rs=document.getElementById('raceStarted').checked;if(!hid){alert('Select a horse');return;}await apiFetch('/admin/scratch','POST',{horse_id:parseInt(hid),race_started:rs});alert('Marked as scratched!');loadHorsesForScratch();}

async function loadPayments(){
  if(!currentRaceDay)return;
  const vc=document.getElementById('payVenueCode').value;
  const tippers=await apiFetch('/tippers?race_day_id='+currentRaceDay.id);
  // Only show tippers who have a payment record for THIS venue
  const vcTippers=tippers.filter(t=>t.venue_code===vc);
  const pm={};vcTippers.forEach(t=>{pm[t.id]=t.paid;});
  const ut=[...new Map(vcTippers.map(t=>[t.id,t])).values()];
  if(!ut.length){document.getElementById('paymentList').innerHTML=\`<div style="color:var(--muted);font-size:0.85rem">No entries for \${vc} yet.</div>\`;return;}
  document.getElementById('paymentList').innerHTML=ut.map(t=>\`<div class="tip-row"><input type="checkbox" \${pm[t.id]?'checked':''} id="pay_\${t.id}" onchange="togglePayment(\${t.id},this.checked)"><label for="pay_\${t.id}" style="cursor:pointer">\${t.name}</label>\${pm[t.id]?'<span class="badge badge-green" style="margin-left:auto">PAID</span>':''}</div>\`).join('');
}
async function togglePayment(tid,paid){const vc=document.getElementById('payVenueCode').value;await apiFetch('/admin/payment','POST',{tipper_id:tid,race_day_id:currentRaceDay.id,venue_code:vc,paid});}

async function loadAllTips(){
  const code=document.getElementById('allTipsVenueCode').value;
  const data=await apiFetch('/admin/alltips/'+code);
  const grid=document.getElementById('allTipsGrid');
  if(!data||!data.races?.length){grid.innerHTML='<p style="color:var(--muted);font-size:0.85rem">No data yet</p>';return;}
  const tm={};for(const t of data.tips){if(!tm[t.tipper_id])tm[t.tipper_id]={name:t.tipper_name,tips:{}};tm[t.tipper_id].tips[t.race_number]=t.barrier_number+(t.horse_name?' '+t.horse_name:'');}
  const tippers=Object.values(tm).sort((a,b)=>a.name.localeCompare(b.name));
  const rns=data.races.map(r=>r.race_number);
  grid.innerHTML=\`<table style="font-size:0.82rem;border-collapse:collapse;min-width:100%"><thead><tr style="color:var(--muted)"><th style="text-align:left">Tipster</th>\${rns.map(n=>'<th style="min-width:60px;text-align:center">R'+n+'</th>').join('')}<th style="text-align:center">Done</th></tr></thead><tbody>\${tippers.map(t=>\`<tr><td style="white-space:nowrap;font-weight:600;padding-right:12px">\${t.name}</td>\${rns.map(n=>'<td style="text-align:center;font-size:0.78rem">'+(t.tips[n]||'<span style="color:#444">\u2014</span>')+'</td>').join('')}<td style="text-align:center;color:var(--muted);font-size:0.78rem">\${rns.filter(n=>t.tips[n]).length}/\${rns.length}</td></tr>\`).join('')}</tbody></table><div style="font-size:0.75rem;color:var(--muted);margin-top:8px">\${tippers.length} tippers</div>\`;
}

async function generateGauntlet(){
  const vc=document.getElementById('gauntletAdminVenue').value;
  const r=await apiFetch('/admin/gauntlet','POST',{venue_code:vc});
  const m=document.getElementById('gauntletGenMsg');
  m.innerHTML=r?.ok?'<div class="msg msg-success">\u2705 Gauntlet generated \u2014 '+r.matches+' matches!</div>':'<div class="msg msg-error">'+(r?.error||'Failed')+'</div>';
}

async function scrapeFields(){
  const m=document.getElementById('scrapeFieldsMsg');
  m.innerHTML='<div class="msg" style="background:#243447">\u23F3 Importing from TAB\u2026</div>';
  const r=await apiFetch('/admin/scrape-fields','POST',{});
  if(!r){m.innerHTML='<div class="msg msg-error">\u274C Request failed</div>';return;}
  if(r.error){m.innerHTML='<div class="msg msg-error">\u274C '+r.error+'</div>';return;}
  let html='<div class="msg msg-success">\u2705 Import done for <b>'+r.date+'</b></div><ul style="margin-top:8px;padding-left:20px;font-size:0.85rem">';
  for(const x of r.results) html+=x.status==='ok'?'<li><b>'+x.venue+'</b>: '+x.runners_imported+' runners'+(x.races_skipped?', '+x.races_skipped+' skipped':'')+'</li>':'<li><b>'+x.venue+'</b>: \u26A0\uFE0F No TAB meeting found</li>';
  m.innerHTML=html+'</ul>';
}

async function scrapeResults(){
  const m=document.getElementById('scrapeResultsMsg');
  m.innerHTML='<div class="msg" style="background:#243447">\u23F3 Fetching results\u2026</div>';
  const r=await apiFetch('/admin/scrape-results','POST',{});
  if(!r){m.innerHTML='<div class="msg msg-error">\u274C Request failed</div>';return;}
  if(r.error){m.innerHTML='<div class="msg msg-error">\u274C '+r.error+'</div>';return;}
  let html='<div class="msg msg-success">\u2705 Done for <b>'+r.date+'</b></div><ul style="margin-top:8px;padding-left:20px;font-size:0.85rem">';
  for(const x of r.results) html+=x.status==='ok'?'<li><b>'+x.venue+'</b>: '+x.results_imported+' results'+(x.races_pending?', '+x.races_pending+' pending':'')+'</li>':'<li><b>'+x.venue+'</b>: \u26A0\uFE0F '+x.status+'</li>';
  m.innerHTML=html+'</ul>';
}

function showMsg(elId,msg,type){const el=document.getElementById(elId);el.innerHTML=\`<div class="msg msg-\${type}">\${msg}</div>\`;setTimeout(()=>el.innerHTML='',5000);}

loadRaceDay();
<\/script>
<footer style="text-align:center;padding:20px 16px;color:#4a5e72;font-size:0.75rem;border-top:1px solid #1a2e40;margin-top:32px">
  <p>18+ only. This platform facilitates private skill-based tipping competitions. Entry fees and prize structures are set by the organiser.</p>
  <p style="margin-top:6px"><a href="/terms" style="color:#c9a227;text-decoration:none">Terms & Conditions</a> &nbsp;&middot;&nbsp; <a href="/privacy" style="color:#c9a227;text-decoration:none">Privacy Policy</a> &nbsp;&middot;&nbsp; <a href="/" style="color:#4a5e72;text-decoration:none">horseracetipping.com</a></p>
</footer>
</body>
</html>`;
}
__name(orgHTML, "orgHTML");
__name2(orgHTML, "orgHTML");
export {
  worker_default as default
};
//# sourceMappingURL=fixed.js.map
