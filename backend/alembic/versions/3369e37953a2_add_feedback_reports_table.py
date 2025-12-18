"""add_feedback_reports_table

Revision ID: 3369e37953a2
Revises: 6d8399490741
Create Date: 2025-12-18 12:31:06.207958

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '3369e37953a2'
down_revision: Union[str, Sequence[str], None] = '6d8399490741'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'feedback_reports',
        sa.Column('report_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.String(length=255), nullable=True),
        sa.Column('user_email', sa.String(length=255), nullable=True),
        sa.Column('hospital_id', sa.String(length=255), nullable=True),
        sa.Column('specialty', sa.String(length=100), nullable=True),
        sa.Column('role_level', sa.String(length=50), nullable=True),
        sa.Column('state_code', sa.String(length=10), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('app_state', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('resolved', sa.String(length=20), nullable=False),
        sa.PrimaryKeyConstraint('report_id')
    )
    op.create_index(op.f('ix_feedback_reports_created_at'), 'feedback_reports', ['created_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_feedback_reports_created_at'), table_name='feedback_reports')
    op.drop_table('feedback_reports')
