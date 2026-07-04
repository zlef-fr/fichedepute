// SEO layer. From the live data it produces: a full sitemap (every page + all
// fiches, each with hreflang alternates), robots.txt, and — on every shell
// response — a localized <head> (title/description/canonical/OG/Twitter),
// hreflang + og:locale link set, JSON-LD (Person on a fiche, FAQPage on the
// method page), and a server-rendered content snapshot so crawlers see the
// numbers without running the SPA.
const { store } = require("./data");
const faq = require("./faq");
const L = require("./locales");
const ssr = require("./ssr");

const BASE = L.BASE;
const OG_DEFAULT = `${BASE}/og.png`;

// Static routes with a relative priority hint for the sitemap.
const STATIC = [
  { path: "/", priority: "1.0", freq: "daily" },
  { path: "/deputes", priority: "0.9", freq: "daily" },
  { path: "/classements", priority: "0.8", freq: "weekly" },
  { path: "/groupes", priority: "0.7", freq: "weekly" },
  { path: "/jeu", priority: "0.6", freq: "weekly" },
  { path: "/methode", priority: "0.4", freq: "monthly" },
];

function xmlEscape(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
}
function attr(s) {
  return String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
}

// ── sitemap (with per-URL hreflang alternates) ────────────────────────────
function alternateLinks(routePath) {
  const links = L.LOCALES.map(
    (lang) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${BASE}${L.localized(routePath, lang)}"/>`
  );
  links.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE}${L.localized(routePath, L.DEFAULT)}"/>`);
  return links.join("\n");
}

function sitemap() {
  const lastmod = (store.meta && store.meta.generatedAt) || null;
  const lm = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : "";
  const urls = [];
  const entry = (routePath, freq, priority) => {
    urls.push(
      `  <url>\n    <loc>${BASE}${L.localized(routePath, L.DEFAULT)}</loc>${lm}\n` +
        `${alternateLinks(routePath)}\n    <changefreq>${freq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`
    );
  };
  for (const r of STATIC) entry(r.path, r.freq, r.priority);
  for (const d of store.deputes || []) entry(`/depute/${xmlEscape(d.slug)}`, "weekly", "0.7");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    `${urls.join("\n")}\n</urlset>\n`
  );
}

