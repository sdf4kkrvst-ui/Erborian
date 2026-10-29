// «Тихий Брод 2» — browser action-RPG (Diablo-like camera). three.js + our GLB models.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import * as VFX from "./vfx.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
const mergeGeos = (a) => mergeGeometries(a, false);
import { Sound } from "./audio.js";

const A = "assets/";
const $ = (id) => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);
const irnd = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ------------------------------------------------------------------ renderer / scene / camera
const canvas = $("view");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.55;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 120);
const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
let QUALITY = IOS ? "low" : "high"; try { QUALITY = localStorage.getItem("tb2_quality") || QUALITY; } catch (e) {}
VFX.makeTextures();
scene.environment = VFX.makeEnvironment(renderer);
let composer = null;
function ensureComposer() { if (!composer) { composer = VFX.makeComposer(renderer, scene, camera); composer.resize(window.innerWidth, window.innerHeight, renderer.getPixelRatio()); } return composer; }
const sound = new Sound("assets/sfx/");
const PFIRE = new VFX.Particles(scene, 900, true), PSMOKE = new VFX.Particles(scene, 300, false), PBLOOD = new VFX.Particles(scene, 400, false), PDUST = new VFX.Particles(scene, 160, true);
const CAM_OFF = new THREE.Vector3(9.5, 15.5, 9.5);
let zoom = 1.0;
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  if (composer) composer.resize(w, h, renderer.getPixelRatio());
  camera.fov = w < h ? 46 : 34;                      // portrait phones see a bit more
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize); resize();

// ------------------------------------------------------------------ loading
const loader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();
let loadTotal = 0, loadDone = 0;
function progress() { $("loadbar").style.width = (100 * loadDone / Math.max(1, loadTotal)) + "%"; }
// Models ship as glTF JSON with the binary buffer embedded as base64. The page's security policy forbids fetching
// data: URLs, so we decode the buffer ourselves and hand GLTFLoader a GLB built in memory.
function b64ToBytes(b64) {
  const bin = atob(b64); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function toGLB(json) {
  const buf = json.buffers && json.buffers[0];
  let bin = new Uint8Array(0);
  if (buf && buf.uri && buf.uri.startsWith("data:")) { bin = b64ToBytes(buf.uri.slice(buf.uri.indexOf(",") + 1)); delete buf.uri; }
  const enc = new TextEncoder(); let js = enc.encode(JSON.stringify(json));
  const jpad = (4 - (js.length % 4)) % 4, bpad = (4 - (bin.length % 4)) % 4;
  const total = 12 + 8 + js.length + jpad + (bin.length ? 8 + bin.length + bpad : 0);
  const out = new Uint8Array(total); const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, js.length + jpad, true); dv.setUint32(16, 0x4e4f534a, true); out.set(js, 20); out.fill(0x20, 20 + js.length, 20 + js.length + jpad);
  if (bin.length) { const o = 20 + js.length + jpad; dv.setUint32(o, bin.length + bpad, true); dv.setUint32(o + 4, 0x004e4942, true); out.set(bin, o + 8); }
  return out.buffer;
}
async function loadGLB(url) {
  loadTotal++; progress();
  const r = await fetch(A + url);
  if (!r.ok) throw new Error(url + ": " + r.status);
  const json = await r.json();
  const g = await new Promise((res, rej) => loader.parse(toGLB(json), "", res, rej));
  loadDone++; progress();
  return g;
}
function loadTex(name, repeat = 1, srgb = true) {
  loadTotal++;
  const t = texLoader.load(A + "tex/" + name, () => { loadDone++; progress(); });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  t.anisotropy = 4; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function pbr(name, repeat, tint = 0xffffff, rough = 1, extra = {}) {
  return new THREE.MeshStandardMaterial({
    map: loadTex(name + "_c.jpg", repeat), normalMap: loadTex(name + "_n.jpg", repeat, false),
    roughnessMap: loadTex(name + "_r.jpg", repeat, false), roughness: rough, metalness: 0, color: tint, envMapIntensity: 0.06, ...extra,
  });
}

// ------------------------------------------------------------------ materials (CC0 ambientCG)
const MAT = {};
function makeMaterials() {
  MAT.cobble = pbr("cobble", 1, 0x8a8478);
  MAT.rockfloor = pbr("rockfloor", 1, 0x77746c);
  MAT.wall = pbr("wall", 1, 0x77706a);
  MAT.wall2 = pbr("wall2", 1, 0x8a8278);
  MAT.grass = pbr("grass", 6, 0x6f7a58);
  MAT.dirt = pbr("dirt", 1, 0x7d6c5c);
  MAT.planks = pbr("planks", 1, 0x806a55);
  MAT.roof = pbr("roof", 1, 0x6e4a3c);
  MAT.plaster = pbr("plaster", 1, 0xc9bca6);
  MAT.wood = pbr("wood", 1, 0x5a4434);
  MAT.metal = new THREE.MeshStandardMaterial({ color: 0x3a3a3e, metalness: 0.8, roughness: 0.45 });
  MAT.flame = new THREE.MeshBasicMaterial({ color: 0xffb04a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  MAT.glowBlue = new THREE.MeshBasicMaterial({ color: 0x7fb4ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  MAT.gold = new THREE.MeshStandardMaterial({ color: 0xffc848, metalness: 1, roughness: 0.3, emissive: 0x3a2200 });
  MAT.potionRed = new THREE.MeshStandardMaterial({ color: 0xc01818, emissive: 0x500000, roughness: 0.15, metalness: 0.1 });
  MAT.glass = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.6 });
  MAT.bone = new THREE.MeshStandardMaterial({ color: 0x9a8f78, roughness: 0.85 });
  MAT.dark = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 });
  // walls between the camera and the hero dissolve (Diablo-style x-ray cut)
  for (const k of ["wall", "wall2", "plaster", "roof", "planks"]) cutaway(MAT[k]);
}
const CUT = { hero: { value: new THREE.Vector3() }, cam: { value: new THREE.Vector3() }, r: { value: 2.3 } };
function cutaway(m) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uHero = CUT.hero; sh.uniforms.uCam = CUT.cam; sh.uniforms.uR = CUT.r;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWP;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed,1.0)).xyz;\n#ifdef USE_INSTANCING\nvWP = (modelMatrix * instanceMatrix * vec4(transformed,1.0)).xyz;\n#endif");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
      varying vec3 vWP; uniform vec3 uHero; uniform vec3 uCam; uniform float uR;`)
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
      { vec3 a = uHero + vec3(0.0,1.0,0.0); vec3 ab = uCam - a; float t = clamp(dot(vWP - a, ab) / dot(ab, ab), 0.0, 1.0);
        float d = length(vWP - (a + ab * t));
        if (t > 0.03 && d < uR * (0.6 + t)) { float dith = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453);
          if (dith < 0.82) discard; } }`);
  };
  m.customProgramCacheKey = () => "cut";
}

// ------------------------------------------------------------------ assets: characters, clips, items
const CHAR_FILES = { hero_t1: 1, hero_t2: 1, hero_t3: 1, hero_t4: 1, skeleton: 1, orc: 1, boss: 1, healer: 1, merchant: 1 };
const PROTO = {}; let CLIPS = {}; let GRIP = null; const ITEM_PROTO = {};
const ANIM = { idle: "sword_and_shield_idle", walk: "sword_and_shield_walk", run: "sword_and_shield_run", attack: "sword_and_shield_slash",
  attack2: "great_sword_slash", hit: "hit_reaction", death: "sword_and_shield_death", cast: "standing_1h_magic_attack_01",
  aoe: "standing_2h_magic_area_attack_01", power: "sword_and_shield_power_up", npc: "breathing_idle", block: "sword_and_shield_block" };

const CHAR_LOADING = {}, EXTRA_CLIPS = {};
function ensureChar(n) {
  if (PROTO[n]) return Promise.resolve();
  if (!CHAR_LOADING[n]) CHAR_LOADING[n] = loadGLB(n + ".json").then((g) => { PROTO[n] = g.scene; EXTRA_CLIPS[n] = g.animations || []; prepModel(g.scene); });
  return CHAR_LOADING[n];
}
function modelFor(cls, sex, tier) { return cls === "pal" && sex !== "f" ? "hero_t" + tier : `${cls}_${sex}_t${tier}`; }
function heroModelNameSaved() { try { const s = JSON.parse(localStorage.getItem("tb2_save") || "null"); return modelFor(s?.cls || "pal", s?.sex || "m", s?.eq?.armor?.tier || 1); } catch (e) { return "hero_t1"; } }
async function loadAll() {
  makeMaterials();
  const anims = loadGLB("anims.json");
  const grip = fetch(A + "grip.json").then((r) => r.json());
  const chars = [heroModelNameSaved(), "healer", "merchant"].map((n) => ensureChar(n));
  const items = [];
  for (const t of [1, 2, 3, 4]) for (const c of ["Sword", "Shield", "Axe", "Mace", "Staff"])
    items.push(loadGLB(`items/Human_${c}_T${t}.json`).then((g) => { ITEM_PROTO[`${c}_${t}`] = g.scene; prepModel(g.scene, false); }));
  const g = await anims; for (const c of g.animations) CLIPS[c.name] = c;
  GRIP = await grip;
  await Promise.all([...chars, ...items]);
}
function prepModel(root, shadows = true) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = shadows; o.receiveShadow = false; o.frustumCulled = false;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) { if (m.map) m.map.anisotropy = 4; m.envMapIntensity = 0.55; }
    }
  });
}

// ------------------------------------------------------------------ actors
class Actor {
  constructor(kind, protoName) {
    this.kind = kind; this.root = new THREE.Group(); scene.add(this.root);
    this.setModel(protoName);
    this.pos = this.root.position; this.face = 0; this.path = []; this.state = "idle"; this.cool = 0; this.dead = false;
    this.hitbox = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 2.0, 8), new THREE.MeshBasicMaterial({ visible: false }));
    this.hitbox.position.y = 1.0; this.hitbox.userData.actor = this; this.root.add(this.hitbox);
  }
  setModel(protoName) {
    if (this.model) { this.root.remove(this.model); }
    this.model = SkeletonUtils.clone(PROTO[protoName]);
    this.mats = [];
    this.model.traverse((o) => { if (o.isMesh) { o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
      for (const m of [].concat(o.material)) { if (m.emissive) { m.userData.e0 = m.emissive.clone(); this.mats.push(m); } } } });
    this.root.add(this.model);
    if (!this.blob) { this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: VFX.TEX.blob, transparent: true, depthWrite: false }));
      this.blob.rotation.x = -Math.PI / 2; this.blob.position.y = 0.03; this.blob.renderOrder = 1; this.root.add(this.blob); }
    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {}; this.cur = null; this.curName = "";
    for (const c of EXTRA_CLIPS[protoName] || []) this.mixer.clipAction(c).play();
    this.bones = {}; this.model.traverse((o) => { if (o.isBone) this.bones[o.name] = o; });
    if (this.curAnim) { const n = this.curAnim; this.curAnim = null; this.play(n); }
  }
  act(name) {
    const clip = CLIPS[ANIM[name] || name];
    if (!clip) return null;
    if (!this.actions[name]) this.actions[name] = this.mixer.clipAction(clip);
    return this.actions[name];
  }
  play(name, { once = false, speed = 1, fade = 0.18, restart = false } = {}) {
    if (this.curAnim === name && !restart) { if (this.cur) this.cur.timeScale = speed; return this.cur; }
    const a = this.act(name); if (!a) return null;
    a.reset(); a.timeScale = speed; a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    a.clampWhenFinished = once; a.enabled = true;
    if (this.cur && this.cur !== a) a.crossFadeFrom(this.cur, fade, false); else a.fadeIn(fade);
    a.play(); this.cur = a; this.curAnim = name; return a;
  }
  attachItem(key, side) {
    const slot = side === "r" ? "itemR" : "itemL";
    if (this[slot]) { this[slot].parent?.remove(this[slot]); this[slot] = null; }
    if (!key || !ITEM_PROTO[key]) return;
    const g = GRIP[side]; const bone = this.bones[g.bone]; if (!bone) return;
    const it = ITEM_PROTO[key].clone(true);
    it.position.set(g.pos[0], g.pos[2], -g.pos[1]);                      // Blender (Z-up) -> glTF (Y-up)
    it.quaternion.set(g.quat[0], g.quat[2], -g.quat[1], g.quat[3]);
    it.scale.set(g.scale[0], g.scale[2], g.scale[1]);
    bone.add(it); this[slot] = it;
  }
  faceTo(x, z, dt, rate = 12) {
    const want = Math.atan2(x - this.pos.x, z - this.pos.z);
    let d = want - this.face; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    this.face += d * Math.min(1, dt * rate); this.root.rotation.y = this.face;
  }
  followPath(dt, speed) {
    if (!this.path.length) return false;
    const p = this.path[0]; const dx = p.x - this.pos.x, dz = p.z - this.pos.z; const d = Math.hypot(dx, dz);
    if (d < 0.25) { this.path.shift(); return this.path.length > 0; }
    const step = Math.min(d, speed * dt);
    const nx = this.pos.x + dx / d * step, nz = this.pos.z + dz / d * step;
    if (world.walkable(nx, nz)) { this.pos.x = nx; this.pos.z = nz; } else { this.path = []; return false; }
    this.faceTo(p.x, p.z, dt);
    return true;
  }
  update(dt) {
    this.mixer.update(dt);
    if (this.flashT > 0) { this.flashT -= dt; const k = Math.min(1, Math.max(0, this.flashT / 0.14));
      for (const m of this.mats) m.emissive.copy(m.userData.e0).lerp(this.flashCol, k); }
  }
  flash(col = 0xff3020) { this.flashCol = new THREE.Color(col).multiplyScalar(0.8); this.flashT = 0.14; }
  dispose() { scene.remove(this.root); }
}

