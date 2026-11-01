import * as M from "./model.js?v=1.1";
import { imageToGrid, cutSheet, asciiToGrid, outline, despeckle, simplify, TILE_NAMES } from "./quantize.js?v=1.1";
import { toLua, toJSON, toBundle, download, encodeProject, spriteCost, spriteToCanvas, fromLua } from "./export.js?v=1.1";
import { decodeRects, rasterize } from "./mesh.js?v=1.1";
import { Actor, drawActor, EASE } from "./sim.js?v=1.1";
import { createPicker, fromHex, PRESET_PALETTES } from "./picker.js?v=1.1";
import { t, lang, setLang, LANGS } from "./i18n.js?v=1.1";
import { PRESETS, PRESET_COLORS, presetGrid } from "./presets.js?v=1.1";
import { CLIP_LIBRARY, CLIP_CATEGORIES, makeClip } from "./clips.js?v=1.1";
import { rasterFrame, drawScaled, bumpRaster } from "./raster.js?v=1.1";
import { SOFT } from "./shapes.js?v=1.1";
import { newVectorSprite, isVector, compileFrame, compileShapes, drawPrims, hitShape, shapeBounds, mapShape, moveShape, scaleShape, simplifyPoints, rectStroke, ellipseStroke, VECTOR_PRESETS, VECTOR_PRESET_COLORS } from "./vector.js?v=1.1";

const $ = s => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "html") e.innerHTML = v; else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k);
  return e;
};
const tip = (label, combo) => combo ? label + "  (" + combo + ")" : label;
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
const fmtCombo = c => !c ? "" : IS_MAC ? c.replace(/Ctrl\+/g, "⌘").replace(/Alt\+/g, "⌥").replace(/Shift\+/g, "⇧") : c;
const kb = id => fmtCombo((CMDS.find(c => c.id === id)?.keys || [])[0] || "");
// Buttons never take keyboard focus, so Space/Enter never re-click them and shortcuts keep working.
const btn = (label, onclick, opts = {}) => {
  const b = el("button", { class: (opts.class || "") + (opts.on ? " on" : ""), title: opts.title || (opts.key ? tip(typeof label === "string" ? label : "", opts.key) : null), onclick }, label);
  b.addEventListener("mousedown", e => e.preventDefault());
  if (opts.disabled) b.disabled = true;
  return b;
};

const ICONS = {
  pencil: '<path d="M11.5 2.5l2 2L5 13H3v-2z"/><path d="M10 4l2 2"/>',
  eraser: '<path d="M9.5 2.5l4 4-6 6H4.5l-2-2z"/><path d="M6 6l4 4"/><path d="M8 13.5h6"/>',
  fill: '<path d="M7 2.5l5.5 5.5-4.5 4.5L2.5 7z"/><path d="M2.5 7h10"/><path d="M14 10.5s1 1.3 1 2a1 1 0 0 1-2 0c0-.7 1-2 1-2z"/>',
  pick: '<path d="M13.5 2.5a1.4 1.4 0 0 0-2 0L10 4 9 3 8 4l4 4 1-1-1-1 1.5-1.5a1.4 1.4 0 0 0 0-2z"/><path d="M9 5l-6 6v2h2l6-6"/>',
  line: '<path d="M3.5 12.5l9-9"/><rect x="1.5" y="11.5" width="3" height="3"/><rect x="11.5" y="1.5" width="3" height="3"/>',
  rect: '<rect x="2.5" y="3.5" width="11" height="9"/>',
  ellipse: '<ellipse cx="8" cy="8" rx="5.5" ry="4.5"/>',
  move: '<path d="M8 1.5v13M1.5 8h13M8 1.5l-2 2M8 1.5l2 2M8 14.5l-2-2M8 14.5l2-2M1.5 8l2-2M1.5 8l2 2M14.5 8l-2-2M14.5 8l-2 2"/>',
  mirror: '<path d="M8 1.5v13" stroke-dasharray="2 2"/><path d="M6 4L2 8l4 4z"/><path d="M10 4l4 4-4 4z"/>',
  onion: '<rect x="2.5" y="2.5" width="8" height="8" opacity=".45"/><rect x="5.5" y="5.5" width="8" height="8"/>',
  grid: '<rect x="2" y="2" width="12" height="12"/><path d="M2 6h12M2 10h12M6 2v12M10 2v12"/>',
  eye: '<path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/>',
  eyeOff: '<path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" opacity=".35"/><path d="M2.5 13.5l11-11"/>',
  swap: '<path d="M4 5.5h8l-2-2M12 10.5H4l2 2"/>',
  play: '<path d="M5 3l8 5-8 5z"/>',
  pause: '<path d="M5.5 3v10M10.5 3v10"/>',
  plus: '<path d="M8 3v10M3 8h10"/>',
  minus: '<path d="M3 8h10"/>',
  copy: '<rect x="2.5" y="5" width="8" height="8.5"/><path d="M5.5 5V2.5h8v8.5H11"/>',
  blank: '<rect x="3.5" y="2.5" width="9" height="11" stroke-dasharray="2 1.5"/>',
  trash: '<path d="M3 4.5h10M6 4.5v-2h4v2M4.5 4.5l.7 9h5.6l.7-9"/>',
  left: '<path d="M10 3L5 8l5 5"/>', right: '<path d="M6 3l5 5-5 5"/>',
  up: '<path d="M3 10l5-5 5 5"/>', down: '<path d="M3 6l5 5 5-5"/>',
  gear: '<circle cx="8" cy="8" r="2.5"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/>',
  fit: '<path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/>',
};
function icon(name, size = 18) {
  const s = document.createElement("span"); s.className = "ico";
  s.innerHTML = `<svg viewBox="0 0 16 16" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round">${ICONS[name]}</svg>`;
  return s;
}
const ts = (s, n) => { const v = n / Math.max(s.w, s.h); return s.kind === "vector" || v < 1 ? v : Math.floor(v); };
const ibtn = (name, onclick, title, opts = {}) => btn(icon(name, opts.size || 16), onclick, { ...opts, class: "ibtn " + (opts.class || ""), title });

const TOOLS = [["pencil", "Pencil", "B"], ["eraser", "Eraser", "E"], ["fill", "Fill", "G"], ["pick", "Pick colour", "I"], ["line", "Line", "L"], ["rect", "Rectangle", "U"], ["ellipse", "Ellipse", "C"], ["move", "Move pixels", "V"]];
const ZOOMS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96];

const S = {
  project: null, sprite: null, frame: 0, layer: 0, key: null, key2: null, editKey: null, tool: "pencil", zoom: 20, mirror: false, onion: true, grid: true, filled: false, brush: 1,
  history: new M.History(), tab: "draw", clip: null, clipTime: 0, playing: false, selKey: null, state: null,
  previewPal: "base", actor: null, drag: null, pan: null, pickerOpen: false, palTab: "base", menu: null, hover: null, lastPx: null,
  spaceDown: false, costTotal: null, vw: 3, smooth: 1, sel: -1, hoverU: null, fitPending: true, centerPending: true, framePlay: false, cost: null,
  open: { preview: true, colours: true, layers: true, cost: true, lua: false },
};

// ---------- persistence ----------
let storageWarned = false;
function autosave() { try { localStorage.setItem("pixforge.project", JSON.stringify(S.project)); } catch (e) { if (!storageWarned) { storageWarned = true; toast(t("The project is too big for the browser storage. Save it to a file (Ctrl+S).")); } } }
function autoload() { try { const x = localStorage.getItem("pixforge.project"); if (x) { const p = JSON.parse(x); if (p.format === "pixforge") return p; } } catch (e) {} return null; }
function snapshot() { S.history.push(S.project); }
function commit() { bumpRaster(); autosave(); renderAll(); }
function undo() { const p = S.history.undo(S.project); if (p) { S.project = p; fixSelection(); commit(); } }
function redo() { const p = S.history.redo(S.project); if (p) { S.project = p; fixSelection(); commit(); } }
function sp() { return S.sprite ? S.project.sprites[S.sprite] : null; }
function migrateProject(p) {
  if (!p || !p.palettes) return p;
  for (const [o, base] of [["hydro", "blue"], ["pyro", "red"], ["electro", "purple"]]) {
    if (!p.palettes[o]) continue;
    let n = base, i = 2; while (p.palettes[n]) n = base + i++;
    p.palettes[n] = p.palettes[o]; delete p.palettes[o];
    for (const c of Object.values(p.clips || {})) for (const tr of c.tracks || []) if (tr.prop === "pal") for (const k of tr.keys) if (k.v === o) k.v = n;
    for (const b of Object.values(p.behaviors || {})) for (const st of Object.values(b.states || {})) if (st.pal === o) st.pal = n;
  }
  return p;
}
function fixSelection() {
  if (S.sprite && !S.project.sprites[S.sprite]) S.sprite = null;
  if (!S.sprite) { S.sprite = Object.keys(S.project.sprites)[0] || null; S.fitPending = true; }
  const s = sp();
  if (s) { S.frame = Math.max(0, Math.min(S.frame, s.frames.length - 1)); S.layer = Math.max(0, Math.min(S.layer, s.layers.length - 1)); }
  if (!S.project.palettes[S.previewPal]) S.previewPal = "base";
  if (!S.project.palettes[S.palTab]) S.palTab = "base";
  const base = S.project.palettes.base;
  if (S.key && !base[S.key]) S.key = Object.keys(base)[0] || null;
  if (S.key2 && !base[S.key2]) S.key2 = null;
  if (S.editKey && !base[S.editKey]) { S.editKey = null; S.pickerOpen = false; }
}
function toast(msg) {
  const tt = el("div", { class: "toast" }, msg); document.body.append(tt);
  setTimeout(() => tt.remove(), 2500);
}
function usedKeysProject(project) { const s = new Set(); for (const spr of Object.values(project.sprites)) for (const k of M.usedKeys(spr)) s.add(k); return s; }
function colorCss(k, pal = S.previewPal) { if (k == null) return null; const c = M.resolveColor(S.project, k, pal); return `rgba(${c[0]},${c[1]},${c[2]},${(c[3] ?? 255) / 255})`; }
function closeDialog() { $("#dialog").classList.remove("on"); }
function dialogOpen() { return $("#dialog").classList.contains("on"); }

