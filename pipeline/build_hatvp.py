#!/usr/bin/env python3
"""
HATVP enrichment (shared by FicheDéputé + FicheSénateur).

Parses the official HATVP open-data dump (declarations.xml — déclarations d'intérêts
of every French public official) and, for each person, extracts a FACTUAL summary of
their most recent "Déclaration d'intérêts" (DI): counts of declared professional
activities, financial holdings and leadership roles, plus consultant/volunteer flags.
No interpretation — every card links back to the official HATVP declaration.

Output: hatvp.json keyed by "NOM|PRENOM" (accent-stripped, uppercase). Written into
both projects' data/ dirs. The fiche matches by the deputy/senator's own name.

Source: https://www.hatvp.fr/livraison/merge/declarations.xml (licence Ouverte).
"""
import xml.etree.ElementTree as ET
import json, os, sys, unicodedata

SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "raw-hatvp", "declarations.xml")
OUT_DIRS = [
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "fichesenat", "data")),
]

def norm(s):
    s = unicodedata.normalize("NFKD", (s or "")).encode("ascii", "ignore").decode()
    return s.upper().strip()

def count(el, path):
    return len(el.findall(path))

def neant(el, tag):
    d = el.find(tag)
    return d is None or (d.findtext("neant") or "").strip().lower() == "true"

def parse_date(s):
    # "DD/MM/YYYY HH:MM:SS" → sortable "YYYYMMDDHHMMSS"
    try:
        d, t = (s or "").split(" ")
        dd, mm, yy = d.split("/")
        return yy + mm + dd + t.replace(":", "")
    except Exception:
        return ""

best = {}   # key -> (dateKey, summary)
n = 0
for ev, el in ET.iterparse(SRC, events=("end",)):
    if el.tag != "declaration":
        continue
    g = el.find("general")
    if g is not None:
        tid = (g.findtext("typeDeclaration/id") or "").strip()
        dec = g.find("declarant")
        # DIA = déclaration d'intérêts ET d'activités (filed by MPs & senators);
        # DI = déclaration d'intérêts (other officials). Keep both, match by name.
        if tid in ("DI", "DIA") and dec is not None:
            key = norm(dec.findtext("nom")) + "|" + norm(dec.findtext("prenom"))
            dk = parse_date(el.findtext("dateDepot"))
            if key not in best or dk > best[key][0]:
                summary = {
                    "activitesProf": count(el, "activProfCinqDerniereDto/items/items"),
                    "participationsFinancieres": count(el, "participationFinanciereDto/items/items"),
                    "participationsDirigeant": count(el, "participationDirigeantDto/items/items"),
                    "consultant": not neant(el, "activConsultantDto"),
                    "activiteConjoint": not neant(el, "activProfConjointDto"),
                    "benevole": not neant(el, "fonctionBenevoleDto"),
                    "dateDepot": (el.findtext("dateDepot") or "")[:10],
                    "url": "https://www.hatvp.fr/pages_nominatives/" +
                           norm(dec.findtext("nom")).lower().replace(" ", "-") + "-" +
                           norm(dec.findtext("prenom")).lower().replace(" ", "-"),
                }
                best[key] = (dk, summary)
    n += 1
    el.clear()

out = {k: v[1] for k, v in best.items()}
for d in OUT_DIRS:
    if os.path.isdir(d):
        json.dump(out, open(os.path.join(d, "hatvp.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        print("· wrote %s (%d DI)" % (os.path.join(d, "hatvp.json"), len(out)), file=sys.stderr)
print("✓ %d déclarations parsées, %d déclarations d'intérêts retenues" % (n, len(out)), file=sys.stderr)
