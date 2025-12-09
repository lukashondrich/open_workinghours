#!/usr/bin/env python
"""
Generate synthetic test data for aggregation testing.

Creates users and work events to test k-anonymity + differential privacy.
"""
import random
from datetime import date, timedelta
from uuid import uuid4

from app.database import get_db
from app.models import User, WorkEvent
from app.security import hash_email

# Test data configuration
STATES = ["BY", "BE", "NW", "HH", "HE"]  # German states (Bavaria, Berlin, NRW, Hamburg, Hesse)
SPECIALTIES = ["surgery", "cardiology", "pediatrics", "internal_medicine", "emergency"]
ROLES = ["resident", "specialist", "senior", "chief"]
HOSPITALS = ["charite-berlin", "uniklinik-muenchen", "uniklinik-koeln", "asklepios-hamburg"]

# Number of users per group
# Some groups will have < 10 users (should be suppressed)
# Some groups will have >= 10 users (should be published)
USERS_PER_GROUP = {
    ("BY", "surgery", "resident"): 15,  # Should be published
    ("BY", "surgery", "specialist"): 12,  # Should be published
    ("BY", "cardiology", "resident"): 8,  # Should be suppressed
    ("BE", "cardiology", "specialist"): 20,  # Should be published
    ("BE", "pediatrics", "resident"): 5,  # Should be suppressed
    ("NW", "internal_medicine", "specialist"): 18,  # Should be published
    ("NW", "emergency", "resident"): 11,  # Should be published
    ("HH", "surgery", "senior"): 6,  # Should be suppressed
}


def create_synthetic_data(target_week_start: date):
    """
    Create synthetic users and work events for testing.

    Args:
        target_week_start: Monday of the week to create data for
    """
    db = next(get_db())

    try:
        print(f"Creating synthetic data for week starting {target_week_start}...")

        users_created = 0
        events_created = 0

        for (state, specialty, role), n_users in USERS_PER_GROUP.items():
            print(f"\nCreating group: {state}/{specialty}/{role} (n={n_users})")

            for i in range(n_users):
                # Create user
                email = f"test_{state}_{specialty}_{role}_{i}@example.com"
                email_hash_value = hash_email(email)

                # Check if user already exists
                existing_user = (
                    db.query(User)
                    .filter(User.email_hash == email_hash_value)
                    .one_or_none()
                )

                if existing_user:
                    user = existing_user
                    print(f"  User {i+1}/{n_users} already exists")
                else:
                    user = User(
                        email_hash=email_hash_value,
                        hospital_id=random.choice(HOSPITALS),
                        specialty=specialty,
                        role_level=role,
                        state_code=state,
                        country_code="DEU",
                    )
                    db.add(user)
                    db.flush()  # Get user_id
                    users_created += 1
                    print(f"  Created user {i+1}/{n_users}")

                # Create work events for each day of the week
                for day_offset in range(7):  # Monday to Sunday
                    event_date = target_week_start + timedelta(days=day_offset)

                    # Check if event already exists
                    existing_event = (
                        db.query(WorkEvent)
                        .filter(
                            WorkEvent.user_id == user.user_id,
                            WorkEvent.date == event_date,
                        )
                        .one_or_none()
                    )

                    if existing_event:
                        continue

                    # Random realistic hours
                    planned_hours = random.choice([8.0, 9.0, 10.0, 12.0])
                    # Actual hours: usually close to planned, sometimes overtime
                    actual_hours = planned_hours + random.uniform(-1.0, 3.0)
                    actual_hours = max(0, min(24, actual_hours))  # Clamp to 0-24

                    source = random.choice(["geofence", "manual", "mixed"])

                    event = WorkEvent(
                        user_id=user.user_id,
                        date=event_date,
                        planned_hours=planned_hours,
                        actual_hours=round(actual_hours, 2),
                        source=source,
                    )
                    db.add(event)
                    events_created += 1

        db.commit()

        print(f"\n✅ Synthetic data created:")
        print(f"   Users: {users_created} new (total: {db.query(User).count()})")
        print(f"   Work events: {events_created} new (total: {db.query(WorkEvent).count()})")

        # Summary by group
        print(f"\n📊 Expected aggregation results:")
        for (state, specialty, role), n_users in USERS_PER_GROUP.items():
            status = "✅ PUBLISHED" if n_users >= 10 else "🔴 SUPPRESSED"
            print(f"   {state}/{specialty}/{role}: n={n_users} → {status}")

    finally:
        db.close()


if __name__ == "__main__":
    # Create data for the current ISO week
    today = date.today()
    # Find Monday of current week
    monday = today - timedelta(days=today.weekday())

    create_synthetic_data(monday)
