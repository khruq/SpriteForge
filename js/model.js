// SpriteForge - project data model.
// Everything the site edits lives in one plain JSON object so it can be saved,
// diffed, versioned in git and re-imported. Pixel grids are arrays of palette
// keys (strings) or null. Palette keys are free names; keys starting with "p"
// or "q" followed by a digit are "tint slots" that the runtime can swap per
// instance (Px.spawn(..., { pal = "hydro" })).

export const FORMAT_VERSION = 1;
export const MAX_SIZE = 256;

export function newProject(name = "my-game") {
  return {
    format: "pixforge", version: FORMAT_VERSION, name, px: 4,
    palettes: {
      base: {
        out: [62, 32, 24, 255], wh: [255, 255, 255, 255], ink: [40, 30, 30, 255],
        p0: [60, 100, 60, 255], p1: [90, 160, 80, 255], p2: [150, 220, 110, 255], p3: [200, 245, 170, 255],
        q0: [120, 60, 30, 255], q1: [170, 100, 50, 255], q2: [220, 160, 90, 255], q3: [245, 210, 150, 255],
      },
      hydro: { p0: [30, 70, 140, 255], p1: [50, 120, 210, 255], p2: [100, 180, 250, 255], p3: [190, 230, 255, 255] },
      pyro: { p0: [140, 40, 20, 255], p1: [220, 80, 40, 255], p2: [255, 140, 70, 255], p3: [255, 210, 150, 255] },
    },
    sprites: {},
    clips: {},
    behaviors: {},
  };
}

export function emptyGrid(w, h) {
  const g = [];
  for (let y = 0; y < h; y++) g.push(new Array(w).fill(null));
  return g;
}

export function newSprite(name, w = 16, h = 16) {
  return {
    name, w, h, ax: w / 2, ay: h - 1,
    layers: [{ name: "body", separate: false, visible: true }],
    frames: [{ layers: { body: emptyGrid(w, h) } }],
    fps: 8, lod: false, nine: null, tiles: false,
  };
}

export function cloneGrid(g) { return g.map(r => r.slice()); }

export function resizeSprite(sp, w, h, anchor = "bl") {
  w = Math.max(1, Math.min(MAX_SIZE, w)); h = Math.max(1, Math.min(MAX_SIZE, h));
  const dx = anchor.includes("r") ? w - sp.w : anchor.includes("c") ? Math.floor((w - sp.w) / 2) : 0;
  const dy = anchor.includes("t") ? 0 : anchor.includes("m") ? Math.floor((h - sp.h) / 2) : h - sp.h;
  for (const f of sp.frames) for (const L of sp.layers) {
    const src = f.layers[L.name] || emptyGrid(sp.w, sp.h), dst = emptyGrid(w, h);
    for (let y = 0; y < sp.h; y++) for (let x = 0; x < sp.w; x++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h) dst[ny][nx] = src[y][x];
    }
    f.layers[L.name] = dst;
  }
  sp.ax = sp.ax + dx; sp.ay = sp.ay + dy; sp.w = w; sp.h = h;
}

// Composite the visible layers of a frame into one grid (later layers on top).
export function composite(sp, frameIndex, onlyLayers = null) {
  if (sp.kind === "vector") return emptyGrid(1, 1);
  const f = sp.frames[frameIndex];
  const out = emptyGrid(sp.w, sp.h);
  for (const L of sp.layers) {
    if (onlyLayers ? !onlyLayers.includes(L.name) : !L.visible) continue;
    const g = f.layers[L.name];
    if (!g) continue;
    for (let y = 0; y < sp.h; y++) for (let x = 0; x < sp.w; x++) if (g[y][x] != null) out[y][x] = g[y][x];
  }
  return out;
}

export function resolveColor(project, key, palName) {
  const pal = project.palettes[palName] || {};
  return pal[key] || project.palettes.base[key] || [255, 0, 255, 255];
}

export function usedKeys(sp) {
  if (sp.kind === "vector") { const v = new Set(); for (const f of sp.frames) for (const shapes of Object.values(f.layers)) for (const sh of shapes || []) if (sh.c != null) v.add(sh.c); return [...v]; }
  const s = new Set();
  for (const f of sp.frames) for (const g of Object.values(f.layers)) for (const row of g) for (const k of row) if (k != null) s.add(k);
  return [...s];
}

export function validate(project) {
  const errors = [];
  if (project.format !== "pixforge") errors.push("not a pixforge project");
  for (const [name, sp] of Object.entries(project.sprites)) {
    if (sp.kind !== "vector" && (sp.w > MAX_SIZE || sp.h > MAX_SIZE)) errors.push(name + ": larger than " + MAX_SIZE);
    for (const k of usedKeys(sp)) if (!project.palettes.base[k]) errors.push(name + ": key '" + k + "' missing from base palette");
  }
  return errors;
}

// ---- undo stack (snapshot based; sprites are small) ----
export class History {
  constructor(limit = 80) { this.past = []; this.future = []; this.limit = limit; }
  push(state) { this.past.push(JSON.stringify(state)); if (this.past.length > this.limit) this.past.shift(); this.future = []; }
  undo(current) { if (!this.past.length) return null; this.future.push(JSON.stringify(current)); return JSON.parse(this.past.pop()); }
  redo(current) { if (!this.future.length) return null; this.past.push(JSON.stringify(current)); return JSON.parse(this.future.pop()); }
}
