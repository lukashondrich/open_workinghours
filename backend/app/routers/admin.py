"""
Admin Dashboard API
Provides monitoring data for the admin web dashboard.
"""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, WorkEvent, VerificationRequest, StatsByStateSpecialty

router = APIRouter(prefix="/admin", tags=["admin"])
security = HTTPBasic()

# Admin credentials from environment variables
import os

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")

if not ADMIN_PASSWORD:
    raise RuntimeError(
        "ADMIN_PASSWORD environment variable must be set! "
        "Add it to .env.production: ADMIN_PASSWORD=your-secure-password"
    )


def verify_admin(credentials: Annotated[HTTPBasicCredentials, Depends(security)]) -> str:
    """Verify admin credentials using basic auth"""
    correct_username = secrets.compare_digest(credentials.username, ADMIN_USERNAME)
    correct_password = secrets.compare_digest(credentials.password, ADMIN_PASSWORD)

    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username


@router.get("/", response_class=HTMLResponse)
def get_dashboard_page(username: str = Depends(verify_admin)) -> str:
    """Serve the admin dashboard HTML page"""
    return """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Open Working Hours - Admin Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            padding: 20px;
            color: #333;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        .header {
            background: white;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        h1 {
            font-size: 24px;
            margin-bottom: 8px;
            color: #1B7A5E;
        }

        .last-updated {
            font-size: 14px;
            color: #666;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 20px;
        }

        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .stat-value {
            font-size: 32px;
            font-weight: bold;
            color: #1B7A5E;
            margin-bottom: 4px;
        }

        .stat-label {
            font-size: 14px;
            color: #666;
        }

        .section {
            background: white;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .section h2 {
            font-size: 18px;
            margin-bottom: 16px;
            color: #333;
        }

        .event-list {
            list-style: none;
        }

        .event-item {
            padding: 12px;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 14px;
        }

        .event-item:last-child {
            border-bottom: none;
        }

        .event-date {
            font-weight: 600;
            color: #333;
        }

        .event-hours {
            color: #666;
        }

        .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
        }

        .badge-geofence {
            background: #e3f2fd;
            color: #1976d2;
        }

        .badge-manual {
            background: #fff3e0;
            color: #f57c00;
        }

        .loading {
            text-align: center;
            padding: 40px;
            color: #666;
        }

        .error {
            background: #ffebee;
            color: #c62828;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 20px;
        }

        @media (max-width: 600px) {
            body {
                padding: 12px;
            }

            .stats-grid {
                grid-template-columns: 1fr 1fr;
            }

            .stat-value {
                font-size: 24px;
            }

            h1 {
                font-size: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏥 Open Working Hours</h1>
            <div class="last-updated" id="last-updated">Loading...</div>
        </div>

        <div id="error-message" class="error" style="display: none;"></div>

        <div class="stats-grid" id="stats-grid">
            <div class="stat-card">
                <div class="stat-value" id="total-users">-</div>
                <div class="stat-label">Total Users</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="total-events">-</div>
                <div class="stat-label">Work Events</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="events-24h">-</div>
                <div class="stat-label">Last 24h</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="total-stats">-</div>
                <div class="stat-label">Stats Groups</div>
            </div>
        </div>

        <div class="section">
            <h2>📅 Recent Work Events</h2>
            <ul class="event-list" id="recent-events">
                <li class="loading">Loading...</li>
            </ul>
        </div>
    </div>

    <script>
        async function fetchDashboardData() {
            try {
                const response = await fetch('/admin/data');
                if (!response.ok) throw new Error('Failed to fetch data');

                const data = await response.json();

                // Update stats
                document.getElementById('total-users').textContent = data.total_users;
                document.getElementById('total-events').textContent = data.total_work_events;
                document.getElementById('events-24h').textContent = data.events_last_24h;
                document.getElementById('total-stats').textContent = data.total_stats;

                // Update recent events
                const eventsList = document.getElementById('recent-events');
                if (data.recent_events.length === 0) {
                    eventsList.innerHTML = '<li class="event-item">No events yet</li>';
                } else {
                    eventsList.innerHTML = data.recent_events.map(event => `
                        <li class="event-item">
                            <div>
                                <div class="event-date">${event.date}</div>
                                <div class="event-hours">
                                    Planned: ${event.planned_hours}h | Actual: ${event.actual_hours}h
                                </div>
                            </div>
                            <span class="badge badge-${event.source}">${event.source}</span>
                        </li>
                    `).join('');
                }

                // Update timestamp
                document.getElementById('last-updated').textContent =
                    `Last updated: ${new Date().toLocaleTimeString()}`;

                // Hide error if showing
                document.getElementById('error-message').style.display = 'none';

            } catch (error) {
                console.error('Error fetching dashboard data:', error);
                document.getElementById('error-message').textContent =
                    'Failed to load dashboard data. Please refresh the page.';
                document.getElementById('error-message').style.display = 'block';
            }
        }

        // Initial load
        fetchDashboardData();

        // Refresh every 30 seconds
        setInterval(fetchDashboardData, 30000);
    </script>
</body>
</html>
    """


@router.get("/data")
def get_dashboard_data(
    username: str = Depends(verify_admin),
    db: Session = Depends(get_db)
) -> dict:
    """Get dashboard data (JSON) for the admin interface"""

    # Total counts
    total_users = db.query(func.count(User.user_id)).scalar() or 0
    total_work_events = db.query(func.count(WorkEvent.event_id)).scalar() or 0
    total_stats = db.query(func.count(StatsByStateSpecialty.stat_id)).scalar() or 0

    # Last 24 hours activity
    yesterday = datetime.now(timezone.utc) - timedelta(hours=24)
    events_last_24h = db.query(func.count(WorkEvent.event_id)).filter(
        WorkEvent.submitted_at >= yesterday
    ).scalar() or 0

    # Recent work events (last 10)
    recent_events = db.query(
        WorkEvent.date,
        WorkEvent.planned_hours,
        WorkEvent.actual_hours,
        WorkEvent.source,
        WorkEvent.submitted_at
    ).order_by(WorkEvent.submitted_at.desc()).limit(10).all()

    recent_events_data = [
        {
            "date": event.date.isoformat(),
            "planned_hours": float(event.planned_hours),
            "actual_hours": float(event.actual_hours),
            "source": event.source,
            "submitted_at": event.submitted_at.isoformat()
        }
        for event in recent_events
    ]

    return {
        "total_users": total_users,
        "total_work_events": total_work_events,
        "total_stats": total_stats,
        "events_last_24h": events_last_24h,
        "recent_events": recent_events_data,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
