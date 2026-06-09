"""
Secure firmware update & rollback for IoMT devices.

Flow: dashboard -> backend (HMAC-SHA256 signs "device_id:version") -> MQTT control
-> device verifies the signature with the shared key before applying -> device ACKs
-> backend confirms DB state. A previous version is retained so an update can be
rolled back to the last known-good firmware.
"""
import os
import json
import hmac
import hashlib
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.models import Device as DBDevice
from app.mqtt_client import publish_mqtt_message
from app.ws_manager import ws_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/firmware", tags=["Firmware"])

# Shared signing secret — MUST match the key compiled into the ESP32 firmware.
FW_SIGNING_KEY = os.getenv("FIRMWARE_SIGNING_KEY", "medisentinel_fw_signing_key_2026")
CONTROL_TOPIC = "medisentinel/iot/control/{}"


class FirmwareUpdate(BaseModel):
    version: str


def sign_firmware(device_id: str, version: str) -> str:
    """HMAC-SHA256 over 'device_id:version' — the device recomputes this and only
    applies the update if the signatures match (rejects forged/unauthorized images)."""
    msg = f"{device_id}:{version}".encode()
    return hmac.new(FW_SIGNING_KEY.encode(), msg, hashlib.sha256).hexdigest()


def _get_fw(device: DBDevice) -> dict:
    md = device.metadata_json or {}
    fw = md.get("firmware") or {}
    return {
        "version": fw.get("version", "v1.0.0"),
        "previous": fw.get("previous"),
        "status": fw.get("status", "stable"),
        "target": fw.get("target"),
        "history": fw.get("history", []),
    }


async def _save_fw(db: AsyncSession, device: DBDevice, fw: dict):
    # Reassign metadata_json (JSON column) so SQLAlchemy detects the change.
    md = dict(device.metadata_json or {})
    md["firmware"] = fw
    device.metadata_json = md
    await db.commit()


async def _broadcast(device_id: str, fw: dict, ack: str | None = None):
    payload = {"topic": "devices/firmware", "data": {"device_id": device_id, "firmware": fw}}
    if ack:
        payload["data"]["ack"] = ack
    await ws_manager.broadcast(json.dumps(payload))


async def _require_device(db: AsyncSession, device_id: str) -> DBDevice:
    res = await db.execute(select(DBDevice).where(DBDevice.device_id == device_id))
    device = res.scalars().first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


@router.get("/{device_id}")
async def get_firmware(device_id: str, db: AsyncSession = Depends(get_db)):
    device = await _require_device(db, device_id)
    return _get_fw(device)


@router.post("/{device_id}/update")
async def update_firmware(device_id: str, payload: FirmwareUpdate, db: AsyncSession = Depends(get_db)):
    device = await _require_device(db, device_id)
    fw = _get_fw(device)
    new_version = payload.version.strip()
    if not new_version:
        raise HTTPException(status_code=400, detail="version is required")
    if new_version == fw["version"]:
        raise HTTPException(status_code=400, detail="Device already runs that version")

    signature = sign_firmware(device_id, new_version)
    fw["previous"] = fw["version"]
    fw["status"] = "updating"
    fw["target"] = new_version
    fw["history"] = (fw.get("history") or [])[-9:] + [{
        "action": "update", "from": fw["version"], "to": new_version,
        "at": datetime.utcnow().isoformat() + "Z",
    }]
    await _save_fw(db, device, fw)

    publish_mqtt_message(CONTROL_TOPIC.format(device_id), {
        "action": "firmware_update", "version": new_version, "signature": signature,
    })
    await _broadcast(device_id, fw)
    logger.info(f"Firmware update dispatched to {device_id}: {fw['previous']} -> {new_version}")
    return {"status": "dispatched", "version": new_version}


@router.post("/{device_id}/rollback")
async def rollback_firmware(device_id: str, db: AsyncSession = Depends(get_db)):
    device = await _require_device(db, device_id)
    fw = _get_fw(device)
    prev = fw.get("previous")
    if not prev:
        raise HTTPException(status_code=400, detail="No previous firmware version to roll back to")

    signature = sign_firmware(device_id, prev)
    fw["status"] = "rolling_back"
    fw["target"] = prev
    fw["history"] = (fw.get("history") or [])[-9:] + [{
        "action": "rollback", "from": fw["version"], "to": prev,
        "at": datetime.utcnow().isoformat() + "Z",
    }]
    await _save_fw(db, device, fw)

    publish_mqtt_message(CONTROL_TOPIC.format(device_id), {
        "action": "firmware_rollback", "version": prev, "signature": signature,
    })
    await _broadcast(device_id, fw)
    logger.info(f"Firmware rollback dispatched to {device_id}: -> {prev}")
    return {"status": "dispatched", "version": prev}


async def handle_firmware_ack(payload: dict):
    """Called from the MQTT bridge when a device confirms it applied/rejected an image."""
    device_id = payload.get("device_id")
    version = payload.get("version")
    status = payload.get("status")  # applied | rejected | rolled_back
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(DBDevice).where(DBDevice.device_id == device_id))
        device = res.scalars().first()
        if not device:
            return
        fw = _get_fw(device)
        if status in ("applied", "rolled_back"):
            fw["version"] = version or fw.get("target") or fw["version"]
            fw["status"] = "stable"
            fw["target"] = None
        elif status == "rejected":
            # Image was rejected (bad signature) — revert optimistic state.
            fw["status"] = "rejected"
            fw["target"] = None
        await _save_fw(session, device, fw)
        await _broadcast(device_id, fw, ack=status)
        logger.info(f"Firmware ACK from {device_id}: {status} (version {version})")
