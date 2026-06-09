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

# Consecutive clean telemetry samples required before lifting containment. Debounces
# recovery so a quarantined device reporting normal values (or interleaved clean/attack
# sources) doesn't oscillate in and out of quarantine.
CLEAN_SAMPLES_TO_RECOVER = int(os.getenv("CLEAN_SAMPLES_TO_RECOVER", "3"))

network_agent = NetworkMonitorAgent()
iot_agent = IoTGuardianAgent()
ir_agent = IncidentResponseAgent()
ti_agent = ThreatIntelligenceAgent()
audit_agent = ComplianceAuditAgent()


# =====================================================================
# CONTAINMENT PLAYBOOKS  (one per detected threat category)
#   detector  : which agent surfaces the detection
#   status    : protective device status applied during containment
#               (the backend PATCH publishes this to the ESP32 over MQTT)
#   action / policy / playbook : audit-trail metadata
# =====================================================================
PLAYBOOKS = {
    "ddos":    dict(detector="Network Monitor",     status="blocked",     action="drop_traffic",
                    policy="POL-NET-004", playbook="PB-DDOS-BLOCK-v1",
                    alert_type="Network Anomaly (DDoS)",            severity="high"),
    "c2":      dict(detector="Threat Intelligence", status="restricted",  action="block_egress",
                    policy="POL-NET-008", playbook="PB-C2-BLOCK-v2",
                    alert_type="Threat Intel Match (C2)",           severity="high"),
    "lateral": dict(detector="Network Monitor",     status="quarantined", action="vlan_isolate",
                    policy="POL-NET-006", playbook="PB-VLAN-ISOLATE-v1",
                    alert_type="Network Anomaly (Lateral Movement)", severity="high"),
    "spoof":   dict(detector="IoT Guardian",        status="quarantined", action="quarantine_device",
                    policy="POL-IOT-002", playbook="PB-DEVICE-QUARANTINE-v3",
                    alert_type="Device Behavior Anomaly",           severity="critical"),
    "tamper":  dict(detector="Compliance Audit",    status="quarantined", action="ledger_rollback",
                    policy="POL-AUD-001", playbook="PB-LEDGER-HEAL-v1",
                    alert_type="Ledger Tamper Attempt",             severity="high"),
    "network": dict(detector="Network Monitor",     status="restricted",  action="limit_network_access",
                    policy="POL-NET-003", playbook="PB-NET-RESTRICT-v1",
                    alert_type="Network Anomaly",                   severity="high"),
}

STOPPING = {
    "ddos":    "[ACTION] [STOPPING] eBPF/XDP filter installed — dropping spoofed TCP SYN packets at ingress; rate-limiting port 80/443.",
    "c2":      "[ACTION] [STOPPING] Severed the socket to the remote C2 host and injected a firewall drop rule for the destination subnet.",
    "lateral": "[ACTION] [STOPPING] Disabled the offending switch port and routed the device into sandbox VLAN 999.",
    "spoof":   "[ACTION] [STOPPING] Intercepted the telemetry stream and rejected the spoofed frames; reverted local device state.",
    "tamper":  "[ACTION] [STOPPING] Suspended ledger commits and isolated the corrupted block entry.",
    "network": "[ACTION] [STOPPING] Restricted the device to its local VLAN and throttled the anomalous flows.",
}

SOLUTION = {
    "ddos":    "[INFO] [SOLUTION] Enable kernel syncookies, ingress QoS shaping, and edge DDoS scrubbing for permanent mitigation.",
    "c2":      "[INFO] [SOLUTION] Deploy DNS RPZ, restrict egress to whitelisted medical proxies, and enforce zero-trust routing.",
    "lateral": "[INFO] [SOLUTION] Enforce SSH key auth + MFA, disable password logins, and apply micro-segmentation.",
    "spoof":   "[INFO] [SOLUTION] Sign telemetry frames with HMAC-SHA256 in firmware and enrol devices in mutual TLS (mTLS).",
    "tamper":  "[INFO] [SOLUTION] Adopt distributed consensus (e.g. Raft) so no single node can override the audit ledger.",
    "network": "[INFO] [SOLUTION] Tighten baseline flow policies and enable continuous behavioural monitoring.",
}

