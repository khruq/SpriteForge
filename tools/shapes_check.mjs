import { fitShapes, shapesError, forPixels, triCorners, overhang, SOFT } from "../js/shapes.js";
import { compileShape, mapShape, primHit } from "../js/vector.js";
const assert = (c, m) => { if (!c) { console.error("FAIL " + m); process.exit(1); } };
const R1 = v => Math.round(v * 10) / 10;

function picture(w, h) {
  const d = new Uint8ClampedArray(w * h * 4);
  const put = (s, rgb) => forPixels(s, w, h, i => { d[i * 4] = rgb[0]; d[i * 4 + 1] = rgb[1]; d[i * 4 + 2] = rgb[2]; d[i * 4 + 3] = 255; });
  put({ t: "e", x: 30, y: 32, a: 20, b: 20, r: 0 }, [220, 50, 60]);
  put({ t: "r", x: 70, y: 30, a: 15, b: 6, r: 30 }, [40, 90, 220]);
  put({ t: "e", x: 30, y: 26, a: 8, b: 4, r: -20 }, [250, 240, 120]);
  return d;
}

const w = 96, h = 64, img = picture(w, h);
let inside = 0; for (let i = 0; i < w * h; i++) if (img[i * 4 + 3]) inside++;
const empty = inside * 3 * 110 * 110 / (w * h);
const t0 = Date.now(); let steps = 0;
const res = fitShapes(img, w, h, { count: 30, colors: 6, kinds: "er", seed: 3 }, () => steps++);
const ms = Date.now() - t0;
const e = shapesError(img, w, h, res.shapes, res.palette);
console.log("shapes", res.shapes.length, "steps", steps, "palette", res.palette.length, "error", e.toFixed(1), "of", empty.toFixed(1), ms + "ms");
assert(res.shapes.length >= 3 && res.shapes.length <= 30, "shape count");
assert(e < empty * 0.06, "error drops below 6% of an empty drawing");
assert(res.shapes.every(s => s.r > -90.0001 && s.r <= 90 && s.a >= 1 && s.b >= 1), "angles and sizes in range");
assert(JSON.stringify(fitShapes(img, w, h, { count: 30, colors: 6, kinds: "er", seed: 3 })) === JSON.stringify(res), "same seed, same result");
assert(fitShapes(new Uint8ClampedArray(w * h * 4), w, h, { count: 10 }).shapes.length === 0, "empty picture gives no shapes");

const ell = fitShapes(img, w, h, { count: 12, colors: 4, kinds: "e", seed: 1 }).shapes;
assert(ell.every(s => s.t === "e"), "ellipses only");
const rec = fitShapes(img, w, h, { count: 12, colors: 4, kinds: "r", seed: 1 }).shapes;
assert(rec.every(s => s.t === "r"), "rectangles only");

const big = 128, bimg = new Uint8ClampedArray(big * big * 4);
for (let y = 0; y < big; y++) for (let x = 0; x < big; x++) { const i = (y * big + x) * 4; bimg[i] = x * 2; bimg[i + 1] = y * 2; bimg[i + 2] = (x + y) & 255; bimg[i + 3] = 255; }
const t1 = Date.now(); const br = fitShapes(bimg, big, big, { count: 150, colors: 16, kinds: "er", seed: 5 });
const stick = br.shapes.reduce((a, s) => a + overhang(s, big, big), 0);
console.log("128x128 photo-like, 150 shapes:", Date.now() - t1 + "ms", "kept", br.shapes.length, "pixels beyond the edges", stick);
assert(stick <= 20, "shapes stay inside the edges of the picture");
assert(overhang({ t: "r", x: 2, y: 10, a: 4, b: 2, r: 0 }, big, big) === 8 && overhang({ t: "t", x: 64, y: 64, a: 10, b: 10, r: 45 }, big, big) === 0, "overhang counts pixel centres beyond the edges");

const q = compileShape({ t: "e", c: "a", x: 0, y: 0, w: 10, h: 4, r: 25 })[0];
assert(q.a === 2 && q.r === 25 && q.x === 5 && q.y === 2, "ellipse keeps its rotation");
assert(compileShape({ t: "r", c: "a", x: 0, y: 0, w: 2, h: 2 })[0].r === 0, "rotation defaults to 0");
const m = mapShape({ t: "r", c: "a", x: 1, y: 1, w: 4, h: 2, r: 30 }, x => 10 - x, y => y);
assert(m.r === -30 && m.x === 5, "mirror turns the other way");
const both = mapShape({ t: "r", c: "a", x: 1, y: 1, w: 4, h: 2, r: 30 }, x => 10 - x, y => 10 - y);
assert(both.r === 30, "flip both ways keeps the angle");
assert(mapShape({ t: "e", c: "a", x: 1, y: 1, w: 4, h: 2, r: 30 }, x => x * 2, y => y * 2).r === 30, "scale keeps the angle");

