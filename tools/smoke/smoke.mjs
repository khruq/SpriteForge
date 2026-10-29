import pw from "/opt/npm-tools/node_modules/playwright/index.js"; const { chromium } = pw;
const shots = new URL("./shots/", import.meta.url).pathname;
const b = await chromium.launch(); const errs = [];
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const pg = await ctx.newPage();
let lastOk = ""; pg.on("pageerror", e => errs.push("pageerror after [" + lastOk + "]: " + e.stack.split("\n").slice(0, 6).join(" | ")));
pg.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text()); });
const ok = (name, cond) => { lastOk = name; console.log((cond ? "PASS " : "FAIL ") + name); };
await pg.goto("http://localhost:8765/index.html"); await pg.waitForTimeout(800);
ok("welcome shown", await pg.locator(".box.welcome").count() === 1);
await pg.screenshot({ path: shots + "welcome.png" });
await pg.getByRole("button", { name: "Load the sample project" }).click(); await pg.waitForTimeout(400);
await pg.screenshot({ path: shots + "draw.png" });
const tool = () => pg.evaluate(() => PF.S.tool);
const key = (k, code, mods = {}) => pg.evaluate(([k, code, mods]) => document.dispatchEvent(new KeyboardEvent("keydown", { key: k, code, bubbles: true, ...mods })), [k, code, mods]);
await key("и", "KeyB"); await key("у", "KeyE"); ok("Cyrillic E -> eraser", await tool() === "eraser");
await key("п", "KeyG"); ok("Cyrillic G -> fill", await tool() === "fill");
await key("с", "KeyC"); ok("Cyrillic C -> ellipse", await tool() === "ellipse");
await pg.keyboard.press("b"); ok("b -> pencil", await tool() === "pencil");
// focus a checkbox then press a key: must still work
await pg.click(".tbtn >> nth=7"); await pg.keyboard.press("l"); ok("after toolbar click L -> line", await tool() === "line");
const zoom0 = await pg.evaluate(() => PF.S.zoom); await pg.keyboard.press("Equal"); ok("+ zooms in", await pg.evaluate(() => PF.S.zoom) > zoom0);
await pg.keyboard.press("Minus"); ok("- zooms out", await pg.evaluate(() => PF.S.zoom) === zoom0);
const f0 = await pg.evaluate(() => PF.S.frame); await pg.keyboard.press("Period"); ok(". next frame", await pg.evaluate(() => PF.S.frame) === f0 + 1);
await pg.keyboard.press("ArrowLeft"); ok("ArrowLeft prev frame", await pg.evaluate(() => PF.S.frame) === f0);
const k1 = await pg.evaluate(() => [PF.S.key, PF.S.key2]); await pg.keyboard.press("x"); const k2 = await pg.evaluate(() => [PF.S.key, PF.S.key2]); ok("X swaps colours", k1[0] === k2[1] && k1[1] === k2[0]); await pg.keyboard.press("x");
// draw a pixel with pencil and undo
await pg.keyboard.press("b");
const box = await pg.locator("#draw").boundingBox(); const z = await pg.evaluate(() => PF.S.zoom);
const before = await pg.evaluate(() => JSON.stringify(PF.S.project.sprites.potion.frames[0].layers.body));
await pg.mouse.click(box.x + z * 0.5, box.y + z * 0.5);
const after = await pg.evaluate(() => JSON.stringify(PF.S.project.sprites.potion.frames[0].layers.body));
ok("pencil paints", before !== after);
await pg.keyboard.press("Control+z"); ok("Ctrl+Z undoes", await pg.evaluate(() => JSON.stringify(PF.S.project.sprites.potion.frames[0].layers.body)) === before);
await key("я", "KeyZ", { ctrlKey: true }); 
// rectangle drag
await pg.keyboard.press("u"); await pg.mouse.move(box.x + z * 0.5, box.y + z * 0.5); await pg.mouse.down(); await pg.mouse.move(box.x + z * 4.5, box.y + z * 3.5, { steps: 4 }); await pg.mouse.up();
ok("rectangle drawn", await pg.evaluate(() => JSON.stringify(PF.S.project.sprites.potion.frames[0].layers.body)) !== before);
await pg.keyboard.press("Control+z");
// menu
await pg.click(".menu-head >> text=Edit"); await pg.waitForTimeout(150); ok("Edit menu opens", await pg.locator(".dropdown .mi").count() > 5);
await pg.screenshot({ path: shots + "menu.png" });
await pg.keyboard.press("Escape"); ok("Esc closes menu", await pg.locator(".dropdown").count() === 0);
await pg.keyboard.press("Shift+Slash"); await pg.waitForTimeout(150); ok("? opens shortcuts", await pg.locator("table.keys").count() > 3);
await pg.screenshot({ path: shots + "shortcuts.png" }); await pg.keyboard.press("Escape");
await pg.keyboard.press("Control+p"); await pg.waitForTimeout(150); ok("Ctrl+P props", await pg.locator(".dialog.on").count() === 1);
await pg.screenshot({ path: shots + "props.png" }); await pg.keyboard.press("Escape");
await pg.dblclick(".sw.on"); await pg.waitForTimeout(150); ok("picker opens", await pg.locator(".picker").count() === 1);
await pg.screenshot({ path: shots + "picker.png" }); await pg.keyboard.press("Escape");

