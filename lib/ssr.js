// Server-side render of the primary content for crawlers (and no-JS users).
// The SPA overwrites #app on boot, so this HTML is a faithful, indexable
// snapshot of the fiche / home — the numbers live in the initial HTML, not only
// after the client bundle runs. Localized; kept deliberately lean (no styling
// dependency — the client repaints instantly).
const { store } = require("./data");

function esc(s) {
  return s == null ? "" : String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
}

// English ordinal suffix (1st, 2nd, 3rd, 4th…).
function ord(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
// Human circo/constituency label per locale.
function circoLabel(d, lang) {
  const dep = [d.depNom, d.dep && `(${d.dep})`].filter(Boolean).join(" ");
  const circo = d.circo ? (lang === "en" ? `${ord(+d.circo)} constituency` : `${d.circo}ᵉ circonscription`) : "";
  return [dep, circo].filter(Boolean).join(", ");
}

const T = {
  fr: {
    role: "Député·e", group: "Groupe", presence: "Présence aux scrutins",
    participation: "Participation (vote exprimé)", loyalty: "Loyauté au groupe",
    source: "Données : Assemblée nationale (licence Ouverte)",
    homeH1: "Votre député·e, en chiffres",
    homeLead: "Chaque chiffre vient des données officielles de l'Assemblée nationale. Aucun avis, que des faits.",
  },
  en: {
    role: "Member of Parliament", group: "Group", presence: "Ballot attendance",
    participation: "Participation (votes cast)", loyalty: "Group loyalty",
    source: "Data: French National Assembly (Licence Ouverte)",
    homeH1: "Your MP, in figures",
    homeLead: "Every figure comes from the French National Assembly's official open data. No opinions, only facts.",
  },
};

function fiche(d, lang) {
  const t = T[lang] || T.fr;
  const name = esc(`${d.prenom} ${d.nom}`);
  const rows = [
    [t.presence, d.presence != null ? `${d.presence}%` : "—"],
    [t.participation, d.participation != null ? `${d.participation}%` : "—"],
    [t.loyalty, d.loyalty != null ? `${d.loyalty}%` : "—"],
  ];
  return `<article class="wrap ssr-fiche">
  <h1>${name}</h1>
  <p class="ssr-sub">${t.role} — ${esc(circoLabel(d, lang))} · ${t.group} : ${esc(d.groupeLibelle || d.groupe)} (${esc(d.groupe)})</p>
  <dl class="ssr-stats">
    ${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("\n    ")}
  </dl>
  <p class="ssr-src">${esc(t.source)}</p>
</article>`;
}

function home(lang) {
  const t = T[lang] || T.fr;
  const n = (store.deputes || []).length;
  return `<section class="wrap ssr-home">
  <h1>${esc(t.homeH1)}</h1>
  <p>${esc(t.homeLead)}</p>
  <p>${n} ${lang === "en" ? "MPs tracked" : "députés suivis"}.</p>
</section>`;
}

// Return the SSR markup for a route+lang, or "" when the route has no snapshot.
function render(path, lang) {
  const p = (path || "/").replace(/\/+$/, "") || "/";
  if (p === "/") return home(lang);
  const m = p.match(/^\/depute\/([^/]+)$/);
  if (m) {
    const d = store.bySlug[decodeURIComponent(m[1])];
    if (d) return fiche(d, lang);
  }
  return "";
}

module.exports = { render, circoLabel };
