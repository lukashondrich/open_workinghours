"""add_period_type_and_ci_columns

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
Create Date: 2026-03-21 12:00:00.000000

Covers Gap 3 (period_type) and Gap 4 (CI columns).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'h8i9j0k1l2m3'
down_revision: Union[str, Sequence[str], None] = 'g7h8i9j0k1l2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Gap 3: period_type on stats and ledger tables
    op.add_column(
        'stats_by_state_specialty',
        sa.Column('period_type', sa.String(length=10), nullable=False, server_default='weekly'),
    )
    op.add_column(
        'state_specialty_privacy_ledger',
        sa.Column('period_type', sa.String(length=10), nullable=False, server_default='weekly'),
    )

    # Gap 4: CI columns on stats table
    op.add_column(
        'stats_by_state_specialty',
        sa.Column('planned_ci_half', sa.Numeric(precision=6, scale=2), nullable=True),
    )
    op.add_column(
        'stats_by_state_specialty',
        sa.Column('actual_ci_half', sa.Numeric(precision=6, scale=2), nullable=True),
    )
    op.add_column(
        'stats_by_state_specialty',
        sa.Column('overtime_ci_half', sa.Numeric(precision=6, scale=2), nullable=True),
    )
    op.add_column(
        'stats_by_state_specialty',
        sa.Column('n_display', sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('stats_by_state_specialty', 'n_display')
    op.drop_column('stats_by_state_specialty', 'overtime_ci_half')
    op.drop_column('stats_by_state_specialty', 'actual_ci_half')
    op.drop_column('stats_by_state_specialty', 'planned_ci_half')
    op.drop_column('state_specialty_privacy_ledger', 'period_type')
    op.drop_column('stats_by_state_specialty', 'period_type')
