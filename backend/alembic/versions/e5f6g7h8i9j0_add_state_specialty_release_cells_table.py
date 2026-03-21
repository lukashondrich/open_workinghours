"""add_state_specialty_release_cells_table

Revision ID: e5f6g7h8i9j0
Revises: d4e5f6g7h8i9
Create Date: 2026-03-20 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e5f6g7h8i9j0'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6g7h8i9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'state_specialty_release_cells',
        sa.Column('cell_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('country_code', sa.String(length=3), nullable=False),
        sa.Column('state_code', sa.String(length=10), nullable=False),
        sa.Column('specialty', sa.String(length=100), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('cell_id'),
        sa.UniqueConstraint('country_code', 'state_code', 'specialty', name='uq_state_specialty_release_cell'),
    )
    op.create_index(op.f('ix_state_specialty_release_cells_state_code'), 'state_specialty_release_cells', ['state_code'], unique=False)
    op.create_index(op.f('ix_state_specialty_release_cells_specialty'), 'state_specialty_release_cells', ['specialty'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_state_specialty_release_cells_specialty'), table_name='state_specialty_release_cells')
    op.drop_index(op.f('ix_state_specialty_release_cells_state_code'), table_name='state_specialty_release_cells')
    op.drop_table('state_specialty_release_cells')
