"""Asset Registration & Directory — register assets, search/filter, and
view per-asset allocation + maintenance history."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional

from ..database import get_db
from .. import models, schemas
from ..auth import get_current_user, require_roles
from ..utils import log_activity, generate_asset_tag

router = APIRouter()

manager_only = require_roles(models.Role.ADMIN, models.Role.ASSET_MANAGER)


@router.post("", response_model=schemas.AssetOut)
def register_asset(payload: schemas.AssetIn, db: Session = Depends(get_db),
                   current: models.User = Depends(manager_only)):
    asset = models.Asset(
        **payload.model_dump(),
        asset_tag=generate_asset_tag(db),
        status=models.AssetStatus.AVAILABLE,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    log_activity(db, current.id, "register_asset", "asset", asset.id, asset.asset_tag)
    db.commit()
    return asset


@router.get("", response_model=List[schemas.AssetOut])
def list_assets(
    q: Optional[str] = Query(None, description="Search by name / tag / serial"),
    category_id: Optional[int] = None,
    status: Optional[str] = None,
    location: Optional[str] = None,
    department_id: Optional[int] = None,
    bookable: Optional[bool] = None,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    query = db.query(models.Asset)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(
            models.Asset.name.ilike(like),
            models.Asset.asset_tag.ilike(like),
            models.Asset.serial_number.ilike(like),
        ))
    if category_id:
        query = query.filter(models.Asset.category_id == category_id)
    if status:
        query = query.filter(models.Asset.status == status)
    if location:
        query = query.filter(models.Asset.location.ilike(f"%{location}%"))
    if department_id:
        query = query.filter(models.Asset.current_holder_department_id == department_id)
    if bookable is not None:
        query = query.filter(models.Asset.is_shared_bookable == bookable)
    return query.order_by(models.Asset.id.desc()).all()


@router.get("/{asset_id}", response_model=schemas.AssetOut)
def get_asset(asset_id: int, db: Session = Depends(get_db),
              current: models.User = Depends(get_current_user)):
    asset = db.get(models.Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@router.put("/{asset_id}", response_model=schemas.AssetOut)
def update_asset(asset_id: int, payload: schemas.AssetIn, db: Session = Depends(get_db),
                 current: models.User = Depends(manager_only)):
    asset = db.get(models.Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    for k, v in payload.model_dump().items():
        setattr(asset, k, v)
    log_activity(db, current.id, "update_asset", "asset", asset.id, asset.asset_tag)
    db.commit()
    db.refresh(asset)
    return asset


@router.post("/{asset_id}/status", response_model=schemas.AssetOut)
def change_status(asset_id: int, status: str, db: Session = Depends(get_db),
                  current: models.User = Depends(manager_only)):
    """Manual lifecycle transition (e.g. Retire / Dispose / mark Lost)."""
    asset = db.get(models.Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    asset.status = status
    log_activity(db, current.id, "status_change", "asset", asset.id, f"-> {status}")
    db.commit()
    db.refresh(asset)
    return asset


@router.get("/{asset_id}/history")
def asset_history(asset_id: int, db: Session = Depends(get_db),
                  current: models.User = Depends(get_current_user)):
    asset = db.get(models.Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    allocations = db.query(models.Allocation).filter(
        models.Allocation.asset_id == asset_id
    ).order_by(models.Allocation.allocated_at.desc()).all()

    maintenance = db.query(models.MaintenanceRequest).filter(
        models.MaintenanceRequest.asset_id == asset_id
    ).order_by(models.MaintenanceRequest.created_at.desc()).all()

    def user_name(uid):
        u = db.get(models.User, uid) if uid else None
        return u.name if u else None

    return {
        "asset": schemas.AssetOut.model_validate(asset),
        "allocation_history": [
            {
                "id": a.id,
                "employee": user_name(a.employee_id),
                "department_id": a.department_id,
                "allocated_at": a.allocated_at,
                "expected_return_date": a.expected_return_date,
                "returned_at": a.returned_at,
                "return_condition_notes": a.return_condition_notes,
                "status": a.status,
            } for a in allocations
        ],
        "maintenance_history": [
            {
                "id": m.id,
                "issue": m.issue_description,
                "priority": m.priority,
                "status": m.status,
                "technician_name": m.technician_name,
                "created_at": m.created_at,
                "resolved_at": m.resolved_at,
            } for m in maintenance
        ],
    }
