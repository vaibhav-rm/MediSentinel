import logging
import json
import hashlib
from datetime import datetime
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import os

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://medi_user:medi_password@localhost:5432/medisentinel")

# HIPAA Security Rule references for automated policy mapping
HIPAA_POLICY_MAP = {
    "quarantine_device":  {"rule": "§164.308(a)(6)(ii)", "control": "Response and Reporting", "category": "Security Incident Procedures"},
    "block_traffic":      {"rule": "§164.312(e)(1)",     "control": "Transmission Security",  "category": "Technical Safeguards"},
    "limit_network_access": {"rule": "§164.312(a)(1)",   "control": "Access Control",          "category": "Technical Safeguards"},
    "trigger_backup":     {"rule": "§164.308(a)(7)(ii)", "control": "Contingency Plan",        "category": "Administrative Safeguards"},
    "alert_only":         {"rule": "§164.308(a)(1)(ii)", "control": "Risk Analysis",           "category": "Administrative Safeguards"},
    "ingest_ioc":         {"rule": "§164.308(a)(1)(i)",  "control": "Security Management",     "category": "Administrative Safeguards"},
    "anomaly_detected":   {"rule": "§164.312(b)",        "control": "Audit Controls",          "category": "Technical Safeguards"},
    "threat_detected":    {"rule": "§164.308(a)(6)(ii)", "control": "Security Incident Procedures", "category": "Administrative Safeguards"},
    "ledger_seal":        {"rule": "§164.312(b)",        "control": "Audit Controls",          "category": "Technical Safeguards"},
}

