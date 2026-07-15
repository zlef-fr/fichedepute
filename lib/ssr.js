// Server-side render of the primary content for crawlers (and no-JS users).
// The SPA overwrites #app on boot, so this HTML is a faithful, indexable
// snapshot of the fiche / home — the numbers live in the initial HTML, not only
// after the client bundle runs. Localized; styled by the shared .ssr-* rules.
const data = require("./data");
const { store } = data;

function esc(s) {
  return s == null ? "" : String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
}
const NB = (n, lang) => (n == null ? "—" : Number(n).toLocaleString(lang === "en" ? "en-GB" : "fr-FR"));

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
// Gendered role label ("Députée"/"Député") — falls back to the inclusive form.
function roleLabel(sexe, lang) {
  if (lang === "en") return "Member of Parliament";
  return sexe === "F" ? "Députée" : sexe === "M" ? "Député" : "Député·e";
}

const T = {
  fr: {
    role: "Député·e", group: "Groupe", presence: "Présence aux scrutins",
    participation: "Participation (vote exprimé)", loyalty: "Loyauté au groupe",
    pour: "Votes pour", contre: "Votes contre", abst: "Abstentions", nv: "Non-votant·e",
    rank: "Rang de présence", born: "Né·e le", prof: "Profession", ballots: "Scrutins suivis",
    recent: "Ses derniers votes", src: "Source officielle",
    election: "Élection 2024", exprimes: "des suffrages exprimés", turnout: "Participation",
    round1: "Élu·e au 1ᵉʳ tour", round2: "Élu·e au 2ᵈ tour",
    act: "Activité législative", qe: "questions écrites", qag: "questions au gouvernement",
    amdt: "amendements déposés", amdtA: "adoptés",
    hatvp: "Déclaration d'intérêts (HATVP)", hactiv: "activités professionnelles (5 ans)",
    hfin: "participations financières", hdir: "fonctions dirigeantes", hdecl: "Voir la déclaration officielle",
    indem: "Indemnité parlementaire", brut: "brut / mois",
    contact: "Contact & liens", website: "Site", an: "Fiche Assemblée nationale",
    source: "Données : Assemblée nationale (licence Ouverte)",
    homeH1: "Votre député·e, en chiffres",
    homeLead: "Chaque chiffre vient des données officielles de l'Assemblée nationale. Aucun avis, que des faits.",
    listH1: "Tous les députés", presCol: "présence",
    notFoundH1: "Page introuvable",
    notFoundLead: "Cette page n'existe pas (ou plus). Le député que vous cherchez a peut-être quitté l'Assemblée.",
    backHome: "Retour à l'accueil", allDeputes: "Tous les députés",
    adopted: "adopté", rejected: "rejeté",
  },
  en: {
    role: "Member of Parliament", group: "Group", presence: "Ballot attendance",
    participation: "Participation (votes cast)", loyalty: "Group loyalty",
    pour: "Votes for", contre: "Votes against", abst: "Abstentions", nv: "Non-voting",
    rank: "Attendance rank", born: "Born", prof: "Occupation", ballots: "Ballots tracked",
    recent: "Latest votes", src: "Official source",
    election: "2024 election", exprimes: "of votes cast", turnout: "Turnout",
    round1: "Elected in round 1", round2: "Elected in round 2",
    act: "Legislative activity", qe: "written questions", qag: "questions to the government",
    amdt: "amendments tabled", amdtA: "adopted",
    hatvp: "Interest declaration (HATVP)", hactiv: "professional activities (5 yrs)",
    hfin: "financial holdings", hdir: "executive positions", hdecl: "See the official declaration",
    indem: "Parliamentary allowance", brut: "gross / month",
    contact: "Contact & links", website: "Website", an: "National Assembly profile",
    source: "Data: French National Assembly (Licence Ouverte)",
    homeH1: "Your MP, in figures",
    homeLead: "Every figure comes from the French National Assembly's official open data. No opinions, only facts.",
    listH1: "All MPs", presCol: "attendance",
    notFoundH1: "Page not found",
    notFoundLead: "This page does not exist (or no longer does). The MP you are looking for may have left the Assembly.",
    backHome: "Back to home", allDeputes: "All MPs",
    adopted: "adopted", rejected: "rejected",
  },
};

const pfx = (lang) => (lang === "en" ? "/en" : "");

