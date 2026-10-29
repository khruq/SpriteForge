// SpriteForge - image import: resample, quantize, clean up.
// Returns a grid of palette keys plus the colours it created, so the result
// drops straight into the editor and the palette.

function medianCut(pixels, count) {
  // pixels: array of [r,g,b]; returns up to `count` representative colours
  let boxes = [pixels];
  const range = box => {
    const mn = [255, 255, 255], mx = [0, 0, 0];
    for (const p of box) for (let i = 0; i < 3; i++) { if (p[i] < mn[i]) mn[i] = p[i]; if (p[i] > mx[i]) mx[i] = p[i]; }
    const span = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
    const axis = span.indexOf(Math.max(...span));
    return { axis, span: span[axis] };
  };
  while (boxes.length < count) {
    let bi = -1, bs = -1;
    boxes.forEach((b, i) => { if (b.length > 1) { const r = range(b); if (r.span > bs) { bs = r.span; bi = i; } } });
    if (bi < 0) break;
    const box = boxes[bi], axis = range(box).axis;
    box.sort((a, b) => a[axis] - b[axis]);
    const mid = box.length >> 1;
    boxes.splice(bi, 1, box.slice(0, mid), box.slice(mid));
  }
  return boxes.map(b => {
    const s = [0, 0, 0];
    for (const p of b) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; }
    return [Math.round(s[0] / b.length), Math.round(s[1] / b.length), Math.round(s[2] / b.length)];
  });
}

function kmeansRefine(pixels, centers, iters = 6) {
  for (let it = 0; it < iters; it++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (const p of pixels) {
      const i = nearest(p, centers);
      sums[i][0] += p[0]; sums[i][1] += p[1]; sums[i][2] += p[2]; sums[i][3]++;
    }
    centers = centers.map((c, i) => sums[i][3] ? [Math.round(sums[i][0] / sums[i][3]), Math.round(sums[i][1] / sums[i][3]), Math.round(sums[i][2] / sums[i][3])] : c);
  }
  return centers;
}

function nearest(p, centers) {
  let bi = 0, bd = Infinity;
  for (let i = 0; i < centers.length; i++) {
    const c = centers[i];
    const d = (p[0] - c[0]) ** 2 * 0.3 + (p[1] - c[1]) ** 2 * 0.59 + (p[2] - c[2]) ** 2 * 0.11;
    if (d < bd) { bd = d; bi = i; }
  }
  return bi;
}

// opts: { w, h, colors, alphaThreshold, outline, despeckle, keyPrefix, dither }
export function imageToGrid(img, opts) {
  const { w, h } = opts;
  const colors = Math.max(2, Math.min(32, opts.colors || 8));
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = opts.smooth !== false;
  ctx.imageSmoothingQuality = "high";
  // letterbox the source into the target grid, keeping aspect
  const scale = Math.min(w / img.width, h / img.height);
  const dw = Math.max(1, Math.round(img.width * scale)), dh = Math.max(1, Math.round(img.height * scale));
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, Math.floor((w - dw) / 2), h - dh, dw, dh);
  const data = ctx.getImageData(0, 0, w, h).data;
  const thr = opts.alphaThreshold ?? 128;
  const opaque = [];
  for (let i = 0; i < w * h; i++) if (data[i * 4 + 3] >= thr) opaque.push([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]);
  if (!opaque.length) return { grid: emptyGrid(w, h), colors: {} };
  let centers = medianCut(opaque, colors);
  centers = kmeansRefine(opaque, centers);
  // sort dark -> light so key numbering is stable
  centers.sort((a, b) => (a[0] * 0.3 + a[1] * 0.59 + a[2] * 0.11) - (b[0] * 0.3 + b[1] * 0.59 + b[2] * 0.11));
  const prefix = opts.keyPrefix || "c";
  const keys = centers.map((_, i) => prefix + i);
  const grid = emptyGrid(w, h);
  const err = opts.dither ? new Float32Array(w * h * 3) : null;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (data[i * 4 + 3] < thr) continue;
    let p = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
    if (err) p = [p[0] + err[i * 3], p[1] + err[i * 3 + 1], p[2] + err[i * 3 + 2]];
    const ci = nearest(p, centers);
    grid[y][x] = keys[ci];
    if (err) {
      const c = centers[ci];
      const e = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
      const spread = (xx, yy, f) => { if (xx < 0 || xx >= w || yy >= h) return; const j = (yy * w + xx) * 3; err[j] += e[0] * f; err[j + 1] += e[1] * f; err[j + 2] += e[2] * f; };
      spread(x + 1, y, 7 / 16); spread(x - 1, y + 1, 3 / 16); spread(x, y + 1, 5 / 16); spread(x + 1, y + 1, 1 / 16);
    }
  }
  if (opts.despeckle) despeckle(grid, w, h);
  const colorsOut = {};
  keys.forEach((k, i) => colorsOut[k] = [...centers[i], 255]);
  if (opts.outline) {
    const okey = opts.outlineKey || "out";
    outline(grid, w, h, okey);
    if (!colorsOut[okey]) colorsOut[okey] = opts.outlineColor || [62, 32, 24, 255];
  }
  return { grid, colors: colorsOut };
}

