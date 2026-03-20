#!/usr/bin/env python3
"""
Local PostgreSQL Migration Test

Verifies that Alembic migrations apply cleanly to PostgreSQL and that
the dp_group_stats tables work correctly with real UUID/Numeric types.

Prerequisites:
  - Running PostgreSQL instance (e.g., docker compose up -d db)
  - psycopg installed (pip install psycopg[binary])

Usage:
  # Using docker-compose PG (default owh/owh@localhost:5432/owh)
  python scripts/test_migrations_pg.py

  # Custom connection
  python scripts/test_migrations_pg.py --db-url postgresql+psycopg://user:pass@host:5432/dbname

  # Keep test database after run
  python scripts/test_migrations_pg.py --keep
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import os
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

# ---------------------------------------------------------------------------
# Make app importable
# ---------------------------------------------------------------------------
_BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND_DIR))

os.chdir(_BACKEND_DIR)


def check_psycopg() -> None:
    try:
        import psycopg  # noqa: F401
    except ImportError:
        print("ERROR: psycopg not installed. Run: pip install 'psycopg[binary]'", file=sys.stderr)
        sys.exit(1)


def run_alembic_upgrade(db_url: str) -> bool:
    """Run alembic upgrade head with the given database URL."""
    env = os.environ.copy()
    # Override database URL for alembic env.py
    env["DATABASE__URL"] = db_url
    # Provide required security settings (not used by migrations, but needed by get_settings)
    env.setdefault("SECURITY__SECRET_KEY", "test" * 8)
    env.setdefault("SECURITY__EMAIL_HASH_SECRET", "test" * 8)

    print("Running: alembic upgrade head")
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=str(_BACKEND_DIR),
        env=env,
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        print(f"FAIL: alembic upgrade head\n{result.stderr}", file=sys.stderr)
        return False

    print(f"  OK: migrations applied\n{result.stdout.strip()}")
    return True


def verify_tables(db_url: str) -> bool:
    """Verify all dp_group_stats tables exist with correct columns."""
    from sqlalchemy import create_engine, inspect

    engine = create_engine(db_url)
    inspector = inspect(engine)
    tables = inspector.get_table_names()

    expected_tables = [
        "state_specialty_release_cells",
        "state_specialty_privacy_ledger",
        "user_privacy_ledger",
        "finalized_user_weeks",
    ]

    ok = True
    for t in expected_tables:
        if t in tables:
            cols = [c["name"] for c in inspector.get_columns(t)]
            print(f"  OK: {t} ({len(cols)} columns: {', '.join(cols)})")
        else:
            print(f"  FAIL: table {t} not found", file=sys.stderr)
            ok = False

    engine.dispose()
    return ok


def insert_test_rows(db_url: str) -> bool:
    """Insert one row into each new table and verify round-trip."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from app.models import (
        Base,
        FinalizedUserWeek,
        StateSpecialtyPrivacyLedger,
        StateSpecialtyReleaseCell,
        User,
        UserPrivacyLedger,
    )

    engine = create_engine(db_url)
    ok = True

    with Session(engine) as db:
        try:
            # Create a test user first (needed for FK constraints)
            test_user_id = uuid4()
            user = User(
                user_id=test_user_id,
                email_hash="test_migration_" + uuid4().hex[:16],
                hospital_id="test-hospital",
                specialty="cardiology",
                role_level="group_a",
                state_code="BY",
                country_code="DEU",
            )
            db.add(user)
            db.flush()
            print(f"  OK: User inserted (id={test_user_id})")

            # StateSpecialtyReleaseCell
            cell = StateSpecialtyReleaseCell(
                country_code="DEU",
                state_code="BY",
                specialty="cardiology",
                is_enabled=True,
            )
            db.add(cell)
            db.flush()
            print(f"  OK: StateSpecialtyReleaseCell inserted (id={cell.cell_id})")

            # FinalizedUserWeek
            week_start = date(2026, 1, 5)
            fuw = FinalizedUserWeek(
                user_id=test_user_id,
                week_start=week_start,
                week_end=week_start + timedelta(days=6),
                planned_hours=Decimal("40.00"),
                actual_hours=Decimal("45.50"),
                hospital_id="test-hospital",
                specialty="cardiology",
                role_level="group_a",
                state_code="BY",
                country_code="DEU",
            )
            db.add(fuw)
            db.flush()
            print(f"  OK: FinalizedUserWeek inserted (id={fuw.finalized_week_id})")

            # StateSpecialtyPrivacyLedger
            ledger = StateSpecialtyPrivacyLedger(
                country_code="DEU",
                state_code="BY",
                specialty="cardiology",
                period_start=week_start,
                mechanism="laplace",
                publication_status="published",
                planned_sum_epsilon=Decimal("0.300"),
                actual_sum_epsilon=Decimal("0.700"),
                total_epsilon=Decimal("1.000"),
            )
            db.add(ledger)
            db.flush()
            print(f"  OK: StateSpecialtyPrivacyLedger inserted (id={ledger.entry_id})")

            # UserPrivacyLedger
            upl = UserPrivacyLedger(
                user_id=test_user_id,
                period_start=week_start,
                family_key="state_specialty_v1",
                cell_key="DEU/BY/cardiology",
                epsilon_spent=Decimal("1.000"),
            )
            db.add(upl)
            db.flush()
            print(f"  OK: UserPrivacyLedger inserted (id={upl.entry_id})")

            db.rollback()
            print("  OK: All inserts verified (rolled back)")

        except Exception as e:
            db.rollback()
            print(f"  FAIL: {e}", file=sys.stderr)
            ok = False

    engine.dispose()
    return ok