// triangles: rows filled by the fitter = pixel centres inside the three corners
const rand = (() => { let a = 12345; return () => { a = (a * 1103515245 + 12345) % 2147483648; return a / 2147483648; }; })();
const inTri = (V, px, py) => {
  const d = (P, Q) => (Q[0] - P[0]) * (py - P[1]) - (Q[1] - P[1]) * (px - P[0]);
  const a = d(V[0], V[1]), b = d(V[1], V[2]), c = d(V[2], V[0]);
  return (a >= 0 && b >= 0 && c >= 0) || (a <= 0 && b <= 0 && c <= 0);
};
let triBad = 0, hitBad = 0, triPx = 0;
for (let k = 0; k < 300; k++) {
  const s = { t: "t", x: R1(10 + rand() * 60), y: R1(8 + rand() * 40), a: R1(1 + rand() * 25), b: R1(1 + rand() * 20), r: R1(rand() * 360 - 180) };
  const V = triCorners(s), got = new Set();
  forPixels(s, w, h, i => got.add(i));
  const q = compileShape({ t: "t", c: "a", x: s.x - s.a, y: s.y - s.b, w: 2 * s.a, h: 2 * s.b, r: s.r })[0];
  for (let i = 0; i < w * h; i++) {
    const px = (i % w) + 0.5, py = Math.floor(i / w) + 0.5;
    if (inTri(V, px, py) !== got.has(i)) triBad++;
    if (primHit(q, px, py) !== got.has(i)) hitBad++;
  }
  triPx += got.size;
}
console.log("triangle pixels", triPx, "mismatches", triBad, "editor hit mismatches", hitBad);
assert(triBad <= triPx * 0.0005, "triangle rows match the corners");
assert(hitBad <= triPx * 0.002, "editor hit test matches the fitted triangle");
const sq = triCorners({ x: 10, y: 10, a: 4, b: 3, r: 0 });
assert(sq[0][0] === 10 && sq[0][1] === 7 && sq[1][0] === 14 && sq[1][1] === 13 && sq[2][0] === 6, "tip on top, base at the bottom");

const tri = fitShapes(img, w, h, { count: 20, colors: 4, kinds: "t", seed: 2 });
assert(tri.shapes.length > 3 && tri.shapes.every(s => s.t === "t" && s.r > -180.0001 && s.r <= 180), "triangles only, angle in (-180, 180]");
const mix = fitShapes(img, w, h, { count: 30, colors: 6, kinds: "ert", seed: 4 });
assert(shapesError(img, w, h, mix.shapes, mix.palette) < empty * 0.08, "all three kinds fit");

// soft: half transparent shapes only where something solid lies below
const soft = fitShapes(bimg, big, big, { count: 150, colors: 16, kinds: "et", soft: true, seed: 5 });
const solid = fitShapes(bimg, big, big, { count: 150, colors: 16, kinds: "et", seed: 5 });
const eSoft = shapesError(bimg, big, big, soft.shapes, soft.palette), eSolid = shapesError(bimg, big, big, solid.shapes, solid.palette);
const halves = soft.shapes.filter(s => soft.palette[s.c][3] === SOFT).length;
console.log("soft", eSoft.toFixed(1), "solid", eSolid.toFixed(1), "half transparent shapes", halves, "palette", soft.palette.length);
assert(halves > 0 && soft.palette.every(p => p.length === 3 || p[3] === SOFT), "soft palette has half transparent colours");
assert(soft.shapes.every(s => s.c >= 0 && s.c < soft.palette.length), "soft colour indices valid");
assert(eSoft < eSolid, "soft blending brings the drawing closer");
assert(JSON.stringify(fitShapes(bimg, big, big, { count: 150, colors: 16, kinds: "et", soft: true, seed: 5 })) === JSON.stringify(soft), "soft: same seed, same result");
assert(soft.placed >= soft.shapes.length && solid.placed >= solid.shapes.length, "placed counts every laid shape");
const first = soft.shapes.find(s => soft.palette[s.c].length === 3);
assert(first && soft.shapes.indexOf(first) === 0, "the first shape is solid");
const ring = new Uint8ClampedArray(w * h * 4);
forPixels({ t: "e", x: 48, y: 32, a: 20, b: 20, r: 0 }, w, h, i => { ring[i * 4] = 200; ring[i * 4 + 1] = 120; ring[i * 4 + 2] = 40; ring[i * 4 + 3] = 255; });
const rs = fitShapes(ring, w, h, { count: 40, colors: 4, kinds: "et", soft: true, seed: 9 });
let spill = 0; const cover = new Uint8Array(w * h);
for (const s of rs.shapes) forPixels(s, w, h, i => { cover[i] = 1; });
for (let i = 0; i < w * h; i++) if (cover[i] && !ring[i * 4 + 3]) spill++;
assert(spill < 40, "soft shapes stay inside the picture");

// triangles flip like the picture: the corners of the mapped shape are the mirrored corners
const corners = v => triCorners({ x: v.x + v.w / 2, y: v.y + v.h / 2, a: v.w / 2, b: v.h / 2, r: v.r || 0 });
const same = (A, B) => A.every(p => B.some(q => Math.abs(p[0] - q[0]) < 0.15 && Math.abs(p[1] - q[1]) < 0.15));
for (const [fx, fy, label] of [[x => 64 - x, y => y, "mirror"], [x => x, y => 64 - y, "flip"], [x => 64 - x, y => 64 - y, "both"], [x => x * 2, y => y * 2, "scale"]]) {
  for (const r0 of [0, 35, -120, 180, 90]) {
    const v = { t: "t", c: "a", x: 10, y: 6, w: 12, h: 9, r: r0 };
    const want = corners(v).map(([x, y]) => [fx(x), fy(y)]);
    const m2 = mapShape(JSON.parse(JSON.stringify(v)), fx, fy);
    assert(same(want, corners(m2)), "triangle " + label + " r=" + r0);
    assert(m2.r === undefined || (m2.r > -180 && m2.r <= 180), "triangle angle stays in range");
  }
}
console.log("shapes OK");
