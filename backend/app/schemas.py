from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, ConfigDict


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class SignupIn(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(ORMBase):
    id: int
    name: str
    email: str
    role: str
    department_id: Optional[int] = None
    status: str


class DepartmentIn(BaseModel):
    name: str
    head_id: Optional[int] = None
    parent_id: Optional[int] = None
    status: str = "active"


class DepartmentOut(DepartmentIn, ORMBase):
    id: int


class CategoryIn(BaseModel):
    name: str
    extra_fields: Optional[str] = None


class CategoryOut(CategoryIn, ORMBase):
    id: int


class PromoteIn(BaseModel):
    role: str


class AssetIn(BaseModel):
    name: str
    category_id: int
    serial_number: Optional[str] = None
    acquisition_date: Optional[datetime] = None
    acquisition_cost: Optional[float] = None
    condition: str = "good"
    location: Optional[str] = None
    photo_url: Optional[str] = None
    is_shared_bookable: bool = False


class AssetOut(ORMBase):
    id: int
    name: str
    asset_tag: str
    category_id: int
    serial_number: Optional[str] = None
    acquisition_date: Optional[datetime] = None
    acquisition_cost: Optional[float] = None
    condition: str
    location: Optional[str] = None
    photo_url: Optional[str] = None
    is_shared_bookable: bool
    status: str
    current_holder_user_id: Optional[int] = None
    current_holder_department_id: Optional[int] = None


class AllocationIn(BaseModel):
    asset_id: int
    employee_id: Optional[int] = None
    department_id: Optional[int] = None
    expected_return_date: Optional[datetime] = None


class ReturnIn(BaseModel):
    condition_notes: Optional[str] = None


class TransferIn(BaseModel):
    asset_id: int
    to_employee_id: Optional[int] = None
    to_department_id: Optional[int] = None


class BookingIn(BaseModel):
    asset_id: int
    start_time: datetime
    end_time: datetime


class MaintenanceIn(BaseModel):
    asset_id: int
    issue_description: str
    priority: str = "medium"
    photo_url: Optional[str] = None


class MaintenanceAssignIn(BaseModel):
    technician_name: str


class AuditCycleIn(BaseModel):
    name: str
    scope_department_id: Optional[int] = None
    scope_location: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    auditor_ids: List[int] = []


class AuditMarkIn(BaseModel):
    asset_id: int
    result: str
    notes: Optional[str] = None
