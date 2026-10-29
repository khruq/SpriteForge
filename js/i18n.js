// SpriteForge - UI strings. Keys are the English text; t() returns the translation
// for the active language or the key itself. Languages follow the 15 Genshin
// client languages. Placeholders look like {n}.
import { STRINGS } from "./strings.js?v=1.0";

export const LANGS = [
  ["en", "English"], ["zh-CN", "简体中文"], ["zh-TW", "繁體中文"], ["ja", "日本語"], ["ko", "한국어"],
  ["es", "Español"], ["fr", "Français"], ["ru", "Русский"], ["th", "ไทย"], ["vi", "Tiếng Việt"],
  ["de", "Deutsch"], ["id", "Bahasa Indonesia"], ["pt", "Português"], ["tr", "Türkçe"], ["it", "Italiano"],
];

export function detectLang() {
  try { const saved = localStorage.getItem("pixforge.lang"); if (saved) return saved; } catch (e) {}
  const nav = (navigator.languages || [navigator.language || "en"]);
  for (const l of nav) {
    const low = l.toLowerCase();
    if (low.startsWith("zh")) return (low.includes("tw") || low.includes("hk") || low.includes("hant")) ? "zh-TW" : "zh-CN";
    const short = low.slice(0, 2);
    const hit = LANGS.find(([code]) => code.toLowerCase().startsWith(short));
    if (hit) return hit[0];
  }
  return "en";
}

export let lang = detectLang();
export function setLang(code) { lang = code; try { localStorage.setItem("pixforge.lang", code); } catch (e) {} }

export function t(key, params) {
  const table = STRINGS[lang] || {};
  let s = table[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replace(new RegExp("\\{" + k + "\\}", "g"), String(v));
  return s;
}
