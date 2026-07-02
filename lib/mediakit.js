// Media kit — on-brand, press-ready assets generated as SVG (rendered to PNG on the fly).
// Shared verbatim across FicheDéputé.fr / FicheSénateur.fr / FicheDéputé.eu.
// Four brands: fr (Assemblée), senat (Sénat), eu (Parlement européen) + family (le réseau 3-en-1).

const BRANDS = {
  fr: {
    key: "fr", letter: "D",
    fiche: "Fiche", rest: "Député", tld: ".fr",
    domain: "fichedepute.fr",
    url: "https://fichedepute.fr",
    tagline: "La fiche vivante de votre député·e",
    taglineEn: "The living scorecard of your MP",
    inst: "Assemblée nationale",
    instEn: "French National Assembly",
    primary: "#000091", primary2: "#1212a0",
    accent: "#e1000f", ink: "#ffffff",
    flag: "fr",
  },
  senat: {
    key: "senat", letter: "S",
    fiche: "Fiche", rest: "Sénateur", tld: ".fr",
    domain: "senat.fichedepute.fr",
    url: "https://senat.fichedepute.fr",
    tagline: "La fiche vivante de votre sénateur·rice",
    taglineEn: "The living scorecard of your Senator",
    inst: "Sénat",
    instEn: "French Senate",
    primary: "#000091", primary2: "#1212a0",
    accent: "#e1000f", ink: "#ffffff",
    flag: "fr",
  },
  eu: {
    key: "eu", letter: "E",
    fiche: "Fiche", rest: "Député", tld: ".eu",
    domain: "fichedepute.eu",
    url: "https://fichedepute.eu",
    tagline: "La fiche vivante de votre eurodéputé·e",
    taglineEn: "The living scorecard of your MEP",
    inst: "Parlement européen",
    instEn: "European Parliament",
    primary: "#003399", primary2: "#0a3aa0",
    accent: "#ffcc00", ink: "#ffcc00",
    flag: "eu",
  },
  family: {
    key: "family", letter: "F",
    fiche: "Fiche", rest: "Député", tld: "",
    domain: "fichedepute.fr · .eu · senat",
    url: "https://fichedepute.fr",
    tagline: "La démocratie représentative, en clair et 100 % sourcée",
    taglineEn: "Representative democracy, in plain terms and fully sourced",
    inst: "Assemblée · Sénat · Parlement européen",
    instEn: "Assembly · Senate · European Parliament",
    primary: "#000091", primary2: "#1212a0",
    accent: "#e1000f", ink: "#ffffff",
    flag: "family",
  },
};

// Asset catalogue (order = display order). w/h feed the page previews & PNG raster.
const KINDS = [
  { id: "icon",          group: "logo",    w: 512,  h: 512,  label: "Icône",            labelEn: "Icon" },
  { id: "wordmark",      group: "logo",    w: 900,  h: 260,  label: "Logo (fond clair)", labelEn: "Logo (light)" },
  { id: "wordmark-dark", group: "logo",    w: 900,  h: 260,  label: "Logo (fond foncé)", labelEn: "Logo (dark)" },
  { id: "banner-og",     group: "banner",  w: 1200, h: 630,  label: "Bannière · 1200×630", labelEn: "Banner · 1200×630" },
  { id: "banner-x",      group: "banner",  w: 1500, h: 500,  label: "En-tête X · 1500×500", labelEn: "X header · 1500×500" },
  { id: "banner-li",     group: "banner",  w: 1584, h: 396,  label: "En-tête LinkedIn · 1584×396", labelEn: "LinkedIn · 1584×396" },
  { id: "story",         group: "story",   w: 1080, h: 1920, label: "Story · 1080×1920", labelEn: "Story · 1080×1920" },
];

