/* 异常区域档案 · 数据访问层
   数据库是唯一数据源；data/zone-seeds.js 只在云端不可用时兜底。
   拆成 3 个文件按顺序加载：zone-data-admin.js → zone-data-tips.js → zone-data.js，函数都挂在 window.ZoneData 上。 */
(function () {
  "use strict";
  var P = window.ZoneData = window.ZoneData || {};

  P.LOCAL_KEY = "quyu_pending_zones";
  P.TIMEOUT_MS = 6000;

  /* 熔断：云端连不上时 5 分钟内不再重试，避免每次打开页面都卡住 */
  P.BREAK_MS = 5 * 60 * 1000;
  P.downUntil = 0;
  P.isDown = function () { return Date.now() < P.downUntil; }
  P.markDown = function () { P.downUntil = Date.now() + P.BREAK_MS; }

  /* ---------------- 云端配置 ----------------
     envId / publishableKey 来自共享的 GUI_CLOUDBASE（与鬼图鉴同一套），
     但表名必须由本模块的 ZONE_APP 决定：鬼详情页加载的是 guitu/data/config.js，
     那份配置里的 table 是 gui_entries。表名跟着共享配置走会查错表（实测 400）。 */
  P.cfg = function () {
    var c = window.GUI_CLOUDBASE || {};
    if (!c.envId || !c.publishableKey) return null;
    return {
      base: "https://" + String(c.envId).trim() + ".api.tcloudbasegateway.com/v1/rdb/rest/",
      key: String(c.publishableKey).trim(),
      table: (window.ZONE_APP && window.ZONE_APP.table) || "gui_zones"
    };
  }

  P.remoteEnabled = function () { return P.cfg() !== null; }

  /* 取组织验证签发的访问令牌（由 js/gui-gate.js 保存） */
  P.accessToken = function () {
    if (window.GuiGate && typeof window.GuiGate.token === "function") {
      return window.GuiGate.token();
    }
    return "";
  }

  P.headers = function (c, extra) {
    var h = {
      "Authorization": "Bearer " + c.key,
      "Content-Type": "application/json"
    };

    if (extra) for (var k in extra) h[k] = extra[k];

    /* 令牌放进 Prefer 头里传。
       为什么不用自定义头：CloudBase 网关的 CORS 允许头是固定白名单，
       不在名单里的头（比如 x-gui-token）会被浏览器预检拦掉；
       而名单里的 X-Client-Info 之类又会被网关吞掉，到不了数据库。
       只有 Prefer 既在白名单里、又会被转发给 PostgREST，
       而且 PostgREST 会忽略它不认识的指令，所以借它捎带令牌。 */
    var tok = P.accessToken();
    if (tok) {
      h["Prefer"] = (h["Prefer"] ? h["Prefer"] + ", " : "") + "gui-token=" + tok;
    }

    return h;
  }

  /* 判断某个错误是不是「没令牌 / 令牌过期」导致的，
     是的话清掉本地令牌，让用户重新验证一次。 */
  P.isAuthError = function (err) {
    var msg = String((err && (err.body || err.message)) || "");
    return /42501|row-level security|JWT|permission denied/i.test(msg);
  }

  P.withTimeout = function (promise, ms) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        setTimeout(function () { reject(new Error("请求超时")); }, ms);
      })
    ]);
  }

  /* 读请求超时后重试一次。
     为什么需要：从没访问过本站的浏览器第一次连 CloudBase 网关，TLS 握手实测
     要十几秒，会先撞上 6 秒超时；一旦超时就会被当成「云端挂了」，触发 5 分钟
     熔断，首屏只能显示种子数据。第一次请求把连接握热之后重试通常几十毫秒就回来。
     只包读请求——写请求重试可能造成重复提交。 */
  P.retryOnceOnTimeout = function (fn) {
    return fn().catch(function (err) {
      if (!/超时/.test(String(err && err.message))) throw err;
      return fn();
    });
  }

  /* ---------------- 本地 ---------------- */
  P.readLocal = function () {
    try {
      var v = JSON.parse(localStorage.getItem(P.LOCAL_KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (err) { return []; }
  }

  P.writeLocal = function (localList) {
    try { localStorage.setItem(P.LOCAL_KEY, JSON.stringify(localList)); } catch (err) { /* 配额满时忽略 */ }
  }

  P.removeLocal = function (id) {
    P.writeLocal(P.readLocal().filter(function (e) { return e.id !== id; }));
  }

  /* ---------------- 仓库静态文件（兜底） ---------------- */
  P.fetchRepoEntries = function () {
    var file = (window.ZONE_APP && window.ZONE_APP.entriesFile) || "data/zones.json";
    return fetch(file + "?t=" + Date.now(), { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        var repoList = (data && data.entries) || (Array.isArray(data) ? data : []);
        return Array.isArray(repoList) ? repoList : [];
      })
      .catch(function () { return []; });
  }

  /* ============================================================
     条目字段：唯一来源
     ------------------------------------------------------------
     字段名、类型、必填都写在 ZONE_FIELDS 里，表单校验、摘要截断、
     标签解析都从这里取。不要再在别的文件里重复一份字段清单。
     新增一个类似图鉴的模块时，复制这张表就是它的数据模型。
     ============================================================ */
  P.INTRO_MAX = 90;
  P.TAG_MAX = 8;

  P.ZONE_FIELDS = [
    { key: "id", label: "标识", type: "string" },
    { key: "title", label: "区域名", type: "string", required: true },
    { key: "lng", label: "经度", type: "number" },
    { key: "lat", label: "纬度", type: "number" },
    { key: "image", label: "封面图", type: "string" },
    { key: "images", label: "图片", type: "array" },
    { key: "thumbs", label: "缩略图", type: "array" },
    { key: "related", label: "关联条目", type: "array" },
    { key: "refs", label: "引用情报", type: "array" },
    { key: "intro", label: "摘要", type: "string" },
    { key: "body", label: "正文", type: "string", required: true },
    { key: "tags", label: "标签", type: "array" },
    { key: "date", label: "记录日期", type: "string", format: "date" }
  ];

  P.isEmptyValue = function (v) {
    if (v == null) return true;
    if (typeof v === "string") return v.trim() === "";
    if (Array.isArray(v)) return v.length === 0;
    return false;
  }

  /* 校验一条条目，返回人话的问题列表；空数组表示通过。
     只查「必填」和「类型」，不设长度上限——长度上限会挡掉已经存在的内容。
     对象里没有的字段跳过，所以表单可以只传自己管的那几个字段。 */
  P.validateZone = function (entry) {
    var problems = [];
    if (!entry) return problems;
    for (var i = 0; i < P.ZONE_FIELDS.length; i++) {
      var f = P.ZONE_FIELDS[i];
      if (!(f.key in entry)) continue;
      var v = entry[f.key];
      if (f.required && P.isEmptyValue(v)) { problems.push(f.label + "不能为空"); continue; }
      if (v == null) continue;
      if (f.type === "array" && !Array.isArray(v)) problems.push(f.label + "格式不对");
      else if (f.type === "string" && typeof v !== "string") problems.push(f.label + "格式不对");
      else if (f.type === "number" && typeof v !== "number") problems.push(f.label + "要填数字");
      else if (f.format === "date" && v !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        problems.push("日期要写成 YYYY-MM-DD");
      }
    }

    if (Array.isArray(entry.tags)) {
      entry.tags.forEach(function (t) {
        if (String(t).trim().length > P.TAG_MAX) {
          problems.push("标签「" + String(t).trim() + "」超过 " + P.TAG_MAX + " 个字");
        }
      });
    }

    return problems;
  }

  /* 正文压成一行，取前 INTRO_MAX 个字当摘要（列表页不读全文） */
  P.buildIntro = function (body) {
    var flat = String(body == null ? "" : body).replace(/\s+/g, " ");
    return flat.length > P.INTRO_MAX ? flat.slice(0, P.INTRO_MAX) + "…" : flat;
  }

  /* 「甲, 乙，丙」→ ["甲","乙","丙"]；中英文逗号都认 */
  P.parseTags = function (text) {
    return String(text == null ? "" : text)
      .split(/[,，]/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s !== ""; });
  }

  /* ---------------- 云数据库 ---------------- */

  /* 数据库行 → 前端区域对象（列表、详情、检索共用同一套映射） */
  P.mapRow = function (r) {
    return {
      id: r.id, title: r.title,
      lng: P.numOrNull(r.lng), lat: P.numOrNull(r.lat),
      image: r.image, images: r.images || [],
      thumbs: r.thumbs || [],
      related: r.related || [],
      refs: r.refs || [],
      intro: r.intro, body: r.body, tags: r.tags || [], date: r.date,
      deleted: !!r.deleted, updated_at: r.updated_at,
      editor: r.editor || "CPU", edited_at: r.edited_at || null
    };
  }

  /* PostgREST 的 numeric 可能回成字符串，统一转成数字或 null */
  P.numOrNull = function (v) {
    if (v === null || v === undefined || v === "") return null;
    var n = Number(v);
    return isNaN(n) ? null : n;
  }

  P.mapRows = function (rows) {
    return (Array.isArray(rows) ? rows : []).map(P.mapRow);
  }

  P.fetchCloud = function (c) {
    /* 正常情况：只取未删除的条目。
       如果数据库还没执行 version-setup.sql（没有 deleted 字段），
       自动退回「不带过滤」的老查询，保证公开图鉴页不会因此报错。 */
    var baseUrl = c.base + c.table + "?select=*";
    var withFilter = baseUrl + "&deleted=eq.false&order=created_at.desc&limit=1000";
    var withoutFilter = baseUrl + "&order=created_at.desc&limit=1000";

    function attempt(url) {
      return P.withTimeout(
        fetch(url, { headers: P.headers(c) }).then(function (res) {
          if (!res.ok) {
            return res.text().then(function (t) {
              var err = new Error("云端返回 " + res.status + " " + t.slice(0, 160));
              err.status = res.status;
              err.body = t;
              throw err;
            });
          }
          return res.json();
        }),
        P.TIMEOUT_MS
      );
    }

    return attempt(withFilter).catch(function (err) {
      /* 缺字段（400 + PGRST204/42703）时降级重试一次 */
      if (err.status === 400 && /deleted|PGRST204|42703/.test(err.body || err.message || "")) {
        return attempt(withoutFilter);
      }
      throw err;
    }).then(P.mapRows);
  }

  /* ---------------- 合并 ---------------- */
  P.merge = function () {
    var out = [], index = {};
    for (var i = 0; i < arguments.length; i++) {
      var arr = arguments[i] || [];
      for (var j = 0; j < arr.length; j++) {
        var e = arr[j];
        if (!e || !e.id) continue;
        if (index[e.id] === undefined) { index[e.id] = out.length; out.push(e); }
        else { out[index[e.id]] = e; }
      }
    }
    return out;
  }

  /* ---------------- 对外：读 ---------------- */
  P.list = function () {
    var c = P.cfg();

    /* 云端不可用时的兜底：代码里的种子条目 + 仓库文件 + 本机未同步条目。
       只在这条路径上才会用到代码内嵌的数据。 */
    function fallback() {
      return P.fetchRepoEntries().then(function (repo) {
        return P.merge(window.ZONE_SEED_ZONES || [], repo, P.readLocal());
      });
    }

    /* 没配置云端，或者刚失败过（5 分钟冷却）：直接走兜底 */
    if (!c || P.isDown()) return fallback();

    /* 数据库是唯一数据源。
       读成功就只用数据库内容，不再合并 data/gui-entries.js 里的种子，
       否则种子和数据库里的同名条目会重复显示。 */
    return P.retryOnceOnTimeout(function () {
      return P.fetchCloud(c);
    }).then(function (rows) {
      return P.merge(rows, P.readLocal());
    }).catch(function (err) {
      P.markDown();
      console.warn("[异常区域档案] 云端读取失败，改用种子数据兜底（5 分钟内不再重试）：", err.message);
      return fallback();
    });
  }

  /* ============================================================
     分页检索
     ------------------------------------------------------------
     列表页不再整表拉下来在浏览器里 filter，改成让数据库分页：
       ?deleted=eq.false&or=(title.ilike.*词*,intro.ilike.*词*,body.ilike.*词*)
       &order=created_at.desc,id.desc&limit=12&offset=0
     总数靠 Prefer: count=exact，从响应的 Content-Range（0-11/57）尾段取。
     ============================================================ */

  P.PAGE_SIZE = 12;

  /* 关键词会拼进 PostgREST 的 or=(...) 表达式，
     逗号、括号、星号是表达式语法字符，实测出现即 400，先在客户端剔掉。 */
  P.safeKeyword = function (q) {
    return String(q == null ? "" : q)
      .replace(/[,()*%"\\{}\u0000-\u001f]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /* Content-Range: 0-11/57 → 57；取不到就返回 -1 由调用方兜底 */
  P.parseTotal = function (res) {
    var cr = res.headers && typeof res.headers.get === "function" ? res.headers.get("Content-Range") : "";
    var m = /\/(\d+)\s*$/.exec(cr || "");
    return m ? parseInt(m[1], 10) : -1;
  }


  /* 兜底用的全量本地列表：种子 + 仓库文件 + 本机未同步 */


  /* 分页检索。返回 { items, total, cloud } */

  /* 按 id 取单条，**包含已删除的**。编辑区编辑/恢复被删除的区域时要用，
     否则 getEntry 会把它当成不存在。 */

  /* 按 id 取单条。详情页原先走 list() 全表拉取，换成这个。 */

  /* ---------------- 对外：新增 ---------------- */
  /* ============================================================
     编辑 / 版本相关（需要数据库执行过 version-setup.sql）
     ============================================================ */

  /* ------------------------------------------------------------
     通用写入：先按原样发；如果数据库缺某个字段（PGRST204 / 42703），
     自动把那个字段去掉再重试，最多重试 3 次。
     这样在「缩略图字段还没迁移」的阶段，保存也不会失败。
     ------------------------------------------------------------ */
  /* 把条目内容整理成一行记录（版本表和条目表共用这些字段） */

  /* 读全部条目（含已删除的），编辑界面和旧图鉴用 */

  /* 把一条条目的当前内容存进版本表 */

  /* 读所有版本（旧图鉴列表用） */

  /* 把一个版本标记为「已应用」——它已经变成当前内容，不该再出现在旧图鉴里。
     只写 applied 一个字段（数据库的列级授权也只允许改这一列）。 */

  /* 读某个区域的全部版本（旧区域页用）；包含已应用过的 */

  /* 按 version_id 取单个版本 */

  /* 改一个已有条目（PATCH），返回 Promise<void> */

  /* 软删除：只把 deleted 置为 true，数据库里不删行 */

  /* 恢复：把某条目重新设为可见，并写入指定的内容（不传则用它的最新版本） */

  /* 新增一个条目（编辑界面用，走和 add 相同的逻辑但不写本地缓冲） */

  /* ============================================================
     投稿 —— 独立的 gui_zone_tips 表
     ------------------------------------------------------------
     和图鉴彻底分开：图鉴的查询永远不碰这张表，反之亦然。
     投稿不需要组织验证（开放），所以这里不带令牌也能写。
     ============================================================ */

  P.TIPS_TABLE = "gui_zone_tips";


  /* 读取投稿。
     opts.pendingOnly = true → 只取未被采纳的（引用投稿界面用）。
     读取是公开的，不需要令牌。 */

  /* 标记一条投稿已被采纳为某个区域。需要组织验证令牌，没有会被 RLS 挡掉。
     先 PATCH（return=minimal），再读回来比对，避免「RLS 静默影响 0 行」被当成成功。 */

  /* 查重：拿标题去数据库比相似度，返回 [{kind,id,title,score}]。
     查重只是提示，失败一律返回空数组，不阻塞提交。 */

  /* 提交一条投稿 */

  window.ZoneData = {
    /* 读 */
    list: P.list,                     /* 公开列表：只含未删除的（地图页用） */
    search: P.search,                 /* 分页 + 检索：{ q, page, pageSize } */
    getEntry: P.getEntry,             /* 按 id 取单条 */
    getEntryAny: P.getEntryAny,       /* 按 id 取单条，含已删除的 */
    PAGE_SIZE: P.PAGE_SIZE,
    listAll: P.listAll,               /* 全部区域：含已删除的 */
    listVersions: P.listVersions,     /* 所有历史版本 */
    listVersionsForZone: P.listVersionsForZone, /* 某个区域的版本 */
    getVersion: P.getVersion,         /* 单个版本 */

    /* 写 */
    add: P.add,                       /* 新增（带本地缓冲，增加区域页用） */
    insertEntry: P.insertEntry,       /* 新增（编辑界面用） */
    updateEntry: P.updateEntry,       /* 修改 */
    softDelete: P.softDelete,         /* 软删除：只标记不删行 */
    restoreEntry: P.restoreEntry,     /* 恢复 */
    archiveVersion: P.archiveVersion, /* 归档旧版本 */
    markVersionApplied: P.markVersionApplied, /* 标记版本已应用（从旧档案隐藏） */

    /* 投稿 */
    listTips: P.listTips,
    addTip: P.addTip,
    markTipAdopted: P.markTipAdopted, /* 引用投稿并标记已采纳，需令牌 */
    dupCheck: P.dupCheck,             /* 投稿前查重（标题相似度） */

    /* 工具 */
    newId: P.newId,
    remoteEnabled: P.remoteEnabled,
    readLocal: P.readLocal,

    /* 区域字段的单一来源（表单、校验、检索都从这里取） */
    ZONE_FIELDS: P.ZONE_FIELDS,
    TAG_MAX: P.TAG_MAX,
    INTRO_MAX: P.INTRO_MAX,
    validateZone: P.validateZone,
    buildIntro: P.buildIntro,
    parseTags: P.parseTags
  };
})();
