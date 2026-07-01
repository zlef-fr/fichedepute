// FicheDéputé.fr — zero-dependency Node HTTP server.
// Serves the static PWA + a small read-only JSON API over the pre-computed data.
const http = require("http");
const fs = require("fs");
const path = require("path");
const data = require("./lib/data");
const og = require("./lib/og");
const tracker = require("./lib/tracker");
const seo = require("./lib/seo");
const { Resvg } = require("@resvg/resvg-js");

const isSlug = (s) => !!data.store.bySlug[s];

const PORT = process.env.PORT || 10091;
const PUB = path.join(__dirname, "public");
const VAR = process.env.VAR_DIR || path.join(__dirname, "var");

// SVG → PNG for social share cards (in-process, no browser)
function renderPng(svg) {
  return new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
    font: { loadSystemFonts: true, defaultFontFamily: "DejaVu Sans" },
  }).render().asPng();
}

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

function sendShell(res, pathname) {
  // serve index.html with per-route <head> meta injected for crawlers
  fs.readFile(path.join(PUB, "index.html"), "utf8", (e, html) =>
    e ? send(res, 404, "not found")
      : send(res, 200, seo.injectMeta(html, pathname), { "content-type": MIME[".html"], "cache-control": "no-cache" })
  );
}

function serveStatic(req, res, urlPath) {
  const pathname = decodeURIComponent(urlPath.split("?")[0]);
  if (pathname === "/") return sendShell(res, "/");
  const file = path.join(PUB, path.normalize(pathname).replace(/^(\.\.[/\\])+/, ""));
  if (!file.startsWith(PUB)) return send(res, 403, "forbidden");
  fs.readFile(file, (err, buf) => {
    if (err) return sendShell(res, pathname); // SPA fallback → client router
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
    if (p === "/api/indemnite") return json(res, data.store.indemnite || {}, 200, "public, max-age=86400");
    if (p === "/api/game/round") {
      const round = data.gameRound();
      return round ? json(res, round, 200, "no-cache") : json(res, { error: "no pool" }, 503, "no-cache");
    }
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

  // ---- SEO: full sitemap (all fiches) + robots (own the .fr canonical) ---
  if (url === "/sitemap.xml" || url.startsWith("/sitemap.xml?")) {
    return send(res, 200, seo.sitemap(), { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" });
  }
  if (url === "/robots.txt") {
    return send(res, 200, seo.robots(), { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" });
  }

  // ---- dynamic OG share image — PNG (rendered on the fly + cached) or SVG -
  if (url.startsWith("/og/")) {
    const slug = url.slice("/og/".length).replace(/\.(svg|png).*$/, "");
    const wantPng = /\.png/.test(url);
    const light = data.store.bySlug[slug];
    if (!light) return send(res, 404, "not found");
    if (!wantPng) {
      return send(res, 200, og.card(light), { "content-type": MIME[".svg"], "cache-control": "public, max-age=3600" });
    }
    const dir = path.join(VAR, "og");
    const file = path.join(dir, slug + ".png");
    return fs.readFile(file, (err, buf) => {
      if (!buf) {
        try {
          buf = renderPng(og.card(light));
        } catch (e) {
          console.error("og png render failed:", e.message);
          return send(res, 200, og.card(light), { "content-type": MIME[".svg"], "cache-control": "public, max-age=600" });
        }
        fs.mkdir(dir, { recursive: true }, () => fs.writeFile(file, buf, () => {}));
      }
      send(res, 200, buf, { "content-type": MIME[".png"], "cache-control": "public, max-age=86400" });
    });
  }

  // ---- static -------------------------------------------------------------
  serveStatic(req, res, url);
});

data.load();
server.listen(PORT, () => console.log(`FicheDéputé on :${PORT} — ${data.store.deputes.length} députés`));
