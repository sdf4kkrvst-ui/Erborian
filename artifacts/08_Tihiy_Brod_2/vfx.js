// Visual effects: post-processing (bloom + grade), environment light, GPU-light particles, procedural decal textures.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// ------------------------------------------------------------------ post
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uVig: { value: 0.55 }, uWarm: { value: 0.06 }, uTime: { value: 0 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig; uniform float uWarm; uniform float uTime; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299,0.587,0.114));
      c.rgb = mix(vec3(l), c.rgb, 0.86);                                  // slightly desaturated, Diablo-like
      c.rgb += vec3(uWarm, uWarm*0.4, -uWarm*0.3) * smoothstep(0.2, 0.9, l);  // warm highlights
      c.rgb = mix(c.rgb, c.rgb * vec3(0.85,0.9,1.08), (1.0 - smoothstep(0.0, 0.25, l)) * 0.6); // cold shadows
      vec2 d = vUv - 0.5; float v = smoothstep(0.85, 0.25, length(d * vec2(1.1, 1.0)));
      c.rgb *= mix(1.0 - uVig, 1.0, v);
      float n = fract(sin(dot(vUv * (uTime + 1.0), vec2(12.9898,78.233))) * 43758.5453);
      c.rgb += (n - 0.5) * 0.018;                                          // fine film grain hides banding
      gl_FragColor = c; }`,
};
export function makeComposer(renderer, scene, camera) {
  const comp = new EffectComposer(renderer);
  comp.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.75, 0.55, 0.82);
  comp.addPass(bloom);
  comp.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader); comp.addPass(grade);
  comp.bloom = bloom; comp.grade = grade;
  comp.resize = (w, h, pr) => { comp.setPixelRatio(pr); comp.setSize(w, h); bloom.resolution.set(w / 2, h / 2); };
  return comp;
}
export function makeEnvironment(renderer) {
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  return env;
}

// ------------------------------------------------------------------ canvas textures
function canvasTex(size, draw, srgb = true) {
  const c = document.createElement("canvas"); c.width = c.height = size; const g = c.getContext("2d"); draw(g, size);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
export const TEX = {};
export function makeTextures() {
  TEX.soft = canvasTex(64, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.35, "rgba(255,255,255,.55)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, s, s); });
  TEX.blob = canvasTex(64, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, "rgba(0,0,0,.75)"); r.addColorStop(0.6, "rgba(0,0,0,.35)"); r.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = r; g.fillRect(0, 0, s, s); });
  TEX.blood = canvasTex(128, (g, s) => { for (let k = 0; k < 14; k++) { const x = s / 2 + (Math.random() - 0.5) * s * 0.6, y = s / 2 + (Math.random() - 0.5) * s * 0.6, r = Math.random() * s * 0.16 + 3;
      g.fillStyle = `rgba(${70 + Math.random() * 40},4,4,${0.6 + Math.random() * 0.35})`; g.beginPath(); g.ellipse(x, y, r, r * (0.6 + Math.random() * 0.6), Math.random() * 3, 0, 7); g.fill(); } });
  TEX.crack = canvasTex(128, (g, s) => { g.strokeStyle = "rgba(0,0,0,.8)"; g.lineWidth = 2;
    for (let k = 0; k < 5; k++) { let x = s / 2, y = s / 2; g.beginPath(); g.moveTo(x, y); const a0 = Math.random() * 6.3;
      for (let i = 0; i < 9; i++) { x += Math.cos(a0 + (Math.random() - 0.5)) * 7; y += Math.sin(a0 + (Math.random() - 0.5)) * 7; g.lineTo(x, y); } g.stroke(); g.lineWidth = 1.2; } });
  TEX.moss = canvasTex(128, (g, s) => { for (let k = 0; k < 60; k++) { g.fillStyle = `rgba(${40 + Math.random() * 30},${60 + Math.random() * 40},20,${Math.random() * 0.4})`;
      g.beginPath(); g.arc(s / 2 + (Math.random() - 0.5) * s * 0.7, s / 2 + (Math.random() - 0.5) * s * 0.7, Math.random() * 10 + 2, 0, 7); g.fill(); } });
  TEX.web = canvasTex(128, (g, s) => { g.strokeStyle = "rgba(220,220,220,.55)"; g.lineWidth = 1;
    for (let k = 0; k < 9; k++) { const a = k / 8 * Math.PI / 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * s, Math.sin(a) * s); g.stroke(); }
    for (let r = 14; r < s; r += 14 + Math.random() * 6) { g.beginPath(); for (let k = 0; k <= 8; k++) { const a = k / 8 * Math.PI / 2, rr = r * (0.9 + Math.random() * 0.15);
      k ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.stroke(); } });
  TEX.grass = canvasTex(128, (g, s) => { for (let k = 0; k < 26; k++) { const x = Math.random() * s, h = s * (0.45 + Math.random() * 0.55), lean = (Math.random() - 0.5) * 30;
      const grd = g.createLinearGradient(0, s, 0, s - h); grd.addColorStop(0, "rgba(40,48,22,1)"); grd.addColorStop(1, `rgba(${110 + Math.random() * 40},${118 + Math.random() * 30},${60 + Math.random() * 20},1)`);
      g.strokeStyle = grd; g.lineWidth = 2 + Math.random() * 2; g.beginPath(); g.moveTo(x, s); g.quadraticCurveTo(x + lean * 0.3, s - h * 0.6, x + lean, s - h); g.stroke(); } });
  TEX.rune = canvasTex(128, (g, s) => { g.strokeStyle = "rgba(255,210,140,1)"; g.lineWidth = 4; g.shadowColor = "rgba(255,180,90,1)"; g.shadowBlur = 10;
    g.beginPath(); g.arc(s / 2, s / 2, s * 0.42, 0, 7); g.stroke(); g.beginPath(); g.arc(s / 2, s / 2, s * 0.3, 0, 7); g.stroke();
    for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; g.beginPath(); g.moveTo(s / 2 + Math.cos(a) * s * 0.3, s / 2 + Math.sin(a) * s * 0.3); g.lineTo(s / 2 + Math.cos(a + 0.4) * s * 0.42, s / 2 + Math.sin(a + 0.4) * s * 0.42); g.stroke(); } });
}

// ------------------------------------------------------------------ particles
const PVS = `attribute float aSize; attribute vec4 aColor; varying vec4 vColor; uniform float uScale;
  void main(){ vColor = aColor; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`;
const PFS = `uniform sampler2D map; varying vec4 vColor; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vColor.rgb, vColor.a * t.a); if (gl_FragColor.a < 0.01) discard; }`;
export class Particles {
  constructor(scene, n, additive) {
    this.n = n; this.i = 0;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 4); this.size = new Float32Array(n);
    this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n);
    this.c0 = new Float32Array(n * 4); this.c1 = new Float32Array(n * 4); this.s0 = new Float32Array(n); this.s1 = new Float32Array(n); this.grav = new Float32Array(n); this.drag = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aColor", new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({ uniforms: { map: { value: TEX.soft }, uScale: { value: 300 } }, vertexShader: PVS, fragmentShader: PFS,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; scene.add(this.pts); this.geo = g;
  }
  emit(x, y, z, o) {
    const i = this.i; this.i = (this.i + 1) % this.n;
    this.pos.set([x, y, z], i * 3); this.vel.set([o.vx || 0, o.vy || 0, o.vz || 0], i * 3);
    this.life[i] = this.max[i] = o.life || 1; this.c0.set(o.c0, i * 4); this.c1.set(o.c1 || [o.c0[0], o.c0[1], o.c0[2], 0], i * 4);
    this.s0[i] = o.s0 || 0.3; this.s1[i] = o.s1 ?? this.s0[i]; this.grav[i] = o.grav || 0; this.drag[i] = o.drag || 0;
  }
  update(dt, h) {
    const n = this.n;
    for (let i = 0; i < n; i++) {
      if (this.life[i] <= 0) { this.col[i * 4 + 3] = 0; continue; }
      this.life[i] -= dt; const k = 1 - Math.max(0, this.life[i]) / this.max[i];
      const d = 1 - this.drag[i] * dt;
      this.vel[i * 3] *= d; this.vel[i * 3 + 2] *= d; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.02 && this.grav[i] > 0) { this.pos[i * 3 + 1] = 0.02; this.vel[i * 3] *= 0.5; this.vel[i * 3 + 2] *= 0.5; this.vel[i * 3 + 1] = 0; }
      for (let c = 0; c < 4; c++) this.col[i * 4 + c] = this.c0[i * 4 + c] + (this.c1[i * 4 + c] - this.c0[i * 4 + c]) * k;
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * k;
    }
    this.mat.uniforms.uScale.value = h * 0.9;
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.aColor.needsUpdate = true; this.geo.attributes.aSize.needsUpdate = true;
  }
}
export const R = (a, b) => a + Math.random() * (b - a);
export function fireBurst(P, x, y, z, k = 1) {
  P.emit(x + R(-0.05, 0.05) * k, y, z + R(-0.05, 0.05) * k, { vx: R(-0.1, 0.1), vy: R(0.6, 1.2) * k, vz: R(-0.1, 0.1), life: R(0.35, 0.6),
    c0: [1.0, 0.62, 0.22, 0.9], c1: [0.7, 0.12, 0.02, 0], s0: 0.32 * k, s1: 0.08 * k });
}
export function ember(P, x, y, z) {
  P.emit(x, y, z, { vx: R(-0.3, 0.3), vy: R(0.5, 1.4), vz: R(-0.3, 0.3), life: R(0.8, 1.6), c0: [1, 0.55, 0.15, 1], c1: [1, 0.2, 0.0, 0], s0: 0.06, s1: 0.02, drag: 0.5 });
}
export function smoke(P, x, y, z) {
  P.emit(x, y, z, { vx: R(-0.1, 0.1), vy: R(0.35, 0.6), vz: R(-0.1, 0.1), life: R(3, 5), c0: [0.25, 0.24, 0.24, 0.35], c1: [0.2, 0.2, 0.22, 0], s0: 0.5, s1: 2.0, drag: 0.1 });
}
export function blood(P, x, y, z, n = 14) {
  for (let k = 0; k < n; k++) P.emit(x, y, z, { vx: R(-1.6, 1.6), vy: R(0.8, 2.6), vz: R(-1.6, 1.6), life: R(0.5, 0.9), c0: [0.45, 0.02, 0.02, 0.95], c1: [0.25, 0.0, 0.0, 0], s0: 0.13, s1: 0.08, grav: 7 });
}
export function sparks(P, x, y, z, n = 12, col = [1, 0.85, 0.5]) {
  for (let k = 0; k < n; k++) P.emit(x, y, z, { vx: R(-3, 3), vy: R(1, 3.5), vz: R(-3, 3), life: R(0.25, 0.5), c0: [...col, 1], c1: [col[0], col[1] * 0.5, 0, 0], s0: 0.09, s1: 0.03, grav: 9 });
}
export function holy(P, x, y, z, n = 18, col = [1, 0.85, 0.45]) {
  for (let k = 0; k < n; k++) { const a = Math.random() * 6.283, r = R(0.2, 1.2);
    P.emit(x + Math.cos(a) * r, y + R(0, 0.3), z + Math.sin(a) * r, { vx: 0, vy: R(0.8, 2), vz: 0, life: R(0.6, 1.1), c0: [...col, 0.9], c1: [col[0], col[1], col[2] * 0.5, 0], s0: 0.18, s1: 0.04 }); }
}
export function dust(P, x, z) {
  P.emit(x + R(-6, 6), R(0.3, 2.5), z + R(-6, 6), { vx: R(-0.05, 0.05), vy: R(-0.02, 0.05), vz: R(-0.05, 0.05), life: R(3, 6), c0: [0.9, 0.75, 0.55, 0.45], c1: [0.9, 0.75, 0.55, 0.0], s0: 0.05, s1: 0.05 });
}
export function firefly(P, x, z) {
  P.emit(x + R(-12, 12), R(0.4, 2.2), z + R(-12, 12), { vx: R(-0.3, 0.3), vy: R(-0.1, 0.1), vz: R(-0.3, 0.3), life: R(2, 4), c0: [0.75, 1, 0.35, 0.95], c1: [0.6, 1, 0.3, 0], s0: 0.1, s1: 0.06 });
}
