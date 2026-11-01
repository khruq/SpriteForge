// SpriteForge - fits shapes to a picture in the background and reports progress.
import { fitShapes, SOFT } from "./shapes.js?v=1.1";
onmessage = e => {
  const { data, w, h, opts } = e.data;
  let last = 0;
  try {
    const res = fitShapes(data, w, h, opts, (done, total, shapes) => {
      const now = Date.now();
      if (now - last < 120) return;
      last = now;
      const palette = shapes.map(s => { const c = s.col.map(Math.round); return s.o ? c : [c[0], c[1], c[2], SOFT]; });
      postMessage({ done, total, shapes: shapes.map((s, i) => ({ t: s.t, c: i, x: s.x, y: s.y, a: s.a, b: s.b, r: s.r })), palette });
    });
    postMessage({ done: res.shapes.length, total: opts.count, placed: res.placed, shapes: res.shapes, palette: res.palette, final: true });
  } catch (err) { postMessage({ error: String(err && err.message || err) }); }
};
