"""
Real over-the-air (OTA) firmware update & rollback for IoMT devices.

- Operators upload signed firmware .bin images to the backend store.
- /update and /rollback send the device an HTTP URL for the target image plus an
  HMAC-SHA256 signature over "device_id:version:url". The ESP32 verifies the
  signature, downloads the image with HTTPUpdate, flashes it to its OTA partition,
  and reboots into the new firmware.
- After reboot the device reports its running version (discovery/telemetry); the
  backend syncs DB state to that ground truth. Rollback re-flashes the previous
  image, so it works for any stored version.
"""
import os
import io
import json
import hmac
import hashlib
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.models import Device as DBDevice
from app.mqtt_client import publish_mqtt_message
from app.ws_manager import ws_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/firmware", tags=["Firmware"])

# Shared signing secret — MUST match the ESP32 FW_SIGN_KEY.
FW_SIGNING_KEY = os.getenv("FIRMWARE_SIGNING_KEY", "medisentinel_fw_signing_key_2026")
# Base URL the DEVICE uses to download images (must be reachable from the device's
# LAN — i.e. the Docker host's IP, not localhost).
OTA_BASE_URL = os.getenv("OTA_BASE_URL", "http://192.168.0.124:8000")
CONTROL_TOPIC = "medisentinel/iot/control/{}"

FIRMWARE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "firmware_images"))
REGISTRY_PATH = os.path.join(FIRMWARE_DIR, "registry.json")
os.makedirs(FIRMWARE_DIR, exist_ok=True)


# ── Image registry (global catalogue of uploaded versions) ──────────────────
def _load_registry() -> dict:
    if not os.path.exists(REGISTRY_PATH):
        return {"versions": {}}
    try:
        with open(REGISTRY_PATH) as f:
            return json.load(f)
    except Exception:
        return {"versions": {}}


def _save_registry(reg: dict):
    with open(REGISTRY_PATH, "w") as f:
        json.dump(reg, f, indent=2)


def _image_url(version: str) -> str:
    return f"{OTA_BASE_URL.rstrip('/')}/firmware/image/{version}"


def sign_command(device_id: str, version: str, url: str) -> str:
    """HMAC-SHA256 over 'device_id:version:url' — authorises the OTA command so the
    device rejects forged update pushes."""
    msg = f"{device_id}:{version}:{url}".encode()
    return hmac.new(FW_SIGNING_KEY.encode(), msg, hashlib.sha256).hexdigest()


# ── Per-device firmware state (in Device.metadata_json) ─────────────────────
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
    md = dict(device.metadata_json or {})
    md["firmware"] = fw
    device.metadata_json = md
    await db.commit()


async def _broadcast(device_id: str, fw: dict, event: str | None = None):
    data = {"device_id": device_id, "firmware": fw, "versions": list(_load_registry()["versions"].keys())}
    if event:
        data["event"] = event
    await ws_manager.broadcast(json.dumps({"topic": "devices/firmware", "data": data}))


async def _require_device(db: AsyncSession, device_id: str) -> DBDevice:
    res = await db.execute(select(DBDevice).where(DBDevice.device_id == device_id))
    device = res.scalars().first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


class FirmwareUpdate(BaseModel):
    version: str


# ── Endpoints ───────────────────────────────────────────────────────────────
@router.get("/versions")
async def list_versions():
    reg = _load_registry()
    return [{"version": v, **meta} for v, meta in sorted(reg["versions"].items())]


@router.get("/image/{version}")
async def get_image(version: str):
    reg = _load_registry()
    meta = reg["versions"].get(version)
    if not meta:
        raise HTTPException(status_code=404, detail="Unknown firmware version")
    path = os.path.join(FIRMWARE_DIR, meta["file"])
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Image file missing")
    return FileResponse(path, media_type="application/octet-stream", filename=meta["file"])


@router.post("/upload")
async def upload_image(version: str = Form(...), file: UploadFile = File(...)):
    version = version.strip()
    if not version:
        raise HTTPException(status_code=400, detail="version is required")
    data = await file.read()
    if len(data) < 1000 or data[0] != 0xE9:  # ESP32 app image magic byte
        raise HTTPException(status_code=400, detail="Not a valid ESP32 firmware image (.bin)")
    filename = f"{version}.bin"
    with open(os.path.join(FIRMWARE_DIR, filename), "wb") as f:
        f.write(data)
    reg = _load_registry()
    reg["versions"][version] = {
        "file": filename,
        "md5": hashlib.md5(data).hexdigest(),
        "size": len(data),
        "uploaded_at": datetime.utcnow().isoformat() + "Z",
    }
    _save_registry(reg)
    logger.info(f"Firmware image uploaded: {version} ({len(data)} bytes)")
    return {"status": "stored", "version": version, "size": len(data), "md5": reg["versions"][version]["md5"]}