function fiche(d, lang) {
  const t = T[lang] || T.fr;
  const name = esc(`${d.prenom} ${d.nom}`);
  const f = data.fiche(d.uid) || {};

  const rows = [
    [t.presence, d.presence != null ? `${d.presence}%` : "—"],
    [t.participation, d.participation != null ? `${d.participation}%` : "—"],
    [t.loyalty, d.loyalty != null ? `${d.loyalty}%` : "—"],
    [t.pour, NB(f.nPour, lang)],
    [t.contre, NB(f.nContre, lang)],
    [t.abst, NB(f.nAbstention, lang)],
    [t.ballots, f.nPresent != null ? `${NB(f.nPresent, lang)} / ${NB(f.nEligible, lang)}` : "—"],
    [f.rang ? t.rank : null, f.rang ? `${f.rang}ᵉ / ${(store.deputes || []).length}` : null],
    [t.born, f.dateNaissance ? new Date(f.dateNaissance).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "long", year: "numeric" }) : null],
    [t.prof, f.profession || null],
  ].filter(([k, v]) => k && v != null);

  const votes = (f.votesRecents || []).map((v) => {
    const date = v.date ? new Date(v.date).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "";
    const sort = v.sort ? ` — ${/adopt/i.test(v.sort) ? t.adopted : t.rejected}` : "";
    return `<li><strong>${esc((v.position || "").toUpperCase())}</strong> · ${esc(v.titre || "Scrutin n°" + v.numero)} <em>(${esc(date)}${sort})</em> <a href="https://www.assemblee-nationale.fr/dyn/17/scrutins/${esc(v.numero)}" rel="noopener">${esc(t.src)}</a></li>`;
  }).join("\n      ");

  const sections = [];
  if (f.election && f.election.scoreExprimes != null) {
    sections.push(`<section><h2>${esc(t.election)}</h2>
    <p>${f.election.scoreExprimes}% ${esc(t.exprimes)} · ${esc(f.election.tour === 1 ? t.round1 : t.round2)}${f.election.nuance ? " · " + esc(f.election.nuance) : ""}${f.election.turnout != null ? ` · ${t.turnout} ${f.election.turnout}%` : ""}</p></section>`);
  }
  if (f.activite) {
    const a = f.activite;
    const parts = [`${NB(a.questionsEcrites, lang)} ${t.qe}`, `${NB(a.qag, lang)} ${t.qag}`];
    if (f.hasAmendements) parts.push(`${NB(a.amendements, lang)} ${t.amdt} (${NB(a.amendementsAdoptes, lang)} ${t.amdtA})`);
    sections.push(`<section><h2>${esc(t.act)}</h2><p>${parts.map(esc).join(" · ")}</p></section>`);
  }
  if (f.hatvpDecl) {
    const h = f.hatvpDecl;
    sections.push(`<section><h2>${esc(t.hatvp)}</h2>
    <p>${NB(h.activitesProf, lang)} ${esc(t.hactiv)} · ${NB(h.participationsFinancieres, lang)} ${esc(t.hfin)} · ${NB(h.participationsDirigeant, lang)} ${esc(t.hdir)}${h.url ? ` · <a href="${esc(h.url)}" rel="noopener">${esc(t.hdecl)}</a>` : ""}</p></section>`);
  }
  const ind = store.indemnite;
  if (ind && ind.brutMensuel) {
    sections.push(`<section><h2>${esc(t.indem)}</h2><p>${NB(ind.brutMensuel, lang)} € ${esc(t.brut)}</p></section>`);
  }
  const links = [];
  if (f.uid) links.push(`<a href="https://www.assemblee-nationale.fr/dyn/deputes/${esc(f.uid)}" rel="noopener">${esc(t.an)}</a>`);
  if (f.twitter) links.push(`<a href="https://x.com/${esc(String(f.twitter).replace(/^@/, ""))}" rel="noopener">${esc(f.twitter)}</a>`);
  if (f.website) links.push(`<a href="${esc(/^https?:/.test(f.website) ? f.website : "https://" + f.website)}" rel="noopener">${esc(t.website)}</a>`);
  if (f.email) links.push(`<a href="mailto:${esc(f.email)}">${esc(f.email)}</a>`);
  if (links.length) sections.push(`<section><h2>${esc(t.contact)}</h2><p>${links.join(" · ")}</p></section>`);

  return `<article class="wrap ssr-fiche">
  <h1>${name}</h1>
  <p class="ssr-sub">${esc(roleLabel(d.sexe, lang))} — ${esc(circoLabel(d, lang))} · ${esc(t.group)} : ${esc(d.groupeLibelle || d.groupe)} (${esc(d.groupe)})</p>
  <dl class="ssr-stats">
    ${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("\n    ")}
  </dl>
  ${votes ? `<section><h2>${esc(t.recent)}</h2><ul class="ssr-list">
      ${votes}
    </ul></section>` : ""}
  ${sections.join("\n  ")}
  <p class="ssr-src">${esc(t.source)}</p>
</article>`;
}

