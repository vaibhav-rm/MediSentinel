import logging
import random
import time
import hashlib
from datetime import datetime
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

# Simulated external STIX/TAXII threat feeds
STIX_FEED_SOURCES = [
    {"name": "AlienVault OTX",  "protocol": "TAXII 2.1", "collection": "healthcare-threats"},
    {"name": "IBM X-Force",     "protocol": "STIX 2.1",  "collection": "medical-iot-indicators"},
    {"name": "VirusTotal",      "protocol": "REST API",   "collection": "malware-hashes"},
    {"name": "ThreatConnect",   "protocol": "TAXII 2.0", "collection": "c2-infrastructure"},
    {"name": "MITRE ATT&CK",   "protocol": "STIX 2.1",  "collection": "ics-techniques"},
    {"name": "CISA ICS-CERT",  "protocol": "TAXII 2.1", "collection": "medical-device-advisories"},
]

# IOC database — simulated indicators of compromise
IOC_DATABASE = [
    {"indicator": "192.168.1.105",    "type": "ipv4-addr",    "source_feed": "AlienVault OTX",  "threat_type": "C2 Server",         "mitre_tactic": "TA0011"},
    {"indicator": "10.0.0.99",        "type": "ipv4-addr",    "source_feed": "IBM X-Force",     "threat_type": "Lateral Movement",  "mitre_tactic": "TA0008"},
    {"indicator": "e3b0c44298fc1c14", "type": "file-hash",    "source_feed": "VirusTotal",      "threat_type": "Ransomware",        "mitre_tactic": "TA0040"},
    {"indicator": "malicious-c2.net", "type": "domain-name",  "source_feed": "ThreatConnect",   "threat_type": "C2 Beacon",         "mitre_tactic": "TA0011"},
    {"indicator": "45.33.32.156",     "type": "ipv4-addr",    "source_feed": "CISA ICS-CERT",   "threat_type": "Scanner",           "mitre_tactic": "TA0043"},
    {"indicator": "apt-medjack.com",  "type": "domain-name",  "source_feed": "MITRE ATT&CK",    "threat_type": "MedJack Campaign",  "mitre_tactic": "TA0001"},
    {"indicator": "a1b2c3d4e5f67890", "type": "file-hash",    "source_feed": "VirusTotal",      "threat_type": "Firmware Backdoor", "mitre_tactic": "TA0003"},
    {"indicator": "172.16.0.200",     "type": "ipv4-addr",    "source_feed": "IBM X-Force",     "threat_type": "Data Exfiltration", "mitre_tactic": "TA0010"},
]


class ThreatIntelligenceAgent:
    """
    Agent 3: Threat Intelligence Agent
    
    Continuously ingests external threat feeds and updates local threat signatures.
    Uses NLP-based extraction to parse STIX/TAXII formatted IOC bundles and correlate
    them with active network telemetry.
    
    Key Technology: NLP + STIX/TAXII Feeds
    """
    def __init__(self):
        self.ioc_database = IOC_DATABASE.copy()
        self.last_ingest_time = 0
        self.ingested_count = 0
        self.active_iocs: List[Dict[str, Any]] = []
        
    def _nlp_extract_ioc(self, raw_feed_entry: dict) -> Dict[str, Any]:
        """
        NLP Engine: Simulates natural language processing extraction of IOCs
        from unstructured STIX bundle descriptions.
        
        In production, this would use spaCy/transformers to parse threat reports
        and extract entities (IPs, domains, hashes, TTPs).
        """
        # Simulate NLP confidence scoring
        nlp_confidence = random.uniform(0.75, 0.99)
        
        # Generate a STIX-compliant IOC object
        stix_ioc = {
            "indicator": raw_feed_entry["indicator"],
            "type": raw_feed_entry["type"],
            "source_feed": raw_feed_entry["source_feed"],
            "threat_type": raw_feed_entry["threat_type"],
            "mitre_tactic": raw_feed_entry["mitre_tactic"],
            "confidence": int(nlp_confidence * 100),
            "stix_id": f"indicator--{hashlib.md5(raw_feed_entry['indicator'].encode()).hexdigest()}",
            "first_seen": datetime.utcnow().isoformat(),
            "nlp_extraction_confidence": round(nlp_confidence, 3),
        }
        
        return stix_ioc
    
    def _correlate_with_active_traffic(self, ioc: Dict[str, Any]) -> bool:
        """
        Checks if a newly ingested IOC correlates with any currently active telemetry.
        """
        # In production, this would query the Kafka raw_data topic
        # For simulation, randomly flag ~20% of IOCs as correlated
        return random.random() < 0.2
        
    def get_new_intel(self) -> List[Dict[str, Any]]:
        """
        Simulate polling external STIX/TAXII feeds and using NLP to extract new IOCs.
        Processes feeds from multiple sources and returns enriched indicators.
        """
        current_time = time.time()
        
        # Simulate new intel every ~60 seconds
        if current_time - self.last_ingest_time > 60:
            self.last_ingest_time = current_time
            
            # Select a random feed source
            feed = random.choice(STIX_FEED_SOURCES)
            logger.info(
                f"ThreatIntelligence: Polling {feed['name']} via {feed['protocol']} "
                f"(collection: {feed['collection']})"
            )
            
            # Extract 1-3 IOCs
            num_to_pick = random.randint(1, 3)
            raw_iocs = random.sample(self.ioc_database, min(num_to_pick, len(self.ioc_database)))
            
            processed_iocs = []
            for raw_ioc in raw_iocs:
                # NLP extraction
                enriched_ioc = self._nlp_extract_ioc(raw_ioc)
                
                # Check correlation
                is_correlated = self._correlate_with_active_traffic(enriched_ioc)
                enriched_ioc["correlated_with_active_traffic"] = is_correlated
                
                self.active_iocs.append(enriched_ioc)
                self.ingested_count += 1
                
                if is_correlated:
                    logger.warning(
                        f"ThreatIntelligence (NLP Engine): CORRELATION FOUND — "
                        f"STIX IOC {enriched_ioc['indicator']} ({enriched_ioc['threat_type']}) "
                        f"matches active network traffic! MITRE: {enriched_ioc['mitre_tactic']}"
                    )
                else:
                    logger.info(
                        f"ThreatIntelligence (NLP Engine): Extracted STIX/TAXII IOC "
                        f"{enriched_ioc['indicator']} ({enriched_ioc['threat_type']}) "
                        f"from {enriched_ioc['source_feed']} | "
                        f"NLP Confidence: {enriched_ioc['nlp_extraction_confidence']:.1%} | "
                        f"STIX ID: {enriched_ioc['stix_id'][:20]}..."
                    )
                
                processed_iocs.append(enriched_ioc)
            
            logger.info(
                f"ThreatIntelligence: Feed poll complete — {len(processed_iocs)} IOCs ingested "
                f"(total: {self.ingested_count})"
            )
            return processed_iocs
        
        return []
    
    def get_stats(self) -> Dict[str, Any]:
        """Returns agent statistics for dashboard display."""
        return {
            "total_iocs_ingested": self.ingested_count,
            "active_iocs": len(self.active_iocs),
            "correlated_threats": sum(1 for i in self.active_iocs if i.get("correlated_with_active_traffic")),
            "feed_sources": len(STIX_FEED_SOURCES)
        }