// ---------- in-page modal: replaces the browser's prompt() and confirm() ----------
function modal(build) {
  return new Promise(res => {
    const m = $("#modal"); m.innerHTML = "";
    const done = v => { m.classList.remove("on"); m.innerHTML = ""; res(v); };
    const box = build(done);
    m.onmousedown = e => { if (e.target === m) done(null); };
    m.append(box); m.classList.add("on");
    const f = box.querySelector("input, select");
    setTimeout(() => { if (f) { f.focus(); if (f.select) f.select(); } }, 0);
  });
}
function modalOpen() { return $("#modal").classList.contains("on"); }
function ask(label, def = "", opts = {}) {
  return modal(done => {
    const ok = () => { if (opts.pattern) inp.value = latinName(inp.value); const v = inp.value.trim(); if (!v) return; if (opts.pattern && !opts.pattern.test(v)) { err.textContent = opts.patternHelp || t("Letters, digits, _ and - only"); return; } done(opts.type === "number" ? +v : v); };
    const inp = el("input", { type: opts.type || "text", value: def, class: "modal-input", oninput: () => { err.textContent = ""; if (opts.pattern) { const a = inp.selectionStart, b = inp.value, c = latinName(b); if (c !== b) { inp.value = c; const q = a + c.length - b.length; try { inp.setSelectionRange(q, q); } catch (e) {} } } }, onkeydown: e => { if (e.key === "Enter") { e.preventDefault(); ok(); } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(null); } } });
    const err = el("div", { class: "warn" });
    return el("div", { class: "mbox" }, el("div", { class: "mtitle" }, label), opts.hint ? el("div", { class: "help" }, opts.hint) : null, inp, err,
      el("div", { class: "row end" }, btn(t("Cancel"), () => done(null), { class: "mcancel" }), btn("OK", ok, { class: "primary mok" })));
  });
}
function sure(msg, okLabel) {
  return modal(done => el("div", { class: "mbox" }, el("div", { class: "mtitle" }, msg),
    el("div", { class: "row end" }, btn(t("Cancel"), () => done(false), { class: "mcancel" }), btn(okLabel || "OK", () => done(true), { class: "primary mok" }))));
}
function choose(label, options) {
  return modal(done => el("div", { class: "mbox" }, el("div", { class: "mtitle" }, label),
    el("div", { class: "choices" }, ...options.map(([v, text, sub]) => btn([el("b", {}, text), sub ? el("span", { class: "help" }, sub) : null], () => done(v), { class: "choice" }))),
    el("div", { class: "row end" }, btn(t("Cancel"), () => done(null), { class: "mcancel" }))));
}
const NAME_RE = /^[A-Za-z][\w-]*$/;
const CYR = { "а": "a", "б": "b", "в": "v", "г": "h", "ґ": "g", "д": "d", "е": "e", "є": "ye", "ж": "zh", "з": "z", "и": "y", "і": "i", "ї": "yi", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch", "ь": "", "ю": "yu", "я": "ya", "ы": "y", "э": "e", "ё": "yo", "ъ": "", "'": "", "’": "" };
function latinName(v) {
  return v.replace(/[\u0400-\u04ff'’]/g, ch => { const l = ch.toLowerCase(), r = CYR[l]; if (r == null) return ""; return ch !== l && r ? r[0].toUpperCase() + r.slice(1) : r; }).replace(/\s+/g, "_");
}

// ---------- commands (one table drives menus, hotkeys and the shortcut list) ----------
const CMDS = [];
function cmd(id, label, keys, run, opts = {}) { CMDS.push({ id, label, keys, run, ...opts }); }
const CMD = id => CMDS.find(c => c.id === id);
const keysOf = id => CMD(id)?.keys || [];
const DEFAULT_KEYS = {};
const RESERVED = new Set(["Ctrl+W", "Ctrl+T", "Ctrl+N", "Ctrl+Shift+N", "Ctrl+Shift+T", "Ctrl+Shift+W", "Ctrl+Tab", "Ctrl+Shift+Tab", "Alt+F4", "Ctrl+Q", "F5", "Ctrl+R", "F11", "F12"]);
let capturing = false;
function keyOverrides() { try { return JSON.parse(localStorage.getItem("pixforge.keys") || "{}"); } catch (e) { return {}; } }
function applyKeyOverrides() { const o = keyOverrides(); for (const c of CMDS) { if (!DEFAULT_KEYS[c.id]) DEFAULT_KEYS[c.id] = c.keys.slice(); c.keys = Array.isArray(o[c.id]) ? o[c.id].slice() : DEFAULT_KEYS[c.id].slice(); } }
function setBinding(id, combos) {
  const o = keyOverrides();
  for (const c of CMDS) if (c.id !== id && combos.some(k => c.keys.includes(k))) { o[c.id] = c.keys.filter(k => !combos.includes(k)); toast(t("{key} was used by \"{name}\" - moved here", { key: fmtCombo(combos[0]), name: t(c.label) })); }
  o[id] = combos;
  try { localStorage.setItem("pixforge.keys", JSON.stringify(o)); } catch (e) {}
  applyKeyOverrides(); buildMenubar(); buildToolbar();
}
function resetBindings() { try { localStorage.removeItem("pixforge.keys"); } catch (e) {} applyKeyOverrides(); buildMenubar(); buildToolbar(); }
function registerCommands() {
  const hasS = () => !!sp();
  const draw = () => S.tab === "draw" && !!sp();
  cmd("newProject", "New project", [], async () => { if (await sure(t("Start a new empty project? Your current project stays in the browser until you overwrite it."))) { snapshot(); S.project = M.newProject(); S.sprite = null; commit(); } });
  cmd("open", "Open project…", ["Ctrl+O"], openProject);
  cmd("save", "Save project", ["Ctrl+S"], saveProject);
  cmd("import", "Import image…", ["Ctrl+I"], openImport);
  cmd("export", "Export…", ["Ctrl+E"], openExport);
  cmd("exportLua", "Download pixdata.lua", [], exportLua);
  cmd("settings", "Settings…", ["Ctrl+,"], openSettings);
  cmd("exportPng", "Export PNG", ["Ctrl+Shift+E"], exportPng, { when: hasS });
  cmd("sample", "Load the sample project", [], loadSample);
  cmd("undo", "Undo", ["Ctrl+Z"], undo);
  cmd("redo", "Redo", ["Ctrl+Shift+Z", "Ctrl+Y"], redo);
  cmd("clear", "Clear layer", ["Delete", "Backspace"], () => { const g = curGrid(); snapshot(); if (isVector(sp())) { if (S.tool === "move" && S.sel >= 0 && g[S.sel]) { g.splice(S.sel, 1); S.sel = -1; } else g.length = 0; } else for (const r of g) r.fill(null); commit(); }, { when: draw });
  cmd("flipH", "Flip horizontally", ["Shift+H"], () => { snapshot(); flipH(); commit(); }, { when: draw });
  cmd("flipV", "Flip vertically", ["Shift+V"], () => { snapshot(); flipV(); commit(); }, { when: draw });
  cmd("outline", "Outline", [], doOutline, { when: () => draw() && !isVector(sp()) });
  cmd("despeckle", "Despeckle", [], () => { snapshot(); despeckle(curGrid(), sp().w, sp().h); commit(); }, { when: () => draw() && !isVector(sp()) });
  cmd("simplify", "Simplify colours…", [], doSimplify, { when: () => draw() && !isVector(sp()) });
  cmd("newSprite", "New sprite…", ["Ctrl+Alt+N"], () => openNewSprite());
  cmd("dupSprite", "Duplicate sprite", [], dupSprite, { when: hasS });
  cmd("renameSprite", "Rename sprite", ["F2"], renameSprite, { when: hasS });
  cmd("delSprite", "Delete sprite", [], delSprite, { when: hasS });
  cmd("props", "Sprite properties…", ["Ctrl+P"], openProps, { when: hasS });
  cmd("scaleUp", "Scale sprite ×2", [], () => scaleSprite(2), { when: () => hasS() && (isVector(sp()) || (sp().w * 2 <= M.MAX_SIZE && sp().h * 2 <= M.MAX_SIZE)) });
  cmd("scaleDown", "Scale sprite ×½", [], () => scaleSprite(0.5), { when: () => hasS() && sp().w >= 2 && sp().h >= 2 });
  cmd("dupFrame", "New frame (copy)", ["Alt+N"], dupFrame, { when: hasS });
  cmd("emptyFrame", "New empty frame", ["Alt+Shift+N"], emptyFrame, { when: hasS });
  cmd("delFrame", "Delete frame", ["Alt+C"], delFrame, { when: () => hasS() && sp().frames.length > 1 });
  cmd("prevFrame", "Previous frame", [",", "ArrowLeft"], () => goFrame(S.frame - 1), { when: draw });
  cmd("nextFrame", "Next frame", [".", "ArrowRight"], () => goFrame(S.frame + 1), { when: draw });
  cmd("firstFrame", "First frame", ["Home"], () => goFrame(0), { when: draw });
  cmd("lastFrame", "Last frame", ["End"], () => goFrame(sp().frames.length - 1), { when: draw });
  cmd("playFrames", "Play frames", ["Enter"], () => { S.framePlay = !S.framePlay; buildDraw(); }, { when: draw, on: () => S.framePlay });
  cmd("newLayer", "New layer", ["Alt+L"], newLayer, { when: hasS });
  cmd("delLayer", "Delete layer", [], delLayer, { when: () => hasS() && sp().layers.length > 1 });
  cmd("renameLayer", "Rename layer", [], () => renameLayer(S.layer), { when: hasS });
  cmd("layerUp", "Move layer up", [], () => moveLayer(1), { when: hasS });
  cmd("layerDown", "Move layer down", [], () => moveLayer(-1), { when: hasS });
  cmd("zoomIn", "Zoom in", ["+"], () => zoomStep(1), { when: draw });
  cmd("zoomOut", "Zoom out", ["-"], () => zoomStep(-1), { when: draw });
  cmd("fit", "Fit to window", ["F"], () => { fitZoom(); drawGrid(); centerView(); updateStatus(); }, { when: draw });
  cmd("toggleGrid", "Pixel grid", ["Ctrl+'"], () => { S.grid = !S.grid; refreshDraw(); }, { on: () => S.grid });
  cmd("toggleOnion", "Onion skin", ["O"], () => { S.onion = !S.onion; refreshDraw(); }, { on: () => S.onion });
  cmd("toggleMirror", "Mirror drawing", ["Shift+M"], () => { S.mirror = !S.mirror; refreshDraw(); }, { on: () => S.mirror });
  cmd("wsDraw", "Draw", ["Alt+1"], () => setTab("draw"), { on: () => S.tab === "draw" });
  cmd("wsAnimate", "Animate", ["Alt+2"], () => setTab("animate"), { on: () => S.tab === "animate" });
  cmd("wsBehave", "Behave", ["Alt+3"], () => setTab("behave"), { on: () => S.tab === "behave" });
  cmd("wsGuide", "Guide", ["F1", "Alt+4"], () => setTab("guide"), { on: () => S.tab === "guide" });
  cmd("shortcuts", "Keyboard shortcuts", ["?"], showShortcuts);
  cmd("docs", "Docs", [], () => window.open("docs/index.html", "_blank"));
  cmd("github", "Source code on GitHub", [], () => window.open("https://github.com/khruq/SpriteForge", "_blank", "noopener"));
  cmd("welcome", "Welcome screen", [], showWelcome);
  cmd("about", "About SpriteForge", [], openAbout);
  for (const [id, label, key] of TOOLS) cmd("tool_" + id, label, [key], () => setTool(id), { when: draw, group: "tools" });
  cmd("swap", "Swap primary and secondary colour", ["X"], swapColors, { when: draw, group: "tools" });
  cmd("brushDown", "Smaller brush", ["["], () => setBrush(S.brush - 1), { when: draw, group: "tools" });
  cmd("brushUp", "Bigger brush", ["]"], () => setBrush(S.brush + 1), { when: draw, group: "tools" });
  cmd("play", "Play / pause (Animate)", ["Space", "Enter"], () => { S.playing = !S.playing; buildAnimate(); }, { when: () => S.tab === "animate", group: "hidden" });
  for (const [d, dx, dy] of [["Left", -1, 0], ["Right", 1, 0], ["Up", 0, -1], ["Down", 0, 1]]) cmd("nudge" + d, "Nudge the layer", ["Shift+Arrow" + d], () => { snapshot(); shift(dx, dy); commit(); }, { when: draw, group: "hidden" });
  applyKeyOverrides();
}

// ---------- keyboard: keys are read by physical position, so any keyboard layout works ----------
const CODE_SYM = { BracketLeft: "[", BracketRight: "]", Comma: ",", Period: ".", Equal: "+", NumpadAdd: "+", Minus: "-", NumpadSubtract: "-", Quote: "'", Slash: "/", Backquote: "`" };
const SHIFTLESS = new Set(["?", "+"]);
function keyName(e) {
  const c = e.code || "";
  if (/^[a-z]$/i.test(e.key)) return e.key.toUpperCase();
  if (c.startsWith("Key")) return c.slice(3);
  if (c.startsWith("Digit")) return c.slice(5);
  if (/^Numpad\d$/.test(c)) return c.slice(6);
  if (c === "Slash" && e.shiftKey) return "?";
  if (CODE_SYM[c]) return CODE_SYM[c];
  if (e.key === " " || c === "Space") return "Space";
  return e.key;
}
function comboOf(e) {
  const k = keyName(e); let s = "";
  if (e.ctrlKey || e.metaKey) s += "Ctrl+";
  if (e.altKey) s += "Alt+";
  if (e.shiftKey && !SHIFTLESS.has(k)) s += "Shift+";
  return s + k;
}
function onKeyDown(e) {
  const tg = e.target, tag = tg.tagName || "";
  const typing = tag === "TEXTAREA" || tag === "SELECT" || tg.isContentEditable || (tag === "INPUT" && !["checkbox", "radio", "range", "button", "color", "file"].includes(tg.type));
  const combo = comboOf(e);
  if (capturing) return;
  if (modalOpen()) {
    if (combo === "Escape") { e.preventDefault(); $("#modal .mcancel")?.click(); }
    else if (combo === "Enter" && tag !== "INPUT") { e.preventDefault(); $("#modal .mok")?.click(); }
    return;
  }
  if (combo === "Escape") { if (typing) tg.blur(); closeDialog(); S.menu = null; S.pickerOpen = false; renderAll(); return; }
  const isUndo = keysOf("undo").includes(combo) || keysOf("redo").includes(combo);
  if (typing && isUndo && (tg.type === "number" || tag === "SELECT")) { tg.blur(); }
  else if (typing) return;
  if (tag === "INPUT") tg.blur();
  if (dialogOpen()) return;
  if (combo === "Space" && S.tab === "draw") { e.preventDefault(); if (!S.spaceDown) { S.spaceDown = true; updateCursor(); } return; }
  const c = CMDS.find(x => x.keys.includes(combo) && (!x.when || x.when()));
  if (c) { e.preventDefault(); if (S.menu) { S.menu = null; buildMenubar(); } c.run(); return; }
  if (/^[1-9]$/.test(combo) && S.tab === "draw") { const keys = Object.keys(S.project.palettes.base); if (keys[+combo - 1]) { S.key = keys[+combo - 1]; if (S.tool === "eraser") S.tool = "pencil"; refreshColours(); } e.preventDefault(); return; }
  if (combo === "0" && S.tab === "draw") { S.key = null; refreshColours(); }
}
function onKeyUp(e) { if (e.code === "Space" && S.spaceDown) { S.spaceDown = false; updateCursor(); } }

// ---------- menubar ----------
const MENUS = [
  ["File", ["newProject", "open", "save", "-", "newSprite", "import", "-", "export", "exportPng", "-", "settings"]],
  ["Edit", ["undo", "redo", "-", "clear", "flipH", "flipV", "-", "outline", "despeckle", "simplify", "-", "shortcuts"]],
  ["Sprite", ["dupSprite", "renameSprite", "delSprite", "props", "scaleUp", "scaleDown", "-", "dupFrame", "emptyFrame", "delFrame", "-", "newLayer", "renameLayer", "delLayer", "layerUp", "layerDown"]],
  ["View", ["zoomIn", "zoomOut", "fit", "-", "toggleGrid", "toggleOnion", "toggleMirror", "-", "prevFrame", "nextFrame", "firstFrame", "lastFrame", "playFrames", "-", "wsDraw", "wsAnimate", "wsBehave"]],
  ["Help", ["wsGuide", "shortcuts", "docs", "welcome", "-", "github", "about"]],
];
function buildMenubar() {
  const bar = $(".menubar"); bar.innerHTML = "";
  bar.append(el("div", { class: "brand" }, "SpriteForge"));
  for (const [name, items] of MENUS) {
    const m = el("div", { class: "menu" + (S.menu === name ? " open" : "") });
    m.append(el("button", { class: "menu-head", onmousedown: e => { e.preventDefault(); S.menu = S.menu === name ? null : name; buildMenubar(); }, onmouseenter: () => { if (S.menu && S.menu !== name) { S.menu = name; buildMenubar(); } } }, t(name)));
    if (S.menu === name) {
      const dd = el("div", { class: "dropdown" });
      for (const id of items) {
        if (id === "-") { dd.append(el("div", { class: "sep" })); continue; }
        const c = CMD(id); const dis = c.when && !c.when();
        dd.append(el("button", { class: "mi" + (dis ? " dis" : ""), onmousedown: e => e.preventDefault(), onclick: () => { S.menu = null; buildMenubar(); if (!dis) c.run(); } },
          el("span", { class: "mchk" }, c.on && c.on() ? "✓" : ""), el("span", {}, t(c.label)), el("span", { class: "kb" }, fmtCombo(c.keys[0] || ""))));
      }
      m.append(dd);
    }
    bar.append(m);
  }
  bar.append(el("span", { class: "spacer" }));
  const ws = el("div", { class: "ws" });
  [["draw", "Draw"], ["animate", "Animate"], ["behave", "Behave"]].forEach(([id, label], i) =>
    ws.append(btn([el("span", { class: "step" }, String(i + 1)), t(label)], () => setTab(id), { on: S.tab === id, title: tip(t(label), kb("ws" + id[0].toUpperCase() + id.slice(1))), class: "ws-" + id })));
  bar.append(ws, el("span", { class: "spacer" }));
  bar.append(el("a", { class: "ghbtn", href: "https://github.com/khruq/SpriteForge", target: "_blank", rel: "noopener", title: t("Source code on GitHub"), html: '<svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>' }));
  bar.append(btn("?", () => setTab("guide"), { class: "helpbtn" + (S.tab === "guide" ? " on" : ""), title: tip(t("Guide"), kb("wsGuide")) }));
  bar.append(btn(t("Export"), openExport, { class: "primary", title: tip(t("Export"), kb("export")) }));
}
function setTab(id) { S.tab = id; S.playing = id === "animate"; S.menu = null; renderAll(); }

// ---------- sprite tabs ----------
function buildDocTabs() {
  const bar = $(".doctabs"); bar.innerHTML = "";
  for (const s of Object.values(S.project.sprites)) {
    const cv = spriteToCanvas(S.project, s, 0, ts(s, 18), S.previewPal);
    bar.append(el("div", { class: "doctab" + (s.name === S.sprite ? " on" : ""), title: s.name + " · " + s.w + "×" + s.h + " · " + t("right-click for more"),
      onclick: () => selectSprite(s.name),
      oncontextmenu: e => { e.preventDefault(); if (S.sprite !== s.name) selectSprite(s.name); popMenu(e, ["renameSprite", "dupSprite", "props", "-", "delSprite"]); } }, cv, el("span", {}, s.name)));
  }
  bar.append(btn([icon("plus", 14), t("New sprite…")], () => openNewSprite(), { class: "doc-add", title: tip(t("New sprite…"), kb("newSprite")) }));
}
function selectSprite(n) { S.sprite = n; S.frame = 0; S.layer = 0; S.clip = null; S.state = null; S.fitPending = true; renderAll(); }

// ---------- left toolbar ----------
function buildToolbar() {
  const tb = $(".toolbar"); tb.innerHTML = "";
  for (const [id, label] of TOOLS) tb.append(btn(icon(id, 20), () => setTool(id), { class: "tbtn", on: S.tool === id, title: tip(t(toolLabel(id, label)), kb("tool_" + id)) }));
  tb.append(el("div", { class: "tsep" }));
  const sw = k => { const d = el("div"); const c = colorCss(k); if (c) d.style.background = c; else d.className = "checker"; return d; };
  const prim = sw(S.key); prim.classList.add("cprim"); prim.title = t("Primary colour (left mouse button)") + ": " + (S.key ?? t("Transparent"));
  prim.onclick = () => { if (S.key) { S.editKey = S.key; S.pickerOpen = true; S.open.colours = true; renderRight(true); } };
  const sec = sw(S.key2); sec.classList.add("csec"); sec.title = t("Secondary colour (right mouse button)") + ": " + (S.key2 ?? t("Transparent"));
  sec.onclick = () => { if (S.key2) { S.editKey = S.key2; S.pickerOpen = true; S.open.colours = true; renderRight(true); } };
  tb.append(el("div", { class: "colors" }, prim, sec, btn(icon("swap", 12), swapColors, { class: "cswap", title: tip(t("Swap primary and secondary colour"), kb("swap")) })));
}
function setTool(id) { S.tool = id; if (id !== "eraser" && id !== "pick" && S.key === null && S.key2 !== null) swapColors(); refreshDraw(); }
function swapColors() { [S.key, S.key2] = [S.key2, S.key]; refreshColours(); }
function setBrush(n) { S.brush = Math.max(1, Math.min(8, n)); refreshDraw(); }
function refreshColours() { buildToolbar(); renderRight(true); updateStatus(); }
function refreshDraw() { buildToolbar(); if (S.tab === "draw") buildDraw(); updateStatus(); }

// ---------- file actions ----------
function saveProject() { download(S.project.name + ".spriteforge.json", toJSON(S.project), "application/json"); toast(t("Project saved as {name}", { name: S.project.name + ".spriteforge.json" })); }
function openProject() { pickFile(".json,.pixforge", f => f.text().then(x => { snapshot(); S.project = migrateProject(JSON.parse(x)); S.sprite = null; fixSelection(); commit(); })); }
function subProject(names) {
  const keep = new Set(names), p = S.project;
  return { ...p, sprites: Object.fromEntries(Object.entries(p.sprites).filter(([n]) => keep.has(n))),
    clips: Object.fromEntries(Object.entries(p.clips).filter(([, c]) => keep.has(c.sprite))),
    behaviors: Object.fromEntries(Object.entries(p.behaviors).filter(([n, b]) => keep.has(b.sprite || n))) };
}
function exportLua(names) { const proj = Array.isArray(names) ? subProject(names) : S.project; if (!Object.keys(proj.sprites).length) { toast(t("Select at least one sprite")); return; } download("pixdata.lua", toLua(proj)); toast(t("pixdata.lua exported")); }
function exportSetup() {
  const p = S.project;
  if (!p.exportSetup || typeof p.exportSetup !== "object") p.exportSetup = { template: null, tapTemplate: null, show: [] };
  const es = p.exportSetup;
  es.show = (Array.isArray(es.show) ? es.show : []).filter(x => x && p.sprites[x.sprite]);
  if (!es.show.length) { const first = S.sprite && p.sprites[S.sprite] ? S.sprite : Object.keys(p.sprites)[0]; if (first) es.show.push({ sprite: first, x: 0, y: 0, size: showSize(first) }); }
  return es;
}
// a size that makes the sprite about 96 screen units on its longer side
function showSize(name) {
  const s = S.project.sprites[name]; if (!s) return 6;
  const k = 96 / Math.max(1, s.w, s.h);
  return isVector(s) ? Math.max(0.5, Math.round(k * 2) / 2) : Math.max(1, Math.round(k));
}
async function exportBundle(names) {
  const proj = subProject(names);
  if (!Object.keys(proj.sprites).length) { toast(t("Select at least one sprite")); return; }
  const es = exportSetup();
  if (!es.show.some(x => proj.sprites[x.sprite])) { toast(t("Choose at least one sprite to show when the game starts")); return; }
  try { download("spriteforge.lua", toBundle(proj, es, await fetchText("lua/pix.lua"))); toast(t("spriteforge.lua exported")); } catch (e) { toast(e.message); }
}
async function fetchText(path) { const r = await fetch(path + "?v=1.1"); if (!r.ok) throw new Error(path); return r.text(); }
async function downloadRuntime() { try { download("pix.lua", await fetchText("lua/pix.lua")); } catch (e) { toast(e.message); } }
async function downloadMain() { try { const s = sp(); let txt = await fetchText("lua/example_main.lua"); if (s) txt = txt.replace(/local SPRITE = "[^"]*"/, 'local SPRITE = "' + s.name + '"'); download("spriteforge_main.lua", txt); } catch (e) { toast(e.message); } }
function pickFile(accept, cb) { const i = el("input", { type: "file", accept }); i.onchange = () => { for (const f of i.files) cb(f); }; i.click(); }
function exportPng() { const s = sp(); if (!s) return; spriteToCanvas(S.project, s, S.frame, 8, S.previewPal).toBlob(b => download(s.name + ".png", b, "image/png")); }

// ---------- sprite / frame / layer operations ----------
function uniqueName(base) { let n = base, i = 2; while (S.project.sprites[n]) n = base + "_" + i++; return n; }
function newSprite() { const n = uniqueName("sprite"); snapshot(); S.project.sprites[n] = M.newSprite(n, 16, 16); S.sprite = n; S.frame = 0; S.layer = 0; S.tab = "draw"; S.fitPending = true; commit(); }
function dupSprite() { const s = sp(); const n = uniqueName(s.name); snapshot(); S.project.sprites[n] = JSON.parse(JSON.stringify({ ...s, name: n })); S.sprite = n; commit(); }
async function delSprite() { const s = sp(); if (s && await sure(t("Delete sprite {name}?", { name: s.name }))) { snapshot(); delete S.project.sprites[s.name]; S.sprite = null; fixSelection(); commit(); } }
async function renameSprite() {
  const s = sp(); if (!s) return;
  const n = await ask(t("Rename sprite"), s.name, { pattern: NAME_RE });
  if (!n || n === s.name || S.project.sprites[n] || !/^[A-Za-z][\w-]*$/.test(n)) return;
  snapshot(); delete S.project.sprites[s.name];
  for (const [cn, c] of Object.entries(S.project.clips)) if (c.sprite === s.name) { delete S.project.clips[cn]; S.project.clips[n + cn.slice(s.name.length)] = { ...c, sprite: n }; }
  if (S.project.behaviors[s.name]) { const b = S.project.behaviors[s.name]; delete S.project.behaviors[s.name]; b.sprite = n; for (const st of Object.values(b.states)) if (st.clip) st.clip = n + st.clip.slice(s.name.length); S.project.behaviors[n] = b; }
  for (const r of (S.project.exportSetup && S.project.exportSetup.show) || []) if (r.sprite === s.name) r.sprite = n;
  s.name = n; S.project.sprites[n] = s; S.sprite = n; commit();
}
function goFrame(i) { const s = sp(); if (!s) return; S.frame = Math.max(0, Math.min(s.frames.length - 1, i)); S.framePlay = false; buildDraw(); updateStatus(); }
function dupFrame() { const s = sp(); snapshot(); s.frames.splice(S.frame + 1, 0, JSON.parse(JSON.stringify(s.frames[S.frame]))); S.frame++; commit(); }
function emptyFrame() { const s = sp(); snapshot(); const f = { layers: {} }; for (const L of s.layers) f.layers[L.name] = isVector(s) ? [] : M.emptyGrid(s.w, s.h); s.frames.splice(S.frame + 1, 0, f); S.frame++; commit(); }
function delFrame() { const s = sp(); if (s.frames.length < 2) return; snapshot(); s.frames.splice(S.frame, 1); S.frame = Math.max(0, S.frame - 1); commit(); }
function moveFrame(d) { const s = sp(), a = s.frames, j = S.frame + d; if (j < 0 || j >= a.length) return; snapshot(); [a[j], a[S.frame]] = [a[S.frame], a[j]]; S.frame = j; commit(); }
async function newLayer() { const s = sp(); const n = await ask(t("Layer name"), "layer" + (s.layers.length + 1), { pattern: NAME_RE }); if (!n || s.layers.some(l => l.name === n)) return; snapshot(); s.layers.push({ name: n, visible: true, separate: false }); for (const f of s.frames) f.layers[n] = isVector(s) ? [] : M.emptyGrid(s.w, s.h); S.layer = s.layers.length - 1; commit(); }
async function delLayer() { const s = sp(); if (s.layers.length < 2) return; const L = s.layers[S.layer]; if (!await sure(t("Delete layer {name}?", { name: L.name }))) return; snapshot(); s.layers.splice(S.layer, 1); for (const f of s.frames) delete f.layers[L.name]; S.layer = 0; commit(); }
async function renameLayer(i) {
  const s = sp(), L = s.layers[i]; const n = await ask(t("Layer name"), L.name, { pattern: NAME_RE });
  if (!n || n === L.name || s.layers.some(l => l.name === n)) return;
  snapshot(); for (const f of s.frames) { f.layers[n] = f.layers[L.name]; delete f.layers[L.name]; }
  for (const c of Object.values(S.project.clips)) if (c.sprite === s.name) for (const tr of c.tracks) if (tr.prop === "layer:" + L.name) tr.prop = "layer:" + n;
  const b = S.project.behaviors[s.name]; if (b) for (const st of Object.values(b.states)) if (st.layers && L.name in st.layers) { st.layers[n] = st.layers[L.name]; delete st.layers[L.name]; }
  L.name = n; commit();
}
function scaleSprite(f) {
  const s = sp(); snapshot();
  if (isVector(s)) { for (const fr of s.frames) for (const shapes of Object.values(fr.layers)) for (const sh of shapes) scaleShape(sh, f); s.w = Math.round(s.w * f); s.h = Math.round(s.h * f); s.ax *= f; s.ay *= f; S.fitPending = true; commit(); return; }
  const W = Math.max(1, Math.round(s.w * f)), H = Math.max(1, Math.round(s.h * f));
  for (const fr of s.frames) for (const L of s.layers) { const g = fr.layers[L.name]; const n = []; for (let y = 0; y < H; y++) { const row = []; for (let x = 0; x < W; x++) row.push(g[Math.min(s.h - 1, Math.floor(y / f))][Math.min(s.w - 1, Math.floor(x / f))]); n.push(row); } fr.layers[L.name] = n; }
  s.w = W; s.h = H; s.ax *= f; s.ay = f > 1 ? (s.ay + 1) * f - 1 : Math.max(0, Math.round((s.ay + 1) * f - 1));
  if (s.nine) for (const k of ["l", "t", "r", "b"]) s.nine[k] = Math.round(s.nine[k] * f);
  S.fitPending = true; commit();
}
function moveLayer(d) { const s = sp(), a = s.layers, j = S.layer + d; if (j < 0 || j >= a.length) return; snapshot(); [a[j], a[S.layer]] = [a[S.layer], a[j]]; S.layer = j; commit(); }
function doOutline() { const s = sp(); snapshot(); if (!S.project.palettes.base.out) S.project.palettes.base.out = [40, 30, 44, 255]; outline(curGrid(), s.w, s.h, "out"); commit(); }
async function doSimplify() { const s = sp(); const v = await ask(t("Merge colours used by fewer pixels than this into the nearest colour"), "3", { type: "number" }); if (!v) return; snapshot(); const n = simplify(curGrid(), s.w, s.h, k => M.resolveColor(S.project, k, "base"), +v || 3); commit(); toast(t("{n} pixels merged", { n })); }

function resizeAny(s, W, H, anchor) {
  if (!isVector(s)) { M.resizeSprite(s, W, H, anchor); return; }
  W = Math.max(1, Math.min(1024, W)); H = Math.max(1, Math.min(1024, H));
  const dx = anchor.includes("r") ? W - s.w : anchor.includes("c") ? (W - s.w) / 2 : 0;
  const dy = anchor.includes("t") ? 0 : anchor.includes("m") ? (H - s.h) / 2 : H - s.h;
  for (const f of s.frames) for (const shapes of Object.values(f.layers)) for (const sh of shapes) moveShape(sh, dx, dy);
  s.ax += dx; s.ay += dy; s.w = W; s.h = H;
}
// ---------- sprite properties dialog ----------
function openProps() {
  const s = sp(); if (!s) return;
  const dlg = $("#dialog"); dlg.innerHTML = "";
  const box = el("div", { class: "box" }, el("h3", {}, t("Sprite properties") + " - " + s.name));
  const w = el("input", { type: "number", min: 1, max: isVector(s) ? 1024 : M.MAX_SIZE, value: s.w }), h = el("input", { type: "number", min: 1, max: isVector(s) ? 1024 : M.MAX_SIZE, value: s.h });
  const anc = el("select", { title: t("Which edge stays in place when resizing") }, ...[["tl", "↖"], ["tc", "↑"], ["tr", "↗"], ["ml", "←"], ["mc", "·"], ["mr", "→"], ["bl", "↙"], ["bc", "↓"], ["br", "↘"]].map(([a, g]) => el("option", { value: a, selected: a === "bc" }, g + " " + a)));
  box.append(el("div", { class: "row" }, el("b", {}, t("Size")), w, "×", h, anc, btn(t("Resize"), () => { snapshot(); resizeAny(s, +w.value, +h.value, anc.value); S.fitPending = true; commit(); openProps(); })));
  box.append(el("div", { class: "row" }, el("b", { title: t("The anchor is the point of the sprite placed at the position you give in code. The red cross shows it.") }, t("Anchor")),
    "x", el("input", { type: "number", step: 0.5, value: s.ax, onchange: e => { snapshot(); s.ax = +e.target.value; commit(); } }),
    "y", el("input", { type: "number", step: 0.5, value: s.ay, onchange: e => { snapshot(); s.ay = +e.target.value; commit(); } }),
    el("span", { class: "help" }, t("The anchor is the point of the sprite placed at the position you give in code. The red cross shows it."))));
  box.append(el("div", { class: "row" }, el("b", {}, t("FPS")), el("input", { type: "number", min: 1, max: 60, value: s.fps || 8, onchange: e => { snapshot(); s.fps = +e.target.value; autosave(); } })));
  if (!isVector(s)) {
  box.append(el("h3", {}, t("Extras")));
  const nine = s.nine || { l: 4, t: 4, r: 4, b: 4 };
  const nineIn = k => el("input", { type: "number", min: 0, max: 40, value: nine[k], style: "width:52px", onchange: e => { snapshot(); s.nine = { ...nine, [k]: +e.target.value }; commit(); } });
  box.append(
    el("label", { class: "chk" }, el("input", { type: "checkbox", checked: s.lod, onchange: e => { snapshot(); s.lod = e.target.checked; commit(); } }), t("Half-size copy"), el("span", { class: "help" }, " - " + t("Also export a half-size copy for small on-screen uses (fewer rectangles)"))),
    el("label", { class: "chk" }, el("input", { type: "checkbox", checked: !!s.nine, onchange: e => { snapshot(); s.nine = e.target.checked ? { l: 4, t: 4, r: 4, b: 4 } : null; commit(); openProps(); } }), t("Stretchable panel"), el("span", { class: "help" }, " - " + t("Stretchable panel: corners stay, edges and centre stretch. Set the insets in pixels."))),
    s.nine ? el("div", { class: "row" }, "left", nineIn("l"), "top", nineIn("t"), "right", nineIn("r"), "bottom", nineIn("b")) : null,
    el("label", { class: "chk" }, el("input", { type: "checkbox", checked: s.tiles, onchange: e => { snapshot(); s.tiles = e.target.checked; if (s.tiles) while (s.frames.length < 16) s.frames.push(JSON.parse(JSON.stringify(s.frames[0]))); commit(); } }), t("Auto-tile set"), el("span", { class: "help" }, " - " + t("16 frames, one per neighbour combination, for walls/paths/fences"))),
  );
  }
  box.append(el("div", { class: "row" }, btn(t("Close"), closeDialog)));
  dlg.append(box); dlg.classList.add("on");
}

// ---------- draw workspace ----------
let drawCanvas = null, drawCtx = null;
function buildDraw() {
  const tab = $("#tab-draw");
  const oldWrap = $("#draw-wrap"); const keep = oldWrap ? [oldWrap.scrollLeft, oldWrap.scrollTop] : null;
  tab.innerHTML = "";
  const s = sp();
  if (!s) { drawCanvas = null; tab.append(startPanel()); return; }
  const ctx = el("div", { class: "ctx" });
  const tool = TOOLS.find(x => x[0] === S.tool);
  ctx.append(el("span", { class: "ctx-tool" }, icon(S.tool, 16), t(toolLabel(S.tool, tool[1]))));
  if (isVector(s)) vecCtxOptions(ctx);
  else if (S.tool === "pencil" || S.tool === "eraser") {
    const seg = el("div", { class: "seg", title: tip(t("Brush size"), [kb("brushDown"), kb("brushUp")].filter(Boolean).join(" ")) });
    for (const n of [1, 2, 3, 4]) seg.append(btn(String(n), () => setBrush(n), { on: S.brush === n }));
    ctx.append(el("span", { class: "help" }, t("Brush size")), seg);
  }
  if (!isVector(s) && (S.tool === "rect" || S.tool === "ellipse")) ctx.append(el("label", { class: "chk", title: t("Shift = square / circle") }, el("input", { type: "checkbox", checked: S.filled, onchange: e => { S.filled = e.target.checked; } }), t("Filled")));
  ctx.append(el("span", { class: "spacer" }));
  ctx.append(
    btn(icon("mirror", 18), () => { S.mirror = !S.mirror; refreshDraw(); }, { class: "ibtn tog", on: S.mirror, title: tip(t("Mirror drawing"), kb("toggleMirror")) }),
    btn(icon("onion", 18), () => { S.onion = !S.onion; refreshDraw(); }, { class: "ibtn tog", on: S.onion, title: tip(t("Onion skin"), kb("toggleOnion")) }),
    btn(icon("grid", 18), () => { S.grid = !S.grid; refreshDraw(); }, { class: "ibtn tog", on: S.grid, title: tip(t("Pixel grid"), kb("toggleGrid")) }),
    el("span", { class: "vsep" }),
    ibtn("minus", () => zoomStep(-1), tip(t("Zoom out"), kb("zoomOut"))), el("span", { class: "zoomlbl", id: "zoomlbl" }, S.zoom * 100 + "%"), ibtn("plus", () => zoomStep(1), tip(t("Zoom in"), kb("zoomIn"))),
    ibtn("fit", () => { fitZoom(); drawGrid(); centerView(); updateStatus(); }, tip(t("Fit to window"), kb("fit"))));
  tab.append(ctx);
  const wrap = el("div", { id: "draw-wrap" });
  drawCanvas = el("canvas", { id: "draw" });
  wrap.append(drawCanvas); tab.append(wrap);
  drawCtx = drawCanvas.getContext("2d");
  drawCanvas.addEventListener("mousedown", onCanvasDown);
  drawCanvas.addEventListener("contextmenu", e => e.preventDefault());
  wrap.addEventListener("mousedown", e => { if (e.button === 1 || (S.spaceDown && e.target === wrap)) { e.preventDefault(); startPan(e); } });
  wrap.addEventListener("wheel", onWheel, { passive: false });
  const fb = el("div", { class: "framebar" });
  fb.append(ibtn(S.framePlay ? "pause" : "play", () => { S.framePlay = !S.framePlay; buildDraw(); }, tip(t("Flip-book preview of the frames at the FPS on the right. Movement is made in Animate."), kb("playFrames")), { on: S.framePlay }));
  const tsz = ts(s, 40);
  s.frames.forEach((f, i) => {
    const cv = spriteToCanvas(S.project, s, i, tsz, S.previewPal);
    fb.append(el("div", { class: "fthumb" + (i === S.frame ? " on" : ""), title: t("Frame") + " " + (i + 1) + " · " + t("right-click for more"), onclick: () => goFrame(i),
      oncontextmenu: e => { e.preventDefault(); goFrame(i); popMenu(e, ["dupFrame", "emptyFrame", "delFrame"], [[t("Move frame left"), () => moveFrame(-1)], [t("Move frame right"), () => moveFrame(1)]]); } }, cv, el("span", {}, String(i + 1))));
  });
  fb.append(btn(icon("plus", 18), dupFrame, { class: "fadd", title: tip(t("New frame (copy)"), kb("dupFrame")) }));
  if (s.frames.length > 1) fb.append(btn("+ " + t("Clip from frames"), framesToClip, { class: "small", title: t("Plays the drawn frames one after another at the sprite FPS") }));
  fb.append(el("span", { class: "spacer" }), el("span", { class: "help" }, t("FPS")), el("input", { type: "number", min: 1, max: 60, value: s.fps || 8, style: "width:52px", onchange: e => { snapshot(); s.fps = +e.target.value; autosave(); } }));
  tab.append(fb);
  if (S.fitPending) { fitZoom(); S.fitPending = false; }
  drawGrid();
  if (S.centerPending || !keep) centerView(); else { wrap.scrollLeft = keep[0]; wrap.scrollTop = keep[1]; }
  updateCursor();
}
function curGrid() { const s = sp(); return s.frames[S.frame].layers[s.layers[S.layer].name]; }
function cell(e) { const r = drawCanvas.getBoundingClientRect(); return { x: Math.floor((e.clientX - r.left) / S.zoom), y: Math.floor((e.clientY - r.top) / S.zoom) }; }
function setPx(g, x, y, k) { const s = sp(); if (x < 0 || y < 0 || x >= s.w || y >= s.h) return; g[y][x] = k; if (S.mirror) g[y][s.w - 1 - x] = k; }
function plot(g, x, y, k) { const b = S.brush, o = Math.floor((b - 1) / 2); for (let dy = 0; dy < b; dy++) for (let dx = 0; dx < b; dx++) setPx(g, x - o + dx, y - o + dy, k); }
function onCanvasDown(e) {
  const s = sp(); if (!s) return;
  if (e.button === 1 || S.spaceDown) return;
  if (isVector(s)) { vecDown(e); return; }
  const c = cell(e), secondary = e.button === 2;
  if (e.altKey || S.tool === "pick") { pickAt(c, secondary); return; }
  const key = S.tool === "eraser" ? null : (secondary ? S.key2 : S.key);
  snapshot();
  S.drag = { x0: c.x, y0: c.y, snap: curGrid().map(r => r.slice()), key, last: null };
  if ((S.tool === "pencil" || S.tool === "eraser") && e.shiftKey && S.lastPx) S.drag.last = S.lastPx;
  applyTool(c, true, e);
}
function pickAt(c, secondary) {
  const k = M.composite(sp(), S.frame)[c.y]?.[c.x]; if (k === undefined) return;
  if (secondary) S.key2 = k; else { S.key = k; if (S.tool === "pick" || S.tool === "eraser") S.tool = "pencil"; }
  refreshColours(); if (S.tab === "draw") buildDraw();
}
function applyTool(c, first, e) {
  const s = sp(), g = curGrid(), d = S.drag, key = d.key;
  if (S.tool === "pencil" || S.tool === "eraser") { const from = d.last || c; bresenham(from.x, from.y, c.x, c.y, (x, y) => plot(g, x, y, key)); d.last = c; S.lastPx = c; }
  else if (S.tool === "fill") { if (first) floodFill(g, c.x, c.y, key); }
  else if (S.tool === "line" || S.tool === "rect" || S.tool === "ellipse") {
    for (let y = 0; y < s.h; y++) g[y] = d.snap[y].slice();
    let x1 = c.x, y1 = c.y;
    if (e && e.shiftKey && S.tool !== "line") { const m = Math.max(Math.abs(x1 - d.x0), Math.abs(y1 - d.y0)); x1 = d.x0 + (x1 < d.x0 ? -m : m); y1 = d.y0 + (y1 < d.y0 ? -m : m); }
    if (S.tool === "line") bresenham(d.x0, d.y0, x1, y1, (x, y) => plot(g, x, y, key)); else shape(g, d.x0, d.y0, x1, y1, S.tool, S.filled, key);
  } else if (S.tool === "move") {
    const dx = c.x - d.x0, dy = c.y - d.y0;
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const sx = x - dx, sy = y - dy; g[y][x] = (sx >= 0 && sy >= 0 && sx < s.w && sy < s.h) ? d.snap[sy][sx] : null; }
  }
  drawGrid();
}
function shape(g, xa, ya, xb, yb, kind, filled, key) {
  const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb), y0 = Math.min(ya, yb), y1 = Math.max(ya, yb);
  const cx = (x0 + x1 + 1) / 2, cy = (y0 + y1 + 1) / 2, rx = (x1 - x0 + 1) / 2, ry = (y1 - y0 + 1) / 2;
  const inside = kind === "rect" ? (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1 : (x, y) => { const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; return dx * dx + dy * dy <= 1.0001; };
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    if (filled || edge) setPx(g, x, y, key);
  }
}
function floodFill(g, x, y, k) { const s = sp(); if (x < 0 || y < 0 || x >= s.w || y >= s.h) return; const target = g[y][x]; if (target === k) return; const st = [[x, y]]; while (st.length) { const [cx, cy] = st.pop(); if (cx < 0 || cy < 0 || cx >= s.w || cy >= s.h || g[cy][cx] !== target) continue; g[cy][cx] = k; if (S.mirror) g[cy][s.w - 1 - cx] = k; st.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]); } }
function bresenham(x0, y0, x1, y1, fn) { const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy; for (;;) { fn(x0, y0); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } } }
function flipH() { const s = sp(); if (isVector(s)) { for (const sh of curGrid()) mapShape(sh, x => s.w - x, y => y); return; } for (const row of curGrid()) row.reverse(); s.ax = s.w - s.ax; }
function flipV() { const s = sp(), g = curGrid(); if (isVector(s)) { for (const sh of g) mapShape(sh, x => x, y => s.h - y); return; } g.reverse(); }
function shift(dx, dy) { if (isVector(sp())) { const g = curGrid(); if (S.tool === "move" && S.sel >= 0 && g[S.sel]) moveShape(g[S.sel], dx, dy); else for (const sh of g) moveShape(sh, dx, dy); return; } const s = sp(), g = curGrid(), base = g.map(r => r.slice()); for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const sx = x - dx, sy = y - dy; g[y][x] = (sx >= 0 && sy >= 0 && sx < s.w && sy < s.h) ? base[sy][sx] : null; } }

