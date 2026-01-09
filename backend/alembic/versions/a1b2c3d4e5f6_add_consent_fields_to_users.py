"""add_consent_fields_to_users

Revision ID: a1b2c3d4e5f6
Revises: 3369e37953a2
Create Date: 2026-01-07 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '3369e37953a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add GDPR consent tracking fields to users table."""
    op.add_column('users', sa.Column('terms_accepted_version', sa.String(length=20), nullable=True))
    op.add_column('users', sa.Column('privacy_accepted_version', sa.String(length=20), nullable=True))
    op.add_column('users', sa.Column('consent_accepted_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Remove GDPR consent tracking fields from users table."""
    op.drop_column('users', 'consent_accepted_at')
    op.drop_column('users', 'privacy_accepted_version')
    op.drop_column('users', 'terms_accepted_version')
