// falkor-push v1.0.0
// Web Push notification server — VAPID auth + aes128gcm encryption
// Endpoints:
//   GET  /health              — public
//   GET  /vapid-public-key    — public
//   POST /subscribe           — save push subscription
//   POST /unsubscribe         — remove push subscription
//   POST /push                — PIN-protected, send to all subscribers
//   GET  /subscribers         — PIN-protected, list subscribers

const ALLOWED_ORIGINS = new Set([
  'https://falkor.luckdragon.io',
  'https://carnivaltiming.com',
  'https://www.carnivaltiming.com',
  'https://schoolsportportal.com.au',
  'https://www.schoolsportportal.com.au',
  'https://sportcarnival.com.au',
  'https://www.sportcarnival.com.au',
]);

const PUSH_SUBJECT = 'mailto:pgallivan@outlook.com';
const FALKOR_ICON = 'https://falkor.luckdragon.io/icon-192.png';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const corsOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://falkor.luckdragon.io';

    const cors = {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Pin',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors, status: 204 });

    const json = (data, status = 200) => new Response(JSON.stringify(data), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

    try {
      // ── Public ──────────────────────────────────────────────────────────────

      if (url.pathname === '/health') {
        return json({ status: 'ok', service: 'falkor-push', version: '1.1.0' });
      }

      if (url.pathname === '/vapid-public-key' && request.method === 'GET') {
        return json({ publicKey: env.VAPID_PUBLIC_KEY });
      }

      if (url.pathname === '/subscribe' && request.method === 'POST') {
        const body = await request.json();
        const { endpoint, keys, deviceId } = body;
        if (!endpoint || !keys?.p256dh || !keys?.auth) {
          return json({ error: 'Missing: endpoint, keys.p256dh, keys.auth' }, 400);
        }
        const id = deviceId || crypto.randomUUID();
        await env.DB.prepare(
          'INSERT OR REPLACE INTO subscriptions (id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(id, endpoint, keys.p256dh, keys.auth, Date.now()).run();
        return json({ success: true, id });
      }

      if (url.pathname === '/unsubscribe' && request.method === 'POST') {
        const { endpoint } = await request.json();
        if (!endpoint) return json({ error: 'Missing endpoint' }, 400);
        await env.DB.prepare('DELETE FROM subscriptions WHERE endpoint = ?').bind(endpoint).run();
        return json({ success: true });
      }


      // ── User management (public — PIN verified per-user) ────────────────────

      if (url.pathname === '/user/list' && request.method === 'GET') {
        const HARDCODED_USERS = [
          { id: 'paddy', name: 'Paddy', role: 'admin' },
          { id: 'jacky', name: 'Jacky', role: 'member' },
          { id: 'george', name: 'George', role: 'member' },
        ];
        try {
          if (!env.DB) throw new Error('No DB binding');
          const { results } = await env.DB.prepare(
            'SELECT id, name, role FROM users ORDER BY name'
          ).all();
          return json({ users: results?.length ? results : HARDCODED_USERS });
        } catch {
          return json({ users: HARDCODED_USERS });
        }
      }

      if (url.pathname === '/user/verify' && request.method === 'POST') {
        const { userId, pin } = await request.json();
        if (!userId || !pin) return json({ error: 'Missing userId or pin' }, 400);
        // Hardcoded fallback PINs (used when DB binding is unavailable)
        const HARDCODED_PINS = { paddy: '1234', jacky: '5678', george: '9012' };
        const HARDCODED_NAMES = { paddy: 'Paddy', jacky: 'Jacky', george: 'George' };
        const HARDCODED_ROLES = { paddy: 'admin', jacky: 'member', george: 'member' };
        try {
          if (!env.DB) throw new Error('No DB binding');
          const user = await env.DB.prepare(
            'SELECT id, name, role, preferences FROM users WHERE id = ? AND pin = ?'
          ).bind(userId, pin).first();
          if (!user) return json({ error: 'Invalid PIN' }, 401);
          const prefs = JSON.parse(user.preferences || '{}');
          return json({ success: true, user: { id: user.id, name: user.name, role: user.role, preferences: prefs }, agentPin: env.AGENT_PIN });
        } catch {
          // Fallback: check against hardcoded PINs
          if (HARDCODED_PINS[userId] !== String(pin)) return json({ error: 'Invalid PIN' }, 401);
          return json({ success: true, user: { id: userId, name: HARDCODED_NAMES[userId] || userId, role: HARDCODED_ROLES[userId] || 'member' }, agentPin: env.AGENT_PIN });
        }
      }

      // ── PIN-protected ────────────────────────────────────────────────────────

      const pin = request.headers.get('X-Pin');
      if (pin !== env.AGENT_PIN) return json({ error: 'Unauthorized' }, 401);

      if (url.pathname === '/push' && request.method === 'POST') {
        const payload = await request.json();
        // payload shape: { title, body, icon?, url?, tag?, badge? }

        const { results: subs } = await env.DB.prepare('SELECT * FROM subscriptions').all();
        if (!subs.length) return json({ sent: 0, failed: 0, total: 0, message: 'No subscribers' });

        const results = await Promise.allSettled(
          subs.map(sub => sendWebPush(sub, payload, env))
        );

        // Remove expired subscriptions (410 Gone or 404)
        const toRemove = [];
        results.forEach((r, i) => {
          if (r.status === 'fulfilled' && (r.value === 410 || r.value === 404)) {
            toRemove.push(subs[i].endpoint);
          }
        });
        for (const ep of toRemove) {
          await env.DB.prepare('DELETE FROM subscriptions WHERE endpoint = ?').bind(ep).run();
        }

        const sent = results.filter(r => r.status === 'fulfilled' && r.value === 201).length;
        const failed = results.length - sent;

        return json({ sent, failed, total: results.length, expired: toRemove.length });
      }

      if (url.pathname === '/subscribers' && request.method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT id, endpoint, created_at FROM subscriptions'
        ).all();
        return json({ count: results.length, subscriptions: results });
      }

      return json({ error: 'Not found' }, 404);

    } catch (err) {
      console.error('falkor-push error:', err);
      return json({ error: err.message }, 500);
    }
  },
};