// zoom + pan
function zoomStep(dir, at) {
  const i = ZOOMS.findIndex(z => z >= S.zoom); const cur = i < 0 ? ZOOMS.length - 1 : i;
  const next = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS[cur] === S.zoom ? cur + dir : (dir > 0 ? cur : cur - 1)))];
  setZoom(next, at);
}
function setZoom(z, at) {
  const wrap = $("#draw-wrap"); if (!wrap || !drawCanvas) { S.zoom = z; return; }
  const r0 = drawCanvas.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
  const ax = at ? at.x : wr.left + wr.width / 2, ay = at ? at.y : wr.top + wr.height / 2;
  const fx = (ax - r0.left) / r0.width, fy = (ay - r0.top) / r0.height;
  S.zoom = z; drawGrid();
  const r1 = drawCanvas.getBoundingClientRect();
  wrap.scrollLeft += (r1.left + fx * r1.width) - ax; wrap.scrollTop += (r1.top + fy * r1.height) - ay;
  const zl = $("#zoomlbl"); if (zl) zl.textContent = S.zoom * 100 + "%";
  updateStatus();
}
function fitZoom() {
  const s = sp(), wrap = $("#draw-wrap"); if (!s || !wrap) return;
  const W = wrap.clientWidth - 48, H = wrap.clientHeight - 48;
  let best = ZOOMS[0]; for (const z of ZOOMS) if (s.w * z <= W && s.h * z <= H) best = z;
  S.zoom = best; const zl = $("#zoomlbl"); if (zl) zl.textContent = S.zoom * 100 + "%";
  S.centerPending = true;
}
function centerView() { const w = $("#draw-wrap"); if (!w) return; w.scrollLeft = (w.scrollWidth - w.clientWidth) / 2; w.scrollTop = (w.scrollHeight - w.clientHeight) / 2; S.centerPending = false; }
function onWheel(e) { e.preventDefault(); zoomStep(e.deltaY < 0 ? 1 : -1, { x: e.clientX, y: e.clientY }); }
function startPan(e) { const w = $("#draw-wrap"); S.pan = { x: e.clientX, y: e.clientY, sl: w.scrollLeft, st: w.scrollTop }; updateCursor(); }
function updateCursor() { const w = $("#draw-wrap"); if (!w) return; const c = S.pan ? "grabbing" : S.spaceDown ? "grab" : S.tool === "move" ? "move" : "crosshair"; w.style.cursor = c; if (drawCanvas) drawCanvas.style.cursor = c; }
function onMouseMove(e) {
  if (S.pan) { const w = $("#draw-wrap"); if (w) { w.scrollLeft = S.pan.sl - (e.clientX - S.pan.x); w.scrollTop = S.pan.st - (e.clientY - S.pan.y); } return; }
  if (!drawCanvas || !drawCanvas.isConnected || S.tab !== "draw") return;
  const c = cell(e), s = sp();
  if (isVector(s)) { const u = unitAt(e); S.hoverU = (u.x >= 0 && u.y >= 0 && u.x <= s.w && u.y <= s.h) ? u : null; S.hover = S.hoverU ? { x: Math.round(u.x * 10) / 10, y: Math.round(u.y * 10) / 10 } : null; if (S.drag) vecMove(e); else drawGrid(); updateStatus(); return; }
  if (S.drag) { if (!S.drag.cur || S.drag.cur.x !== c.x || S.drag.cur.y !== c.y || e.shiftKey !== S.drag.sh) { S.drag.cur = c; S.drag.sh = e.shiftKey; applyTool(c, false, e); } }
  const h = (c.x >= 0 && c.y >= 0 && c.x < s.w && c.y < s.h) ? c : null;
  if ((h && (!S.hover || h.x !== S.hover.x || h.y !== S.hover.y)) || (!h && S.hover)) { S.hover = h; if (!S.drag) drawGrid(); updateStatus(); }
}
function onMouseUp() { if (S.pan) { S.pan = null; updateCursor(); } if (S.drag && S.drag.vec) { vecUp(); return; } if (S.drag) { const same = JSON.stringify(S.drag.snap) === JSON.stringify(curGrid()); S.drag = null; if (same) S.history.past.pop(); commit(); } }

function drawGrid() {
  const s = sp(); if (!s || !drawCanvas || !drawCanvas.isConnected) return;
  if (isVector(s)) { drawVec(); return; }
  const z = S.zoom; drawCanvas.width = s.w * z; drawCanvas.height = s.h * z;
  const ctx = drawCtx; const cs = Math.max(4, Math.min(z, 16));
  for (let y = 0; y < s.h * z; y += cs) for (let x = 0; x < s.w * z; x += cs) { ctx.fillStyle = ((x + y) / cs) % 2 ? "#2a2c33" : "#22242a"; ctx.fillRect(x, y, cs, cs); }
  const names = s.layers.filter(L => L.visible).map(L => L.name);
  if (S.onion && S.frame > 0) { ctx.globalAlpha = 0.25; drawScaled(ctx, rasterFrame(S.project, s, S.frame - 1, S.previewPal, names), 0, 0, s.w * z, s.h * z); ctx.globalAlpha = 1; }
  drawScaled(ctx, rasterFrame(S.project, s, S.frame, S.previewPal, names), 0, 0, s.w * z, s.h * z);
  bumpRaster();
  if (S.grid && z >= 6) { ctx.strokeStyle = "rgba(255,255,255,.07)"; ctx.lineWidth = 1; ctx.beginPath(); for (let x = 0; x <= s.w; x++) { ctx.moveTo(x * z + .5, 0); ctx.lineTo(x * z + .5, s.h * z); } for (let y = 0; y <= s.h; y++) { ctx.moveTo(0, y * z + .5); ctx.lineTo(s.w * z, y * z + .5); } ctx.stroke(); }
  if (S.mirror) { ctx.strokeStyle = "rgba(106,172,240,.8)"; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(s.w * z / 2, 0); ctx.lineTo(s.w * z / 2, s.h * z); ctx.stroke(); ctx.setLineDash([]); }
  if (s.nine) { ctx.strokeStyle = "rgba(242,186,66,.6)"; ctx.setLineDash([3, 3]); ctx.beginPath(); const n = s.nine; for (const x of [n.l, s.w - n.r]) { ctx.moveTo(x * z, 0); ctx.lineTo(x * z, s.h * z); } for (const y of [n.t, s.h - n.b]) { ctx.moveTo(0, y * z); ctx.lineTo(s.w * z, y * z); } ctx.stroke(); ctx.setLineDash([]); }
  ctx.strokeStyle = "#e0564f"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.ax * z - 6, (s.ay + 1) * z); ctx.lineTo(s.ax * z + 6, (s.ay + 1) * z); ctx.moveTo(s.ax * z, (s.ay + 1) * z - 6); ctx.lineTo(s.ax * z, (s.ay + 1) * z + 6); ctx.stroke(); ctx.lineWidth = 1;
  if (S.hover && !S.drag && !S.spaceDown) {
    const b = (S.tool === "pencil" || S.tool === "eraser") ? S.brush : 1, o = Math.floor((b - 1) / 2);
    const k = S.tool === "eraser" ? null : S.key; const fillC = colorCss(k);
    const hx = (S.hover.x - o) * z, hy = (S.hover.y - o) * z;
    if (fillC && S.tool !== "pick" && S.tool !== "move") { ctx.globalAlpha = 0.5; ctx.fillStyle = fillC; ctx.fillRect(hx, hy, b * z, b * z); ctx.globalAlpha = 1; }
    ctx.strokeStyle = "#000"; ctx.strokeRect(hx + .5, hy + .5, b * z - 1, b * z - 1); ctx.strokeStyle = "#fff"; ctx.strokeRect(hx + 1.5, hy + 1.5, b * z - 3, b * z - 3);
  }
}

// ---------- drawing (vector) sprites ----------
const VTOOL_LABELS = { pencil: "Brush", eraser: "Eraser (deletes shapes)", fill: "Recolour", pick: "Pick colour", line: "Line", rect: "Rectangle", ellipse: "Ellipse", move: "Select and move" };
const toolLabel = (id, label) => isVector(sp()) ? VTOOL_LABELS[id] : label;
function unitAt(e) { const r = drawCanvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / S.zoom, y: (e.clientY - r.top) / S.zoom }; }
const R1 = v => Math.round(v * 10) / 10;
function mirrorShape(sh) { const s = sp(); return mapShape(JSON.parse(JSON.stringify(sh)), x => s.w - x, y => y); }
function addShape(sh) { const g = curGrid(); g.push(sh); if (S.mirror) g.push(mirrorShape(sh)); }
function vecDown(e) {
  const s = sp(), u = unitAt(e), secondary = e.button === 2, g = curGrid();
  if (e.altKey || S.tool === "pick") { const i = hitShape(g, u.x, u.y); if (i >= 0) { if (secondary) S.key2 = g[i].c; else { S.key = g[i].c; if (S.tool === "pick") S.tool = "pencil"; } refreshColours(); buildDraw(); } return; }
  const key = secondary ? S.key2 : S.key;
  snapshot();
  S.drag = { vec: true, x0: u.x, y0: u.y, key, before: JSON.stringify(g), shift: e.shiftKey };
  if (S.tool === "pencil") { if (key == null) { S.drag = null; S.history.past.pop(); toast(t("Pick a colour first")); return; } S.drag.pts = [R1(u.x), R1(u.y)]; }
  else if (S.tool === "eraser") { const i = hitShape(g, u.x, u.y); if (i >= 0) g.splice(i, 1); }
  else if (S.tool === "fill") { const i = hitShape(g, u.x, u.y); if (i >= 0 && key != null) g[i].c = key; }
  else if (S.tool === "move") { S.sel = hitShape(g, u.x, u.y); if (S.sel >= 0) S.drag.orig = JSON.stringify(g[S.sel]); }
  drawGrid();
}
function vecMove(e) {
  const d = S.drag, u = unitAt(e), g = curGrid();
  if (S.tool === "pencil") { const n = d.pts.length; if (Math.hypot(u.x - d.pts[n - 2], u.y - d.pts[n - 1]) >= 0.4) d.pts.push(R1(u.x), R1(u.y)); }
  else if (S.tool === "eraser") { const i = hitShape(g, u.x, u.y); if (i >= 0) g.splice(i, 1); }
  else if (S.tool === "move" && S.sel >= 0 && d.orig) { const o = JSON.parse(d.orig); moveShape(o, R1(u.x - d.x0), R1(u.y - d.y0)); g[S.sel] = o; }
  d.cur = u; d.shift = e.shiftKey;
  drawGrid();
}
function vecPreviewShape() {
  const d = S.drag; if (!d || !d.cur && S.tool !== "pencil") return null;
  const key = d.key; if (key == null) return null;
  if (S.tool === "pencil") return { t: "s", c: key, w: S.vw, p: d.pts };
  let x1 = d.cur.x, y1 = d.cur.y;
  if (S.tool === "line") { if (d.shift) { const a = Math.round(Math.atan2(y1 - d.y0, x1 - d.x0) / (Math.PI / 4)) * Math.PI / 4, L = Math.hypot(x1 - d.x0, y1 - d.y0); x1 = d.x0 + Math.cos(a) * L; y1 = d.y0 + Math.sin(a) * L; } return { t: "s", c: key, w: S.vw, p: [R1(d.x0), R1(d.y0), R1(x1), R1(y1)] }; }
  if (S.tool === "rect" || S.tool === "ellipse") {
    if (d.shift) { const m = Math.max(Math.abs(x1 - d.x0), Math.abs(y1 - d.y0)); x1 = d.x0 + Math.sign(x1 - d.x0 || 1) * m; y1 = d.y0 + Math.sign(y1 - d.y0 || 1) * m; }
    const x = R1(Math.min(d.x0, x1)), y = R1(Math.min(d.y0, y1)), w = R1(Math.abs(x1 - d.x0)), h = R1(Math.abs(y1 - d.y0));
    if (w < 0.3 || h < 0.3) return null;
    if (S.filled) return { t: S.tool === "rect" ? "r" : "e", c: key, x, y, w, h };
    return S.tool === "rect" ? rectStroke(x, y, w, h, key, S.vw) : ellipseStroke(x, y, w, h, key, S.vw);
  }
  return null;
}
function vecUp() {
  const d = S.drag, g = curGrid();
  if (["pencil", "line", "rect", "ellipse"].includes(S.tool)) {
    const sh = vecPreviewShape();
    if (sh) { if (sh.t === "s" && S.tool === "pencil") sh.p = simplifyPoints(sh.p, S.smooth * 0.35 + 0.15); addShape(sh); }
  }
  const same = d.before === JSON.stringify(g);
  S.drag = null; if (same) S.history.past.pop();
  commit();
}
function drawVec() {
  const s = sp(), z = S.zoom, ctx = drawCtx;
  drawCanvas.width = Math.max(1, Math.round(s.w * z)); drawCanvas.height = Math.max(1, Math.round(s.h * z));
  const cs = 16;
  for (let y = 0; y < drawCanvas.height; y += cs) for (let x = 0; x < drawCanvas.width; x += cs) { ctx.fillStyle = ((x + y) / cs) % 2 ? "#2a2c33" : "#22242a"; ctx.fillRect(x, y, cs, cs); }
  const colorOf = k => k == null ? null : M.resolveColor(S.project, k, S.previewPal);
  if (S.onion && S.frame > 0) drawPrims(ctx, compileFrame(s, S.frame - 1), colorOf, 0, 0, z, 0.25);
  drawPrims(ctx, compileFrame(s, S.frame), colorOf, 0, 0, z);
  const pv = S.drag && S.drag.vec ? vecPreviewShape() : null;
  if (pv) { drawPrims(ctx, compileShapes([pv]), colorOf, 0, 0, z); if (S.mirror) drawPrims(ctx, compileShapes([mirrorShape(pv)]), colorOf, 0, 0, z, 0.6); }
  if (S.grid && z >= 4) { ctx.strokeStyle = "rgba(255,255,255,.06)"; ctx.beginPath(); for (let x = 0; x <= s.w; x += 8) { ctx.moveTo(x * z + .5, 0); ctx.lineTo(x * z + .5, s.h * z); } for (let y = 0; y <= s.h; y += 8) { ctx.moveTo(0, y * z + .5); ctx.lineTo(s.w * z, y * z + .5); } ctx.stroke(); }
  if (S.mirror) { ctx.strokeStyle = "rgba(106,172,240,.8)"; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(s.w * z / 2, 0); ctx.lineTo(s.w * z / 2, s.h * z); ctx.stroke(); ctx.setLineDash([]); }
  const g = curGrid();
  if (S.tool === "move" && S.sel >= 0 && g[S.sel]) { const b = shapeBounds(g[S.sel]); ctx.strokeStyle = "#f2ba42"; ctx.setLineDash([5, 4]); ctx.strokeRect(b.x0 * z, b.y0 * z, (b.x1 - b.x0) * z, (b.y1 - b.y0) * z); ctx.setLineDash([]); }
  ctx.strokeStyle = "#e0564f"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.ax * z - 6, s.ay * z); ctx.lineTo(s.ax * z + 6, s.ay * z); ctx.moveTo(s.ax * z, s.ay * z - 6); ctx.lineTo(s.ax * z, s.ay * z + 6); ctx.stroke(); ctx.lineWidth = 1;
  if (S.hoverU && !S.drag && ["pencil", "line", "rect", "ellipse"].includes(S.tool)) { ctx.strokeStyle = "#fff"; ctx.beginPath(); ctx.arc(S.hoverU.x * z, S.hoverU.y * z, Math.max(2, S.vw * z / 2), 0, Math.PI * 2); ctx.stroke(); }
}
function vecCtxOptions(ctx) {
  if (["pencil", "line", "rect", "ellipse"].includes(S.tool)) {
    const showW = S.tool === "pencil" || S.tool === "line" || !S.filled;
    if (S.tool === "rect" || S.tool === "ellipse") ctx.append(el("label", { class: "chk", title: t("Shift = square / circle") }, el("input", { type: "checkbox", checked: S.filled, onchange: e => { S.filled = e.target.checked; buildDraw(); } }), t("Filled")));
    if (showW) { const lbl = el("span", { class: "stat" }, String(S.vw)); ctx.append(el("span", { class: "help" }, t("Width")), el("input", { type: "range", min: 0.5, max: 16, step: 0.5, value: S.vw, oninput: e => { S.vw = +e.target.value; lbl.textContent = S.vw; } }), lbl); }
    if (S.tool === "pencil") ctx.append(el("span", { class: "help", title: t("Higher = fewer points per stroke, smoother lines and fewer rectangles") }, t("Smoothing")), el("input", { type: "range", min: 0, max: 4, step: 1, value: S.smooth, style: "width:80px", onchange: e => { S.smooth = +e.target.value; } }));
  }
  if (S.tool === "move") {
    const g = curGrid(), has = S.sel >= 0 && g[S.sel];
    ctx.append(el("span", { class: "help" }, has ? t("Drag to move the shape. Delete removes it.") : t("Click a shape to select it")));
    if (has) ctx.append(
      btn(t("To front"), () => { snapshot(); const [x] = g.splice(S.sel, 1); g.push(x); S.sel = g.length - 1; commit(); }, { class: "small" }),
      btn(t("To back"), () => { snapshot(); const [x] = g.splice(S.sel, 1); g.unshift(x); S.sel = 0; commit(); }, { class: "small" }),
      btn(t("Duplicate"), () => { snapshot(); const c = moveShape(JSON.parse(JSON.stringify(g[S.sel])), 2, 2); g.push(c); S.sel = g.length - 1; commit(); }, { class: "small" }),
      btn(t("Delete"), () => { snapshot(); g.splice(S.sel, 1); S.sel = -1; commit(); }, { class: "small danger" }));
  }
  if (S.tool === "eraser") ctx.append(el("span", { class: "help" }, t("Click or drag over shapes to delete them")));
  if (S.tool === "fill") ctx.append(el("span", { class: "help" }, t("Click a shape to give it the primary colour")));
  ctx.append(el("span", { class: "help" }, t("Shapes") + ": " + curGrid().length));
}
function addVectorPreset(p) {
  snapshot();
  const base = S.project.palettes.base, rename = {};
  const keys = new Set(p.shapes.map(x => x.c));
  for (const k of keys) {
    const c = VECTOR_PRESET_COLORS[k];
    if (!base[k]) base[k] = c.slice();
    else if (base[k].join() !== c.join()) { let i = 2; while (base[k + "_" + i] && base[k + "_" + i].join() !== c.join()) i++; base[k + "_" + i] = c.slice(); rename[k] = k + "_" + i; }
  }
  const n = uniqueName(p.name), s = newVectorSprite(n, 64, 64);
  s.frames[0].layers.body = JSON.parse(JSON.stringify(p.shapes)).map(sh => ({ ...sh, c: rename[sh.c] || sh.c }));
  S.project.sprites[n] = s; S.sprite = n; S.frame = 0; S.layer = 0; S.tab = "draw"; S.fitPending = true; S.tool = "pencil";
  if (!S.key) S.key = Object.keys(base)[0];
  commit();
}

