// Locale model shared by the server (URL routing) and the SEO layer (canonical,
// hreflang, og:locale). One locale owns the bare path (the DEFAULT); every other
// locale lives under a "/<lang>" prefix so each language has its own indexable
// URL. FR is the default here (fichedepute.fr / senat) — EN is the alternate.
const BASE = "https://fichedepute.fr";
const DEFAULT = "fr";
const LOCALES = ["fr", "en"];
const OG_LOCALE = { fr: "fr_FR", en: "en_GB" };

// Split a request path into { lang, path } — an unknown/absent prefix means the
// default locale on the bare path.
function parsePath(pathname) {
  const m = (pathname || "/").match(/^\/([a-z]{2})(\/.*)?$/);
  if (m && LOCALES.includes(m[1])) return { lang: m[1], path: m[2] || "/" };
  return { lang: DEFAULT, path: pathname || "/" };
}

// Build the URL path for a route in a given locale (bare for the default).
function localized(path, lang) {
  const clean = !path || path === "/" ? "" : path.replace(/\/+$/, "");
  if (lang === DEFAULT) return clean || "/";
  return `/${lang}${clean}`;
}

module.exports = { BASE, DEFAULT, LOCALES, OG_LOCALE, parsePath, localized };
