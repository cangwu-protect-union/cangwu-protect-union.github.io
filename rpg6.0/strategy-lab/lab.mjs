#!/usr/bin/env node
/* 策略实验室 · 命令行入口
   node rpg6.0/strategy-lab/lab.mjs --stage=all --chars=5 */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { classify, nashOf, sensitivityOf } from "./lib/analyze.mjs";
import { behaviorSignature } from "./lib/battle.mjs";
import { buildCalibration, loadCalibration, writeCalibration } from "./lib/calibration.mjs";
import { LAB_DIR, loadEngine, ROOT, roster } from "./lib/engine.mjs";
import { estimatePair, makeSeeds, rateAgainst, summarize } from "./lib/matrix.mjs";
import { makeRng, policyKey, randomWeights, readablePolicy } from "./lib/policy.mjs";
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
    gens: { type: "string", default: "5" },
    pop: { type: "string", default: "10" },
    screen: { type: "string", default: "6" },
    confirm: { type: "string", default: "12" },
    strategies: { type: "string", default: "4" },
    oracles: { type: "string", default: "6" },
    eps: { type: "string", default: "0.02" },
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
    gens: num("gens", 5),
    pop: num("pop", 10),
    screen: num("screen", 6),
    confirm: num("confirm", 12),
    strategies: num("strategies", 4),
    oracles: num("oracles", 6),
    eps: isFinite(Number(values.eps)) && Number(values.eps) > 0 ? Number(values.eps) : 0.02,
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
  const TRAIN_SEEDS = 3;
  const MERGE_CAP = 12;
  const PRUNE_KEEP = 8;
  const scoreMat = (cells) => cells.map((row) => row.map((c) => (c.n ? (c.a + 0.5 * c.d) / c.n : 0)));

  for (const [a, b] of pairs) {
    const t0 = Date.now();
    process.stdout.write("训练 " + a.name + " vs " + b.name + " … ");
    /* 多种子合并：同一对跑 TRAIN_SEEDS 个训练种子，合并策略池再重判 */
    const allA = [];
    const allB = [];
    const metas = [];
    const traces = [];
    for (let s = 0; s < TRAIN_SEEDS; s++) {
      const t = trainPair(B, a, b, { ...config, calib, baseSeed: config.baseSeed + s * 1000 });
      for (const p of t.a) allA.push(p.w);
      for (const p of t.b) allB.push(p.w);
      metas.push(t.meta);
      traces.push({ seed: config.baseSeed + s * 1000, trace: t.trace });
    }
    const dedupe = (list) => {
      const seen = new Set();
      const out = [];
      for (const p of list) {
        const k = policyKey(p);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(p);
      }
      return out.slice(0, MERGE_CAP);
    };
    const uniqA = dedupe(allA);
    const uniqB = dedupe(allB);
    /* 修剪：按「对敌方池的最差胜率」保留最强的 PRUNE_KEEP 套 */
    const pruneSeeds = makeSeeds(12, config.baseSeed + 7000);
    const prune = (mine, foes, mineIsA) => {
      if (mine.length <= PRUNE_KEEP) return mine;
      const scored = mine.map((p, i) => {
        let min = 1;
        for (const q of foes) {
          const r = rateAgainst(B, mineIsA ? a : b, mineIsA ? b : a, p, q, pruneSeeds, { calib, cap: config.cap }).rate;
          min = Math.min(min, mineIsA ? r : 1 - r);
        }
        return { p, i, min };
      });
      scored.sort((x, y) => y.min - x.min);
      return scored.slice(0, PRUNE_KEEP).sort((x, y) => x.i - y.i).map((x) => x.p);
    };
    const poolA = prune(uniqA, uniqB, true);
    const poolB = prune(uniqB, uniqA, false);

    const seeds = makeSeeds(config.games, config.baseSeed);
    const matrix = estimatePair(B, a, b, poolA, poolB, seeds,
      { calib, cap: config.cap, minGames: config.minGames, adaptive: !values.noadaptive });
    const verdict = classify(matrix.cells);
    verdict.sensitive = sensitivityOf(matrix.cells, verdict);
    const eq = nashOf(scoreMat(matrix.cells));
    /* 混合均衡的 x/y 是支撑相对数组，展开成全长度对齐策略池 */
    const expand = (mix, idxs, total) => {
      const out = new Array(total).fill(0);
      (idxs || mix.map((_, i) => i)).forEach((idx, k) => { out[idx] = mix[k]; });
      return out;
    };
    const xFull = eq.S ? expand(eq.x, eq.S, poolA.length) : eq.x;
    const yFull = eq.T ? expand(eq.y, eq.T, poolB.length) : eq.y;
    const summary = summarize(matrix.cells);

    const packSide = (pool, foes, mineChar, foeChar, mix) => {
      const evalSeeds = makeSeeds(config.confirm, config.baseSeed + 611);
      return pool.map((p, i) => {
        const profile = foes.map((q) => rateAgainst(B, mineChar, foeChar, p, q, evalSeeds, { calib, cap: config.cap }).rate);
        return {
          id: mineChar.name + ".vs." + foeChar.name + "." + i,
          w: p,
          obj: +mix.reduce((s, x, j) => s + x * profile[j], 0).toFixed(3),
          min: +Math.min(...profile).toFixed(3),
          signature: behaviorSignature(B, mineChar, foeChar, p, makeSeeds(4, config.baseSeed + 7), calib),
          readable: readablePolicy(p)
        };
      });
    };
    const policiesA = packSide(poolA, poolB, a, b, yFull);
    const policiesB = packSide(poolB, poolA, b, a, xFull);

    results.push({
      a: a.name, b: b.name, verdict, summary,
      cells: matrix.cells, policiesA, policiesB,
      trace: traces,
      meta: {
        v: +eq.v.toFixed(4),
        x: xFull.map((v) => +v.toFixed(4)),
        y: yFull.map((v) => +v.toFixed(4)),
        pure: eq.pure === true,
        seeds: TRAIN_SEEDS,
        iterations: Math.max(...metas.map((m) => m.iterations)),
        exploitability: Math.max(...metas.map((m) => m.exploitability)),
        stopReasons: metas.map((m) => m.stopReason)
      }
    });
    console.log(verdict.state + (verdict.strength ? "（" + verdict.strength + "）" : "")
      + " · 确定性 " + summary.certainCells + "/" + summary.cells
      + " · 灵敏 " + (verdict.sensitive.stable ? "稳" : "翻")
      + " · 榨取值 " + (metas.length ? Math.max(...metas.map((m) => m.exploitability)) : "—")
      + " · " + ((Date.now() - t0) / 1000).toFixed(1) + "s");
  }

  /* 留出验证：最优打法 vs 该对手在其它配对里练出的策略池（跨配对泛化） */
  const poolOf = {};
  for (const p of results) {
    (poolOf[p.a] = poolOf[p.a] || []).push({ key: p.a + "+" + p.b, list: p.policiesA });
    (poolOf[p.b] = poolOf[p.b] || []).push({ key: p.a + "+" + p.b, list: p.policiesB });
  }
  const holdSeeds = makeSeeds(40, config.baseSeed + 5000);
  for (const p of results) {
    const key = p.a + "+" + p.b;
    const foePoolB = (poolOf[p.b] || []).filter((x) => x.key !== key).flatMap((x) => x.list.map((q) => q.w));
    const foePoolA = (poolOf[p.a] || []).filter((x) => x.key !== key).flatMap((x) => x.list.map((q) => q.w));
    const a = chars.find((c) => c.name === p.a);
    const b = chars.find((c) => c.name === p.b);
    const bestA = p.policiesA[p.meta.x.indexOf(Math.max(...p.meta.x))];
    const bestB = p.policiesB[p.meta.y.indexOf(Math.max(...p.meta.y))];
    const fallback = (name) => {
      const rnd = makeRng(config.baseSeed + name.length * 13);
      return [randomWeights(rnd), randomWeights(rnd)];
    };
    const poolB = foePoolB.length ? foePoolB : fallback(p.b);
    const poolA = foePoolA.length ? foePoolA : fallback(p.a);
    const holdA = poolB.reduce((s, q) => s + rateAgainst(B, a, b, bestA.w, q, holdSeeds, { calib, cap: config.cap }).rate, 0) / poolB.length;
    const holdB = 1 - poolA.reduce((s, q) => s + rateAgainst(B, a, b, q, bestB.w, holdSeeds, { calib, cap: config.cap }).rate, 0) / poolA.length;
    p.holdout = { a: holdA, b: holdB };
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
    pairs: results.map((p) => ({ a: p.a, b: p.b, a_policies: p.policiesA, b_policies: p.policiesB, trace: p.trace, meta: p.meta }))
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
