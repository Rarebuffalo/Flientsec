import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    members = relationship(
        "Member", back_populates="organization", cascade="all, delete-orphan"
    )
    devices = relationship(
        "Device", back_populates="organization", cascade="all, delete-orphan"
    )
    policies = relationship(
        "Policy", back_populates="organization", cascade="all, delete-orphan"
    )
    enrollment_tokens = relationship(
        "EnrollmentToken",
        back_populates="organization",
        cascade="all, delete-orphan",
    )


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    memberships = relationship(
        "Member", back_populates="user", cascade="all, delete-orphan"
    )
    sessions = relationship(
        "Session", back_populates="user", cascade="all, delete-orphan"
    )


class Member(Base):
    __tablename__ = "members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    organization_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False
    )
    role = Column(String, default="viewer")  # owner, admin, viewer
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="memberships")
    organization = relationship("Organization", back_populates="members")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="sessions")


class EnrollmentToken(Base):
    __tablename__ = "enrollment_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False
    )
    token_hash = Column(String, unique=True, index=True, nullable=False)
    created_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    organization = relationship(
        "Organization", back_populates="enrollment_tokens"
    )


class Device(Base):
    __tablename__ = "devices"

    id = Column(UUID(as_uuid=True), primary_key=True)
    organization_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False
    )
    hostname = Column(String, nullable=False)
    os_name = Column(String, nullable=False)
    os_version = Column(String, nullable=False)
    os_arch = Column(String, nullable=False)
    kernel_version = Column(String, nullable=False)
    agent_version = Column(String, nullable=False)

    # Pending / Online / Offline / Warning / Failing / Decommissioned
    status = Column(String, default="PENDING")
    compliance_status = Column(String, default="UNKNOWN")  # PASS / FAIL / WARN
    compliance_score = Column(Integer, default=100)
    last_checkin = Column(DateTime, nullable=True)

    # Device Token generated upon successful registration handshake
    device_token = Column(String, unique=True, index=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    organization = relationship("Organization", back_populates="devices")
    check_runs = relationship(
        "CheckRun", back_populates="device", cascade="all, delete-orphan"
    )
    findings = relationship(
        "Finding", back_populates="device", cascade="all, delete-orphan"
    )
    events = relationship(
        "Event", back_populates="device", cascade="all, delete-orphan"
    )


class DeviceGroup(Base):
    __tablename__ = "device_groups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False
    )
    name = Column(String, nullable=False)
    policy_id = Column(
        UUID(as_uuid=True), ForeignKey("policies.id"), nullable=True
    )
    created_at = Column(DateTime, default=datetime.utcnow)


class Policy(Base):
    __tablename__ = "policies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False
    )
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    organization = relationship("Organization", back_populates="policies")
    versions = relationship(
        "PolicyVersion", back_populates="policy", cascade="all, delete-orphan"
    )


class PolicyVersion(Base):
    __tablename__ = "policy_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    policy_id = Column(
        UUID(as_uuid=True), ForeignKey("policies.id"), nullable=False
    )
    version_number = Column(Integer, nullable=False)
    definition_json = Column(String, nullable=False)
    created_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    created_at = Column(DateTime, default=datetime.utcnow)

    policy = relationship("Policy", back_populates="versions")


class CheckRun(Base):
    __tablename__ = "check_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(
        UUID(as_uuid=True), ForeignKey("devices.id"), nullable=False
    )
    timestamp = Column(DateTime, default=datetime.utcnow)
    status = Column(String, nullable=False)  # PASS / FAIL / WARN
    score = Column(Integer, nullable=False)  # 0 to 100

    device = relationship("Device", back_populates="check_runs")


class Finding(Base):
    __tablename__ = "findings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(
        UUID(as_uuid=True), ForeignKey("devices.id"), nullable=False
    )
    check_name = Column(String, nullable=False)
    severity = Column(String, default="medium")  # high, medium, low
    status = Column(String, default="Open")  # Open, Acknowledged, Resolved
    reason = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    device = relationship("Device", back_populates="findings")


class Event(Base):
    __tablename__ = "events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(
        UUID(as_uuid=True), ForeignKey("devices.id"), nullable=False
    )
    type = Column(
        String, nullable=False
    )  # VIOLATION_TRIGGERED / VIOLATION_RESOLVED
    rule_name = Column(String, nullable=False)
    message = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    device = relationship("Device", back_populates="events")
