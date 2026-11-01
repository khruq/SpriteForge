// SpriteForge - turns a picture into overlapping filled ellipses and rectangles.
// Every step tries many random shapes, improves the best few by small random
// changes and keeps the one that brings the drawing closest to the picture.
// Transparent parts of the picture stay empty: covering one costs several times
// more than leaving a visible pixel uncovered, because nothing can clear it later.
//
// fitShapes(rgba, w, h, opts, onStep) -> { shapes, palette }
//   rgba: Uint8ClampedArray of w*h pixels
//   opts: { count, colors, kinds ("e", "r" or "er"), thr, seed, spill, tries, climbers }
//   shapes: [{ t: "e"|"r", c: palette index, x, y: centre, a, b: half width and height, r: degrees clockwise }]

function rng32(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makePalette(T, mask, n, k, rnd) {
  const idx = [];
  for (let i = 0; i < n; i++) if (mask[i]) idx.push(i);
  const step = Math.max(1, Math.floor(idx.length / 6000));
  const pts = [];
  for (let j = 0; j < idx.length; j += step) { const i = idx[j]; pts.push([T[i * 3], T[i * 3 + 1], T[i * 3 + 2]]); }
  let boxes = [pts];
  const span = b => {
    const mn = [255, 255, 255], mx = [0, 0, 0];
    for (const p of b) for (let c = 0; c < 3; c++) { if (p[c] < mn[c]) mn[c] = p[c]; if (p[c] > mx[c]) mx[c] = p[c]; }
    const s = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]], ax = s.indexOf(Math.max(...s));
    return [ax, s[ax]];
  };
  while (boxes.length < k) {
    let bi = -1, bs = 0;
    boxes.forEach((b, i) => { if (b.length > 1) { const sp = span(b)[1]; if (sp < 12) return; const s = sp * Math.sqrt(b.length); if (s > bs) { bs = s; bi = i; } } });
    if (bi < 0) break;
    const b = boxes[bi], ax = span(b)[0];
    b.sort((p, q) => p[ax] - q[ax]);
    const mid = b.length >> 1;
    boxes.splice(bi, 1, b.slice(0, mid), b.slice(mid));
  }
  let cs = boxes.filter(b => b.length).map(b => { const s = [0, 0, 0]; for (const p of b) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; } return s.map(v => v / b.length); });
  for (let it = 0; it < 8; it++) {
    const sum = cs.map(() => [0, 0, 0, 0]);
    for (const p of pts) {
      let bi = 0, bd = Infinity;
      for (let c = 0; c < cs.length; c++) { const q = cs[c], d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2; if (d < bd) { bd = d; bi = c; } }
      const s = sum[bi]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++;
    }
    cs = cs.map((c, i) => sum[i][3] ? [sum[i][0] / sum[i][3], sum[i][1] / sum[i][3], sum[i][2] / sum[i][3]] : c);
  }
  const out = [];
  for (const c of cs) { const r = c.map(Math.round); if (!out.some(o => o[0] === r[0] && o[1] === r[1] && o[2] === r[2])) out.push(r); }
  out.sort((p, q) => (p[0] * 0.3 + p[1] * 0.59 + p[2] * 0.11) - (q[0] * 0.3 + q[1] * 0.59 + q[2] * 0.11));
  return out;
}

// x range covered by a shape on the row whose centre is at height yc, relative to the shape centre
function span(s, cs, sn, dy) {
  if (s.t === "e") {
    const ia = 1 / (s.a * s.a), ib = 1 / (s.b * s.b);
    const A = cs * cs * ia + sn * sn * ib, B = 2 * dy * cs * sn * (ia - ib), C = dy * dy * (sn * sn * ia + cs * cs * ib) - 1;
    const D = B * B - 4 * A * C;
    if (D < 0) return null;
    const q = Math.sqrt(D);
    return [(-B - q) / (2 * A), (-B + q) / (2 * A)];
  }
  let lo = -Infinity, hi = Infinity;
  if (Math.abs(cs) < 1e-9) { if (Math.abs(sn * dy) > s.a) return null; }
  else { let p = (-s.a - sn * dy) / cs, q = (s.a - sn * dy) / cs; if (p > q) [p, q] = [q, p]; lo = Math.max(lo, p); hi = Math.min(hi, q); }
  if (Math.abs(sn) < 1e-9) { if (Math.abs(cs * dy) > s.b) return null; }
  else { let p = (cs * dy - s.b) / sn, q = (cs * dy + s.b) / sn; if (p > q) [p, q] = [q, p]; lo = Math.max(lo, p); hi = Math.min(hi, q); }
  return lo > hi ? null : [lo, hi];
}