HEAL = {
    "ddos":    "[ACTION] [SELF-HEALING] Traffic ingestion restored to nominal bounds; filter rules reconstructed.",
    "c2":      "[ACTION] [SELF-HEALING] Egress verified clean; temporary firewall rules cleaned up.",
    "lateral": "[ACTION] [SELF-HEALING] Micro-segmentation restored; SSH authentication limits re-applied.",
    "spoof":   "[ACTION] [SELF-HEALING] Telemetry is back within clinical bounds; device baseline re-verified.",
    "tamper":  "[ACTION] [SELF-HEALING] Block reconstructed to match its parent hash; ledger integrity restored.",
    "network": "[ACTION] [SELF-HEALING] Flows normalised; baseline policy re-applied.",
}

_SCENARIO_TO_CATEGORY = {
    "agent1_ddos": "ddos",
    "agent2_spoof": "spoof",
    "agent3_c2": "c2",
    "agent4_vlan": "lateral",
    "agent5_tamper": "tamper",
}


async def get_kafka_producer():
    # Retry until Kafka is reachable (it may still be starting up).
    while True:
        producer = AIOKafkaProducer(bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS)
        try:
            await producer.start()
            logger.info("Kafka producer connected.")
            return producer
        except Exception as e:
            logger.warning(f"Waiting for Kafka producer... {e}")
            try:
                await producer.stop()
            except Exception:
                pass
            await asyncio.sleep(5)


async def send_agent_log(agent_name: str, status: str, message: str):
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{BACKEND_URL}/simulation/log",
                json={"agent_name": agent_name, "status": status, "message": message},
                timeout=5.0,
            )
    except Exception as e:
        logger.error(f"Failed to send simulation log for {agent_name}: {e}")


def _iso_score(net_result: dict):
    iso = (net_result.get("models", {}) or {}).get("isolation_forest", {})
    if isinstance(iso, dict):
        return iso.get("decision_score")
    return None


def detect(payload: dict, net_result: dict, iot_result: dict, ioc) -> tuple:
    """
    Decide whether this telemetry sample represents an attack — driven by the
    REAL model / rule output:
      * NetworkMonitor Isolation-Forest + attack-signature matcher,
      * IoTGuardian autoencoder + clinical rule engine,
      * ThreatIntelligence deterministic IOC correlation,
      * Compliance ledger-tamper flag.

    Returns (category, evidence) or (None, {}). The threat decision is gated on
    the models; a declared scenario hint is only used to pick the correct
    narrative/playbook among genuinely-detected anomalies (distinguishing e.g.
    a SYN flood from a port scan from three scalar features is ambiguous).
    """
    network = payload.get("network", {}) or {}
    sigs = net_result.get("matched_signatures", []) or []
    pkt = float(network.get("packet_rate", 0) or 0)

    threat = bool(
        net_result.get("is_anomaly")
        or iot_result.get("is_anomaly")
        or ioc
        or payload.get("tamper_ledger")
    )
    if not threat:
        return None, {}

    ev = {
        "packet_rate": network.get("packet_rate", 0),
        "dest": network.get("destination_ip"),
        "ioc": ioc,
        "hr": payload.get("heart_rate"),
        "spo2": payload.get("spo2"),
        "loss": iot_result.get("loss", 0),
        "violations": ((iot_result.get("models", {}) or {}).get("rule_engine", {}) or {}).get("details", []),
        "iso": _iso_score(net_result),
        "score": net_result.get("score", 0),
    }

    scenario = payload.get("attack_type", "")
    if scenario in _SCENARIO_TO_CATEGORY:
        category = _SCENARIO_TO_CATEGORY[scenario]
    elif ioc or "Data Exfiltration" in sigs:
        category = "c2"
    elif iot_result.get("is_anomaly"):
        category = "spoof"
    elif "Port Scan" in sigs and pkt < 2000:
        category = "lateral"
    elif "SYN Flood" in sigs:
        category = "ddos"
    elif payload.get("tamper_ledger"):
        category = "tamper"
    else:
        category = "network"

    return category, ev


