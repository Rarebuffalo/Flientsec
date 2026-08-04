"""add_drift_type_and_event_tracking

Revision ID: ff2174b4b19a
Revises: 012dd382a1ea
Create Date: 2026-08-04 17:49:44.631896

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ff2174b4b19a'
down_revision: Union[str, None] = '012dd382a1ea'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Normalize existing mixed-case status values
    op.execute(
        "UPDATE findings SET status = 'OPEN' "
        "WHERE status = 'Open' OR status = 'open'"
    )
    op.execute(
        "UPDATE findings SET status = 'RESOLVED' "
        "WHERE status = 'Resolved' OR status = 'resolved'"
    )

    # 2. Add columns
    sa_uuid_type = sa.dialects.postgresql.UUID(as_uuid=True)
    op.add_column(
        'findings',
        sa.Column('drift_type', sa.String(), nullable=True)
    )
    op.add_column(
        'events',
        sa.Column('finding_id', sa_uuid_type, nullable=True)
    )
    op.add_column(
        'events',
        sa.Column('policy_version_id', sa_uuid_type, nullable=True)
    )

    # 3. Create foreign key constraints
    op.create_foreign_key(
        'fk_events_finding_id',
        'events',
        'findings',
        ['finding_id'],
        ['id']
    )
    op.create_foreign_key(
        'fk_events_policy_version_id',
        'events',
        'policy_versions',
        ['policy_version_id'],
        ['id']
    )


def downgrade() -> None:
    op.drop_constraint('fk_events_policy_version_id', 'events', type_='foreignkey')
    op.drop_constraint('fk_events_finding_id', 'events', type_='foreignkey')
    op.drop_column('events', 'policy_version_id')
    op.drop_column('events', 'finding_id')
    op.drop_column('findings', 'drift_type')
