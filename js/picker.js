// SpriteForge - colour picker: HSV square + hue strip + alpha + hex, no dependencies.
export function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) { if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return [h, max ? d / max : 0, max];
}
export function hsvToRgb(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  let r, g, b;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
export const toHex = c => "#" + c.slice(0, 3).map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
export const fromHex = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h.trim()); return m ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)] : null; };

// Creates the picker DOM. onChange([r,g,b,a]) fires on every change.
export function createPicker(initial, onChange, labels = {}) {
  let [h, s, v] = rgbToHsv(initial[0], initial[1], initial[2]);
  let a = initial[3] ?? 255;
  const root = document.createElement("div"); root.className = "picker";
  const sv = document.createElement("canvas"); sv.width = 200; sv.height = 160; sv.className = "picker-sv";
  const hue = document.createElement("canvas"); hue.width = 200; hue.height = 16; hue.className = "picker-hue";
  const alpha = document.createElement("input"); alpha.type = "range"; alpha.min = 0; alpha.max = 255; alpha.value = a; alpha.style.width = "200px";
  const hex = document.createElement("input"); hex.type = "text"; hex.style.width = "76px"; hex.className = "mono";
  const rgbRow = document.createElement("div"); rgbRow.className = "row";
  const rgbIn = ["R", "G", "B"].map(l => { const i = document.createElement("input"); i.type = "number"; i.min = 0; i.max = 255; i.style.width = "48px"; i.title = l; return i; });
  const swatch = document.createElement("div"); swatch.className = "picker-swatch";
  const alphaLabel = document.createElement("span"); alphaLabel.className = "help";
  const drawSv = () => {
    const ctx = sv.getContext("2d");
    const base = hsvToRgb(h, 1, 1);
    const gx = ctx.createLinearGradient(0, 0, 200, 0); gx.addColorStop(0, "#fff"); gx.addColorStop(1, `rgb(${base[0]},${base[1]},${base[2]})`);
    ctx.fillStyle = gx; ctx.fillRect(0, 0, 200, 160);
    const gy = ctx.createLinearGradient(0, 0, 0, 160); gy.addColorStop(0, "rgba(0,0,0,0)"); gy.addColorStop(1, "#000");
    ctx.fillStyle = gy; ctx.fillRect(0, 0, 200, 160);
    ctx.strokeStyle = v > 0.5 ? "#000" : "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s * 200, (1 - v) * 160, 6, 0, Math.PI * 2); ctx.stroke();
  };
  const drawHue = () => {
    const ctx = hue.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 200, 0);
    for (let i = 0; i <= 6; i++) { const c = hsvToRgb(i * 60 % 360, 1, 1); g.addColorStop(i / 6, `rgb(${c[0]},${c[1]},${c[2]})`); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, 200, 16);
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.strokeRect(h / 360 * 200 - 2, 1, 4, 14);
  };
  const current = () => { const c = hsvToRgb(h, s, v); return [c[0], c[1], c[2], a]; };
  const sync = (fromRgb, silent) => {
    const c = current();
    if (!fromRgb) { hex.value = toHex(c); rgbIn.forEach((i, k) => i.value = c[k]); }
    swatch.style.background = `linear-gradient(rgba(${c[0]},${c[1]},${c[2]},${a / 255}),rgba(${c[0]},${c[1]},${c[2]},${a / 255})), repeating-conic-gradient(#666 0 25%, #333 0 50%) 0 0/10px 10px`;
    alphaLabel.textContent = (labels.alpha || "Alpha") + " " + a;
    drawSv(); drawHue();
    if (!silent) onChange(c);
  };
  const setRgb = (r, g, b) => { [h, s, v] = rgbToHsv(r, g, b); sync(false); };
  let dragSv = false, dragHue = false;
  const svAt = e => { const r = sv.getBoundingClientRect(); s = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); v = 1 - Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)); sync(false); };
  const hueAt = e => { const r = hue.getBoundingClientRect(); h = Math.max(0, Math.min(359.99, (e.clientX - r.left) / r.width * 360)); sync(false); };
  sv.onmousedown = e => { dragSv = true; svAt(e); }; hue.onmousedown = e => { dragHue = true; hueAt(e); };
  window.addEventListener("mousemove", e => { if (dragSv) svAt(e); if (dragHue) hueAt(e); });
  window.addEventListener("mouseup", () => { dragSv = dragHue = false; });
  alpha.oninput = () => { a = +alpha.value; sync(false); };
  hex.onchange = () => { const c = fromHex(hex.value); if (c) setRgb(...c); };
  rgbIn.forEach(i => i.onchange = () => { setRgb(+rgbIn[0].value || 0, +rgbIn[1].value || 0, +rgbIn[2].value || 0); });
  const row1 = document.createElement("div"); row1.className = "row"; row1.append(swatch, hex, ...rgbIn);
  const row2 = document.createElement("div"); row2.className = "row"; row2.append(alphaLabel, alpha);
  root.append(sv, hue, row1, row2);
  sync(false, true);
  return { el: root, get: current, set: (c) => { [h, s, v] = rgbToHsv(c[0], c[1], c[2]); a = c[3] ?? 255; alpha.value = a; sync(false, true); } };
}

// Lospec-style quick palettes (public domain / CC0 style ramps) for beginners.
export const PRESET_PALETTES = {
  "Soft 8": ["#2b2b3a", "#5a5a7a", "#8fa0b8", "#e8e8e0", "#d95f5f", "#f2b05e", "#7bc96f", "#5aa9e6"],
  "Warm earth": ["#3b2a20", "#6b4a32", "#a0714b", "#d9a66b", "#f2d7a2", "#8c3b2e", "#c7643f", "#e8a55a"],
  "Cool night": ["#0f1020", "#262b4d", "#3f5a8a", "#6c9bd1", "#a9d6f5", "#f5f3e5", "#c84e7b", "#7bd3a4"],
  "Gameboy": ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"],
  "Pico-ish": ["#000000", "#1d2b53", "#7e2553", "#008751", "#ab5236", "#5f574f", "#c2c3c7", "#fff1e8", "#ff004d", "#ffa300", "#ffec27", "#00e436", "#29adff", "#83769c", "#ff77a8", "#ffccaa"],
};
