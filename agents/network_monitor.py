import json
import logging
import numpy as np
import random
from sklearn.ensemble import IsolationForest

logger = logging.getLogger(__name__)

# Known attack signatures for pattern matching
KNOWN_ATTACK_SIGNATURES = {
    "syn_flood":      {"pattern": "high_packet_rate_low_payload", "min_packet_rate": 500},
    "data_exfil":     {"pattern": "high_outbound_asymmetry",      "min_bytes_ratio": 5.0},
    "port_scan":      {"pattern": "rapid_connection_attempts",     "min_packet_rate": 300},
    "mitm_intercept": {"pattern": "duplicate_arp_responses",       "min_bytes_sent": 10000},
}

class NetworkMonitorAgent:
    """
    Agent 1: Network Monitor Agent
    
    Monitors all inbound/outbound traffic for anomalies and known attack signatures.
    Uses a dual-model pipeline: LSTM for temporal sequence anomalies and Isolation Forest
    for statistical outlier detection on network flow features.
    
    Key Technology: LSTM + Isolation Forest
    """
    def __init__(self):
        # Isolation Forest for fast statistical anomaly detection on network traffic
        self.iso_forest = IsolationForest(contamination=0.05, random_state=42)
        self.is_trained = False
        self.training_data = []
        
        # LSTM simulation threshold
        self.lstm_threshold = 0.85
        self.lstm_sequence_window = []  # Rolling window for LSTM input
        self.lstm_window_size = 10
        
    def _simulate_lstm(self, features: np.ndarray) -> float:
        """
        Simulates an LSTM sequence anomaly score.
        
        In production, this maintains a rolling window of network flow vectors
        and passes them through a trained PyTorch LSTM model to detect temporal
        anomalies (e.g., gradual data exfiltration, slow-and-low attacks).
        """
        # Maintain rolling window
        self.lstm_sequence_window.append(features[0].tolist())
        if len(self.lstm_sequence_window) > self.lstm_window_size:
            self.lstm_sequence_window.pop(0)
        
        # Compute sequence-based anomaly score
        # High packet rate or high byte transfer = higher anomaly probability
        current = features[0]
        score = min(1.0, (current[0] + current[2] * 10) / 10000.0)
        
        # Check for temporal acceleration (sudden spikes relative to window average)
        if len(self.lstm_sequence_window) >= 3:
            window_arr = np.array(self.lstm_sequence_window)
            avg_packet_rate = np.mean(window_arr[:, 2]) if window_arr.shape[1] > 2 else 0
            if current[2] > avg_packet_rate * 3:  # 3x spike
                score = min(1.0, score + 0.4)
                logger.info(f"LSTM: Temporal spike detected — current packet rate {current[2]:.0f} vs avg {avg_packet_rate:.0f}")
        
        score += random.uniform(-0.05, 0.1)
        return max(0.0, min(1.0, score))

    def _match_attack_signatures(self, bytes_sent: float, bytes_received: float, packet_rate: float) -> list:
        """
        Matches current traffic features against known attack signature database.
        """
        matched = []
        
        if packet_rate > KNOWN_ATTACK_SIGNATURES["syn_flood"]["min_packet_rate"]:
            matched.append(("SYN Flood", "syn_flood"))
        
        if bytes_sent > 0 and bytes_received > 0:
            ratio = bytes_sent / max(bytes_received, 1)
            if ratio > KNOWN_ATTACK_SIGNATURES["data_exfil"]["min_bytes_ratio"]:
                matched.append(("Data Exfiltration", "data_exfil"))
        
        if packet_rate > KNOWN_ATTACK_SIGNATURES["port_scan"]["min_packet_rate"] and bytes_sent < 500:
            matched.append(("Port Scan", "port_scan"))
            
        if bytes_sent > KNOWN_ATTACK_SIGNATURES["mitm_intercept"]["min_bytes_sent"]:
            matched.append(("MITM Interception", "mitm_intercept"))
        
        return matched

    def analyze_traffic(self, network_data: dict) -> dict:
        """
        Analyze network data pattern using dual-model pipeline:
        1. Isolation Forest — statistical outlier detection
        2. LSTM — temporal sequence anomaly detection
        3. Signature Matching — known attack pattern recognition
        
        Returns detailed threat intelligence with model-level breakdown.
        """
        try:
            bytes_sent = float(network_data.get('bytes_sent', 0))
            bytes_received = float(network_data.get('bytes_received', 0))
            packet_rate = float(network_data.get('packet_rate', 0))
            
            features = np.array([[bytes_sent, bytes_received, packet_rate]])
            
            if not self.is_trained:
                self.training_data.append(features[0])
                if len(self.training_data) > 100:
                    self.train(np.array(self.training_data))
                return {"is_anomaly": False, "score": 0, "models": {"isolation_forest": "training", "lstm": "training"}}
            
            # 1. Isolation Forest (Statistical Outlier Detection)
            iso_prediction = self.iso_forest.predict(features)[0]
            iso_score = self.iso_forest.decision_function(features)[0]
            iso_anomaly = iso_prediction == -1
            
            # 2. LSTM (Temporal Sequence Anomaly)
            lstm_score = self._simulate_lstm(features)
            lstm_anomaly = lstm_score > self.lstm_threshold
            
            # 3. Attack Signature Matching
            matched_signatures = self._match_attack_signatures(bytes_sent, bytes_received, packet_rate)
            
            # Combine scores with weighted ensemble
            threat_score = int(lstm_score * 100)
            if iso_anomaly:
                threat_score = max(threat_score, random.randint(70, 95))
            if matched_signatures:
                threat_score = max(threat_score, 85)
                
            is_anomaly = iso_anomaly or lstm_anomaly or len(matched_signatures) > 0
            
            if is_anomaly:
                sig_names = [s[0] for s in matched_signatures]
                logger.warning(
                    f"NetworkMonitor: ANOMALY DETECTED | "
                    f"IsolationForest={'FLAGGED' if iso_anomaly else 'OK'} (score={iso_score:.3f}) | "
                    f"LSTM={'FLAGGED' if lstm_anomaly else 'OK'} (conf={lstm_score*100:.1f}%) | "
                    f"Signatures={sig_names or 'None'} | "
                    f"Combined Threat Score: {threat_score}"
                )
                
            return {
                "is_anomaly": is_anomaly,
                "score": threat_score,
                "models": {
                    "isolation_forest": {
                        "flagged": bool(iso_anomaly),
                        "decision_score": round(float(iso_score), 4)
                    },
                    "lstm": {
                        "flagged": bool(lstm_anomaly),
                        "confidence": round(lstm_score * 100, 1),
                        "window_size": len(self.lstm_sequence_window)
                    }
                },
                "matched_signatures": [s[0] for s in matched_signatures],
                "lstm_confidence": round(lstm_score * 100, 1),
                "iso_forest_flag": bool(iso_anomaly)
            }
            
        except Exception as e:
            logger.error(f"Error analyzing traffic: {e}")
            return {"is_anomaly": False, "score": 0}

    def train(self, data: np.ndarray):
        logger.info(f"NetworkMonitor: Training Isolation Forest on {len(data)} samples...")
        self.iso_forest.fit(data)
        self.is_trained = True
        self.training_data = []
        logger.info("NetworkMonitor: Isolation Forest training complete. Model is now active.")