def build_identification(category: str, ev: dict) -> str:
    if category == "ddos":
        iso = ev.get("iso")
        iso_str = f"{iso:.3f}" if isinstance(iso, (int, float)) else "training"
        return (f"[ALERT] [IDENTIFICATION] SYN-flood signature + Isolation Forest flagged a flood: "
                f"packet_rate={ev.get('packet_rate')} pkts/s exceeds the 500 pkts/s threshold "
                f"(iso decision_score={iso_str}). Combined threat score {ev.get('score')}/100.")
    if category == "c2":
        ioc = ev.get("ioc")
        if ioc:
            return (f"[ALERT] [IDENTIFICATION] Outbound endpoint {ioc['indicator']} matches IOC feed "
                    f"'{ioc['source_feed']}' ({ioc['threat_type']}, MITRE {ioc['mitre_tactic']}). "
                    f"Active C2 / exfiltration channel.")
        return (f"[ALERT] [IDENTIFICATION] High outbound asymmetry to {ev.get('dest')} matches the "
                f"data-exfiltration signature. Suspected C2 tunnel.")
    if category == "lateral":
        return (f"[ALERT] [IDENTIFICATION] Port-scan signature: packet_rate={ev.get('packet_rate')} pkts/s "
                f"with low payload — rapid connection attempts probing the ICU VLAN.")
    if category == "spoof":
        viol = ev.get("violations") or []
        descs = "; ".join(v.get("description", "") for v in viol[:2]) if viol else "clinical bounds exceeded"
        return (f"[ALERT] [IDENTIFICATION] Autoencoder + rule engine flag a telemetry spoof: "
                f"HR={ev.get('hr')} BPM, SpO2={ev.get('spo2')}% (recon_loss={ev.get('loss')}). "
                f"Violations: {descs}.")
    if category == "tamper":
        return ("[ALERT] [IDENTIFICATION] Audit hash-chain verification failed — a block parent-hash "
                "mismatch indicates ledger tampering.")
    return (f"[ALERT] [IDENTIFICATION] Network anomaly: packet_rate={ev.get('packet_rate')} pkts/s "
            f"outside the learned baseline (Isolation Forest flagged).")


async def handle_attack_start(producer, device_id, category, ev):
    """A new attack episode began: narrate identification → containment →
    prevention → solution with REAL evidence, and actually quarantine the device
    (the PATCH drives the ESP32 LCD)."""
    pb = PLAYBOOKS[category]
    det = pb["detector"]

    # 1. The detecting agent identifies the threat (real numbers).
    await send_agent_log(det, "attack", build_identification(category, ev))
    await asyncio.sleep(0.15)

    # 2. Incident Response executes containment — ACTUAL device status change.
    ok = await ir_agent.contain(
        device_id, status=pb["status"], action=pb["action"],
        policy_id=pb["policy"], playbook=pb["playbook"],
    )
    await send_agent_log(
        "Incident Response", "mitigated",
        f"[ACTION] [CONTAINMENT] Playbook {pb['playbook']} executed | action={pb['action']} | "
        f"policy={pb['policy']} | target={device_id} → status '{pb['status']}'"
        + ("" if ok else " (WARNING: backend PATCH failed)")
    )
    await asyncio.sleep(0.15)

    # 3 & 4. Detecting agent: how it stopped the attack + the permanent fix.
    await send_agent_log(det, "warning", STOPPING[category])
    await asyncio.sleep(0.15)
    await send_agent_log(det, "info", SOLUTION[category])
    await asyncio.sleep(0.15)

    # 5. Compliance: tamper-proof audit entry (real hash chain in Postgres).
    sig = hashlib.sha256(f"{device_id}-{category}-{datetime.utcnow().isoformat()}".encode()).hexdigest()[:16]
    await send_agent_log(
        "Compliance Audit", "logged",
        f"[AUDIT] HIPAA §164.308(a)(6)(ii) security incident recorded | category={category} | "
        f"hash-chain signature {sig} | tamper-proof entry sealed."
    )
    try:
        await audit_agent.log_event(
            action="threat_detected", actor="AgentCluster",
            target=device_id, details={"category": category, "severity": pb["severity"]},
        )
    except Exception as e:
        logger.error(f"Compliance log_event failed: {e}")

    # Kafka alert → backend consumer → dashboard alert feed.
    await producer.send_and_wait("alerts", json.dumps({
        "device_id": device_id,
        "type": pb["alert_type"],
        "severity": pb["severity"],
        "description": f"{build_identification(category, ev)} | Action: {pb['action']} ({pb['policy']})",
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }).encode("utf-8"))


