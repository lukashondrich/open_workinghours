"""add_state_specialty_privacy_ledger_table

Revision ID: f6g7h8i9j0k1
Revises: e5f6g7h8i9j0
Create Date: 2026-03-20 14:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'f6g7h8i9j0k1'
down_revision: Union[str, Sequence[str], None] = 'e5f6g7h8i9j0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'state_specialty_privacy_ledger',
        sa.Column('entry_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('country_code', sa.String(length=3), nullable=False),
        sa.Column('state_code', sa.String(length=10), nullable=False),
        sa.Column('specialty', sa.String(length=100), nullable=False),
        sa.Column('period_start', sa.Date(), nullable=False),
        sa.Column('mechanism', sa.String(length=50), nullable=False, server_default='laplace'),
        sa.Column('publication_status', sa.String(length=20), nullable=False, server_default='published'),
        sa.Column('planned_sum_epsilon', sa.Numeric(precision=6, scale=3), nullable=False),
        sa.Column('actual_sum_epsilon', sa.Numeric(precision=6, scale=3), nullable=False),
        sa.Column('total_epsilon', sa.Numeric(precision=6, scale=3), nullable=False),
        sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('entry_id'),
        sa.UniqueConstraint(
            'country_code',
            'state_code',
            'specialty',
            'period_start',
            name='uq_state_specialty_privacy_ledger',
        ),
    )
    op.create_index(
        op.f('ix_state_specialty_privacy_ledger_period_start'),
        'state_specialty_privacy_ledger',
        ['period_start'],
        unique=False,
    )
    op.create_index(
        op.f('ix_state_specialty_privacy_ledger_specialty'),
        'state_specialty_privacy_ledger',
        ['specialty'],
        unique=False,
    )
    op.create_index(
        op.f('ix_state_specialty_privacy_ledger_state_code'),
        'state_specialty_privacy_ledger',
        ['state_code'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_state_specialty_privacy_ledger_state_code'), table_name='state_specialty_privacy_ledger')
    op.drop_index(op.f('ix_state_specialty_privacy_ledger_specialty'), table_name='state_specialty_privacy_ledger')
    op.drop_index(op.f('ix_state_specialty_privacy_ledger_period_start'), table_name='state_specialty_privacy_ledger')
    op.drop_table('state_specialty_privacy_ledger')
