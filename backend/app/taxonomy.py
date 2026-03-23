"""
Taxonomy constants — single source of truth for all closed-set profile fields.

Anchored to the official Fachabteilungsschlüssel (§301 SGB V) for departments,
plus profession/seniority hierarchy per decisions D1–D12 in dp-data-model-alignment.md.
"""
from __future__ import annotations

from enum import Enum


# ---------------------------------------------------------------------------
# Level 0: Profession
# ---------------------------------------------------------------------------

class Profession(str, Enum):
    physician = "physician"
    nurse = "nurse"


# ---------------------------------------------------------------------------
# Seniority (by profession) — D7
# ---------------------------------------------------------------------------

class PhysicianSeniority(str, Enum):
    assistenzarzt = "assistenzarzt"
    facharzt = "facharzt"
    oberarzt_plus = "oberarzt_plus"


class NurseSeniority(str, Enum):
    pflegefachkraft = "pflegefachkraft"
    leitung = "leitung"


SENIORITY_BY_PROFESSION: dict[Profession, list[str]] = {
    Profession.physician: [s.value for s in PhysicianSeniority],
    Profession.nurse: [s.value for s in NurseSeniority],
}

ALL_SENIORITY_VALUES: set[str] = {
    s.value for s in PhysicianSeniority
} | {
    s.value for s in NurseSeniority
}


def validate_seniority(profession: str, seniority: str) -> bool:
    """Return True if seniority is valid for the given profession."""
    try:
        prof = Profession(profession)
    except ValueError:
        return False
    return seniority in SENIORITY_BY_PROFESSION[prof]


# ---------------------------------------------------------------------------
# Level 1: Department groups (10 broad groups) — D3
# ---------------------------------------------------------------------------

class DepartmentGroup(str, Enum):
    innere_medizin = "innere_medizin"
    chirurgie = "chirurgie"
    anaesthesiologie_intensiv = "anaesthesiologie_intensiv"
    notaufnahme = "notaufnahme"
    paediatrie = "paediatrie"
    gynaekologie_geburtshilfe = "gynaekologie_geburtshilfe"
    neurologie_psychiatrie = "neurologie_psychiatrie"
    hno_augen_mkg = "hno_augen_mkg"
    diagnostik_radiologie = "diagnostik_radiologie"
    sonstige = "sonstige"


ALL_DEPARTMENT_GROUPS: set[str] = {d.value for d in DepartmentGroup}


# ---------------------------------------------------------------------------
# Level 2: Specializations — Fachabteilungsschlüssel codes → group mapping
# Physicians only. Code → (label_de, department_group)
# ---------------------------------------------------------------------------

