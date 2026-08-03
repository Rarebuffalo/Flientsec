"""policy_assignments

Revision ID: ea88fe687ae9
Revises: c62159670a42
Create Date: 2026-08-04 02:44:33.001209

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ea88fe687ae9'
down_revision: Union[str, None] = 'c62159670a42'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create policy_assignments table
    sa_uuid_type = sa.dialects.postgresql.UUID(as_uuid=True)
    op.create_table(
        'policy_assignments',
        sa.Column('id', sa_uuid_type, nullable=False),
        sa.Column('organization_id', sa_uuid_type, nullable=False),
        sa.Column('policy_id', sa_uuid_type, nullable=False),
        sa.Column('device_id', sa_uuid_type, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name='fk_policy_assignments_organization_id'),
        sa.ForeignKeyConstraint(['policy_id'], ['policies.id'], name='fk_policy_assignments_policy_id'),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], name='fk_policy_assignments_device_id'),
        sa.PrimaryKeyConstraint('id')
    )

    # 2. Add partial unique indexes
    op.create_index(
        'uq_org_default_assignment',
        'policy_assignments',
        ['organization_id'],
        unique=True,
        postgresql_where=sa.text('device_id IS NULL')
    )
    op.create_index(
        'uq_device_assignment',
        'policy_assignments',
        ['device_id'],
        unique=True,
        postgresql_where=sa.text('device_id IS NOT NULL')
    )


def downgrade() -> None:
    op.drop_index('uq_device_assignment', table_name='policy_assignments')
    op.drop_index('uq_org_default_assignment', table_name='policy_assignments')
    op.drop_table('policy_assignments')
