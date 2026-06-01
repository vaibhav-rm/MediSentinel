from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.models import Device as DBDevice, User
from app.schemas import Device, DeviceCreate, DeviceUpdate
from app.auth import get_current_active_user, require_admin

router = APIRouter(prefix="/devices", tags=["devices"])

@router.get("/", response_model=List[Device])
async def read_devices(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DBDevice).offset(skip).limit(limit))
    return result.scalars().all()

@router.get("/{device_id}", response_model=Device)
async def read_device(device_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DBDevice).where(DBDevice.device_id == device_id))
    device = result.scalars().first()
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    return device

@router.post("/", response_model=Device)
async def create_device(device: DeviceCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    result = await db.execute(select(DBDevice).where(DBDevice.device_id == device.device_id))
    db_device = result.scalars().first()
    if db_device:
        raise HTTPException(status_code=400, detail="Device already registered")
    
    db_device = DBDevice(**device.model_dump())
    db.add(db_device)
    await db.commit()
    await db.refresh(db_device)
    return db_device

@router.patch("/{device_id}", response_model=Device)
async def update_device(device_id: str, device: DeviceUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    result = await db.execute(select(DBDevice).where(DBDevice.device_id == device_id))
    db_device = result.scalars().first()
    if not db_device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    update_data = device.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_device, key, value)
        
    await db.commit()
    await db.refresh(db_device)

    if "status" in update_data:
        try:
            from app.mqtt_client import publish_mqtt_message
            publish_mqtt_message(f"medisentinel/iot/control/{device_id}", {"status": db_device.status})
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to publish status change to MQTT: {e}")

    return db_device
