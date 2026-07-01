#!/usr/bin/env python3
"""
FicheDéputé.fr — data pipeline.
Transforms official Assemblée nationale open data (17th legislature) into
ready-to-serve JSON: light deputy list, full per-deputy "fiche vivante",
groups, and viral leaderboards. Client does zero computation.

Sources (data.assemblee-nationale.fr, licence Ouverte):
  - AMO10 deputes_actifs_mandats_actifs_organes  (acteurs + organes)
  - loi/scrutins/Scrutins.json                    (7900+ scrutins publics)
"""
import json, glob, os, sys, collections, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
DEP_DIR = os.path.join(HERE, "raw-deputes", "json")
SCR_DIR = os.path.join(HERE, "raw-scrutins", "json")
OUT = os.path.abspath(os.path.join(HERE, "..", "data"))
os.makedirs(os.path.join(OUT, "depute"), exist_ok=True)

# Standard political colours (hex) keyed by group sigle. Kept factual/neutral.
GROUP_COLORS = {
    "RN":      "#173a6a",
    "EPR":     "#ffd400",
    "LFI-NFP": "#cc2443",
    "DR":      "#0066cc",
    "SOC":     "#e8557e",
    "EcoS":    "#4caf50",
    "Dem":     "#ff9800",
    "HOR":     "#00b3c8",
    "GDR":     "#c0392b",
    "LIOT":    "#f4a300",
    "UDR":     "#1b3a5c",
    "NI":      "#8a8f98",
}

def as_list(x):
    if x is None: return []
    return x if isinstance(x, list) else [x]

def txt(x):
    if isinstance(x, dict): return x.get("#text")
    return x

# ---------------------------------------------------------------------------
# 1. Organes: political groups (GP) + circonscription labels
# ---------------------------------------------------------------------------
print("· loading organes …", file=sys.stderr)
groups = {}        # uid -> {sigle, libelle, color}
for f in glob.glob(os.path.join(DEP_DIR, "organe", "*.json")):
    o = json.load(open(f))["organe"]
    if o.get("codeType") == "GP":
        sigle = o.get("libelleAbrege")
        groups[o["uid"]] = {
            "uid": o["uid"],
            "sigle": sigle,
            "libelle": o.get("libelle"),
            "color": GROUP_COLORS.get(sigle, "#8a8f98"),
            "position": (o.get("positionPolitique") or None),
        }
GROUP_UIDS = set(groups)

# ---------------------------------------------------------------------------
# 2. Acteurs: identity + current group + circonscription
# ---------------------------------------------------------------------------
print("· loading %d acteurs …" % len(glob.glob(os.path.join(DEP_DIR, "acteur", "*.json"))), file=sys.stderr)
deputes = {}   # uid -> record
for f in glob.glob(os.path.join(DEP_DIR, "acteur", "*.json")):
    a = json.load(open(f))["acteur"]
    uid = txt(a["uid"])
    ident = a["etatCivil"]["ident"]
    naiss = a["etatCivil"].get("infoNaissance") or {}
    prof = (a.get("profession") or {}).get("libelleCourant")

    group_uid, group_start = None, None
    circo = None
    mandate_start = None
    place = None
    for m in as_list(a["mandats"]["mandat"]):
        typ = m.get("@xsi:type")
        orgs = as_list((m.get("organes") or {}).get("organeRef"))
        dfin = m.get("dateFin")
        # current political-group membership (GP organe, no end date)
        if dfin in (None, "", "null") and typ == "MandatSimple_Type":
            for org in orgs:
                if org in GROUP_UIDS:
                    group_uid = org
                    group_start = m.get("dateDebut")
        # parliamentary mandate → circonscription + start date + seat
        if typ == "MandatParlementaire_type":
            el = m.get("election") or {}
            lieu = el.get("lieu") or {}
            circo = {
                "region": lieu.get("region"),
                "departement": lieu.get("departement"),
                "numDepartement": lieu.get("numDepartement"),
                "numCirco": lieu.get("numCirco"),
            }
            mandate_start = m.get("dateDebut")
            ml = m.get("mandature") or {}
            place = ml.get("placeHemicycle")

    # socials / contact
    twitter = facebook = email = website = None
    for ad in as_list((a.get("adresses") or {}).get("adresse")):
        t = ad.get("typeLibelle")
        v = ad.get("valElec") or ad.get("valeurElectronique")
        if t == "Twitter": twitter = v
        elif t == "Facebook": facebook = v
        elif t == "Mèl": email = v
        elif t in ("Site internet", "Site Internet", "Page perso"):
            website = ad.get("valElec")

    deputes[uid] = {
        "uid": uid,
        "civ": ident.get("civ"),
        "prenom": ident.get("prenom"),
        "nom": ident.get("nom"),
        "trigramme": ident.get("trigramme"),
        "sexe": "F" if ident.get("civ") == "Mme" else "H",
        "dateNaissance": naiss.get("dateNais"),
        "villeNaissance": naiss.get("villeNais"),
        "profession": prof,
        "groupeUid": group_uid,
        "circo": circo,
        "mandatDebut": mandate_start,
        "placeHemicycle": place,
        "hatvp": a.get("uri_hatvp"),
        "twitter": twitter, "facebook": facebook, "email": email, "website": website,
        # vote tallies, filled below
        "nPour": 0, "nContre": 0, "nAbstention": 0, "nNonVotant": 0,
        "nPresent": 0, "nEligible": 0, "nLoyal": 0, "nGroupExpr": 0,
        "votes": [],   # recent votes (chronological, trimmed later)
    }

