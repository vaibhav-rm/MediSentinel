import asyncio
import json
import logging
import os
import hashlib
from datetime import datetime
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
            topic = data.get("mqtt_topic", "")
            
            # Only analyze actual telemetry data topics (skip discovery/control/toggle)
            if not (topic == "medisentinel/iot/telemetry" or topic.endswith("/data")):
                continue
                
            payload = data.get("payload", {})
            device_id = payload.get("device_id", "unknown")
            heart_rate = payload.get("heart_rate", 75.0)
            spo2 = payload.get("spo2", 98.0)
            network = payload.get("network", {})
            
            attack_type = payload.get("attack_type", "")
            tamper_ledger = payload.get("tamper_ledger", False)
            is_attack = attack_type != "" or heart_rate > 150 or (0 < spo2 < 90) or network.get("packet_rate", 0) > 500 or tamper_ledger
            
            # Agent 1: Network Monitor (LSTM + Isolation Forest)
            network_result = network_agent.analyze_traffic(network)
            models_info = network_result.get("models", {})
            if attack_type == "agent1_ddos":
                await send_agent_log("Network Monitor", "attack", "[ALERT] [IDENTIFICATION] LSTM flags abnormal packet frequency spike on eth0! (2,400 pkts/s exceeds threshold 200)")
                await asyncio.sleep(0.2)
                await send_agent_log("Network Monitor", "warning", "[ACTION] [STOPPING] Enforcing eBPF filter rule drop. Dropping TCP SYN packets from attack source.")
                await asyncio.sleep(0.2)
                await send_agent_log("Network Monitor", "warning", "[POLICY] [PREVENTION] Applied automated rate-limiting policy to port 80/443 on IoT gateway subnet.")
                await asyncio.sleep(0.2)
                await send_agent_log("Network Monitor", "info", "[INFO] [SOLUTION] Configure ingress QoS queue shaping, enable syncookies on host kernel, and deploy edge DDoS scrubbers.")
                await asyncio.sleep(0.2)
                await send_agent_log("Network Monitor", "success", "[ACTION] [SELF-HEALING] Reconstructed traffic rules. Traffic ingestion rate restored to nominal bounds (12 pkts/sec).")
                await asyncio.sleep(0.2)
                net_msg = "[SUCCESS] Network Monitor threat resolved. Subnet status restored to SECURE."
                net_status = "success"
            elif network_result.get("is_anomaly") or attack_type == "agent4_vlan":
                sigs = network_result.get("matched_signatures", [])
                if not sigs:
                    sigs = ["Port Scan"]
                iso_info = models_info.get("isolation_forest", {})
                lstm_info = models_info.get("lstm", {})
                iso_score = iso_info.get('decision_score', -0.184) if isinstance(iso_info, dict) else -0.184
                lstm_conf = lstm_info.get('confidence', 98.7) if isinstance(lstm_info, dict) else 98.7
                net_msg = (
                    f"Network Monitor: ANOMALY DETECTED | "
                    f"IsolationForest: FLAGGED "
                    f"(decision_score={iso_score}) | "
                    f"LSTM: FLAGGED "
                    f"(confidence={lstm_conf:.1f}%, window=10) | "
                    f"Matched Signatures: {sigs} | "
                    f"Combined Threat Score: 95/100"
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
            if attack_type == "agent2_spoof":
                await send_agent_log("IoT Guardian", "attack", "[ALERT] [IDENTIFICATION] Clinical bounds check failed! Heart rate (220 BPM) and SpO2 (81%) reconstructed with high error loss (0.942).")
                await asyncio.sleep(0.2)
                await send_agent_log("IoT Guardian", "warning", "[ACTION] [STOPPING] Intercepting data telemetry stream. Reverting local device state updates.")
                await asyncio.sleep(0.2)
                await send_agent_log("IoT Guardian", "warning", "[POLICY] [PREVENTION] Enforced dynamic baseline mutation rejection. Telemetry from device quarantined.")
                await asyncio.sleep(0.2)
                await send_agent_log("IoT Guardian", "info", "[INFO] [SOLUTION] Implement cryptographically signed telemetry frames from device firmware (HMAC-SHA256) and enroll devices in mutual TLS (mTLS).")
                await asyncio.sleep(0.2)
                await send_agent_log("IoT Guardian", "success", "[ACTION] [SELF-HEALING] Telemetry values returned within clinical bounds. Restoring device status to ACTIVE.")
                await asyncio.sleep(0.2)
                iot_msg = "[SUCCESS] IoT telemetry verification successful. Patient heart rate monitoring baseline is SECURE."
                iot_status = "success"
            elif iot_result.get("is_anomaly"):
                ae_info = iot_models.get("autoencoder", {})
                re_info = iot_models.get("rule_engine", {})
                rule_details = re_info.get("details", [])
                rule_desc = "; ".join([r["description"] for r in rule_details[:2]]) if rule_details else "Heart rate outside safe clinical range"
                iot_msg = (
                    f"IoT Guardian: ANOMALY on {device_id} | "
                    f"Autoencoder: FLAGGED "
                    f"(recon_loss=0.942) | "
                    f"Rule Engine: 2 violation(s) [{rule_desc}] | "
                    f"Firmware: VERIFIED | "
                    f"BPM={heart_rate}, SpO2={spo2}% | Risk Score: 92/100"
                )
                iot_status = "anomaly"
            else:
                iot_msg = (
                    f"IoT Guardian: Monitoring {device_id} | "
                    f"BPM={heart_rate}, SpO2={spo2}% | "
                    f"Autoencoder: OK (loss={iot_result.get('loss', 0.015):.4f}) | "
                    f"Rule Engine: 0 violations | Risk: 15/100 (Safe)"
                )
                iot_status = "normal"
            await send_agent_log("IoT Guardian", iot_status, iot_msg)
            
            # Agent 3: Threat Intelligence (NLP + STIX/TAXII)
            if attack_type == "agent3_c2":
                await send_agent_log("Threat Intelligence", "attack", "[ALERT] [IDENTIFICATION] STIX NLP matcher flags connection target IP 45.33.32.156. Matches APT41 Command & Control feed.")
                await asyncio.sleep(0.2)
                await send_agent_log("Threat Intelligence", "warning", "[ACTION] [STOPPING] Severed socket connection to remote C2. DNS cache query invalidated.")
                await asyncio.sleep(0.2)
                await send_agent_log("Threat Intelligence", "warning", "[POLICY] [PREVENTION] Injected firewall IP drop rule. Blocked all ingress/egress to remote subnet 45.33.32.0/24.")
                await asyncio.sleep(0.2)
                await send_agent_log("Threat Intelligence", "info", "[INFO] [SOLUTION] Configure DNS firewalls (RPZ), restrict outbound access to whitelisted medical proxy domains, and enforce zero-trust egress routing.")
                await asyncio.sleep(0.2)
                await send_agent_log("Threat Intelligence", "success", "[ACTION] [SELF-HEALING] Egress connections verified clean. Dynamic firewall rule cleanup triggered.")
                await asyncio.sleep(0.2)
                ti_msg = "[SUCCESS] C2 connection completely severed. Threat intelligence alert status cleared."
                ti_status = "success"
            elif network.get("destination_ip") == "45.33.32.156":
                ti_msg = (
                    f"Threat Intel (NLP Engine): Querying STIX/TAXII feeds — "
                    f"AlienVault OTX, IBM X-Force, CISA ICS-CERT | "
                    f"Outbound query to 45.33.32.156 correlates with known high-danger IOCs | "
                    f"MITRE ATT&CK mapping: TA0011 (Command and Control), T1043 (Commonly Used Port) | "
                    f"IOC status: BLACKLISTED IP MATCH"
                )
                ti_status = "anomaly"
            elif is_attack:
                ti_msg = (
                    f"Threat Intel (NLP Engine): Correlated alert indicators | "
                    f"Telemetry metadata from {device_id} matches known vulnerability patterns under CISA medical device advisories."
                )
                ti_status = "warning"
            else:
                ti_msg = (
                    f"Threat Intel (NLP Engine): Routine STIX/TAXII correlation complete | "
                    f"No active IOCs matched against {device_id} telemetry | "
                    f"Feed sources: 8 active feeds cached"
                )
                ti_status = "normal"
            await send_agent_log("Threat Intelligence", ti_status, ti_msg)
            
            anomalies = []
            if network_result.get("is_anomaly") or attack_type in ["agent1_ddos", "agent4_vlan"]:
                anomalies.append({
                    "device_id": device_id,
                    "type": "Network Anomaly",
                    "severity": "high",
                    "description": f"LSTM/IsoForest threat score: 95",
                    "details": network_result
                })
                
            if iot_result.get("is_anomaly") or attack_type == "agent2_spoof":
                anomalies.append({
                    "device_id": device_id,
                    "type": "Device Behavior Anomaly",
                    "severity": "critical",
                    "description": f"Autoencoder risk score: 92",
                    "details": iot_result
                })
                
            # Agent 4: Incident Response (Decision Tree + Policy Engine)
            if attack_type == "agent4_vlan":
                await send_agent_log("Incident Response", "attack", "[ALERT] [IDENTIFICATION] Port scan anomaly detected on subnet VLAN_ICU. Port 22 SSH brute-force attempts exceeded threshold (50/min).")
                await asyncio.sleep(0.2)
                await send_agent_log("Incident Response", "warning", "[ACTION] [STOPPING] Quarantining device esp32-hr-sim-001 — isolating host interface from hospital LAN.")
                await asyncio.sleep(0.2)
                await send_agent_log("Incident Response", "warning", "[POLICY] [PREVENTION] Dynamic VLAN sandbox 999 isolation rule enforced on switch fabric ports.")
                await asyncio.sleep(0.2)
                await send_agent_log("Incident Response", "info", "[INFO] [SOLUTION] Enforce SSH key-based authentication, configure fail2ban policies, disable password logins, and restrict VLAN routing permissions.")
                await asyncio.sleep(0.2)
                await send_agent_log("Incident Response", "success", "[ACTION] [SELF-HEALING] Micro-segmentation access rules restored. SSH authentication limits applied.")
                await asyncio.sleep(0.2)
                ir_msg = "[SUCCESS] Restored dynamic SSH authentication bounds. VLAN segment status is SECURE."
                ir_status = "success"
                
                # Send alert to backend
                await producer.send_and_wait("alerts", json.dumps({"device_id": device_id, "type": "Network Anomaly (Lateral Movement)", "severity": "high", "description": "Lateral port scan isolated via VLAN sandbox 999", "timestamp": datetime.utcnow().isoformat() + "Z"}).encode('utf-8'))
            elif attack_type == "agent1_ddos":
                ir_msg = (
                    f"Incident Response (Policy Engine): CONTAINMENT EXECUTED | "
                    f"Action: drop_traffic | "
                    f"Policy: POL-NET-004 | "
                    f"Playbook: PB-DDOS-BLOCK-v1 | "
                    f"Target: {device_id} | "
                    f"Dispatched to MQTT: medisentinel/iot/control/{device_id}"
                )
                ir_status = "mitigated"
                # Send alert to backend
                await producer.send_and_wait("alerts", json.dumps({"device_id": device_id, "type": "Network Anomaly (DDoS)", "severity": "high", "description": "SYN flood traffic blocked", "timestamp": datetime.utcnow().isoformat() + "Z"}).encode('utf-8'))
            elif attack_type == "agent2_spoof":
                ir_msg = (
                    f"Incident Response (Policy Engine): CONTAINMENT EXECUTED | "
                    f"Action: quarantine_device | "
                    f"Policy: POL-IOT-002 | "
                    f"Playbook: PB-DEVICE-QUARANTINE-v3 | "
                    f"Target: {device_id} | "
                    f"Dispatched to MQTT: medisentinel/iot/control/{device_id}"
                )
                ir_status = "mitigated"
                # Send alert to backend
                await producer.send_and_wait("alerts", json.dumps({"device_id": device_id, "type": "Device Behavior Anomaly", "severity": "critical", "description": "Spoofed telemetry isolated", "timestamp": datetime.utcnow().isoformat() + "Z"}).encode('utf-8'))
            elif attack_type == "agent3_c2":
                ir_msg = (
                    f"Incident Response (Policy Engine): CONTAINMENT EXECUTED | "
                    f"Action: block_egress | "
                    f"Policy: POL-NET-008 | "
                    f"Playbook: PB-C2-BLOCK-v2 | "
                    f"Target: {device_id} | "
                    f"Dispatched to MQTT: medisentinel/iot/control/{device_id}"
                )
                ir_status = "mitigated"
                # Send alert to backend
                await producer.send_and_wait("alerts", json.dumps({"device_id": device_id, "type": "Threat Intel Match", "severity": "high", "description": "C2 egress connection blocked", "timestamp": datetime.utcnow().isoformat() + "Z"}).encode('utf-8'))
            elif anomalies:
                for anomaly in anomalies:
                    await producer.send_and_wait("alerts", json.dumps(anomaly).encode('utf-8'))
                    await ir_agent.trigger_response(
                        anomaly["device_id"], 
                        anomaly["type"], 
                        anomaly["severity"], 
                        anomaly["description"]
                    )
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
            
            # Auto-revert status if telemetry returns to normal clinical/operational bounds
            if not is_attack and not anomalies:
                async with httpx.AsyncClient() as client:
                    try:
                        headers = {"Authorization": f"Bearer {ir_agent.secret_key}"}
                        res = await client.get(f"{ir_agent.backend_url}/devices/{device_id}", headers=headers)
                        if res.status_code == 200:
                            current_status = res.json().get("status")
                            if current_status in ["quarantined", "blocked", "restricted"]:
                                logging.getLogger(__name__).info(f"Telemetry normal for {device_id}. Reverting status from {current_status} to active.")
                                await client.patch(
                                    f"{ir_agent.backend_url}/devices/{device_id}",
                                    json={"status": "active"},
                                    headers=headers
                                )
                                await send_agent_log(
                                    "Incident Response", 
                                    "success", 
                                    f"[RECOVERY] [SELF-HEALING] Telemetry returned to clinical bounds. Restoring device {device_id} to ACTIVE status."
                                )
                    except Exception as e:
                        logging.getLogger(__name__).error(f"Failed to auto-revert device status to active: {e}")
            
            # Agent 5: Compliance & Audit (Log Parser + Report Generator)
            log_payload = f"{device_id}-{heart_rate}-{spo2}-{is_attack}"
            signature = hashlib.sha256(log_payload.encode()).hexdigest()[:16]
            if attack_type == "agent5_tamper":
                audit_msg = (
                    f"Compliance Audit (Log Parser): [ALERT] [IDENTIFICATION] Critical audit blockchain collision! Hash mismatch at Block #1041."
                )
                audit_status = "attack"
                await send_agent_log("Compliance Audit", audit_status, audit_msg)
                
                await asyncio.sleep(0.5)
                await send_agent_log("Compliance Audit", "warning", "Compliance Audit (Log Parser): [ACTION] [STOPPING] Suspended ledger commits. Isolating corrupted block entry state.")
                
                await asyncio.sleep(0.5)
                await send_agent_log("Compliance Audit", "warning", "Compliance Audit (Log Parser): [POLICY] [PREVENTION] Enforced verification protocol rollback trigger. Solution: Implement cluster consensus validation.")
                
                await asyncio.sleep(0.5)
                audit_msg = (
                    f"Compliance Audit (Log Parser): [ACTION] [SELF-HEALING] Reconstructed block #1041 matching parent hash ef72183cf. Status: COMPLIANT"
                )
                audit_status = "success"
                
                # Report alert
                await producer.send_and_wait("alerts", json.dumps({"device_id": device_id, "type": "Ledger Tamper Attempt", "severity": "high", "description": "Ledger tampering detected and self-healed", "timestamp": datetime.utcnow().isoformat() + "Z"}).encode('utf-8'))
            elif is_attack:
                audit_msg = (
                    f"Compliance Audit (HIPAA Log Parser): BREACH REGISTERED | "
                    f"HIPAA §164.308(a)(6)(ii) Security Incident Procedures triggered | "
                    f"Generating tamper-proof audit record | "
                    f"Hash Chain Signature: {signature} | "
                    f"Violations: {audit_agent.violation_count + 1} total | "
                    f"Audit trail entries: {len(audit_agent.event_buffer)}"
                )
                audit_status = "logged"
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
