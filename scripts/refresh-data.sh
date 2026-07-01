#!/usr/bin/env bash
# Downloads the latest official Assemblée nationale open data (17th legislature)
# and rebuilds the served JSON. Run periodically (e.g. daily cron) to keep fiches fresh.
set -euo pipefail
cd "$(dirname "$0")/.."
BASE="https://data.assemblee-nationale.fr/static/openData/repository/17"
DEP="$BASE/amo/deputes_actifs_mandats_actifs_organes/AMO10_deputes_actifs_mandats_actifs_organes.json.zip"
SCR="$BASE/loi/scrutins/Scrutins.json.zip"
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

echo "· rebuilding data …"
python3 pipeline/build_data.py
echo "✓ data refreshed"
