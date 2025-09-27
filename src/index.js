import { GREETING_KEYWORDS, REPLY_HTML } from './config.js';

export default {
  async fetch(req, env, ctx) {
    // 只处理来自 Cloudflare Email Routing 的 POST
    if (req.method !== 'POST') return new Response('OK');

    const body   = await req.json();
    const from   = body.from;
    const to     = body.to;
    const subj   = body.subject || '';
    const text   = body.text     || '';

    // 1. 判断是否为问候
    const isGreeting = GREETING_KEYWORDS.some(k =>
      subj.toLowerCase().includes(k) || text.toLowerCase().includes(k)
    );
    if (!isGreeting) return new Response('no-greeting');

    // 2. 每日配额检查（简单 KV 计数器）
    const today = new Date().toISOString().slice(0, 10);          // 2025-09-27
    const key   = `count_${today}`;
    const current = parseInt(await env.DB.get(key) || '0');
    if (current >= 50) return new Response('daily-limit');

    // 3. 发信
    await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/email/routing/send`, {
      method : 'POST',
      headers: {
        'Authorization': `Bearer ${env.API_TOKEN}`,
        'Content-Type' : 'application/json'
      },
      body: JSON.stringify({
        from: { email: to, name: 'Project-X Bot' },
        to  : [{ email: from }],
        subject: `Re: ${subj}`,
        content: [{ type: 'text/html', value: REPLY_HTML }]
      })
    });

    // 4. 计数+1
    await env.DB.put(key, String(current + 1), { expirationTtl: 86400 });
    return new Response('replied');
  }
};
