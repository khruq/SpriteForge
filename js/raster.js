// SpriteForge - fast pixel rendering. A frame becomes one small canvas built with
// ImageData (one write per pixel), then it is drawn scaled with drawImage.
// Much faster than one fillRect per pixel, which matters for 128-256 px sprites.

const cache = new Map();
let rev = 0;
export function bumpRaster() { rev++; cache.clear(); }

function colorTable(project, palName) {
  const out = {};
  const pal = project.palettes[palName] || {};
  for (const [k, c] of Object.entries(project.palettes.base)) out[k] = pal[k] || c;
  for (const [k, c] of Object.entries(pal)) out[k] = c;
  return out;
}

// layerNames: which layers to draw, bottom to top order is the sprite's layer order
export function rasterFrame(project, sp, frame, palName, layerNames) {
  const w = sp.w, h = sp.h;
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d");
  const img = ctx.createImageData(w, h), d = img.data;
  const cols = colorTable(project, palName);
  const f = sp.frames[frame] || sp.frames[0];
  for (const L of sp.layers) {
    if (!layerNames.includes(L.name)) continue;
    const g = f.layers[L.name]; if (!g) continue;
    for (let y = 0; y < h; y++) {
      const row = g[y]; if (!row) continue;
      for (let x = 0; x < w; x++) {
        const k = row[x]; if (k == null) continue;
        const c = cols[k] || [255, 0, 255, 255];
        const i = (y * w + x) * 4, a = (c[3] ?? 255) / 255;
        if (a >= 1 || d[i + 3] === 0) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = Math.round(a * 255); continue; }
        const da = d[i + 3] / 255, oa = a + da * (1 - a);
        d[i] = (c[0] * a + d[i] * da * (1 - a)) / oa; d[i + 1] = (c[1] * a + d[i + 1] * da * (1 - a)) / oa; d[i + 2] = (c[2] * a + d[i + 2] * da * (1 - a)) / oa; d[i + 3] = oa * 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

export function cachedFrame(project, sp, frame, palName, layerNames) {
  const key = sp.name + "|" + frame + "|" + palName + "|" + layerNames.join(",") + "|" + rev;
  let c = cache.get(key);
  if (!c) { c = rasterFrame(project, sp, frame, palName, layerNames); if (cache.size > 200) cache.clear(); cache.set(key, c); }
  return c;
}

// draws a raster scaled; crisp when enlarging, smooth when shrinking
export function drawScaled(ctx, src, x, y, w, h) {
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = w < src.width;
  ctx.drawImage(src, x, y, w, h);
  ctx.imageSmoothingEnabled = prev;
}
