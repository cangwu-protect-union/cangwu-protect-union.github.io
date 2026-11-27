/* 回合制正传 6.0 · 联机对局三维场景
   固定机位、运行时剪影小人、贴地亮圈；标签与点击热区用 DOM，便于读屏与页面层事件委托。
   WebGL 不可用时退到 is-flat 的百分比定位，标签层照常创建。 */

import * as THREE from "../lib/three.module.min.js";

const HERO_H = 1.9;
const SUMMON_H = 0.85;
const NEAR = { x: -1.2, z: 2.2 };
const FAR = { x: 1.2, z: -2.2 };
const RING_CHOSEN = "#ff5a5a";
const RING_TARGET = "#d64545";

function el(ctx, name, cls) {
  var node = ctx.doc.createElement(name);
  if (cls) node.className = cls;
  return node;
}

function themeColors(doc) {
  var css = globalThis.getComputedStyle(doc.documentElement);
  function read(name, fallback) {
    return css.getPropertyValue(name).trim() || fallback;
  }
  return {
    card: read("--card", "#f6f8fa"), bg: read("--bg", "#ffffff"),
    border: read("--border", "#d8dee4"), accent: read("--accent", "#0969da")
  };
}

function segment(c2, pts, width, color) {
  c2.strokeStyle = color;
  c2.lineWidth = width;
  c2.beginPath();
  c2.moveTo(pts[0], pts[1]);
  c2.lineTo(pts[2], pts[3]);
  c2.stroke();
}

/* 通用人形剪影：腿、手臂、躯干、头；正面加两个眼睛点。 */
function drawFigure(c2, front, colors) {
  var w = c2.canvas.width;
  var h = c2.canvas.height;
  var cx = w / 2;
  c2.clearRect(0, 0, w, h);
  c2.lineCap = "round";
  c2.lineJoin = "round";
  var limbs = [
    [cx - w * 0.09, h * 0.55, cx - w * 0.13, h * 0.94, 0.12],
    [cx + w * 0.09, h * 0.55, cx + w * 0.13, h * 0.94, 0.12],
    [cx - w * 0.15, h * 0.34, cx - w * 0.25, h * 0.6, 0.1],
    [cx + w * 0.15, h * 0.34, cx + w * 0.25, h * 0.6, 0.1]
  ];
  limbs.forEach(function (limb) {
    var pts = [limb[0], limb[1], limb[2], limb[3]];
    segment(c2, pts, w * limb[4], colors.line);
    segment(c2, pts, w * limb[4] * 0.66, colors.fill);
  });
  c2.fillStyle = colors.fill;
  c2.strokeStyle = colors.line;
  c2.lineWidth = w * 0.03;
  c2.beginPath();
  c2.moveTo(cx - w * 0.15, h * 0.3);
  c2.lineTo(cx + w * 0.15, h * 0.3);
  c2.lineTo(cx + w * 0.12, h * 0.58);
  c2.lineTo(cx - w * 0.12, h * 0.58);
  c2.closePath();
  c2.fill();
  c2.stroke();
  c2.beginPath();
  c2.arc(cx, h * 0.19, w * 0.145, 0, Math.PI * 2);
  c2.fill();
  c2.stroke();
  if (!front) return;
  c2.fillStyle = colors.line;
  c2.beginPath();
  c2.arc(cx - w * 0.05, h * 0.18, w * 0.02, 0, Math.PI * 2);
  c2.fill();
  c2.beginPath();
  c2.arc(cx + w * 0.05, h * 0.18, w * 0.02, 0, Math.PI * 2);
  c2.fill();
}

