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

# In-memory flag for simulation state and selected attack type
simulation_state = {"attack_active": False, "attack_type": "agent1_ddos"}

class AttackToggle(BaseModel):
    attack_active: bool
    attack_type: str = "agent1_ddos"

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

async def broadcast_attack_toggle(attack_active: bool, attack_type: str):
    simulation_state["attack_active"] = attack_active
    simulation_state["attack_type"] = attack_type
    
    # Publish MQTT message for Attacker Agent / Hardware
    try:
        publish_mqtt_message("medisentinel/iot/attack/toggle", {
            "attack_active": attack_active,
            "attack_type": attack_type
        })
    except Exception as e:
        logger.error(f"Failed to publish attack toggle to MQTT: {e}")

    # Seed Database Threat Intel if active
    if attack_active:
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
            logger.error(f"Failed to seed threat intel: {e}")
    else:
        # Reset device status and clear threat indicators
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
                    
                    # Broadcast status change to WebSocket
                    ws_payload = {
                        "topic": "devices/telemetry",
                        "data": {
                            "device_id": "esp32-hr-sim-001",
                            "status": "active"
                        }
                    }
                    await ws_manager.broadcast(json.dumps(ws_payload))
                
                await session.execute(delete(DBThreatIntel).where(DBThreatIntel.indicator.in_(["45.33.32.156", "esp32-hr-sim-001", "ransomware_payload.exe"])))
                await session.commit()
        except Exception as e:
            logger.error(f"Failed to reset device status: {e}")

    # Broadcast simulation update to WebSocket
    ws_payload = {
        "topic": "simulation/attack_toggle",
        "data": {"attack_active": attack_active, "attack_type": attack_type}
    }
    await ws_manager.broadcast(json.dumps(ws_payload))

@router.post("/attack-toggle")
async def toggle_attack(payload: AttackToggle):
    await broadcast_attack_toggle(payload.attack_active, payload.attack_type)
    return {"message": "Attack simulation state updated", "attack_active": payload.attack_active, "attack_type": payload.attack_type}

# Endpoints for each of the 5 attacking vectors
@router.post("/trigger/agent1_ddos")
async def trigger_agent1_ddos():
    await broadcast_attack_toggle(True, "agent1_ddos")
    return {"status": "success", "message": "Triggered Agent 1 DDoS Attack Simulation"}

@router.post("/trigger/agent2_spoof")
async def trigger_agent2_spoof():
    await broadcast_attack_toggle(True, "agent2_spoof")
    return {"status": "success", "message": "Triggered Agent 2 Telemetry Spoofing Simulation"}

@router.post("/trigger/agent3_c2")
async def trigger_agent3_c2():
    await broadcast_attack_toggle(True, "agent3_c2")
    return {"status": "success", "message": "Triggered Agent 3 C2 Beaconing Simulation"}

@router.post("/trigger/agent4_vlan")
async def trigger_agent4_vlan():
    await broadcast_attack_toggle(True, "agent4_vlan")
    return {"status": "success", "message": "Triggered Agent 4 VLAN Isolation Simulation"}

@router.post("/trigger/agent5_tamper")
async def trigger_agent5_tamper():
    await broadcast_attack_toggle(True, "agent5_tamper")
    return {"status": "success", "message": "Triggered Agent 5 Cryptographic Tamper Simulation"}

@router.get("/logs")
async def get_logs():
    return get_logs_from_file()

@router.post("/log")
async def add_log(log: AgentLog):
    if not log.timestamp:
        log.timestamp = datetime.utcnow().isoformat() + "Z"
        
    log_dict = log.model_dump()
    
    logs = get_logs_from_file()
    logs.append(log_dict)
    save_logs_to_file(logs)
    
    try:
        from app.mqtt_client import publish_mqtt_message
        publish_mqtt_message("medisentinel/iot/control/esp32-hr-sim-001", {
            "agent_name": log.agent_name,
            "status": log.status,
            "message": log.message
        })
    except Exception as e:
        logger.error(f"Failed to publish agent log to MQTT: {e}")
        
    ws_payload = {
        "topic": "simulation/agent_log",
        "data": log_dict
    }
    await ws_manager.broadcast(json.dumps(ws_payload))
    
    return {"status": "success", "log": log_dict}

@router.post("/reset")
async def reset_logs():
    save_logs_to_file([])
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
                
            await session.execute(delete(DBThreatIntel).where(DBThreatIntel.indicator.in_(["45.33.32.156", "esp32-hr-sim-001", "ransomware_payload.exe"])))
            await session.commit()
    except Exception as e:
        logger.error(f"Failed to reset device status and threat intel: {e}")
        
    ws_payload = {
        "topic": "simulation/reset",
        "data": {}
    }
    await ws_manager.broadcast(json.dumps(ws_payload))
    return {"status": "success", "message": "Simulation logs reset"}
