import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class Company(Base):
    __tablename__ = "companies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="company", cascade="all, delete-orphan")
    devices = relationship("Device", back_populates="company", cascade="all, delete-orphan")
    policies = relationship("Policy", back_populates="company", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="admin")
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False)

    company = relationship("Company", back_populates="users")


class Device(Base):
    __tablename__ = "devices"

    id = Column(UUID(as_uuid=True), primary_key=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False)
    hostname = Column(String, nullable=False)
    os_name = Column(String, nullable=False)
    os_version = Column(String, nullable=False)
    os_arch = Column(String, nullable=False)
    kernel_version = Column(String, nullable=False)
    agent_version = Column(String, nullable=False)
    status = Column(String, default="UNKNOWN")  # ONLINE / OFFLINE / UNKNOWN
    compliance_status = Column(String, default="UNKNOWN")  # PASS / FAIL / WARN
    compliance_score = Column(Integer, default=0)  # 0 to 100
    last_checkin = Column(DateTime, nullable=True)

    company = relationship("Company", back_populates="devices")
    check_runs = relationship("CheckRun", back_populates="device", cascade="all, delete-orphan")
    events = relationship("Event", back_populates="device", cascade="all, delete-orphan")


class Policy(Base):
    __tablename__ = "policies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False)
    rules_yaml = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)

    company = relationship("Company", back_populates="policies")


class CheckRun(Base):
    __tablename__ = "check_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    status = Column(String, nullable=False)  # PASS / FAIL / WARN
    score = Column(Integer, nullable=False)  # 0 to 100

    device = relationship("Device", back_populates="check_runs")
    findings = relationship("Finding", back_populates="check_run", cascade="all, delete-orphan")


class Finding(Base):
    __tablename__ = "findings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    check_run_id = Column(UUID(as_uuid=True), ForeignKey("check_runs.id"), nullable=False)
    rule_name = Column(String, nullable=False)
    status = Column(String, nullable=False)  # FAIL / WARN
    message = Column(String, nullable=False)
    severity = Column(String, default="MEDIUM")  # HIGH / MEDIUM / LOW

    check_run = relationship("CheckRun", back_populates="findings")


class Event(Base):
    __tablename__ = "events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id"), nullable=False)
    type = Column(String, nullable=False)  # VIOLATION_TRIGGERED / VIOLATION_RESOLVED
    rule_name = Column(String, nullable=False)
    message = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    device = relationship("Device", back_populates="events")