// ---------- status bar ----------
function updateStatus() {
  const st = $(".status"); if (!st) return; st.innerHTML = "";
  const s = sp();
  const item = (label, value) => el("span", {}, label ? label + " " : "", el("b", {}, value));
  if (s) {
    if (S.tab === "draw") st.append(item("", S.hover ? `${S.hover.x}, ${S.hover.y}` : "-, -"));
    st.append(item("", s.w + "×" + s.h));
    if (S.tab === "draw") st.append(item("", S.zoom * 100 + "%"));
    if (S.cost != null) { const tot = S.costTotal || S.cost; st.append(el("span", { class: "costbadge " + (tot > 2000 ? "bad" : tot > 1200 ? "mid" : "ok"), title: t("Each rectangle becomes one UI image control in the game. Rule of thumb: keep everything visible at once under ~2000 on PC and ~1200 on phones. Frames of one sprite reuse the same controls.") }, S.cost + " " + t("rectangles"))); }
  }
  st.append(el("span", { class: "spacer" }));
  const hints = {
    pencil: t("Left: paint · Right: secondary colour · Shift+click: straight line"), eraser: t("Click or drag to erase"), fill: t("Fills the connected area of the same colour"),
    pick: t("Left click = primary colour, right click = secondary"), line: t("Drag from start to end"), rect: t("Drag · Shift = square"), ellipse: t("Drag · Shift = circle"), move: t("Drag to move the whole layer"),
  };
  const hint = S.tab === "draw" ? hints[S.tool] + " · " + t("Wheel: zoom · Space+drag: pan") : S.tab === "animate" ? t("Click a lane to add a key at that time; click a key to edit it. Press Space to play.") : S.tab === "behave" ? t("In the game: actor:fire(\"tap\"), actor:set(\"hp\", 0.2). Try it in the preview on the right.") : "";
  st.append(el("span", { class: "hint" }, hint), el("span", { class: "help" }, " ? " + t("Keyboard shortcuts")));
}
// ---------- right panel ----------
let previewCv = null, previewCtx = null, lastT = 0, frameClock = 0;
function section(id, title, build, info) {
  const open = S.open[id] !== false;
  const sec = el("div", { class: "sec" + (open ? "" : " closed") });
  sec.append(el("div", { class: "sec-headrow" }, btn([el("span", { class: "caret" }, open ? "▾" : "▸"), title], () => { S.open[id] = !open; renderRight(true); }, { class: "sec-head" }),
    info ? el("span", { class: "info", title: info }, "i") : null));
  if (open) sec.append(el("div", { class: "sec-body" }, ...build()));
  return sec;
}
function resetActor() {
  const s = sp(); if (!s) { S.actor = null; return; }
  const b = S.tab === "behave" ? S.project.behaviors[s.name] : null;
  S.actor = new Actor(S.project, s.name, b ? s.name : null);
  S.actor.on("event", n => { S.evFlash = { name: n, t: 0.9 }; });
  if (!b && S.clip && S.project.clips[S.clip]?.sprite === s.name && S.tab === "animate") S.actor.play(S.clip);
}
function renderRight(rebuild = true) {
  const right = $(".right"); const s = sp();
  if (rebuild) {
    const keepScroll = right.scrollTop;
    right.innerHTML = ""; previewCv = previewCtx = null;
    right.append(section("preview", t("Preview"), () => {
      previewCv = el("canvas", { id: "preview", width: 280, height: 170 }); previewCtx = previewCv.getContext("2d");
      const out = [previewCv];
      if (Object.keys(S.project.palettes).length > 1) out.push(el("div", { class: "row" }, el("span", { class: "help" }, t("Variant")), el("select", { onchange: e => { S.previewPal = e.target.value; S.palTab = e.target.value; renderAll(); } }, ...Object.keys(S.project.palettes).map(p => el("option", { value: p, selected: p === S.previewPal }, p)))));
      if (s && S.tab === "behave" && S.project.behaviors[s.name]) {
        const b = S.project.behaviors[s.name];
        const evs = new Set(); for (const st of Object.values(b.states)) for (const tr of st.on || []) if (tr.ev && tr.ev !== "end") evs.add(tr.ev);
        const row = el("div", { class: "row" }, el("span", { id: "actorstate", class: "stat" }, t("state") + ": " + (S.actor?.state || "-")));
        for (const ev of evs) row.append(btn(t("fire") + " " + ev, () => S.actor?.fire(ev), { class: "small" }));
        out.push(row);
        for (const [k, v] of Object.entries(b.params)) out.push(el("div", { class: "row" }, k, el("input", { type: "range", min: 0, max: Math.max(1, v * 2), step: 0.01, value: v, oninput: e => S.actor?.set(k, +e.target.value) })));
        out.push(btn(t("Restart"), resetActor, { class: "small" }));
      }
      if (s && s.nine) { const cv = el("canvas", { width: 280, height: 100, class: "mini" }); drawNine(cv, s, 260, 80); out.push(el("div", { class: "help" }, t("Stretchable panel preview")), cv); }
      if (s && s.tiles && s.frames.length >= 16) { const cv = el("canvas", { width: 280, height: 110, class: "mini" }); drawTilesPreview(cv, s); out.push(el("div", { class: "help" }, t("Auto-tile preview")), cv); }
      return out;
    }));
    if (S.tab === "draw" && s) {
      right.append(section("colours", t("Colours"), coloursBody, t("Left click = primary colour, right click = secondary, double-click = edit.") + "\n" + t("Keys named p0-p3 and q0-q3 are tint slots: variants can recolour them, so one sprite gives many colour versions at no extra cost.")));
      right.append(section("layers", t("Layers"), layersBody, t("Export as a separate part (name/layer) that the game can show or hide")));
    }
    right.scrollTop = keepScroll;
  }
  if (!s) return;
  scheduleCost();
}
let costTimer = null, costWorker = null, costSeq = 0;
function scheduleCost() {
  clearTimeout(costTimer);
  costTimer = setTimeout(() => {
    const s = sp(); if (!s) return;
    try {
      if (!costWorker) {
        costWorker = new Worker("js/costworker.js?v=1.1", { type: "module" });
        costWorker.onmessage = e => { if (e.data.id !== costSeq) return; if (e.data.error) S.cost = null; else { S.cost = e.data.cost; S.costTotal = e.data.total; } updateStatus(); };
        costWorker.onerror = () => { costWorker = null; };
      }
      S.cost = null; updateStatus();
      costWorker.postMessage({ id: ++costSeq, project: S.project, name: s.name, frame: S.frame });
    } catch (err) { S.cost = null; updateStatus(); }
  }, 350);
}
function coloursBody() {
  const out = [];
  const pals = Object.keys(S.project.palettes);
  out.push(el("div", { class: "row" },
    el("select", { title: t("Base: the real colours of every key"), onchange: e => { S.palTab = e.target.value; S.previewPal = e.target.value; renderAll(); } }, ...pals.map(p => el("option", { value: p, selected: p === S.palTab }, p === "base" ? "base" : p + " (" + t("variant") + ")"))),
    ibtn("plus", async () => { const n = await ask(t("Variant name (e.g. blue, gold, team2)"), "", { pattern: /^[A-Za-z]\w*$/ }); if (n && !S.project.palettes[n]) { snapshot(); S.project.palettes[n] = {}; S.palTab = n; S.previewPal = n; commit(); } }, t("Add a colour variant")),
    S.palTab !== "base" ? ibtn("trash", async () => { if (await sure(t("Delete variant {name}?", { name: S.palTab }))) { snapshot(); delete S.project.palettes[S.palTab]; S.palTab = "base"; S.previewPal = "base"; commit(); } }, t("Delete variant {name}?", { name: S.palTab }), { class: "danger" }) : null));
  const pal = el("div", { class: "pal" });
  const mark = k => (S.key === k ? " on" : "") + (S.key2 === k ? " on2" : "");
  pal.append(el("div", { class: "sw none" + mark(null), "data-k": "", title: t("Transparent") + "  (0)", onmousedown: e => { e.preventDefault(); if (e.button === 2) S.key2 = null; else S.key = null; markColours(); }, oncontextmenu: e => e.preventDefault() }));
  const keys = Object.keys(S.project.palettes[S.palTab]);
  keys.forEach((k, i) => {
    const isSlot = /^[pq]\d$/.test(k);
    pal.append(el("div", { class: "sw" + mark(k) + (isSlot ? " slot" : ""), title: k + (i < 9 && S.palTab === "base" ? "  (" + (i + 1) + ")" : "") + (isSlot ? " · " + t("tint slot") : ""), style: `background:${colorCss(k, S.palTab)}`,
      "data-k": k, onmousedown: e => { e.preventDefault(); const was = S.tool; if (e.button === 2) S.key2 = k; else { S.key = k; if (S.tool === "eraser") S.tool = "pencil"; } if (S.pickerOpen && S.editKey !== k) { S.editKey = k; renderRight(true); } markColours(); if (was !== S.tool && S.tab === "draw") buildDraw(); },
      oncontextmenu: e => e.preventDefault(), ondblclick: () => { S.editKey = k; S.pickerOpen = true; renderRight(true); } }));
  });
  pal.append(btn(icon("plus", 14), () => { snapshot(); const k = S.palTab === "base" ? nextKey() : (S.key || nextKey()); if (!S.project.palettes.base[k]) S.project.palettes.base[k] = [200, 200, 200, 255]; if (!S.project.palettes[S.palTab][k]) S.project.palettes[S.palTab][k] = S.project.palettes.base[k].slice(); S.key = k; S.editKey = k; S.pickerOpen = true; commit(); }, { class: "swadd", title: t("Add a colour") }));
  out.push(pal);
  out.push(el("div", { class: "row" },
    btn(t("Edit"), () => { if (S.key) { S.editKey = S.key; S.pickerOpen = !S.pickerOpen; renderRight(true); } }, { class: "small", on: S.pickerOpen }),
    btn(t("Remove"), () => { const k = S.key; if (!k) return; if (S.palTab === "base" && usedKeysProject(S.project).has(k)) { toast(t("This colour is still used by a sprite")); return; } snapshot(); delete S.project.palettes[S.palTab][k]; if (S.palTab === "base") S.key = null; commit(); }, { class: "small danger" }),
    el("span", { class: "spacer" }),
    el("select", { class: "small", title: t("Load a preset palette into base"), onchange: e => { const p = PRESET_PALETTES[e.target.value]; if (!p) return; snapshot(); p.forEach((h, i) => { S.project.palettes.base["c" + (i + 1)] = [...fromHex(h), 255]; }); S.key = "c1"; commit(); } }, el("option", { value: "" }, t("Presets…")), ...Object.keys(PRESET_PALETTES).map(n => el("option", { value: n }, n)))));
  if (S.pickerOpen && S.editKey && S.project.palettes[S.palTab]) {
    const palName = S.palTab, key = S.editKey;
    const cur = M.resolveColor(S.project, key, palName);
    let pending = cur.slice(), dirty = false;
    const picker = createPicker(cur, c => { pending = c; if (!dirty) { snapshot(); dirty = true; } S.project.palettes[palName][key] = c; drawGrid(); buildToolbar(); }, { alpha: t("Alpha") });
    out.push(el("div", { class: "card" }, el("div", { class: "row" }, el("b", {}, key), el("span", { class: "help" }, palName === "base" ? t("base colour") : t("override in {name}", { name: palName })), el("span", { class: "spacer" }), btn(t("Rename key"), () => renameKey(key), { class: "small" })), picker.el,
      el("div", { class: "row" }, btn(t("Apply"), () => { S.project.palettes[palName][key] = pending.slice(); S.pickerOpen = false; commit(); }, { class: "primary" }), btn(t("Close"), () => { S.pickerOpen = false; commit(); }, { class: "small" }))));
  }
  return out;
}
function markColours() {
  for (const d of document.querySelectorAll(".pal .sw")) { const k = d.dataset.k || null; d.classList.toggle("on", S.key === k); d.classList.toggle("on2", S.key2 === k); }
  buildToolbar(); updateStatus(); if (S.tab === "draw") drawGrid();
}
function nextKey() { let i = 1; while (S.project.palettes.base["c" + i]) i++; return "c" + i; }
async function renameKey(k) {
  const n = await ask(t("New key name (letters and digits)"), k, { pattern: /^[A-Za-z]\w*$/ });
  if (!n || n === k || !/^[A-Za-z]\w*$/.test(n) || S.project.palettes.base[n]) return;
  snapshot();
  for (const pal of Object.values(S.project.palettes)) if (pal[k]) { pal[n] = pal[k]; delete pal[k]; }
  for (const s of Object.values(S.project.sprites)) for (const f of s.frames) for (const g of Object.values(f.layers)) for (const row of g) for (let x = 0; x < row.length; x++) if (row[x] === k) row[x] = n;
  if (S.key === k) S.key = n; if (S.key2 === k) S.key2 = n; S.editKey = n; commit();
}
function layersBody() {
  const s = sp(); const list = el("div", { class: "layers" });
  s.layers.map((L, i) => [L, i]).reverse().forEach(([L, i]) => list.append(el("div", { class: "layer" + (i === S.layer ? " on" : ""), title: t("Click to draw on this layer") + " · " + t("double-click to rename"), onclick: () => { S.layer = i; renderRight(true); updateStatus(); }, ondblclick: () => renameLayer(i) },
    btn(icon(L.visible ? "eye" : "eyeOff", 16), e => { e.stopPropagation(); snapshot(); L.visible = !L.visible; autosave(); drawGrid(); renderRight(true); }, { class: "eye", title: t("Visible") }),
    el("span", { class: "lname" }, L.name),
    btn(t("part"), e => { e.stopPropagation(); snapshot(); L.separate = !L.separate; autosave(); renderRight(true); }, { class: "tag" + (L.separate ? " on" : ""), title: t("Export as a separate part (name/layer) that the game can show or hide") }))));
  return [list, el("div", { class: "row" },
    ibtn("plus", newLayer, tip(t("New layer"), kb("newLayer"))), ibtn("up", () => moveLayer(1), t("Move layer up")), ibtn("down", () => moveLayer(-1), t("Move layer down")),
    el("span", { class: "spacer" }), ibtn("trash", delLayer, t("Delete layer"), { class: "danger", disabled: s.layers.length < 2 }))];
}
function tick(ts) {
  const dt = Math.min(0.1, (ts - lastT) / 1000 || 0); lastT = ts;
  const s = sp();
  if (previewCtx && previewCv.isConnected && s) {
    if (!S.actor || S.actor.sprite !== s) resetActor();
    const a = S.actor;
    let force = null;
    if (S.tab === "animate") { if (S.clip && a.clipName !== S.clip) a.play(S.clip); if (S.playing) { a.update(dt); S.clipTime = Math.min(a.t, a.clip ? a.clip.dur : a.t); if (a.ended && a.clip && !a.clip.loop) { S.replayWait = (S.replayWait || 0) + dt; if (S.replayWait > 0.6) { S.replayWait = 0; a.play(S.clip); S.clipTime = 0; } } } else { a.t = S.clipTime; a.ended = false; a.update(0); } updateTimelineCursor(); }
    else if (S.tab === "guide") { a.update(dt); } else if (S.tab === "behave") { a.update(dt); const st = $("#actorstate"); if (st) st.textContent = t("state") + ": " + a.state; }
    else { if (a.clipName) a.play(null); a.update(0); force = S.frame; if (S.framePlay) { frameClock += dt; force = Math.floor(frameClock * (s.fps || 8)) % s.frames.length; } }
    const W = previewCv.width, H = previewCv.height;
    previewCtx.fillStyle = "#15161a"; previewCtx.fillRect(0, 0, W, H);
    previewCtx.strokeStyle = "#2e3139"; previewCtx.beginPath(); previewCtx.moveTo(0, H - 30); previewCtx.lineTo(W, H - 30); previewCtx.stroke();
    const fit = 140 / Math.max(s.w, s.h), px = s.kind === "vector" || fit < 2 ? Math.min(fit, 10) : Math.min(10, Math.floor(fit));
    drawActor(previewCtx, a, S.project, W / 2, H - 30, px, S.previewPal === "base" ? null : S.previewPal, force);
    if (S.evFlash) { S.evFlash.t -= dt; if (S.evFlash.t <= 0) S.evFlash = null; else { previewCtx.globalAlpha = Math.min(1, S.evFlash.t * 2); previewCtx.fillStyle = "#f2ba42"; previewCtx.font = "bold 13px Segoe UI, sans-serif"; previewCtx.fillText("event: " + S.evFlash.name, 8, 18); previewCtx.globalAlpha = 1; } }
  }
  if (S.tab === "guide" || dialogOpen()) tickDemos(dt);
  requestAnimationFrame(tick);
}

// ---------- shortcuts dialog: every command, editable ----------
function showShortcuts() {
  const dlg = $("#dialog"); dlg.innerHTML = "";
  const box = el("div", { class: "box wide" }, el("div", { class: "row" }, el("h3", {}, t("Keyboard shortcuts")), el("span", { class: "spacer" }),
    btn(t("Reset all to defaults"), async () => { if (await sure(t("Reset all shortcuts to defaults?"))) { resetBindings(); showShortcuts(); } }, { class: "small" })));
  box.append(el("div", { class: "help" }, t("Click Change, then press the new key combination. Esc cancels. Keys like Ctrl+W, Ctrl+T and Ctrl+N belong to the browser and cannot be used.")));
  const cols = el("div", { class: "kcols" });
  const editRow = c => {
    const keyCell = el("td", {}, ...(c.keys.length ? c.keys.map(x => el("kbd", {}, fmtCombo(x))) : [el("span", { class: "help" }, "-")]));
    const changed = JSON.stringify(c.keys) !== JSON.stringify(DEFAULT_KEYS[c.id] || []);
    const change = btn(t("Change"), () => {
      if (capturing) return;
      capturing = true; change.textContent = t("Press keys…"); change.classList.add("on");
      const cap = e => {
        if (["Control", "Shift", "Alt", "Meta", "AltGraph"].includes(e.key)) return;
        e.preventDefault(); e.stopPropagation();
        window.removeEventListener("keydown", cap, true); capturing = false;
        const combo = comboOf(e);
        if (combo === "Escape") { showShortcuts(); return; }
        if (RESERVED.has(combo)) { toast(t("{key} is reserved by the browser", { key: fmtCombo(combo) })); showShortcuts(); return; }
        setBinding(c.id, [combo]); showShortcuts();
      };
      window.addEventListener("keydown", cap, true);
    }, { class: "small" });
    return el("tr", { class: changed ? "changed" : "" }, keyCell, el("td", {}, t(c.label)),
      el("td", { class: "kact" }, change, c.keys.length ? btn("×", () => { setBinding(c.id, []); showShortcuts(); }, { class: "small", title: t("Remove") }) : null,
        changed ? btn("↺", () => { setBinding(c.id, (DEFAULT_KEYS[c.id] || []).slice()); showShortcuts(); }, { class: "small", title: t("Reset all to defaults") }) : null));
  };
  const group = (title, rows) => { const tb = el("table", { class: "keys" }, el("tr", {}, el("th", { colspan: 3 }, title))); for (const r of rows) tb.append(r); cols.append(tb); };
  const seen = new Set();
  group(t("Tools"), CMDS.filter(c => c.group === "tools").map(c => { seen.add(c.id); return editRow(c); }));
  for (const [name, items] of MENUS) {
    const rows = items.filter(id => id !== "-" && !seen.has(id)).map(id => { seen.add(id); return editRow(CMD(id)); });
    if (rows.length) group(t(name), rows);
  }
  group(t("Animate"), [editRow(CMD("play"))]);
  const fixed = [[["1…9"], t("Select colour · transparent")], [["Alt+click"], t("Pick colour")], [[t("Right-click")], t("Secondary colour (right mouse button)")], [["Shift+click"], t("Line") + " (" + t("Pencil") + ")"], [["Shift+drag"], t("Shift = square / circle")], [["Shift+←↑→↓"], t("Nudge the layer")], [[t("Wheel")], t("Zoom")], [["Space+drag"], t("Pan")], [["Esc"], t("Close dialogs")]];
  group(t("Mouse and fixed keys"), fixed.map(([k, v]) => el("tr", {}, el("td", {}, ...k.map(x => el("kbd", {}, fmtCombo(x)))), el("td", { colspan: 2 }, v))));
  box.append(cols, el("div", { class: "row" }, btn(t("Close"), closeDialog)));
  dlg.append(box); dlg.classList.add("on");
}
// ---------- sample project ----------
function sampleProject() {
  const p = M.newProject("sample");
  p.palettes = {
    base: { out: [40, 30, 44, 255], wh: [255, 255, 255, 255], glass: [190, 220, 235, 255], glass2: [230, 245, 250, 255], cork: [160, 110, 60, 255], cork2: [200, 150, 90, 255],
      p0: [150, 30, 40, 255], p1: [215, 60, 70, 255], p2: [245, 110, 110, 255], p3: [255, 190, 190, 255] },
    blue: { p0: [25, 60, 140, 255], p1: [45, 110, 210, 255], p2: [100, 170, 250, 255], p3: [190, 225, 255, 255] },
    green: { p0: [30, 100, 50, 255], p1: [60, 160, 80, 255], p2: [120, 220, 120, 255], p3: [200, 250, 190, 255] },
    gold: { p0: [140, 90, 10, 255], p1: [220, 160, 30, 255], p2: [250, 210, 80, 255], p3: [255, 245, 180, 255] },
  };
  const rows = [
    "....xxxx....",
    "....xkkx....",
    "....xKkx....",
    "...xxggxx...",
    "..xGgggggx..",
    ".xGggggggGx.",
    ".xGgp1ppggx.",
    "xGgp3p1pppgx",
    "xGp11pppp1gx",
    "xGp1ppp11pgx",
    "xgpppp1ppp0x",
    "xgp1ppppp00x",
    ".xpp1ppp00x.",
    ".xx1p0000xx.",
    "..xxxxxxxx..",
    "............",
  ];
  const s = M.newSprite("potion", 12, 16);
  s.frames[0].layers.body = asciiToGrid(rows.join("\n"), { x: "out", k: "cork", K: "cork2", g: "glass", G: "glass2", p: "p2", "1": "p1", "0": "p0", "3": "p3" });
  s.ay = 14; s.ax = 6;
  const f2 = JSON.parse(JSON.stringify(s.frames[0]));
  const g2 = f2.layers.body;
  for (let x = 1; x < 11; x++) if (["p1", "p2", "p3"].includes(g2[6][x])) g2[6][x] = "glass";
  for (let x = 2; x < 10; x++) if (g2[7][x] === "p2" && x % 3 === 0) g2[7][x] = "p3";
  s.frames.push(f2);
  s.layers.push({ name: "label", separate: true, visible: true });
  for (const f of s.frames) { const lg = M.emptyGrid(12, 16); for (let x = 3; x < 9; x++) { lg[10][x] = "wh"; lg[11][x] = "wh"; } lg[10][5] = "out"; lg[11][6] = "out"; f.layers.label = lg; }
  p.sprites.potion = s;
  p.clips["potion.idle"] = { sprite: "potion", dur: 1.2, loop: true, tracks: [{ prop: "frame", ease: "step", keys: [{ t: 0, v: 1 }, { t: 0.6, v: 2 }] }, { prop: "y", ease: "inOutQuad", keys: [{ t: 0, v: 0 }, { t: 0.6, v: 2 }, { t: 1.2, v: 0 }] }] };
  p.clips["potion.pop"] = { sprite: "potion", dur: 0.5, loop: false, tracks: [{ prop: "sy", ease: "outBack", keys: [{ t: 0, v: 0.6 }, { t: 0.5, v: 1 }] }, { prop: "sx", ease: "outBack", keys: [{ t: 0, v: 1.3 }, { t: 0.5, v: 1 }] }, { prop: "pal", ease: "step", keys: [{ t: 0, v: "gold" }, { t: 0.4, v: "base" }] }] };
  p.clips["potion.drain"] = { sprite: "potion", dur: 0.8, loop: false, tracks: [{ prop: "alpha", ease: "outQuad", keys: [{ t: 0, v: 1 }, { t: 0.8, v: 0 }] }, { prop: "y", ease: "outQuad", keys: [{ t: 0, v: 0 }, { t: 0.8, v: -8 }] }] };
  p.behaviors.potion = { sprite: "potion", initial: "idle", params: { charge: 1 }, states: {
    idle: { clip: "potion.idle", pal: null, layers: {}, on: [{ ev: "tap", to: "pop" }, { param: "charge", lt: 0.2, to: "empty" }] },
    pop: { clip: "potion.pop", pal: null, layers: {}, on: [{ ev: "end", to: "idle" }] },
    empty: { clip: null, pal: null, layers: { label: false }, on: [{ param: "charge", gt: 0.5, to: "idle" }, { ev: "use", to: "gone" }] },
    gone: { clip: "potion.drain", pal: null, layers: {}, on: [] },
  } };
  return p;
}

