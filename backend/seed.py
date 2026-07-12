"""Seed the database with an Admin account and realistic demo data so the
prototype can be demoed immediately.

Run from the backend/ folder:  python seed.py
"""
from datetime import datetime, timedelta

from app.database import Base, engine, SessionLocal
from app import models
from app.auth import hash_password

Base.metadata.create_all(bind=engine)


def get_or_create_user(db, name, email, password, role, department_id=None):
    u = db.query(models.User).filter(models.User.email == email).first()
    if u:
        return u
    u = models.User(
        name=name, email=email, hashed_password=hash_password(password),
        role=role, department_id=department_id, status="active",
    )
    db.add(u)
    db.flush()
    return u


def run():
    db = SessionLocal()
    try:
        if db.query(models.User).filter(models.User.email == "admin@assetflow.com").first():
            print("Database already seeded. Skipping.")
            return

        # ---- Departments ----
        it = models.Department(name="IT", status="active")
        ops = models.Department(name="Operations", status="active")
        fac = models.Department(name="Facilities", status="active")
        db.add_all([it, ops, fac])
        db.flush()

        # ---- Users / roles (roles assigned by admin, never at signup) ----
        admin = get_or_create_user(db, "System Admin", "admin@assetflow.com", "admin123", models.Role.ADMIN, it.id)
        manager = get_or_create_user(db, "Asha Manager", "manager@assetflow.com", "manager123", models.Role.ASSET_MANAGER, it.id)
        head = get_or_create_user(db, "Deepak Head", "head@assetflow.com", "head123", models.Role.DEPARTMENT_HEAD, ops.id)
        priya = get_or_create_user(db, "Priya Sharma", "priya@assetflow.com", "priya123", models.Role.EMPLOYEE, it.id)
        raj = get_or_create_user(db, "Raj Verma", "raj@assetflow.com", "raj123", models.Role.EMPLOYEE, ops.id)
        db.flush()

        it.head_id = admin.id
        ops.head_id = head.id

        # ---- Categories ----
        electronics = models.AssetCategory(name="Electronics", extra_fields="warranty_period")
        furniture = models.AssetCategory(name="Furniture")
        vehicles = models.AssetCategory(name="Vehicles")
        rooms = models.AssetCategory(name="Rooms")
        db.add_all([electronics, furniture, vehicles, rooms])
        db.flush()

        # ---- Assets ----
        def asset(name, cat, tag, **kw):
            a = models.Asset(name=name, category_id=cat.id, asset_tag=tag,
                             status=models.AssetStatus.AVAILABLE, **kw)
            db.add(a)
            db.flush()
            return a

        laptop = asset("Dell Latitude Laptop", electronics, "AF-0001",
                       serial_number="DL-99201", condition="good", location="HQ Floor 2",
                       acquisition_cost=1200.0, acquisition_date=datetime.utcnow() - timedelta(days=200))
        laptop2 = asset("MacBook Pro 14", electronics, "AF-0002",
                        serial_number="MB-55123", condition="excellent", location="HQ Floor 3",
                        acquisition_cost=2400.0)
        projector = asset("Epson Projector", electronics, "AF-0003",
                          serial_number="EP-3321", condition="good", location="HQ Floor 2")
        desk = asset("Standing Desk", furniture, "AF-0004", location="HQ Floor 1",
                     acquisition_cost=350.0)
        van = asset("Delivery Van", vehicles, "AF-0005", location="Parking Lot",
                    is_shared_bookable=True, acquisition_cost=28000.0)
        room_b2 = asset("Meeting Room B2", rooms, "AF-0006", location="HQ Floor 2",
                        is_shared_bookable=True)
        room_a1 = asset("Conference Room A1", rooms, "AF-0007", location="HQ Floor 1",
                        is_shared_bookable=True)

        # ---- An active allocation (Priya holds the laptop, overdue) ----
        laptop.status = models.AssetStatus.ALLOCATED
        laptop.current_holder_user_id = priya.id
        db.add(models.Allocation(
            asset_id=laptop.id, employee_id=priya.id,
            expected_return_date=datetime.utcnow() - timedelta(days=2),  # overdue
            status="active", created_by_id=manager.id,
        ))
        # a current, non-overdue allocation
        laptop2.status = models.AssetStatus.ALLOCATED
        laptop2.current_holder_user_id = raj.id
        db.add(models.Allocation(
            asset_id=laptop2.id, employee_id=raj.id,
            expected_return_date=datetime.utcnow() + timedelta(days=10),
            status="active", created_by_id=manager.id,
        ))

        # ---- A booking on Room B2 (9:00-10:00 today) ----
        today = datetime.utcnow().replace(hour=9, minute=0, second=0, microsecond=0)
        db.add(models.Booking(
            asset_id=room_b2.id, booked_by_id=head.id,
            start_time=today, end_time=today + timedelta(hours=1),
            status=models.BookingStatus.UPCOMING,
        ))

        # ---- A pending maintenance request ----
        db.add(models.MaintenanceRequest(
            asset_id=projector.id, raised_by_id=priya.id,
            issue_description="Projector bulb flickering", priority="high",
            status=models.MaintenanceStatus.PENDING,
        ))

        # ---- Notifications ----
        db.add(models.Notification(user_id=priya.id,
                                   message="Asset AF-0001 (Dell Latitude) was assigned to you",
                                   type="allocation"))

        db.commit()
        print("Seed complete.")
        print("-" * 48)
        print("Login accounts (email / password):")
        print("  Admin          admin@assetflow.com   / admin123")
        print("  Asset Manager  manager@assetflow.com / manager123")
        print("  Dept Head      head@assetflow.com    / head123")
        print("  Employee       priya@assetflow.com   / priya123")
        print("  Employee       raj@assetflow.com     / raj123")
    finally:
        db.close()


if __name__ == "__main__":
    run()
