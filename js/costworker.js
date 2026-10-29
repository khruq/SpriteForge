// SpriteForge - counts rectangles in the background so drawing stays smooth on big sprites.
import { encodeProject } from "./export.js?v=1.7";
onmessage = e => {
  const { id, project, name, frame } = e.data;
  try {
    const enc = encodeProject(project);
    const mine = enc.entries.filter(x => x.name === name || x.name.startsWith(name + "#"));
    postMessage({ id, cost: (mine[frame] || mine[0] || { count: 0 }).count, total: enc.total });
  } catch (err) { postMessage({ id, error: String(err && err.message || err) }); }
};
