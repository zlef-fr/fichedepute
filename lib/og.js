// Dynamic social share card (1200×630 SVG) for a deputy fiche.
// Rendered on the fly — factual, on-brand, screenshot-ready.
function esc(s) {
  return (s || "").toString().replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
}

// strip flag/emoji (regional-indicator + ZWJ/VS) so the PNG needs no emoji font
const noEmoji = (s) => (s || "").replace(/[\u{1F1E6}-\u{1F1FF}\u{2600}-\u{27BF}\u{1F300}-\u{1FAFF}‍️]/gu, "").trim();

function card(d) {
  const name = esc(`${d.prenom} ${d.nom}`);
  const circo = esc(noEmoji(`${d.dep} · ${d.depNom}${d.circo ? " — " + d.circo + "ᵉ circo" : ""}`));
  const grpFull = d.groupeLibelle || d.groupe || "";
  const grp = esc(grpFull.length > 30 ? (d.groupe || grpFull) : grpFull);
  const color = d.groupeColor || "#173a6a";
  const val = d.presence != null ? d.presence : d.participation;   // headline = presence
  const part = val != null ? Math.round(val) : "—";
  const arc = Math.max(0, Math.min(100, val || 0));
  const R = 120, C = 2 * Math.PI * R;
  const dash = (arc / 100) * C;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#eef2f9"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="10" y="0" fill="#000091"/>
  <rect width="1200" height="10" y="620" fill="#e1000f"/>
  <g font-family="'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
    <text x="80" y="120" font-size="30" fill="#000091" font-weight="700" letter-spacing="1">fichedepute.fr</text>
    <text x="80" y="250" font-size="66" fill="#161616" font-weight="800">${name}</text>
    <text x="80" y="305" font-size="30" fill="#3a3a3a">${circo}</text>
    <rect x="80" y="345" rx="18" height="52" width="${Math.min(600, 52 + grp.length * 15)}" fill="${color}"/>
    <text x="104" y="380" font-size="26" fill="#ffffff" font-weight="600">${grp}</text>
    <text x="80" y="500" font-size="26" fill="#555">Présence aux scrutins publics · 17ᵉ législature</text>

    <g transform="translate(1000,300)">
      <circle r="${R}" fill="none" stroke="#e6e9f0" stroke-width="26"/>
      <circle r="${R}" fill="none" stroke="${color}" stroke-width="26" stroke-linecap="round"
        stroke-dasharray="${dash.toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90)"/>
      <text x="0" y="4" font-size="58" fill="#161616" font-weight="800" text-anchor="middle">${part}%</text>
      <text x="0" y="52" font-size="24" fill="#666" text-anchor="middle">présence</text>
    </g>
  </g>
</svg>`;
}

module.exports = { card };