function home(lang) {
  const t = T[lang] || T.fr;
  const p = pfx(lang);
  const n = (store.deputes || []).length;
  const sorted = [...(store.deputes || [])].sort((a, b) => b.presence - a.presence);
  const link = (d) => `<a href="${p}/depute/${esc(d.slug)}">${esc(d.prenom + " " + d.nom)}</a> (${esc(d.groupe)}, ${d.presence}%)`;
  const top = sorted.slice(0, 5).map(link).join(" · ");
  const flop = sorted.slice(-5).reverse().map(link).join(" · ");
  return `<section class="wrap ssr-home">
  <h1>${esc(t.homeH1)}</h1>
  <p>${esc(t.homeLead)}</p>
  <p>${n} ${lang === "en" ? "MPs tracked" : "députés suivis"}. <a href="${p}/deputes">${esc(t.listH1)}</a></p>
  <p>${lang === "en" ? "Most diligent" : "Les plus assidus"} : ${top}</p>
  <p>${lang === "en" ? "Most absent" : "Les plus absents"} : ${flop}</p>
</section>`;
}

// Full MP directory — one link per fiche (crawl mesh + no-JS navigation).
function list(lang) {
  const t = T[lang] || T.fr;
  const p = pfx(lang);
  const items = [...(store.deputes || [])]
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
    .map((d) => `<li><a href="${p}/depute/${esc(d.slug)}">${esc(d.prenom + " " + d.nom)}</a> — ${esc(d.groupe)} · ${esc(d.depNom || "")} · ${d.presence != null ? d.presence + "% " + t.presCol : ""}</li>`)
    .join("\n    ");
  return `<section class="wrap ssr-home">
  <h1>${esc(t.listH1)}</h1>
  <ul class="ssr-list">
    ${items}
  </ul>
</section>`;
}

function groups(lang) {
  const p = pfx(lang);
  const items = (store.groupes || []).map((g) =>
    `<li><strong>${esc(g.sigle || "")}</strong> — ${esc(g.libelle || "")}${g.n ? ` · ${g.n} ${lang === "en" ? "members" : "membres"}` : ""}${g.presenceMoyenne != null ? ` · ${g.presenceMoyenne}% ${lang === "en" ? "attendance" : "présence"}` : ""}</li>`
  ).join("\n    ");
  return `<section class="wrap ssr-home">
  <h1>${lang === "en" ? "Political groups" : "Les groupes politiques"}</h1>
  <ul class="ssr-list">
    ${items}
  </ul>
  <p><a href="${p}/deputes">${esc((T[lang] || T.fr).listH1)}</a></p>
</section>`;
}

function notFound(lang) {
  const t = T[lang] || T.fr;
  const p = pfx(lang);
  return `<section class="wrap ssr-home ssr-404">
  <h1>${esc(t.notFoundH1)}</h1>
  <p>${esc(t.notFoundLead)}</p>
  <p><a href="${p}/">${esc(t.backHome)}</a> · <a href="${p}/deputes">${esc(t.allDeputes)}</a></p>
</section>`;
}

// Return the SSR markup for a route+lang, or "" when the route has no snapshot.
function render(path, lang) {
  const p = (path || "/").replace(/\/+$/, "") || "/";
  if (p === "/") return home(lang);
  if (p === "/deputes") return list(lang);
  if (p === "/groupes") return groups(lang);
  const m = p.match(/^\/depute\/([^/]+)$/);
  if (m) {
    const d = store.bySlug[decodeURIComponent(m[1])];
    if (d) return fiche(d, lang);
  }
  return "";
}

module.exports = { render, notFound, circoLabel, roleLabel };
