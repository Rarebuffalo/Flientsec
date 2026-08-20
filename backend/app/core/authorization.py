"""
FlientSec Server-Side Role-Based Access Control (RBAC) Module

Provides authoritative role and permission evaluation for FastAPI endpoints.
Roles:
- OWNER: Full tenant administration and operational mutations.
- ADMIN: Operational security mutations (policies, findings, waivers, tokens, webhooks, devices).
- VIEWER: Read-only access across console dashboards, compliance, findings, and devices.
"""

from enum import Enum
from typing import Sequence, Optional, List, Union
import uuid
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core import security
from app.models import models

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")


class RoleEnum(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    VIEWER = "viewer"


ROLE_HIERARCHY = {
    RoleEnum.OWNER.value: 3,
    RoleEnum.ADMIN.value: 2,
    RoleEnum.VIEWER.value: 1,
}


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> models.User:
    """
    Resolves the authenticated user from the Bearer JWT token.
    Raises HTTP 401 Unauthorized if the token is missing, invalid, or user not found.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    email = security.decode_access_token(token)
    if email is None:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception
    return user


def get_user_roles(user: models.User, org_id: Optional[uuid.UUID] = None) -> List[str]:
    """
    Extracts normalized lowercase roles from user memberships.
    If org_id is provided, filters to memberships for that specific organization.
    """
    if not user or not user.memberships:
        return []
    if org_id:
        return [
            m.role.lower()
            for m in user.memberships
            if m.organization_id == org_id and m.role
        ]
    return [m.role.lower() for m in user.memberships if m.role]


def verify_org_role(
    user: models.User,
    org_id: uuid.UUID,
    allowed_roles: Sequence[Union[str, RoleEnum]]
) -> None:
    """
    Explicitly verifies that the user has one of the allowed roles for a specific organization.
    Raises HTTP 403 if user lacks required role for that organization.
    """
    normalized_allowed = {
        r.value.lower() if isinstance(r, RoleEnum) else str(r).lower()
        for r in allowed_roles
    }
    roles = get_user_roles(user, org_id=org_id)
    if not roles or not set(roles).intersection(normalized_allowed):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Insufficient permissions for this organization. Required role: "
                f"{', '.join(sorted(normalized_allowed))}"
            ),
        )


def require_role(allowed_roles: Sequence[Union[str, RoleEnum]]):
    """
    FastAPI dependency factory to enforce server-side RBAC.
    Validates that the authenticated user possesses an authorized role in their membership.
    Returns the authenticated models.User if authorized, otherwise raises HTTP 403 Forbidden.
    """
    normalized_allowed = {
        r.value.lower() if isinstance(r, RoleEnum) else str(r).lower()
        for r in allowed_roles
    }

    def role_checker(
        current_user: models.User = Depends(get_current_user),
    ) -> models.User:
        user_roles = get_user_roles(current_user)
        if not user_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No active organization membership found for user.",
            )

        if not set(user_roles).intersection(normalized_allowed):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Forbidden: Action requires one of the following roles: "
                    f"{', '.join(sorted(normalized_allowed))}"
                ),
            )
        return current_user

    return role_checker


# Pre-defined reusable dependency instances
require_admin_or_owner = require_role([RoleEnum.ADMIN, RoleEnum.OWNER])
require_owner = require_role([RoleEnum.OWNER])
require_authenticated_viewer = require_role([RoleEnum.VIEWER, RoleEnum.ADMIN, RoleEnum.OWNER])
