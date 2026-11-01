import { compileShapes, drawPrims } from "./vector.js?v=1.0";
import { cachedFrame, drawScaled } from "./raster.js?v=1.0";
// SpriteForge - runtime simulator. Mirrors lua/pix.lua: the same clip evaluation
// and the same state machine, so what the browser preview shows is what the
// Lua runtime does in the game.

export const EASE = {
  linear: t => t,
  inQuad: t => t * t,
  outQuad: t => 1 - (1 - t) * (1 - t),
  inOutQuad: t => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2,
  inCubic: t => t * t * t,
  outCubic: t => 1 - (1 - t) ** 3,
  inOutCubic: t => t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2,
  inSine: t => 1 - Math.cos(t * Math.PI / 2),
  outSine: t => Math.sin(t * Math.PI / 2),
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  inBack: t => 2.70158 * t * t * t - 1.70158 * t * t,
  outElastic: t => t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1,
  outBack: t => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  outBounce: t => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; },
  step: () => 0,
};

export const DEFAULTS = { x: 0, y: 0, sx: 1, sy: 1, rot: 0, alpha: 1, frame: 1, pal: null };
const STEPPED = p => p === "frame" || p === "pal" || p.startsWith("layer:");

export function evalTrack(track, t) {
  const keys = track.keys || [];
  if (!keys.length) return undefined;
  if (t <= keys[0].t) return keys[0].v;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t >= a.t && t < b.t) {
      if (STEPPED(track.prop) || typeof a.v !== "number") return a.v;
      const f = (EASE[track.ease] || EASE.linear)((t - a.t) / Math.max(1e-6, b.t - a.t));
      return a.v + (b.v - a.v) * f;
    }
  }
  return keys[keys.length - 1].v;
}

// Returns { props, layers } for a clip at time t (t already wrapped/clamped)
export function evalClip(clip, t) {
  const props = { ...DEFAULTS }, layers = {};
  for (const track of clip.tracks || []) {
    if (track.prop === "ev") continue;
    const v = evalTrack(track, t);
    if (v === undefined) continue;
    if (track.prop.startsWith("layer:")) layers[track.prop.slice(6)] = !!v && v !== 0;
    else props[track.prop] = v;
  }
  return { props, layers };
}

