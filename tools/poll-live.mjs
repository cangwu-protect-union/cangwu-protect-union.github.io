/* tools/poll-live.mjs —— 等 Pages 生效：轮询一个 URL，直到内容里出现期望字符串。
   用法：node --use-system-ca tools/poll-live.mjs <url> <expect>
   环境变量 POLL_TRIES 控制轮询次数（默认 15，每次约 8 秒）。 */
import { setTimeout as sleep } from "node:timers/promises";

const [url, expect] = process.argv.slice(2);
if (!url || !expect) {
  console.error("用法：node tools/poll-live.mjs <url> <expect>");
  process.exit(2);
}
const tries = Number(process.env.POLL_TRIES || 15);

for (let i = 1; i <= tries; i++) {
  await sleep(i === 1 ? 5000 : 8000);
  try {
    const res = await fetch(url, { headers: { "cache-control": "no-cache" } });
    const text = await res.text();
    const ok = res.ok && text.includes(expect);
    console.log("poll " + i + ": " + res.status + (ok ? " 已生效" : ""));
    if (ok) process.exit(0);
  } catch (err) {
    console.log("poll " + i + ": " + (err && err.message ? err.message : err));
  }
}
console.error("超时：页面里没出现期望内容");
process.exit(1);
