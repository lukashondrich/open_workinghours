"""add_institution_inquiries_table

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2026-01-17 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6g7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create institution_inquiries table for public dashboard contact form."""
    op.create_table(
        'institution_inquiries',
        sa.Column('inquiry_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('organization', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=100), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('responded_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('inquiry_id')
    )
    op.create_index(
        op.f('ix_institution_inquiries_created_at'),
        'institution_inquiries',
        ['created_at'],
        unique=False
    )


def downgrade() -> None:
    """Drop institution_inquiries table."""
    op.drop_index(op.f('ix_institution_inquiries_created_at'), table_name='institution_inquiries')
    op.drop_table('institution_inquiries')