// calls fn(i) for every pixel whose centre lies inside the shape
export function forPixels(s, w, h, fn) {
  const rad = s.r * Math.PI / 180, cs = Math.cos(rad), sn = Math.sin(rad);
  const ext = s.t === "e" ? Math.sqrt(s.a * s.a * sn * sn + s.b * s.b * cs * cs) : s.a * Math.abs(sn) + s.b * Math.abs(cs);
  const y0 = Math.max(0, Math.ceil(s.y - ext - 0.5)), y1 = Math.min(h - 1, Math.floor(s.y + ext - 0.5));
  for (let y = y0; y <= y1; y++) {
    const sp = span(s, cs, sn, y + 0.5 - s.y);
    if (!sp) continue;
    const xa = Math.max(0, Math.ceil(s.x + sp[0] - 0.5)), xb = Math.min(w - 1, Math.floor(s.x + sp[1] - 0.5));
    for (let x = xa, i = y * w + xa; x <= xb; x++, i++) fn(i);
  }
}

export function fitShapes(rgba, w, h, opts = {}, onStep = null) {
  const n = w * h, thr = opts.thr ?? 128, count = Math.max(1, opts.count ?? 120), kinds = opts.kinds || "e";
  const tries = opts.tries ?? 100, climbers = opts.climbers ?? 3, maxFail = opts.maxFail ?? 150, maxIter = opts.maxIter ?? 600;
  const rnd = rng32(opts.seed ?? 7);
  const T = new Float32Array(n * 3), T2 = new Float32Array(n), mask = new Uint8Array(n);
  let inside = 0;
  for (let i = 0; i < n; i++) if (rgba[i * 4 + 3] >= thr) {
    mask[i] = 1; inside++;
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    T[i * 3] = r; T[i * 3 + 1] = g; T[i * 3 + 2] = b; T2[i] = r * r + g * g + b * b;
  }
  if (!inside) return { shapes: [], palette: [] };
  const pal = makePalette(T, mask, n, Math.max(1, Math.min(64, opts.colors ?? 16)), rnd);
  const PEN = opts.penalty ?? 3 * 110 * 110, OUT = PEN * (opts.spill ?? 10);
  const err = new Float64Array(n), top = new Int32Array(n).fill(-1), cdf = new Float64Array(n);
  for (let i = 0; i < n; i++) err[i] = mask[i] ? PEN : 0;
  const big = Math.max(w, h), minR = 1;
  const gauss = () => { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  const score = s => {
    const rad = s.r * Math.PI / 180, cs = Math.cos(rad), sn = Math.sin(rad);
    const ext = s.t === "e" ? Math.sqrt(s.a * s.a * sn * sn + s.b * s.b * cs * cs) : s.a * Math.abs(sn) + s.b * Math.abs(cs);
    const y0 = Math.max(0, Math.ceil(s.y - ext - 0.5)), y1 = Math.min(h - 1, Math.floor(s.y + ext - 0.5));
    let cnt = 0, out = 0, sr = 0, sg = 0, sb = 0, s2 = 0, old = 0;
    for (let y = y0; y <= y1; y++) {
      const sp = span(s, cs, sn, y + 0.5 - s.y);
      if (!sp) continue;
      const xa = Math.max(0, Math.ceil(s.x + sp[0] - 0.5)), xb = Math.min(w - 1, Math.floor(s.x + sp[1] - 0.5));
      for (let i = y * w + xa, e = y * w + xb; i <= e; i++) {
        old += err[i];
        if (mask[i]) { cnt++; sr += T[i * 3]; sg += T[i * 3 + 1]; sb += T[i * 3 + 2]; s2 += T2[i]; } else out++;
      }
    }
    if (!cnt) return { gain: -Infinity, c: 0 };
    const mr = sr / cnt, mg = sg / cnt, mb = sb / cnt;
    let c = 0, bd = Infinity;
    for (let k = 0; k < pal.length; k++) { const p = pal[k], d = (p[0] - mr) ** 2 + (p[1] - mg) ** 2 + (p[2] - mb) ** 2; if (d < bd) { bd = d; c = k; } }
    const p = pal[c];
    const after = s2 - 2 * (p[0] * sr + p[1] * sg + p[2] * sb) + cnt * (p[0] * p[0] + p[1] * p[1] + p[2] * p[2]) + out * OUT;
    return { gain: old - after, c };
  };

  let total = 0;
  const buildCdf = () => { total = 0; for (let i = 0; i < n; i++) { total += (mask[i] ? err[i] : 0) + 1; cdf[i] = total; } };
  const pick = () => {
    const v = rnd() * total;
    let lo = 0, hi = n - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < v) lo = m + 1; else hi = m; }
    return lo;
  };
  const logR = () => Math.exp(Math.log(minR) + rnd() * (Math.log(big / 2) - Math.log(minR)));
  const randomShape = t => {
    const i = pick();
    return { t, x: (i % w) + rnd(), y: Math.floor(i / w) + rnd(), a: logR(), b: logR(), r: t === "r" && rnd() < 0.5 ? 0 : rnd() * 180 };
  };
  const mutate = s => {
    const m = { ...s }, k = Math.floor(rnd() * 4);
    const sc = rnd() < 0.5 ? Math.max(0.5, (s.a + s.b) * 0.2) : big / 16;
    if (k === 0) { m.x = clamp(m.x + gauss() * sc, 0, w); m.y = clamp(m.y + gauss() * sc, 0, h); }
    else if (k === 1) m.a = clamp(m.a + gauss() * sc, minR, big);
    else if (k === 2) m.b = clamp(m.b + gauss() * sc, minR, big);
    else m.r = rnd() < 0.15 ? Math.round(m.r / 90) * 90 : m.r + gauss() * 18;
    return m;
  };
  const climb = (s, sc) => {
    let fails = 0;
    for (let it = 0; it < maxIter && fails < maxFail; it++) {
      const m = mutate(s), ms = score(m);
      if (ms.gain > sc.gain) { s = m; sc = ms; fails = 0; } else fails++;
    }
    return [s, sc];
  };

  const shapes = [];
  for (let step = 0; step < count; step++) {
    buildCdf();
    const cands = [];
    for (let j = 0; j < tries; j++) { const s = randomShape(kinds[Math.floor(rnd() * kinds.length)]); cands.push([s, score(s)]); }
    cands.sort((p, q) => q[1].gain - p[1].gain);
    let best = null, bestSc = { gain: 0, c: 0 };
    for (let j = 0; j < Math.min(climbers, cands.length); j++) {
      const [s, sc] = climb(cands[j][0], cands[j][1]);
      if (sc.gain > bestSc.gain) { best = s; bestSc = sc; }
    }
    if (!best || bestSc.gain < 1) break;
    const p = pal[bestSc.c], idx = shapes.length;
    forPixels(best, w, h, i => {
      top[i] = idx;
      err[i] = mask[i] ? (T[i * 3] - p[0]) ** 2 + (T[i * 3 + 1] - p[1]) ** 2 + (T[i * 3 + 2] - p[2]) ** 2 : OUT;
    });
    shapes.push({ ...best, c: bestSc.c });
    if (onStep) onStep(shapes.length, count, shapes, pal);
  }

  // recolour every shape from the part that stays visible, drop shapes nothing shows of
  const sums = shapes.map(() => [0, 0, 0, 0, 0]);
  for (let i = 0; i < n; i++) { const k = top[i]; if (k < 0) continue; const s = sums[k]; s[4]++; if (mask[i]) { s[0] += T[i * 3]; s[1] += T[i * 3 + 1]; s[2] += T[i * 3 + 2]; s[3]++; } }
  const kept = [];
  shapes.forEach((s, k) => {
    const v = sums[k];
    if (!v[4]) return;
    if (v[3]) {
      const mr = v[0] / v[3], mg = v[1] / v[3], mb = v[2] / v[3];
      let c = s.c, bd = Infinity;
      for (let q = 0; q < pal.length; q++) { const p = pal[q], d = (p[0] - mr) ** 2 + (p[1] - mg) ** 2 + (p[2] - mb) ** 2; if (d < bd) { bd = d; c = q; } }
      s.c = c;
    }
    let r = ((s.r % 180) + 180) % 180;
    if (r > 90) r -= 180;
    kept.push({ t: s.t, c: s.c, x: s.x, y: s.y, a: s.a, b: s.b, r });
  });
  const used = [...new Set(kept.map(s => s.c))].sort((p, q) => p - q), at = new Map(used.map((c, i) => [c, i]));
  for (const s of kept) s.c = at.get(s.c);
  return { shapes: kept, palette: used.map(c => pal[c]) };
}

// error of a finished set of shapes against the picture, 0 = identical (used by tests)
export function shapesError(rgba, w, h, shapes, palette, thr = 128, penalty = 3 * 110 * 110) {
  const n = w * h, col = new Int32Array(n).fill(-1);
  for (const s of shapes) forPixels(s, w, h, i => { col[i] = s.c; });
  let e = 0;
  for (let i = 0; i < n; i++) {
    const m = rgba[i * 4 + 3] >= thr, c = col[i];
    if (c < 0) e += m ? penalty : 0;
    else if (!m) e += penalty;
    else { const p = palette[c]; e += (rgba[i * 4] - p[0]) ** 2 + (rgba[i * 4 + 1] - p[1]) ** 2 + (rgba[i * 4 + 2] - p[2]) ** 2; }
  }
  return e / n;
}
