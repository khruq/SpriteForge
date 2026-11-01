// SpriteForge - turns a picture into overlapping filled triangles, ellipses and rectangles.
// Every step tries thousands of small random shapes, grows and moves the best of several
// groups by small random changes and keeps the one that brings the drawing closest to the
// picture. Each shape gets the exact colour that fits it best; at the end the colours are
// grouped into the requested number of palette colours.
// A picture without transparent parts starts from one rectangle in its average colour.
// Transparent parts of the picture stay empty: covering one costs several times more than
// leaving a visible pixel uncovered, because nothing can clear it later. Shapes also stay
// inside the edges of the picture: the game shows every part of them.
// Sums along every row of the picture make the score of a shape cost one step per row.
//
// fitShapes(rgba, w, h, opts, onStep) -> { shapes, palette, placed }
//   rgba: Uint8ClampedArray of w*h pixels
//   opts: { count, colors, kinds (letters e, r, t: "e", "er", "t", "ert"...), soft, thr, seed, spill,
//           background, tries, climbers, maxFail, maxIter }
//   soft: a shape may also be half transparent (alpha SOFT) when that brings the drawing closer;
//   such shapes only blend over parts already covered, so the outline of the picture stays solid.
//   palette entries are [r, g, b] or [r, g, b, a] for half transparent shapes
//   shapes: [{ t: "e"|"r"|"t", c: palette index, x, y: centre, a, b: half width and height, r: degrees clockwise }]
//   placed: shapes laid before the ones hidden under later shapes were dropped;
//   fewer than opts.count means more shapes would no longer bring the drawing closer.
//   onStep(done, total, shapes): shapes so far as { t, x, y, a, b, r, col: [r, g, b], o: 1 solid | 0 half transparent }
//   A triangle fills its box like the built-in triangle image: the tip at the middle of the
//   top edge, the base along the bottom edge, then the whole box turns by r around its centre.

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

// corners of a triangle in picture coordinates: tip, right foot, left foot
export function triCorners(s) {
  const rad = s.r * Math.PI / 180, cs = Math.cos(rad), sn = Math.sin(rad);
  return [[0, -s.b], [s.a, s.b], [-s.a, s.b]].map(([lx, ly]) => [s.x + cs * lx - sn * ly, s.y + sn * lx + cs * ly]);
}

// Rows of the picture a shape covers: Y[k], and XA[k]..XB[k] = pixels whose centre lies inside.
// Returns the number of rows; spanOff = pixel centres of the shape beyond the edges of the picture.
let spanOff = 0;
function spans(s, w, h, Y, XA, XB) {
  let n = 0, off = 0;
  const row = (y, lo, hi) => {
    const a = Math.ceil(lo - 0.5), b = Math.floor(hi - 0.5);
    if (a > b) return;
    if (y < 0 || y >= h) { off += b - a + 1; return; }
    const xa = a < 0 ? 0 : a, xb = b >= w ? w - 1 : b;
    if (xa <= xb) { off += b - a - (xb - xa); Y[n] = y; XA[n] = xa; XB[n] = xb; n++; } else off += b - a + 1;
  };
  const rad = s.r * Math.PI / 180, cs = Math.cos(rad), sn = Math.sin(rad);
  if (s.t === "t") {
    const x0 = s.x + sn * s.b, y0 = s.y - cs * s.b;
    const x1 = s.x + cs * s.a - sn * s.b, y1 = s.y + sn * s.a + cs * s.b;
    const x2 = s.x - cs * s.a - sn * s.b, y2 = s.y - sn * s.a + cs * s.b;
    const ya = Math.ceil(Math.min(y0, y1, y2) - 0.5), yb = Math.floor(Math.max(y0, y1, y2) - 0.5);
    for (let y = ya; y <= yb; y++) {
      const yc = y + 0.5;
      let lo = Infinity, hi = -Infinity, x;
      if (y0 !== y1 && (yc - y0) * (yc - y1) <= 0) { x = x0 + (yc - y0) * (x1 - x0) / (y1 - y0); if (x < lo) lo = x; if (x > hi) hi = x; }
      if (y1 !== y2 && (yc - y1) * (yc - y2) <= 0) { x = x1 + (yc - y1) * (x2 - x1) / (y2 - y1); if (x < lo) lo = x; if (x > hi) hi = x; }
      if (y2 !== y0 && (yc - y2) * (yc - y0) <= 0) { x = x2 + (yc - y2) * (x0 - x2) / (y0 - y2); if (x < lo) lo = x; if (x > hi) hi = x; }
      if (lo <= hi) row(y, lo, hi);
    }
  } else if (s.t === "e") {
    const ia = 1 / (s.a * s.a), ib = 1 / (s.b * s.b);
    const A = cs * cs * ia + sn * sn * ib, Bk = 2 * cs * sn * (ia - ib), Ck = sn * sn * ia + cs * cs * ib, A2 = 2 * A;
    const ext = Math.sqrt(s.a * s.a * sn * sn + s.b * s.b * cs * cs);
    const ya = Math.ceil(s.y - ext - 0.5), yb = Math.floor(s.y + ext - 0.5);
    for (let y = ya; y <= yb; y++) {
      const dy = y + 0.5 - s.y, B = Bk * dy, D = B * B - 4 * A * (Ck * dy * dy - 1);
      if (D < 0) continue;
      const q = Math.sqrt(D);
      row(y, s.x + (-B - q) / A2, s.x + (-B + q) / A2);
    }
  } else {
    const ext = s.a * Math.abs(sn) + s.b * Math.abs(cs);
    const ya = Math.ceil(s.y - ext - 0.5), yb = Math.floor(s.y + ext - 0.5);
    const vc = Math.abs(cs) >= 1e-9, vs = Math.abs(sn) >= 1e-9;
    for (let y = ya; y <= yb; y++) {
      const dy = y + 0.5 - s.y;
      let lo = -Infinity, hi = Infinity;
      if (!vc) { if (Math.abs(sn * dy) > s.a) continue; }
      else { let p = (-s.a - sn * dy) / cs, q = (s.a - sn * dy) / cs; if (p > q) { const t = p; p = q; q = t; } if (p > lo) lo = p; if (q < hi) hi = q; }
      if (!vs) { if (Math.abs(cs * dy) > s.b) continue; }
      else { let p = (cs * dy - s.b) / sn, q = (cs * dy + s.b) / sn; if (p > q) { const t = p; p = q; q = t; } if (p > lo) lo = p; if (q < hi) hi = q; }
      if (lo <= hi) row(y, s.x + lo, s.x + hi);
    }
  }
  spanOff = off;
  return n;
}

