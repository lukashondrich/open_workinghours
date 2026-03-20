"""add_publication_status_to_stats_tables

Revision ID: d4e5f6g7h8i9
Revises: c3d4e5f6g7h8
Create Date: 2026-03-20 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6g7h8i9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6g7h8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'stats_by_state_specialty',
        sa.Column('publication_status', sa.String(length=20), nullable=False, server_default='published'),
    )
    op.add_column(
        'stats_by_hospital',
        sa.Column('publication_status', sa.String(length=20), nullable=False, server_default='published'),
    )


def downgrade() -> None:
    op.drop_column('stats_by_hospital', 'publication_status')
    op.drop_column('stats_by_state_specialty', 'publication_status')
