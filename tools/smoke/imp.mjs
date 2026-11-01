import pw from "/opt/npm-tools/node_modules/playwright/index.js"; const { chromium } = pw;
import fs from "fs";
const shots = new URL("./shots/", import.meta.url).pathname;
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const errs = []; pg.on("pageerror", e => errs.push(e.message + " | " + (e.stack || "").split("\n")[1])); pg.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text()); });
let fails = 0; const ok = (n, c) => { if (!c) fails++; console.log((c ? "PASS " : "FAIL ") + n); };
await pg.goto("http://localhost:8765/index.html"); await pg.waitForTimeout(600);
await pg.keyboard.press("Escape"); await pg.waitForTimeout(100);

const picture = async (a, b2, c3) => Buffer.from((await pg.evaluate(([a, b2, c3]) => {
  const c = document.createElement("canvas"); c.width = 120; c.height = 100; const x = c.getContext("2d");
  x.fillStyle = a; x.beginPath(); x.ellipse(50, 55, 42, 30, 0.4, 0, 7); x.fill();
  x.fillStyle = b2; x.save(); x.translate(85, 25); x.rotate(0.5); x.fillRect(-18, -9, 36, 18); x.restore();
  x.fillStyle = c3; x.beginPath(); x.arc(40, 50, 11, 0, 7); x.fill();
  return c.toDataURL("image/png");
}, [a, b2, c3])).split(",")[1], "base64");
const pic1 = await picture("#e03838", "#3366dd", "#ffdd44"), pic2 = await picture("#22aa55", "#8844cc", "#ffffff");
const choose = async buf => { const [fc] = await Promise.all([pg.waitForEvent("filechooser"), pg.click(".dialog.on >> text=Choose image…")]); await fc.setFiles({ name: "pic.png", mimeType: "image/png", buffer: buf }); };
const colours = name => pg.evaluate(n => { const S = PF.S, sp = S.project.sprites[n], out = new Set();
  const add = k => { const c = S.project.palettes.base[k]; out.add(k + "=" + (c ? c.join(",") : "missing")); };
  if (sp.kind === "vector") for (const f of sp.frames) for (const sh of Object.values(f.layers).flat()) add(sh.c);
  else for (const f of sp.frames) for (const g of Object.values(f.layers)) for (const row of g) for (const k of row) if (k != null) add(k);
  return [...out].sort().join(" "); }, name);

// pixel import twice: the first sprite keeps its colours
await pg.keyboard.press("Control+i"); await pg.waitForTimeout(200);
ok("import opens in pixel mode", await pg.locator(".dialog.on .kindbtn.on", { hasText: "Pixel art" }).count() === 1);
await choose(pic1); await pg.waitForTimeout(900);
ok("pixel preview cost", /\d+ rectangles/.test(await pg.locator(".dialog.on .stat").innerText()));
await pg.click(".dialog.on >> text=Add sprite"); await pg.waitForTimeout(300);
const a = await pg.evaluate(() => PF.S.sprite), aCol = await colours(a);
await pg.keyboard.press("Control+i"); await pg.waitForTimeout(200); await choose(pic2); await pg.waitForTimeout(900);
await pg.click(".dialog.on >> text=Add sprite"); await pg.waitForTimeout(300);
const b2 = await pg.evaluate(() => PF.S.sprite);
ok("second pixel import is a new sprite", a !== b2);
ok("first import keeps its colours", aCol === await colours(a));
ok("no missing colour keys", !(aCol + await colours(b2)).includes("missing"));

