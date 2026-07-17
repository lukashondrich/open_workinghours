#!/usr/bin/env python3
"""Augment german_hospitals.csv with hospitals from OpenStreetMap.

Why this exists: the original builder (build_german_hospitals_dataset.py) only
wrote register rows it could MATCH to an OSM object — unmatched rows were
silently dropped, leaving ~900 German hospitals missing (e.g. Alexianer
St. Hedwig-Krankenhaus Berlin). This script goes the other way: it keeps every
existing row untouched and appends OSM hospitals we don't have yet.

ID STABILITY (critical): users store hospital_ref_id. Historically both the
backend and the mobile converter derived id = CSV row number, so row order was
load-bearing. This script:
  1. adds an explicit `id` column, assigning existing rows their historical
     row numbers (identical to what enumerate(start=1) produced),
  2. never reorders or deletes existing rows,
  3. appends new hospitals with ids above the previous maximum.
The backend loader and mobile converter must read the explicit column
(fallback: row number) — see backend/app/routers/taxonomy.py and
scripts/convert-hospitals-csv.py.

Also repairs rows whose coordinates fall outside their claimed state (bad
fuzzy matches in the original build) when a confident same-state OSM name
match exists.

Data: © OpenStreetMap contributors, ODbL. https://www.openstreetmap.org/copyright

Usage:
    python3 augment_hospitals_from_osm.py            # full run (16 Overpass queries)
    python3 augment_hospitals_from_osm.py --dry-run  # report only, no writes
"""
from __future__ import annotations

import argparse
import csv
import difflib
import json
import math
import re
import sys
import time
import urllib.request
from pathlib import Path

CSV_PATH = Path(__file__).parent / "output" / "german_hospitals.csv"
# Tried in order per attempt — the main instance 504s on large states under load.
OVERPASS_URLS = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
]
USER_AGENT = "OpenWorkingHours-DatasetBuilder/1.0 (openworkinghours.org; hospital directory refresh)"

STATES = {
    "DE-BW": "Baden-Württemberg", "DE-BY": "Bayern", "DE-BE": "Berlin",
    "DE-BB": "Brandenburg", "DE-HB": "Bremen", "DE-HH": "Hamburg",
    "DE-HE": "Hessen", "DE-MV": "Mecklenburg-Vorpommern", "DE-NI": "Niedersachsen",
    "DE-NW": "Nordrhein-Westfalen", "DE-RP": "Rheinland-Pfalz", "DE-SL": "Saarland",
    "DE-SN": "Sachsen", "DE-ST": "Sachsen-Anhalt", "DE-SH": "Schleswig-Holstein",
    "DE-TH": "Thüringen",
}

# Rough bounding boxes (lat_min, lat_max, lon_min, lon_max) to detect
# existing rows whose coordinates cannot be in their claimed state.
STATE_BBOX = {
    "Baden-Württemberg": (47.5, 49.8, 7.5, 10.5),
    "Bayern": (47.2, 50.6, 8.9, 13.9),
    "Berlin": (52.3, 52.7, 13.0, 13.8),
    "Brandenburg": (51.3, 53.6, 11.2, 14.8),
    "Bremen": (53.0, 53.6, 8.5, 9.0),
    "Hamburg": (53.4, 53.8, 9.7, 10.4),
    "Hessen": (49.4, 51.7, 7.7, 10.3),
    "Mecklenburg-Vorpommern": (53.1, 54.7, 10.5, 14.5),
    "Niedersachsen": (51.3, 54.0, 6.6, 11.6),
    "Nordrhein-Westfalen": (50.3, 52.6, 5.8, 9.5),
    "Rheinland-Pfalz": (48.9, 51.0, 6.1, 8.5),
    "Saarland": (49.1, 49.7, 6.3, 7.5),
    "Sachsen": (50.1, 51.7, 11.8, 15.1),
    "Sachsen-Anhalt": (50.9, 53.1, 10.5, 13.2),
    "Schleswig-Holstein": (53.3, 55.1, 7.8, 11.4),
    "Thüringen": (50.2, 51.7, 9.8, 12.7),
}

NON_HOSPITAL_NAME = re.compile(r"tierklinik|tierärztlich|veterinär", re.IGNORECASE)


def norm_name(name: str) -> str:
    s = name.casefold()
    s = re.sub(r"\b(ggmbh|gmbh|ag|e\.? ?v\.?|kdör)\b", "", s)
    s = re.sub(r"[^a-z0-9äöüß]+", " ", s)
    return " ".join(s.split())