// ------------------------------------------------------------------ world: grid, navigation
const world = {
  cell: 1.0, W: 0, H: 0, grid: null, ox: 0, oz: 0, group: null, torches: [], kind: "town",
  idx(x, z) { const i = Math.floor((x - this.ox) / this.cell), j = Math.floor((z - this.oz) / this.cell); return [i, j]; },
  free(i, j) { return i >= 0 && j >= 0 && i < this.W && j < this.H && this.grid[j * this.W + i] === 1; },
  walkable(x, z) { const [i, j] = this.idx(x, z); return this.free(i, j); },
  center(i, j) { return new THREE.Vector3(this.ox + (i + 0.5) * this.cell, 0, this.oz + (j + 0.5) * this.cell); },
  los(a, b) {
    const n = Math.ceil(a.distanceTo(b) / (this.cell * 0.35));
    for (let k = 1; k < n; k++) { const t = k / n; if (!this.walkable(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false; }
    return true;
  },
  path(from, to, maxIter = 6000) {
    let [si, sj] = this.idx(from.x, from.z); let [ti, tj] = this.idx(to.x, to.z);
    if (!this.free(ti, tj)) { const n = this.nearestFree(ti, tj); if (!n) return []; [ti, tj] = n; }
    if (!this.free(si, sj)) { const n = this.nearestFree(si, sj); if (!n) return []; [si, sj] = n; }
    const W = this.W, key = (i, j) => j * W + i;
    const open = new Map(), came = new Map(), g = new Map();
    const h = (i, j) => Math.hypot(i - ti, j - tj);
    const s = key(si, sj); g.set(s, 0); open.set(s, h(si, sj));
    let it = 0;
    while (open.size && it++ < maxIter) {
      let cur = null, best = Infinity; for (const [k, f] of open) if (f < best) { best = f; cur = k; }
      const ci = cur % W, cj = (cur / W) | 0;
      if (ci === ti && cj === tj) break;
      open.delete(cur);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const ni = ci + di, nj = cj + dj; if (!this.free(ni, nj)) continue;
        if (di && dj && (!this.free(ci + di, cj) || !this.free(ci, cj + dj))) continue;
        const nk = key(ni, nj), ng = g.get(cur) + (di && dj ? 1.414 : 1);
        if (ng < (g.has(nk) ? g.get(nk) : Infinity)) { g.set(nk, ng); came.set(nk, cur); open.set(nk, ng + h(ni, nj)); }
      }
    }
    const end = key(ti, tj); if (!came.has(end) && end !== s) return [];
    const cells = []; let k = end; while (k !== s && k !== undefined) { cells.push([k % W, (k / W) | 0]); k = came.get(k); }
    cells.reverse();
    const pts = cells.map(([i, j]) => this.center(i, j));
    if (pts.length) { const last = pts[pts.length - 1]; if (this.walkable(to.x, to.z) && this.los(last, to)) { last.x = to.x; last.z = to.z; } }
    // string-pull smoothing
    const out = []; let anchor = from.clone();
    for (let q = 0; q < pts.length; q++) {
      if (q + 1 < pts.length && this.los(anchor, pts[q + 1])) continue;
      out.push(pts[q]); anchor = pts[q];
    }
    return out;
  },
  nearestFree(i, j) {
    for (let r = 1; r < 8; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (this.free(i + di, j + dj)) return [i + di, j + dj];
    return null;
  },
};

function clearWorld() {
  if (world.group) scene.remove(world.group);
  for (const e of enemies) e.dispose(); enemies.length = 0;
  for (const n of npcs) n.dispose(); npcs.length = 0;
  for (const l of loot) { scene.remove(l.obj); l.label.remove(); } loot.length = 0;
  for (const p of projectiles) scene.remove(p.mesh); projectiles.length = 0;
  for (const p of eproj) scene.remove(p.mesh); eproj.length = 0; for (const t of tele) scene.remove(t.grp); tele.length = 0;
  world.torches = []; world.interact = []; world.smokes = [];
  world.group = new THREE.Group(); scene.add(world.group);
}

// ---------- props
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
};
function addBox(mat, x, y, z, sx, sy, sz, rotY = 0, uvScale = null) {
  const geo = new THREE.BoxGeometry(sx, sy, sz);
  if (uvScale) scaleUV(geo, sx, sy, sz, uvScale);
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = rotY;
  m.castShadow = true; m.receiveShadow = true; world.group.add(m); return m;
}
function scaleUV(geo, sx, sy, sz, s) {           // world-size texture tiling on boxes
  const uv = geo.attributes.uv, n = geo.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    const w = nx > 0.5 ? sz : sx, h = ny > 0.5 ? sz : sy;
    uv.setXY(i, uv.getX(i) * w / s, uv.getY(i) * h / s);
  }
}
function barrel(x, z) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.32, 0.95, 14), MAT.wood); body.position.y = 0.48; g.add(body);
  for (const y of [0.18, 0.78]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.025, 6, 18), MAT.metal); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); }
  g.position.set(x, 0, z); g.traverse((o) => { o.castShadow = o.receiveShadow = true; }); world.group.add(g); return g;
}
function crate(x, z, s = 0.8, rot = 0) { const c = addBox(MAT.planks, x, s / 2, z, s, s, s, rot, 1.2); return c; }
function chest(x, z, rot = 0) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.55, 0.6), MAT.planks); b.position.y = 0.28; g.add(b);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.0, 12, 1, false, 0, Math.PI), MAT.planks);
  lid.rotation.z = Math.PI / 2; lid.position.y = 0.55; g.add(lid);
  for (const dx of [-0.35, 0.35]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 0.64), MAT.gold); s.position.set(dx, 0.32, 0); g.add(s); }
  g.position.set(x, 0, z); g.rotation.y = rot; g.traverse((o) => { o.castShadow = true; }); world.group.add(g);
  return g;
}
function bones(x, z) {
  const g = new THREE.Group();
  for (let k = 0; k < 6; k++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, rnd(0.3, 0.5), 5), MAT.bone);
    b.rotation.set(Math.PI / 2, 0, rnd(0, 6)); b.position.set(rnd(-0.4, 0.4), 0.04, rnd(-0.4, 0.4)); g.add(b);
  }
  const sk = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), MAT.bone); sk.position.set(rnd(-0.2, 0.2), 0.1, rnd(-0.2, 0.2)); g.add(sk);
  g.position.set(x, 0, z); world.group.add(g);
}
function torch(x, y, z, light = true) {
  const g = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.5, 6), MAT.wood); stick.rotation.x = 0.3; g.add(stick);
  const fl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffc070 })); fl.position.set(0, 0.3, 0.05); g.add(fl);
  g.position.set(x, y, z); world.group.add(g);
  world.torches.push({ pos: new THREE.Vector3(x, y + 0.36, z + 0.05), flame: fl, light });
  return g;
}
function flicker(t, seed) { return 0.85 + 0.15 * Math.sin(t * 11 + seed) * Math.sin(t * 7.3 + seed * 2); }

// ---------- lights (pooled point lights follow the nearest torches)
const hemi = new THREE.HemisphereLight(0x6070a0, 0x1a1410, 0.25); scene.add(hemi);
const moon = new THREE.DirectionalLight(0x8fa6ff, 0.0); moon.castShadow = true;
moon.shadow.mapSize.set(1024, 1024); const sc = moon.shadow.camera; sc.left = -18; sc.right = 18; sc.top = 18; sc.bottom = -18; sc.far = 60;
scene.add(moon); scene.add(moon.target);
const heroLight = new THREE.PointLight(0xffb070, 30, 17, 1.25); scene.add(heroLight);
const POOL = []; for (let k = 0; k < 4; k++) { const l = new THREE.PointLight(0xff9a4a, 0, 11, 1.4); scene.add(l); POOL.push(l); }

// ------------------------------------------------------------------ TOWN
function buildTown() {
  clearWorld(); world.kind = "town";
  const N = 64; world.W = N; world.H = N; world.cell = 1; world.ox = -N / 2; world.oz = -N / 2;
  world.grid = new Uint8Array(N * N).fill(1);
  const block = (x0, z0, x1, z1) => { for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const c = world.center(i, j); if (c.x > x0 && c.x < x1 && c.z > z0 && c.z < z1) world.grid[j * N + i] = 0; } };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (i < 2 || j < 2 || i > N - 3 || j > N - 3) world.grid[j * N + i] = 0;
  scene.background = new THREE.Color(0x0b0d14); scene.fog = new THREE.FogExp2(0x0b0d14, 0.035);
  hemi.intensity = 0.45; moon.intensity = 0.8;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(N, N), MAT.grass); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  world.group.add(ground);
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(9, 40), MAT.cobble.clone()); plaza.material.map = MAT.cobble.map.clone();
  for (const k of ["map", "normalMap", "roughnessMap"]) { plaza.material[k] = MAT.cobble[k].clone(); plaza.material[k].repeat.set(12, 12); plaza.material[k].needsUpdate = true; }
  plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.01; plaza.receiveShadow = true; world.group.add(plaza);
  // grass tufts (crossed alpha cards), kept off the plaza and the road
  const tuftGeo = new THREE.PlaneGeometry(0.9, 0.55); tuftGeo.translate(0, 0.27, 0);
  const tg2 = tuftGeo.clone().rotateY(Math.PI / 2); const tuft = mergeGeos([tuftGeo, tg2]);
  const tuftMat = new THREE.MeshStandardMaterial({ map: VFX.TEX.grass, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1, color: 0x9aa47a });
  const TN = QUALITY === "high" ? 1400 : 600; const tufts = new THREE.InstancedMesh(tuft, tuftMat, TN); const tm = new THREE.Matrix4(); let tn = 0;
  for (let k = 0; k < TN * 3 && tn < TN; k++) { const x = rnd(-29, 29), z = rnd(-29, 29);
    if (Math.hypot(x, z) < 9.5 || (Math.abs(x) < 2.6 && z < -8)) continue;
    tufts.setMatrixAt(tn++, tm.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd(0, 3)), new THREE.Vector3(1, 1, 1).multiplyScalar(rnd(0.6, 1.4)))); }
  tufts.count = tn; tufts.receiveShadow = true; world.group.add(tufts);
  world.smokes = [];
  const road = new THREE.Mesh(new THREE.PlaneGeometry(4, 22), MAT.cobble.clone());
  for (const k of ["map", "normalMap", "roughnessMap"]) { road.material[k] = MAT.cobble[k].clone(); road.material[k].repeat.set(3, 16); road.material[k].needsUpdate = true; }
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0.012, -19); road.receiveShadow = true; world.group.add(road);
  // houses around the plaza
  const houses = [[-15, -6, 0.2], [-15, 8, -0.1], [15, -7, 0.15], [15, 7, -0.2], [-6, 16, 0.05], [7, 17, -0.05]];
  for (const [x, z, r] of houses) { house(x, z, r); block(x - 4.2, z - 3.4, x + 4.2, z + 3.4); }
  // well
  const well = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.9, 16, 1, true), MAT.wall2); well.position.set(0, 0.45, 0); well.castShadow = true; world.group.add(well);
  const water = new THREE.Mesh(new THREE.CircleGeometry(1.0, 16), new THREE.MeshStandardMaterial({ color: 0x0a1820, roughness: 0.05, metalness: 0.5 }));
  water.rotation.x = -Math.PI / 2; water.position.y = 0.3; world.group.add(water);
  for (const s of [-1, 1]) addBox(MAT.wood, s * 1.0, 1.3, 0, 0.15, 1.8, 0.15);
  const roofW = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.9, 4), MAT.roof); roofW.position.set(0, 2.5, 0); roofW.rotation.y = Math.PI / 4; world.group.add(roofW);
  block(-1.6, -1.6, 1.6, 1.6);
  // campfire
  const fire = new THREE.Group(); for (let k = 0; k < 5; k++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 6), MAT.wood); l.rotation.set(Math.PI / 2, 0, k * 1.25); l.position.y = 0.08; fire.add(l); }
  fire.position.set(5, 0, 3); world.group.add(fire); torch(5, -0.25, 3); world.torches[world.torches.length - 1].big = 2.6; block(4.3, 2.3, 5.7, 3.7);
  // lamp posts
  for (const [x, z] of [[-6, -8], [6, -8], [-8, 6], [8, 6]]) { addBox(MAT.wood, x, 1.5, z, 0.18, 3, 0.18); torch(x, 2.9, z); block(x - 0.4, z - 0.4, x + 0.4, z + 0.4); }
  for (let k = 0; k < 7; k++) barrel(rnd(-12, 12) + (k % 2 ? 10 : -10), rnd(-12, 12));
  for (let k = 0; k < 5; k++) crate(rnd(-20, 20), rnd(-20, 20), rnd(0.6, 1), rnd(0, 3));
  // dead trees around the edge
  for (let k = 0; k < 26; k++) {
    const a = rnd(0, Math.PI * 2), r = rnd(23, 30); const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(x) < 4 && z < -15) continue;
    deadTree(x, z); block(x - 0.5, z - 0.5, x + 0.5, z + 0.5);
  }
  // dungeon entrance (north)
  const ex = 0, ez = -29;
  addBox(MAT.wall, ex - 2.4, 2, ez, 1.2, 4, 1.6, 0, 1.5); addBox(MAT.wall, ex + 2.4, 2, ez, 1.2, 4, 1.6, 0, 1.5);
  addBox(MAT.wall, ex, 4.4, ez, 6, 1.0, 1.6, 0, 1.5);
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.8), MAT.dark); hole.position.set(ex, 1.9, ez + 0.2); world.group.add(hole);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.4), MAT.glowBlue); glow.rotation.x = -Math.PI / 2; glow.position.set(ex, 0.03, ez + 1.4); world.group.add(glow);
  torch(ex - 1.7, 2.3, ez + 0.9); torch(ex + 1.7, 2.3, ez + 0.9);
  world.interact.push({ pos: new THREE.Vector3(ex, 0, ez + 1.6), r: 2.2, label: "Спуск в подземелье", act: () => enterDungeon(1) });
  // NPCs
  const healer = new Actor("npc", "healer"); healer.pos.set(-4, 0, -3); healer.face = 0.8; healer.root.rotation.y = 0.8; healer.play("npc");
  healer.name = "Лекарь Аделия"; healer.npc = "healer"; npcs.push(healer);
  const merchant = new Actor("npc", "merchant"); merchant.pos.set(4, 0, -4); merchant.face = -0.7; merchant.root.rotation.y = -0.7; merchant.play("npc");
  merchant.name = "Торговец Гримм"; merchant.npc = "merchant"; npcs.push(merchant);
  for (const n of npcs) { const [i, j] = world.idx(n.pos.x, n.pos.z); world.grid[j * N + i] = 0; }
  hero.pos.set(0, 0, 6); hero.path = []; hero.target = null;
  setLocation("Тихий Брод — деревня");
}
function house(x, z, rot) {
  const g = new THREE.Group(); world.group.add(g); g.position.set(x, 0, z); g.rotation.y = rot;
  const W = 7.6, D = 6, H = 3.2;
  const add = (mesh) => { mesh.castShadow = mesh.receiveShadow = true; g.add(mesh); return mesh; };
  const base = new THREE.BoxGeometry(W + 0.2, 0.8, D + 0.2); scaleUV(base, W, 0.8, D, 1.6); add(new THREE.Mesh(base, MAT.wall2)).position.y = 0.4;
  const walls = new THREE.BoxGeometry(W, H, D); scaleUV(walls, W, H, D, 2.5); add(new THREE.Mesh(walls, MAT.plaster)).position.y = 0.8 + H / 2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.25, H, 0.25), MAT.wood)).position.set(sx * W / 2, 0.8 + H / 2, sz * D / 2);
  for (const sz of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(W + 0.1, 0.22, 0.22), MAT.wood)).position.set(0, 0.8 + H, sz * D / 2);
  for (const k of [-2, 0, 2]) { const b = add(new THREE.Mesh(new THREE.BoxGeometry(0.2, H, 0.05), MAT.wood)); b.position.set(k, 0.8 + H / 2, D / 2 + 0.02); b.rotation.z = k ? 0.5 * Math.sign(k) : 0; }
  // gable roof
  const roofH = 2.6, ov = 0.6;
  const shape = new THREE.Shape(); shape.moveTo(-D / 2 - ov, 0); shape.lineTo(0, roofH); shape.lineTo(D / 2 + ov, 0); shape.lineTo(-D / 2 - ov, 0);
  const rg = new THREE.ExtrudeGeometry(shape, { depth: W + ov * 2, bevelEnabled: false });
  const ruv = rg.attributes.uv; for (let i = 0; i < ruv.count; i++) ruv.setXY(i, ruv.getX(i) / 2.2, ruv.getY(i) / 2.2);
  const roof = add(new THREE.Mesh(rg, MAT.roof)); roof.rotation.y = Math.PI / 2; roof.position.set(-W / 2 - ov, 0.8 + H, 0);
  // door + windows (warm light inside)
  add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.1, 0.1), MAT.planks)).position.set(1.5, 0.8 + 1.05, D / 2 + 0.06);
  const win = new THREE.MeshBasicMaterial({ color: 0xffaa55 });
  for (const wx of [-2.2, 3.2]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), win); w.position.set(wx, 0.8 + 1.9, D / 2 + 0.03); g.add(w); }
  const chim = add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.4, 0.7), MAT.wall2)); chim.position.set(W / 2 - 1.2, 0.8 + H + 1.4, -1.0);
  g.updateMatrixWorld(true); world.smokes.push(new THREE.Vector3(W / 2 - 1.2, 0.8 + H + 2.7, -1.0).applyMatrix4(g.matrixWorld));
}
function deadTree(x, z) {
  const g = new THREE.Group(); const h = rnd(3.5, 6);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.28, h, 7), MAT.wood); trunk.position.y = h / 2; g.add(trunk);
  for (let k = 0; k < 5; k++) {
    const L = rnd(1, 2.2); const br = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.09, L, 5), MAT.wood);
    const y = rnd(h * 0.45, h * 0.95), a = rnd(0, 6.28);
    br.position.set(Math.cos(a) * L * 0.4, y + L * 0.3, Math.sin(a) * L * 0.4); br.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); g.add(br);
  }
  g.position.set(x, 0, z); g.rotation.y = rnd(0, 6); g.traverse((o) => { o.castShadow = true; }); world.group.add(g);
}

