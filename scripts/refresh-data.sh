#!/usr/bin/env bash
# Downloads the latest official Assemblée nationale open data (17th legislature)
# and rebuilds the served JSON. Run periodically (e.g. daily cron) to keep fiches fresh.
set -euo pipefail
cd "$(dirname "$0")/.."
BASE="https://data.assemblee-nationale.fr/static/openData/repository/17"
DEP="$BASE/amo/deputes_actifs_mandats_actifs_organes/AMO10_deputes_actifs_mandats_actifs_organes.json.zip"
SCR="$BASE/loi/scrutins/Scrutins.json.zip"
QAG="$BASE/questions/questions_gouvernement/Questions_gouvernement.json.zip"
QE="$BASE/questions/questions_ecrites/Questions_ecrites.json.zip"
AMDT="$BASE/loi/amendements_div_legis/Amendements.json.zip"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "· downloading deputes …"
curl -fsSL -o "$TMP/dep.zip" "$DEP"
echo "· downloading scrutins …"
curl -fsSL -o "$TMP/scr.zip" "$SCR"

rm -rf pipeline/raw-deputes pipeline/raw-scrutins
mkdir -p pipeline/raw-deputes pipeline/raw-scrutins
unzip -q "$TMP/dep.zip" -d pipeline/raw-deputes
unzip -q "$TMP/scr.zip" -d pipeline/raw-scrutins

echo "· rebuilding core data …"
python3 pipeline/build_data.py

echo "· downloading questions (QAG + écrites) …"
curl -fsSL -o "$TMP/qag.zip" "$QAG"
curl -fsSL -o "$TMP/qe.zip" "$QE"
rm -rf pipeline/raw-questions
mkdir -p pipeline/raw-questions/qag pipeline/raw-questions/ecrites
unzip -q "$TMP/qag.zip" -d pipeline/raw-questions/qag
unzip -q "$TMP/qe.zip" -d pipeline/raw-questions/ecrites

# Amendements is heavy (~289 MB). Set WITH_AMENDEMENTS=1 to include them.
if [ "${WITH_AMENDEMENTS:-0}" = "1" ]; then
  echo "· downloading amendements (~289 MB) …"
  curl -fsSL -o "$TMP/amdt.zip" "$AMDT"
  rm -rf pipeline/raw-amendements
  mkdir -p pipeline/raw-amendements
  unzip -q "$TMP/amdt.zip" -d pipeline/raw-amendements
fi

echo "· rebuilding activity data …"
python3 pipeline/build_activite.py
# HATVP declarations (~84 MB XML, both chambers). WITH_HATVP=1 to refresh.
if [ "${WITH_HATVP:-0}" = "1" ]; then
  echo "· downloading HATVP declarations …"
  mkdir -p pipeline/raw-hatvp
  curl -fsSL --http1.1 -o pipeline/raw-hatvp/declarations.xml "https://www.hatvp.fr/livraison/merge/declarations.xml"
  python3 pipeline/build_hatvp.py   # writes hatvp.json into BOTH fichedepute + fichesenat data/
fi
# 2024 election results (Ministère de l'Intérieur, ~150 KB each round) — always fetched
echo "· downloading 2024 election results …"
mkdir -p pipeline/raw-elections
curl -fsSL -o pipeline/raw-elections/circo-t2.csv "https://static.data.gouv.fr/resources/elections-legislatives-des-30-juin-et-7-juillet-2024-resultats-definitifs-du-2nd-tour/20240710-170728/resultats-definitifs-par-circonscription.csv"
curl -fsSL -o pipeline/raw-elections/circo-t1.csv "https://static.data.gouv.fr/resources/elections-legislatives-des-30-juin-et-7-juillet-2024-resultats-definitifs-du-1er-tour/20240710-171413/resultats-definitifs-par-circonscriptions-legislatives.csv"
python3 pipeline/build_elections.py
echo "✓ data refreshed"
