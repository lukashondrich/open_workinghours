-- Backend Monitoring Queries for Open Working Hours
-- Run these on Hetzner to check tester activity

-- =============================================================================
-- USER ACTIVITY
-- =============================================================================

-- 1. How many users registered?
SELECT COUNT(*) as total_users FROM users;

-- 2. Recent registrations (last 7 days)
SELECT
    user_id,
    hospital_id,
    specialty,
    role_level,
    state_code,
    created_at
FROM users
ORDER BY created_at DESC
LIMIT 10;

-- 3. Last submission time per user
SELECT
    u.hospital_id,
    u.specialty,
    u.role_level,
    u.last_submission_at,
    COUNT(w.event_id) as total_events
FROM users u
LEFT JOIN work_events w ON u.user_id = w.user_id
GROUP BY u.user_id, u.hospital_id, u.specialty, u.role_level, u.last_submission_at
ORDER BY u.last_submission_at DESC;

-- =============================================================================
-- WORK EVENTS
-- =============================================================================

-- 4. How many work events submitted?
SELECT COUNT(*) as total_work_events FROM work_events;

-- 5. Work events by day (last 14 days)
SELECT
    date,
    COUNT(*) as events_count,
    AVG(planned_hours) as avg_planned,
    AVG(actual_hours) as avg_actual
FROM work_events
WHERE date >= CURRENT_DATE - INTERVAL '14 days'
GROUP BY date
ORDER BY date DESC;

-- 6. Recent work events (last 20)
SELECT
    w.event_id,
    w.date,
    w.planned_hours,
    w.actual_hours,
    w.source,
    w.submitted_at,
    u.hospital_id,
    u.specialty,
    u.role_level
FROM work_events w
JOIN users u ON w.user_id = u.user_id
ORDER BY w.submitted_at DESC
LIMIT 20;

-- 7. Work events by source (geofence vs manual)
SELECT
    source,
    COUNT(*) as count,
    AVG(actual_hours) as avg_hours
FROM work_events
GROUP BY source
ORDER BY count DESC;

-- =============================================================================
-- AGGREGATION STATUS
-- =============================================================================

-- 8. How many aggregated stats computed?
SELECT COUNT(*) as total_stats FROM stats_by_state_specialty;

-- 9. Latest aggregation run
SELECT
    period_start,
    period_end,
    COUNT(*) as groups_published,
    MAX(computed_at) as last_computed
FROM stats_by_state_specialty
GROUP BY period_start, period_end
ORDER BY period_start DESC
LIMIT 5;

-- 10. Stats by state/specialty (most recent week)
SELECT
    state_code,
    specialty,
    role_level,
    n_users,
    ROUND(avg_planned_hours_noised::numeric, 2) as avg_planned,
    ROUND(avg_actual_hours_noised::numeric, 2) as avg_actual,
    period_start
FROM stats_by_state_specialty
WHERE period_start = (SELECT MAX(period_start) FROM stats_by_state_specialty)
ORDER BY n_users DESC;

-- =============================================================================
-- VERIFICATION ACTIVITY
-- =============================================================================

-- 11. Recent verification requests
SELECT
    email_domain,
    status,
    attempt_count,
    created_at,
    confirmed_at,
    expires_at
FROM verification_requests
ORDER BY created_at DESC
LIMIT 10;

-- 12. Verification success rate
SELECT
    status,
    COUNT(*) as count
FROM verification_requests
GROUP BY status;

-- =============================================================================
-- HEALTH CHECK
-- =============================================================================

-- 13. Database size and table stats
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 14. Activity in last 24 hours
SELECT
    'Users registered' as metric,
    COUNT(*) as count
FROM users
WHERE created_at >= NOW() - INTERVAL '24 hours'
UNION ALL
SELECT
    'Work events submitted' as metric,
    COUNT(*) as count
FROM work_events
WHERE submitted_at >= NOW() - INTERVAL '24 hours'
UNION ALL
SELECT
    'Verifications requested' as metric,
    COUNT(*) as count
FROM verification_requests
WHERE created_at >= NOW() - INTERVAL '24 hours';