// ------------------------------------------------------------------ DUNGEON (procedural rooms + corridors)
let depth = 1;
async function enterDungeon(d) {
  const need = ["skeleton", "orc", "healer"].concat(d % 3 === 0 ? ["boss"] : []);
  if (need.some((n) => !PROTO[n])) { toast("Спуск…", "#cbb48a"); await Promise.all(need.map(ensureChar)); }
  depth = d; buildDungeon(d); save();
}
function buildDungeon(d) {
  clearWorld(); world.kind = "dungeon";
  const N = 70; world.W = N; world.H = N; world.cell = 1; world.ox = -N / 2; world.oz = -N / 2;
  world.grid = new Uint8Array(N * N);
  scene.background = new THREE.Color(0x020203); scene.fog = new THREE.FogExp2(0x020203, 0.04);
  hemi.intensity = 0.28; moon.intensity = 0.0;
  const rooms = [];
  for (let tries = 0; tries < 300 && rooms.length < 9; tries++) {
    const w = irnd(7, 13), h = irnd(7, 12), x = irnd(2, N - w - 3), z = irnd(2, N - h - 3);
    if (rooms.some((r) => x < r.x + r.w + 3 && x + w + 3 > r.x && z < r.z + r.h + 3 && z + h + 3 > r.z)) continue;
    rooms.push({ x, z, w, h, cx: x + (w >> 1), cz: z + (h >> 1) });
  }
  const carve = (i, j) => { if (i > 0 && j > 0 && i < N - 1 && j < N - 1) world.grid[j * N + i] = 1; };
  for (const r of rooms) for (let j = r.z; j < r.z + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) carve(i, j);
  rooms.sort((a, b) => a.cx - b.cx);
  for (let k = 1; k < rooms.length; k++) {
    const a = rooms[k - 1], b = rooms[k];
    const hor = (j, i0, i1) => { for (let i = Math.min(i0, i1); i <= Math.max(i0, i1); i++) { carve(i, j); carve(i, j + 1); carve(i, j - 1); } };
    const ver = (i, j0, j1) => { for (let j = Math.min(j0, j1); j <= Math.max(j0, j1); j++) { carve(i, j); carve(i + 1, j); carve(i - 1, j); } };
    if (Math.random() < 0.5) { hor(a.cz, a.cx, b.cx); ver(b.cx, a.cz, b.cz); } else { ver(a.cx, a.cz, b.cz); hor(b.cz, a.cx, b.cx); }
  }
  // floor: one plane per walkable cell row-run (merged geometry)
  const floorGeo = []; const tmp = new THREE.Matrix4();
  const fg = new THREE.PlaneGeometry(1, 1); fg.rotateX(-Math.PI / 2);
  const floorCount = world.grid.reduce((s, v) => s + v, 0);
  const floor = new THREE.InstancedMesh(fg, MAT.rockfloor, floorCount); let fi = 0;
  const wallList = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    if (world.grid[j * N + i]) { const c = world.center(i, j); floor.setMatrixAt(fi++, tmp.makeTranslation(c.x, 0, c.z)); continue; }
    let near = false; for (let dj = -1; dj <= 1 && !near; dj++) for (let di = -1; di <= 1; di++) if (world.free(i + di, j + dj)) { near = true; break; }
    if (near) wallList.push([i, j]);
  }
  // baked-looking ambient occlusion: floor cells darken next to walls
  const fcol = new THREE.Color(); fi = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    if (!world.grid[j * N + i]) continue;
    let w = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if ((di || dj) && !world.free(i + di, j + dj)) w += (di && dj) ? 0.5 : 1;
    const v = clamp(1 - w * 0.13, 0.42, 1) * rnd(0.88, 1.05); floor.setColorAt(fi++, fcol.setRGB(v, v * 0.98, v * 0.95));
  }
  floor.receiveShadow = true; world.group.add(floor);
  const wg = new THREE.BoxGeometry(1, 3.2, 1); scaleUV(wg, 1, 3.2, 1, 1.6);
  const walls = new THREE.InstancedMesh(wg, MAT.wall, wallList.length);
  const wcol = new THREE.Color();
  wallList.forEach(([i, j], k) => { const c = world.center(i, j); walls.setMatrixAt(k, tmp.makeTranslation(c.x, 1.6, c.z));
    const v = rnd(0.75, 1.05); walls.setColorAt(k, wcol.setRGB(v, v * 0.97, v * 0.93)); });
  world.group.add(walls);
  // black wall tops (Diablo-style "solid rock" look from above)
  const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(1.02, 0.05, 1.02), new THREE.MeshBasicMaterial({ color: 0x050403 }), wallList.length);
  wallList.forEach(([i, j], k) => { const c = world.center(i, j); caps.setMatrixAt(k, tmp.makeTranslation(c.x, 3.22, c.z)); }); world.group.add(caps);
  // floor decals: blood, cracks, moss
  const floorCells = []; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (world.grid[j * N + i]) floorCells.push([i, j]);
  for (const [tex, count, size, op] of [[VFX.TEX.blood, 14, 1.3, 0.5], [VFX.TEX.crack, 40, 1.2, 0.7], [VFX.TEX.moss, 24, 1.6, 0.4]]) {
    const dm = new THREE.InstancedMesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: tex, color: tex === VFX.TEX.blood ? 0x6a3a30 : 0xffffff, transparent: true, opacity: op, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }), count);
    for (let k = 0; k < count; k++) { const [i, j] = pick(floorCells); const c = world.center(i, j);
      dm.setMatrixAt(k, tmp.compose(new THREE.Vector3(c.x + rnd(-0.3, 0.3), 0.012 + k * 0.0002, c.z + rnd(-0.3, 0.3)), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd(0, 6.3)), new THREE.Vector3(1, 1, 1).multiplyScalar(rnd(0.6, 1.3)))); }
    dm.renderOrder = 2; world.group.add(dm);
  }
  // cobwebs in inner corners, rubble along walls
  const webMat = new THREE.MeshBasicMaterial({ map: VFX.TEX.web, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.7 });
  const rubGeo = new THREE.DodecahedronGeometry(0.16, 0); const rub = new THREE.InstancedMesh(rubGeo, MAT.rockfloor, 260); let rk = 0;
  for (const [i, j] of floorCells) {
    const wx = !world.free(i - 1, j) ? -1 : !world.free(i + 1, j) ? 1 : 0, wz = !world.free(i, j - 1) ? -1 : !world.free(i, j + 1) ? 1 : 0;
    const c = world.center(i, j);
    if (wx && wz && Math.random() < 0.35) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), webMat);
      w.position.set(c.x + wx * 0.45, 2.4, c.z + wz * 0.45); w.lookAt(c.x - wx, 2.4, c.z - wz); w.rotateZ(wx * wz > 0 ? 0 : Math.PI / 2); world.group.add(w); }
    if ((wx || wz) && Math.random() < 0.18) for (let q = 0; q < irnd(2, 5) && rk < 260; q++) {
      rub.setMatrixAt(rk++, tmp.compose(new THREE.Vector3(c.x + wx * 0.35 + rnd(-0.35, 0.35), 0.05, c.z + wz * 0.35 + rnd(-0.35, 0.35)),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(0, 3), rnd(0, 3), 0)), new THREE.Vector3(1, 0.7, 1).multiplyScalar(rnd(0.5, 1.6)))); }
  }
  rub.count = rk; rub.castShadow = true; world.group.add(rub);
  // torches on walls facing a floor cell
  let tcount = 0;
  for (const [i, j] of wallList) {
    if (Math.random() > 0.08) continue;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (world.free(i + di, j + dj)) {
      const c = world.center(i, j); torch(c.x + di * 0.55, 1.9, c.z + dj * 0.55); tcount++; break;
    }
  }
  // decor + enemies
  const start = rooms[0], end = rooms[rooms.length - 1]; let necroLeft = d >= 4 ? 2 : 1;
  for (const r of rooms) {
    for (let k = 0; k < irnd(1, 3); k++) bones(r.x + rnd(1, r.w - 1) + world.ox, r.z + rnd(1, r.h - 1) + world.oz);
    if (Math.random() < 0.6) barrel(r.x + 1.2 + world.ox, r.z + 1.2 + world.oz);
    if (r === start) continue;
    const isBoss = r === end && d % 3 === 0;
    const n = isBoss ? 3 : irnd(2, 4) + Math.floor(d / 2);
    for (let k = 0; k < n; k++) {
      const r0 = Math.random(), pOrc = Math.min(0.2 + d * 0.06, 0.45), pArch = d >= 1 ? 0.22 : 0, pBers = d >= 2 ? Math.min(0.06 + d * 0.03, 0.2) : 0;
      const type = r0 < pBers ? "berserker" : r0 < pBers + pOrc ? "orc" : r0 < pBers + pOrc + pArch ? "archer" : "skeleton";
      spawnEnemy(type, r.x + rnd(1.5, r.w - 1.5) + world.ox, r.z + rnd(1.5, r.h - 1.5) + world.oz, d);
    }
    if (!isBoss && d >= 2 && necroLeft > 0 && Math.random() < 0.5) { necroLeft--; spawnEnemy("necro", r.cx + 0.5 + world.ox, r.cz + 0.5 + world.oz, d); }
    if (isBoss) spawnEnemy("boss", r.cx + 0.5 + world.ox, r.cz + 0.5 + world.oz, d);
    if (Math.random() < 0.45) { const c = chest(r.x + r.w - 1.5 + world.ox, r.z + 1.3 + world.oz, rnd(0, 6)); world.interact.push({ pos: c.position.clone(), r: 1.6, label: "Сундук", obj: c, act: () => openChest(c) }); }
  }
  // stairs down in the last room, way back up in the first one
  const sc = world.center(end.cx, end.cz);
  const st = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.1, 24), MAT.dark); st.position.set(sc.x, 0.02, sc.z); world.group.add(st);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.5, 32), MAT.glowBlue); ring.rotation.x = -Math.PI / 2; ring.position.set(sc.x, 0.05, sc.z); world.group.add(ring);
  world.interact.push({ pos: sc, r: 1.8, label: "Спуститься глубже", act: () => { if (d % 3 === 0 && enemies.some((e) => e.type === "boss" && !e.dead)) toast("Путь вниз запечатан, пока жив Тёмный рыцарь"); else enterDungeon(d + 1); } });
  const up = world.center(start.cx, start.cz);
  const ur = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.25, 32), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
  ur.rotation.x = -Math.PI / 2; ur.position.set(up.x, 0.05, up.z); world.group.add(ur);
  world.interact.push({ pos: up, r: 1.6, label: "Вернуться в деревню", act: () => { buildTown(); save(); } });
  hero.pos.set(up.x + 1.5, 0, up.z + 1.5); if (!hero_walkable()) hero.pos.copy(up); hero.path = []; hero.target = null;
  setLocation(`Подземелье — уровень ${d}${d % 3 === 0 ? " (логово Тёмного рыцаря)" : ""}`);
}
function hero_walkable() { return world.walkable(hero.pos.x, hero.pos.z); }

