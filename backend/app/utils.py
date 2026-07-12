"""Shared helper functions used across routers."""
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from . import models


def log_activity(db: Session, user_id, action: str, entity_type: str = None,
                 entity_id: int = None, details: str = None):
    """Record an entry in the activity log (who did what, when)."""
    log = models.ActivityLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
    )
    db.add(log)


def notify(db: Session, user_id, message: str, type: str = "info"):
    """Create an in-app notification for a user."""
    if not user_id:
        return
    n = models.Notification(user_id=user_id, message=message, type=type)
    db.add(n)


def generate_asset_tag(db: Session) -> str:
    """Auto-generate the next asset tag, e.g. AF-0001."""
    count = db.query(func.count(models.Asset.id)).scalar() or 0
    return f"AF-{count + 1:04d}"
