# SpriteForge

Live: https://khruq.github.io/SpriteForge/

A browser sprite editor (pixel art and freehand drawings) for games that cannot load image files. Draw or import a sprite, give it colour variants, animate it on a timeline, describe how it reacts with a small state machine, and export one Lua file for the game. Every sprite is stored as a minimal set of coloured rectangles; the bundled `pix.lua` runtime draws them with plain UI image controls from Lua client scripts, and the format is simple enough to port to any engine.

The editor is available in 15 languages, auto-detected from the browser; standard editor shortcuts (`?` shows the list), a full colour picker, a built-in Guide and a sample project help first-time users.

**Live editor:** open `index.html` (or the GitHub Pages site). **Docs:** `docs/index.html`.

## What you get

- **Two kinds of sprites** - pixel art (pencil, fill, import a picture) or freehand drawings (brush strokes, lines, circles, boxes) that the runtime rebuilds from rotated rectangles and circles, identical to the editor.
- **Draw or import** - pencil / fill / line / rect / mirror, layers, frames; import a picture as pixel art (quantised to N colours, optional outline) or as a drawing (overlapping ellipses or rectangles fitted to the picture), a sprite sheet, ASCII rows, or an earlier `pixdata.lua`.
- **Palettes with tint slots** - one sprite, many colour variants at runtime (`pal = "blue"`), no extra cost.
- **Clips** - timelines on `x y sx sy rot alpha frame pal layer:*` with easing; presets for idle/bounce/squash/shake/float/fadeout.
- **Behaviours** - a state machine per sprite: events, timers, clip-end, parameter thresholds. The game only fires events and sets parameters.
- **Variants for free** - half-resolution LOD (`lod = "half"`), 9-slice panels (`Px.nine`), autotiles (`Px.tiles`), vertical fill (`Px.fill`), stacks, tap areas (`Px.hit`, `actor:onTap`).
- **Cost everywhere** - every sprite shows how many rectangles it costs (each is one UI control in the game), Simplify merges rare colours; the runtime exposes `Px.count`.
- **One file for the game** - `spriteforge.lua` holds the sprites, palettes, clips, behaviours, the runtime and a start script; the `.spriteforge.json` project stays editable. Programmers can take `pixdata.lua` and `pix.lua` separately.

## Quick start

1. In your game editor make one Image control template (white square, asset `100001`, centred) and note its Index.
2. In SpriteForge open Export, type that Index into **Image template Index**, choose what to show when the game starts and press **Download spriteforge.lua**.
3. Copy `spriteforge.lua` into your stage's `external_lua_file`, add it to the client script list and attach it to a client UI container. Nothing else is needed; the log prints `SpriteForge: 1 sprite(s) ready`.

To control sprites from your own code, export `pixdata.lua`, copy it with `lua/pix.lua`, expose the template as script parameter `TPL_SPRITE` and write:

```lua
local Px = require("pix")
function OnStart()
  local root = Px.root(script)
  potion = Px.spawn(root, "potion", 0, 0, { pal = "blue" })
  script:EnableUpdate(true)
end
function OnUpdate(dt) Px.update(dt) end
-- later: potion:fire("tap")   potion:set("charge", 0.1)   potion:tint("gold")
```

See `lua/example_main.lua` and `examples/pixdata.lua`.

## Repository layout

```
index.html, css/, js/      the editor (static, no build step)
lua/pix.lua                Lua runtime
lua/example_main.lua       minimal client script
examples/pixdata.lua       export of the demo project
docs/index.html            setup, API, data format, budget
tools/mesh_check.mjs       encoder round-trip test (node)
tools/shapes_check.mjs     picture-to-shapes fitting test (node)
tools/lua_check.lua        runtime test against a stubbed UI API (lua 5.4)
tools/nine_check.lua       9-slice geometry and LOD coverage test
tools/i18n/                UI translations (keys.json + one array per language) and build.mjs → js/strings.js
tools/smoke/               headless browser smoke test (playwright)
```

## Tests

```
node tools/mesh_check.mjs
node tools/shapes_check.mjs
lua tools/lua_check.lua
lua tools/nine_check.lua
node tools/i18n/build.mjs     # regenerate js/strings.js after editing translations
```

## License

MIT © 2026 khruq. See [LICENSE](LICENSE).

## Disclaimer

SpriteForge is an independent, unofficial, fan-made tool. It is not affiliated with, endorsed, sponsored or approved by any game developer or publisher. All trademarks belong to their respective owners.

SpriteForge contains no game files, art or code; it refers to the built-in shapes of game editors only by their index numbers. The sample sprites and presets were made for this project.

Users are solely responsible for the content they create, import and export with SpriteForge, including having the rights to any images they import. The developer is not responsible for user-created content or for how it is used. SpriteForge is provided "as is", without warranty of any kind (see LICENSE).
