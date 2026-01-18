"""
Datawrapper API integration for updating the public dashboard map.

Updates the Germany states choropleth map with current coverage data.
"""
from __future__ import annotations

import csv
import io
import logging
from typing import TYPE_CHECKING

import requests
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import User

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

# German states mapping (state_code -> Datawrapper expects German names)
GERMAN_STATES = {
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

# Privacy threshold
K_MIN = 11

# Datawrapper API base URL
API_BASE = "https://api.datawrapper.de/v3"


def _count_to_status_value(count: int) -> int:
    """
    Convert contributor count to a numeric value for the choropleth.

    Returns:
        0 = No data (grey)
        1 = Building (1-10 contributors, amber)
        2 = Available (11+ contributors, green)
    """
    if count == 0:
        return 0
    elif count < K_MIN:
        return 1
    else:
        return 2


def _get_coverage_data(db: Session) -> list[dict]:
    """
    Get coverage data for all German states.

    Returns list of dicts with state name and status value.
    """
    # Count users per state
    state_counts = (
        db.query(
            User.state_code,
            func.count(User.user_id).label("count")
        )
        .filter(User.state_code.isnot(None))
        .group_by(User.state_code)
        .all()
    )

    state_count_map = {row.state_code: row.count for row in state_counts}

    # Build data for all states
    data = []
    for state_code, state_name in GERMAN_STATES.items():
        count = state_count_map.get(state_code, 0)
        data.append({
            "name": state_name,
            "value": _count_to_status_value(count),
        })

    return data


def _data_to_csv(data: list[dict]) -> str:
    """Convert data to CSV string for Datawrapper upload."""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["name", "value"])
    writer.writeheader()
    writer.writerows(data)
    return output.getvalue()


def update_datawrapper_map(db: Session) -> dict:
    """
    Update the Datawrapper choropleth map with current coverage data.

    Steps:
    1. Get coverage data from database
    2. Upload data to Datawrapper chart
    3. Update chart metadata (colors, legend)
    4. Publish the chart

    Returns:
        dict with status and details
    """
    settings = get_settings()

    if not settings.datawrapper:
        return {"success": False, "error": "Datawrapper not configured"}

    api_token = settings.datawrapper.api_token
    chart_id = settings.datawrapper.chart_id

    headers = {
        "Authorization": f"Bearer {api_token}",
    }

    try:
        # 1. Get coverage data
        data = _get_coverage_data(db)
        csv_data = _data_to_csv(data)

        logger.info(f"Updating Datawrapper chart {chart_id} with {len(data)} states")

        # 2. First configure axes to tell Datawrapper which columns to use
        axes_metadata = {
            "metadata": {
                "axes": {
                    "keys": "name",
                    "values": "value",
                },
            },
        }

        axes_resp = requests.patch(
            f"{API_BASE}/charts/{chart_id}",
            headers={**headers, "Content-Type": "application/json"},
            json=axes_metadata,
            timeout=30,
        )
        if not axes_resp.ok:
            logger.error(f"Datawrapper axes config failed: {axes_resp.status_code} - {axes_resp.text}")
            return {"success": False, "error": f"Axes config failed: {axes_resp.text}"}

        # 3. Upload data to chart
        upload_resp = requests.put(
            f"{API_BASE}/charts/{chart_id}/data",
            headers={**headers, "Content-Type": "text/csv"},
            data=csv_data,
            timeout=30,
        )
        if not upload_resp.ok:
            logger.error(f"Datawrapper upload failed: {upload_resp.status_code} - {upload_resp.text}")
            return {"success": False, "error": f"Upload failed: {upload_resp.text}"}

        # 4. Update chart metadata (colors and legend)
        metadata = {
            "metadata": {
                "visualize": {
                    "map-key-attr": "name",
                },
            },
        }

        metadata_resp = requests.patch(
            f"{API_BASE}/charts/{chart_id}",
            headers={**headers, "Content-Type": "application/json"},
            json=metadata,
            timeout=30,
        )
        if not metadata_resp.ok:
            logger.error(f"Datawrapper metadata update failed: {metadata_resp.status_code} - {metadata_resp.text}")
            return {"success": False, "error": f"Metadata update failed: {metadata_resp.text}"}

        # 5. Publish the chart
        publish_resp = requests.post(
            f"{API_BASE}/charts/{chart_id}/publish",
            headers=headers,
            timeout=30,
        )
        if not publish_resp.ok:
            logger.error(f"Datawrapper publish failed: {publish_resp.status_code} - {publish_resp.text}")
            return {"success": False, "error": f"Publish failed: {publish_resp.text}"}

        publish_data = publish_resp.json()

        logger.info(f"Successfully updated and published Datawrapper chart {chart_id}")

        return {
            "success": True,
            "chart_id": chart_id,
            "embed_url": publish_data.get("url"),
            "states_updated": len(data),
        }

    except requests.RequestException as e:
        logger.error(f"Datawrapper API error: {e}")
        return {"success": False, "error": str(e)}
    except Exception as e:
        logger.error(f"Error updating Datawrapper map: {e}")
        return {"success": False, "error": str(e)}


def get_embed_code(chart_id: str | None = None) -> str:
    """
    Get the responsive embed code for the Datawrapper chart.

    This can be used directly in the frontend.
    """
    settings = get_settings()

    if chart_id is None:
        if not settings.datawrapper:
            return ""
        chart_id = settings.datawrapper.chart_id

    # Datawrapper responsive embed code
    return f'''<iframe title="Healthcare Coverage Map" aria-label="Map" id="datawrapper-chart-{chart_id}" src="https://datawrapper.dwcdn.net/{chart_id}/" scrolling="no" frameborder="0" style="width: 0; min-width: 100% !important; border: none;" height="500" data-external="1"></iframe><script type="text/javascript">!function(){{"use strict";window.addEventListener("message",(function(a){{if(void 0!==a.data["datawrapper-height"]){{var e=document.querySelectorAll("iframe");for(var t in a.data["datawrapper-height"])for(var r=0;r<e.length;r++)if(e[r].contentWindow===a.source){{var i=a.data["datawrapper-height"][t]+"px";e[r].style.height=i}}}}}})}}();</script>'''
