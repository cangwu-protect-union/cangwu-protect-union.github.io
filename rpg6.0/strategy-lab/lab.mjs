#!/usr/bin/env node
/* 策略实验室 · 命令行入口
   node rpg6.0/strategy-lab/lab.mjs --stage=all --chars=5 */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { classify } from "./lib/analyze.mjs";
import { buildCalibration, loadCalibration, writeCalibration } from "./lib/calibration.mjs";
import { LAB_DIR, loadEngine, ROOT, roster } from "./lib/engine.mjs";
import { estimatePair, makeSeeds, rateAgainst, summarize } from "./lib/matrix.mjs";
import { makeRng, randomWeights } from "./lib/policy.mjs";
import { writeReport } from "./lib/report.mjs";
import { writeHtml } from "./lib/report-html.mjs";
import { trainPair } from "./lib/train.mjs";

const { values } = parseArgs({
  options: {
    stage: { type: "string", default: "all" },
    chars: { type: "string", default: "5" },
    roster: { type: "string", default: "" },
    pairs: { type: "string", default: "" },
    games: { type: "string", default: "400" },
    mingames: { type: "string", default: "40" },
    gens: { type: "string", default: "4" },
    pop: { type: "string", default: "12" },
    screen: { type: "string", default: "6" },
    confirm: { type: "string", default: "16" },
    rounds: { type: "string", default: "2" },
    strategies: { type: "string", default: "3" },
    cap: { type: "string", default: "400" },
    seed: { type: "string", default: "1000" },
    out: { type: "string", default: "" },
    from: { type: "string", default: "" },
    export: { type: "boolean", default: false },
    recalibrate: { type: "boolean", default: false },
    noadaptive: { type: "boolean", default: false }
  }
});

const num = (name, fallback) => {
  const v = Number(values[name]);
  return isFinite(v) && v > 0 ? v : fallback;
};

function pickChars() {
  if (values.roster) {
    const list = values.roster.split(",").map((s) => s.trim()).filter(Boolean);
    const all = roster();
    return list.map((name) => {
      const hit = all.find((c) => c.name === name);
      if (!hit) throw new Error("找不到角色：" + name);
      return hit;
    });
  }
  return roster(num("chars", 5));
}

function pickPairs(chars) {
  if (values.pairs) {
    return values.pairs.split(",").map((s) => s.trim()).filter(Boolean).map((part) => {
      const names = part.split("+");
      if (names.length !== 2) throw new Error("--pairs 格式应为 A+B，用逗号分隔多对：" + part);
      const a = chars.find((c) => c.name === names[0]);
      const b = chars.find((c) => c.name === names[1]);
      if (!a || !b) throw new Error("--pairs 里的角色不在参加名单里：" + part);
      return [a, b];
    });
  }
  const out = [];
  for (let i = 0; i < chars.length; i++) for (let j = i + 1; j < chars.length; j++) out.push([chars[i], chars[j]]);
  return out;
}

function ensureCalibration() {
  if (values.recalibrate) {
    const table = buildCalibration();
    writeCalibration(table);
    console.log("标定表已重建：" + table.total + " 条技能");
    return table;
  }
  try {
    const table = loadCalibration();
    if (table) return table;
  } catch (err) {
    console.log(String(err.message));
  }
  const table = buildCalibration();
  writeCalibration(table);
  console.log("标定表已生成：" + table.total + " 条技能");
  return table;
}

function writeSnapshot(run) {
  const payload = {
    engineVersion: run.engineVersion,
    generatedAt: run.generatedAt,
    chars: run.chars,
    config: run.config,
    pairs: run.pairs.map((p) => ({
      a: p.a,
      b: p.b,
      verdict: p.verdict,
      summary: p.summary,
      cells: p.cells,
      policiesA: (p.policiesA || []).map((x) => ({ id: x.id, obj: x.obj, readable: x.readable })),
      policiesB: (p.policiesB || []).map((x) => ({ id: x.id, obj: x.obj, readable: x.readable }))
    }))
  };
  const file = path.resolve(ROOT, "rpg6.0", "data", "lab-snapshot.js");
  const header = "/* 策略实验室兜底快照 · 生成物，不要手改\n"
    + "   重新生成：node rpg6.0/strategy-lab/lab.mjs --stage=export --from=<run 目录>\n"
    + "   数据库里有记录时页面优先读数据库。 */\n";
  fs.writeFileSync(file, header + "window.RPG_LAB_SNAPSHOT = " + JSON.stringify(payload) + ";\n", "utf8");
  return file;
}

