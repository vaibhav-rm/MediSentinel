import os
import json
import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.mqtt_client import publish_mqtt_message
from app.ws_manager import ws_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/simulation", tags=["simulation"])

LOGS_FILE_PATH = os.path.join(os.path.dirname(__file__), "..", "simulation_logs.json")

# Simple in-memory flag for simulation state
simulation_state = {"attack_active": False}

class AttackToggle(BaseModel):
    attack_active: bool

class AgentLog(BaseModel):
    agent_name: str
    status: str
    message: str
    timestamp: str = None

def get_logs_from_file():
    if not os.path.exists(LOGS_FILE_PATH):
        return []
    try:
        with open(LOGS_FILE_PATH, "r") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to read simulation logs: {e}")
        return []

def save_logs_to_file(logs):
    try:
        with open(LOGS_FILE_PATH, "w") as f:
            json.dump(logs, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to write simulation logs: {e}")

@router.get("/attack-status")
async def get_attack_status():
    return simulation_state

@router.post("/attack-toggle")
async def toggle_attack(payload: AttackToggle):
    simulation_state["attack_active"] = payload.attack_active
    logger.info(f"Attack simulation toggled: {payload.attack_active}")
    
    # Publish MQTT message so the Attacker Agent can react
    try:
        publish_mqtt_message("medisentinel/iot/attack/toggle", {"attack_active": payload.attack_active})
    except Exception as e:
        logger.error(f"Failed to publish attack toggle to MQTT: {e}")
        
    # Auto-inject threat IOCs when attack is active
    if payload.attack_active:
        from app.database import AsyncSessionLocal
        from app.models import ThreatIntel as DBThreatIntel
        from sqlalchemy.future import select
        try:
            async with AsyncSessionLocal() as session:
                for indicator, ioc_type, confidence, source in [
                    ("45.33.32.156", "ip", 98, "AlienVault OTX"),
                    ("esp32-hr-sim-001", "device_id", 95, "VirusTotal"),
                    ("ransomware_payload.exe", "file", 92, "CISA Known Exploits")
                ]:
                    result = await session.execute(select(DBThreatIntel).where(DBThreatIntel.indicator == indicator))
                    existing = result.scalars().first()
                    if not existing:
                        db_intel = DBThreatIntel(indicator=indicator, type=ioc_type, confidence=confidence, source_feed=source)
                        session.add(db_intel)
                await session.commit()
        except Exception as e:
            logger.error(f"Failed to seed threat intel during toggle: {e}")

    # Broadcast simulation update to WebSocket
    ws_payload = {
        "topic": "simulation/attack_toggle",
        "data": {"attack_active": payload.attack_active}
    }
    await ws_manager.broadcast(json.dumps(ws_payload))
    
    return {"message": "Attack simulation state updated", "attack_active": payload.attack_active}

@router.get("/logs")
async def get_logs():
    return get_logs_from_file()

@router.post("/log")
async def add_log(log: AgentLog):
    if not log.timestamp:
        log.timestamp = datetime.utcnow().isoformat() + "Z"
        
    log_dict = log.model_dump()
    
    # Save to JSON file
    logs = get_logs_from_file()
    logs.append(log_dict)
    save_logs_to_file(logs)
    
    # Forward Agent status/logs to ESP32 control topic
    try:
        from app.mqtt_client import publish_mqtt_message
        publish_mqtt_message("medisentinel/iot/control/esp32-hr-sim-001", {
            "agent_name": log.agent_name,
            "status": log.status,
            "message": log.message
        })
    except Exception as e:
        logger.error(f"Failed to publish agent log to MQTT: {e}")
        
    # Broadcast to frontend via WS
    ws_payload = {
        "topic": "simulation/agent_log",
        "data": log_dict
    }
    await ws_manager.broadcast(json.dumps(ws_payload))
    
    return {"status": "success", "log": log_dict}

@router.post("/reset")
async def reset_logs():
    save_logs_to_file([])
    # Reset device status to active to clean up
    from app.database import AsyncSessionLocal
    from app.models import Device as DBDevice, ThreatIntel as DBThreatIntel
    from sqlalchemy.future import select
    from sqlalchemy import delete
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(DBDevice).where(DBDevice.device_id == "esp32-hr-sim-001"))
            db_device = result.scalars().first()
            if db_device:
                db_device.status = "active"
                await session.commit()
                publish_mqtt_message("medisentinel/iot/control/esp32-hr-sim-001", {"status": "active"})
                
            # Clear simulation threat intel indicators
            await session.execute(delete(DBThreatIntel).where(DBThreatIntel.indicator.in_(["45.33.32.156", "esp32-hr-sim-001", "ransomware_payload.exe"])))
            await session.commit()
    except Exception as e:
        logger.error(f"Failed to reset device status and threat intel on simulation reset: {e}")
        
    ws_payload = {
        "topic": "simulation/reset",
        "data": {}
    }
    await ws_manager.broadcast(json.dumps(ws_payload))
    return {"status": "success", "message": "Simulation logs reset"}