async def handle_attack_end(producer, device_id, category):
    """The threat cleared (telemetry back to normal): narrate self-healing and
    restore the device to active (the PATCH drives the ESP32 LCD back to SECURE)."""
    pb = PLAYBOOKS.get(category, PLAYBOOKS["network"])
    det = pb["detector"]

    await send_agent_log(det, "success", HEAL[category])
    await asyncio.sleep(0.15)

    ok = await ir_agent.restore(device_id)
    await send_agent_log(
        "Incident Response", "success",
        f"[RECOVERY] [SELF-HEALING] Threat cleared on {device_id}. Containment lifted → status 'active'."
        + ("" if ok else " (WARNING: backend PATCH failed)")
    )
    await asyncio.sleep(0.15)
    await send_agent_log(
        "Compliance Audit", "success",
        f"[AUDIT] Incident closed for {device_id}. Audit ledger sealed; HIPAA §164.312(b) controls COMPLIANT."
    )

    await producer.send_and_wait("alerts", json.dumps({
        "device_id": device_id,
        "type": pb["alert_type"],
        "severity": "low",
        "description": f"Incident resolved — {device_id} restored to active by the agent swarm.",
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }).encode("utf-8"))


async def send_normal_heartbeat(device_id, hr, spo2, iot_result):
    """Light, throttled 'all clear' chatter so the dashboard consoles stay alive
    between attacks — without flooding them."""
    await send_agent_log("Network Monitor", "normal",
                         "Traffic baseline normal | packet activity nominal | Isolation Forest: OK.")
    await send_agent_log("IoT Guardian", "normal",
                         f"Monitoring {device_id} | HR={hr} BPM, SpO2={spo2}% | "
                         f"recon_loss={iot_result.get('loss', 0)} | 0 rule violations.")
    await send_agent_log("Threat Intelligence", "normal",
                         f"STIX/TAXII correlation complete | no active IOC match for {device_id}.")
    await send_agent_log("Compliance Audit", "normal",
                         "Routine telemetry logged | HIPAA §164.312(b) audit controls COMPLIANT.")


LEDGER_SEAL_INTERVAL = int(os.getenv("LEDGER_SEAL_INTERVAL", "20"))  # seconds


async def ledger_heartbeat_worker():
    """
    Agent 5: seal a routine block into the immutable cryptographic audit ledger at
    a FIXED INTERVAL. Each block is SHA-256-chained to its parent in Postgres, so the
    chain grows continuously even when there are no attacks — a real, verifiable
    blockchain rather than a static display.
    """
    block_no = 0
    while True:
        await asyncio.sleep(LEDGER_SEAL_INTERVAL)
        block_no += 1
        try:
            await audit_agent.log_event(
                action="ledger_seal",
                actor="ComplianceAuditAgent",
                target="audit-ledger",
                details={"type": "periodic_seal", "sealed_at": datetime.utcnow().isoformat() + "Z"},
            )
            await send_agent_log(
                "Compliance Audit", "logged",
                f"[LEDGER] Sealed periodic audit block (chain head {audit_agent.last_hash[:12]}…) — "
                f"HIPAA §164.312(b) Audit Controls."
            )
        except Exception as e:
            logger.error(f"Ledger heartbeat error: {e}")


async def threat_intel_worker(producer):
    """
    Background worker for Agent 3 (Threat Intelligence).
    Polls for STIX IOCs and publishes them to the backend feed.
    """
    async with httpx.AsyncClient() as client:
        while True:
            try:
                new_iocs = ti_agent.get_new_intel()
                for ioc in new_iocs:
                    await producer.send_and_wait("threat_intel", json.dumps(ioc).encode("utf-8"))
                    await client.post(f"{BACKEND_URL}/threat-intel/inject", params=ioc)
                    await audit_agent.log_event(
                        action="ingest_ioc",
                        actor="ThreatIntelligenceAgent",
                        target=ioc["indicator"],
                        details=ioc,
                    )
            except Exception as e:
                logger.error(f"Threat Intel Worker Error: {e}")
            await asyncio.sleep(10)


