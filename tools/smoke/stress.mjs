import pw from "/opt/npm-tools/node_modules/playwright/index.js"; const { chromium } = pw;
const shots = new URL("./shots/", import.meta.url).pathname;
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } }); const pg = await ctx.newPage();
const errs = []; pg.on("pageerror", e => errs.push(e.message));
await pg.goto("http://localhost:8765/index.html"); await pg.waitForTimeout(600);
await pg.getByRole("button", { name: "Load the sample project" }).click(); await pg.waitForTimeout(300);
const t0 = await pg.evaluate(() => {
  const S = PF.S, W = 256, H = 256, keys = [];
  for (let i = 0; i < 30; i++) { const k = "c" + (i + 1); keys.push(k); S.project.palettes.base[k] = [200 - i * 5, 100 + i * 4, 40 + i * 6, 255]; }
  const g = []; let seed = 3; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < H; y++) { const row = []; for (let x = 0; x < W; x++) row.push(keys[Math.floor((Math.sin(x / 13) + Math.cos(y / 11) + 2) * 6 + r() * 4) % 30]); g.push(row); }
  S.project.sprites.big = { name: "big", w: W, h: H, ax: 128, ay: 255, layers: [{ name: "body", visible: true, separate: false }], frames: [{ layers: { body: g } }], fps: 8, lod: false, nine: null, tiles: false };
  S.sprite = "big"; S.fitPending = true;
  const t = performance.now(); PF.commit(); return performance.now() - t;
});
console.log("commit+render ms:", t0.toFixed(0));
await pg.waitForTimeout(500);
const fps = await pg.evaluate(() => new Promise(res => { let n = 0; const s = performance.now(); const f = () => { n++; if (performance.now() - s < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }));
console.log("idle fps:", fps);
const box = await pg.locator("#draw").boundingBox();
const tm = Date.now(); for (let i = 0; i < 60; i++) await pg.mouse.move(box.x + 10 + i * 4, box.y + 50 + i * 3); console.log("60 hover moves ms:", Date.now() - tm);
const ts = Date.now(); await pg.mouse.down(); for (let i = 0; i < 30; i++) await pg.mouse.move(box.x + 100 + i * 5, box.y + 100); await pg.mouse.up(); console.log("30-step stroke + commit ms:", Date.now() - ts);
await pg.waitForTimeout(3000);
console.log("cost:", await pg.evaluate(() => PF.S.cost), "storage KB:", await pg.evaluate(() => Math.round((localStorage.getItem("pixforge.project") || "").length / 1024)));
await pg.screenshot({ path: shots + "big.png" });
const tr = Date.now(); await pg.reload(); await pg.waitForFunction(() => window.PF && document.querySelector(".doctab"), null, { timeout: 30000 }); console.log("reload until UI ms:", Date.now() - tr);
await pg.waitForTimeout(1500); await pg.screenshot({ path: shots + "big_reload.png" });
console.log("errors", errs);
await b.close();
