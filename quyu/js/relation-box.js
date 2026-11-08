/* ============================================================
   relation-box.js —— 「关联条目」框（鬼与区域的编辑页共用）
   ------------------------------------------------------------
   框里同时显示两类：
     · 自己引用的（存在自己的 related 里，随保存一起写）
     · 被别人引用的（反查出来的，删它等于去改对方条目）
   左侧列表按类型分段，每行右侧一个删除按钮。

   用法：
     var box = RelationBox.mount(hostEl, {
       selfType: "zone" | "ghost",
       selfId: "" | 当前条目 id,
       pickUrl: "pick-relation.html",
       listUrl: function (item) { return 跳转地址 }
     })
     box.setTokens([...])   // 从选择器回来时写入
     box.tokens()           // 取当前自己引用的 token 数组
     box.refresh()
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

    var selfType = opts.selfType || "zone";
    var selfId = opts.selfId || "";
    var pickUrl = opts.pickUrl || "pick-relation.html";
    var listUrl = opts.listUrl || function () { return "#"; };

    var tokens = [];        /* 自己引用的 */
    var forward = [];       /* 解析出标题后的正向项 */
    var remote = [];        /* 被别人引用的 */
    var errorText = "";

    function render() {
      var groups = [
        { label: "关联的鬼", type: "ghost" },
        { label: "关联的区域", type: "zone" }
      ];

      var items = forward.concat(remote);

      function row(it) {
        var key = it.type + ":" + it.id;
        return '<li class="rel-row" data-key="' + esc(key) + '"' +
                 ' data-own="' + (it.own ? "1" : "0") + '"' +
                 ' data-owner-type="' + esc(it.ownerType || "") + '"' +
                 ' data-owner-id="' + esc(it.ownerId || "") + '">' +
                 '<a href="' + esc(listUrl(it)) + '">' + esc(it.title || it.id) + "</a>" +
                 '<button type="button" class="rel-del" title="删除关联">删除</button>' +
               "</li>";
      }

      host.innerHTML =
        '<div class="rel-box">' +
          '<div class="rel-box__head">' +
            '<span class="rel-box__count">共 ' + items.length + " 条</span>" +
            '<button type="button" class="btn btn-ghost" id="relPickBtn">引用条目</button>' +
          "</div>" +
          (errorText ? '<p class="gate-error">' + esc(errorText) + "</p>" : "") +
          (items.length
            ? groups.map(function (g) {
                var list = items.filter(function (it) { return it.type === g.type; });
                if (!list.length) return "";
                return '<p class="rel-box__sub">' + g.label + "（" + list.length + "）</p>" +
                       '<ul class="rel-list">' + list.map(row).join("") + "</ul>";
              }).join("")
            : '<p class="rel-box__empty muted">还没有关联条目。</p>') +
        "</div>";

      var btn = host.querySelector("#relPickBtn");
      if (btn) {
        btn.addEventListener("click", function () {
          if (opts.onBeforeOpen) { try { opts.onBeforeOpen(); } catch (_e) {} }
          window.ZoneRelations.openPicker(pickUrl, {
            selected: tokens,
            selfType: selfType,
            selfId: selfId
          });
        });
      }
    }

    function resolveForward() {
      if (!tokens.length) { forward = []; return Promise.resolve(); }
      return window.ZoneRelations.titlesFor(window.ZoneRelations.parse(tokens)).then(function (list) {
        forward = list.map(function (f) {
          return { type: f.type, id: f.id, title: f.title, own: true, ownerType: selfType, ownerId: selfId };
        });
      });
    }

    function loadRemote() {
      if (!selfId) { remote = []; return Promise.resolve(); }
      return window.ZoneRelations.listFor(selfType, selfId).then(function (items) {
        remote = (items || []).filter(function (it) { return !it.own; });
      }).catch(function () { remote = []; });
    }

    function refresh() {
      return Promise.all([resolveForward(), loadRemote()]).then(render);
    }

    host.addEventListener("click", function (ev) {
      var btn = ev.target.closest(".rel-del");
      if (!btn) return;
      var row = btn.closest(".rel-row");
      if (!row) return;

      var own = row.getAttribute("data-own") === "1";
      var key = row.getAttribute("data-key");

      if (own) {
        tokens = tokens.filter(function (t) { return t !== key; });
        errorText = "";
        refresh();
        return;
      }

      /* 反向关联：去改对方条目，会先归档对方旧版本 */
      var ownerType = row.getAttribute("data-owner-type");
      var ownerId = row.getAttribute("data-owner-id");
      btn.disabled = true;

      window.ZoneRelations.removeFrom(ownerType, ownerId, [selfType + ":" + selfId])
        .then(function () { errorText = ""; return refresh(); })
        .catch(function (err) {
          btn.disabled = false;
          errorText = "删除失败：" + (err.message || "请稍后重试");
          render();
        });
    });

    var box = {
      setTokens: function (list) {
        tokens = (list || []).slice();
        return refresh();
      },
      tokens: function () { return tokens.slice(); },
      refresh: refresh,
      el: host
    };

    refresh();
    return box;
  }

  window.RelationBox = { mount: mount };
})();