// ── geometry helpers ────────────────────────────────────────────────────────
function starPath(cx, cy, ro) {
  const ri = ro * 0.382, pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? ri : ro;
    const a = (-90 + i * 36) * Math.PI / 180;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

// ring of 12 EU stars
function euStars(cx, cy, R, r, fill) {
  let s = "";
  for (let i = 0; i < 12; i++) {
    const a = (i * 30 - 90) * Math.PI / 180;
    s += `<path d="${starPath(cx + R * Math.cos(a), cy + R * Math.sin(a), r)}" fill="${fill}"/>`;
  }
  return s;
}

// parliamentary hemicycle: concentric arcs of seats fanning upward
function hemicycle(cx, cy, rMin, rMax, rows, fill, opacity) {
  let s = `<g fill="${fill}" opacity="${opacity}">`;
  for (let k = 0; k < rows; k++) {
    const r = rMin + (rMax - rMin) * (k / (rows - 1));
    const n = Math.round(6 + r / 26);
    const dot = Math.max(2.4, r * 0.028);
    for (let i = 0; i <= n; i++) {
      const a = Math.PI + (i / n) * Math.PI;        // 180°→360° = upward fan
      s += `<circle cx="${(cx + r * Math.cos(a)).toFixed(1)}" cy="${(cy + r * Math.sin(a)).toFixed(1)}" r="${dot.toFixed(1)}"/>`;
    }
  }
  return s + "</g>";
}

// the rounded-square brand icon (self-contained group, drawn at 0,0 with size s)
function iconGlyph(b, s) {
  const r = s * 0.22;
  const inner = `<rect width="${s}" height="${s}" rx="${r}" fill="url(#ig)"/>`;
  const accentBar = `<rect x="${s * 0.22}" y="${s * 0.8}" width="${s * 0.56}" height="${s * 0.055}" rx="${s * 0.03}" fill="${b.accent}"/>`;
  let mark;
  if (b.flag === "family") {
    // hemicycle glyph = the whole network
    mark = hemicycle(s / 2, s * 0.62, s * 0.1, s * 0.34, 5, "#ffffff", 0.96)
         + `<circle cx="${s / 2}" cy="${s * 0.62}" r="${s * 0.05}" fill="${b.accent}"/>`;
  } else if (b.flag === "eu") {
    mark = euStars(s / 2, s * 0.46, s * 0.3, s * 0.05, b.accent)
         + `<text x="${s / 2}" y="${s * 0.55}" font-size="${s * 0.34}" font-weight="800" fill="${b.accent}" text-anchor="middle" font-family="'DejaVu Sans',sans-serif">${b.letter}</text>`;
  } else {
    mark = `<text x="${s / 2}" y="${s * 0.66}" font-size="${s * 0.5}" font-weight="800" fill="#ffffff" text-anchor="middle" font-family="'DejaVu Sans',sans-serif">${b.letter}</text>`;
  }
  return `<defs><linearGradient id="ig" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${b.primary2}"/><stop offset="1" stop-color="${b.primary}"/>
    </linearGradient></defs>${inner}${mark}${b.flag === "family" ? "" : accentBar}`;
}

// wordmark text as <tspan>s (Fiche = primary/white, rest = ink, tld = accent)
function wordmarkText(b, x, y, size, dark) {
  const c1 = dark ? "#ffffff" : b.primary;
  const c2 = dark ? "#e9eaf2" : "#161616";
  const fiche = dark && b.key === "eu" ? "#ffffff" : c1;
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="800" font-family="'DejaVu Sans',sans-serif" letter-spacing="-1">`
    + `<tspan fill="${fiche}">${b.fiche}</tspan>`
    + `<tspan fill="${c2}">${b.rest}</tspan>`
    + (b.tld ? `<tspan fill="${b.accent}" font-weight="700">${b.tld}</tspan>` : "")
    + `</text>`;
}

// ── individual assets ───────────────────────────────────────────────────────
function svgIcon(b) {
  const s = 512;
  return wrap(s, s, iconGlyph(b, s));
}

function svgWordmark(b, dark) {
  const W = 900, H = 260, s = 168, ix = 40, iy = (H - s) / 2;
  const bg = dark ? `<rect width="${W}" height="${H}" fill="${b.primary}"/>` : "";
  const tx = ix + s + 44;
  return wrap(W, H,
    bg
    + `<g transform="translate(${ix},${iy})">${iconGlyph(b, s)}</g>`
    + wordmarkText(b, tx, H / 2 - 6, 62, dark)
    + `<text x="${tx + 2}" y="${H / 2 + 44}" font-size="24" font-weight="500" fill="${dark ? "#b9bce0" : "#5a5a68"}" font-family="'DejaVu Sans',sans-serif">${esc(b.inst)}</text>`
  );
}

function svgBanner(b, W, H) {
  const compact = H < 520;                 // linkedin / x are short
  const pad = Math.round(W * 0.055);
  const s = Math.round(H * (compact ? 0.42 : 0.34));
  const iy = compact ? Math.round(H * 0.30) : Math.round(H * 0.22);
  const tx = pad + s + Math.round(W * 0.03);
  const nameSize = Math.round(H * (compact ? 0.16 : 0.13));
  const cy = iy + s / 2;
  const tagY = compact ? H * 0.62 : H * 0.6;

  const bars = b.flag === "eu"
    ? `<rect width="${W}" height="10" fill="${b.accent}"/><rect width="${W}" height="10" y="${H - 10}" fill="${b.accent}"/>`
    : `<rect width="${W}" height="10" fill="${b.primary}"/><rect width="${W}" height="10" y="${H - 10}" fill="${b.accent}"/>`;

  const motif = b.flag === "eu"
    ? euStars(W - Math.round(W * 0.16), H / 2, Math.round(H * 0.32), Math.round(H * 0.045), "rgba(0,51,153,0.10)")
    : hemicycle(W - Math.round(W * 0.14), H * 0.9, H * 0.16, H * 0.62, 6, b.primary, 0.07);

  const tagline = compact ? "" :
    `<text x="${tx}" y="${tagY}" font-size="${Math.round(H * 0.05)}" fill="#3a3a44" font-family="'DejaVu Sans',sans-serif">${esc(b.tagline)}</text>`;

  const chip = `<g transform="translate(${tx},${H * (compact ? 0.6 : 0.7)})">
      <rect width="${44 + b.inst.length * (H * 0.019)}" height="${Math.round(H * 0.062)}" rx="${Math.round(H * 0.031)}" fill="${b.primary}" opacity="${b.flag === "eu" ? 1 : 0.08}"/>
      <text x="20" y="${Math.round(H * 0.043)}" font-size="${Math.round(H * 0.032)}" font-weight="700" fill="${b.flag === "eu" ? b.accent : b.primary}" font-family="'DejaVu Sans',sans-serif">${esc(b.inst)}</text>
    </g>`;

  const domain = `<text x="${W - pad}" y="${H - Math.round(H * 0.06)}" font-size="${Math.round(H * 0.04)}" font-weight="700" fill="${b.primary}" text-anchor="end" font-family="'DejaVu Sans',sans-serif" opacity="0.85">${esc(b.domain)}</text>`;

  return wrap(W, H,
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#eef2f9"/></linearGradient></defs>`
    + `<rect width="${W}" height="${H}" fill="url(#bg)"/>`
    + motif + bars
    + `<g transform="translate(${pad},${iy})">${iconGlyph(b, s)}</g>`
    + wordmarkText(b, tx, cy + nameSize * 0.34, nameSize, false)
    + tagline + chip + domain
  );
}

