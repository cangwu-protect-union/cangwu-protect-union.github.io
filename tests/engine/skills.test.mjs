/* 技能库：全部角色的条件、结算、校验（角色数/技能数不写死，跟着 data/skills 与 seed 走） */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

const B = globalThis.RPG6B;
const LIB = globalThis.RPG6_SKILLS;
B.skills.load(LIB);

/* 固件：从 seed（数据库导出）与技能库现算，不再手抄 ----------------
   以前这里有两张手抄表：SHEET（29 人 104 条技能名与条件）和 CHAR（29 人面板）。
   每批加角色要抄两遍，抄错的条件会让「条件对得上」那条用例变成自己和自己比。
   现在面板与技能条件都取 seed，拼音键靠技能库的模块实例对上（比 identity，不写死映射），
   于是那条用例真的在比技能库 ↔ 数据库导出。 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const RPG6 = path.resolve(HERE, "..", "..", "rpg6.0");

function loadSeed() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  for (const f of ["characters.js", "characters-2.js", "characters-3.js", "characters-4.js"]) {
    const p = path.join(RPG6, "data", "seeds", f);
    vm.runInContext(fs.readFileSync(p, "utf8"), sandbox, { filename: p });
  }
  return sandbox.window.RPG_SEED_CHARACTERS;
}

const SEED = new Map(loadSeed().map((c) => [c.name, c]));

/* 拼音文件名 → 中文名：index.js import 的是同一个模块实例，比 identity 就够 */
const PINYIN = {};
for (const file of fs.readdirSync(path.join(RPG6, "data", "skills")).filter((f) => f.endsWith(".js") && f !== "index.js")) {
  const pinyin = file.slice(0, -3);
  const mod = await import(pathToFileURL(path.join(RPG6, "data", "skills", file)).href);
  const name = Object.keys(LIB.characters).find((n) => LIB.characters[n] === mod.default);
  if (name) PINYIN[pinyin] = name;
}

const CHAR = {};
for (const [pinyin, name] of Object.entries(PINYIN)) {
  const c = SEED.get(name);
  const panel = (LIB.panels || {})[name] || {};
  CHAR[pinyin] = {
    id: "t-" + pinyin,
    name,
    gender: c.gender || "",
    occupation: c.occupation || "",
    side_job: c.side_job || "",
    atk: panel.atk != null ? String(panel.atk) : c.atk,
    def: c.def,
    mres: c.mres,
    hp: c.hp,
    mp: c.mp,
    spd: c.spd
  };
}
/* 木桩：测试专用，不在 seed 里 */
CHAR.dummy = { id: "t-dummy", name: "木桩", gender: "男", occupation: "强攻手", side_job: "", atk: "10", def: "40", mres: "30", hp: "9999", mp: "10", spd: "80" };

const SHEET = Object.fromEntries(
  Object.entries(PINYIN).map(([, name]) => [name, (SEED.get(name).skills || []).map((s) => [s.name, s.condition])])
);

function sheet(name) {
  return (SHEET[name] || []).map(([skillName, condition]) => ({ name: skillName, condition: condition, effect: "" }));
}

function withSheet(char) {
  return { ...char, skills: sheet(char.name) };
}

function mk(a, b, seed) {
  return B.battle.create({
    seed: seed == null ? 11 : seed,
    a: withSheet(a || CHAR.liuwenzhe),
    b: withSheet(b || CHAR.dummy)
  }).state;
}

function cast(state, unitUid, skillId, target, extra) {
  const unit = B.state.unitOf(state, unitUid);
  const events = [];
  const action = { kind: "skill", skillId: skillId, target: target };
  if (extra) Object.assign(action, extra);
  const committed = B.skills.execute(state, unit, action, events);
  return { events, committed };
}

function basic(state, target) {
  const events = [];
  const committed = B.actions.execute(state, { kind: "basic", type: "attack", target: target }, events);
  return { events, committed };
}

function endRound(state, round) {
  state.round = round;
  const events = [];
  B.effectOps.roundEnd(state, events);
  return events;
}