@router.get("/{device_id}")
async def get_firmware(device_id: str, db: AsyncSession = Depends(get_db)):
    device = await _require_device(db, device_id)
    fw = _get_fw(device)
    fw["available"] = [{"version": v, **m} for v, m in sorted(_load_registry()["versions"].items())]
    return fw


@router.post("/{device_id}/update")
async def update_firmware(device_id: str, payload: FirmwareUpdate, db: AsyncSession = Depends(get_db)):
    device = await _require_device(db, device_id)
    fw = _get_fw(device)
    version = payload.version.strip()
    reg = _load_registry()
    if version not in reg["versions"]:
        raise HTTPException(status_code=400, detail=f"No uploaded image for {version}")
    if version == fw["version"]:
        raise HTTPException(status_code=400, detail="Device already runs that version")

    url = _image_url(version)
    signature = sign_command(device_id, version, url)
    fw["previous"] = fw["version"]
    fw["status"] = "updating"
    fw["target"] = version
    fw["history"] = (fw.get("history") or [])[-9:] + [{
        "action": "update", "from": fw["version"], "to": version,
        "at": datetime.utcnow().isoformat() + "Z",
    }]
    await _save_fw(db, device, fw)

    publish_mqtt_message(CONTROL_TOPIC.format(device_id), {
        "action": "firmware_update", "version": version, "url": url, "signature": signature,
    })
    await _broadcast(device_id, fw, event="update_dispatched")
    logger.info(f"OTA update dispatched to {device_id}: {fw['previous']} -> {version} ({url})")
    return {"status": "dispatched", "version": version, "url": url}


@router.post("/{device_id}/rollback")
async def rollback_firmware(device_id: str, db: AsyncSession = Depends(get_db)):
    device = await _require_device(db, device_id)
    fw = _get_fw(device)
    prev = fw.get("previous")
    if not prev:
        raise HTTPException(status_code=400, detail="No previous firmware version to roll back to")
    reg = _load_registry()
    if prev not in reg["versions"]:
        raise HTTPException(status_code=400, detail=f"Previous image {prev} is no longer in the store")

    url = _image_url(prev)
    signature = sign_command(device_id, prev, url)
    fw["status"] = "rolling_back"
    fw["target"] = prev
    fw["history"] = (fw.get("history") or [])[-9:] + [{
        "action": "rollback", "from": fw["version"], "to": prev,
        "at": datetime.utcnow().isoformat() + "Z",
    }]
    await _save_fw(db, device, fw)

    publish_mqtt_message(CONTROL_TOPIC.format(device_id), {
        "action": "firmware_rollback", "version": prev, "url": url, "signature": signature,
    })
    await _broadcast(device_id, fw, event="rollback_dispatched")
    logger.info(f"OTA rollback dispatched to {device_id}: -> {prev} ({url})")
    return {"status": "dispatched", "version": prev, "url": url}


# ── Device feedback ─────────────────────────────────────────────────────────
async def sync_reported_version(device_id: str, reported: str):
    """Device reported its running version (discovery/telemetry). After a successful
    OTA reboot this is how we confirm the new image is live."""
    if not reported:
        return
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(DBDevice).where(DBDevice.device_id == device_id))
        device = res.scalars().first()
        if not device:
            return
        fw = _get_fw(device)
        if reported == fw["version"] and fw["status"] not in ("updating", "rolling_back"):
            return  # nothing changed
        changed = reported != fw["version"]
        fw["version"] = reported
        if fw.get("target") == reported:
            fw["status"] = "stable"
            fw["target"] = None
        elif changed:
            fw["status"] = "stable"
        await _save_fw(session, device, fw)
        await _broadcast(device_id, fw, event="version_reported")
        logger.info(f"Device {device_id} reports running firmware {reported}")


async def handle_firmware_ack(payload: dict):
    """Device-side ACK for failures/rejections (success is confirmed by the post-reboot
    version report)."""
    device_id = payload.get("device_id")
    version = payload.get("version")
    status = payload.get("status")  # rejected | failed
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(DBDevice).where(DBDevice.device_id == device_id))
        device = res.scalars().first()
        if not device:
            return
        fw = _get_fw(device)
        if status in ("rejected", "failed"):
            fw["status"] = status
            fw["target"] = None
        await _save_fw(session, device, fw)
        await _broadcast(device_id, fw, event=status)
        logger.info(f"Firmware ACK from {device_id}: {status} (version {version})")