// ------------------------------------------------------------------ ENEMIES
const enemies = [], npcs = [], loot = [], projectiles = [];
const ETYPE = {
  skeleton: { name: "Скелет-воин", hp: 34, dmg: [4, 7], speed: 2.4, range: 1.7, xp: 12, gold: [2, 9], aggro: 9, scale: 1.0, bony: true },
  archer: { name: "Скелет-лучник", model: "skeleton", hp: 24, dmg: [5, 8], speed: 2.3, range: 9, ranged: "arrow", keep: 6, xp: 15, gold: [3, 10], aggro: 11, scale: 0.97, bony: true, tint: [0.9, 0.85, 0.65], bow: true },
  necro: { name: "Некромантка", model: "healer", hp: 58, dmg: [7, 11], speed: 2.1, range: 9.5, ranged: "dark", keep: 7.5, summoner: true, xp: 42, gold: [12, 30], aggro: 12, scale: 1.04, tint: [0.16, 0.1, 0.22], glow: 0x24063a },
  orc: { name: "Орк-рубака", hp: 70, dmg: [8, 13], speed: 2.8, range: 1.9, xp: 26, gold: [6, 18], aggro: 10, scale: 1.08 },
  berserker: { name: "Орк-берсерк", model: "orc", hp: 100, dmg: [11, 17], speed: 3.0, range: 2.0, charge: true, xp: 40, gold: [10, 26], aggro: 11, scale: 1.2, tint: [1.2, 0.62, 0.55], glow: 0x2a0400 },
  summon: { name: "Поднятый мертвец", model: "skeleton", hp: 16, dmg: [3, 6], speed: 2.7, range: 1.7, xp: 3, gold: [0, 2], aggro: 30, scale: 0.92, bony: true, tint: [0.7, 0.75, 1.0], glow: 0x1a0a40, summoned: true },
  boss: { name: "Тёмный рыцарь", hp: 420, dmg: [16, 26], speed: 2.6, range: 2.2, xp: 260, gold: [120, 220], aggro: 14, scale: 1.18, boss: true },
};
const eproj = [], tele = [];
const _c = new THREE.Color();
function tintActor(e, T) {
  e.model.traverse((o) => { if (!o.isMesh) return; for (const m of [].concat(o.material)) {
    if (T.tint && m.color) m.color.multiply(_c.setRGB(...T.tint));
    if (T.glow && m.emissive) { m.emissive.setHex(T.glow); m.emissiveIntensity = 1; m.userData.e0 = m.emissive.clone(); } } });
}
function giveBow(e) {
  const bone = e.bones[GRIP.l.bone] || e.bones["mixamorigLeftHand"]; if (!bone) return;
  const g = new THREE.Group();
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.022, 5, 18, Math.PI * 0.85), new THREE.MeshStandardMaterial({ color: 0x3a2614, roughness: 0.8 }));
  arc.rotation.z = Math.PI / 2 - Math.PI * 0.425; g.add(arc);
  const y = 0.48 * Math.sin(Math.PI * 0.425), x = 0.48 * Math.cos(Math.PI * 0.425);
  const str = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, y * 2, 3), new THREE.MeshBasicMaterial({ color: 0xcfc6b0 })); str.position.x = x; g.add(str);
  g.rotation.set(0, Math.PI / 2, 0);
  e.root.updateMatrixWorld(true); const ws = new THREE.Vector3(); bone.getWorldScale(ws); g.scale.setScalar(e.T.scale / ws.x);
  bone.add(g);
}
function spawnEnemy(type, x, z, d) {
  const T = ETYPE[type]; const e = new Actor("enemy", T.model || type);
  const k = 1 + 0.35 * (d - 1);
  e.type = type; e.T = T; e.name = T.name; e.maxhp = Math.round(T.hp * k); e.hp = e.maxhp; e.dmgK = k; e.spdK = 1; e.atkCD = T.boss ? 1.6 : 1.9;
  e.pos.set(x, 0, z); e.face = rnd(0, 6); e.root.rotation.y = e.face; e.root.scale.setScalar(T.scale);
  if (T.tint || T.glow) tintActor(e, T);
  if (T.bow) giveBow(e);
  e.home = e.pos.clone(); e.repath = 0; e.play("idle", { speed: rnd(0.8, 1.1) }); e.mixer.update(rnd(0, 2));
  e.sumCD = rnd(1.5, 3); e.chargeCD = rnd(0.2, 1); e.slamCD = 4; e.phase = 1;
  enemies.push(e); return e;
}
// summoned dead crawl out of the floor
function raiseDead(x, z, d) {
  for (let t = 0; t < 8; t++) { const px = x + rnd(-1.2, 1.2), pz = z + rnd(-1.2, 1.2); if (!world.walkable(px, pz)) continue;
    const e = spawnEnemy("summon", px, pz, d); e.root.position.y = -1.9; e.rising = 1.0; e.state = "chase"; e.faceTo(hero.pos.x, hero.pos.z, 1, 100);
    VFX.holy(PFIRE, px, 0.1, pz, 26, [0.55, 0.2, 0.9]); VFX.dust(PDUST, px, pz); ringFX(e.pos, 0x8a3aff, 1.0); return e; }
  return null;
}
// red ground warning that fills up, then fires
function telegraph(x, z, r, dur, done) {
  const grp = new THREE.Group(); grp.position.set(x, 0.07, z);
  const base = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshBasicMaterial({ color: 0xff2a10, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
  const edge = new THREE.Mesh(new THREE.RingGeometry(r * 0.94, r, 48), new THREE.MeshBasicMaterial({ color: 0xff4a20, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  const fill = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshBasicMaterial({ color: 0xff3a10, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  for (const m of [base, edge, fill]) { m.rotation.x = -Math.PI / 2; m.renderOrder = 4; grp.add(m); }
  scene.add(grp); tele.push({ grp, fill, t: 0, dur, done });
}
function updateTele(dt) {
  for (const T of [...tele]) { T.t += dt; const k = Math.min(1, T.t / T.dur); T.fill.scale.setScalar(Math.max(0.01, k));
    if (k >= 1) { scene.remove(T.grp); tele.splice(tele.indexOf(T), 1); T.done && T.done(); } }
}
function enemyShoot(e, kind) {
  const from = new THREE.Vector3(e.pos.x, 1.35 * e.T.scale, e.pos.z);
  const lead = hero.path.length ? 0.35 : 0;                              // aim a little ahead of a running hero
  const to = new THREE.Vector3(hero.pos.x + Math.sin(hero.face) * lead * 4, 1.1, hero.pos.z + Math.cos(hero.face) * lead * 4);
  const dir = to.sub(from).setY(0).normalize();
  let mesh;
  if (kind === "arrow") { mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.75, 4), new THREE.MeshBasicMaterial({ color: 0xd8c8a0 }));
    mesh.rotation.x = Math.PI / 2; const holder = new THREE.Group(); holder.add(mesh); holder.lookAt(dir); mesh = holder; sound.play("swing", { vol: 0.35, rate: 1.6, dist: e.pos.distanceTo(hero.pos) }); }
  else { mesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: 0xb050ff })); const l = new THREE.PointLight(0x9a40ff, 6, 5, 2); mesh.add(l); sound.magic("bolt"); }
  mesh.position.copy(from).addScaledVector(dir, 0.7); scene.add(mesh);
  eproj.push({ mesh, dir, kind, speed: kind === "arrow" ? 15 : 9, life: 1.6, dmg: Math.round(rnd(...e.T.dmg) * e.dmgK), src: e });
}
function updateEProj(dt) {
  for (const p of [...eproj]) {
    p.life -= dt; p.mesh.position.addScaledVector(p.dir, dt * p.speed);
    if (p.kind === "dark" && Math.random() < 0.6) VFX.holy(PFIRE, p.mesh.position.x, p.mesh.position.y - 0.2, p.mesh.position.z, 1, [0.6, 0.25, 1]);
    const hit = !hero.dead && Math.hypot(hero.pos.x - p.mesh.position.x, hero.pos.z - p.mesh.position.z) < 0.6;
    if (hit || p.life <= 0 || !world.walkable(p.mesh.position.x, p.mesh.position.z)) {
      if (hit) { damageHero(p.dmg, p.src); if (p.kind === "dark") ringFX(hero.pos, 0x9a40ff, 0.8); }
      scene.remove(p.mesh); eproj.splice(eproj.indexOf(p), 1);
    }
  }
}
function meleeSwing(e, d) {
  e.state = "attack"; e.cool = e.atkCD;
  const a = e.play(Math.random() < 0.5 || !e.T.boss ? "attack" : "attack2", { once: true, speed: (e.T.boss ? 1.25 : 1.1) * e.spdK, restart: true });
  const dur = a ? a.getClip().duration / a.timeScale : 1;
  if (e.T.bony) sound.rattle(d); else sound.growl(d, e.T.boss ? 0.7 : 1);
  setTimeout(() => { if (e.dead || hero.dead) return; sound.play("swing", { vol: 0.6, rate: e.T.boss ? 0.8 : 1 });
    if (e.pos.distanceTo(hero.pos) < e.T.range + 0.8) damageHero(Math.round(rnd(...e.T.dmg) * e.dmgK), e); }, dur * 450);
}
function stepAway(e, dt) {   // ranged enemies keep their distance
  const dx = e.pos.x - hero.pos.x, dz = e.pos.z - hero.pos.z, dd = Math.hypot(dx, dz) || 1;
  const nx = e.pos.x + dx / dd * dt * e.T.speed * 0.9, nz = e.pos.z + dz / dd * dt * e.T.speed * 0.9;
  if (world.walkable(nx, nz)) { e.pos.x = nx; e.pos.z = nz; e.play("walk", { speed: 1.1 }); e.faceTo(hero.pos.x, hero.pos.z, dt, 8); return true; }
  return false;
}
function updateEnemy(e, dt) {
  e.update(dt);
  if (e.dead) { e.sink = (e.sink || 0) + dt; if (e.sink > 6) { e.root.position.y -= dt * 0.3; if (e.sink > 9) { e.dispose(); enemies.splice(enemies.indexOf(e), 1); } } return; }
  if (e.rising > 0) { e.rising -= dt; e.root.position.y = -1.9 * Math.max(0, e.rising); if (Math.random() < 0.3) VFX.dust(PDUST, e.pos.x, e.pos.z); if (e.rising <= 0) e.root.position.y = 0; else return; }
  const slow = (e.slowT = (e.slowT || 0) - dt) > 0;
  e.cool -= dt * (slow ? 0.5 : 1); e.repath -= dt; e.sumCD -= dt; e.chargeCD -= dt; e.slamCD -= dt;
  const d = e.pos.distanceTo(hero.pos);
  if (hero.dead) { if (e.state !== "idle") { e.state = "idle"; e.play("idle"); } return; }
  if (e.state === "attack" || e.state === "cast") { if (e.cur && !e.cur.isRunning()) { e.state = "chase"; } e.faceTo(hero.pos.x, hero.pos.z, dt, 6); return; }
  if (e.state === "hit") { e.hitT -= dt; if (e.hitT <= 0) e.state = "chase"; return; }
  if (e.state === "slam") return;                                   // boss is winding up, telegraph decides
  // ---- berserker charge
  if (e.state === "windup") { e.windT -= dt; e.faceTo(hero.pos.x, hero.pos.z, dt, 10); if (Math.random() < 0.5) VFX.blood(PBLOOD, e.pos.x, 0.2, e.pos.z, 1);
    if (e.windT <= 0) { e.state = "charge"; e.chT = 0.85; e.chHit = false; e.chDir = new THREE.Vector3(hero.pos.x - e.pos.x, 0, hero.pos.z - e.pos.z).normalize(); e.play("run", { speed: 1.7 }); sound.growl(d, 0.8); } return; }
  if (e.state === "charge") {
    e.chT -= dt; const nx = e.pos.x + e.chDir.x * dt * 12, nz = e.pos.z + e.chDir.z * dt * 12;
    e.face = Math.atan2(e.chDir.x, e.chDir.z); e.root.rotation.y = e.face; if (Math.random() < 0.8) VFX.dust(PDUST, e.pos.x, e.pos.z);
    if (!e.chHit && e.pos.distanceTo(hero.pos) < 1.4) { e.chHit = true; damageHero(Math.round(rnd(...e.T.dmg) * e.dmgK * 1.6), e); shake(0.3); sound.play("heavy", { vol: 0.9 });
      for (let q = 0; q < 6; q++) { const hx = hero.pos.x + e.chDir.x * 0.3, hz = hero.pos.z + e.chDir.z * 0.3; if (world.walkable(hx, hz)) { hero.pos.x = hx; hero.pos.z = hz; } } hero.path = []; e.chT = Math.min(e.chT, 0.08); }
    if (e.chT <= 0 || !world.walkable(nx, nz)) { if (!world.walkable(nx, nz)) { shake(0.15); sound.play("heavy", { vol: 0.6, dist: d }); e.state = "hit"; e.hitT = 0.9; e.play("hit", { once: true, restart: true }); } else e.state = "chase"; e.chargeCD = rnd(4, 6); e.cool = 0.6; return; }
    e.pos.x = nx; e.pos.z = nz; return;
  }
  if (!(d < e.T.aggro || e.state === "chase")) return;
  if (e.state !== "chase") { e.state = "chase"; if (e.T.boss) toast("Тёмный рыцарь пробудился!"); if (e.T.summoner) toast("Некромантка поднимает мёртвых!", "#c79aff"); }
  const sees = d < 14 && world.los(e.pos, hero.pos);
  // ---- necromancer: raise the dead
  if (e.T.summoner && e.sumCD <= 0 && sees) {
    const mine = enemies.filter((o) => o.master === e && !o.dead).length;
    if (mine < 4) { e.state = "cast"; e.sumCD = rnd(8, 10); e.play("aoe", { once: true, speed: 1.2, restart: true }); sound.magic("whirl"); ringFX(e.pos, 0x9a40ff, 2);
      setTimeout(() => { if (e.dead) return; for (let q = 0; q < 2; q++) { const s = raiseDead(e.pos.x + rnd(-2, 2), e.pos.z + rnd(-2, 2), depth); if (s) s.master = e; } }, 700); return; }
  }
  // ---- berserker: wind-up then charge in a straight line
  if (e.T.charge && e.chargeCD <= 0 && d > 3.2 && d < 10 && sees) {
    e.state = "windup"; e.windT = 0.75; e.path = []; e.play("power", { once: true, speed: 1.6, restart: true }); e.flash(0xff2000); e.flashT = 0.7;
    sound.growl(d, 0.6); floatText(e.pos, "!", "#ff4a2a", 1.6); return;
  }
  // ---- boss phases: ground slam
  if (e.T.boss && e.phase >= 2 && e.slamCD <= 0 && d < 5.5) {
    e.state = "slam"; e.slamCD = e.phase >= 3 ? rnd(4.5, 6) : rnd(7, 9); e.path = []; e.play("aoe", { once: true, speed: 0.9, restart: true }); sound.growl(d, 0.5);
    const r = e.phase >= 3 ? 4.6 : 3.8, x = e.pos.x, z = e.pos.z;
    telegraph(x, z, r, 1.15, () => { if (e.dead) return; e.state = "chase"; shake(0.45); sound.play("heavy", { vol: 1 }); ringFX(e.pos, 0xff5a20, r); VFX.holy(PFIRE, x, 0.2, z, 50, [1, 0.35, 0.1]);
      for (let q = 0; q < 10; q++) VFX.dust(PDUST, x + rnd(-r, r) * 0.7, z + rnd(-r, r) * 0.7);
      if (Math.hypot(hero.pos.x - x, hero.pos.z - z) < r) damageHero(Math.round(rnd(...e.T.dmg) * e.dmgK * 1.3), e); });
    return;
  }
  // ---- ranged: keep distance, shoot when the line is clear
  if (e.T.ranged) {
    if (d < (e.backing ? e.T.keep : e.T.keep - 2.5) && stepAway(e, dt)) { e.backing = true; return; } e.backing = false;
    if (d <= e.T.range && sees) {
      e.path = []; e.faceTo(hero.pos.x, hero.pos.z, dt, 8);
      if (e.cool <= 0) { e.state = "attack"; e.cool = e.T.ranged === "arrow" ? rnd(1.8, 2.4) : rnd(2.2, 2.8);
        const a = e.play("cast", { once: true, speed: 1.2, restart: true }); const dur = a ? a.getClip().duration / a.timeScale : 1;
        if (e.T.bony) sound.rattle(d);
        setTimeout(() => { if (!e.dead && !hero.dead) enemyShoot(e, e.T.ranged); }, dur * 420); }
      else if (e.curAnim !== "idle") e.play("idle");
      return;
    }
  } else if (d <= e.T.range) {
    e.path = []; e.faceTo(hero.pos.x, hero.pos.z, dt, 8);
    if (e.cool <= 0) meleeSwing(e, d); else if (e.curAnim !== "idle") e.play("idle");
    return;
  }
  if (e.repath <= 0 || !e.path.length) { e.path = world.path(e.pos, hero.pos, 2500); e.repath = 0.6; }
  for (const o of enemies) if (o !== e && !o.dead) { const dx = e.pos.x - o.pos.x, dz = e.pos.z - o.pos.z, dd = Math.hypot(dx, dz); if (dd < 0.9 && dd > 0.01) { const nx = e.pos.x + dx / dd * dt, nz = e.pos.z + dz / dd * dt; if (world.walkable(nx, nz)) { e.pos.x = nx; e.pos.z = nz; } } }
  const sp = e.T.speed * e.spdK * (slow ? 0.45 : 1);
  if (e.followPath(dt, sp)) e.play(sp > 2.6 ? "run" : "walk", { speed: sp > 2.6 ? 0.9 * sp / 2.8 : 1.15 }); else e.play("idle");
}
function bossPhase(e) {
  const k = e.hp / e.maxhp;
  if (e.phase === 1 && k < 0.6) { e.phase = 2; e.slamCD = 1.5; toast("Тёмный рыцарь призывает мёртвых!", "#ff7a4a"); shake(0.3); sound.growl(0, 0.45);
    for (let q = 0; q < 3; q++) { const s = raiseDead(e.pos.x + rnd(-3, 3), e.pos.z + rnd(-3, 3), depth); if (s) s.master = e; } }
  if (e.phase === 2 && k < 0.3) { e.phase = 3; e.spdK = 1.35; e.atkCD = 1.05; e.slamCD = 1; toast("Тёмный рыцарь впадает в ярость!", "#ff3a2a"); shake(0.4); sound.growl(0, 0.4);
    for (const m of e.mats) { m.userData.e0 = new THREE.Color(0x3a0600); m.emissive.copy(m.userData.e0); }
    for (let q = 0; q < 2; q++) { const s = raiseDead(e.pos.x + rnd(-3, 3), e.pos.z + rnd(-3, 3), depth); if (s) s.master = e; } }
}
function damageEnemy(e, amount, crit = false) {
  if (e.dead) return;
  e.hp -= amount; floatText(e.pos, (crit ? "✶" : "") + amount, crit ? "#ffd04a" : "#ffffff", crit ? 1.25 : 1);
  e.flash(crit ? 0xffd040 : 0xff3020); sound.play(e.T.bony ? "stone" : "hit", { vol: 0.85, dist: e.pos.distanceTo(hero.pos) });
  if (e.T.bony) VFX.sparks(PFIRE, e.pos.x, 1.2, e.pos.z, 8, [0.9, 0.85, 0.7]); else VFX.blood(PBLOOD, e.pos.x, 1.2, e.pos.z, crit ? 22 : 12);
  if (crit) shake(0.12);
  showTarget(e);
  if (e.hp <= 0) { killEnemy(e); return; }
  if (e.T.boss) bossPhase(e);
  if (e.state === "windup" || e.state === "charge" || e.state === "slam" || e.rising > 0) return;
  if (e.state !== "attack" && !e.T.boss && Math.random() < 0.6) { e.state = "hit"; e.hitT = 0.45; e.play("hit", { once: true, restart: true, speed: 1.4 }); }
  if (e.state === "idle") e.state = "chase";
}
function killEnemy(e) {
  e.dead = true; e.state = "dead"; e.play("death", { once: true, restart: true }); e.hitbox.visible = false; e.hitbox.userData.actor = null;
  setTimeout(() => sound.play("fall", { vol: 0.7, dist: e.pos.distanceTo(hero.pos) }), 700);
  if (e.T.summoner) for (const o of enemies) if (o.master === e && !o.dead) { o.hp = 0; killEnemy(o); }
  if (e.T.bony) sound.rattle(0); else sound.growl(e.pos.distanceTo(hero.pos), 0.6);
  if (e.T.boss) { shake(0.5); VFX.holy(PFIRE, e.pos.x, 0.3, e.pos.z, 40, [1, 0.4, 0.2]); }
  gainXP(Math.round(e.T.xp * e.dmgK));
  if (!e.T.summoned || Math.random() < 0.15) dropLoot(e.pos, e.T, e.T.boss);
  if (hero.target === e) hero.target = null;
  if (e.T.boss) { toast("Тёмный рыцарь повержен! Путь вниз открыт."); }
  hideTargetSoon();
}

// ------------------------------------------------------------------ ITEMS & LOOT
const TIERNAME = ["", "Простой", "Добротный", "Мастерской", "Легендарный"];
const TIERCOL = ["", "#d8d4cc", "#6ea8ff", "#e6c35a", "#ff8a3d"];
const WNAMES = { Sword: ["Железный меч", "Стальной меч", "Меч Замка", "Святой клинок"], Axe: ["Железный топор", "Стальной топор", "Боевой топор Замка", "Секира рассвета"],
  Mace: ["Железная булава", "Стальная булава", "Молот Замка", "Булава небес"], Shield: ["Деревянный щит", "Окованный щит", "Щит Замка", "Эгида света"], Staff: ["Посох ученика", "Посох адепта", "Посох мага", "Посох Пламени"] };
const ANAMES_BY = { pal: ["Стёганка и кольчуга", "Кольчужный доспех", "Латы рыцаря Замка", "Латы паладина"],
  bar: ["Кожанка дикаря", "Доспех налётчика", "Броня вождя", "Латы Кровавой луны"], mag: ["Ученическая мантия", "Мантия адепта", "Облачение мага", "Мантия Пламени"] };
const WDMG = { Sword: [6, 11, 18, 27], Axe: [8, 13, 21, 31], Mace: [7, 12, 19, 29], Staff: [7, 12, 19, 28] };
const WSPD = { Sword: 1.25, Axe: 1.05, Mace: 1.12, Staff: 1.0 };
const CLASS_WEAPONS = { pal: ["Sword", "Axe", "Mace"], bar: ["Axe", "Mace", "Sword"], mag: ["Staff"] };
function makeItem(kind, tier, sub) {
  if (kind === "shield" && state.cls && state.cls !== "pal") kind = "weapon";
  if (kind === "weapon") { sub = sub || pick(CLASS_WEAPONS[state.cls || "pal"]); return { id: Math.random().toString(36).slice(2), kind, sub, tier, name: WNAMES[sub][tier - 1], dmg: WDMG[sub][tier - 1], spd: WSPD[sub] }; }
  if (kind === "shield") return { id: Math.random().toString(36).slice(2), kind, sub: "Shield", tier, name: WNAMES.Shield[tier - 1], armor: [3, 6, 10, 15][tier - 1] };
  if (kind === "armor") return { id: Math.random().toString(36).slice(2), kind, tier, name: ANAMES_BY[state.cls || "pal"][tier - 1], armor: [6, 14, 24, 36][tier - 1] };
  if (kind === "potion") return { id: Math.random().toString(36).slice(2), kind, name: "Зелье исцеления", heal: 45 };
}
function rollTier(boss) {
  const r = Math.random() + (depth - 1) * 0.06 + (boss ? 0.45 : 0);
  return r > 1.15 ? 4 : r > 0.85 ? 3 : r > 0.55 ? 2 : 1;
}
function dropLoot(pos, T, boss) {
  const gold = irnd(...T.gold) * (1 + (depth - 1) * 0.3) | 0; spawnLoot(pos, { kind: "gold", amount: gold, name: gold + " золота" });
  if (Math.random() < 0.3) spawnLoot(pos, makeItem("potion"));
  const n = boss ? 3 : Math.random() < 0.28 ? 1 : 0;
  for (let k = 0; k < n; k++) { const kind = pick(["weapon", "weapon", "shield", "armor"]); spawnLoot(pos, makeItem(kind, rollTier(boss))); }
}
function openChest(c) {
  if (c.userData.open) return; c.userData.open = true; sound.play("chest"); c.children[1].rotation.x = -1.2; c.children[1].position.z -= 0.25;
  spawnLoot(c.position, { kind: "gold", amount: irnd(15, 40) * depth, name: "" });
  spawnLoot(c.position, Math.random() < 0.6 ? makeItem(pick(["weapon", "shield", "armor"]), rollTier(false)) : makeItem("potion"));
}
function itemMesh(it) {
  if (it.kind === "gold") { const g = new THREE.Group(); for (let k = 0; k < 7; k++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 10), MAT.gold); c.position.set(rnd(-0.15, 0.15), 0.01 + k * 0.012, rnd(-0.15, 0.15)); g.add(c); } return g; }
  if (it.kind === "potion") { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), MAT.potionRed); b.position.y = 0.12; g.add(b); const n = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.1, 8), MAT.glass); n.position.y = 0.27; g.add(n); return g; }
  if (it.kind === "armor") { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4), new THREE.MeshStandardMaterial({ color: [0, 0x6b6560, 0x8f949c, 0xc6cbd3, 0xe8e4dc][it.tier], metalness: 0.9, roughness: 0.35 })); b.position.y = 0.09; g.add(b); return g; }
  const key = `${it.sub}_${it.tier}`; const m = ITEM_PROTO[key].clone(true); m.rotation.set(Math.PI / 2, 0, rnd(0, 6)); m.position.y = 0.06; const g = new THREE.Group(); g.add(m); return g;
}
function spawnLoot(pos, it) {
  const obj = itemMesh(it); obj.position.set(pos.x + rnd(-0.8, 0.8), 0, pos.z + rnd(-0.8, 0.8));
  if (!world.walkable(obj.position.x, obj.position.z)) obj.position.set(pos.x, 0, pos.z);
  world.group.add(obj);
  const label = document.createElement("div"); label.className = "lootlabel";
  label.textContent = it.kind === "gold" ? `${it.amount} золота` : it.name; label.style.color = it.tier ? TIERCOL[it.tier] : it.kind === "gold" ? "#e6c35a" : "#e8a0a0";
  const L = { obj, it, label };
  label.addEventListener("pointerdown", (ev) => { ev.stopPropagation(); hero.path = world.path(hero.pos, obj.position); hero.target = null; hero.pickup = L; });
  $("labels").appendChild(label); loot.push(L);
}
function pickUp(L) {
  const it = L.it;
  if (it.kind === "gold") { state.gold += it.amount; toast(`+${it.amount} золота`); sound.play("coins"); }
  else if (it.kind === "potion") { if (state.belt.length < 4) state.belt.push(it); else if (state.bag.length < 20) state.bag.push(it); else return toast("Сумка полна"); }
  else { if (state.bag.length >= 20) return toast("Сумка полна"); state.bag.push(it); toast(`Получено: ${it.name}`, TIERCOL[it.tier]); sound.play("pickup"); }
  world.group.remove(L.obj); L.label.remove(); loot.splice(loot.indexOf(L), 1); hud(); save();
}

