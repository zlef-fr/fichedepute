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
  const game = readJSON(path.join(DATA, "game.json"));
  let indemnite = null;
  try { indemnite = readJSON(path.join(DATA, "indemnite.json")); } catch {}
  let activite = { hasAmendements: false, byUid: {} };
  try { activite = readJSON(path.join(DATA, "activite.json")); } catch {}
  let hatvp = {};
  try { hatvp = readJSON(path.join(DATA, "hatvp.json")); } catch {}

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
    game: game.deputes,
    indemnite,
    activite,
    hatvp,
    rankByUid,
    bySlug,
  });
  return store;
}

// Build one "Devine le député" round: a random target + 3 distractors.
function gameRound() {
  const pool = store.game;
  if (!pool || pool.length < 4) return null;
  const pick = () => pool[Math.floor(Math.random() * pool.length)];
  const target = pick();
  const chosen = new Set([target.uid]);
  const choices = [
    { uid: target.uid, slug: target.slug, prenom: target.prenom, nom: target.nom,
      groupe: target.groupe, groupeColor: target.groupeColor, dep: target.dep, depNom: target.depNom },
  ];
  let guard = 0;
  while (choices.length < 4 && guard++ < 200) {
    const c = pick();
    if (chosen.has(c.uid)) continue;
    chosen.add(c.uid);
    choices.push({ uid: c.uid, slug: c.slug, prenom: c.prenom, nom: c.nom,
      groupe: c.groupe, groupeColor: c.groupeColor, dep: c.dep, depNom: c.depNom });
  }
  // Fisher–Yates shuffle so the answer isn't always first
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return {
    clue: { presence: target.presence, pour: target.pour, contre: target.contre },
    choices,
    answer: target.uid,
    answerSlug: target.slug,
  };
}

function fiche(uid) {
  const p = path.join(DATA, "depute", uid + ".json");
  if (!fs.existsSync(p)) return null;
  const f = readJSON(p);
  f.rang = store.rankByUid[uid] || null;
  f.activite = (store.activite.byUid && store.activite.byUid[uid]) || null;
  f.hasAmendements = store.activite.hasAmendements;
  const hnorm = (x) => (x || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  f.hatvpDecl = store.hatvp[hnorm(f.nom) + "|" + hnorm(f.prenom)] || null;
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

module.exports = { load, fiche, search, gameRound, store };