async function main() {
  const stage = values.stage;
  const { engineVersion } = loadEngine();

  if (stage === "calibrate") {
    const table = buildCalibration();
    const file = writeCalibration(table);
    console.log("标定完成：" + table.total + " 条技能，失败 " + table.failed + " 条 → " + path.relative(LAB_DIR, file));
    return;
  }

  if (stage === "export") {
    const runFile = path.resolve(ROOT, values.from || "", "run.json");
    if (!fs.existsSync(runFile)) throw new Error("找不到 run.json：" + runFile);
    const run = JSON.parse(fs.readFileSync(runFile, "utf8"));
    const file = writeSnapshot(run);
    console.log("兜底快照已写入：" + path.relative(ROOT, file));
    return;
  }

  const calib = ensureCalibration();
  const chars = pickChars();
  const pairs = pickPairs(chars);
  const config = {
    games: num("games", 400),
    minGames: num("mingames", 40),
    gens: num("gens", 4),
    pop: num("pop", 12),
    screen: num("screen", 6),
    confirm: num("confirm", 16),
    rounds: num("rounds", 2),
    strategies: num("strategies", 3),
    cap: num("cap", 400),
    baseSeed: num("seed", 1000)
  };
  const outDir = values.out
    ? path.resolve(ROOT, values.out)
    : path.resolve(ROOT, "_local", "strategy-lab", "runs", new Date().toISOString().replace(/[:.]/g, "-"));
  fs.mkdirSync(outDir, { recursive: true });

  const results = [];
  const started = Date.now();
  const B = loadEngine().B;
  for (const [a, b] of pairs) {
    const t0 = Date.now();
    process.stdout.write("训练 " + a.name + " vs " + b.name + " … ");
    const trained = trainPair(B, a, b, { ...config, calib });
    const seeds = makeSeeds(config.games, config.baseSeed);
    const matrix = estimatePair(B, a, b, trained.a.map((p) => p.w), trained.b.map((p) => p.w), seeds,
      { calib, cap: config.cap, minGames: config.minGames, adaptive: !values.noadaptive });
    const verdict = classify(matrix.cells);
    const summary = summarize(matrix.cells);

    /* 留出校验：最优打法对两套没参与训练的随机打法，防训练把策略练废 */
    const rnd = makeRng(config.baseSeed + a.name.length * 13 + b.name.length);
    const probes = [randomWeights(rnd), randomWeights(rnd)];
    const holdSeeds = makeSeeds(60, config.baseSeed + 5000);
    const holdA = probes.reduce((sum, p) => sum + rateAgainst(B, a, b, trained.a[0].w, p, holdSeeds, { calib, cap: config.cap }).rate, 0) / probes.length;
    const holdB = probes.reduce((sum, p) => sum + rateAgainst(B, b, a, trained.b[0].w, p, holdSeeds, { calib, cap: config.cap }).rate, 0) / probes.length;

    results.push({ a: a.name, b: b.name, verdict, summary, cells: matrix.cells, policiesA: trained.a, policiesB: trained.b, trace: trained.trace, holdout: { a: holdA, b: holdB } });
    console.log(verdict.state + (verdict.strength ? "（" + verdict.strength + "）" : "")
      + " · 确定性 " + summary.certainCells + "/" + summary.cells
      + " · " + ((Date.now() - t0) / 1000).toFixed(1) + "s");
  }

  const result = {
    engineVersion,
    generatedAt: new Date().toISOString(),
    config,
    chars: chars.map((c) => c.name),
    pairs: results
  };
  fs.writeFileSync(path.join(outDir, "policies.json"), JSON.stringify({
    engineVersion,
    pairs: results.map((p) => ({ a: p.a, b: p.b, a_policies: p.policiesA, b_policies: p.policiesB, trace: p.trace }))
  }, null, 2) + "\n", "utf8");
  writeReport(outDir, result);
  const htmlFile = writeHtml(outDir, result);
  if (values.export) {
    const snapFile = writeSnapshot(result);
    console.log("兜底快照：" + path.relative(ROOT, snapFile));
  }

  const total = ((Date.now() - started) / 1000).toFixed(1);
  console.log("");
  console.log("完成：" + results.length + " 对，用时 " + total + "s");
  console.log("报告：" + path.join(outDir, "report.md"));
  console.log("热力图：" + htmlFile);
}

main().catch((err) => {
  console.error(err && err.stack || err);
  process.exitCode = 1;
});