// calls fn(y, xa, xb) for every row of the picture the shape covers; returns pixel centres beyond the edges
function eachRow(s, w, h, fn) {
  const m = Math.max(1, h), Y = new Int32Array(m), XA = new Int32Array(m), XB = new Int32Array(m);
  const n = spans(s, w, h, Y, XA, XB), off = spanOff;
  for (let k = 0; k < n; k++) fn(Y[k], XA[k], XB[k]);
  return off;
}

// pixel centres of a shape that lie beyond the edges of the picture
export function overhang(s, w, h) { return eachRow(s, w, h, () => {}); }

// calls fn(i) for every pixel whose centre lies inside the shape
export function forPixels(s, w, h, fn) {
  eachRow(s, w, h, (y, xa, xb) => { for (let i = y * w + xa, e = y * w + xb; i <= e; i++) fn(i); });
}

export const SOFT = 128;

// k-means on weighted colours, deterministic; returns the centres and the centre of every point
function cluster(points, weights, k, rnd) {
  const n = points.length;
  if (n <= k) return { centres: points.map(p => p.slice()), of: points.map((_, i) => i) };
  const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
  let first = 0, wmax = -1;
  for (let i = 0; i < n; i++) if (weights[i] > wmax) { wmax = weights[i]; first = i; }
  const centres = [points[first].slice()], dist = points.map(p => d2(p, centres[0]));
  while (centres.length < k) {
    let tot = 0;
    for (let i = 0; i < n; i++) tot += dist[i] * weights[i];
    if (tot <= 0) break;
    let v = rnd() * tot, pick = n - 1;
    for (let i = 0; i < n; i++) { v -= dist[i] * weights[i]; if (v <= 0) { pick = i; break; } }
    const c = points[pick].slice();
    centres.push(c);
    for (let i = 0; i < n; i++) dist[i] = Math.min(dist[i], d2(points[i], c));
  }
  const of = new Int32Array(n);
  for (let it = 0; it < 16; it++) {
    const sum = centres.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < n; i++) {
      let bi = 0, bd = Infinity;
      for (let c = 0; c < centres.length; c++) { const d = d2(points[i], centres[c]); if (d < bd) { bd = d; bi = c; } }
      of[i] = bi;
      const s = sum[bi], wt = weights[i];
      s[0] += points[i][0] * wt; s[1] += points[i][1] * wt; s[2] += points[i][2] * wt; s[3] += wt;
    }
    for (let c = 0; c < centres.length; c++) if (sum[c][3] > 0) centres[c] = [sum[c][0] / sum[c][3], sum[c][1] / sum[c][3], sum[c][2] / sum[c][3]];
  }
  return { centres, of: Array.from(of) };
}

