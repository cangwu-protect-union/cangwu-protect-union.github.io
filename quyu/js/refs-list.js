/* ============================================================
   refs-list.js —— 「引用情报」折叠列表（鬼与区域共用）
   ------------------------------------------------------------
   折叠时只显示条数；展开显示标题、可跳转；编辑状态下可删除。
   删除只改 refs 字段，不动正文、图片、标签。

   用法：
     RefsList.mount(hostEl, {
       refs: [{ id, title }],
       editable: true,
       href: function (ref) { return "tips-entry.html?id=" + ref.id; },
       onDelete: function (ref) { return Promise }   // 返回 Promise，成功后从列表移除
     })
   ============================================================ */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function mount(host, opts) {
    if (!host) return null;
    opts = opts || {};

    var refs = (opts.refs || []).filter(function (r) { return r && r.id; });
    var href = opts.href || function (r) { return String(r.id); };

    function render() {
      if (!refs.length) { host.innerHTML = ""; host.hidden = true; return; }
      host.hidden = false;

      host.innerHTML =
        "<details class=\"refs-box\">" +
          "<summary>引用情报（" + refs.length + "）</summary>" +
          "<ul class=\"refs-list\">" +
            refs.map(function (r, i) {
              return "<li>" +
                '<a href="' + esc(href(r)) + '">' + esc(r.title || r.id) + "</a>" +
                (opts.editable ? '<button type="button" class="refs-del" data-i="' + i + '">删除</button>' : "") +
              "</li>";
            }).join("") +
          "</ul>" +
        "</details>";
    }

    if (opts.editable) {
      host.addEventListener("click", function (ev) {
        var btn = ev.target.closest("[data-i]");
        if (!btn) return;
        var i = parseInt(btn.getAttribute("data-i"), 10);
        var ref = refs[i];
        if (!ref || !opts.onDelete) return;

        btn.disabled = true;
        Promise.resolve(opts.onDelete(ref)).then(function () {
          refs.splice(i, 1);
          render();
        }).catch(function (err) {
          btn.disabled = false;
          host.insertAdjacentHTML("beforeend",
            '<p class="gate-error">删除失败：' + esc(err && err.message ? err.message : "请稍后重试") + "</p>");
        });
      });
    }

    render();

    return {
      refs: function () { return refs.slice(); },
      setRefs: function (list) { refs = (list || []).slice(); render(); },
      add: function (ref) {
        if (!ref || !ref.id) return;
        if (refs.some(function (r) { return r.id === ref.id; })) return;
        refs.push({ id: ref.id, title: ref.title || ref.id });
        render();
      }
    };
  }

  window.RefsList = { mount: mount };
})();
