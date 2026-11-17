/* 增加条目 · 引用情报与草稿分片
   只往 window.AddGuiPage 挂函数，在 add-gui.js 之前加载。 */
(function () {
  "use strict";
  var P = window.AddGuiPage || (window.AddGuiPage = {});


  P.applyPickedTips = function () {
    var raw = null;
    try { raw = sessionStorage.getItem(P.PICK_KEY); } catch (e) { return; }
    if (!raw) return;

    /* 立刻清掉，避免下次再进来重复追加 */
    try { sessionStorage.removeItem(P.PICK_KEY); } catch (e) {}

    var picks;
    try { picks = JSON.parse(raw); } catch (e) { return; }
    if (!Array.isArray(picks) || !picks.length) return;

    P.pickedRefs = picks.map(function (p) { return { id: p.id, title: p.title }; });

    /* --- 正文：按情报顺序追加段落 --- */
    var bodyEl = document.getElementById("fBody");
    var extra = picks.map(function (p) { return (p.body || "").trim(); })
                     .filter(function (s) { return s !== ""; });
    if (extra.length && bodyEl) {
      var cur = bodyEl.value.trim();
      bodyEl.value = (cur ? cur + "\n\n" : "") + extra.join("\n\n");
    }

    /* --- 图片：直接放进队列，标记为已完成（它们本来就是云端地址） --- */
    picks.forEach(function (p) {
      var urls = p.images || [];
      var ths = p.thumbs || [];
      urls.forEach(function (u, i) {
        P.queue.push({
          key: "img" + (++P.seq),
          name: "引用的图片",
          file: null,
          previewUrl: (ths[i] || u),
          status: "done",
          url: u,
          thumb: ths[i] || "",
          error: ""
        });
      });
    });
    P.renderThumbs();

    /* --- 标签：去重后追加 --- */
    var tagEl = document.getElementById("fTags");
    if (tagEl) {
      var curTags = tagEl.value.split(/[,，]/).map(function (s) { return s.trim(); })
                            .filter(function (s) { return s !== ""; });
      picks.forEach(function (p) {
        (p.tags || []).forEach(function (tg) {
          if (curTags.indexOf(tg) < 0) curTags.push(tg);
        });
      });
      tagEl.value = curTags.join(", ");
    }

    /* 提示用户引用了哪些情报 */
    var hint = document.getElementById("refsHint");
    if (hint) {
      hint.className = "gate-error gate-ok";
      hint.textContent = "已引用 " + picks.length + " 条情报：" +
        picks.map(function (p) { return "「" + p.title + "」"; }).join("、");
      hint.hidden = false;
    }
  }

  P.draftKey = function () {
    return P.IS_TIP ? "gui_tip_draft" : "gui_entry_draft";
  }

  P.draftEls = function () {
    return {
      title: document.getElementById("fTitle"),
      body:  document.getElementById("fBody"),
      tags:  document.getElementById("fTags"),
      imageUrl: document.getElementById("fImage")
    };
  }

  P.saveDraft = function () {
    var els = P.draftEls();
    if (!els.title || !els.body) return;

    /* 只收已经上传完成的图片 */
    var imgs = P.queue
      .filter(function (i) { return i.status === "done" && i.url; })
      .map(function (i) { return { url: i.url, thumb: i.thumb || "" }; });

    try {
      sessionStorage.setItem(P.draftKey(), JSON.stringify({
        savedAt: Date.now(),
        title: els.title.value,
        body: els.body.value,
        tags: els.tags ? els.tags.value : "",
        imageUrl: els.imageUrl ? els.imageUrl.value : "",
        images: imgs,
        refs: P.pickedRefs,
        related: P.relBox ? P.relBox.tokens() : []
      }));
    } catch (e) {}
  }

  P.clearDraft = function () {
    try { sessionStorage.removeItem(P.draftKey()); } catch (e) {}
  }

  P.restoreDraft = function () {

    var raw = null;
    try { raw = sessionStorage.getItem(P.draftKey()); } catch (e) { return; }
    if (!raw) return;

    var d = null;
    try { d = JSON.parse(raw); } catch (e) { P.clearDraft(); return; }
    if (!d) { P.clearDraft(); return; }

    /* 太旧的草稿直接丢掉 */
    if (!d.savedAt || Date.now() - d.savedAt > P.DRAFT_MAX_AGE) { P.clearDraft(); return; }

    /* 完全空的草稿没什么可恢复的 */
    var hasText = (d.title || "").trim() || (d.body || "").trim() ||
                  (d.tags || "").trim() || (d.imageUrl || "").trim() ||
                  (d.images && d.images.length) || (d.refs && d.refs.length);
    if (!hasText) { P.clearDraft(); return; }

    var els = P.draftEls();
    if (els.title && d.title) els.title.value = d.title;
    if (els.body && d.body) els.body.value = d.body;
    if (els.tags && d.tags) els.tags.value = d.tags;
    if (els.imageUrl && d.imageUrl) els.imageUrl.value = d.imageUrl;
    if (d.refs && d.refs.length) P.pickedRefs = d.refs;
    if (d.related && P.relBox) P.relBox.setTokens(d.related);

    /* 已上传的图片直接放回队列，标记为完成，不需要重传 */
    (d.images || []).forEach(function (im) {
      if (!im || !im.url) return;
      P.queue.push({
        key: "img" + (++P.seq),
        name: "已上传的图片",
        file: null,
        previewUrl: im.thumb || im.url,
        status: "done",
        url: im.url,
        thumb: im.thumb || "",
        error: ""
      });
    });
    P.renderThumbs();

    P.showDraftHint();
  }

  P.showDraftHint = function () {
    var err = document.getElementById("formError");
    if (!err || !err.parentNode || document.getElementById("draftHint")) return;

    var p = document.createElement("p");
    p.className = "tip-draft-hint";
    p.id = "draftHint";
    p.innerHTML = "已恢复上次没提交完的内容。" +
                  '<button type="button" class="link-btn" id="clearDraftBtn">清空重填</button>';

    err.parentNode.insertBefore(p, err);

    document.getElementById("clearDraftBtn").addEventListener("click", function () {
      var els = P.draftEls();
      if (els.title) els.title.value = "";
      if (els.body) els.body.value = "";
      if (els.tags) els.tags.value = "";
      if (els.imageUrl) els.imageUrl.value = "";

      P.queue = [];
      P.renderThumbs();      /* 这一步会顺手存一次草稿，所以清空要放在它后面 */

      P.clearDraft();     /* 最后再删，确保真的删干净 */

      p.remove();
    });
  }
})();