# fast lookup slug
def slugify(d):
    import unicodedata, re
    s = f"{d['prenom']}-{d['nom']}".lower()
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s
for d in deputes.values():
    d["slug"] = slugify(d)

# ---------------------------------------------------------------------------
# 3. Scrutins: per-deputy vote index + participation
# ---------------------------------------------------------------------------
files = glob.glob(os.path.join(SCR_DIR, "*.json"))
print("· processing %d scrutins …" % len(files), file=sys.stderr)

scrutins_meta = []   # for global recent-votes feed
POS = {"pours": "pour", "contres": "contre", "abstentions": "abstention", "nonVotants": "nonVotant"}

for i, f in enumerate(files):
    s = json.load(open(f))["scrutin"]
    date = s.get("dateScrutin")
    numero = s.get("numero")
    sort = (s.get("sort") or {}).get("code")
    titre = (s.get("titre") or (s.get("objet") or {}).get("libelle") or "").strip()
    synth = s.get("syntheseVote") or {}
    dec = synth.get("decompte") or {}
    meta = {
        "numero": numero, "date": date, "sort": sort, "titre": titre,
        "pour": dec.get("pour"), "contre": dec.get("contre"),
        "abstention": dec.get("abstentions"),
    }
    scrutins_meta.append(meta)

    groupes = (((s.get("ventilationVotes") or {}).get("organe") or {}).get("groupes") or {}).get("groupe")
    for g in as_list(groupes):
        dn = (g.get("vote") or {}).get("decompteNominatif") or {}
        # collect this group's expressed votes per position, then its majority line
        by_label = {}
        for key, label in POS.items():
            block = dn.get(key)
            by_label[label] = [v.get("acteurRef") for v in as_list(block.get("votant"))] if block else []
        expressed = {lab: by_label[lab] for lab in ("pour", "contre", "abstention")}
        majority = max(expressed, key=lambda lab: len(expressed[lab])) if any(expressed.values()) else None
        for label, arefs in by_label.items():
            for aref in arefs:
                d = deputes.get(aref)
                if not d: continue
                # only count scrutins on/after the deputy's mandate start
                if d["mandatDebut"] and date and date < d["mandatDebut"]:
                    continue
                d["nPresent"] += 1
                if label == "pour": d["nPour"] += 1
                elif label == "contre": d["nContre"] += 1
                elif label == "abstention": d["nAbstention"] += 1
                elif label == "nonVotant": d["nNonVotant"] += 1
                # group loyalty: did the deputy's expressed vote match the group's majority line?
                if label in ("pour", "contre", "abstention") and majority is not None:
                    d["nGroupExpr"] += 1
                    if label == majority: d["nLoyal"] += 1
                d["votes"].append({"numero": numero, "date": date, "position": label,
                                   "titre": titre, "sort": sort})
    if i % 1500 == 0:
        print("  … %d/%d" % (i, len(files)), file=sys.stderr)

# eligible = scrutins held on/after mandate start (fair denominator)
scrutins_meta.sort(key=lambda m: (m["date"] or "", m["numero"] or 0))
dates_sorted = [m["date"] for m in scrutins_meta if m["date"]]
total_scrutins = len(scrutins_meta)
import bisect
for d in deputes.values():
    if d["mandatDebut"]:
        idx = bisect.bisect_left(dates_sorted, d["mandatDebut"])
        d["nEligible"] = len(dates_sorted) - idx
    else:
        d["nEligible"] = total_scrutins
    d["nEligible"] = max(d["nEligible"], d["nPresent"])  # safety

# ---------------------------------------------------------------------------
# 4. Derived scores + write outputs
# ---------------------------------------------------------------------------
def pct(n, d):
    return round(100.0 * n / d, 1) if d else 0.0