def haversine_m(lat1, lon1, lat2, lon2) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def overpass_state(iso: str, attempt: int = 0) -> list[dict]:
    query = (
        f'[out:json][timeout:180];area["ISO3166-2"="{iso}"]->.a;'
        f'(nwr["amenity"="hospital"](area.a);nwr["healthcare"="hospital"](area.a););'
        f"out center tags;"
    )
    url = OVERPASS_URLS[attempt % len(OVERPASS_URLS)]
    req = urllib.request.Request(
        url,
        data=("data=" + urllib.parse.quote(query)).encode(),
        headers={"User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=200) as resp:
        return json.load(resp)["elements"]


def element_coords(el: dict):
    if "lat" in el:
        return el["lat"], el["lon"]
    c = el.get("center")
    if c:
        return c["lat"], c["lon"]
    return None


def domain_from(tags: dict) -> str:
    for key in ("contact:email", "email"):
        m = re.search(r"@([A-Za-z0-9._-]+)", tags.get(key, ""))
        if m:
            return m.group(1).lower()
    for key in ("contact:website", "website"):
        url = tags.get(key, "")
        m = re.search(r"^(?:\w+://)?(?:www\.)?([A-Za-z0-9.-]+)", url)
        if m and "." in m.group(1):
            return m.group(1).lower()
    return ""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    with open(CSV_PATH, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    # Assign historical ids (row number, start=1) unless already explicit.
    has_id_col = "id" in rows[0]
    for idx, row in enumerate(rows, start=1):
        row["id"] = int(row["id"]) if has_id_col else idx
    next_id = max(r["id"] for r in rows) + 1
    print(f"Loaded {len(rows)} existing rows (explicit id column: {has_id_col})")

    by_state: dict[str, list[dict]] = {}
    for r in rows:
        by_state.setdefault(r["state"], []).append(r)

    added, repaired, skipped_nonhospital = [], [], 0

    for iso, state_name in STATES.items():
        for attempt in range(4):
            try:
                elements = overpass_state(iso, attempt)
                break
            except Exception as exc:  # noqa: BLE001 - retry then surface
                print(f"  {state_name}: attempt {attempt + 1} failed ({exc}); retrying…", file=sys.stderr)
                time.sleep(15)
        else:
            print(f"  {state_name}: FAILED after retries — state skipped, rerun later", file=sys.stderr)
            continue

        osm = []
        seen_names = set()
        for el in elements:
            tags = el.get("tags", {})
            name = tags.get("name", "").strip()
            coords = element_coords(el)
            if not name or not coords:
                continue
            if NON_HOSPITAL_NAME.search(name):
                skipped_nonhospital += 1
                continue
            key = norm_name(name)
            if key in seen_names:  # node+way duplicates of the same hospital
                continue
            seen_names.add(key)
            osm.append({"name": name, "norm": key, "lat": coords[0], "lon": coords[1], "tags": tags})

        existing = by_state.get(state_name, [])
        existing_norms = {norm_name(r["name"]): r for r in existing}

        new_in_state = 0
        for hosp in osm:
            # Already present? (a) close name match, (b) within 400 m of any row
            name_hit = existing_norms.get(hosp["norm"])
            if not name_hit:
                close = difflib.get_close_matches(hosp["norm"], existing_norms.keys(), n=1, cutoff=0.88)
                name_hit = existing_norms.get(close[0]) if close else None
            if name_hit:
                continue
            if any(
                haversine_m(hosp["lat"], hosp["lon"], float(r["lat"]), float(r["lon"])) < 400
                for r in existing
            ):
                continue

            tags = hosp["tags"]
            new_row = {
                "id": next_id,
                "name": hosp["name"],
                "lat": round(hosp["lat"], 7),
                "lon": round(hosp["lon"], 7),
                "staff_email_domain": domain_from(tags),
                "website": tags.get("contact:website", tags.get("website", "")),
                "street": tags.get("addr:street", ""),
                "postcode": tags.get("addr:postcode", ""),
                "city": tags.get("addr:city", ""),
                "state": state_name,
            }
            next_id += 1
            rows.append(new_row)
            existing.append(new_row)
            existing_norms[hosp["norm"]] = new_row
            added.append(f"{state_name}: {hosp['name']}")
            new_in_state += 1

        # Repair existing rows whose coords are outside the state bbox.
        bbox = STATE_BBOX[state_name]
        osm_by_norm = {h["norm"]: h for h in osm}
        for r in existing:
            lat, lon = float(r["lat"]), float(r["lon"])
            if bbox[0] <= lat <= bbox[1] and bbox[2] <= lon <= bbox[3]:
                continue
            candidates = difflib.get_close_matches(norm_name(r["name"]), osm_by_norm.keys(), n=1, cutoff=0.85)
            if candidates:
                fix = osm_by_norm[candidates[0]]
                repaired.append(f"{state_name}: {r['name']} ({lat},{lon}) -> ({fix['lat']},{fix['lon']})")
                r["lat"], r["lon"] = round(fix["lat"], 7), round(fix["lon"], 7)

        print(f"  {state_name}: {len(osm)} OSM hospitals, +{new_in_state} new (total now {len(existing)})")
        time.sleep(10)

    print(f"\nAdded {len(added)}, repaired coords on {len(repaired)}, "
          f"skipped {skipped_nonhospital} veterinary, final total {len(rows)}")
    for line in repaired:
        print(f"  repaired: {line}")

    if args.dry_run:
        print("(dry run — nothing written)")
        return

    fieldnames = ["id", "name", "lat", "lon", "staff_email_domain",
                  "website", "street", "postcode", "city", "state"]
    with open(CSV_PATH, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            writer.writerow({k: r.get(k, "") for k in fieldnames})
    print(f"Wrote {len(rows)} rows to {CSV_PATH}")


if __name__ == "__main__":
    main()
