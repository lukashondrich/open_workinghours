"""Add social auth columns (auth_provider, provider_sub) and make email_hash nullable

Revision ID: j0k1l2m3n4o5
Revises: i9j0k1l2m3n4
Create Date: 2026-05-01 12:00:00.000000

Additive migration for Sign in with Apple + Google support.
- auth_provider: "apple" | "google" | NULL (email users)
- provider_sub: opaque provider user identifier
- email_hash: relaxed to nullable (social-auth users have no stored email)
- Composite unique constraint on (auth_provider, provider_sub)
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "j0k1l2m3n4o5"
down_revision = "i9j0k1l2m3n4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add social auth columns
    op.add_column("users", sa.Column("auth_provider", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("provider_sub", sa.String(255), nullable=True))
    op.create_index(op.f("ix_users_provider_sub"), "users", ["provider_sub"])

    # Make email_hash nullable (social-auth users don't have one)
    # PostgreSQL: ALTER COLUMN ... DROP NOT NULL
    # SQLite: no-op (SQLite doesn't enforce NOT NULL changes via ALTER)
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column("email_hash", existing_type=sa.String(64), nullable=True)

    # Composite uniqueness: one account per provider+sub pair
    op.create_unique_constraint("uq_user_auth_provider_sub", "users", ["auth_provider", "provider_sub"])


def downgrade() -> None:
    op.drop_constraint("uq_user_auth_provider_sub", "users", type_="unique")
    op.drop_index(op.f("ix_users_provider_sub"), table_name="users")
    op.drop_column("users", "provider_sub")
    op.drop_column("users", "auth_provider")

    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column("email_hash", existing_type=sa.String(64), nullable=False)
