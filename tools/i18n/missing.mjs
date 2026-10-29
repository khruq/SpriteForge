import fs from "fs";
const dir = new URL(".", import.meta.url).pathname;
const src = fs.readFileSync(dir + "../../js/app.js", "utf8");
const keys = JSON.parse(fs.readFileSync(dir + "keys.json", "utf8"));
const found = new Set();
const unq = s => JSON.parse('"' + s + '"');
for (const m of src.matchAll(/\bt\("((?:[^"\\]|\\.)*)"/g)) found.add(unq(m[1]));
for (const m of src.matchAll(/\bcmd\("[^"]+",\s*"((?:[^"\\]|\\.)*)"/g)) found.add(unq(m[1]));
for (const m of src.matchAll(/\["[a-z]+",\s*"((?:[^"\\]|\\.)*)",\s*"[^"]*"\]/g)) found.add(unq(m[1]));
for (const m of src.matchAll(/^\s*\["([A-Z][a-z]+)",\s*\[/gm)) found.add(m[1]);
for (const m of src.matchAll(/PROP_HELP = \{([^}]+)\}/g)) for (const x of m[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)) if (x[1].includes(" ")) found.add(unq(x[1]));
const miss = [...found].filter(k => !keys.includes(k) && /[A-Za-z]/.test(k));
if (process.argv[2] === "--append") { fs.writeFileSync(dir + "keys.json", JSON.stringify([...keys, ...miss], null, 1)); fs.writeFileSync(dir + "new_keys.json", JSON.stringify(miss, null, 1)); }
console.log(miss.length, JSON.stringify(miss));
