"""Dashboard KPIs + Reports & Analytics."""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from .. import models
from ..auth import get_current_user

router = APIRouter()


@router.get("/kpis")
def kpis(db: Session = Depends(get_db),
         current: models.User = Depends(get_current_user)):
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)

    def count(model, *filters):
        return db.query(func.count(model.id)).filter(*filters).scalar() or 0

    available = count(models.Asset, models.Asset.status == models.AssetStatus.AVAILABLE)
    allocated = count(models.Asset, models.Asset.status == models.AssetStatus.ALLOCATED)
    under_maint = count(models.Asset, models.Asset.status == models.AssetStatus.UNDER_MAINTENANCE)

    maintenance_today = count(
        models.MaintenanceRequest,
        models.MaintenanceRequest.created_at >= today_start,
    )
    active_bookings = count(
        models.Booking,
        models.Booking.status != models.BookingStatus.CANCELLED,
        models.Booking.end_time >= now,
    )
    pending_transfers = count(
        models.TransferRequest,
        models.TransferRequest.status == models.TransferStatus.REQUESTED,
    )
    upcoming_returns = count(
        models.Allocation,
        models.Allocation.status == "active",
        models.Allocation.expected_return_date.isnot(None),
        models.Allocation.expected_return_date >= now,
    )
    overdue_returns = count(
        models.Allocation,
        models.Allocation.status == "active",
        models.Allocation.expected_return_date.isnot(None),
        models.Allocation.expected_return_date < now,
    )

    return {
        "assets_available": available,
        "assets_allocated": allocated,
        "under_maintenance": under_maint,
        "maintenance_today": maintenance_today,
        "active_bookings": active_bookings,
        "pending_transfers": pending_transfers,
        "upcoming_returns": upcoming_returns,
        "overdue_returns": overdue_returns,
        "total_assets": count(models.Asset),
    }


@router.get("/overdue")
def overdue(db: Session = Depends(get_db),
            current: models.User = Depends(get_current_user)):
    now = datetime.utcnow()
    rows = db.query(models.Allocation).filter(
        models.Allocation.status == "active",
        models.Allocation.expected_return_date.isnot(None),
        models.Allocation.expected_return_date < now,
    ).all()
    out = []
    for a in rows:
        asset = db.get(models.Asset, a.asset_id)
        emp = db.get(models.User, a.employee_id) if a.employee_id else None
        days = (now - a.expected_return_date).days
        out.append({
            "allocation_id": a.id,
            "asset_tag": asset.asset_tag if asset else None,
            "asset_name": asset.name if asset else None,
            "employee_name": emp.name if emp else None,
            "expected_return_date": a.expected_return_date,
            "days_overdue": days,
        })
    return out


@router.get("/reports")
def reports(db: Session = Depends(get_db),
            current: models.User = Depends(get_current_user)):
    """Aggregated analytics for the Reports & Analytics screen."""
    # utilization: allocation count per asset (most-used vs idle)
    util_rows = db.query(
        models.Allocation.asset_id, func.count(models.Allocation.id)
    ).group_by(models.Allocation.asset_id).all()
    util_map = {aid: c for aid, c in util_rows}

    assets = db.query(models.Asset).all()
    utilization = []
    for a in assets:
        utilization.append({
            "asset_tag": a.asset_tag,
            "asset_name": a.name,
            "times_allocated": util_map.get(a.id, 0),
            "status": a.status,
        })
    utilization.sort(key=lambda x: x["times_allocated"], reverse=True)

    # maintenance frequency by category
    cats = {c.id: c.name for c in db.query(models.AssetCategory).all()}
    asset_cat = {a.id: a.category_id for a in assets}
    maint_by_cat = {}
    for m in db.query(models.MaintenanceRequest).all():
        cid = asset_cat.get(m.asset_id)
        cname = cats.get(cid, "Unknown")
        maint_by_cat[cname] = maint_by_cat.get(cname, 0) + 1

    # department-wise allocation summary
    depts = {d.id: d.name for d in db.query(models.Department).all()}
    dept_alloc = {}
    for a in assets:
        if a.current_holder_department_id:
            dn = depts.get(a.current_holder_department_id, "Unknown")
            dept_alloc[dn] = dept_alloc.get(dn, 0) + 1

    # booking heatmap by hour of day (peak usage windows)
    heatmap = {h: 0 for h in range(24)}
    for b in db.query(models.Booking).filter(
        models.Booking.status != models.BookingStatus.CANCELLED).all():
        heatmap[b.start_time.hour] = heatmap.get(b.start_time.hour, 0) + 1

    return {
        "utilization": utilization,
        "idle_assets": [u for u in utilization if u["times_allocated"] == 0],
        "maintenance_by_category": maint_by_cat,
        "department_allocation": dept_alloc,
        "booking_heatmap": heatmap,
    }
