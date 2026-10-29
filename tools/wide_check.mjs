// Wide sprites (> 91 px): JS encode -> JS decode, and JS encode -> pix.lua decode must both give the input back.
import { encodeSprite, decodeRects, rasterize } from "../js/mesh.js";
import { execFileSync } from "child_process";
import fs from "fs"; import os from "os"; import path from "path";
let seed = 11; const rand = n => { seed = (seed * 48271) % 2147483647; return Math.floor(seed / 2147483647 * n); };
const W = 150, H = 120, keys = ["a", "b", "c", "d"];
const grid = [];
for (let y = 0; y < H; y++) { const row = []; for (let x = 0; x < W; x++) row.push(((x >> 3) + (y >> 4)) % 5 === 0 ? null : keys[(Math.floor(x / 11) + Math.floor(y / 7) + (rand(20) === 0 ? 1 : 0)) % 4]); grid.push(row); }
const e = encodeSprite(grid, W, H, () => 255);
if (e.z !== 2) throw new Error("expected wide form");
const back = rasterize(decodeRects(e.r, e.k, 2), W, H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (back[y][x] !== grid[y][x]) { console.log("JS MISMATCH", x, y); process.exit(1); }
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pfwide-"));
const q = s => '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
fs.writeFileSync(path.join(dir, "pixdata.lua"), `local D = {} D.P = { base = { a={1,1,1,255}, b={2,2,2,255}, c={3,3,3,255}, d={4,4,4,255} } }\nD.S = { w = {w=${W},h=${H},ax=0,ay=0,n=${e.count},k={${e.k.map(q).join(",")}},r=${q(e.r)},z=2} }\nD.A = {} D.C = {} D.B = {}\nreturn D\n`);
const expect = grid.map(r => r.map(c => c || ".").join("")).join("\n");
fs.writeFileSync(path.join(dir, "expect.txt"), expect);
fs.writeFileSync(path.join(dir, "run.lua"), `package.path = "${dir}/?.lua;${process.cwd()}/lua/?.lua;" .. package.path
game = {} Enum = { ImageSource = {} } Color = function() return {} end
local Px = require("pix")
local s = Px.get("w")
local g = {} for y = 1, ${H} do g[y] = {} for x = 1, ${W} do g[y][x] = "." end end
for _, r in ipairs(s.rects) do for y = r[2], r[2] + r[4] - 1 do for x = r[1], r[1] + r[3] - 1 do g[y + 1][x + 1] = r[5] end end end
local rows = {} for y = 1, ${H} do rows[y] = table.concat(g[y]) end
local f = io.open("${dir}/expect.txt") local want = f:read("a") f:close()
assert(table.concat(rows, "\\n") == want, "lua wide decode mismatch")
print("wide OK", #s.rects, "rects")`);
console.log(execFileSync("lua", [path.join(dir, "run.lua")]).toString().trim());
