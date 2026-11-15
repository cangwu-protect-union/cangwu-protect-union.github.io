#!/usr/bin/env node
/* 把一次运行的结果上传到 CloudBase PostgreSQL。
   令牌放在 Prefer 头里，由数据库的 gui_token_ok() 读取。

   用法：
     node rpg6.0/strategy-lab/upload.mjs --from=_local/strategy-lab/runs/<id> --token=<64 位令牌>
     $env:GUI_TOKEN="..." ; node ... --from=...
   令牌从浏览器验证页取：http://127.0.0.1:9300/_local/tests/lib/token.html */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { ROOT } from "./lib/engine.mjs";

const { values } = parseArgs({
  options: {
    from: { type: "string", default: "" },
    token: { type: "string", default: "" },
    note: { type: "string", default: "" },
    "dry-run": { type: "boolean", default: false }
  }
});

function config() {
  const base = path.resolve(ROOT, "guitu", "data", "config.js");
  const src = fs.readFileSync(base, "utf8");
  const envId = (src.match(/envId\s*:\s*"([^"]+)"/) || [])[1];
  const key = (src.match(/publishableKey\s*:\s*"([^"]+)"/) || [])[1];
  if (!envId || !key) throw new Error("读不到 GUI_CLOUDBASE 配置");
  return {
    rest: "https://" + envId + ".api.tcloudbasegateway.com/v1/rdb/rest/",
    key
  };
}

async function main() {
  const runDir = path.resolve(ROOT, values.from || "");
  const runFile = path.join(runDir, "run.json");
  if (!fs.existsSync(runFile)) throw new Error("找不到 run.json：" + runFile + "（先跑 lab.mjs --export）");
  const run = JSON.parse(fs.readFileSync(runFile, "utf8"));
  const token = values.token || process.env.GUI_TOKEN || "";
  if (!token) throw new Error("缺令牌：--token= 或环境变量 GUI_TOKEN");

  const c = config();
  const headers = {
    "Authorization": "Bearer " + c.key,
    "Content-Type": "application/json",
    "Prefer": "return=representation, gui-token=" + token
  };

  const runBody = {
    engine_version: run.engineVersion,
    chars: run.chars,
    config: run.config,
    summary: summarize(run),
    note: values.note || ""
  };
  if (values["dry-run"]) {
    console.log("dry-run：将上传 1 个 run、" + run.pairs.length + " 对");
    return;
  }

  const created = await post(c.rest + "rpg_lab_runs", headers, runBody);
  const runId = created && created[0] && created[0].id;
  if (!runId) throw new Error("创建 run 失败：" + JSON.stringify(created).slice(0, 200));

  const rows = run.pairs.map((p) => ({
    run_id: runId,
    a: p.a,
    b: p.b,
    state: p.verdict.state,
    mode: p.verdict.mode || null,
    strength: p.verdict.strength || null,
    resolve: p.verdict.resolve || null,
    stable: !!p.verdict.stable,
    avg_win_a: p.summary.winA,
    draw_rate: p.summary.draw,
    spread: p.verdict.spread,
    games: p.summary.games,
    cells: p.cells,
    verdict: p.verdict,
    policies: { a: p.policiesA, b: p.policiesB }
  }));
  await post(c.rest + "rpg_lab_pairs", headers, rows);

  console.log("已上传：run " + runId + " · " + rows.length + " 对");
  console.log("页面：https://cangwu-protect-union.github.io/rpg6.0/lab.html");
}

function summarize(run) {
  const counts = { 静止: 0, 封闭: 0, 开放: 0 };
  for (const p of run.pairs) counts[p.verdict.state] = (counts[p.verdict.state] || 0) + 1;
  return { pairs: run.pairs.length, chars: run.chars.length, states: counts };
}

async function post(url, headers, body) {
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error("写入失败 " + res.status + "：" + text.slice(0, 300));
  return text ? JSON.parse(text) : null;
}

main().catch((err) => {
  console.error(String(err && err.message || err));
  process.exitCode = 1;
});
