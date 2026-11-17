/* 回合制正传 6.0 · 数据访问层 · 战报分片
   只往 window.RpgData 挂函数，在 rpg-data.js 之前加载。 */
(function () {
  "use strict";
  var P = window.RpgData || (window.RpgData = {});


  P.mapBattle = function (r) {
    if (!r) return null;
    return {
      id: r.id || "",
      engine_version: r.engine_version || "",
      seed: Number(r.seed) || 0,
      character_a: r.character_a || "",
      character_b: r.character_b || "",
      name_a: r.name_a || "",
      name_b: r.name_b || "",
      actions: Array.isArray(r.actions) ? r.actions : [],
      result: r.result || "unfinished",
      steps: Number(r.steps) || 0,
      rounds: Number(r.rounds) || 0,
      final_hash: r.final_hash || "",
      created_at: r.created_at || null
    };
  }

  P.listBattles = function (opts) {
    var c = P.cfg();
    if (!c) return Promise.resolve([]);
    var limit = Math.min(Math.max(Number(opts && opts.limit) || 20, 1), 50);
    var offset = Math.max(Number(opts && opts.offset) || 0, 0);
    var path = c.battles +
      "?select=id,engine_version,seed,character_a,character_b,name_a,name_b,result,steps,rounds,created_at" +
      "&order=created_at.desc&limit=" + limit + "&offset=" + offset;

    /* 任意一方是该角色即命中；两侧都要比值，所以用 or 而不是 eq */
    var who = P.trim(opts && opts.character);
    if (who) {
      path += "&or=(character_a.eq." + encodeURIComponent(who) +
        ",character_b.eq." + encodeURIComponent(who) + ")";
    }

    return P.get(c, path).then(function (rows) {
      return (Array.isArray(rows) ? rows : []).map(P.mapBattle);
    }).catch(function (err) {
      console.warn("[战报] 列表读取失败：", err.message);
      throw err;
    });
  }

  P.getBattle = function (id) {
    if (!id) return Promise.resolve(null);
    var c = P.cfg();
    if (!c) return Promise.resolve(null);
    return P.get(c, c.battles + "?select=*&id=eq." + encodeURIComponent(id) + "&limit=1")
      .then(function (rows) {
        var row = (Array.isArray(rows) ? rows : [])[0];
        return row ? P.mapBattle(row) : null;
      })
      .catch(function (err) {
        console.warn("[战报] 读取失败：", err.message);
        return null;
      });
  }

  P.createBattle = function (record) {
    var c = P.cfg();
    if (!c) return Promise.reject(new Error("云服务未配置，战报无法保存。"));

    var row = {
      id: P.trim(record.id) || P.newId("b"),
      engine_version: P.trim(record.engine_version),
      seed: Math.abs(Number(record.seed) || 0),
      character_a: P.trim(record.character_a),
      character_b: P.trim(record.character_b),
      name_a: P.trim(record.name_a),
      name_b: P.trim(record.name_b),
      actions: Array.isArray(record.actions) ? record.actions : [],
      result: P.trim(record.result) || "unfinished",
      steps: Number(record.steps) || 0,
      rounds: Number(record.rounds) || 0,
      final_hash: P.trim(record.final_hash)
    };

    return P.send(c, c.rest + c.battles, "POST", row).then(function () {
      return { id: row.id };
    });
  }

  P.purgeBattles = function () {
    var c = P.cfg();
    if (!c) return Promise.resolve(0);
    return P.withTimeout(
      fetch(c.rest + "rpc/rpg_battles_purge", {
        method: "POST",
        headers: P.headers(c),
        body: "{}"
      }),
      P.TIMEOUT_MS
    ).then(P.readJson).then(function (n) {
      return Number(n) || 0;
    }).catch(function (err) {
      console.warn("[战报] 旧战报清理失败：", err.message);
      return 0;
    });
  }
})();
