/* 回合制正传 6.0 · 对局页 · 远程联机
   建房 / 加入 / 座位存储 / 轮询 / 刷新恢复 / 进入对局 / 动作提交与远端应用 / 结算。 */
(function (root) {
  "use strict";

  var P = root.RPG6BattlePage || (root.RPG6BattlePage = {});
  var R = root.RPG6Remote = root.RPG6Remote || {};
  var B = root.RPG6B;

  var SEATS_KEY = "rpg6-room-seats";
  var NICK_KEY = "rpg6-nick";
  var MAX_SEATS = 8;
  var POLL_MS = 2000;
  var HIDDEN_MS = 10000;
  var BACKOFF_MAX = 15000;
  var OFFLINE_MS = 30000;
  var PAGE_LIMIT = 500;
  var MAX_PAGES = 4;

  var ERRORS = {
    not_found: "没有这个房间（或已过期）",
    full: "房间已有两名玩家",
    bad_key: "本机保存的房间凭证已失效，请重新加入",
    version: "双方页面版本不一致，请刷新",
    abandoned: "房间已关闭",
    finished: "房间已结束",
    bad_input: "输入不合法",
    too_many: "对局步数过多，无法恢复"
  };

  R.code = "";
  R.side = "";
  R.seatKey = "";
  R.room = null;
  R.seq = 0;
  R.entered = false;
  R.active = false;
  R.busy = false;
  R.failCount = 0;
  R.halted = false;
  R.statusText = "";
  R.timer = null;
  R.inflight = false;
  R.gen = 0;
  R.pending = false;
  R.locked = false;
  R.lastTag = "";
  R.again = false;

  function $(sel) {
    return P.$ ? P.$("" + sel) : root.document.querySelector(sel);
  }

  function esc(text) {
    return P.esc ? P.esc(text) : String(text == null ? "" : text);
  }

  function setText(node, text) {
    if (node) node.innerHTML = esc(text);
  }

  /* ---------------- 座位与昵称 ---------------- */

  function readSeats() {
    try {
      var list = JSON.parse(root.localStorage.getItem(SEATS_KEY) || "[]");
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return [];
    }
  }

  function writeSeats(list) {
    try {
      root.localStorage.setItem(SEATS_KEY, JSON.stringify(list.slice(-MAX_SEATS)));
    } catch (err) {
      /* 存不下就算了，刷新恢复会失效，不影响当前对局 */
    }
  }

  function saveSeat(seat) {
    var list = readSeats().filter(function (item) { return item.code !== seat.code; });
    list.push(seat);
    list.sort(function (x, y) { return (x.at || 0) - (y.at || 0); });
    writeSeats(list);
  }

  function findSeat(code) {
    var list = readSeats();
    for (var i = 0; i < list.length; i++) {
      if (list[i].code === code) return list[i];
    }
    return null;
  }

  function dropSeat(code) {
    writeSeats(readSeats().filter(function (item) { return item.code !== code; }));
  }

  function readNick() {
    try { return root.localStorage.getItem(NICK_KEY) || ""; } catch (err) { return ""; }
  }

  function writeNick(nick) {
    try { root.localStorage.setItem(NICK_KEY, nick); } catch (err) { /* ignore */ }
  }

  /* ---------------- 小工具 ---------------- */

  function engineVersion() {
    return (root.RPG_APP && root.RPG_APP.engineVersion) || "";
  }

  function roomsApi() {
    return root.RpgData && typeof root.RpgData.createRoom === "function" ? root.RpgData : null;
  }

  function newSeatKey() {
    var bytes = [];
    var cryptoObj = root.crypto;
    if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
      var buf = new Uint8Array(16);
      cryptoObj.getRandomValues(buf);
      for (var i = 0; i < buf.length; i++) bytes.push(buf[i]);
    } else {
      for (var j = 0; j < 16; j++) bytes.push(Math.floor(Math.random() * 256));
    }
    return bytes.map(function (n) { return (n < 16 ? "0" : "") + n.toString(16); }).join("");
  }

  function normCode(value) {
    return String(value == null ? "" : value).toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  function roomLink(code) {
    return root.location.origin + root.location.pathname + "?room=" + code;
  }

  function setRoomUrl(code) {
    try {
      var url = new root.URL(root.location.href);
      if (code) url.searchParams.set("room", code);
      else url.searchParams.delete("room");
      root.history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch (err) {
      /* 老浏览器没有 URL/history 就算了，只是刷新不能自动恢复 */
    }
  }

  /* ---------------- 界面 ---------------- */

  function note(text) {
    setText($("[data-room-note]"), text);
  }

  function openBox() {
    var box = $("[data-room-box]");
    if (box && typeof box.open === "boolean") box.open = true;
  }

  function setWait(on, code) {
    var box = $("[data-room-wait]");
    if (box) box.hidden = !on;
    var form = $(".room-form");
    if (form) form.hidden = !!on;
    if (!on) {
      setText($("[data-room-wait-note]"), "");
      return;
    }
    var link = $("[data-room-link]");
    if (link) link.value = roomLink(code || R.code);
    setText($("[data-room-wait-note]"), "等待对手加入…");
  }

  function disableStart(on) {
    if (P.dom && P.dom.start) P.dom.start.disabled = !!on;
  }

  function currentSide() {
    if (!P.state || !P.state.turnUid || !B) return "";
    try {
      return B.state.sideOf(P.state, P.state.turnUid);
    } catch (err) {
      return "";
    }
  }

  function opponentNick(room) {
    if (!room) return "";
    return R.side === "a" ? room.nickB : room.nickA;
  }

  function isOffline(room) {
    var seen = R.side === "a" ? room.seenB : room.seenA;
    if (!seen) return false;
    var when = Date.parse(seen);
    if (!isFinite(when)) return false;
    return Date.now() - when > OFFLINE_MS;
  }

  function playingStatus(room) {
    if (isOffline(room)) return "对手离线";
    var side = currentSide();
    if (!side) return "已进入房间";
    if (side === R.side) return "轮到你";
    return "等 " + (opponentNick(room) || "对手") + " 行动";
  }

  function statusText() {
    if (R.halted && R.statusText) return R.statusText;
    if (R.pending) return "提交中…";
    if (R.failCount > 0) return "同步中断，重试中";
    var room = R.room;
    if (!room) return "";
    if (room.status === "waiting") return "等待对手加入…";
    if (room.status === "finished") return "房间已结束";
    if (room.status === "abandoned") return "房间已关闭";
    if (room.status === "playing") return playingStatus(room);
    return "";
  }

  R.syncStatus = function () {
    var node = $("[data-room-status]");
    if (!node) return;
    var text = R.code ? statusText() : "";
    node.hidden = !text;
    setText(node, text);
  };

  /* ---------------- 本端出招 ---------------- */

  R.canAct = function () {
    if (P.mode !== "play" || P.remote !== R || !R.room || R.room.status !== "playing") return false;
    if (!R.active || R.pending || R.locked || R.halted) return false;
    if (!P.state || P.state.phase !== "fight" || !P.state.turnUid) return false;
    try { return B.state.sideOf(P.state, P.state.turnUid) === R.side; } catch (err) { return false; }
  };

  /* 先在克隆状态上算出 committed，服务端确认后才替换本地状态 */
  R.act = function (action) {
    if (!R.canAct()) {
      P.setHint(R.pending ? "正在提交…" : "等对方行动");
      return false;
    }
    var result;
    try {
      result = B.battle.apply(P.state, action);
    } catch (err) {
      P.setHint(err.message); root.BattlePick.cancel(P.pick); P.render(); return false;
    }
    var api = root.RpgData;
    if (!api || typeof api.appendRoomAction !== "function") { R.fail("联机服务未部署"); return false; }
    var next = result.state;
    var tag = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    var gen = R.gen;
    R.lastTag = tag; R.pending = true;
    P.setHint("正在提交…"); P.render();
    api.appendRoomAction({
      code: R.code, seatKey: R.seatKey, expectedSeq: R.seq, action: result.committed,
      stateHash: B.state.hash(next), clientTag: tag,
      result: next.phase === "finished" ? next.result : "",
      rounds: next.round, engineVersion: engineVersion()
    }).then(function (res) {
      if (gen !== R.gen) return;
      R.pending = false;
      if (res.status) R.room.status = res.status;
      if (res.seq > R.seq) {
        P.state = next; P.actions.push(result.committed);
        P.hint = P.describe(result.events); R.seq = res.seq;
        root.BattlePick.cancel(P.pick);
      }
      P.render();
    }).catch(function (err) {
      if (gen !== R.gen) return;
      R.pending = false;
      var code = err && err.code;
      if (code === "stale") { P.setHint("对方先走了一步，正在同步"); R.pollNow(); return; }
      if (code === "bad_key" || code === "not_found") resetLocal(errorText(err));
      else if (code === "finished" || code === "abandoned") R.fail(errorText(err));
      else { P.setHint("提交失败，请重试"); P.render(); }
    });
    return true;
  };

  /* ---------------- 错误 ---------------- */

  function errorText(err) {
    if (err && err.code) return ERRORS[err.code] || "联机请求失败";
    var message = String((err && err.message) || "");
    if (/联机服务未部署|云服务未配置/.test(message)) return message;
    return "联机请求失败";
  }

  /* ---------------- 角色下拉 ---------------- */

  R.refreshRoster = function () {
    var select = $("[data-room-char]");
    if (!select) return;
    var current = select.value;
    var options = (P.roster || []).map(function (char) {
      return '<option value="' + esc(char.name) + '">' + esc(char.name) + "</option>";
    });
    select.innerHTML = options.join("");
    if (!current) return;
    for (var i = 0; i < select.options.length; i++) {
      if (select.options[i].value === current) {
        select.selectedIndex = i;
        return;
      }
    }
  };

  /* ---------------- 表单校验 ---------------- */

  function readForm() {
    var nickEl = $("[data-room-nick]");
    var nick = nickEl ? String(nickEl.value || "").trim() : "";
    if (!nick) {
      note("先填昵称");
      return null;
    }
    if (nick.length > 16) {
      note("昵称最多 16 个字");
      return null;
    }
    var charEl = $("[data-room-char]");
    var char = charEl ? P.byName[charEl.value] : null;
    if (!char) {
      note("先选自己的角色");
      return null;
    }
    return { nick: nick, char: char };
  }

  /* ---------------- 建房 / 加入 ---------------- */

  function createRoom() {
    if (R.active || R.busy) return;
    var info = readForm();
    if (!info) return;
    var api = roomsApi();
    if (!api) {
      note("联机服务未部署");
      return;
    }
    var key = newSeatKey();
    var gen = (R.gen += 1);
    R.busy = true;
    note("正在创建房间…");
    api.createRoom({
      nick: info.nick,
      seatKey: key,
      character: info.char.id,
      name: info.char.name,
      engineVersion: engineVersion()
    }).then(function (res) {
      if (gen !== R.gen) return;
      R.busy = false;
      writeNick(info.nick);
      R.code = res.code;
      R.side = res.side || "a";
      R.seatKey = key;
      R.room = res.room;
      saveSeat({ code: res.code, side: R.side, seatKey: key, nick: info.nick, at: Date.now() });
      setRoomUrl(res.code);
      R.active = true;
      R.failCount = 0;
      R.halted = false;
      R.statusText = "";
      setWait(true, res.code);
      disableStart(true);
      note("房间已创建，把链接发给对手。");
      R.syncStatus();
      scheduleNext(POLL_MS);
    }).catch(function (err) {
      if (gen !== R.gen) return;
      R.busy = false;
      note(errorText(err));
    });
  }

  function joinRoom() {
    if (R.active || R.busy) return;
    var info = readForm();
    if (!info) return;
    var codeEl = $("[data-room-code]");
    var code = normCode(codeEl ? codeEl.value : "");
    if (code.length !== 8) {
      note("房间码必须是 8 位");
      return;
    }
    var api = roomsApi();
    if (!api) {
      note("联机服务未部署");
      return;
    }
    var key = newSeatKey();
    var gen = (R.gen += 1);
    R.busy = true;
    note("正在加入房间…");
    api.joinRoom({
      code: code,
      nick: info.nick,
      seatKey: key,
      character: info.char.id,
      name: info.char.name,
      engineVersion: engineVersion()
    }).then(function (res) {
      if (gen !== R.gen) return;
      R.busy = false;
      writeNick(info.nick);
      R.code = code;
      R.side = res.side || "b";
      R.seatKey = key;
      R.room = res.room;
      saveSeat({ code: code, side: R.side, seatKey: key, nick: info.nick, at: Date.now() });
      setRoomUrl(code);
      R.active = true;
      R.failCount = 0;
      R.halted = false;
      R.statusText = "";
      setWait(false);
      disableStart(true);
      return handleRoom(res.room, res.actions || [], res.side);
    }).then(function () {
      if (gen === R.gen && R.active) scheduleNext(POLL_MS);
    }).catch(function (err) {
      if (gen !== R.gen) return;
      R.busy = false;
      note(errorText(err));
    });
  }

  function copyLink() {
    var code = R.code;
    if (!code) {
      var codeEl = $("[data-room-code]");
      code = normCode(codeEl ? codeEl.value : "");
    }
    if (!code) return;
    code = normCode(code);
    if (code.length !== 8) {
      note("房间码必须是 8 位");
      return;
    }
    var link = roomLink(code);
    var input = $("[data-room-link]");
    if (input) input.value = link;
    var done = function () { note("链接已复制，发给对手即可。"); };
    var clipboard = root.navigator && root.navigator.clipboard;
    if (clipboard && typeof clipboard.writeText === "function") {
      clipboard.writeText(link).then(done).catch(function () { fallbackCopy(input, link); });
      return;
    }
    fallbackCopy(input, link);
  }

  function copyCode() {
    var code = R.code;
    if (!code) return;
    var clipboard = root.navigator && root.navigator.clipboard;
    if (clipboard && typeof clipboard.writeText === "function") {
      clipboard.writeText(code).then(function () {
        if (P.setHint) P.setHint("房间码已复制：" + code);
      }).catch(function () { root.prompt("房间码：", code); });
      return;
    }
    root.prompt("房间码：", code);
  }

  function fallbackCopy(input, link) {
    if (input) {
      input.focus();
      input.select();
    }
    root.prompt("复制下面的链接发给对手：", link);
    note("请手动复制链接。");
  }

  /* ---------------- 重放与进入对局 ---------------- */

  function replay(room, actions, a, b) {
    var created = B.battle.create({ seed: room.seed, a: a, b: b });
    var state = created.state;
    var committed = [];
    var list = (actions || []).slice().sort(function (x, y) { return (x.seq || 0) - (y.seq || 0); });
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var step = item.seq || i + 1;
      var result;
      try {
        result = B.battle.apply(state, item.action);
      } catch (err) {
        return { ok: false, step: step };
      }
      state = result.state;
      committed.push(result.committed);
      if (item.stateHash && B.state.hash(state) !== item.stateHash) {
        return { ok: false, step: step };
      }
    }
    return {
      ok: true,
      state: state,
      committed: committed,
      lastSeq: list.length ? (list[list.length - 1].seq || 0) : 0
    };
  }

  function halt(text) {
    R.gen += 1;
    R.inflight = false;
    R.busy = false;
    R.active = false;
    R.halted = true;
    R.pending = false;
    R.locked = false;
    R.again = false;
    R.statusText = text;
    stopPoll();
    if (!R.entered) {
      setWait(false);
      disableStart(false);
    }
    note(text);
    R.syncStatus();
  }

  function enter(room, actions) {
    if (R.entered) return Promise.resolve(true);
    var mine = engineVersion();
    if (mine && room.engineVersion && room.engineVersion !== mine) {
      halt("双方页面版本不一致，请刷新");
      return Promise.resolve(false);
    }
    return Promise.all([P.charOf(room.characterA), P.charOf(room.characterB)]).then(function (pair) {
      if (!pair[0] || !pair[1]) {
        halt("角色已下架，无法进入");
        return false;
      }
      var replayed = replay(room, actions, pair[0], pair[1]);
      if (!replayed.ok) {
        halt("与对手状态不一致（第 " + replayed.step + " 步）");
        return false;
      }
      startGame(room, pair[0], pair[1], replayed);
      return true;
    }).catch(function () {
      halt("角色已下架，无法进入");
      return false;
    });
  }

  function startGame(room, a, b, replayed) {
    R.locked = true;
    R.code = room.code || R.code;
    R.room = room;
    R.seq = replayed.lastSeq || room.lastSeq || 0;
    R.active = true;
    P.remote = R;
    P.startBattle(a, b, room.seed, null);
    P.state = replayed.state;
    P.actions = replayed.committed;
    P.history = [];
    P.hint = replayed.committed.length
      ? "已恢复房间，进度 " + replayed.committed.length + " 步"
      : "联机开局";
    R.entered = true;
    R.locked = false;
    if (P.dom && P.dom.stage) P.dom.stage.setAttribute("data-my-side", R.side);
    setWait(false);
    disableStart(true);
    P.render();
  }

  /* ---------------- 远端动作 ---------------- */

  function resultButtons() {
    return '<button type="button" class="btn btn-ghost" data-room-leave>离开房间</button>' +
      '<button type="button" class="btn btn-ghost" data-room-copy>复制房间码</button>';
  }

  R.applyRemote = function (actions) {
    if (!actions || !actions.length || R.halted) return;
    var list = actions.slice().sort(function (x, y) { return (x.seq || 0) - (y.seq || 0); });
    var changed = false;
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var step = item.seq || 0;
      if (step <= R.seq) continue;
      if (step !== R.seq + 1) return R.fail("同步序号不连续（第 " + step + " 步）");
      var next;
      try { next = B.battle.apply(P.state, item.action); } catch (err) {
        return R.fail("与对手状态不一致（第 " + step + " 步）");
      }
      if (B.state.hash(next.state) !== item.stateHash) return R.fail("与对手状态不一致（第 " + step + " 步）");
      P.state = next.state;
      P.actions.push(next.committed);
      R.seq = step;
      P.hint = P.describe(next.events);
      if (item.side === R.side && item.clientTag && item.clientTag === R.lastTag) P.hint = "已同步本机提交";
      changed = true;
    }
    if (!changed) return;
    root.BattlePick.cancel(P.pick);
    P.render();
  };

  R.fail = function (text) {
    halt(text);
    if (root.RpgData && typeof root.RpgData.abandonRoom === "function" && R.code && R.seatKey) {
      root.RpgData.abandonRoom({ code: R.code, seatKey: R.seatKey, reason: "desync" }).catch(function () {});
    }
    if (P.dom && P.dom.result) {
      P.dom.result.hidden = false;
      P.dom.result.innerHTML = "<h2>同步中止</h2>" +
        '<p class="br-line">' + esc(text) + '</p><div class="br-actions">' + resultButtons() + "</div>";
    }
    P.render();
  };

  /* ---------------- 结算与保存 ---------------- */

  R.saveBattle = function () {
    if (P.saved || P.saving || P.saveTried) return;
    if (P.mode !== "play" || !P.state || P.state.phase !== "finished" || !root.BattleRecord) return;
    P.saving = true; P.saveTried = true; P.saveError = "";
    var record = root.BattleRecord.build(P.state, P.meta, P.actions);
    record.id = "room-" + R.code;
    var api = root.RpgData;
    if (!api || typeof api.createBattle !== "function") {
      P.saving = false; P.saveError = "数据层不可用，战报没有保存"; P.showResult(); return;
    }
    api.createBattle(record).then(function (res) {
      P.recordId = (res && res.id) || record.id;
      P.saved = true; P.saving = false; P.showResult();
    }).catch(function (err) {
      var body = String((err && err.body) || "");
      if ((err && err.status === 409) || /23505|duplicate key/i.test(body)) {
        P.recordId = record.id;
        P.saved = true;
      } else {
        P.saveError = (err && err.message) || "保存失败";
      }
      P.saving = false; P.showResult();
    });
  };

  R.showResult = function () {
    if (!P.state || !P.dom || !P.dom.result) return;
    var winner = P.state.result === "a" ? P.meta.a : P.state.result === "b" ? P.meta.b : null;
    var line = "胜者：<b>" + esc(winner ? winner.name : "平局") + "</b> · 共 " + P.state.round +
      " 个标准回合 · 种子 " + P.state.seed + " · 房间码 " + esc(R.code);
    var saveLine = "";
    if (P.saving) saveLine = '<p class="br-line">正在保存战报…</p>';
    else if (P.saved) {
      var id = P.recordId || ("room-" + R.code);
      saveLine = '<p class="br-line">战报已保存：<code>' + esc(id) + "</code> · " +
        '<a href="test.html?record=' + encodeURIComponent(id) + '">打开回放</a></p>';
    } else if (P.saveError) {
      saveLine = '<p class="br-line">战报没有保存：' + esc(P.saveError) + "</p>" +
        '<button type="button" class="btn btn-ghost" data-retry-save>重试保存</button>';
    }
    P.dom.result.hidden = false;
    P.dom.result.innerHTML = "<h2>对局结束</h2>" + '<p class="br-line">' + line + "</p>" +
      saveLine + '<div class="br-actions">' + resultButtons() + "</div>";
  };

  /* ---------------- 轮询 ---------------- */

  function stopPoll() {
    if (R.timer) {
      clearTimeout(R.timer);
      R.timer = null;
    }
  }

  function scheduleNext(ms) {
    stopPoll();
    if (!R.active) return;
    R.timer = setTimeout(poll, ms == null ? POLL_MS : ms);
  }

  R.pollNow = function () {
    if (!R.active) return;
    stopPoll();
    if (R.inflight) { R.again = true; return; }
    poll();
  };

  function fetchAll() {
    var all = [];
    var first = null;
    var last = null;
    var after = R.seq || 0;
    var pages = 0;
    function step() {
      return roomsApi().getRoom({
        code: R.code,
        seatKey: R.seatKey,
        afterSeq: after,
        limit: PAGE_LIMIT
      }).then(function (res) {
        if (!first) first = res;
        last = res;
        (res.actions || []).forEach(function (item) { all.push(item); });
        if (res.actions && res.actions.length) {
          after = res.actions[res.actions.length - 1].seq || after;
        }
        if (res.hasMore) {
          if (pages >= MAX_PAGES) {
            var err = new Error("对局步数过多");
            err.code = "too_many";
            throw err;
          }
          pages += 1;
          return step();
        }
        return {
          room: last.room,
          actions: all,
          side: first ? first.side : ""
        };
      });
    }
    return step();
  }

  function handleRoom(room, actions, side) {
    if (!room) {
      halt("没有这个房间（或已过期）");
      return Promise.resolve(false);
    }
    R.room = room;
    if (side) R.side = side;
    if (!R.code && room.code) R.code = room.code;
    if (room.status === "abandoned") {
      halt("房间已关闭");
      return Promise.resolve(false);
    }
    if (room.status === "finished") {
      var wasEntered = R.entered;
      var done = wasEntered ? Promise.resolve(true) : enter(room, actions);
      return done.then(function (ok) {
        if (!ok || !R.entered) return ok;
        if (wasEntered && actions && actions.length) R.applyRemote(actions);
        R.room = room; R.syncStatus(); stopPoll(); R.active = false;
        return true;
      });
    }
    if (room.status === "waiting") {
      if (!R.entered) {
        var host = R.side === "a";
        setWait(host, room.code || R.code);
        note(host ? "等待对手加入…" : "等待房主开始…");
      }
      R.syncStatus();
      return Promise.resolve(true);
    }
    if (room.status === "playing") {
      note("");
      if (R.entered) {
        if (actions && actions.length) R.applyRemote(actions); else R.syncStatus();
        return Promise.resolve(true);
      }
      return enter(room, actions);
    }
    R.syncStatus();
    return Promise.resolve(true);
  }

  function handlePollError(err) {
    var code = err && err.code;
    if (code === "bad_key" || code === "not_found") {
      resetLocal(errorText(err));
      return;
    }
    if (code === "abandoned" || code === "finished") {
      halt(errorText(err));
      return;
    }
    if (code === "too_many") {
      halt(errorText(err));
      return;
    }
    note("同步中断，重试中");
    R.syncStatus();
  }

  function poll() {
    R.timer = null;
    if (!R.active || R.inflight) return;
    var gen = R.gen;
    R.inflight = true;
    fetchAll().then(function (res) {
      if (gen !== R.gen) {
        R.inflight = false;
        return;
      }
      R.inflight = false;
      R.failCount = 0;
      return handleRoom(res.room, res.actions, res.side);
    }).catch(function (err) {
      if (gen !== R.gen) {
        R.inflight = false;
        return;
      }
      R.inflight = false;
      R.failCount += 1;
      handlePollError(err);
    }).then(function () {
      if (gen !== R.gen || !R.active) return;
      if (R.again) { R.again = false; poll(); return; }
      var delay = root.document.hidden
        ? HIDDEN_MS
        : Math.min(POLL_MS * Math.pow(2, R.failCount), BACKOFF_MAX);
      scheduleNext(delay);
    });
  }

  function onVisible() {
    if (!R.active || root.document.hidden) return;
    stopPoll();
    poll();
  }

  /* ---------------- 恢复与离开 ---------------- */

  function restore(rawCode) {
    var code = normCode(rawCode);
    openBox();
    var codeEl = $("[data-room-code]");
    if (codeEl) codeEl.value = code;
    if (code.length !== 8) {
      note("链接里的房间码不合法");
      return;
    }
    R.code = code;
    var seat = findSeat(code);
    if (!seat) {
      setWait(false);
      note("输入昵称、选择自己的角色后加入房间。");
      return;
    }
    R.seatKey = seat.seatKey;
    R.side = seat.side || "";
    var nickEl = $("[data-room-nick]");
    if (nickEl && !nickEl.value) nickEl.value = seat.nick || readNick();
    setWait(true, code);
    disableStart(true);
    note("正在恢复房间…");
    R.gen += 1;
    var gen = R.gen;
    R.active = true;
    R.failCount = 0;
    R.halted = false;
    R.statusText = "";
    fetchAll().then(function (res) {
      if (gen !== R.gen) return false;
      return handleRoom(res.room, res.actions, res.side);
    }).then(function () {
      if (gen === R.gen && R.active) scheduleNext(POLL_MS);
    }).catch(function (err) {
      if (gen !== R.gen) return;
      R.active = false;
      stopPoll();
      if (err && (err.code === "bad_key" || err.code === "not_found")) {
        resetLocal(errorText(err));
        return;
      }
      setWait(true, code);
      disableStart(true);
      note(errorText(err) + "，刷新重试或用「取消房间」退出。");
      R.syncStatus();
    });
  }

  function resetLocal(text) {
    stopPoll();
    R.gen += 1;
    R.inflight = false;
    R.busy = false;
    R.active = false;
    R.entered = false;
    R.halted = false;
    R.pending = false;
    R.locked = false;
    R.lastTag = "";
    R.again = false;
    R.seq = 0;
    R.failCount = 0;
    if (R.code) dropSeat(R.code);
    R.code = "";
    R.side = "";
    R.seatKey = "";
    R.room = null;
    R.statusText = "";
    P.remote = null;
    if (P.dom && P.dom.stage) {
      P.dom.stage.removeAttribute("data-my-side");
      if (!P.dom.stage.hidden) {
        P.state = null;
        P.actions = [];
        P.history = [];
        P.dom.stage.hidden = true;
        P.dom.result.hidden = true;
        P.dom.setup.hidden = false;
        P.setImmersive(false);
        root.document.title = P.BASE_TITLE;
      }
    }
    setRoomUrl("");
    setWait(false);
    disableStart(false);
    note(text || "");
    R.syncStatus();
    if (P.offerResume) P.offerResume();
  }

  function cancelRoom() {
    if (!R.code && !R.room) {
      resetLocal("");
      return;
    }
    var status = R.room && R.room.status;
    if (status === "finished") { resetLocal("已退出房间。"); return; }
    if (status === "playing" && !root.confirm("离开会关闭房间，对手将看到「房间已关闭」。确定离开吗？")) return;
    var code = R.code;
    var key = R.seatKey;
    var api = root.RpgData;
    note("正在关闭房间…");
    var done = function () { resetLocal("已退出房间。"); };
    if (api && typeof api.abandonRoom === "function" && code && key) {
      api.abandonRoom({ code: code, seatKey: key, reason: "leave" }).then(done).catch(done);
      return;
    }
    done();
  }

  /* ---------------- 绑定与初始化 ---------------- */

  function bind() {
    var createBtn = $("[data-room-create]");
    var joinBtn = $("[data-room-join]");
    var copyBtn = $("[data-room-copy]");
    var cancelBtn = $("[data-room-cancel]");
    var leaveBar = $("[data-room-leave-bar]");
    if (createBtn) createBtn.addEventListener("click", createRoom);
    if (joinBtn) joinBtn.addEventListener("click", joinRoom);
    if (copyBtn) copyBtn.addEventListener("click", copyLink);
    if (cancelBtn) cancelBtn.addEventListener("click", cancelRoom);
    if (leaveBar) leaveBar.addEventListener("click", function () { R.leave(); });
    if (P.dom && P.dom.result && !R.resultBound) {
      R.resultBound = true;
      P.dom.result.addEventListener("click", function (event) {
        if (event.target.closest("[data-room-leave]")) R.leave();
        else if (event.target.closest("[data-room-copy]")) copyCode();
      });
    }
    var codeEl = $("[data-room-code]");
    if (codeEl) {
      codeEl.addEventListener("input", function () { codeEl.value = normCode(codeEl.value); });
      codeEl.addEventListener("keydown", function (event) {
        if (event.key === "Enter") joinRoom();
      });
    }
    var nickEl = $("[data-room-nick]");
    if (nickEl && !nickEl.value) nickEl.value = readNick();
    if (root.document && root.document.addEventListener) {
      root.document.addEventListener("visibilitychange", onVisible);
    }
  }

  R.init = function (roomParam) {
    if (!R.bound) {
      R.bound = true;
      bind();
    }
    if (!R.purged) {
      R.purged = true;
      if (root.RpgData && typeof root.RpgData.purgeRooms === "function") {
        root.RpgData.purgeRooms();
      }
    }
    R.refreshRoster();
    if (roomParam) restore(roomParam);
  };

  R.leave = cancelRoom;

  P.remoteInit = R.init;
  P.remoteRefreshRoster = R.refreshRoster;
})(typeof globalThis !== "undefined" ? globalThis : this);
