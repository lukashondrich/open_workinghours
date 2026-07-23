# German Hospitals Dataset Builder

This tool creates a CSV of German hospitals with **name, latitude, longitude, staff_email_domain, website, street, postcode, city, state** by merging:
- an official Excel register that you supply locally, and
- OpenStreetMap geometry fetched through the Overpass API.

## Quickstart

```bash
python3 -m venv .venv
source .venv/bin/activate  # Windows PowerShell: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python build_german_hospitals_dataset.py --excel /path/to/Krankenhausverzeichnis.xlsx --out ./output

# If your workbook has multiple sheets or a header row before the column names
python build_german_hospitals_dataset.py --excel /path/to/file.xlsx --sheet " KHV_2023" --header-row 2
```

The script queries Overpass (default: https://overpass-api.de/api/interpreter) for `amenity=hospital` and `healthcare=hospital` within Germany, matches the results to the official register first by email/website domain, then by fuzzy name + locality, and finally writes `german_hospitals.csv` into the selected `--out` directory (default `./output`).


---

## Maintenance (since 2026-07): augment, don't rebuild

The original builder above is **match-or-drop**: register rows without an OSM
match were silently discarded, which is how ~900 German hospitals went missing
from the first dataset. Do not re-run it against the production CSV.

The maintained path is **`augment_hospitals_from_osm.py`**:

```bash
python3 augment_hospitals_from_osm.py --dry-run   # report only
python3 augment_hospitals_from_osm.py             # 16 Overpass queries (one per state)
python3 ../../scripts/convert-hospitals-csv.py    # regenerate mobile per-state JSONs
```

Guarantees:
- **Append-only with explicit stable ids** — users store `hospital_ref_id`;
  existing rows are never reordered, deleted, or re-identified.
- Idempotent: re-running never duplicates (name + 400 m proximity matching);
  safe to re-run for states that failed on Overpass timeouts.
- Repairs coordinates that fall outside the row's claimed state when a
  confident same-state OSM name match exists.

After updating: ship the JSONs in the next app release (they are bundled — no
OTA), and redeploy the backend so `/taxonomy` serves the new CSV (mounted via
docker-compose volume; the build context does not include this directory).

Free-text hospitals entered by users via "My hospital isn't listed" can be
found with: `hospital_ref_id IS NULL AND hospital_id != 'not_specified'` —
add them here, regenerate, ship.

Data: © OpenStreetMap contributors, ODbL — https://www.openstreetmap.org/copyright
