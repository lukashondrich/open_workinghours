#!/bin/bash
#
# Run the privacy-preserving aggregation job
# This script should be run from a cron job daily at 3 AM UTC
#

set -e  # Exit on error

# Change to the project directory
cd /home/deploy/open_workinghours

# Run aggregation inside the backend container
docker exec open_workinghours-backend-1 python -m app.aggregation

# Log completion
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Aggregation job completed" >> /home/deploy/aggregation.log
