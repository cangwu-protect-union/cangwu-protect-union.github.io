/* ============================================================
   zone-form.js —— 区域表单（新增 / 编辑 / 投稿 三处共用）
   ------------------------------------------------------------
   为什么做成一个模块：三张页面要填的是同一套字段，
   字段清单一变就得改三处，迟早不一致。这里从 ZoneData.ZONE_FIELDS
   和三个枚举里取，页面只管「什么时候显示、提交给谁」。

   对外：
     var form = ZoneForm.mount(rootEl, { mode: "create"|"edit"|"tip", value: zone })
     form.collect()       → 字段对象
     form.validate()      → 人话的问题数组，空数组表示通过
     form.media()         → { image, images, thumbs }
     form.isUploading()   → 还有图片在上传就返回 true
     form.setValue(zone)  → 回填
     form.reset()         → 清空
   ============================================================ */
(function () {
  "use strict";

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

  function options(list, current) {
    return '<option value="">（未定）</option>' + list.map(function (v) {
      return '<option value="' + esc(v) + '"' + (v === current ? " selected" : "") + ">" + esc(v) + "</option>";
    }).join("");
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

      '<div class="field-row">' +
        '<div class="field">' +
          '<label for="zfRegion">所属地区</label>' +
          '<input id="zfRegion" type="text" maxlength="60" placeholder="例：苍梧 · 城西">' +
        "</div>" +
        '<div class="field">' +
          '<label for="zfTerrain">地形</label>' +
          '<select id="zfTerrain">' + options(D.TERRAIN, "") + "</select>" +
        "</div>" +
      "</div>" +

      '<div class="field-row">' +
        '<div class="field">' +
          '<label for="zfLng">经度 <span class="muted">（可留空）</span></label>' +
          '<input id="zfLng" type="number" step="0.000001" placeholder="120.583">' +
        "</div>" +
        '<div class="field">' +
          '<label for="zfLat">纬度</label>' +
          '<input id="zfLat" type="number" step="0.000001" placeholder="31.313">' +
        "</div>" +
      "</div>" +
      '<p class="field-hint">坐标用 WGS-84，与天地图一致；渲染高德过渡底图时会自动换算，不用自己改。</p>' +

      '<div class="field-row" data-admin>' +
        '<div class="field">' +
          '<label for="zfLevel">危险等级</label>' +
          '<select id="zfLevel">' + options(D.LEVELS, "") + "</select>" +
        "</div>" +
        '<div class="field">' +
          '<label for="zfStatus">状态</label>' +
          '<select id="zfStatus">' + options(D.STATUSES, "") + "</select>" +
        "</div>" +
        '<div class="field">' +
          '<label for="zfRadius">范围半径（米）</label>' +
          '<input id="zfRadius" type="number" min="0" step="10" placeholder="0 表示未测定">' +
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
          '<label for="zfTags">标签 <span class="muted">（逗号分隔）</span></label>' +
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
      region: root.querySelector("#zfRegion"),
      terrain: root.querySelector("#zfTerrain"),
      lng: root.querySelector("#zfLng"),
      lat: root.querySelector("#zfLat"),
      level: root.querySelector("#zfLevel"),
      status: root.querySelector("#zfStatus"),
      radius: root.querySelector("#zfRadius"),
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

    /* 投稿页看不到「等级 / 状态 / 半径」，那些由组织在采纳时补 */
    if (isTip) {
      root.querySelectorAll("[data-admin]").forEach(function (n) { n.hidden = true; });
    }

    /* ---------------- 图片队列 ---------------- */

    var queue = [];      /* { key, file, previewUrl, status, url, thumb } */
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

    /* ---------------- 对外 ---------------- */

    function media() {
      var done = queue.filter(function (i) { return i.status === "done"; });
      return {
        images: done.map(function (i) { return i.url; }),
        thumbs: done.map(function (i) { return i.thumb || i.url; })
      };
    }

    function collect() {
      var m = media();
      var lng = el.lng.value.trim();
      var lat = el.lat.value.trim();
      var radius = el.radius.value.trim();

      return {
        title: el.title.value.trim(),
        region: el.region.value.trim(),
        lng: lng === "" ? null : Number(lng),
        lat: lat === "" ? null : Number(lat),
        radius_m: radius === "" ? 0 : Math.round(Number(radius)),
        terrain: el.terrain.value,
        level: el.level.value,
        status: el.status.value,
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
        title: v.title, region: v.region, body: v.body, date: v.date
      });

      if (v.title && v.title.length > 60) problems.push("区域名不要超过 60 个字");
      if ((v.lng == null) !== (v.lat == null)) problems.push("经度和纬度要同时填，或者都留空");
      if (v.lng != null && (v.lng < -180 || v.lng > 180)) problems.push("经度要在 -180 到 180 之间");
      if (v.lat != null && (v.lat < -90 || v.lat > 90)) problems.push("纬度要在 -90 到 90 之间");
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
      el.region.value = zone.region || "";
      el.terrain.value = zone.terrain || "";
      el.lng.value = typeof zone.lng === "number" ? zone.lng : "";
      el.lat.value = typeof zone.lat === "number" ? zone.lat : "";
      el.level.value = zone.level || "";
      el.status.value = zone.status || "";
      el.radius.value = zone.radius_m ? zone.radius_m : "";
      el.body.value = zone.body || "";
      el.image.value = zone.image || "";
      el.tags.value = (zone.tags || []).join(", ");
      el.date.value = zone.date || today();

      /* 已有图片直接放进队列，显示成已上传状态 */
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
    }

    function reset() {
      setValue({ date: today() });
      el.error.hidden = true;
    }

    function showError(text) {
      el.error.textContent = text || "";
      el.error.hidden = !text;
    }

    setValue(value);
    if (!el.date.value) el.date.value = today();

    return {
      collect: collect,
      validate: validate,
      media: media,
      isUploading: isUploading,
      setValue: setValue,
      reset: reset,
      showError: showError,
      el: el,
      isTip: isTip
    };
  }

  window.ZoneForm = { mount: mount, today: today };
})();
