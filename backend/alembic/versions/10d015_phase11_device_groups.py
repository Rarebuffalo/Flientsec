"""phase11_device_groups_and_membership

Revision ID: 10d015_phase11
Revises: 9c014_phase9
Create Date: 2026-09-16 00:22:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '10d015_phase11'
down_revision: Union[str, None] = '9c014_phase9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add description and updated_at to device_groups table
    op.add_column('device_groups', sa.Column('description', sa.String(), nullable=True))
    op.add_column('device_groups', sa.Column('updated_at', sa.DateTime(), nullable=True, server_default=sa.text('now()')))
    
    # 2. Add unique constraint on (organization_id, name) in device_groups
    op.create_unique_constraint('uq_device_group_org_name', 'device_groups', ['organization_id', 'name'])

    # 3. Add group_id to devices table
    op.add_column('devices', sa.Column('group_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        'fk_devices_group_id',
        'devices',
        'device_groups',
        ['group_id'],
        ['id'],
        ondelete='SET NULL'
    )
    op.create_index('ix_devices_group_id', 'devices', ['group_id'])


def downgrade() -> None:
    op.drop_index('ix_devices_group_id', table_name='devices')
    op.drop_constraint('fk_devices_group_id', 'devices', type_='foreignkey')
    op.drop_column('devices', 'group_id')
    op.drop_constraint('uq_device_group_org_name', 'device_groups', type_='unique')
    op.drop_column('device_groups', 'updated_at')
    op.drop_column('device_groups', 'description')
