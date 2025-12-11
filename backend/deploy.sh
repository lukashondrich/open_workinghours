#!/bin/bash

# Open Working Hours - Deployment Helper Script
# This script helps deploy the backend to production

set -e  # Exit on error

echo "🚀 Open Working Hours - Deployment Helper"
echo "=========================================="
echo ""

# Check if we're deploying or updating
if [ "$1" == "update" ]; then
    echo "📦 Updating existing deployment..."

    # Create tarball
    echo "Creating tarball..."
    tar -czf backend.tar.gz \
        --exclude='.venv' \
        --exclude='__pycache__' \
        --exclude='*.pyc' \
        --exclude='dev.db' \
        --exclude='.env' \
        --exclude='.env.production' \
        .

    echo "✅ Tarball created: backend.tar.gz"
    echo ""
    echo "Next steps:"
    echo "1. scp backend.tar.gz deploy@YOUR_SERVER_IP:~/"
    echo "2. ssh deploy@YOUR_SERVER_IP"
    echo "3. cd ~/open_workinghours/backend"
    echo "4. docker compose down"
    echo "5. tar -xzf ~/backend.tar.gz"
    echo "6. export \$(cat .env.production | xargs)"
    echo "7. docker compose up -d --build"

elif [ "$1" == "package" ]; then
    echo "📦 Creating deployment package..."

    # Create tarball
    tar -czf backend.tar.gz \
        --exclude='.venv' \
        --exclude='__pycache__' \
        --exclude='*.pyc' \
        --exclude='dev.db' \
        --exclude='.env' \
        --exclude='.env.production' \
        .

    echo "✅ Package created: backend.tar.gz"
    echo ""
    echo "File size:"
    ls -lh backend.tar.gz
    echo ""
    echo "Ready to upload to server!"

else
    echo "Usage:"
    echo "  ./deploy.sh package   - Create deployment package"
    echo "  ./deploy.sh update    - Update existing deployment"
    echo ""
    echo "Examples:"
    echo "  ./deploy.sh package"
    echo "  scp backend.tar.gz deploy@78.47.123.456:~/"
fi