// ------------------------------------------------------------------ HERO
const state = { level: 1, xp: 0, gold: 0, hp: 100, mp: 60, belt: [], bag: [], eq: { weapon: null, shield: null, armor: null }, cls: "pal", sex: "m", tal: {} };
let hero;
// ------------------------------------------------------------------ CLASSES
const CLS = {
  pal: { name: "Паладин", hpK: 1, mpK: 1, dmgK: 1, armK: 1, spdK: 1, regen: 1.6, desc: "Меч, щит и святой свет. Крепкий воин, умеет лечить себя.", dots: [3, 3, 2] },
  bar: { name: "Варвар", hpK: 1.15, mpK: 0.8, dmgK: 1.3, armK: 0.85, spdK: 1.12, regen: 1.5, desc: "Без щита и без страха. Огромный урон, вихрь и прыжок в гущу врагов.", dots: [4, 4, 1] },
  mag: { name: "Маг", hpK: 0.8, mpK: 1.7, dmgK: 1, armK: 0.7, spdK: 1, regen: 3.2, ranged: true, desc: "Бьёт огнём издалека. Хрупкий, но сжигает толпы и замораживает врагов.", dots: [2, 3, 4] },
};
// ------------------------------------------------------------------ TALENTS (1 point per level; capstone needs 5 points in its branch)
const TALENTS = [
  { br: "def", name: "Защита", col: "#8fb6ff", items: [
    { k: "fort", n: "Крепость", max: 3, d: (r) => `+${8 * r}% к здоровью` },
    { k: "iron", n: "Закалка", max: 3, d: (r) => `+${12 * r}% к броне` },
    { k: "thorn", n: "Шипы", max: 2, d: (r) => `${15 * r}% урона в ближнем бою возвращается врагу` },
    { k: "unb", n: "Несокрушимость", max: 1, cap: true, d: () => "При здоровье ниже 35% получаете на 40% меньше урона" } ] },
  { br: "light", name: "Свет", col: "#ffe08a", items: [
    { k: "grace", n: "Благодать", max: 3, d: (r) => `+${20 * r}% к любому лечению` },
    { k: "flow", n: "Поток", max: 3, d: (r) => `+${30 * r}% к восстановлению маны` },
    { k: "leech", n: "Вампиризм", max: 3, d: (r) => `${3 * r}% нанесённого урона лечит вас` },
    { k: "aura", n: "Святая аура", max: 1, cap: true, d: () => "В подземелье восстанавливаете 1,2% здоровья в секунду" } ] },
  { br: "fury", name: "Ярость", col: "#ff8a6a", items: [
    { k: "might", n: "Мощь", max: 3, d: (r) => `+${8 * r}% к урону` },
    { k: "crit", n: "Меткость", max: 3, d: (r) => `+${5 * r}% к шансу крита` },
    { k: "haste", n: "Быстрота", max: 3, d: (r) => `+${8 * r}% к скорости атаки` },
    { k: "exec", n: "Казнь", max: 1, cap: true, d: () => "+60% урона по врагам, у которых меньше 30% здоровья" } ] },
];
const TL = (k) => (state.tal && state.tal[k]) || 0;
function talSpent(br) { let n = 0; for (const B of TALENTS) if (!br || B.br === br) for (const t of B.items) n += TL(t.k); return n; }
function talFree() { return Math.max(0, state.level - 1 - talSpent()); }
const C = () => CLS[state.cls] || CLS.pal;
function maxHP() { return Math.round((90 + state.level * 14) * C().hpK * (1 + 0.08 * TL("fort"))); }
function maxMP() { return Math.round((50 + state.level * 8) * C().mpK); }
function armor() { const base = (state.eq.armor?.armor || 2) + (state.cls === "pal" ? state.eq.shield?.armor || 0 : 0);
  return Math.round(base * C().armK * (1 + 0.12 * TL("iron")) * (hero?.cryT > 0 ? 1.25 : 1)); }
function weaponDmg() { return (state.eq.weapon?.dmg || 3) + state.level * 1.2; }
function dmgMult(e) { return C().dmgK * (1 + 0.08 * TL("might")) * (hero?.cryT > 0 ? 1.4 : 1) * (hero?.angel ? 1.5 : 1) * (TL("exec") && e && e.hp / e.maxhp < 0.3 ? 1.6 : 1); }
function critChance() { return 0.12 + 0.05 * TL("crit"); }
function atkSpeed() { return C().spdK * (1 + 0.08 * TL("haste")) * (hero?.angel ? 1.15 : 1); }
function healHero(n, show = true) { n = Math.round(n * (1 + 0.2 * TL("grace"))); const before = state.hp; state.hp = Math.min(maxHP(), state.hp + n); if (show && state.hp - before >= 1) floatText(hero.pos, "+" + Math.round(state.hp - before), "#7dff8a"); return n; }
// every hero-dealt hit goes through here: class/talent/buff multipliers, crits, lifesteal
function hitEnemy(e, base, crit = false) {
  if (!e || e.dead) return 0;
  const dmg = Math.max(1, Math.round(base * dmgMult(e) * (crit ? 1.8 : 1)));
  damageEnemy(e, dmg, crit);
  if (TL("leech")) healHero(dmg * 0.03 * TL("leech"), false);
  return dmg;
}
function xpNeed() { return 60 + (state.level - 1) * 90 + (state.level - 1) ** 2 * 30; }
function gainXP(n) {
  state.xp += n;
  while (state.xp >= xpNeed()) { state.xp -= xpNeed(); state.level++; state.hp = maxHP(); state.mp = maxMP();
    toast(`Новый уровень: ${state.level}! Очко таланта (T)`, "#ffd04a"); levelFX(); sound.levelUp(); VFX.holy(PFIRE, hero.pos.x, 0.2, hero.pos.z, 50);
    if (state.level === 5) setTimeout(() => toast("Открыт Облик Архангела (клавиша 4)", "#ffe6a0"), 2600);
    if (state.level >= 4) ensureChar("archangel").catch(() => {}); buildSkillBar(); }
  hud();
}
function heroModelName() { return modelFor(state.cls, state.sex, state.eq.armor?.tier || 1); }
async function refreshHeroLook() {
  if (hero.angel) return;
  if (hero.modelName !== heroModelName()) {
    const want = heroModelName(); if (!PROTO[want]) { toast("Надеваю доспех…"); await ensureChar(want); }
    if (want !== heroModelName() || hero.angel) return;
    hero.modelName = want; hero.setModel(want);
  }
  hero.attachItem(state.eq.weapon ? `${state.eq.weapon.sub}_${state.eq.weapon.tier}` : null, "r");
  hero.attachItem(state.cls === "pal" && state.eq.shield ? `Shield_${state.eq.shield.tier}` : null, "l");
}
function damageHero(n, src) {
  if (hero.dead) return;
  if (hero.blocking && Math.random() < 0.5) { floatText(hero.pos, "Блок", "#9fc3ff"); sound.play("block"); return; }
  let dmg = n * 100 / (100 + armor() * 3);
  if (hero.angel) dmg *= 0.6;
  if (TL("unb") && state.hp < maxHP() * 0.35) dmg *= 0.6;
  dmg = Math.max(1, Math.round(dmg));
  if (TL("thorn") && src && src.pos && !src.dead && src.pos.distanceTo(hero.pos) < 3.2) damageEnemy(src, Math.max(1, Math.round(n * 0.15 * TL("thorn"))));
  if (hero.barrier > 0) { const ab = Math.min(hero.barrier, dmg); hero.barrier -= ab; dmg -= ab; if (dmg <= 0) { floatText(hero.pos, "поглощено", "#8ad8ff", 0.8); sound.play("block", { vol: 0.5 }); return; } }
  state.hp -= dmg; floatText(hero.pos, "-" + dmg, "#ff5a4a");
  sound.play("armorhit", { vol: 0.8 }); hero.flash(0xff2010); VFX.blood(PBLOOD, hero.pos.x, 1.2, hero.pos.z, 8); shake(src?.T?.boss ? 0.35 : 0.15);
  $("vignette").style.opacity = 0.65; setTimeout(() => ($("vignette").style.opacity = 0), 160);
  if (state.hp <= 0) { state.hp = 0; heroDie(); }
  hud();
}
function heroDie() {
  hero.dead = true; hero.path = []; hero.target = null; hero.play("death", { once: true, restart: true });
  const lost = Math.floor(state.gold * 0.2); state.gold -= lost;
  $("death").hidden = false; $("deathtext").textContent = lost ? `Вы потеряли ${lost} золота.` : "";
}
$("respawn").addEventListener("click", () => {
  $("death").hidden = true; hero.dead = false; if (hero.angel) endAngel(true); hero.cryT = 0; hero.barrier = 0; hero.spinT = 0; hero.leap = null;
  state.hp = maxHP(); state.mp = maxMP(); hero.play("idle", { restart: true });
  buildTown(); hud(); save();
});

