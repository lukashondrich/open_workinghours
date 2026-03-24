#!/usr/bin/env python3
"""Convert german_hospitals.csv into per-state JSON files for the mobile app.

Usage:
    python scripts/convert-hospitals-csv.py

Output:
    mobile-app/src/lib/taxonomy/hospitals/*.json  (one per state code)
"""

import csv
import json
import os
from pathlib import Path

# State name (CSV) → state code (app)
STATE_NAME_TO_CODE = {
    'Baden-Württemberg': 'BW',
    'Bayern': 'BY',
    'Berlin': 'BE',
    'Brandenburg': 'BB',
    'Bremen': 'HB',
    'Hamburg': 'HH',
    'Hessen': 'HE',
    'Mecklenburg-Vorpommern': 'MV',
    'Niedersachsen': 'NI',
    'Nordrhein-Westfalen': 'NW',
    'Rheinland-Pfalz': 'RP',
    'Saarland': 'SL',
    'Sachsen': 'SN',
    'Sachsen-Anhalt': 'ST',
    'Schleswig-Holstein': 'SH',
    'Thüringen': 'TH',
}

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / 'datasets' / 'german_hospitals' / 'output' / 'german_hospitals.csv'
OUT_DIR = ROOT / 'mobile-app' / 'src' / 'lib' / 'taxonomy' / 'hospitals'


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Collect hospitals by state code
    by_state: dict[str, list] = {code: [] for code in STATE_NAME_TO_CODE.values()}
    skipped = []

    with open(CSV_PATH, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for idx, row in enumerate(reader, start=1):
            name = row['name'].strip()
            state_name = row['state'].strip()
            lat = row['lat'].strip()
            lon = row['lon'].strip()
            city = row['city'].strip()

            # Skip rows with no name or no state
            if not name or not state_name:
                skipped.append((idx, name or '(empty)', state_name or '(empty)'))
                continue

            state_code = STATE_NAME_TO_CODE.get(state_name)
            if not state_code:
                skipped.append((idx, name, state_name))
                continue

            entry = {
                'id': idx,
                'name': name,
                'lat': round(float(lat), 6) if lat else None,
                'lon': round(float(lon), 6) if lon else None,
                'city': city,
            }
            by_state[state_code].append(entry)

    # Write per-state JSON files
    total = 0
    for code, hospitals in sorted(by_state.items()):
        # Sort by name within each state
        hospitals.sort(key=lambda h: h['name'].lower())
        out_path = OUT_DIR / f'{code}.json'
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(hospitals, f, ensure_ascii=False, indent=None, separators=(',', ':'))
            f.write('\n')
        total += len(hospitals)
        print(f'  {code}: {len(hospitals)} hospitals')

    print(f'\nTotal: {total} hospitals in {len(by_state)} files')
    if skipped:
        print(f'Skipped {len(skipped)} rows:')
        for idx, name, state in skipped:
            print(f'  Row {idx}: name="{name}", state="{state}"')


if __name__ == '__main__':
    main()