export function fitShapes(rgba, w, h, opts = {}, onStep = null) {
  const n = w * h, thr = opts.thr ?? 128, count = Math.max(1, opts.count ?? 120), kinds = opts.kinds || "e";
  const tries = opts.tries ?? 300, climbers = opts.climbers ?? 16, maxFail = opts.maxFail ?? 100, maxIter = opts.maxIter ?? 1000;
  const soft = !!opts.soft, AL = SOFT / 255, K1 = 1 - AL, ncol = Math.max(1, Math.min(256, opts.colors ?? 64));
  const rnd = rng32(opts.seed ?? 7);
  const T = new Float32Array(n * 3), T2 = new Float32Array(n), mask = new Uint8Array(n);
  let inside = 0;
  for (let i = 0; i < n; i++) if (rgba[i * 4 + 3] >= thr) {
    mask[i] = 1; inside++;
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    T[i * 3] = r; T[i * 3 + 1] = g; T[i * 3 + 2] = b; T2[i] = r * r + g * g + b * b;
  }
  if (!inside) return { shapes: [], palette: [], placed: 0 };
  const PEN = opts.penalty ?? 3 * 110 * 110, OUT = PEN * (opts.spill ?? 10);
  const err = new Float64Array(n), top = new Int32Array(n).fill(-1), cdf = new Float64Array(n);
  const cur = new Float32Array(n * 3), cov = new Uint8Array(n);
  for (let i = 0; i < n; i++) err[i] = mask[i] ? PEN : 0;
  const big = Math.max(w, h), minR = 1, initMax = Math.max(2, opts.initMax ?? big / 8);
  const gauss = () => { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  // Running sums along every row. Fixed: visible pixels, picture colour and its square.
  // Changing: error, and for half transparent shapes the part of the picture a layer
  // still has to add over what is drawn (T - (1 - alpha) * drawn) and its square.
  const W1 = w + 1, PN = h * W1, RY = new Int32Array(h), RA = new Int32Array(h), RB = new Int32Array(h);
  const pM = new Float64Array(PN), pR = new Float64Array(PN), pG = new Float64Array(PN), pB = new Float64Array(PN), pQ = new Float64Array(PN);
  const pE = new Float64Array(PN), pC = new Float64Array(PN), pDR = new Float64Array(PN), pDG = new Float64Array(PN), pDB = new Float64Array(PN), pD2 = new Float64Array(PN);
  for (let y = 0; y < h; y++) {
    let m = 0, r = 0, g = 0, b = 0, q = 0;
    for (let x = 0; x < w; x++) {
      const i = y * w + x, o = y * W1 + x + 1;
      if (mask[i]) { m++; r += T[i * 3]; g += T[i * 3 + 1]; b += T[i * 3 + 2]; q += T2[i]; }
      pM[o] = m; pR[o] = r; pG[o] = g; pB[o] = b; pQ[o] = q;
    }
  }
  const rebuild = y => {
    let e = 0, c = 0, dr = 0, dg = 0, db = 0, d2 = 0;
    for (let x = 0; x < w; x++) {
      const i = y * w + x, o = y * W1 + x + 1;
      e += err[i];
      if (mask[i] && cov[i]) {
        const vr = T[i * 3] - K1 * cur[i * 3], vg = T[i * 3 + 1] - K1 * cur[i * 3 + 1], vb = T[i * 3 + 2] - K1 * cur[i * 3 + 2];
        c++; dr += vr; dg += vg; db += vb; d2 += vr * vr + vg * vg + vb * vb;
      }
      pE[o] = e; pC[o] = c; pDR[o] = dr; pDG[o] = dg; pDB[o] = db; pD2[o] = d2;
    }
  };
  for (let y = 0; y < h; y++) rebuild(y);

  // gain of a shape and its best colour: solid = mean of the picture under it,
  // half transparent = the colour that blends closest over what is already drawn
  const score = s => {
    let len = 0, cnt = 0, sr = 0, sg = 0, sb = 0, s2 = 0, old = 0, na = 0, ar = 0, ag = 0, ab = 0, a2 = 0;
    const rows = spans(s, w, h, RY, RA, RB), off = spanOff;
    for (let k = 0; k < rows; k++) {
      const base = RY[k] * W1, o0 = base + RA[k], o1 = base + RB[k] + 1;
      len += o1 - o0;
      old += pE[o1] - pE[o0];
      cnt += pM[o1] - pM[o0]; sr += pR[o1] - pR[o0]; sg += pG[o1] - pG[o0]; sb += pB[o1] - pB[o0]; s2 += pQ[o1] - pQ[o0];
      if (soft) { na += pC[o1] - pC[o0]; ar += pDR[o1] - pDR[o0]; ag += pDG[o1] - pDG[o0]; ab += pDB[o1] - pDB[o0]; a2 += pD2[o1] - pD2[o0]; }
    }
    if (!cnt) return { gain: -Infinity, col: null, o: 1 };
    const out = len - cnt + off, bare = cnt - na;
    let best = { gain: old - (s2 - (sr * sr + sg * sg + sb * sb) / cnt + out * OUT), col: [sr / cnt, sg / cnt, sb / cnt], o: 1 };
    if (na > 0.5) {
      const k = 1 / (na * AL), q0 = clamp(ar * k, 0, 255), q1 = clamp(ag * k, 0, 255), q2 = clamp(ab * k, 0, 255);
      const afterA = a2 - 2 * AL * (q0 * ar + q1 * ag + q2 * ab) + na * AL * AL * (q0 * q0 + q1 * q1 + q2 * q2) + (bare + out) * OUT;
      if (old - afterA > best.gain) best = { gain: old - afterA, col: [q0, q1, q2], o: 0 };
    }
    return best;
  };

  let total = 0;
  const buildCdf = () => { total = 0; for (let i = 0; i < n; i++) { total += (mask[i] ? err[i] : 0) + 1; cdf[i] = total; } };
  const pick = () => {
    const v = rnd() * total;
    let lo = 0, hi = n - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < v) lo = m + 1; else hi = m; }
    return lo;
  };
  // new shapes start small where the drawing is worst and grow while they help
  const randomShape = t => {
    const i = pick();
    return { t, x: (i % w) + rnd(), y: Math.floor(i / w) + rnd(), a: minR + rnd() * (initMax - minR), b: minR + rnd() * (initMax - minR),
      r: t === "t" ? rnd() * 360 : t === "r" && rnd() < 0.5 ? 0 : rnd() * 180 };
  };
  const mutate = s => {
    const m = { ...s }, k = Math.floor(rnd() * 4);
    const sc = rnd() < 0.5 ? Math.max(0.5, (s.a + s.b) * 0.2) : big / 16;
    if (k === 0) { m.x = clamp(m.x + gauss() * sc, 0, w); m.y = clamp(m.y + gauss() * sc, 0, h); }
    else if (k === 1) m.a = clamp(m.a + gauss() * sc, minR, big);
    else if (k === 2) m.b = clamp(m.b + gauss() * sc, minR, big);
    else if (s.t === "t" && rnd() < 0.1) m.r = m.r + 180;
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

  const shapes = [], RY2 = new Int32Array(h), RA2 = new Int32Array(h), RB2 = new Int32Array(h);
  const lay = (s, col, o) => {
    const idx = shapes.length, rows = spans(s, w, h, RY2, RA2, RB2);
    for (let k = 0; k < rows; k++) {
      for (let i = RY2[k] * w + RA2[k], e = RY2[k] * w + RB2[k]; i <= e; i++) {
        if (o) {
          top[i] = idx; cov[i] = 1;
          cur[i * 3] = col[0]; cur[i * 3 + 1] = col[1]; cur[i * 3 + 2] = col[2];
          err[i] = mask[i] ? (T[i * 3] - col[0]) ** 2 + (T[i * 3 + 1] - col[1]) ** 2 + (T[i * 3 + 2] - col[2]) ** 2 : OUT;
        } else if (!mask[i] || !cov[i]) err[i] = OUT;
        else {
          for (let c = 0; c < 3; c++) cur[i * 3 + c] = AL * col[c] + K1 * cur[i * 3 + c];
          err[i] = (T[i * 3] - cur[i * 3]) ** 2 + (T[i * 3 + 1] - cur[i * 3 + 1]) ** 2 + (T[i * 3 + 2] - cur[i * 3 + 2]) ** 2;
        }
      }
      rebuild(RY2[k]);
    }
    shapes.push({ t: s.t, x: s.x, y: s.y, a: s.a, b: s.b, r: s.r, col, o });
    if (onStep) onStep(shapes.length, count, shapes);
  };

  // a picture without transparent parts starts from one rectangle under everything, in its average colour
  if ((opts.background ?? true) && inside >= n * 0.995) {
    let sr = 0, sg = 0, sb = 0;
    for (let i = 0; i < n; i++) if (mask[i]) { sr += T[i * 3]; sg += T[i * 3 + 1]; sb += T[i * 3 + 2]; }
    lay({ t: "r", x: w / 2, y: h / 2, a: w / 2, b: h / 2, r: 0 }, [sr / inside, sg / inside, sb / inside], 1);
  }
  while (shapes.length < count) {
    buildCdf();
    let best = null, bestSc = { gain: 0 };
    // several groups: the best of many random shapes in each group is grown and moved, the best result wins
    for (let j = 0; j < climbers; j++) {
      let bs = null, bsc = { gain: -Infinity };
      for (let q = 0; q < tries; q++) {
        const s = randomShape(kinds[Math.floor(rnd() * kinds.length)]), sc = score(s);
        if (sc.gain > bsc.gain) { bs = s; bsc = sc; }
      }
      if (!bs || bsc.gain === -Infinity) continue;
      const [s, sc] = climb(bs, bsc);
      if (sc.gain > bestSc.gain) { best = s; bestSc = sc; }
    }
    if (!best || bestSc.gain < 1) break;
    lay(best, bestSc.col, bestSc.o);
  }

  const angle = s => {
    let r;
    if (s.t === "t") { r = ((s.r % 360) + 360) % 360; if (r > 180) r -= 360; }
    else { r = ((s.r % 180) + 180) % 180; if (r > 90) r -= 180; }
    return r;
  };
  // how much of every shape stays visible; without soft blending a solid shape also takes the mean colour of what shows
  const seen = new Float64Array(shapes.length), vis = shapes.map(() => [0, 0, 0, 0]);
  shapes.forEach((s, k) => forPixels(s, w, h, i => {
    if (s.o ? top[i] !== k : top[i] > k) return;
    seen[k]++;
    if (s.o && mask[i]) { const v = vis[k]; v[0] += T[i * 3]; v[1] += T[i * 3 + 1]; v[2] += T[i * 3 + 2]; v[3]++; }
  }));
  const kept = [];
  shapes.forEach((s, k) => {
    if (!seen[k]) return;
    const v = vis[k], col = !soft && v[3] ? [v[0] / v[3], v[1] / v[3], v[2] / v[3]] : s.col;
    kept.push({ s, col, wt: seen[k] });
  });
  // the editor keeps colours in a palette: group the shape colours into the requested number
  const { centres, of } = cluster(kept.map(k => k.col), kept.map(k => k.wt), ncol, rnd);
  const key = new Map(), palette = [], out = [];
  kept.forEach((k, j) => {
    const id = of[j] * 2 + (k.s.o ? 0 : 1);
    if (!key.has(id)) {
      const c = centres[of[j]].map(v => Math.round(clamp(v, 0, 255)));
      key.set(id, palette.length);
      palette.push(k.s.o ? c : [c[0], c[1], c[2], SOFT]);
    }
    out.push({ t: k.s.t, c: key.get(id), x: k.s.x, y: k.s.y, a: k.s.a, b: k.s.b, r: angle(k.s) });
  });
  return { shapes: out, palette, placed: shapes.length };
}

