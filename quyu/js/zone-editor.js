/* ============================================================
   zone-editor.js —— 区域编辑器（新增与编辑共用）
   ------------------------------------------------------------
   把三块内容拼在一起：基本表单、关联条目框、引用情报列表。
   跳去标点页或选择页之前，把整份状态（含关联与引用）存进 sessionStorage，
   回来后原样恢复——否则每跳一次，写了一半的内容就没了。

   对外：
     var ed = ZoneEditor.mount(rootEl, { mode: "create"|"edit", zone: {...} })
     ed.save()      → Promise<zone>
     ed.values()    → 当前字段
   ============================================================ */
(function () {
  "use strict";

  var DRAFT_KEY = "quyu_editor_draft";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function mount(root, opts) {
    opts = opts || {};
    var mode = opts.mode || "create";
    var zoneInput = opts.zone || {};
    var D = window.ZoneData;

    root.innerHTML =
      '<form id="zoneForm" autocomplete="off">' +
        '<div id="zoneFormMount"></div>' +
        '<section class="editor-block">' +
          '<h2 class="entry-section-title">关联条目</h2>' +
          '<div id="zoneRelBox"></div>' +
        "</section>" +
        '<section class="editor-block">' +
          '<h2 class="entry-section-title">引用情报</h2>' +
          '<div class="rel-box__head">' +
            '<span class="rel-box__count" id="zoneRefCount">共 0 条</span>' +
            '<button type="button" class="btn btn-ghost" id="zoneRefPick">引用情报</button>' +
          "</div>" +
          '<div id="zoneRefList"></div>' +
        "</section>" +
        '<p class="gate-error" id="zoneSaveError" hidden></p>' +
      "</form>";

    var formErrorEl = document.getElementById("zoneSaveError");
    var refCountEl = document.getElementById("zoneRefCount");
    var refHost = document.getElementById("zoneRefList");

    var form = window.ZoneForm.mount(document.getElementById("zoneFormMount"), {
      mode: mode === "edit" ? "edit" : "create",
      value: zoneInput,
      onBeforeNavigate: saveDraft
    });

    var relBox = window.RelationBox.mount(document.getElementById("zoneRelBox"), {
      selfType: "zone",
      selfId: zoneInput.id || "",
      pickUrl: "pick-relation.html",
      listUrl: function (it) {
        return it.type === "ghost"
          ? "../guitu/条目.html?id=" + encodeURIComponent(it.id)
          : "zone.html?id=" + encodeURIComponent(it.id);
      }
    });

    /* 把条目已有的关联灌进框里 */
    if (relBox) relBox.setTokens((zoneInput.related || []).slice());

    var refs = (zoneInput.refs || []).slice();
    var newRefIds = {};

    var refsView = window.RefsList.mount(refHost, {
      refs: refs,
      editable: true,
      href: function (r) { return "tips-entry.html?id=" + encodeURIComponent(r.id); },
      onDelete: function (ref) {
        refs = refs.filter(function (r) { return r.id !== ref.id; });
        delete newRefIds[ref.id];
        refCountEl.textContent = "共 " + refs.length + " 条";
        return Promise.resolve();
      }
    });

    function syncRefCount() {
      refs = refsView ? refsView.refs() : refs;
      refCountEl.textContent = "共 " + refs.length + " 条";
    }

    /* ---------------- 草稿 ---------------- */

    function saveDraft() {
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
          form: form.collect(),
          related: relBox.tokens(),
          refs: refs
        }));
      } catch (e) {}
    }

    function takeDraft() {
      try {
        var v = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null");
        sessionStorage.removeItem(DRAFT_KEY);
        return v && typeof v === "object" ? v : null;
      } catch (e) { return null; }
    }

    /* ---------------- 引用情报：去选择页 ---------------- */

    document.getElementById("zoneRefPick").addEventListener("click", function () {
      saveDraft();
      try {
        sessionStorage.setItem("quyu_tips_ctx", JSON.stringify({
          returnTo: location.pathname + location.search,
          selected: refs.map(function (r) { return r.id; })
        }));
      } catch (e) {}
      location.href = "pick-tips.html";
    });

    /* 从选择页回来：把新选的投稿正文追加到正文末尾 */
    function absorbPickedTips() {
      var ctx = null;
      try {
        ctx = JSON.parse(sessionStorage.getItem("quyu_tips_ctx") || "null");
      } catch (e) { ctx = null; }
      if (!ctx || !ctx.done) return Promise.resolve();

      sessionStorage.removeItem("quyu_tips_ctx");

      var selected = ctx.selected || [];
      var known = {};
      refs.forEach(function (r) { known[r.id] = 1; });
      var fresh = selected.filter(function (id) { return !known[id]; });
      if (!fresh.length) return Promise.resolve();

      return window.ZoneData.listTips().then(function (tips) {
        var byId = {};
        tips.forEach(function (t) { byId[t.id] = t; });

        var addText = [];
        fresh.forEach(function (id) {
          var t = byId[id];
          if (!t) return;
          addText.push(String(t.body || "").trim() + "\n\n引自：《" + (t.title || "未命名") + "》");
          refs.push({ id: id, title: t.title || id });
          newRefIds[id] = 1;
        });

        if (addText.length) {
          var bodyEl = document.getElementById("zfBody");
          if (bodyEl) {
            var cur = bodyEl.value.replace(/\s+$/, "");
            bodyEl.value = (cur ? cur + "\n\n" : "") + addText.join("\n\n");
          }
        }
        if (refsView) refsView.setRefs(refs);
        syncRefCount();
      }).catch(function () {});
    }

    /* ---------------- 从选择页 / 标点页回来 ---------------- */

    var draft = takeDraft();
    if (draft) {
      if (draft.form) form.setValue(draft.form);
      if (draft.related && relBox) relBox.setTokens(draft.related);
      if (draft.refs) {
        refs = draft.refs;
        if (refsView) refsView.setRefs(refs);
      }
      syncRefCount();
    }

    var picked = window.ZoneRelations.peekPick();
    if (picked && picked.done) {
      window.ZoneRelations.takePicked();
      if (relBox) relBox.setTokens(picked.selected || []);
    }

    absorbPickedTips().then(syncRefCount);

    /* ---------------- 保存 ---------------- */

    function values() {
      var v = form.collect();
      v.related = relBox ? relBox.tokens() : [];
      v.refs = (refsView ? refsView.refs() : refs).map(function (r) {
        return { id: r.id, title: r.title };
      });
      return v;
    }

    function save() {
      var problems = form.validate();
      if (problems.length) { form.showError(problems.join("；")); return Promise.reject(new Error("校验未通过")); }

      var v = values();
      formErrorEl.hidden = true;

      var saved;
      if (mode === "edit") {
        var id = zoneInput.id;
        saved = D.archiveVersion(zoneInput, "edit").then(function () {
          v.id = id;
          return D.updateEntry(v);
        }).then(function () { return v; });
      } else {
        v.id = D.newId();
        saved = D.insertEntry(v).then(function () { return v; });
      }

      return saved.then(function (result) {
        var ids = Object.keys(newRefIds);
        if (!ids.length) return result;
        return Promise.all(ids.map(function (tipId) {
          return D.markTipAdopted(tipId, result.id).catch(function () { return null; });
        })).then(function () { return result; });
      });
    }

    return {
      save: save,
      values: values,
      form: form,
      relations: relBox,
      refs: function () { return refs; },
      root: root
    };
  }

  window.ZoneEditor = { mount: mount, esc: esc };
})();
