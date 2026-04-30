// streamlinewebapps-proxy v23 — cache control, rate limiting, legal pages, share button, counter animation, footer links
const SUPABASE = "https://huvfgenbcaiicatvtxak.supabase.co/functions/v1/streamline";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,Authorization" };

// In-memory rate limiter
const _rl = new Map();
function rateOk(ip, key, max, windowMs=60000) {
  const k = ip+':'+key, now = Date.now();
  let w = _rl.get(k);
  if (!w || now > w.r) w = {c:0, r:now+windowMs};
  w.c++; _rl.set(k,w);
  return w.c <= max;
}

// API routes that should be proxied to Supabase
const API_ROUTES = ["/ideas", "/stats", "/vote", "/chat", "/submit", "/analytics"];

const PRIVACY_HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Privacy Policy — Streamline</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#fafaf8;--white:#ffffff;--surface:#f4f4f0;--surface-2:#eeede9;
  --border:#e5e4e0;--border-2:#d5d4cf;
  --ink:#1a1a18;--ink-2:#5a5a56;--ink-3:#9a9994;
  --accent:#4f46e5;--accent-light:#ede9fe;
  --r:10px;--r-lg:16px;
}
html{background:var(--bg);color:var(--ink);font-family:'Inter',sans-serif;font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
nav{background:rgba(250,250,248,.92);backdrop-filter:blur(16px);border-bottom:1px solid var(--border);padding:0 40px}
.nav-inner{max-width:1080px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;height:58px}
.logo{font-family:'Syne',sans-serif;font-weight:800;font-size:19px;letter-spacing:-.03em;display:flex;align-items:center;gap:8px;cursor:pointer}
.logo-mark{width:28px;height:28px;background:var(--accent);border-radius:7px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:800}
main{max-width:900px;margin:0 auto;padding:60px 40px}
h1{font-family:'Syne',sans-serif;font-size:48px;font-weight:800;letter-spacing:-.03em;line-height:1.1;margin-bottom:8px;color:var(--ink)}
.updated{font-size:14px;color:var(--ink-3);margin-bottom:44px}
section{margin-bottom:48px}
h2{font-family:'Syne',sans-serif;font-size:24px;font-weight:700;letter-spacing:-.02em;margin-bottom:12px;margin-top:28px}
h2:first-child{margin-top:0}
p{margin-bottom:14px;color:var(--ink-2);line-height:1.8}
ul,ol{margin-left:20px;margin-bottom:14px}
li{margin-bottom:8px;color:var(--ink-2);line-height:1.7}
footer{border-top:1px solid var(--border);padding:36px 40px;background:var(--white);margin-top:60px}
.foot-inner{max-width:1080px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
.foot-logo{font-family:'Syne',sans-serif;font-size:16px;font-weight:800;letter-spacing:-.02em;display:flex;align-items:center;gap:7px}
.foot-logo .logo-mark{width:22px;height:22px;font-size:11px}
.foot-links{display:flex;gap:20px}
.foot-links a{font-size:13px;color:var(--ink-2)}
.foot-links a:hover{color:var(--accent)}
footer p{font-size:13px;color:var(--ink-3);margin:0}
@media(max-width:768px){
  main,nav{padding-left:20px;padding-right:20px}
  h1{font-size:32px}
  h2{font-size:20px}
  .foot-inner{flex-direction:column;gap:8px;text-align:center}
  .foot-links{justify-content:center}
}
</style></head><body>
<nav>
  <div class="nav-inner">
    <a href="/" class="logo"><div class="logo-mark">✦</div>Streamline</a>
  </div>
</nav>
<main>
  <h1>Privacy Policy</h1>
  <p class="updated">Last updated: April 2026</p>

  <section>
    <p>Streamline ("we", "us", "our", or "Company") operates the streamlinewebapps.com website and related services. This page informs you of our policies regarding the collection, use, and disclosure of personal data when you use our service.</p>
  </section>

  <section>
    <h2>1. Information We Collect</h2>
    <p>We collect several types of information for various purposes:</p>
    <ul>
      <li><strong>Account Information:</strong> When you submit an idea, we collect your name, email address, phone number (optional), app title, category, and idea description.</li>
      <li><strong>Technical Information:</strong> We collect your IP address (via Cloudflare CF-Connecting-IP header) and generate an anonymous fingerprint for voting purposes.</li>
      <li><strong>Payment Information:</strong> Payment processing is handled entirely by Stripe. We do not store credit card details.</li>
      <li><strong>Usage Data:</strong> We track which ideas you vote for, stored locally in your browser.</li>
    </ul>
  </section>

  <section>
    <h2>2. How We Use Your Information</h2>
    <ul>
      <li>To review and potentially build your submitted idea</li>
      <li>To process payments and manage your account</li>
      <li>To calculate and pay commissions on app revenue</li>
      <li>To prevent fraud and abuse through IP-based rate limiting</li>
      <li>To allow community voting on idea popularity</li>
      <li>To send you updates about your ideas and the platform</li>
    </ul>
  </section>

  <section>
    <h2>3. Australian Privacy Principles (APPs)</h2>
    <p>We comply with Australia's Privacy Act 1988 and the Australian Privacy Principles. You have the right to:</p>
    <ul>
      <li>Request access to personal information we hold about you</li>
      <li>Ask us to correct inaccurate or incomplete information</li>
      <li>Request deletion of your data (subject to legal retention requirements)</li>
      <li>Object to our use of your information</li>
    </ul>
    <p>To exercise these rights, contact us at hello@streamlinewebapps.com.</p>
  </section>

  <section>
    <h2>4. Data Storage</h2>
    <p>Your information is stored securely in Supabase (Australia region) and protected with SSL encryption. We retain submission data indefinitely to calculate ongoing commissions. Voting records are stored for 12 months.</p>
  </section>

  <section>
    <h2>5. Third-Party Services</h2>
    <ul>
      <li><strong>Stripe:</strong> Payment processing. See Stripe's privacy policy at stripe.com/privacy.</li>
      <li><strong>Supabase:</strong> Data storage. See Supabase's privacy policy at supabase.com/privacy.</li>
      <li><strong>Cloudflare:</strong> CDN and infrastructure. See Cloudflare's privacy policy at cloudflare.com/privacypolicy.</li>
    </ul>
  </section>

  <section>
    <h2>6. Security</h2>
    <p>We implement industry-standard security measures to protect your data. However, no method of transmission over the Internet is 100% secure. While we strive to protect your personal information, we cannot guarantee its absolute security.</p>
  </section>

  <section>
    <h2>7. Changes to This Policy</h2>
    <p>We may update this privacy policy periodically. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date.</p>
  </section>

  <section>
    <h2>8. Contact Us</h2>
    <p>If you have any questions about this privacy policy or our practices, please contact us at hello@streamlinewebapps.com.</p>
  </section>
</main>
<footer>
  <div class="foot-inner">
    <div class="foot-logo"><div class="logo-mark">✦</div>Streamline</div>
    <div class="foot-links">
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
      <a href="/refunds">Refunds</a>
    </div>
    <p>© 2026 Luck Dragon</p>
  </div>
</footer>
</body></html>`;

const TERMS_HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Terms of Service — Streamline</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#fafaf8;--white:#ffffff;--surface:#f4f4f0;--surface-2:#eeede9;
  --border:#e5e4e0;--border-2:#d5d4cf;
  --ink:#1a1a18;--ink-2:#5a5a56;--ink-3:#9a9994;
  --accent:#4f46e5;--accent-light:#ede9fe;
  --r:10px;--r-lg:16px;
}
html{background:var(--bg);color:var(--ink);font-family:'Inter',sans-serif;font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
nav{background:rgba(250,250,248,.92);backdrop-filter:blur(16px);border-bottom:1px solid var(--border);padding:0 40px}
.nav-inner{max-width:1080px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;height:58px}
.logo{font-family:'Syne',sans-serif;font-weight:800;font-size:19px;letter-spacing:-.03em;display:flex;align-items:center;gap:8px;cursor:pointer}
.logo-mark{width:28px;height:28px;background:var(--accent);border-radius:7px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:800}
main{max-width:900px;margin:0 auto;padding:60px 40px}
h1{font-family:'Syne',sans-serif;font-size:48px;font-weight:800;letter-spacing:-.03em;line-height:1.1;margin-bottom:8px;color:var(--ink)}
.updated{font-size:14px;color:var(--ink-3);margin-bottom:44px}
section{margin-bottom:48px}
h2{font-family:'Syne',sans-serif;font-size:24px;font-weight:700;letter-spacing:-.02em;margin-bottom:12px;margin-top:28px}
h2:first-child{margin-top:0}
p{margin-bottom:14px;color:var(--ink-2);line-height:1.8}
ul,ol{margin-left:20px;margin-bottom:14px}
li{margin-bottom:8px;color:var(--ink-2);line-height:1.7}
footer{border-top:1px solid var(--border);padding:36px 40px;background:var(--white);margin-top:60px}
.foot-inner{max-width:1080px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
.foot-logo{font-family:'Syne',sans-serif;font-size:16px;font-weight:800;letter-spacing:-.02em;display:flex;align-items:center;gap:7px}
.foot-logo .logo-mark{width:22px;height:22px;font-size:11px}
.foot-links{display:flex;gap:20px}
.foot-links a{font-size:13px;color:var(--ink-2)}
.foot-links a:hover{color:var(--accent)}
footer p{font-size:13px;color:var(--ink-3);margin:0}
@media(max-width:768px){
  main,nav{padding-left:20px;padding-right:20px}
  h1{font-size:32px}
  h2{font-size:20px}
  .foot-inner{flex-direction:column;gap:8px;text-align:center}
  .foot-links{justify-content:center}
}
</style></head><body>
<nav>
  <div class="nav-inner">
    <a href="/" class="logo"><div class="logo-mark">✦</div>Streamline</a>
  </div>
</nav>
<main>
  <h1>Terms of Service</h1>
  <p class="updated">Last updated: April 2026</p>

  <section>
    <p>These Terms of Service ("Terms") govern your use of Streamline, operated by Luck Dragon Pty Ltd ("Company", "we", "us", or "our"). By accessing or using Streamline, you agree to be bound by these Terms.</p>
  </section>

  <section>
    <h2>1. Service Description</h2>
    <p>Streamline is a platform where users submit app ideas in exchange for a one-time fee. Community members vote on ideas. Selected ideas are built by our team, and submitters receive a lifetime commission on revenue generated by the app:</p>
    <ul>
      <li><strong>Standard ($29 AUD):</strong> 20% lifetime commission, 7-day review window, 30-day refund guarantee</li>
      <li><strong>Priority ($99 AUD):</strong> 25% lifetime commission, priority queue placement, 14-day refund guarantee</li>
      <li><strong>Equity ($299 AUD):</strong> 30% lifetime commission, 48-hour build window, 14-day refund guarantee</li>
    </ul>
  </section>

  <section>
    <h2>2. Intellectual Property</h2>
    <p><strong>Standard and Priority Tiers:</strong> Streamline retains full ownership of the built application and all source code. You retain the right to the lifetime commission percentage agreed.</p>
    <p><strong>Equity Tier:</strong> You co-own the application with Streamline and receive co-founder credit in the product. Both parties own the intellectual property equally and may not exploit it separately without consent.</p>
  </section>

  <section>
    <h2>3. Payment and Refunds</h2>
    <p>Payments are processed via Stripe using AUD currency. A refund is guaranteed if we do not build your idea within the timeframe specified by your tier (30 days for Standard, 14 days for Priority/Equity).</p>
    <p>Refunds are processed to your original payment method within 5–10 business days of approval.</p>
  </section>

  <section>
    <h2>4. Commission Payments</h2>
    <p>Once your app launches and generates revenue, we calculate your commission monthly. Payments are sent via bank transfer when your balance reaches $50 AUD in a given month, within 5 business days of month end.</p>
    <p>You are responsible for declaring commission income for tax purposes in your jurisdiction.</p>
  </section>

  <section>
    <h2>5. Submission Requirements</h2>
    <p>By submitting an idea, you certify that:</p>
    <ul>
      <li>You own or have rights to the idea you're submitting</li>
      <li>The idea does not infringe on third-party intellectual property</li>
      <li>The information you provide is accurate and truthful</li>
      <li>You are of legal age (18+) and eligible to enter into this agreement</li>
    </ul>
  </section>

  <section>
    <h2>6. Voting and Community</h2>
    <p>Ideas are ranked by community votes. Each user can vote once per idea. Voting is anonymous but tied to a browser fingerprint to prevent duplicate votes. We may disqualify ideas that violate these terms or contain illegal, offensive, or defamatory content.</p>
  </section>

  <section>
    <h2>7. Prohibited Content</h2>
    <p>Ideas must not contain:</p>
    <ul>
      <li>Illegal activity or content that violates Australian law</li>
      <li>Hate speech, discrimination, or harassment</li>
      <li>Explicit sexual or violent content</li>
      <li>Misinformation or scam-related schemes</li>
      <li>Infringement of third-party rights</li>
    </ul>
    <p>We reserve the right to reject or remove any idea that violates these standards without refund.</p>
  </section>

  <section>
    <h2>8. Governing Law</h2>
    <p>These Terms are governed by the laws of Victoria, Australia, and you agree to the exclusive jurisdiction of courts in Victoria.</p>
  </section>

  <section>
    <h2>9. Limitation of Liability</h2>
    <p>To the extent permitted by law, Luck Dragon and Streamline are not liable for indirect, incidental, or consequential damages, including lost profits or revenue.</p>
  </section>

  <section>
    <h2>10. Changes to Terms</h2>
    <p>We may update these Terms at any time. Continued use of Streamline constitutes acceptance of updated Terms.</p>
  </section>

  <section>
    <h2>11. Contact</h2>
    <p>For questions about these Terms, contact us at hello@streamlinewebapps.com.</p>
  </section>
</main>
<footer>
  <div class="foot-inner">
    <div class="foot-logo"><div class="logo-mark">✦</div>Streamline</div>
    <div class="foot-links">
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
      <a href="/refunds">Refunds</a>
    </div>
    <p>© 2026 Luck Dragon</p>
  </div>
</footer>
</body></html>`;

const REFUNDS_HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Refund Policy — Streamline</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#fafaf8;--white:#ffffff;--surface:#f4f4f0;--surface-2:#eeede9;
  --border:#e5e4e0;--border-2:#d5d4cf;
  --ink:#1a1a18;--ink-2:#5a5a56;--ink-3:#9a9994;
  --accent:#4f46e5;--accent-light:#ede9fe;
  --r:10px;--r-lg:16px;
}
html{background:var(--bg);color:var(--ink);font-family:'Inter',sans-serif;font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
nav{background:rgba(250,250,248,.92);backdrop-filter:blur(16px);border-bottom:1px solid var(--border);padding:0 40px}
.nav-inner{max-width:1080px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;height:58px}
.logo{font-family:'Syne',sans-serif;font-weight:800;font-size:19px;letter-spacing:-.03em;display:flex;align-items:center;gap:8px;cursor:pointer}
.logo-mark{width:28px;height:28px;background:var(--accent);border-radius:7px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:800}
main{max-width:900px;margin:0 auto;padding:60px 40px}
h1{font-family:'Syne',sans-serif;font-size:48px;font-weight:800;letter-spacing:-.03em;line-height:1.1;margin-bottom:8px;color:var(--ink)}
.updated{font-size:14px;color:var(--ink-3);margin-bottom:44px}
section{margin-bottom:48px}
h2{font-family:'Syne',sans-serif;font-size:24px;font-weight:700;letter-spacing:-.02em;margin-bottom:12px;margin-top:28px}
h2:first-child{margin-top:0}
p{margin-bottom:14px;color:var(--ink-2);line-height:1.8}
ul,ol{margin-left:20px;margin-bottom:14px}
li{margin-bottom:8px;color:var(--ink-2);line-height:1.7}
.tier-box{background:var(--white);border:1px solid var(--border);border-radius:var(--r-lg);padding:24px;margin:16px 0}
.tier-box h3{font-family:'Syne',sans-serif;font-size:18px;font-weight:700;margin-bottom:8px;color:var(--ink)}
footer{border-top:1px solid var(--border);padding:36px 40px;background:var(--white);margin-top:60px}
.foot-inner{max-width:1080px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
.foot-logo{font-family:'Syne',sans-serif;font-size:16px;font-weight:800;letter-spacing:-.02em;display:flex;align-items:center;gap:7px}
.foot-logo .logo-mark{width:22px;height:22px;font-size:11px}
.foot-links{display:flex;gap:20px}
.foot-links a{font-size:13px;color:var(--ink-2)}
.foot-links a:hover{color:var(--accent)}
footer p{font-size:13px;color:var(--ink-3);margin:0}
@media(max-width:768px){
  main,nav{padding-left:20px;padding-right:20px}
  h1{font-size:32px}
  h2{font-size:20px}
  .foot-inner{flex-direction:column;gap:8px;text-align:center}
  .foot-links{justify-content:center}
}
</style></head><body>
<nav>
  <div class="nav-inner">
    <a href="/" class="logo"><div class="logo-mark">✦</div>Streamline</a>
  </div>
</nav>
<main>
  <h1>Refund Policy</h1>
  <p class="updated">Last updated: April 2026</p>

  <section>
    <p>At Streamline, we stand behind our commitment to build your idea if it's selected by the community. This policy outlines when and how refunds are provided.</p>
  </section>

  <section>
    <h2>Refund Guarantees by Tier</h2>

    <div class="tier-box">
      <h3>Standard Tier ($29 AUD)</h3>
      <p><strong>30-day refund guarantee.</strong> If we have not begun development on your idea within 30 days of your submission, you are eligible for a full refund of your $29 AUD submission fee.</p>
      <p><strong>Conditions:</strong> Your idea must have been submitted in good faith and not violate our Terms of Service.</p>
    </div>

    <div class="tier-box">
      <h3>Priority Tier ($99 AUD)</h3>
      <p><strong>14-day refund guarantee.</strong> If we have not begun development on your idea within 14 days of your submission, you are eligible for a full refund of your $99 AUD submission fee.</p>
      <p><strong>Conditions:</strong> Your idea must receive enough community votes to be queued for development. If insufficient votes are received, we will notify you by day 14 and process a refund.</p>
    </div>

    <div class="tier-box">
      <h3>Equity Tier ($299 AUD)</h3>
      <p><strong>14-day refund guarantee.</strong> We commit to beginning development within 48 hours. If development has not begun within 48 hours, we will contact you to reschedule. If development cannot start within 14 days, a full refund of $299 AUD is processed.</p>
      <p><strong>Conditions:</strong> Equity tier submissions are prioritized and built with guaranteed timelines.</p>
    </div>
  </section>

  <section>
    <h2>How to Request a Refund</h2>
    <p>To request a refund, email hello@streamlinewebapps.com with:</p>
    <ul>
      <li>Your submitted idea title</li>
      <li>The email address associated with your submission</li>
      <li>The reason for your refund request</li>
    </ul>
    <p>We will review your request and respond within 2 business days.</p>
  </section>

  <section>
    <h2>Refund Processing</h2>
    <p>Approved refunds are processed to your original payment method within 5–10 business days. If your payment was made via Stripe, the refund will appear as a credit to the card or payment method used.</p>
  </section>

  <section>
    <h2>What Does NOT Qualify for Refund</h2>
    <ul>
      <li>Ideas rejected due to Terms of Service violations (illegal, offensive, or defamatory content)</li>
      <li>Requests submitted more than 30 days after submission (beyond the guarantee window)</li>
      <li>Ideas that have already been built and shipped</li>
      <li>Refunds requested after the refund period has expired</li>
    </ul>
  </section>

  <section>
    <h2>Commission Disputes</h2>
    <p>If you believe commission calculations are incorrect, contact us at hello@streamlinewebapps.com within 30 days of the relevant payment. We will audit the transaction and either explain the calculation or issue a corrected payment.</p>
  </section>

  <section>
    <h2>Questions?</h2>
    <p>If you have questions about this refund policy, reach out to hello@streamlinewebapps.com and we'll be happy to help.</p>
  </section>
</main>
<footer>
  <div class="foot-inner">
    <div class="foot-logo"><div class="logo-mark">✦</div>Streamline</div>
    <div class="foot-links">
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
      <a href="/refunds">Refunds</a>
    </div>
    <p>© 2026 Luck Dragon</p>
  </div>
</footer>
</body></html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    if (path === "/health") return new Response(JSON.stringify({ ok: true, version: 23 }), { headers: { ...CORS, "Content-Type": "application/json" } });

    // Legal routes
    if (path === "/privacy") return new Response(PRIVACY_HTML, { headers: { "Content-Type": "text/html;charset=utf-8", "Cache-Control": "public,max-age=3600" } });
    if (path === "/terms") return new Response(TERMS_HTML, { headers: { "Content-Type": "text/html;charset=utf-8", "Cache-Control": "public,max-age=3600" } });
    if (path === "/refunds") return new Response(REFUNDS_HTML, { headers: { "Content-Type": "text/html;charset=utf-8", "Cache-Control": "public,max-age=3600" } });

    // Proxy all API routes to Supabase with rate limiting
    if (API_ROUTES.includes(path)) {
      const ip = request.headers.get("CF-Connecting-IP") || "";

      // Apply rate limiting based on route
      if (path === "/submit" && !rateOk(ip, "sub", 5)) {
        return new Response(JSON.stringify({error:"Too many requests"}), {status:429, headers:{...CORS,"Content-Type":"application/json"}});
      }
      if (path === "/chat" && !rateOk(ip, "chat", 20)) {
        return new Response(JSON.stringify({error:"Too many requests"}), {status:429, headers:{...CORS,"Content-Type":"application/json"}});
      }
      if (path === "/vote" && !rateOk(ip, "vote", 30)) {
        return new Response(JSON.stringify({error:"Too many requests"}), {status:429, headers:{...CORS,"Content-Type":"application/json"}});
      }

      const target = SUPABASE + path + url.search;
      const h = new Headers(request.headers);
      h.delete("host");
      try {
        const pr = await fetch(target, {
          method: request.method,
          headers: h,
          body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
          redirect: "follow"
        });
        const rh = new Headers(pr.headers);
        Object.entries(CORS).forEach(([k,v]) => rh.set(k, v));
        rh.set("Cache-Control", "no-cache");
        return new Response(pr.body, { status: pr.status, headers: rh });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Upstream error", detail: e.message }), { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
      }
    }

    // Serve the HTML shell for everything else
    return new Response(HTML, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60", "X-Streamline-Version": "23" }
    });
  }
};

const HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Streamline — Submit an idea. We build it. You earn forever.</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#fafaf8;--white:#ffffff;--surface:#f4f4f0;--surface-2:#eeede9;
  --border:#e5e4e0;--border-2:#d5d4cf;
  --ink:#1a1a18;--ink-2:#5a5a56;--ink-3:#9a9994;
  --accent:#4f46e5;--accent-light:#ede9fe;--accent-mid:#7c3aed;
  --green:#16a34a;--green-bg:#f0fdf4;--amber:#d97706;--amber-bg:#fffbeb;
  --r:10px;--r-lg:16px;
}
html{background:var(--bg);color:var(--ink);font-family:'Inter',sans-serif;font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}button{cursor:pointer;font-family:inherit;background:none;border:none;color:inherit}
input,textarea,select{font-family:inherit}
.topbar{background:var(--ink);color:#fff;padding:9px 24px;display:flex;align-items:center;justify-content:center;gap:20px;font-size:12.5px;font-weight:400;letter-spacing:.01em;overflow-x:auto;white-space:nowrap}
.topbar .dot{width:6px;height:6px;border-radius:50%;background:#4ade80;display:inline-block;margin-right:6px;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.topbar .sep{opacity:.3}
nav{background:rgba(250,250,248,.92);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid var(--border);padding:0 40px;position:sticky;top:0;z-index:90}
.nav-inner{max-width:1080px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;height:58px}
.logo{font-family:'Syne',sans-serif;font-weight:800;font-size:19px;letter-spacing:-.03em;display:flex;align-items:center;gap:8px}
.logo-mark{width:28px;height:28px;background:var(--accent);border-radius:7px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:800}
.nav-links{display:flex;align-items:center;gap:2px}
.nav-links a{padding:6px 13px;font-size:14px;font-weight:500;color:var(--ink-2);border-radius:7px;transition:.15s}
.nav-links a:hover{color:var(--ink);background:var(--surface)}
.nav-cta{padding:8px 18px;background:var(--ink);color:#fff;border-radius:8px;font-size:14px;font-weight:600;transition:.15s}
.nav-cta:hover{background:#2d2d2a}
main{max-width:1080px;margin:0 auto;padding:0 40px}
.hero{padding:88px 0 72px;text-align:center}
.hero-pill{display:inline-flex;align-items:center;gap:8px;padding:5px 14px 5px 8px;background:var(--accent-light);border-radius:999px;font-size:13px;font-weight:500;color:var(--accent);margin-bottom:28px}
.hero-pill-dot{width:20px;height:20px;background:var(--accent);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700}
h1{font-family:'Syne',sans-serif;font-size:clamp(42px,6.5vw,76px);font-weight:800;letter-spacing:-.04em;line-height:1.0;margin-bottom:22px;color:var(--ink)}
.accent-text{color:var(--accent)}
.hero-sub{font-size:18px;color:var(--ink-2);font-weight:300;max-width:500px;margin:0 auto 36px;line-height:1.65}
.hero-btns{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;margin-bottom:56px}
.btn-pri{padding:12px 26px;background:var(--ink);color:#fff;border-radius:9px;font-size:15px;font-weight:600;transition:.15s;display:inline-flex;align-items:center;gap:7px}
.btn-pri:hover{background:#2d2d2a;transform:translateY(-1px)}
.btn-sec{padding:12px 26px;background:var(--white);color:var(--ink);border:1px solid var(--border-2);border-radius:9px;font-size:15px;font-weight:500;transition:.15s}
.btn-sec:hover{border-color:var(--ink-3);transform:translateY(-1px)}
.hero-stats{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden;background:var(--white);max-width:580px;margin:0 auto;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.stat{padding:18px 20px;text-align:center;border-right:1px solid var(--border)}
.stat:last-child{border-right:none}
.stat-val{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:var(--ink)}
.stat-lbl{font-size:11.5px;color:var(--ink-3);margin-top:2px;font-weight:400}
section{padding:64px 0}
.section-tag{font-size:12px;font-weight:600;color:var(--accent);letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;display:flex;align-items:center;gap:6px}
.section-tag::before{content:'';width:16px;height:2px;background:var(--accent);border-radius:1px}
h2{font-family:'Syne',sans-serif;font-size:clamp(26px,3.8vw,42px);font-weight:800;letter-spacing:-.03em;line-height:1.1;margin-bottom:14px;color:var(--ink)}
.section-desc{font-size:17px;color:var(--ink-2);font-weight:300;max-width:460px;line-height:1.65;margin-bottom:44px}
.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.step{background:var(--white);border:1px solid var(--border);border-radius:var(--r-lg);padding:28px 24px;transition:.2s}
.step:hover{border-color:var(--border-2);box-shadow:0 4px 16px rgba(0,0,0,.06);transform:translateY(-2px)}
.step-num{width:34px;height:34px;background:var(--accent-light);border-radius:9px;display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:var(--accent);margin-bottom:18px}
.step h3{font-family:'Syne',sans-serif;font-size:17px;font-weight:700;margin-bottom:7px}
.step p{font-size:14px;color:var(--ink-2);line-height:1.6;font-weight:300}
.feat-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.feat-card{background:var(--white);border:1px solid var(--border);border-radius:var(--r-lg);padding:36px;transition:.2s}
.feat-card:hover{box-shadow:0 8px 28px rgba(0,0,0,.08);transform:translateY(-2px)}
.feat-card.main{background:var(--ink);color:#fff;border-color:var(--ink)}
.feat-tag{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:600;letter-spacing:.04em;margin-bottom:14px}
.feat-tag.live{background:var(--green-bg);color:var(--green)}
.feat-card.main .feat-tag.live{background:rgba(74,222,128,.12);color:#4ade80}
.feat-tag.next{background:var(--amber-bg);color:var(--amber)}
.feat-card h3{font-family:'Syne',sans-serif;font-size:30px;font-weight:800;letter-spacing:-.03em;margin-bottom:8px}
.feat-card p{font-size:14px;font-weight:300;line-height:1.65;margin-bottom:22px;color:var(--ink-2)}
.feat-card.main p{color:rgba(255,255,255,.65)}
.feat-chips{display:flex;gap:7px;flex-wrap:wrap}
.feat-chip{padding:4px 11px;background:var(--surface);border:1px solid var(--border);border-radius:6px;font-size:12px;font-weight:500;color:var(--ink-2)}
.feat-card.main .feat-chip{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.15);color:rgba(255,255,255,.75)}
.filters{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:24px}
.chip{padding:6px 15px;background:var(--white);border:1px solid var(--border);border-radius:7px;font-size:13px;font-weight:500;color:var(--ink-2);cursor:pointer;transition:.15s}
.chip:hover{border-color:var(--border-2);color:var(--ink)}
.chip.active{background:var(--ink);border-color:var(--ink);color:#fff}
.ideas-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(295px,1fr));gap:11px}
.idea{background:var(--white);border:1px solid var(--border);border-radius:var(--r);padding:18px;display:flex;flex-direction:column;transition:.15s}
.idea:hover{border-color:var(--border-2);box-shadow:0 2px 10px rgba(0,0,0,.05)}
.idea-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:11px}
.idea-icon{width:38px;height:38px;background:var(--surface);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:18px;border:1px solid var(--border)}
.vote-btn{display:flex;flex-direction:column;align-items:center;gap:1px;padding:6px 10px;background:var(--surface);border:1px solid var(--border);border-radius:7px;min-width:44px;cursor:pointer;transition:.15s;position:relative}
.vote-btn:hover{border-color:var(--accent);background:var(--accent-light)}
.vote-btn.voted{background:var(--accent-light);border-color:var(--accent)}
.vote-arr{font-size:10px;color:var(--ink-3)}
.vote-cnt{font-size:14px;font-weight:600;font-family:'Syne',sans-serif;color:var(--ink)}
.vote-btn.voted .vote-arr,.vote-btn.voted .vote-cnt{color:var(--accent)}
.idea h4{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;margin-bottom:5px;letter-spacing:-.01em}
.idea-desc{font-size:13px;color:var(--ink-2);font-weight:300;line-height:1.5;flex:1;margin-bottom:12px}
.idea-foot{display:flex;gap:5px;flex-wrap:wrap;align-items:center}
.share-btn{padding:4px 9px;background:var(--surface);border:1px solid var(--border);border-radius:7px;font-size:12px;cursor:pointer;transition:.15s;color:var(--ink-2);position:relative}
.share-btn:hover{border-color:var(--accent);color:var(--accent)}
.share-tooltip{position:absolute;bottom:100%;left:50%;transform:translateX(-50%);background:var(--ink);color:#fff;padding:4px 8px;border-radius:5px;font-size:11px;white-space:nowrap;pointer-events:none;opacity:0;transition:.2s;margin-bottom:6px}
.share-tooltip.show{opacity:1}
.badge{padding:2px 8px;border-radius:5px;font-size:11px;font-weight:500;border:1px solid transparent}
.b-live{background:var(--green-bg);border-color:#bbf7d0;color:var(--green)}
.b-building{background:var(--amber-bg);border-color:#fde68a;color:var(--amber)}
.b-queued{background:var(--surface);border-color:var(--border);color:var(--ink-3)}
.b-cat{background:var(--surface);border-color:var(--border);color:var(--ink-3)}
.b-rev{background:var(--accent-light);border-color:#c4b5fd;color:var(--accent)}
.tiers-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;align-items:start}
.tier{background:var(--white);border:1px solid var(--border);border-radius:var(--r-lg);padding:30px;display:flex;flex-direction:column;cursor:pointer;transition:.2s;position:relative}
.tier:hover{box-shadow:0 8px 28px rgba(0,0,0,.08);border-color:var(--border-2);transform:translateY(-2px)}
.tier.featured{background:var(--ink);border-color:var(--ink);color:#fff}
.tier-popular{position:absolute;top:-1px;left:50%;transform:translateX(-50%);background:var(--accent);color:#fff;font-size:11px;font-weight:600;letter-spacing:.06em;padding:3px 12px;border-radius:0 0 8px 8px}
.tier-name{font-size:11.5px;font-weight:600;color:var(--ink-3);letter-spacing:.08em;text-transform:uppercase;margin-bottom:14px}
.tier.featured .tier-name{color:rgba(255,255,255,.5)}
.tier-price{font-family:'Syne',sans-serif;font-size:52px;font-weight:800;letter-spacing:-.04em;line-height:1;margin-bottom:4px}
.tier-price sup{font-size:.38em;font-weight:600;vertical-align:super;opacity:.6}
.tier-comm{font-size:13px;font-weight:600;color:var(--accent);margin-bottom:22px;margin-top:8px;display:flex;align-items:center;gap:5px}
.tier.featured .tier-comm{color:#a5b4fc}
.tier-feat{font-size:13.5px;color:var(--ink-2);padding:8px 0;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;font-weight:400}
.tier.featured .tier-feat{color:rgba(255,255,255,.65);border-color:rgba(255,255,255,.1)}
.tier-feat:last-of-type{border-bottom:none}
.tier-feat::before{content:'✓';color:var(--accent);font-weight:600;flex-shrink:0}
.tier.featured .tier-feat::before{color:#a5b4fc}
.tier-btn{margin-top:22px;padding:11px;border-radius:9px;font-size:14px;font-weight:600;background:var(--surface);border:1px solid var(--border-2);color:var(--ink);transition:.15s;text-align:center}
.tier:hover .tier-btn{background:var(--ink);border-color:var(--ink);color:#fff}
.tier.featured .tier-btn{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.2);color:#fff}
.tier.featured:hover .tier-btn{background:#fff;color:var(--ink)}
.form-outer{max-width:620px;margin:0 auto}
.form-card{background:var(--white);border:1px solid var(--border);border-radius:var(--r-lg);padding:40px;box-shadow:0 2px 12px rgba(0,0,0,.06)}
.form-card h2{margin-bottom:6px}
.form-sub{font-size:15px;color:var(--ink-2);font-weight:300;margin-bottom:28px;line-height:1.6}
.sel-tier-bar{padding:12px 16px;background:var(--accent-light);border:1px solid #c4b5fd;border-radius:9px;font-size:14px;font-weight:500;color:var(--accent);margin-bottom:22px;display:flex;justify-content:space-between;align-items:center}
.field{margin-bottom:15px}
.field label{display:block;font-size:13px;font-weight:500;color:var(--ink-2);margin-bottom:5px}
.field input,.field textarea,.field select{width:100%;padding:10px 13px;font-size:14px;background:var(--bg);color:var(--ink);border:1px solid var(--border-2);border-radius:8px;outline:none;transition:.15s}
.field input:focus,.field textarea:focus,.field select:focus{border-color:var(--accent);background:var(--white);box-shadow:0 0 0 3px rgba(79,70,229,.08)}
.field select option{background:var(--white)}
.field textarea{min-height:96px;resize:vertical;line-height:1.5}
.submit-btn{width:100%;padding:13px;background:var(--ink);color:#fff;border-radius:9px;font-size:15px;font-weight:600;margin-top:8px;transition:.15s}
.submit-btn:hover{background:#2d2d2a;transform:translateY(-1px)}
.faq-wrap{max-width:620px}
details{border-bottom:1px solid var(--border)}
details:last-child{border-bottom:none}
summary{list-style:none;cursor:pointer;padding:18px 0;display:flex;justify-content:space-between;align-items:center;font-size:15px;font-weight:500;color:var(--ink)}
summary::-webkit-details-marker{display:none}
.faq-ico{width:26px;height:26px;background:var(--surface);border:1px solid var(--border);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:15px;color:var(--ink-3);flex-shrink:0;transition:.2s}
details[open] .faq-ico{background:var(--accent-light);border-color:#c4b5fd;color:var(--accent);transform:rotate(45deg)}
.faq-ans{padding:0 0 18px;font-size:14px;color:var(--ink-2);font-weight:300;line-height:1.7}
footer{border-top:1px solid var(--border);padding:36px 40px;background:var(--white)}
.foot-inner{max-width:1080px;margin:0 auto;display:flex;align-items:center;justify-content:space-between}
.foot-logo{font-family:'Syne',sans-serif;font-size:16px;font-weight:800;letter-spacing:-.02em;display:flex;align-items:center;gap:7px}
.foot-logo .logo-mark{width:22px;height:22px;font-size:11px}
.foot-links{display:flex;gap:18px;font-size:13px}
.foot-links a{color:var(--ink-2);transition:.15s}
.foot-links a:hover{color:var(--accent)}
footer p{font-size:13px;color:var(--ink-3)}
.chat-bubble{position:fixed;bottom:22px;right:22px;z-index:95;width:52px;height:52px;background:var(--ink);border-radius:50%;font-size:20px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(0,0,0,.2);animation:float 3s ease-in-out infinite;color:#fff;transition:.15s}
.chat-bubble:hover{transform:scale(1.08)}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
.chat-panel{position:fixed;bottom:22px;right:22px;z-index:100;width:370px;height:520px;max-height:calc(100vh - 44px);background:var(--white);border:1px solid var(--border);border-radius:var(--r-lg);box-shadow:0 20px 60px rgba(0,0,0,.15);display:none;flex-direction:column;overflow:hidden}
.chat-panel.open{display:flex}
.chat-head{padding:14px 18px;background:var(--ink);display:flex;justify-content:space-between;align-items:center}
.chat-head-info{display:flex;align-items:center;gap:9px}
.chat-av{width:30px;height:30px;background:var(--accent);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;color:#fff}
.chat-title{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:#fff}
.chat-status{font-size:11.5px;color:#4ade80;font-weight:500}
.chat-close{width:28px;height:28px;background:rgba(255,255,255,.1);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:15px;color:rgba(255,255,255,.7);transition:.15s}
.chat-close:hover{background:rgba(255,255,255,.2);color:#fff}
.chat-body{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:9px;background:var(--bg)}
.msg{max-width:84%;padding:9px 13px;font-size:13.5px;line-height:1.5;border-radius:11px;font-weight:300}
.msg.ai{background:var(--white);border:1px solid var(--border);color:var(--ink);align-self:flex-start;border-bottom-left-radius:4px}
.msg.me{background:var(--ink);color:#fff;align-self:flex-end;border-bottom-right-radius:4px;font-weight:400}
.chat-input-row{padding:10px;border-top:1px solid var(--border);display:flex;gap:7px;background:var(--white)}
.chat-input{flex:1;padding:9px 12px;font-size:14px;background:var(--bg);color:var(--ink);border:1px solid var(--border-2);border-radius:8px;outline:none;resize:none;line-height:1.4;transition:.15s}
.chat-input:focus{border-color:var(--accent)}
.chat-send{width:36px;height:36px;background:var(--ink);border-radius:8px;color:#fff;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;transition:.15s}
.chat-send:hover{background:var(--accent)}
@media(max-width:768px){
  nav,footer{padding-left:20px;padding-right:20px}
  main{padding:0 20px}
  h1{font-size:36px}
  .steps{grid-template-columns:1fr 1fr}
  .feat-grid,.tiers-grid{grid-template-columns:1fr}
  .hero-stats{grid-template-columns:repeat(2,1fr)}
  .hero-stats .stat:nth-child(2){border-right:none}
  .hero-stats .stat:nth-child(1),.hero-stats .stat:nth-child(2){border-bottom:1px solid var(--border)}
  .topbar{font-size:11px;gap:12px}
  .chat-panel{bottom:0;right:0;left:0;width:100%;max-width:100%;border-radius:var(--r-lg) var(--r-lg) 0 0;height:72vh}
  .foot-inner{flex-direction:column;gap:8px;text-align:center}
}
</style></head><body>
<div class="topbar" id="topbar">
  <span id="tb-live"><span class="dot"></span>Loading...</span>
  <span class="sep">·</span><span id="tb-mrr">—</span>
  <span class="sep">·</span><span>20–30% commission, forever</span>
  <span class="sep">·</span><span id="tb-paid">—</span>
</div>
<nav>
  <div class="nav-inner">
    <div class="logo"><div class="logo-mark">✦</div>Streamline</div>
    <div class="nav-links">
      <a href="#how">How it works</a>
      <a href="#board">Ideas</a>
      <a href="#tiers">Pricing</a>
    </div>
    <a href="#tiers" class="nav-cta">Submit idea →</a>
  </div>
</nav>
<main>
  <section class="hero">
    <div class="hero-pill"><div class="hero-pill-dot">✦</div>Now taking idea submissions</div>
    <h1>Your idea.<br/><span class="accent-text">We build it.</span><br/>You earn forever.</h1>
    <p class="hero-sub">Submit an app idea. The community votes. We build it with AI. You earn a commission on every dollar — forever.</p>
    <div class="hero-btns">
      <a href="#tiers" class="btn-pri">Submit your idea →</a>
      <a href="#board" class="btn-sec">Browse the board</a>
    </div>
    <div class="hero-stats">
      <div class="stat"><div class="stat-val" id="hs-live">—</div><div class="stat-lbl">Apps live</div></div>
      <div class="stat"><div class="stat-val" id="hs-mrr">—</div><div class="stat-lbl">Monthly revenue</div></div>
      <div class="stat"><div class="stat-val">30%</div><div class="stat-lbl">Max commission</div></div>
      <div class="stat"><div class="stat-val" id="hs-paid">—</div><div class="stat-lbl">Paid out</div></div>
    </div>
  </section>
  <section id="how">
    <div class="section-tag">Process</div>
    <h2>From idea to income in 4 steps</h2>
    <div class="steps">
      <div class="step"><div class="step-num">01</div><h3>Submit</h3><p>Pick a tier ($29–$299), describe your idea. Takes 5 minutes.</p></div>
      <div class="step"><div class="step-num">02</div><h3>Vote</h3><p>Your idea hits the public board. The community picks what gets built.</p></div>
      <div class="step"><div class="step-num">03</div><h3>Build</h3><p>Winning ideas ship in weeks. You get updates and beta access.</p></div>
      <div class="step"><div class="step-num">04</div><h3>Earn</h3><p>20–30% commission forever. Paid monthly once it hits $50.</p></div>
    </div>
  </section>
  <section>
    <div class="section-tag">Featured</div>
    <h2>Live right now, earning</h2>
    <div class="feat-grid">
      <div class="feat-card main">
        <div class="feat-tag live">● FLAGSHIP · LIVE</div>
        <h3>LessonLab</h3>
        <p>931 primary-school PE lessons, curriculum-aligned. One tap during duty rotations. Built for Australian teachers.</p>
        <div class="feat-chips"><span class="feat-chip">$3,200 / mo</span><span class="feat-chip">🇦🇺 Australia</span><span class="feat-chip">iOS + Web</span></div>
      </div>
      <div class="feat-card">
        <div class="feat-tag next">◐ NEXT BUILD</div>
        <h3>Judy's Kitchen</h3>
        <p>Save Grandma's recipes forever. Voice capture, card scanning, family sharing. Never lose a family recipe again.</p>
        <div class="feat-chips"><span class="feat-chip">Voice input</span><span class="feat-chip">OCR scanning</span><span class="feat-chip">Q2 2026</span></div>
      </div>
    </div>
  </section>
  <section id="board">
    <div class="section-tag">Idea Board</div>
    <h2>Vote for what gets built next</h2>
    <div class="filters">
      <button class="chip active" data-cat="All">All</button>
      <button class="chip" data-cat="Education">Education</button>
      <button class="chip" data-cat="Sport">Sport</button>
      <button class="chip" data-cat="Food">Food</button>
      <button class="chip" data-cat="Entertainment">Entertainment</button>
      <button class="chip" data-cat="Health">Health</button>
      <button class="chip" data-cat="Business">Business</button>
      <button class="chip" data-cat="Utility">Utility</button>
    </div>
    <div class="ideas-grid" id="ideas"><p style="color:var(--ink-3);font-size:14px">Loading ideas...</p></div>
  </section>
  <section id="tiers">
    <div class="section-tag">Pricing</div>
    <h2>One fee. Commission forever.</h2>
    <p class="section-desc">Pay once to get your idea reviewed. If we build it, you earn a percentage of every dollar it makes — for as long as it runs.</p>
    <div class="tiers-grid">
      <div class="tier" data-tier="Standard">
        <div class="tier-name">Standard</div>
        <div class="tier-price"><sup>$</sup>29</div>
        <div class="tier-comm">✦ 20% lifetime commission</div>
        <div class="tier-feat">7-day review window</div>
        <div class="tier-feat">20% commission forever</div>
        <div class="tier-feat">Community vote placement</div>
        <div class="tier-feat">30-day refund guarantee</div>
        <div class="tier-btn">Get started</div>
      </div>
      <div class="tier featured" data-tier="Priority">
        <div class="tier-popular">MOST POPULAR</div>
        <div class="tier-name">Priority</div>
        <div class="tier-price"><sup>$</sup>99</div>
        <div class="tier-comm">✦ 25% lifetime commission</div>
        <div class="tier-feat">Priority queue placement</div>
        <div class="tier-feat">25% commission forever</div>
        <div class="tier-feat">Direct builder contact</div>
        <div class="tier-feat">Weekly progress updates</div>
        <div class="tier-feat">Beta access before launch</div>
        <div class="tier-btn">Get started</div>
      </div>
      <div class="tier" data-tier="Equity">
        <div class="tier-name">Equity</div>
        <div class="tier-price"><sup>$</sup>299</div>
        <div class="tier-comm">✦ 30% lifetime commission</div>
        <div class="tier-feat">Built within 48 hours</div>
        <div class="tier-feat">30% commission forever</div>
        <div class="tier-feat">Co-founder credit</div>
        <div class="tier-feat">Co-ownership of the app</div>
        <div class="tier-feat">14-day refund guarantee</div>
        <div class="tier-btn">Get started</div>
      </div>
    </div>
  </section>
  <section id="submit" style="padding-top:0">
    <div class="form-outer">
      <div class="form-card">
        <h2>Submit your idea</h2>
        <p class="form-sub">5 minutes to fill in. Stripe payment. Full refund if we don't build it.</p>
        <div class="sel-tier-bar" id="sel-tier"><span>Selected: <strong>Priority</strong></span><span>$99 · 25% commission</span></div>
        <div class="field"><label>App title</label><input id="f-title" placeholder="e.g. Footy Tipping Tracker" required/></div>
        <div class="field"><label>Your name</label><input id="f-name" placeholder="Full name" required/></div>
        <div class="field"><label>Email address</label><input id="f-email" type="email" placeholder="you@example.com" required/></div>
        <div class="field"><label>Category</label>
          <select id="f-cat"><option>Education</option><option>Sport</option><option>Health</option><option>Food</option><option>Business</option><option>Entertainment</option><option>Social</option><option>Utility</option></select>
        </div>
        <div class="field"><label>Describe the idea</label><textarea id="f-desc" placeholder="What does it do? Who is it for? Why will people pay for it?" required></textarea></div>
        <button class="submit-btn" onclick="submitIdea()">Continue to payment →</button>
      </div>
    </div>
  </section>
  <section>
    <div class="section-tag">FAQ</div>
    <h2>Common questions</h2>
    <div class="faq-wrap">
      <details><summary><span>What if you don't build my idea?</span><span class="faq-ico">+</span></summary><div class="faq-ans">Full refund — 14 days for Priority/Equity tiers, 30 days for Standard. No questions asked.</div></details>
      <details><summary><span>How and when do I get paid?</span><span class="faq-ico">+</span></summary><div class="faq-ans">Monthly bank transfer once your app generates $50+ in a given month. We pay within 5 business days of month end.</div></details>
      <details><summary><span>Who owns the intellectual property?</span><span class="faq-ico">+</span></summary><div class="faq-ans">Standard and Priority: Streamline owns the app. Equity tier: co-owned, with your name in the product.</div></details>
      <details><summary><span>How long does it take to build?</span><span class="faq-ico">+</span></summary><div class="faq-ans">Equity: 48 hours. Priority: 2–4 weeks. Standard: 4–8 weeks depending on complexity and vote ranking.</div></details>
    </div>
  </section>
</main>
<footer>
  <div class="foot-inner">
    <div class="foot-logo"><div class="logo-mark">✦</div>Streamline</div>
    <div class="foot-links">
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
      <a href="/refunds">Refunds</a>
    </div>
    <p>Built in Melbourne by Paddy Gallivan · Part of the Asgard ecosystem · v23 · © 2026</p>
  </div>
</footer>
<button class="chat-bubble" id="chat-bubble" onclick="oc()">✦</button>
<div class="chat-panel" id="chat-panel">
  <div class="chat-head">
    <div class="chat-head-info">
      <div class="chat-av">✦</div>
      <div><div class="chat-title">Streamline AI</div><div class="chat-status">● Online</div></div>
    </div>
    <button class="chat-close" onclick="cc()">×</button>
  </div>
  <div class="chat-body" id="chat-body">
    <div class="msg ai">Hey! Ask me about submitting ideas, how commissions work, or what's on the board. 👋</div>
  </div>
  <div class="chat-input-row">
    <textarea class="chat-input" id="chat-input" placeholder="Ask anything..." rows="1"></textarea>
    <button class="chat-send" onclick="sc()">→</button>
  </div>
</div>
<script>
var EMOJI={Education:"📚",Sport:"🏆",Food:"🍳",Entertainment:"🎤",Health:"💪",Social:"🤝",Utility:"🔧",Business:"💼"};
var hist=[],busy=false,selTier="Priority";
var TIERS={Standard:[29,20],Priority:[99,25],Equity:[299,30]};
var STRIPE={Standard:"https://buy.stripe.com/7sYeVc7Y1aMX7N6fwy9IQ00",Priority:"https://buy.stripe.com/dRm5kC1zDbR10kEbgi9IQ01",Equity:"https://buy.stripe.com/00w5kCceh4ozc3mesu9IQ02"};

function fmt(n){return n>=1000?(n/1000).toFixed(1)+'k':String(n);}

function animCount(el, to, prefix, suffix) {
  const start = Date.now(), dur = 1200;
  const tick = () => {
    const p = Math.min((Date.now()-start)/dur, 1);
    const ease = 1-Math.pow(1-p,3);
    el.textContent = prefix + Math.round(ease*to).toLocaleString('en-AU') + suffix;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function loadStats(){
  try{
    var r=await fetch("/stats");
    var d=await r.json();
    if(!d||d.error) return;
    var live=d.live||0,mrr=d.monthly||0,paid=d.paid_out||3677,building=d.building||0;
    document.getElementById("tb-live").innerHTML='<span class="dot"></span>'+live+' apps live';
    document.getElementById("tb-mrr").textContent='$'+fmt(mrr)+' MRR';
    document.getElementById("tb-paid").textContent='$'+paid.toLocaleString('en-AU',{maximumFractionDigits:0})+' paid out';
    animCount(document.getElementById("hs-live"), live, '', '');
    animCount(document.getElementById("hs-mrr"), mrr, '$', '');
    animCount(document.getElementById("hs-paid"), paid, '$', '');
  }catch(e){}
}

async function loadIdeas(){
  try{
    var r=await fetch("/ideas");
    var d=await r.json();
    if(!d||!d.ideas||!d.ideas.length) return;
    renderIdeas(d.ideas.map(function(x){return{id:x.id,title:x.title,desc:x.description||'',cat:x.category||'Utility',rev:x.revenue||0,status:x.status||'queued',votes:x.votes||0,emoji:EMOJI[x.category]||'✦'};}));
  }catch(e){}
}

function renderIdeas(IDEAS){
  var g=document.getElementById("ideas"),s=IDEAS.slice().sort(function(a,b){return b.votes-a.votes}),h="";
  var voted=JSON.parse(localStorage.getItem("slv")||"[]");
  for(var i=0;i<s.length;i++){
    var x=s[i],bc=x.status==="live"?"b-live":x.status==="building"?"b-building":"b-queued";
    var bt=x.status==="live"?"● Live":x.status==="building"?"◐ Building":"○ Queued";
    var rv=x.rev>0?'<span class="badge b-rev">$'+x.rev.toLocaleString()+'/mo</span>':"";
    var iv=voted.indexOf(x.id)!==-1;
    h+='<div class="idea" data-cat="'+x.cat+'"><div class="idea-top"><div class="idea-icon">'+x.emoji+'</div><button class="vote-btn'+(iv?" voted":"")+'" onclick="vt('+x.id+')" id="vb-'+x.id+'"><span class="vote-arr">▲</span><span class="vote-cnt" id="vc-'+x.id+'">'+x.votes+'</span></button></div><h4>'+x.title+'</h4><p class="idea-desc">'+x.desc+'</p><div class="idea-foot"><span class="badge '+bc+'">'+bt+'</span><span class="badge b-cat">'+x.cat+'</span>'+rv+'<button class="share-btn" onclick="sh('+x.id+')"><span>🔗 Share</span><span class="share-tooltip" id="st-'+x.id+'">Copied!</span></button></div></div>';
  }
  g.innerHTML=h;
}

async function vt(id){
  var voted=JSON.parse(localStorage.getItem("slv")||"[]");
  if(voted.indexOf(id)!==-1)return;
  var btn=document.getElementById("vb-"+id),cnt=document.getElementById("vc-"+id);
  if(btn)btn.classList.add("voted");
  if(cnt)cnt.textContent=parseInt(cnt.textContent)+1;
  voted.push(id);localStorage.setItem("slv",JSON.stringify(voted));
  try{await fetch("/vote",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idea_id:id,fingerprint:fp()})});}catch(e){}
}

function sh(id){
  var url=window.location.origin+'/?idea='+id;
  navigator.clipboard.writeText(url).then(function(){
    var tt=document.getElementById("st-"+id);
    if(tt){tt.classList.add("show");setTimeout(function(){tt.classList.remove("show");},1600);}
  }).catch(function(){});
}

function fp(){var f=localStorage.getItem("sl_fp");if(!f){f=Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem("sl_fp",f);}return f;}

function setTier(n){selTier=n;var t=TIERS[n];document.getElementById("sel-tier").innerHTML='<span>Selected: <strong>'+n+'</strong></span><span>$'+t[0]+' · '+t[1]+'% commission</span>';}
document.addEventListener("click",function(e){
  var t=e.target.closest(".tier");
  if(t&&t.dataset.tier){setTier(t.dataset.tier);document.getElementById("submit").scrollIntoView({behavior:"smooth"});}
  var ch=e.target.closest(".chip");
  if(ch){var c=ch.getAttribute("data-cat");document.querySelectorAll(".chip").forEach(function(x){x.classList.remove("active")});ch.classList.add("active");document.querySelectorAll(".idea").forEach(function(x){x.style.display=c==="All"||x.getAttribute("data-cat")===c?"":"none";});}
});

function submitIdea(){
  var title=document.getElementById("f-title").value.trim(),name=document.getElementById("f-name").value.trim(),email=document.getElementById("f-email").value.trim(),cat=document.getElementById("f-cat").value,desc=document.getElementById("f-desc").value.trim();
  if(!title||!name||!email||!desc){alert("Please fill in all fields.");return;}
  var btn=document.querySelector(".submit-btn");btn.textContent="Saving...";btn.disabled=true;
  fetch("/submit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:title,name:name,email:email,category:cat,description:desc,tier:selTier})})
  .then(function(r){return r.json()})
  .then(function(d){
    if(d.success){window.location.href=STRIPE[selTier]+"?prefilled_email="+encodeURIComponent(email);}
    else{alert("Error: "+(d.error||"Unknown error"));btn.textContent="Continue to payment →";btn.disabled=false;}
  })
  .catch(function(){alert("Network error. Please try again.");btn.textContent="Continue to payment →";btn.disabled=false;});
}

function oc(){document.getElementById("chat-panel").classList.add("open");document.getElementById("chat-bubble").style.display="none";setTimeout(function(){document.getElementById("chat-input").focus();},100);}
function cc(){document.getElementById("chat-panel").classList.remove("open");document.getElementById("chat-bubble").style.display="flex";}
function am(t,w){var b=document.getElementById("chat-body"),d=document.createElement("div");d.className="msg "+w;d.textContent=t;b.appendChild(d);b.scrollTop=b.scrollHeight;return d;}
function sc(){if(busy)return;var i=document.getElementById("chat-input"),t=i.value.trim();if(!t)return;i.value="";am(t,"me");hist.push({role:"user",content:t});var ty=am("Thinking...","ai");busy=true;fetch("/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:hist})}).then(function(r){return r.json()}).then(function(d){ty.remove();if(d.error){am("⚠ "+d.error,"ai");}else{am(d.text||"...","ai");hist.push({role:"assistant",content:d.text});}}).catch(function(){ty.remove();am("Network error — try again.","ai");}).finally(function(){busy=false;});}
document.getElementById("chat-input").addEventListener("keydown",function(e){if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sc();}});

loadStats();
loadIdeas();
</script>
</body></html>`;