// ── Web Push send ─────────────────────────────────────────────────────────────

async function sendWebPush(subscription, payload, env) {
  const { endpoint, p256dh, auth } = subscription;
  try {
    const payloadBytes = new TextEncoder().encode(JSON.stringify({
      title: payload.title || 'Falkor',
      body: payload.body || '',
      icon: payload.icon || FALKOR_ICON,
      url: payload.url || 'https://falkor.luckdragon.io',
      tag: payload.tag || 'falkor',
      badge: payload.badge || FALKOR_ICON,
    }));

    const encrypted = await encryptPayload(payloadBytes, b64url_decode(p256dh), b64url_decode(auth));
    const vapidAuth = await buildVapidAuth(endpoint, env.VAPID_PRIVATE_KEY_JWK, env.VAPID_PUBLIC_KEY);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': vapidAuth,
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400',
        'Urgency': 'normal',
      },
      body: encrypted,
    });

    return response.status;
  } catch (err) {
    console.error('sendWebPush error:', err.message);
    return 500;
  }
}

// ── VAPID JWT (ES256) ─────────────────────────────────────────────────────────

async function buildVapidAuth(endpoint, privateKeyJwkString, publicKeyB64) {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const now = Math.floor(Date.now() / 1000);

  const header = b64url_encode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64url_encode(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: now + 43200,
    sub: PUSH_SUBJECT,
  })));

  const signingInput = `${header}.${claims}`;

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    JSON.parse(privateKeyJwkString),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signatureBytes = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privateKey,
    new TextEncoder().encode(signingInput)
  );

  const signature = b64url_encode(new Uint8Array(signatureBytes));
  return `vapid t=${signingInput}.${signature}, k=${publicKeyB64}`;
}

// ── Payload Encryption: RFC 8291 + RFC 8188 aes128gcm ────────────────────────

async function encryptPayload(plaintext, receiverPublicKeyBytes, authSecret) {
  // 1. Generate ephemeral ECDH key pair
  const ephemeralKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  // 2. Import receiver's public key
  const receiverPublicKey = await crypto.subtle.importKey(
    'raw',
    receiverPublicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // 3. ECDH shared secret
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: receiverPublicKey },
    ephemeralKeyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  // 4. Export ephemeral public key (65 bytes uncompressed)
  const senderPublicKeyBytes = new Uint8Array(
    await crypto.subtle.exportKey('raw', ephemeralKeyPair.publicKey)
  );

  // 5. Random salt (16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // === RFC 8291: derive IKM ===
  // PRK_key = HMAC-SHA-256(auth_secret, sharedSecret)
  const prkKey = new Uint8Array(await hmacSha256(authSecret, sharedSecret));

  // info_key = "WebPush: info\x00" || receiverPublicKey || senderPublicKey || 0x01
  const infoKey = concat([
    new TextEncoder().encode('WebPush: info\x00'),
    receiverPublicKeyBytes,
    senderPublicKeyBytes,
    new Uint8Array([0x01]),
  ]);

  // IKM = HMAC-SHA-256(prkKey, info_key)
  const ikm = new Uint8Array(await hmacSha256(prkKey, infoKey));

  // === RFC 8188: derive CEK (16 bytes) and Nonce (12 bytes) ===
  // PRK = HMAC-SHA-256(salt, IKM)  — HKDF Extract step
  const prk = new Uint8Array(await hmacSha256(salt, ikm));

  // CEK = HKDF-Expand(PRK, "Content-Encoding: aes128gcm\x00\x01", 16)
  const cekInfo = concat([
    new TextEncoder().encode('Content-Encoding: aes128gcm\x00'),
    new Uint8Array([0x01]),
  ]);
  const cek = await hkdfExpand(prk, cekInfo, 16);

  // Nonce = HKDF-Expand(PRK, "Content-Encoding: nonce\x00\x01", 12)
  const nonceInfo = concat([
    new TextEncoder().encode('Content-Encoding: nonce\x00'),
    new Uint8Array([0x01]),
  ]);
  const nonce = await hkdfExpand(prk, nonceInfo, 12);

  // === AES-128-GCM encrypt ===
  // Record = plaintext || 0x02 (end-of-record delimiter)
  const record = concat([plaintext, new Uint8Array([0x02])]);

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, record)
  );

  // === Build aes128gcm content-encoding header ===
  // salt(16) + rs(4 BE uint32) + idlen(1) + keyid(65)
  const header = new Uint8Array(86);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096, false); // rs = 4096
  header[20] = 65;                                         // idlen
  header.set(senderPublicKeyBytes, 21);                    // keyid = ephemeral pub key

  return concat([header, ciphertext]);
}

// ── Crypto helpers ────────────────────────────────────────────────────────────

async function hmacSha256(key, data) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, data);
}

async function hkdfExpand(prk, info, length) {
  // Single-block HKDF Expand: T(1) = HMAC-SHA-256(PRK, info || 0x01)
  // Valid for length <= 32 bytes
  const input = concat([info, new Uint8Array([0x01])]);
  const t1 = new Uint8Array(await hmacSha256(prk, input));
  return t1.slice(0, length);
}

function concat(arrays) {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

function b64url_encode(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64url_decode(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}