// drawing (shapes) import
await pg.keyboard.press("Control+i"); await pg.waitForTimeout(200);
await pg.click(".dialog.on .kindbtn >> text=Drawing"); await pg.waitForTimeout(100);
ok("drawing mode shows shape options", await pg.locator(".dialog.on select option", { hasText: "Ellipses and rectangles" }).count() === 1 && await pg.locator(".dialog.on select option", { hasText: "Triangles" }).count() === 2);
ok("triangles and ellipses by default", await pg.locator(".dialog.on select").inputValue() === "et");
ok("soft blending on by default", await pg.locator(".dialog.on label.chk", { hasText: "soft blending" }).locator("input").isChecked());
ok("up to 64 colours", await pg.locator(".dialog.on input[type=number][max='64']").count() === 1);
const cnt = pg.locator(".dialog.on input[type=number]").filter({ has: pg.locator("xpath=self::*[@max='500']") });
await cnt.fill("60"); await cnt.dispatchEvent("change");
await choose(pic1);
await pg.waitForFunction(() => /^\d+ rectangles/.test(document.querySelector(".dialog.on .stat")?.textContent || ""), null, { timeout: 20000 });
await pg.screenshot({ path: shots + "import_shapes.png" });
const label = await pg.locator(".dialog.on .stat").innerText();
ok("shapes fitted: " + label, +label.split(" ")[0] >= 10 && +label.split(" ")[0] <= 60);
await pg.fill(".dialog.on input[type=text] >> nth=0", "Лисичка");
await pg.click(".dialog.on >> text=Add sprite"); await pg.waitForTimeout(400);
const v = await pg.evaluate(() => { const sp = PF.S.project.sprites[PF.S.sprite]; return { name: PF.S.sprite, kind: sp.kind, w: sp.w, h: sp.h, n: sp.frames[0].layers.body.length, rot: sp.frames[0].layers.body.filter(s => s.r).length, types: [...new Set(sp.frames[0].layers.body.map(s => s.t))].join("") }; });
console.log("  ", JSON.stringify(v));
ok("drawing sprite added", v.kind === "vector" && v.n >= 10 && v.w === 64 && v.h === 54);
ok("Cyrillic name transliterated", v.name === "Lysychka");
ok("triangles and ellipses only, some turned: " + v.types, /^[et]+$/.test(v.types) && v.rot > 0);
ok("drawing colours present", !(await colours(v.name)).includes("missing"));
await pg.screenshot({ path: shots + "import_drawn.png" });
await pg.keyboard.press("Shift+H"); await pg.waitForTimeout(100);
ok("flip keeps shapes", await pg.evaluate(() => PF.S.project.sprites[PF.S.sprite].frames[0].layers.body.length) === v.n);
await pg.keyboard.press("Control+z");

// rectangles only, then close while working
await pg.keyboard.press("Control+i"); await pg.waitForTimeout(200);
ok("import remembers drawing mode", await pg.locator(".dialog.on .kindbtn.on", { hasText: "Drawing" }).count() === 1);
await pg.selectOption(".dialog.on select", "r"); await choose(pic2);
await pg.waitForFunction(() => /^\d+ rectangles/.test(document.querySelector(".dialog.on .stat")?.textContent || ""), null, { timeout: 20000 });
await pg.click(".dialog.on >> text=Add sprite"); await pg.waitForTimeout(300);
ok("rectangles only", await pg.evaluate(() => PF.S.project.sprites[PF.S.sprite].frames[0].layers.body.every(s => s.t === "r")));

// triangles only: a photo-like gradient, soft blending gives half transparent colours
await pg.keyboard.press("Control+i"); await pg.waitForTimeout(200);
ok("import remembers rectangles", await pg.locator(".dialog.on select").inputValue() === "r");
await pg.selectOption(".dialog.on select", "t");
const grad = Buffer.from((await pg.evaluate(() => { const c = document.createElement("canvas"); c.width = 96; c.height = 96; const x = c.getContext("2d");
  const g = x.createRadialGradient(40, 40, 4, 48, 48, 60); g.addColorStop(0, "#ffe0a0"); g.addColorStop(0.5, "#e07030"); g.addColorStop(1, "#402060"); x.fillStyle = g; x.fillRect(0, 0, 96, 96);
  x.fillStyle = "#203080"; x.beginPath(); x.moveTo(48, 10); x.lineTo(86, 80); x.lineTo(10, 80); x.closePath(); x.globalAlpha = 0.5; x.fill(); return c.toDataURL("image/png"); })).split(",")[1], "base64");
