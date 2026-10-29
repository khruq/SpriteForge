# SpriteForge

Live: https://khruq.github.io/spriteforge/

A browser sprite editor (pixel art and Paint-like drawings) for games that cannot load image files. Draw or import a sprite, give it colour variants, animate it on a timeline, describe how it reacts with a small state machine, and export one Lua data file. Every sprite is stored as a minimal set of coloured rectangles; the bundled `pix.lua` runtime draws them in **Miliastra Wonderland** (editor 7.1+) with plain UI image controls, and the format is simple enough to port to any engine.

The editor is available in 15 languages (the Genshin Impact set), auto-detected from the browser; standard editor shortcuts (`?` shows the list), a full colour picker, a built-in Guide and a sample project help first-time users.

**Live editor:** open `index.html` (or the GitHub Pages site). **Docs:** `docs/index.html`.

## What you get

- **Two kinds of sprites** - pixel art (pencil, fill, import a picture) or drawings like in Paint (brush strokes, lines, circles, boxes) that the runtime rebuilds from rotated rectangles and circles, identical to the editor.
- **Draw or import** - pencil / fill / line / rect / mirror, layers, frames; import a picture (quantised to N colours, optional outline), a sprite sheet, ASCII rows, or an earlier `pixdata.lua`.
- **Palettes with tint slots** - one sprite, many colour variants at runtime (`pal = "hydro"`), no extra cost.
- **Clips** - timelines on `x y sx sy rot alpha frame pal layer:*` with easing; presets for idle/bounce/squash/shake/float/fadeout.
- **Behaviours** - a state machine per sprite: events, timers, clip-end, parameter thresholds. The game only fires events and sets parameters.
- **Variants for free** - half-resolution LOD (`lod = "half"`), 9-slice panels (`Px.nine`), autotiles (`Px.tiles`), vertical fill (`Px.fill`), stacks, tap areas (`Px.hit`, `actor:onTap`).
- **Cost everywhere** - every sprite shows how many rectangles it costs (each is one UI control in the game), Simplify merges rare colours; the runtime exposes `Px.count`.
- **One export** - `pixdata.lua` with sprites, palettes, clips and behaviours; the `.spriteforge.json` project stays editable.

## Quick start

1. Export `pixdata.lua` from the editor and copy it with `lua/pix.lua` into your stage's `external_lua_file`.
2. In the Miliastra editor: a Custom UI container with your script on it, plus one Image control template (white square, asset `100001`, centred) exposed to the script as parameter `TPL_SPRITE`.
3. In Lua:

```lua
local Px = require("pix")
function OnStart()
  local root = Px.root(script)
  slime = Px.spawn(root, "slime", 0, 0, { pal = "hydro" })
  script:EnableUpdate(true)
end
function OnUpdate(dt) Px.update(dt) end
-- later: slime:fire("tap")   slime:set("energy", 0.2)   slime:tint("pyro")
```

See `lua/example_main.lua` and `examples/pixdata.lua`.

## Repository layout

```
index.html, css/, js/      the editor (static, no build step)
lua/pix.lua                runtime for Miliastra Wonderland
lua/example_main.lua       minimal client script
examples/pixdata.lua       export of the demo project
docs/index.html            setup, API, data format, budget
tools/mesh_check.mjs       encoder round-trip test (node)
tools/lua_check.lua        runtime test against stubbed Miliastra API (lua 5.4)
tools/nine_check.lua       9-slice geometry and LOD coverage test
tools/i18n/                UI translations (keys.json + one array per language) and build.mjs → js/strings.js
tools/smoke/               headless browser smoke test (playwright)
```

## Tests

```
node tools/mesh_check.mjs
lua tools/lua_check.lua
lua tools/nine_check.lua
node tools/i18n/build.mjs     # regenerate js/strings.js after editing translations
```

## License

MIT.
