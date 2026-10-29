import pw from "/opt/npm-tools/node_modules/playwright/index.js"; const { chromium } = pw;
const shots = new URL("./shots/", import.meta.url).pathname;
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; pg.on("pageerror", e => errs.push(e.message + " | " + (e.stack || "").split("\n")[1]));
const ok = (n, c) => console.log((c ? "PASS " : "FAIL ") + n);
await pg.goto("http://localhost:8765/index.html"); await pg.waitForTimeout(600);
ok("title", (await pg.title()).startsWith("SpriteForge"));
await pg.screenshot({ path: shots + "welcome.png" });
await pg.getByRole("button", { name: /^Drawing/ }).first().click(); await pg.waitForTimeout(300);
ok("dialog in drawing mode", await pg.locator(".kindbtn.on", { hasText: "Drawing" }).count() === 1);
await pg.screenshot({ path: shots + "newdrawing.png" });
await pg.getByRole("button", { name: "Create" }).click(); await pg.waitForTimeout(400);
const shapes = () => pg.evaluate(() => PF.S.project.sprites[PF.S.sprite].frames[PF.S.frame].layers.body.length);
ok("vector sprite", await pg.evaluate(() => PF.S.project.sprites[PF.S.sprite].kind) === "vector");
const box = await pg.locator("#draw").boundingBox();
const P = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];
// brush stroke
await pg.mouse.move(...P(0.2, 0.3)); await pg.mouse.down();
for (let i = 0; i <= 20; i++) await pg.mouse.move(...P(0.2 + i * 0.03, 0.3 + Math.sin(i / 3) * 0.1));
await pg.mouse.up(); await pg.waitForTimeout(200);
ok("brush adds a stroke", await shapes() === 1);
const pts = await pg.evaluate(() => PF.S.project.sprites[PF.S.sprite].frames[0].layers.body[0].p.length / 2); console.log("  stroke points after smoothing:", pts);
// filled ellipse
await pg.keyboard.press("c"); await pg.click("text=Filled"); await pg.mouse.move(...P(0.4, 0.55)); await pg.mouse.down(); await pg.mouse.move(...P(0.7, 0.85), { steps: 5 }); await pg.mouse.up(); await pg.waitForTimeout(200);
ok("ellipse", await shapes() === 2);
// rect outline
await pg.keyboard.press("u"); await pg.click("text=Filled"); await pg.mouse.move(...P(0.1, 0.6)); await pg.mouse.down(); await pg.mouse.move(...P(0.35, 0.9), { steps: 5 }); await pg.mouse.up(); await pg.waitForTimeout(200);
ok("rectangle outline", await shapes() === 3);
await pg.screenshot({ path: shots + "drawn.png" });
// select & move
await pg.keyboard.press("v"); const before = await pg.evaluate(() => JSON.stringify(PF.S.project.sprites[PF.S.sprite].frames[0].layers.body[1]));
await pg.mouse.move(...P(0.55, 0.7)); await pg.mouse.down(); await pg.mouse.move(...P(0.6, 0.6), { steps: 4 }); await pg.mouse.up(); await pg.waitForTimeout(200);
ok("move shape", (await pg.evaluate(() => JSON.stringify(PF.S.project.sprites[PF.S.sprite].frames[0].layers.body[1]))) !== before);
await pg.keyboard.press("Control+z"); ok("undo move", (await pg.evaluate(() => JSON.stringify(PF.S.project.sprites[PF.S.sprite].frames[0].layers.body[1]))) === before);
// eraser
await pg.keyboard.press("e"); await pg.mouse.click(...P(0.55, 0.7)); await pg.waitForTimeout(200); ok("eraser deletes shape", await shapes() === 2);
await pg.keyboard.press("Control+z");
// animate + export
await pg.click(".ws-animate"); await pg.waitForTimeout(300);
await pg.getByRole("button", { name: "+ Preset…" }).first().click(); await pg.waitForTimeout(600);
await pg.screenshot({ path: shots + "veclib.png" });
await pg.locator(".clipcard", { hasText: "wobble" }).click(); await pg.waitForTimeout(500);
await pg.screenshot({ path: shots + "vecanim.png" });
const lua = await pg.evaluate(() => PF.toLua(PF.S.project));
ok("exports D.V", /D\.V\["drawing"\]=\{/.test(lua) && lua.includes("vector=true"));
await pg.click(".ws-draw"); await pg.keyboard.press("Control+Alt+n"); await pg.waitForTimeout(300);
await pg.locator(".gcard", { hasText: "flower" }).click(); await pg.waitForTimeout(400);
ok("vector preset added", await pg.evaluate(() => PF.S.sprite) === "flower");
await pg.screenshot({ path: shots + "flower.png" });
await pg.click(".helpbtn"); await pg.waitForTimeout(600);
await pg.locator(".card.guide", { hasText: "Drawing mode" }).scrollIntoViewIfNeeded(); await pg.waitForTimeout(400);
await pg.screenshot({ path: shots + "guidevec.png" });
console.log("errors", errs);
await b.close();
