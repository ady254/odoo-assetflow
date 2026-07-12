from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import auth, org, assets, allocations, bookings, maintenance, dashboard, audits, notifications

Base.metadata.create_all(bind=engine)

app = FastAPI(title="AssetFlow API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(org.router, prefix="/org", tags=["org"])
app.include_router(assets.router, prefix="/assets", tags=["assets"])
app.include_router(allocations.router, prefix="/allocations", tags=["allocations"])
app.include_router(bookings.router, prefix="/bookings", tags=["bookings"])
app.include_router(maintenance.router, prefix="/maintenance", tags=["maintenance"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
app.include_router(audits.router, prefix="/audits", tags=["audits"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])


@app.get("/")
def root():
    return {"status": "ok", "service": "AssetFlow API"}
