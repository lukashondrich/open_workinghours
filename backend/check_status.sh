#!/bin/bash

# Quick monitoring script - run on Hetzner to check system status

set -e

echo "📊 Open Working Hours - Status Check"
echo "===================================="
echo ""

# Check if containers are running
echo "🐳 Docker Status:"
docker compose ps
echo ""

# Quick database stats
echo "📈 Quick Stats:"
docker exec owh_postgres psql -U owh -d owh -t <<'SQL'
SELECT '👥 Total Users: ' || COUNT(*) FROM users;
SELECT '📝 Work Events: ' || COUNT(*) FROM work_events;
SELECT '📊 Stats Groups: ' || COUNT(*) FROM stats_by_state_specialty;
SELECT '✉️  Verifications: ' || COUNT(*) FROM verification_requests;
SQL

echo ""
echo "⏱️  Recent Activity (last 24h):"
docker exec owh_postgres psql -U owh -d owh -t <<'SQL'
SELECT '  Users: ' || COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '24 hours';
SELECT '  Events: ' || COUNT(*) FROM work_events WHERE submitted_at >= NOW() - INTERVAL '24 hours';
SQL

echo ""
echo "📅 Latest Work Events:"
docker exec owh_postgres psql -U owh -d owh <<'SQL'
SELECT
    date,
    ROUND(planned_hours::numeric, 1) as planned,
    ROUND(actual_hours::numeric, 1) as actual,
    source,
    TO_CHAR(submitted_at, 'YYYY-MM-DD HH24:MI') as submitted
FROM work_events
ORDER BY submitted_at DESC
LIMIT 5;
SQL

echo ""
echo "📁 Recent Aggregation Logs:"
ls -lt /home/deploy/logs/aggregation_*.log 2>/dev/null | head -3 || echo "  (no logs yet)"

echo ""
echo "✅ Status check complete"
echo ""
echo "💡 For detailed queries, run:"
echo "   docker exec -it owh_postgres psql -U owh -d owh"
echo "   Then paste queries from monitoring.sql"
