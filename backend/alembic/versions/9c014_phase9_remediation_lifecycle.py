"""phase9_remediation_lifecycle

Revision ID: 9c014_phase9
Revises: 8b013_phase8
Create Date: 2026-08-21 00:05:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '9c014_phase9'
down_revision: Union[str, None] = '8b013_phase8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add lifecycle tracking columns to findings table
    op.add_column('findings', sa.Column('acknowledged_at', sa.DateTime(), nullable=True))
    op.add_column('findings', sa.Column('acknowledged_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True))
    op.add_column('findings', sa.Column('remediation_started_at', sa.DateTime(), nullable=True))
    op.add_column('findings', sa.Column('remediation_started_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True))
    op.add_column('findings', sa.Column('remediation_note', sa.String(), nullable=True))
    op.add_column('findings', sa.Column('waived_at', sa.DateTime(), nullable=True))
    op.add_column('findings', sa.Column('waived_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True))
    op.add_column('findings', sa.Column('waiver_reason', sa.String(), nullable=True))
    op.add_column('findings', sa.Column('waiver_expires_at', sa.DateTime(), nullable=True))
    op.add_column('findings', sa.Column('waiver_owner', sa.String(), nullable=True))
    op.add_column('findings', sa.Column('waiver_ticket_id', sa.String(), nullable=True))

    # 2. Update unique active finding index to cover all non-resolved states
    op.drop_index('uq_active_finding', table_name='findings')
    op.create_index(
        'uq_active_finding',
        'findings',
        ['device_id', 'policy_id', 'rule_id'],
        unique=True,
        postgresql_where=sa.text("status != 'RESOLVED'")
    )


def downgrade() -> None:
    # Restore previous index
    op.drop_index('uq_active_finding', table_name='findings')
    op.create_index(
        'uq_active_finding',
        'findings',
        ['device_id', 'policy_id', 'rule_id'],
        unique=True,
        postgresql_where=sa.text("status = 'OPEN'")
    )

    # Drop added columns
    op.drop_column('findings', 'waiver_ticket_id')
    op.drop_column('findings', 'waiver_owner')
    op.drop_column('findings', 'waiver_expires_at')
    op.drop_column('findings', 'waiver_reason')
    op.drop_column('findings', 'waived_by_id')
    op.drop_column('findings', 'waived_at')
    op.drop_column('findings', 'remediation_note')
    op.drop_column('findings', 'remediation_started_by_id')
    op.drop_column('findings', 'remediation_started_at')
    op.drop_column('findings', 'acknowledged_by_id')
    op.drop_column('findings', 'acknowledged_at')
