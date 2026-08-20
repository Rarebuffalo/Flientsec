from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import List, Optional
from uuid import UUID
from enum import Enum


# Auth Schemas
class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    created_at: datetime

    class Config:
        from_attributes = True


class MemberResponse(BaseModel):
    id: UUID
    user_id: UUID
    organization_id: UUID
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


# Organization & Team Schemas
class OrganizationResponse(BaseModel):
    id: UUID
    name: str
    created_at: datetime

    class Config:
        from_attributes = True


class OrganizationProfileResponse(BaseModel):
    id: UUID
    name: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    member_count: int
    device_count: int = 0
    policy_count: int = 0
    current_user_role: Optional[str] = None

    class Config:
        from_attributes = True


class OrganizationProfileUpdate(BaseModel):
    name: str


class OrganizationMemberResponse(BaseModel):
    id: UUID
    user_id: UUID
    email: EmailStr
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


class OrganizationMemberListResponse(BaseModel):
    items: List[OrganizationMemberResponse]
    total: int


class OrganizationMemberCreate(BaseModel):
    email: EmailStr
    role: str


class OrganizationMemberUpdate(BaseModel):
    role: str


# Device Schemas
class DeviceRegister(BaseModel):
    id: UUID
    hostname: str
    os_name: str
    os_version: str
    os_arch: str
    kernel_version: str
    agent_version: str


class DeviceResponse(BaseModel):
    id: UUID
    organization_id: UUID
    hostname: str
    os_name: str
    os_version: str
    os_arch: str
    kernel_version: str
    agent_version: str
    status: str
    compliance_status: str
    compliance_score: int
    last_checkin: Optional[datetime] = None
    device_token: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Finding Schemas
class FindingCreate(BaseModel):
    check_name: str
    rule_id: str
    severity: str
    status: str
    reason: str


class FindingResponse(BaseModel):
    id: UUID
    policy_id: Optional[UUID] = None
    rule_id: str
    check_name: str
    severity: str
    status: str
    reason: Optional[str] = None
    resolution_reason: Optional[str] = None
    created_at: datetime
    first_detected_at: datetime
    last_detected_at: datetime
    resolved_at: Optional[datetime] = None
    drift_type: Optional[str] = None

    class Config:
        from_attributes = True


# CheckRun Schemas
class DeviceFindingResponse(BaseModel):
    id: UUID
    rule_name: str
    severity: str
    status: str
    message: str

    class Config:
        from_attributes = True


class CheckRunCreate(BaseModel):
    id: UUID
    status: str
    score: int
    timestamp: datetime
    findings: List[FindingCreate]
    policy_version_id: Optional[UUID] = None
    content_hash: Optional[str] = None


class CheckRunResponse(BaseModel):
    id: UUID
    device_id: UUID
    timestamp: datetime
    status: str
    score: int
    findings: List[DeviceFindingResponse] = []
    policy_version_id: Optional[UUID] = None
    content_hash: Optional[str] = None
    provenance_status: Optional[str] = None
    policy_name: Optional[str] = None
    version_number: Optional[int] = None

    class Config:
        from_attributes = True


# Event Schemas
class EventResponse(BaseModel):
    id: UUID
    device_id: Optional[UUID] = None
    type: str
    rule_name: str
    message: str
    timestamp: datetime
    finding_id: Optional[UUID] = None
    policy_version_id: Optional[UUID] = None

    class Config:
        from_attributes = True


# Policy Schemas
class PolicyCreate(BaseModel):
    name: str
    description: Optional[str] = None


class PolicyUpdate(BaseModel):
    rules_yaml: str


class PolicyResponse(BaseModel):
    id: UUID
    organization_id: UUID
    name: str
    description: Optional[str] = None
    created_at: datetime
    rules_yaml: str
    active_version_id: Optional[UUID] = None
    active_version_number: Optional[int] = None

    class Config:
        from_attributes = True


class PolicyVersionResponse(BaseModel):
    id: UUID
    policy_id: UUID
    version_number: int
    definition_json: str
    content: Optional[str] = None
    status: str
    content_hash: Optional[str] = None
    created_by: UUID
    created_at: datetime

    class Config:
        from_attributes = True


# EnrollmentToken Schemas
class EnrollmentTokenBase(BaseModel):
    expires_at: datetime


class EnrollmentTokenCreate(EnrollmentTokenBase):
    pass


