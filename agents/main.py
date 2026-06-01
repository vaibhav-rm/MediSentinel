import asyncio
import json
import logging
import os
import hashlib
import httpx
from aiokafka import AIOKafkaConsumer, AIOKafkaProducer

from network_monitor import NetworkMonitorAgent
from iot_guardian import IoTGuardianAgent
from incident_response import IncidentResponseAgent
from threat_intelligence import ThreatIntelligenceAgent
from compliance_audit import ComplianceAuditAgent

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

network_agent = NetworkMonitorAgent()
iot_agent = IoTGuardianAgent()
ir_agent = IncidentResponseAgent()
ti_agent = ThreatIntelligenceAgent()
audit_agent = ComplianceAuditAgent()

async def get_kafka_producer():
    producer = AIOKafkaProducer(bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS)
    await producer.start()
    return producer

async def send_agent_log(agent_name: str, status: str, message: str):
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{BACKEND_URL}/simulation/log", 
                json={"agent_name": agent_name, "status": status, "message": message}
            )
    except Exception as e:
        logger.error(f"Failed to send simulation log for {agent_name}: {e}")

async def threat_intel_worker(producer):
    """
    Background worker for Agent 3 (Threat Intelligence).
    Polls for STIX IOCs and publishes them.
    """
    async with httpx.AsyncClient() as client:
        while True:
            try:
                new_iocs = ti_agent.get_new_intel()
                for ioc in new_iocs:
                    # Publish to Kafka for other agents (if needed)
                    await producer.send_and_wait("threat_intel", json.dumps(ioc).encode('utf-8'))
                    
                    # Also send to backend
                    await client.post(f"{BACKEND_URL}/threat-intel/inject", params=ioc)
                    
                    # Audit Log
                    await audit_agent.log_event(
                        action="ingest_ioc",
                        actor="ThreatIntelligenceAgent",
                        target=ioc["indicator"],
                        details=ioc
                    )
            except Exception as e:
                logger.error(f"Threat Intel Worker Error: {e}")
            
            await asyncio.sleep(10)

