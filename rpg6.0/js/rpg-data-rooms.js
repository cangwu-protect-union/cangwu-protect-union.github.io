/* 回合制正传 6.0 · 数据访问层 · 远程联机房间分片
   只往 window.RpgData 挂函数，在 rpg-data.js 装配之前加载。
   房间表对 anon 不可读，全部读写都走 rpc/rpg_room_*。 */
(function () {
  "use strict";
  var P = window.RpgData || (window.RpgData = {});

  P.ROOM_TIMEOUT_MS = 12000;

  P.mapRoom = function (r) {
    if (!r) return null;
    return {
      code: r.code || "",
      status: r.status || "",
      seed: Number(r.seed) || 0,
      engineVersion: r.engine_version || "",
      characterA: r.character_a || "",
      nameA: r.name_a || "",
      nickA: r.nick_a || "",
      characterB: r.character_b || "",
      nameB: r.name_b || "",
      nickB: r.nick_b || "",
      lastSeq: Number(r.last_seq) || 0,
      result: r.result || "",
      steps: Number(r.steps) || 0,
      rounds: Number(r.rounds) || 0,
      seenA: r.seen_a || null,
      seenB: r.seen_b || null
    };
  }

  P.mapRoomAction = function (r) {
    if (!r) return null;
    return {
      seq: Number(r.seq) || 0,
      side: r.side || "",
      action: r.action && typeof r.action === "object" ? r.action : {},
      stateHash: r.state_hash || "",
      clientTag: r.client_tag || ""
    };
  }

  function roomError(data) {
    var code = (data && data.code) || "unknown";
    var err = new Error("联机请求失败：" + code);
    err.code = code;
    err.data = data;
    return err;
  }

  function ensureOk(data) {
    if (data && data.ok === true) return data;
    throw roomError(data);
  }

  function rpc(c, name, payload, retry) {
    function once() {
      return P.withTimeout(
        fetch(c.rest + "rpc/" + name, {
          method: "POST",
          headers: P.headers(c),
          body: JSON.stringify(payload || {})
        }),
        P.ROOM_TIMEOUT_MS
      ).then(P.readJson);
    }

    var run = retry ? function () { return P.retryOnceOnTimeout(once); } : once;

    return run().catch(function (err) {
      var body = String((err && err.body) || "");
      if (err && err.status === 404 &&
          /PGRST202|Could not find the function/i.test(body)) {
        throw new Error("联机服务未部署");
      }
      throw err;
    });
  }

  function noCloud() {
    return Promise.reject(new Error("云服务未配置，联机不可用。"));
  }

  P.createRoom = function (payload) {
    var c = P.cfg();
    if (!c) return noCloud();
    payload = payload || {};
    return rpc(c, "rpg_room_create", {
      p_nick: P.trim(payload.nick),
      p_seat_key: P.trim(payload.seatKey),
      p_character: P.trim(payload.character),
      p_name: P.trim(payload.name),
      p_engine_version: P.trim(payload.engineVersion)
    }, true).then(ensureOk).then(function (data) {
      return {
        side: data.side || "a",
        code: data.code || (data.room && data.room.code) || "",
        room: P.mapRoom(data.room),
        actions: (data.actions || []).map(P.mapRoomAction)
      };
    });
  }

  P.joinRoom = function (payload) {
    var c = P.cfg();
    if (!c) return noCloud();
    payload = payload || {};
    return rpc(c, "rpg_room_join", {
      p_code: P.trim(payload.code),
      p_nick: P.trim(payload.nick),
      p_seat_key: P.trim(payload.seatKey),
      p_character: P.trim(payload.character),
      p_name: P.trim(payload.name),
      p_engine_version: P.trim(payload.engineVersion)
    }, true).then(ensureOk).then(function (data) {
      return {
        side: data.side || "b",
        code: data.code || (data.room && data.room.code) || "",
        room: P.mapRoom(data.room),
        actions: (data.actions || []).map(P.mapRoomAction)
      };
    });
  }

  P.getRoom = function (payload) {
    var c = P.cfg();
    if (!c) return noCloud();
    payload = payload || {};
    var limit = parseInt(payload.limit, 10);
    if (!(limit > 0)) limit = 500;
    if (limit > 500) limit = 500;
    return rpc(c, "rpg_room_get", {
      p_code: P.trim(payload.code),
      p_seat_key: P.trim(payload.seatKey),
      p_after_seq: Math.max(0, parseInt(payload.afterSeq, 10) || 0),
      p_limit: limit
    }, false).then(ensureOk).then(function (data) {
      return {
        side: data.side || "",
        room: P.mapRoom(data.room),
        actions: (data.actions || []).map(P.mapRoomAction),
        hasMore: !!data.has_more,
        serverTime: data.server_time || null
      };
    });
  }

  P.appendRoomAction = function (payload) {
    var c = P.cfg();
    if (!c) return noCloud();
    payload = payload || {};
    return rpc(c, "rpg_room_append", {
      p_code: P.trim(payload.code),
      p_seat_key: P.trim(payload.seatKey),
      p_expected_seq: Math.max(0, parseInt(payload.expectedSeq, 10) || 0),
      p_action: payload.action && typeof payload.action === "object" ? payload.action : {},
      p_state_hash: P.trim(payload.stateHash),
      p_client_tag: P.trim(payload.clientTag),
      p_result: P.trim(payload.result),
      p_rounds: Math.max(0, parseInt(payload.rounds, 10) || 0),
      p_engine_version: P.trim(payload.engineVersion)
    }, true).then(ensureOk).then(function (data) {
      return {
        seq: Number(data.seq) || 0,
        status: data.status || ""
      };
    });
  }

  P.abandonRoom = function (payload) {
    var c = P.cfg();
    if (!c) return noCloud();
    payload = payload || {};
    return rpc(c, "rpg_room_abandon", {
      p_code: P.trim(payload.code),
      p_seat_key: P.trim(payload.seatKey),
      p_reason: P.trim(payload.reason)
    }, false).then(ensureOk).then(function () {
      return { ok: true };
    });
  }

  P.purgeRooms = function () {
    var c = P.cfg();
    if (!c) return Promise.resolve(0);
    return P.withTimeout(
      fetch(c.rest + "rpc/rpg_rooms_purge", {
        method: "POST",
        headers: P.headers(c),
        body: "{}"
      }),
      P.ROOM_TIMEOUT_MS
    ).then(P.readJson).then(function (n) {
      return Number(n) || 0;
    }).catch(function (err) {
      console.warn("[联机] 旧房间清理失败：", err.message);
      return 0;
    });
  }

})();
