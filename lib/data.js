// In-memory data layer. Loads the pipeline JSON once at boot and builds indexes
// so the API can answer search / fiche / leaderboard queries without a database.
const fs = require("fs");
const path = require("path");

const DATA = path.join(__dirname, "..", "data");

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

const store = { ready: false };

function load() {
  const deputes = readJSON(path.join(DATA, "deputes.json"));
  const groupes = readJSON(path.join(DATA, "groupes.json"));
  const stats = readJSON(path.join(DATA, "stats.json"));
  const scrutins = readJSON(path.join(DATA, "scrutins.json"));

  // rank by presence at ballots (desc) for the fiche "Nᵉ/577" badge
  const byPart = [...deputes.deputes].sort((a, b) => b.presence - a.presence);
  const rankByUid = {};
  byPart.forEach((d, i) => (rankByUid[d.uid] = i + 1));

  const bySlug = {};
  deputes.deputes.forEach((d) => (bySlug[d.slug] = d));

  Object.assign(store, {
    ready: true,
    meta: { generatedAt: deputes.generatedAt, legislature: deputes.legislature, totalScrutins: deputes.totalScrutins },
    deputes: deputes.deputes,
    groupes: groupes.groupes,
    stats,
    scrutins: scrutins.scrutins,
    rankByUid,
    bySlug,
  });
  return store;
}

function fiche(uid) {
  const p = path.join(DATA, "depute", uid + ".json");
  if (!fs.existsSync(p)) return null;
  const f = readJSON(p);
  f.rang = store.rankByUid[uid] || null;
  return f;
}

// diacritic-insensitive search over name / department / group
function norm(s) {
  return (s || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
function search(q, limit = 30) {
  const nq = norm(q).trim();
  if (!nq) return [];
  return store.deputes
    .map((d) => {
      const hay = norm(`${d.prenom} ${d.nom} ${d.depNom} ${d.dep} ${d.groupe} ${d.groupeLibelle}`);
      let score = 0;
      if (norm(`${d.prenom} ${d.nom}`).startsWith(nq)) score = 100;
      else if (norm(d.nom).startsWith(nq)) score = 90;
      else if (hay.includes(nq)) score = 50;
      return { d, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.d.nom.localeCompare(b.d.nom))
    .slice(0, limit)
    .map((x) => x.d);
}

module.exports = { load, fiche, search, store };