function heroAttack(e) {
  if (hero.busy > 0) return;
  const w = state.eq.weapon;
  if (C().ranged) {                                    // mage: fire bolt from the staff
    const a = hero.play("cast", { once: true, speed: 1.55 * atkSpeed(), restart: true });
    const dur = a ? a.getClip().duration / a.timeScale : 0.8; hero.busy = dur * 0.72;
    setTimeout(() => { if (e.dead || hero.dead) return;
      const dir = new THREE.Vector3(e.pos.x - hero.pos.x, 0, e.pos.z - hero.pos.z).normalize(); const crit = Math.random() < critChance();
      heroShoot({ dir, dmg: weaponDmg() * rnd(0.85, 1.15), crit, color: hero.angel ? 0xfff0b0 : 0xff8a3a, light: hero.angel ? 0xffe08a : 0xff6a20, size: 0.14, speed: 19, life: 0.75, trail: hero.angel ? "holy" : "fire" });
      sound.magic("bolt"); }, dur * 0.33);
    return;
  }
  const spd = (w?.spd || 1.2) * 1.15 * atkSpeed();
  const a = hero.play(state.cls === "bar" || Math.random() < 0.3 ? "attack2" : "attack", { once: true, speed: spd * (state.cls === "bar" ? 1.15 : 1), restart: true });
  setTimeout(() => sound.play(state.eq.weapon?.sub === "Sword" ? "swing" : "chop", { vol: 0.7 }), 250);
  const dur = a ? a.getClip().duration / a.timeScale : 0.9;
  hero.busy = dur * 0.82;
  setTimeout(() => {
    if (e.dead || hero.dead) return;
    if (e.pos.distanceTo(hero.pos) < 2.6) {
      const crit = Math.random() < critChance(); hitEnemy(e, weaponDmg() * rnd(0.85, 1.15), crit); slashFX(e.pos);
      if (hero.angel) VFX.holy(PFIRE, e.pos.x, 1, e.pos.z, 8);
    }
  }, dur * 380);
}
function updateHero(dt) {
  hero.update(dt);
  if (hero.dead) return;
  hero.busy = (hero.busy || 0) - dt;
  state.mp = Math.min(maxMP(), state.mp + dt * C().regen * (1 + 0.3 * TL("flow"))); if (world.kind === "town") state.hp = Math.min(maxHP(), state.hp + dt * 4);
  if (TL("aura") && world.kind === "dungeon") state.hp = Math.min(maxHP(), state.hp + maxHP() * 0.012 * dt);
  if (hero.angel) state.hp = Math.min(maxHP(), state.hp + maxHP() * 0.015 * dt);
  updateBuffs(dt);
  updateFocus(dt);
  if (hero.leap) { updateLeap(dt); return; }
  if (hero.spinT > 0) { updateSpin(dt); return; }
  if (hero.busy > 0) { if (hero.target) hero.faceTo(hero.target.pos.x, hero.target.pos.z, dt, 10); return; }
  // auto-engage: standing still with an enemy close by -> fight it (Diablo-style), walking always wins
  if (!hero.target && !hero.path.length && !holding && focus && focus.pos.distanceTo(hero.pos) < (C().ranged ? 8 : AUTO_R)) hero.target = focus;
  if (hero.target) {
    const e = hero.target; if (e.dead) { hero.target = null; }
    else {
      const d = e.pos.distanceTo(hero.pos);
      if (C().ranged ? d < 8.5 && world.los(hero.pos, e.pos) : d < 1.9) { hero.path = []; hero.faceTo(e.pos.x, e.pos.z, dt, 20); heroAttack(e); return; }
      hero.repath = (hero.repath || 0) - dt;
      if (hero.repath <= 0 || !hero.path.length) { hero.path = world.path(hero.pos, e.pos); hero.repath = 0.35; }
    }
  }
  if (holding && !hero.target && performance.now() - holdT > 250) moveTo(holdPoint, false);
  if (hero.followPath(dt, 4.6)) hero.play("run", { speed: 0.95 });
  else {
    hero.play("idle");
    if (hero.pickup) { const L = hero.pickup; hero.pickup = null; if (loot.includes(L) && L.obj.position.distanceTo(hero.pos) < 1.6) pickUp(L); }
  }
  // automatic gold pickup + interaction prompts
  for (const L of [...loot]) if (L.it.kind === "gold" && L.obj.position.distanceTo(hero.pos) < 1.1) pickUp(L);
  let near = null; for (const it of world.interact) if (it.pos.distanceTo(hero.pos) < it.r) near = it;
  const npcNear = npcs.find((n) => n.pos.distanceTo(hero.pos) < 2.4);
  if (npcNear) near = { label: npcNear.name, act: () => talk(npcNear) };
  setPrompt(near);
}

// ------------------------------------------------------------------ SKILLS
const enemiesNear = (p, r) => enemies.filter((e) => !e.dead && Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < r);
function aimDir() { const t = hero.target && !hero.target.dead ? hero.target : focus && !focus.dead ? focus : nearestEnemy(14);
  if (t) { hero.faceTo(t.pos.x, t.pos.z, 1, 100); return new THREE.Vector3(t.pos.x - hero.pos.x, 0, t.pos.z - hero.pos.z).normalize(); }
  return new THREE.Vector3(Math.sin(hero.face), 0, Math.cos(hero.face)); }
const SKILLSETS = {
  pal: [
    { id: "whirl", name: "Освящённый круг", mp: 14, cd: 3, icon: "⟳", use() {
        const a = hero.play("aoe", { once: true, speed: 1.3, restart: true }); hero.busy = a ? a.getClip().duration / 1.3 * 0.7 : 1; hero.path = []; sound.magic("whirl");
        setTimeout(() => { ringFX(hero.pos, 0xffd27a, 3.2); VFX.holy(PFIRE, hero.pos.x, 0.4, hero.pos.z, 40); shake(0.1); for (const e of enemiesNear(hero.pos, 3.2)) hitEnemy(e, weaponDmg() * 1.4); }, 500);
      } },
    { id: "bolt", name: "Святая стрела", mp: 8, cd: 0.9, icon: "✦", use() {
        const dir = aimDir(); hero.play("cast", { once: true, speed: 1.5, restart: true }); hero.busy = 0.7; hero.path = [];
        setTimeout(() => { heroShoot({ dir, dmg: 8 + state.level * 3 + weaponDmg() * 0.5, color: 0xffe6a0, light: 0xffd58a, size: 0.18, speed: 16, life: 1.4, trail: "holy" }); sound.magic("bolt"); }, 380);
      } },
    { id: "heal", name: "Свет исцеления", mp: 22, cd: 6, icon: "✚", use() {
        hero.play("power", { once: true, speed: 1.4, restart: true }); hero.busy = 0.9; hero.path = [];
        healHero(maxHP() * 0.4); ringFX(hero.pos, 0x8dffb0, 1.6); VFX.holy(PFIRE, hero.pos.x, 0.2, hero.pos.z, 30, [0.6, 1, 0.6]); sound.magic("heal"); hud();
      } },
  ],
  bar: [
    { id: "spin", name: "Вихрь", mp: 16, cd: 4, icon: "⟳", use() {
        hero.spinT = 1.6; hero.spinTick = 0; hero.busy = 1.6; hero.path = []; hero.target = null; hero.play("attack2", { speed: 1.5, restart: true }); sound.magic("whirl");
      } },
    { id: "leap", name: "Прыжок", mp: 14, cd: 5, icon: "⤴", use() {
        const t = hero.target && !hero.target.dead ? hero.target : focus && !focus.dead && focus.pos.distanceTo(hero.pos) < 11 ? focus : nearestEnemy(11);
        let tx, tz;
        if (t) { const d = Math.max(0.01, t.pos.distanceTo(hero.pos)), k = Math.max(0, (d - 1.1) / d); tx = hero.pos.x + (t.pos.x - hero.pos.x) * k; tz = hero.pos.z + (t.pos.z - hero.pos.z) * k; }
        else { tx = hero.pos.x + Math.sin(hero.face) * 5; tz = hero.pos.z + Math.cos(hero.face) * 5; }
        for (let q = 0; q < 12 && !world.walkable(tx, tz); q++) { tx = hero.pos.x + (tx - hero.pos.x) * 0.8; tz = hero.pos.z + (tz - hero.pos.z) * 0.8; }
        if (t) hero.faceTo(t.pos.x, t.pos.z, 1, 100);
        hero.leap = { fx: hero.pos.x, fz: hero.pos.z, tx, tz, t: 0, dur: 0.55 }; hero.busy = 0.8; hero.path = []; hero.play("attack2", { once: true, speed: 1.1, restart: true }); sound.growl(0, 1.3);
      } },
    { id: "cry", name: "Боевой клич", mp: 20, cd: 14, icon: "♅", use() {
        hero.cryT = 10; hero.play("power", { once: true, speed: 1.4, restart: true }); hero.busy = 0.8; hero.path = [];
        healHero(maxHP() * 0.15); ringFX(hero.pos, 0xff5a3a, 3); VFX.holy(PFIRE, hero.pos.x, 0.3, hero.pos.z, 36, [1, 0.35, 0.2]); sound.growl(0, 0.75); shake(0.15); hud();
      } },
  ],
  mag: [
    { id: "fireball", name: "Огненный шар", mp: 14, cd: 1.6, icon: "☄", use() {
        const dir = aimDir(); hero.play("cast", { once: true, speed: 1.4, restart: true }); hero.busy = 0.7; hero.path = [];
        setTimeout(() => { heroShoot({ dir, dmg: weaponDmg() * 2.1 + state.level * 2, color: 0xff6a18, light: 0xff5a10, size: 0.32, speed: 13, life: 1.3, aoe: 2.7, trail: "fire" }); sound.magic("bolt"); }, 360);
      } },
    { id: "nova", name: "Ледяная нова", mp: 20, cd: 7, icon: "❄", use() {
        hero.play("aoe", { once: true, speed: 1.4, restart: true }); hero.busy = 0.8; hero.path = []; sound.magic("heal");
        setTimeout(() => { ringFX(hero.pos, 0x8ad8ff, 4.2); VFX.holy(PFIRE, hero.pos.x, 0.3, hero.pos.z, 46, [0.5, 0.8, 1]); shake(0.1);
          for (const e of enemiesNear(hero.pos, 4.2)) { hitEnemy(e, weaponDmg() * 1.1); e.slowT = 4.5; e.flash(0x60c0ff); } }, 420);
      } },
    { id: "barrier", name: "Барьер", mp: 24, cd: 12, icon: "◈", use() {
        hero.barrier = Math.round(maxHP() * 0.4 * (1 + 0.2 * TL("grace"))); hero.barrierT = 10; hero.play("power", { once: true, speed: 1.5, restart: true }); hero.busy = 0.6; hero.path = [];
        ringFX(hero.pos, 0x8ad8ff, 1.6); sound.magic("heal"); hud();
      } },
  ],
};
const ANGEL_SKILL = { id: "angel", name: "Облик Архангела", mp: 30, cd: 75, lvl: 5, icon: "✧", async use() {
    hero.play("power", { once: true, speed: 1.2, restart: true }); hero.busy = 1.1; hero.path = []; hero.target = null;
    ringFX(hero.pos, 0xffe6a0, 3); VFX.holy(PFIRE, hero.pos.x, 0.2, hero.pos.z, 70); sound.levelUp(); shake(0.25);
    if (!PROTO.archangel) toast("Небеса отвечают…", "#ffe6a0");
    try { await ensureChar("archangel"); } catch (e) { toast("Не удалось призвать облик"); return; }
    if (hero.dead) return;
    hero.angel = true; hero.angelT = 20; hero.attachItem(null, "r"); hero.attachItem(null, "l"); hero.setModel("archangel");
    healHero(maxHP() * 0.3); ringFX(hero.pos, 0xffd27a, 4); VFX.holy(PFIRE, hero.pos.x, 0.5, hero.pos.z, 90); shake(0.35); sound.play("bell", { vol: 0.8, verb: 0.8 });
    toast("Облик Архангела! Урон +50%, получаемый урон −40%", "#ffe6a0");
  } };
function endAngel(silent) {
  hero.angel = false; hero.angelT = 0; hero.setModel(hero.modelName); refreshHeroLook();
  if (!silent) { ringFX(hero.pos, 0xffd27a, 2.4); VFX.holy(PFIRE, hero.pos.x, 0.5, hero.pos.z, 40); toast("Облик Архангела угас", "#cbb48a"); }
}
let SKILLS = [];
const skillCD = {};
function useSkill(s) {
  if (!s || hero.dead || !started) return;
  if (s.lvl && state.level < s.lvl) return toast(`${s.name}: откроется на ${s.lvl} уровне`);
  if (s.id === "angel" && hero.angel) return;
  if ((skillCD[s.id] || 0) > 0) return;
  if (state.mp < s.mp) return toast("Не хватает маны");
  if (hero.leap || hero.spinT > 0) return;
  state.mp -= s.mp; skillCD[s.id] = s.cd; s.use(); hud();
}
// ---- class mechanics driven from updateHero
const bubble = new THREE.Mesh(new THREE.SphereGeometry(1.05, 24, 16), new THREE.MeshBasicMaterial({ color: 0x6ac8ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
bubble.visible = false; scene.add(bubble);
function updateBuffs(dt) {
  if (hero.cryT > 0) { hero.cryT -= dt; if (Math.random() < 0.3) VFX.holy(PFIRE, hero.pos.x, 0.2, hero.pos.z, 1, [1, 0.3, 0.15]); }
  if (hero.barrierT > 0) { hero.barrierT -= dt; if (hero.barrierT <= 0) hero.barrier = 0; }
  bubble.visible = hero.barrier > 0; if (bubble.visible) { bubble.position.set(hero.pos.x, 1.0, hero.pos.z); bubble.material.opacity = 0.12 + 0.05 * Math.sin(tAcc * 5); }
  if (hero.angel) { hero.angelT -= dt; if (Math.random() < 0.5) VFX.holy(PFIRE, hero.pos.x + rnd(-0.6, 0.6), rnd(0.5, 2.2), hero.pos.z + rnd(-0.6, 0.6), 1); if (hero.angelT <= 0) endAngel(); }
}
function updateSpin(dt) {
  hero.spinT -= dt; hero.face += dt * 15; hero.root.rotation.y = hero.face; hero.spinTick -= dt;
  if (Math.random() < 0.6) VFX.dust(PDUST, hero.pos.x, hero.pos.z);
  if (hero.spinTick <= 0) { hero.spinTick = 0.3; sound.play("swing", { vol: 0.5, rate: 1.2 }); ringFX(hero.pos, 0xff9a6a, 1.0);
    for (const e of enemiesNear(hero.pos, 3)) { hitEnemy(e, weaponDmg() * 0.55, Math.random() < critChance()); VFX.blood(PBLOOD, e.pos.x, 1.1, e.pos.z, 4); } }
  if (hero.spinT <= 0) { hero.busy = 0; hero.play("idle", { restart: true }); }
}
function updateLeap(dt) {
  const L = hero.leap; L.t += dt; const k = Math.min(1, L.t / L.dur);
  hero.pos.x = L.fx + (L.tx - L.fx) * k; hero.pos.z = L.fz + (L.tz - L.fz) * k; hero.root.position.y = Math.sin(Math.PI * k) * 1.7;
  if (k >= 1) { hero.root.position.y = 0; hero.leap = null; shake(0.35); sound.play("heavy", { vol: 1 }); ringFX(hero.pos, 0xffa060, 2.8);
    for (let q = 0; q < 12; q++) VFX.dust(PDUST, hero.pos.x + rnd(-1.5, 1.5), hero.pos.z + rnd(-1.5, 1.5));
    for (const e of enemiesNear(hero.pos, 2.8)) { hitEnemy(e, weaponDmg() * 1.5); if (!e.dead && e.state !== "charge" && e.state !== "slam") { e.state = "hit"; e.hitT = e.T.boss ? 0.4 : 1.4; e.play("hit", { once: true, restart: true }); } } }
}
function heroShoot({ dir, dmg, crit = false, color, light, size, speed, life, aoe = 0, trail }) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(size, 10, 8), new THREE.MeshBasicMaterial({ color }));
  if (QUALITY === "high" || aoe) m.add(new THREE.PointLight(light, aoe ? 10 : 6, 6, 2));
  m.position.set(hero.pos.x + dir.x * 0.8, 1.3, hero.pos.z + dir.z * 0.8); scene.add(m);
  projectiles.push({ mesh: m, dir, life, speed, dmg, crit, aoe, trail });
}
function nearestEnemy(r) { let best = null, bd = r; for (const e of enemies) if (!e.dead) { const d = e.pos.distanceTo(hero.pos); if (d < bd && world.los(hero.pos, e.pos)) { bd = d; best = e; } } return best; }
// ---- soft lock: the nearest visible enemy is always "in focus" (red ring + health bar), attack button / bolt / auto-fight use it
const AUTO_R = 5.5, FOCUS_R = 11;
let focus = null;
const focusRing = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.8, 40), new THREE.MeshBasicMaterial({ color: 0xff3a22, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
focusRing.rotation.x = -Math.PI / 2; focusRing.renderOrder = 5; focusRing.visible = false; scene.add(focusRing);
const focusArrow = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 4), new THREE.MeshBasicMaterial({ color: 0xff4a2a, transparent: true, opacity: 0.9, depthWrite: false }));
focusArrow.rotation.x = Math.PI; focusArrow.visible = false; scene.add(focusArrow);
function updateFocus(dt) {
  if (hero.target && !hero.target.dead) focus = hero.target;
  else if (!focus || focus.dead || focus.pos.distanceTo(hero.pos) > FOCUS_R + 1 || (tAcc * 5 | 0) % 2 === 0) focus = nearestEnemy(FOCUS_R);
  focusRing.visible = focusArrow.visible = !!focus;
  if (focus) {
    const s = (focus.T?.scale || 1) * (1 + 0.08 * Math.sin(tAcc * 6));
    focusRing.position.set(focus.pos.x, 0.06, focus.pos.z); focusRing.scale.setScalar(s * (focus.T?.boss ? 1.4 : 1));
    focusRing.material.color.setHex(hero.target === focus ? 0xff2a12 : 0xff8a3a);
    focusArrow.position.set(focus.pos.x, 2.5 * (focus.T?.scale || 1) + 0.12 * Math.sin(tAcc * 4), focus.pos.z); focusArrow.rotation.y += dt * 2;
    showTarget(focus); targetHideT = Math.max(targetHideT, 0.4);
  }
  $("atkbtn").classList.toggle("armed", !!focus);
}
function attackFocus() {
  if (hero.dead) return;
  const e = focus && !focus.dead ? focus : nearestEnemy(FOCUS_R + 3);
  if (!e) { toast("Рядом нет врагов"); return; }
  hero.target = e; holding = false; showTarget(e);
}
function updateProjectiles(dt) {
  for (const p of [...projectiles]) {
    p.life -= dt; p.mesh.position.addScaledVector(p.dir, dt * (p.speed || 16)); const P = p.mesh.position;
    if (p.trail === "fire") { VFX.fireBurst(PFIRE, P.x, P.y - 0.1, P.z, p.aoe ? 1.4 : 0.6); } else if (Math.random() < 0.6) VFX.holy(PFIRE, P.x, P.y - 0.2, P.z, 1);
    let hit = null; for (const e of enemies) if (!e.dead && Math.hypot(e.pos.x - P.x, e.pos.z - P.z) < 0.8) { hit = e; break; }
    if (hit || p.life <= 0 || !world.walkable(P.x, P.z)) {
      if (p.aoe && (hit || p.life > -1)) {                                // fireball: explode wherever it stops
        ringFX(P, 0xff7a2a, p.aoe); for (let q = 0; q < 8; q++) VFX.fireBurst(PFIRE, P.x + rnd(-1, 1), 0.4, P.z + rnd(-1, 1), 2); shake(0.15); sound.play("heavy", { vol: 0.6 });
        for (const e of enemiesNear(P, p.aoe)) hitEnemy(e, p.dmg, Math.random() < critChance());
      } else if (hit) { hitEnemy(hit, p.dmg, p.crit); ringFX(hit.pos, p.trail === "fire" ? 0xff8a3a : 0xffe0a0, 1.0); if (p.trail !== "fire") VFX.holy(PFIRE, hit.pos.x, 0.8, hit.pos.z, 20); else VFX.fireBurst(PFIRE, hit.pos.x, 1.0, hit.pos.z, 1.5); }
      scene.remove(p.mesh); projectiles.splice(projectiles.indexOf(p), 1);
    }
  }
}

