/* 策略实验室 · 渲染层：把一对的矩阵渲染成表格与卡片。
   只做字符串拼接，不碰网络，方便单独替换。 */
(function (root) {
  "use strict";

  function esc(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pct(value) {
    return (Math.max(0, Math.min(1, Number(value) || 0)) * 100).toFixed(1) + "%";
  }

  function tint(value) {
    var v = Math.max(0, Math.min(1, Number(value) || 0));
    var depth = Math.min(1, Math.abs(v - 0.5) * 2);
    var alpha = (0.08 + depth * 0.5).toFixed(2);
    return v >= 0.5 ? "rgba(181,83,59," + alpha + ")" : "rgba(59,110,165," + alpha + ")";
  }

  function stateClass(verdict) {
    if (verdict.state === "静止") return "lab-badge-still";
    if (verdict.state === "封闭") return "lab-badge-loop";
    return "lab-badge-open";
  }

  function stateText(verdict) {
    if (verdict.resolve === "underpowered") return verdict.state + "（预算不足）";
    if (verdict.state === "静止") {
      if (verdict.mode === "策略无关") return "静止 · 无策略差异";
      if (verdict.mode === "多重最优") return "静止 · 多重最优";
      return "静止 · 唯一最优";
    }
    if (verdict.state === "封闭") return "封闭 · 克制循环";
    if (verdict.mode === "弱鞍点") return "开放 · 弱鞍点";
    if (verdict.mode && verdict.mode.indexOf("单向") === 0) return "开放 · 单向选择";
    return "开放 · 平坦";
  }

  function cellScore(cell) {
    if (!cell || !cell.n) return 0;
    return (cell.a + 0.5 * cell.d) / cell.n;
  }

  function matrixHtml(pair) {
    var cells = pair.cells || [];
    if (!cells.length) return "<p class=\"lab-empty\">没有矩阵数据</p>";
    var head = "<tr><th></th>";
    for (var j = 0; j < cells[0].length; j++) head += "<th>B" + j + "</th>";
    head += "</tr>";
    var body = "";
    for (var i = 0; i < cells.length; i++) {
      body += "<tr><th>A" + i + "</th>";
      for (var k = 0; k < cells[i].length; k++) {
        var cell = cells[i][k];
        var score = cellScore(cell);
        var saddle = pair.verdict && pair.verdict.cell && pair.verdict.cell[0] === i && pair.verdict.cell[1] === k;
        body += "<td class=\"" + (saddle ? "lab-saddle" : "") + "\" style=\"background:" + tint(score) + "\""
          + " title=\"" + cell.n + " 局，平 " + cell.d + "\">" + pct(score) + "</td>";
      }
      body += "</tr>";
    }
    return "<table class=\"lab-matrix\">" + head + body + "</table>";
  }

  function policyList(title, list) {
    if (!list || !list.length) return "";
    var items = "";
    for (var i = 0; i < list.length; i++) {
      var pol = list[i];
      items += "<li><code>" + esc(pol.id) + "</code> 保底 " + pct(pol.obj)
        + "<br>" + (pol.readable || []).map(esc).join("<br>") + "</li>";
    }
    return "<h3>" + esc(title) + "</h3><ul class=\"lab-policies\">" + items + "</ul>";
  }

  root.LabView = {
    esc: esc,
    pct: pct,
    tint: tint,
    stateClass: stateClass,
    stateText: stateText,
    matrixHtml: matrixHtml,
    policyList: policyList,
    cellScore: cellScore
  };
})(window);
