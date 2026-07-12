"""Maintenance Management — route repairs through approval before work
starts. Pending -> Approved/Rejected -> Technician Assigned -> In Progress
-> Resolved. Asset flips to Under Maintenance on approval, back to
Available on resolution."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..auth import get_current_user, require_roles
from ..utils import log_activity, notify

router = APIRouter()

manager_only = require_roles(models.Role.ADMIN, models.Role.ASSET_MANAGER)


def _dict(db: Session, m: models.MaintenanceRequest) -> dict:
    asset = db.get(models.Asset, m.asset_id)
    raiser = db.get(models.User, m.raised_by_id)
    return {
        "id": m.id,
        "asset_id": m.asset_id,
        "asset_tag": asset.asset_tag if asset else None,
        "asset_name": asset.name if asset else None,
        "raised_by": raiser.name if raiser else None,
        "raised_by_id": m.raised_by_id,
        "issue_description": m.issue_description,
        "priority": m.priority,
        "photo_url": m.photo_url,
        "status": m.status,
        "technician_name": m.technician_name,
        "created_at": m.created_at,
        "resolved_at": m.resolved_at,
    }


@router.post("")
def raise_request(payload: schemas.MaintenanceIn, db: Session = Depends(get_db),
                  current: models.User = Depends(get_current_user)):
    asset = db.get(models.Asset, payload.asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    req = models.MaintenanceRequest(
        asset_id=payload.asset_id,
        raised_by_id=current.id,
        issue_description=payload.issue_description,
        priority=payload.priority,
        photo_url=payload.photo_url,
        status=models.MaintenanceStatus.PENDING,
    )
    db.add(req)
    log_activity(db, current.id, "maintenance_raise", "asset", asset.id, asset.asset_tag)
    db.commit()
    db.refresh(req)
    return _dict(db, req)


@router.get("")
def list_requests(status: str = None, db: Session = Depends(get_db),
                  current: models.User = Depends(get_current_user)):
    q = db.query(models.MaintenanceRequest)
    if status:
        q = q.filter(models.MaintenanceRequest.status == status)
    rows = q.order_by(models.MaintenanceRequest.created_at.desc()).all()
    return [_dict(db, m) for m in rows]


@router.post("/{req_id}/approve")
def approve(req_id: int, db: Session = Depends(get_db),
            current: models.User = Depends(manager_only)):
    req = db.get(models.MaintenanceRequest, req_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != models.MaintenanceStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Already {req.status}")
    req.status = models.MaintenanceStatus.APPROVED
    req.approved_by_id = current.id
    asset = db.get(models.Asset, req.asset_id)
    asset.status = models.AssetStatus.UNDER_MAINTENANCE   # auto-update on approval
    notify(db, req.raised_by_id, f"Maintenance approved for {asset.asset_tag}", "maintenance")
    log_activity(db, current.id, "maintenance_approve", "asset", asset.id, asset.asset_tag)
    db.commit()
    return _dict(db, req)


@router.post("/{req_id}/reject")
def reject(req_id: int, db: Session = Depends(get_db),
           current: models.User = Depends(manager_only)):
    req = db.get(models.MaintenanceRequest, req_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    req.status = models.MaintenanceStatus.REJECTED
    req.approved_by_id = current.id
    notify(db, req.raised_by_id, "Your maintenance request was rejected", "maintenance")
    log_activity(db, current.id, "maintenance_reject", "maintenance", req.id)
    db.commit()
    return _dict(db, req)


@router.post("/{req_id}/assign")
def assign_technician(req_id: int, payload: schemas.MaintenanceAssignIn,
                      db: Session = Depends(get_db),
                      current: models.User = Depends(manager_only)):
    req = db.get(models.MaintenanceRequest, req_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status not in (models.MaintenanceStatus.APPROVED,
                          models.MaintenanceStatus.TECHNICIAN_ASSIGNED):
        raise HTTPException(status_code=400, detail="Request must be approved first")
    req.technician_name = payload.technician_name
    req.status = models.MaintenanceStatus.TECHNICIAN_ASSIGNED
    log_activity(db, current.id, "maintenance_assign", "maintenance", req.id, payload.technician_name)
    db.commit()
    return _dict(db, req)


@router.post("/{req_id}/progress")
def start_progress(req_id: int, db: Session = Depends(get_db),
                   current: models.User = Depends(manager_only)):
    req = db.get(models.MaintenanceRequest, req_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    req.status = models.MaintenanceStatus.IN_PROGRESS
    log_activity(db, current.id, "maintenance_progress", "maintenance", req.id)
    db.commit()
    return _dict(db, req)


@router.post("/{req_id}/resolve")
def resolve(req_id: int, db: Session = Depends(get_db),
            current: models.User = Depends(manager_only)):
    req = db.get(models.MaintenanceRequest, req_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    req.status = models.MaintenanceStatus.RESOLVED
    req.resolved_at = datetime.utcnow()
    asset = db.get(models.Asset, req.asset_id)
    # back to Available on resolution (unless it is currently held)
    if asset.current_holder_user_id or asset.current_holder_department_id:
        asset.status = models.AssetStatus.ALLOCATED
    else:
        asset.status = models.AssetStatus.AVAILABLE
    notify(db, req.raised_by_id, f"Maintenance resolved for {asset.asset_tag}", "maintenance")
    log_activity(db, current.id, "maintenance_resolve", "asset", asset.id, asset.asset_tag)
    db.commit()
    return _dict(db, req)
