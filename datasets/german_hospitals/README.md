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
