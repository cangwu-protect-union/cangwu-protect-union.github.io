/* 增加条目 / 提供情报（表单 + 多图上传）
   同一个脚本服务两个页面，靠 <body data-mode> 区分。
   拆成 3 个文件按顺序加载：add-gui-upload.js → add-gui-draft.js → add-gui.js，函数都挂在 window.AddGuiPage 上。 */
(function () {
  "use strict";
  var P = window.AddGuiPage = window.AddGuiPage || {};

  /* 当前页面是「增加条目」还是「提供情报」 */
  P.MODE = (document.body && document.body.getAttribute("data-mode")) || "entry";
  P.IS_TIP = (P.MODE === "tip");

  /* 引用过的情报：[{id, title}]，随条目一起保存 */
  P.pickedRefs = [];

  /* 关联条目框（只在增加条目模式用，提供情报页隐藏） */
  P.relBox = null;

  /* 查重提示已经确认过（避免第二次提交又被拦一次） */
  P.dupAcknowledged = false;

  P.gateSection = document.getElementById("gateSection");
  P.gateMount   = document.getElementById("gateMount");
  P.formSection = document.getElementById("formSection");
  P.doneSection = document.getElementById("doneSection");
  P.entryForm   = document.getElementById("entryForm");
  P.formError   = document.getElementById("formError");
  P.editorSel   = document.getElementById("editorSel");

  P.showForm = function () {
    if (P.gateSection) P.gateSection.hidden = true;
    P.formSection.hidden = false;
    if (!P.IS_TIP && P.editorSel) window.Operator.fill(P.editorSel, "请选择编辑人");
    var t = document.getElementById("fTitle");
    if (t) t.focus();
  }

  if (P.IS_TIP) {
    /* 投稿开放，不需要组织验证，直接进表单 */
    P.showForm();
  } else {
    /* 增加条目：用共享的 GuiGate 验证（本会话验过就直接放行） */
    window.GuiGate.require(P.gateMount, {
      cancelHref: "edit-gui.html",
      failHref: "edit-gui.html",
      onPass: P.showForm
    });
  }

  /* ---------- 取消 ---------- */
  document.getElementById("cancelBtn").addEventListener("click", function () {
    location.href = P.IS_TIP ? "../projects.html" : "edit-gui.html";
  });

  /* ---------- 提交新条目 ---------- */
  P.entryForm.addEventListener("submit", function (ev) {
    ev.preventDefault();
    P.formError.hidden = true;

    var title = document.getElementById("fTitle").value.trim();
    var body  = document.getElementById("fBody").value.trim();
    var media = P.collectedMedia();
    var images = media.images;
    var tags  = window.GuiData.parseTags(document.getElementById("fTags").value);
    var today = new Date().toISOString().slice(0, 10);

    if (P.anyUploading()) {
      P.formError.textContent = "还有图片正在上传，请等全部完成后再点确认。";
      P.formError.hidden = false;
      return;
    }

    var failed = P.queue.filter(function (i) { return i.status === "error"; });
    if (failed.length) {
      P.formError.textContent = "有 " + failed.length + " 张图片上传失败，请重试或移除后再提交。";
      P.formError.hidden = false;
      return;
    }

    /* 必填项交给 GuiData.validateEntry 判断，字段清单只有一份 */
    var problems = window.GuiData.validateEntry({ title: title, body: body, tags: tags, date: today });
    if (problems.length) {
      P.formError.textContent = problems[0] + "。";
      P.formError.hidden = false;
      return;
    }

    var member = "";
    if (!P.IS_TIP && P.editorSel) {
      member = window.Operator.value(P.editorSel);
      if (!member) {
        P.formError.textContent = "请选择编辑人。";
        P.formError.hidden = false;
        return;
      }
    }

    /* 查重：标题和已有条目/情报相似度够高就先拦一次，确认后才继续。
       查重本身失败不会阻塞提交（GuiData.dupCheck 内部吞掉错误）。 */
    if (!P.dupAcknowledged) {
      var dupBtn = P.entryForm.querySelector('button[type="submit"]');
      var dupLabel = dupBtn ? dupBtn.textContent : "";
      if (dupBtn) { dupBtn.disabled = true; dupBtn.textContent = "查重中…"; }

      window.GuiData.dupCheck(title).then(function (hits) {
        if (dupBtn) { dupBtn.disabled = false; dupBtn.textContent = dupLabel || "确认提交"; }

        var close = (hits || []).filter(function (h) { return h.score >= 0.5; });
        var goOn = true;

        if (close.length) {
          var lines = close.slice(0, 3).map(function (h) {
            return "· " + h.title + "（" + (h.kind === "entry" ? "已有条目" : "已有情报") +
                   "，相似度 " + h.score + "）";
          });
          goOn = window.confirm(
            "已经存在相似的内容：\n" + lines.join("\n") +
            "\n\n如果这是同一起事件，请改为补充已有条目；确实是新内容就点确定继续提交。"
          );
        }

        if (!goOn) return;
        P.dupAcknowledged = true;
        if (P.entryForm.requestSubmit) P.entryForm.requestSubmit();
        else P.entryForm.dispatchEvent(new Event("submit", { cancelable: true }));
      });
      return;
    }

    var intro = window.GuiData.buildIntro(body);

    var entry = {
      id: window.GuiData.newId(),
      title: title,
      image: images[0] || "",   /* 封面图：第一张，列表页用 */
      images: images,           /* 全部原图：详情页用 */
      thumbs: media.thumbs,     /* 对应缩略图：列表页用 */
      intro: intro,
      body: body,
      tags: tags,
      date: today,
      related: P.relBox ? P.relBox.tokens() : [],
      refs: P.pickedRefs,          /* 引用过的情报 [{id,title}]，仅增加条目模式会有 */
      editor: member
    };

    var submitBtn = P.entryForm.querySelector('button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "上传中…"; }

    /* 情报提交到 gui_tips，条目提交到 gui_entries */
    var savePromise;
    if (P.IS_TIP) {
      savePromise = window.GuiData.addTip(entry).then(function () {
        return { remoteSaved: true, error: null };
      }).catch(function (err) {
        return { remoteSaved: false, error: err.message };
      });
    } else {
      savePromise = window.GuiData.add(entry).then(function (result) {
        if (result && result.remoteSaved) {
          window.EditLog.log({
            module: "guitu", targetType: "entry", targetId: entry.id,
            targetTitle: title, action: "create", member: member
          });
        }
        return result;
      });
    }

    savePromise.then(function (result) {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "确认"; }

      P.formSection.hidden = true;
      P.doneSection.hidden = false;

      var failBox = document.getElementById("failBox");
      var doneText = document.getElementById("doneText");

      if (P.IS_TIP) {
        /* 情报没有本地兜底：上传失败就直接告诉用户重试 */
        if (result.remoteSaved) {
          P.clearDraft();   /* 提交成功，草稿没用了 */
          doneText.textContent = "情报「" + title + "」已提交。成员可以在「查看情报」里看到它。";
        } else {
          doneText.textContent = "提交失败：" + (result.error || "云端没有响应") + "。请稍后重试。";
        }
        document.getElementById("doneView").href = "tips-entry.html?id=" + encodeURIComponent(entry.id);
      } else {
        if (result.remoteSaved) {
          P.clearDraft();   /* 已经存进云端，草稿没用了 */
          if (failBox) failBox.hidden = true;
          doneText.textContent = "条目「" + title + "」已上传到云端，所有设备都能看到，可以立即搜索。";
        } else {
          if (failBox) failBox.hidden = false;
          doneText.textContent = "条目「" + title + "」已保存在这台设备上。";
        }
        document.getElementById("doneView").href = "条目.html?id=" + encodeURIComponent(entry.id);
      }
    });
  });

  /* ---------- 复制 JSON：生成完整的 entries.json 内容 ---------- */
  P.copyBtn = document.getElementById("copyBtn");
  P.copyState = document.getElementById("copyState");

  /* 提供情报页没有这段兜底（情报必须上云才有意义），所以要做存在性判断 */
  if (P.copyBtn) P.copyBtn.addEventListener("click", function () {
    P.copyState.hidden = true;
    Promise.resolve(window.GuiData.readLocal()).then(function (localEntries) {
      var text = JSON.stringify({ entries: localEntries }, null, 2);
      function done(msg, ok) {
        P.copyState.textContent = msg;
        P.copyState.hidden = false;
        P.copyState.className = ok ? "gate-error gate-ok" : "gate-error";
      }

      function fallback() {
        /* 剪贴板 API 不可用时（非 https 或权限被拒），显示一个可选中的文本框 */
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
        document.body.removeChild(ta);

        if (ok) { done("已复制到剪贴板。去 GitHub 粘贴即可。", true); return; }

        /* 真的复制不了：把完整内容放进页面，让用户自己全选复制 */
        var box = document.getElementById("copyManual");
        if (box) { box.value = text; box.hidden = false; box.focus(); box.select(); }
        done("浏览器不允许自动复制。完整内容已显示在下方，请点一下文本框按 Ctrl+A、Ctrl+C。", false);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          done("已复制 " + text.length + " 个字符到剪贴板。去 GitHub 粘贴即可。", true);
        }).catch(fallback);
      } else {
        fallback();
      }
    }).catch(function (e) {
      P.copyState.textContent = "生成 JSON 失败：" + e.message;
      P.copyState.hidden = false;
    });
  });

  /* ============================================================
     多图上传队列
     - 支持多选 / 拖拽 / 粘贴
     - 并发 2 个上传，其余排队
     - 每张单独显示状态，失败可单独重试
     ============================================================ */
  P.fileInput   = document.getElementById("fImageFile");
  P.pickBtn     = document.getElementById("pickImageBtn");
  P.dropzone    = document.getElementById("dropzone");
  P.thumbsEl    = document.getElementById("thumbs");
  P.imgUrlInput = document.getElementById("fImage");

  P.queue = [];              /* { key, name, previewUrl, status, url, error } */
  P.seq = 0;
  P.running = 0;
  P.MAX_CONCURRENT = 2;




  /* 启动队列中还没开始的条目 */



  /* ---- 点击选择 ---- */
  P.pickBtn.addEventListener("click", function () { P.fileInput.click(); });
  P.fileInput.addEventListener("change", function () {
    P.addFiles(P.fileInput.files);
    P.fileInput.value = "";   /* 允许重复选同一个文件 */
  });

  /* ---- 拖拽 ---- */
  ["dragenter", "dragover"].forEach(function (ev) {
    P.dropzone.addEventListener(ev, function (e) {
      e.preventDefault();
      e.stopPropagation();
      P.dropzone.classList.add("is-drag");
    });
  });
  ["dragleave", "drop"].forEach(function (ev) {
    P.dropzone.addEventListener(ev, function (e) {
      e.preventDefault();
      e.stopPropagation();
      P.dropzone.classList.remove("is-drag");
    });
  });
  P.dropzone.addEventListener("drop", function (e) {
    var dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length) P.addFiles(dt.files);
  });

  /* ---- 粘贴（Ctrl+V 直接贴截图） ---- */
  document.addEventListener("paste", function (e) {
    /* 如果焦点在文本框里，粘贴文本是正常操作，不拦截 */
    var el = e.target;
    var typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
    if (typing) {
      /* 但如果是图片，仍然要接管 */
      var items0 = (e.clipboardData && e.clipboardData.items) || [];
      var hasImg = Array.prototype.some.call(items0, function (i) { return /^image\//.test(i.type); });
      if (!hasImg) return;
    }
    if (P.formSection.hidden) return;   /* 还没通过验证，不响应 */

    var items = (e.clipboardData && e.clipboardData.items) || [];
    var files = [];
    for (var i = 0; i < items.length; i++) {
      if (/^image\//.test(items[i].type)) {
        var f = items[i].getAsFile();
        if (f) {
          /* 粘贴的截图没有文件名，补一个便于识别 */
          if (!f.name) { try { Object.defineProperty(f, "name", { value: "粘贴的截图.png" }); } catch (err) {} }
          files.push(f);
        }
      }
    }
    if (files.length) {
      e.preventDefault();
      P.addFiles(files);
    }
  });

  /* ---- 缩略图上的删除 / 重试（事件委托） ---- */
  P.thumbsEl.addEventListener("click", function (e) {
    var delKey = e.target.getAttribute && e.target.getAttribute("data-del");
    if (delKey) {
      P.queue = P.queue.filter(function (i) {
        if (i.key === delKey) {
          if (i.previewUrl && i.previewUrl.indexOf("blob:") === 0) URL.revokeObjectURL(i.previewUrl);
          return false;
        }
        return true;
      });
      P.renderThumbs();
      return;
    }

    var retryKey = e.target.getAttribute && e.target.getAttribute("data-retry");
    if (retryKey) {
      var it = P.queue.filter(function (i) { return i.key === retryKey; })[0];
      if (it) {
        it.status = "waiting";
        it.error = "";
        P.renderThumbs();
        P.pump();
      }
    }
  });

  /* 收集已上传成功的图片地址（按添加顺序）
     返回 { images: 原图数组, thumbs: 缩略图数组 }
     两个数组长度一致、顺序对应；手动粘贴的网址没有缩略图，用空串占位，
     显示时 guiThumbFor() 会自动回退到原图。 */

  /* ============================================================
     引用情报
     ------------------------------------------------------------
     流程：
       1. 点「引用情报」→ 跳到 pick-tips.html 勾选
       2. pick-tips 把选中的情报写进 sessionStorage（gui_picked_tips）
       3. 回到本页时读取它，把正文 / 图片 / 标签追加到表单，
          并记下引用关系（refs），随条目一起保存
     ============================================================ */

  P.PICK_KEY = "gui_picked_tips";

  P.pickTipsBtn = document.getElementById("pickTipsBtn");
  if (P.pickTipsBtn) {
    P.pickTipsBtn.addEventListener("click", function () {
      location.href = "pick-tips.html?back=" + encodeURIComponent("add-gui.html");
    });
  }

  /* 把引用来的情报合并进表单 */

  /* 引用情报的调用挪到文件末尾：必须先恢复草稿，再合并引用，否则合并的内容会被覆盖 */

  /* ============================================================
     表单草稿（提供情报 / 增加条目 都生效）
     ------------------------------------------------------------
     问题：填到一半点了别的页面再退回来，页面会重新加载，写的内容全丢。
     办法：边填边把内容存进 sessionStorage，回到本页时自动恢复。
        · 图片只存已经上传成功的（它们本来就是云端地址，能直接复用）
        · 提交成功后清掉草稿（条目上传失败时保留，方便重试）
        · 超过 24 小时的草稿不再恢复，免得看到几天前的内容
     ============================================================ */

  /* 两个页面各用各的键，互不干扰 */

  P.DRAFT_MAX_AGE = 24 * 60 * 60 * 1000;


  /* 存草稿 */


  /* 把草稿填回表单 */

  /* 恢复后给个提示，并提供一键清空，免得用户疑惑 */

  /* 边填边存 */
  ["fTitle", "fBody", "fTags", "fImage"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("input", P.saveDraft);
  });

  /* 顺序很重要：
     1. 先把关联条目框建起来（草稿恢复要往里塞 token）
     2. 再把上次没提交完的草稿填回去
     3. 最后把这次通过「引用情报 / 引用条目」选中的内容合并进来
     反过来的话，恢复草稿会把刚合并的内容覆盖掉。 */
  if (!P.IS_TIP && window.RelationBox) {
    P.relBox = window.RelationBox.mount(document.getElementById("relBox"), {
      selfType: "ghost",
      selfId: "",
      pickUrl: "../quyu/pick-relation.html",
      onBeforeOpen: P.saveDraft,
      listUrl: function (it) {
        return it.type === "ghost"
          ? "条目.html?id=" + encodeURIComponent(it.id)
          : "../quyu/zone.html?id=" + encodeURIComponent(it.id);
      }
    });
  }

  P.restoreDraft();

  /* 从「引用条目」页回来：这次选的覆盖草稿里的旧选择 */
  if (!P.IS_TIP && P.relBox) {
    var pickedRel = window.ZoneRelations.peekPick();
    if (pickedRel && pickedRel.done) {
      window.ZoneRelations.takePicked();
      P.relBox.setTokens(pickedRel.selected || []);
    }
  }

  if (!P.IS_TIP) P.applyPickedTips();
})();