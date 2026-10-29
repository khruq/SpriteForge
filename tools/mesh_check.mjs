import { encodeSprite, decodeRects, rasterize } from "../js/mesh.js";
// random grids: encode -> decode -> rasterize must equal the input
let seed = 7; const rand = n => { seed = (seed * 48271) % 2147483647; return Math.floor(seed / 2147483647 * n); };
let total = 0, worst = 0;
for (let t = 0; t < 200; t++) {
  const W = 4 + rand(28), H = 4 + rand(28), keys = ["a", "b", "c", "d", "e", "t1"];
  const grid = [];
  for (let y = 0; y < H; y++) { const row = []; for (let x = 0; x < W; x++) row.push(rand(10) < 3 ? null : keys[rand(keys.length)]); grid.push(row); }
  const e = encodeSprite(grid, W, H, k => k === "t1" ? 128 : 255);
  const back = rasterize(decodeRects(e.r, e.k), W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (back[y][x] !== grid[y][x]) { console.log("MISMATCH", t, x, y); process.exit(1); }
  total += e.count; worst = Math.max(worst, e.count / (W * H));
}
console.log("mesh ok, avg rects", (total / 200).toFixed(1), "worst ratio", worst.toFixed(2));