// ---------- animate tab ----------
const PROPS = ["x", "y", "sx", "sy", "rot", "alpha", "frame", "pal", "ev"];
const PROP_HELP = { x: "Horizontal offset in sprite pixels", y: "Vertical offset in sprite pixels (up is positive)", sx: "Horizontal scale (1 = normal)", sy: "Vertical scale (1 = normal)", rot: "Rotation in degrees", alpha: "Opacity 0-1", frame: "Which frame to show (1-based)", pal: "Which colour variant to use", ev: "Sends an event at this moment: footsteps, sounds, the hit frame of an attack" };
function clipsOf(s) { return Object.entries(S.project.clips).filter(([, c]) => c.sprite === s.name); }
function shortClip(n) { return n.split(".").slice(1).join(".") || n; }
function framesToClip() {
  const s = sp(); if (!s) return;
  const full = s.name + ".frames"; snapshot();
  S.project.clips[full] = { sprite: s.name, ...JSON.parse(JSON.stringify(clipPresets(s).frames)) };
  S.clip = full; S.clipTime = 0; S.playing = true; S.tab = "animate"; commit();
  toast(t("Clip \"frames\" plays your frames at {n} FPS", { n: s.fps || 8 }));
}
function animSteps() {
  return el("ol", { class: "steps" },
    el("li", {}, t("Choose a ready-made clip with + Preset…, or make an empty one with + Clip.")),
    el("li", {}, t("Add a track: pick what should change (y = up/down, sx/sy = stretch, rot = rotation, alpha = fade, frame = which drawing) and press + Track.")),
    el("li", {}, t("Click on the track at the moment you want a key, then type its value below. Between two keys the value moves smoothly; the list next to the track name chooses how (easing).")),
    el("li", {}, t("Press Space or Play. A looping clip repeats; a one-shot clip stops and sends the 'end' event to the behaviour.")));
}
function buildAnimate() {
  const tab = $("#tab-animate"); tab.innerHTML = "";
  const s = sp(); if (!s) { tab.append(startPanel()); return; }
  const clips = clipsOf(s);
  if (S.clip && !S.project.clips[S.clip]) S.clip = null;
  if (!S.clip && clips.length) S.clip = clips[0][0];
  const split = el("div", { class: "split" });
  const list = el("div", { class: "list" });
  for (const [name, c] of clips) list.append(el("div", { class: "item" + (S.clip === name ? " on" : ""), onclick: () => { S.clip = name; S.clipTime = 0; S.selKey = null; S.playing = true; buildAnimate(); } }, el("span", {}, shortClip(name)), el("small", {}, c.dur + "s" + (c.loop ? " ↻" : ""))));
  if (!clips.length) list.append(el("div", { class: "help" }, t("No clips yet.")));
  split.append(el("div", { class: "card" }, el("b", {}, t("Clips")), list,
    btn("+ " + t("Preset…"), () => presetClip(s), { class: "primary", title: t("Ready-made clips: idle, bounce, squash, shake, float, spin, fadeout, frames") }),
    btn("+ " + t("Clip"), async () => { const n = await ask(t("Clip name (e.g. idle, walk, hit)"), "", { pattern: NAME_RE }); if (!n) return; const full = s.name + "." + n; if (S.project.clips[full]) return; snapshot(); S.project.clips[full] = { sprite: s.name, dur: 1, loop: true, tracks: [] }; S.clip = full; commit(); }),
    s.frames.length > 1 ? btn("+ " + t("Clip from frames"), framesToClip, { title: t("Plays the drawn frames one after another at the sprite FPS") }) : null));
  const c = S.clip ? S.project.clips[S.clip] : null;
  const main = el("div", { class: "card grow" });
  if (!c) {
    main.append(el("b", { class: "big" }, t("How to animate")), animSteps(), el("div", { class: "row" }, btn("+ " + t("Preset…"), () => presetClip(s), { class: "primary" }), btn(t("Guide"), () => setTab("guide"))));
  } else {
    main.append(el("div", { class: "row" }, el("b", { class: "big" }, shortClip(S.clip)),
      btn([icon(S.playing ? "pause" : "play", 16), S.playing ? t("Pause") : t("Play")], () => { S.playing = !S.playing; buildAnimate(); }, { on: S.playing, title: tip(t("Play / pause (Animate)"), kb("play")) }),
      el("span", { class: "help" }, t("Duration")), el("input", { type: "number", step: 0.05, min: 0.05, value: c.dur, onchange: e => { snapshot(); c.dur = Math.max(0.05, +e.target.value); commit(); } }), "s",
      el("label", { class: "chk", title: t("Loop forever, or play once and fire the 'end' event") }, el("input", { type: "checkbox", checked: c.loop, onchange: e => { snapshot(); c.loop = e.target.checked; autosave(); } }), t("loop")),
      el("span", { class: "spacer" }),
      ibtn("trash", async () => { if (await sure(t("Delete clip {name}?", { name: shortClip(S.clip) }))) { snapshot(); delete S.project.clips[S.clip]; S.clip = null; commit(); } }, t("Delete clip {name}?", { name: shortClip(S.clip) }), { class: "danger" })));
    main.append(el("div", { class: "row" }, el("span", { class: "help" }, t("Time")), el("input", { type: "range", min: 0, max: 1000, value: Math.round(S.clipTime / c.dur * 1000), id: "tslider", style: "flex:1", oninput: e => { S.clipTime = +e.target.value / 1000 * c.dur; if (S.playing) { S.playing = false; buildAnimate(); } else updateTimelineCursor(); } }), el("span", { id: "tlabel", class: "stat" }, S.clipTime.toFixed(2) + "s")));
    const fr = el("div", { class: "animframes", id: "animframes" }, el("span", { class: "help" }, t("Frames")));
    const tsz = ts(s, 28);
    s.frames.forEach((f, i) => fr.append(el("div", { class: "fthumb", title: t("Frame") + " " + (i + 1) }, spriteToCanvas(S.project, s, i, tsz, S.previewPal), el("span", {}, String(i + 1)))));
    fr.append(el("span", { class: "help" }, c.tracks.some(x => x.prop === "frame") ? t("The highlighted frame is the one this clip shows right now.") : t("This clip does not switch frames. Add a 'frame' track or use + Clip from frames.")));
    main.append(fr);
    main.append(el("div", { class: "timeline", id: "timeline" }));
    main.append(el("div", { class: "row" }, el("span", { class: "help" }, t("What should change?")), el("select", { id: "trackprop" }, ...PROPS.map(p => el("option", { value: p }, p + " - " + t(PROP_HELP[p]))), ...s.layers.map(L => el("option", { value: "layer:" + L.name }, "layer:" + L.name + " - " + t("Shows (1) or hides (0) this layer")))),
      btn("+ " + t("Track"), () => { const p = $("#trackprop").value; if (c.tracks.some(x => x.prop === p)) { toast(t("This track already exists")); return; } snapshot(); c.tracks.push({ prop: p, ease: "outQuad", keys: [{ t: 0, v: defaultFor(p) }] }); commit(); }, { class: "small primary" })));
    main.append(el("div", { id: "keyedit" }));
    if (!c.tracks.length) main.append(el("b", {}, t("How to animate")), animSteps());
  }
  split.append(main);
  tab.append(split);
  if (c) { drawTimeline(); updateTimelineCursor(); }
}

const EASE_HELP = { linear: "Constant speed", inQuad: "Starts slow, speeds up", outQuad: "Starts fast, slows down", inOutQuad: "Slow start and end", inCubic: "Starts very slow, speeds up", outCubic: "Starts very fast, slows down", inOutCubic: "Very slow start and end", inSine: "Gently speeds up", outSine: "Gently slows down", inOutSine: "Gentle start and end", inBack: "Pulls back first, then moves", outBack: "Overshoots, then settles", outElastic: "Springs past and wobbles", outBounce: "Bounces at the end", step: "Jumps, no in-between" };
function defaultFor(p) { if (p === "ev") return "event"; return p === "sx" || p === "sy" || p === "alpha" || p === "frame" ? 1 : p === "pal" ? "base" : p.startsWith("layer:") ? 1 : 0; }
function updateTimelineCursor() {
  const c = S.project.clips[S.clip]; if (!c) return;
  const pct = Math.max(0, Math.min(100, S.clipTime / c.dur * 100));
  for (const cur of document.querySelectorAll("#timeline .cursor")) cur.style.left = pct + "%";
  const tl = $("#tlabel"); if (tl) tl.textContent = S.clipTime.toFixed(2) + "s";
  const ts = $("#tslider"); if (ts) ts.value = Math.round(S.clipTime / c.dur * 1000);
  const fi = S.actor ? S.actor.frameIndex() : 0;
  document.querySelectorAll("#animframes .fthumb").forEach((d, i) => d.classList.toggle("on", i === fi));
}
function drawTimeline() {
  const c = S.project.clips[S.clip]; const box = $("#timeline"); if (!c || !box) return;
  box.innerHTML = "";
  box.append(el("div", { class: "help" }, t("Easing (the list next to each track) is how the value moves between two keys: at constant speed, speeding up, slowing down, overshooting or bouncing.")));
  box.append(el("div", { class: "track" }, el("b", {}, t("track")), el("div", { class: "lane", style: "background:transparent", html: `<span class="help">0s</span><span class="help" style="float:right">${c.dur}s</span>` }), el("span")));
  c.tracks.forEach((tr, ti) => {
    const lane = el("div", { class: "lane", title: t("Click to add a key here"), onclick: e => { const r = lane.getBoundingClientRect(); const tt = Math.round((e.clientX - r.left) / r.width * c.dur * 100) / 100; snapshot(); const v = tr.keys.length ? tr.keys[tr.keys.length - 1].v : defaultFor(tr.prop); tr.keys.push({ t: tt, v }); tr.keys.sort((a, b) => a.t - b.t); S.selKey = { ti, ki: tr.keys.findIndex(k => k.t === tt) }; commit(); } });
    tr.keys.forEach((k, ki) => lane.append(el("div", { class: "key" + (S.selKey && S.selKey.ti === ti && S.selKey.ki === ki ? " on" : ""), style: `left:${k.t / c.dur * 100}%`, title: k.t + "s → " + k.v, onclick: e => { e.stopPropagation(); S.selKey = { ti, ki }; S.clipTime = k.t; drawTimeline(); renderRight(false); } })));
    lane.append(el("div", { class: "cursor", style: `left:${S.clipTime / c.dur * 100}%` }));
    box.append(el("div", { class: "track" }, el("div", { title: t(PROP_HELP[tr.prop] || "Layer visibility: 1 = shown, 0 = hidden") }, tr.prop, " ", el("select", { class: "small ease", title: t("Easing between keys") + ": " + t(EASE_HELP[tr.ease || "linear"] || ""), onchange: e => { snapshot(); tr.ease = e.target.value; commit(); } }, ...Object.keys(EASE).map(e => el("option", { value: e, selected: e === (tr.ease || "linear"), title: t(EASE_HELP[e] || "") }, e + " - " + t(EASE_HELP[e] || ""))))), lane,
      btn("×", () => { snapshot(); c.tracks.splice(ti, 1); S.selKey = null; commit(); }, { class: "small danger", title: t("Remove track") })));
  });
  const ke = $("#keyedit"); ke.innerHTML = "";
  if (S.selKey && c.tracks[S.selKey.ti] && c.tracks[S.selKey.ti].keys[S.selKey.ki]) {
    const tr = c.tracks[S.selKey.ti], k = tr.keys[S.selKey.ki];
    ke.append(el("div", { class: "row" }, el("b", {}, tr.prop + " " + t("key")), t("time"), el("input", { type: "number", step: 0.01, min: 0, value: k.t, onchange: e => { snapshot(); k.t = Math.max(0, Math.min(c.dur, +e.target.value)); tr.keys.sort((a, b) => a.t - b.t); S.selKey.ki = tr.keys.indexOf(k); commit(); } }),
      t("value"), tr.prop === "ev" ? el("input", { type: "text", value: String(k.v), style: "width:140px", onchange: e => { snapshot(); k.v = e.target.value.trim() || "event"; commit(); } }) : tr.prop === "pal" ? el("select", { onchange: e => { snapshot(); k.v = e.target.value; commit(); } }, ...Object.keys(S.project.palettes).map(p => el("option", { value: p, selected: p === k.v }, p)))
        : el("input", { type: "number", step: tr.prop === "frame" ? 1 : 0.1, value: typeof k.v === "number" ? k.v : 0, onchange: e => { snapshot(); k.v = +e.target.value; commit(); } }),
      btn(t("Delete key"), () => { snapshot(); tr.keys.splice(S.selKey.ki, 1); S.selKey = null; commit(); }, { class: "small danger" }),
      el("span", { class: "help" }, t(PROP_HELP[tr.prop] || "Layer visibility: 1 = shown, 0 = hidden"))));
  } else ke.append(el("div", { class: "help" }, t("Click a lane to add a key at that time; click a key to edit it. Press Space to play.")));
  const tl = $("#tlabel"); if (tl) tl.textContent = S.clipTime.toFixed(2) + "s";
  const ts = $("#tslider"); if (ts) ts.value = Math.round(S.clipTime / c.dur * 1000);
}
function clipPresets(s) {
  return Object.fromEntries(CLIP_LIBRARY.map(e => [e[0], JSON.parse(JSON.stringify(e[3](s)))]));
}
function presetClip(s) { openClipLibrary(s); }
function openClipLibrary(s) {
  const dlg = $("#dialog"); dlg.innerHTML = "";
  const temp = { ...S.project, clips: {} };
  const px = ts(s, 52);
  const box = el("div", { class: "box wide" }, el("div", { class: "row" }, el("h2", {}, t("Ready-made clips")), el("span", { class: "spacer" }), btn(t("Close"), closeDialog)),
    el("div", { class: "help" }, t("Each preview plays on your sprite. Click one to add it; you can change everything afterwards in the timeline.")));
  for (const cat of CLIP_CATEGORIES) {
    const items = CLIP_LIBRARY.filter(e => e[1] === cat);
    box.append(el("h3", {}, t(cat)));
    if (cat === "Frames" && s.frames.length < 2) { box.append(el("div", { class: "help" }, t("Draw at least two frames first (Draw → + under the canvas)."))); continue; }
    const grid = el("div", { class: "cliplib" });
    for (const [name, , desc, make, o] of items) {
      const key = s.name + ".__lib_" + name;
      temp.clips[key] = { sprite: s.name, ...JSON.parse(JSON.stringify(make(s))) };
      const d = demo({ project: temp, sprite: s.name, clip: key, w: 128, h: 100, px, mid: o && o.mid });
      grid.append(btn([d.cv, el("b", {}, name), el("span", { class: "help" }, t(desc))], () => addLibClip(s, name), { class: "clipcard", title: t("Add this clip") }));
    }
    box.append(grid);
  }
  dlg.append(box); dlg.classList.add("on");
}
function addLibClip(s, name) {
  let n = name, i = 2; while (S.project.clips[s.name + "." + n]) n = name + "_" + i++;
  const full = s.name + "." + n; snapshot();
  S.project.clips[full] = { sprite: s.name, ...makeClip(name, s) };
  S.clip = full; S.clipTime = 0; S.playing = true; S.selKey = null; closeDialog(); S.tab = "animate"; commit();
  toast(t("Clip \"{name}\" added", { name: n }));
}

// ---------- behave tab ----------
function buildBehave() {
  const tab = $("#tab-behave"); tab.innerHTML = "";
  const s = sp(); if (!s) { tab.append(startPanel()); return; }
  let b = S.project.behaviors[s.name];
  if (!b) { tab.append(el("div", { class: "card narrow" }, el("p", { class: "help" }, t("A behaviour is a list of states (idle, hit, sleeping…). Each state plays a clip, picks a colour variant and shows or hides parts. The game only sends events (\"tap\") or sets numbers (\"hp = 0.2\"); the switching rules live here.")), btn("+ " + t("Create behaviour"), () => { snapshot(); S.project.behaviors[s.name] = { sprite: s.name, initial: "idle", params: {}, states: { idle: { clip: null, pal: null, layers: {}, on: [] } } }; S.state = "idle"; commit(); }, { class: "primary" }))); return; }
  if (!S.state || !b.states[S.state]) S.state = b.initial || Object.keys(b.states)[0];
  const split = el("div", { class: "split" });
  const list = el("div", { class: "list" });
  for (const n of Object.keys(b.states)) list.append(el("div", { class: "item" + (n === S.state ? " on" : ""), onclick: () => { S.state = n; buildBehave(); } }, el("span", {}, (n === b.initial ? "▸ " : "") + n), el("small", {}, b.states[n].clip ? shortClip(b.states[n].clip) : "-")));
  const params = el("div", { class: "list" });
  for (const [k, v] of Object.entries(b.params)) params.append(el("div", { class: "item" }, el("span", {}, k + " = " + v), btn("×", () => { snapshot(); delete b.params[k]; commit(); }, { class: "small danger", title: t("Remove") })));
  split.append(el("div", { class: "card" }, el("b", {}, t("State")), list,
    btn("+ " + t("State"), async () => { const n = await ask(t("State name"), "", { pattern: NAME_RE }); if (!n || b.states[n]) return; snapshot(); b.states[n] = { clip: null, pal: null, layers: {}, on: [] }; S.state = n; commit(); }, { class: "primary" }),
    el("div", { class: "row" }, el("span", { class: "help" }, t("Initial state")), el("select", { onchange: e => { snapshot(); b.initial = e.target.value; commit(); } }, ...Object.keys(b.states).map(n => el("option", { value: n, selected: n === b.initial }, n)))),
    el("b", {}, t("Numbers")), params,
    btn("+ " + t("Number"), async () => { const k = await ask(t("Name of the number the game will set (e.g. hp, energy)"), "", { pattern: /^[A-Za-z_]\w*$/ }); if (!k) return; const v = await ask(t("Starting value"), "1", { type: "number" }); snapshot(); b.params[k] = +(v || 0); commit(); }),
    btn(t("Delete behaviour"), async () => { if (await sure(t("Delete the whole behaviour?"))) { snapshot(); delete S.project.behaviors[s.name]; commit(); } }, { class: "small danger" })));
  const st = b.states[S.state];
  const card = el("div", { class: "card grow" }, el("div", { class: "row" }, el("b", { class: "big" }, S.state), el("span", { class: "spacer" }),
    ibtn("trash", async () => { if (Object.keys(b.states).length > 1 && await sure(t("Delete state {name}?", { name: S.state }))) { snapshot(); delete b.states[S.state]; S.state = null; commit(); } }, t("Delete state {name}?", { name: S.state }), { class: "danger", disabled: Object.keys(b.states).length < 2 })));
  card.append(el("div", { class: "row" }, t("Clip"), el("select", { onchange: e => { snapshot(); st.clip = e.target.value || null; autosave(); resetActor(); } }, el("option", { value: "" }, "- " + t("none") + " -"), ...clipsOf(s).map(([n]) => el("option", { value: n, selected: n === st.clip }, shortClip(n)))),
    t("Colour variant"), el("select", { onchange: e => { snapshot(); st.pal = e.target.value || null; autosave(); resetActor(); } }, el("option", { value: "" }, "- " + t("as placed") + " -"), ...Object.keys(S.project.palettes).map(p => el("option", { value: p, selected: p === st.pal }, p)))));
  const lay = el("div", { class: "row" }, t("Parts") + ": ");
  for (const L of s.layers) { const v = st.layers[L.name]; lay.append(el("label", { class: "chk" }, el("select", { class: "small", onchange: e => { snapshot(); if (e.target.value === "") delete st.layers[L.name]; else st.layers[L.name] = e.target.value === "1"; autosave(); resetActor(); } }, el("option", { value: "", selected: v === undefined }, t("keep")), el("option", { value: "1", selected: v === true }, t("show")), el("option", { value: "0", selected: v === false }, t("hide"))), L.name)); }
  card.append(lay);
  card.append(el("b", {}, t("Switch to another state…")));
  (st.on || []).forEach((tr, i) => {
    const desc = tr.ev === "end" ? t("when the clip ends") : tr.ev ? t("on event '{ev}'", { ev: tr.ev }) : tr.timer ? t("after {a}-{b} s", { a: tr.timer[0], b: tr.timer[1] }) : tr.param ? t("when {p} {op} {v}", { p: tr.param, op: tr.lt != null ? "<" : ">", v: tr.lt != null ? tr.lt : tr.gt }) : "?";
    card.append(el("div", { class: "row" }, el("span", {}, desc + " → " + tr.to), btn("×", () => { snapshot(); st.on.splice(i, 1); commit(); }, { class: "small danger" })));
  });
  const kind = el("select", {}, el("option", { value: "ev" }, t("on event")), el("option", { value: "end" }, t("when the clip ends")), el("option", { value: "timer" }, t("after a random delay")), el("option", { value: "lt" }, t("when number <")), el("option", { value: "gt" }, t("when number >")));
  const arg = el("input", { type: "text", placeholder: t("event / number name"), style: "width:190px" }), num = el("input", { type: "text", placeholder: t("value or min,max"), style: "width:150px" });
  const to = el("select", {}, ...Object.keys(b.states).map(n => el("option", { value: n }, n)));
  card.append(el("div", { class: "row" }, kind, arg, num, "→", to, btn("+ " + t("Add"), () => {
    const k = kind.value, tr = { to: to.value };
    if (k === "ev") { if (!arg.value) return; tr.ev = arg.value; }
    else if (k === "end") tr.ev = "end";
    else if (k === "timer") { const [a, bb] = num.value.split(",").map(Number); if (isNaN(a)) return; tr.timer = [a, isNaN(bb) ? a : bb]; }
    else { if (!arg.value || num.value === "") return; tr.param = arg.value; tr[k] = +num.value; }
    snapshot(); st.on = st.on || []; st.on.push(tr); commit();
  }, { class: "small" })));
  split.append(card);
  tab.append(split);
}