await choose(grad);
await pg.waitForFunction(() => /^\d+ rectangles/.test(document.querySelector(".dialog.on .stat")?.textContent || ""), null, { timeout: 30000 });
await pg.screenshot({ path: shots + "import_triangles.png" });
await pg.click(".dialog.on >> text=Add sprite"); await pg.waitForTimeout(400);
const tv = await pg.evaluate(() => { const S = PF.S, sh = S.project.sprites[S.sprite].frames[0].layers.body; return { n: sh.length, tri: sh.every(s => s.t === "t"), half: sh.filter(s => (S.project.palettes.base[s.c] || [])[3] === 128).length, range: sh.every(s => !s.r || (s.r > -180 && s.r <= 180)) }; });
console.log("  ", JSON.stringify(tv));
ok("triangles only", tv.tri && tv.n >= 30);
ok("soft blending adds half transparent shapes", tv.half > 0);
ok("triangle angles in range", tv.range);
await pg.screenshot({ path: shots + "import_triangles_sprite.png" });
const before = await pg.evaluate(() => JSON.stringify(PF.S.project.sprites[PF.S.sprite].frames[0].layers.body));
await pg.keyboard.press("Shift+H"); await pg.waitForTimeout(100); await pg.keyboard.press("Shift+H"); await pg.waitForTimeout(100);
ok("mirroring twice gives the same triangles", await pg.evaluate(b => { const a = JSON.parse(b), c = PF.S.project.sprites[PF.S.sprite].frames[0].layers.body; return a.length === c.length && a.every((s, i) => Math.abs(s.x - c[i].x) < 0.11 && Math.abs((s.r || 0) - (c[i].r || 0)) < 0.11); }, before));
await pg.keyboard.press("Control+z"); await pg.keyboard.press("Control+z");
await pg.keyboard.press("Control+i"); await pg.waitForTimeout(200); await choose(pic1); await pg.waitForTimeout(300); await pg.keyboard.press("Escape"); await pg.waitForTimeout(600);
ok("Esc closes import while working", await pg.locator(".dialog.on").count() === 0);

// one-file export
await pg.keyboard.press("Control+e"); await pg.waitForTimeout(300);
await pg.screenshot({ path: shots + "export_onefile.png" });
ok("export shows one-file section", await pg.locator(".dialog.on >> text=One file for the game").count() === 1);
await pg.fill(".dialog.on input[placeholder] >> nth=0", "abc").catch(() => {});
const tplInput = pg.locator(".dialog.on .row", { hasText: "Image template Index" }).locator("input").first();
await tplInput.fill("12345"); await tplInput.dispatchEvent("change");
const sel = pg.locator(".dialog.on .showlist select").first(); await sel.selectOption(v.name);
const [dl] = await Promise.all([pg.waitForEvent("download"), pg.click(".dialog.on >> text=Download spriteforge.lua")]);
const path = shots + "spriteforge.lua"; await dl.saveAs(path);
const lua = fs.readFileSync(path, "utf8");
ok("download is spriteforge.lua", dl.suggestedFilename() === "spriteforge.lua");
ok("bundle has template and sprite", lua.includes("local TEMPLATE = 12345") && lua.includes('sprite = "' + v.name + '"'));
ok("bundle holds runtime and start", lua.includes("local Px = (function()") && lua.includes("function OnStart"));
await pg.keyboard.press("Escape");

await pg.click(".helpbtn"); await pg.waitForTimeout(300);
ok("guide one-file section", await pg.locator("text=The easiest way is one file").count() >= 1);
await pg.screenshot({ path: shots + "guide_onefile.png", fullPage: false });
console.log("errors:", errs.length ? errs : "none");
await b.close();
process.exit(fails || errs.length ? 1 : 0);