class EnrollmentTokenResponse(BaseModel):
    id: UUID
    organization_id: UUID
    token_hash: str
    created_by: UUID
    expires_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class PolicyAssignmentResponse(BaseModel):
    id: UUID
    organization_id: UUID
    policy_id: UUID
    device_id: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AgentPolicyResponse(BaseModel):
    policy_id: UUID
    policy_name: str
    version_id: UUID
    version_number: int
    schema_version: int = 1
    content: str
    content_hash: str
    issued_at: datetime

    class Config:
        from_attributes = True


# Fleet Findings & Events Schemas (Phase 4A & Phase 9)
class FindingStatusEnum(str, Enum):
    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    IN_REMEDIATION = "IN_REMEDIATION"
    WAIVED = "WAIVED"
    RESOLVED = "RESOLVED"


class FindingSeverityEnum(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class FindingDriftTypeEnum(str, Enum):
    DEVICE_DRIFT = "DEVICE_DRIFT"
    POLICY_CHANGE_NON_COMPLIANCE = "POLICY_CHANGE_NON_COMPLIANCE"


class EventTypeEnum(str, Enum):
    VIOLATION_TRIGGERED = "VIOLATION_TRIGGERED"
    VIOLATION_RESOLVED = "VIOLATION_RESOLVED"
    POLICY_ROLLBACK = "POLICY_ROLLBACK"
    TEST_EVENT = "TEST_EVENT"
    FINDING_ACKNOWLEDGED = "FINDING_ACKNOWLEDGED"
    FINDING_REMEDIATION_STARTED = "FINDING_REMEDIATION_STARTED"
    FINDING_WAIVED = "FINDING_WAIVED"
    FINDING_WAIVER_EXPIRED = "FINDING_WAIVER_EXPIRED"
    MEMBER_ADDED = "MEMBER_ADDED"
    MEMBER_ROLE_CHANGED = "MEMBER_ROLE_CHANGED"
    MEMBER_REMOVED = "MEMBER_REMOVED"
    ORGANIZATION_UPDATED = "ORGANIZATION_UPDATED"


class FindingRemediationRequest(BaseModel):
    note: Optional[str] = None


class FindingWaiverRequest(BaseModel):
    reason: str
    expires_at: datetime
    owner: Optional[str] = None
    ticket_id: Optional[str] = None


class RemediationCommandGuidance(BaseModel):
    os_name: str
    remediation_cmd: str
    verification_cmd: str
    notes: Optional[str] = None


class RemediationGuidanceResponse(BaseModel):
    rule_id: str
    title: str
    why_it_matters: str
    expected_state: str
    observed_state: str
    os_guidance: List[RemediationCommandGuidance]
    automated_verification_note: str


class FleetFindingResponse(BaseModel):
    id: UUID
    device_id: UUID
    device_hostname: str
    policy_id: Optional[UUID] = None
    policy_name: Optional[str] = None
    rule_id: str
    check_name: str
    severity: FindingSeverityEnum
    status: FindingStatusEnum
    reason: Optional[str] = None
    drift_type: Optional[FindingDriftTypeEnum] = None
    resolution_reason: Optional[str] = None
    first_detected_at: datetime
    last_detected_at: datetime
    resolved_at: Optional[datetime] = None

    # Lifecycle tracking (Phase 9)
    acknowledged_at: Optional[datetime] = None
    acknowledged_by_id: Optional[UUID] = None
    remediation_started_at: Optional[datetime] = None
    remediation_started_by_id: Optional[UUID] = None
    remediation_note: Optional[str] = None
    waived_at: Optional[datetime] = None
    waived_by_id: Optional[UUID] = None
    waiver_reason: Optional[str] = None
    waiver_expires_at: Optional[datetime] = None
    waiver_owner: Optional[str] = None
    waiver_ticket_id: Optional[str] = None

    class Config:
        from_attributes = True


class FleetFindingListResponse(BaseModel):
    items: List[FleetFindingResponse]
    total: int
    limit: int
    offset: int


class FleetEventResponse(BaseModel):
    id: UUID
    type: EventTypeEnum
    timestamp: datetime
    message: str
    rule_name: str
    device_id: Optional[UUID] = None
    device_hostname: Optional[str] = None
    finding_id: Optional[UUID] = None
    policy_version_id: Optional[UUID] = None
    policy_name: Optional[str] = None
    policy_version_number: Optional[int] = None

    class Config:
        from_attributes = True


class FleetEventListResponse(BaseModel):
    items: List[FleetEventResponse]
    total: int
    limit: int
    offset: int


class FleetFindingDetailResponse(FleetFindingResponse):
    acknowledged_by_email: Optional[str] = None
    remediation_started_by_email: Optional[str] = None
    waived_by_email: Optional[str] = None
    guidance: Optional[RemediationGuidanceResponse] = None
    events: List[FleetEventResponse] = []


class FleetFindingSummaryResponse(BaseModel):
    open_count: int
    critical_high_count: int
    in_remediation_count: int
    acknowledged_count: int
    waived_count: int
    resolved_recent_count: int
    resolved_count: Optional[int] = None
    total: int


# Webhook Schemas (Phase 7)
class WebhookCreate(BaseModel):
    name: str
    endpoint_url: str
    events: Optional[List[str]] = ["VIOLATION_TRIGGERED", "VIOLATION_RESOLVED"]
    enabled: Optional[bool] = True


class WebhookUpdate(BaseModel):
    name: Optional[str] = None
    endpoint_url: Optional[str] = None
    events: Optional[List[str]] = None
    enabled: Optional[bool] = None


class WebhookResponse(BaseModel):
    id: UUID
    organization_id: UUID
    name: str
    endpoint_url: str
    enabled: bool
    events: List[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WebhookCreatedResponse(WebhookResponse):
    signing_secret: str


class WebhookDeliveryResponse(BaseModel):
    id: UUID
    webhook_id: UUID
    event_id: Optional[UUID] = None
    event_type: str
    status: str
    attempt_count: int
    response_status_code: Optional[int] = None
    error_message: Optional[str] = None
    delivered_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class WebhookDetailResponse(WebhookResponse):
    recent_deliveries: List[WebhookDeliveryResponse] = []


# Policy Rollback Schema (Phase 7)
class PolicyRollbackResponse(BaseModel):
    status: str
    policy_id: UUID
    previous_active_version_id: Optional[UUID] = None
    active_version_id: UUID
    active_version_number: int
    message: str


# Compliance & Evidence Schemas (Phase 8)
class ComplianceControlResponse(BaseModel):
    id: UUID
    control_id: str
    name: str
    description: str
    category: str
    severity: str
    mapped_rule_id: str
    organization_id: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ControlPostureSummary(BaseModel):
    control_id: str
    name: str
    description: str
    category: str
    severity: str
    mapped_rule_id: str
    status: str  # PASS, FAIL, UNKNOWN, NOT_APPLICABLE
    compliance_percentage: int
    passed_devices: int
    failed_devices: int
    unknown_devices: int


class ComplianceSummaryDevices(BaseModel):
    total: int
    compliant: int
    failing: int
    unknown: int


class ComplianceSummaryControls(BaseModel):
    total: int
    passed: int
    failed: int
    unknown: int


class ComplianceSummaryResponse(BaseModel):
    overall_score: int
    devices: ComplianceSummaryDevices
    controls: ComplianceSummaryControls
    critical_failures: int
    stale_devices: int


class DeviceControlStatus(BaseModel):
    control_id: str
    name: str
    severity: str
    status: str  # PASS, FAIL, UNKNOWN, NOT_APPLICABLE
    rule_id: str
    observed_result: Optional[str] = None
    last_evaluated_at: Optional[datetime] = None


class DeviceComplianceResponse(BaseModel):
    device_id: UUID
    hostname: str
    compliance_score: int
    compliance_status: str
    last_checkin: Optional[datetime] = None
    controls: List[DeviceControlStatus] = []


class EvidenceResponse(BaseModel):
    id: UUID
    organization_id: UUID
    device_id: UUID
    hostname: Optional[str] = None
    control_id: str
    rule_id: str
    check_run_id: Optional[UUID] = None
    policy_version_id: Optional[UUID] = None
    status: str
    severity: str
    observed_result: str
    evaluation_timestamp: datetime
    evidence_hash: str
    created_at: datetime

    class Config:
        from_attributes = True


class EvidenceListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: List[EvidenceResponse]


class ControlDetailResponse(BaseModel):
    control: ComplianceControlResponse
    posture: ControlPostureSummary
    failing_devices: List[DeviceResponse] = []
