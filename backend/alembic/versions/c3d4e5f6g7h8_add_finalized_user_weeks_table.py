"""add_finalized_user_weeks_table

Revision ID: c3d4e5f6g7h8
Revises: b2c3d4e5f6g7
Create Date: 2026-03-19 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6g7h8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6g7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'finalized_user_weeks',
        sa.Column('finalized_week_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('week_start', sa.Date(), nullable=False),
        sa.Column('week_end', sa.Date(), nullable=False),
        sa.Column('planned_hours', sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column('actual_hours', sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column('hospital_id', sa.String(length=255), nullable=False),
        sa.Column('specialty', sa.String(length=100), nullable=False),
        sa.Column('role_level', sa.String(length=50), nullable=False),
        sa.Column('state_code', sa.String(length=10), nullable=True),
        sa.Column('country_code', sa.String(length=3), nullable=False),
        sa.Column('finalized_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('finalized_week_id'),
        sa.UniqueConstraint('user_id', 'week_start', name='uq_finalized_user_week_user_start'),
    )
    op.create_index(op.f('ix_finalized_user_weeks_user_id'), 'finalized_user_weeks', ['user_id'], unique=False)
    op.create_index(op.f('ix_finalized_user_weeks_week_start'), 'finalized_user_weeks', ['week_start'], unique=False)
    op.create_index(op.f('ix_finalized_user_weeks_hospital_id'), 'finalized_user_weeks', ['hospital_id'], unique=False)
    op.create_index(op.f('ix_finalized_user_weeks_specialty'), 'finalized_user_weeks', ['specialty'], unique=False)
    op.create_index(op.f('ix_finalized_user_weeks_state_code'), 'finalized_user_weeks', ['state_code'], unique=False)
    op.create_index(op.f('ix_finalized_user_weeks_finalized_at'), 'finalized_user_weeks', ['finalized_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_finalized_user_weeks_finalized_at'), table_name='finalized_user_weeks')
    op.drop_index(op.f('ix_finalized_user_weeks_state_code'), table_name='finalized_user_weeks')
    op.drop_index(op.f('ix_finalized_user_weeks_specialty'), table_name='finalized_user_weeks')
    op.drop_index(op.f('ix_finalized_user_weeks_hospital_id'), table_name='finalized_user_weeks')
    op.drop_index(op.f('ix_finalized_user_weeks_week_start'), table_name='finalized_user_weeks')
    op.drop_index(op.f('ix_finalized_user_weeks_user_id'), table_name='finalized_user_weeks')
    op.drop_table('finalized_user_weeks')
