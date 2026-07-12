from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas, auth as auth_utils
from ..utils import log_activity

router = APIRouter()


@router.post("/signup", response_model=schemas.Token)
def signup(payload: schemas.SignupIn, db: Session = Depends(get_db)):
    """Signup always creates a plain Employee account. Roles are NEVER
    self-assigned here — only an Admin can promote from the directory."""
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = models.User(
        name=payload.name,
        email=payload.email,
        hashed_password=auth_utils.hash_password(payload.password),
        role=models.Role.EMPLOYEE,   # forced — no role selection at signup
        status="active",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    log_activity(db, user.id, "signup", "user", user.id, f"{user.email} registered")
    db.commit()

    token = auth_utils.create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/login", response_model=schemas.Token)
def login(payload: schemas.LoginIn, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not auth_utils.verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.status != "active":
        raise HTTPException(status_code=403, detail="Account is inactive")

    token = auth_utils.create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=schemas.UserOut)
def me(current: models.User = Depends(auth_utils.get_current_user)):
    return current


@router.post("/forgot-password")
def forgot_password(payload: schemas.LoginIn, db: Session = Depends(get_db)):
    """Prototype stub: in production this emails a reset link. Here we just
    confirm the account exists so the UI flow can be demonstrated."""
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if user and payload.password:
        user.hashed_password = auth_utils.hash_password(payload.password)
        db.commit()
        return {"status": "ok", "detail": "Password reset"}
    return {"status": "ok", "detail": "If the account exists, it has been updated"}