function makeTexture(front, colors) {
  var canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  drawFigure(canvas.getContext("2d"), front, colors);
  var tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

function prepareDom(ctx) {
  if (ctx.labels) return;
  ctx.labels = ctx.rootEl.querySelector(".scene-labels");
  if (!ctx.labels) {
    ctx.labels = el(ctx, "div", "scene-labels");
    ctx.rootEl.appendChild(ctx.labels);
  }
}

function probeWebgl(ctx) {
  if (typeof globalThis.WebGLRenderingContext === "undefined") return false;
  try {
    var probe = ctx.doc.createElement("canvas");
    var gl = probe.getContext("webgl") || probe.getContext("experimental-webgl");
    if (!gl) return false;
    var lose = gl.getExtension("WEBGL_lose_context");
    if (lose) lose.loseContext();
    return true;
  } catch {
    return false;
  }
}

function makeRenderer(ctx) {
  if (!ctx.canvas) {
    ctx.canvas = ctx.host.querySelector("canvas");
    if (!ctx.canvas) {
      ctx.canvas = el(ctx, "canvas", "scene-canvas");
      ctx.host.appendChild(ctx.canvas);
    }
  }
  try {
    return new THREE.WebGLRenderer({ canvas: ctx.canvas, antialias: true, alpha: true });
  } catch {
    return null;
  }
}

function buildScene(ctx) {
  var colors = themeColors(ctx.doc);
  ctx.accent = new THREE.Color(colors.accent);
  ctx.scene = new THREE.Scene();
  ctx.scene.fog = new THREE.Fog(new THREE.Color(colors.bg), 14, 32);
  ctx.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  ctx.camera.position.set(0, 3.4, 8.6);
  ctx.camera.lookAt(0, 1.1, 0);
  ctx.ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: new THREE.Color(colors.card) }));
  ctx.ground.rotation.x = -Math.PI / 2; ctx.scene.add(ctx.ground);
  var edge = new THREE.Color(colors.border);
  ctx.grid = new THREE.GridHelper(36, 18, edge, edge);
  ctx.grid.material.transparent = true; ctx.grid.material.opacity = 0.45;
  ctx.grid.position.y = 0.005;
  ctx.scene.add(ctx.grid);
  ctx.planeGeom = new THREE.PlaneGeometry(1, 1);
  ctx.ringHeroGeom = new THREE.RingGeometry(0.4, 0.56, 40);
  ctx.ringSummonGeom = new THREE.RingGeometry(0.2, 0.3, 32);
  ctx.shadowGeom = new THREE.CircleGeometry(0.32, 20);
  ctx.shadowMat = new THREE.MeshBasicMaterial({ color: 0x11161c, transparent: true, opacity: 0.18, depthWrite: false });
  ctx.textures.own = makeTexture(false, { fill: "#7d93b6", line: "#2a3341" });
  ctx.textures.enemy = makeTexture(true, { fill: "#a8604f", line: "#3a221d" });
}

function syncSize(ctx) {
  var w = ctx.rootEl.clientWidth || ctx.host.clientWidth || 0;
  var h = ctx.rootEl.clientHeight || ctx.host.clientHeight || 0;
  if (!w || !h) return;
  ctx.width = w; ctx.height = h;
  if (ctx.camera) {
    ctx.camera.aspect = w / h;
    ctx.camera.updateProjectionMatrix();
  }
  if (ctx.renderer) ctx.renderer.setSize(w, h, false);
}

function onResize(ctx) {
  if (ctx.flat) return;
  syncSize(ctx);
  renderFrame(ctx);
}

function onVisibility(ctx) {
  if (ctx.doc.hidden) {
    if (ctx.rafId) globalThis.cancelAnimationFrame(ctx.rafId);
    ctx.rafId = 0;
    return;
  }
  onResize(ctx);
  if (hasRing(ctx)) schedule(ctx);
}

function bindEvents(ctx) {
  if (typeof globalThis.ResizeObserver !== "undefined") {
    ctx.observer = new globalThis.ResizeObserver(function () {
      onResize(ctx);
    });
    ctx.observer.observe(ctx.rootEl);
  } else {
    globalThis.addEventListener("resize", ctx.onResizeBound);
    ctx.resizeBound = true;
  }
  ctx.doc.addEventListener("visibilitychange", ctx.onVisibilityBound);
  ctx.visibilityBound = true;
}

