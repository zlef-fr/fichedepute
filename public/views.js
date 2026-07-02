// FicheDéputé.fr — view renderers. All dynamic values pass through STD.esc().
const V = (STD.views = {});
const t = STD.t, esc = STD.esc;

function setMeta(title, desc, canonical) {
  document.title = title;
  const md = document.querySelector('meta[name="description"]');
  if (md) md.setAttribute("content", desc);
  let link = document.querySelector('link[rel="canonical"]');
  if (link && canonical) link.setAttribute("href", canonical);
  const ogt = document.querySelector('meta[property="og:title"]');
  if (ogt) ogt.setAttribute("content", title);
}

// ── live search wiring (used on home + list) ──────────────────────────────
function wireSearch(input, box) {
  let timer, active = -1, items = [];
  const close = () => { box.innerHTML = ""; box.style.display = "none"; active = -1; };
  const open = () => (box.style.display = "block");
  input.addEventListener("input", () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) return close();
    timer = setTimeout(async () => {
      const { results } = await STD.getJSON("/api/search?q=" + encodeURIComponent(q));
      items = results;
      if (!results.length) { box.innerHTML = `<div class="sr-none">${esc(t("search.none"))}</div>`; return open(); }
      box.innerHTML = results
        .map((d) => `<a href="/depute/${esc(d.slug)}" data-link>
          ${STD.avatar(d)}
          <div style="min-width:0;flex:1">
            <div class="nm" style="font-weight:700">${esc(d.prenom)} ${esc(d.nom)}</div>
            <div class="sub" style="font-size:12.5px;color:var(--muted)">${esc(STD.circoLabel(d))}</div>
          </div>
          ${STD.grpPill(d.groupe, d.groupeLibelle, d.groupeColor)}</a>`)
        .join("");
      open();
    }, 160);
  });
  input.addEventListener("keydown", (e) => {
    const links = [...box.querySelectorAll("a")];
    if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(active + 1, links.length - 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(active - 1, 0); }
    else if (e.key === "Enter" && links[active]) { e.preventDefault(); STD.go(links[active].getAttribute("href")); close(); return; }
    else if (e.key === "Escape") return close();
    links.forEach((l, i) => (l.style.background = i === active ? "var(--bg-2)" : ""));
  });
  document.addEventListener("click", (e) => { if (!box.contains(e.target) && e.target !== input) close(); });
}

