#!/usr/bin/env python3
"""
Seed demo user for Apple App Store review.

This script creates a demo user account that can be used by Apple reviewers
to test the app without needing real email verification.

Usage:
    # Set environment variables first (or use .env file)
    DEMO__EMAIL=demo@openworkinghours.org
    DEMO__CODE=123456

    # Run the script
    cd backend
    python scripts/seed_demo_user.py

    # Or with Docker
    docker exec -it backend python scripts/seed_demo_user.py
"""
from __future__ import annotations

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import get_settings
from app.database import SessionLocal, engine
from app.models import Base, User
from app.security import hash_email


def seed_demo_user() -> None:
    """Create the demo user if DEMO settings are configured."""
    settings = get_settings()

    if settings.demo is None:
        print("ERROR: Demo settings not configured.")
        print("Set DEMO__EMAIL and DEMO__CODE environment variables.")
        sys.exit(1)

    demo_email = settings.demo.email.lower()
    demo_code = settings.demo.code
    email_hash = hash_email(demo_email)

    print(f"Demo account configuration:")
    print(f"  Email: {demo_email}")
    print(f"  Code: {demo_code}")
    print(f"  Email hash: {email_hash[:16]}...")

    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.email_hash == email_hash).first()

        if existing_user:
            print(f"\n✓ Demo user already exists (ID: {existing_user.user_id})")
            print("  No action needed.")
            return

        # Create demo user with realistic test data
        demo_user = User(
            email_hash=email_hash,
            hospital_id="demo-hospital-001",
            specialty="Internal Medicine",
            role_level="Resident",
            state_code="BY",  # Bavaria
            country_code="DEU",
        )

        db.add(demo_user)
        db.commit()
        db.refresh(demo_user)

        print(f"\n✓ Demo user created successfully!")
        print(f"  User ID: {demo_user.user_id}")
        print(f"  Hospital: {demo_user.hospital_id}")
        print(f"  Specialty: {demo_user.specialty}")
        print(f"  Role: {demo_user.role_level}")
        print(f"  State: {demo_user.state_code}")

        print(f"\n📱 Apple App Review credentials:")
        print(f"  Email: {demo_email}")
        print(f"  Verification Code: {demo_code}")

    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_user()
