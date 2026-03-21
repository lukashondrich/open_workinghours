"""add_user_privacy_ledger_table

Revision ID: g7h8i9j0k1l2
Revises: f6g7h8i9j0k1
Create Date: 2026-03-20 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'g7h8i9j0k1l2'
down_revision: Union[str, Sequence[str], None] = 'f6g7h8i9j0k1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'user_privacy_ledger',
        sa.Column('entry_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('period_start', sa.Date(), nullable=False),
        sa.Column('family_key', sa.String(length=50), nullable=False, server_default='state_specialty_v1'),
        sa.Column('cell_key', sa.String(length=255), nullable=False),
        sa.Column('epsilon_spent', sa.Numeric(precision=6, scale=3), nullable=False),
        sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('entry_id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], ondelete='CASCADE'),
        sa.UniqueConstraint(
            'user_id', 'period_start', 'family_key', 'cell_key',
            name='uq_user_privacy_ledger',
        ),
    )
    op.create_index(
        op.f('ix_user_privacy_ledger_user_id'),
        'user_privacy_ledger',
        ['user_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_user_privacy_ledger_period_start'),
        'user_privacy_ledger',
        ['period_start'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_user_privacy_ledger_period_start'), table_name='user_privacy_ledger')
    op.drop_index(op.f('ix_user_privacy_ledger_user_id'), table_name='user_privacy_ledger')
    op.drop_table('user_privacy_ledger')
