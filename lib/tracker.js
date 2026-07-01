// Per-page view counter with throttled disk persistence.
// Keys are normalised to a safe, bounded set (fixed routes + validated deputy
// slugs) so a client can't inject arbitrary keys or grow the store unboundedly.
const fs = require("fs");
const path = require("path");

const VAR = process.env.VAR_DIR || path.join(__dirname, "..", "var");
const FILE = path.join(VAR, "views.json");
const FIXED = new Set(["home", "deputes", "classements", "groupes", "methode"]);

let counts = {};
let dirty = false;

function load() {
  try {
    fs.mkdirSync(VAR, { recursive: true });
    counts = JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch { counts = {}; }
}
function flush() {
  if (!dirty) return;
  dirty = false;
  try { fs.writeFileSync(FILE, JSON.stringify(counts)); }
  catch (e) { console.error("tracker flush failed:", e.message); }
}

// Turn a request path into a safe storage key, or null to ignore.
// `isSlug(slug)` validates deputy pages against the real dataset.
function keyFor(rawPath, isSlug) {
  let p = String(rawPath || "").split("?")[0].replace(/\/+$/, "") || "/";
  if (p === "/") return "home";
  const seg = p.replace(/^\//, "");
  if (FIXED.has(seg)) return seg;
  const m = p.match(/^\/depute\/([a-z0-9-]{1,80})$/);
  if (m && isSlug(m[1])) return "depute/" + m[1];
  return null;
}

function hit(rawPath, isSlug) {
  const key = keyFor(rawPath, isSlug);
  if (!key) return null;
  counts[key] = (counts[key] || 0) + 1;
  dirty = true;
  return counts[key];
}
function get(rawPath, isSlug) {
  const key = keyFor(rawPath, isSlug);
  return key ? counts[key] || 0 : 0;
}
function total() {
  let t = 0;
  for (const k in counts) t += counts[k];
  return t;
}

load();
const timer = setInterval(flush, 5000);
if (timer.unref) timer.unref();
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => { flush(); process.exit(0); });

module.exports = { hit, get, total };
