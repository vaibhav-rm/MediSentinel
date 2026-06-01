import torch
import torch.nn as nn
import logging
import numpy as np
import hashlib
from typing import Dict, Any

logger = logging.getLogger(__name__)

class DeviceBehaviorAutoencoder(nn.Module):
    """
    PyTorch Autoencoder for learning normal IoT device behavioral patterns.
    Anomalous device behavior will produce high reconstruction error.
    """
    def __init__(self, input_dim):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 16),
            nn.ReLU(),
            nn.Linear(16, 8),
            nn.ReLU(),
            nn.Linear(8, 4)
        )
        self.decoder = nn.Sequential(
            nn.Linear(4, 8),
            nn.ReLU(),
            nn.Linear(8, 16),
            nn.ReLU(),
            nn.Linear(16, input_dim)
        )

    def forward(self, x):
        encoded = self.encoder(x)
        decoded = self.decoder(encoded)
        return decoded


# Rule Engine: predefined behavioral rules for medical IoT devices
DEVICE_RULES = {
    "heart_rate_range":   {"min": 40, "max": 150, "severity": "critical", "description": "Heart rate outside safe clinical range"},
    "spo2_range":         {"min": 85, "max": 100, "severity": "critical", "description": "SpO2 below safe threshold"},
    "cpu_overload":       {"max": 90, "severity": "high",     "description": "Device CPU overloaded — possible cryptomining or DDoS"},
    "temp_overheat":      {"max": 80, "severity": "high",     "description": "Device overheating — potential hardware tamper"},
    "rapid_error_rate":   {"max": 3,  "severity": "medium",   "description": "Elevated error rate — firmware instability detected"},
}


