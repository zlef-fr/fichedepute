// SEO artifacts generated from live data: a full sitemap (every page + all 577
// fiches) and a robots.txt pointing at it. Served on the canonical .fr apex via
// a priority Traefik override of the shared seo-well-known redirect.
const { store } = require("./data");
const faq = require("./faq");

const BASE = "https://fichedepute.fr";

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

function sitemap() {
  const lastmod = (store.meta && store.meta.generatedAt) || null;
  const lm = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : "";
  const urls = [];
  for (const r of STATIC) {
    urls.push(`  <url>\n    <loc>${BASE}${r.path}</loc>${lm}\n    <changefreq>${r.freq}</changefreq>\n    <priority>${r.priority}</priority>\n  </url>`);
  }
  for (const d of store.deputes || []) {
    urls.push(`  <url>\n    <loc>${BASE}/depute/${xmlEscape(d.slug)}</loc>${lm}\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

function robots() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${BASE}/sitemap.xml\n`;
}

// ── Per-route meta for crawlers (FR = default locale) ─────────────────────
// The SPA sets meta via JS; non-JS/social crawlers need it in the initial HTML.
const OG_DEFAULT = "https://fichedepute.fr/og.png";
const SUB = "Participation, votes et absences de votre député à l'Assemblée nationale — en clair et 100 % sourcé.";

function metaFor(pathname) {
  const p = pathname.replace(/\/+$/, "") || "/";
  const fiche = p.match(/^\/depute\/([^/]+)$/);
  if (fiche) {
    const d = store.bySlug[decodeURIComponent(fiche[1])];
    if (d) {
      const name = `${d.prenom} ${d.nom}`;
      const circo = [d.dep && `${d.dep}·${d.depNom || ""}`, d.circo && `${d.circo}ᵉ circonscription`].filter(Boolean).join(" ");
      return {
        title: `${name} (${d.groupe}) — FicheDéputé.fr`,
        desc: `${name}, député·e ${circo}. ${d.presence}% de présence aux scrutins publics${d.participation != null ? `, ${d.participation}% de vote exprimé` : ""}, votes, loyauté au groupe et activité législative — 100 % sourcé (Assemblée nationale).`,
        canonical: `${BASE}/depute/${d.slug}`,
        og: `${BASE}/og/${d.slug}.png`,
      };
    }
  }
  const pages = {
    "/deputes": ["Tous les députés — FicheDéputé.fr", "Cherchez et comparez les 577 députés de la 17ᵉ législature : présence, votes, groupe et circonscription."],
    "/classements": ["Classements des députés — FicheDéputé.fr", "Les plus assidus, les plus absents, les plus actifs, les plus loyaux et les plus frondeurs de l'Assemblée nationale."],
    "/groupes": ["Les groupes politiques — FicheDéputé.fr", "Présence moyenne et effectifs de chaque groupe politique de l'Assemblée nationale."],
    "/jeu": ["Devine le député — FicheDéputé.fr", "Le jeu civique : présence + 3 votes POUR et 3 votes CONTRE, à toi de deviner de quelle fiche il s'agit."],
    "/methode": ["Méthode & sources — FicheDéputé.fr", "D'où viennent les chiffres de FicheDéputé.fr : les jeux open data officiels de l'Assemblée nationale (licence Ouverte)."],
  };
  if (pages[p]) return { title: pages[p][0], desc: pages[p][1], canonical: `${BASE}${p}`, og: OG_DEFAULT };
  return { title: "FicheDéputé.fr — La fiche vivante de votre député·e", desc: SUB, canonical: `${BASE}/`, og: OG_DEFAULT };
}

function attr(s) { return String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c])); }

// FAQPage JSON-LD on the Méthode route so crawlers & AI lift the answers (esp.
// "présence non publiée nominativement") without running the SPA. FR canonical.
function faqJsonLd(pathname) {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p !== "/methode") return "";
  const strip = (s) => String(s).replace(/<[^>]+>/g, "");
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.fr.map((x) => ({
      "@type": "Question",
      name: x.q,
      acceptedAnswer: { "@type": "Answer", text: strip(x.a) },
    })),
  };
  return `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`;
}

// Rewrite the <head> meta of the SPA shell for the requested route.
function injectMeta(html, pathname) {
  const m = metaFor(pathname);
  const t = attr(m.title), d = attr(m.desc), c = attr(m.canonical), o = attr(m.og);
  const ld = faqJsonLd(pathname);
  html = ld ? html.replace("</head>", ld + "</head>") : html;
  return html
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
}

module.exports = { sitemap, robots, metaFor, injectMeta, BASE };