light_list = []
game_pool = []   # deputies usable in the "Devine le député" game
for d in deputes.values():
    g = groups.get(d["groupeUid"]) or {"sigle": "NI", "libelle": "Non inscrit", "color": "#8a8f98"}
    d["presenceRate"] = pct(d["nPresent"], d["nEligible"])
    exprimes = d["nPour"] + d["nContre"] + d["nAbstention"]
    d["participationRate"] = pct(exprimes, d["nEligible"])
    d["nExprimes"] = exprimes
    # group loyalty rate (null when too few group votes to be meaningful)
    d["loyaltyRate"] = pct(d["nLoyal"], d["nGroupExpr"]) if d["nGroupExpr"] >= 20 else None
    # recent votes: last 25 chronologically
    d["votes"].sort(key=lambda v: (v["date"] or "", v["numero"] or 0), reverse=True)
    recent = d["votes"][:25]
    full = dict(d)
    full["groupe"] = g
    full["votesRecents"] = recent
    del full["votes"]; del full["groupeUid"]
    json.dump(full, open(os.path.join(OUT, "depute", d["uid"] + ".json"), "w"),
              ensure_ascii=False, separators=(",", ":"))
    light_list.append({
        "uid": d["uid"], "slug": d["slug"],
        "prenom": d["prenom"], "nom": d["nom"], "civ": d["civ"], "sexe": d["sexe"],
        "groupe": g["sigle"], "groupeColor": g["color"], "groupeLibelle": g["libelle"],
        "dep": (d["circo"] or {}).get("numDepartement"),
        "depNom": (d["circo"] or {}).get("departement"),
        "region": (d["circo"] or {}).get("region"),
        "circo": (d["circo"] or {}).get("numCirco"),
        "presence": d["presenceRate"], "participation": d["participationRate"],
        "nPresent": d["nPresent"], "nEligible": d["nEligible"],
        "loyalty": d["loyaltyRate"],
    })

    # game pool: need ≥3 recent "pour" and ≥3 recent "contre", a real group, enough activity
    pour3 = [{"titre": v["titre"], "date": v["date"]} for v in d["votes"] if v["position"] == "pour"][:3]
    contre3 = [{"titre": v["titre"], "date": v["date"]} for v in d["votes"] if v["position"] == "contre"][:3]
    if len(pour3) == 3 and len(contre3) == 3 and d["nPresent"] >= 20 and g["sigle"] != "NI":
        game_pool.append({
            "uid": d["uid"], "slug": d["slug"], "prenom": d["prenom"], "nom": d["nom"],
            "groupe": g["sigle"], "groupeColor": g["color"], "groupeLibelle": g["libelle"],
            "dep": (d["circo"] or {}).get("numDepartement"),
            "depNom": (d["circo"] or {}).get("departement"),
            "presence": d["presenceRate"], "pour": pour3, "contre": contre3,
        })

light_list.sort(key=lambda x: (x["nom"] or "", x["prenom"] or ""))
json.dump({"generatedAt": datetime.date.today().isoformat(),
           "legislature": 17, "totalScrutins": total_scrutins,
           "deputes": light_list},
          open(os.path.join(OUT, "deputes.json"), "w"),
          ensure_ascii=False, separators=(",", ":"))

# groups with aggregate stats
gstats = {}
for x in light_list:
    s = x["groupe"]
    a = gstats.setdefault(s, {"sigle": s, "libelle": x["groupeLibelle"],
                              "color": x["groupeColor"], "n": 0, "sumPres": 0.0, "sumPart": 0.0})
    a["n"] += 1; a["sumPres"] += x["presence"]; a["sumPart"] += x["participation"]
groupes_out = []
for a in gstats.values():
    a["presenceMoyenne"] = round(a["sumPres"] / a["n"], 1)
    a["participationMoyenne"] = round(a["sumPart"] / a["n"], 1)
    del a["sumPres"]; del a["sumPart"]
    groupes_out.append(a)
groupes_out.sort(key=lambda a: -a["n"])
json.dump({"groupes": groupes_out}, open(os.path.join(OUT, "groupes.json"), "w"),
          ensure_ascii=False, separators=(",", ":"))

# leaderboards
def top(key, rev, n=20):
    return sorted(light_list, key=lambda x: x[key], reverse=rev)[:n]
with_loyalty = [x for x in light_list if x["loyalty"] is not None]
stats = {
    "totalDeputes": len(light_list),
    "totalScrutins": total_scrutins,
    "presenceMoyenne": round(sum(x["presence"] for x in light_list) / len(light_list), 1),
    "plusAssidus": top("presence", True),
    "plusAbsents": top("presence", False),
    "plusActifs": top("participation", True),
    "plusLoyaux": sorted(with_loyalty, key=lambda x: -x["loyalty"])[:20],
    "plusFrondeurs": sorted(with_loyalty, key=lambda x: x["loyalty"])[:20],
    "groupesAbsents": sorted(groupes_out, key=lambda a: a["presenceMoyenne"]),
}
json.dump(stats, open(os.path.join(OUT, "stats.json"), "w"),
          ensure_ascii=False, separators=(",", ":"))

# recent scrutins feed (last 40)
json.dump({"scrutins": list(reversed(scrutins_meta[-40:]))},
          open(os.path.join(OUT, "scrutins.json"), "w"),
          ensure_ascii=False, separators=(",", ":"))

# "Devine le député" game pool
json.dump({"deputes": game_pool}, open(os.path.join(OUT, "game.json"), "w"),
          ensure_ascii=False, separators=(",", ":"))

print("✓ %d députés, %d scrutins, %d groupes, %d jouables → %s" %
      (len(light_list), total_scrutins, len(groupes_out), len(game_pool), OUT), file=sys.stderr)
