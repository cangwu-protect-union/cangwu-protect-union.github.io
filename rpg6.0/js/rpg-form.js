/* ============================================================
   rpg-form.js —— 角色表单的共用部分
   ------------------------------------------------------------
   投稿页与编辑器共用同一套字段，避免两处各写一份。
   还提供：人员下拉、确认对话框、图片上传。

   图片规则：只有投稿页能加图；编辑器与转正表单里图片只读。
   ============================================================ */
(function () {
  "use strict";

  var STAT_KEYS = ["atk", "def", "mres", "hp", "mp", "spd"];
  var STAT_LABELS = {
    atk: "攻击", def: "防御", mres: "法抗",
    hp: "血量", mp: "蓝上限", spd: "速度"
  };

  var MAX_SKILLS = 12;
  var MAX_IMAGES = 9;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function val(obj, key) {
    return obj && obj[key] != null ? String(obj[key]) : "";
  }

  function statGrid(value) {
    return '<div class="stat-grid">' + STAT_KEYS.map(function (k) {
      return '<label class="field field-compact">' +
               "<span>" + STAT_LABELS[k] + "</span>" +
               '<input type="text" name="' + k + '" maxlength="40" value="' + esc(val(value, k)) + '">' +
             "</label>";
    }).join("") + "</div>";
  }

  function skillRow(skill) {
    var s = skill || {};
    return '<div class="skill-row">' +
             '<div class="skill-row-main">' +
               '<label class="field"><span>技能名称</span>' +
                 '<input type="text" data-skill="name" maxlength="40" value="' + esc(val(s, "name")) + '"></label>' +
               '<label class="field field-narrow"><span>释放条件</span>' +
                 '<input type="text" data-skill="condition" maxlength="40" placeholder="例：1蓝1蓄力" value="' +
                   esc(val(s, "condition")) + '"></label>' +
               '<button type="button" class="btn btn-ghost skill-del" aria-label="删除这条技能">删除</button>' +
             "</div>" +
             '<label class="field"><span>效果</span>' +
               '<textarea data-skill="effect" rows="2" maxlength="400">' + esc(val(s, "effect")) + "</textarea></label>" +
             '<label class="field"><span>备注</span>' +
               '<input type="text" data-skill="note" maxlength="200" value="' + esc(val(s, "note")) + '"></label>' +
           "</div>";
  }

  function imageListHtml(urls) {
    if (!urls.length) return '<p class="muted image-empty">还没有图片。</p>';
    return urls.map(function (u, i) {
      return '<figure class="image-item">' +
               '<img src="' + esc(u) + '" alt="">' +
               '<button type="button" class="btn btn-ghost image-del" data-index="' + i + '"' +
                 ' aria-label="移除这张图片">移除</button>' +
             "</figure>";
    }).join("");
  }

  function imagesField(editable, urls) {
    if (!editable) {
      return '<fieldset class="form-group" data-images-readonly>' +
               "<legend>图片</legend>" +
               '<p class="field-hint">图片只能随投稿提交，建档后不能修改。</p>' +
               '<div class="image-list">' + imageListHtml(urls) + "</div>" +
             "</fieldset>";
    }
    return '<fieldset class="form-group" data-images>' +
             "<legend>图片</legend>" +
             '<p class="field-hint">最多 9 张。图片只能通过投稿提交，建档后不能修改。</p>' +
             '<input type="file" accept="image/*,.heic,.heif" multiple aria-label="选择图片">' +
             '<p class="field-hint image-progress" data-progress hidden></p>' +
             '<div class="image-list" data-image-list>' + imageListHtml(urls) + "</div>" +
           "</fieldset>";
  }

  function renderForm(container, opts) {
    opts = opts || {};
    var value = opts.value || {};
    var skills = Array.isArray(value.skills) && value.skills.length
      ? value.skills
      : [{}, {}, {}];

    var state = {
      images: (value.images || []).filter(function (u) { return String(u).trim(); }),
      editableImages: opts.imagesEditable === true,
      uploading: false
    };
    container.__rpg = state;

    container.innerHTML =
      '<div class="rpg-form">' +
        '<div class="form-problems" data-problems hidden></div>' +
        '<label class="field"><span class="field-label">角色名称 <em>必填</em></span>' +
          '<input type="text" name="name" maxlength="40" value="' + esc(val(value, "name")) + '"></label>' +
        '<label class="field"><span class="field-label">别名' +
          '<span class="field-hint">没有就留空，多个用逗号隔开</span></span>' +
          '<input type="text" name="aliases" value="' +
            esc((value.aliases || []).join("，")) + '"></label>' +
        '<div class="field-row">' +
          '<label class="field"><span class="field-label">主职业 <em>必填</em></span>' +
            '<input type="text" name="occupation" maxlength="20" placeholder="例：粉碎者" value="' +
              esc(val(value, "occupation")) + '"></label>' +
          '<label class="field"><span class="field-label">副业<span class="field-hint">可以留空</span></span>' +
            '<input type="text" name="side_job" maxlength="20" value="' + esc(val(value, "side_job")) + '"></label>' +
          '<label class="field field-narrow"><span class="field-label">强度评级</span>' +
            '<input type="text" name="rating" maxlength="8" list="rpgRatingList" value="' +
              esc(val(value, "rating")) + '"></label>' +
        "</div>" +
        '<datalist id="rpgRatingList">' +
          (window.RpgData ? window.RpgData.RATING_SUGGESTIONS : []).map(function (r) {
            return '<option value="' + esc(r) + '"></option>';
          }).join("") +
        "</datalist>" +
        '<fieldset class="form-group">' +
          "<legend>六维</legend>" +
          '<p class="field-hint">可以填非数字，例如：受攻击者当前血量的20%</p>' +
          statGrid(value) +
        "</fieldset>" +
        '<fieldset class="form-group" data-skills>' +
          "<legend>技能</legend>" +
          '<p class="field-hint">按模板写：技能名称（释放条件）效果。至少一条。</p>' +
          '<div class="skill-rows">' + skills.map(skillRow).join("") + "</div>" +
          '<button type="button" class="btn btn-ghost" data-act="add-skill">添加技能</button>' +
        "</fieldset>" +
        imagesField(state.editableImages, state.images) +
        (opts.showAuthor
          ? '<label class="field"><span class="field-label">署名<span class="field-hint">可留空</span></span>' +
            '<input type="text" name="author" maxlength="30" value="' + esc(val(value, "author")) + '"></label>' +
            '<label class="field"><span class="field-label">备注<span class="field-hint">给审核者的说明</span></span>' +
            '<textarea name="note" rows="3" maxlength="500">' + esc(val(value, "note")) + "</textarea></label>"
          : "") +
      "</div>";

    ensureEvents(container);
    refreshSkillUi(container);
    if (state.editableImages) bindFileInput(container);
    return container;
  }

  /* ---------------- 技能行 ---------------- */

  function skillRows(container) {
    return container.querySelectorAll(".skill-row");
  }

  function refreshSkillUi(container) {
    var addBtn = container.querySelector('[data-act="add-skill"]');
    if (!addBtn) return;
    var full = skillRows(container).length >= MAX_SKILLS;
    addBtn.disabled = full;
    addBtn.textContent = full ? "技能已到上限（12 条）" : "添加技能";
  }

  /* 监听只在第一次挂上：反复 render 同一个容器时不会叠加一份 */
  function ensureEvents(container) {
    if (container.__rpgEvents) return;
    container.__rpgEvents = true;
    container.addEventListener("click", function (ev) {
      handleClick(container, ev);
    });
  }

  function handleClick(container, ev) {
    var target = ev.target;
    if (!target || !target.closest) return;

    var delSkill = target.closest(".skill-del");
    if (delSkill) {
      var row = delSkill.closest(".skill-row");
      if (!row) return;
      if (skillRows(container).length <= 1) {
        Array.prototype.forEach.call(row.querySelectorAll("input, textarea"), function (el) {
          el.value = "";
        });
        return;
      }
      row.parentNode.removeChild(row);
      refreshSkillUi(container);
      return;
    }

    var addSkill = target.closest('[data-act="add-skill"]');
    if (addSkill) {
      if (skillRows(container).length >= MAX_SKILLS) return;
      var rowsBox = container.querySelector("[data-skills] .skill-rows");
      if (rowsBox) rowsBox.insertAdjacentHTML("beforeend", skillRow({}));
      refreshSkillUi(container);
      return;
    }

    var delImage = target.closest(".image-del");
    if (delImage) {
      var state = container.__rpg;
      if (!state) return;
      var index = parseInt(delImage.getAttribute("data-index"), 10);
      if (isNaN(index)) return;
      state.images.splice(index, 1);
      renderImages(container);
    }
  }

  /* ---------------- 图片（只有投稿页可编辑） ---------------- */

  function renderImages(container) {
    var state = container.__rpg;
    var box = container.querySelector("[data-image-list]");
    if (box) box.innerHTML = imageListHtml(state.images);
  }

  function setProgress(container, text) {
    var el = container.querySelector("[data-progress]");
    if (!el) return;
    el.hidden = !text;
    el.textContent = text || "";
  }

  function bindFileInput(container) {
    var input = container.querySelector('[data-images] input[type="file"]');
    if (!input) return;

    input.addEventListener("change", function () {
      var state = container.__rpg;
      var files = Array.prototype.slice.call(input.files || []);
      input.value = "";
      if (!files.length) return;

      var room = MAX_IMAGES - state.images.length;
      if (room <= 0) {
        setProgress(container, "图片已满 9 张，先移除一张再选。");
        return;
      }
      if (files.length > room) {
        files = files.slice(0, room);
        setProgress(container, "最多 9 张，只上传了前 " + files.length + " 张。");
      }

      if (!window.GuiUpload || !window.GuiUpload.isConfigured()) {
        setProgress(container, "云存储未配置，暂时不能上传图片。");
        return;
      }

      state.uploading = true;
      var done = 0;

      function next() {
        if (done >= files.length) {
          state.uploading = false;
          setProgress(container, "");
          return;
        }
        var file = files[done];
        var label = "正在处理第 " + (done + 1) + "/" + files.length + " 张…";
        setProgress(container, label);

        window.GuiUpload.compress(file, function (step) {
          setProgress(container, label + " " + step);
        }).then(function (result) {
          setProgress(container, "正在上传第 " + (done + 1) + "/" + files.length + " 张…");
          return window.GuiUpload.upload(result.blob);
        }).then(function (url) {
          state.images.push(url);
          renderImages(container);
          done += 1;
          next();
        }).catch(function (err) {
          state.uploading = false;
          setProgress(container, "第 " + (done + 1) + " 张失败：" + err.message);
        });
      }

      next();
    });
  }

  /* ---------------- 读取 ---------------- */

  function readForm(container) {
    var state = container.__rpg || { images: [] };
    var get = function (name) {
      var el = container.querySelector('[name="' + name + '"]');
      return el ? el.value : "";
    };

    var skills = [];
    Array.prototype.forEach.call(skillRows(container), function (row) {
      var item = { name: "", condition: "", effect: "", note: "" };
      Array.prototype.forEach.call(row.querySelectorAll("[data-skill]"), function (input) {
        item[input.getAttribute("data-skill")] = input.value;
      });
      if (String(item.name).trim() || String(item.effect).trim()) skills.push(item);
    });

    var out = {
      name: get("name"),
      aliases: window.RpgData ? window.RpgData.parseAliases(get("aliases")) : [],
      occupation: get("occupation"),
      side_job: get("side_job"),
      rating: get("rating"),
      skills: skills,
      images: (state.images || []).slice(),
      author: get("author"),
      note: get("note")
    };
    STAT_KEYS.forEach(function (k) { out[k] = get(k); });
    return out;
  }

  function showProblems(container, problems) {
    var box = container.querySelector("[data-problems]");
    if (!box) return;
    if (!problems || !problems.length) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    box.hidden = false;
    box.innerHTML = "<p>请先处理这几处：</p><ul>" +
      problems.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>";
  }

  /* ---------------- 下拉与对话框 ---------------- */

  function fillMembers(selectEl, placeholder) {
    if (!selectEl) return;
    var members = (window.RpgData && window.RpgData.MEMBERS) || [];
    selectEl.innerHTML = '<option value="">' + esc(placeholder || "请选择") + "</option>" +
      members.map(function (m) {
        return '<option value="' + esc(m) + '">' + esc(m) + "</option>";
      }).join("");
    selectEl.value = "";
  }

  function fillMarks(selectEl) {
    if (!selectEl) return;
    var marks = (window.RpgData && window.RpgData.MARKS) || ["√", "O", "X"];
    selectEl.innerHTML = '<option value="">请选择</option>' +
      marks.map(function (m) {
        return '<option value="' + esc(m) + '">' + esc(m) + "</option>";
      }).join("");
    selectEl.value = "";
  }

  /* 返回 Promise：确认时给 { operator, note }，取消时给 null */
  function dialog(opts) {
    opts = opts || {};
    var wrap = document.createElement("div");

    wrap.innerHTML =
      '<dialog class="rpg-dialog">' +
        '<form method="dialog" class="rpg-dialog-box">' +
          '<h2 class="rpg-dialog-title">' + esc(opts.title || "确认") + "</h2>" +
          (opts.text ? '<p class="rpg-dialog-text">' + esc(opts.text) + "</p>" : "") +
          (opts.needOperator
            ? '<label class="field"><span class="field-label">操作人 <em>必填</em></span>' +
              '<select data-dialog="operator" aria-label="操作人"></select></label>'
            : "") +
          (opts.needNote
            ? '<label class="field"><span class="field-label">备注<span class="field-hint">可留空</span></span>' +
              '<textarea data-dialog="note" rows="3" maxlength="200"></textarea></label>'
            : "") +
          '<div class="rpg-dialog-actions">' +
            '<button type="button" class="btn btn-ghost" data-dialog="cancel">取消</button>' +
            '<button type="button" class="btn' + (opts.danger ? " btn-danger" : "") +
              '" data-dialog="ok">' + esc(opts.confirmText || "确认") + "</button>" +
          "</div>" +
        "</form>" +
      "</dialog>";

    var el = wrap.firstChild;
    document.body.appendChild(el);

    var operatorEl = el.querySelector('[data-dialog="operator"]');
    var noteEl = el.querySelector('[data-dialog="note"]');
    var okBtn = el.querySelector('[data-dialog="ok"]');
    var cancelBtn = el.querySelector('[data-dialog="cancel"]');

    if (operatorEl) fillMembers(operatorEl, "请选择操作人");
    if (okBtn && opts.needOperator) okBtn.disabled = true;
    if (operatorEl) {
      operatorEl.addEventListener("change", function () {
        okBtn.disabled = !operatorEl.value;
      });
    }

    return new Promise(function (resolve) {
      function close(result) {
        if (el.open) el.close();
        if (el.parentNode) el.parentNode.removeChild(el);
        resolve(result);
      }

      okBtn.addEventListener("click", function () {
        if (opts.needOperator && !operatorEl.value) return;
        close({
          operator: operatorEl ? operatorEl.value : "",
          note: noteEl ? noteEl.value.trim() : ""
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

  window.RpgForm = {
    render: renderForm,
    read: readForm,
    showProblems: showProblems,
    fillMembers: fillMembers,
    fillMarks: fillMarks,
    dialog: dialog,
    esc: esc,
    MAX_IMAGES: MAX_IMAGES,
    MAX_SKILLS: MAX_SKILLS
  };
})();