function svgStory(b) {
  const W = 1080, H = 1920, s = 300, cx = W / 2;
  const iy = 560;
  const white = b.flag === "eu" ? b.accent : "#ffffff";
  const soft = b.flag === "eu" ? "rgba(255,204,0,0.85)" : "rgba(255,255,255,0.86)";

  const motif = b.flag === "eu"
    ? euStars(cx, 1470, 360, 46, "rgba(255,204,0,0.16)")
    : hemicycle(cx, 1560, 120, 540, 8, "#ffffff", 0.09);

  const tld = b.tld ? `<tspan fill="${b.accent}" font-weight="700">${b.tld}</tspan>` : "";

  return wrap(W, H,
    `<defs><linearGradient id="sg" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="${b.primary2}"/><stop offset="1" stop-color="${b.primary}"/></linearGradient></defs>`
    + `<rect width="${W}" height="${H}" fill="url(#sg)"/>`
    + motif
    + `<rect x="0" y="0" width="${W}" height="14" fill="${b.accent}"/>`
    + `<g transform="translate(${(W - s) / 2},${iy})">${iconGlyph(b, s)}</g>`
    // wordmark, centered, white
    + `<text x="${cx}" y="${iy + s + 190}" font-size="110" font-weight="800" text-anchor="middle" letter-spacing="-2" font-family="'DejaVu Sans',sans-serif">`
      + `<tspan fill="${b.flag === "eu" ? "#ffffff" : "#ffffff"}">${b.fiche}</tspan><tspan fill="${b.flag === "eu" ? "#ffffff" : "#dfe1f5"}">${b.rest}</tspan>${tld}</text>`
    + `<text x="${cx}" y="${iy + s + 270}" font-size="42" fill="${soft}" text-anchor="middle" font-family="'DejaVu Sans',sans-serif">${esc(b.tagline)}</text>`
    // institution pill
    + `<g transform="translate(${cx},${iy + s + 360})"><rect x="${-(b.inst.length * 13 + 60) / 2}" y="0" width="${b.inst.length * 13 + 60}" height="76" rx="38" fill="rgba(255,255,255,0.12)" stroke="${white}" stroke-opacity="0.4"/>`
      + `<text x="0" y="50" font-size="34" font-weight="700" fill="${white}" text-anchor="middle" font-family="'DejaVu Sans',sans-serif">${esc(b.inst)}</text></g>`
    + `<text x="${cx}" y="${H - 150}" font-size="40" font-weight="800" fill="${white}" text-anchor="middle" letter-spacing="1" font-family="'DejaVu Sans',sans-serif">${esc(b.domain)}</text>`
    + `<text x="${cx}" y="${H - 96}" font-size="28" fill="${soft}" text-anchor="middle" font-family="'DejaVu Sans',sans-serif">Données officielles · 100 % sourcé</text>`
  );
}

// ── plumbing ────────────────────────────────────────────────────────────────
function esc(s) {
  return (s || "").toString().replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
}
function wrap(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}

function render(brandKey, kind) {
  const b = BRANDS[brandKey];
  if (!b) return null;
  switch (kind) {
    case "icon":          return svgIcon(b);
    case "wordmark":      return svgWordmark(b, false);
    case "wordmark-dark": return svgWordmark(b, true);
    case "banner-og":     return svgBanner(b, 1200, 630);
    case "banner-x":      return svgBanner(b, 1500, 500);
    case "banner-li":     return svgBanner(b, 1584, 396);
    case "story":         return svgStory(b);
    default:              return null;
  }
}

module.exports = { BRANDS, KINDS, render };
