package.path = "./lua/?.lua;./examples/?.lua;" .. package.path
package.loaded["pixdata"] = dofile("examples/pixdata_box.lua")
local Ctrl = {} Ctrl.__index = Ctrl
local function newCtrl() return setmetatable({ pos = {0,0}, size = {0,0} }, Ctrl) end
function Ctrl:SetAnchoredPosition(x, y) self.pos = {x, y} end
function Ctrl:SetSizeDelta(w, h) self.size = {w, h} end
function Ctrl:SetLocalScale() end function Ctrl:SetLocalRotation() end function Ctrl:SetActive() end function Ctrl:SetVisible() end function Ctrl:SetImage() end function Ctrl:SetAsLastSibling() end
game = { InstantiateClientUIControl = function() return newCtrl() end, DestroyClientUIControl = function() end }
Enum = { ImageSource = { StaticReference = 1 } }
Color = function(r, g, b, a) return { r, g, b, a } end
local script = { object = newCtrl(), GetParam = function(_, n) if n == "TPL_SPRITE" then return 1 end end }
local Px = require("pix")
local root = Px.root(script)
local function bounds(node, ox, oy, acc)
  ox, oy = ox + node.x, oy + node.y
  for _, c in ipairs(node.rectCtrls or {}) do
    local x, y, w, h = ox + c.pos[1], oy + c.pos[2], c.size[1] - Px.SEAM, c.size[2] - Px.SEAM
    acc.x0 = math.min(acc.x0, x - w / 2) acc.x1 = math.max(acc.x1, x + w / 2)
    acc.y0 = math.min(acc.y0, y - h / 2) acc.y1 = math.max(acc.y1, y + h / 2)
    acc.n = acc.n + 1
  end
  for _, k in ipairs(node.kids) do bounds(k, ox, oy, acc) end
  return acc
end
for _, size in ipairs({ { 300, 120 }, { 64, 56 }, { 500, 300 } }) do
  local W, H = size[1], size[2]
  local n = Px.nine(root, "box", 0, 0, W, H)
  local b = bounds(n, 0, 0, { x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, n = 0 })
  local ok = math.abs((b.x1 - b.x0) - W) < 0.01 and math.abs((b.y1 - b.y0) - H) < 0.01 and math.abs(b.x0 + W / 2) < 0.01 and math.abs(b.y0 + H / 2) < 0.01
  print(string.format("nine %dx%d -> extents %.1fx%.1f from (%.1f,%.1f) rects %d %s", W, H, b.x1 - b.x0, b.y1 - b.y0, b.x0, b.y0, b.n, ok and "OK" or "FAIL"))
  assert(ok)
end
-- LOD: slime@2 is drawn at double px so it covers the same area as slime
local a = Px.draw(root, "box", 0, 0, { px = 4 })
local c = Px.draw(root, "box", 0, 0, { px = 4, lod = "half" })
local ba = bounds(a, 0, 0, { x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, n = 0 })
local bc = bounds(c, 0, 0, { x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, n = 0 })
print(string.format("lod full %d rects %.0fx%.0f, half %d rects %.0fx%.0f", ba.n, ba.x1 - ba.x0, ba.y1 - ba.y0, bc.n, bc.x1 - bc.x0, bc.y1 - bc.y0))
assert(math.abs((bc.x1 - bc.x0) - (ba.x1 - ba.x0)) <= 8 and math.abs((bc.y1 - bc.y0) - (ba.y1 - ba.y0)) <= 8)
print("nine/lod OK")
