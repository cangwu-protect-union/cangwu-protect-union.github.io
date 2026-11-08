/* ============================================================
   zone-form.js —— 区域表单（新增 / 编辑 / 投稿 三处共用）
   ------------------------------------------------------------
   字段：区域名、位置（必填，小地图 + 坐标）、描述、图片、标签、日期。
   位置通过 pick-location.html 标点；跳走前把已填内容存进 sessionStorage，
   回来后原样恢复——不然标一次点，上面写的东西全没了。

   对外：
     var form = ZoneForm.mount(rootEl, { mode: "create"|"edit"|"tip", value: zone })
     form.collect() / validate() / media() / isUploading() / setValue() / reset()
   ============================================================ */
(function () {
  "use strict";

  var DRAFT_KEY = "quyu_form_draft";
  var seq = 0;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function today() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  function coordText(lng, lat) {
    if (typeof lng !== "number" || typeof lat !== "number") return "未标点";
    return lng.toFixed(4) + ", " + lat.toFixed(4);
  }

  function mount(root, opts) {
    opts = opts || {};
    var value = opts.value || {};
    var mode = opts.mode || "create";
    var isTip = mode === "tip";
    var D = window.ZoneData;

    root.innerHTML = "" +
      '<div class="field">' +
        '<label for="zfTitle">区域名</label>' +
        '<input id="zfTitle" type="text" maxlength="60" placeholder="例：苍梧西门旧糖厂">' +
      "</div>" +

      '<div class="field">' +
        '<label>位置 <span class="muted">' + (isTip ? "（可留空）" : "（必填）") + "</span></label>" +
        '<div class="loc-box" id="zfLocBox" role="button" tabindex="0" aria-label="选择位置">' +
          '<div class="loc-box__map" id="zfLocMap"></div>' +
          '<div class="loc-box__side">' +
            '<p class="loc-box__text" id="zfLocText">未标点</p>' +
            '<button type="button" class="btn btn-ghost" id="zfLocBtn">选择位置</button>' +
          "</div>" +
        "</div>" +
      "</div>" +

      '<div class="field">' +
        '<label for="zfBody">描述 <span class="muted">（段落之间空一行）</span></label>' +
        '<textarea id="zfBody" rows="10" placeholder="什么时间发现的、有什么现象、现在是什么状态……"></textarea>' +
      "</div>" +

      '<div class="field">' +
        "<label>图片</label>" +
        '<div class="dropzone" id="zfDropzone">' +
          '<div class="dz-emoji">🖼</div>' +
          '<p class="dz-main">把图片拖到这里，或者 <button type="button" class="link-btn" id="zfPickBtn">选择文件</button></p>' +
          '<p class="dz-sub">留空会自动生成占位图</p>' +
        "</div>" +
        '<input id="zfFile" type="file" accept="image/*" multiple hidden>' +
        '<div class="thumbs" id="zfThumbs" hidden></div>' +
        '<input id="zfImage" type="url" placeholder="也可以粘贴单张图片网址 https://…">' +
      "</div>" +

      '<div class="field-row">' +
        '<div class="field">' +
          '<label for="zfTags">标签 <span class="muted">（逗号分隔，每个不超过 ' + D.TAG_MAX + ' 字）</span></label>' +
          '<input id="zfTags" type="text" placeholder="城市异常, 有影像记录">' +
        "</div>" +
        '<div class="field">' +
          '<label for="zfDate">记录日期</label>' +
          '<input id="zfDate" type="date">' +
        "</div>" +
      "</div>" +

      '<p class="gate-error" id="zfError" hidden></p>';

    var el = {
      title: root.querySelector("#zfTitle"),
      locBox: root.querySelector("#zfLocBox"),
      locMap: root.querySelector("#zfLocMap"),
      locText: root.querySelector("#zfLocText"),
      locBtn: root.querySelector("#zfLocBtn"),
      body: root.querySelector("#zfBody"),
      image: root.querySelector("#zfImage"),
      tags: root.querySelector("#zfTags"),
      date: root.querySelector("#zfDate"),
      thumbs: root.querySelector("#zfThumbs"),
      dropzone: root.querySelector("#zfDropzone"),
      pickBtn: root.querySelector("#zfPickBtn"),
      file: root.querySelector("#zfFile"),
      error: root.querySelector("#zfError")
    };

    var coords = { lng: null, lat: null };
    var mini = null;

    /* ---------------- 位置：小地图 + 跳转标点 ---------------- */

    function renderLoc() {
      el.locText.textContent = coordText(coords.lng, coords.lat);
      el.locBox.classList.toggle("is-empty", coords.lng == null);

      if (!window.ZoneMap) return;

      if (!mini) {
        mini = window.ZoneMap.create(el.locMap, {
          center: [coords.lat == null ? 30.9 : coords.lat, coords.lng == null ? 120.2 : coords.lng],
          zoom: coords.lng == null ? 5 : 11,
          interactive: false
        });
        if (coords.lng != null) mini.addZone({ lng: coords.lng, lat: coords.lat });
      } else {
        mini.setPosition(coords.lng, coords.lat);
      }
    }

    function saveDraft() {
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
          title: el.title.value,
          body: el.body.value,
          tags: el.tags.value,
          date: el.date.value,
          image: el.image.value,
          images: queue.filter(function (i) { return i.status === "done"; }).map(function (i) { return i.url; }),
          thumbs: queue.filter(function (i) { return i.status === "done"; }).map(function (i) { return i.thumb || i.url; })
        }));
      } catch (e) {}
    }

    function readDraft() {
      try {
        var v = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null");
        sessionStorage.removeItem(DRAFT_KEY);
        return v && typeof v === "object" ? v : null;
      } catch (e) { return null; }
    }

    function gotoPicker() {
      if (opts.onBeforeNavigate) { try { opts.onBeforeNavigate(); } catch (_e) {} }
      saveDraft();
      window.ZonePicker.open(coords.lng, coords.lat, location.pathname + location.search, opts.pickerUrl);
    }

    el.locBox.addEventListener("click", function (ev) {
      if (ev.target.closest("button")) return;
      gotoPicker();
    });
    el.locBox.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); gotoPicker(); }
    });
    el.locBtn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      gotoPicker();
    });

    /* ---------------- 图片队列 ---------------- */

    var queue = [];
    var running = 0;
    var MAX_CONCURRENT = 2;

    function renderThumbs() {
      if (!queue.length) { el.thumbs.innerHTML = ""; el.thumbs.hidden = true; return; }
      el.thumbs.hidden = false;
      el.thumbs.innerHTML = queue.map(function (it) {
        var badge = it.status === "uploading" ? '<span class="thumb-badge">上传中</span>'
                  : it.status === "error" ? '<span class="thumb-badge is-err">失败</span>' : "";
        var retry = it.status === "error"
          ? '<button type="button" class="thumb-retry" data-retry="' + it.key + '">重试</button>' : "";
        var src = it.previewUrl || it.url || "";
        return '<div class="thumb thumb-' + it.status + '" data-key="' + it.key + '">' +
                 '<img src="' + esc(src) + '" alt="">' + badge + retry +
                 '<button type="button" class="thumb-del" data-del="' + it.key + '" title="移除">×</button>' +
               "</div>";
      }).join("");
    }

    function pump() {
      while (running < MAX_CONCURRENT) {
        var next = queue.filter(function (i) { return i.status === "waiting"; })[0];
        if (!next) break;
        start(next);
      }
    }

    function start(item) {
      item.status = "uploading";
      running++;
      renderThumbs();

      window.ZoneUpload.uploadFile(item.file).then(function (res) {
        item.url = res.url;
        item.thumb = res.thumb;
        item.status = "done";
        if (item.previewUrl && item.previewUrl.indexOf("blob:") === 0) URL.revokeObjectURL(item.previewUrl);
        item.previewUrl = res.thumb || res.url;
      }).catch(function () {
        item.status = "error";
      }).then(function () {
        running--;
        renderThumbs();
        pump();
      });
    }

    function addFiles(list) {
      var files = Array.prototype.slice.call(list || []);
      var added = 0;
      files.forEach(function (f) {
        if (!f) return;
        var isImage = /^image\//.test(f.type) || (window.ZoneUpload && window.ZoneUpload.looksHeic(f));
        if (!isImage) return;
        queue.push({
          key: "zimg" + (++seq),
          file: f,
          previewUrl: (window.ZoneUpload && window.ZoneUpload.looksHeic(f)) ? "" : URL.createObjectURL(f),
          status: "waiting",
          url: "",
          thumb: "",
          error: ""
        });
        added++;
      });
      if (added) { renderThumbs(); pump(); }
    }

    el.pickBtn.addEventListener("click", function () { el.file.click(); });
    el.file.addEventListener("change", function () { addFiles(el.file.files); el.file.value = ""; });

    ["dragenter", "dragover"].forEach(function (ev) {
      el.dropzone.addEventListener(ev, function (e) { e.preventDefault(); el.dropzone.classList.add("is-drag"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      el.dropzone.addEventListener(ev, function (e) { e.preventDefault(); el.dropzone.classList.remove("is-drag"); });
    });
    el.dropzone.addEventListener("drop", function (e) {
      if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
    });

    el.thumbs.addEventListener("click", function (e) {
      var del = e.target.closest("[data-del]");
      if (del) {
        var key = del.getAttribute("data-del");
        queue = queue.filter(function (i) {
          if (i.key === key && i.previewUrl && i.previewUrl.indexOf("blob:") === 0) URL.revokeObjectURL(i.previewUrl);
          return i.key !== key;
        });
        renderThumbs();
        return;
      }
      var retry = e.target.closest("[data-retry]");
      if (retry) {
        queue.forEach(function (i) { if (i.key === retry.getAttribute("data-retry")) i.status = "waiting"; });
        renderThumbs();
        pump();
      }
    });

    /* ---------------- 取值 / 校验 ---------------- */

    function media() {
      var done = queue.filter(function (i) { return i.status === "done"; });
      return {
        images: done.map(function (i) { return i.url; }),
        thumbs: done.map(function (i) { return i.thumb || i.url; })
      };
    }

    function collect() {
      var m = media();
      return {
        title: el.title.value.trim(),
        lng: coords.lng,
        lat: coords.lat,
        image: el.image.value.trim() || m.images[0] || "",
        images: m.images,
        thumbs: m.thumbs,
        intro: window.ZoneData.buildIntro(el.body.value),
        body: el.body.value,
        tags: window.ZoneData.parseTags(el.tags.value),
        date: el.date.value
      };
    }

    function validate() {
      var v = collect();
      var problems = window.ZoneData.validateZone({
        title: v.title, body: v.body, tags: v.tags, date: v.date
      });

      if (v.title && v.title.length > 60) problems.push("区域名不要超过 60 个字");
      if (!isTip && (v.lng == null || v.lat == null)) problems.push("还没标位置，点「选择位置」在地图上点一下");
      if (v.body && v.body.trim().length < 10) problems.push("描述太短了，至少写一两句话");
      if (isUploading()) problems.push("还有图片在上传，等一会儿再保存");

      return problems;
    }

    function isUploading() {
      return queue.some(function (i) { return i.status === "uploading" || i.status === "waiting"; });
    }

    function setValue(zone) {
      zone = zone || {};
      el.title.value = zone.title || "";
      el.body.value = zone.body || "";
      el.image.value = zone.image || "";
      el.tags.value = (zone.tags || []).join(", ");
      el.date.value = zone.date || today();

      coords.lng = typeof zone.lng === "number" ? zone.lng : null;
      coords.lat = typeof zone.lat === "number" ? zone.lat : null;

      queue = (zone.images || []).map(function (url, i) {
        return {
          key: "zimg" + (++seq),
          file: null,
          previewUrl: (zone.thumbs && zone.thumbs[i]) || url,
          status: "done",
          url: url,
          thumb: (zone.thumbs && zone.thumbs[i]) || url,
          error: ""
        };
      });
      renderThumbs();
      renderLoc();
    }

    function reset() {
      setValue({ date: today() });
      el.error.hidden = true;
    }

    function showError(text) {
      el.error.textContent = text || "";
      el.error.hidden = !text;
    }

    function setCoords(lng, lat) {
      coords.lng = typeof lng === "number" ? lng : null;
      coords.lat = typeof lat === "number" ? lat : null;
      renderLoc();
    }

    /* ---------------- 初始化 ---------------- */

    setValue(value);
    if (!el.date.value) el.date.value = today();

    /* 从标点页回来：先取坐标，再恢复跳走前存的草稿 */
    if (window.ZonePicker) {
      var picked = window.ZonePicker.take();
      if (picked) {
        setCoords(picked.lng, picked.lat);

        var draft = readDraft();
        if (draft) {
          el.title.value = draft.title || el.title.value;
          el.body.value = draft.body || el.body.value;
          el.tags.value = draft.tags || el.tags.value;
          el.date.value = draft.date || el.date.value;
          el.image.value = draft.image || el.image.value;
          if (draft.images && draft.images.length) {
            queue = draft.images.map(function (url, i) {
              return {
                key: "zimg" + (++seq), file: null,
                previewUrl: (draft.thumbs && draft.thumbs[i]) || url,
                status: "done", url: url, thumb: (draft.thumbs && draft.thumbs[i]) || url, error: ""
              };
            });
            renderThumbs();
          }
        }
        window.ZonePicker.clear();
      }
    }

    return {
      collect: collect,
      validate: validate,
      media: media,
      isUploading: isUploading,
      setValue: setValue,
      reset: reset,
      showError: showError,
      setCoords: setCoords,
      coords: function () { return { lng: coords.lng, lat: coords.lat }; },
      el: el,
      isTip: isTip
    };
  }

  window.ZoneForm = { mount: mount, today: today };
})();
