// FicheDéputé.fr — zero-dependency Node HTTP server.
// Serves the static PWA + a small read-only JSON API over the pre-computed data.
const http = require("http");
const fs = require("fs");
const path = require("path");
const data = require("./lib/data");
const og = require("./lib/og");
const tracker = require("./lib/tracker");

const isSlug = (s) => !!data.store.bySlug[s];

const PORT = process.env.PORT || 10091;
const PUB = path.join(__dirname, "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
  ".ico": "image/x-icon",
};

function send(res, code, body, headers = {}) {
  res.writeHead(code, headers);
  res.end(body);
}
function json(res, obj, code = 200, cache = "public, max-age=300") {
  send(res, code, JSON.stringify(obj), { "content-type": MIME[".json"], "cache-control": cache });
}

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  const file = path.join(PUB, path.normalize(rel).replace(/^(\.\.[/\\])+/, ""));
  if (!file.startsWith(PUB)) return send(res, 403, "forbidden");
  fs.readFile(file, (err, buf) => {
    if (err) {
      // SPA fallback → index.html (client router handles the route)
      return fs.readFile(path.join(PUB, "index.html"), (e2, idx) =>
        e2 ? send(res, 404, "not found") : send(res, 200, idx, { "content-type": MIME[".html"], "cache-control": "no-cache" })
      );
    }
    const ext = path.extname(file);
    const cache = ext === ".html" ? "no-cache" : "public, max-age=3600";
    send(res, 200, buf, { "content-type": MIME[ext] || "application/octet-stream", "cache-control": cache });
  });
}

const server = http.createServer((req, res) => {
  const url = req.url;

  // ---- API ----------------------------------------------------------------
  if (url.startsWith("/api/")) {
    const u = new URL(url, "http://x");
    const p = u.pathname;

    if (p === "/api/deputes") return json(res, { meta: data.store.meta, deputes: data.store.deputes });
    if (p === "/api/groupes") return json(res, { groupes: data.store.groupes });
    if (p === "/api/stats") return json(res, data.store.stats);
    if (p === "/api/scrutins") return json(res, { scrutins: data.store.scrutins });
    if (p === "/api/meta") return json(res, data.store.meta);
    // per-page view counter — POST {path} increments, GET reads (no count)
    if (p === "/api/view") {
      if (req.method === "POST") {
        let body = "";
        req.on("data", (c) => { body += c; if (body.length > 2000) req.destroy(); });
        req.on("end", () => {
          let target = "/";
          try { target = JSON.parse(body || "{}").path || "/"; } catch {}
          const count = tracker.hit(target, isSlug);
          json(res, { count, total: tracker.total() }, 200, "no-cache");
        });
        return;
      }
      const count = tracker.get(u.searchParams.get("path") || "/", isSlug);
      return json(res, { count, total: tracker.total() }, 200, "no-cache");
    }
    if (p === "/api/search") {
      const q = u.searchParams.get("q") || "";
      return json(res, { results: data.search(q, 30) }, 200, "public, max-age=60");
    }
    if (p.startsWith("/api/depute/")) {
      const key = p.slice("/api/depute/".length);
      const light = data.store.bySlug[key];
      const uid = light ? light.uid : key;
      const f = data.fiche(uid);
      return f ? json(res, f) : json(res, { error: "not found" }, 404, "no-cache");
    }
    return json(res, { error: "unknown endpoint" }, 404, "no-cache");
  }

  // ---- dynamic OG share image (SVG) --------------------------------------
  if (url.startsWith("/og/")) {
    const slug = url.slice("/og/".length).replace(/\.svg.*$/, "");
    const light = data.store.bySlug[slug];
    if (!light) return send(res, 404, "not found");
    const svg = og.card(light);
    return send(res, 200, svg, { "content-type": MIME[".svg"], "cache-control": "public, max-age=3600" });
  }

  // ---- static -------------------------------------------------------------
  serveStatic(req, res, url);
});

data.load();
server.listen(PORT, () => console.log(`FicheDéputé on :${PORT} — ${data.store.deputes.length} députés`));
