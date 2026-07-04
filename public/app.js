// FicheDéputé.fr — SPA core: i18n, routing, data fetching, shared helpers.
const STD = (window.STD = {});

// ── i18n & locale routing ─────────────────────────────────────────────────
// The URL is authoritative: the default locale owns the bare path, every other
// locale lives under "/<lang>". Resolution order for what to render:
//   path prefix  →  ?lang=  →  (default). A zl-lang cookie only soft-redirects a
// returning visitor from the bare default path to their locale (bots carry no
// cookie, so the canonical stays crawlable).
const LOCALES = ["fr", "en"];
const DEFAULT_LANG = "fr";
function cookie(name) {
  const m = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
  return m ? decodeURIComponent(m.pop()) : null;
}
// Strip a leading "/<lang>" segment, returning the bare route path.
STD.stripLocale = (p) => {
  const m = p.match(/^\/([a-z]{2})(\/.*)?$/);
  return m && LOCALES.includes(m[1]) ? m[2] || "/" : p || "/";
};
// Build the URL path for a bare route in a locale (bare for the default).
STD.localized = (p, lang) => {
  const bare = STD.stripLocale(p);
  const clean = bare === "/" ? "" : bare;
  return lang === DEFAULT_LANG ? clean || "/" : `/${lang}${clean}`;
};
function pathLang() {
  const m = location.pathname.match(/^\/([a-z]{2})(\/|$)/);
  return m && LOCALES.includes(m[1]) ? m[1] : null;
}
function queryLang() {
  const q = new URLSearchParams(location.search).get("lang");
  return LOCALES.includes(q) ? q : null;
}
STD.lang = pathLang() || queryLang() || DEFAULT_LANG;
// ?lang= on a bare URL → normalise to the locale-prefixed path.
if (!pathLang() && queryLang()) history.replaceState({}, "", STD.localized(location.pathname, STD.lang));
// Returning visitor on the bare default path → honour their saved locale.
else if (!pathLang() && !queryLang()) {
  const c = cookie("zl-lang");
  if (c && c !== DEFAULT_LANG && LOCALES.includes(c)) {
    STD.lang = c;
    history.replaceState({}, "", STD.localized(location.pathname, c));
  }
}
document.cookie = `zl-lang=${STD.lang};path=/;domain=.zlef.fr;max-age=31536000`;
document.documentElement.lang = STD.lang;
const DICT = window.STD_I18N;
STD.t = (key, vars) => {
  let s = (DICT[STD.lang] && DICT[STD.lang][key]) || DICT.en[key] || key;
  if (vars) for (const k in vars) s = s.replace(`{${k}}`, vars[k]);
  return s;
};

// ── helpers ───────────────────────────────────────────────────────────────
STD.esc = (s) => (s == null ? "" : String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c])));
STD.initials = (d) => ((d.prenom || " ")[0] + (d.nom || " ")[0]).toUpperCase();
STD.civ = (d) => (d.sexe === "F" ? "Mme" : "M.");
const cache = {};
STD.getJSON = async (url) => {
  if (cache[url]) return cache[url];
  const r = await fetch(url);
  if (!r.ok) throw new Error(r.status);
  const j = await r.json();
  cache[url] = j;
  return j;
};
STD.avatar = (d, cls = "") =>
  `<div class="avatar ${cls}" style="background:${STD.esc(d.groupeColor || d.groupe?.color || "#000091")}">${STD.initials(d)}</div>`;
STD.grpPill = (sigle, libelle, color) =>
  `<span class="grp-pill" style="background:${STD.esc(color)}" title="${STD.esc(libelle)}"><span class="grp-dot" style="background:rgba(255,255,255,.7)"></span>${STD.esc(sigle)}</span>`;
STD.circoLabel = (d) => {
  const dep = d.dep || d.depNom;
  const parts = [];
  if (d.depNom) parts.push(`${d.dep ? d.dep + " · " : ""}${d.depNom}`);
  if (d.circo) parts.push(`${d.circo}ᵉ circo.`);
  return parts.join(" — ");
};
STD.presenceColor = (v) => (v >= 50 ? "#18753c" : v >= 25 ? "#b34000" : "#e1000f");