// ── HOME ──────────────────────────────────────────────────────────────────
V.home = async (root) => {
  setMeta("FicheDéputé.fr — " + t("meta.tagline"), t("meta.sub"), "https://fichedepute.fr/");
  const stats = await STD.getJSON("/api/stats");
  const groupes = (await STD.getJSON("/api/groupes")).groupes;
  const meta = await STD.getJSON("/api/meta");

  const rankList = (arr) =>
    arr.slice(0, 5).map((d, i) => `<a class="rank-row" href="/depute/${esc(d.slug)}" data-link>
      <span class="pos">${i + 1}</span>${STD.avatar(d)}
      <div class="who"><div class="nm">${esc(d.prenom)} ${esc(d.nom)}</div>
        <div class="sub">${esc(d.groupe)} · ${esc(d.depNom || "")}</div></div>
      <span class="val" style="color:${STD.presenceColor(d.presence)}">${d.presence.toFixed(0)}%</span></a>`).join("");

  root.innerHTML = `
  <div class="fade-in">
    <section class="hero"><div class="wrap">
      <span class="eyebrow"><span class="dot"></span>${esc(t("search.hint"))}</span>
      <h1>${esc(t("home.h1"))}</h1>
      <p class="lead">${esc(t("home.lead"))}</p>
      <div class="searchbox">
        <span class="ico">⌕</span>
        <input id="q" type="search" autocomplete="off" placeholder="${esc(t("search.placeholder"))}" aria-label="${esc(t("search.placeholder"))}">
        <div class="search-results" style="display:none"></div>
      </div>
      <div class="stats">
        <div class="stat"><div class="n">${stats.totalDeputes}</div><div class="l">${esc(t("home.stat.deputes"))}</div></div>
        <div class="stat"><div class="n">${stats.totalScrutins.toLocaleString(STD.lang)}</div><div class="l">${esc(t("home.stat.scrutins"))}</div></div>
        <div class="stat"><div class="n">${stats.presenceMoyenne}%</div><div class="l">${esc(t("home.stat.presence"))}</div></div>
      </div>
    </div></section>

    <section class="block"><div class="wrap">
      <div class="grid-2">
        <div>
          <div class="sec-head"><h2>${esc(t("home.assidus"))}</h2><a href="/classements" data-link>${esc(t("home.seeall"))} →</a></div>
          <div class="card rank-card">${rankList(stats.plusAssidus)}</div>
        </div>
        <div>
          <div class="sec-head"><h2>${esc(t("home.absents"))}</h2><a href="/classements" data-link>${esc(t("home.seeall"))} →</a></div>
          <div class="card rank-card">${rankList(stats.plusAbsents)}</div>
        </div>
      </div>
    </div></section>

    <section class="block"><div class="wrap">
      <div class="sec-head"><h2>${esc(t("home.groupes"))}</h2><a href="/groupes" data-link>${esc(t("home.seeall"))} →</a></div>
      <div class="card" style="padding:18px">
        ${groupes.slice().sort((a, b) => b.participationMoyenne - a.participationMoyenne).map((g) => `
          <div class="rank-row" style="cursor:default">
            <span class="grp-dot" style="width:14px;height:14px;background:${esc(g.color)}"></span>
            <div class="who"><div class="nm">${esc(g.sigle)} <span style="color:var(--muted);font-weight:500">· ${esc(g.libelle)}</span></div>
              <div class="bar"><i style="width:${g.participationMoyenne}%;background:${esc(g.color)}"></i></div></div>
            <span class="val">${g.participationMoyenne}%</span>
            <span class="sub" style="color:var(--muted);font-size:12.5px;width:56px;text-align:right">${g.n} dép.</span>
          </div>`).join("")}
      </div>
    </div></section>
  </div>`;

  const input = root.querySelector("#q");
  wireSearch(input, root.querySelector(".search-results"));
  requestAnimationFrame(() => input.focus());
};

// ── LIST ──────────────────────────────────────────────────────────────────
V.list = async (root) => {
  setMeta(t("list.title") + " — FicheDéputé.fr", t("meta.sub"), "https://fichedepute.fr/deputes");
  const { deputes } = await STD.getJSON("/api/deputes");
  const groups = [...new Set(deputes.map((d) => d.groupe))].sort();
  const deps = [...new Map(deputes.filter((d) => d.dep).map((d) => [d.dep, d.depNom])).entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "fr", { numeric: true }));

  root.innerHTML = `<section class="block fade-in"><div class="wrap">
    <div class="sec-head"><h1>${esc(t("list.title"))}</h1></div>
    <div class="filters">
      <input id="f-q" type="search" placeholder="${esc(t("search.placeholder"))}" style="flex:1;min-width:200px">
      <select id="f-g"><option value="">${esc(t("list.filter.group"))}</option>${groups.map((g) => `<option value="${esc(g)}">${esc(g)}</option>`).join("")}</select>
      <select id="f-d"><option value="">${esc(t("list.filter.dep"))}</option>${deps.map(([n, l]) => `<option value="${esc(n)}">${esc(n)} · ${esc(l)}</option>`).join("")}</select>
      <select id="f-s">
        <option value="name">${esc(t("list.sort.name"))}</option>
        <option value="pd">${esc(t("list.sort.presence_desc"))}</option>
        <option value="pa">${esc(t("list.sort.presence_asc"))}</option>
      </select>
    </div>
    <div id="count" style="color:var(--muted);font-size:14px;margin-bottom:14px"></div>
    <div class="dep-grid" id="grid"></div>
  </div></section>`;

  const grid = root.querySelector("#grid"), count = root.querySelector("#count");
  const fq = root.querySelector("#f-q"), fg = root.querySelector("#f-g"), fd = root.querySelector("#f-d"), fs = root.querySelector("#f-s");
  const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  function apply() {
    const q = norm(fq.value.trim());
    let arr = deputes.filter((d) =>
      (!fg.value || d.groupe === fg.value) &&
      (!fd.value || d.dep === fd.value) &&
      (!q || norm(`${d.prenom} ${d.nom} ${d.depNom}`).includes(q)));
    if (fs.value === "pd") arr = arr.slice().sort((a, b) => b.presence - a.presence);
    else if (fs.value === "pa") arr = arr.slice().sort((a, b) => a.presence - b.presence);
    count.textContent = t("list.count", { n: arr.length });
    grid.innerHTML = arr.map((d) => `<a class="dep-card" href="/depute/${esc(d.slug)}" data-link>
      ${STD.avatar(d)}
      <div class="meta">
        <div class="nm">${esc(d.prenom)} ${esc(d.nom)}</div>
        <div class="sub">${esc(STD.circoLabel(d))}</div>
        <div style="display:flex;align-items:center;gap:8px">
          ${STD.grpPill(d.groupe, d.groupeLibelle, d.groupeColor)}
          <span class="pp" style="color:${STD.presenceColor(d.presence)}">${d.presence.toFixed(0)}%</span>
        </div>
      </div></a>`).join("") || `<div class="sr-none">${esc(t("search.none"))}</div>`;
  }
  [fq, fg, fd, fs].forEach((el) => el.addEventListener("input", apply));
  apply();
};