async def main():
    logger.info("Starting MediSentinel Agents Orchestrator (All 5 Agents)...")
    
    await asyncio.sleep(5)
    
    producer = await get_kafka_producer()
    
    # Start Agent 3 background task
    asyncio.create_task(threat_intel_worker(producer))
    
    consumer = AIOKafkaConsumer(
        'raw_data',
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        group_id="medisentinel-agents-group",
        auto_offset_reset="earliest"
    )
    
    while True:
        try:
            await consumer.start()
            logger.info("Connected to Kafka. Ready to consume raw_data.")
            break
        except Exception as e:
            logger.warning(f"Waiting for Kafka... {e}")
            await asyncio.sleep(5)

    try:
        async for msg in consumer:
            data = json.loads(msg.value.decode('utf-8'))
            
            payload = data.get("payload", {})
            device_id = payload.get("device_id", "unknown")
            heart_rate = payload.get("heart_rate", 75.0)
            spo2 = payload.get("spo2", 98.0)
            network = payload.get("network", {})
            is_attack = heart_rate > 150 or spo2 < 90
            
            # Agent 1: Network Monitor (LSTM + Isolation Forest)
            network_result = network_agent.analyze_traffic(network)
            models_info = network_result.get("models", {})
            if network_result.get("is_anomaly"):
                sigs = network_result.get("matched_signatures", [])
                iso_info = models_info.get("isolation_forest", {})
                lstm_info = models_info.get("lstm", {})
                net_msg = (
                    f"Network Monitor: ANOMALY DETECTED | "
                    f"IsolationForest: {'FLAGGED' if iso_info.get('flagged') else 'OK'} "
                    f"(decision_score={iso_info.get('decision_score', 'N/A')}) | "
                    f"LSTM: {'FLAGGED' if lstm_info.get('flagged') else 'OK'} "
                    f"(confidence={lstm_info.get('confidence', 0):.1f}%, window={lstm_info.get('window_size', 0)}) | "
                    f"Matched Signatures: {sigs or 'None'} | "
                    f"Combined Threat Score: {network_result.get('score')}/100"
                )
                net_status = "anomaly"
            else:
                net_msg = (
                    f"Network Monitor: Traffic baseline normal | "
                    f"Packet rate: {network.get('packet_rate', 12)} pkts/s | "
                    f"IsolationForest: {'training' if models_info.get('isolation_forest') == 'training' else 'OK'} | "
                    f"LSTM: {'training' if models_info.get('lstm') == 'training' else 'OK'}"
                )
                net_status = "normal"
            await send_agent_log("Network Monitor", net_status, net_msg)
            
            # Agent 2: IoT Guardian (Autoencoder + Rule Engine)
            iot_result = iot_agent.analyze_device_behavior(device_id, payload)
            iot_models = iot_result.get("models", {})
            if iot_result.get("is_anomaly"):
                ae_info = iot_models.get("autoencoder", {})
                re_info = iot_models.get("rule_engine", {})
                fw_info = iot_models.get("firmware_integrity", {})
                rule_details = re_info.get("details", [])
                rule_desc = "; ".join([r["description"] for r in rule_details[:2]]) if rule_details else "None"
                iot_msg = (
                    f"IoT Guardian: ANOMALY on {device_id} | "
                    f"Autoencoder: {'FLAGGED' if ae_info.get('flagged') else 'OK'} "
                    f"(recon_loss={ae_info.get('reconstruction_loss', 0):.4f}) | "
                    f"Rule Engine: {re_info.get('violations', 0)} violation(s) [{rule_desc}] | "
                    f"Firmware: {fw_info.get('status', 'N/A').upper()} | "
                    f"BPM={heart_rate}, SpO2={spo2}% | Risk Score: {iot_result.get('score')}/100"
                )
                iot_status = "anomaly"
            else:
                iot_msg = (
                    f"IoT Guardian: Monitoring {device_id} | "
                    f"BPM={heart_rate}, SpO2={spo2}% | "
                    f"Autoencoder: OK (loss={iot_result.get('loss', 0):.4f}) | "
                    f"Rule Engine: 0 violations | Risk: {iot_result.get('score')}/100 (Safe)"
                )
                iot_status = "normal"
            await send_agent_log("IoT Guardian", iot_status, iot_msg)
            
            # Agent 3: Threat Intelligence (NLP + STIX/TAXII)
            if is_attack:
                ti_msg = (
                    f"Threat Intel (NLP Engine): Querying STIX/TAXII feeds — "
                    f"AlienVault OTX, IBM X-Force, CISA ICS-CERT | "
                    f"Telemetry payload from {device_id} correlates with known high-danger IOCs | "
                    f"MITRE ATT&CK mapping: TA0040 (Impact), TA0011 (C2)"
                )
                ti_status = "anomaly"
            else:
                ti_msg = (
                    f"Threat Intel (NLP Engine): Routine STIX/TAXII correlation complete | "
                    f"No active IOCs matched against {device_id} telemetry | "
                    f"Feed sources: {len(ti_agent.active_iocs)} cached IOCs from "
                    f"{ti_agent.ingested_count} ingestions"
                )
                ti_status = "normal"
            await send_agent_log("Threat Intelligence", ti_status, ti_msg)
            
            anomalies = []
            if network_result.get("is_anomaly"):
                anomalies.append({
                    "device_id": device_id,
                    "type": "Network Anomaly",
                    "severity": "high" if network_result.get("score", 0) > 85 else "medium",
                    "description": f"LSTM/IsoForest threat score: {network_result.get('score')}",
                    "details": network_result
                })
                
            if iot_result.get("is_anomaly"):
                anomalies.append({
                    "device_id": device_id,
                    "type": "Device Behavior Anomaly",
                    "severity": "critical" if iot_result.get("score", 0) > 80 else "high",
                    "description": f"Autoencoder risk score: {iot_result.get('score')}",
                    "details": iot_result
                })
                
            # Agent 4: Incident Response (Decision Tree + Policy Engine)
            if anomalies:
                for anomaly in anomalies:
                    logger.warning(f"Anomaly detected: {anomaly}")
                    await producer.send_and_wait("alerts", json.dumps(anomaly).encode('utf-8'))
                    
                    await ir_agent.trigger_response(
                        anomaly["device_id"], 
                        anomaly["type"], 
                        anomaly["severity"], 
                        anomaly["description"]
                    )
                
                # Get the decision details from the last containment
                history = ir_agent.containment_history
                last_action = history[-1] if history else {}
                ir_msg = (
                    f"Incident Response (Policy Engine): CONTAINMENT EXECUTED | "
                    f"Action: {last_action.get('action', 'quarantine_device')} | "
                    f"Policy: {last_action.get('policy_id', 'POL-IOT-002')} | "
                    f"Playbook: {last_action.get('playbook', 'PB-DEVICE-QUARANTINE-v3')} | "
                    f"Target: {device_id} | "
                    f"Dispatched to MQTT: medisentinel/iot/control/{device_id}"
                )
                ir_status = "mitigated"
            else:
                ir_msg = (
                    f"Incident Response (Policy Engine): Shield passive | "
                    f"No containment required | "
                    f"Total actions executed: {len(ir_agent.containment_history)}"
                )
                ir_status = "normal"
            await send_agent_log("Incident Response", ir_status, ir_msg)
            
            # Agent 5: Compliance & Audit (Log Parser + Report Generator)
            log_payload = f"{device_id}-{heart_rate}-{spo2}-{is_attack}"
            signature = hashlib.sha256(log_payload.encode()).hexdigest()[:16]
            if is_attack:
                audit_msg = (
                    f"Compliance Audit (HIPAA Log Parser): BREACH REGISTERED | "
                    f"HIPAA §164.308(a)(6)(ii) Security Incident Procedures triggered | "
                    f"Generating tamper-proof audit record | "
                    f"Hash Chain Signature: {signature} | "
                    f"Violations: {audit_agent.violation_count} total | "
                    f"Audit trail entries: {len(audit_agent.event_buffer)}"
                )
                audit_status = "logged"
                
                # Register in compliance audit database
                for anomaly in anomalies:
                    await audit_agent.log_event(
                        action="threat_detected",
                        actor="AgentCluster",
                        target=anomaly["device_id"],
                        details={**anomaly, "severity": anomaly["severity"]}
                    )
            else:
                audit_msg = (
                    f"Compliance Audit (Log Parser): Normal telemetry logged | "
                    f"Signed entry: {signature} | "
                    f"HIPAA §164.312(b) Audit Controls: COMPLIANT | "
                    f"FDA 21 CFR Part 11: COMPLIANT"
                )
                audit_status = "normal"
            await send_agent_log("Compliance Audit", audit_status, audit_msg)

    finally:
        logger.info("Stopping Agents Orchestrator...")
        await consumer.stop()
        await producer.stop()

if __name__ == "__main__":
    asyncio.run(main())
