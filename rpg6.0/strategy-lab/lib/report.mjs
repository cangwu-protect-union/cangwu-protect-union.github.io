/* 报告输出：一份 Markdown，总表 + 每对明细。 */
import fs from "node:fs";
import path from "node:path";

function pct(v) {
  return (v * 100).toFixed(1) + "%";
}

function stateLabel(verdict) {
  if (verdict.resolve === "underpowered") return verdict.state + "（预算不足）";
  if (verdict.state === "静止") {
    if (verdict.mode === "策略无关") return "静止（无策略差异）";
    if (verdict.mode === "多重最优") return "静止（多重最优）";
    return "静止（唯一最优）";
  }
  if (verdict.state === "封闭") return "封闭";
  if (verdict.mode === "弱鞍点") return "开放（弱鞍点）";
  if (verdict.mode && verdict.mode.indexOf("单向") === 0) return "开放（单向）";
  return "开放（平坦）";
}

export function buildMarkdown(result) {
  const lines = [];
  lines.push("# 策略实验室报告");
  lines.push("");
  lines.push("引擎版本 `" + result.engineVersion + "` · 生成于 " + result.generatedAt);
  const totalGames = result.pairs.reduce((sum, p) => sum + (p.summary.games || 0), 0);
  lines.push("角色 " + result.chars.length + " 个 · 对局 " + result.pairs.length + " 对 · 每格最多 "
    + result.config.games + " 局 · 实际 " + totalGames + " 局");
  lines.push("");
  const counts = { 静止: 0, 封闭: 0, 开放: 0 };
  for (const p of result.pairs) counts[p.verdict.state] = (counts[p.verdict.state] || 0) + 1;
  lines.push("结论：静止 " + counts["静止"] + " 对 · 封闭 " + counts["封闭"] + " 对 · 开放 " + counts["开放"] + " 对。");
  lines.push("");
  lines.push("## 总表");
  lines.push("");
  lines.push("| 对局 | 状态 | 平均胜率 | 平局率 | 强度 | 稳定性 | 极差 | 保底 vs 随机 |");
  lines.push("|---|---|---|---|---|---|---|---|");
  for (const p of result.pairs) {
    const hold = p.holdout ? (p.holdout.a * 100).toFixed(0) + "% / " + (p.holdout.b * 100).toFixed(0) + "%" : "—";
    lines.push("| " + p.a + " vs " + p.b + " | " + stateLabel(p.verdict) + " | "
      + pct(p.summary.winA) + " | " + pct(p.summary.draw) + " | "
      + (p.verdict.strength || "—") + " | " + (p.verdict.stable ? "稳定" : "不稳定") + " | "
      + p.verdict.spread + " | " + hold + " |");
  }
  lines.push("");
  for (const p of result.pairs) {
    lines.push("## " + p.a + " vs " + p.b);
    lines.push("");
    lines.push("状态 **" + stateLabel(p.verdict) + "**，证据：极差 " + p.verdict.spread
      + "，鞍点 " + (p.verdict.cell ? "(" + p.verdict.cell.join(",") + ")" : "无")
      + "，支撑 " + (p.verdict.support || []).join("/")
      + "，确定性 " + p.summary.certainCells + "/" + p.summary.cells
      + "，对半复核 " + p.verdict.halves.join(" / ") + "。");
    lines.push("");
    const head = ["| 行 \\ 列 |"].concat(p.cells[0].map((_, j) => " B" + j + " |")).join("");
    lines.push(head);
    lines.push("|" + "---|".repeat(p.cells[0].length + 1));
    p.cells.forEach((row, i) => {
      const cells = row.map((cell) => {
        const hit = p.verdict.cell && p.verdict.cell[0] === i && p.verdict.cell[1] === row.indexOf(cell);
        return " " + pct(cell.n ? (cell.a + 0.5 * cell.d) / cell.n : 0) + (hit ? " ★" : "") + " |";
      });
      lines.push("| A" + i + " |" + cells.join(""));
    });
    lines.push("");
    lines.push("A 侧打法：");
    for (const pol of p.policiesA) {
      lines.push("- `" + pol.id + "` 保底 " + pct(pol.obj) + "：" + pol.readable.join("；"));
    }
    lines.push("");
    lines.push("B 侧打法：");
    for (const pol of p.policiesB) {
      lines.push("- `" + pol.id + "` 保底 " + pct(pol.obj) + "：" + pol.readable.join("；"));
    }
    lines.push("");
  }
  lines.push("## 边界");
  lines.push("");
  lines.push("- 结论只对本次训练出的 " + result.config.strategies + " 套打法成立，换策略库结论会变。");
  lines.push("- 只看单挑，三方克制循环测不出来。");
  lines.push("- 判定基于前后两半种子分别复核，不一致记「预算不足」。");
  return lines.join("\n") + "\n";
}

export function writeReport(outDir, result) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "report.md"), buildMarkdown(result), "utf8");
  fs.writeFileSync(path.join(outDir, "run.json"), JSON.stringify(result, null, 2) + "\n", "utf8");
  fs.writeFileSync(path.join(outDir, "verdicts.json"), JSON.stringify({
    engineVersion: result.engineVersion,
    generatedAt: result.generatedAt,
    config: result.config,
    pairs: result.pairs.map((p) => ({
      a: p.a, b: p.b, verdict: p.verdict, summary: p.summary
    }))
  }, null, 2) + "\n", "utf8");
  return outDir;
}
