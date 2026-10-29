local D = require("pixdata")

local Px = {}
Px.VERSION = "1.0"
Px.PX = D.PX or 4
Px.SEAM = 0.6
Px.SQUARE = 100001
Px.CIRCLE = 100002
Px.count = 0

local floor, max, min, sin, random = math.floor, math.max, math.min, math.sin, math.random

local DEC = {}
do
  local i = 0
  for c = 35, 126 do
    if c ~= 92 then DEC[c] = i i = i + 1 end
  end
end

local function pcallm(obj, name, ...)
  local f = obj and obj[name]
  if f == nil then return false end
  local ok = pcall(f, obj, ...)
  return ok
end

local imgSrc
local function source()
  if imgSrc == nil then pcall(function() imgSrc = Enum.ImageSource.StaticReference end) end
  return imgSrc
end

local colorCache, colorOrder, colorAt = {}, {}, 1
local function color(r, g, b, a)
  local key = r * 16777216 + g * 65536 + b * 256 + a
  local c = colorCache[key]
  if c == nil then
    local ok, v = pcall(function() return Color(r, g, b, a) end)
    if not ok then return nil end
    c = v
    local old = colorOrder[colorAt]
    if old then colorCache[old] = nil end
    colorOrder[colorAt] = key
    colorCache[key] = c
    colorAt = colorAt % 1024 + 1
  end
  return c
end

local template, hitTemplate, scriptRef

local function param(script, name)
  if type(name) == "number" then return name end
  local v
  pcall(function() v = script:GetParam(name) end)
  if v == nil then return nil end
  return tonumber(v) or v
end

function Px.setup(script, templateParam, hitParam)
  scriptRef = script
  template = param(script, templateParam or "TPL_SPRITE")
  hitTemplate = param(script, hitParam or "TPL_HIT")
  return template ~= nil
end

function Px.root(script, templateParam)
  if script then Px.setup(script, templateParam) end
  local o
  pcall(function() o = scriptRef.object end)
  return o
end

local function spawn(parentCtrl)
  if template == nil or parentCtrl == nil then return nil end
  local ok, c = pcall(function() return game.InstantiateClientUIControl(template, parentCtrl) end)
  if not ok then return nil end
  Px.count = Px.count + 1
  return c
end

local function destroyCtrl(c)
  if c == nil then return end
  if not pcall(function() game.DestroyClientUIControl(c) end) then pcall(function() game.DestroyClientControl(c) end) end
  Px.count = max(0, Px.count - 1)
end

local function setPos(c, x, y) pcall(function() c:SetAnchoredPosition(x, y) end) end
local function setSize(c, w, h) pcall(function() c:SetSizeDelta(w, h) end) end
local function setScale(c, sx, sy) pcall(function() c:SetLocalScale(sx, sy, 1) end) end
local function setRot(c, deg) pcall(function() c:SetLocalRotation(0, 0, deg) end) end
local function setVisible(c, on) pcall(function() c:SetActive(on) end) pcall(function() c:SetVisible(on) end) end
local function setImage(c, idx) pcall(function() c:SetImage(source(), idx) end) end
local function setColor(c, r, g, b, a)
  local col = color(floor(r + 0.5), floor(g + 0.5), floor(b + 0.5), floor(a + 0.5))
  if col then pcall(function() c.imageColor = col end) end
end
local function front(c) pcall(function() c:SetAsLastSibling() end) end

-- ---------------------------------------------------------------- sprites
local cache = {}

