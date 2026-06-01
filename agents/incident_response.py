import logging
import httpx
from datetime import datetime
import os

logger = logging.getLogger(__name__)

class IncidentResponseAgent:
    """
    Agent 4: Incident Response Agent
    
    Executes autonomous containment actions: quarantine, block, alert, and backup triggers.
    Uses a Decision Tree + Policy Engine to select the optimal response playbook.
    
    Key Technology: Decision Tree + Policy Engine
    """
    def __init__(self):
        self.backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
        self.secret_key = os.getenv("SECRET_KEY", "medisentinel_super_secret_key_change_in_prod")
        self.containment_history = []
        
    def _decision_tree(self, alert_type: str, severity: str) -> dict:
        """
        Decision Tree + Policy Engine for containment action selection.
        Returns both the action and the policy justification.
        """
        if severity == "critical":
            if "Network" in alert_type:
                return {
                    "action": "block_traffic",
                    "policy_id": "POL-NET-001",
                    "justification": "Critical network anomaly — immediate traffic isolation required",
                    "playbook": "PB-NETWORK-BLOCK-v2"
                }
            return {
                "action": "quarantine_device",
                "policy_id": "POL-IOT-002",
                "justification": "Critical device compromise — full quarantine with data preservation",
                "playbook": "PB-DEVICE-QUARANTINE-v3"
            }
        elif severity == "high":
            if "IoT" in alert_type or "Behavior" in alert_type:
                return {
                    "action": "limit_network_access",
                    "policy_id": "POL-IOT-003",
                    "justification": "High-severity IoT behavioral deviation — restricting network scope",
                    "playbook": "PB-IOT-RESTRICT-v1"
                }
            return {
                "action": "trigger_backup",
                "policy_id": "POL-DR-001",
                "justification": "High-severity event — triggering emergency backup snapshot",
                "playbook": "PB-BACKUP-SNAPSHOT-v2"
            }
        elif severity == "medium":
            return {
                "action": "alert_only",
                "policy_id": "POL-MON-002",
                "justification": "Medium-severity event — logging and notifying SOC analysts",
                "playbook": "PB-ALERT-NOTIFY-v1"
            }
        else:
            return {
                "action": "alert_only",
                "policy_id": "POL-MON-001",
                "justification": "Low-severity event — logging for audit trail compliance",
                "playbook": "PB-LOG-ONLY-v1"
            }

    async def trigger_response(self, device_id: str, alert_type: str, severity: str, description: str):
        """
        Triggers an autonomous incident response:
        1. Evaluates the decision tree to select a containment playbook.
        2. Creates an alert in the backend database.
        3. Executes the selected containment action (quarantine, block, backup, alert).
        """
        logger.error(f"INCIDENT RESPONSE TRIGGERED: {device_id} | {alert_type} | {severity}")
        
        # 1. Decision Tree Action Selection
        decision = self._decision_tree(alert_type, severity)
        action = decision["action"]
        policy_id = decision["policy_id"]
        playbook = decision["playbook"]
        justification = decision["justification"]
        
        logger.info(f"Policy Engine → Action: {action} | Policy: {policy_id} | Playbook: {playbook}")
        logger.info(f"Justification: {justification}")
        
        # Track containment history
        self.containment_history.append({
            "timestamp": datetime.utcnow().isoformat(),
            "device_id": device_id,
            "action": action,
            "policy_id": policy_id,
            "playbook": playbook
        })
        
        # 2. Create Alert via Backend API
        alert_payload = {
            "device_id": device_id,
            "type": alert_type,
            "severity": severity,
            "description": f"{description} | Action: {action} | Policy: {policy_id} | Playbook: {playbook}"
        }
        
        headers = {
            "Authorization": f"Bearer {self.secret_key}"
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(f"{self.backend_url}/alerts/", json=alert_payload, headers=headers)
                if response.status_code == 200 or response.status_code == 201:
                    logger.info(f"Alert registered in backend for {device_id}.")
                else:
                    logger.error(f"Failed to register alert: {response.text}")
                    
                # 3. Autonomous Containment Execution
                if action == "quarantine_device":
                    logger.warning(f"[CONTAINMENT] Quarantining device {device_id} — isolating from hospital network")
                    await client.patch(
                        f"{self.backend_url}/devices/{device_id}", 
                        json={"status": "quarantined"},
                        headers=headers
                    )
                    
                elif action == "block_traffic":
                    logger.warning(f"[CONTAINMENT] Blocking all inbound/outbound traffic for {device_id}")
                    await client.patch(
                        f"{self.backend_url}/devices/{device_id}",
                        json={"status": "blocked"},
                        headers=headers
                    )
                    
                elif action == "limit_network_access":
                    logger.warning(f"[CONTAINMENT] Restricting {device_id} to local VLAN only")
                    await client.patch(
                        f"{self.backend_url}/devices/{device_id}",
                        json={"status": "restricted"},
                        headers=headers
                    )
                    
                elif action == "trigger_backup":
                    logger.warning(f"[CONTAINMENT] Triggering emergency backup snapshot for {device_id} data")
                    # In production, this would trigger a backup service API
                    
            except Exception as e:
                logger.error(f"Incident Response Agent failed to reach backend: {e}")
    
    def get_containment_stats(self) -> dict:
        """Returns containment statistics for the dashboard."""
        return {
            "total_actions": len(self.containment_history),
            "quarantines": sum(1 for h in self.containment_history if h["action"] == "quarantine_device"),
            "blocks": sum(1 for h in self.containment_history if h["action"] == "block_traffic"),
            "backups": sum(1 for h in self.containment_history if h["action"] == "trigger_backup"),
            "history": self.containment_history[-10:]  # Last 10 actions
        }
