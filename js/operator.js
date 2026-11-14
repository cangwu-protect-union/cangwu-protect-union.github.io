/* ============================================================
   operator.js —— 选「编辑人」的两种控件
   ------------------------------------------------------------
   1. fill(selectEl)      往页面里已有的 <select> 填四位成员
   2. ask(opts)           弹一个确认框，框里选人（可带备注），
                          返回 Promise<{ member, note } | null>
   样式与 rpg6.0 的保存人控件一致，定义在 css/style.css。
   ============================================================ */
(function () {
  "use strict";

  function members() {
    var list = window.CPU_MEMBERS;
    return Array.isArray(list) && list.length ? list : [];
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* 填下拉：第一项是「请选择」，不预选任何人，也不记住上次选择 */
  function fill(selectEl, placeholder) {
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="">' + esc(placeholder || "请选择编辑人") + "</option>" +
      members().map(function (m) {
        return '<option value="' + esc(m) + '">' + esc(m) + "</option>";
      }).join("");
    selectEl.value = "";
  }

  function value(selectEl) {
    return selectEl ? String(selectEl.value || "").trim() : "";
  }

  function needsMember() {
    return members().length === 0;
  }

  /* opts: { title, text, confirmText, danger, note, placeholder }
     note 为 true 时多一个备注输入框（可留空） */
  function ask(opts) {
    opts = opts || {};

    var wrap = document.createElement("div");
    wrap.innerHTML =
      '<dialog class="op-dialog">' +
        '<form method="dialog" class="op-dialog-box">' +
          '<h2 class="op-dialog-title">' + esc(opts.title || "确认") + "</h2>" +
          (opts.text ? '<p class="op-dialog-text">' + esc(opts.text) + "</p>" : "") +
          '<label class="field">' +
            '<span class="field-label">编辑人 <em>必填</em></span>' +
            '<select data-op="member" aria-label="编辑人"></select>' +
          "</label>" +
          (opts.note
            ? '<label class="field">' +
                '<span class="field-label">备注<span class="field-hint">可留空</span></span>' +
                '<textarea data-op="note" rows="3" maxlength="200"></textarea>' +
              "</label>"
            : "") +
          '<div class="op-dialog-actions">' +
            '<button type="button" class="btn btn-ghost" data-op="cancel">取消</button>' +
            '<button type="button" class="btn' + (opts.danger ? " btn-danger" : "") +
              '" data-op="ok" disabled>' + esc(opts.confirmText || "确认") + "</button>" +
          "</div>" +
        "</form>" +
      "</dialog>";

    var el = wrap.firstChild;
    document.body.appendChild(el);

    var memberEl = el.querySelector('[data-op="member"]');
    var noteEl = el.querySelector('[data-op="note"]');
    var okBtn = el.querySelector('[data-op="ok"]');
    var cancelBtn = el.querySelector('[data-op="cancel"]');

    fill(memberEl, opts.placeholder || "请选择编辑人");
    memberEl.addEventListener("change", function () {
      okBtn.disabled = !value(memberEl);
    });

    return new Promise(function (resolve) {
      function close(result) {
        if (el.open) el.close();
        if (el.parentNode) el.parentNode.removeChild(el);
        resolve(result);
      }

      okBtn.addEventListener("click", function () {
        if (!value(memberEl)) return;
        close({
          member: value(memberEl),
          note: noteEl ? String(noteEl.value || "").trim() : ""
        });
      });

      cancelBtn.addEventListener("click", function () { close(null); });
      el.addEventListener("cancel", function (ev) {
        ev.preventDefault();
        close(null);
      });

      if (typeof el.showModal === "function") el.showModal();
      else el.setAttribute("open", "open");
    });
  }

  window.Operator = {
    fill: fill,
    value: value,
    ask: ask,
    members: members,
    esc: esc
  };
})();
