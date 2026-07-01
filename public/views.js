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
    <div class="sec-head"><h2>${esc(t("list.title"))}</h2></div>
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
  const d = await STD.getJSON("/api/depute/" + encodeURIComponent(slug));
  const g = d.groupe || { sigle: "NI", color: "#8a8f98", libelle: "Non inscrit" };
  const name = `${d.prenom} ${d.nom}`;
  setMeta(`${name} — FicheDéputé.fr`,
    `${name} (${g.sigle}) : ${d.presenceRate}% de participation aux scrutins publics. ${d.nPresent} scrutins sur ${d.nEligible}.`,
    "https://fichedepute.fr/depute/" + d.slug);
  const ogimg = document.querySelector('meta[property="og:image"]');
  if (ogimg) ogimg.setAttribute("content", "https://fichedepute.fr/og/" + d.slug + ".svg");

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
          </div>
        </div>
        <button class="btn btn-ghost" id="share">⇪ ${esc(t("fiche.share"))}</button>
      </div>

      <div class="gauges">
        ${STD.ring(d.presenceRate, STD.presenceColor(d.presenceRate), t("fiche.participation"), t("fiche.of", { n: d.nEligible }))}
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
  const tbl = (title, arr, field) => `
    <div class="panel" style="margin-bottom:20px">
      <h2>${esc(title)}</h2>
      <div>${arr.slice(0, 15).map((d, i) => `<a class="rank-row" href="/depute/${esc(d.slug)}" data-link>
        <span class="pos">${i + 1}</span>${STD.avatar(d)}
        <div class="who"><div class="nm">${esc(d.prenom)} ${esc(d.nom)}</div><div class="sub">${esc(d.groupe)} · ${esc(d.depNom || "")}</div></div>
        <span class="val" style="color:${STD.presenceColor(d[field])}">${d[field].toFixed(1)}%</span></a>`).join("")}</div>
    </div>`;
  root.innerHTML = `<section class="block fade-in"><div class="wrap">
    <div class="sec-head"><h2>${esc(t("rank.title"))}</h2></div>
    <div class="grid-2">
      <div>${tbl(t("rank.assidus"), stats.plusAssidus, "presence")}</div>
      <div>${tbl(t("rank.absents"), stats.plusAbsents, "presence")}</div>
    </div>
    ${tbl(t("rank.actifs"), stats.plusActifs, "participation")}
  </div></section>`;
};

// ── GROUPS ────────────────────────────────────────────────────────────────
V.groups = async (root) => {
  setMeta(t("groups.title") + " — FicheDéputé.fr", t("meta.sub"), "https://fichedepute.fr/groupes");
  const { groupes } = await STD.getJSON("/api/groupes");
  root.innerHTML = `<section class="block fade-in"><div class="wrap">
    <div class="sec-head"><h2>${esc(t("groups.title"))}</h2></div>
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
  const meta = await STD.getJSON("/api/meta");
  const d = meta.generatedAt ? new Date(meta.generatedAt).toLocaleDateString(STD.lang, { year: "numeric", month: "long", day: "numeric" }) : "—";
  root.innerHTML = `<section class="block fade-in"><div class="wrap">
    <div class="prose">
      <h1>${esc(t("methodo.title"))}</h1>
      <p>${t("methodo.body")}</p>
      <p class="upd">${esc(t("methodo.updated", { d }))}</p>
    </div>
  </div></section>`;
};
