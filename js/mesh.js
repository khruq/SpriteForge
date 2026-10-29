// SpriteForge - rect-mesh encoder/decoder.
// A sprite is a grid of palette keys (string) or null. The encoder covers every
// painted cell with axis-aligned rectangles, allowing rectangles of a colour to
// be painted *under* later colours (painter's order), which keeps the count low.
// Output is the compact text format consumed by lua/pix.lua:
//   k = ordered list of palette keys, r = 5 chars per rect: x y w h keyIndex
// Each char encodes 0..90 using printable ASCII 35..126 minus backslash.
// Sprites wider or taller than 91 use the wide form (z = 2): x y w h take two
// chars each (hi * 91 + lo), the key index stays one char: 9 chars per rect.

export const ALPHA = (() => {
  const out = [];
  for (let c = 35; c < 127; c++) if (c !== 92) out.push(String.fromCharCode(c));
  return out;
})();
const DEC = new Map(ALPHA.map((ch, i) => [ch, i]));

export function enc(v) {
  if (v < 0 || v >= ALPHA.length) throw new Error("mesh: value out of range " + v);
  return ALPHA[v];
}

export const MAX_SIDE = 256;
export function decodeRects(r, keys, z = 1) {
  const out = [];
  if (z === 2) {
    const d2 = i => DEC.get(r[i]) * 91 + DEC.get(r[i + 1]);
    for (let i = 0; i + 9 <= r.length; i += 9) out.push({ x: d2(i), y: d2(i + 2), w: d2(i + 4), h: d2(i + 6), key: keys[DEC.get(r[i + 8])] });
    return out;
  }
  for (let i = 0; i + 5 <= r.length; i += 5) {
    out.push({ x: DEC.get(r[i]), y: DEC.get(r[i + 1]), w: DEC.get(r[i + 2]), h: DEC.get(r[i + 3]), key: keys[DEC.get(r[i + 4])] });
  }
  return out;
}

function grow(allowed, target, covered, x, y, W, H, exact) {
  const gain = (rx, ry, rw, rh) => {
    let n = 0;
    for (let yy = ry; yy < ry + rh; yy++) for (let xx = rx; xx < rx + rw; xx++) if (target[yy][xx] && !covered[yy][xx]) n++;
    return n;
  };
  const cands = [];
  let w = 1;
  while (x + w < W && allowed[y][x + w]) w++;
  let h = 1;
  const rowOk = (yy, x0, x1) => { for (let xx = x0; xx < x1; xx++) if (!allowed[yy][xx]) return false; return true; };
  while (y + h < H && rowOk(y + h, x, x + w)) h++;
  cands.push([x, y, w, h]);
  let h2 = 1;
  while (y + h2 < H && allowed[y + h2][x]) h2++;
  let w2 = 1;
  const colOk = (xx, y0, y1) => { for (let yy = y0; yy < y1; yy++) if (!allowed[yy][xx]) return false; return true; };
  while (x + w2 < W && colOk(x + w2, y, y + h2)) w2++;
  cands.push([x, y, w2, h2]);
  for (let wl = 1; wl <= w; wl++) {
    let hh = 1;
    while (y + hh < H && rowOk(y + hh, x, x + wl)) hh++;
    cands.push([x, y, wl, hh]);
  }
  let best = null, bg = -1;
  for (const c of cands) {
    const g = gain(...c);
    if (g > bg || (g === bg && c[2] * c[3] > best[2] * best[3])) { best = c; bg = g; }
  }
  return best;
}

function layered(grid, W, H, order, trans) {
  const rank = new Map(order.map((k, i) => [k, i]));
  const rects = [];
  order.forEach((k, i) => {
    const allowed = [], target = [], covered = [];
    for (let y = 0; y < H; y++) {
      allowed.push(new Array(W).fill(false)); target.push(new Array(W).fill(false)); covered.push(new Array(W).fill(false));
      for (let x = 0; x < W; x++) {
        const c = grid[y][x];
        if (c == null) continue;
        if (c === k) { allowed[y][x] = true; target[y][x] = true; }
        else if (!trans.has(k) && !trans.has(c) && rank.get(c) > i) allowed[y][x] = true;
      }
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (target[y][x] && !covered[y][x]) {
        const [rx, ry, rw, rh] = grow(allowed, target, covered, x, y, W, H, trans.has(k));
        for (let yy = ry; yy < ry + rh; yy++) for (let xx = rx; xx < rx + rw; xx++) {
          if (target[yy][xx]) covered[yy][xx] = true;
          if (trans.has(k)) allowed[yy][xx] = false;
        }
        rects.push({ x: rx, y: ry, w: rw, h: rh, key: k });
      }
    }
  });
  return rects;
}