STD.toast = (msg) => {
  let t = document.querySelector(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
  t.textContent = msg;
  requestAnimationFrame(() => t.classList.add("show"));
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove("show"), 2200);
};

// ── ring gauge (SVG) ──────────────────────────────────────────────────────
STD.ring = (value, color, label, sub) => {
  const R = 54, C = 2 * Math.PI * R, dash = (Math.max(0, Math.min(100, value)) / 100) * C;
  return `<div class="gauge"><div class="ring">
    <svg width="132" height="132" viewBox="0 0 132 132">
      <circle cx="66" cy="66" r="${R}" fill="none" stroke="#eef1f8" stroke-width="12"/>
      <circle cx="66" cy="66" r="${R}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"
        stroke-dasharray="${dash.toFixed(1)} ${C.toFixed(1)}" style="transition:stroke-dasharray 1s cubic-bezier(.2,.8,.2,1)"/>
    </svg>
    <div class="rv"><b>${value.toFixed(1)}%</b></div>
  </div><div class="gl">${STD.esc(label)}</div><div class="gs">${STD.esc(sub || "")}</div></div>`;
};

// ── router ────────────────────────────────────────────────────────────────
const routes = [
  { re: /^\/$/, view: "home" },
  { re: /^\/deputes\/?$/, view: "list" },
  { re: /^\/depute\/([^/]+)\/?$/, view: "fiche" },
  { re: /^\/classements\/?$/, view: "rankings" },
  { re: /^\/groupes\/?$/, view: "groups" },
  { re: /^\/jeu\/?$/, view: "game" },
  { re: /^\/methode\/?$/, view: "methodo" },
];
STD.go = (path, replace) => {
  const full = STD.localized(path, STD.lang);
  if (replace) history.replaceState({}, "", full);
  else history.pushState({}, "", full);
  render();
};
// Switch locale in place: keep the current route, swap the prefix, re-render.
STD.setLang = (lang) => {
  if (!LOCALES.includes(lang) || lang === STD.lang) return;
  STD.lang = lang;
  document.cookie = `zl-lang=${lang};path=/;domain=.zlef.fr;max-age=31536000`;
  document.documentElement.lang = lang;
  history.replaceState({}, "", STD.localized(location.pathname, lang));
  document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = STD.t(el.dataset.i18n)));
  render();
};
function highlightNav(view) {
  document.querySelectorAll("nav.main a").forEach((a) => a.classList.toggle("active", a.dataset.view === view));
  document.querySelector("nav.main")?.classList.remove("open");
}
async function render() {
  const path = STD.stripLocale(location.pathname);
  const root = document.getElementById("app");
  let match = routes.find((r) => r.re.test(path)) || routes[0];
  const m = path.match(match.re);
  highlightNav(match.view);
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  root.innerHTML = `<div class="wrap"><div class="spinner"></div></div>`;
  try {
    await STD.views[match.view](root, m);
    STD.track(path);
  } catch (e) {
    console.error(e);
    root.innerHTML = `<div class="wrap block"><div class="prose"><h1>Oups</h1><p>${STD.esc(String(e))}</p><a class="btn btn-primary" href="/" data-link>${STD.t("fiche.back")}</a></div></div>`;
  }
}

// intercept internal links
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-link]");
  if (a && a.getAttribute("href")?.startsWith("/")) {
    e.preventDefault();
    STD.go(a.getAttribute("href"));
  }
});
window.addEventListener("popstate", render);

// ── per-page view counter ─────────────────────────────────────────────────
STD.track = async (path) => {
  try {
    const r = await fetch("/api/view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path }),
    });
    const { count } = await r.json();
    // locale-aware plural: fr → 's' when >1, en → 's' when ≠1
    const s = STD.lang === "fr" ? (count > 1 ? "s" : "") : (count === 1 ? "" : "s");
    const label = STD.t("footer.views", { n: count == null ? "" : count.toLocaleString(STD.lang), s });
    document.querySelectorAll("[data-views]").forEach((el) => {
      if (count == null) { el.hidden = true; return; }
      el.textContent = label;
      el.hidden = false;
    });
  } catch {}
};

STD.render = render;
STD.boot = () => {
  // translate static chrome
  document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = STD.t(el.dataset.i18n)));
  render();
};
