// FicheDéputé.fr — zero-dependency Node HTTP server.
// Serves the static PWA + a small read-only JSON API over the pre-computed data.
const http = require("http");
const fs = require("fs");
const path = require("path");
const data = require("./lib/data");
const og = require("./lib/og");
const tracker = require("./lib/tracker");
const seo = require("./lib/seo");
const locales = require("./lib/locales");
const faq = require("./lib/faq");
const mediakit = require("./lib/mediakit");
const { Resvg } = require("@resvg/resvg-js");

// which brand this deployment IS (highlighted first in the media kit) — fr | senat | eu
const SITE_BRAND = process.env.SITE_BRAND || "fr";

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
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function send(res, code, body, headers = {}) {
  res.writeHead(code, headers);
  res.end(body);
}
function json(res, obj, code = 200, cache = "public, max-age=300") {
  send(res, code, JSON.stringify(obj), { "content-type": MIME[".json"], "cache-control": cache });
}

function sendShell(res, pathname) {
  // serve index.html with per-route <head> meta injected for crawlers;
  // unknown routes come back with a real 404 status (no soft-404s)
  fs.readFile(path.join(PUB, "index.html"), "utf8", (e, html) => {
    if (e) return send(res, 404, "not found");
    const out = seo.injectMeta(html, pathname);
    send(res, out.status, out.html, { "content-type": MIME[".html"], "cache-control": "no-cache" });
  });
}

function serveStatic(req, res, urlPath) {
  const pathname = decodeURIComponent(urlPath.split("?")[0]);
  if (pathname === "/") return sendShell(res, "/");
  const file = path.join(PUB, path.normalize(pathname).replace(/^(\.\.[/\\])+/, ""));
  if (!file.startsWith(PUB)) return send(res, 403, "forbidden");
  fs.readFile(file, (err, buf) => {
    if (err) {
      // missing asset-like path (has an extension) → plain 404, not the shell
      if (/\.[a-z0-9]{2,5}$/i.test(pathname)) return send(res, 404, "not found", { "content-type": "text/plain; charset=utf-8" });
      return sendShell(res, pathname); // route → shell (SSR + real status inside)
    }
    const ext = path.extname(file);
    const cache = ext === ".html" ? "no-cache" : ext === ".woff2" ? "public, max-age=31536000, immutable" : "public, max-age=3600";
    send(res, 200, buf, { "content-type": MIME[ext] || "application/octet-stream", "cache-control": cache });
  });
}

const server = http.createServer((req, res) => {
  const url = req.url;

  // ---- locale: the default locale owns the bare path; a redundant
  // "/<default>" prefix 301s to the canonical bare URL (no duplicate content).
  const pathOnly = url.split("?")[0];
  const defPrefix = new RegExp(`^/${locales.DEFAULT}(/|$)`);
  if (defPrefix.test(pathOnly)) {
    let stripped = pathOnly.replace(new RegExp(`^/${locales.DEFAULT}`), "") || "/";
    // never emit a protocol-relative or non-absolute Location (open-redirect guard)
    if (!stripped.startsWith("/") || stripped.startsWith("//")) stripped = "/";
    const qs = url.includes("?") ? url.slice(url.indexOf("?")) : "";
    return send(res, 301, "", { location: stripped + qs });
  }

  // ---- API ----------------------------------------------------------------
  if (url.startsWith("/api/")) {
    const u = new URL(url, "http://x");
    const p = u.pathname;

    if (p === "/api/deputes") return json(res, { meta: data.store.meta, deputes: data.store.deputes });
    if (p === "/api/groupes") return json(res, { groupes: data.store.groupes });
    if (p === "/api/stats") return json(res, data.store.stats);
    if (p === "/api/scrutins") return json(res, { scrutins: data.store.scrutins });
    if (p === "/api/meta") return json(res, data.store.meta);
    if (p === "/api/faq") return json(res, faq, 200, "public, max-age=3600");
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
  if (url === "/llms.txt") {
    return send(res, 200, seo.llms(), { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" });
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

  // ---- Media kit ----------------------------------------------------------
  if (url === "/mediakit" || url === "/mediakit/") {
    return fs.readFile(path.join(PUB, "mediakit.html"), (e, buf) =>
      e ? send(res, 404, "not found")
        : send(res, 200, buf, { "content-type": MIME[".html"], "cache-control": "no-cache" }));
  }
  if (url === "/mediakit/config.json") {
    return json(res, { current: SITE_BRAND, brands: Object.values(mediakit.BRANDS), kinds: mediakit.KINDS }, 200, "public, max-age=600");
  }
  if (url.startsWith("/mediakit/asset/")) {
    const m = url.slice("/mediakit/asset/".length).split("?")[0].match(/^([a-z]+)\/([a-z0-9-]+)\.(svg|png)$/);
    if (!m) return send(res, 404, "not found");
    const [, brand, kind, ext] = m;
    const svg = mediakit.render(brand, kind);
    if (!svg) return send(res, 404, "not found");
    const dl = /[?&]dl=/.test(url);
    const fname = `fichedepute-${brand}-${kind}.${ext}`;
    const disp = dl ? { "content-disposition": `attachment; filename="${fname}"` } : {};
    if (ext === "svg") {
      return send(res, 200, svg, { "content-type": MIME[".svg"], "cache-control": "public, max-age=86400", ...disp });
    }
    try {
      return send(res, 200, renderPng(svg), { "content-type": MIME[".png"], "cache-control": "public, max-age=86400", ...disp });
    } catch (e) {
      console.error("mediakit png render failed:", e.message);
      return send(res, 200, svg, { "content-type": MIME[".svg"], "cache-control": "public, max-age=600" });
    }
  }

  // ---- static -------------------------------------------------------------
  serveStatic(req, res, url);
});

data.load();
server.listen(PORT, () => console.log(`FicheDéputé on :${PORT} — ${data.store.deputes.length} députés`));
