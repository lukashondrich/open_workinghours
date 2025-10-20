#!/usr/bin/env python3
"""
Build a unified dataset of German hospitals with:
- name
- latitude, longitude
- staff_email_domain (observed organizational email domain)
- website
- address fields: street, postcode, city, state

DATA INPUTS (you provide one file path):
1) Official hospital register Excel (e.g., "Krankenhausverzeichnis 2023").
   The file typically includes name, address, email, website.
   Column headers vary; this script finds likely matches heuristically.

DATA FROM WEB (automatic):
2) Coordinates from OpenStreetMap via Overpass API (Germany-wide, hospitals).
   We query both amenity=hospital and healthcare=hospital and fetch nodes/ways/relations.
   For ways/relations we use the 'center' node returned by Overpass.

OUTPUT:
- A CSV at ./output/german_hospitals.csv

USAGE (Linux/macOS/WSL/PowerShell):
1) Create a clean virtual env.
   Linux/macOS:
       python3 -m venv .venv
       source .venv/bin/activate
   Windows PowerShell:
       py -3 -m venv .venv
       .\\.venv\\Scripts\\Activate.ps1

2) Install deps:
       pip install -r requirements.txt

3) Put the Excel file somewhere on disk, then run:
       python build_german_hospitals_dataset.py --excel /path/to/Krankenhausverzeichnis.xlsx

   Optional: set an output dir and Overpass endpoint (defaults are fine):
       python build_german_hospitals_dataset.py --excel /path/to/file.xlsx --out ./output --overpass https://overpass-api.de/api/interpreter

   If the workbook has multiple sheets or header rows, you can guide the reader:
       python build_german_hospitals_dataset.py --excel /path/to/file.xlsx --sheet \" KHV_2023\" --header-row 2

NOTES:
- We match in two passes:
  A) by domain: registrable website/email domain equality
  B) by name + (postcode or city): fuzzy name similarity >= 90 and city or postcode match.
- We keep the observed email domain as staff_email_domain when present; else fall back to the website's registrable domain.
- The Overpass query can take time; consider running off-peak or swapping to another public endpoint if throttled.

Terminology tip:
- Instead of "email domain of their staff," data dictionaries often say "organizational email domain" or "staff email domain (observed)".
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import requests
import tldextract
from rapidfuzz import fuzz

HEADER_CANDIDATES = {
    "name": [
        "name",
        "krankenhaus",
        "krankenhausname",
        "einrichtung",
        "einrichtungsname",
        "bezeichnung",
        "hausname",
    ],
    "email": [
        "email",
        "e-mail",
        "e_mail",
        "mail",
        "kontakt_email",
        "kontakt (email)",
        "kontakt-e-mail",
    ],
    "website": [
        "website",
        "webseite",
        "homepage",
        "url",
        "internet",
    ],
    "street": [
        "straße",
        "strasse",
        "str.",
        "anschrift",
        "adresse",
        "hausanschrift",
    ],
    "postcode": [
        "plz",
        "postleitzahl",
    ],
    "city": [
        "adresse_ort",
        "ort",
        "stadt",
        "gemeinde",
    ],
    "state": [
        "bundesland",
        "land",
    ],
}

STATE_CODE_MAP = {
    "01": "Schleswig-Holstein",
    "02": "Hamburg",
    "03": "Niedersachsen",
    "04": "Bremen",
    "05": "Nordrhein-Westfalen",
    "06": "Hessen",
    "07": "Rheinland-Pfalz",
    "08": "Baden-Württemberg",
    "09": "Bayern",
    "10": "Saarland",
    "11": "Berlin",
    "12": "Brandenburg",
    "13": "Mecklenburg-Vorpommern",
    "14": "Sachsen",
    "15": "Sachsen-Anhalt",
    "16": "Thüringen",
}


def normalize_col(name: Any) -> str:
    if not isinstance(name, str):
        name = str(name)
    normalized = name.strip().lower()
    normalized = normalized.replace("\n", " ")
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized


def find_best_column(df: pd.DataFrame, keys: List[str]) -> Optional[str]:
    norm_map = {col: normalize_col(col) for col in df.columns}
    for key in keys:
        for original, normalized in norm_map.items():
            if key == normalized or key in normalized:
                return original
    return None


def map_columns(df: pd.DataFrame) -> Dict[str, Optional[str]]:
    mapping: Dict[str, Optional[str]] = {}
    for logical, candidates in HEADER_CANDIDATES.items():
        mapping[logical] = find_best_column(df, candidates)
    return mapping


def mapping_has_core_fields(mapping: Dict[str, Optional[str]]) -> bool:
    if not mapping.get("name"):
        return False
    for key in ("city", "postcode", "street", "email", "website"):
        if mapping.get(key):
            return True
    return False


def detect_header_row(preview: pd.DataFrame) -> Optional[int]:
    if preview.empty:
        return None
    for idx in range(len(preview)):
        row = preview.iloc[idx]
        if row.notna().sum() == 0:
            continue
        normalized_cells = [
            normalize_col(str(value))
            for value in row
            if isinstance(value, str) and normalize_col(str(value))
        ]
        if not normalized_cells:
            continue
        matched_logicals = 0
        for candidates in HEADER_CANDIDATES.values():
            cand_match = False
            for candidate in candidates:
                candidate_norm = normalize_col(candidate)
                if any(
                    candidate_norm == cell or candidate_norm in cell
                    for cell in normalized_cells
                ):
                    cand_match = True
                    break
            if cand_match:
                matched_logicals += 1
        if matched_logicals >= 2:
            return idx
    return None


def read_excel_safely(
    path: str, sheet_name: Optional[str] = None, header_row: Optional[int] = None
) -> pd.DataFrame:
    read_kwargs: Dict[str, Any] = {"engine": "openpyxl"}
    if sheet_name is not None:
        read_kwargs["sheet_name"] = sheet_name
    if header_row is not None:
        read_kwargs["header"] = header_row
        return pd.read_excel(path, **read_kwargs)

    df = pd.read_excel(path, **read_kwargs)
    if mapping_has_core_fields(map_columns(df)):
        return df

    with pd.ExcelFile(path, engine="openpyxl") as workbook:
        sheet_candidates = [sheet_name] if sheet_name else workbook.sheet_names
        for candidate_sheet in sheet_candidates:
            preview = workbook.parse(candidate_sheet, header=None, nrows=50)
            header_guess = detect_header_row(preview)
            if header_guess is None:
                continue
            df_candidate = workbook.parse(candidate_sheet, header=header_guess)
            if mapping_has_core_fields(map_columns(df_candidate)):
                return df_candidate

    return df


def registrable_domain_from_url(url: str) -> Optional[str]:
    if not isinstance(url, str) or not url.strip():
        return None
    candidate = url.strip()
    if not re.match(r"^\w+://", candidate):
        candidate = f"http://{candidate}"
    try:
        extracted = tldextract.extract(candidate)
        if not extracted.domain:
            return None
        return ".".join(part for part in [extracted.domain, extracted.suffix] if part)
    except Exception:  # pragma: no cover - parse errors are unlikely but safe to guard
        return None


def registrable_domain_from_email(email: str) -> Optional[str]:
    if not isinstance(email, str) or not email.strip():
        return None
    match = re.search(r"@([A-Za-z0-9._-]+)", email)
    if not match:
        return None
    host = match.group(1)
    try:
        extracted = tldextract.extract(host)
        if not extracted.domain:
            return None
        return ".".join(part for part in [extracted.domain, extracted.suffix] if part)
    except Exception:  # pragma: no cover
        return None


def clean_str(value: Any) -> str:
    """Return a trimmed string or empty value for NA entries."""
    if pd.isna(value):
        return ""
    if isinstance(value, float):
        if value.is_integer():
            return str(int(value))
        return str(value).strip()
    if isinstance(value, int):
        return str(value)
    return str(value).strip()


def coalesce(*values: Any) -> Optional[Any]:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value
        if value is not None and not (isinstance(value, float) and pd.isna(value)):
            return value
    return None


def normalize_postcode(value: str) -> str:
    value = value.strip()
    if not value:
        return ""
    if re.fullmatch(r"\d+", value):
        return value.zfill(5)
    return value


def normalize_state(value: str) -> str:
    value = value.strip()
    if not value:
        return ""
    if re.fullmatch(r"\d+", value):
        return STATE_CODE_MAP.get(value.zfill(2), value.zfill(2))
    upper = value.lower()
    for code, name in STATE_CODE_MAP.items():
        if upper == name.lower():
            return name
    return value


# ----------------------------
# Overpass (OSM) fetch
# ----------------------------

OVERPASS_QUERY = r"""
[out:json][timeout:1800];
area["ISO3166-1"="DE"][admin_level=2]->.de;
(
  node["amenity"="hospital"](area.de);
  way["amenity"="hospital"](area.de);
  relation["amenity"="hospital"](area.de);
  node["healthcare"="hospital"](area.de);
  way["healthcare"="hospital"](area.de);
  relation["healthcare"="hospital"](area.de);
);
out center tags;
"""


def fetch_osm_hospitals(overpass_url: str) -> pd.DataFrame:
    response = requests.post(overpass_url, data=OVERPASS_QUERY.encode("utf-8"), timeout=600)
    response.raise_for_status()
    payload = response.json()
    elements = payload.get("elements", [])
    rows: List[Dict[str, Any]] = []
    for element in elements:
        tags = element.get("tags", {}) or {}
        lat = None
        lon = None
        if "center" in element:
            lat = element["center"].get("lat")
            lon = element["center"].get("lon")
        else:
            lat = element.get("lat")
            lon = element.get("lon")

        name = tags.get("name") or tags.get("official_name") or ""
        website = coalesce(tags.get("website"), tags.get("contact:website"), "")
        city = tags.get("addr:city", "")
        postcode = tags.get("addr:postcode", "")
        street = tags.get("addr:street", "")
        state = tags.get("addr:state", "")

        rows.append(
            {
                "osm_id": element.get("id"),
                "name": name,
                "website": website,
                "lat": lat,
                "lon": lon,
                "city": city,
                "postcode": postcode,
                "street": street,
                "state": state,
            }
        )

    df = pd.DataFrame(rows)
    df["website_domain"] = df["website"].apply(registrable_domain_from_url)
    df["name_lc"] = df["name"].fillna("").str.lower().str.strip()
    df["city_lc"] = df["city"].fillna("").str.lower().str.strip()
    df["postcode"] = df["postcode"].fillna("").astype(str).str.strip()
    return df


# ----------------------------
# Excel parsing
# ----------------------------

def parse_official_excel(
    path: str, sheet_name: Optional[str] = None, header_row: Optional[int] = None
) -> pd.DataFrame:
    raw = read_excel_safely(path, sheet_name=sheet_name, header_row=header_row)
    mapping = map_columns(raw)

    name_col = mapping.get("name")
    email_col = mapping.get("email")
    web_col = mapping.get("website")
    street_col = mapping.get("street")
    plz_col = mapping.get("postcode")
    city_col = mapping.get("city")
    state_col = mapping.get("state")

    df = pd.DataFrame(
        {
            "name": raw[name_col] if name_col else raw.iloc[:, 0],
            "email": raw[email_col] if email_col else "",
            "website": raw[web_col] if web_col else "",
            "street": raw[street_col] if street_col else "",
            "postcode": raw[plz_col] if plz_col else "",
            "city": raw[city_col] if city_col else "",
            "state": raw[state_col] if state_col else "",
        }
    )

    for column in ["name", "email", "website", "street", "postcode", "city", "state"]:
        df[column] = df[column].apply(clean_str)

    df["postcode"] = df["postcode"].apply(normalize_postcode)
    df["state"] = df["state"].apply(normalize_state)
    df["email_domain"] = df["email"].apply(registrable_domain_from_email)
    df["website_domain"] = df["website"].apply(registrable_domain_from_url)
    df["name_lc"] = df["name"].str.lower().str.strip()
    df["city_lc"] = df["city"].str.lower().str.strip()
    return df


# ----------------------------
# Matching logic
# ----------------------------

def match_by_domain(official: pd.DataFrame, osm: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
    official_copy = official.copy()
    osm_subset = osm[~osm["website_domain"].isna() & (osm["website_domain"] != "")]
    official_copy["domain_for_match"] = official_copy["email_domain"].fillna("")
    mask_missing = official_copy["domain_for_match"].eq("")
    official_copy.loc[mask_missing, "domain_for_match"] = official_copy.loc[mask_missing, "website_domain"].fillna("")

    domain_map: Dict[str, List[int]] = {}
    for idx, domain in official_copy["domain_for_match"].items():
        if not domain:
            continue
        domain_map.setdefault(domain, []).append(idx)

    matched_pairs: List[Tuple[int, int]] = []
    for idx, domain in osm_subset["website_domain"].items():
        if domain in domain_map:
            candidate_indices = domain_map[domain]
            if len(candidate_indices) == 1:
                matched_pairs.append((candidate_indices[0], idx))
            else:
                best_candidate = None
                best_score = -1
                osm_name = osm.loc[idx, "name_lc"]
                osm_city = osm.loc[idx, "city_lc"]
                osm_plz = osm.loc[idx, "postcode"]
                for candidate_idx in candidate_indices:
                    score = fuzz.token_sort_ratio(osm_name, official_copy.loc[candidate_idx, "name_lc"])
                    if osm_city and osm_city == official_copy.loc[candidate_idx, "city_lc"]:
                        score += 10
                    if osm_plz and osm_plz == official_copy.loc[candidate_idx, "postcode"]:
                        score += 8
                    if score > best_score:
                        best_score = score
                        best_candidate = candidate_idx
                if best_candidate is not None:
                    matched_pairs.append((best_candidate, idx))

    matched_official_idx = {pair[0] for pair in matched_pairs}
    unmatched_official = official_copy.drop(index=list(matched_official_idx), errors="ignore")
    matched_df = pd.DataFrame(matched_pairs, columns=["official_idx", "osm_idx"])
    return matched_df, unmatched_official


def match_by_name_city(official_unmatched: pd.DataFrame, osm: pd.DataFrame, min_score: int = 90) -> pd.DataFrame:
    pairs: List[Tuple[int, int]] = []
    osm_by_city: Dict[str, List[int]] = {}
    for idx, row in osm.iterrows():
        key_city = row["city_lc"]
        osm_by_city.setdefault(key_city, []).append(idx)
    osm_by_plz: Dict[str, List[int]] = {}
    for idx, row in osm.iterrows():
        key_plz = row["postcode"]
        osm_by_plz.setdefault(key_plz, []).append(idx)

    for official_idx, official_row in official_unmatched.iterrows():
        candidates = set()
        if official_row["city_lc"] in osm_by_city:
            candidates.update(osm_by_city[official_row["city_lc"]])
        if official_row["postcode"] in osm_by_plz:
            candidates.update(osm_by_plz[official_row["postcode"]])
        if not candidates:
            continue

        best_candidate = None
        best_score = -1
        for candidate_idx in candidates:
            score = fuzz.token_sort_ratio(official_row["name_lc"], osm.loc[candidate_idx, "name_lc"])
            if score > best_score:
                best_score = score
                best_candidate = candidate_idx
        if best_candidate is not None and best_score >= min_score:
            pairs.append((official_idx, best_candidate))

    return pd.DataFrame(pairs, columns=["official_idx", "osm_idx"])


# ----------------------------
# Main
# ----------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build German hospitals dataset (name, lat/lon, staff_email_domain)."
    )
    parser.add_argument(
        "--excel",
        required=True,
        help="Path to the official hospital Excel (e.g., Krankenhausverzeichnis 2023).",
    )
    parser.add_argument(
        "--overpass",
        default="https://overpass-api.de/api/interpreter",
        help="Overpass API endpoint URL.",
    )
    parser.add_argument(
        "--out",
        default="./output",
        help="Output directory.",
    )
    parser.add_argument(
        "--sheet",
        default=None,
        help="Optional Excel sheet name if the workbook contains multiple tables.",
    )
    parser.add_argument(
        "--header-row",
        type=int,
        default=None,
        help="Optional zero-based row index to use as header when reading the Excel sheet.",
    )
    args = parser.parse_args()

    outdir = args.out
    os.makedirs(outdir, exist_ok=True)

    print("Reading official Excel…", file=sys.stderr)
    official = parse_official_excel(
        args.excel, sheet_name=args.sheet, header_row=args.header_row
    )

    print("Fetching OSM hospitals via Overpass… (this may take a while)", file=sys.stderr)
    osm = fetch_osm_hospitals(args.overpass)

    print("Matching by domain…", file=sys.stderr)
    matches_domain, official_unmatched = match_by_domain(official, osm)

    print("Matching by name + locality…", file=sys.stderr)
    matches_name = match_by_name_city(official_unmatched, osm, min_score=90)

    matches = pd.concat([matches_domain, matches_name], ignore_index=True)

    rows: List[Dict[str, Any]] = []
    used_osm = set()
    used_official = set()

    for _, match in matches.iterrows():
        official_idx = match["official_idx"]
        osm_idx = match["osm_idx"]
        used_osm.add(osm_idx)
        used_official.add(official_idx)

        official_row = official.loc[official_idx]
        osm_row = osm.loc[osm_idx]

        staff_domain = (
            official_row["email_domain"]
            if pd.notna(official_row["email_domain"]) and official_row["email_domain"]
            else official_row["website_domain"]
        )

        rows.append(
            {
                "name": official_row["name"] or osm_row["name"],
                "lat": osm_row["lat"],
                "lon": osm_row["lon"],
                "staff_email_domain": staff_domain,
                "website": coalesce(official_row["website"], osm_row["website"]),
                "street": coalesce(official_row["street"], osm_row["street"]),
                "postcode": coalesce(official_row["postcode"], osm_row["postcode"]),
                "city": coalesce(official_row["city"], osm_row["city"]),
                "state": coalesce(official_row["state"], osm_row["state"]),
            }
        )

    final_df = pd.DataFrame(rows)

    out_csv = os.path.join(outdir, "german_hospitals.csv")
    final_df.to_csv(out_csv, index=False, encoding="utf-8")
    print(f"Wrote {len(final_df):,} matched hospitals to {out_csv}", file=sys.stderr)


if __name__ == "__main__":
    main()