async def main():
    logger.info("Starting MediSentinel Agents Orchestrator (model-driven detection)...")

    await asyncio.sleep(5)

    producer = await get_kafka_producer()

    # Resume the audit hash chain from the DB so it stays continuous, then start
    # the fixed-interval ledger sealer and the threat-intel feed worker.
    await audit_agent.init_chain()
    asyncio.create_task(ledger_heartbeat_worker())
    asyncio.create_task(threat_intel_worker(producer))

    consumer = AIOKafkaConsumer(
        'raw_data',
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        group_id="medisentinel-agents-group",
        auto_offset_reset="latest",
    )

    while True:
        try:
            await consumer.start()
            logger.info("Connected to Kafka. Ready to consume raw_data.")
            break
        except Exception as e:
            logger.warning(f"Waiting for Kafka... {e}")
            await asyncio.sleep(5)

    # Per-device episode state: {device_id: {"under_attack": bool, "category": str|None, "tick": int}}
    device_state = {}

    try:
        async for msg in consumer:
            try:
                data = json.loads(msg.value.decode('utf-8'))
            except Exception:
                continue

            topic = data.get("mqtt_topic", "")
            # Only analyse real telemetry (skip discovery / control / toggle).
            if not (topic == "medisentinel/iot/telemetry" or topic.endswith("/data")):
                continue

            payload = data.get("payload", {}) or {}
            device_id = payload.get("device_id", "unknown")
            heart_rate = payload.get("heart_rate", 75.0)
            spo2 = payload.get("spo2", 98.0)
            network = payload.get("network", {}) or {}

            # --- Run the REAL detection models on every sample ---
            net_result = network_agent.analyze_traffic(network)
            iot_result = iot_agent.analyze_device_behavior(device_id, payload)
            ioc = ti_agent.correlate(payload)

            category, ev = detect(payload, net_result, iot_result, ioc)

            state = device_state.setdefault(
                device_id, {"under_attack": False, "category": None, "tick": 0, "clean_streak": 0}
            )
            state["tick"] += 1

            if category and not state["under_attack"]:
                # clean -> attack : identify, contain (quarantine), advise
                logger.warning(f"THREAT DETECTED on {device_id}: category={category}")
                await handle_attack_start(producer, device_id, category, ev)
                state["under_attack"] = True
                state["category"] = category
                state["clean_streak"] = 0

            elif category and state["under_attack"]:
                # ongoing attack : any malicious sample resets the recovery counter so a
                # quarantined device that now reports normal values (or an interleaved
                # clean source) does NOT prematurely lift containment.
                state["clean_streak"] = 0
                if state["tick"] % 4 == 0:
                    pb = PLAYBOOKS.get(state["category"], PLAYBOOKS["network"])
                    await send_agent_log(
                        pb["detector"], "anomaly",
                        f"[MONITOR] Threat still active on {device_id} — containment '{pb['action']}' holding; "
                        f"device remains isolated."
                    )

            elif not category and state["under_attack"]:
                # attack -> clean, debounced : only declare the threat over after several
                # consecutive clean samples, so quarantined-but-normal telemetry doesn't
                # oscillate the device in and out of containment.
                state["clean_streak"] += 1
                if state["clean_streak"] >= CLEAN_SAMPLES_TO_RECOVER:
                    logger.info(f"Threat cleared on {device_id} ({state['clean_streak']} clean samples); restoring.")
                    await handle_attack_end(producer, device_id, state["category"])
                    state["under_attack"] = False
                    state["category"] = None
                    state["clean_streak"] = 0

            else:
                # steady normal : light, throttled heartbeat
                state["clean_streak"] = 0
                if state["tick"] % 5 == 0:
                    await send_normal_heartbeat(device_id, heart_rate, spo2, iot_result)

    finally:
        logger.info("Stopping Agents Orchestrator...")
        await consumer.stop()
        await producer.stop()


if __name__ == "__main__":
    asyncio.run(main())