function emptyGrid(w, h) { const g = []; for (let y = 0; y < h; y++) g.push(new Array(w).fill(null)); return g; }

// Replace isolated single pixels by their most common neighbour.
export function despeckle(grid, w, h) {
  const copy = grid.map(r => r.slice());
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = copy[y][x];
    const nb = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h) nb.push(copy[yy][xx]);
    }
    if (nb.length < 2 || nb.some(n => n === k)) continue;
    const counts = {};
    for (const n of nb) counts[n] = (counts[n] || 0) + 1;
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] >= 3) grid[y][x] = best[0] === "null" ? null : best[0];
  }
}

// One-pixel outline around every painted cell (4-neighbour), drawn into empty cells.
export function outline(grid, w, h, key, diagonal = false) {
  const add = [];
  const nbs = diagonal ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (grid[y][x] != null) continue;
    for (const [dx, dy] of nbs) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h && grid[yy][xx] != null && grid[yy][xx] !== key) { add.push([x, y]); break; }
    }
  }
  for (const [x, y] of add) grid[y][x] = key;
}

// Cut a sprite sheet into frames: returns array of HTMLCanvasElement
export function cutSheet(img, cols, rows, margin = 0, spacing = 0) {
  const fw = Math.floor((img.width - margin * 2 - spacing * (cols - 1)) / cols);
  const fh = Math.floor((img.height - margin * 2 - spacing * (rows - 1)) / rows);
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const cv = document.createElement("canvas"); cv.width = fw; cv.height = fh;
    cv.getContext("2d").drawImage(img, margin + c * (fw + spacing), margin + r * (fh + spacing), fw, fh, 0, 0, fw, fh);
    out.push(cv);
  }
  return out;
}

// Parse ASCII art rows with a legend, e.g. rows ["..xx..", ".xLLx."], legend {x:"out", L:"p3"}
export function asciiToGrid(text, legend) {
  const rows = text.replace(/\r/g, "").split("\n").filter(l => l.length);
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  const grid = emptyGrid(w, h);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== "." && ch !== " " && legend[ch]) grid[y][x] = legend[ch]; }));
  return grid;
}

// Half-resolution copy: majority colour of every 2x2 block (ties -> top-left).
export function downscale(grid, w, h) {
  const W = Math.ceil(w / 2), H = Math.ceil(h / 2);
  const out = emptyGrid(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const counts = new Map();
    let first = null;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const xx = x * 2 + dx, yy = y * 2 + dy;
      if (xx >= w || yy >= h) continue;
      const k = grid[yy][xx];
      if (first === null && k != null) first = k;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    let best = null, bn = 0, painted = 0;
    for (const [k, n] of counts) { if (k != null) painted += n; if (k != null && n > bn) { best = k; bn = n; } }
    out[y][x] = painted >= 2 ? best : null;
  }
  return out;
}

// Merge colours used by fewer than minPixels cells into the nearest other colour.
export function simplify(grid, w, h, colorOf, minPixels) {
  const counts = {};
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = grid[y][x]; if (k != null) counts[k] = (counts[k] || 0) + 1; }
  const keys = Object.keys(counts);
  const rare = keys.filter(k => counts[k] < minPixels);
  const keep = keys.filter(k => counts[k] >= minPixels);
  if (!rare.length || !keep.length) return 0;
  const map = {};
  for (const k of rare) {
    const c = colorOf(k);
    let best = keep[0], bd = Infinity;
    for (const o of keep) { const d = colorOf(o); const dist = (c[0] - d[0]) ** 2 * 0.3 + (c[1] - d[1]) ** 2 * 0.59 + (c[2] - d[2]) ** 2 * 0.11; if (dist < bd) { bd = dist; best = o; } }
    map[k] = best;
  }
  let changed = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = grid[y][x]; if (k != null && map[k]) { grid[y][x] = map[k]; changed++; } }
  return changed;
}

// Build the 16 autotile frames from 5 drawn sources (centre, edge N, corner NE...) is complex;
// instead the editor keeps 16 frames and this helper only names them.
export const TILE_NAMES = ["none", "n", "e", "ne", "s", "ns", "se", "nse", "w", "nw", "we", "new", "sw", "nsw", "sew", "nsew"];
