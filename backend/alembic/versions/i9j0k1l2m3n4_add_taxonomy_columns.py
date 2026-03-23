"""Add taxonomy columns (profession, seniority, department_group, specialization_code, hospital_ref_id)

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
Create Date: 2026-03-23 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "i9j0k1l2m3n4"
down_revision = "h8i9j0k1l2m3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- User table ---
    op.add_column("users", sa.Column("profession", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("seniority", sa.String(30), nullable=True))
    op.add_column("users", sa.Column("department_group", sa.String(50), nullable=True))
    op.add_column("users", sa.Column("specialization_code", sa.String(10), nullable=True))
    op.add_column("users", sa.Column("hospital_ref_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_users_profession"), "users", ["profession"])
    op.create_index(op.f("ix_users_seniority"), "users", ["seniority"])
    op.create_index(op.f("ix_users_department_group"), "users", ["department_group"])
    op.create_index(op.f("ix_users_specialization_code"), "users", ["specialization_code"])
    op.create_index(op.f("ix_users_hospital_ref_id"), "users", ["hospital_ref_id"])

    # --- FinalizedUserWeek table ---
    op.add_column("finalized_user_weeks", sa.Column("profession", sa.String(20), nullable=True))
    op.add_column("finalized_user_weeks", sa.Column("seniority", sa.String(30), nullable=True))
    op.add_column("finalized_user_weeks", sa.Column("department_group", sa.String(50), nullable=True))
    op.add_column("finalized_user_weeks", sa.Column("specialization_code", sa.String(10), nullable=True))
    op.add_column("finalized_user_weeks", sa.Column("hospital_ref_id", sa.Integer(), nullable=True))

    # --- StatsByStateSpecialty table ---
    op.add_column("stats_by_state_specialty", sa.Column("department_group", sa.String(50), nullable=True))
    op.create_index(op.f("ix_stats_by_state_specialty_department_group"), "stats_by_state_specialty", ["department_group"])


def downgrade() -> None:
    # --- StatsByStateSpecialty table ---
    op.drop_index(op.f("ix_stats_by_state_specialty_department_group"), table_name="stats_by_state_specialty")
    op.drop_column("stats_by_state_specialty", "department_group")

    # --- FinalizedUserWeek table ---
    op.drop_column("finalized_user_weeks", "hospital_ref_id")
    op.drop_column("finalized_user_weeks", "specialization_code")
    op.drop_column("finalized_user_weeks", "department_group")
    op.drop_column("finalized_user_weeks", "seniority")
    op.drop_column("finalized_user_weeks", "profession")

    # --- User table ---
    op.drop_index(op.f("ix_users_hospital_ref_id"), table_name="users")
    op.drop_index(op.f("ix_users_specialization_code"), table_name="users")
    op.drop_index(op.f("ix_users_department_group"), table_name="users")
    op.drop_index(op.f("ix_users_seniority"), table_name="users")
    op.drop_index(op.f("ix_users_profession"), table_name="users")
    op.drop_column("users", "hospital_ref_id")
    op.drop_column("users", "specialization_code")
    op.drop_column("users", "department_group")
    op.drop_column("users", "seniority")
    op.drop_column("users", "profession")