function robots() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${BASE}/sitemap.xml\n`;
}

// ── localized <head> meta ─────────────────────────────────────────────────
const PAGES = {
  fr: {
    "/": ["FicheDéputé.fr — La fiche vivante de votre député·e", "Participation, votes et absences de votre député à l'Assemblée nationale — en clair et 100 % sourcé depuis les données officielles."],
    "/deputes": ["Tous les députés — FicheDéputé.fr", "Cherchez et comparez les 577 députés de la 17ᵉ législature : présence, votes, groupe et circonscription."],
    "/classements": ["Classements des députés — FicheDéputé.fr", "Les plus assidus, les plus absents, les plus actifs, les plus loyaux et les plus frondeurs de l'Assemblée nationale."],
    "/groupes": ["Les groupes politiques — FicheDéputé.fr", "Présence moyenne et effectifs de chaque groupe politique de l'Assemblée nationale."],
    "/jeu": ["Devine le député — FicheDéputé.fr", "Le jeu civique : présence + 3 votes POUR et 3 votes CONTRE, à toi de deviner de quelle fiche il s'agit."],
    "/methode": ["Méthode & sources — FicheDéputé.fr", "D'où viennent les chiffres de FicheDéputé.fr : les jeux open data officiels de l'Assemblée nationale (licence Ouverte)."],
  },
  en: {
    "/": ["FicheDéputé.fr — The living record of your MP", "Turnout, votes and absences of your MP at the French National Assembly — in plain language, fully sourced from official open data."],
    "/deputes": ["All MPs — FicheDéputé.fr", "Search and compare the 577 MPs of the 17th legislature: attendance, votes, group and constituency."],
    "/classements": ["MP rankings — FicheDéputé.fr", "The most diligent, the most absent, the most active, the most loyal and the biggest rebels of the French National Assembly."],
    "/groupes": ["Political groups — FicheDéputé.fr", "Average attendance and size of each political group in the French National Assembly."],
    "/jeu": ["Guess the MP — FicheDéputé.fr", "The civic game: attendance + 3 FOR votes and 3 AGAINST votes — guess whose record it is."],
    "/methode": ["Method & sources — FicheDéputé.fr", "Where FicheDéputé.fr's figures come from: the French National Assembly's official open datasets (Licence Ouverte)."],
  },
};

function ficheMeta(d, lang) {
  const name = `${d.prenom} ${d.nom}`;
  const circo = ssr.circoLabel(d, lang);
  const part = d.participation != null;
  if (lang === "en") {
    return {
      title: `${name} (${d.groupe}) — FicheDéputé.fr`,
      desc: `${name}, Member of Parliament for ${circo}. ${d.presence}% ballot attendance${part ? `, ${d.participation}% votes cast` : ""}, voting record, group loyalty and legislative activity — fully sourced (French National Assembly).`,
    };
  }
  return {
    title: `${name} (${d.groupe}) — FicheDéputé.fr`,
    desc: `${name}, député·e ${circo}. ${d.presence}% de présence aux scrutins publics${part ? `, ${d.participation}% de vote exprimé` : ""}, votes, loyauté au groupe et activité législative — 100 % sourcé (Assemblée nationale).`,
  };
}

// Resolve title/description/canonical/og for a route path in a locale.
function metaFor(routePath, lang) {
  const p = (routePath || "/").replace(/\/+$/, "") || "/";
  const fiche = p.match(/^\/depute\/([^/]+)$/);
  if (fiche) {
    const d = store.bySlug[decodeURIComponent(fiche[1])];
    if (d) {
      const m = ficheMeta(d, lang);
      return { ...m, routePath: `/depute/${d.slug}`, og: `${BASE}/og/${d.slug}.png` };
    }
  }
  const dict = PAGES[lang] || PAGES[L.DEFAULT];
  const entry = dict[p] || PAGES[L.DEFAULT][p];
  if (entry) return { title: entry[0], desc: entry[1], routePath: p, og: OG_DEFAULT };
  const home = dict["/"];
  return { title: home[0], desc: home[1], routePath: "/", og: OG_DEFAULT };
}

// ── JSON-LD ───────────────────────────────────────────────────────────────
function personJsonLd(routePath, lang) {
  const m = routePath.match(/^\/depute\/([^/]+)$/);
  if (!m) return "";
  const d = store.bySlug[decodeURIComponent(m[1])];
  if (!d) return "";
  const url = `${BASE}${L.localized(`/depute/${d.slug}`, lang)}`;
  const assembly = lang === "en" ? "French National Assembly" : "Assemblée nationale";
  const ld = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: `${d.prenom} ${d.nom}`,
    jobTitle: lang === "en" ? "Member of Parliament" : "Députée / Député",
    url,
    memberOf: {
      "@type": "Organization",
      name: d.groupeLibelle || d.groupe,
      memberOf: { "@type": "GovernmentOrganization", name: assembly },
    },
    affiliation: { "@type": "GovernmentOrganization", name: assembly },
  };
  if (d.depNom) ld.workLocation = { "@type": "Place", name: d.depNom };
  return `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`;
}

function faqJsonLd(routePath, lang) {
  const p = (routePath || "/").replace(/\/+$/, "") || "/";
  if (p !== "/methode") return "";
  const list = faq[lang] || faq.fr;
  const strip = (s) => String(s).replace(/<[^>]+>/g, "");
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: lang,
    mainEntity: list.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: strip(x.a) } })),
  };
  return `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`;
}

// ── hreflang + og:locale link set ─────────────────────────────────────────
function hreflangTags(routePath) {
  const tags = L.LOCALES.map(
    (lang) => `<link rel="alternate" hreflang="${lang}" href="${attr(BASE + L.localized(routePath, lang))}">`
  );
  tags.push(`<link rel="alternate" hreflang="x-default" href="${attr(BASE + L.localized(routePath, L.DEFAULT))}">`);
  return tags.join("\n");
}
function ogLocaleTags(lang) {
  const cur = `<meta property="og:locale" content="${L.OG_LOCALE[lang] || L.OG_LOCALE[L.DEFAULT]}">`;
  const alt = L.LOCALES.filter((x) => x !== lang).map((x) => `<meta property="og:locale:alternate" content="${L.OG_LOCALE[x]}">`);
  return [cur, ...alt].join("\n");
}

// ── inject everything into the SPA shell for a request path ───────────────
function injectMeta(html, pathname) {
  const { lang, path } = L.parsePath(pathname);
  const m = metaFor(path, lang);
  const canonical = `${BASE}${L.localized(m.routePath, lang)}`;
  const t = attr(m.title), d = attr(m.desc), c = attr(canonical), o = attr(m.og);

  const headExtra = [hreflangTags(m.routePath), ogLocaleTags(lang), personJsonLd(m.routePath, lang), faqJsonLd(m.routePath, lang)]
    .filter(Boolean)
    .join("\n");

  html = html
    .replace(/<html lang="[^"]*"/, `<html lang="${lang}"`)
    .replace("</head>", `${headExtra}\n</head>`)
    .replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(">)/, `$1${d}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(">)/, `$1${c}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(">)/, `$1${t}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(">)/, `$1${d}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(">)/, `$1${c}$2`)
    .replace(/(<meta property="og:image" content=")[^"]*(">)/, `$1${o}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(">)/, `$1${t}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(">)/, `$1${d}$2`)
    .replace(/(<meta name="twitter:image" content=")[^"]*(">)/, `$1${o}$2`);

  // Server-rendered content snapshot (the SPA repaints #app on boot).
  const body = ssr.render(path, lang);
  if (body) html = html.replace(/(<main id="app">)[\s\S]*?(<\/main>)/, `$1${body}$2`);
  return html;
}

module.exports = { sitemap, robots, metaFor, injectMeta, BASE };
