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
from ..models import User, WorkEvent, VerificationRequest, StatsByStateSpecialty, FeedbackReport

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

        .tabs {
            display: flex;
            gap: 8px;
            margin-bottom: 20px;
            border-bottom: 2px solid #e0e0e0;
        }

        .tab-button {
            background: none;
            border: none;
            padding: 12px 24px;
            font-size: 16px;
            color: #666;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            margin-bottom: -2px;
            transition: all 0.2s;
        }

        .tab-button:hover {
            color: #1B7A5E;
        }

        .tab-button.active {
            color: #1B7A5E;
            border-bottom-color: #1B7A5E;
            font-weight: 600;
        }

        .tab-content {
            display: none;
        }

        .tab-content.active {
            display: block;
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

        .report-card {
            background: white;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 12px;
            border-left: 4px solid #1B7A5E;
            cursor: pointer;
            transition: box-shadow 0.2s;
        }

        .report-card:hover {
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }

        .report-card.resolved {
            border-left-color: #4caf50;
            opacity: 0.7;
        }

        .report-card.dismissed {
            border-left-color: #9e9e9e;
            opacity: 0.6;
        }

        .report-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 8px;
        }

        .report-timestamp {
            font-size: 14px;
            color: #666;
            font-weight: 600;
        }

        .report-status {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
        }

        .report-status.pending {
            background: #fff3e0;
            color: #f57c00;
        }

        .report-status.resolved {
            background: #e8f5e9;
            color: #2e7d32;
        }

        .report-status.dismissed {
            background: #f5f5f5;
            color: #616161;
        }

        .report-user {
            font-size: 14px;
            color: #333;
            margin-bottom: 8px;
        }

        .report-description {
            font-size: 14px;
            color: #666;
            margin-top: 8px;
            padding: 8px;
            background: #f9f9f9;
            border-radius: 4px;
        }

        .report-details {
            display: none;
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid #eee;
            font-size: 13px;
            color: #666;
        }

        .report-card.expanded .report-details {
            display: block;
        }

        .report-details-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 12px;
            margin-top: 8px;
        }

        .report-detail-item {
            background: #f9f9f9;
            padding: 8px;
            border-radius: 4px;
        }

        .report-detail-label {
            font-weight: 600;
            color: #333;
            margin-bottom: 4px;
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

        <div class="tabs">
            <button class="tab-button active" onclick="showTab('dashboard')">Dashboard</button>
            <button class="tab-button" onclick="showTab('reports')">Reports</button>
        </div>

        <div id="error-message" class="error" style="display: none;"></div>

        <!-- Dashboard Tab -->
        <div id="dashboard-tab" class="tab-content active">
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

        <!-- Reports Tab -->
        <div id="reports-tab" class="tab-content">
            <div class="section">
                <h2>🐛 Bug Reports & Feedback</h2>
                <div id="reports-list">
                    <div class="loading">Loading reports...</div>
                </div>
            </div>
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

        // Tab switching
        function showTab(tabName) {
            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });

            // Remove active class from all buttons
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('active');
            });

            // Show selected tab
            document.getElementById(tabName + '-tab').classList.add('active');

            // Add active class to clicked button
            event.target.classList.add('active');

            // Load reports if reports tab is selected
            if (tabName === 'reports') {
                fetchReports();
            }
        }

        // Fetch and display bug reports
        async function fetchReports() {
            try {
                const response = await fetch('/admin/reports');
                if (!response.ok) throw new Error('Failed to fetch reports');

                const data = await response.json();
                const reportsList = document.getElementById('reports-list');

                if (data.reports.length === 0) {
                    reportsList.innerHTML = '<div class="loading">No reports yet</div>';
                    return;
                }

                reportsList.innerHTML = data.reports.map(report => {
                    const timestamp = new Date(report.created_at).toLocaleString();
                    const userInfo = report.user_email || 'Anonymous';

                    return `
                        <div class="report-card ${report.resolved}" onclick="toggleReport(this)">
                            <div class="report-header">
                                <div class="report-timestamp">${timestamp}</div>
                                <span class="report-status ${report.resolved}">${report.resolved}</span>
                            </div>
                            <div class="report-user">
                                📧 ${userInfo}
                                ${report.specialty ? `| ${report.specialty}` : ''}
                                ${report.hospital_id ? `| ${report.hospital_id}` : ''}
                            </div>
                            ${report.description ? `<div class="report-description">${report.description}</div>` : ''}
                            <div class="report-details">
                                <div class="report-details-grid">
                                    <div class="report-detail-item">
                                        <div class="report-detail-label">App Version</div>
                                        Build #${report.app_state.app.build_number} (v${report.app_state.app.version})
                                    </div>
                                    <div class="report-detail-item">
                                        <div class="report-detail-label">Platform</div>
                                        ${report.app_state.app.platform} ${report.app_state.app.os_version || ''}
                                    </div>
                                    <div class="report-detail-item">
                                        <div class="report-detail-label">Device</div>
                                        ${report.app_state.app.device_model || 'Unknown'}
                                    </div>
                                    <div class="report-detail-item">
                                        <div class="report-detail-label">Locations</div>
                                        ${report.app_state.locations.count} configured
                                    </div>
                                    <div class="report-detail-item">
                                        <div class="report-detail-label">Work Events</div>
                                        ${report.app_state.work_events.total} total (${report.app_state.work_events.pending} pending)
                                    </div>
                                    <div class="report-detail-item">
                                        <div class="report-detail-label">Last Submission</div>
                                        ${report.app_state.work_events.last_submission || 'Never'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            } catch (error) {
                console.error('Error fetching reports:', error);
                document.getElementById('reports-list').innerHTML =
                    '<div class="error">Failed to load reports. Please refresh the page.</div>';
            }
        }

        // Toggle report expansion
        function toggleReport(element) {
            element.classList.toggle('expanded');
        }
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


@router.get("/reports")
def get_feedback_reports(
    status: str | None = None,
    limit: int = 100,
    username: str = Depends(verify_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Get bug reports and feedback from mobile app users

    Args:
        status: Filter by resolution status (pending, resolved, dismissed)
        limit: Number of reports to return (default: 100, max: 500)
    """
    # Limit to prevent abuse
    limit = min(limit, 500)

    # Build query
    query = db.query(FeedbackReport)

    # Filter by status if provided
    if status:
        query = query.filter(FeedbackReport.resolved == status)

    # Order by most recent first
    reports = query.order_by(FeedbackReport.created_at.desc()).limit(limit).all()

    # Format response
    reports_data = [
        {
            "report_id": str(report.report_id),
            "created_at": report.created_at.isoformat(),
            "user_id": report.user_id,
            "user_email": report.user_email,
            "hospital_id": report.hospital_id,
            "specialty": report.specialty,
            "role_level": report.role_level,
            "state_code": report.state_code,
            "description": report.description,
            "app_state": report.app_state,
            "resolved": report.resolved,
        }
        for report in reports
    ]

    return {
        "total": len(reports_data),
        "reports": reports_data,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/logs")
def get_logs(
    source: str = "backend",
    lines: int = 100,
    search: str | None = None,
    level: str | None = None,
    username: str = Depends(verify_admin),
) -> dict:
    """Get logs from Docker containers with filtering

    Args:
        source: Log source (backend, aggregation, nginx)
        lines: Number of lines to return (default: 100, max: 1000)
        search: Search term to filter logs
        level: Filter by log level (ERROR, WARNING, INFO)
    """
    import subprocess

    # Limit lines to prevent abuse
    lines = min(lines, 1000)

    try:
        # Get logs based on source
        if source == "backend":
            result = subprocess.run(
                ["docker", "compose", "logs", "--tail", str(lines), "backend"],
                capture_output=True,
                text=True,
                timeout=10
            )
        elif source == "aggregation":
            # Get aggregation logs from log files
            result = subprocess.run(
                ["tail", "-n", str(lines), "/home/deploy/logs/aggregation*.log"],
                capture_output=True,
                text=True,
                timeout=10,
                shell=True
            )
        elif source == "nginx":
            result = subprocess.run(
                ["docker", "compose", "logs", "--tail", str(lines), "nginx"],
                capture_output=True,
                text=True,
                timeout=10
            )
        else:
            raise HTTPException(status_code=400, detail="Invalid log source")

        logs = result.stdout

        # Apply search filter
        if search:
            logs = "\n".join([line for line in logs.split("\n") if search.lower() in line.lower()])

        # Apply level filter
        if level:
            logs = "\n".join([line for line in logs.split("\n") if level.upper() in line.upper()])

        return {
            "source": source,
            "lines_requested": lines,
            "logs": logs,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Log fetch timeout")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch logs: {str(e)}")