function startScene(ctx) {
  ctx.started = true;
  prepareDom(ctx);
  var renderer = probeWebgl(ctx) ? makeRenderer(ctx) : null;
  if (!renderer) {
    ctx.flat = true;
    ctx.rootEl.classList.remove("is-3d"); ctx.rootEl.classList.add("is-flat");
    return;
  }
  ctx.renderer = renderer;
  ctx.rootEl.classList.add("is-3d"); ctx.rootEl.classList.remove("is-flat");
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
  buildScene(ctx);
  syncSize(ctx);
  bindEvents(ctx);
}

function project(ctx, x, y, z) {
  var v = new THREE.Vector3(x, y, z).project(ctx.camera);
  return { x: (v.x * 0.5 + 0.5) * ctx.width, y: (-v.y * 0.5 + 0.5) * ctx.height };
}

function makeTag(ctx, uid, isSummon) {
  var tag = el(ctx, "div", "scene-tag");
  var name = el(ctx, "span", "scene-tag-name");
  var bar = el(ctx, "span", "scene-tag-hp");
  var fill = el(ctx, "i", "");
  var sub = el(ctx, "span", "scene-tag-sub");
  bar.appendChild(fill);
  tag.appendChild(name);
  tag.appendChild(bar);
  tag.appendChild(sub);
  var hit = el(ctx, "button", "scene-hit");
  hit.type = "button"; hit.setAttribute(isSummon ? "data-summon" : "data-unit", uid); hit.setAttribute("aria-label", "选择目标");
  return { tag: tag, name: name, bar: bar, fill: fill, sub: sub, hit: hit };
}