// ---------- live examples used by the Guide ----------
const DEMOS = [];
let demoProj = null;
function getDemoProject() {
  if (demoProj) return demoProj;
  const p = sampleProject(), pr = clipPresets(p.sprites.potion);
  for (const k of ["bounce", "squash", "spin", "shake", "float", "fadeout"]) p.clips["potion." + k] = { sprite: "potion", ...JSON.parse(JSON.stringify(pr[k])) };
  return (demoProj = p);
}
let vecDemo = null;
function vecDemoProject() {
  if (vecDemo) return vecDemo;
  const p = M.newProject("drawings"); p.palettes = { base: { ...VECTOR_PRESET_COLORS } };
  for (const [name, clip] of [["smile", "wobble"], ["cloud", "float"], ["heart", "heartbeat"], ["flower", "sway"]]) {
    const sp0 = newVectorSprite(name, 64, 64); sp0.frames[0].layers.body = JSON.parse(JSON.stringify(VECTOR_PRESETS.find(x => x.name === name).shapes));
    p.sprites[name] = sp0; p.clips[name + "." + clip] = { sprite: name, ...makeClip(clip, sp0) };
  }
  return (vecDemo = p);
}
function demo(opts = {}) {
  const proj = opts.project || getDemoProject(), spr = opts.sprite || "potion";
  const cv = el("canvas", { width: opts.w || 200, height: opts.h || 140 });
  const a = new Actor(proj, spr, opts.behavior ? spr : null);
  if (opts.clip) a.play(opts.clip);
  if (opts.layers) a.stateLayers = { ...opts.layers };
  const d = { cv, a, pal: opts.pal || null, frames: !!opts.frames, px: opts.px || 5, mid: !!opts.mid, wait: 0, clock: 0, seen: false, onTick: null };
  DEMOS.push(d);
  return d;
}
function tickDemos(dt) {
  for (let i = DEMOS.length - 1; i >= 0; i--) {
    const d = DEMOS[i];
    if (!d.cv.isConnected) { if (d.seen) DEMOS.splice(i, 1); continue; }
    d.seen = true;
    if (d.a.ended && !d.a.behavior) { d.wait += dt; if (d.wait > 0.8) { d.wait = 0; d.a.play(d.a.clipName); } }
    d.a.update(dt);
    let force = null;
    if (d.frames) { d.clock += dt; force = Math.floor(d.clock * 3) % d.a.sprite.frames.length; }
    const ctx = d.cv.getContext("2d"), W = d.cv.width, H = d.cv.height;
    ctx.fillStyle = "#15161a"; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#2e3139"; ctx.beginPath(); ctx.moveTo(0, H - 20); ctx.lineTo(W, H - 20); ctx.stroke();
    drawActor(ctx, d.a, d.a.project, W / 2, d.mid ? H / 2 + 10 : H - 20, d.px, d.pal, force);
    if (d.onTick) d.onTick();
  }
}
function demoCard(d, title, text, code) {
  return el("div", { class: "demo" }, d.cv, el("b", {}, title), text ? el("div", { class: "help" }, text) : null, code ? el("pre", {}, code) : null);
}
function addExampleToProject() {
  const ex = sampleProject(); snapshot();
  const base = S.project.palettes.base, rename = {};
  for (const [k, c] of Object.entries(ex.palettes.base)) {
    if (!base[k]) base[k] = c.slice();
    else if (base[k].join() !== c.join()) { let i = 2; while (base[k + "_" + i] && base[k + "_" + i].join() !== c.join()) i++; if (!base[k + "_" + i]) base[k + "_" + i] = c.slice(); rename[k] = k + "_" + i; }
  }
  for (const [pn, pal] of Object.entries(ex.palettes)) { if (pn === "base") continue; const tgt = S.project.palettes[pn] = S.project.palettes[pn] || {}; for (const [k, c] of Object.entries(pal)) tgt[rename[k] || k] = c.slice(); }
  const n = uniqueName("potion"), s = ex.sprites.potion; s.name = n;
  for (const f of s.frames) for (const g of Object.values(f.layers)) for (const row of g) for (let x = 0; x < row.length; x++) if (row[x] && rename[row[x]]) row[x] = rename[row[x]];
  S.project.sprites[n] = s;
  for (const [cn, c] of Object.entries(ex.clips)) S.project.clips[n + cn.slice(6)] = { ...c, sprite: n };
  const b = ex.behaviors.potion; b.sprite = n; for (const st of Object.values(b.states)) if (st.clip) st.clip = n + st.clip.slice(6);
  S.project.behaviors[n] = b;
  S.sprite = n; S.frame = 0; S.layer = 0; S.fitPending = true; commit();
  toast(t("Example \"{name}\" added to your project", { name: n }));
}

// ---------- guide tab ----------
function buildGuide() {
  const tab = $("#tab-guide"); tab.innerHTML = "";
  const sec = (title, ...body) => el("div", { class: "card guide" }, el("h2", {}, title), ...body);
  const p = x => el("p", {}, x);
  const h = x => el("h3", {}, x);
  const pre = x => el("pre", {}, x);
  const tryIt = () => el("div", { class: "row" }, btn(t("Add this example to my project"), addExampleToProject, { class: "primary" }), el("span", { class: "help" }, t("Adds the potion with its colours, clips and behaviour, so you can open and change everything shown here.")));

  const variants = el("div", { class: "demos" });
  for (const pn of ["base", "blue", "green", "gold"]) variants.append(demoCard(demo({ clip: "potion.idle", pal: pn === "base" ? null : pn }), pn, null, pn === "base" ? 'Px.spawn(root, "potion", 0, 0)' : 'Px.spawn(root, "potion", 0, 0,\n  { pal = "' + pn + '" })'));

  const parts = el("div", { class: "demos" },
    demoCard(demo({ clip: "potion.idle" }), t("label shown"), null, 'a:layer("label", true)'),
    demoCard(demo({ clip: "potion.idle", layers: { label: false } }), t("label hidden"), null, 'a:layer("label", false)'));

  const anims = el("div", { class: "demos" },
    demoCard(demo({ frames: true }), t("Frames (flip-book)"), t("Two drawings shown one after another. Made in Draw, in the frame strip under the canvas."), null),
    demoCard(demo({ clip: "potion.idle" }), "idle", t("frame 1 → 2 (step), y 0 → 2 → 0 (smooth). Loops."), 'a:play("idle")'),
    demoCard(demo({ clip: "potion.bounce" }), "bounce", t("y up and down, sy squashes on landing. Loops."), 'a:play("bounce")'),
    demoCard(demo({ clip: "potion.squash" }), "squash", t("sx wide → 1, sy flat → 1 with an overshoot (outBack). Plays once."), 'a:play("squash")'),
    demoCard(demo({ clip: "potion.pop" }), "pop", t("Stretch plus a short switch to the gold variant (pal track). Plays once."), 'a:play("pop")'),
    demoCard(demo({ clip: "potion.spin", px: 3, mid: true }), "spin", t("rot 0 → 360, linear. Loops."), 'a:play("spin")'),
    demoCard(demo({ clip: "potion.drain" }), "drain", t("alpha 1 → 0 while y falls. Plays once."), 'a:play("drain")'));

  const live = demo({ behavior: true, w: 260, h: 170, px: 7 });
  const b = getDemoProject().behaviors.potion;
  const ruleText = tr => tr.ev === "end" ? t("when the clip ends") : tr.ev ? t("on event '{ev}'", { ev: tr.ev }) : tr.timer ? t("after {a}-{b} s", { a: tr.timer[0], b: tr.timer[1] }) : t("when {p} {op} {v}", { p: tr.param, op: tr.lt != null ? "<" : ">", v: tr.lt != null ? tr.lt : tr.gt });
  const states = el("div", { class: "statelist" });
  const stateRows = {};
  for (const [n, st] of Object.entries(b.states)) { const row = el("div", {}, el("b", {}, n), " - " + t("clip") + ": " + (st.clip ? shortClip(st.clip) : "-") + ((st.on || []).length ? " · " + st.on.map(tr => ruleText(tr) + " → " + tr.to).join(" · ") : "")); stateRows[n] = row; states.append(row); }
  const stateLbl = el("b", {});
  live.onTick = () => { stateLbl.textContent = t("state") + ": " + live.a.state; for (const [n, r] of Object.entries(stateRows)) r.classList.toggle("on", n === live.a.state); };
  const charge = el("input", { type: "range", min: 0, max: 1, step: 0.01, value: 1, oninput: e => live.a.set("charge", +e.target.value) });
  const behaveDemo = el("div", { class: "split" },
    el("div", { class: "demo" }, live.cv, stateLbl,
      el("div", { class: "row" }, btn('fire("tap")', () => live.a.fire("tap"), { class: "small" }), btn('fire("use")', () => live.a.fire("use"), { class: "small" })),
      el("div", { class: "row" }, el("span", { class: "help" }, 'set("charge")'), charge),
      btn(t("Restart"), () => { live.a = new Actor(getDemoProject(), "potion", "potion"); charge.value = 1; }, { class: "small" })),
    el("div", {}, p(t("Try it: press fire(\"tap\"), drag charge below 0.2, then fire(\"use\"). The highlighted line is the current state.")), states));

  tab.append(
    sec(t("What is SpriteForge?"),
      p(t("SpriteForge makes custom pixel art usable in games that cannot load image files. Each sprite is stored as a short list of coloured rectangles; a small runtime (pix.lua) draws those rectangles as plain UI image controls. The result looks like a normal sprite and can be moved, scaled, tinted and animated.")),
      p(t("It was built for Lua client scripts in game editors where creators have no way to upload textures, but the format is engine-neutral: anything that can draw a coloured rectangle can draw a SpriteForge sprite.")),
      el("div", { class: "row" }, btn(t("New sprite…"), () => openNewSprite(), { class: "primary" }), btn(t("Import image…"), openImport), btn(t("Add this example to my project"), addExampleToProject)),
      el("p", { class: "help" }, t("SpriteForge is an independent, unofficial, fan-made tool. It is not affiliated with, endorsed, sponsored or approved by any game developer or publisher. All trademarks belong to their respective owners.")),
      el("p", { class: "help" }, t("Users are solely responsible for the content they create, import and export with SpriteForge, including having the rights to any images they import. The developer is not responsible for user-created content or for how it is used. SpriteForge is provided as is, without warranty of any kind."))),
    sec(t("The screen"),
      p(t("Top: the menu (File, Edit, Sprite, View, Help) - every command is there with its shortcut. In the middle: the three steps Draw, Animate, Behave. Right: ? opens this guide, Export saves the Lua file.")),
      p(t("Under the menu: one tab per sprite. Left: the tools and your two colours - the left mouse button paints the primary colour, the right button the secondary one. Centre: the canvas; the mouse wheel zooms, Space+drag or the middle button moves the view. Bottom: the frames of the sprite.")),
      p(t("Right: preview, colours and layers. The status bar at the very bottom shows the cursor position, the cost in rectangles and hints. Press ? at any time for all shortcuts."))),
    sec(t("1. Make a sprite"),
      p(t("Draw on the grid, or Import a picture: it is shrunk to the grid size and reduced to a few colours. The red cross is the anchor: the point that sits at the x,y you give in code (usually the feet or the centre). Keep sprites small: 12-32 pixels is typical; each extra colour or stray pixel adds rectangles.")),
      p(t("The number next to each sprite is its cost in rectangles. Every rectangle is one UI control in the game, so fewer is faster. A clean 16×16 character costs 20-40; a photo quantised to 16 colours can cost 300+.")),
      h(t("Example")), p(t("New sprite… has ten ready-made sprites (heart, coin, sword, chest, button…). Pick one, change a few pixels, look at the cost in the status bar.")),
      el("div", { class: "row" }, btn(t("New sprite…"), () => openNewSprite(), { class: "primary" }))),
    sec(t("Drawing mode"),
      p(t("Besides pixel art, a sprite can be a drawing: brush strokes, lines, circles and boxes. Choose Drawing in New sprite…. It is still a normal sprite: colours and variants, layers and parts, frames, clips and behaviours work exactly the same.")),
      p(t("In the game every stroke is rebuilt from rectangles and circles with the same positions, sizes and angles as in the editor, so it looks identical at any size. The cost is the number of these pieces: about two per corner of a stroke. Smoothing removes corners.")),
      h(t("Examples (live)")),
      el("div", { class: "demos" }, ...[["smile", "wobble"], ["cloud", "float"], ["heart", "heartbeat"], ["flower", "sway"]].map(([n, c]) => demoCard(demo({ project: vecDemoProject(), sprite: n, clip: n + "." + c, px: 1.6 }), n, c + " · " + compileFrame(vecDemoProject().sprites[n], 0).length + " " + t("rectangles"), 'a:play("' + c + '")'))),
      h(t("From a picture")),
      p(t("Import image… → Drawing turns a picture into overlapping triangles, ellipses or rectangles. Every shape is one rectangle in the game: 80-150 are enough for an icon, 300 or more come close to a detailed picture. Soft blending lets some shapes be half transparent, which gives smoother colours for the same cost. Transparent parts stay empty.")),
      el("div", { class: "row" }, btn(t("Import image…"), () => openImport("shapes"))),
      h(t("How to draw")),
      el("ol", { class: "steps" },
        el("li", {}, t("Brush (B): hold the mouse button and draw. Width and Smoothing are above the canvas. The right button draws with the secondary colour.")),
        el("li", {}, t("Line (L), Rectangle (U), Ellipse (C): drag from corner to corner. Filled makes a solid shape, otherwise you get an outline of the chosen width. Shift keeps lines at 45° and makes squares and circles.")),
        el("li", {}, t("Select and move (V): click a shape and drag it. Above the canvas: To front, To back, Duplicate, Delete. Arrow keys with Shift nudge it.")),
        el("li", {}, t("Eraser (E) deletes whole shapes, Recolour (G) gives a shape the primary colour, Pick colour (I) takes a shape's colour. Mirror draws a mirrored copy of every new shape.")),
        el("li", {}, t("Everything else is the same as for pixel sprites: layers, frames, Animate, Behave, Export."))),
      el("div", { class: "row" }, btn(t("Drawing"), () => openNewSprite("vector"), { class: "primary" }))),
    sec(t("2. Colours and variants"),
      p(t("Colours are keys (names) with a value in the base palette. Keys p0-p3 and q0-q3 are tint slots: a variant palette (blue, gold, team2…) replaces only those keys. In the game you choose the variant when you place the sprite, so one drawing becomes many colour versions for free.")),
      h(t("Example: one drawing, four variants")), variants,
      p(t("Double-click a colour to edit it. Use Presets for a quick starter palette. Alpha below 255 makes a translucent colour, which costs more rectangles - use it sparingly."))),
    sec(t("3. Parts (layers)"),
      p(t("Layers stack bottom to top. Tick 'part' on a layer to export it separately (sprite/layer): the game can then show or hide it (a hat, a label, a glow) or a state can switch it on and off.")),
      h(t("Example: the label is a separate part")), parts),
    sec(t("4. Animation"),
      p(t("There are two kinds of animation, and they work together.")),
      p(t("Frames are different drawings of the same sprite, like pages of a flip-book. You draw them in Draw, in the strip under the canvas; the play button there only previews them.")),
      p(t("Clips are movement over time, made in Animate: position, stretch, rotation, opacity, which frame is shown and the colour variant. A clip can contain a 'frame' track, so the flip-book becomes part of the clip. + Clip from frames makes such a clip in one click.")),
      h(t("Examples (live)")), anims,
      p(t("Animate → + Preset… opens more than 50 ready-made clips in 8 groups (idle, movement, appear, disappear, reactions, items, defeat, frames). Each one previews on your own sprite.")),
      h(t("How to animate")), animSteps(),
      pre('local a = Px.spawn(root, "potion", 0, 0)\na:play("bounce")\na:on("clipEnd", function(actor, clip)\n  print(clip .. " finished")\nend)'),
      tryIt()),
    sec(t("5. Behaviour"),
      p(t("A behaviour is a set of states. Each state plays a clip and chooses a variant and parts. Rules switch between states: on an event the game sends ('tap'), after a random delay, when the clip ends, or when a number crosses a threshold (hp < 0.2). The game code stays tiny: actor:fire('tap'), actor:set('hp', 0.2).")),
      h(t("Example (live): the potion")), behaveDemo,
      h(t("How to make a behaviour")),
      el("ol", { class: "steps" },
        el("li", {}, t("Make the clips first (Animate): for example idle, pop and drain.")),
        el("li", {}, t("Open Behave and press Create behaviour. It starts with one state, idle.")),
        el("li", {}, t("Add a state for every situation with + State (pop, empty, gone…). For each state choose its clip, colour variant and which parts are shown.")),
        el("li", {}, t("Under Switch to another state… add rules: on event (the game calls actor:fire), when the clip ends, after a random delay, when a number is below or above a value (the game calls actor:set).")),
        el("li", {}, t("Add the numbers the rules use with + Number, then test with the buttons and sliders under Preview.")),
        el("li", {}, t("Initial state is where the sprite starts when it appears in the game."))),
      pre('local a = Px.spawn(root, "potion", 0, 0)   -- starts in "idle"\n\nfunction OnTap()\n  a:fire("tap")            -- idle -> pop -> idle\nend\n\nfunction OnDrink(left)\n  a:set("charge", left)    -- below 0.2 -> empty\nend\n\na:on("state", function(actor, name)\n  print("now " .. name)\nend)'),
      h(t("More ideas")),
      pre('ENEMY\n  idle   clip idle    after 2-4 s -> walk;  on "hit" -> hurt;  when hp < 0.01 -> dead\n  walk   clip walk    after 1-3 s -> idle;  on "hit" -> hurt\n  hurt   clip shake   when the clip ends -> idle\n  dead   clip fadeout\n\nBUTTON\n  normal   clip -        on "enter" -> hover\n  hover    clip float    on "leave" -> normal;  on "tap" -> pressed\n  pressed  clip squash   when the clip ends -> normal\n\nCOIN\n  spin   clip spin      on "pick" -> gone\n  gone   clip fadeout'),
      tryIt()),
    sec(t("6. Put it in the game"),
      p(t("The easiest way is one file, spriteforge.lua. It holds your sprites, the runtime that draws them and a start script, so you download and attach only this file.")),
      h(t("What you need")),
      el("ul", { class: "steps" },
        el("li", {}, el("b", {}, "spriteforge.lua"), " - ", t("made by Export: your sprites, the runtime and a start script in one file. Download it again after every change.")),
        el("li", {}, t("One Image template in the stage, made once. Its Index number goes into Export."))),
      el("div", { class: "row" }, btn([icon("down", 16), t("Export")], openExport, { class: "primary" })),
      h(t("Where the files go")),
      el("pre", {}, "<stage folder>\\external_lua_file\\\n    spriteforge.lua"),
      h(t("Step by step")),
      el("ol", { class: "steps" },
        el("li", {}, t("Open your stage in the editor and save it once, so its folder exists.")),
        el("li", {}, t("UI Control Group Library → Client Control Templates → new template of type Image. Write down its Control Template Index ID."),
          el("pre", {}, "Name:    T_PIXEL\nImage:   100001  (white square)\nSize:    10 × 10\nPivot / Anchor: centre\nInitially Visible: on")),
        el("li", {}, t("In SpriteForge open Export, type that number into Image template Index, choose what to show when the game starts and press Download spriteforge.lua.")),
        el("li", {}, t("Find the folder: Client Script Resource Explorer → right-click → New Client Script. A file window opens in the external_lua_file folder of this stage; copy its path from the address bar. The empty script it made can be deleted.")),
        el("li", {}, t("Copy spriteforge.lua into that folder. If an older copy is there, replace it.")),
        el("li", {}, t("Client Script Resource Explorer → right-click → Batch Add Script Files → Add by Folder. Check that spriteforge now appears in the list. A file without a mapping never reaches the game.")),
        el("li", {}, t("Manage UI Control Groups → Interface Layout → Add UI Control → Client Control Container. Name it PX_Root and stretch it to full screen. In code, (0, 0) is the centre of the screen.")),
        el("li", {}, t("On PX_Root: Script tab → Add Script → spriteforge.lua. No script variables are needed.")),
        el("li", {}, t("Ctrl+S, restart the Sandbox completely, Test Play. Logs → Client Scripts should show \"SpriteForge: 1 sprite(s) ready\"."))),
      h(t("Clickable sprites (optional)")),
      el("ol", { class: "steps" },
        el("li", {}, t("Make a second template of type CursorEventArea, 10 × 10, centred, and write down its Control Template Index ID.")),
        el("li", {}, t("Type that number into Tap template Index in Export and download the file again. Sprites with a behaviour then react to taps with the \"tap\" event."))),
      h(t("Updating")),
      p(t("After redrawing: export spriteforge.lua again, replace the file, Ctrl+S and restart the Sandbox. The template numbers are remembered in your project.")),
      h(t("If something is wrong")),
      el("ul", { class: "steps" },
        el("li", {}, t("Nothing appears and the log says \"nothing was drawn\": the Image template Index in Export is missing or wrong, or the file is not attached to PX_Root.")),
        el("li", {}, t("spriteforge is missing from the Client Script Resource Explorer list: the file is not in external_lua_file, or Add by Folder was not run. Repeat step 6.")),
        el("li", {}, t("You still see the old picture: press Ctrl+S and restart the Sandbox completely; Test Play alone can keep old scripts.")),
        el("li", {}, t("The sprite is in the wrong place or has the wrong size: change X, Y and Size in Export and download again.")),
        el("li", {}, t("The game gets slow: check the cost in Export and keep everything visible at once under about 1200-2000 rectangles.")),
        el("li", {}, t("You used pix.lua, pixdata.lua and spriteforge_main.lua before: either keep them or switch to spriteforge.lua, but do not attach both scripts to PX_Root."))),
      el("details", { class: "adv" }, el("summary", {}, t("For programmers: separate files")),
        p(t("Use pix.lua, pixdata.lua and your own main script when you want to control sprites from code.")),
        p(t("pix.lua is the runtime for Lua client scripts. Other engines can read the same pixdata.lua: the format is described in the Docs.")),
        h(t("What you need")),
        el("ul", { class: "steps" },
          el("li", {}, el("b", {}, "pixdata.lua"), " - ", t("your sprites, colours, clips and behaviours. Made by Export; download it again after every change.")),
          el("li", {}, el("b", {}, "pix.lua"), " - ", t("the runtime that draws the sprites. The same for every project; replace it only when SpriteForge itself updates.")),
          el("li", {}, el("b", {}, "spriteforge_main.lua"), " - ", t("the script you attach to the container. It creates the sprite and updates it every frame. You can rename it or write your own."))),
        p(t("Do not rename pix.lua and pixdata.lua: the scripts load them by these exact names.")),
        el("div", { class: "row" }, btn([icon("down", 16), t("Download pixdata.lua")], exportLua, { class: "primary" }), btn([icon("down", 16), "pix.lua"], downloadRuntime), btn([icon("down", 16), "spriteforge_main.lua"], downloadMain)),
        h(t("Where the files go")),
        el("pre", {}, "<stage folder>\\external_lua_file\\\n    pix.lua\n    pixdata.lua\n    spriteforge_main.lua"),
        h(t("Step by step")),
        el("ol", { class: "steps" },
          el("li", {}, t("Open your stage in the editor and save it once, so its folder exists.")),
          el("li", {}, t("Find the folder: Client Script Resource Explorer → right-click → New Client Script. A file window opens in the external_lua_file folder of this stage; copy its path from the address bar. The empty script it made can be deleted.")),
          el("li", {}, t("Copy the three files into that folder. If older copies are there, replace them.")),
          el("li", {}, t("Client Script Resource Explorer → right-click → Batch Add Script Files → Add by Folder. Check that pix, pixdata and spriteforge_main now appear in the list. A file without a mapping never reaches the game.")),
          el("li", {}, t("Manage UI Control Groups → Interface Layout → Add UI Control → Client Control Container. Name it PX_Root and stretch it to full screen. In code, (0, 0) is the centre of the screen.")),
          el("li", {}, t("UI Control Group Library → Client Control Templates → new template of type Image. Write down its Control Template Index ID."),
            el("pre", {}, "Name:    T_PIXEL\nImage:   100001  (white square)\nSize:    10 × 10\nPivot / Anchor: centre\nInitially Visible: on")),
          el("li", {}, t("On PX_Root: Script tab → Add Script → spriteforge_main.lua. Attach only this file; it loads pix and pixdata by itself.")),
          el("li", {}, t("Right-click spriteforge_main.lua → Edit Script Variables → add a variable:"),
            el("pre", {}, "Name:   TPL_SPRITE\nType:   Client Control ID\nValue:  Control Template Index ID of T_PIXEL")),
          el("li", {}, t("At the top of spriteforge_main.lua: SPRITE is the sprite name exactly as on its tab, SIZE is how many screen units one pixel takes. The file downloaded from here already has the current sprite."),
            el("pre", {}, 'local SPRITE = "' + (sp() ? sp().name : "potion") + '"\nlocal SIZE = 6')),
          el("li", {}, t("Ctrl+S, restart the Sandbox completely, Test Play. Logs → Client Scripts should show \"SpriteForge: <name> ready\". \"no container or TPL_SPRITE\" means the variable from step 8 is missing or has the wrong index."))),
        h(t("Control it from code:")),
        el("pre", {}, 'hero:pos(200, -100)\nhero:play("bounce")\nhero:tint("blue")\nhero:fire("tap")\nhero:set("hp", 0.2)'),
        h(t("Several sprites in one stage")),
        p(t("Tick all of them in Export so they go into one pixdata.lua. Then create each one in the main script, inside init():")),
        el("pre", {}, 'local hero, coin\n\nlocal function init()\n  local root = Px.root(script, "TPL_SPRITE")\n  if not root then return false end\n  hero = Px.spawn(root, "potion", -200, 0, { px = 6 })\n  coin = Px.spawn(root, "coin", 200, 0, { px = 4 })\n  return hero ~= nil\nend'),
        h(t("Clickable sprites (optional)")),
        el("ol", { class: "steps" },
          el("li", {}, t("Make a second template of type CursorEventArea, 10 × 10, centred, and write down its Control Template Index ID.")),
          el("li", {}, t("Add a second script variable: TPL_HIT, type Client Control ID, value = that index.")),
          el("li", {}, t("In the script:"), el("pre", {}, 'hero:onTap(function(actor) actor:fire("tap") end)'))),
        h(t("Updating")),
        p(t("After redrawing: export pixdata.lua again, replace the file, Ctrl+S and restart the Sandbox. Mappings and editor settings stay.")),
        p(t("When SpriteForge itself updates, replace pix.lua as well. Your main script and editor settings stay.")),
        h(t("If something is wrong")),
        el("ul", { class: "steps" },
          el("li", {}, t("Nothing appears and the log says \"no container or TPL_SPRITE\": the TPL_SPRITE variable is missing or has a wrong number, or the script is not attached to PX_Root.")),
          el("li", {}, t("An error says the module pix or pixdata was not found: the file is not mapped or was renamed. Repeat step 4.")),
          el("li", {}, t("You still see the old picture: press Ctrl+S and restart the Sandbox completely; Test Play alone can keep old scripts.")),
          el("li", {}, t("The sprite is in the wrong place: (0, 0) is the centre of PX_Root. Move the container or change the numbers in Px.spawn.")),
          el("li", {}, t("The sprite is too big or too small: change SIZE (or px in Px.spawn).")),
          el("li", {}, t("The game gets slow: check the cost in Export and keep everything visible at once under about 1200-2000 rectangles.")))),
      p(t("Full API, data format and the editor setup checklist are in the Docs page.")), el("a", { href: "docs/index.html", target: "_blank" }, t("Open the Docs")), " · ", el("a", { href: "https://github.com/khruq/SpriteForge", target: "_blank", rel: "noopener" }, t("Open source on GitHub"))),
    sec(t("7. More for programmers"),
      p(t("Everything below works in the game through pix.lua. Put calls in your main script; Px.update(dt) in OnUpdate drives all of them.")),
      h(t("Clip events")),
      p(t("Add an 'ev' track to a clip and put keys with names (step, swing, hit). The actor sends them while the clip plays - use them for sounds, damage or effects at the exact frame. The preview shows them in yellow.")),
      pre('a:on("event", function(actor, name)\n  if name == "hit" then dealDamage() end\n  if name == "step" then game.PlayAudio2D(STEP_SOUND) end\nend)'),
      h(t("Play once, speed, direction")),
      pre('a:playOnce("attack", function() print("attack done") end)  -- then back to the previous clip\na:speed(1.5)        -- 1.5x faster clips (0.5 = slow motion)\na:flip(true)        -- mirror left/right\na:face(dx)          -- look where it moves: dx < 0 left, dx > 0 right'),
      h(t("Smooth movement (tweens)")),
      p(t("Moves the whole sprite in screen units, on top of whatever clip is playing. Easing names are the same as in the timeline.")),
      pre('a:moveTo(300, -120, 0.6, "outCubic", function() a:fire("arrived") end)\na:moveBy(0, 40, 0.3)\na:scaleTo(1.5, 0.2, "outBack")\na:rotTo(90, 0.4)\na:fadeTo(0, 0.5, "linear", function(n) n:destroy() end)\nlocal tw = a:moveTo(0, 0, 2)  Px.cancel(tw)'),
      h(t("Timers")),
      pre('Px.after(1.5, function() a:fire("wake") end)\nlocal blink = Px.every(4, function() a:playOnce("blink") end)\nPx.cancel(blink)'),
      h(t("Particles")),
      p(t("Throws small copies of a sprite that fly, fall and fade, then removes them. Each copy costs its rectangles while it lives, so keep small sprites and low counts.")),
      pre('Px.burst(root, "coin", x, y, { count = 8, speed = 180, life = 0.7, px = 2 })\nPx.burst(root, "star", x, y, { count = 5, angle = 90, spread = 60, gravity = 0, spin = 360 })'),
      h(t("Clean up")),
      pre('a:destroy()     -- one sprite\nPx.clear()      -- every sprite, tween, timer and particle\nprint(Px.count) -- rectangles alive right now')),
    sec(t("Extras"),
      p(t("Half-size copy: a cheaper version for small on-screen uses. Stretchable panel: frames and buttons that scale without distorted corners. Auto-tile set: walls and paths that connect automatically. Simplify: merge rare colours after an import.")),
      pre('Px.draw(root, "potion", 0, 0, { lod = "half" })        -- Half-size copy\nPx.nine(root, "button", 0, 0, 300, 90)                -- Stretchable panel\nPx.tiles(root, "wall", grid, 64)                      -- Auto-tile set\nPx.fill(root, "heart", 0, 0, 0.6)                     -- bottom 60 %\nPx.hit(root, x, y, w, h, function() a:fire("tap") end) -- needs TPL_HIT'),
      p(t("Keyboard: press ? for the full list of shortcuts."))),
  );
}

