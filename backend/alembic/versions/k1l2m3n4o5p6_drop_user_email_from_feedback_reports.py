"""Drop user_email column from feedback_reports

Revision ID: k1l2m3n4o5p6
Revises: j0k1l2m3n4o5
Create Date: 2026-05-22 10:00:00.000000

The column has always been written as NULL (privacy-by-design), see
routers/feedback.py. Removing the column and stopping the mobile app
from transmitting the email makes the privacy-by-design choice explicit
at every layer (wire, schema, DB).
"""
from alembic import op
import sqlalchemy as sa


revision = "k1l2m3n4o5p6"
down_revision = "j0k1l2m3n4o5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("feedback_reports") as batch_op:
        batch_op.drop_column("user_email")


def downgrade() -> None:
    with op.batch_alter_table("feedback_reports") as batch_op:
        batch_op.add_column(sa.Column("user_email", sa.String(255), nullable=True))
