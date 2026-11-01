import { fitShapes, shapesError, forPixels } from "../js/shapes.js";
import { compileShape, mapShape } from "../js/vector.js";
const assert = (c, m) => { if (!c) { console.error("FAIL " + m); process.exit(1); } };

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
console.log("128x128 photo-like, 150 shapes:", Date.now() - t1 + "ms", "kept", br.shapes.length);

const q = compileShape({ t: "e", c: "a", x: 0, y: 0, w: 10, h: 4, r: 25 })[0];
assert(q.a === 2 && q.r === 25 && q.x === 5 && q.y === 2, "ellipse keeps its rotation");
assert(compileShape({ t: "r", c: "a", x: 0, y: 0, w: 2, h: 2 })[0].r === 0, "rotation defaults to 0");
const m = mapShape({ t: "r", c: "a", x: 1, y: 1, w: 4, h: 2, r: 30 }, x => 10 - x, y => y);
assert(m.r === -30 && m.x === 5, "mirror turns the other way");
const both = mapShape({ t: "r", c: "a", x: 1, y: 1, w: 4, h: 2, r: 30 }, x => 10 - x, y => 10 - y);
assert(both.r === 30, "flip both ways keeps the angle");
assert(mapShape({ t: "e", c: "a", x: 1, y: 1, w: 4, h: 2, r: 30 }, x => x * 2, y => y * 2).r === 30, "scale keeps the angle");
console.log("shapes OK");