SPECIALIZATIONS: dict[str, tuple[str, DepartmentGroup]] = {
    # Innere Medizin
    "0100": ("Innere Medizin", DepartmentGroup.innere_medizin),
    "0200": ("Geriatrie", DepartmentGroup.innere_medizin),
    "0300": ("Kardiologie", DepartmentGroup.innere_medizin),
    "0400": ("Nephrologie", DepartmentGroup.innere_medizin),
    "0500": ("Hämatologie und internistische Onkologie", DepartmentGroup.innere_medizin),
    "0600": ("Endokrinologie", DepartmentGroup.innere_medizin),
    "0700": ("Gastroenterologie", DepartmentGroup.innere_medizin),
    "0800": ("Pneumologie", DepartmentGroup.innere_medizin),
    "0900": ("Rheumatologie", DepartmentGroup.innere_medizin),
    "1400": ("Lungen- und Bronchialheilkunde", DepartmentGroup.innere_medizin),
    # Chirurgie
    "1500": ("Allgemeine Chirurgie", DepartmentGroup.chirurgie),
    "1600": ("Unfallchirurgie", DepartmentGroup.chirurgie),
    "1800": ("Gefäßchirurgie", DepartmentGroup.chirurgie),
    "1900": ("Plastische Chirurgie", DepartmentGroup.chirurgie),
    "2000": ("Thoraxchirurgie", DepartmentGroup.chirurgie),
    "2100": ("Herzchirurgie", DepartmentGroup.chirurgie),
    "2200": ("Urologie", DepartmentGroup.chirurgie),
    "2300": ("Orthopädie", DepartmentGroup.chirurgie),
    "2316": ("Orthopädie und Unfallchirurgie", DepartmentGroup.chirurgie),
    # Anästhesiologie / Intensivmedizin
    "3600": ("Intensivmedizin", DepartmentGroup.anaesthesiologie_intensiv),
    "AN01": ("Anästhesiologie", DepartmentGroup.anaesthesiologie_intensiv),
    # Notaufnahme
    "ZNA1": ("Zentrale Notaufnahme", DepartmentGroup.notaufnahme),
    # Pädiatrie
    "1000": ("Pädiatrie", DepartmentGroup.paediatrie),
    "1100": ("Kinderkardiologie", DepartmentGroup.paediatrie),
    "1200": ("Neonatologie", DepartmentGroup.paediatrie),
    "1300": ("Kinderchirurgie", DepartmentGroup.paediatrie),
    # Gynäkologie / Geburtshilfe
    "2400": ("Frauenheilkunde und Geburtshilfe", DepartmentGroup.gynaekologie_geburtshilfe),
    "2425": ("Frauenheilkunde", DepartmentGroup.gynaekologie_geburtshilfe),
    "2500": ("Geburtshilfe", DepartmentGroup.gynaekologie_geburtshilfe),
    # Neurologie / Psychiatrie
    "2800": ("Neurologie", DepartmentGroup.neurologie_psychiatrie),
    "1700": ("Neurochirurgie", DepartmentGroup.neurologie_psychiatrie),
    "2900": ("Allgemeine Psychiatrie", DepartmentGroup.neurologie_psychiatrie),
    "3000": ("Kinder- und Jugendpsychiatrie", DepartmentGroup.neurologie_psychiatrie),
    "3100": ("Psychosomatik/Psychotherapie", DepartmentGroup.neurologie_psychiatrie),
    # HNO / Augen / MKG
    "2600": ("Hals-, Nasen-, Ohrenheilkunde", DepartmentGroup.hno_augen_mkg),
    "2700": ("Augenheilkunde", DepartmentGroup.hno_augen_mkg),
    "3500": ("Mund-Kiefer-Gesichtschirurgie", DepartmentGroup.hno_augen_mkg),
    # Diagnostik / Radiologie
    "3200": ("Nuklearmedizin", DepartmentGroup.diagnostik_radiologie),
    "3300": ("Strahlenheilkunde", DepartmentGroup.diagnostik_radiologie),
    "3400": ("Dermatologie und Venerologie", DepartmentGroup.diagnostik_radiologie),
    "RD01": ("Radiologie", DepartmentGroup.diagnostik_radiologie),
    "PA01": ("Pathologie", DepartmentGroup.diagnostik_radiologie),
    # Sonstige
    "3700": ("Sonstige Fachabteilung", DepartmentGroup.sonstige),
}

ALL_SPECIALIZATION_CODES: set[str] = set(SPECIALIZATIONS.keys())


# ---------------------------------------------------------------------------
# German federal states (16 Bundesländer) — D5
# ---------------------------------------------------------------------------

GERMAN_STATES: dict[str, str] = {
    "BW": "Baden-Württemberg",
    "BY": "Bayern",
    "BE": "Berlin",
    "BB": "Brandenburg",
    "HB": "Bremen",
    "HH": "Hamburg",
    "HE": "Hessen",
    "MV": "Mecklenburg-Vorpommern",
    "NI": "Niedersachsen",
    "NW": "Nordrhein-Westfalen",
    "RP": "Rheinland-Pfalz",
    "SL": "Saarland",
    "SN": "Sachsen",
    "ST": "Sachsen-Anhalt",
    "SH": "Schleswig-Holstein",
    "TH": "Thüringen",
}

ALL_STATE_CODES: set[str] = set(GERMAN_STATES.keys())
