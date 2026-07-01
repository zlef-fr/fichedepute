#!/usr/bin/env python3
"""
2024 election result per constituency → data/elections.json.

Official Ministère de l'Intérieur "résultats définitifs par circonscription"
(data.gouv.fr, licence Ouverte), both rounds. For each of the 577 constituencies
we keep the elected candidate's score (% suffrages exprimés) and the turnout
(% votants). A seat won outright in round 1 isn't in the round-2 file, so we merge:
round-2 winner if present, else the round-1 winner.

Output keyed by "<dept>-<circo>" (dept leading-zeros stripped, keeps 2A/2B/971…):
{ nom, prenom, nuance, scoreExprimes, turnout, tour }. The pipeline attaches it to
each deputy by their (numDepartement, numCirco).
"""
import csv, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw-elections")
OUT = os.path.abspath(os.path.join(HERE, "..", "data", "elections.json"))
T2 = os.path.join(RAW, "circo-t2.csv")
T1 = os.path.join(RAW, "circo-t1.csv")

def pctf(s):
    s = (s or "").replace(",", ".").replace("%", "").strip()
    try: return round(float(s), 2)
    except ValueError: return None

def norm_dep(d):
    d = d.strip()
    return str(int(d)) if d.isdigit() else d

def parse(path, tour):
    out = {}
    if not os.path.exists(path):
        return out
    rows = list(csv.reader(open(path, encoding="utf-8"), delimiter=";"))
    hdr = [h.strip().strip('"') for h in rows[0]]
    ci = hdr.index("Code circonscription législative")
    vti = hdr.index("% Votants")
    elu_cols = [i for i, h in enumerate(hdr) if h.startswith("Elu")]
    for r in rows[1:]:
        code = r[ci].strip()
        if len(code) < 3:
            continue
        key = norm_dep(code[:-2]) + "-" + str(int(code[-2:]))
        for e in elu_cols:
            if e < len(r) and r[e].strip().lower() == "élu":
                out[key] = {
                    "nom": r[e - 6].strip(), "prenom": r[e - 5].strip(),
                    "nuance": r[e - 7].strip(), "scoreExprimes": pctf(r[e - 1]),
                    "turnout": pctf(r[vti]), "tour": tour,
                }
                break
    return out

t2 = parse(T2, 2)
t1 = parse(T1, 1)
# round-2 is decisive where it exists; round-1 fills the outright-win seats
elec = dict(t1)
elec.update(t2)
json.dump({"byCirco": elec, "year": 2024, "source": "Ministère de l'Intérieur (data.gouv.fr)"},
          open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
print("✓ %d circonscriptions (%d T2 + %d T1) → %s" % (len(elec), len(t2), len(t1), OUT), file=sys.stderr)