local function decode(r, keys, z)
  local list = {}
  if z == 2 then
    for i = 0, floor(#r / 9) - 1 do
      local a1, a2, b1, b2, c1, c2, e1, e2, f = string.byte(r, i * 9 + 1, i * 9 + 9)
      list[i + 1] = { DEC[a1] * 91 + DEC[a2], DEC[b1] * 91 + DEC[b2], DEC[c1] * 91 + DEC[c2], DEC[e1] * 91 + DEC[e2], keys[DEC[f] + 1] }
    end
    return list
  end
  for i = 0, floor(#r / 5) - 1 do
    local a, b, c, e, f = string.byte(r, i * 5 + 1, i * 5 + 5)
    list[i + 1] = { DEC[a], DEC[b], DEC[c], DEC[e], keys[DEC[f] + 1] }
  end
  return list
end

local function decodeVector(d, name)
  local prims, p = {}, d.p or {}
  for i = 1, #p - 6, 7 do
    prims[#prims + 1] = { p[i], p[i + 1], p[i + 2], p[i + 3], p[i + 4], p[i + 5], d.k[p[i + 6]] }
  end
  return { w = d.w, h = d.h, ax = d.ax, ay = d.ay, prims = prims, keys = d.k, name = name, vector = true }
end

function Px.get(name)
  local s = cache[name]
  if s then return s end
  local v = D.V and D.V[name]
  if v then s = decodeVector(v, name) cache[name] = s return s end
  local d = D.S[name]
  if not d then return nil end
  s = { w = d.w, h = d.h, ax = d.ax, ay = d.ay, rects = decode(d.r, d.k, d.z), keys = d.k, name = name }
  cache[name] = s
  return s
end

function Px.has(name) return D.S[name] ~= nil or (D.V ~= nil and D.V[name] ~= nil) end

function Px.color(key, palName)
  local pal = palName and D.P[palName]
  local c = pal and pal[key] or D.P.base[key]
  if not c then return { 255, 0, 255, 255 } end
  return c
end

-- ---------------------------------------------------------------- node (group) API
local Node = {}
Node.__index = Node

local function newNode(ctrl, parent)
  local n = setmetatable({ ctrl = ctrl, x = 0, y = 0, sx = 1, sy = 1, rotation = 0, vis = true, kids = {}, parent = parent }, Node)
  if parent then parent.kids[#parent.kids + 1] = n end
  return n
end

local function isNode(p)
  local ok, kids = pcall(function() return type(p) == "table" and rawget(p, "kids") end)
  return ok and kids ~= nil
end

function Px.group(parent, x, y)
  local pn = isNode(parent) and parent or nil
  local pc = pn and pn.ctrl or parent
  local c = spawn(pc)
  local n = newNode(c, pn)
  if c then
    setImage(c, Px.SQUARE)
    setSize(c, 2, 2)
    setColor(c, 255, 255, 255, 0)
    setVisible(c, true)
  end
  n:pos(x or 0, y or 0)
  return n
end

function Node:pos(x, y) self.x, self.y = x, y if self.ctrl then setPos(self.ctrl, x, y) end return self end
function Node:scale(sx, sy) self.sx, self.sy = sx, sy or sx if self.ctrl then setScale(self.ctrl, self.sx, self.sy) end return self end
function Node:rot(deg) self.rotation = deg if self.ctrl then setRot(self.ctrl, deg) end return self end
function Node:show(on) self.vis = on and true or false if self.ctrl then setVisible(self.ctrl, self.vis) end return self end
function Node:front() if self.ctrl then front(self.ctrl) end return self end
function Node:destroy()
  for i = #self.kids, 1, -1 do self.kids[i]:destroy() end
  self.kids = {}
  if self.rectCtrls then for _, c in ipairs(self.rectCtrls) do destroyCtrl(c) end self.rectCtrls = nil end
  if self.ctrl then destroyCtrl(self.ctrl) self.ctrl = nil end
  if self.parent then
    for i, k in ipairs(self.parent.kids) do if k == self then table.remove(self.parent.kids, i) break end end
  end
  Px.actors[self] = nil
  return self
end

-- ---------------------------------------------------------------- drawing rects into a node
local function paintRects(node, s, px, flip, palName, alpha, pxX, pxY)
  local ctrls = node.rectCtrls or {}
  node.rectCtrls = ctrls
  local ax, ay = s.ax, s.ay + 1
  local seam = Px.SEAM
  pxX, pxY = pxX or px, pxY or px
  for i, r in ipairs(s.rects) do
    local c = ctrls[i]
    if not c then
      c = spawn(node.ctrl)
      if not c then break end
      ctrls[i] = c
      setImage(c, Px.SQUARE)
      setVisible(c, true)
    end
    local rx, ry, rw, rh, key = r[1], r[2], r[3], r[4], r[5]
    local col = Px.color(key, palName)
    local a = (col[4] or 255) * (alpha or 1)
    local cx = (rx + rw / 2 - ax) * pxX
    if flip then cx = -cx end
    local cy = (ay - ry - rh / 2) * pxY
    local e = a >= 255 and seam or 0
    setPos(c, cx, cy)
    setSize(c, rw * pxX + e, rh * pxY + e)
    setColor(c, col[1], col[2], col[3], a)
  end
  for i = #ctrls, #s.rects + 1, -1 do destroyCtrl(ctrls[i]) ctrls[i] = nil end
  node.painted = { name = s.name, pal = palName, alpha = alpha or 1, flip = flip, px = px }
end

local function paintPrims(node, s, px, flip, palName, alpha)
  local ctrls = node.rectCtrls or {}
  local imgs = node.rectImgs or {}
  node.rectCtrls, node.rectImgs = ctrls, imgs
  for i, q in ipairs(s.prims) do
    local c = ctrls[i]
    if not c then
      c = spawn(node.ctrl)
      if not c then break end
      ctrls[i] = c
      setVisible(c, true)
    end
    local asset = q[1] == 2 and Px.CIRCLE or Px.SQUARE
    if imgs[i] ~= asset then setImage(c, asset) imgs[i] = asset end
    local col = Px.color(q[7], palName)
    local cx = (q[2] - s.ax) * px
    if flip then cx = -cx end
    setPos(c, cx, (s.ay - q[3]) * px)
    setSize(c, q[4] * px, q[5] * px)
    setRot(c, flip and q[6] or -q[6])
    setColor(c, col[1], col[2], col[3], (col[4] or 255) * (alpha or 1))
  end
  for i = #ctrls, #s.prims + 1, -1 do destroyCtrl(ctrls[i]) ctrls[i] = nil imgs[i] = nil end
  node.painted = { name = s.name, pal = palName, alpha = alpha or 1, flip = flip, px = px }
end

local function paintSprite(node, s, px, flip, palName, alpha)
  if s.vector then paintPrims(node, s, px, flip, palName, alpha) else paintRects(node, s, px, flip, palName, alpha) end
end

-- Draw a static sprite. Returns a node you can pos/scale/rot/show/destroy.
-- opts.lod = "half" uses the half-resolution variant (name@2) exported by the editor,
-- drawn at double pixel size so it looks the same but costs far fewer nodes.
local function pick(name, opts)
  local px = (opts and opts.px) or Px.PX
  if opts and opts.lod == "half" then
    local base, suffix = string.match(name, "^([^#]+)(#?%d*)$")
    local s = Px.get((base or name) .. "@2" .. (suffix or ""))
    if s then return s, px * 2 end
  end
  return Px.get(name), px
end

function Px.draw(parent, name, x, y, opts)
  opts = opts or {}
  local s, px = pick(name, opts)
  local node = Px.group(parent, x or 0, y or 0)
  if not s then return node end
  node.sprite = s
  paintSprite(node, s, px, opts.flip, opts.pal, opts.alpha)
  return node
end

function Node:repaint(name, opts)
  local s = Px.get(name or (self.sprite and self.sprite.name))
  if not s then return self end
  self.sprite = s
  opts = opts or {}
  local p = self.painted or {}
  paintSprite(self, s, opts.px or p.px or Px.PX, opts.flip == nil and p.flip or opts.flip, opts.pal or p.pal, opts.alpha or p.alpha)
  return self
end

function Node:tint(palName) return self:repaint(nil, { pal = palName }) end
function Node:alpha(a) return self:repaint(nil, { alpha = a }) end
function Node:flip(on) return self:repaint(nil, { flip = on }) end

-- ---------------------------------------------------------------- clips
local EASE = {
  linear = function(t) return t end,
  inQuad = function(t) return t * t end,
  outQuad = function(t) return 1 - (1 - t) * (1 - t) end,
  inOutQuad = function(t) if t < 0.5 then return 2 * t * t end return 1 - (-2 * t + 2) ^ 2 / 2 end,
  outCubic = function(t) return 1 - (1 - t) ^ 3 end,
  outBack = function(t) return 1 + 2.70158 * (t - 1) ^ 3 + 1.70158 * (t - 1) ^ 2 end,
  inCubic = function(t) return t * t * t end,
  inOutCubic = function(t) if t < 0.5 then return 4 * t * t * t end return 1 - (-2 * t + 2) ^ 3 / 2 end,
  inSine = function(t) return 1 - math.cos(t * math.pi / 2) end,
  outSine = function(t) return math.sin(t * math.pi / 2) end,
  inOutSine = function(t) return -(math.cos(math.pi * t) - 1) / 2 end,
  inBack = function(t) return 2.70158 * t * t * t - 1.70158 * t * t end,
  outElastic = function(t) if t == 0 or t == 1 then return t end return 2 ^ (-10 * t) * math.sin((t * 10 - 0.75) * (2 * math.pi / 3)) + 1 end,
  outBounce = function(t)
    local n, d = 7.5625, 2.75
    if t < 1 / d then return n * t * t end
    if t < 2 / d then t = t - 1.5 / d return n * t * t + 0.75 end
    if t < 2.5 / d then t = t - 2.25 / d return n * t * t + 0.9375 end
    t = t - 2.625 / d return n * t * t + 0.984375
  end,
  step = function() return 0 end,
}
Px.EASE = EASE

local DEFAULTS = { x = 0, y = 0, sx = 1, sy = 1, rot = 0, alpha = 1, frame = 1, pal = nil }

local function stepped(prop) return prop == "frame" or prop == "pal" or string.sub(prop, 1, 6) == "layer:" end

local function evalTrack(track, t)
  local keys = track.keys
  if not keys or #keys == 0 then return nil end
  if t <= keys[1][1] then return keys[1][2] end
  for i = 1, #keys - 1 do
    local a, b = keys[i], keys[i + 1]
    if t >= a[1] and t < b[1] then
      if stepped(track.prop) or type(a[2]) ~= "number" then return a[2] end
      local f = (EASE[track.ease] or EASE.linear)((t - a[1]) / max(1e-6, b[1] - a[1]))
      return a[2] + (b[2] - a[2]) * f
    end
  end
  return keys[#keys][2]
end

function Px.evalClip(clip, t)
  local props, layers = {}, {}
  for k, v in pairs(DEFAULTS) do props[k] = v end
  for _, track in ipairs(clip.tracks or {}) do
    local v = track.prop ~= "ev" and evalTrack(track, t) or nil
    if v ~= nil then
      if string.sub(track.prop, 1, 6) == "layer:" then layers[string.sub(track.prop, 7)] = v ~= false and v ~= 0
      else props[track.prop] = v end
    end
  end
  return props, layers
end

-- ---------------------------------------------------------------- actors (sprite + clips + behaviour)
Px.actors = {}

local Actor = setmetatable({}, { __index = Node })
Actor.__index = Actor

function Px.spawn(parent, name, x, y, opts)
  opts = opts or {}
  local meta = D.A[name] or { frames = 1, layers = {}, separate = {} }
  local behavior = D.B[opts.behavior or name]
  local a = setmetatable(Px.group(parent, x or 0, y or 0), Actor)
  a.name, a.meta, a.behavior = name, meta, behavior
  a.px, a.instPal, a.flipped = opts.px or Px.PX, opts.pal, opts.flip
  a.body = Px.group(a, 0, 0)
  a.layerNodes = {}
  for _, ln in ipairs(meta.separate or {}) do a.layerNodes[ln] = Px.group(a.body, 0, 0) end
  a.params = {}
  if behavior then for k, v in pairs(behavior.params or {}) do a.params[k] = v end end
  a.listeners = {}
  a.props = {}
  for k, v in pairs(DEFAULTS) do a.props[k] = v end
  a.layers, a.stateLayers = {}, {}
  a.t, a.ended = 0, false
  Px.actors[a] = true
  if behavior then a:state(behavior.initial) end
  a:render(true)
  return a
end

function Actor:on(ev, fn) self.listeners[ev] = self.listeners[ev] or {} table.insert(self.listeners[ev], fn) return self end
function Actor:emit(ev, ...) for _, fn in ipairs(self.listeners[ev] or {}) do fn(self, ...) end end

function Actor:play(clipName, restart)
  if clipName == nil then self.clip, self.clipName = nil, nil return self end
  local c = D.C[clipName] or D.C[self.name .. "." .. clipName]
  self.clip = c
  self.clipName = c and clipName or nil
  if restart ~= false then self.t, self.ended, self.fresh = 0, false, true end
  return self
end

function Actor:speed(m) self.rate = m or 1 return self end

function Actor:playOnce(clipName, done)
  local back = self.clipName
  self:play(clipName, true)
  self.once = { back = back, done = done }
  return self
end

function Actor:flip(on) self.flipped = on and true or false self:render(true) return self end
function Actor:face(dx) if dx and dx < 0 then self:flip(true) elseif dx and dx > 0 then self:flip(false) end return self end

function Actor:clipEvents(prev, now, wrapped)
  local lo = self.fresh and -1 or prev
  self.fresh = false
  for _, track in ipairs(self.clip.tracks or {}) do
    if track.prop == "ev" then
      for _, k in ipairs(track.keys or {}) do
        local hit
        if wrapped then hit = k[1] > lo or k[1] <= now else hit = k[1] > lo and k[1] <= now end
        if hit then self:emit("event", k[2]) end
      end
    end
  end
end

function Actor:state(name)
  local st = self.behavior and self.behavior.states and self.behavior.states[name]
  if not st then return false end
  self.stateName = name
  self.stateLayers = {}
  for k, v in pairs(st.layers or {}) do self.stateLayers[k] = v end
  self.statePal = st.pal
  self:play(st.clip, true)
  self.timer = nil
  for _, tr in ipairs(st.on or {}) do
    if tr.timer then self.timer = { at = tr.timer[1] + random() * max(0, tr.timer[2] - tr.timer[1]), to = tr.to } end
  end
  self:emit("state", name)
  self:checkParams()
  return true
end

function Actor:fire(ev)
  local st = self.behavior and self.behavior.states and self.behavior.states[self.stateName]
  if not st then return false end
  for _, tr in ipairs(st.on or {}) do
    if tr.ev == ev then self:state(tr.to) return true end
  end
  return false
end

function Actor:set(param, value) self.params[param] = value self:checkParams() return self end
function Actor:get(param) return self.params[param] end

function Actor:checkParams()
  local st = self.behavior and self.behavior.states and self.behavior.states[self.stateName]
  if not st then return end
  for _, tr in ipairs(st.on or {}) do
    if tr.param then
      local v = self.params[tr.param] or 0
      if (tr.lt and v < tr.lt) or (tr.gt and v > tr.gt) then
        if tr.to ~= self.stateName then self:state(tr.to) end
        return
      end
    end
  end
end

function Actor:tint(palName) self.instPal = palName self:render(true) return self end
function Actor:layer(name, on) self.stateLayers[name] = on self:render(true) return self end

function Actor:frameName(i)
  local n = self.meta.frames or 1
  local f = ((floor((i or 1) + 0.5) - 1) % n + n) % n
  if f == 0 then return self.name end
  return self.name .. "#" .. (f + 1)
end

function Actor:render(force)
  local p = self.props
  local frame = self:frameName(p.frame)
  local pal = p.pal or self.statePal or self.instPal
  local alpha = (p.alpha or 1) * (self.alphaMul or 1)
  local key = frame .. "|" .. tostring(pal) .. "|" .. tostring(alpha) .. "|" .. tostring(self.flipped)
  if force or key ~= self.renderKey then
    self.renderKey = key
    local s = Px.get(frame)
    if s then
      self.sprite = s
      paintSprite(self.body, s, self.px, self.flipped, pal, alpha)
    end
    for ln, node in pairs(self.layerNodes) do
      local vis = self.layers[ln]
      if vis == nil then vis = self.stateLayers[ln] end
      if vis == nil then vis = true end
      node:show(vis)
      if vis then
        local suffix = (frame == self.name) and "" or string.sub(frame, #self.name + 1)
        local ls = Px.get(self.name .. "/" .. ln .. suffix)
        if ls then paintSprite(node, ls, self.px, self.flipped, pal, alpha) end
      end
    end
  end
  self.body:pos(p.x * self.px, p.y * self.px)
  self.body:scale(p.sx, p.sy)
  self.body:rot(p.rot)
end

function Actor:update(dt)
  dt = dt * (self.rate or 1)
  if self.clip then
    local dur = max(1e-6, self.clip.dur or 1)
    local prev, wrapped = self.t, false
    self.t = self.t + dt
    if self.clip.loop and not self.once then
      if self.t >= dur then wrapped = true end
      self.t = self.t % dur
    end
    self:clipEvents(prev, min(self.t, dur), wrapped)
    if self.t >= dur and not self.ended and (not self.clip.loop or self.once) then
      self.t, self.ended = dur, true
      self:emit("clipEnd", self.clipName)
      if self.once then
        local o = self.once
        self.once = nil
        self:play(o.back, true)
        if o.done then o.done(self) end
      else
        self:fire("end")
      end
    end
    if self.clip then
      dur = max(1e-6, self.clip.dur or 1)
      local props, layers = Px.evalClip(self.clip, min(self.t, dur))
      self.props = props
      self.layers = {}
      for k, v in pairs(self.stateLayers) do self.layers[k] = v end
      for k, v in pairs(layers) do self.layers[k] = v end
    end
  else
    for k, v in pairs(DEFAULTS) do self.props[k] = v end
    self.layers = {}
    for k, v in pairs(self.stateLayers) do self.layers[k] = v end
  end
  if self.timer then
    self.timer.at = self.timer.at - dt
    if self.timer.at <= 0 then local to = self.timer.to self.timer = nil self:state(to) end
  end
  self:render(false)
end

-- Call once per frame from OnUpdate(dt).
Px.tweens, Px.timers, Px.parts = {}, {}, {}

local function keysOf(t) local out = {} for k in pairs(t) do out[#out + 1] = k end return out end

function Px.tween(node, to, dur, ease, done)
  local tw = { node = node, to = to, from = {}, dur = max(1e-6, dur or 0.3), t = 0, ease = EASE[ease or "outQuad"] or EASE.linear, done = done }
  for k in pairs(to) do
    if k == "x" then tw.from.x = node.x elseif k == "y" then tw.from.y = node.y
    elseif k == "sx" then tw.from.sx = node.sx elseif k == "sy" then tw.from.sy = node.sy
    elseif k == "rot" then tw.from.rot = node.rotation elseif k == "alpha" then tw.from.alpha = node.alphaMul or 1 end
  end
  Px.tweens[tw] = true
  return tw
end

local function applyTween(tw, f)
  local n, v = tw.node, {}
  for k, to in pairs(tw.to) do if tw.from[k] then v[k] = tw.from[k] + (to - tw.from[k]) * f end end
  if v.x or v.y then n:pos(v.x or n.x, v.y or n.y) end
  if v.sx or v.sy then n:scale(v.sx or n.sx, v.sy or n.sy) end
  if v.rot then n:rot(v.rot) end
  if v.alpha then
    local q = floor(v.alpha * 20 + 0.5) / 20
    if q ~= n.alphaMul then
      n.alphaMul = q
      if n.render then n:render(true) elseif n.sprite then n:alpha(q) end
    end
  end
end

function Node:moveTo(x, y, dur, ease, done) return Px.tween(self, { x = x, y = y }, dur, ease, done) end
function Node:moveBy(dx, dy, dur, ease, done) return Px.tween(self, { x = self.x + dx, y = self.y + dy }, dur, ease, done) end
function Node:scaleTo(s, dur, ease, done) return Px.tween(self, { sx = s, sy = s }, dur, ease, done) end
function Node:rotTo(deg, dur, ease, done) return Px.tween(self, { rot = deg }, dur, ease, done) end
function Node:fadeTo(a, dur, ease, done) return Px.tween(self, { alpha = a }, dur, ease, done) end

function Px.after(sec, fn) local h = { at = sec, fn = fn } Px.timers[h] = true return h end
function Px.every(sec, fn) local h = { at = sec, every = sec, fn = fn } Px.timers[h] = true return h end
function Px.cancel(h) if h then Px.tweens[h] = nil Px.timers[h] = nil end end

function Px.burst(parent, name, x, y, opts)
  opts = opts or {}
  local list = {}
  for i = 1, opts.count or 8 do
    local ang = math.rad((opts.angle or 90) + (random() - 0.5) * (opts.spread or 360))
    local sp = (opts.speed or 160) * (0.6 + random() * 0.8)
    local node = Px.draw(parent, name, x or 0, y or 0, { px = opts.px or 2, pal = opts.pal })
    local life = (opts.life or 0.7) * (0.7 + random() * 0.6)
    local p = { node = node, vx = math.cos(ang) * sp, vy = math.sin(ang) * sp, g = opts.gravity or -400, life = life, t = 0, spin = (random() - 0.5) * (opts.spin or 0), fade = opts.fade ~= false, a = 1 }
    Px.parts[p] = true
    list[#list + 1] = node
  end
  return list
end

function Px.clear()
  for _, a in ipairs(keysOf(Px.actors)) do a:destroy() end
  for _, p in ipairs(keysOf(Px.parts)) do p.node:destroy() end
  Px.actors, Px.tweens, Px.timers, Px.parts = {}, {}, {}, {}
end

function Px.update(dt)
  dt = dt or 0
  for _, a in ipairs(keysOf(Px.actors)) do if Px.actors[a] then a:update(dt) end end
  for _, tw in ipairs(keysOf(Px.tweens)) do
    if Px.tweens[tw] then
      if tw.node.ctrl == nil and #tw.node.kids == 0 then
        Px.tweens[tw] = nil
      else
        tw.t = tw.t + dt
        local f = min(1, tw.t / tw.dur)
        applyTween(tw, tw.ease(f))
        if f >= 1 then Px.tweens[tw] = nil if tw.done then tw.done(tw.node) end end
      end
    end
  end
  for _, h in ipairs(keysOf(Px.timers)) do
    if Px.timers[h] then
      h.at = h.at - dt
      if h.at <= 0 then
        if h.every then h.at = h.at + h.every else Px.timers[h] = nil end
        h.fn(h)
      end
    end
  end
  for _, p in ipairs(keysOf(Px.parts)) do
    p.t = p.t + dt
    if p.t >= p.life then
      p.node:destroy()
      Px.parts[p] = nil
    else
      p.vy = p.vy + p.g * dt
      p.node:pos(p.node.x + p.vx * dt, p.node.y + p.vy * dt)
      if p.spin ~= 0 then p.node:rot(p.node.rotation + p.spin * dt) end
      if p.fade then
        local q = floor((1 - p.t / p.life) * 4 + 0.999) / 4
        if q ~= p.a then p.a = q p.node:alpha(q) end
      end
    end
  end
end

-- Composition helper: several sprites sharing one anchor in one group.
function Px.stack(parent, names, x, y, opts)
  local g = Px.group(parent, x or 0, y or 0)
  g.parts = {}
  for i, n in ipairs(names) do g.parts[i] = Px.draw(g, n, 0, 0, opts) end
  return g
end

-- Vertical fill (progress bars, "charging" effects): shows the lowest `ratio` of the sprite.
function Px.fill(parent, name, x, y, ratio, opts)
  opts = opts or {}
  local s = Px.get(name)
  local node = Px.group(parent, x or 0, y or 0)
  if not s then return node end
  local cut = { w = s.w, h = s.h, ax = s.ax, ay = s.ay, name = name, keys = s.keys, rects = {} }
  local keepFrom = s.h - floor(s.h * max(0, min(1, ratio or 1)) + 0.5)
  for _, r in ipairs(s.rects) do
    local y0, y1 = r[2], r[2] + r[4]
    if y1 > keepFrom then
      local ny0 = max(y0, keepFrom)
      cut.rects[#cut.rects + 1] = { r[1], ny0, r[3], y1 - ny0, r[5] }
    end
  end
  node.sprite = cut
  paintRects(node, cut, opts.px or Px.PX, opts.flip, opts.pal, opts.alpha)
  return node
end

-- 9-slice panel: corners keep their size, edges stretch along one axis, the centre along both.
-- Pieces are exported by the editor as name~tl, ~t, ~tr, ~l, ~c, ~r, ~bl, ~b, ~br.
function Px.nine(parent, name, x, y, w, h, opts)
  opts = opts or {}
  local px = opts.px or Px.PX
  local meta = D.A[name]
  local node = Px.group(parent, x or 0, y or 0)
  if not meta or not meta.nine then return node end
  local n = meta.nine
  local cw = meta.w - n.l - n.r
  local ch = meta.h - n.t - n.b
  local innerW = max(0, w - (n.l + n.r) * px)
  local innerH = max(0, h - (n.t + n.b) * px)
  local sx = cw > 0 and innerW / cw or px
  local sy = ch > 0 and innerH / ch or px
  local left, bottom = -w / 2, -h / 2
  local cols = { { "l", n.l * px, px }, { "", innerW, sx }, { "r", n.r * px, px } }
  local rows = { { "b", n.b * px, px }, { "", innerH, sy }, { "t", n.t * px, px } }
  local yy = bottom
  for ri, row in ipairs(rows) do
    local xx = left
    for ci, col in ipairs(cols) do
      local tag = (row[1] == "" and col[1] == "") and "c" or (row[1] .. col[1])
      if tag == "" then tag = "c" end
      local s = Px.get(name .. "~" .. tag)
      if s and row[2] > 0 and col[2] > 0 then
        local piece = Px.group(node, xx + col[2] / 2 - s.w * col[3] / 2 + s.ax * col[3], yy + row[2] / 2 - s.h * row[3] / 2 + (s.h - s.ay - 1) * row[3])
        paintRects(piece, s, px, false, opts.pal, opts.alpha, col[3], row[3])
      end
      xx = xx + col[2]
    end
    yy = yy + row[2]
  end
  return node
end

-- Autotiles: a sprite exported with 16 frames in the order
-- none,n,e,ne,s,ns,se,nse,w,nw,we,new,sw,nsw,sew,nsew (bit 1=N, 2=E, 4=S, 8=W).
-- grid[y][x] is truthy where a tile exists; cell = tile size in UI units (default sprite w * px).
function Px.tiles(parent, name, grid, cell, opts)
  opts = opts or {}
  local px = opts.px or Px.PX
  local meta = D.A[name]
  local node = Px.group(parent, opts.x or 0, opts.y or 0)
  if not meta then return node end
  cell = cell or meta.w * px
  node.tiles = {}
  local function at(x, y) local row = grid[y] return row and row[x] and true or false end
  for y, row in pairs(grid) do
    for x, v in pairs(row) do
      if v then
        local mask = (at(x, y - 1) and 1 or 0) + (at(x + 1, y) and 2 or 0) + (at(x, y + 1) and 4 or 0) + (at(x - 1, y) and 8 or 0)
        local frame = mask == 0 and name or (name .. "#" .. (mask + 1))
        local t = Px.draw(node, frame, x * cell, -y * cell, { px = px, pal = opts.pal, alpha = opts.alpha })
        node.tiles[#node.tiles + 1] = t
      end
    end
  end
  return node
end

-- Hit area (needs a TPL_HIT template with a raycast target). fn() is called on click.
function Px.hit(parent, x, y, w, h, fn)
  local pn = isNode(parent) and parent or nil
  local pc = pn and pn.ctrl or parent
  if hitTemplate == nil or pc == nil then return nil end
  local ok, c = pcall(function() return game.InstantiateClientUIControl(hitTemplate, pc) end)
  if not ok or c == nil then return nil end
  Px.count = Px.count + 1
  local n = newNode(c, pn)
  setSize(c, w, h)
  setPos(c, x, y)
  setVisible(c, true)
  local ev
  pcall(function() ev = Enum.CursorEventType.CursorClick end)
  pcall(function() c:AddCursorEventListener(ev, function() pcall(fn) end) end)
  return n
end

function Actor:onTap(fn)
  local meta = self.meta
  local w, h = (meta.w or 16) * self.px, (meta.h or 16) * self.px
  if self.hitNode then self.hitNode:destroy() end
  self.hitNode = Px.hit(self, 0, h / 2, w, h, function() fn(self) end)
  return self
end

return Px
