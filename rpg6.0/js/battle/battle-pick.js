/* 回合制正传 6.0 · 战斗界面 · 选中状态
   一次只允许有一个待选目标的操作。界面只问这里「现在能不能点某个角色」。 */
(function (root) {
  "use strict";

  function create() {
    return { mode: "", type: "", id: "", targets: [] };
  }

  function begin(pick, spec) {
    pick.mode = spec.mode;
    pick.type = spec.type || "";
    pick.id = spec.id || "";
    pick.targets = (spec.targets || []).slice();
    return pick;
  }

  function cancel(pick) {
    pick.mode = "";
    pick.type = "";
    pick.id = "";
    pick.targets = [];
    return pick;
  }

  function isActive(pick) {
    return !!pick && !!pick.mode;
  }

  function allows(pick, uid) {
    if (!isActive(pick)) return false;
    return pick.targets.indexOf(uid) >= 0;
  }

  root.BattlePick = {
    create: create,
    begin: begin,
    cancel: cancel,
    isActive: isActive,
    allows: allows
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
