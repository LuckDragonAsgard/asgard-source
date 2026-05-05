
export default {
  async fetch(request, env) {
    const CF_TOKEN = env.CF_API_TOKEN;
    const ZONE = '6292327060a0a2209a084cc7f0566e1a';
    const base = `https://api.cloudflare.com/client/v4/zones/${ZONE}/dns_records`;
    const hdr = { 'Authorization': `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' };

    const records = [
      { type:'TXT', name:'resend._domainkey.streamlinewebapps.com', content:'p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDYVADTUX/oTtGSLTIL7H6jUdS3+777ceVG6sAVY1aOC6klU/tRBsevT98prnpIspPs1GD9QhUCjWP1J0ku1jv5JhLWcardifBLRqAG0QQAfjR02jE8xVEBgYtGsJqGQcx5OmM+VslBN/OewkhvBisVv8JsPnPcrmXv4yAmh1Ff9wIDAQAB', ttl:1 },
      { type:'MX', name:'send.streamlinewebapps.com', content:'feedback-smtp.ap-northeast-1.amazonses.com', priority:10, ttl:1 },
      { type:'TXT', name:'send.streamlinewebapps.com', content:'v=spf1 include:amazonses.com ~all', ttl:1 }
    ];

    const results = [];
    for (const rec of records) {
      const r = await fetch(base, { method:'POST', headers:hdr, body: JSON.stringify(rec) });
      const j = await r.json();
      results.push({ name: rec.name, type: rec.type, ok: j.success, err: j.errors });
    }
    return Response.json(results);
  }
};
