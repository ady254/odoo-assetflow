"""Asset Audit — structured verification cycles. Create a cycle with a
scope + auditors, auto-populate the assets in scope, let auditors mark each
Verified/Missing/Damaged, auto-generate a discrepancy report, then close
(confirmed-missing assets become Lost)."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..auth import get_current_user, require_roles
from ..utils import log_activity, notify

router = APIRouter()

admin_only = require_roles(models.Role.ADMIN)


@router.post("")
def create_cycle(payload: schemas.AuditCycleIn, db: Session = Depends(get_db),
                 current: models.User = Depends(admin_only)):
    cycle = models.AuditCycle(
        name=payload.name,
        scope_department_id=payload.scope_department_id,
        scope_location=payload.scope_location,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status="open",
        created_by_id=current.id,
    )
    db.add(cycle)
    db.flush()  # get cycle.id

    # assign auditors
    for aid in payload.auditor_ids:
        db.add(models.AuditAssignment(audit_cycle_id=cycle.id, auditor_id=aid))
        notify(db, aid, f"You were assigned to audit cycle '{cycle.name}'", "audit")

    # auto-populate the assets in scope
    q = db.query(models.Asset)
    if payload.scope_department_id:
        q = q.filter(models.Asset.current_holder_department_id == payload.scope_department_id)
    if payload.scope_location:
        q = q.filter(models.Asset.location.ilike(f"%{payload.scope_location}%"))
    for asset in q.all():
        db.add(models.AuditItem(audit_cycle_id=cycle.id, asset_id=asset.id))

    log_activity(db, current.id, "audit_create", "audit", cycle.id, cycle.name)
    db.commit()
    db.refresh(cycle)
    return {"id": cycle.id, "name": cycle.name, "status": cycle.status}


@router.get("")
def list_cycles(db: Session = Depends(get_db),
                current: models.User = Depends(get_current_user)):
    rows = db.query(models.AuditCycle).order_by(models.AuditCycle.created_at.desc()).all()
    out = []
    for c in rows:
        items = db.query(models.AuditItem).filter(models.AuditItem.audit_cycle_id == c.id).all()
        checked = [i for i in items if i.result]
        out.append({
            "id": c.id,
            "name": c.name,
            "scope_department_id": c.scope_department_id,
            "scope_location": c.scope_location,
            "start_date": c.start_date,
            "end_date": c.end_date,
            "status": c.status,
            "total_items": len(items),
            "checked_items": len(checked),
        })
    return out


@router.get("/{cycle_id}")
def get_cycle(cycle_id: int, db: Session = Depends(get_db),
              current: models.User = Depends(get_current_user)):
    cycle = db.get(models.AuditCycle, cycle_id)
    if not cycle:
        raise HTTPException(status_code=404, detail="Audit cycle not found")

    assignments = db.query(models.AuditAssignment).filter(
        models.AuditAssignment.audit_cycle_id == cycle_id).all()
    auditors = []
    for a in assignments:
        u = db.get(models.User, a.auditor_id)
        if u:
            auditors.append({"id": u.id, "name": u.name})

    items = db.query(models.AuditItem).filter(
        models.AuditItem.audit_cycle_id == cycle_id).all()
    item_list = []
    for it in items:
        asset = db.get(models.Asset, it.asset_id)
        item_list.append({
            "id": it.id,
            "asset_id": it.asset_id,
            "asset_tag": asset.asset_tag if asset else None,
            "asset_name": asset.name if asset else None,
            "result": it.result,
            "notes": it.notes,
            "checked_at": it.checked_at,
        })

    return {
        "id": cycle.id,
        "name": cycle.name,
        "status": cycle.status,
        "scope_department_id": cycle.scope_department_id,
        "scope_location": cycle.scope_location,
        "start_date": cycle.start_date,
        "end_date": cycle.end_date,
        "auditors": auditors,
        "items": item_list,
    }


@router.post("/{cycle_id}/mark")
def mark_item(cycle_id: int, payload: schemas.AuditMarkIn, db: Session = Depends(get_db),
              current: models.User = Depends(get_current_user)):
    cycle = db.get(models.AuditCycle, cycle_id)
    if not cycle:
        raise HTTPException(status_code=404, detail="Audit cycle not found")
    if cycle.status != "open":
        raise HTTPException(status_code=400, detail="Audit cycle is closed")
    if payload.result not in ("verified", "missing", "damaged"):
        raise HTTPException(status_code=400, detail="result must be verified/missing/damaged")

    item = db.query(models.AuditItem).filter(
        models.AuditItem.audit_cycle_id == cycle_id,
        models.AuditItem.asset_id == payload.asset_id,
    ).first()
    if not item:
        item = models.AuditItem(audit_cycle_id=cycle_id, asset_id=payload.asset_id)
        db.add(item)
    item.result = payload.result
    item.notes = payload.notes
    item.checked_at = datetime.utcnow()
    log_activity(db, current.id, "audit_mark", "asset", payload.asset_id, payload.result)
    db.commit()
    return {"asset_id": payload.asset_id, "result": payload.result}


@router.get("/{cycle_id}/discrepancies")
def discrepancy_report(cycle_id: int, db: Session = Depends(get_db),
                       current: models.User = Depends(get_current_user)):
    """Auto-generated report of every flagged (missing/damaged) item."""
    items = db.query(models.AuditItem).filter(
        models.AuditItem.audit_cycle_id == cycle_id,
        models.AuditItem.result.in_(["missing", "damaged"]),
    ).all()
    report = []
    for it in items:
        asset = db.get(models.Asset, it.asset_id)
        report.append({
            "asset_id": it.asset_id,
            "asset_tag": asset.asset_tag if asset else None,
            "asset_name": asset.name if asset else None,
            "result": it.result,
            "notes": it.notes,
            "checked_at": it.checked_at,
        })
    return {"cycle_id": cycle_id, "discrepancies": report, "count": len(report)}


@router.post("/{cycle_id}/close")
def close_cycle(cycle_id: int, db: Session = Depends(get_db),
                current: models.User = Depends(admin_only)):
    cycle = db.get(models.AuditCycle, cycle_id)
    if not cycle:
        raise HTTPException(status_code=404, detail="Audit cycle not found")
    cycle.status = "closed"

    # confirmed-missing assets become Lost
    missing = db.query(models.AuditItem).filter(
        models.AuditItem.audit_cycle_id == cycle_id,
        models.AuditItem.result == "missing",
    ).all()
    updated = 0
    for it in missing:
        asset = db.get(models.Asset, it.asset_id)
        if asset:
            asset.status = models.AssetStatus.LOST
            updated += 1
            notify(db, cycle.created_by_id, f"{asset.asset_tag} marked LOST after audit", "audit")

    log_activity(db, current.id, "audit_close", "audit", cycle.id,
                 f"{updated} asset(s) marked lost")
    db.commit()
    return {"id": cycle.id, "status": "closed", "assets_marked_lost": updated}
