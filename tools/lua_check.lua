-- Runs pix.lua against stub UI API objects and checks clip/behaviour semantics.
package.path = "./lua/?.lua;./examples/?.lua;" .. package.path
local calls = { spawn = 0, destroy = 0 }
local Ctrl = {} Ctrl.__index = Ctrl
local function newCtrl() return setmetatable({ pos = {0,0}, size = {0,0}, col = nil }, Ctrl) end
function Ctrl:SetAnchoredPosition(x, y) self.pos = {x, y} end
function Ctrl:SetSizeDelta(w, h) self.size = {w, h} end
function Ctrl:SetLocalScale(x, y) self.scale = {x, y} end
function Ctrl:SetLocalRotation(_, _, z) self.rotz = z end
function Ctrl:SetActive(v) self.active = v end
function Ctrl:SetVisible(v) self.visible = v end
function Ctrl:SetImage(src, idx) self.img = idx end
function Ctrl:SetAsLastSibling() end
game = { InstantiateClientUIControl = function(tpl, parent) calls.spawn = calls.spawn + 1 return newCtrl() end,
         DestroyClientUIControl = function(c) calls.destroy = calls.destroy + 1 end }
Enum = { ImageSource = { StaticReference = 1 } }
Color = function(r, g, b, a) return { r, g, b, a } end
local script = { object = newCtrl(), GetParam = function(_, n) if n == "TPL_SPRITE" then return 12345 elseif n == "TPL_HIT" then return 777 end end }

local Px = require("pix")
local DATA = require("pixdata")
local root = Px.root(script)
assert(root, "root")
local a = Px.spawn(root, "potion", 10, 20, { pal = "blue" })
assert(a.stateName == "idle", "initial state")
local s = Px.get("potion")
local N = DATA.S["potion"].n
assert(#s.rects == N, "rect count " .. #s.rects)
local spawnedByActor = 3 + N + DATA.S["potion/label"].n
assert(calls.spawn == spawnedByActor, "spawned nodes: " .. calls.spawn .. " expected " .. spawnedByActor)
local blueP2 = Px.color("p2", "blue")
assert(blueP2[1] == 100 and blueP2[2] == 170 and blueP2[3] == 250, "palette override")
local props = Px.evalClip(DATA.C["potion.idle"], 0.3)
assert(math.abs(props.y - 1) < 1e-9 and props.frame == 1, "idle at 0.3: y " .. props.y)
props = Px.evalClip(DATA.C["potion.idle"], 0.7)
assert(props.frame == 2, "idle switches to frame 2")
a:fire("tap")
assert(a.stateName == "pop", "tap -> pop")
Px.update(0.1)
assert(a.props.pal == "gold", "pal track while pop plays")
local states = {}
a:on("state", function(_, n) states[#states + 1] = n end)
for _ = 1, 20 do Px.update(0.05) end
assert(a.stateName == "idle", "pop ends -> idle, got " .. tostring(a.stateName))
assert(states[1] == "idle", "state event")
a:set("charge", 0.1)
assert(a.stateName == "empty", "charge < 0.2 -> empty")
a:set("charge", 0.9)
assert(a.stateName == "idle", "charge > 0.5 -> idle")
assert(a:frameName(1) == "potion" and a:frameName(2) == "potion#2" and a:frameName(3) == "potion", "frame names wrap")
local f = Px.fill(root, "potion", 0, 0, 0.5)
assert(#f.sprite.rects > 0 and #f.sprite.rects <= N, "fill rects")
local before0 = calls.destroy
a:destroy()
assert(calls.destroy - before0 == spawnedByActor, "destroyed " .. (calls.destroy - before0))
assert(Px.actors[a] == nil, "actor unregistered")
local tapped = 0
local b = Px.spawn(root, "potion", 0, 0)
b:onTap(function() tapped = tapped + 1 end)
assert(b.hitNode and b.hitNode.ctrl, "hit node created from TPL_HIT")
local grid = { [0] = { [0] = true, [1] = true }, [1] = { [0] = true } }
local tl = Px.tiles(root, "potion", grid, 64)
assert(#tl.tiles == 3, "3 tiles placed")
local nine = Px.nine(root, "potion", 0, 0, 300, 120)
assert(nine and nine.ctrl, "nine group")
-- lod fallback: no @2 variant -> normal sprite
local d2 = Px.draw(root, "potion", 0, 0, { lod = "half" })
assert(d2.sprite and d2.sprite.name == "potion", "lod fallback")
DATA.C["potion.evtest"] = { dur = 1, loop = true, tracks = { { prop = "ev", ease = "step", keys = { {0, "start"}, {0.5, "step"} } }, { prop = "y", ease = "linear", keys = { {0, 0}, {1, 10} } } } }
DATA.C["potion.once"] = { dur = 0.4, loop = false, tracks = { { prop = "x", ease = "linear", keys = { {0, 0}, {0.4, 4} } } } }
local e = Px.spawn(root, "potion", 0, 0, { behavior = "none" })
local got = {}
e:on("event", function(_, name) got[#got + 1] = name end)
e:play("evtest")
e:update(0.25) e:update(0.3) e:update(0.6)
assert(table.concat(got, ",") == "start,step,start", "clip events: " .. table.concat(got, ","))
e:speed(2) e:update(0.25)
assert(math.abs(e.t - 0.65) < 1e-9, "speed doubles time: " .. e.t)
e:speed(1)
local doneOnce = false
e:playOnce("once", function() doneOnce = true end)
e:update(0.2) assert(e.clipName == "once", "once playing")
e:update(0.3) assert(doneOnce and e.clipName == "evtest", "playOnce returns to previous clip: " .. tostring(e.clipName))
assert(math.abs(Px.evalClip(DATA.C["potion.evtest"], 0.5).y - 5) < 1e-9 and Px.evalClip(DATA.C["potion.evtest"], 0.5).ev == nil, "ev track not a prop")
local mv = Px.draw(root, "potion", 0, 0)
local arrived = false
mv:moveTo(100, 50, 0.5, "linear", function() arrived = true end)
Px.update(0.25) assert(math.abs(mv.x - 50) < 1e-6 and math.abs(mv.y - 25) < 1e-6, "tween halfway")
Px.update(0.3) assert(arrived and mv.x == 100 and mv.y == 50, "tween done")
local fired, ticks = false, 0
Px.after(0.2, function() fired = true end)
local ev = Px.every(0.1, function() ticks = ticks + 1 end)
Px.update(0.15) assert(not fired and ticks == 1, "timers early")
Px.update(0.1) assert(fired and ticks == 2, "timers fired")
Px.cancel(ev) Px.update(0.5) assert(ticks == 2, "every cancelled")
local before = calls.spawn
local parts = Px.burst(root, "potion", 0, 0, { count = 5, life = 0.3 })
assert(#parts == 5 and calls.spawn > before, "burst spawned")
local destroyedBefore = calls.destroy
Px.update(0.5)
assert(next(Px.parts) == nil and calls.destroy > destroyedBefore, "particles cleaned up")
e:flip(true) assert(e.flipped == true, "flip") e:face(1) assert(e.flipped == false, "face right")
for _, n in ipairs({ "inCubic", "inOutCubic", "inSine", "outSine", "inOutSine", "inBack", "outElastic" }) do
  local f = Px.EASE[n] assert(math.abs(f(0)) < 1e-9 and math.abs(f(1) - 1) < 1e-9, "ease " .. n)
end
print("pix.lua OK: nodes live", Px.count)
