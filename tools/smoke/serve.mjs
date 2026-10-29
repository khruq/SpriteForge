import http from "http"; import fs from "fs"; import path from "path";
const root = process.argv[2] || "."; const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".lua": "text/plain" };
http.createServer((q, r) => { const p = path.join(root, decodeURIComponent(q.url.split("?")[0])); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); r.end(d); }); }).listen(8765);
