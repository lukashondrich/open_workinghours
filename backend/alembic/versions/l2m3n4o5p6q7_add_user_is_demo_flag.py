"""Add users.is_demo flag for demo/review accounts

Revision ID: l2m3n4o5p6q7
Revises: k1l2m3n4o5p6
Create Date: 2026-07-11

Demo accounts (e.g. Apple App Review) have publicly-known credentials, so
their submissions must never flow into the DP aggregation pipeline. The demo
login bypass also requires this flag, tying the env-configured credentials to
an explicitly flagged account.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "l2m3n4o5p6q7"
down_revision = "k1l2m3n4o5p6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_demo", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("users", "is_demo")
