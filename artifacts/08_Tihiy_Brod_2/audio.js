// Sound: CC0 effects (Kenney) + a generative dark-ambient score built from oscillators and a synthetic reverb.
const FILES = {
  step_stone: [0, 1, 2, 3, 4].map((i) => "stepstone" + i), step_grass: [0, 1, 2, 3, 4].map((i) => "stepgrass" + i),
  hit: [0, 1, 2, 3, 4].map((i) => "hit" + i), armorhit: [0, 1, 2, 3, 4].map((i) => "armorhit" + i),
  swing: ["swing0", "swing1", "swing2", "slice0", "slice1"], chop: ["chop"], block: ["block"], coins: ["coins0", "coins1"],
  potion: ["potion"], drop: ["drop"], pickup: ["pickup"], chest: ["chest", "creak"], bell: ["bell", "bell2"], fall: ["fall"],
  heavy: ["heavyhit"], click: ["click"], confirm: ["confirm"], error: ["error"], stone: ["stone"],
};
export class Sound {
  constructor(base) { this.base = base; this.buf = {}; this.ctx = null; this.muted = false; this.musicOn = true; this.zone = "town"; }
  async init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.9; this.master.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.8; this.sfx.connect(this.master);
    this.verb = c.createConvolver(); this.verb.buffer = this.impulse(3.2, 2.4); const vg = c.createGain(); vg.gain.value = 0.35; this.verb.connect(vg); vg.connect(this.master);
    this.music = c.createGain(); this.music.gain.value = 0.0; this.music.connect(this.master); this.music.connect(this.verb);
    const names = [...new Set(Object.values(FILES).flat())];
    await Promise.all(names.map(async (n) => {
      try { const r = await fetch(this.base + n + ".mp3"); const a = await r.arrayBuffer(); this.buf[n] = await c.decodeAudioData(a); } catch (e) { /* missing sound is not fatal */ }
    }));
    this.startMusic();
  }
  impulse(sec, decay) {
    const c = this.ctx, n = c.sampleRate * sec, b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  play(kind, { vol = 1, rate = 1, dist = 0, verb = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const list = FILES[kind]; if (!list) return; const b = this.buf[list[Math.floor(Math.random() * list.length)]]; if (!b) return;
    const c = this.ctx, s = c.createBufferSource(); s.buffer = b; s.playbackRate.value = rate * (0.94 + Math.random() * 0.12);
    const g = c.createGain(); g.gain.value = vol * Math.max(0, 1 - dist / 22);
    s.connect(g); g.connect(this.sfx); if (verb) { const vg = c.createGain(); vg.gain.value = verb; g.connect(vg); vg.connect(this.verb); }
    s.start();
  }
  // synthesized voices for things the CC0 packs don't cover
  growl(dist = 0, low = 1) {
    if (!this.ctx || this.muted) return; const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(95 * low, t); o.frequency.exponentialRampToValueAtTime(55 * low, t + 0.5);
    const n = this.noise(0.6); const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 600 * low; f.Q.value = 6;
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35 * Math.max(0, 1 - dist / 20), t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.connect(f); n.connect(f); f.connect(g); g.connect(this.sfx); const vg = c.createGain(); vg.gain.value = 0.3; g.connect(vg); vg.connect(this.verb);
    o.start(t); o.stop(t + 0.7); n.start(t); n.stop(t + 0.7);
  }
  rattle(dist = 0) {                       // dry bone clatter
    if (!this.ctx || this.muted) return; const c = this.ctx, t0 = c.currentTime;
    for (let k = 0; k < 5; k++) { const t = t0 + k * 0.05 + Math.random() * 0.03; const o = c.createOscillator(); o.type = "square"; o.frequency.value = 600 + Math.random() * 900;
      const g = c.createGain(); g.gain.setValueAtTime(0.08 * Math.max(0, 1 - dist / 20), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04); o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + 0.05); }
  }
  magic(kind = "bolt") {
    if (!this.ctx || this.muted) return; const c = this.ctx, t = c.currentTime;
    const base = kind === "heal" ? 520 : kind === "whirl" ? 180 : 740;
    for (const [m, d] of [[1, 0], [1.5, 0.03], [2, 0.06]]) {
      const o = c.createOscillator(); o.type = kind === "whirl" ? "sawtooth" : "sine"; o.frequency.setValueAtTime(base * m, t + d);
      o.frequency.exponentialRampToValueAtTime(base * m * (kind === "bolt" ? 0.5 : 1.5), t + 0.6);
      const g = c.createGain(); g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(0.12, t + d + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      o.connect(g); g.connect(this.sfx); const vg = c.createGain(); vg.gain.value = 0.6; g.connect(vg); vg.connect(this.verb); o.start(t + d); o.stop(t + 0.9);
    }
    if (kind === "whirl") { const n = this.noise(0.7); const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.6);
      const g = c.createGain(); g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.7); n.connect(f); f.connect(g); g.connect(this.sfx); n.start(t); n.stop(t + 0.7); }
  }
  levelUp() {
    if (!this.ctx || this.muted) return; const c = this.ctx, t = c.currentTime;
    [261.6, 329.6, 392, 523.2].forEach((f, k) => { const o = c.createOscillator(); o.type = "triangle"; o.frequency.value = f;
      const g = c.createGain(); g.gain.setValueAtTime(0, t + k * 0.12); g.gain.linearRampToValueAtTime(0.15, t + k * 0.12 + 0.04); g.gain.exponentialRampToValueAtTime(0.001, t + k * 0.12 + 1.6);
      o.connect(g); g.connect(this.sfx); const vg = c.createGain(); vg.gain.value = 0.8; g.connect(vg); vg.connect(this.verb); o.start(t + k * 0.12); o.stop(t + 2); });
    this.play("bell", { vol: 0.5, rate: 1.0, verb: 0.6 });
  }
  noise(sec) { const c = this.ctx, b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = b; return s; }
  // ---------------- generative score: slow drone + sparse low bells, darker in the dungeon
  startMusic() {
    const c = this.ctx; if (!c || this.droneOn) return; this.droneOn = true;
    this.droneFilter = c.createBiquadFilter(); this.droneFilter.type = "lowpass"; this.droneFilter.frequency.value = 380; this.droneFilter.connect(this.music);
    this.drones = [];
    for (const [f, det] of [[55, -6], [55, 7], [82.4, 3], [110, -4]]) {
      const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = det;
      const g = c.createGain(); g.gain.value = 0.05; o.connect(g); g.connect(this.droneFilter); o.start(); this.drones.push(o);
    }
    const lfo = c.createOscillator(); lfo.frequency.value = 0.06; const lg = c.createGain(); lg.gain.value = 160; lfo.connect(lg); lg.connect(this.droneFilter.frequency); lfo.start();
    this.music.gain.setTargetAtTime(this.musicOn ? 0.55 : 0, c.currentTime, 2);
    const tick = () => {
      if (!this.ctx) return;
      if (this.musicOn && !this.muted) {
        const scale = this.zone === "town" ? [220, 261.6, 293.7, 329.6, 392] : [110, 130.8, 146.8, 155.6, 196];
        const f = scale[Math.floor(Math.random() * scale.length)]; const t = c.currentTime;
        const o = c.createOscillator(); o.type = "sine"; o.frequency.value = f; const o2 = c.createOscillator(); o2.type = "sine"; o2.frequency.value = f * 2.76;
        const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 4);
        const g2 = c.createGain(); g2.gain.value = 0.25; o.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.music); o.start(t); o2.start(t); o.stop(t + 4.2); o2.stop(t + 4.2);
      }
      setTimeout(tick, 2500 + Math.random() * 4500);
    };
    setTimeout(tick, 1500);
  }
  setZone(z) {
    this.zone = z; if (!this.ctx) return; const t = this.ctx.currentTime;
    this.droneFilter.frequency.setTargetAtTime(z === "town" ? 520 : 300, t, 2);
    this.drones?.forEach((o, i) => o.frequency.setTargetAtTime((z === "town" ? [55, 55, 82.4, 110] : [41.2, 41.2, 61.7, 82.4])[i], t, 3));
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.1); }
}