function loadSample() { snapshot(); S.project = sampleProject(); S.sprite = "potion"; S.frame = 0; S.layer = 0; S.tab = "draw"; S.fitPending = true; S.key2 = null; S.previewPal = "base"; S.palTab = "base"; S.key = "p2"; commit(); }


function drawNine(cv, s, W, H) {
  const ctx = cv.getContext("2d"); const grid = M.composite(s, 0); const n = s.nine; const px = 3;
  const cw = s.w - n.l - n.r, ch = s.h - n.t - n.b, innerW = W - (n.l + n.r) * px, innerH = H - (n.t + n.b) * px;
  const sx = cw > 0 ? innerW / cw : px, sy = ch > 0 ? innerH / ch : px, ox = (cv.width - W) / 2, oy = (cv.height - H) / 2;
  const xmap = x => x < n.l ? ox + x * px : x < s.w - n.r ? ox + n.l * px + (x - n.l) * sx : ox + n.l * px + innerW + (x - (s.w - n.r)) * px;
  const ymap = y => y < n.t ? oy + y * px : y < s.h - n.b ? oy + n.t * px + (y - n.t) * sy : oy + n.t * px + innerH + (y - (s.h - n.b)) * px;
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const k = grid[y][x]; if (k == null) continue; const c = M.resolveColor(S.project, k, S.previewPal); ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${(c[3] ?? 255) / 255})`; ctx.fillRect(xmap(x), ymap(y), xmap(x + 1) - xmap(x) + 0.5, ymap(y + 1) - ymap(y) + 0.5); }
}
function drawTilesPreview(cv, s) {
  const ctx = cv.getContext("2d"); const map = [[1, 1, 1, 0, 1], [1, 0, 1, 0, 1], [1, 1, 1, 1, 1], [0, 0, 1, 0, 0]];
  const cell = Math.floor(Math.min(300 / 5, 110 / 4)); const px = cell / Math.max(s.w, s.h); const at = (x, y) => !!(map[y] && map[y][x]);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 5; x++) { if (!at(x, y)) continue; const mask = (at(x, y - 1) ? 1 : 0) + (at(x + 1, y) ? 2 : 0) + (at(x, y + 1) ? 4 : 0) + (at(x - 1, y) ? 8 : 0); const g = M.composite(s, Math.min(mask, s.frames.length - 1)); for (let yy = 0; yy < s.h; yy++) for (let xx = 0; xx < s.w; xx++) { const k = g[yy][xx]; if (k == null) continue; const c = M.resolveColor(S.project, k, S.previewPal); ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; ctx.fillRect(10 + x * cell + xx * px, 5 + y * cell + yy * px, px + 0.5, px + 0.5); } }
}

// ---------- import dialog ----------
// Adds colours to the base palette without changing the ones already there; returns the key used for each colour.
function addColours(list, prefix) {
  const base = S.project.palettes.base, re = new RegExp("^" + prefix + "\\d+$");
  const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && (a[3] ?? 255) === (b[3] ?? 255);
  let i = 0;
  return list.map(c => {
    const hit = Object.keys(base).find(k => re.test(k) && same(base[k], c));
    if (hit) return hit;
    while (base[prefix + i]) i++;
    base[prefix + i] = [c[0], c[1], c[2], c[3] ?? 255];
    return prefix + i;
  });
}
function openImport(mode) {
  mode = mode === "shapes" || mode === "pixels" ? mode : S.importMode || "pixels";
  const dlg = $("#dialog"); dlg.innerHTML = "";
  const box = el("div", { class: "box" }, el("h3", {}, t("Import")));
  const img = new Image(); let loaded = false;
  const prev = el("canvas", { width: 160, height: 160, class: "mini" });
  const w = el("input", { type: "number", min: 4, max: M.MAX_SIZE, value: 24 }), h = el("input", { type: "number", min: 4, max: M.MAX_SIZE, value: 24 });
  const colors = el("input", { type: "number", min: 2, max: 32, value: 8 }), thr = el("input", { type: "range", min: 1, max: 255, value: 128 });
  const outl = el("input", { type: "checkbox" }), desp = el("input", { type: "checkbox", checked: true }), dith = el("input", { type: "checkbox" }), slots = el("input", { type: "checkbox" });
  const name = el("input", { type: "text", value: uniqueName("import") });
  const sheet = el("input", { type: "checkbox" }), cols = el("input", { type: "number", min: 1, value: 4, style: "width:50px" }), rows = el("input", { type: "number", min: 1, value: 1, style: "width:50px" });
  const vo = S.vecImport || (S.vecImport = { count: 120, colors: 64, kinds: "et", soft: false });
  const vcount = el("input", { type: "number", min: 10, max: 500, value: vo.count }), vcolors = el("input", { type: "number", min: 2, max: 128, value: vo.colors }), vthr = el("input", { type: "range", min: 1, max: 255, value: 128 });
  const vkind = el("select", {}, el("option", { value: "et" }, t("Triangles and ellipses")), el("option", { value: "t" }, t("Triangles")), el("option", { value: "e" }, t("Ellipses")), el("option", { value: "r" }, t("Rectangles")), el("option", { value: "er" }, t("Ellipses and rectangles")), el("option", { value: "ert" }, t("All shapes")));
  vkind.value = vo.kinds;
  const vsoft = el("input", { type: "checkbox", checked: vo.soft });
  let result = null, costT = null, worker = null, vres = null, fitT = null;
  const W = () => Math.max(1, Math.min(M.MAX_SIZE, Math.round(+w.value) || 24)), H = () => Math.max(1, Math.min(M.MAX_SIZE, Math.round(+h.value) || 24));
  const keepRatio = el("input", { type: "checkbox", checked: true });
  const clampIn = (inp) => { const v = Math.round(+inp.value) || 24; if (v > M.MAX_SIZE || v < 1) { inp.value = Math.max(1, Math.min(M.MAX_SIZE, v)); toast(t("Up to {n}×{n} pixels. Bigger sprites cost more rectangles.", { n: M.MAX_SIZE })); } };
  const num = (inp, lo, hi, def) => { const v = Math.max(lo, Math.min(hi, Math.round(+inp.value) || def)); inp.value = v; return v; };
  const ratio = () => loaded && img.naturalWidth ? img.naturalHeight / img.naturalWidth : 1;
  w.addEventListener("change", () => { clampIn(w); if (keepRatio.checked) { h.value = Math.max(1, Math.min(M.MAX_SIZE, Math.round(W() * ratio()))); } refresh(); });
  h.addEventListener("change", () => { clampIn(h); if (keepRatio.checked) { w.value = Math.max(1, Math.min(M.MAX_SIZE, Math.round(H() / ratio()))); } refresh(); });
  const costLabel = el("span", { class: "stat" });
  const stopFit = () => { clearTimeout(fitT); if (worker) { worker.terminate(); worker = null; } };
  const drawShapes = (shapes, pal, ww, wh) => {
    const ctx = prev.getContext("2d"); ctx.clearRect(0, 0, 160, 160);
    const sc = 160 / Math.max(ww, wh), ox = (160 - ww * sc) / 2, oy = (160 - wh * sc) / 2;
    for (const q of shapes) {
      const c = pal[q.c]; if (!c) continue;
      const al = q.o === 0 ? SOFT / 255 : (c[3] ?? 255) / 255, a = q.a * sc, b = q.b * sc;
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${al})`; ctx.save(); ctx.translate(ox + q.x * sc, oy + q.y * sc); ctx.rotate(q.r * Math.PI / 180);
      if (q.t === "e") { ctx.beginPath(); ctx.ellipse(0, 0, Math.max(0.01, a), Math.max(0.01, b), 0, 0, Math.PI * 2); ctx.fill(); }
      else if (q.t === "t") { ctx.beginPath(); ctx.moveTo(0, -b); ctx.lineTo(a, b); ctx.lineTo(-a, b); ctx.closePath(); ctx.fill(); }
      else ctx.fillRect(-a, -b, a * 2, b * 2);
      ctx.restore();
    }
  };
  const runFit = () => {
    stopFit(); vres = null; addBtn.disabled = true;
    const iw = img.naturalWidth, ih = img.naturalHeight, u = 64 / Math.max(iw, ih);
    const ww = 4 * Math.max(1, Math.round(iw * u)), wh = 4 * Math.max(1, Math.round(ih * u));
    const cv = el("canvas", { width: ww, height: wh }), ctx = cv.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = iw > ww; ctx.imageSmoothingQuality = "high"; ctx.drawImage(img, 0, 0, ww, wh);
    const data = ctx.getImageData(0, 0, ww, wh).data, count = num(vcount, 10, 500, 120), colors = num(vcolors, 2, 128, 64);
    Object.assign(vo, { count, colors, kinds: vkind.value, soft: vsoft.checked });
    const job = worker = new Worker("js/shapeworker.js?v=1.1", { type: "module" });
    job.onmessage = e => {
      if (job !== worker) return;
      if (!dlg.classList.contains("on") || !prev.isConnected) { stopFit(); return; }
      const m = e.data;
      if (m.error) { costLabel.textContent = m.error; stopFit(); return; }
      drawShapes(m.shapes, m.palette, ww, wh);
      if (!m.final) { costLabel.textContent = t("Working… {n} of {total}", { n: m.done, total: count }); return; }
      stopFit(); vres = { shapes: m.shapes, palette: m.palette, w: ww, h: wh };
      costLabel.textContent = m.shapes.length + " " + t("rectangles") + (m.placed < count ? " · " + t("more shapes would not help") : ""); addBtn.disabled = false;
    };
    job.postMessage({ data, w: ww, h: wh, opts: { count, colors, kinds: vkind.value, soft: vsoft.checked, thr: +vthr.value, seed: 7 } }, [data.buffer]);
    costLabel.textContent = t("Working… {n} of {total}", { n: 0, total: count });
  };
  const refresh = () => {
    if (!loaded) return;
    if (mode === "shapes") { stopFit(); vres = null; addBtn.disabled = true; costLabel.textContent = "…"; fitT = setTimeout(runFit, 250); return; }
    const src = sheet.checked ? cutSheet(img, +cols.value, +rows.value)[0] : img;
    result = imageToGrid(src, { w: W(), h: H(), colors: +colors.value, alphaThreshold: +thr.value, outline: outl.checked, despeckle: desp.checked, dither: dith.checked, keyPrefix: slots.checked ? "p" : "c" });
    const off = el("canvas", { width: W(), height: H() }), octx = off.getContext("2d");
    for (let y = 0; y < H(); y++) for (let x = 0; x < W(); x++) { const k = result.grid[y][x]; if (k == null) continue; const c = result.colors[k] || S.project.palettes.base[k] || [255, 0, 255]; octx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; octx.fillRect(x, y, 1, 1); }
    const ctx = prev.getContext("2d"); ctx.clearRect(0, 0, 160, 160); ctx.imageSmoothingEnabled = false;
    const sc = 160 / Math.max(W(), H()); ctx.drawImage(off, (160 - W() * sc) / 2, (160 - H() * sc) / 2, W() * sc, H() * sc);
    const tmp = { name: "t", w: W(), h: H(), ax: 0, ay: 0, layers: [{ name: "body", visible: true }], frames: [{ layers: { body: result.grid } }], fps: 8 };
    const proj = { ...S.project, palettes: { ...S.project.palettes, base: { ...S.project.palettes.base, ...result.colors } } };
    costLabel.textContent = "…"; clearTimeout(costT);
    costT = setTimeout(() => { try { costLabel.textContent = spriteCost(proj, tmp) + " " + t("rectangles"); } catch (e) { costLabel.textContent = e.message; } }, 250);
  };
  for (const i of [colors, thr, outl, desp, dith, slots, sheet, cols, rows]) i.addEventListener("input", refresh);
  for (const i of [vcount, vcolors, vthr, vkind, vsoft]) i.addEventListener("change", refresh);
  const spriteName = () => { const v = latinName(name.value.trim()).replace(/[^\w-]/g, ""); return uniqueName(NAME_RE.test(v) ? v : "import"); };
  const addPixels = () => {
    if (!result) { toast(t("Choose an image first")); return; }
    snapshot();
    const n = spriteName();
    const spr = M.newSprite(n, W(), H()), base = S.project.palettes.base, map = {};
    const plain = slots.checked ? [] : Object.keys(result.colors).filter(k => k !== "out");
    addColours(plain.map(k => result.colors[k]), "c").forEach((nk, i) => { map[plain[i]] = nk; });
    for (const [k, c] of Object.entries(result.colors)) if (!(k in map)) { if (k !== "out" || !base.out) base[k] = c; map[k] = k; }
    const remap = g => g.map(row => row.map(k => k == null ? null : map[k] || k));
    if (sheet.checked) spr.frames = cutSheet(img, +cols.value, +rows.value).map(cv => ({ layers: { body: remap(imageToGrid(cv, { w: W(), h: H(), colors: +colors.value, alphaThreshold: +thr.value, outline: outl.checked, despeckle: desp.checked, dither: dith.checked, keyPrefix: slots.checked ? "p" : "c" }).grid) } }));
    else spr.frames = [{ layers: { body: remap(result.grid) } }];
    S.project.sprites[n] = spr; S.sprite = n; S.frame = 0; S.layer = 0; S.tab = "draw"; S.fitPending = true; dlg.classList.remove("on"); commit();
  };
  const addShapes = () => {
    if (!vres) { toast(t("Choose an image first")); return; }
    if (!vres.shapes.length) { toast(t("Nothing to import: the picture is empty or fully transparent")); return; }
    snapshot();
    const n = spriteName(), k = 64 / Math.max(vres.w, vres.h);
    const spr = newVectorSprite(n, Math.max(1, Math.round(vres.w * k)), Math.max(1, Math.round(vres.h * k)));
    const keys = addColours(vres.palette, "v");
    spr.frames[0].layers.body = vres.shapes.map(q => { const o = { t: q.t, c: keys[q.c], x: R1((q.x - q.a) * k), y: R1((q.y - q.b) * k), w: R1(2 * q.a * k), h: R1(2 * q.b * k) }; const r = R1(q.r); if (r) o.r = r; return o; });
    S.project.sprites[n] = spr; S.sprite = n; S.frame = 0; S.layer = 0; S.tab = "draw"; S.tool = "move"; S.fitPending = true; dlg.classList.remove("on"); commit();
  };
  const addBtn = btn(t("Add sprite"), () => mode === "shapes" ? addShapes() : addPixels(), { class: "primary" });
  const kPix = btn([el("b", {}, t("Pixel art")), el("span", { class: "help" }, t("A small grid in a few colours, crisp retro look."))], () => setMode("pixels"), { class: "kindbtn", on: mode === "pixels" });
  const kVec = btn([el("b", {}, t("Drawing")), el("span", { class: "help" }, t("Overlapping triangles, ellipses or rectangles, smooth at any size."))], () => setMode("shapes"), { class: "kindbtn", on: mode === "shapes" });
  const pixRows = [
    el("div", { class: "row" }, t("Grid"), w, "×", h, el("label", { class: "chk" }, keepRatio, t("keep proportions")), t("Colours"), colors, t("Transparency threshold"), thr),
    el("div", { class: "row" }, el("label", { class: "chk" }, outl, t("outline")), el("label", { class: "chk" }, desp, t("despeckle")), el("label", { class: "chk" }, dith, t("dither")), el("label", { class: "chk", title: t("Name the colours p0…pN so variants can recolour them") }, slots, t("use tint slots"))),
    el("div", { class: "row" }, el("label", { class: "chk" }, sheet, t("sprite sheet")), t("cols"), cols, t("rows"), rows, el("span", { class: "help" }, t("every cell becomes a frame")))];
  const vecRows = [
    el("div", { class: "row" }, t("Shapes"), vcount, t("Colours"), vcolors, vkind, el("label", { class: "chk", title: t("Some shapes become half transparent and blend with the shapes below: smoother colours for the same number of rectangles.") }, vsoft, t("soft blending")), t("Transparency threshold"), vthr),
    el("div", { class: "help" }, t("Each shape becomes one rectangle in the game. More shapes look closer to the picture but cost more."))];
  function setMode(m) {
    mode = S.importMode = m;
    for (const r of pixRows) r.style.display = m === "pixels" ? "" : "none";
    for (const r of vecRows) r.style.display = m === "shapes" ? "" : "none";
    kPix.classList.toggle("on", m === "pixels"); kVec.classList.toggle("on", m === "shapes");
    prev.style.imageRendering = m === "pixels" ? "pixelated" : "auto";
    stopFit(); result = vres = null; addBtn.disabled = false; prev.getContext("2d").clearRect(0, 0, 160, 160); costLabel.textContent = ""; refresh();
  }
  box.append(el("h3", {}, t("From a picture")), el("div", { class: "kinds" }, kPix, kVec),
    el("div", { class: "row" }, btn(t("Choose image…"), () => pickFile("image/*", f => { img.onload = () => { loaded = true; if (keepRatio.checked) h.value = Math.max(1, Math.min(M.MAX_SIZE, Math.round(W() * ratio()))); refresh(); }; img.src = URL.createObjectURL(f); })), prev, costLabel),
    ...pixRows, ...vecRows,
    el("div", { class: "row" }, t("Sprite name"), name, addBtn));
  setMode(mode);
  const ta = el("textarea", { placeholder: "..xx..\n.xLLx.\nxLllLx\n.xxxx." }), legend = el("input", { type: "text", value: "x=out,L=p3,l=p2", style: "width:220px" }), aname = el("input", { type: "text", value: "ascii" });
  box.append(el("h3", {}, t("From text rows")), el("div", { class: "help" }, t("One character per pixel, '.' = empty; the legend maps characters to colour keys.")), ta, el("div", { class: "row" }, t("Legend"), legend, t("name"), aname, btn(t("Add"), () => {
    const lg = {}; for (const pair of legend.value.split(",")) { const [k, v] = pair.split("=").map(x => x.trim()); if (k && v) lg[k] = v; }
    const grid = asciiToGrid(ta.value, lg); if (!grid.length) return;
    snapshot(); const n = uniqueName(aname.value || "ascii"); const spr = M.newSprite(n, grid[0].length, grid.length); spr.frames[0].layers.body = grid;
    for (const v of Object.values(lg)) if (!S.project.palettes.base[v]) S.project.palettes.base[v] = [200, 200, 200, 255];
    S.project.sprites[n] = spr; S.sprite = n; S.tab = "draw"; S.fitPending = true; dlg.classList.remove("on"); commit();
  })));
  box.append(el("h3", {}, t("From an exported pixdata.lua")), el("div", { class: "row" }, btn(t("Choose .lua…"), () => pickFile(".lua", f => f.text().then(x => {
    const r = fromLua(x); if (!r.sprites.length) { toast(t("No sprites found in that file")); return; }
    snapshot();
    for (const [pn, pal] of Object.entries(r.palettes)) S.project.palettes[pn] = { ...(S.project.palettes[pn] || {}), ...pal };
    const groups = {};
    for (const e of r.sprites) { if (/[@~]/.test(e.name)) continue; const base = e.name.split("#")[0]; (groups[base] = groups[base] || []).push(e); }
    for (const [base, list] of Object.entries(groups)) {
      const n = S.project.sprites[base] ? uniqueName(base) : base;
      const spr = M.newSprite(n, list[0].w, list[0].h); spr.ax = list[0].ax; spr.ay = list[0].ay;
      spr.frames = list.map(e => ({ layers: { body: rasterize(decodeRects(e.r, e.k, e.z), e.w, e.h) } }));
      for (const e of list) for (const k of e.k) if (!S.project.palettes.base[k]) S.project.palettes.base[k] = [200, 200, 200, 255];
      S.project.sprites[n] = spr; S.sprite = n;
    }
    dlg.classList.remove("on"); commit();
  }))), el("span", { class: "help" }, t("Brings sprites and palettes back for editing."))));
  box.append(el("div", { class: "row" }, btn(t("Close"), () => { stopFit(); dlg.classList.remove("on"); })));
  dlg.append(box); dlg.classList.add("on");
}

