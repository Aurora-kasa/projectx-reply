// ===== 163 SMTP 配置（填你自己的）=====
const SMTP = {
  host: "smtp.163.com",
  port: 587,
  user: "helloc0927@163.com",      // 163 登录名
  pass: "TCnbrJeGBHcPupGd",        // 16 位授权码
  from: "hello@voidsprite.qzz.io"  // 外观发件人（代发）
};

// ===== 彩色 HTML 回复内容 =====
const HTML_BODY = `
<div style="font-family:Poppins,sans-serif;color:#fff;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px;border-radius:12px;max-width:600px;margin:auto">
  <h2 style="margin-top:0">👋 Hello from Project-X!</h2>
  <p>Thanks for reaching out. Here's a quick intro to our studio:</p>
  <ul>
    <li>🎮 Micro-scope games → 1-3 month prototypes</li>
    <li>🚀 Mid-core IPs → PC / Console, shipped &lt; 2 yrs</li>
    <li>🛠️ Open-source tools we built along the way</li>
  </ul>
  <p>Current flagship: <b>Nova Drift: Genesis</b> (Q4 2025)</p>
  <p>Stay awesome,<br/>— Project-X Team</p>
  <hr style="border:none;border-top:1px solid rgba(255,255,255,.3)">
  <small>This auto-reply is sent max 50×/day; for urgent issues just reply again.</small>
</div>`;

// ===== 每日配额 =====
const DAILY_LIMIT = 50;
const TODAY       = new Date().toISOString().slice(0, 10);
const COUNT_KEY   = `count_${TODAY}`;

// ===== 发信函数（纯 TCP + SMTP，零依赖） =====
async function send163Reply(to, subject) {
  const boundary = "----WorkerBoundary" + Math.random().toString(36).slice(2);
  const body = [
    `From: Project-X Bot <${SMTP.from}>`,
    `To: <${to}>`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    `Hi! This is an auto-reply from Project-X.`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    HTML_BODY,
    `--${boundary}--`
  ].join("\r\n");

  const encoder = new TextEncoder();
  const buf = encoder.encode(body);

  const socket = await connect({ hostname: SMTP.host, port: SMTP.port });
  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();

  await writer.write(encoder.encode(`EHLO ${SMTP.host}\r\n`)); await reader.read();
  await writer.write(encoder.encode("AUTH LOGIN\r\n"));          await reader.read();
  await writer.write(encoder.encode(btoa(SMTP.user) + "\r\n")); await reader.read();
  await writer.write(encoder.encode(btoa(SMTP.pass) + "\r\n")); await reader.read();
  await writer.write(encoder.encode(`MAIL FROM:<${SMTP.from}>\r\n`)); await reader.read();
  await writer.write(encoder.encode(`RCPT TO:<${to}>\r\n`));           await reader.read();
  await writer.write(encoder.encode("DATA\r\n"));                       await reader.read();
  await writer.write(buf); await writer.write(encoder.encode("\r\n.\r\n")); await reader.read();
  await writer.write(encoder.encode("QUIT\r\n")); await reader.read();
  await writer.close();
}

// ===== 主入口（Email Routing 推送）=====
export default {
  async fetch(req, env, ctx) {
    if (req.method !== "POST") return new Response("OK");

    const msg  = await req.json();
    const from = msg.from;
    const subj = (msg.subject || "").toLowerCase();
    const text = (msg.text     || "").toLowerCase();

    // 1. 问候语检测
    const greetings = ["hello", "hi", "hey", "你好", "您好"];
    if (!greetings.some(g => subj.includes(g) || text.includes(g)))
      return new Response("no-greeting");

    // 2. 每日配额
    const current = parseInt(await env.DB.get(COUNT_KEY) || "0");
    if (current >= DAILY_LIMIT) return new Response("daily-limit");

    // 3. 发信（通过 163 SMTP）
    await send163Reply(from, `Re: ${msg.subject}`);
    await env.DB.put(COUNT_KEY, String(current + 1), { expirationTtl: 86400 });
    return new Response("replied");
  }
};
