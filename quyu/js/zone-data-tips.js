/* 异常区域档案 · 数据访问层 · 投稿分片
   只往 window.ZoneData 挂函数，在 zone-data.js 之前加载。 */
(function () {
  "use strict";
  var P = window.ZoneData || (window.ZoneData = {});


  P.mapTip = function (r) {
    return {
      id: r.id,
      title: r.title,
      lng: P.numOrNull(r.lng),
      lat: P.numOrNull(r.lat),
      image: r.image,
      images: r.images || [],
      thumbs: r.thumbs || [],
      intro: r.intro,
      body: r.body,
      tags: r.tags || [],
      date: r.date,
      created_at: r.created_at,
      adopted: !!r.adopted,
      adopted_zone_id: r.adopted_zone_id || ""
    };
  }

  P.listTips = function (opts) {
    var c = P.cfg();
    if (!c) return Promise.resolve([]);

    var url = c.base + P.TIPS_TABLE + "?select=*&order=created_at.desc&limit=1000";
    if (opts && opts.pendingOnly) url += "&adopted=eq.false";

    return P.retryOnceOnTimeout(function () {
      return P.withTimeout(fetch(url, { headers: P.headers(c) }), P.TIMEOUT_MS);
    })
      .then(function (res) {
        if (!res.ok) {
          return res.text().then(function (txt) {
            throw new Error("读取投稿失败 HTTP " + res.status + " " + txt.slice(0, 140));
          });
        }
        return res.json();
      })
      .then(function (rows) { return (rows || []).map(P.mapTip); });
  }

  P.markTipAdopted = function (tipId, zoneId) {
    var c = P.cfg();
    if (!c) return Promise.reject(new Error("云服务未配置"));
    if (!P.accessToken()) return Promise.reject(new Error("需要先通过组织验证"));

    var url = c.base + P.TIPS_TABLE + "?id=eq." + encodeURIComponent(tipId);
    var row = { adopted: true, adopted_zone_id: zoneId || "" };

    return P.withTimeout(
      fetch(url, {
        method: "PATCH",
        headers: P.headers(c, { "Prefer": "return=minimal" }),
        body: JSON.stringify(row)
      }),
      P.TIMEOUT_MS
    ).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (txt) {
          var err = new Error("标记采纳失败 HTTP " + res.status + " " + txt.slice(0, 140));
          err.status = res.status;
          err.body = txt;
          throw err;
        });
      }
      return P.withTimeout(
        fetch(url + "&select=*&limit=1", { headers: P.headers(c) }),
        P.TIMEOUT_MS
      );
    }).then(function (res) {
      if (!res.ok) throw new Error("采纳后校验失败 HTTP " + res.status);
      return res.json();
    }).then(function (rows) {
      var got = (Array.isArray(rows) ? rows : [])[0];
      if (!got) throw new Error("没有权限修改这条投稿，或它已不存在。");
      if (!got.adopted) throw new Error("状态没改成，可能是验证已失效。");
      return P.mapTip(got);
    });
  }

  P.dupCheck = function (title) {
    var c = P.cfg();
    if (!c) return Promise.resolve([]);

    return P.withTimeout(
      fetch(c.base + "rpc/gui_dup_check", {
        method: "POST",
        headers: P.headers(c),
        body: JSON.stringify({ p_text: String(title || "") })
      }),
      P.TIMEOUT_MS
    ).then(function (res) {
      if (!res.ok) throw new Error("查重失败 HTTP " + res.status);
      return res.json();
    }).then(function (data) {
      return Array.isArray(data) ? data : [];
    }).catch(function (err) {
      console.warn("[异常区域档案] 查重失败，跳过：", err.message);
      return [];
    });
  }

  P.addTip = function (tip) {
    var c = P.cfg();
    if (!c) return Promise.reject(new Error("云服务未配置"));

    var row = {
      id: tip.id,
      title: tip.title,
      lng: tip.lng == null || tip.lng === "" ? null : Number(tip.lng),
      lat: tip.lat == null || tip.lat === "" ? null : Number(tip.lat),
      image: tip.image || "",
      images: tip.images || [],
      thumbs: tip.thumbs || [],
      intro: tip.intro || "",
      body: tip.body,
      tags: tip.tags || [],
      date: tip.date || ""
    };
    return P.sendWithColumnFallback(c.base + P.TIPS_TABLE, "POST", row, c);
  }
})();
