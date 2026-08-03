"""policy_versioning_foundation

Revision ID: c62159670a42
Revises: 
Create Date: 2026-08-04 02:44:27.283849

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c62159670a42'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add status, content, and content_hash to policy_versions
    op.add_column('policy_versions', sa.Column('status', sa.String(), server_default='DRAFT', nullable=False))
    op.add_column('policy_versions', sa.Column('content', sa.String(), nullable=True))
    op.add_column('policy_versions', sa.Column('content_hash', sa.String(), nullable=True))

    # 2. Add active_version_id to policies
    op.add_column('policies', sa.Column('active_version_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_policy_active_version_id',
        'policies',
        'policy_versions',
        ['active_version_id'],
        ['id'],
        use_alter=True
    )

    # 3. Add policy_version_id and content_hash to check_runs
    sa_uuid_type = sa.dialects.postgresql.UUID(as_uuid=True)
    op.add_column('check_runs', sa.Column('policy_version_id', sa_uuid_type, nullable=True))
    op.add_column('check_runs', sa.Column('content_hash', sa.String(), nullable=True))
    op.create_foreign_key(
        'fk_check_runs_policy_version_id',
        'check_runs',
        'policy_versions',
        ['policy_version_id'],
        ['id']
    )


def downgrade() -> None:
    op.drop_constraint('fk_check_runs_policy_version_id', 'check_runs', type_='foreignkey')
    op.drop_column('check_runs', 'content_hash')
    op.drop_column('check_runs', 'policy_version_id')

    op.drop_constraint('fk_policy_active_version_id', 'policies', type_='foreignkey')
    op.drop_column('policies', 'active_version_id')

    op.drop_column('policy_versions', 'content_hash')
    op.drop_column('policy_versions', 'content')
    op.drop_column('policy_versions', 'status')