export class Actor {
  constructor(project, spriteName, behaviorName = null) {
    this.project = project;
    this.sprite = project.sprites[spriteName];
    this.behavior = behaviorName ? project.behaviors[behaviorName] : null;
    this.params = { ...(this.behavior?.params || {}) };
    this.clip = null; this.clipName = null; this.t = 0; this.ended = false; this.rate = 1; this.once = null; this.fresh = false;
    this.state = null; this.timer = null; this.stateLayers = {}; this.statePal = null;
    this.listeners = {};
    this.props = { ...DEFAULTS };
    this.layers = {};
    if (this.behavior) this.setState(this.behavior.initial || Object.keys(this.behavior.states || {})[0]);
  }
  on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); }
  emit(ev, ...a) { for (const fn of this.listeners[ev] || []) fn(...a); }
  play(clipName, restart = true) {
    const c = this.project.clips[clipName];
    this.clipName = c ? clipName : null; this.clip = c || null;
    if (restart) { this.t = 0; this.ended = false; this.fresh = true; }
  }
  speed(m) { this.rate = m; return this; }
  playOnce(clipName, done) { const back = this.clipName; this.play(clipName, true); this.once = { back, done }; return this; }
  clipEvents(prev, now, wrapped) {
    const lo = this.fresh ? -1 : prev; this.fresh = false;
    for (const tr of this.clip.tracks || []) {
      if (tr.prop !== "ev") continue;
      for (const k of tr.keys) if (wrapped ? (k.t > lo || k.t <= now) : (k.t > lo && k.t <= now)) this.emit("event", k.v);
    }
  }
  setState(name) {
    const st = this.behavior?.states?.[name];
    if (!st) return false;
    this.state = name;
    this.stateLayers = { ...(st.layers || {}) };
    this.statePal = st.pal || null;
    this.play(st.clip || null, true);
    this.timer = null;
    for (const tr of st.on || []) if (tr.timer) { const [a, b] = tr.timer; this.timer = { at: a + Math.random() * Math.max(0, b - a), to: tr.to }; }
    this.emit("state", name);
    this.checkParams();
    return true;
  }
  fire(ev) {
    const st = this.behavior?.states?.[this.state];
    if (!st) return false;
    for (const tr of st.on || []) if (tr.ev === ev) { this.setState(tr.to); return true; }
    return false;
  }
  set(param, value) { this.params[param] = value; this.checkParams(); }
  checkParams() {
    const st = this.behavior?.states?.[this.state];
    if (!st) return;
    for (const tr of st.on || []) {
      if (!tr.param) continue;
      const v = this.params[tr.param] ?? 0;
      if ((tr.lt != null && v < tr.lt) || (tr.gt != null && v > tr.gt)) { if (tr.to !== this.state) this.setState(tr.to); return; }
    }
  }
  update(dt) {
    dt *= this.rate;
    if (this.clip) {
      const dur = Math.max(1e-6, this.clip.dur || 1);
      const prev = this.t; let wrapped = false;
      this.t += dt;
      if (this.clip.loop && !this.once) { if (this.t >= dur) wrapped = true; this.t = this.t % dur; }
      else if (this.ended) this.t = Math.min(this.t, dur);
      this.clipEvents(prev, Math.min(this.t, dur), wrapped);
      if (this.t >= dur && !this.ended && (!this.clip.loop || this.once)) {
        this.t = dur; this.ended = true; this.emit("clipEnd", this.clipName);
        if (this.once) { const o = this.once; this.once = null; this.play(o.back, true); if (o.done) o.done(this); }
        else this.fire("end");
      }
      if (!this.clip) { this.props = { ...DEFAULTS }; this.layers = { ...this.stateLayers }; }
      else { const r = evalClip(this.clip, Math.min(this.t, Math.max(1e-6, this.clip.dur || 1))); this.props = r.props; this.layers = { ...this.stateLayers, ...r.layers }; }
    } else { this.props = { ...DEFAULTS }; this.layers = { ...this.stateLayers }; }
    if (this.timer) { this.timer.at -= dt; if (this.timer.at <= 0) { const to = this.timer.to; this.timer = null; this.setState(to); } }
  }
  // effective values for rendering
  frameIndex() { const n = this.sprite.frames.length; const f = Math.round(this.props.frame || 1); return ((f - 1) % n + n) % n; }
  palette() { return this.props.pal || this.statePal || "base"; }
  layerVisible(name) { const v = this.layers[name]; return v === undefined ? true : v; }
}

// Draw an actor to a 2D context. px = size of one sprite pixel in canvas px.
export function drawActor(ctx, actor, project, cx, cy, px, instancePal = null, forceFrame = null) {
  const sp = actor.sprite, p = actor.props;
  const frame = forceFrame ?? actor.frameIndex();
  const pal = instancePal || actor.palette();
  const f = sp.frames[frame];
  ctx.save();
  ctx.translate(cx + p.x * px, cy - p.y * px);
  ctx.rotate(-p.rot * Math.PI / 180);
  ctx.scale(p.sx, p.sy);
  ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
  if (sp.kind === "vector") {
    const colorOf = k => (project.palettes[pal] || {})[k] || project.palettes.base[k] || [255, 0, 255, 255];
    for (const L of sp.layers) {
      if (!actor.layerVisible(L.name) || !L.visible) continue;
      drawPrims(ctx, compileShapes(f.layers[L.name] || []), colorOf, -sp.ax * px, -sp.ay * px, px);
    }
    ctx.restore();
    return;
  }
  const names = sp.layers.filter(L => L.visible && actor.layerVisible(L.name)).map(L => L.name);
  drawScaled(ctx, cachedFrame(project, sp, frame, pal, names), -sp.ax * px, -(sp.ay + 1) * px, sp.w * px, sp.h * px);
  ctx.restore();
}