// v0.5 checks
await pg.keyboard.press("F2"); await pg.waitForTimeout(150); ok("F2 opens in-page rename", await pg.locator("#modal.on .modal-input").count() === 1);
await pg.screenshot({ path: shots + "modal.png" });
await pg.keyboard.press("Escape"); ok("Esc closes modal", await pg.locator("#modal.on").count() === 0);
await pg.keyboard.press("Control+Alt+n"); await pg.waitForTimeout(150); ok("new sprite dialog with gallery", await pg.locator(".gcard").count() >= 10);
await pg.screenshot({ path: shots + "newsprite.png" });
await pg.locator(".gcard", { hasText: "sword" }).click(); await pg.waitForTimeout(300); ok("preset added", await pg.evaluate(() => PF.S.sprite) === "sword");
await pg.screenshot({ path: shots + "sword.png" });
const v0 = await pg.evaluate(() => PF.S.project.sprites.sword.layers[0].visible); await pg.click(".layer .eye"); await pg.keyboard.press("Control+z"); ok("undo layer visibility", await pg.evaluate(() => PF.S.project.sprites.sword.layers[0].visible) === v0);
await pg.keyboard.press("Control+e"); await pg.waitForTimeout(200); ok("export dialog", await pg.locator(".meter").count() === 1); await pg.screenshot({ path: shots + "export.png" }); await pg.keyboard.press("Escape");
await pg.keyboard.press("Control+i"); await pg.waitForTimeout(150);
await pg.setInputFiles("input[type=file]", []).catch(() => {});
const nums = pg.locator(".dialog.on input[type=number]"); await nums.nth(0).fill("700"); await nums.nth(0).dispatchEvent("change"); ok("import grid clamped", +(await nums.nth(0).inputValue()) <= 256);
await pg.keyboard.press("Escape");
// rebind Pencil to P
await pg.keyboard.press("Shift+Slash"); await pg.waitForTimeout(150);
await pg.locator("table.keys tr", { hasText: "Pencil" }).first().locator("button", { hasText: "Change" }).click();
await pg.keyboard.press("p"); await pg.waitForTimeout(100); await pg.keyboard.press("Escape");
await pg.keyboard.press("e"); await pg.keyboard.press("p"); ok("rebound P -> pencil", await tool() === "pencil");
await pg.evaluate(() => localStorage.removeItem("pixforge.keys"));
await pg.click(".ws-animate"); await pg.waitForTimeout(200); await pg.screenshot({ path: shots + "animate2.png" });
await pg.click(".ws-draw");

for (const tab of ["animate", "behave", "guide", "draw"]) { if (tab === "guide") await pg.click(".helpbtn"); else await pg.click(".ws-" + tab); await pg.waitForTimeout(300); await pg.screenshot({ path: shots + tab + ".png" }); }
await pg.keyboard.press("Alt+2"); ok("Alt+2 -> animate", await pg.evaluate(() => PF.S.tab) === "animate");
await pg.keyboard.press("Alt+1");
const langs = ["zh-CN", "ja", "ru", "th", "en"];
for (const l of langs) { await pg.evaluate(l => localStorage.setItem("pixforge.lang", l), l); await pg.reload(); await pg.waitForTimeout(400); console.log(l, (await pg.locator(".menu-head").allInnerTexts()).join(" | ")); if (l === "ru") await pg.screenshot({ path: shots + "ru.png" }); }
console.log("errors:", errs.length ? errs : "none");
await b.close();
