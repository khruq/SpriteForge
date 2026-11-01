// SpriteForge - vector drawings. A vector sprite stores shapes in sprite units
// (y down, like the pixel grid). For the game every shape is compiled into
// primitives the runtime can show with built-in assets:
//   a = 1 square (asset 100001), a = 2 circle (asset 100002), a = 3 triangle (asset 100003)
//   x, y = centre, w, h = size, r = rotation in degrees (clockwise on screen), c = colour key
// The editor preview draws exactly these primitives, so what you see is what the game shows.
//
// Shapes:
//   { t: "s", c, w, p: [x0, y0, x1, y1, ...] }  stroke with round ends and joints
//   { t: "r", c, x, y, w, h, r }                  filled rectangle (top-left corner, size, optional rotation)
//   { t: "e", c, x, y, w, h, r }                  filled ellipse (bounding box, optional rotation)
//   { t: "t", c, x, y, w, h, r }                  filled triangle: tip at the middle of the top edge, base along the bottom edge
// r turns the shape around its centre, in degrees clockwise on screen.

const R2 = v => Math.round(v * 10) / 10;
const BOX_KIND = { r: 1, e: 2, t: 3 };

export function newVectorSprite(name, w = 64, h = 64) {
  return {
    name, kind: "vector", w, h, ax: w / 2, ay: h,
    layers: [{ name: "body", separate: false, visible: true }],
    frames: [{ layers: { body: [] } }],
    fps: 8, lod: false, nine: null, tiles: false,
  };
}
export const isVector = sp => !!sp && sp.kind === "vector";

// Ramer-Douglas-Peucker on a flat point list
export function simplifyPoints(p, tol) {
  const n = p.length / 2;
  if (n <= 2 || tol <= 0) return p.slice();
  const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const ax = p[a * 2], ay = p[a * 2 + 1], bx = p[b * 2], by = p[b * 2 + 1];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-9;
    let best = -1, bi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * p[i * 2] - dx * p[i * 2 + 1] + bx * ay - by * ax) / len;
      if (d > best) { best = d; bi = i; }
    }
    if (best > tol) { keep[bi] = 1; stack.push([a, bi], [bi, b]); }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(R2(p[i * 2]), R2(p[i * 2 + 1]));
  return out;
}

export function compileShape(s, out = []) {
  if (BOX_KIND[s.t]) { out.push({ a: BOX_KIND[s.t], x: R2(s.x + s.w / 2), y: R2(s.y + s.h / 2), w: R2(Math.abs(s.w)), h: R2(Math.abs(s.h)), r: R2(s.r || 0), c: s.c }); return out; }
  if (s.t !== "s") return out;
  const p = s.p, n = p.length / 2, w = s.w;
  if (n === 0) return out;
  if (n === 1 || (n === 2 && p[0] === p[2] && p[1] === p[3])) { out.push({ a: 2, x: R2(p[0]), y: R2(p[1]), w: R2(w), h: R2(w), r: 0, c: s.c }); return out; }
  out.push({ a: 2, x: R2(p[0]), y: R2(p[1]), w: R2(w), h: R2(w), r: 0, c: s.c });
  let prevAng = null;
  for (let i = 0; i < n - 1; i++) {
    const x0 = p[i * 2], y0 = p[i * 2 + 1], x1 = p[i * 2 + 2], y1 = p[i * 2 + 3];
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 1e-6) continue;
    const ang = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI;
    if (prevAng !== null) {
      let d = Math.abs(ang - prevAng) % 360; if (d > 180) d = 360 - d;
      if (d > 1) out.push({ a: 2, x: R2(x0), y: R2(y0), w: R2(w), h: R2(w), r: 0, c: s.c });
    }
    out.push({ a: 1, x: R2((x0 + x1) / 2), y: R2((y0 + y1) / 2), w: R2(len), h: R2(w), r: R2(ang), c: s.c });
    prevAng = ang;
  }
  out.push({ a: 2, x: R2(p[(n - 1) * 2]), y: R2(p[(n - 1) * 2 + 1]), w: R2(w), h: R2(w), r: 0, c: s.c });
  return out;
}
export function compileShapes(shapes) { const out = []; for (const s of shapes || []) compileShape(s, out); return out; }