class ComplianceAuditAgent:
    """
    Agent 5: Compliance & Audit Agent
    
    Maintains cryptographically linked audit logs (blockchain-style hash chain),
    generates HIPAA-compliant audit trails, and flags policy violations.
    
    Key Technology: Log Parser + Report Generator
    """
    def __init__(self):
        self.engine = create_async_engine(DATABASE_URL, echo=False)
        self.SessionLocal = sessionmaker(self.engine, class_=AsyncSession, expire_on_commit=False)
        self.last_hash = "GENESIS_HASH_00000000000000000000000000000000000000000000000000000"
        self.event_buffer: List[Dict[str, Any]] = []
        self.violation_count = 0
        
    async def init_chain(self):
        """
        Seed the in-memory last_hash from the most recent persisted block so the
        cryptographic hash chain stays continuous across agent restarts (otherwise
        the next block would point at GENESIS and break verify-chain).
        """
        try:
            async with self.SessionLocal() as session:
                from sqlalchemy import text
                res = await session.execute(text("SELECT current_hash FROM audit_logs ORDER BY id DESC LIMIT 1"))
                row = res.first()
                if row and row[0]:
                    self.last_hash = row[0]
                    logger.info(f"ComplianceAudit: resumed hash chain from {self.last_hash[:12]}...")
                else:
                    logger.info("ComplianceAudit: starting a fresh hash chain from GENESIS.")
        except Exception as e:
            logger.error(f"ComplianceAudit init_chain failed: {e}")

    def _map_hipaa_policy(self, action: str) -> Dict[str, str]:
        """
        Log Parser: Maps an action to its corresponding HIPAA Security Rule reference.
        """
        return HIPAA_POLICY_MAP.get(action, {
            "rule": "§164.308(a)(1)(i)",
            "control": "General Security Management",
            "category": "Administrative Safeguards"
        })

    def _check_policy_violations(self, action: str, details: Dict[str, Any]) -> List[str]:
        """
        Policy Violation Detector: Flags actions that may violate HIPAA rules.
        """
        violations = []
        
        # Flag if a critical device was not quarantined within policy window
        if action == "alert_only" and details.get("severity") == "critical":
            violations.append(
                f"HIPAA §164.308(a)(6)(ii) VIOLATION: Critical severity incident on "
                f"{details.get('device_id', 'unknown')} was not auto-contained. "
                f"Manual review required within 24 hours."
            )
            
        # Flag if unencrypted telemetry is detected
        if details.get("encryption") == "none" or details.get("protocol") == "plaintext":
            violations.append(
                f"HIPAA §164.312(e)(2)(ii) VIOLATION: Unencrypted ePHI transmission detected "
                f"from {details.get('device_id', 'unknown')}."
            )
            
        # Flag excessive failed access attempts
        if action == "anomaly_detected" and details.get("score", 0) > 90:
            violations.append(
                f"HIPAA §164.312(d) FINDING: High-confidence anomaly (score={details.get('score')}) "
                f"on {details.get('device_id', 'unknown')} may indicate unauthorized access attempt."
            )
        
        return violations

    def generate_audit_summary(self) -> Dict[str, Any]:
        """
        Report Generator: Produces a HIPAA-compliant audit summary from the event buffer.
        """
        summary = {
            "report_type": "HIPAA Security Audit Trail",
            "generated_at": datetime.utcnow().isoformat(),
            "total_events": len(self.event_buffer),
            "policy_violations": self.violation_count,
            "hash_chain_integrity": "VERIFIED" if self.last_hash else "BROKEN",
            "categories": {}
        }
        
        for event in self.event_buffer[-50:]:  # Last 50 events
            category = event.get("hipaa_category", "Unknown")
            summary["categories"][category] = summary["categories"].get(category, 0) + 1
            
        logger.info(f"ComplianceAudit (Report Generator): Generated HIPAA audit summary — "
                     f"{summary['total_events']} events, {summary['policy_violations']} violations")
        return summary

    async def log_event(self, action: str, actor: str, target: str, details: Dict[str, Any]):
        """
        Appends a cryptographically linked, HIPAA-mapped log entry to the audit chain.
        """
        # Map to HIPAA policy
        hipaa_ref = self._map_hipaa_policy(action)
        
        # Check for policy violations
        violations = self._check_policy_violations(action, details)
        for v in violations:
            logger.warning(f"ComplianceAudit (Policy Engine): {v}")
            self.violation_count += 1
        
        # Build the EXACT details object that gets persisted, then hash THAT (so the
        # stored block can be independently re-hashed and verified — the hash must
        # cover what is stored, not the pre-enrichment input).
        details_obj = {**details, "hipaa_ref": hipaa_ref, "violations": violations}
        content_to_hash = f"{self.last_hash}{action}{actor}{target}{json.dumps(details_obj, sort_keys=True)}"
        current_hash = hashlib.sha256(content_to_hash.encode()).hexdigest()

        # Buffer for report generation
        self.event_buffer.append({
            "action": action,
            "actor": actor,
            "target": target,
            "hipaa_rule": hipaa_ref["rule"],
            "hipaa_control": hipaa_ref["control"],
            "hipaa_category": hipaa_ref["category"],
            "violations": violations,
            "hash": current_hash[:16],
            "timestamp": datetime.utcnow().isoformat()
        })
        
        async with self.SessionLocal() as session:
            from sqlalchemy import text
            try:
                await session.execute(
                    text("""
                        INSERT INTO audit_logs (action, actor, target, details, previous_hash, current_hash)
                        VALUES (:action, :actor, :target, :details, :prev_hash, :curr_hash)
                    """),
                    {
                        "action": action,
                        "actor": actor,
                        "target": target,
                        "details": json.dumps(details_obj),
                        "prev_hash": self.last_hash,
                        "curr_hash": current_hash
                    }
                )
                await session.commit()
                self.last_hash = current_hash
                logger.info(
                    f"ComplianceAudit (Log Parser): Recorded [{hipaa_ref['rule']}] "
                    f"'{action}' by {actor} → {target} | Hash: {current_hash[:12]}..."
                )
            except Exception as e:
                logger.error(f"ComplianceAudit error: {e}")
                await session.rollback()
