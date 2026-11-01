// SpriteForge - fits shapes to a picture in the background and reports progress.
import { fitShapes } from "./shapes.js?v=1.0";
onmessage = e => {
  const { data, w, h, opts } = e.data;
  let last = 0;
  try {
    const res = fitShapes(data, w, h, opts, (done, total, shapes, palette) => {
      const now = Date.now();
      if (now - last < 120) return;
      last = now;
      postMessage({ done, total, shapes, palette });
    });
    postMessage({ done: res.shapes.length, total: opts.count, placed: res.placed, shapes: res.shapes, palette: res.palette, final: true });
  } catch (err) { postMessage({ error: String(err && err.message || err) }); }
};
