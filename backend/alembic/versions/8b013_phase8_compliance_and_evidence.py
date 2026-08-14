"""phase8_compliance_and_evidence

Revision ID: 8b013_phase8
Revises: 7a012_phase7
Create Date: 2026-08-15 04:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '8b013_phase8'
down_revision: Union[str, None] = '7a012_phase7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create compliance_controls table
    op.create_table(
        'compliance_controls',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=True),
        sa.Column('control_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=False),
        sa.Column('category', sa.String(), nullable=False, server_default=sa.text("'Endpoint Security'")),
        sa.Column('severity', sa.String(), nullable=False, server_default=sa.text("'HIGH'")),
        sa.Column('mapped_rule_id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_compliance_controls_organization_id', 'compliance_controls', ['organization_id'])
    op.create_index('ix_compliance_controls_control_id', 'compliance_controls', ['control_id'])

    # 2. Create evidence table
    op.create_table(
        'evidence',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('device_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('devices.id'), nullable=False),
        sa.Column('control_id', sa.String(), nullable=False),
        sa.Column('rule_id', sa.String(), nullable=False),
        sa.Column('check_run_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('check_runs.id', ondelete='SET NULL'), nullable=True),
        sa.Column('policy_version_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('policy_versions.id'), nullable=True),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('severity', sa.String(), nullable=False, server_default=sa.text("'MEDIUM'")),
        sa.Column('observed_result', sa.String(), nullable=False),
        sa.Column('evaluation_timestamp', sa.DateTime(), nullable=False),
        sa.Column('evidence_hash', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_evidence_organization_id', 'evidence', ['organization_id'])
    op.create_index('ix_evidence_device_id', 'evidence', ['device_id'])
    op.create_index('ix_evidence_control_id', 'evidence', ['control_id'])
    op.create_index('ix_evidence_rule_id', 'evidence', ['rule_id'])
    op.create_index('ix_evidence_check_run_id', 'evidence', ['check_run_id'])
    op.create_index('ix_evidence_created_at', 'evidence', ['created_at'])


def downgrade() -> None:
    op.drop_table('evidence')
    op.drop_table('compliance_controls')