// ---------- welcome ----------
function showWelcome() {
  const dlg = $("#dialog"); dlg.innerHTML = "";
  const go = fn => () => { closeDialog(); fn(); };
  dlg.append(el("div", { class: "box welcome" },
    el("h2", {}, t("Welcome to SpriteForge")),
    el("p", {}, t("Draw or import a small pixel sprite, give it colour variants, animate it, describe how it reacts - then export one Lua file your game draws with plain rectangles. Made for engines that cannot load images, usable anywhere.")),
    el("div", { class: "startbtns" },
      btn([icon("plus", 22), el("b", {}, t("Pixel art")), el("span", { class: "help" }, t("Blank canvas or a ready-made example"))], go(() => openNewSprite("pixel")), { class: "bigbtn" }),
      btn([icon("pencil", 22), el("b", {}, t("Drawing")), el("span", { class: "help" }, t("Free brush strokes, lines, circles and boxes, smooth at any size."))], go(() => openNewSprite("vector")), { class: "bigbtn" }),
      btn([icon("copy", 22), el("b", {}, t("Import image…")), el("span", { class: "help" }, t("Turn a picture into pixel art or a drawing"))], go(openImport), { class: "bigbtn" }),
      btn([icon("play", 22), el("b", {}, t("Load the sample project")), el("span", { class: "help" }, t("A finished sprite with animation and behaviour"))], go(loadSample), { class: "bigbtn" }),
      btn([icon("gear", 22), el("b", {}, t("Read the Guide")), el("span", { class: "help" }, t("What SpriteForge is and how to use it"))], go(() => setTab("guide")), { class: "bigbtn" })),
    el("div", { class: "row" }, el("span", { class: "help" }, t("Language")), el("select", { onchange: e => { setLang(e.target.value); location.reload(); } }, ...LANGS.map(([c, n]) => el("option", { value: c, selected: c === lang }, n))), el("span", { class: "spacer" }), btn(t("Close"), closeDialog)),
    el("div", { class: "help" }, t("Unofficial fan-made tool, not affiliated with any game developer or publisher."), " ", el("a", { href: "#", onclick: e => { e.preventDefault(); openAbout(); } }, t("About SpriteForge")))));
  dlg.classList.add("on");
  try { localStorage.setItem("pixforge.welcomed", "1"); } catch (e) {}
}
// ---------- dialogs: new sprite, export, settings ----------
function popMenu(e, ids, extra = []) {
  closePop();
  const m = el("div", { class: "popmenu", id: "popmenu" });
  for (const id of ids) {
    if (id === "-") { m.append(el("div", { class: "sep" })); continue; }
    const c = CMD(id); const dis = c.when && !c.when();
    m.append(el("button", { class: "mi" + (dis ? " dis" : ""), onmousedown: ev => ev.preventDefault(), onclick: () => { closePop(); if (!dis) c.run(); } }, el("span", { class: "mchk" }), el("span", {}, t(c.label)), el("span", { class: "kb" }, fmtCombo(c.keys[0] || ""))));
  }
  for (const [label, fn] of extra) m.append(el("button", { class: "mi", onmousedown: ev => ev.preventDefault(), onclick: () => { closePop(); fn(); } }, el("span", { class: "mchk" }), el("span", {}, label), el("span")));
  document.body.append(m);
  const r = m.getBoundingClientRect();
  m.style.left = Math.min(e.clientX, innerWidth - r.width - 8) + "px"; m.style.top = Math.min(e.clientY, innerHeight - r.height - 8) + "px";
}
function closePop() { const p = $("#popmenu"); if (p) p.remove(); }

function startPanel() {
  return el("div", { class: "start" },
    el("h2", {}, t("Start a sprite")),
    el("div", { class: "startbtns" },
      btn([icon("plus", 22), el("b", {}, t("Pixel art")), el("span", { class: "help" }, t("Blank canvas or a ready-made example"))], () => openNewSprite("pixel"), { class: "bigbtn" }),
      btn([icon("pencil", 22), el("b", {}, t("Drawing")), el("span", { class: "help" }, t("Free brush strokes, lines, circles and boxes, smooth at any size."))], () => openNewSprite("vector"), { class: "bigbtn" }),
      btn([icon("copy", 22), el("b", {}, t("Import image…")), el("span", { class: "help" }, t("Turn a picture into pixel art or a drawing"))], openImport, { class: "bigbtn" }),
      btn([icon("play", 22), el("b", {}, t("Load the sample project")), el("span", { class: "help" }, t("A finished sprite with animation and behaviour"))], loadSample, { class: "bigbtn" }),
      btn([icon("gear", 22), el("b", {}, t("Guide")), el("span", { class: "help" }, t("What SpriteForge is and how to use it"))], () => setTab("guide"), { class: "bigbtn" })));
}

function openExport() {
  const dlg = $("#dialog"); dlg.innerHTML = "";
  let enc = null, err = null;
  try { enc = encodeProject(S.project); } catch (e) { err = e.message; }
  const box = el("div", { class: "box" }, el("h2", {}, t("Export")));
  const sel = new Set(Object.keys(S.project.sprites));
  const costOf = {};
  const meter = el("div", { class: "meter" }), countLbl = el("span", { class: "help" });
  const refresh = () => {
    let tot = 0; for (const n of sel) tot += costOf[n] || 0;
    meter.className = "meter " + (tot > 2000 ? "bad" : tot > 1200 ? "mid" : "ok");
    meter.innerHTML = ""; meter.append(el("b", {}, tot + " " + t("rectangles")), el("span", {}, " · " + t("{n} of {total} sprites selected", { n: sel.size, total: Object.keys(S.project.sprites).length })));
  };
  if (enc) {
    box.append(meter, el("div", { class: "help" }, t("Each rectangle becomes one UI image control in the game. Rule of thumb: keep everything visible at once under ~2000 on PC and ~1200 on phones. Frames of one sprite reuse the same controls.")));
    const tb = el("table", { class: "keys" });
    const boxes = [];
    for (const s of Object.values(S.project.sprites)) {
      const n = enc.entries.filter(e => e.name === s.name || e.name.startsWith(s.name + "#") || e.name.startsWith(s.name + "/"));
      costOf[s.name] = n.reduce((a, e) => a + e.count, 0);
      const cb = el("input", { type: "checkbox", checked: true, onchange: e => { if (e.target.checked) sel.add(s.name); else sel.delete(s.name); refresh(); } });
      boxes.push([cb, s.name]);
      tb.append(el("tr", {}, el("td", {}, el("label", { class: "chk" }, cb, s.name)), el("td", {}, s.w + "×" + s.h + " · " + s.frames.length + " " + t("frames")), el("td", {}, costOf[s.name] + " " + t("rectangles"))));
    }
    const setAll = on => { for (const [cb, n] of boxes) { cb.checked = on; if (on) sel.add(n); else sel.delete(n); } refresh(); };
    box.append(el("div", { class: "row" }, btn(t("Select all"), () => setAll(true), { class: "small" }), btn(t("Select none"), () => setAll(false), { class: "small" }),
      sp() ? btn(t("Only the current sprite"), () => { setAll(false); const c = boxes.find(b => b[1] === S.sprite); if (c) { c[0].checked = true; sel.add(S.sprite); } refresh(); }, { class: "small" }) : null), tb,
      el("div", { class: "help" }, t("Only the ticked sprites are exported, with their clips and behaviours. The game reads one export per stage, so put everything that stage needs into it.")));
    refresh();
  } else box.append(el("div", { class: "warn" }, err));
  const errors = M.validate(S.project); if (errors.length) box.append(el("div", { class: "warn" }, errors.join(" · ")));
  const es = exportSetup();
  const numIn = (val, onSet) => el("input", { type: "text", inputmode: "numeric", value: val == null ? "" : String(val), placeholder: "1073741…", style: "width:150px",
    onchange: e => { const v = e.target.value.trim(); if (v === "") { onSet(null); autosave(); return; } if (!/^\d+$/.test(v)) { toast(t("Enter the template Index as a number")); e.target.value = val == null ? "" : String(val); return; } onSet(+v); autosave(); } });
  const showBox = el("div", { class: "showlist" });
  const drawShow = () => {
    showBox.innerHTML = "";
    es.show.forEach((row, i) => {
      const pick = el("select", { onchange: e => { if (row.size === showSize(row.sprite)) row.size = showSize(e.target.value); row.sprite = e.target.value; autosave(); drawShow(); } }, ...Object.keys(S.project.sprites).map(n => el("option", { value: n, selected: n === row.sprite }, n)));
      const num = (key, w) => el("input", { type: "number", step: "any", value: row[key], style: "width:" + w + "px", onchange: e => { row[key] = +e.target.value || 0; autosave(); } });
      showBox.append(el("div", { class: "row" }, pick, t("Size"), num("size", 60), "X", num("x", 70), "Y", num("y", 70),
        es.show.length > 1 ? btn(t("Remove"), () => { es.show.splice(i, 1); autosave(); drawShow(); }, { class: "small" }) : null));
    });
    showBox.append(el("div", { class: "row" }, btn("+ " + t("Add another sprite"), () => { const last = es.show[es.show.length - 1]; es.show.push({ sprite: last.sprite, x: 0, y: 0, size: last.size || showSize(last.sprite) }); autosave(); drawShow(); }, { class: "small" })));
  };
  drawShow();
  box.append(el("h3", {}, t("One file for the game")),
    el("div", { class: "help" }, t("Recommended. spriteforge.lua holds the ticked sprites, the runtime and a start script. Put it into external_lua_file, add it in Client Script Resource Explorer and attach it to a Client Control Container. Nothing else to download.")),
    el("div", { class: "row" }, el("b", { class: "lbl" }, t("Image template Index")), numIn(es.template, v => { es.template = v; }),
      el("span", { class: "help" }, t("UI Control Group Library → Client Control Templates → your Image template. Leave it empty to read the TPL_SPRITE script variable instead."))),
    el("div", { class: "row" }, el("b", { class: "lbl" }, t("Tap template Index")), numIn(es.tapTemplate, v => { es.tapTemplate = v; }),
      el("span", { class: "help" }, t("Optional. A CursorEventArea template, only needed if a sprite should react to taps."))),
    el("b", {}, t("Show when the game starts")),
    el("div", { class: "help" }, t("(0, 0) is the centre of the container. Size is how many screen units one pixel or one drawing unit takes.")),
    showBox,
    el("div", { class: "row" }, btn([icon("down", 16), t("Download spriteforge.lua")], () => exportBundle([...sel]), { class: "primary big" }),
      btn(t("Export PNG"), exportPng, { title: tip(t("Export PNG"), kb("exportPng")) }),
      btn(t("Save project"), saveProject, { title: tip(t("Save project"), kb("save")) })));
  const adv = el("details", { class: "adv" }, el("summary", {}, t("Separate files (for programmers)")),
    el("div", { class: "help" }, t("Use these when you control the sprites from your own scripts. Do not mix them with spriteforge.lua in one stage.")),
    el("div", { class: "row" },
      btn([icon("down", 16), t("Download pixdata.lua")], () => { exportLua([...sel]); }),
      btn([icon("down", 16), "pix.lua"], downloadRuntime, { title: t("Runtime that draws the sprites in the game") }),
      btn([icon("down", 16), "spriteforge_main.lua"], downloadMain, { title: t("Main script, already set to the current sprite") })));
  box.append(adv);
  const s = sp();
  if (s) {
    const b = S.project.behaviors[s.name]; const clips = clipsOf(s).map(([n]) => shortClip(n));
    const code = [`local Px = require("pix")`, `local root = Px.root(script)`, `local a = Px.spawn(root, "${s.name}", 0, 0, { pal = "${S.previewPal}" })`,
      clips.length ? `a:play("${clips[0]}")` : null, b ? `a:fire("tap")` : null, b && Object.keys(b.params).length ? `a:set("${Object.keys(b.params)[0]}", 0.5)` : null,
      s.nine ? `local panel = Px.nine(root, "${s.name}", 0, 0, 420, 160)` : null, `-- OnUpdate(dt): Px.update(dt)`].filter(Boolean).join("\n");
    adv.append(el("details", {}, el("summary", {}, t("Use in Lua") + ": " + s.name), el("pre", {}, code)));
  }
  box.append(el("div", { class: "row" }, el("span", { class: "help" }, t("Step-by-step setup is in the Guide, section 6.")), btn(t("Guide"), () => { closeDialog(); setTab("guide"); }, { class: "small" }), el("a", { href: "docs/index.html", target: "_blank" }, t("Open the Docs")), el("span", { class: "spacer" }), btn(t("Close"), closeDialog)));
  dlg.append(box); dlg.classList.add("on");
}

function openAbout() {
  const dlg = $("#dialog"); dlg.innerHTML = "";
  dlg.append(el("div", { class: "box" }, el("h2", {}, "SpriteForge 1.1"),
    el("p", {}, t("SpriteForge is an independent, unofficial, fan-made tool. It is not affiliated with, endorsed, sponsored or approved by any game developer or publisher. All trademarks belong to their respective owners.")),
    el("p", {}, t("SpriteForge contains no game files, art or code. It refers to the built-in shapes of the editor only by their index numbers (100001, 100002, 100003). Everything you draw and export is your own work.")),
    el("p", {}, t("Users are solely responsible for the content they create, import and export with SpriteForge, including having the rights to any images they import. The developer is not responsible for user-created content or for how it is used. SpriteForge is provided as is, without warranty of any kind.")),
    el("p", { class: "help" }, "© 2026 khruq · ", t("Open source under the MIT licence."), " ", el("a", { href: "https://github.com/khruq/SpriteForge", target: "_blank", rel: "noopener" }, "github.com/khruq/SpriteForge")),
    el("div", { class: "row" }, el("span", { class: "spacer" }), btn(t("Close"), closeDialog))));
  dlg.classList.add("on");
}
function openSettings() {
  const dlg = $("#dialog"); dlg.innerHTML = "";
  dlg.append(el("div", { class: "box" }, el("h2", {}, t("Settings")),
    el("div", { class: "row" }, el("b", { class: "lbl" }, t("Project name")), el("input", { type: "text", value: S.project.name, style: "width:220px", onchange: e => { snapshot(); S.project.name = e.target.value; autosave(); } })),
    el("div", { class: "row" }, el("b", { class: "lbl" }, t("Language")), el("select", { onchange: e => { setLang(e.target.value); location.reload(); } }, ...LANGS.map(([c, n]) => el("option", { value: c, selected: c === lang }, n)))),
    el("div", { class: "row" }, el("b", { class: "lbl" }, t("Keyboard shortcuts")), btn(t("Change") + "…", showShortcuts)),
    el("div", { class: "row" }, el("span", { class: "spacer" }), btn(t("Close"), closeDialog))));
  dlg.classList.add("on");
}

function openNewSprite(kind) {
  kind = kind || S.newKind || "pixel"; S.newKind = kind;
  const vec = kind === "vector", MAXV = 1024;
  const dlg = $("#dialog"); dlg.innerHTML = "";
  const name = el("input", { type: "text", value: uniqueName(vec ? "drawing" : "sprite"), style: "width:160px" });
  const def = vec ? 64 : 16, max = vec ? MAXV : M.MAX_SIZE;
  const w = el("input", { type: "number", min: 1, max, value: def }), h = el("input", { type: "number", min: 1, max, value: def });
  const sizes = el("div", { class: "seg" }); for (const n of (vec ? [32, 64, 128, 256] : [8, 16, 24, 32, 48, 64, 128])) sizes.append(btn(String(n), () => { w.value = n; h.value = n; }));
  const create = () => {
    name.value = latinName(name.value); const n = name.value.trim(); if (!NAME_RE.test(n)) { toast(t("Letters, digits, _ and - only")); return; }
    const W = Math.max(1, Math.min(max, +w.value || def)), H = Math.max(1, Math.min(max, +h.value || def));
    snapshot(); const nn = uniqueName(n); S.project.sprites[nn] = vec ? newVectorSprite(nn, W, H) : M.newSprite(nn, W, H); S.sprite = nn; S.frame = 0; S.layer = 0; S.tab = "draw"; S.fitPending = true;
    if (vec) S.tool = "pencil";
    if (!S.key) S.key = Object.keys(S.project.palettes.base)[0] || null;
    closeDialog(); commit();
  };
  const gallery = el("div", { class: "gallery" });
  if (vec) {
    for (const p of VECTOR_PRESETS) {
      const cv = el("canvas", { width: 64, height: 64 });
      drawPrims(cv.getContext("2d"), compileShapes(p.shapes), k => VECTOR_PRESET_COLORS[k], 4, 4, 56 / 64);
      gallery.append(btn([cv, el("span", {}, p.name), el("span", { class: "help" }, compileShapes(p.shapes).length + " " + t("rectangles"))], () => { addVectorPreset(p); closeDialog(); }, { class: "gcard" }));
    }
  } else for (const p of PRESETS) {
    const g = presetGrid(p), cv = el("canvas", { width: 64, height: 64 }), ctx = cv.getContext("2d"), z = Math.floor(56 / Math.max(g.length, g[0].length)), ox = (64 - g[0].length * z) / 2, oy = (64 - g.length * z) / 2;
    g.forEach((row, y) => row.forEach((k, x) => { if (!k) return; const c = PRESET_COLORS[k]; ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; ctx.fillRect(ox + x * z, oy + y * z, z, z); }));
    gallery.append(btn([cv, el("span", {}, p.name), el("span", { class: "help" }, g[0].length + "×" + g.length)], () => { addPreset(p); closeDialog(); }, { class: "gcard" }));
  }
  const kinds = el("div", { class: "kinds" },
    btn([el("b", {}, t("Pixel art")), el("span", { class: "help" }, t("A grid of pixels. Crisp retro look, pencil and fill tools."))], () => openNewSprite("pixel"), { class: "kindbtn", on: !vec }),
    btn([el("b", {}, t("Drawing")), el("span", { class: "help" }, t("Free brush strokes, lines, circles and boxes, smooth at any size."))], () => openNewSprite("vector"), { class: "kindbtn", on: vec }));
  dlg.append(el("div", { class: "box" }, el("h2", {}, t("New sprite…")), kinds,
    el("h3", {}, t("Blank canvas")),
    el("div", { class: "row" }, el("span", { class: "help" }, t("name")), name, el("span", { class: "help" }, t("Size")), w, "×", h, sizes),
    el("div", { class: "row" }, btn(t("Create"), create, { class: "primary" }), el("span", { class: "help" }, vec ? t("Size is in drawing units. The cost depends on the number of strokes and shapes, not on the size.") : t("Up to {n}×{n} pixels. Bigger sprites cost more rectangles.", { n: M.MAX_SIZE }))),
    el("h3", {}, t("Start from an example")), gallery,
    el("div", { class: "row" }, btn(t("Import image…"), () => { closeDialog(); openImport(vec ? "shapes" : "pixels"); }), el("span", { class: "spacer" }), btn(t("Cancel"), closeDialog))));
  dlg.classList.add("on");
  setTimeout(() => name.focus(), 0);
}
function addPreset(p) {
  snapshot();
  const base = S.project.palettes.base, rename = {};
  for (const k of new Set(Object.values(p.legend))) {
    const c = PRESET_COLORS[k];
    if (!base[k]) base[k] = c.slice();
    else if (base[k].join() !== c.join()) { let i = 2; while (base[k + "_" + i] && base[k + "_" + i].join() !== c.join()) i++; base[k + "_" + i] = c.slice(); rename[k] = k + "_" + i; }
  }
  const g = presetGrid(p).map(r => r.map(k => k ? (rename[k] || k) : null));
  const n = uniqueName(p.name), s = M.newSprite(n, g[0].length, g.length);
  s.frames[0].layers.body = g; s.ax = Math.floor(s.w / 2); s.ay = s.h - 1; if (p.nine) s.nine = { ...p.nine };
  S.project.sprites[n] = s; S.sprite = n; S.frame = 0; S.layer = 0; S.tab = "draw"; S.fitPending = true;
  S.key = rename[p.legend[Object.keys(p.legend)[1]]] || p.legend[Object.keys(p.legend)[1]] || S.key;
  commit();
}

// ---------- render + boot ----------
function renderAll() {
  fixSelection();
  document.body.classList.toggle("nodraw", S.tab !== "draw"); document.body.classList.toggle("guidemode", S.tab === "guide");
  buildMenubar();
  buildDocTabs();
  buildToolbar();
  for (const id of ["draw", "animate", "behave", "guide"]) $("#tab-" + id).classList.toggle("on", S.tab === id);
  if (S.tab === "draw") buildDraw(); else if (S.tab === "animate") buildAnimate(); else if (S.tab === "behave") buildBehave(); else buildGuide();
  resetActor();
  renderRight(true);
  updateStatus();
}
function boot() {
  document.documentElement.lang = lang;
  registerCommands();
  const safe = /[?&]safe\b/.test(location.search);
  S.project = safe ? null : migrateProject(autoload());
  if (safe) setTimeout(() => toast(t("Started without the saved project. Open a project file or start a new one.")), 300);
  let fresh = false;
  if (!S.project) { S.project = sampleProject(); S.sprite = "potion"; S.key = "p2"; fresh = true; }
  if (S.key === null) S.key = Object.keys(S.project.palettes.base)[0] || null;
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", () => { S.spaceDown = false; S.pan = null; });
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("resize", () => { if (S.tab === "draw") { S.fitPending = true; buildDraw(); } });
  document.addEventListener("mousedown", e => { if (S.menu && !e.target.closest(".menu")) { S.menu = null; buildMenubar(); } });
  autosave();
  window.PF = { S, toLua, toJSON, render: renderAll, snapshot, commit, loadSample, CMDS };
  renderAll();
  requestAnimationFrame(tick);
  let welcomed = false; try { welcomed = !!localStorage.getItem("pixforge.welcomed"); } catch (e) {}
  if (fresh || !welcomed) showWelcome();
}
boot();