function buildBody(ctx, item) {
  var height = item.summon ? SUMMON_H : HERO_H;
  var shadow = new THREE.Mesh(ctx.shadowGeom, ctx.shadowMat);
  shadow.rotation.x = -Math.PI / 2; shadow.scale.set(item.summon ? 0.55 : 1, 0.55, 1); shadow.position.y = 0.008;
  var map = item.near ? ctx.textures.own : ctx.textures.enemy;
  var material = new THREE.MeshBasicMaterial({ map: map, transparent: true, side: THREE.DoubleSide, depthWrite: false });
  var mesh = new THREE.Mesh(ctx.planeGeom, material);
  mesh.scale.set(height * 0.52, height, 1); mesh.position.y = height / 2; mesh.renderOrder = 2;
  var group = new THREE.Group();
  group.add(shadow);
  group.add(mesh);
  ctx.scene.add(group);
  var ringMat = new THREE.MeshBasicMaterial({ color: ctx.accent, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  var ring = new THREE.Mesh(item.summon ? ctx.ringSummonGeom : ctx.ringHeroGeom, ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.012; ring.renderOrder = 1; ring.visible = false;
  ctx.scene.add(ring);
  item.group = group; item.mesh = mesh; item.ring = ring;
}

function ensureItem(ctx, uid, isSummon, near) {
  var item = ctx.items.get(uid);
  if (item) return item;
  var bits = makeTag(ctx, uid, isSummon);
  ctx.labels.appendChild(bits.tag); ctx.labels.appendChild(bits.hit);
  item = {
    uid: uid, summon: isSummon, near: near, dead: false, index: 0, pos: null,
    group: null, mesh: null, ring: null, ringOpacity: 0,
    tag: bits.tag, nameEl: bits.name, barEl: bits.bar, fillEl: bits.fill, subEl: bits.sub, hit: bits.hit
  };
  if (!ctx.flat) buildBody(ctx, item);
  ctx.items.set(uid, item);
  return item;
}

function placeItem(ctx, item, pos, index) {
  item.pos = pos;
  item.index = index;
  if (!item.group) return;
  item.group.position.set(pos.x, 0, pos.z);
  item.ring.position.set(pos.x, 0.012, pos.z);
}

function placeHero(ctx, unit, near, seen) {
  if (!unit || !unit.uid) return;
  seen[unit.uid] = true;
  var item = ensureItem(ctx, unit.uid, false, near);
  placeItem(ctx, item, near ? NEAR : FAR, 0);
  applyUnit(ctx, item, unit, false);
}

function placeSummons(ctx, side, seen) {
  var B = globalThis.RPG6B;
  if (!B || !B.summons || !B.summons.ofSide) return;
  var list = B.summons.ofSide(ctx.view.state, side) || [];
  var near = side === ctx.view.side;
  var center = near ? NEAR : FAR;
  for (var i = 0; i < list.length; i++) {
    var unit = list[i];
    if (!unit || !unit.uid) continue;
    seen[unit.uid] = true;
    var item = ensureItem(ctx, unit.uid, true, near);
    var offset = (i - (list.length - 1) / 2) * 0.72;
    placeItem(ctx, item, { x: center.x + offset, z: center.z + (near ? -0.95 : 0.95) }, i);
    applyUnit(ctx, item, unit, true);
  }
}

function ringSpec(ctx, item, isSummon) {
  var pick = ctx.view.pick;
  var targets = pick && pick.targets ? pick.targets : [];
  if (item.dead) return null;
  if (!isSummon && pick && pick.mode === "input" && targets[0] === item.uid) {
    return { color: RING_CHOSEN, opacity: 0.9, scale: 1.16 };
  }
  if (targets.indexOf(item.uid) >= 0) return { color: RING_TARGET, opacity: 0.62, scale: 1 };
  if (!isSummon && ctx.view.state && ctx.view.state.turnUid === item.uid) {
    return { color: ctx.accent, opacity: 0.45, scale: 1 };
  }
  return null;
}

function applyRing(ctx, item, isSummon) {
  if (!item.ring) return;
  var spec = ringSpec(ctx, item, isSummon);
  item.ring.visible = !!spec;
  item.ringOpacity = spec ? spec.opacity : 0;
  if (!spec) return;
  item.ring.material.color.set(spec.color);
  item.ring.material.opacity = spec.opacity;
  item.ring.scale.set(spec.scale, spec.scale, 1);
}

function applyUnit(ctx, item, unit, isSummon) {
  var B = globalThis.RPG6B;
  var max = B && B.state && B.state.maxHpOf ? B.state.maxHpOf(unit) : Number(unit.maxHp) || 1;
  var hp = Math.max(0, Number(unit.hp) || 0);
  var pct = max > 0 ? Math.max(0, Math.min(100, (hp / max) * 100)) : 0;
  var showHp = !item.summon || unit.targetable;
  item.dead = showHp && hp <= 0;
  if (item.mesh) item.mesh.material.opacity = item.dead ? 0.35 : 1;
  item.nameEl.textContent = unit.name || "？";
  if (item.barEl) item.barEl.hidden = !showHp;
  item.fillEl.style.width = (item.dead ? 0 : pct) + "%";
  item.fillEl.classList.toggle("is-low", !item.dead && pct < 30); item.fillEl.classList.toggle("is-mid", !item.dead && pct >= 30 && pct < 60);
  item.tag.classList.toggle("is-dead", item.dead);
  var parts = [];
  if (showHp) parts.push("血 " + hp + "/" + max);
  if (unit.ttl && unit.ttl.remain != null) parts.push("剩 " + unit.ttl.remain + " 回合");
  var sub = parts.join(" · ");
  item.subEl.textContent = sub; item.subEl.hidden = !sub;
  var label = (unit.name || "？") + (showHp ? " " + hp + "/" + max : " 不可选中") +
    (item.dead ? " 已倒下" : "") +
    (unit.ttl && unit.ttl.remain != null ? " 剩 " + unit.ttl.remain + " 回合" : "");
  item.hit.setAttribute("aria-label", label);
  applyRing(ctx, item, isSummon);
}

function dropUnseen(ctx, seen) {
  var gone = [];
  ctx.items.forEach(function (item) { if (!seen[item.uid]) gone.push(item.uid); });
  gone.forEach(function (uid) { disposeItem(ctx, ctx.items.get(uid)); ctx.items["delete"](uid); });
}

function layoutLabels(ctx) {
  if (!ctx.camera || !ctx.width || !ctx.height) return;
  ctx.camera.updateMatrixWorld();
  ctx.items.forEach(function (item) {
    var pos = item.pos;
    if (!pos) return;
    var height = item.summon ? SUMMON_H : HERO_H;
    var tagPoint = project(ctx, pos.x, item.summon ? 1.0 : 2.05, pos.z);
    var foot = project(ctx, pos.x, 0, pos.z);
    var head = project(ctx, pos.x, height, pos.z);
    var px = Math.abs(foot.y - head.y);
    px = Math.max(item.summon ? 50 : 140, Math.min(item.summon ? 260 : 380, px));
    var pad = (item.tag.offsetHeight || (item.summon ? 34 : 48)) + 4;
    var top = Math.min(tagPoint.y - pad, head.y - 8);
    var bottom = Math.max(foot.y + 6, top + px);
    var width = Math.max(item.summon ? 64 : 96, px * (item.summon ? 0.6 : 0.55), item.tag.offsetWidth || 0);
    item.tag.style.display = tagPoint.y < -80 || tagPoint.y > ctx.height + 80 ? "none" : "";
    item.tag.style.left = tagPoint.x.toFixed(1) + "px";
    item.tag.style.top = tagPoint.y.toFixed(1) + "px";
    item.hit.style.left = tagPoint.x.toFixed(1) + "px";
    item.hit.style.top = ((top + bottom) / 2).toFixed(1) + "px";
    item.hit.style.width = width.toFixed(1) + "px";
    item.hit.style.height = (bottom - top).toFixed(1) + "px";
  });
}

function layoutFlat(ctx) {
  ctx.items.forEach(function (item) {
    var left;
    var top;
    if (item.summon) {
      left = item.near ? 22 + item.index * 8 : 76 - item.index * 8;
      top = item.near ? 72 : 48;
    } else {
      left = item.near ? 32 : 64;
      top = item.near ? 64 : 40;
    }
    item.tag.style.display = "";
    item.tag.style.left = left + "%";
    item.tag.style.top = top - (item.summon ? 9 : 16) + "%";
    item.hit.style.left = left + "%";
    item.hit.style.top = top + "%";
    item.hit.style.width = (item.summon ? 48 : 84) + "px";
    item.hit.style.height = (item.summon ? 80 : 160) + "px";
  });
}

function animateRings(ctx, time) {
  ctx.items.forEach(function (item) {
    if (!item.ring || !item.ring.visible) return;
    var pulse = 0.72 + 0.28 * Math.sin(time * 3.2 + (item.summon ? 1.1 : 0));
    item.ring.material.opacity = item.ringOpacity * pulse;
  });
}

function hasRing(ctx) {
  var any = false;
  ctx.items.forEach(function (item) { if (item.ring && item.ring.visible) any = true; });
  return any;
}

function renderFrame(ctx) {
  if (ctx.flat || !ctx.renderer || !ctx.scene || !ctx.camera) return;
  layoutLabels(ctx);
  ctx.renderer.render(ctx.scene, ctx.camera);
}

function schedule(ctx) {
  if (ctx.rafId || ctx.flat || ctx.doc.hidden) return;
  ctx.rafId = globalThis.requestAnimationFrame(function (ts) {
    ctx.rafId = 0;
    if (ctx.doc.hidden || ctx.flat) return;
    animateRings(ctx, ts / 1000);
    renderFrame(ctx);
    if (hasRing(ctx)) schedule(ctx);
  });
}

function disposeItem(ctx, item) {
  if (!item) return;
  if (ctx.scene) {
    if (item.group) ctx.scene.remove(item.group);
    if (item.ring) ctx.scene.remove(item.ring);
  }
  if (item.mesh) item.mesh.material.dispose();
  if (item.ring) item.ring.material.dispose();
  if (item.hit.parentNode) item.hit.parentNode.removeChild(item.hit);
  if (item.tag.parentNode) item.tag.parentNode.removeChild(item.tag);
}

function disposeBasics(ctx) {
  if (ctx.ground) { ctx.ground.geometry.dispose(); ctx.ground.material.dispose(); }
  if (ctx.grid) { ctx.grid.geometry.dispose(); ctx.grid.material.dispose(); }
  [ctx.planeGeom, ctx.ringHeroGeom, ctx.ringSummonGeom, ctx.shadowGeom].forEach(function (geom) {
    if (geom) geom.dispose();
  });
  if (ctx.shadowMat) ctx.shadowMat.dispose();
  Object.keys(ctx.textures).forEach(function (key) {
    ctx.textures[key].dispose();
  });
  ctx.planeGeom = ctx.ringHeroGeom = ctx.ringSummonGeom = ctx.shadowGeom = null;
  ctx.shadowMat = null; ctx.textures = {}; ctx.ground = null; ctx.grid = null;
}

function destroyScene(ctx) {
  if (ctx.rafId) globalThis.cancelAnimationFrame(ctx.rafId);
  ctx.rafId = 0;
  if (ctx.visibilityBound) ctx.doc.removeEventListener("visibilitychange", ctx.onVisibilityBound);
  if (ctx.observer) {
    ctx.observer.disconnect();
    ctx.observer = null;
  }
  if (ctx.resizeBound) globalThis.removeEventListener("resize", ctx.onResizeBound);
  ctx.resizeBound = false;
  ctx.visibilityBound = false;
  ctx.items.forEach(function (item) {
    disposeItem(ctx, item);
  });
  ctx.items.clear();
  disposeBasics(ctx);
  if (ctx.renderer) {
    try { ctx.renderer.forceContextLoss(); } catch (e) { /* 老浏览器忽略 */ }
    ctx.renderer.dispose();
    ctx.renderer = null;
  }
  if (ctx.canvas && ctx.canvas.parentNode) ctx.canvas.parentNode.removeChild(ctx.canvas);
  if (ctx.labels && ctx.labels.parentNode) ctx.labels.parentNode.removeChild(ctx.labels);
  ctx.canvas = null; ctx.labels = null;
  ctx.rootEl.classList.remove("is-3d", "is-flat");
  ctx.scene = null; ctx.camera = null; ctx.started = false;
}

function updateScene(ctx, state, opts) {
  if (!state) return;
  var options = opts || {};
  ctx.view.state = state; ctx.view.pick = options.pick || null; ctx.view.side = options.side === "b" ? "b" : "a";
  if (!ctx.started) startScene(ctx);
  var units = state.units || [];
  var ownIdx = ctx.view.side === "a" ? 0 : 1;
  var seen = {};
  placeHero(ctx, units[ownIdx], true, seen);
  placeHero(ctx, units[1 - ownIdx], false, seen);
  placeSummons(ctx, "a", seen);
  placeSummons(ctx, "b", seen);
  dropUnseen(ctx, seen);
  if (ctx.flat) {
    layoutFlat(ctx);
    return;
  }
  syncSize(ctx);
  renderFrame(ctx);
  if (hasRing(ctx)) schedule(ctx);
}

export function createScene3d(liveRoot) {
  var host = liveRoot ? liveRoot.querySelector("[data-scene]") : null;
  if (!liveRoot || !host) {
    return {
      update: function () {},
      destroy: function () {},
      isFlat: function () {
        return true;
      }
    };
  }
  var ctx = {
    doc: liveRoot.ownerDocument || document, rootEl: liveRoot, host: host,
    labels: null, canvas: null, started: false, flat: false, renderer: null,
    scene: null, camera: null, ground: null, grid: null, accent: null,
    textures: {}, planeGeom: null, ringHeroGeom: null, ringSummonGeom: null,
    shadowGeom: null, shadowMat: null, items: new Map(),
    view: { state: null, pick: null, side: "a" },
    rafId: 0, observer: null, resizeBound: false, visibilityBound: false,
    width: 0, height: 0
  };
  ctx.onResizeBound = function () { onResize(ctx); };
  ctx.onVisibilityBound = function () { onVisibility(ctx); };
  return {
    update: function (state, opts) {
      updateScene(ctx, state, opts);
    },
    destroy: function () {
      destroyScene(ctx);
    },
    isFlat: function () {
      return ctx.flat;
    }
  };
}