// ------------------------------------------------------------------ FX
const fx = [];
function ringFX(pos, color, r) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.35, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.1, pos.z); scene.add(m);
  fx.push({ m, t: 0, dur: 0.5, upd: (f, k) => { const s = 0.3 + k * r * 3; f.m.scale.setScalar(s); f.m.material.opacity = 0.9 * (1 - k); } });
}
function slashFX(pos) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.75, 24, 1, 0, Math.PI * 0.8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.position.set(pos.x, 1.1, pos.z); m.rotation.set(rnd(-0.5, 0.5), rnd(0, 6), rnd(-0.5, 0.5)); scene.add(m);
  fx.push({ m, t: 0, dur: 0.2, upd: (f, k) => { f.m.material.opacity = 0.8 * (1 - k); f.m.scale.setScalar(1 + k * 0.4); } });
}
function levelFX() { ringFX(hero.pos, 0xffd04a, 2.5); setTimeout(() => ringFX(hero.pos, 0xffd04a, 2.5), 200); }
function updateFX(dt) { for (const f of [...fx]) { f.t += dt; const k = f.t / f.dur; if (k >= 1) { scene.remove(f.m); fx.splice(fx.indexOf(f), 1); } else f.upd(f, k); } }

// ------------------------------------------------------------------ HUD / UI
const v3 = new THREE.Vector3();
function toScreen(p, y = 0) { v3.set(p.x, p.y + y, p.z).project(camera); return [(v3.x * 0.5 + 0.5) * window.innerWidth, (-v3.y * 0.5 + 0.5) * window.innerHeight, v3.z]; }
function floatText(pos, text, color, size = 1) {
  const d = document.createElement("div"); d.className = "float"; d.textContent = text; d.style.color = color; d.style.fontSize = (18 * size) + "px";
  $("labels").appendChild(d); const p = pos.clone(); const t0 = performance.now(); const dx = rnd(-20, 20);
  const step = () => { const k = (performance.now() - t0) / 900; if (k > 1) { d.remove(); return; }
    const [x, y] = toScreen(p, 2.1 + k * 0.9); d.style.transform = `translate(${x + dx}px, ${y}px) translate(-50%,-50%)`; d.style.opacity = 1 - k * k; requestAnimationFrame(step); };
  step();
}
let toastT = 0;
function toast(text, color = "#efe6d6") { const t = $("toast"); t.textContent = text; t.style.color = color; t.style.opacity = 1; toastT = 2.4; }
function setLocation(s) { $("loc").textContent = s; toast(s, "#cbb48a"); sound.setZone(world.kind); }
let promptAct = null;
function setPrompt(near) { const p = $("prompt"); if (near) { p.hidden = false; p.textContent = near.label; promptAct = near.act; } else { p.hidden = true; promptAct = null; } }
$("prompt").addEventListener("click", (e) => { e.stopPropagation(); promptAct && promptAct(); });
let targetShown = null, targetHideT = 0;
function showTarget(e) { targetShown = e; targetHideT = 3; $("target").hidden = false; }
function hideTargetSoon() { targetHideT = Math.min(targetHideT, 1.2); }
function hud() {
  const hp = clamp(state.hp / maxHP(), 0, 1), mp = clamp(state.mp / maxMP(), 0, 1);
  $("hpfill").style.height = (hp * 100) + "%"; $("mpfill").style.height = (mp * 100) + "%";
  $("hptext").textContent = `${Math.ceil(state.hp)} / ${maxHP()}`; $("mptext").textContent = `${Math.floor(state.mp)} / ${maxMP()}`;
  $("gold").textContent = state.gold; $("lvl").textContent = state.level;
  $("xpfill").style.width = (100 * state.xp / xpNeed()) + "%";
  const belt = $("belt"); belt.innerHTML = "";
  for (let k = 0; k < 4; k++) { const b = document.createElement("button"); b.className = "slot potion"; b.setAttribute("aria-label", "Зелье");
    if (state.belt[k]) { b.innerHTML = '<span class="flask"></span>'; b.onclick = (ev) => { ev.stopPropagation(); drink(k); }; } belt.appendChild(b); }
  for (const s of SKILLS) { const el = $("sk_" + s.id); if (!el) continue; const locked = s.lvl && state.level < s.lvl;
    el.classList.toggle("nomana", !locked && state.mp < s.mp); el.classList.toggle("locked", !!locked); el.querySelector(".lock").hidden = !locked; }
  const tp = talFree(); $("talpts").textContent = tp; $("talpts").hidden = !tp;
  const bf = []; if (hero?.angel) bf.push(`<span style="color:#ffe6a0">✧ Архангел ${Math.ceil(hero.angelT)}с</span>`);
  if (hero?.cryT > 0) bf.push(`<span style="color:#ff8a6a">♅ Клич ${Math.ceil(hero.cryT)}с</span>`);
  if (hero?.barrier > 0) bf.push(`<span style="color:#8ad8ff">◈ Барьер ${Math.round(hero.barrier)}</span>`);
  $("buffs").innerHTML = bf.join("");
}
function drink(k) {
  const p = state.belt[k]; if (!p || hero.dead) return; state.belt.splice(k, 1);
  const bagP = state.bag.findIndex((i) => i.kind === "potion"); if (bagP >= 0) state.belt.push(state.bag.splice(bagP, 1)[0]);
  state.hp = Math.min(maxHP(), state.hp + p.heal); floatText(hero.pos, "+" + p.heal, "#7dff8a"); sound.play("potion"); VFX.holy(PFIRE, hero.pos.x, 0.3, hero.pos.z, 12, [1, 0.35, 0.3]); hud(); save();
}
function buildSkillBar() {
  SKILLS = [...SKILLSETS[state.cls] || SKILLSETS.pal, ANGEL_SKILL];
  const bar = $("skills"); bar.innerHTML = "";
  SKILLS.forEach((s, i) => { const b = document.createElement("button"); b.className = "skill" + (s.id === "angel" ? " ult" : ""); b.id = "sk_" + s.id;
    b.innerHTML = `<span class="ic">${s.icon}</span><span class="cd"></span><span class="lock" hidden>${s.lvl || ""}</span><span class="key">${i + 1}</span>`;
    b.title = `${s.name} (${s.mp} маны)`; b.setAttribute("aria-label", s.name);
    b.addEventListener("pointerdown", (ev) => { ev.stopPropagation(); useSkill(s); }); bar.appendChild(b); });
  hud();
}
// inventory
function itemLine(it) {
  if (!it) return "—";
  const stat = it.kind === "weapon" ? `урон ${it.dmg}` : it.kind === "potion" ? `+${it.heal} здоровья` : `броня ${it.armor}`;
  return `<b style="color:${it.tier ? TIERCOL[it.tier] : "#e8a0a0"}">${it.name}</b><small>${it.tier ? TIERNAME[it.tier] + " · " : ""}${stat}</small>`;
}
function openInv() {
  $("inv").hidden = false;
  const eq = $("eqslots"); eq.innerHTML = "";
  for (const [k, label] of (state.cls === "pal" ? [["weapon", "Оружие"], ["shield", "Щит"], ["armor", "Доспех"]] : [["weapon", state.cls === "mag" ? "Посох" : "Оружие"], ["armor", state.cls === "mag" ? "Мантия" : "Доспех"]])) {
    const d = document.createElement("div"); d.className = "eq"; d.innerHTML = `<span class="lab">${label}</span>${itemLine(state.eq[k])}`; eq.appendChild(d);
  }
  $("stats").innerHTML = `${C().name} · уровень ${state.level} · урон ${Math.round(weaponDmg() * dmgMult(null))} · броня ${armor()} · здоровье ${maxHP()} · мана ${maxMP()} · крит ${Math.round(critChance() * 100)}%`;
  const bag = $("bag"); bag.innerHTML = "";
  state.bag.forEach((it, idx) => {
    const d = document.createElement("button"); d.className = "item"; d.innerHTML = itemLine(it);
    const cur = it.kind === "weapon" ? state.eq.weapon : it.kind === "shield" ? state.eq.shield : it.kind === "armor" ? state.eq.armor : null;
    if (cur && it.kind !== "potion") { const better = (it.dmg || it.armor) > (cur.dmg || cur.armor); d.innerHTML += `<em class="${better ? "up" : "down"}">${better ? "▲ лучше" : "▼ хуже"}</em>`; }
    if (!canEquip(it)) d.innerHTML += `<em class="down">не для класса «${C().name}»</em>`;
    d.onclick = () => { equip(idx); };
    bag.appendChild(d);
  });
  if (!state.bag.length) bag.innerHTML = '<p class="empty">Сумка пуста. Добыча падает с врагов и из сундуков.</p>';
}
function canEquip(it) {
  if (it.kind === "weapon") return state.cls === "mag" ? it.sub === "Staff" : it.sub !== "Staff";
  if (it.kind === "shield") return state.cls === "pal";
  return true;
}
function equip(idx) {
  const it = state.bag[idx];
  if (!canEquip(it)) { toast(`${C().name} не может это использовать — продайте торговцу`); return; }
  if (it.kind === "potion") { if (state.belt.length < 4) { state.belt.push(it); state.bag.splice(idx, 1); } else toast("Пояс полон"); }
  else { const old = state.eq[it.kind]; state.eq[it.kind] = it; state.bag.splice(idx, 1); if (old) state.bag.push(old); refreshHeroLook(); toast(`Надето: ${it.name}`, TIERCOL[it.tier]); }
  hud(); openInv(); save();
}
$("invbtn").addEventListener("click", (e) => { e.stopPropagation(); openInv(); sound.play("click"); });
try { sound.muted = localStorage.getItem("tb2_mute") === "1"; } catch (e) {}
function syncToggles() { $("sndbtn").textContent = sound.muted ? "Звук: выкл" : "Звук: вкл"; $("gfxbtn").textContent = QUALITY === "high" ? "Графика: высокая" : "Графика: экономная"; }
$("sndbtn").addEventListener("click", (e) => { e.stopPropagation(); sound.setMuted(!sound.muted); try { localStorage.setItem("tb2_mute", sound.muted ? "1" : "0"); } catch (er) {} syncToggles(); });
$("gfxbtn").addEventListener("click", (e) => { e.stopPropagation(); QUALITY = QUALITY === "high" ? "low" : "high"; try { localStorage.setItem("tb2_quality", QUALITY); } catch (er) {} applyQuality(); syncToggles(); });
function applyQuality() { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY === "high" ? (IOS ? 1.25 : 1.6) : 1.0));
  if (QUALITY !== "high" && composer) { composer.dispose?.(); composer.renderTarget1?.dispose(); composer.renderTarget2?.dispose(); composer = null; } renderer.shadowMap.enabled = QUALITY === "high"; resize(); }
applyQuality(); syncToggles();
$("invclose").addEventListener("click", () => ($("inv").hidden = true));
// NPC dialogs
function talk(n) {
  const d = $("dialog"); d.hidden = false; $("dlgname").textContent = n.name; const body = $("dlgbody"); body.innerHTML = "";
  const btn = (t, f) => { const b = document.createElement("button"); b.className = "dlgbtn"; b.textContent = t; b.onclick = f; body.appendChild(b); };
  if (n.npc === "healer") {
    $("dlgtext").textContent = "Да хранит тебя Свет, странник. Под деревней, в старых катакомбах, проснулась нежить. Я залечу твои раны — бесплатно.";
    btn("Исцели меня", () => { state.hp = maxHP(); state.mp = maxMP(); hud(); ringFX(hero.pos, 0x8dffb0, 1.6); $("dlgtext").textContent = "Ступай. Свет с тобой."; });
  } else {
    $("dlgtext").textContent = `Добрый товар для доброго воина. Зелье — 25 золота. Ненужное оружие и доспехи куплю. У тебя ${state.gold} золота.`;
    btn("Купить зелье (25)", () => { if (state.gold < 25) return toast("Не хватает золота"); if (state.belt.length >= 4 && state.bag.length >= 20) return toast("Некуда положить");
      state.gold -= 25; const p = makeItem("potion"); if (state.belt.length < 4) state.belt.push(p); else state.bag.push(p); hud(); save(); talk(n); });
    const sellable = state.bag.filter((i) => i.kind !== "potion");
    if (sellable.length) btn(`Продать всё из сумки (${sellable.reduce((s, i) => s + i.tier * i.tier * 12, 0)})`, () => {
      const v = sellable.reduce((s, i) => s + i.tier * i.tier * 12, 0); state.gold += v; state.bag = state.bag.filter((i) => i.kind === "potion"); hud(); save(); talk(n); });
  }
  btn("Уйти", () => (d.hidden = true));
}