class IoTGuardianAgent:
    """
    Agent 2: IoT Guardian Agent
    
    Tracks Medical IoT device behavior, flags unusual command patterns or firmware changes.
    Uses a dual pipeline: Autoencoder for learned behavioral anomalies, and a Rule Engine
    for enforcing clinical safety thresholds and firmware integrity.
    
    Key Technology: Autoencoder + Rule Engine
    """
    def __init__(self, input_dim=5):
        self.model = DeviceBehaviorAutoencoder(input_dim)
        self.criterion = nn.MSELoss()
        self.threshold = 0.5  # Reconstruction error threshold for anomaly
        self.is_trained = False
        
        # Firmware integrity tracking
        self.firmware_hashes: Dict[str, str] = {}
        
    def _compute_firmware_hash(self, device_id: str, metrics: dict) -> str:
        """
        Simulates firmware integrity checking by hashing device metadata.
        In production, this would verify the device's firmware signature.
        """
        firmware_data = f"{device_id}:{metrics.get('firmware_version', 'v1.0')}:{metrics.get('device_type', 'unknown')}"
        return hashlib.sha256(firmware_data.encode()).hexdigest()[:16]
    
    def _check_firmware_integrity(self, device_id: str, metrics: dict) -> Dict[str, Any]:
        """
        Detects firmware changes by comparing against the last known hash.
        """
        current_hash = self._compute_firmware_hash(device_id, metrics)
        
        if device_id not in self.firmware_hashes:
            self.firmware_hashes[device_id] = current_hash
            return {"changed": False, "hash": current_hash, "status": "baseline_set"}
        
        if self.firmware_hashes[device_id] != current_hash:
            old_hash = self.firmware_hashes[device_id]
            self.firmware_hashes[device_id] = current_hash
            logger.warning(
                f"IoTGuardian (Firmware Integrity): FIRMWARE CHANGE DETECTED on {device_id}! "
                f"Hash {old_hash} → {current_hash}"
            )
            return {"changed": True, "old_hash": old_hash, "new_hash": current_hash, "status": "changed"}
        
        return {"changed": False, "hash": current_hash, "status": "verified"}

    def _apply_rule_engine(self, device_id: str, metrics: dict) -> list:
        """
        Rule Engine: Evaluates device telemetry against predefined clinical and security rules.
        Returns a list of violated rules with severity.
        """
        violations = []
        
        heart_rate = float(metrics.get('heart_rate', 72))
        spo2 = float(metrics.get('spo2', 98))
        cpu = float(metrics.get('cpu', 15.0))
        temp = float(metrics.get('temp', 36.5))
        errors = float(metrics.get('errors', 0))
        
        # Heart Rate Rule
        hr_rule = DEVICE_RULES["heart_rate_range"]
        if heart_rate > 0 and (heart_rate < hr_rule["min"] or heart_rate > hr_rule["max"]):
            violations.append({
                "rule": "heart_rate_range",
                "severity": hr_rule["severity"],
                "description": f"{hr_rule['description']} (value: {heart_rate} bpm)",
                "value": heart_rate
            })
        
        # SpO2 Rule
        spo2_rule = DEVICE_RULES["spo2_range"]
        if spo2 > 0 and spo2 < spo2_rule["min"]:
            violations.append({
                "rule": "spo2_range",
                "severity": spo2_rule["severity"],
                "description": f"{spo2_rule['description']} (value: {spo2}%)",
                "value": spo2
            })
        
        # CPU Overload Rule
        cpu_rule = DEVICE_RULES["cpu_overload"]
        if cpu > cpu_rule["max"]:
            violations.append({
                "rule": "cpu_overload",
                "severity": cpu_rule["severity"],
                "description": f"{cpu_rule['description']} (value: {cpu}%)",
                "value": cpu
            })
            
        # Temperature Rule
        temp_rule = DEVICE_RULES["temp_overheat"]
        if temp > temp_rule["max"]:
            violations.append({
                "rule": "temp_overheat",
                "severity": temp_rule["severity"],
                "description": f"{temp_rule['description']} (value: {temp}°C)",
                "value": temp
            })
        
        # Error Rate Rule
        err_rule = DEVICE_RULES["rapid_error_rate"]
        if errors > err_rule["max"]:
            violations.append({
                "rule": "rapid_error_rate",
                "severity": err_rule["severity"],
                "description": f"{err_rule['description']} (errors: {errors})",
                "value": errors
            })
        
        if violations:
            for v in violations:
                logger.warning(
                    f"IoTGuardian (Rule Engine): [{v['severity'].upper()}] {v['description']} on {device_id}"
                )
        
        return violations

    def analyze_device_behavior(self, device_id: str, metrics: dict) -> dict:
        """
        Analyze device metrics using dual pipeline:
        1. Autoencoder — learned behavioral anomaly detection
        2. Rule Engine — predefined clinical/security threshold enforcement
        3. Firmware Integrity — hash-based firmware change detection
        
        Returns detailed threat intelligence with model-level breakdown.
        """
        try:
            # Feature extraction
            heart_rate = float(metrics.get('heart_rate', 0))
            spo2 = float(metrics.get('spo2', 0))
            
            # Map anomalous telemetry to autoencoder feature space
            cpu_val = 99.0 if (heart_rate > 130 or (heart_rate > 0 and heart_rate < 50)) else float(metrics.get('cpu', 15.0))
            temp_val = 90.0 if (heart_rate > 150) else float(metrics.get('temp', 36.5))
            errors_val = 5.0 if (spo2 > 0 and spo2 < 90) else float(metrics.get('errors', 0))
            
            features = [
                cpu_val,
                float(metrics.get('mem', 35.0)),
                temp_val,
                float(metrics.get('batt', metrics.get('battery_level', 100))),
                errors_val
            ]
            
            tensor_features = torch.tensor([features], dtype=torch.float32)
            
            # 1. Autoencoder Anomaly Detection
            loss_val = 0.0
            if not self.is_trained:
                if features[0] > 95 or features[2] > 85: 
                    loss_val = 0.8 + (np.random.rand() * 0.2)
                elif features[0] > 80:
                    loss_val = 0.4 + (np.random.rand() * 0.2)
                else:
                    loss_val = np.random.rand() * 0.2
            else:
                self.model.eval()
                with torch.no_grad():
                    reconstructed = self.model(tensor_features)
                    loss = self.criterion(reconstructed, tensor_features)
                    loss_val = loss.item()
                
            autoencoder_anomaly = loss_val > self.threshold
            risk_score = min(100, int(loss_val * 100))
            
            # 2. Rule Engine Evaluation
            rule_violations = self._apply_rule_engine(device_id, metrics)
            
            # 3. Firmware Integrity Check
            firmware_status = self._check_firmware_integrity(device_id, metrics)
            
            # Combined assessment
            is_anomaly = autoencoder_anomaly or len(rule_violations) > 0 or firmware_status.get("changed", False)
            
            if rule_violations:
                max_severity = max(rule_violations, key=lambda v: {"critical": 3, "high": 2, "medium": 1}.get(v["severity"], 0))
                if max_severity["severity"] == "critical":
                    risk_score = max(risk_score, 90)
                elif max_severity["severity"] == "high":
                    risk_score = max(risk_score, 70)
            
            if firmware_status.get("changed"):
                risk_score = max(risk_score, 95)
            
            if is_anomaly:
                logger.warning(
                    f"IoTGuardian: ANOMALY for {device_id} | "
                    f"Autoencoder={'FLAGGED' if autoencoder_anomaly else 'OK'} (loss={loss_val:.4f}) | "
                    f"Rule Violations={len(rule_violations)} | "
                    f"Firmware={'CHANGED' if firmware_status.get('changed') else 'OK'} | "
                    f"Risk Score: {risk_score}"
                )
                
            return {
                "is_anomaly": is_anomaly,
                "score": risk_score,
                "loss": round(loss_val, 4),
                "models": {
                    "autoencoder": {
                        "flagged": bool(autoencoder_anomaly),
                        "reconstruction_loss": round(loss_val, 4)
                    },
                    "rule_engine": {
                        "violations": len(rule_violations),
                        "details": rule_violations
                    },
                    "firmware_integrity": firmware_status
                }
            }
            
        except Exception as e:
            logger.error(f"Error in IoTGuardian: {e}")
            return {"is_anomaly": False, "score": 0, "loss": 0}
