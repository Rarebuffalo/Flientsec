"""finding_lifecycle

Revision ID: e4fa6db90d3d
Revises: ea88fe687ae9
Create Date: 2026-08-04 02:44:35.982039

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4fa6db90d3d'
down_revision: Union[str, None] = 'ea88fe687ae9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add columns to findings
    sa_uuid_type = sa.dialects.postgresql.UUID(as_uuid=True)
    op.add_column('findings', sa.Column('policy_id', sa_uuid_type, nullable=True))
    op.add_column('findings', sa.Column('rule_id', sa.String(), server_default='legacy.rule.id', nullable=True))
    op.add_column('findings', sa.Column('resolution_reason', sa.String(), nullable=True))
    op.add_column('findings', sa.Column('first_detected_at', sa.DateTime(), server_default=sa.func.now(), nullable=False))
    op.add_column('findings', sa.Column('last_detected_at', sa.DateTime(), server_default=sa.func.now(), nullable=False))

    # 2. Update existing status values to uppercase OPEN/RESOLVED
    op.execute("UPDATE findings SET status = 'OPEN' WHERE status = 'Open' OR status IS NULL")
    op.execute("UPDATE findings SET status = 'RESOLVED' WHERE status = 'Resolved'")
    
    # 3. Make reason column nullable
    op.alter_column('findings', 'reason', nullable=True)

    # 4. Add ForeignKey constraint for policy_id
    op.create_foreign_key(
        'fk_findings_policy_id',
        'findings',
        'policies',
        ['policy_id'],
        ['id']
    )

    # 5. Create partial unique index for active open findings
    op.create_index(
        'uq_active_finding',
        'findings',
        ['device_id', 'policy_id', 'rule_id'],
        unique=True,
        postgresql_where=sa.text("status = 'OPEN'")
    )


def downgrade() -> None:
    op.drop_index('uq_active_finding', table_name='findings')
    op.drop_constraint('fk_findings_policy_id', 'findings', type_='foreignkey')
    op.alter_column('findings', 'reason', nullable=False)
    
    op.drop_column('findings', 'last_detected_at')
    op.drop_column('findings', 'first_detected_at')
    op.drop_column('findings', 'resolution_reason')
    op.drop_column('findings', 'rule_id')
    op.drop_column('findings', 'policy_id')
