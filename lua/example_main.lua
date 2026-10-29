local Px = require("pix")

local SPRITE = "potion"
local SIZE = 6

local hero
local ready = false
local tries = 0

local function init()
  local root = Px.root(script, "TPL_SPRITE")
  if not root then return false end
  hero = Px.spawn(root, SPRITE, 0, 0, { px = SIZE })
  if not hero then return false end
  print("SpriteForge: " .. SPRITE .. " ready, rectangles: " .. Px.count)
  return true
end

function OnStart()
  script:EnableUpdate(true)
  ready = init()
end

function OnUpdate(dt)
  if not ready then
    tries = tries + 1
    if tries <= 120 then
      ready = init()
    elseif tries == 121 then
      print("SpriteForge: no container or TPL_SPRITE, check Script Variables")
    end
    return
  end
  Px.update(dt)
end

function OnDestroy()
  if hero then hero:destroy() end
end