// ── FICHE ─────────────────────────────────────────────────────────────────
V.fiche = async (root, m) => {
  const slug = decodeURIComponent(m[1]);
  const [d, indem] = await Promise.all([
    STD.getJSON("/api/depute/" + encodeURIComponent(slug)),
    STD.getJSON("/api/indemnite").catch(() => null),
  ]);
  const g = d.groupe || { sigle: "NI", color: "#8a8f98", libelle: "Non inscrit" };
  const eur = (n) => n.toLocaleString(STD.lang, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const name = `${d.prenom} ${d.nom}`;
  setMeta(`${name} — FicheDéputé.fr`,
    `${name} (${g.sigle}) : ${d.presenceRate}% de participation aux scrutins publics. ${d.nPresent} scrutins sur ${d.nEligible}.`,
    "https://fichedepute.fr/depute/" + d.slug);
  const ogimg = document.querySelector('meta[property="og:image"]');
  if (ogimg) ogimg.setAttribute("content", "https://fichedepute.fr/og/" + d.slug + ".png");

  const born = d.dateNaissance ? new Date(d.dateNaissance).toLocaleDateString(STD.lang, { year: "numeric", month: "long", day: "numeric" }) : null;
  const sortTag = (s) => {
    if (!s) return "";
    const adopt = /adopt/i.test(s);
    return `<span class="sort-tag ${adopt ? "adopte" : "rejete"}">${esc(adopt ? t("fiche.adopted") : t("fiche.rejected"))}</span>`;
  };
  const posLabel = { pour: t("fiche.vote.pour"), contre: t("fiche.vote.contre"), abstention: t("fiche.vote.abstention"), nonVotant: t("fiche.vote.nonVotant") };

  root.innerHTML = `<section class="block fade-in"><div class="wrap">
    <a href="/deputes" data-link style="font-size:14px;font-weight:600;color:var(--muted)">← ${esc(t("nav.deputes"))}</a>

    <div class="fiche-hero" style="margin-top:10px">
      <div class="accent" style="background:${esc(g.color)}"></div>
      <div class="fiche-top">
        ${STD.avatar({ groupeColor: g.color, prenom: d.prenom, nom: d.nom }, "lg")}
        <div class="id" style="flex:1;min-width:220px">
          <h1>${esc(name)}</h1>
          <div class="circo">${esc(STD.circoLabel({ dep: (d.circo || {}).numDepartement, depNom: (d.circo || {}).departement, circo: (d.circo || {}).numCirco }))}</div>
          <div class="fiche-badges">
            ${STD.grpPill(g.sigle, g.libelle, g.color)}
            ${d.rang ? `<span class="chip">${esc(t("fiche.rank", { r: d.rang }))}</span>` : ""}
            <span class="chip" data-views hidden></span>
          </div>
        </div>
        <button class="btn btn-ghost" id="share">⇪ ${esc(t("fiche.share"))}</button>
      </div>

      <div class="gauges">
        ${STD.ring(d.presenceRate, STD.presenceColor(d.presenceRate), t("fiche.presence.ring"), t("fiche.of", { n: d.nEligible }))}
        ${STD.ring(d.participationRate, STD.presenceColor(d.participationRate), t("fiche.participation"), t("fiche.exprime.sub", { n: (d.nExprimes != null ? d.nExprimes : 0).toLocaleString(STD.lang) }))}
        ${d.loyaltyRate != null ? STD.ring(d.loyaltyRate, g.color, t("fiche.loyalty"), t("fiche.loyalty.sub", { g: g.sigle })) : ""}
        <div class="votes-split" style="align-self:center">
          <div class="vsplit pour"><b>${d.nPour}</b><span>${esc(t("fiche.pour"))}</span></div>
          <div class="vsplit contre"><b>${d.nContre}</b><span>${esc(t("fiche.contre"))}</span></div>
          <div class="vsplit abst"><b>${d.nAbstention}</b><span>${esc(t("fiche.abstention"))}</span></div>
        </div>
      </div>
    </div>

    <div class="fiche-cols">
      <div class="panel">
        <h2>${esc(t("fiche.recent"))}</h2>
        ${d.votesRecents.length ? d.votesRecents.map((v) => `
          <div class="vote-item">
            <div class="vote-pos"><span class="vpos-tag ${esc(v.position)}">${esc(posLabel[v.position] || v.position)}</span></div>
            <div class="vote-body">
              <div class="vt">${esc(v.titre || "Scrutin n°" + v.numero)}</div>
              <div class="vm"><span>${esc(new Date(v.date).toLocaleDateString(STD.lang, { day: "2-digit", month: "short", year: "numeric" }))}</span>${sortTag(v.sort)}
                <a href="https://www.assemblee-nationale.fr/dyn/17/scrutins/${esc(v.numero)}" target="_blank" rel="noopener" style="font-size:12px">${esc(t("fiche.source"))} ↗</a></div>
            </div>
          </div>`).join("") : `<p style="color:var(--muted)">—</p>`}
      </div>

      <aside style="display:flex;flex-direction:column;gap:16px">
        <div class="card side-card">
          <h3>${esc(t("fiche.group"))}</h3>
          <div class="kv"><span class="k">${esc(t("fiche.group"))}</span><span class="v">${esc(g.sigle)}</span></div>
          ${born ? `<div class="kv"><span class="k">${esc(t("fiche.born"))}</span><span class="v">${esc(born)}</span></div>` : ""}
          ${d.profession ? `<div class="kv"><span class="k">${esc(t("fiche.profession"))}</span><span class="v">${esc(d.profession)}</span></div>` : ""}
          <div class="kv"><span class="k">${esc(t("fiche.ballots"))}</span><span class="v">${d.nPresent} / ${d.nEligible}</span></div>
        </div>
        ${d.election ? `<div class="card side-card">
          <h3>🗳 ${esc(t("election.title"))}</h3>
          <div class="salary-amount">${d.election.scoreExprimes != null ? d.election.scoreExprimes + "%" : "—"}<span class="salary-unit"> ${esc(t("election.exprimes"))}</span></div>
          <div class="salary-net">${esc(t(d.election.tour === 1 ? "election.round1" : "election.round2"))}${d.election.nuance ? " · " + esc(d.election.nuance) : ""}</div>
          <div class="salary-breakdown"><div class="kv"><span class="k">${esc(t("election.turnout"))}</span><span class="v">${d.election.turnout != null ? d.election.turnout + "%" : "—"}</span></div></div>
          <a class="salary-src" href="https://www.resultats-elections.interieur.gouv.fr/legislatives2024/" target="_blank" rel="noopener">${esc(t("election.source"))} ↗</a>
        </div>` : ""}
        ${d.activite ? `<div class="card side-card">
          <h3>📝 ${esc(t("fiche.activite"))}</h3>
          <div class="act-grid">
            <div class="act"><b>${d.activite.questionsEcrites}</b><span>${esc(t("fiche.activite.qe"))}</span></div>
            <div class="act"><b>${d.activite.qag}</b><span>${esc(t("fiche.activite.qag"))}</span></div>
            ${d.hasAmendements ? `<div class="act"><b>${d.activite.amendements}</b><span>${esc(t("fiche.activite.amdt"))}</span><em>${esc(t("fiche.activite.amdtAdopt", { n: d.activite.amendementsAdoptes }))}</em></div>` : ""}
          </div>
        </div>` : ""}
        ${d.hatvpDecl ? `<div class="card side-card">
          <h3>⚖ ${esc(t("fiche.hatvp"))}</h3>
          <div class="act-grid">
            <div class="act"><b>${d.hatvpDecl.activitesProf}</b><span>${esc(t("hatvp.activites"))}</span></div>
            <div class="act"><b>${d.hatvpDecl.participationsFinancieres}</b><span>${esc(t("hatvp.finance"))}</span></div>
            <div class="act"><b>${d.hatvpDecl.participationsDirigeant}</b><span>${esc(t("hatvp.dirigeant"))}</span></div>
          </div>
          ${(d.hatvpDecl.consultant || d.hatvpDecl.benevole || d.hatvpDecl.activiteConjoint) ? `<div class="hatvp-flags">
            ${d.hatvpDecl.consultant ? `<span class="chip">${esc(t("hatvp.consultant"))}</span>` : ""}
            ${d.hatvpDecl.benevole ? `<span class="chip">${esc(t("hatvp.benevole"))}</span>` : ""}
            ${d.hatvpDecl.activiteConjoint ? `<span class="chip">${esc(t("hatvp.conjoint"))}</span>` : ""}
          </div>` : ""}
          <a class="salary-src" href="${esc(d.hatvp || d.hatvpDecl.url)}" target="_blank" rel="noopener">${esc(t("hatvp.voir"))} ↗</a>
        </div>` : ""}
        ${indem && indem.brutMensuel ? `<div class="card side-card salary-card">
          <h3>💶 ${esc(t("fiche.salary"))}</h3>
          <div class="salary-amount">${esc(eur(indem.brutMensuel))}<span class="salary-unit"> ${esc(t("fiche.salary.brut"))}</span></div>
          <div class="salary-net">${esc(t("fiche.salary.net", { v: eur(indem.netMensuel) }))}</div>
          <div class="salary-breakdown">
            ${(indem.composition || []).map((c) => `<div class="kv"><span class="k">${esc(c.libelle)}</span><span class="v">${esc(eur(c.montant))}</span></div>`).join("")}
          </div>
          <div class="salary-note">${esc(t("fiche.salary.same"))}</div>
          <a class="salary-src" href="${esc(indem.source)}" target="_blank" rel="noopener">${esc(t("fiche.salary.source"))} ↗</a>
        </div>` : ""}
        <div class="card side-card">
          <h3>${esc(t("fiche.contact"))}</h3>
          <div class="link-row">
            ${d.hatvp ? `<a href="${esc(d.hatvp)}" target="_blank" rel="noopener">⚖ ${esc(t("fiche.hatvp"))} ↗</a>` : ""}
            ${d.twitter ? `<a href="https://twitter.com/${esc(String(d.twitter).replace(/^@/, ""))}" target="_blank" rel="noopener">𝕏 ${esc(d.twitter)} ↗</a>` : ""}
            ${d.website ? `<a href="${esc(d.website)}" target="_blank" rel="noopener">🌐 Site ↗</a>` : ""}
            ${d.email ? `<a href="mailto:${esc(d.email)}">✉ ${esc(d.email)}</a>` : ""}
          </div>
        </div>
      </aside>
    </div>
  </div></section>`;

  // animate ring on mount
  requestAnimationFrame(() => {
    const c = root.querySelector(".ring circle:last-of-type");
    if (c) { const full = c.getAttribute("stroke-dasharray"); c.setAttribute("stroke-dasharray", "0 9999"); requestAnimationFrame(() => c.setAttribute("stroke-dasharray", full)); }
  });
  root.querySelector("#share").addEventListener("click", async () => {
    const url = location.href;
    const shareData = { title: `${name} — FicheDéputé.fr`, text: `${name} : ${d.participationRate}% de participation aux scrutins.`, url };
    if (navigator.share) { try { await navigator.share(shareData); } catch (e) {} }
    else { try { await navigator.clipboard.writeText(url); STD.toast(t("fiche.shared")); } catch (e) {} }
  });
};

// ── RANKINGS ──────────────────────────────────────────────────────────────
V.rankings = async (root) => {
  setMeta(t("rank.title") + " — FicheDéputé.fr", t("meta.sub"), "https://fichedepute.fr/classements");
  const stats = await STD.getJSON("/api/stats");
  // colorMode: "score" → green/amber/red by value; "group" → the deputy's group colour
  const tbl = (title, arr, field, colorMode = "score") => `
    <div class="panel" style="margin-bottom:20px">
      <h2>${esc(title)}</h2>
      <div>${arr.slice(0, 15).map((d, i) => `<a class="rank-row" href="/depute/${esc(d.slug)}" data-link>
        <span class="pos">${i + 1}</span>${STD.avatar(d)}
        <div class="who"><div class="nm">${esc(d.prenom)} ${esc(d.nom)}</div><div class="sub">${esc(d.groupe)} · ${esc(d.depNom || "")}</div></div>
        <span class="val" style="color:${colorMode === "group" ? esc(d.groupeColor) : STD.presenceColor(d[field])}">${d[field].toFixed(1)}%</span></a>`).join("")}</div>
    </div>`;
  root.innerHTML = `<section class="block fade-in"><div class="wrap">
    <div class="sec-head"><h1>${esc(t("rank.title"))}</h1></div>
    <div class="grid-2">
      <div>${tbl(t("rank.assidus"), stats.plusAssidus, "presence")}</div>
      <div>${tbl(t("rank.absents"), stats.plusAbsents, "presence")}</div>
    </div>
    ${tbl(t("rank.actifs"), stats.plusActifs, "participation")}
    ${(stats.plusFrondeurs && stats.plusFrondeurs.length) ? `<div class="grid-2">
      <div>${tbl(t("rank.frondeurs"), stats.plusFrondeurs, "loyalty", "group")}</div>
      <div>${tbl(t("rank.loyaux"), stats.plusLoyaux, "loyalty", "group")}</div>
    </div>` : ""}
  </div></section>`;
};

// ── GAME · Devine le député (normal = 4 choix · expert = saisie libre) ─────
V.game = async (root) => {
  setMeta(t("game.title") + " — FicheDéputé.fr", t("game.lead"), "https://fichedepute.fr/jeu");
  const MODES = ["normal", "expert"];
  let mode = MODES.includes(localStorage.getItem("fd_game_mode")) ? localStorage.getItem("fd_game_mode") : "normal";
  const bestKey = () => "fd_game_best_" + mode;
  const loadBest = () => parseInt(localStorage.getItem(bestKey()) || "0", 10) || 0;
  let best = loadBest();
  let streak = 0;

  root.innerHTML = `<section class="block fade-in"><div class="wrap">
    <div class="game-head">
      <div>
        <h2 class="game-title">🕵️ ${esc(t("game.title"))}</h2>
        <p class="game-lead">${esc(t("game.lead"))}</p>
      </div>
      <div class="game-score">
        <div class="gsc"><b id="g-streak">0</b><span>${esc(t("game.streak"))}</span></div>
        <div class="gsc"><b id="g-best">${best}</b><span>${esc(t("game.best"))}</span></div>
      </div>
    </div>
    <div class="game-mode" role="tablist">
      ${MODES.map((mo) => `<button class="gm-btn${mo === mode ? " active" : ""}" data-mode="${mo}">
        <b>${esc(t("game.mode." + mo))}</b><span>${esc(t("game.mode." + mo + ".hint"))}</span></button>`).join("")}
    </div>
    <div id="g-card"></div>
  </div></section>`;

  const card = root.querySelector("#g-card");
  const elStreak = root.querySelector("#g-streak"), elBest = root.querySelector("#g-best");

  root.querySelectorAll(".gm-btn").forEach((btn) => btn.addEventListener("click", () => {
    if (btn.dataset.mode === mode) return;
    mode = btn.dataset.mode;
    localStorage.setItem("fd_game_mode", mode);
    root.querySelectorAll(".gm-btn").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
    streak = 0; elStreak.textContent = "0";
    best = loadBest(); elBest.textContent = best;
    loadRound();
  }));

  const voteList = (arr, kind) => `<ul class="g-votes ${kind}">${arr.map((v) =>
    `<li><span class="g-tick">${kind === "yes" ? "✓" : "✕"}</span><span>${esc(v.titre || "Scrutin")}</span></li>`).join("")}</ul>`;

  // shared post-answer handling: score, persist best, render the result banner
  function settle(r, correct, result) {
    const answer = r.choices.find((c) => c.uid === r.answer);
    const answerName = `${answer.prenom} ${answer.nom}`;
    streak = correct ? streak + 1 : 0;
    elStreak.textContent = streak;
    if (streak > best) { best = streak; localStorage.setItem(bestKey(), String(best)); elBest.textContent = best; }
    result.hidden = false;
    result.className = "g-result " + (correct ? "ok" : "ko");
    result.innerHTML = `<span class="g-verdict">${correct ? "✅ " + esc(t("game.correct", { name: answerName })) : "❌ " + esc(t("game.wrong", { name: answerName }))}</span>
      <div class="g-actions">
        <a class="btn btn-ghost" href="/depute/${esc(r.answerSlug)}" data-link>${esc(t("game.seefiche"))}</a>
        <button class="btn btn-primary" id="g-next">${esc(t("game.next"))}</button>
      </div>`;
    result.querySelector("#g-next").addEventListener("click", loadRound);
    result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // NORMAL: 4 clickable choices
  function renderNormal(pick, r, result) {
    pick.innerHTML = `<h3>${esc(t("game.pick"))}</h3>
      <div class="g-choices">${r.choices.map((c) => `
        <button class="g-choice" data-uid="${esc(c.uid)}">
          ${STD.avatar(c)}
          <span class="g-cinfo">
            <span class="g-cname">${esc(c.prenom)} ${esc(c.nom)}</span>
            <span class="g-cmeta">${esc(c.groupe)}${c.depNom ? " · " + esc(c.depNom) : ""}</span>
          </span>
        </button>`).join("")}</div>`;
    const buttons = [...pick.querySelectorAll(".g-choice")];
    let answered = false;
    buttons.forEach((btn) => btn.addEventListener("click", () => {
      if (answered) return; answered = true;
      const correct = btn.dataset.uid === r.answer;
      buttons.forEach((b) => {
        b.disabled = true;
        if (b.dataset.uid === r.answer) b.classList.add("is-right");
        else if (b === btn) b.classList.add("is-wrong");
      });
      settle(r, correct, result);
    }));
  }

  // EXPERT: free-text autocomplete over all 577 MPs
  function renderExpert(pick, r, result) {
    pick.innerHTML = `<h3>${esc(t("game.pick"))}</h3>
      <div class="g-expert">
        <span class="ico">⌕</span>
        <input id="g-guess" type="search" autocomplete="off" placeholder="${esc(t("game.expert.placeholder"))}" aria-label="${esc(t("game.expert.placeholder"))}">
        <div class="g-suggest" hidden></div>
      </div>`;
    const input = pick.querySelector("#g-guess");
    const box = pick.querySelector(".g-suggest");
    let timer, active = -1, answered = false;
    const close = () => { box.hidden = true; box.innerHTML = ""; active = -1; };
    const guess = (uid) => {
      if (answered) return; answered = true;
      input.disabled = true; close();
      settle(r, uid === r.answer, result);
    };
    input.addEventListener("input", () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 2) return close();
      timer = setTimeout(async () => {
        const { results } = await STD.getJSON("/api/search?q=" + encodeURIComponent(q));
        if (answered) return;
        if (!results.length) { box.innerHTML = `<div class="sr-none">${esc(t("search.none"))}</div>`; box.hidden = false; return; }
        box.innerHTML = results.map((d) => `<button class="g-sug" data-uid="${esc(d.uid)}">
          ${STD.avatar(d)}<span class="g-cname">${esc(d.prenom)} ${esc(d.nom)}</span>
          <span class="g-cmeta">${esc(d.groupe)}${d.depNom ? " · " + esc(d.depNom) : ""}</span></button>`).join("");
        box.hidden = false; active = -1;
        box.querySelectorAll(".g-sug").forEach((b) => b.addEventListener("click", () => guess(b.dataset.uid)));
      }, 160);
    });
    input.addEventListener("keydown", (e) => {
      const sug = [...box.querySelectorAll(".g-sug")];
      if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(active + 1, sug.length - 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(active - 1, 0); }
      else if (e.key === "Enter") { e.preventDefault(); if (sug[active]) sug[active].click(); else if (sug.length === 1) sug[0].click(); return; }
      else if (e.key === "Escape") return close();
      sug.forEach((l, i) => l.classList.toggle("sug-active", i === active));
    });
    requestAnimationFrame(() => input.focus());
  }

  async function loadRound() {
    card.innerHTML = `<div class="spinner"></div>`;
    let r;
    try { r = await STD.getJSON("/api/game/round?_=" + Date.now()); }
    catch { card.innerHTML = `<p class="sr-none">${esc(t("search.none"))}</p>`; return; }
    // getJSON caches by URL; the _=Date.now() busts it so each round is fresh
    const presColor = STD.presenceColor(r.clue.presence);
    card.innerHTML = `<div class="game-card fade-in">
      <div class="g-clues">
        <div class="g-gauge">${STD.ring(r.clue.presence, presColor, t("game.presence"), "")}</div>
        <div class="g-votecols">
          <div class="g-votecol"><h4 class="g-yes">${esc(t("game.yes"))}</h4>${voteList(r.clue.pour, "yes")}</div>
          <div class="g-votecol"><h4 class="g-no">${esc(t("game.no"))}</h4>${voteList(r.clue.contre, "no")}</div>
        </div>
      </div>
      <div class="g-pick"></div>
      <div class="g-result" hidden></div>
    </div>`;
    const pick = card.querySelector(".g-pick");
    const result = card.querySelector(".g-result");
    (mode === "expert" ? renderExpert : renderNormal)(pick, r, result);
  }
  loadRound();
};

