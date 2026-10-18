#!/usr/bin/env bash
# One-time fetch of the Ontario OSM extract used by the self-hosted geo
# services (Nominatim for address autocomplete, OSRM for routing). Both
# services are built from this single file so Ontario-only coverage and the
# one-time download are shared instead of duplicated.
#
# Safe to re-run: skips the download if the file already exists. Delete
# data/osm/ontario-latest.osm.pbf to force a refresh.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$REPO_ROOT/data/osm"
DEST="$DATA_DIR/ontario-latest.osm.pbf"
URL="https://download.geofabrik.de/north-america/canada/ontario-latest.osm.pbf"

mkdir -p "$DATA_DIR"

if [ -f "$DEST" ]; then
  echo "[fetch-ontario-osm] already present: $DEST (delete it to re-fetch)"
  exit 0
fi

echo "[fetch-ontario-osm] downloading Ontario extract from Geofabrik..."
echo "[fetch-ontario-osm] $URL"
curl -fL --progress-bar -o "$DEST.part" "$URL"
mv "$DEST.part" "$DEST"
echo "[fetch-ontario-osm] saved to $DEST"