export const cases = [
  {
    name: "技能库：每个角色的技能 id 带本角色前缀、不重复、总数与引擎一致",
    run() {
      const ids = new Set();
      let total = 0;
      for (const [pinyin, name] of Object.entries(PINYIN)) {
        const list = LIB.characters[name];
        assert.ok(list.length > 0, name + " 没有技能");
        for (const skill of list) {
          assert.ok(
            String(skill.id).startsWith(pinyin + "."),
            name + " · " + skill.name + " 的 id 应以 " + pinyin + ". 开头，实际 " + skill.id
          );
          assert.ok(!ids.has(skill.id), "技能 id 重复：" + skill.id);
          ids.add(skill.id);
        }
        total += list.length;
      }
      assert.equal(total, B.skills.all().length);
    }
  },
  {
    name: "校验：全部角色的技能名与条件都和档案对得上",
    run() {
      const chars = Object.keys(SHEET).map((name) => {
        const key = Object.keys(CHAR).find((k) => CHAR[k].name === name);
        return withSheet(CHAR[key]);
      });
      const problems = B.skills.validate(chars);
      assert.deepEqual(problems, []);
    }
  },
  {
    name: "校验：档案里少了技能会被拦下",
    run() {
      const broken = withSheet(CHAR.liuwenzhe);
      broken.skills = broken.skills.slice(0, 2);
      const problems = B.skills.validate([broken]);
      assert.equal(problems.length, 1);
      assert.match(problems[0].reason, /档案里没有/);
      assert.match(B.skills.find("liuwenzhe.yidefuren").unsupported, /档案里没有/);
    }
  },
  {
    name: "校验：条件文本不一致会被拦下",
    run() {
      const broken = withSheet(CHAR.lishuo);
      broken.skills[1].condition = "5蓝";
      const problems = B.skills.validate([broken]);
      assert.equal(problems.length, 1);
      assert.match(problems[0].reason, /条件与档案不一致/);
      assert.throws(() => cast(mk(CHAR.lishuo, CHAR.dummy), "a", "lishuo.yuzhou", "b"), /条件与档案不一致/);
      B.skills.validate([withSheet(CHAR.lishuo)]);
    }
  },
  {
    name: "刨祖坟：伤害按 250 + 自己当前血量算，打完自己回满",
    run() {
      const state = mk(CHAR.wangluor, CHAR.dummy);
      state.units[0].hp = 500;
      state.units[0].charge = { skillId: "wangluor.paozufen", amount: 3 };
      const before = state.units[1].hp;
      cast(state, "a", "wangluor.paozufen", "b");
      assert.equal(before - state.units[1].hp, 250 + 500 - 40);
      assert.equal(state.units[0].hp, 855);
      assert.equal(B.state.statOf(state.units[1], "atk"), 60);
      assert.equal(B.state.statOf(state.units[1], "spd"), 110);
    }
  },
  {
    name: "拟玛使勒：扣 1 蓝，目标蓝上限 -3",
    run() {
      const state = mk(CHAR.liuwenzhe, CHAR.lishuo);
      state.units[0].mp = 5;
      const r = cast(state, "a", "liuwenzhe.nimashile", "b");
      assert.equal(state.units[0].mp, 4);
      assert.equal(B.state.maxMpOf(state.units[1]), 12, "15-3=12，蓝上限只向下取整到个位");
      assert.equal(r.committed.target, "b");
    }
  },
  {
    name: "致命打只因：力不足只蓄力，不扣蓝不结算",
    run() {
      const state = mk(CHAR.liuwenzhe, CHAR.dummy);
      state.units[0].mp = 5;
      const r = cast(state, "a", "liuwenzhe.zhiming", "b");
      assert.equal(r.committed.kind, "charge");
      assert.equal(state.units[0].mp, 5);
      assert.deepEqual(state.units[0].charge, { skillId: "liuwenzhe.zhiming", amount: 1 });
      assert.equal(state.units[1].hp, 9999);
    }
  },
  {
    name: "致命打只因：4 力释放，995 普伤",
    run() {
      const state = mk(CHAR.liuwenzhe, CHAR.dummy);
      state.units[0].mp = 5;
      state.units[0].charge = { skillId: "liuwenzhe.zhiming", amount: 4 };
      cast(state, "a", "liuwenzhe.zhiming", "b");
      assert.equal(state.units[1].hp, 9999 - 955);
      assert.equal(state.units[0].mp, 4);
      assert.equal(state.units[0].charge, null);
    }
  },
  {
    name: "一手好牌：4 段法伤，掷 6 时每段翻 2.5 倍",
    run() {
      const seen = {};
      for (let seed = 1; seed <= 40 && (!seen.normal || !seen.crit); seed++) {
        const state = mk(CHAR.xieyuchen, CHAR.dummy, seed);
        const before = state.units[1].hp;
        cast(state, "a", "xieyuchen.yishou", "b");
        const loss = before - state.units[1].hp;
        if (loss === 200) seen.normal = true;
        else if (loss === 500) seen.crit = true;
        else throw new Error("出手伤害异常：" + loss);
      }
      assert.ok(seen.normal, "应出现不加倍的 200");
      assert.ok(seen.crit, "应出现掷 6 的 500");
    }
  },
  {
    name: "一手好牌：冷却期间不能再用",
    run() {
      const state = mk(CHAR.xieyuchen, CHAR.dummy, 3);
      state.round = 5;
      cast(state, "a", "xieyuchen.yishou", "b");
      assert.equal(state.units[0].cooldowns["xieyuchen.yishou"], 5);
      const check = B.conditions.evaluate(state, state.units[0], B.skills.find("xieyuchen.yishou"));
      assert.equal(check.ok, false);
      assert.match(check.reason, /冷却中，还需 4 回合/);
      state.round = 9;
      assert.equal(B.conditions.evaluate(state, state.units[0], B.skills.find("xieyuchen.yishou")).ok, true);
    }
  },
  {
    name: "大聪明：按现有血量 40% 取整到十位再加 30",
    run() {
      const state = mk(CHAR.lishuo, CHAR.dummy);
      state.units[0].hp = 200;
      state.units[0].charge = { skillId: "lishuo.dacongming", amount: 2 };
      cast(state, "a", "lishuo.dacongming", "a");
      assert.equal(state.units[0].hp, 310);
      assert.equal(state.units[0].mp, 3);
    }
  },
  {
    name: "干饭人：按已损失血量 25% 取整到个位，并清 Debuff",
    run() {
      const state = mk(CHAR.jiangyuxuan, CHAR.dummy);
      state.units[0].hp = 500;
      state.units[0].mp = 3;
      state.units[0].buffs.push({ kind: "fragile", percent: 50, remain: 3, unit: "standard", source: "x" });
      cast(state, "a", "jiangyuxuan.ganfanren", "a");
      assert.equal(state.units[0].hp, 603);
      assert.equal(state.units[0].buffs.length, 0);
    }
  },
  {
    name: "认大哥：前两次 5 个目标回合，第 3 次转永久",
    run() {
      const state = mk(CHAR.wangluor, CHAR.dummy);
      state.units[0].mp = 10;
      cast(state, "a", "wangluor.rendage", "b");
      assert.equal(B.state.defOf(state.units[1]), 0);
      const first = state.units[1].mods.find((m) => m.stat === "def");
      assert.equal(first.remain, 5);
      cast(state, "a", "wangluor.rendage", "b");
      cast(state, "a", "wangluor.rendage", "b");
      const mods = state.units[1].mods.filter((m) => m.stat === "def");
      assert.ok(mods.some((m) => m.remain === B.state.PERMANENT));
    }
  },
  {
    name: "泰山压顶：200 普伤、速度设为 25、100% 脆弱，10 标准回合后恢复",
    run() {
      const state = mk(CHAR.jiangyuxuan, CHAR.dummy);
      state.units[0].charge = { skillId: "jiangyuxuan.taishan", amount: 1 };
      cast(state, "a", "jiangyuxuan.taishan", "b");
      assert.equal(state.units[1].hp, 9999 - 160);
      assert.equal(B.state.statOf(state.units[1], "spd"), 25);
      assert.equal(B.rules.buffTotal(state.units[1], "fragile", "sum"), 100);
      const mod = state.units[1].mods.find((m) => m.stat === "spd");
      assert.equal(mod.unit, "standard");
      assert.equal(mod.remain, 10);
      for (let i = 0; i < 9; i++) B.effectOps.roundEnd(state, []);
      assert.equal(B.state.statOf(state.units[1], "spd"), 25, "第 9 个标准回合末仍是 25");
      B.effectOps.roundEnd(state, []);
      assert.equal(B.state.statOf(state.units[1], "spd"), 80, "第 10 个标准回合末回到原速度");
      assert.equal(B.rules.buffTotal(state.units[1], "fragile", "sum"), 0, "脆弱同时到期");
    }
  },
  {
    name: "肥肥反弹：蓄力即挂反射，再点释放后解除",
    run() {
      const state = mk(CHAR.jiangyuxuan, CHAR.liuwenzhe);
      cast(state, "a", "jiangyuxuan.feifei", "a");
      assert.notEqual(state.units[0].reflect, null);
      assert.equal(state.units[0].charge.indestructible, true);
      cast(state, "a", "jiangyuxuan.feifei", "a");
      assert.equal(state.units[0].reflect, null);
      assert.equal(state.units[0].charge, null);
    }
  },
  {
    name: "鸡肾豹肝：两个点数分支都成立",
    run() {
      const seen = {};
      for (let seed = 1; seed <= 40 && (!seen.magic || !seen.trueDamage); seed++) {
        const state = mk(CHAR.yuzy, CHAR.dummy, seed);
        state.units[0].charge = { skillId: "yuzy.jishen", amount: 1 };
        const before = state.units[1].hp;
        cast(state, "a", "yuzy.jishen", "b");
        const loss = before - state.units[1].hp;
        if (loss === 115) seen.magic = true;
        else if (loss === 150) seen.trueDamage = true;
        else throw new Error("鸡肾豹肝伤害异常：" + loss);
      }
      assert.ok(seen.magic && seen.trueDamage);
    }
  },
  {
    name: "削肾客：对同一目标连打两次鸡肾豹肝，速度翻倍",
    run() {
      const state = mk(CHAR.yuzy, CHAR.dummy);
      state.units[0].mp = 5;
      const before = state.units[1].hp;
      cast(state, "a", "yuzy.xueshenke", "b");
      assert.ok(before - state.units[1].hp >= 230);
      assert.equal(B.state.statOf(state.units[1], "spd"), 160);
    }
  },
  {
    name: "夏极八打：攻 -35、速 +295、封锁技能、伤害不加击溃值",
    run() {
      const state = mk(CHAR.yuzy, CHAR.dummy);
      state.units[0].charge = { skillId: "yuzy.xiajibada", amount: 5 };
      cast(state, "a", "yuzy.xiajibada", "a");
      assert.equal(B.state.statOf(state.units[0], "atk"), 35);
      assert.equal(B.state.statOf(state.units[0], "spd"), 415);
      const check = B.conditions.evaluate(state, state.units[0], B.skills.find("yuzy.jishen"));
      assert.match(check.reason, /被封锁/);
      const hpBefore = state.units[1].hp;
      B.damage.hit(state, { sourceUid: "a", targetUid: "b", type: "phys", amount: 100 }, []);
      assert.equal(hpBefore - state.units[1].hp, 60);
      assert.equal(state.units[1].breakValue, 0);
    }
  },
  {
    name: "三角板：5 回合每回合 245、第 6 回合再 100，类型按施放时锁定",
    run() {
      const state = mk(CHAR.zhengwanwan, CHAR.dummy);
      state.units[0].mp = 30;
      state.units[0].lastDamageType = "true";
      state.units[0].charge = { skillId: "zhengwanwan.sanjiaoban", amount: 2 };
      const before = state.units[1].hp;
      cast(state, "a", "zhengwanwan.sanjiaoban", "b");
      const effect = state.units[1].effects[0];
      assert.equal(effect.ops[0].type, "true");
      const start = state.round;
      for (let round = start; round < start + 5; round++) {
        state.round = round;
        B.effectOps.roundEnd(state, []);
      }
      assert.equal(before - state.units[1].hp, 245 * 5);
      state.round = effect.bornRound + 5;
      B.effectOps.roundEnd(state, []);
      assert.equal(before - state.units[1].hp, 245 * 5 + 100);
    }
  },
  {
    name: "拍后脑勺：恐慌 4 回合，并打断「宇宙的奥秘」",
    run() {
      const state = mk(CHAR.lishuo, CHAR.zhengwanwan);
      state.units[1].mp = 30;
      B.effectOps.runOps(state, { sourceUid: "a", targetUid: "a", skillId: "lishuo.yuzhou" }, [
        { op: "tick", duration: 5, unstoppable: true, label: "宇宙的奥秘", ops: [{ op: "directLoss", value: 100 }] }
      ], []);
      assert.equal(state.units[0].effects.length, 1);
      const unit = B.state.unitOf(state, "b");
      const events = [];
      B.skills.execute(state, unit, { kind: "skill", skillId: "zhengwanwan.paihou", target: "a" }, events);
      assert.equal(state.units[0].effects.length, 0);
      assert.equal(B.rules.buffTotal(state.units[0], "panic", "max"), 20);
    }
  },
  {
    name: "以德服人：普攻附 30 强扣，击溃按击溃值×50 补普伤",
    run() {
      const state = mk(CHAR.liuwenzhe, CHAR.lishuo);
      const hit = B.battle.apply(state, { kind: "basic", type: "attack", target: "b" });
      assert.equal(hit.state.units[1].hp, 360 - 85 - 30);
      const second = mk(CHAR.liuwenzhe, CHAR.dummy);
      second.units[1].breakValue = 4;
      second.units[0].actionsLeft = 1;
      second.turnUid = "a";
      const events = [];
      B.actions.execute(second, { kind: "basic", type: "break", target: "b" }, events);
      const bonus = events.filter((e) => e.type === "damage" && e.label === "击溃被动");
      assert.equal(bonus.length, 1);
      assert.equal(bonus[0].amount, 160, "被动按进入击溃前的击溃值 4 结算");
      assert.equal(second.units[1].breakValue, 0, "进入击溃后击溃值清零");
    }
  },
  {
    name: "杨舒然·猿力与你同在：三选一，回复造成的伤害；旧战报按三段回放",
    run() {
      const cases = [
        { choice: "phys", expect: 170 },
        { choice: "magic", expect: 115 },
        { choice: "true", expect: 120 }
      ];
      for (const item of cases) {
        const state = mk(CHAR.yangshuran, CHAR.dummy);
        state.units[0].hp = 50;
        state.units[0].mp = 20;
        const before = state.units[1].hp;
        const r = cast(state, "a", "yangshuran.yuanli", "b", { choice: item.choice });
        assert.equal(before - state.units[1].hp, item.expect, item.choice);
        assert.equal(state.units[0].hp, 50 + item.expect);
        assert.equal(r.committed.choice, item.choice);
      }

      const legacy = mk(CHAR.yangshuran, CHAR.dummy);
      legacy.units[0].hp = 50;
      legacy.units[0].mp = 20;
      const before = legacy.units[1].hp;
      const r = cast(legacy, "a", "yangshuran.yuanli", "b");
      assert.equal(before - legacy.units[1].hp, 170 + 115 + 120);
      assert.equal(r.committed.choice, undefined);
    }
  },
  {
    name: "杨舒然·苟之危笑：目标血量上限变为自身血量 -5，当前血量被压下来",
    run() {
      const state = mk(CHAR.yangshuran, CHAR.dummy);
      state.units[0].hp = 200;
      state.units[0].mp = 20;
      state.units[0].charge = { skillId: "yangshuran.gouzhi", amount: 2 };
      cast(state, "a", "yangshuran.gouzhi", "b");
      assert.equal(B.state.maxHpOf(state.units[1]), 195);
      assert.equal(state.units[1].hp, 195);
    }
  },
  {
    name: "杨舒然·绝对防御：不会死亡，且只能用一次",
    run() {
      const state = mk(CHAR.yangshuran, CHAR.dummy);
      cast(state, "a", "yangshuran.juedui", "a");
      assert.equal(B.state.hasStatus(state.units[0], "noDeath"), true);
      B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "true", amount: 9999 }, []);
      assert.equal(state.units[0].hp, 1);
      assert.equal(state.phase, "fight");
      const check = B.conditions.evaluate(state, state.units[0], B.skills.find("yangshuran.juedui"));
      assert.equal(check.ok, false);
      assert.match(check.reason, /只能用一次/);
    }
  },
  {
    name: "杨舒然·高猿长啸：每标准回合 30 真伤计击溃值，行动前掷骰 2-5 跳过",
    run() {
      const state = mk(CHAR.yangshuran, CHAR.dummy, 3);
      state.units[0].charge = { skillId: "yangshuran.gaoyuan", amount: 2 };
      cast(state, "a", "yangshuran.gaoyuan", "b");
      const effect = state.units[1].effects.find((e) => e.label === "高猿长啸");
      assert.ok(effect, "持续效果挂在目标身上");
      assert.equal(effect.remain, 6);
      assert.deepEqual(effect.gate.cancel, [2, 3, 4, 5]);

      const hpBefore = state.units[1].hp;
      state.round += 1;
      const events = [];
      B.effectOps.roundEnd(state, events);
      const hits = events.filter((e) => e.type === "damage");
      assert.equal(hits.length, 1, "每标准回合固定一次伤害，与掷骰无关");
      assert.equal(hits[0].amount, 30);
      assert.equal(hits[0].damageType, "true");
      assert.equal(hits[0].noBreak, false, "这 30 点要计击溃值");
      assert.equal(state.units[1].hp, hpBefore - 30);
      assert.equal(state.units[1].breakValue, 1);

      const seen = {};
      for (let seed = 1; seed <= 24; seed++) {
        const s = mk(CHAR.yangshuran, CHAR.dummy, seed);
        s.units[0].charge = { skillId: "yangshuran.gaoyuan", amount: 2 };
        cast(s, "a", "yangshuran.gaoyuan", "b");
        s.turnUid = "b";
        s.units[1].actionsLeft = 1;
        const before = s.units[0].hp;
        const ev = [];
        B.actions.execute(s, { kind: "basic", type: "attack", target: "a" }, ev);
        const roll = ev.find((e) => e.type === "dice");
        if (!roll) continue;
        if ([2, 3, 4, 5].includes(roll.value)) {
          seen.skip = true;
          assert.ok(ev.some((e) => e.type === "actionCanceled"), "掷出 " + roll.value + " 应跳过行动");
          assert.equal(s.units[0].hp, before, "行动没有发生");
        } else {
          seen.pass = true;
          assert.ok(!ev.some((e) => e.type === "actionCanceled"));
          assert.ok(s.units[0].hp < before, "掷出 " + roll.value + " 行动正常结算");
        }
      }
      assert.ok(seen.skip && seen.pass, "跳过与放行两种分支都要覆盖");
    }
  },
  {
    name: "包必冉·无能狂怒：挂在自己身上，每个自身回合开始时自动普攻一次，共 5 次",
    run() {
      const state = mk(CHAR.baobiran, CHAR.dummy);
      state.units[0].mp = 5;
      cast(state, "a", "baobiran.wuneng", "b");
      const self = state.units[0];
      const effect = self.effects.find((e) => e.label === "无能狂怒");
      assert.ok(effect, "持续效果应挂在包必冉自己身上");
      assert.equal(effect.when, "turnStart");
      assert.equal(effect.remain, 5);
      assert.equal(state.units[1].effects.length, 0, "不应挂到敌方身上");

      let total = 0;
      for (let turn = 0; turn < 5; turn++) {
        const events = [];
        B.effectOps.turnStart(state, self, events);
        events.filter((e) => e.type === "damage").forEach((e) => {
          assert.equal(e.damageType, "magic");
          total += e.amount;
        });
        const roundEvents = [];
        B.effectOps.roundEnd(state, roundEvents);
        assert.ok(!roundEvents.some((e) => e.type === "damage"), "标准回合末不应重复结算");
      }
      assert.equal(total, 5 * 35);
      assert.equal(9999 - state.units[1].hp, 175);
      assert.equal(self.effects.length, 0, "5 个自身回合后到期");
    }
  },
  {
    name: "包必冉·三杯不过岗：掷 2/4/6 伤害翻倍转真伤，掷 1/3/5 转回血",
    run() {
      const seen = {};
      for (let seed = 1; seed <= 20 && (!seen.hit || !seen.heal); seed++) {
        const state = mk(CHAR.baobiran, CHAR.dummy, seed);
        state.units[0].hp = 100;
        state.turnUid = "a";
        state.units[0].actionsLeft = 1;
        const events = [];
        B.actions.execute(state, { kind: "basic", type: "attack", target: "b" }, events);
        const damage = events.find((e) => e.type === "damage");
        const heal = events.find((e) => e.type === "heal");
        if (damage) {
          assert.equal(damage.damageType, "true");
          assert.equal(damage.amount, 90);
          assert.equal(state.units[0].hp, 100);
          seen.hit = true;
        } else {
          assert.ok(heal, "没有伤害时应有一条回血");
          assert.equal(heal.raw, 45);
          assert.equal(state.units[0].hp, 145);
          seen.heal = true;
        }
      }
      assert.ok(seen.hit && seen.heal, "两个分支都应覆盖");
    }
  },
  {
    name: "宋知远·电摩冲击：攻速每回合递增并封顶，期间不能放技能",
    run() {
      const state = mk(CHAR.songzhiyuan, CHAR.dummy);
      state.units[0].charge = { skillId: "songzhiyuan.dianmo", amount: 3 };
      cast(state, "a", "songzhiyuan.dianmo", "a");
      const check = B.conditions.evaluate(state, state.units[0], B.skills.find("songzhiyuan.shuijiao"));
      assert.match(check.reason, /被封锁/);
      const start = state.round;
      for (let round = start; round < start + 10; round++) {
        state.round = round;
        B.effectOps.roundEnd(state, []);
      }
      assert.equal(B.state.statOf(state.units[0], "spd"), 170);
      assert.equal(B.state.statOf(state.units[0], "atk"), 230);
    }
  },
  {
    name: "宋知远·睡觉：防抗 +45、每回合血量上限 +80 并回血，期间视为击溃",
    run() {
      const state = mk(CHAR.songzhiyuan, CHAR.dummy);
      state.units[0].hp = 1000;
      state.units[0].mp = 5;
      cast(state, "a", "songzhiyuan.shuijiao", "a");
      assert.equal(B.state.statOf(state.units[0], "def"), 165);
      assert.equal(B.state.statOf(state.units[0], "mres"), 75);
      assert.equal(state.units[0].taunt, 3);
      assert.equal(B.state.canAct(state.units[0]), false);
      assert.equal(state.units[0].breakValue, 0, "睡觉期间视为击溃，击溃值固定 0");
      B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "true", amount: 10 }, []);
      assert.equal(state.units[0].breakValue, 0, "击溃状态下受伤也不涨");
      const start = state.round;
      for (let round = start; round < start + 3; round++) {
        state.round = round;
        B.effectOps.roundEnd(state, []);
      }
      assert.equal(B.state.maxHpOf(state.units[0]), 1440);
      assert.equal(state.units[0].hp, 1440);
    }
  },
  {
    name: "宋知远·肥龙在天：等量普伤 + 真伤，3 击溃值并立即击溃",
    run() {
      const state = mk(CHAR.songzhiyuan, CHAR.dummy);
      state.units[0].charge = { skillId: "songzhiyuan.feilong", amount: 1 };
      const before = state.units[1].hp;
      const events = [];
      B.skills.execute(state, state.units[0], { kind: "skill", skillId: "songzhiyuan.feilong", target: "b" }, events);
      assert.equal(before - state.units[1].hp, 140 + 180);
      const damages = events.filter((e) => e.type === "damage");
      assert.deepEqual(damages.map((e) => e.damageType), ["phys", "true"]);
      assert.equal(state.units[1].breakValue, 0, "进入击溃后击溃值归零");
      const brk = state.units[1].statuses.find((s) => s.kind === "break");
      assert.equal(brk.remain, 8, "按击溃值 5 进入击溃：5 段伤害 2 点 + 技能 3 点，封顶 5");
    }
  },
  {
    name: "宋知远·皮糙肉厚：每次伤害先掷骰，1/3/5 整体免疫，2/4/6 正常结算",
    run() {
      const state = mk(CHAR.songzhiyuan, CHAR.dummy);
      const me = state.units[0];
      let dodged = 0;
      let taken = 0;
      for (let i = 0; i < 24; i++) {
        me.hp = 1200;
        me.breakValue = 0;
        const events = [];
        B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "true", amount: 100 }, events);
        const roll = events.find((e) => e.type === "dice");
        assert.ok(roll, "每次伤害都应掷骰");
        assert.equal(roll.uid, "a", "骰子是毛毛自己掷的");
        const hit = events.find((e) => e.type === "damage");
        if ([1, 3, 5].includes(roll.value)) {
          dodged += 1;
          assert.equal(me.hp, 1200, "免疫时不掉血");
          assert.equal(hit, undefined, "免疫时不产生伤害事件");
          assert.equal(me.breakValue, 0, "免疫时不加击溃值");
          assert.ok(events.some((e) => e.type === "dodge"), "应记录闪避");
        } else {
          taken += 1;
          assert.equal(me.hp, 1100, "2/4/6 正常掉血");
          assert.equal(hit.amount, 100);
          assert.equal(me.breakValue, 1, "正常伤害加击溃值");
        }
      }
      assert.ok(dodged > 0 && taken > 0, "24 次应覆盖两种结果：" + dodged + "/" + taken);
    }
  },
  {
    name: "宋知远·皮糙肉厚：Buff 持续伤害、反弹与被动强制普攻也要掷骰",
    run() {
      const state = mk(CHAR.songzhiyuan, CHAR.dummy);
      const buffEvents = [];
      B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "true", amount: 40, fromBuff: true }, buffEvents);
      assert.ok(buffEvents.some((e) => e.type === "dice"), "Buff 伤害要掷骰");
      const reactEvents = [];
      B.damage.hit(state, {
        sourceUid: "b", targetUid: "a", type: "true", amount: 40, noReaction: true, reflected: true
      }, reactEvents);
      assert.ok(reactEvents.some((e) => e.type === "dice"), "反弹/反击这类二次伤害也要掷骰");
      const normal = mk(CHAR.liuwenzhe, CHAR.dummy);
      const plainEvents = [];
      B.damage.hit(normal, { sourceUid: "b", targetUid: "a", type: "true", amount: 40 }, plainEvents);
      assert.equal(plainEvents.some((e) => e.type === "dice"), false, "别的角色不掷骰");
    }
  },
  {
    name: "宋知远·皮糙肉厚：血 ≤600 时每个标准回合开始回 25，605 不回",
    run() {
      const state = mk(CHAR.songzhiyuan, CHAR.dummy);
      const me = state.units[0];
      me.hp = 600;
      const events = [];
      B.effectOps.roundStart(state, events);
      assert.equal(me.hp, 625);
      const heal = events.find((e) => e.type === "heal");
      assert.equal(heal.amount, 25);
      assert.equal(heal.label, "皮糙肉厚");
      me.hp = 605;
      B.effectOps.roundStart(state, []);
      assert.equal(me.hp, 605, "605 不回血");
      me.hp = 1200;
      B.effectOps.roundStart(state, []);
      assert.equal(me.hp, 1200, "满血不回血");
    }
  },
  {
    name: "宋知远·皮糙肉厚：不会被赋予脆弱/恐慌，已有的在标准回合开始清掉",
    run() {
      const state = mk(CHAR.songzhiyuan, CHAR.dummy);
      const me = state.units[0];
      const events = [];
      B.effectOps.runOps(state, { sourceUid: "b", targetUid: "a", skillId: "test", label: "测试" }, [
        { op: "buff", kind: "fragile", who: "target", percent: 20, duration: 5 },
        { op: "buff", kind: "panic", who: "target", percent: 20, duration: 5 }
      ], events);
      assert.equal(me.buffs.length, 0, "两种 Debuff 都加不进来");
      assert.equal(events.filter((e) => e.type === "buffImmune").length, 2);

      me.buffs.push({ kind: "panic", percent: 20, remain: 3, unit: "standard", source: "x", label: "恐慌", stacking: true });
      const stripEvents = [];
      B.effectOps.roundStart(state, stripEvents);
      assert.equal(me.buffs.length, 0, "标准回合开始清掉残留");
      assert.ok(stripEvents.some((e) => e.type === "buffImmune" && e.kind === "panic"));

      const other = mk(CHAR.liuwenzhe, CHAR.dummy);
      B.effectOps.runOps(other, { sourceUid: "a", targetUid: "b", skillId: "test", label: "测试" }, [
        { op: "buff", kind: "panic", who: "target", percent: 20, duration: 5 }
      ], []);
      assert.equal(other.units[1].buffs.length, 1, "别的角色照常中恐慌");
    }
  },
  {
    name: "张家铭·小行星撞击：伤害按目标防御 ×6 计算",
    run() {
      const state = mk(CHAR.zhangjiaming, CHAR.dummy);
      state.units[0].charge = { skillId: "zhangjiaming.xiaoxingxing", amount: 2 };
      const before = state.units[1].hp;
      cast(state, "a", "zhangjiaming.xiaoxingxing", "b");
      assert.equal(before - state.units[1].hp, 40 * 6 - 40);
      assert.equal(state.units[1].breakValue, 0);
    }
  },
  {
    name: "张家铭·塞进垃圾桶：300 普伤、眩晕 5 回合、之后每个敌方回合 50 真伤且永久",
    run() {
      const state = mk(CHAR.zhangjiaming, CHAR.dummy);
      state.units[0].mp = 5;
      state.units[0].charge = { skillId: "zhangjiaming.saijin", amount: 3 };
      const before = state.units[1].hp;
      cast(state, "a", "zhangjiaming.saijin", "b");
      assert.equal(before - state.units[1].hp, 260);
      assert.equal(state.units[1].statuses.find((s) => s.kind === "stun").remain, 5);
      const effect = state.units[1].effects[0];
      assert.equal(effect.unit, "targetRound");
      assert.equal(effect.remain, B.state.PERMANENT);

      const lost = [];
      for (let i = 0; i < 6; i++) {
        const events = [];
        B.effectOps.turnEnd(state, state.units[1], events);
        events.filter((e) => e.type === "damage").forEach((e) => lost.push(e.amount));
      }
      assert.deepEqual(lost, [50, 50, 50, 50, 50, 50]);
      assert.equal(state.units[1].effects.length, 1, "永久效果不应到期");
      assert.equal(state.units[1].breakValue, 1, "只有那一次 300 普伤加了 1 点，持续伤害不加");
    }
  },
  {
    name: "张家铭·秋风扫落叶：5 个标准回合各受一次普攻伤害",
    run() {
      const state = mk(CHAR.zhangjiaming, CHAR.dummy);
      state.units[0].mp = 5;
      state.units[0].charge = { skillId: "zhangjiaming.qiufeng", amount: 1 };
      cast(state, "a", "zhangjiaming.qiufeng", "b");
      const start = state.round;
      let total = 0;
      for (let round = start; round < start + 5; round++) {
        state.round = round;
        const events = [];
        B.effectOps.roundEnd(state, events);
        events.filter((e) => e.type === "damage").forEach((e) => { total += e.amount; });
      }
      assert.equal(total, 5 * 90);
      assert.equal(state.units[1].effects.length, 0);
    }
  },
  {
    name: "王荣逸·刷题：叠层、加属性与上限、清空击溃值，满 3 层后不能再刷",
    run() {
      const state = mk(CHAR.wangrongyi, CHAR.dummy);
      state.units[0].mp = 10;
      state.units[0].breakValue = 4;
      cast(state, "a", "wangrongyi.shuati", "a");
      assert.equal(B.state.markOf(state.units[0], "shuati"), 1);
      assert.equal(B.state.statOf(state.units[0], "atk"), 80);
      assert.equal(B.state.statOf(state.units[0], "def"), 65);
      assert.equal(B.state.statOf(state.units[0], "spd"), 80);
      assert.equal(B.state.statOf(state.units[0], "mres"), 20);
      assert.equal(B.state.maxHpOf(state.units[0]), 480);
      assert.equal(state.units[0].hp, 480);
      assert.equal(B.state.maxMpOf(state.units[0]), 18, "15+3=18，蓝上限只向下取整到个位");
      assert.equal(state.units[0].breakValue, 0);

      cast(state, "a", "wangrongyi.shuati", "a");
      cast(state, "a", "wangrongyi.shuati", "a");
      assert.equal(B.state.markOf(state.units[0], "shuati"), 3);
      assert.throws(() => cast(state, "a", "wangrongyi.shuati", "a"), /刷题已满 3 层/);
    }
  },
  {
    name: "王荣逸·习题轰炸：伤害随刷题层数变化，0 层不能放",
    run() {
      const none = mk(CHAR.wangrongyi, CHAR.dummy);
      none.units[0].mp = 10;
      assert.throws(() => cast(none, "a", "wangrongyi.xiti", "b"), /需要先刷题/);

      const expected = [100, 150, 210];
      for (let layer = 1; layer <= 3; layer++) {
        const state = mk(CHAR.wangrongyi, CHAR.dummy);
        state.units[0].mp = 10;
        for (let i = 0; i < layer; i++) cast(state, "a", "wangrongyi.shuati", "a");
        state.units[0].charge = { skillId: "wangrongyi.xiti", amount: 1 };
        const before = state.units[1].hp;
        const mpBefore = state.units[0].mp;
        cast(state, "a", "wangrongyi.xiti", "b");
        assert.equal(before - state.units[1].hp, expected[layer - 1] - 40);
        assert.equal(state.units[0].mp, mpBefore + 2);
        assert.equal(state.units[1].statuses.find((s) => s.kind === "stun").remain, 3);
      }
    }
  },
  {
    name: "王荣逸·满分嘲讽：240 真伤 + 每层刷题 150",
    run() {
      const state = mk(CHAR.wangrongyi, CHAR.dummy);
      state.units[0].mp = 20;
      cast(state, "a", "wangrongyi.shuati", "a");
      cast(state, "a", "wangrongyi.shuati", "a");
      state.units[0].charge = { skillId: "wangrongyi.manfen", amount: 3 };
      const before = state.units[1].hp;
      cast(state, "a", "wangrongyi.manfen", "b");
      assert.equal(before - state.units[1].hp, 540);
    }
  },
  {
    name: "标记：对手能看见，也能被对手削减与清空",
    run() {
      const state = mk(CHAR.wangrongyi, CHAR.liuwenzhe);
      state.units[0].mp = 10;
      cast(state, "a", "wangrongyi.shuati", "a");
      cast(state, "a", "wangrongyi.shuati", "a");
      assert.equal(B.state.markOf(state.units[0], "shuati"), 2);

      const opp = { sourceUid: "b", targetUid: "a", skillId: "test" };
      B.effectOps.runOps(state, opp, [{ op: "mark", who: "target", key: "shuati", delta: -1 }], []);
      assert.equal(B.state.markOf(state.units[0], "shuati"), 1);

      B.effectOps.runOps(state, opp, [{ op: "dispel", who: "target", scope: "marks" }], []);
      assert.equal(B.state.markOf(state.units[0], "shuati"), 0);
    }
  },
  {
    name: "标记计入状态指纹：改标记就改指纹",
    run() {
      const state = mk(CHAR.wangrongyi, CHAR.dummy);
      state.units[0].mp = 10;
      const before = B.state.hash(state);
      cast(state, "a", "wangrongyi.shuati", "a");
      assert.notEqual(B.state.hash(state), before);
    }
  },
  {
    name: "庄文希·星流霆击：一次普攻 2 段，都不加击溃与眩晕值",
    run() {
      const state = mk(CHAR.zhuangwenxi, CHAR.dummy);
      const r = basic(state, "b");
      const hits = r.events.filter((e) => e.type === "damage");
      assert.equal(hits.length, 2);
      assert.equal(hits[0].noBreak, true);
      assert.equal(state.units[1].breakValue, 0);
      assert.equal(state.units[1].stunValue, 0);
    }
  },
  {
    name: "被动技能不可释放：界面会置灰，点击不消耗行动",
    run() {
      const state = mk(CHAR.zhuangwenxi, CHAR.dummy);
      const check = B.conditions.evaluate(state, state.units[0], B.skills.find("zhuangwenxi.xingliu"));
      assert.equal(check.ok, false);
      assert.match(check.reason, /被动技能/);
      assert.throws(() => cast(state, "a", "zhuangwenxi.xingliu", "b"), /被动技能/);
    }
  },
  {
    name: "庄文希·降维打击：前 3 次必触发蓝上限 −2，第 4 次起 8 面骰出 6 才触发",
    run() {
      const state = mk(CHAR.zhuangwenxi, CHAR.dummy);
      for (let i = 0; i < 3; i++) basic(state, "b");
      assert.equal(B.state.maxMpOf(state.units[1]), 4, "10 − 3×2 = 4");
      assert.equal(B.state.markOf(state.units[0], "dim"), 3);

      let found = null;
      for (let seed = 1; seed < 200 && !found; seed++) {
        const s = mk(CHAR.zhuangwenxi, CHAR.dummy, seed);
        for (let i = 0; i < 3; i++) basic(s, "b");
        const r = basic(s, "b");
        const dice = r.events.find((e) => e.type === "dice");
        if (dice && dice.value === 6) found = s;
      }
      assert.ok(found, "应能找到一个第 4 次普攻掷出 6 的种子");
      assert.equal(B.state.maxMpOf(found.units[1]), 2, "10 − 3×2 − 2 = 2");
    }
  },
  {
    name: "庄文希·力挽狂澜：速度 set 100、普攻 3 段、每动作追加 15 真伤与 15% 脆弱",
    run() {
      const state = mk(CHAR.zhuangwenxi, CHAR.dummy);
      cast(state, "a", "zhuangwenxi.liwan", "a");
      assert.equal(B.state.statOf(state.units[0], "spd"), 100);
      assert.equal(state.units[0].statuses.find((s) => s.kind === "wlk").remain, 8);

      const before = state.units[1].hp;
      const r = basic(state, "b");
      const hits = r.events.filter((e) => e.type === "damage");
      assert.equal(hits.length, 4, "3 段普伤 + 1 段 15 真伤");
      assert.equal(before - state.units[1].hp, 15);
      const fragile = state.units[1].buffs.find((b) => b.kind === "fragile");
      assert.equal(fragile.percent, 15);
      assert.equal(fragile.remain, 8);
      assert.equal(fragile.stacking, false, "同一来源只刷新，不叠加");
      assert.equal(state.units[1].breakValue, 1, "只有 15 真伤这一段加击溃值");
    }
  },
  {
    name: "张克太·吉罢之歌：5 回合 60 法伤，加击溃值不加眩晕值，施法者被击晕即断",
    run() {
      const state = mk(CHAR.zhangketa, CHAR.dummy);
      state.units[0].mp = 10;
      cast(state, "a", "zhangketa.jiba", "b");
      const effect = state.units[1].effects[0];
      assert.equal(effect.remain, 5);

      const events = [];
      B.effectOps.runOps(state, B.effectOps.ctxOfEffect(effect), effect.ops, events);
      assert.equal(events.find((e) => e.type === "damage").amount, 45);
      assert.equal(state.units[1].breakValue, 1);
      assert.equal(state.units[1].stunValue, 0);

      const cut = mk(CHAR.zhangketa, CHAR.dummy);
      cut.units[0].mp = 10;
      cast(cut, "a", "zhangketa.jiba", "b");
      B.state.addStatus(cut.units[0], { kind: "stun", remain: 3, label: "眩晕" });
      const cutEvents = [];
      B.effectOps.roundEnd(cut, cutEvents);
      assert.equal(cut.units[1].effects.length, 0);
      assert.ok(cutEvents.some((e) => e.type === "effectExpire"));
    }
  },
  {
    name: "张克太·副班主任之威：前 5 回合无法行动，后 5 回合只能普攻",
    run() {
      const state = mk(CHAR.zhangketa, CHAR.dummy);
      state.units[0].mp = 20;
      state.units[0].charge = { skillId: "zhangketa.fubanzhuren", amount: 4 };
      cast(state, "a", "zhangketa.fubanzhuren", "a");
      assert.equal(B.state.statOf(state.units[0], "atk"), 235);
      assert.equal(B.state.statOf(state.units[0], "spd"), 150);
      assert.equal(state.units[0].statuses.find((s) => s.kind === "cannotAct").remain, 5);

      for (let round = 1; round <= 5; round++) endRound(state, round);
      assert.equal(state.units[0].statuses.some((s) => s.kind === "cannotAct"), false);
      assert.equal(state.units[0].statuses.find((s) => s.kind === "noSkill").remain, 5);
      assert.ok(state.units[0].statuses.some((s) => s.kind === "onlyBasic"));

      const list = B.actions.list(state);
      assert.equal(list.find((x) => x.type === "break").enabled, false);
      assert.equal(list.find((x) => x.type === "chargeMp").enabled, false);
      assert.equal(list.find((x) => x.type === "attack").enabled, true);
      assert.equal(
        B.conditions.evaluate(state, state.units[0], B.skills.find("zhangketa.jiba")).reason,
        "现在只能普攻"
      );

      for (let round = 6; round <= 10; round++) endRound(state, round);
      assert.equal(state.units[0].statuses.some((s) => s.kind === "noSkill"), false);
      assert.equal(B.state.statOf(state.units[0], "atk"), 125);
    }
  },
  {
    name: "张克太·LSP：开局给场上女角色加减益，男角色不受影响",
    run() {
      const state = mk(CHAR.zhangketa, CHAR.zhuangwenxi);
      const female = state.units[1];
      assert.equal(B.state.statOf(female, "atk"), 50);
      assert.equal(B.state.statOf(female, "def"), 40);
      assert.equal(B.state.statOf(female, "spd"), 80);
      assert.equal(B.state.statOf(female, "mres"), 15);
      assert.equal(B.state.statOf(state.units[0], "atk"), 125);
    }
  },
  {
    name: "张克太·愈挫愈勇：每 3 次造成伤害 / 受伤 / 属性削弱各触发一次加成",
    run() {
      const state = mk(CHAR.zhangketa, CHAR.dummy);
      for (let i = 0; i < 3; i++) basic(state, "b");
      assert.equal(B.state.statOf(state.units[0], "atk"), 130);
      assert.equal(B.state.markOf(state.units[0], "dealt"), 0);

      for (let i = 0; i < 3; i++) {
        B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "phys", amount: 200 }, []);
      }
      assert.equal(B.state.statOf(state.units[0], "def"), 15);

      const ctx = { sourceUid: "b", targetUid: "a", skillId: "test" };
      B.effectOps.runOps(state, ctx, [{ op: "stat", stat: "atk", who: "target", mode: "add", value: -5 }], []);
      B.effectOps.runOps(state, ctx, [{ op: "stat", stat: "def", who: "target", mode: "add", value: -5 }], []);
      B.effectOps.runOps(state, ctx, [{ op: "stat", stat: "spd", who: "target", mode: "add", value: -5 }], []);
      assert.equal(B.state.statOf(state.units[0], "mres"), 15);
      assert.equal(B.state.statOf(state.units[0], "spd"), 40);
      assert.equal(B.state.markOf(state.units[0], "drain"), 0);
    }
  },
  {
    name: "金圣杰·在杰难逃：每 3 段降攻防、每 5 段降速抗与血上限",
    run() {
      const state = mk(CHAR.jinshengjie, CHAR.dummy);
      for (let i = 0; i < 5; i++) basic(state, "b");
      const target = state.units[1];
      assert.equal(B.state.statOf(target, "atk"), 5);
      assert.equal(B.state.statOf(target, "def"), 35);
      assert.equal(B.state.statOf(target, "spd"), 75);
      assert.equal(B.state.statOf(target, "mres"), 25);
      assert.equal(B.state.maxHpOf(target), 9965, "9999 − 30 再按 5 的倍数向下取");
      assert.equal(B.state.markOf(state.units[0], "hit3"), 2);
      assert.equal(B.state.markOf(state.units[0], "hit5"), 0);
    }
  },
  {
    name: "金圣杰·杰除封印：+70/+40/−100，之后每 2 回合递减，8 回合后一起移除",
    run() {
      const state = mk(CHAR.jinshengjie, CHAR.dummy);
      state.units[0].charge = { skillId: "jinshengjie.jiechu", amount: 1 };
      cast(state, "a", "jinshengjie.jiechu", "a");
      assert.equal(B.state.statOf(state.units[0], "atk"), 205);
      assert.equal(B.state.statOf(state.units[0], "spd"), 65);
      assert.equal(B.state.statOf(state.units[0], "mres"), 0);

      for (let round = 1; round <= 8; round++) endRound(state, round);
      assert.equal(B.state.statOf(state.units[0], "atk"), 135);
      assert.equal(B.state.statOf(state.units[0], "spd"), 25);
      assert.equal(B.state.statOf(state.units[0], "mres"), 100);
    }
  },
  {
    name: "金圣杰·万杰不复：20% 脆弱/恐慌，每标准回合强扣 5% 血上限",
    run() {
      const state = mk(CHAR.jinshengjie, CHAR.dummy);
      state.units[0].mp = 5;
      state.units[0].charge = { skillId: "jinshengjie.wanjie", amount: 1 };
      cast(state, "a", "jinshengjie.wanjie", "b");
      assert.equal(state.units[1].buffs.find((b) => b.kind === "fragile").percent, 20);
      assert.equal(state.units[1].buffs.find((b) => b.kind === "panic").percent, 20);
      const effect = state.units[1].effects[0];
      assert.equal(effect.remain, 8);

      const events = [];
      B.effectOps.runOps(state, B.effectOps.ctxOfEffect(effect), effect.ops, events);
      assert.equal(events.find((e) => e.type === "directLoss").amount, 500);
      assert.equal(state.units[1].breakValue, 0);
      assert.equal(state.units[1].stunValue, 0);
    }
  },
  {
    name: "金圣杰·杰骜不驯：n 满时闪避、回血、反击，且不触发对手的命中后被动",
    run() {
      const state = mk(CHAR.jinshengjie, CHAR.liuwenzhe);
      state.units[0].marks.jien.value = 6;
      state.turnUid = "b";
      state.units[1].actionsLeft = 1;
      const hp0 = state.units[0].hp;
      const osHp0 = state.units[1].hp;
      const r = basic(state, "a");
      assert.equal(state.units[0].hp, hp0);
      assert.equal(osHp0 - state.units[1].hp, 125);
      assert.equal(state.units[0].marks.jien.value, 0);
      assert.ok(r.events.some((e) => e.type === "dodge"));
      assert.equal(r.events.some((e) => e.type === "directLoss"), false);
    }
  },
  {
    name: "金圣杰·光：6 蓝超过蓝上限，永远不可释放",
    run() {
      const state = mk(CHAR.jinshengjie, CHAR.dummy);
      state.units[0].mp = 5;
      const check = B.conditions.evaluate(state, state.units[0], B.skills.find("jinshengjie.guang"));
      assert.equal(check.ok, false);
      assert.match(check.reason, /缺 1 蓝/);
      assert.throws(() => cast(state, "a", "jinshengjie.guang", "b"), /缺 1 蓝/);
    }
  },
  {
    name: "田誉清·耐久：开局 3，普攻 −1，耐久 0 时普攻禁用",
    run() {
      const state = mk(CHAR.tianyuqing, CHAR.dummy);
      assert.equal(B.state.markOf(state.units[0], "naijiu"), 3);
      const r = basic(state, "b");
      assert.equal(B.state.markOf(state.units[0], "naijiu"), 2);
      assert.equal(r.events.find((e) => e.type === "damage").amount, 150);

      state.units[0].marks.naijiu.value = 0;
      assert.throws(() => basic(state, "b"), /耐久不足/);
      const list = B.actions.list(state);
      assert.equal(list.find((x) => x.type === "attack").enabled, false);
      assert.match(list.find((x) => x.type === "attack").reason, /耐久不足/);
    }
  },
  {
    name: "田誉清·霰弹枪：输入 n，扣 n 蓝与 2 耐久，造成 3n 段普伤",
    run() {
      const state = mk(CHAR.tianyuqing, CHAR.dummy);
      state.units[0].mp = 5;
      state.units[0].charge = { skillId: "tianyuqing.pen", amount: 1 };
      const before = state.units[1].hp;
      const r = cast(state, "a", "tianyuqing.pen", "b", { n: 2 });
      assert.equal(before - state.units[1].hp, 720);
      assert.equal(state.units[0].mp, 3);
      assert.equal(B.state.markOf(state.units[0], "naijiu"), 1);
      assert.equal(r.events.filter((e) => e.type === "damage").length, 6);
      assert.equal(r.committed.n, 2);

      const low = mk(CHAR.tianyuqing, CHAR.dummy);
      low.units[0].mp = 5;
      low.units[0].marks.naijiu.value = 1;
      assert.throws(() => cast(low, "a", "tianyuqing.pen", "b", { n: 1 }), /耐久不足 2/);

      const over = mk(CHAR.tianyuqing, CHAR.dummy);
      over.units[0].mp = 5;
      over.units[0].charge = { skillId: "tianyuqing.pen", amount: 1 };
      assert.throws(() => cast(over, "a", "tianyuqing.pen", "b", { n: 6 }), /需要支付 1 到 5 蓝/);
    }
  },
  {
    name: "田誉清·重机枪：速度 1000 持续 50 回合，期间霰弹枪禁用",
    run() {
      const state = mk(CHAR.tianyuqing, CHAR.dummy);
      state.units[0].mp = 5;
      state.units[0].charge = { skillId: "tianyuqing.zhongji", amount: 3 };
      cast(state, "a", "tianyuqing.zhongji", "a");
      assert.equal(B.state.statOf(state.units[0], "spd"), 1000);
      const lock = state.units[0].statuses.find((s) => s.kind === "noSkill" && s.skillId === "tianyuqing.pen");
      assert.ok(lock);
      assert.equal(lock.remain, 50);
      const check = B.conditions.evaluate(state, state.units[0], B.skills.find("tianyuqing.pen"));
      assert.equal(check.ok, false);
      assert.match(check.reason, /霰弹枪禁用/);
      assert.equal(B.conditions.evaluate(state, state.units[0], B.skills.find("tianyuqing.zhi")).ok, true);
      assert.equal(B.state.statOf(state.units[0], "spd"), 1000);
    }
  },
  {
    name: "田誉清·纸质工艺：耐久 +2 无上限，攻击 +30 永久可叠加",
    run() {
      const state = mk(CHAR.tianyuqing, CHAR.dummy);
      state.units[0].mp = 10;
      cast(state, "a", "tianyuqing.zhi", "a");
      assert.equal(B.state.markOf(state.units[0], "naijiu"), 5);
      assert.equal(B.state.statOf(state.units[0], "atk"), 220);
      cast(state, "a", "tianyuqing.zhi", "a");
      cast(state, "a", "tianyuqing.zhi", "a");
      assert.equal(B.state.markOf(state.units[0], "naijiu"), 9);
      assert.equal(B.state.statOf(state.units[0], "atk"), 280);
    }
  },
  {
    name: "田誉清·皮筋枪械：普攻掷 1 哑火、掷 6 攻击值翻倍，两种都消耗 1 耐久",
    run() {
      const find = (side) => {
        for (let seed = 1; seed < 300; seed++) {
          const s = mk(CHAR.tianyuqing, CHAR.dummy, seed);
          const r = basic(s, "b");
          const dice = r.events.find((e) => e.type === "dice");
          if (dice && dice.value === side) return { state: s, r };
        }
        return null;
      };

      const misfire = find(1);
      assert.ok(misfire, "应能找到掷出 1 的种子");
      assert.ok(misfire.r.events.some((e) => e.type === "misfire"));
      assert.equal(misfire.r.events.some((e) => e.type === "damage"), false);
      assert.equal(B.state.markOf(misfire.state.units[0], "naijiu"), 2);

      const double = find(6);
      assert.ok(double, "应能找到掷出 6 的种子");
      assert.equal(double.r.events.find((e) => e.type === "damage").amount, 340);
      assert.equal(B.state.markOf(double.state.units[0], "naijiu"), 2);
    }
  },
  {
    name: "田誉清·霰弹枪：动作里的 n 写进战报，回放一致",
    run() {
      const created = B.battle.create({
        seed: 13,
        a: withSheet(CHAR.tianyuqing),
        b: withSheet(CHAR.dummy)
      });
      created.state.units[0].mp = 5;
      created.state.units[0].charge = { skillId: "tianyuqing.pen", amount: 1 };
      const action = { kind: "skill", skillId: "tianyuqing.pen", target: "b", n: 2 };
      const applied = B.battle.apply(created.state, action);
      const replayed = B.battle.replay(created.state, [action]);
      assert.equal(B.state.hash(applied.state), B.state.hash(replayed.state));
      assert.equal(applied.committed.n, 2);
    }
  },
  {
    name: "田誉清·霰弹枪：蓝为 0 时不能释放",
    run() {
      const state = mk(CHAR.tianyuqing, CHAR.dummy);
      state.units[0].mp = 0;
      const check = B.conditions.evaluate(state, state.units[0], B.skills.find("tianyuqing.pen"));
      assert.equal(check.ok, false);
      assert.match(check.reason, /至少 1 蓝|缺/);
    }
  },
  {
    name: "召唤物：无血计时物 4 回合后自爆，伤害不加击溃",
    run() {
      const state = mk(CHAR.liubinlu, CHAR.dummy);
      state.units[0].mp = 5;
      state.units[0].charge = { skillId: "liubinlu.xingying", amount: 1 };
      cast(state, "a", "liubinlu.xingying", "a");
      const summon = state.summons[0];
      assert.equal(summon.summonKey, "liubinlu.xiaoliu");
      assert.equal(summon.targetable, false);
      assert.equal(summon.ttl.remain, 4);

      let total = 0;
      for (let round = 1; round <= 4; round++) {
        endRound(state, round).filter((e) => e.type === "damage").forEach((e) => { total += e.amount; });
      }
      assert.equal(total, 70);
      assert.equal(state.units[1].breakValue, 0);
      assert.equal(state.summons.length, 0);
    }
  },
  {
    name: "召唤物：有血可击杀、死亡不影响胜负、英雄死亡清场",
    run() {
      const state = mk(CHAR.yangshuhan, CHAR.dummy);
      state.units[0].mp = 10;
      state.units[0].hpLost = 500;
      cast(state, "a", "yangshuhan.mu", "a");
      /* 王霸之气的持续真伤会混进来，先摘掉，只看墓的出手 */
      state.units[1].effects = [];
      state.units[1].breakValue = 0;
      const tomb = state.summons[0];
      assert.equal(tomb.targetable, true);
      assert.equal(tomb.hp, 1200);

      B.damage.hit(state, { sourceUid: "b", targetUid: tomb.uid, type: "true", amount: 2000 }, []);
      assert.equal(state.summons.length, 0);
      assert.equal(state.phase, "fight");

      const state2 = mk(CHAR.yangshuhan, CHAR.dummy);
      state2.units[0].mp = 10;
      state2.units[0].hpLost = 500;
      cast(state2, "a", "yangshuhan.mu", "a");
      B.damage.hit(state2, { sourceUid: "b", targetUid: "a", type: "true", amount: 9999 }, []);
      assert.equal(state2.phase, "finished");
      assert.equal(state2.summons.length, 0);
    }
  },
  {
    name: "召唤物：单体嘲讽取最高，射手 ignoreTaunt 例外",
    run() {
      const state = mk(CHAR.liubinlu, CHAR.yangshuhan);
      state.units[1].mp = 10;
      state.units[1].hpLost = 500;
      state.turnUid = "b";
      state.units[1].actionsLeft = 1;
      cast(state, "b", "yangshuhan.mu", "b");
      const tomb = state.summons[0];
      state.units[1].taunt = 2;
      state.turnUid = "a";
      state.units[0].actionsLeft = 1;
      assert.throws(
        () => B.actions.execute(state, { kind: "basic", type: "attack", target: tomb.uid }, []),
        /嘲讽最高/
      );
      state.units[1].taunt = 0;
      const r = B.actions.execute(state, { kind: "basic", type: "attack", target: tomb.uid }, []);
      assert.equal(r.target, tomb.uid);

      const sniper = mk(CHAR.yangshuhan, CHAR.tianyuqing);
      sniper.units[0].mp = 10;
      sniper.units[0].hpLost = 500;
      cast(sniper, "a", "yangshuhan.mu", "a");
      sniper.units[0].taunt = 2;
      sniper.turnUid = "b";
      sniper.units[1].actionsLeft = 1;
      const shot = B.actions.execute(sniper, { kind: "basic", type: "attack", target: "a-s1" }, []);
      assert.equal(shot.target, "a-s1");
    }
  },
  {
    name: "召唤物：群体伤害含召唤物，群体增益/治疗只给英雄",
    run() {
      const state = mk(CHAR.xieyuchen, CHAR.yangshuhan);
      state.units[1].mp = 10;
      state.units[1].hpLost = 500;
      state.turnUid = "b";
      state.units[1].actionsLeft = 1;
      cast(state, "b", "yangshuhan.mu", "b");
      const tomb = state.summons[0];
      const heroHp = state.units[1].hp;
      const tombHp = tomb.hp;

      state.turnUid = "a";
      state.units[0].charge = { skillId: "xieyuchen.ernv", amount: 2 };
      cast(state, "a", "xieyuchen.ernv", "b");
      endRound(state, 1);
      assert.equal(heroHp - state.units[1].hp, 30);
      assert.equal(tombHp - tomb.hp, 30);

      const atkBefore = B.state.statOf(state.units[1], "atk");
      const tombAtk = B.state.statOf(tomb, "atk");
      B.effectOps.runOps(state, { sourceUid: "b", targetUid: "b", skillId: "test" }, [
        { op: "stat", who: "allAllies", stat: "atk", mode: "add", value: 10, duration: null }
      ], []);
      assert.equal(B.state.statOf(state.units[1], "atk"), atkBefore + 10);
      assert.equal(B.state.statOf(tomb, "atk"), tombAtk);
    }
  },
  {
    name: "刘滨路·旷课：受击掷 6 免疫并回蓝，动能满 7 全体击溃",
    run() {
      let found = null;
      for (let seed = 1; seed < 200 && !found; seed++) {
        const state = mk(CHAR.liubinlu, CHAR.dummy, seed);
        const hp0 = state.units[0].hp;
        const mp0 = state.units[0].mp;
        B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "phys", amount: 100 }, []);
        if (state.units[0].hp === hp0) found = { state, mp0 };
      }
      assert.ok(found, "应能找到掷出 6 的种子");
      assert.equal(found.state.units[0].mp, found.mp0 + 1);

      const state = mk(CHAR.liubinlu, CHAR.dummy);
      for (let i = 0; i < 7; i++) {
        state.turnUid = "a";
        state.units[0].actionsLeft = 1;
        B.actions.execute(state, { kind: "basic", type: "chargeMp" }, []);
      }
      assert.equal(B.state.markOf(state.units[0], "dongneng"), 0);
      assert.equal(state.units[1].statuses.find((s) => s.kind === "break").remain, 5);
    }
  },
  {
    name: "刘滨路·强制内卷：4 回合每回合 70 攻击值法伤，正常击溃",
    run() {
      const state = mk(CHAR.liubinlu, CHAR.dummy);
      state.units[0].mp = 5;
      cast(state, "a", "liubinlu.neijuan", "b");
      let total = 0;
      for (let round = 1; round <= 4; round++) {
        endRound(state, round).filter((e) => e.type === "damage").forEach((e) => { total += e.amount; });
      }
      assert.equal(total, 200);
      assert.equal(state.units[1].breakValue, 4);
      assert.equal(state.units[1].effects.length, 0);
    }
  },
  {
    name: "正盈利·葵花宝典：2 回合光环，到期再补 75 群普伤",
    run() {
      const state = mk(CHAR.zhengyingli, CHAR.dummy);
      cast(state, "a", "zhengyingli.kuihua", "a");
      assert.equal(state.summons[0].ttl.remain, 2);
      const hp0 = state.units[1].hp;
      endRound(state, 1);
      const after1 = state.units[1].hp;
      endRound(state, 2);
      assert.equal(hp0 - after1, 35);
      assert.equal(after1 - state.units[1].hp, 70, "50 法伤 + 75 普伤各 35");
      assert.equal(state.summons.length, 0);
      assert.equal(state.units[1].breakValue, 0);
    }
  },
  {
    name: "正盈利·独裁主义：每次自己造成伤害召唤 1 本，上限 3",
    run() {
      const state = mk(CHAR.zhengyingli, CHAR.dummy);
      state.units[0].charge = { skillId: "zhengyingli.ducai", amount: 5 };
      cast(state, "a", "zhengyingli.ducai", "a");
      for (let i = 0; i < 5; i++) basic(state, "b");
      assert.equal(state.summons.length, 3);
      assert.equal(state.summons.every((s) => s.summonKey === "zhengyingli.kuihua4"), true);
      assert.equal(state.summons.every((s) => s.ttl.remain === 4), true);
    }
  },
  {
    name: "正盈利·负亏损：首次减攻加防加抗减上限，再放复原攻防抗但不还上限",
    run() {
      const state = mk(CHAR.zhengyingli, CHAR.dummy);
      state.units[0].charge = { skillId: "zhengyingli.fukui", amount: 1 };
      cast(state, "a", "zhengyingli.fukui", "a");
      assert.equal(B.state.statOf(state.units[0], "atk"), 0);
      assert.equal(B.state.statOf(state.units[0], "def"), 155);
      assert.equal(B.state.statOf(state.units[0], "mres"), 100);
      assert.equal(B.state.maxHpOf(state.units[0]), 380);
      state.units[0].charge = { skillId: "zhengyingli.fukui", amount: 1 };
      cast(state, "a", "zhengyingli.fukui", "a");
      assert.equal(B.state.statOf(state.units[0], "atk"), 110);
      assert.equal(B.state.statOf(state.units[0], "def"), 45);
      assert.equal(B.state.statOf(state.units[0], "mres"), 30);
      assert.equal(B.state.maxHpOf(state.units[0]), 380);
      state.units[0].charge = { skillId: "zhengyingli.fukui", amount: 1 };
      cast(state, "a", "zhengyingli.fukui", "a");
      assert.equal(B.state.maxHpOf(state.units[0]), 1);
      assert.equal(state.units[0].hp, 1);
    }
  },
  {
    name: "正盈利·死了没埋：血上限 −60%，100% 脆弱 8 回合",
    run() {
      const state = mk(CHAR.zhengyingli, CHAR.dummy);
      state.units[0].mp = 10;
      state.units[0].charge = { skillId: "zhengyingli.sile", amount: 2 };
      const before = B.state.maxHpOf(state.units[1]);
      cast(state, "a", "zhengyingli.sile", "b");
      assert.equal(B.state.maxHpOf(state.units[1]), 4000);
      assert.ok(B.state.maxHpOf(state.units[1]) < before * 0.45);
      const fragile = state.units[1].buffs.find((b) => b.kind === "fragile");
      assert.equal(fragile.percent, 100);
      assert.equal(fragile.remain, 8);
    }
  },
  {
    name: "羊书含·王霸之气：开局减攻防抗 15 回合，每 3 回合 25 真伤",
    run() {
      const state = mk(CHAR.yangshuhan, CHAR.dummy);
      assert.equal(B.state.statOf(state.units[1], "atk"), 0);
      assert.equal(B.state.statOf(state.units[1], "def"), 20);
      assert.equal(B.state.statOf(state.units[1], "mres"), 10);
      let total = 0;
      let ticks = 0;
      for (let round = 1; round <= 15; round++) {
        endRound(state, round).filter((e) => e.type === "damage" && e.label === "王霸之气").forEach((e) => {
          total += e.amount;
          ticks += 1;
        });
      }
      assert.equal(total, 125);
      assert.equal(ticks, 5);
      assert.equal(state.units[1].effects.length, 0);
      assert.equal(B.state.statOf(state.units[1], "atk"), 10);
    }
  },
  {
    name: "羊书含·涌泉相报：3 次独立 d6，点数 ×20 法伤，不造成击溃",
    run() {
      const state = mk(CHAR.yangshuhan, CHAR.dummy);
      state.units[0].mp = 10;
      state.units[0].charge = { skillId: "yangshuhan.yongquan", amount: 1 };
      const r = cast(state, "a", "yangshuhan.yongquan", "b");
      assert.equal(r.events.filter((e) => e.type === "dice").length, 3);
      assert.equal(r.events.filter((e) => e.type === "damage").length, 3);
      assert.equal(state.units[1].breakValue, 0);
    }
  },
  {
    name: "羊书含·墓：按累计失血降费，500 失血 0 蓝 0 力，限一次",
    run() {
      const state = mk(CHAR.yangshuhan, CHAR.dummy);
      const skill = B.skills.find("yangshuhan.mu");
      state.units[0].hpLost = 0;
      assert.deepEqual(B.skills.effectiveCost(state.units[0], skill), { mp: 5, charge: 4, def: 0, maxMp: 0, steps: 0 });
      state.units[0].hpLost = 250;
      assert.deepEqual(B.skills.effectiveCost(state.units[0], skill), { mp: 3, charge: 2, def: 0, maxMp: 0, steps: 2 });
      state.units[0].hpLost = 500;
      assert.deepEqual(B.skills.effectiveCost(state.units[0], skill), { mp: 0, charge: 0, def: 0, maxMp: 0, steps: 5 });

      state.units[0].mp = 10;
      cast(state, "a", "yangshuhan.mu", "a");
      assert.equal(state.units[0].mp, 10);
      assert.equal(state.summons.length, 1);
      assert.throws(() => cast(state, "a", "yangshuhan.mu", "a"), /只能用一次/);
    }
  },
  {
    name: "羊书含·墓：每 10 个标准回合 200 真伤、眩晕那一拍作废、免疫击溃、可被击杀",
    run() {
      const state = mk(CHAR.yangshuhan, CHAR.dummy);
      state.units[0].mp = 10;
      state.units[0].hpLost = 500;
      cast(state, "a", "yangshuhan.mu", "a");
      /* 王霸之气的持续真伤会混进来，先摘掉，只看墓的出手 */
      state.units[1].effects = [];
      state.units[1].breakValue = 0;
      const tomb = state.summons[0];
      assert.equal(B.state.statOf(tomb, "spd"), 10);
      const hp0 = state.units[1].hp;
      for (let round = 1; round <= 9; round++) endRound(state, round);
      assert.equal(state.units[1].hp, hp0, "前 9 个标准回合不应出手");
      assert.equal(tomb.gauge, 90);
      endRound(state, 10);
      assert.equal(hp0 - state.units[1].hp, 200);
      assert.equal(state.units[1].breakValue, 0);
      assert.equal(tomb.gauge, 0);

      B.state.addStatus(tomb, { kind: "stun", remain: 99, label: "眩晕" });
      const hp1 = state.units[1].hp;
      for (let round = 11; round <= 20; round++) endRound(state, round);
      assert.equal(state.units[1].hp, hp1, "攒满那一拍被眩晕，作废");
      assert.equal(tomb.gauge, 0);
      tomb.statuses = [];
      for (let round = 21; round <= 29; round++) endRound(state, round);
      assert.equal(state.units[1].hp, hp1);
      endRound(state, 30);
      assert.equal(hp1 - state.units[1].hp, 200);

      tomb.breakValue = 3;
      state.turnUid = "a";
      state.units[0].actionsLeft = 1;
      assert.throws(() => B.actions.execute(state, { kind: "basic", type: "break", target: tomb.uid }, []), /无法被击溃/);

      const healTarget = B.skills.basicHealTarget(state, state.units[0]);
      assert.equal(healTarget, tomb.uid);
      B.damage.hit(state, { sourceUid: "b", targetUid: tomb.uid, type: "true", amount: 300 }, []);
      const beforeHeal = tomb.hp;
      state.turnUid = "a";
      state.units[0].actionsLeft = 1;
      B.actions.execute(state, { kind: "basic", type: "attack", target: tomb.uid }, []);
      assert.equal(tomb.hp, beforeHeal + 130);

      B.damage.hit(state, { sourceUid: "b", targetUid: tomb.uid, type: "true", amount: 5000 }, []);
      assert.equal(state.summons.length, 0);
      assert.equal(B.skills.basicHealTarget(state, state.units[0]), null);
      state.turnUid = "a";
      state.units[0].actionsLeft = 1;
      const normal = B.actions.execute(state, { kind: "basic", type: "attack", target: "b" }, []);
      assert.equal(normal.target, "b");
    }
  },
  {
    name: "召唤物的行动条进入指纹：gauge 变化会改变状态指纹",
    run() {
      const state = mk(CHAR.yangshuhan, CHAR.dummy);
      state.units[0].mp = 10;
      state.units[0].hpLost = 500;
      cast(state, "a", "yangshuhan.mu", "a");
      const tomb = state.summons[0];
      const h0 = B.state.hash(state);
      tomb.gauge = 60;
      assert.notEqual(B.state.hash(state), h0);
      tomb.gauge = 0;
      assert.equal(B.state.hash(state), h0);
    }
  },
  {
    name: "召唤物进入指纹：召唤/到期会改变状态指纹，回放一致",
    run() {
      const created = B.battle.create({ seed: 21, a: withSheet(CHAR.yangshuhan), b: withSheet(CHAR.dummy) });
      created.state.units[0].mp = 10;
      created.state.units[0].hpLost = 500;
      const action = { kind: "skill", skillId: "yangshuhan.mu", target: "a" };
      const applied = B.battle.apply(created.state, action);
      assert.notEqual(B.state.hash(applied.state), B.state.hash(created.state));
      const replayed = B.battle.replay(created.state, [action]);
      assert.equal(B.state.hash(applied.state), B.state.hash(replayed.state));
    }
  },
  {
    name: "未实现的技能给出原因，不会静默失效",
    run() {
      const zjm = mk(CHAR.zhangjiaming, CHAR.dummy);
      const weixiang = B.conditions.evaluate(zjm, zjm.units[0], B.skills.find("zhangjiaming.weixiang"));
      assert.match(weixiang.reason, /本版未实现/);
      assert.equal(B.skills.find("songzhiyuan.picao").unsupported, "", "皮糙肉厚已实现，不应再被禁用");
      const szy = mk(CHAR.songzhiyuan, CHAR.dummy);
      assert.match(B.conditions.evaluate(szy, szy.units[0], B.skills.find("songzhiyuan.picao")).reason, /被动技能/);
    }
  },
  {
    name: "被封的技能不会再执行",
    run() {
      const state = mk(CHAR.lishuo, CHAR.dummy);
      const skill = B.skills.find("lishuo.yuzhou");
      skill.unsupported = "档案里没有「宇宙的奥秘」";
      assert.throws(() => cast(state, "a", "lishuo.yuzhou", "b"), /档案里没有/);
      skill.unsupported = "";
    }
  },
  {
    name: "赵云哲·剑光如我：10 段法伤、眩晕值满 5 后眩晕 8 回合并清零",
    run() {
      const state = mk(CHAR.zhaoyunzhe, CHAR.dummy);
      assert.equal(state.units[0].mp, 0);
      assert.throws(() => cast(state, "a", "zhaoyunzhe.jianguang", "b"), /缺 9 蓝|缺/);
      state.units[0].mp = 9;
      cast(state, "a", "zhaoyunzhe.jianguang", "b");
      assert.equal(9999 - state.units[1].hp, 100, "10 段 × 10 点法伤（法抗 30 → 7 向上取 10）");
      assert.equal(state.units[1].breakValue, 5);
      const stun = state.units[1].statuses.find((s) => s.kind === "stun");
      assert.equal(stun.remain, 8);
      assert.equal(state.units[1].stunValue, 0);
    }
  },
  {
    name: "赵云哲·剑光如我：眩晕值正好 5 才眩晕 8 回合，否则不触发",
    run() {
      const state = mk(CHAR.zhaoyunzhe, CHAR.dummy);
      const skill = B.skills.find("zhaoyunzhe.jianguang");
      state.units[1].stunValue = 5;
      state.units[1].statuses = [];
      B.effectOps.runOps(state, { sourceUid: "a", targetUid: "b", skillId: skill.id, label: skill.name }, skill.ops.slice(1), []);
      assert.equal(state.units[1].statuses.find((s) => s.kind === "stun").remain, 8);
      assert.equal(state.units[1].stunValue, 0);
      for (const value of [3, 4]) {
        state.units[1].stunValue = value;
        state.units[1].statuses = [];
        B.effectOps.runOps(state, { sourceUid: "a", targetUid: "b", skillId: skill.id, label: skill.name }, skill.ops.slice(1), []);
        assert.equal(state.units[1].statuses.length, 0, "眩晕值 " + value + " 不触发");
      }
    }
  },
  {
    name: "赵云哲·彻底疯狂：第 4 段伤害触发 65 群真伤与 1 个敌方回合眩晕",
    run() {
      const state = mk(CHAR.zhaoyunzhe, CHAR.dummy);
      state.units[0].charge = { skillId: "zhaoyunzhe.chedi", amount: 2 };
      cast(state, "a", "zhaoyunzhe.chedi", "a");
      assert.equal(state.units[0].statuses.find((s) => s.kind === "chedi").remain, 12);
      state.turnUid = "a";
      state.units[0].actionsLeft = 1;
      for (let i = 0; i < 3; i++) basic(state, "b");
      assert.equal(state.units[1].hp, 9999 - 135, "3 段普攻，不触发");
      basic(state, "b");
      assert.equal(state.units[1].hp, 9999 - 180 - 65, "第 4 段触发 65 群真伤");
      const stuns = state.units[1].statuses.filter((s) => s.kind === "stun");
      assert.equal(stuns.length, 1);
      assert.equal(stuns[0].unit, "targetRound");
      assert.equal(stuns[0].remain, 1);
      const daze = state.units[1].statuses.find((s) => s.kind === "daze");
      assert.equal(daze.unit, "turnStart");
      assert.equal(daze.remain, 2);
      assert.equal(B.state.mresOf(state.units[1]), 0, "眩晕余波期间防抗为 0");
      B.effectOps.turnStart(state, state.units[1], []);
      B.effectOps.skippedTurn(state, state.units[1], []);
      assert.equal(state.units[1].statuses.filter((s) => s.kind === "stun").length, 0, "跳过行动后眩晕结束");
      assert.equal(B.state.mresOf(state.units[1]), 0, "余波还在，防抗仍为 0");
      B.effectOps.turnStart(state, state.units[1], []);
      assert.equal(state.units[1].statuses.filter((s) => s.kind === "daze").length, 0, "再下一次行动开始时余波结束");
      assert.equal(B.state.mresOf(state.units[1]), 30);
      state.units[0].statuses = state.units[0].statuses.filter((s) => s.kind !== "chedi");
      const hp = state.units[1].hp;
      basic(state, "b");
      assert.equal(state.units[1].hp, hp - 45, "12 回合结束后不再追加");
    }
  },
  {
    name: "赵云哲·嬉皮笑脸：65 真伤、2 回合普攻附加 15 真伤、4 回合冷却",
    run() {
      const state = mk(CHAR.zhaoyunzhe, CHAR.dummy);
      cast(state, "a", "zhaoyunzhe.xipi", "b");
      assert.equal(9999 - state.units[1].hp, 65);
      state.turnUid = "a";
      state.units[0].actionsLeft = 1;
      const before = state.units[1].hp;
      basic(state, "b");
      assert.equal(before - state.units[1].hp, 60, "45 普攻 + 15 真伤");
      assert.throws(() => cast(state, "a", "zhaoyunzhe.xipi", "b"), /冷却中/);
      endRound(state, 1);
      endRound(state, 2);
      const hp = state.units[1].hp;
      basic(state, "b");
      assert.equal(hp - state.units[1].hp, 45, "2 回合后只剩普攻");
    }
  },
  {
    name: "赵云哲·高冷如冰：卅力挂敌方、普攻不加击溃、满 5 挂法伤易伤",
    run() {
      const state = mk(CHAR.zhaoyunzhe, CHAR.dummy);
      assert.ok(state.units[1].marks.shili, "卅力应挂在敌方单位上");
      assert.equal(state.units[0].marks.shili, undefined, "自己身上没有卅力");
      state.turnUid = "a";
      state.units[0].actionsLeft = 1;
      const bv = state.units[1].breakValue;
      basic(state, "b");
      assert.equal(state.units[1].breakValue, bv, "普攻不加击溃值");
      for (let i = 0; i < 120 && !state.units[1].buffs.some((b) => b.kind === "magicVuln"); i++) {
        basic(state, "b");
      }
      assert.ok(state.units[1].buffs.some((b) => b.kind === "magicVuln"), "应攒满 5 层卅力");
      assert.equal(B.state.markOf(state.units[1], "shili"), 0, "满 5 后清零");

      state.units[0].mp = 9;
      const hp = state.units[1].hp;
      cast(state, "a", "zhaoyunzhe.jianguang", "b");
      assert.equal(hp - state.units[1].hp, 105, "第一段法伤 ×2（15 + 9×10）");
      assert.equal(state.units[1].buffs.filter((b) => b.kind === "magicVuln").length, 0, "命中后消耗");
    }
  },
  {
    name: "李雨轩·只因只因爆：防抗归零、每回合 −45、10 回合结束",
    run() {
      const state = mk(CHAR.liyuxuan, CHAR.dummy);
      state.units[0].mp = 3;
      state.units[0].charge = { skillId: "liyuxuan.zhiyin", amount: 2 };
      cast(state, "a", "liyuxuan.zhiyin", "a");
      assert.equal(B.state.defOf(state.units[0]), 0);
      assert.equal(B.state.mresOf(state.units[0]), 0);
      assert.equal(B.state.statOf(state.units[0], "atk"), 140);
      assert.equal(state.units[0].statuses.find((s) => s.kind === "zhiyin").remain, 10);
      for (let round = 1; round <= 4; round++) endRound(state, round);
      assert.equal(state.units[0].hp, 450 - 180);
      assert.equal(B.state.defOf(state.units[0]), 0, "4 回合时效果还在");
      state.units[0].hp = 450;
      for (let round = 5; round <= 10; round++) endRound(state, round);
      assert.equal(state.units[0].hp, 450 - 270);
      assert.equal(B.state.defOf(state.units[0]), 45, "30 × 1.5：半血触发的斗士加成");
      assert.equal(B.state.mresOf(state.units[0]), 10);
      assert.equal(B.state.statOf(state.units[0], "atk"), 90, "60 × 1.5：斗士半血加成");
      assert.equal(state.units[0].statuses.filter((s) => s.kind === "zhiyin").length, 0);
    }
  },
  {
    name: "李雨轩·只因只因爆：造成伤害后掷出 6 回满血",
    run() {
      const state = mk(CHAR.liyuxuan, CHAR.dummy);
      state.units[0].mp = 3;
      state.units[0].charge = { skillId: "liyuxuan.zhiyin", amount: 2 };
      cast(state, "a", "liyuxuan.zhiyin", "a");
      state.units[0].hp = 100;
      let healed = false;
      for (let i = 0; i < 80 && !healed; i++) {
        B.skills.runHooks(state, state.units[0], "damageDealt", { sourceUid: "a", targetUid: "b", skillId: "passive.damageDealt", label: "伤害结算后" }, []);
        if (state.units[0].hp === B.state.maxHpOf(state.units[0])) healed = true;
      }
      assert.ok(healed, "应至少掷出一次 6 回满血");
    }
  },
  {
    name: "李雨轩·小学生人大代表：防抗归零后每标准回合 +10，补足原值",
    run() {
      const state = mk(CHAR.liyuxuan, CHAR.dummy);
      state.units[0].mp = 2;
      cast(state, "a", "liyuxuan.xiaoxuesheng", "b");
      const seen = [B.state.defOf(state.units[1])];
      assert.equal(seen[0], 0);
      assert.equal(B.state.mresOf(state.units[1]), 0);
      for (let round = 1; round <= 4; round++) {
        endRound(state, round);
        seen.push(B.state.defOf(state.units[1]));
      }
      assert.deepEqual(seen, [0, 10, 20, 30, 40]);
      assert.equal(B.state.mresOf(state.units[1]), 30);
      endRound(state, 5);
      assert.equal(state.units[1].mods.filter((m) => m.restore).length, 0, "恢复完自动收尾");

      const withSummon = mk(CHAR.liyuxuan, CHAR.yangshuhan);
      withSummon.turnUid = "b";
      withSummon.units[1].mp = 10;
      withSummon.units[1].charge = { skillId: "yangshuhan.mu", amount: 4 };
      cast(withSummon, "b", "yangshuhan.mu", "b");
      const summon = withSummon.summons[0];
      summon.base.def = 40;
      summon.base.mres = 20;
      withSummon.turnUid = "a";
      withSummon.units[0].mp = 2;
      cast(withSummon, "a", "liyuxuan.xiaoxuesheng", "a");
      assert.equal(B.state.defOf(summon), 0, "召唤物也算敌方单位");
      assert.equal(B.state.mresOf(summon), 0);
    }
  },
  {
    name: "李雨轩·旋转：10/20/30/40/50 递增、每回合 +1 击溃值，5 回合结束",
    run() {
      const state = mk(CHAR.liyuxuan, CHAR.dummy);
      state.units[0].mp = 1;
      state.units[0].charge = { skillId: "liyuxuan.xuanzhuan", amount: 1 };
      cast(state, "a", "liyuxuan.xuanzhuan", "b");
      const amounts = [];
      for (let round = 1; round <= 5; round++) {
        endRound(state, round).filter((e) => e.type === "damage").forEach((e) => amounts.push(e.amount));
      }
      assert.deepEqual(amounts, [10, 15, 25, 30, 35]);
      assert.equal(state.units[1].breakValue, 5, "每标准回合 +1，到上限 5 不再增加");
      assert.equal(state.units[1].effects.length, 0, "5 标准回合后旋转结束");
      assert.equal(state.units[1].statuses.filter((s) => s.kind === "break").length, 0, "没有溢出就不击溃");

      const overflow = mk(CHAR.liyuxuan, CHAR.dummy);
      overflow.units[0].mp = 1;
      overflow.units[0].charge = { skillId: "liyuxuan.xuanzhuan", amount: 1 };
      overflow.units[1].breakValue = 5;
      cast(overflow, "a", "liyuxuan.xuanzhuan", "b");
      endRound(overflow, 1);
      assert.ok(overflow.units[1].statuses.some((s) => s.kind === "break"), "已在 5 时再 +1 溢出，自动击溃");
      endRound(overflow, 2);
      assert.equal(overflow.units[1].effects.length, 0, "击溃后旋转立即结束");
    }
  },
  {
    name: "李雨轩·旋转：目标无法普攻、无法蓄力，但可以蓄蓝",
    run() {
      const state = mk(CHAR.liyuxuan, CHAR.lishuo);
      state.units[0].mp = 1;
      state.units[0].charge = { skillId: "liyuxuan.xuanzhuan", amount: 1 };
      cast(state, "a", "liyuxuan.xuanzhuan", "b");
      state.turnUid = "b";
      state.units[1].actionsLeft = 1;
      assert.throws(() => B.actions.execute(state, { kind: "basic", type: "attack", target: "a" }, []), /无法普攻/);
      assert.throws(() => cast(state, "b", "lishuo.dacongming", "b"), /无法蓄力/);
      const result = B.actions.execute(state, { kind: "basic", type: "chargeMp" }, []);
      assert.equal(result.kind, "basic");
      const list = B.actions.list(state);
      assert.equal(list.find((item) => item.type === "attack").enabled, false);
    }
  },
  {
    name: "倪曼云·卷：血上限 −20/−30/−40/−50、伤害 70/80/90/100，第 4 次起固定",
    run() {
      const state = mk(CHAR.nimanyun, CHAR.dummy);
      /* 倪曼云「刚长出来」开局把对方攻防抗锁为 0；这里先解锁法抗，单独验证「卷」的数值 */
      state.units[1].marks.lockMres.value = 1;
      B.state.addMod(state.units[1], { stat: "mres", mode: "set", value: 30 });
      state.units[0].mp = 15;
      state.units[0].hp = 300;
      cast(state, "a", "nimanyun.juan", "b");
      assert.equal(B.state.maxHpOf(state.units[0]), 530);
      assert.equal(state.units[0].hp, 400, "造成的 100 点伤害回复给自己");
      cast(state, "a", "nimanyun.juan", "b");
      assert.equal(B.state.maxHpOf(state.units[0]), 500);
      cast(state, "a", "nimanyun.juan", "b");
      assert.equal(B.state.maxHpOf(state.units[0]), 460);
      cast(state, "a", "nimanyun.juan", "b");
      assert.equal(B.state.maxHpOf(state.units[0]), 410);
      cast(state, "a", "nimanyun.juan", "b");
      assert.equal(B.state.maxHpOf(state.units[0]), 360, "第 4 次起固定 −50");
      assert.equal(B.state.markOf(state.units[0], "juan"), 4);
      assert.equal(state.units[0].hp, 360);
      assert.equal(9999 - state.units[1].hp, 100 + 120 + 130 + 140 + 140);
    }
  },
  {
    name: "顾文达·人高马大：低于阈值免疫，受伤阈值 −5 并回 15 血",
    run() {
      const state = mk(CHAR.guwenda, CHAR.dummy);
      const hp0 = state.units[0].hp;
      B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "true", amount: 55 }, []);
      assert.equal(state.units[0].hp, hp0, "55 < 60 免疫");
      assert.equal(B.state.markOf(state.units[0], "renGao"), 60, "免疫不触发递减");
      B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "true", amount: 60 }, []);
      assert.equal(state.units[0].hp, hp0 - 60 + 15, "受伤 60、回 15");
      assert.equal(B.state.markOf(state.units[0], "renGao"), 55);
      B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "true", amount: 50 }, []);
      assert.equal(state.units[0].hp, hp0 - 60 + 15, "50 < 55 免疫");
      state.units[0].marks.renGao.value = 0;
      const hp1 = state.units[0].hp;
      B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "true", amount: 10 }, []);
      assert.equal(state.units[0].hp, hp1 - 10 + 15, "阈值为 0 后不再免疫");
    }
  },
  {
    name: "顾文达·炸弹摔：力不足只蓄力；掷点 ≤ 击溃值或目标已击溃才命中",
    run() {
      const insufficient = mk(CHAR.guwenda, CHAR.dummy);
      insufficient.units[0].mp = 1;
      const charged = cast(insufficient, "a", "guwenda.zhadanshuai", "b");
      assert.equal(charged.committed.kind, "charge");
      assert.equal(insufficient.units[1].hp, 9999);

      const miss = mk(CHAR.guwenda, CHAR.dummy);
      miss.units[0].mp = 1;
      miss.units[0].charge = { skillId: "guwenda.zhadanshuai", amount: 3 };
      miss.units[1].breakValue = 0;
      cast(miss, "a", "guwenda.zhadanshuai", "b");
      assert.equal(miss.units[1].hp, 9999, "击溃值 0 时掷点至少 1，不命中");

      const hit = mk(CHAR.guwenda, CHAR.dummy);
      hit.units[0].mp = 1;
      hit.units[0].charge = { skillId: "guwenda.zhadanshuai", amount: 3 };
      hit.units[1].breakValue = 5;
      cast(hit, "a", "guwenda.zhadanshuai", "b");
      assert.equal(9999 - hit.units[1].hp, 360 + 400, "400 普伤（防御 40）+ 400 真伤");

      const broken = mk(CHAR.guwenda, CHAR.dummy);
      broken.units[0].mp = 1;
      broken.units[0].charge = { skillId: "guwenda.zhadanshuai", amount: 3 };
      broken.units[1].breakValue = 0;
      B.state.enterBreak(broken.units[1], 8, "test", "击溃");
      cast(broken, "a", "guwenda.zhadanshuai", "b");
      assert.equal(9999 - broken.units[1].hp, 760, "目标已击溃时必中");
    }
  },
  {
    name: "法伤一次性易伤：法伤 ×2 并消耗，物理伤害不受影响",
    run() {
      const state = mk(CHAR.guwenda, CHAR.dummy);
      const target = state.units[1];
      B.state.addBuff(target, { kind: "magicVuln", percent: 100, remain: -1, source: "test", label: "测试" });
      B.damage.hit(state, { sourceUid: "a", targetUid: "b", type: "phys", amount: 100 }, []);
      assert.equal(target.buffs.filter((b) => b.kind === "magicVuln").length, 1, "物理伤害不消耗");
      B.damage.hit(state, { sourceUid: "a", targetUid: "b", type: "magic", amount: 100 }, []);
      assert.equal(target.buffs.filter((b) => b.kind === "magicVuln").length, 0, "法伤命中后消耗");
    }
  },
  {
    name: "targetRound：眩晕 1 个敌方回合在回合被跳过时就结束",
    run() {
      const state = mk(CHAR.zhaoyunzhe, CHAR.dummy);
      state.units[1].statuses = [];
      B.effectOps.runOps(state, { sourceUid: "a", targetUid: "b", skillId: "test" }, [
        { op: "status", kind: "stun", who: "target", duration: { unit: "targetRound", count: 1 }, label: "测试眩晕" }
      ], []);
      assert.equal(state.units[1].statuses.find((s) => s.kind === "stun").remain, 1);
      assert.equal(state.units[1].statuses.find((s) => s.kind === "stun").unit, "targetRound");
      state.turnUid = null;
      state.queue = ["b"];
      const events = [];
      B.timeline.beginTurn(state, events);
      assert.equal(state.units[1].statuses.filter((s) => s.kind === "stun").length, 0, "被跳过一次就结束");
      assert.ok(events.some((e) => e.type === "turnSkip"));
    }
  },
  {
    name: "未实现技能都写明原因，不会静默失效",
    run() {
      for (const skill of B.skills.all()) {
        if (!skill.unsupported) continue;
        assert.match(skill.unsupported, /本版未实现|界面|档案|「/, skill.id + " 应写明原因");
      }
      const blocked = B.skills.all().filter((s) => s.unsupported);
      assert.ok(blocked.length >= 1);
      for (const id of ["nimanyun.gangzhang", "nimanyun.yuegong", "guwenda.xiaqian", "guwenda.shuoge"]) {
        const skill = B.skills.find(id);
        assert.ok(skill, "技能应存在：" + id);
        assert.equal(skill.unsupported || "", "", id + " 第六批应已实现");
      }
    }
  },
  {
    name: "孙嘉怿：面板攻击 0，普攻按目标当前血量 20% 结算",
    run() {
      const state = mk(CHAR.sunjiaqi, CHAR.dummy);
      assert.equal(B.state.statOf(state.units[0], "atk"), 0, "面板攻击被技能库覆盖为 0");
      state.turnUid = "a";
      state.units[0].actionsLeft = 1;
      const { events } = basic(state, "b");
      const dmg = events.find((e) => e.type === "damage");
      assert.ok(dmg, "应造成伤害");
      /* 木桩 9999 血 × 20% = 1999.8，作为普伤再减 40 防御，最后向 5 的倍数上取整 */
      assert.equal(dmg.amount, 1960);
    }
  },
  {
    name: "孙嘉怿·送礼物：普攻 1 次、回 65 血、给自己挂 10% 脆弱 3 回合",
    run() {
      const state = mk(CHAR.sunjiaqi, CHAR.dummy);
      state.units[0].hp = 300;
      const { events } = cast(state, "a", "sunjiaqi.songliwu", "b");
      const dmg = events.find((e) => e.type === "damage");
      assert.ok(dmg, "应打出一次普攻");
      assert.equal(dmg.amount, 1960);
      assert.equal(state.units[0].hp, 365, "回 65 血");
      const buff = state.units[0].buffs.find((b) => b.kind === "fragile");
      assert.ok(buff, "脆弱挂在自己身上");
      assert.equal(buff.percent, 10);
      assert.equal(buff.remain, 3);
    }
  },
  {
    name: "孙嘉怿·抛媚眼：75 法伤，第 6 标准回合回血上限 20%",
    run() {
      const state = mk(CHAR.sunjiaqi, CHAR.dummy);
      state.units[0].hp = 300;
      cast(state, "a", "sunjiaqi.paomeiyan", "b");
      cast(state, "a", "sunjiaqi.paomeiyan", "b");
      const { events } = cast(state, "a", "sunjiaqi.paomeiyan", "b");
      const dmg = events.find((e) => e.type === "damage");
      assert.ok(dmg);
      assert.equal(dmg.damageType, "magic");
      assert.equal(dmg.amount, 55, "75 法伤打 30 法抗 = 52.5，上取整到 5 的倍数");
      const at = state.units[0].scheduled[0];
      assert.ok(at, "应挂延迟结算");
      assert.equal(at.atRound, state.round + 5);
      B.effectOps.roundEnd(state, []);
      const healEvents = [];
      state.round = at.atRound;
      B.effectOps.roundEnd(state, healEvents);
      const heal = healEvents.find((e) => e.type === "heal");
      assert.ok(heal, "第 6 标准回合应回血");
      assert.equal(heal.amount, 80, "血上限 400 的 20%");
    }
  },
  {
    name: "孙嘉怿·领毒者：眩晕 1 个敌方回合、每标准回合 10 强扣、自己受伤打断",
    run() {
      const state = mk(CHAR.sunjiaqi, CHAR.dummy);
      state.units[0].mp = 4;
      const { events } = cast(state, "a", "sunjiaqi.lingduzhe", "b");
      const stun = state.units[1].statuses.find((s) => s.kind === "stun");
      assert.ok(stun);
      assert.equal(stun.unit, "targetRound");
      assert.equal(stun.remain, 1);
      const tick = state.units[1].effects.find((e) => e.tag === "lingduzhe");
      assert.ok(tick, "目标身上挂持续强扣");
      assert.equal(tick.remain, 10);
      const roundEvents = [];
      B.effectOps.roundEnd(state, roundEvents);
      assert.ok(roundEvents.some((e) => e.type === "directLoss" && e.amount === 10));
      /* 孙嘉怿自己受到伤害，效果立即结束 */
      B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "true", amount: 20 }, []);
      assert.equal(state.units[1].effects.filter((e) => e.tag === "lingduzhe").length, 0);
      assert.ok(!events.some((e) => e.type === "statusImmune"));
    }
  },
  {
    name: "杨冬明·竹光法杖：防御不足 10 置灰，释放扣 10 防，3 段法伤 + 眩晕 2 个敌方回合",
    run() {
      const state = mk(CHAR.yangdongming, CHAR.dummy);
      const skill = B.skills.find("yangdongming.zhuguang");
      state.units[0].base.def = 5;
      assert.match(B.conditions.evaluate(state, state.units[0], skill).reason, /防御不足/);
      state.units[0].base.def = 60;
      const { events } = cast(state, "a", "yangdongming.zhuguang", "b");
      assert.ok(events.filter((e) => e.type === "damage").every((e) => e.damageType === "magic"));
      assert.equal(B.state.statOf(state.units[0], "def"), 50, "释放后防御 -10");
      const stun = state.units[1].statuses.find((s) => s.kind === "stun");
      assert.equal(stun.remain, 2);
      assert.equal(stun.unit, "targetRound");
      assert.equal(B.conditions.evaluate(state, state.units[0], skill).ok, true);
    }
  },
  {
    name: "杨冬明·坚若磐石：护盾全吸收、4 标准回合后消失并加 5 防、提前破盾不加防",
    run() {
      const state = mk(CHAR.yangdongming, CHAR.dummy);
      const hp0 = state.units[0].hp;
      cast(state, "a", "yangdongming.jianruopanshi", "a");
      assert.equal(state.units[0].shield.hp, 300);
      B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "true", amount: 280 }, []);
      assert.equal(state.units[0].hp, hp0, "护盾全吸收，不扣血");
      assert.equal(state.units[0].shield.hp, 20);
      /* 4 个标准回合后到期：先满 4 回合 */
      for (let i = 0; i < 4; i++) B.effectOps.roundEnd(state, []);
      assert.equal(state.units[0].shield, null, "到期消失");
      assert.equal(B.state.statOf(state.units[0], "def"), 65, "防御 +5");
      /* 提前破盾不加防 */
      const state2 = mk(CHAR.yangdongming, CHAR.dummy);
      cast(state2, "a", "yangdongming.jianruopanshi", "a");
      B.damage.hit(state2, { sourceUid: "b", targetUid: "a", type: "true", amount: 400 }, []);
      assert.equal(state2.units[0].shield, null);
      B.effectOps.roundEnd(state2, []);
      assert.equal(B.state.statOf(state2.units[0], "def"), 60, "破盾不加防");
    }
  },
  {
    name: "杨冬明·嘚吪呐呃嘶哦：召唤上限 6、每个标准回合 50+5(N-1) 法伤、10 回合消失",
    run() {
      const state = mk(CHAR.yangdongming, CHAR.dummy);
      cast(state, "a", "yangdongming.dedenaenashio", "a");
      assert.equal(state.summons.length, 1);
      const events1 = [];
      B.effectOps.roundEnd(state, events1);
      const d1 = events1.find((e) => e.type === "damage");
      assert.equal(d1.amount, 35, "1 个时 50 法伤，打 30 法抗后 35");
      state.round += 1;
      cast(state, "a", "yangdongming.dedenaenashio", "a");
      assert.equal(state.summons.length, 2);
      const events2 = [];
      B.effectOps.roundEnd(state, events2);
      const dmgs = events2.filter((e) => e.type === "damage");
      assert.equal(dmgs.length, 2, "每个召唤物各结算一次");
      for (const d of dmgs) assert.equal(d.amount, 40, "2 个时每个 55，打 30 法抗后 38.5 取整 40");
    }
  },
  {
    name: "倪曼云·刚长出来：开局锁攻防抗、花 1 蓝解锁一个、3 标准回合后恢复、全部解锁后隐藏入口",
    run() {
      const state = mk(CHAR.nimanyun, CHAR.dummy);
      assert.equal(B.state.statOf(state.units[1], "atk"), 0, "对方攻击开局为 0");
      assert.equal(B.state.statOf(state.units[1], "def"), 0);
      assert.equal(B.state.statOf(state.units[1], "mres"), 0);
      state.turnUid = "b";
      state.units[1].actionsLeft = 1;
      state.units[1].mp = 5;
      const list = B.actions.list(state);
      const unlock = list.find((a) => a.kind === "unlock");
      assert.ok(unlock, "行动面板应有解锁入口");
      assert.equal(unlock.stats.length, 3);
      const events = [];
      const committed = B.actions.execute(state, { kind: "unlock", stat: "atk" }, events);
      assert.equal(committed.kind, "unlock");
      assert.equal(state.units[1].mp, 4, "花 1 蓝");
      assert.equal(state.units[1].marks.lockAtk.value, 1);
      assert.equal(B.state.statOf(state.units[1], "atk"), 0, "解锁后仍是 0，3 回合后才恢复");
      /* 3 个标准回合后恢复原值 */
      for (let i = 0; i < 3; i++) endRound(state, state.round + 1);
      assert.equal(B.state.statOf(state.units[1], "atk"), 10, "恢复原值");
      /* 解锁防御与法抗后入口隐藏 */
      B.actions.execute(state, { kind: "unlock", stat: "def" }, events);
      B.actions.execute(state, { kind: "unlock", stat: "mres" }, events);
      assert.equal(B.actions.list(state).some((a) => a.kind === "unlock"), false, "全部解锁后隐藏");
    }
  },
  {
    name: "顾文达·下潜：取消 5 次伤害、免疫异常与击溃、蓄力不断，用完才降防",
    run() {
      const state = mk(CHAR.guwenda, CHAR.dummy);
      cast(state, "a", "guwenda.xiaqian", "a");
      cast(state, "a", "guwenda.xiaqian", "a");
      assert.ok(state.units[0].effects.some((e) => e.key === "xiaqian"), "下潜挂上");
      const hp0 = state.units[0].hp;
      const events = [];
      B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "true", amount: 200 }, events);
      assert.equal(state.units[0].hp, hp0, "第 1 次伤害被取消");
      assert.ok(events.some((e) => e.type === "guardBlock"));
      /* 免疫眩晕 */
      const stunEvents = [];
      B.effectOps.runOps(state, { sourceUid: "b", targetUid: "a", skillId: "test" }, [
        { op: "status", kind: "stun", who: "target", duration: 2, label: "测试眩晕" }
      ], stunEvents);
      assert.ok(stunEvents.some((e) => e.type === "statusImmune"));
      assert.equal(B.state.hasStatus(state.units[0], "stun"), false);
      /* 再挨 4 次，用完结束 */
      for (let i = 0; i < 4; i++) B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "true", amount: 200 }, []);
      assert.equal(state.units[0].effects.filter((e) => e.key === "xiaqian").length, 0, "5 次用完结束");
      assert.equal(B.state.statOf(state.units[0], "def"), 0, "随后防御变 0");
      assert.ok(state.units[0].effects.some((e) => e.key === "rengaoOff"), "人高马大失效 1 标准回合");
    }
  },
  {
    name: "顾文达·硕哥过肩摔：蓄力期间受击免疫并立即发动 80 普伤 + 80 法伤",
    run() {
      const state = mk(CHAR.guwenda, CHAR.dummy);
      cast(state, "a", "guwenda.shuoge", "a");
      assert.ok(state.units[0].effects.some((e) => e.key === "shuoge"), "蓄力时挂防护层");
      const hp0 = state.units[0].hp;
      const events = [];
      B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "true", amount: 200 }, events);
      assert.equal(state.units[0].hp, hp0, "免疫该次伤害");
      const dmgs = events.filter((e) => e.type === "damage" && e.uid === "b");
      assert.equal(dmgs.length, 2, "立即发动两段");
      assert.equal(dmgs[0].damageType, "phys");
      assert.equal(dmgs[1].damageType, "magic");
    }
  },
  {
    name: "倪曼云·越共探头：血上限 +60，免疫一次攻击并免费触发 2 次「卷」",
    run() {
      const state = mk(CHAR.nimanyun, CHAR.dummy);
      const maxBefore = B.state.maxHpOf(state.units[0]);
      cast(state, "a", "nimanyun.yuegong", "a");
      cast(state, "a", "nimanyun.yuegong", "a");
      assert.equal(B.state.maxHpOf(state.units[0]), maxBefore + 60);
      const hp0 = state.units[0].hp;
      const events = [];
      B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "true", amount: 200 }, events);
      assert.equal(events.filter((e) => e.type === "damage" && e.uid === "a").length, 0, "免疫该次伤害");
      assert.equal(B.state.markOf(state.units[0], "juan"), 2, "免费触发 2 次卷");
      const dealt = events.filter((e) => e.type === "damage" && e.uid === "b");
      assert.equal(dealt.length, 4, "2 次卷各 2 段法伤");
      assert.ok(state.units[0].hp >= hp0, "卷的回血不会让血变少");
    }
  },
  {
    name: "targetRound 修复：Buff 与属性修改按目标回合计时，不再永久",
    run() {
      const state = mk(CHAR.dummy, CHAR.dummy);
      B.effectOps.runOps(state, { sourceUid: "a", targetUid: "b", skillId: "test" }, [
        { op: "buff", kind: "fragile", who: "target", percent: 10, duration: { unit: "targetRound", count: 1 } },
        { op: "stat", who: "target", stat: "def", mode: "add", value: -10, duration: { unit: "targetRound", count: 1 } }
      ], []);
      assert.equal(state.units[1].buffs[0].targetUid, "b");
      assert.equal(state.units[1].mods[0].targetUid, "b");
      /* 以 a 的回合结算不会减 b 的 buff */
      B.effectOps.turnEnd(state, state.units[0], []);
      assert.equal(state.units[1].buffs.length, 1);
      assert.equal(state.units[1].mods.length, 1);
      /* 轮到 b 的回合结束后过期 */
      B.effectOps.turnEnd(state, state.units[1], []);
      assert.equal(state.units[1].buffs.length, 0);
      assert.equal(state.units[1].mods.length, 0);
    }
  },
  {
    name: "刘亦萱·十分“物理给力”：每受 5 段伤害攻 +10、击溃归零、可反复",
    run() {
      const state = mk(CHAR.liuyixuan, CHAR.dummy);
      const unit = state.units[0];
      unit.breakValue = 4;
      for (let i = 0; i < 5; i++) {
        B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "true", amount: 40, noBreak: true }, []);
      }
      assert.equal(B.state.statOf(unit, "atk"), 110, "满 5 次攻 +10");
      assert.equal(unit.breakValue, 0, "击溃值归零");
      assert.equal(B.state.markOf(unit, "taken"), 0, "计数清零");
      for (let i = 0; i < 5; i++) {
        B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "true", amount: 40, noBreak: true }, []);
      }
      assert.equal(B.state.statOf(unit, "atk"), 120, "可反复触发");
      assert.equal(B.state.markOf(unit, "taken"), 0);
    }
  },
  {
    name: "刘亦萱·泼水节：封锁自己可蓄力、双 tick 结算、溢出自动击溃、被眩晕即断",
    run() {
      const insufficient = mk(CHAR.liuyixuan, CHAR.dummy);
      insufficient.units[0].mp = 1;
      const skill = B.skills.find("liuyixuan.poshuijie");
      const check = B.conditions.evaluate(insufficient, insufficient.units[0], skill);
      assert.equal(check.ok, false, "缺蓝置灰");
      assert.match(check.reason, /缺 1 蓝/);

      const state = mk(CHAR.liuyixuan, CHAR.dummy);
      const unit = state.units[0];
      const foe = state.units[1];
      unit.mp = 2;
      unit.charge = { skillId: "liuyixuan.poshuijie", amount: 2 };
      const events = cast(state, "a", "liuyixuan.poshuijie", "a").events;
      assert.ok(B.state.hasStatus(unit, "noBasic"), "无法普攻");
      assert.ok(B.state.hasStatus(unit, "noSkill"), "无法释放技能");
      assert.equal(foe.effects.length, 2, "两个 tick 挂在敌方");
      /* 蓄力不受限（chargeOk）：文学巨作之类仍被封锁，但徒手开苹果可以蓄力 */
      const wenxue = B.conditions.evaluate(state, unit, B.skills.find("liuyixuan.wenxue"));
      assert.equal(wenxue.ok, false, "无蓄力技能被封锁");
      unit.mp = 5;
      const pingguo = B.conditions.evaluate(state, unit, B.skills.find("liuyixuan.kaipingguo"));
      assert.equal(pingguo.needsCharge, true, "蓄力技能仍可蓄力");

      /* 第 2 标准回合末：150 真伤 + 击溃值 +3；Buff tick 每回合 50 法伤（木桩法抗 30 → 35） */
      endRound(state, 1);
      assert.equal(9999 - foe.hp, 35, "第 1 回合末只有 Buff 50 法伤（抗 30 → 35）");
      endRound(state, 2);
      assert.equal(9999 - foe.hp, 35 + 150 + 35, "第 2 回合末 150 真伤 + 50 法伤");
      assert.equal(foe.breakValue, 3, "击溃值 +3");
      endRound(state, 3);
      assert.equal(9999 - foe.hp, 35 + 150 + 35 + 35);
      endRound(state, 4);
      assert.equal(foe.breakValue, 0, "溢出：3+3>5 直接进入击溃");
      assert.ok(B.state.hasStatus(foe, "break"), "处于击溃状态");
      /* 自身被眩晕：两个 tick 立即结束 */
      B.state.addStatus(unit, { kind: "stun", remain: 2, label: "眩晕" });
      endRound(state, 5);
      assert.equal(foe.effects.length, 0, "被眩晕后 tick 全断");
    }
  },
  {
    name: "刘亦萱·徒手开苹果：恐慌、攻 +20、按骰值加碎苹果，吃苹果限每回合 1 次",
    run() {
      const state = mk(CHAR.liuyixuan, CHAR.dummy);
      const unit = state.units[0];
      const foe = state.units[1];
      unit.charge = { skillId: "liuyixuan.kaipingguo", amount: 3 };
      const events = cast(state, "a", "liuyixuan.kaipingguo", "a").events;
      assert.equal(foe.buffs.filter((b) => b.kind === "panic").length, 1, "敌方全体 100% 恐慌");
      assert.equal(foe.buffs[0].percent, 100);
      assert.equal(B.state.statOf(unit, "atk"), 120, "攻 +20 永久");
      const dice = events.find((e) => e.type === "dice");
      assert.equal(B.state.markOf(unit, "apple"), dice.value, "碎苹果按骰值加");
      assert.equal(unit.marks.apple.max, 36);
      /* 吃苹果：回血 90、击溃值 −1、碎苹果 −1、不消耗行动 */
      unit.hp = 300;
      unit.breakValue = 2;
      const actionsBefore = unit.actionsLeft;
      B.actions.execute(state, { kind: "item", key: "liuyixuan.appleEat" }, []);
      assert.equal(unit.hp, 390);
      assert.equal(unit.breakValue, 1);
      assert.equal(B.state.markOf(unit, "apple"), dice.value - 1);
      assert.equal(unit.actionsLeft, actionsBefore, "额外动作不消耗行动");
      assert.throws(() => B.actions.execute(state, { kind: "item", key: "liuyixuan.appleEat" }, []), /本回合已经用过/);
    }
  },
  {
    name: "刘亦萱·文学巨作：勇猛+坚强 3 己方回合，清异常/Debuff/标记修正，能解王霸之气",
    run() {
      const insufficient = mk(CHAR.liuyixuan, CHAR.dummy);
      insufficient.units[0].mp = 1;
      const check = B.conditions.evaluate(insufficient, insufficient.units[0], B.skills.find("liuyixuan.wenxue"));
      assert.equal(check.ok, false);
      assert.match(check.reason, /缺 1 蓝/);

      const state = mk(CHAR.liuyixuan, CHAR.yangshuhan);
      const unit = state.units[0];
      unit.mp = 2;
      assert.equal(B.state.statOf(unit, "atk"), 80, "王霸之气开局 −20");
      unit.breakValue = 3;
      B.state.addStatus(unit, { kind: "stun", remain: 2, label: "眩晕" });
      cast(state, "a", "liuyixuan.wenxue", "a");
      assert.equal(B.state.statOf(unit, "atk"), 100, "标记削弱被清，攻回基础值");
      assert.equal(B.state.statOf(unit, "def"), 10);
      assert.equal(B.state.statOf(unit, "mres"), 0);
      assert.equal(unit.effects.filter((e) => e.debuff).length, 0, "王霸之气 tick 被清");
      assert.equal(unit.statuses.length, 0, "眩晕被清");
      assert.equal(unit.breakValue, 3, "击溃值不动");
      assert.equal(unit.buffs.filter((b) => b.kind === "brave")[0].percent, 50);
      assert.equal(unit.buffs.filter((b) => b.kind === "strong")[0].percent, 50);
      assert.equal(unit.buffs[0].remain, 3, "3 己方回合，释放当回合算第 1 个");
      B.effectOps.turnEnd(state, unit, []);
      assert.equal(unit.buffs[0].remain, 2, "己方回合结束走一格");
      B.effectOps.turnEnd(state, state.units[1], []);
      assert.equal(unit.buffs[0].remain, 2, "敌方回合不走");
      B.effectOps.turnEnd(state, unit, []);
      assert.equal(unit.buffs[0].remain, 1);
      B.effectOps.turnEnd(state, unit, []);
      assert.equal(unit.buffs.length, 0, "第 4 个己方回合开始前结束");
    }
  },
  {
    name: "吕场龄·土豆地雷：300 血可选中，10 回合后爆炸最多 3 人，剃发为僧期间置灰",
    run() {
      const insufficient = mk(CHAR.lvchangling, CHAR.dummy);
      insufficient.units[0].mp = 0;
      const check = B.conditions.evaluate(insufficient, insufficient.units[0], B.skills.find("lvchangling.dilei"));
      assert.equal(check.ok, false);
      assert.match(check.reason, /缺 1 蓝/);

      const state = mk(CHAR.lvchangling, CHAR.dummy);
      const unit = state.units[0];
      const foe = state.units[1];
      unit.mp = 1;
      unit.charge = { skillId: "lvchangling.dilei", amount: 1 };
      cast(state, "a", "lvchangling.dilei", "a");
      assert.equal(state.summons.length, 1);
      const mine = state.summons[0];
      assert.equal(mine.summonKey, "lvchangling.dilei");
      assert.equal(mine.hp, 300);
      assert.equal(mine.targetable, true);
      assert.equal(B.state.combatantsOf(state, "a").indexOf(mine) >= 0, true, "可被单体选中");
      /* 到期爆炸：对敌人 100 真伤 + 50% 脆弱 */
      mine.ttl.remain = 1;
      endRound(state, 1);
      assert.equal(9999 - foe.hp, 100, "爆炸 100 真伤");
      assert.equal(foe.breakValue, 0, "召唤物伤害无击溃值");
      assert.equal(foe.buffs.filter((b) => b.kind === "fragile")[0].percent, 50);
      assert.equal(state.summons.length, 0, "爆炸后消失");
      /* 剃发为僧期间置灰 */
      const tifa = mk(CHAR.lvchangling, CHAR.dummy);
      tifa.units[0].charge = { skillId: "lvchangling.tifa", amount: 1 };
      cast(tifa, "a", "lvchangling.tifa", "a");
      const blocked = B.conditions.evaluate(tifa, tifa.units[0], B.skills.find("lvchangling.dilei"));
      assert.equal(blocked.ok, false);
      assert.match(blocked.reason, /剃发为僧/);
    }
  },
  {
    name: "吕场龄·剃发为僧：首次释放加成、免疫、功德计时；再次释放全回滚、功德保留",
    run() {
      const state = mk(CHAR.lvchangling, CHAR.dummy);
      const unit = state.units[0];
      const foe = state.units[1];
      unit.charge = { skillId: "lvchangling.tifa", amount: 1 };
      cast(state, "a", "lvchangling.tifa", "a");
      assert.equal(B.state.statOf(unit, "def"), 60, "防 +45");
      assert.equal(B.state.maxHpOf(unit), 600, "血上限 +300");
      assert.equal(unit.hp, 600, "当前血 +300");
      assert.equal(B.state.spdOf(unit), 50, "速 −25");
      assert.equal(B.state.effectHasFlag(unit, "breakImmune"), true, "免疫击溃");
      assert.equal(B.state.immuneToBuff(unit, "fragile"), "剃发为僧");
      assert.equal(B.state.immuneToStatus(unit, "stun"), "剃发为僧");
      const mod = B.skills.basicMod(state, unit, foe, []);
      assert.equal(mod.type, "phys", "普攻改物理");
      foe.hp = 100;
      assert.equal(B.skills.basicGate(state, unit, foe.uid, []).allow, false, "对方血 ≤100 无法普攻");
      foe.hp = 101;
      assert.equal(B.skills.basicGate(state, unit, foe.uid, []).allow, true);
      /* 每标准回合末未普攻则功德 +1 并同步 +5 */
      endRound(state, 1);
      assert.equal(B.state.markOf(unit, "gongde"), 1);
      assert.equal(B.state.statOf(unit, "atk"), 55);
      assert.equal(B.state.statOf(unit, "def"), 65);
      assert.equal(B.state.statOf(unit, "mres"), 55);
      /* 本回合普攻过则不加 */
      B.skills.runHooks(state, unit, "basicHit", { sourceUid: "a", targetUid: "b", skillId: "passive.basicHit", label: "普攻被动" }, []);
      endRound(state, 2);
      assert.equal(B.state.markOf(unit, "gongde"), 1, "攻击过的回合不加功德");
      /* 再次释放：全回滚、效果移除、功德保留 */
      unit.charge = { skillId: "lvchangling.tifa", amount: 1 };
      cast(state, "a", "lvchangling.tifa", "a");
      assert.equal(B.state.statOf(unit, "def"), 20, "防回滚到 15 + 功德 1 层 5");
      assert.equal(B.state.maxHpOf(unit), 300, "血上限回滚");
      assert.equal(unit.hp, 300, "当前血钳到新上限");
      assert.equal(B.state.spdOf(unit), 75, "速回滚");
      assert.equal(B.state.hasEffectKey(unit, "lvchangling.tifa"), false, "效果移除");
      const mod2 = B.skills.basicMod(state, unit, foe, []);
      assert.equal(mod2.type, undefined, "普攻回到法伤");
      assert.equal(B.state.markOf(unit, "gongde"), 1, "功德保留");
    }
  },
  {
    name: "吕场龄·功德无量：回血 150 花 1 层并同步 −5，剃发为僧期间不列入口",
    run() {
      const state = mk(CHAR.lvchangling, CHAR.dummy);
      const unit = state.units[0];
      const passive = B.conditions.evaluate(state, unit, B.skills.find("lvchangling.gongdewuliang"));
      assert.equal(passive.ok, false, "被动不需要释放");
      unit.hp = 100;
      unit.marks.gongde.value = 2;
      B.actions.execute(state, { kind: "item", key: "lvchangling.gongdeHeal" }, []);
      assert.equal(unit.hp, 250, "回血 150");
      assert.equal(B.state.markOf(unit, "gongde"), 1, "功德 −1");
      assert.equal(B.state.statOf(unit, "atk"), 45, "攻同步 −5");
      assert.equal(B.state.statOf(unit, "def"), 10);
      assert.equal(B.state.statOf(unit, "mres"), 45);
      /* 剃发为僧期间不列入口 */
      unit.charge = { skillId: "lvchangling.tifa", amount: 1 };
      cast(state, "a", "lvchangling.tifa", "a");
      const entries = B.battle.available(state).filter((x) => x.kind === "item");
      assert.equal(entries.length, 0, "剃发为僧期间功德回血入口隐藏");
    }
  },
  {
    name: "王春雨·剩蛋老人：110 真伤、1 敌方回合封锁、20% 勇猛 2 敌方回合",
    run() {
      const state = mk(CHAR.wangchunyu, CHAR.dummy);
      const unit = state.units[0];
      const foe = state.units[1];
      unit.charge = { skillId: "wangchunyu.shengdan", amount: 2 };
      cast(state, "a", "wangchunyu.shengdan", "b");
      assert.equal(9999 - foe.hp, 110, "110 真伤");
      assert.equal(foe.breakValue, 1, "按默认规则 +1 击溃值");
      assert.equal(foe.stunValue, 0, "不加眩晕值");
      assert.ok(B.state.hasStatus(foe, "noBasic"));
      assert.ok(B.state.hasStatus(foe, "noCharge"));
      assert.equal(foe.buffs.filter((b) => b.kind === "brave")[0].percent, 20);
      /* 敌方 1 个回合后封锁到期、勇猛剩 1 回合 */
      B.effectOps.turnEnd(state, foe, []);
      assert.equal(B.state.hasStatus(foe, "noBasic"), false);
      assert.equal(B.state.hasStatus(foe, "noCharge"), false);
      assert.equal(foe.buffs.length, 1);
      /* 我方回合不影响敌方回合计时 */
      B.effectOps.turnEnd(state, unit, []);
      assert.equal(foe.buffs.length, 1);
      B.effectOps.turnEnd(state, foe, []);
      assert.equal(foe.buffs.length, 0, "2 个敌方回合后勇猛到期");
    }
  },
  {
    name: "王春雨·学富五车：3 敌方回合计时不扣血只加血上限，强扣不转，到期恢复",
    run() {
      const state = mk(CHAR.wangchunyu, CHAR.dummy);
      const unit = state.units[0];
      const foe = state.units[1];
      unit.mp = 10;
      cast(state, "a", "wangchunyu.xuefu", "a");
      assert.ok(B.state.hasEffectKey(unit, "wangchunyu.xuefu"));
      const check = B.conditions.evaluate(state, unit, B.skills.find("wangchunyu.xuefu"));
      assert.equal(check.ok, false, "冷却中置灰");
      assert.match(check.reason, /冷却中/);
      const maxBefore = B.state.maxHpOf(unit);
      const events = [];
      B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "true", amount: 100 }, events);
      assert.equal(unit.hp, 370, "不扣血");
      assert.equal(B.state.maxHpOf(unit), maxBefore + 100, "等量加血上限");
      assert.equal(events.some((e) => e.type === "convertMaxHp"), true);
      assert.equal(unit.breakValue, 0, "不加击溃值");
      B.damage.directLoss(state, { sourceUid: "b", targetUid: "a", amount: 50 }, []);
      assert.equal(unit.hp, 320, "强扣照常扣");
      B.effectOps.turnEnd(state, unit, []);
      assert.ok(B.state.hasEffectKey(unit, "wangchunyu.xuefu"), "己方回合不走格");
      B.effectOps.turnEnd(state, foe, []);
      B.effectOps.turnEnd(state, foe, []);
      B.effectOps.turnEnd(state, foe, []);
      assert.equal(B.state.hasEffectKey(unit, "wangchunyu.xuefu"), false, "3 个敌方回合后到期");
      B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "true", amount: 100 }, []);
      assert.equal(unit.hp, 220, "到期后恢复扣血");
    }
  },
  {
    name: "王春雨·糕爆战士：防抗归 0、速 +140、攻 −10 持续 4 标准回合",
    run() {
      const insufficient = mk(CHAR.wangchunyu, CHAR.dummy);
      insufficient.units[0].mp = 4;
      const check = B.conditions.evaluate(insufficient, insufficient.units[0], B.skills.find("wangchunyu.gaobao"));
      assert.equal(check.ok, false);
      assert.match(check.reason, /缺 1 蓝/);

      const state = mk(CHAR.wangchunyu, CHAR.dummy);
      const unit = state.units[0];
      unit.mp = 5;
      unit.charge = { skillId: "wangchunyu.gaobao", amount: 3 };
      cast(state, "a", "wangchunyu.gaobao", "a");
      assert.equal(B.state.statOf(unit, "def"), 0);
      assert.equal(B.state.statOf(unit, "mres"), 0);
      assert.equal(B.state.spdOf(unit), 250);
      assert.equal(B.state.statOf(unit, "atk"), 50);
      endRound(state, 1);
      endRound(state, 2);
      endRound(state, 3);
      endRound(state, 4);
      assert.equal(B.state.statOf(unit, "def"), 10, "到期恢复");
      assert.equal(B.state.statOf(unit, "mres"), 10);
      assert.equal(B.state.spdOf(unit), 110);
      assert.equal(B.state.statOf(unit, "atk"), 60);
    }
  },
  {
    name: "韩东晓·我是天才：蓝 +5 钳上限、四维 +10 永久、勇猛逐回合 −20% 共 4 回合",
    run() {
      const state = mk(CHAR.handongxiao, CHAR.dummy);
      const unit = state.units[0];
      const foe = state.units[1];
      unit.mp = 18;
      unit.charge = { skillId: "handongxiao.woshi", amount: 3 };
      cast(state, "a", "handongxiao.woshi", "a");
      assert.equal(unit.mp, 20, "蓝 +5 钳到上限");
      assert.equal(B.state.statOf(unit, "atk"), 95);
      assert.equal(B.state.statOf(unit, "def"), 40);
      assert.equal(B.state.statOf(unit, "mres"), 60);
      assert.equal(B.state.spdOf(unit), 100);
      assert.equal(foe.buffs.filter((b) => b.kind === "brave")[0].percent, 100);
      endRound(state, 1);
      assert.equal(foe.buffs.filter((b) => b.kind === "brave")[0].percent, 80, "释放当回合末第一次衰减");
      endRound(state, 2);
      assert.equal(foe.buffs.filter((b) => b.kind === "brave")[0].percent, 60);
      endRound(state, 3);
      assert.equal(foe.buffs.filter((b) => b.kind === "brave")[0].percent, 40);
      endRound(state, 4);
      assert.equal(foe.buffs.filter((b) => b.kind === "brave").length, 0, "4 个标准回合后移除");
    }
  },
  {
    name: "韩东晓·机枪射手：5 段 10 真伤、永久 −5 蓝上限、可反复到不足 5",
    run() {
      const state = mk(CHAR.handongxiao, CHAR.dummy);
      const unit = state.units[0];
      const foe = state.units[1];
      unit.mp = 20;
      cast(state, "a", "handongxiao.jiqiang", "b");
      assert.equal(9999 - foe.hp, 50, "5 段 10 真伤");
      assert.equal(foe.breakValue, 5, "每段 +1 击溃值");
      assert.equal(B.state.maxMpOf(unit), 15, "蓝上限 −5");
      assert.equal(unit.mp, 15, "当前蓝钳到新上限");
      cast(state, "a", "handongxiao.jiqiang", "b");
      cast(state, "a", "handongxiao.jiqiang", "b");
      cast(state, "a", "handongxiao.jiqiang", "b");
      assert.equal(B.state.maxMpOf(unit), 0);
      assert.equal(unit.mp, 0);
      const blocked = B.conditions.evaluate(state, unit, B.skills.find("handongxiao.jiqiang"));
      assert.equal(blocked.ok, false, "蓝上限不足 5 置灰");
      assert.match(blocked.reason, /蓝上限不足/);
    }
  },
  {
    name: "第七批 unsupported 四条：置灰且原因可核对",
    run() {
      const pairs = [
        ["lvchangling.chaodu", /10 秒内喊出一串数字/],
        ["wangchunyu.chunyu", /条件写作「？」/],
        ["handongxiao.woshuai", /对方的回答/],
        ["handongxiao.chouxiang", /猜数/]
      ];
      const state = mk(CHAR.lvchangling, CHAR.dummy);
      for (const [id, pattern] of pairs) {
        const skill = B.skills.find(id);
        assert.ok(skill.unsupported, id + " 应置灰");
        assert.match(skill.unsupported, pattern);
        const check = B.conditions.evaluate(state, state.units[0], skill);
        assert.equal(check.ok, false);
        assert.match(check.reason, /本版未实现/);
      }
    }
  },
  {
    /* 机械跑一遍全部技能：不看数值对不对（那是手写用例的事），只看结算不抛错、
       血量/蓝/击溃值/眩晕值/行动条不越界不出 NaN、状态指纹算得出来。
       新角色进库自动被这条覆盖，不再需要为「条件不足」手写用例。 */
    name: "全技能释放：技能库每条各结算一次，不抛错、数值不越界、指纹可算",
    run() {
      const problems = [];
      let released = 0;
      let notReady = 0;
      for (const name of Object.keys(LIB.characters)) {
        const key = Object.keys(CHAR).find((k) => CHAR[k].name === name);
        if (!key) { problems.push(name + " 没有面板固件"); continue; }
        for (const skill of LIB.characters[name]) {
          if (skill.unsupported || skill.baseUnsupported || skill.passive) continue;
          /* 单体治疗类只有 1v1 的打不出队友，跳过不判失败 */
          if (skill.target === "ally") { notReady += 1; continue; }
          const state = mk(CHAR[key], CHAR.dummy, 7);
          const unit = state.units[0];
          unit.mp = B.state.maxMpOf(unit);
          unit.charge = skill.charge > 0 ? { skillId: skill.id, amount: skill.charge } : null;
          const target = skill.target === "self" || skill.target === "allAllies" ? "a" : "b";

          let result;
          try {
            result = cast(state, unit.uid, skill.id, target);
          } catch (err) {
            /* 业务规则抛的是普通 Error（缺蓝、还没刷题、要传 n……），那是前置条件不满足，
               记一笔跳过；TypeError / ReferenceError 才是引擎真炸了。 */
            if (err && (err.name === "Error" || err.name === "")) { notReady += 1; continue; }
            problems.push(name + " · " + skill.name + " 结算抛错：" + (err && err.message ? err.message : err));
            continue;
          }
          if (!result.committed || result.committed.kind === "charge") { notReady += 1; continue; }
          released += 1;

          for (const u of state.units) {
            const tag = name + " · " + skill.name + " · " + u.name;
            for (const field of ["hp", "mp", "breakValue", "stunValue", "gauge"]) {
              const v = Number(u[field]);
              if (!Number.isFinite(v)) problems.push(tag + " 的 " + field + " 不是有限数：" + u[field]);
              else if (v < 0) problems.push(tag + " 的 " + field + " 为负：" + v);
            }
            /* 面板值按 5 归一（测试木桩写 9999，会被算成 9995），容差留 5 */
            if (u.hp > B.state.statOf(u, "maxHp") + 5) problems.push(tag + " 血量超过上限：" + u.hp);
            if (u.mp > B.state.maxMpOf(u) + 5) problems.push(tag + " 蓝超过上限：" + u.mp);
            /* 上限见 js/engine/rules.js 的 CONFIG.breakValueMax / stunValueMax / gaugeMax */
            if (u.breakValue > 5) problems.push(tag + " 击溃值越界：" + u.breakValue);
            if (u.stunValue > 5) problems.push(tag + " 眩晕值越界：" + u.stunValue);
            if (u.gauge > 100) problems.push(tag + " 行动条越界：" + u.gauge);
          }
          try {
            B.state.hash(state);
          } catch (err) {
            problems.push(name + " · " + skill.name + " 指纹算不出来：" + (err && err.message ? err.message : err));
          }
        }
      }
      assert.equal(problems.length, 0, "\n" + problems.slice(0, 12).join("\n"));
      assert.ok(released >= 70, "只结算了 " + released + " 条技能（另有 " + notReady + " 条没进结算），阈值过低说明固件没生效");
    }
  }
];