// Layers of one frame, bottom to top. onlyLayers: names to include (default: visible ones).
export function compileFrame(sp, frameIndex, onlyLayers = null) {
  const f = sp.frames[frameIndex], out = [];
  for (const L of sp.layers) {
    if (onlyLayers ? !onlyLayers.includes(L.name) : !L.visible) continue;
    compileShapes(f.layers[L.name] || []).forEach(q => out.push(q));
  }
  return out;
}

// Draw primitives. ox/oy = where sprite unit (0, 0) lands, s = screen px per unit.
export function drawPrims(ctx, prims, colorOf, ox, oy, s, alphaMul = 1) {
  for (const q of prims) {
    const c = colorOf(q.c); if (!c) continue;
    ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${(c[3] ?? 255) / 255 * alphaMul})`;
    ctx.save();
    ctx.translate(ox + q.x * s, oy + q.y * s);
    if (q.r) ctx.rotate(q.r * Math.PI / 180);
    if (q.a === 2) { ctx.beginPath(); ctx.ellipse(0, 0, Math.max(0.01, q.w * s / 2), Math.max(0.01, q.h * s / 2), 0, 0, Math.PI * 2); ctx.fill(); }
    else if (q.a === 3) { const hw = q.w * s / 2, hh = q.h * s / 2; ctx.beginPath(); ctx.moveTo(0, -hh); ctx.lineTo(hw, hh); ctx.lineTo(-hw, hh); ctx.closePath(); ctx.fill(); }
    else ctx.fillRect(-q.w * s / 2, -q.h * s / 2, q.w * s, q.h * s);
    ctx.restore();
  }
}

export function primHit(q, x, y, pad = 0) {
  const dx = x - q.x, dy = y - q.y, a = -(q.r || 0) * Math.PI / 180;
  const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
  const hw = q.w / 2 + pad, hh = q.h / 2 + pad;
  if (q.a === 2) return (lx * lx) / (hw * hw) + (ly * ly) / (hh * hh) <= 1;
  if (q.a === 3) return ly >= -hh && ly <= hh && Math.abs(lx) <= hw * (ly + hh) / (2 * hh);
  return Math.abs(lx) <= hw && Math.abs(ly) <= hh;
}
// index of the topmost shape under (x, y), or -1
export function hitShape(shapes, x, y, pad = 0.6) {
  for (let i = shapes.length - 1; i >= 0; i--) for (const q of compileShape(shapes[i])) if (primHit(q, x, y, pad)) return i;
  return -1;
}
export function shapeBounds(s) {
  const prims = compileShape(s);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const q of prims) { const r = Math.hypot(q.w, q.h) / 2; x0 = Math.min(x0, q.x - r); y0 = Math.min(y0, q.y - r); x1 = Math.max(x1, q.x + r); y1 = Math.max(y1, q.y + r); }
  return { x0, y0, x1, y1 };
}

// geometric edits (in place)
export function mapShape(s, fx, fy) {
  if (s.t === "s") { for (let i = 0; i < s.p.length; i += 2) { s.p[i] = R2(fx(s.p[i])); s.p[i + 1] = R2(fy(s.p[i + 1])); } return s; }
  const xa = fx(s.x), xb = fx(s.x + s.w), ya = fy(s.y), yb = fy(s.y + s.h);
  s.x = R2(Math.min(xa, xb)); s.w = R2(Math.abs(xb - xa)); s.y = R2(Math.min(ya, yb)); s.h = R2(Math.abs(yb - ya));
  const fx2 = xb < xa, fy2 = yb < ya;
  if (s.t === "t") {
    if (fx2 || fy2) { let r = fx2 && fy2 ? (s.r || 0) + 180 : fy2 ? 180 - (s.r || 0) : -(s.r || 0); r = ((r % 360) + 360) % 360; if (r > 180) r -= 360; r = R2(r); if (r) s.r = r; else delete s.r; }
  } else if (s.r && fx2 !== fy2) s.r = -s.r;
  return s;
}
export function moveShape(s, dx, dy) { return mapShape(s, x => x + dx, y => y + dy); }
export function scaleShape(s, k) { mapShape(s, x => x * k, y => y * k); if (s.t === "s") s.w = R2(s.w * k); return s; }

export function ellipseStroke(x, y, w, h, c, width, steps = 28) {
  const p = [], cx = x + w / 2, cy = y + h / 2;
  for (let i = 0; i <= steps; i++) { const a = i / steps * Math.PI * 2; p.push(R2(cx + Math.cos(a) * w / 2), R2(cy + Math.sin(a) * h / 2)); }
  return { t: "s", c, w: width, p };
}
export function rectStroke(x, y, w, h, c, width) {
  return { t: "s", c, w: width, p: [x, y, x + w, y, x + w, y + h, x, y + h, x, y].map(R2) };
}

export function usedVectorKeys(sp) {
  const s = new Set();
  for (const f of sp.frames) for (const shapes of Object.values(f.layers)) for (const sh of shapes || []) if (sh.c != null) s.add(sh.c);
  return [...s];
}

// ready-made vector drawings (64 x 64 units)
export const VECTOR_PRESET_COLORS = {
  out: [40, 30, 44, 255], wh: [255, 255, 255, 255], skin: [255, 214, 120, 255], red1: [215, 60, 70, 255],
  sky: [120, 190, 255, 255], cloud: [245, 248, 255, 255], cloud2: [210, 222, 240, 255], leaf1: [70, 160, 75, 255], gold1: [235, 175, 40, 255],
  bubble: [250, 250, 250, 255], btn1: [90, 105, 140, 255], btn2: [140, 160, 200, 255], pink: [255, 150, 190, 255],
};
const S = (c, w, ...p) => ({ t: "s", c, w, p });
const E = (c, x, y, w, h) => ({ t: "e", c, x, y, w, h });
const Rr = (c, x, y, w, h) => ({ t: "r", c, x, y, w, h });
export const VECTOR_PRESETS = [
  { name: "smile", shapes: [E("out", 6, 6, 52, 52), E("skin", 9, 9, 46, 46), E("out", 21, 22, 6, 9), E("out", 37, 22, 6, 9), S("out", 3.5, 19, 38, 25, 44, 32, 46, 39, 44, 45, 38)] },
  { name: "cloud", shapes: [E("cloud2", 6, 26, 24, 22), E("cloud2", 34, 24, 26, 24), E("cloud", 14, 16, 26, 26), E("cloud", 30, 12, 22, 24), E("cloud", 8, 28, 50, 18)] },
  { name: "flower", shapes: [S("leaf1", 4, 32, 36, 32, 62), E("leaf1", 32, 44, 16, 8), E("pink", 22, 4, 20, 20), E("pink", 22, 28, 20, 20), E("pink", 10, 16, 20, 20), E("pink", 34, 16, 20, 20), E("gold1", 25, 19, 14, 14)] },
  { name: "bubble", shapes: [Rr("out", 4, 6, 56, 38), Rr("bubble", 6, 8, 52, 34), S("out", 2, 18, 44, 14, 56, 28, 44), S("bubble", 2.5, 20, 42, 16, 52)] },
  { name: "heart", shapes: [E("red1", 8, 10, 26, 26), E("red1", 30, 10, 26, 26), E("red1", 16, 20, 32, 20), S("red1", 14, 15, 30, 32, 50, 49, 30)] },
  { name: "star", shapes: [S("gold1", 7, 32, 8, 38, 26, 56, 26, 42, 38, 48, 56, 32, 46, 16, 56, 22, 38, 8, 26, 26, 26, 32, 8)] },
  { name: "arrow", shapes: [S("out", 8, 8, 32, 50, 32), S("out", 8, 36, 18, 52, 32, 36, 46)] },
  { name: "button", shapes: [Rr("btn1", 4, 14, 56, 36), Rr("btn2", 4, 14, 56, 28), S("wh", 3, 20, 32, 44, 32)] },
];
