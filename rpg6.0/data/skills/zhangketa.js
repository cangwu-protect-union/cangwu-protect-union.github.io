/* 回合制正传 6.0 · 技能库 · 张克太 */
export default [
      {
        id: "zhangketa.jiba",
        name: "吉罢之歌",
        conditionText: "2蓝",
        cost: { mp: 2 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [
          {
            op: "tick",
            duration: { unit: "standard", count: 5 },
            label: "吉罢之歌",
            breakOnSourceStatus: ["stun", "break"],
            ops: [
              { op: "damage", type: "magic", value: 60, noStun: true }
            ]
          }
        ]
      },
      {
        id: "zhangketa.fubanzhuren",
        name: "副班主任之威[余威尚存]",
        conditionText: "6蓝4蓄力",
        cost: { mp: 6 },
        charge: 4,
        cooldown: 0,
        target: "self",
        ops: [
          { op: "stat", stat: "atk", who: "self", mode: "add", value: 80, duration: 10 },
          { op: "stat", stat: "spd", who: "self", mode: "add", value: 80, duration: 10 },
          { op: "stat", stat: "atk", who: "self", mode: "add", value: 30, duration: 10 },
          { op: "stat", stat: "def", who: "self", mode: "add", value: 30, duration: 10 },
          { op: "stat", stat: "mres", who: "self", mode: "add", value: 30, duration: 10 },
          { op: "stat", stat: "spd", who: "self", mode: "add", value: 30, duration: 10 },
          { op: "status", kind: "cannotAct", who: "self", rounds: 5, label: "副班主任：无法行动" },
          {
            op: "schedule",
            on: "self",
            after: 4,
            label: "副班主任：余威尚存",
            ops: [
              { op: "status", kind: "noSkill", who: "self", rounds: 6, label: "副班主任：只能普攻" },
              { op: "status", kind: "onlyBasic", who: "self", rounds: 6, label: "副班主任：只能普攻" }
            ]
          }
        ]
      },
      {
        id: "zhangketa.lsp",
        name: "LSP",
        conditionText: "被动",
        passive: true,
        cost: { mp: 0 },
        charge: 0,
        cooldown: 0,
        target: "self",
        ops: [],
        hooks: {
          battleStart: [
            {
              op: "if",
              cond: { gender: "target", eq: "女" },
              then: [
                { op: "stat", stat: "atk", who: "target", mode: "add", value: 10, duration: null },
                { op: "stat", stat: "def", who: "target", mode: "add", value: 10, duration: null },
                { op: "stat", stat: "spd", who: "target", mode: "add", value: 10, duration: null },
                { op: "stat", stat: "mres", who: "target", mode: "add", value: -5, duration: null }
              ]
            },
            {
              op: "if",
              cond: { gender: "self", eq: "女" },
              then: [
                { op: "stat", stat: "atk", who: "self", mode: "add", value: 10, duration: null },
                { op: "stat", stat: "def", who: "self", mode: "add", value: 10, duration: null },
                { op: "stat", stat: "spd", who: "self", mode: "add", value: 10, duration: null },
                { op: "stat", stat: "mres", who: "self", mode: "add", value: -5, duration: null }
              ]
            }
          ]
        }
      },
      {
        id: "zhangketa.yucuo",
        name: "愈挫愈勇",
        conditionText: "被动",
        passive: true,
        cost: { mp: 0 },
        charge: 0,
        cooldown: 0,
        target: "self",
        ops: [],
        hooks: {
          damageDealt: [
            { op: "mark", who: "self", key: "dealt", delta: 1 },
            {
              op: "if",
              cond: { left: { mark: "dealt" }, op: "ge", right: 3 },
              then: [
                { op: "mark", who: "self", key: "dealt", delta: -3 },
                { op: "stat", stat: "atk", who: "self", mode: "add", value: 5, duration: null }
              ]
            }
          ],
          damageTaken: [
            { op: "mark", who: "self", key: "taken", delta: 1 },
            {
              op: "if",
              cond: { left: { mark: "taken" }, op: "ge", right: 3 },
              then: [
                { op: "mark", who: "self", key: "taken", delta: -3 },
                { op: "stat", stat: "def", who: "self", mode: "add", value: 5, duration: null }
              ]
            }
          ],
          statDrained: [
            { op: "mark", who: "self", key: "drain", delta: 1 },
            {
              op: "if",
              cond: { left: { mark: "drain" }, op: "ge", right: 3 },
              then: [
                { op: "mark", who: "self", key: "drain", delta: -3 },
                { op: "stat", stat: "mres", who: "self", mode: "add", value: 5, duration: null },
                { op: "stat", stat: "spd", who: "self", mode: "add", value: 5, duration: null }
              ]
            }
          ]
        }
      }
];
