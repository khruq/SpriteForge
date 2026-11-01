// Vector sprites: the Lua runtime must place every primitive exactly where the editor draws it.
import { toLua } from "../js/export.js";
import { newVectorSprite, compileFrame, VECTOR_PRESETS, VECTOR_PRESET_COLORS } from "../js/vector.js";
import { execFileSync } from "child_process";
import fs from "fs"; import os from "os"; import path from "path";
const proj = { format: "pixforge", version: 1, name: "v", px: 2, palettes: { base: { ...VECTOR_PRESET_COLORS } }, sprites: {}, clips: {}, behaviors: {} };
const sp = newVectorSprite("smile", 64, 64);
sp.frames[0].layers.body = JSON.parse(JSON.stringify(VECTOR_PRESETS[0].shapes)).concat([{ t: "t", c: "red1", x: 20, y: 40, w: 12, h: 8, r: 35 }, { t: "t", c: "sky", x: 40, y: 10, w: 10, h: 14 }]);
proj.sprites.smile = sp;
const prims = compileFrame(sp, 0);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sfvec-"));
fs.writeFileSync(path.join(dir, "pixdata.lua"), toLua(proj));
const px = 2;
const expect = prims.map(q => [q.a === 2 ? 100002 : q.a === 3 ? 100003 : 100001, (q.x - sp.ax) * px, (sp.ay - q.y) * px, q.w * px, q.h * px, -(q.r || 0)].map(v => Math.round(v * 1000) / 1000).join(" ")).join("\n");
fs.writeFileSync(path.join(dir, "expect.txt"), expect);
fs.writeFileSync(path.join(dir, "run.lua"), `package.path = "${dir}/?.lua;${process.cwd()}/lua/?.lua;" .. package.path
local made = {}
local Ctrl = {} Ctrl.__index = Ctrl
function Ctrl:SetAnchoredPosition(x, y) self.x, self.y = x, y end
function Ctrl:SetSizeDelta(w, h) self.w, self.h = w, h end
function Ctrl:SetLocalScale() end
function Ctrl:SetLocalRotation(_, _, z) self.r = z end
function Ctrl:SetActive() end function Ctrl:SetVisible() end
function Ctrl:SetImage(_, idx) self.img = idx end
game = { InstantiateClientUIControl = function() local c = setmetatable({ r = 0 }, Ctrl) made[#made + 1] = c return c end, DestroyClientUIControl = function() end }
Enum = { ImageSource = { StaticReference = 1 } } Color = function(r, g, b, a) return { r, g, b, a } end
local Px = require("pix")
local script = { object = setmetatable({}, Ctrl), GetParam = function() return 1 end }
local root = Px.root(script)
local node = Px.draw(root, "smile", 0, 0, { px = ${px} })
local function r3(v) return math.floor(v * 1000 + 0.5) / 1000 end
local function fmt(v) v = r3(v) if v == math.floor(v) then return string.format("%d", v) end return tostring(v) end
local rows = {}
for _, c in ipairs(node.rectCtrls) do rows[#rows + 1] = table.concat({ fmt(c.img), fmt(c.x), fmt(c.y), fmt(c.w), fmt(c.h), fmt(c.r) }, " ") end
local f = io.open("${dir}/expect.txt") local want = f:read("a") f:close()
local got = table.concat(rows, "\\n")
if got ~= want then print("GOT\\n" .. got .. "\\nWANT\\n" .. want) error("vector placement mismatch") end
local tri = 0 for _, c in ipairs(node.rectCtrls) do if c.img == 100003 then tri = tri + 1 end end
if tri ~= 2 then error("triangles: " .. tri) end
print("vector OK", #rows, "primitives,", tri, "triangles")`);
console.log(execFileSync("lua", [path.join(dir, "run.lua")]).toString().trim());
