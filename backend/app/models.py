from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from .database import Base


class Role:
    ADMIN = "admin"
    ASSET_MANAGER = "asset_manager"
    DEPARTMENT_HEAD = "department_head"
    EMPLOYEE = "employee"


class AssetStatus:
    AVAILABLE = "available"
    ALLOCATED = "allocated"
    RESERVED = "reserved"
    UNDER_MAINTENANCE = "under_maintenance"
    LOST = "lost"
    RETIRED = "retired"
    DISPOSED = "disposed"


class BookingStatus:
    UPCOMING = "upcoming"
    ONGOING = "ongoing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class MaintenanceStatus:
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    TECHNICIAN_ASSIGNED = "technician_assigned"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"


class TransferStatus:
    REQUESTED = "requested"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default=Role.EMPLOYEE, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)

    department = relationship("Department", foreign_keys=[department_id], back_populates="employees")


class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    head_id = Column(Integer, ForeignKey("users.id", use_alter=True, name="fk_department_head"), nullable=True)
    parent_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)

    employees = relationship("User", foreign_keys=[User.department_id], back_populates="department")
    head = relationship("User", foreign_keys=[head_id])


class AssetCategory(Base):
    __tablename__ = "asset_categories"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    extra_fields = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Asset(Base):
    __tablename__ = "assets"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    asset_tag = Column(String, unique=True, nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("asset_categories.id"), nullable=False)
    serial_number = Column(String, nullable=True)
    acquisition_date = Column(DateTime, nullable=True)
    acquisition_cost = Column(Float, nullable=True)
    condition = Column(String, default="good")
    location = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)
    is_shared_bookable = Column(Boolean, default=False)
    status = Column(String, default=AssetStatus.AVAILABLE)

    current_holder_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    current_holder_department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    category = relationship("AssetCategory")


class Allocation(Base):
    __tablename__ = "allocations"
    id = Column(Integer, primary_key=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    allocated_at = Column(DateTime, default=datetime.utcnow)
    expected_return_date = Column(DateTime, nullable=True)
    returned_at = Column(DateTime, nullable=True)
    return_condition_notes = Column(Text, nullable=True)
    status = Column(String, default="active")
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    asset = relationship("Asset")


class TransferRequest(Base):
    __tablename__ = "transfer_requests"
    id = Column(Integer, primary_key=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    requested_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    to_employee_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    to_department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    status = Column(String, default=TransferStatus.REQUESTED)
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)


class Booking(Base):
    __tablename__ = "bookings"
    id = Column(Integer, primary_key=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    booked_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    status = Column(String, default=BookingStatus.UPCOMING)
    created_at = Column(DateTime, default=datetime.utcnow)

    asset = relationship("Asset")


class MaintenanceRequest(Base):
    __tablename__ = "maintenance_requests"
    id = Column(Integer, primary_key=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    raised_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    issue_description = Column(Text, nullable=False)
    priority = Column(String, default="medium")
    photo_url = Column(String, nullable=True)
    status = Column(String, default=MaintenanceStatus.PENDING)
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    technician_name = Column(String, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    asset = relationship("Asset")


class AuditCycle(Base):
    __tablename__ = "audit_cycles"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    scope_department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    scope_location = Column(String, nullable=True)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    status = Column(String, default="open")
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditAssignment(Base):
    __tablename__ = "audit_assignments"
    id = Column(Integer, primary_key=True)
    audit_cycle_id = Column(Integer, ForeignKey("audit_cycles.id"), nullable=False)
    auditor_id = Column(Integer, ForeignKey("users.id"), nullable=False)


class AuditItem(Base):
    __tablename__ = "audit_items"
    id = Column(Integer, primary_key=True)
    audit_cycle_id = Column(Integer, ForeignKey("audit_cycles.id"), nullable=False)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    result = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    checked_at = Column(DateTime, nullable=True)


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(String, nullable=False)
    type = Column(String, nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)
    entity_type = Column(String, nullable=True)
    entity_id = Column(Integer, nullable=True)
    details = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
