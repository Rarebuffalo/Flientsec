"""add_provenance_status_to_checkrun

Revision ID: 012dd382a1ea
Revises: e4fa6db90d3d
Create Date: 2026-08-04 16:16:25.363786

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '012dd382a1ea'
down_revision: Union[str, None] = 'e4fa6db90d3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('check_runs', sa.Column('provenance_status', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('check_runs', 'provenance_status')