// ------------------------------------------------------------------ INPUT (tap to move / attack, hold to keep walking)
const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2(); const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let holding = false, holdT = 0; const holdPoint = new THREE.Vector3();
function screenHit(cx, cy) {
  ndc.set((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const boxes = enemies.filter((e) => !e.dead).map((e) => e.hitbox).concat(npcs.map((n) => n.hitbox));
  const hits = ray.intersectObjects(boxes, false); const p = new THREE.Vector3(); ray.ray.intersectPlane(ground, p);
  return { actor: hits.length ? hits[0].object.userData.actor : null, point: p };
}
function moveTo(p, fresh = true) {
  if (!fresh && hero.path.length && hero.path[hero.path.length - 1].distanceTo(p) < 0.6) return;
  hero.path = world.path(hero.pos, p); hero.target = null;
}
canvas.addEventListener("pointerdown", (ev) => {
  if (!started || hero.dead) return;
  const h = screenHit(ev.clientX, ev.clientY);
  if (h.actor && h.actor.kind === "enemy") { hero.target = h.actor; showTarget(h.actor); holding = false; return; }
  if (h.actor && h.actor.kind === "npc") { hero.path = world.path(hero.pos, h.actor.pos); hero.target = null; hero.talkTo = h.actor; return; }
  // forgiving taps: a tap on the ground near an enemy counts as attacking it
  let near = null, nd = 1.8; for (const e of enemies) if (!e.dead) { const d = Math.hypot(e.pos.x - h.point.x, e.pos.z - h.point.z); if (d < nd) { nd = d; near = e; } }
  if (near) { hero.target = near; showTarget(near); holding = false; return; }
  moveTo(h.point); markFX(h.point); holding = true; holdT = performance.now(); holdPoint.copy(h.point);
});
canvas.addEventListener("pointermove", (ev) => { if (holding) { const h = screenHit(ev.clientX, ev.clientY); holdPoint.copy(h.point); } });
window.addEventListener("pointerup", () => (holding = false));
canvas.addEventListener("wheel", (ev) => { zoom = clamp(zoom + Math.sign(ev.deltaY) * 0.08, 0.5, 1.35); }, { passive: true });
window.addEventListener("keydown", (ev) => {
  if (ev.key === "i" || ev.key === "I" || ev.key === "ш") $("inv").hidden ? openInv() : ($("inv").hidden = true);
  if (ev.key >= "1" && ev.key <= "4") useSkill(SKILLS[+ev.key - 1]);
  if (ev.key === "t" || ev.key === "T" || ev.key === "е") $("tal").hidden ? openTal() : ($("tal").hidden = true);
  if (ev.key === "q" || ev.key === "й") drink(0);
  if (ev.key === " ") { ev.preventDefault(); attackFocus(); }
});
$("atkbtn").addEventListener("pointerdown", (ev) => { ev.stopPropagation(); ev.preventDefault(); attackFocus(); });
function markFX(p) { ringFX(p, 0xffe0a0, 0.25); }

// ------------------------------------------------------------------ SAVE
function save() { try { localStorage.setItem("tb2_save", JSON.stringify({ ...state, depth })); } catch (e) {} }
function loadSave() { try { const s = JSON.parse(localStorage.getItem("tb2_save") || "null"); if (s && s.eq) { Object.assign(state, s); return true; } } catch (e) {} return false; }

// ------------------------------------------------------------------ MAIN LOOP
let started = false; const clock = new THREE.Clock(); let tAcc = 0;
let shakeA = 0; function shake(a) { shakeA = Math.max(shakeA, a); }
let stepT = 0, emitT = 0;
function render() { if (QUALITY === "high") { const c = ensureComposer(); c.grade.uniforms.uTime.value = tAcc % 10; c.render(); } else renderer.render(scene, camera); }
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05); tAcc += dt;
  if (!started) { render(); return; }
  updateHero(dt);
  if (hero.talkTo && !hero.path.length) { const n = hero.talkTo; hero.talkTo = null; if (n.pos.distanceTo(hero.pos) < 2.6) { hero.faceTo(n.pos.x, n.pos.z, 1, 100); talk(n); } }
  for (const e of [...enemies]) updateEnemy(e, dt);
  for (const n of npcs) { n.update(dt); }
  updateProjectiles(dt); updateEProj(dt); updateTele(dt); updateFX(dt);
  for (const k in skillCD) { skillCD[k] -= dt; const el = $("sk_" + k)?.querySelector(".cd"); const s = SKILLS.find((x) => x.id === k); if (!s) continue;
    if (el) el.style.height = (Math.max(0, skillCD[k] / s.cd) * 100) + "%"; }
  // camera follows
  const want = hero.pos.clone().add(CAM_OFF.clone().multiplyScalar(zoom));
  camera.position.lerp(want, 1 - Math.pow(0.0015, dt)); camera.lookAt(hero.pos.x, hero.pos.y + 1.0, hero.pos.z);
  if (shakeA > 0.001) { camera.position.x += rnd(-1, 1) * shakeA; camera.position.y += rnd(-1, 1) * shakeA; shakeA *= Math.pow(0.004, dt); }
  // footsteps
  if (hero.curAnim === "run" && !hero.dead) { stepT -= dt; if (stepT <= 0) { stepT = 0.31; sound.play(world.kind === "town" ? "step_grass" : "step_stone", { vol: 0.35 }); } }
  // particles: torch fire, embers, chimney smoke, dust motes / fireflies
  emitT += dt;
  while (emitT > 1 / 60) { emitT -= 1 / 60;
    for (const t of world.torches) { if (t.pos.distanceToSquared(hero.pos) > 900) continue; VFX.fireBurst(PFIRE, t.pos.x, t.pos.y, t.pos.z, t.big || 1); if (Math.random() < 0.04) VFX.ember(PFIRE, t.pos.x, t.pos.y + 0.1, t.pos.z); }
    if (world.smokes && Math.random() < 0.35) { const sp = pick(world.smokes); if (sp) VFX.smoke(PSMOKE, sp.x, sp.y, sp.z); }
    if (Math.random() < 0.25) world.kind === "town" ? VFX.firefly(PDUST, hero.pos.x, hero.pos.z) : VFX.dust(PDUST, hero.pos.x, hero.pos.z);
  }
  const H = window.innerHeight * renderer.getPixelRatio();
  PFIRE.update(dt, H); PSMOKE.update(dt, H); PBLOOD.update(dt, H); PDUST.update(dt, H);
  CUT.hero.value.copy(hero.pos); CUT.cam.value.copy(camera.position);
  // lights
  heroLight.position.set(hero.pos.x, 3.2, hero.pos.z); heroLight.color.setHex(hero.angel ? 0xffe2a0 : hero.cryT > 0 ? 0xff9070 : 0xffb070); heroLight.intensity = (world.kind === "dungeon" ? 46 : 22) * (0.92 + 0.08 * Math.sin(tAcc * 9));
  moon.position.set(hero.pos.x - 10, 20, hero.pos.z - 6); moon.target.position.copy(hero.pos);
  const ts = world.torches.map((t) => [t, t.pos.distanceToSquared(hero.pos)]).sort((a, b) => a[1] - b[1]);
  POOL.forEach((l, k) => { const t = ts[k]; if (t && t[1] < 400) { l.position.copy(t[0].pos); l.intensity = 16 * flicker(tAcc, k * 3.1); } else l.intensity = 0; });
  for (const t of world.torches) t.flame.scale.set(1, flicker(tAcc, t.pos.x) * 1.1, 1);
  // labels
  for (const L of loot) { const [x, y, z] = toScreen(L.obj.position, 0.5); const vis = z < 1 && L.obj.position.distanceTo(hero.pos) < 16;
    L.label.style.display = vis ? "block" : "none"; if (vis) L.label.style.transform = `translate(${x}px, ${y}px) translate(-50%,-100%)`; }
  if (targetShown) { targetHideT -= dt; const e = targetShown;
    $("tname").textContent = e.name + (e.T?.boss ? " — босс" : ""); $("tfill").style.width = (100 * Math.max(0, e.hp) / e.maxhp) + "%";
    if (targetHideT <= 0) { $("target").hidden = true; targetShown = null; } }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $("toast").style.opacity = 0; }
  if ((tAcc * 4 | 0) % 2 === 0) hud();
  render();
}

// ------------------------------------------------------------------ TALENTS UI
function openTal() {
  $("tal").hidden = false; const free = talFree();
  $("talhead").textContent = free ? `Свободных очков: ${free}` : "Очки талантов дают новые уровни";
  const g = $("talgrid"); g.innerHTML = "";
  for (const B of TALENTS) {
    const col = document.createElement("div"); col.className = "branch"; const spent = talSpent(B.br);
    col.innerHTML = `<h3 style="color:${B.col}">${B.name} <small>${spent}</small></h3>`;
    for (const t of B.items) {
      const r = TL(t.k), locked = t.cap && spent - r < 5, maxed = r >= t.max;
      const b = document.createElement("button"); b.className = "node" + (maxed ? " max" : "") + (t.cap ? " cap" : ""); b.type = "button";
      b.disabled = !free || maxed || locked;
      b.innerHTML = `<b>${t.n} <span>${r}/${t.max}</span></b><small>${t.d(Math.max(1, maxed ? r : r + 1))}</small>${locked ? "<small class='req'>нужно 5 очков в ветке</small>" : ""}`;
      b.onclick = () => { if (talFree() <= 0) return; state.tal[t.k] = r + 1; state.hp = Math.min(state.hp, maxHP()); sound.play("confirm"); hud(); save(); openTal(); };
      col.appendChild(b);
    }
    g.appendChild(col);
  }
  $("talreset").disabled = !talSpent(); $("talreset").textContent = world.kind === "town" ? "Сбросить таланты" : "Сброс — только в деревне";
}
$("talbtn").addEventListener("click", (e) => { e.stopPropagation(); openTal(); sound.play("click"); });
$("talclose").addEventListener("click", () => ($("tal").hidden = true));
$("talreset").addEventListener("click", () => { if (world.kind !== "town") return toast("Сбросить таланты можно только в деревне"); state.tal = {}; state.hp = Math.min(state.hp, maxHP()); hud(); save(); openTal(); });
let newArm = 0;
$("talnew").addEventListener("click", () => { if (Date.now() - newArm > 4000) { newArm = Date.now(); $("talnew").textContent = "Точно? Нажмите ещё раз"; return; }
  $("tal").hidden = true; $("talnew").textContent = "Новый герой"; openCreate(true); });

// ------------------------------------------------------------------ HERO CREATION
let pickCls = "pal", pickSex = "m";
function openCreate(fromGame) {
  $("create").hidden = false; $("create").dataset.fromGame = fromGame ? "1" : "";
  const g = $("clsgrid"); g.innerHTML = "";
  const dots = (n) => "●".repeat(n) + "○".repeat(4 - n);
  for (const [k, c] of Object.entries(CLS)) {
    const b = document.createElement("button"); b.type = "button"; b.className = "cls"; b.setAttribute("aria-pressed", k === pickCls);
    b.innerHTML = `<h3>${c.name}</h3><p>${c.desc}</p><div class="dots"><span>Стойкость</span><i>${dots(c.dots[0])}</i><span>Урон</span><i>${dots(c.dots[1])}</i><span>Магия</span><i>${dots(c.dots[2])}</i></div>
      <small>${SKILLSETS[k].map((s) => s.icon + " " + s.name).join(" · ")}</small>`;
    b.onclick = () => { pickCls = k; openCreate(fromGame); sound.play("click"); }; g.appendChild(b);
  }
  for (const b of document.querySelectorAll("#sexrow button")) b.setAttribute("aria-pressed", b.dataset.sex === pickSex);
}
for (const b of document.querySelectorAll("#sexrow button")) b.addEventListener("click", () => { pickSex = b.dataset.sex; openCreate($("create").dataset.fromGame); sound.play("click"); });
$("createback").addEventListener("click", () => { $("create").hidden = true; });
$("creatego").addEventListener("click", async () => {
  const btn = $("creatego"); btn.disabled = true; btn.textContent = "Собираю героя…";
  try { await newHero(pickCls, pickSex); } catch (e) { console.error(e); toast("Не удалось загрузить героя: " + e.message); }
  btn.disabled = false; btn.textContent = "В путь"; $("create").hidden = true; hadSave = true;
  if (!started) startGame(); else toast(`${C().name} начинает путь`, "#ffd04a");
});
async function newHero(cls, sex) {
  const fresh = { level: 1, xp: 0, gold: 0, belt: [], bag: [], eq: { weapon: null, shield: null, armor: null }, cls, sex, tal: {} };
  Object.assign(state, fresh);
  state.eq.weapon = makeItem("weapon", 1, CLASS_WEAPONS[cls][0]); state.eq.armor = makeItem("armor", 1); if (cls === "pal") state.eq.shield = makeItem("shield", 1);
  state.belt = [makeItem("potion"), makeItem("potion")]; state.hp = maxHP(); state.mp = maxMP(); depth = 1;
  for (const k in skillCD) skillCD[k] = 0;
  if (hero.angel) endAngel(true); hero.cryT = 0; hero.barrier = 0; hero.dead = false;
  const want = heroModelName(); await ensureChar(want); hero.modelName = want; hero.setModel(want); await refreshHeroLook(); hero.play("idle", { restart: true });
  buildSkillBar(); buildTown(); hud(); save();
}

// ------------------------------------------------------------------ BOOT
let hadSave = false;
async function boot() {
  try { await loadAll(); }
  catch (e) { $("loadtext").textContent = "Не удалось загрузить ресурсы игры: " + (e && e.message ? e.message : e) + ". Обновите страницу."; console.error(e); return; }
  hadSave = loadSave();
  if (!state.cls) state.cls = "pal"; if (!state.sex) state.sex = "m"; if (!state.tal) state.tal = {};
  if (state.cls !== "pal") state.eq.shield = null;
  if (!hadSave) { state.eq.weapon = makeItem("weapon", 1, "Sword"); state.eq.shield = makeItem("shield", 1); state.eq.armor = makeItem("armor", 1); state.belt = [makeItem("potion"), makeItem("potion")]; }
  hero = new Actor("hero", heroModelName()); hero.modelName = heroModelName(); hero.name = "Герой";
  await refreshHeroLook(); hero.play("idle");
  buildSkillBar();
  buildTown();
  hud();
  $("loading").classList.add("ready"); $("loadtext").textContent = hadSave ? `${C().name}, уровень ${state.level}` : "";
  $("start").textContent = hadSave ? "Продолжить" : "Создать героя"; $("start").hidden = false; $("newbtn").hidden = !hadSave;
  if (hadSave && state.level >= 4) ensureChar("archangel").catch(() => {});
}
function startGame() { sound.init().then(() => sound.setZone(world.kind)); $("loading").hidden = true; started = true; clock.getDelta();
  toast(C().ranged ? "Тапните по врагу — маг бьёт огнём издалека. Умения 1–3, Облик Архангела — 4." : "Тапните по земле, чтобы идти, по врагу — чтобы атаковать.", "#cbb48a"); }
$("start").addEventListener("click", () => { if (!hadSave) openCreate(false); else startGame(); });
$("newbtn").addEventListener("click", () => openCreate(false));
frame(); boot();
window.__zoom = (z) => { zoom = z; };
window.__refresh = () => refreshHeroLook();
window.__tbNpcs = () => npcs;
window.__tb = { state, get hero() { return hero; }, enemies, world, enterDungeon, buildTown, useSkill, get SKILLS() { return SKILLS; }, newHero, openTal, dmg: (e, n) => damageEnemy(e, n), sim: (n) => { for (let i = 0; i < n; i++) { const dt = 1 / 30; tAcc += dt; updateHero(dt); for (const e of [...enemies]) updateEnemy(e, dt); updateProjectiles(dt); updateEProj(dt); updateTele(dt); updateFX(dt); } }, spawn: (t, dx, dz) => spawnEnemy(t, hero.pos.x + dx, hero.pos.z + dz, depth), start: () => $("start").click() };