def test_accounting_functions(db_url: str) -> bool:
    """Test the accounting module functions with a minimal synthetic dataset."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from app.models import FinalizedUserWeek, User
    from app.dp_group_stats.accounting import (
        EpsilonBreakdown,
        record_state_specialty_ledger_entry,
        record_user_ledger_entries,
        state_specialty_spent,
        user_cumulative_spent,
    )

    engine = create_engine(db_url)
    ok = True

    with Session(engine) as db:
        try:
            # Create 11 test users in BY/cardiology
            user_ids = []
            for i in range(11):
                uid = uuid4()
                user = User(
                    user_id=uid,
                    email_hash=f"acct_test_{uuid4().hex[:12]}",
                    hospital_id="test-hospital",
                    specialty="cardiology",
                    role_level="group_a",
                    state_code="BY",
                    country_code="DEU",
                )
                db.add(user)
                user_ids.append(uid)
            db.flush()
            print(f"  OK: Created 11 test users")

            cell_key = ("DEU", "BY", "cardiology")
            week1 = date(2026, 1, 5)
            week2 = date(2026, 1, 12)

            # Record ledger entries for 2 weeks
            for week in [week1, week2]:
                breakdown = EpsilonBreakdown(planned_sum=0.3, actual_sum=0.7)
                entry = record_state_specialty_ledger_entry(
                    db,
                    cell_key=cell_key,
                    period_start=week,
                    breakdown=breakdown,
                    publication_status="published",
                )
                print(f"  OK: Cell ledger entry for {week} (id={entry.entry_id})")

                n_created = record_user_ledger_entries(
                    db,
                    cell_key=cell_key,
                    period_start=week,
                    user_ids=user_ids,
                    epsilon_per_user=1.0,
                )
                print(f"  OK: User ledger entries: {n_created} created")

            db.flush()

            # Verify totals
            cell_total = state_specialty_spent(db, cell_key=cell_key)
            print(f"  OK: Cell total ε = {cell_total:.3f} (expected 2.000)")
            if abs(cell_total - 2.0) > 0.01:
                print(f"  FAIL: Expected 2.0, got {cell_total}", file=sys.stderr)
                ok = False

            user_total = user_cumulative_spent(db, user_id=user_ids[0])
            print(f"  OK: User[0] total ε = {user_total:.3f} (expected 2.000)")
            if abs(user_total - 2.0) > 0.01:
                print(f"  FAIL: Expected 2.0, got {user_total}", file=sys.stderr)
                ok = False

            # Test idempotency (re-recording same period should not duplicate)
            n_dup = record_user_ledger_entries(
                db,
                cell_key=cell_key,
                period_start=week1,
                user_ids=user_ids,
                epsilon_per_user=1.0,
            )
            print(f"  OK: Duplicate insert created {n_dup} rows (expected 0)")
            if n_dup != 0:
                print(f"  FAIL: Expected 0 duplicates, got {n_dup}", file=sys.stderr)
                ok = False

            db.rollback()
            print("  OK: Accounting functions verified (rolled back)")

        except Exception as e:
            db.rollback()
            print(f"  FAIL: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc()
            ok = False

    engine.dispose()
    return ok


def main() -> None:
    parser = argparse.ArgumentParser(description="Test Alembic migrations on PostgreSQL")
    parser.add_argument(
        "--db-url",
        default="postgresql+psycopg://owh:owh@localhost:5432/owh",
        help="PostgreSQL connection URL (default: owh/owh@localhost:5432/owh)",
    )
    parser.add_argument("--keep", action="store_true", help="Keep test data (don't roll back)")
    args = parser.parse_args()

    check_psycopg()

    print(f"=== PostgreSQL Migration Test ===")
    print(f"DB: {args.db_url}\n")

    steps = [
        ("Step 1: Run Alembic migrations", lambda: run_alembic_upgrade(args.db_url)),
        ("Step 2: Verify table structure", lambda: verify_tables(args.db_url)),
        ("Step 3: Insert test rows", lambda: insert_test_rows(args.db_url)),
        ("Step 4: Test accounting functions", lambda: test_accounting_functions(args.db_url)),
    ]

    all_ok = True
    for name, fn in steps:
        print(f"\n{name}")
        print("-" * len(name))
        if not fn():
            all_ok = False
            print(f"\n  STOPPED: {name} failed", file=sys.stderr)
            break

    print(f"\n{'=' * 40}")
    if all_ok:
        print("PASS: All migration tests passed")
    else:
        print("FAIL: Some tests failed", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
