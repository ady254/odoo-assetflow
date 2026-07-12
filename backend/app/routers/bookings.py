"""Resource Booking — time-slot booking of shared resources with strict
overlap validation (adjacent slots are allowed, overlapping ones rejected)."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from .. import models, schemas
from ..auth import get_current_user
from ..utils import log_activity, notify

router = APIRouter()


def _derive_status(b: models.Booking) -> str:
    if b.status == models.BookingStatus.CANCELLED:
        return b.status
    now = datetime.utcnow()
    if now < b.start_time:
        return models.BookingStatus.UPCOMING
    if b.start_time <= now <= b.end_time:
        return models.BookingStatus.ONGOING
    return models.BookingStatus.COMPLETED


def _booking_dict(db: Session, b: models.Booking) -> dict:
    asset = db.get(models.Asset, b.asset_id)
    user = db.get(models.User, b.booked_by_id)
    return {
        "id": b.id,
        "asset_id": b.asset_id,
        "asset_name": asset.name if asset else None,
        "asset_tag": asset.asset_tag if asset else None,
        "booked_by": user.name if user else None,
        "booked_by_id": b.booked_by_id,
        "start_time": b.start_time,
        "end_time": b.end_time,
        "status": _derive_status(b),
    }


@router.get("/resources", response_model=List[schemas.AssetOut])
def bookable_resources(db: Session = Depends(get_db),
                       current: models.User = Depends(get_current_user)):
    return db.query(models.Asset).filter(
        models.Asset.is_shared_bookable == True  # noqa: E712
    ).all()


@router.post("")
def create_booking(payload: schemas.BookingIn, db: Session = Depends(get_db),
                   current: models.User = Depends(get_current_user)):
    asset = db.get(models.Asset, payload.asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if not asset.is_shared_bookable:
        raise HTTPException(status_code=400, detail="This asset is not a bookable resource")
    if payload.end_time <= payload.start_time:
        raise HTTPException(status_code=400, detail="End time must be after start time")

    # Overlap rule: overlap when start < existing.end AND end > existing.start.
    conflict = db.query(models.Booking).filter(
        models.Booking.asset_id == payload.asset_id,
        models.Booking.status != models.BookingStatus.CANCELLED,
        models.Booking.start_time < payload.end_time,
        models.Booking.end_time > payload.start_time,
    ).first()
    if conflict:
        raise HTTPException(status_code=409, detail={
            "message": "Time slot overlaps an existing booking",
            "conflict_start": conflict.start_time.isoformat(),
            "conflict_end": conflict.end_time.isoformat(),
        })

    booking = models.Booking(
        asset_id=payload.asset_id,
        booked_by_id=current.id,
        start_time=payload.start_time,
        end_time=payload.end_time,
        status=models.BookingStatus.UPCOMING,
    )
    db.add(booking)
    notify(db, current.id, f"Booking confirmed for {asset.name}", "booking")
    log_activity(db, current.id, "create_booking", "asset", asset.id, asset.asset_tag)
    db.commit()
    db.refresh(booking)
    return _booking_dict(db, booking)


@router.get("")
def list_bookings(asset_id: Optional[int] = None, mine: bool = False,
                  db: Session = Depends(get_db),
                  current: models.User = Depends(get_current_user)):
    q = db.query(models.Booking)
    if asset_id:
        q = q.filter(models.Booking.asset_id == asset_id)
    if mine:
        q = q.filter(models.Booking.booked_by_id == current.id)
    rows = q.order_by(models.Booking.start_time.asc()).all()
    return [_booking_dict(db, b) for b in rows]


@router.get("/resource/{asset_id}")
def resource_calendar(asset_id: int, db: Session = Depends(get_db),
                      current: models.User = Depends(get_current_user)):
    """Calendar view: all existing bookings for a single resource."""
    rows = db.query(models.Booking).filter(
        models.Booking.asset_id == asset_id,
        models.Booking.status != models.BookingStatus.CANCELLED,
    ).order_by(models.Booking.start_time.asc()).all()
    return [_booking_dict(db, b) for b in rows]


@router.post("/{booking_id}/cancel")
def cancel_booking(booking_id: int, db: Session = Depends(get_db),
                   current: models.User = Depends(get_current_user)):
    b = db.get(models.Booking, booking_id)
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    b.status = models.BookingStatus.CANCELLED
    notify(db, b.booked_by_id, "Your booking was cancelled", "booking")
    log_activity(db, current.id, "cancel_booking", "booking", b.id)
    db.commit()
    return {"id": b.id, "status": b.status}
