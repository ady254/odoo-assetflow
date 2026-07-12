"""Organization Setup — Admin-only master data: departments, asset
categories, and the employee directory (the only place roles are assigned)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from .. import models, schemas
from ..auth import get_current_user, require_roles
from ..utils import log_activity, notify

router = APIRouter()

admin_only = require_roles(models.Role.ADMIN)


# ---------------- Tab A: Department Management ----------------
@router.get("/departments", response_model=List[schemas.DepartmentOut])
def list_departments(db: Session = Depends(get_db),
                     current: models.User = Depends(get_current_user)):
    return db.query(models.Department).all()


@router.post("/departments", response_model=schemas.DepartmentOut)
def create_department(payload: schemas.DepartmentIn, db: Session = Depends(get_db),
                      current: models.User = Depends(admin_only)):
    dept = models.Department(**payload.model_dump())
    db.add(dept)
    db.commit()
    db.refresh(dept)
    # keep the department head's role in sync
    if dept.head_id:
        head = db.get(models.User, dept.head_id)
        if head and head.role == models.Role.EMPLOYEE:
            head.role = models.Role.DEPARTMENT_HEAD
    log_activity(db, current.id, "create_department", "department", dept.id, dept.name)
    db.commit()
    db.refresh(dept)
    return dept


@router.put("/departments/{dept_id}", response_model=schemas.DepartmentOut)
def update_department(dept_id: int, payload: schemas.DepartmentIn,
                      db: Session = Depends(get_db),
                      current: models.User = Depends(admin_only)):
    dept = db.get(models.Department, dept_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    for k, v in payload.model_dump().items():
        setattr(dept, k, v)
    if dept.head_id:
        head = db.get(models.User, dept.head_id)
        if head and head.role == models.Role.EMPLOYEE:
            head.role = models.Role.DEPARTMENT_HEAD
    log_activity(db, current.id, "update_department", "department", dept.id, dept.name)
    db.commit()
    db.refresh(dept)
    return dept


# ---------------- Tab B: Asset Category Management ----------------
@router.get("/categories", response_model=List[schemas.CategoryOut])
def list_categories(db: Session = Depends(get_db),
                    current: models.User = Depends(get_current_user)):
    return db.query(models.AssetCategory).all()


@router.post("/categories", response_model=schemas.CategoryOut)
def create_category(payload: schemas.CategoryIn, db: Session = Depends(get_db),
                    current: models.User = Depends(admin_only)):
    cat = models.AssetCategory(**payload.model_dump())
    db.add(cat)
    log_activity(db, current.id, "create_category", "category", None, cat.name)
    db.commit()
    db.refresh(cat)
    return cat


@router.put("/categories/{cat_id}", response_model=schemas.CategoryOut)
def update_category(cat_id: int, payload: schemas.CategoryIn,
                    db: Session = Depends(get_db),
                    current: models.User = Depends(admin_only)):
    cat = db.get(models.AssetCategory, cat_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    for k, v in payload.model_dump().items():
        setattr(cat, k, v)
    db.commit()
    db.refresh(cat)
    return cat


# ---------------- Tab C: Employee Directory ----------------
@router.get("/employees", response_model=List[schemas.UserOut])
def list_employees(db: Session = Depends(get_db),
                   current: models.User = Depends(get_current_user)):
    return db.query(models.User).order_by(models.User.name).all()


@router.post("/employees/{user_id}/promote", response_model=schemas.UserOut)
def promote_employee(user_id: int, payload: schemas.PromoteIn,
                     db: Session = Depends(get_db),
                     current: models.User = Depends(admin_only)):
    """The ONLY place a role is assigned. Admin promotes an employee to
    Department Head or Asset Manager (or resets back to Employee)."""
    valid = {models.Role.EMPLOYEE, models.Role.ASSET_MANAGER,
             models.Role.DEPARTMENT_HEAD, models.Role.ADMIN}
    if payload.role not in valid:
        raise HTTPException(status_code=400, detail="Invalid role")
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")
    user.role = payload.role
    notify(db, user.id, f"Your role was updated to {payload.role.replace('_', ' ').title()}", "role")
    log_activity(db, current.id, "promote", "user", user.id, f"-> {payload.role}")
    db.commit()
    db.refresh(user)
    return user


@router.put("/employees/{user_id}", response_model=schemas.UserOut)
def update_employee(user_id: int, department_id: int = None, status: str = None,
                    db: Session = Depends(get_db),
                    current: models.User = Depends(admin_only)):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")
    if department_id is not None:
        user.department_id = department_id
    if status is not None:
        user.status = status
    log_activity(db, current.id, "update_employee", "user", user.id)
    db.commit()
    db.refresh(user)
    return user
