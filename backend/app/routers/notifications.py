"""Activity Logs & Notifications."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models
from ..auth import get_current_user, require_roles

router = APIRouter()


@router.get("")
def my_notifications(unread_only: bool = False, db: Session = Depends(get_db),
                     current: models.User = Depends(get_current_user)):
    q = db.query(models.Notification).filter(
        models.Notification.user_id == current.id)
    if unread_only:
        q = q.filter(models.Notification.is_read == False)  # noqa: E712
    rows = q.order_by(models.Notification.created_at.desc()).limit(100).all()
    return [
        {
            "id": n.id,
            "message": n.message,
            "type": n.type,
            "is_read": n.is_read,
            "created_at": n.created_at,
        } for n in rows
    ]


@router.post("/{notif_id}/read")
def mark_read(notif_id: int, db: Session = Depends(get_db),
              current: models.User = Depends(get_current_user)):
    n = db.get(models.Notification, notif_id)
    if not n or n.user_id != current.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = True
    db.commit()
    return {"id": n.id, "is_read": True}


@router.post("/read-all")
def mark_all_read(db: Session = Depends(get_db),
                  current: models.User = Depends(get_current_user)):
    db.query(models.Notification).filter(
        models.Notification.user_id == current.id,
        models.Notification.is_read == False,  # noqa: E712
    ).update({"is_read": True})
    db.commit()
    return {"status": "ok"}


@router.get("/activity")
def activity_log(limit: int = 100, db: Session = Depends(get_db),
                 current: models.User = Depends(require_roles(
                     models.Role.ADMIN, models.Role.ASSET_MANAGER,
                     models.Role.DEPARTMENT_HEAD))):
    """Full audit log of who did what, when (managers/admin only)."""
    rows = db.query(models.ActivityLog).order_by(
        models.ActivityLog.created_at.desc()).limit(limit).all()
    out = []
    for a in rows:
        u = db.get(models.User, a.user_id) if a.user_id else None
        out.append({
            "id": a.id,
            "user": u.name if u else "System",
            "action": a.action,
            "entity_type": a.entity_type,
            "entity_id": a.entity_id,
            "details": a.details,
            "created_at": a.created_at,
        })
    return out
