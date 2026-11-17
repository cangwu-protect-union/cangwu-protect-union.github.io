/* 回合制正传 6.0 · 数据访问层 · 写入/版本/投稿分片
   只往 window.RpgData 挂函数，在 rpg-data.js 之前加载。 */
(function () {
  "use strict";
  var P = window.RpgData || (window.RpgData = {});


  P.findCharacterBySubmission = function (submissionId) {
    var c = P.cfg();
    if (!c || !submissionId) return Promise.resolve(null);
    return P.get(c, c.characters + "?select=*&source_submission_id=eq." +
      encodeURIComponent(submissionId) + "&limit=1")
      .then(function (rows) {
        var row = (Array.isArray(rows) ? rows : [])[0];
        return row ? P.mapCharacter(row) : null;
      })
      .catch(function () { return null; });
  }

  P.nextSeq = function () {
    var c = P.cfg();
    var seedMax = (window.RPG_SEED_CHARACTERS || []).reduce(function (max, x) {
      return Math.max(max, parseInt(x.seq, 10) || 0);
    }, 0);

    if (!c || P.isDown()) return Promise.resolve(seedMax + 1);

    return P.get(c, c.characters + "?select=seq&order=seq.desc&limit=1")
      .then(function (rows) {
        var row = (Array.isArray(rows) ? rows : [])[0];
        var max = row ? parseInt(row.seq, 10) || 0 : 0;
        return Math.max(max, seedMax) + 1;
      })
      .catch(function () { return seedMax + 1; });
  }

  P.listVersions = function () {
    var c = P.cfg();
    if (!c || P.isDown()) return Promise.resolve([]);

    return P.retryOnceOnTimeout(function () {
      return P.get(c, c.versions + "?select=*&applied=eq.false&order=archived_at.desc&limit=2000");
    }).then(function (rows) {
      return (Array.isArray(rows) ? rows : []).map(P.mapVersion);
    }).catch(function (err) {
      P.markDown();
      console.warn("[角色档案] 读取旧档案失败：", err.message);
      return [];
    });
  }

  P.listVersionsOf = function (characterId) {
    var c = P.cfg();
    if (!c || !characterId || P.isDown()) return Promise.resolve([]);

    return P.retryOnceOnTimeout(function () {
      return P.get(c, c.versions + "?select=*&character_id=eq." +
        encodeURIComponent(characterId) + "&order=archived_at.desc&limit=2000");
    }).then(function (rows) {
      return (Array.isArray(rows) ? rows : []).map(P.mapVersion);
    }).catch(function (err) {
      P.markDown();
      console.warn("[角色档案] 读取版本失败：", err.message);
      return [];
    });
  }

  P.getVersion = function (versionId) {
    var c = P.cfg();
    if (!c || !versionId || P.isDown()) return Promise.resolve(null);

    return P.get(c, c.versions + "?select=*&version_id=eq." +
      encodeURIComponent(versionId) + "&limit=1")
      .then(function (rows) {
        var row = (Array.isArray(rows) ? rows : [])[0];
        return row ? P.mapVersion(row) : null;
      })
      .catch(function () { return null; });
  }

  P.listSubmissions = function (statuses) {
    var c = P.cfg();
    if (!c || P.isDown()) return Promise.resolve([]);

    var url = c.submissions + "?select=*&order=created_at.desc&limit=1000";
    if (statuses && statuses.length) {
      url += "&status=in.(" + statuses.map(encodeURIComponent).join(",") + ")";
    }

    return P.retryOnceOnTimeout(function () {
      return P.get(c, url);
    }).then(function (rows) {
      return (Array.isArray(rows) ? rows : []).map(P.mapSubmission);
    }).catch(function (err) {
      P.markDown();
      console.warn("[角色档案] 读取投稿失败：", err.message);
      return [];
    });
  }

  P.getSubmission = function (id) {
    var c = P.cfg();
    if (!c || !id || P.isDown()) return Promise.resolve(null);

    return P.get(c, c.submissions + "?select=*&id=eq." + encodeURIComponent(id) + "&limit=1")
      .then(function (rows) {
        var row = (Array.isArray(rows) ? rows : [])[0];
        return row ? P.mapSubmission(row) : null;
      })
      .catch(function (err) {
        P.markDown();
        throw err;
      });
  }

  P.addSubmission = function (payload) {
    var c = P.cfg();
    if (!c) return Promise.reject(new Error("云服务未配置，暂时无法提交。"));

    var row = P.toRow(payload);
    row.id = P.newId("s");
    row.status = "pending";
    row.author = P.trim(payload.author);
    row.note = P.trim(payload.note);
    row.created_at = P.nowIso();

    return P.send(c, c.rest + c.submissions, "POST", row).then(function () {
      return { id: row.id };
    });
  }

  P.rejectSubmission = function (id, reviewer, note) {
    var c = P.cfg();
    if (!c) return Promise.reject(new Error("云服务未配置"));
    if (!P.accessToken()) return Promise.reject(new Error("需要先通过组织验证"));

    var row = {
      status: "rejected",
      reviewer: reviewer,
      reviewed_at: P.nowIso(),
      review_note: P.trim(note)
    };
    return P.send(c, c.rest + c.submissions + "?id=eq." + encodeURIComponent(id), "PATCH", row)
      .then(function () {
        return P.logEdit({
          module: "rpg6.0", targetType: "submission", targetId: id,
          targetTitle: "", action: "review", member: reviewer, note: P.trim(note)
        });
      });
  }

  P.approveSubmission = function (submissionId, payload, reviewer, mark, note) {
    var c = P.cfg();
    if (!c) return Promise.reject(new Error("云服务未配置"));
    if (!P.accessToken()) return Promise.reject(new Error("需要先通过组织验证"));

    var characterId = "";

    return P.getSubmission(submissionId).then(function (sub) {
      if (!sub) throw new Error("投稿不存在，或当前身份无权读取。");
      if (sub.status !== "pending") {
        throw new Error("这条投稿已处理（" + (P.STATUS_TEXT[sub.status] || sub.status) + "）。");
      }
      return P.findCharacterBySubmission(submissionId);
    }).then(function (existing) {
      if (existing) {
        characterId = existing.id;
        return null;
      }
      return P.nextSeq().then(function (seq) {
        var row = P.toRow(payload);
        row.id = P.newId("rp");
        row.seq = seq;
        row.reviewer = reviewer;
        row.review_mark = mark;
        row.reviewed_at = P.nowIso();
        row.review_note = P.trim(note);
        row.source_submission_id = submissionId;
        row.created_at = P.nowIso();
        row.editor = reviewer;
        row.edited_at = row.created_at;
        row.updated_at = row.created_at;
        characterId = row.id;

        var patch = {
          status: "approved",
          reviewer: reviewer,
          reviewed_at: row.reviewed_at,
          review_note: P.trim(note),
          approved_character_id: row.id
        };

        return P.send(c, c.rest + c.characters, "POST", row).then(function () {
          return P.send(c, c.rest + c.submissions + "?id=eq." + encodeURIComponent(submissionId), "PATCH", patch)
            .then(function () { return { id: row.id, reused: false }; })
            .catch(function (err) {
              err.partial = true;
              err.characterId = row.id;
              throw err;
            });
        });
      });
    }).then(function (result) {
      if (result) return result;

      var patch = {
        status: "approved",
        reviewer: reviewer,
        reviewed_at: P.nowIso(),
        review_note: P.trim(note),
        approved_character_id: characterId
      };
      return P.send(c, c.rest + c.submissions + "?id=eq." + encodeURIComponent(submissionId), "PATCH", patch)
        .then(function () { return { id: characterId, reused: true }; });
    }).then(function (result) {
      return P.logEdit({
        module: "rpg6.0", targetType: "character", targetId: result.id,
        targetTitle: P.trim(payload.name), action: "review", member: reviewer, note: P.trim(note)
      }).then(function () { return result; });
    });
  }

  P.updateCharacter = function (id, payload, operator) {
    var c = P.cfg();
    if (!c) return Promise.reject(new Error("云服务未配置"));
    if (!P.accessToken()) return Promise.reject(new Error("需要先通过组织验证"));
    if (!operator) return Promise.reject(new Error("请选择保存人"));

    var row = P.toRow(payload);
    row.editor = operator;
    row.edited_at = P.nowIso();
    row.updated_at = row.edited_at;

    return P.send(c, c.rest + c.characters + "?id=eq." + encodeURIComponent(id), "PATCH", row)
      .then(function () {
        return P.logEdit({
          module: "rpg6.0", targetType: "character", targetId: id,
          targetTitle: P.trim(payload.name), action: "update", member: operator
        });
      });
  }

  P.softDelete = function (id, operator) {
    var c = P.cfg();
    if (!c) return Promise.reject(new Error("云服务未配置"));
    if (!P.accessToken()) return Promise.reject(new Error("需要先通过组织验证"));

    var row = {
      deleted: true,
      deleter: operator || "",
      deleted_at: P.nowIso(),
      updated_at: P.nowIso()
    };
    return P.send(c, c.rest + c.characters + "?id=eq." + encodeURIComponent(id), "PATCH", row)
      .then(function () {
        return P.logEdit({
          module: "rpg6.0", targetType: "character", targetId: id,
          targetTitle: "", action: "delete", member: operator || ""
        });
      });
  }

  P.restoreCharacter = function (id, content, operator) {
    var c = P.cfg();
    if (!c) return Promise.reject(new Error("云服务未配置"));
    if (!P.accessToken()) return Promise.reject(new Error("需要先通过组织验证"));

    var row = P.toRow(content);
    row.deleted = false;
    row.editor = operator || "";
    row.edited_at = P.nowIso();
    row.updated_at = row.edited_at;

    return P.send(c, c.rest + c.characters + "?id=eq." + encodeURIComponent(id), "PATCH", row)
      .then(function () {
        return P.logEdit({
          module: "rpg6.0", targetType: "character", targetId: id,
          targetTitle: P.trim(content && content.name), action: "restore", member: operator || ""
        });
      });
  }

  P.archiveVersion = function (character, reason) {
    var c = P.cfg();
    if (!c) return Promise.reject(new Error("云服务未配置"));

    var row = P.toRow(character);
    row.version_id = P.newId("v");
    row.character_id = character.id;
    row.reason = reason === "delete" ? "delete" : "edit";
    row.applied = false;
    row.archived_at = P.nowIso();

    return P.send(c, c.rest + c.versions, "POST", row).then(function () {
      return row.version_id;
    });
  }

  P.markVersionApplied = function (versionId) {
    var c = P.cfg();
    if (!c) return Promise.reject(new Error("云服务未配置"));
    return P.send(c, c.rest + c.versions + "?version_id=eq." + encodeURIComponent(versionId),
      "PATCH", { applied: true });
  }

  P.parseAliases = function (text) {
    var seen = {};
    return P.trim(text).split(/[,，]/).map(function (s) { return s.trim(); })
      .filter(function (s) {
        if (!s || seen[s]) return false;
        seen[s] = 1;
        return true;
      })
      .slice(0, 8);
  }

  P.parseStatLine = function (text) {
    var parts = String(text == null ? "" : text).split("/");
    var out = {};
    P.STAT_KEYS.forEach(function (k, i) {
      out[k] = P.trim(parts[i]);
    });
    return out;
  }

  P.emptyCharacter = function () {
    var obj = {
      name: "", aliases: [], occupation: "", side_job: "", rating: "", gender: "",
      review_mark: "", images: [], skills: [], author: "", note: ""
    };
    P.STAT_KEYS.forEach(function (k) { obj[k] = ""; });
    for (var i = 0; i < 3; i++) {
      obj.skills.push({ name: "", condition: "", effect: "", note: "" });
    }
    return obj;
  }

  P.validateCharacter = function (obj, opts) {
    opts = opts || {};
    var problems = [];

    if (!P.trim(obj.name)) problems.push("角色名称不能为空");
    else if (P.trim(obj.name).length > 40) problems.push("角色名称超过 40 字");

    if (P.asArray(obj.aliases).length > 8) problems.push("别名最多 8 个");
    P.asArray(obj.aliases).forEach(function (a) {
      if (P.trim(a).length > 12) problems.push("别名「" + P.trim(a) + "」超过 12 字");
    });

    if (!P.trim(obj.occupation)) problems.push("主职业不能为空");
    else if (P.trim(obj.occupation).length > 20) problems.push("主职业超过 20 字");
    if (P.trim(obj.side_job).length > 20) problems.push("副业超过 20 字");
    if (P.trim(obj.rating).length > 8) problems.push("强度评级超过 8 字");
    if (P.trim(obj.gender) && P.trim(obj.gender) !== "男" && P.trim(obj.gender) !== "女") {
      problems.push("性别只能填男或女");
    }

    P.STAT_KEYS.forEach(function (k) {
      if (P.trim(obj[k]).length > 40) problems.push(P.STAT_LABELS[k] + "超过 40 字");
    });

    var skills = P.asArray(obj.skills);
    var filled = skills.filter(function (s) {
      return P.trim(s.name) || P.trim(s.effect);
    });
    if (!filled.length) problems.push("至少要写一个技能");
    if (skills.length > 12) problems.push("技能最多 12 条");
    skills.forEach(function (s, i) {
      var n = i + 1;
      if (P.trim(s.name).length > 40) problems.push("技能 " + n + " 名称超过 40 字");
      if (P.trim(s.condition).length > 40) problems.push("技能 " + n + " 释放条件超过 40 字");
      if (P.trim(s.effect).length > 400) problems.push("技能 " + n + " 效果超过 400 字");
      if (P.trim(s.note).length > 200) problems.push("技能 " + n + " 备注超过 200 字");
    });

    if (P.asArray(obj.images).length > 9) problems.push("图片最多 9 张");
    if (P.trim(obj.author).length > 30) problems.push("署名超过 30 字");
    if (P.trim(obj.note).length > 500) problems.push("备注超过 500 字");
    if (P.trim(obj.review_note).length > 200) problems.push("审核备注超过 200 字");

    if (opts.requireReview) {
      if (!P.trim(obj.reviewer)) problems.push("请选择审核人");
      if (!P.trim(obj.review_mark)) problems.push("请选择审核评价");
    }
    if (opts.requireOperator && !P.trim(obj.operator)) {
      problems.push("请选择保存人");
    }

    return problems;
  }
})();