// ── GROUPS ────────────────────────────────────────────────────────────────
V.groups = async (root) => {
  setMeta(t("groups.title") + " — FicheDéputé.fr", t("meta.sub"), "https://fichedepute.fr/groupes");
  const { groupes } = await STD.getJSON("/api/groupes");
  root.innerHTML = `<section class="block fade-in"><div class="wrap">
    <div class="sec-head"><h1>${esc(t("groups.title"))}</h1></div>
    <div class="grp-grid">
      ${groupes.slice().sort((a, b) => b.n - a.n).map((g) => `
        <div class="card grp-card" style="border-left-color:${esc(g.color)}">
          <div class="gt">${esc(g.sigle)}</div>
          <div class="gsig">${esc(g.libelle)}</div>
          <div class="gm">
            <div><div class="n">${g.n}</div><div class="lbl">${esc(t("groups.members", { n: g.n }))}</div></div>
            <div><div class="n" style="color:${STD.presenceColor(g.participationMoyenne)}">${g.participationMoyenne}%</div><div class="lbl">${esc(t("groups.presence"))}</div></div>
          </div>
          <div class="bar" style="margin-top:14px"><i style="width:${g.participationMoyenne}%;background:${esc(g.color)}"></i></div>
        </div>`).join("")}
    </div>
  </div></section>`;
};