// grid: array[h][w] of key|null; alphaOf(key) -> 0..255 (translucent keys are never painted under others)
export function mesh(grid, W, H, alphaOf) {
  const keys = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = grid[y][x]; if (c != null && !keys.includes(c)) keys.push(c); }
  if (!keys.length) return { order: [], rects: [] };
  const trans = new Set(keys.filter(k => (alphaOf ? alphaOf(k) : 255) < 255));
  const stats = {};
  for (const k of keys) {
    let n = 0, minx = W, maxx = -1, miny = H, maxy = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (grid[y][x] === k) { n++; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
    stats[k] = [n, (maxx - minx + 1) * (maxy - miny + 1)];
  }
  const orders = [
    [...keys].sort((a, b) => stats[b][1] - stats[a][1]),
    [...keys].sort((a, b) => stats[b][0] - stats[a][0]),
    [...keys].sort((a, b) => (stats[b][1] + stats[b][0]) - (stats[a][1] + stats[a][0])),
    [...keys],
  ];
  let best = null;
  for (let order of orders) {
    order = [...order.filter(k => !trans.has(k)), ...order.filter(k => trans.has(k))];
    const rects = layered(grid, W, H, order, trans);
    if (!best || rects.length < best.rects.length) best = { order, rects };
  }
  return best;
}

// Flat (non-layered) cover: every rect is exact, used for the "compact" opaque variant
// when the caller wants no overdraw (e.g. translucent whole-sprite alpha).
export function meshExact(grid, W, H) {
  const keys = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = grid[y][x]; if (c != null && !keys.includes(c)) keys.push(c); }
  const trans = new Set(keys);
  return { order: keys, rects: layered(grid, W, H, keys, trans) };
}

const CACHE = new Map();
export function encodeSprite(grid, W, H, alphaOf) {
  if (W > MAX_SIDE || H > MAX_SIDE) throw new Error("mesh: sprites are limited to " + MAX_SIDE + "x" + MAX_SIDE);
  const keys = new Set(); for (const row of grid) for (const c of row) if (c != null) keys.add(c);
  const trans = [...keys].filter(k => (alphaOf ? alphaOf(k) : 255) < 255).sort().join(",");
  const ck = W + "x" + H + "|" + trans + "|" + JSON.stringify(grid);
  const hit = CACHE.get(ck);
  if (hit) return hit;
  const m = mesh(grid, W, H, alphaOf);
  if (m.order.length > 91) throw new Error("mesh: at most 91 colours per sprite");
  const idx = new Map(m.order.map((k, i) => [k, i]));
  const z = W > 91 || H > 91 ? 2 : 1;
  const e2 = v => enc(Math.floor(v / 91)) + enc(v % 91);
  let r = "";
  for (const q of m.rects) r += z === 2 ? e2(q.x) + e2(q.y) + e2(q.w) + e2(q.h) + enc(idx.get(q.key)) : enc(q.x) + enc(q.y) + enc(q.w) + enc(q.h) + enc(idx.get(q.key));
  const out = { k: m.order, r, count: m.rects.length, z };
  if (CACHE.size > 400) CACHE.delete(CACHE.keys().next().value);
  CACHE.set(ck, out);
  return out;
}

export function rasterize(rects, W, H) {
  const grid = [];
  for (let y = 0; y < H; y++) grid.push(new Array(W).fill(null));
  for (const q of rects) for (let y = q.y; y < q.y + q.h; y++) for (let x = q.x; x < q.x + q.w; x++) if (y < H && x < W) grid[y][x] = q.key;
  return grid;
}
