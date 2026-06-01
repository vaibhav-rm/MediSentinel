from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio
import json

from app.database import init_db, get_db
from app.routers import auth, devices, alerts, compliance, threat_intel, ml_models, simulation
from app.ws_manager import ws_manager
from app.kafka_client import consume_kafka_alerts
from app.mqtt_client import run_mqtt_bridge

app = FastAPI(
    title="MediSentinel Enterprise Cybersecurity Framework",
    description="Backend API for AI-driven IoT Security",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(devices.router)
app.include_router(alerts.router)
app.include_router(compliance.router)
app.include_router(threat_intel.router)
app.include_router(ml_models.router)
app.include_router(simulation.router)


@app.on_event("startup")
async def on_startup():
    await init_db()
    # Create an initial admin user if none exists
    async with app.state.db_session() if hasattr(app.state, 'db_session') else get_db_context() as db:
        from sqlalchemy.future import select
        from app.models import User, RoleEnum, Device
        from app.auth import get_password_hash
        
        result = await db.execute(select(User).where(User.username == "admin"))
        if not result.scalars().first():
            admin_user = User(
                username="admin",
                hashed_password=get_password_hash("admin"),
                role=RoleEnum.admin
            )
            db.add(admin_user)
            await db.commit()
            
        # Initialize mock hospital wing devices if they don't exist
        mock_devices = [
            Device(device_id="rad-mri-01", device_type="MRI_Scanner", status="active", metadata_json={}),
            Device(device_id="rad-xray-02", device_type="XRay_Machine", status="active", metadata_json={}),
            Device(device_id="er-infusion-04", device_type="Infusion_Pump", status="active", metadata_json={}),
            Device(device_id="pharm-dispenser-01", device_type="Automated_Dispenser", status="active", metadata_json={}),
            Device(device_id="icu-vent-02", device_type="Ventilator", status="active", metadata_json={}),
            Device(device_id="er-ecg-01", device_type="ECG_Monitor", status="active", metadata_json={}),
            Device(device_id="pharm-fridge-02", device_type="Smart_Fridge", status="active", metadata_json={}),
            Device(device_id="rad-ct-01", device_type="CT_Scanner", status="active", metadata_json={})
        ]
        
        for dev in mock_devices:
            res = await db.execute(select(Device).where(Device.device_id == dev.device_id))
            if not res.scalars().first():
                db.add(dev)
        await db.commit()
    
    # Start background tasks
    asyncio.create_task(consume_kafka_alerts())
    asyncio.create_task(run_mqtt_bridge())

# Helper for manual db sessions in background tasks/startup
from app.database import AsyncSessionLocal
import contextlib

@contextlib.asynccontextmanager
async def get_db_context():
    async with AsyncSessionLocal() as session:
        yield session

@app.get("/")
async def root():
    return {"message": "Welcome to MediSentinel API"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            # We don't necessarily expect data from clients, but we keep the connection open
            data = await websocket.receive_text()
            # If clients send messages, we can handle them here
            pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
