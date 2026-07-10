from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import List, Optional
from uuid import UUID

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
    role: str
    company_id: UUID

    class Config:
        from_attributes = True

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
    company_id: UUID
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

    class Config:
        from_attributes = True

# Finding Schemas
class FindingCreate(BaseModel):
    rule_name: str
    status: str
    message: str
    severity: str

class FindingResponse(BaseModel):
    id: UUID
    rule_name: str
    status: str
    message: str
    severity: str

    class Config:
        from_attributes = True

# CheckRun Schemas
class CheckRunCreate(BaseModel):
    id: UUID
    status: str
    score: int
    timestamp: datetime
    findings: List[FindingCreate]

class CheckRunResponse(BaseModel):
    id: UUID
    device_id: UUID
    timestamp: datetime
    status: str
    score: int
    findings: List[FindingResponse]

    class Config:
        from_attributes = True

# Event Schemas
class EventResponse(BaseModel):
    id: UUID
    device_id: UUID
    type: str
    rule_name: str
    message: str
    timestamp: datetime

    class Config:
        from_attributes = True

# Policy Schemas
class PolicyCreate(BaseModel):
    rules_yaml: str

class PolicyResponse(BaseModel):
    id: UUID
    company_id: UUID
    rules_yaml: str
    is_active: bool

    class Config:
        from_attributes = True