// ── METHODO ───────────────────────────────────────────────────────────────
V.methodo = async (root) => {
  setMeta(t("methodo.title") + " — FicheDéputé.fr", t("meta.sub"), "https://fichedepute.fr/methode");
  const [meta, faq] = await Promise.all([STD.getJSON("/api/meta"), STD.getJSON("/api/faq").catch(() => ({}))]);
  const d = meta.generatedAt ? new Date(meta.generatedAt).toLocaleDateString(STD.lang, { year: "numeric", month: "long", day: "numeric" }) : "—";
  const items = (faq[STD.lang] || faq.fr || []);
  const faqHtml = items.length ? `
    <h2 class="faq-title">${esc(t("methodo.faqTitle"))}</h2>
    <div class="faq">
      ${items.map((x) => `<details class="faq-item">
        <summary>${esc(x.q)}</summary>
        <div class="faq-a">${x.a}</div>
      </details>`).join("")}
    </div>` : "";
  root.innerHTML = `<section class="block fade-in"><div class="wrap">
    <div class="prose">
      <h1>${esc(t("methodo.title"))}</h1>
      <p>${t("methodo.body")}</p>
      ${faqHtml}
      <p class="upd">${esc(t("methodo.updated", { d }))}</p>
    </div>
  </div></section>`;
};
