#!/usr/bin/env python3
"""
Legislative-activity enrichment → data/activite.json (per-deputy counts).

Aggregates official Assemblée nationale open data (licence Ouverte), 17th legislature:
  - Questions au gouvernement (QAG)      raw-questions/qag/**/*.json
  - Questions écrites                     raw-questions/ecrites/**/*.json
  - Amendements (OPTIONAL — 289 MB)       raw-amendements/**/*.json
    (signés + adoptés; skipped cleanly if the dir is absent)

Author link in every file: auteur.identite.acteurRef == deputy uid.
Output keyed by uid: {qag, questionsEcrites, amendements, amendementsAdoptes}.
"""
import json, glob, os, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, "..", "data", "activite.json"))

def author_ref(obj):
    a = (obj.get("auteur") or {})
    return ((a.get("identite") or {}).get("acteurRef"))

def scan_questions(subdir, field, acc):
    root = os.path.join(HERE, "raw-questions", subdir)
    n = 0
    for f in glob.glob(os.path.join(root, "**", "*.json"), recursive=True):
        try:
            q = json.load(open(f)).get("question", {})
        except Exception:
            continue
        ref = author_ref(q)
        if ref:
            acc[ref][field] += 1
            n += 1
    print("· %s: %d files → attributed" % (subdir, n), file=sys.stderr)

def scan_amendements(acc):
    root = os.path.join(HERE, "raw-amendements")
    if not os.path.isdir(root):
        print("· amendements: dir absent — skipped", file=sys.stderr)
        return False
    n = 0
    for f in glob.glob(os.path.join(root, "**", "*.json"), recursive=True):
        try:
            a = json.load(open(f)).get("amendement", {})
        except Exception:
            continue
        # individual-deputy author lives in signataires.auteur.acteurRef
        auteur = ((a.get("signataires") or {}).get("auteur") or {})
        ref = auteur.get("acteurRef")
        if not ref or not isinstance(ref, str):
            continue
        acc[ref]["amendements"] += 1
        sort = ((a.get("cycleDeVie") or {}).get("sort") or "")
        if isinstance(sort, str) and "adopt" in sort.lower():
            acc[ref]["amendementsAdoptes"] += 1
        n += 1
    print("· amendements: %d attributed" % n, file=sys.stderr)
    return True

acc = collections.defaultdict(lambda: {"qag": 0, "questionsEcrites": 0,
                                        "amendements": 0, "amendementsAdoptes": 0})
scan_questions("qag", "qag", acc)
scan_questions("ecrites", "questionsEcrites", acc)
has_amdt = scan_amendements(acc)

out = {"hasAmendements": has_amdt, "byUid": {k: v for k, v in acc.items()}}
json.dump(out, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
print("✓ %d députés avec activité → %s" % (len(acc), OUT), file=sys.stderr)
