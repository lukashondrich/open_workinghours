#!/bin/bash

# Open Working Hours - Monitoring Setup Script
# Run this on Hetzner server to set up monitoring and aggregation

set -e

echo "🔍 Setting up Open Working Hours monitoring..."
echo ""

# Create logs directory
mkdir -p /home/deploy/logs

echo "📊 Creating aggregation cron job..."

# Create aggregation runner script
cat > /home/deploy/run_aggregation.sh <<'EOF'
#!/bin/bash
# Run aggregation job and log results

LOG_FILE="/home/deploy/logs/aggregation_$(date +%Y%m%d_%H%M%S).log"

echo "[$(date)] Starting aggregation..." >> "$LOG_FILE"

cd /home/deploy/open_workinghours/backend

# Run aggregation inside Docker container
docker compose exec -T backend python -m app.aggregation >> "$LOG_FILE" 2>&1

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "[$(date)] Aggregation completed successfully" >> "$LOG_FILE"
else
    echo "[$(date)] Aggregation failed with exit code $EXIT_CODE" >> "$LOG_FILE"
fi

# Keep only last 30 days of logs
find /home/deploy/logs -name "aggregation_*.log" -mtime +30 -delete

exit $EXIT_CODE
EOF

chmod +x /home/deploy/run_aggregation.sh

echo "✅ Aggregation script created at: /home/deploy/run_aggregation.sh"
echo ""

# Add cron job (runs daily at 3 AM UTC)
CRON_JOB="0 3 * * * /home/deploy/run_aggregation.sh"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "run_aggregation.sh"; then
    echo "⚠️  Cron job already exists, skipping..."
else
    # Add to crontab
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "✅ Cron job added: Daily at 3 AM UTC"
fi

echo ""
echo "📋 Current crontab:"
crontab -l | grep -E "(run_aggregation|CRON)" || echo "(no aggregation jobs)"
echo ""

echo "🧪 Testing aggregation manually..."
/home/deploy/run_aggregation.sh

echo ""
echo "✅ Monitoring setup complete!"
echo ""
echo "📖 Usage:"
echo "  • View logs: ls -lh /home/deploy/logs/"
echo "  • Latest log: tail -f /home/deploy/logs/aggregation_*.log | tail -1"
echo "  • Run manually: /home/deploy/run_aggregation.sh"
echo "  • Check cron: crontab -l"
echo ""
echo "🔍 Run monitoring queries:"
echo "  docker exec -it owh_postgres psql -U owh -d owh -f /path/to/monitoring.sql"
echo ""
