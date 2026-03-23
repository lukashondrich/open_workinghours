"""
Taxonomy endpoints — hospital search, department list, state list.

Hospital data loaded from CSV at startup and served from memory.
"""
from __future__ import annotations

import csv
import logging
from pathlib import Path

from fastapi import APIRouter, Query
from pydantic import BaseModel

from ..taxonomy import (
    GERMAN_STATES,
    SPECIALIZATIONS,
    DepartmentGroup,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/taxonomy", tags=["taxonomy"])


# ---------------------------------------------------------------------------
# Hospital data (loaded once at import time)
# ---------------------------------------------------------------------------

class Hospital(BaseModel):
    id: int
    name: str
    city: str
    state: str
    postcode: str


_HOSPITALS: list[Hospital] = []
_HOSPITALS_LOADED = False


def _load_hospitals() -> list[Hospital]:
    global _HOSPITALS, _HOSPITALS_LOADED
    if _HOSPITALS_LOADED:
        return _HOSPITALS

    csv_path = Path(__file__).resolve().parent.parent.parent.parent / "datasets" / "german_hospitals" / "output" / "german_hospitals.csv"
    if not csv_path.exists():
        logger.warning(f"Hospital CSV not found at {csv_path}. Hospital search will return empty results.")
        _HOSPITALS_LOADED = True
        return _HOSPITALS

    with open(csv_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for idx, row in enumerate(reader, start=1):
            _HOSPITALS.append(Hospital(
                id=idx,
                name=row.get("name", ""),
                city=row.get("city", ""),
                state=row.get("state", ""),
                postcode=row.get("postcode", ""),
            ))

    logger.info(f"Loaded {len(_HOSPITALS)} hospitals from {csv_path}")
    _HOSPITALS_LOADED = True
    return _HOSPITALS


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class HospitalOut(BaseModel):
    id: int
    name: str
    city: str
    state: str
    postcode: str


class DepartmentGroupOut(BaseModel):
    key: str
    specializations: list[dict]


class StateOut(BaseModel):
    code: str
    name: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/hospitals", response_model=list[HospitalOut])
def search_hospitals(
    state: str | None = Query(default=None, description="Filter by state name (e.g. 'Bayern')"),
    q: str | None = Query(default=None, description="Search by hospital name (case-insensitive substring)"),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[HospitalOut]:
    """Search hospital dataset. Public endpoint."""
    hospitals = _load_hospitals()
    results = hospitals

    if state:
        state_lower = state.lower()
        results = [h for h in results if h.state.lower() == state_lower]

    if q:
        q_lower = q.lower()
        results = [h for h in results if q_lower in h.name.lower()]

    return [HospitalOut(**h.dict()) for h in results[:limit]]


@router.get("/departments", response_model=list[DepartmentGroupOut])
def list_departments() -> list[DepartmentGroupOut]:
    """List all 10 department groups with their specialization codes."""
    groups: dict[str, list[dict]] = {dg.value: [] for dg in DepartmentGroup}

    for code, (label, group) in SPECIALIZATIONS.items():
        groups[group.value].append({"code": code, "label_de": label})

    return [
        DepartmentGroupOut(key=key, specializations=specs)
        for key, specs in groups.items()
    ]


@router.get("/states", response_model=list[StateOut])
def list_states() -> list[StateOut]:
    """Return all 16 German federal states."""
    return [StateOut(code=code, name=name) for code, name in sorted(GERMAN_STATES.items())]
