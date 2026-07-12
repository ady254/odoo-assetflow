"""Asset Allocation & Transfer — who holds what, with explicit conflict
rules, a transfer approval workflow, returns, and overdue flagging."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from .. import models, schemas
from ..auth import get_current_user, require_roles
from ..utils import log_activity, notify

router = APIRouter()

approver = require_roles(models.Role.ADMIN, models.Role.ASSET_MANAGER,
                         models.Role.DEPARTMENT_HEAD)

HOLDABLE_BLOCKED = {
    models.AssetStatus.UNDER_MAINTENANCE, models.AssetStatus.LOST,
    models.AssetStatus.RETIRED, models.AssetStatus.DISPOSED,
}


def _holder_name(db: Session, asset: models.Asset) -> str:
    if asset.current_holder_user_id:
        u = db.get(models.User, asset.current_holder_user_id)
        return u.name if u else "another employee"
    if asset.current_holder_department_id:
        d = db.get(models.Department, asset.current_holder_department_id)
        return f"{d.name} dept" if d else "another department"
    return "someone"


@router.post("")
def allocate(payload: schemas.AllocationIn, db: Session = Depends(get_db),
             current: models.User = Depends(approver)):
    asset = db.get(models.Asset, payload.asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset.status in HOLDABLE_BLOCKED:
        raise HTTPException(status_code=400,
                            detail=f"Asset is {asset.status} and cannot be allocated")

    # Conflict rule: can't allocate an asset that is already held.
    if asset.status == models.AssetStatus.ALLOCATED:
        raise HTTPException(status_code=409, detail={
            "message": f"Currently held by {_holder_name(db, asset)}",
            "current_holder_user_id": asset.current_holder_user_id,
            "current_holder_department_id": asset.current_holder_department_id,
            "hint": "Raise a Transfer Request instead.",
        })

    alloc = models.Allocation(
        asset_id=asset.id,
        employee_id=payload.employee_id,
        department_id=payload.department_id,
        expected_return_date=payload.expected_return_date,
        status="active",
        created_by_id=current.id,
    )
    asset.status = models.AssetStatus.ALLOCATED
    asset.current_holder_user_id = payload.employee_id
    asset.current_holder_department_id = payload.department_id
    db.add(alloc)

    notify(db, payload.employee_id, f"Asset {asset.asset_tag} ({asset.name}) was assigned to you", "allocation")
    log_activity(db, current.id, "allocate", "asset", asset.id,
                 f"{asset.asset_tag} -> user {payload.employee_id or ''} dept {payload.department_id or ''}")
    db.commit()
    db.refresh(alloc)
    return {"id": alloc.id, "asset_id": asset.id, "status": "allocated"}


@router.get("")
def list_allocations(active_only: bool = True, db: Session = Depends(get_db),
                     current: models.User = Depends(get_current_user)):
    q = db.query(models.Allocation)
    if active_only:
        q = q.filter(models.Allocation.status == "active")
    rows = q.order_by(models.Allocation.allocated_at.desc()).all()
    return [_alloc_dict(db, a) for a in rows]


@router.get("/mine")
def my_allocations(db: Session = Depends(get_db),
                   current: models.User = Depends(get_current_user)):
    rows = db.query(models.Allocation).filter(
        models.Allocation.employee_id == current.id,
        models.Allocation.status == "active",
    ).all()
    return [_alloc_dict(db, a) for a in rows]


@router.get("/overdue")
def overdue_allocations(db: Session = Depends(get_db),
                        current: models.User = Depends(get_current_user)):
    now = datetime.utcnow()
    rows = db.query(models.Allocation).filter(
        models.Allocation.status == "active",
        models.Allocation.expected_return_date.isnot(None),
        models.Allocation.expected_return_date < now,
    ).all()
    return [_alloc_dict(db, a) for a in rows]


@router.post("/{asset_id}/return")
def return_asset(asset_id: int, payload: schemas.ReturnIn, db: Session = Depends(get_db),
                 current: models.User = Depends(get_current_user)):
    asset = db.get(models.Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    alloc = db.query(models.Allocation).filter(
        models.Allocation.asset_id == asset_id,
        models.Allocation.status == "active",
    ).first()
    if not alloc:
        raise HTTPException(status_code=400, detail="Asset is not currently allocated")

    alloc.status = "returned"
    alloc.returned_at = datetime.utcnow()
    alloc.return_condition_notes = payload.condition_notes
    asset.status = models.AssetStatus.AVAILABLE
    asset.current_holder_user_id = None
    asset.current_holder_department_id = None

    log_activity(db, current.id, "return", "asset", asset.id, asset.asset_tag)
    db.commit()
    return {"asset_id": asset.id, "status": "available"}


# ---------------- Transfer workflow ----------------
@router.post("/transfer")
def request_transfer(payload: schemas.TransferIn, db: Session = Depends(get_db),
                     current: models.User = Depends(get_current_user)):
    asset = db.get(models.Asset, payload.asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    tr = models.TransferRequest(
        asset_id=payload.asset_id,
        requested_by_id=current.id,
        to_employee_id=payload.to_employee_id,
        to_department_id=payload.to_department_id,
        status=models.TransferStatus.REQUESTED,
    )
    db.add(tr)
    log_activity(db, current.id, "transfer_request", "asset", asset.id, asset.asset_tag)
    db.commit()
    db.refresh(tr)
    return {"id": tr.id, "status": tr.status}


@router.get("/transfers")
def list_transfers(db: Session = Depends(get_db),
                   current: models.User = Depends(get_current_user)):
    rows = db.query(models.TransferRequest).order_by(
        models.TransferRequest.created_at.desc()).all()
    out = []
    for t in rows:
        asset = db.get(models.Asset, t.asset_id)
        requester = db.get(models.User, t.requested_by_id)
        out.append({
            "id": t.id,
            "asset_id": t.asset_id,
            "asset_tag": asset.asset_tag if asset else None,
            "asset_name": asset.name if asset else None,
            "requested_by": requester.name if requester else None,
            "to_employee_id": t.to_employee_id,
            "to_department_id": t.to_department_id,
            "status": t.status,
            "created_at": t.created_at,
        })
    return out


@router.post("/transfers/{transfer_id}/approve")
def approve_transfer(transfer_id: int, db: Session = Depends(get_db),
                     current: models.User = Depends(approver)):
    tr = db.get(models.TransferRequest, transfer_id)
    if not tr:
        raise HTTPException(status_code=404, detail="Transfer request not found")
    if tr.status != models.TransferStatus.REQUESTED:
        raise HTTPException(status_code=400, detail=f"Already {tr.status}")

    asset = db.get(models.Asset, tr.asset_id)
    # close the current active allocation (history updated automatically)
    old = db.query(models.Allocation).filter(
        models.Allocation.asset_id == asset.id,
        models.Allocation.status == "active",
    ).first()
    if old:
        old.status = "transferred"
        old.returned_at = datetime.utcnow()

    new_alloc = models.Allocation(
        asset_id=asset.id,
        employee_id=tr.to_employee_id,
        department_id=tr.to_department_id,
        status="active",
        created_by_id=current.id,
    )
    asset.current_holder_user_id = tr.to_employee_id
    asset.current_holder_department_id = tr.to_department_id
    asset.status = models.AssetStatus.ALLOCATED
    db.add(new_alloc)

    tr.status = models.TransferStatus.COMPLETED
    tr.approved_by_id = current.id
    tr.resolved_at = datetime.utcnow()

    notify(db, tr.to_employee_id, f"Transfer approved: {asset.asset_tag} is now allocated to you", "transfer")
    notify(db, tr.requested_by_id, f"Your transfer request for {asset.asset_tag} was approved", "transfer")
    log_activity(db, current.id, "transfer_approve", "asset", asset.id, asset.asset_tag)
    db.commit()
    return {"id": tr.id, "status": tr.status}


@router.post("/transfers/{transfer_id}/reject")
def reject_transfer(transfer_id: int, db: Session = Depends(get_db),
                    current: models.User = Depends(approver)):
    tr = db.get(models.TransferRequest, transfer_id)
    if not tr:
        raise HTTPException(status_code=404, detail="Transfer request not found")
    tr.status = models.TransferStatus.REJECTED
    tr.approved_by_id = current.id
    tr.resolved_at = datetime.utcnow()
    notify(db, tr.requested_by_id, "Your transfer request was rejected", "transfer")
    log_activity(db, current.id, "transfer_reject", "transfer", tr.id)
    db.commit()
    return {"id": tr.id, "status": tr.status}


def _alloc_dict(db: Session, a: models.Allocation) -> dict:
    asset = db.get(models.Asset, a.asset_id)
    emp = db.get(models.User, a.employee_id) if a.employee_id else None
    now = datetime.utcnow()
    overdue = bool(a.status == "active" and a.expected_return_date and a.expected_return_date < now)
    return {
        "id": a.id,
        "asset_id": a.asset_id,
        "asset_tag": asset.asset_tag if asset else None,
        "asset_name": asset.name if asset else None,
        "employee_id": a.employee_id,
        "employee_name": emp.name if emp else None,
        "department_id": a.department_id,
        "allocated_at": a.allocated_at,
        "expected_return_date": a.expected_return_date,
        "returned_at": a.returned_at,
        "status": a.status,
        "overdue": overdue,
    }