// error of a finished set of shapes against the picture, 0 = identical (used by tests).
// A pixel counts as covered once a solid shape lies on it; half transparent shapes blend on top.
// Anything drawn outside the picture counts as a miss, like a visible pixel left empty.
export function shapesError(rgba, w, h, shapes, palette, thr = 128, penalty = 3 * 110 * 110) {
  const n = w * h, cur = new Float32Array(n * 3), solid = new Uint8Array(n), any = new Uint8Array(n);
  for (const s of shapes) {
    const p = palette[s.c], a = (p[3] ?? 255) / 255;
    forPixels(s, w, h, i => {
      any[i] = 1;
      if (a >= 1) { solid[i] = 1; cur[i * 3] = p[0]; cur[i * 3 + 1] = p[1]; cur[i * 3 + 2] = p[2]; return; }
      for (let c = 0; c < 3; c++) cur[i * 3 + c] = a * p[c] + (1 - a) * cur[i * 3 + c];
    });
  }
  let e = 0;
  for (let i = 0; i < n; i++) {
    const m = rgba[i * 4 + 3] >= thr;
    if (!m) { if (any[i]) e += penalty; }
    else if (!solid[i]) e += penalty;
    else e += (rgba[i * 4] - cur[i * 3]) ** 2 + (rgba[i * 4 + 1] - cur[i * 3 + 1]) ** 2 + (rgba[i * 4 + 2] - cur[i * 3 + 2]) ** 2;
  }
  return e / n;
}
