import { useState, useEffect } from 'react';
import type { Device, Alert } from './types';

const BACKEND_REST_URL = 'http://localhost:8000';
const BACKEND_WS_URL = 'ws://localhost:8000/ws';

export interface AgentLog {
  agent: string;
  msg: string;
  time: string;
  status: string; // 'info' | 'warning' | 'attack' | 'mitigated' | 'success'
}

export interface NetworkMetrics {
  packetRate: number;
  entropyScore: number;
  anomalyProbability: number;
  sequenceMismatch: number;
  lateralMovementConfidence: number;
  beaconIntervalDetected: string;
  trafficHistory: { time: string; packets: number; entropy: number; mismatch: number }[];
  preventionActive: boolean;
  throttleLevel: string;
}

export interface DeviceMetrics {
  reconstructionLoss: number;
  telemetryMutation: number;
  sensorDrift: number;
  heartbeatConsistency: string;
  deviceIntegrityScore: number;
  spoofProbability: number;
  heartRate: number;
  spo2: number;
  ecgWaveform: number[];
  preventionActive: boolean;
  telemetryIntercepted: boolean;
}

export interface ThreatIntelMetrics {
  mitreMapping: string;
  iocConfidence: number;
  malwareFamily: string;
  c2Communication: string;
  threatActorSimilarity: number;
  campaignClassification: string;
  attackOrigins: { name: string; lat: number; lng: number; infected: boolean; label: string }[];
  threatFeed: { indicator: string; type: string; confidence: number; source: string; time: string; threat_type: string; mitre: string }[];
  preventionActive: boolean;
  ipBlocked: string;
}

export interface IncidentMetrics {
  quarantineActions: string[];
  firewallRuleExecution: string;
  vlanIsolation: boolean;
  containmentTimeline: { time: string; action: string; status: string }[];
  attackMitigationStatus: string;
  decisionTree: { threatScore: number; iocMatch: boolean; containmentProtocol: string };
  preventionActive: boolean;
}

export interface ComplianceMetrics {
  auditBlocks: { id: number; hash: string; prevHash: string; hipaa: string; timestamp: string; status: string }[];
  tamperAttemptActive: boolean;
  lastTamperTime: string;
  tamperPrevented: boolean;
}

export interface AttackerMetrics {
  attackProgression: number;
  mutationEngine: string;
  evasionAttempts: string[];
  attackConfidence: number;
  infectionSpread: string;
  privilegeEscalation: string;
  attackType: string;
}

export interface GlobalMetrics {
  threatLevel: string; // 'SAFE' | 'SUSPICIOUS' | 'COMPROMISED' | 'QUARANTINED' | 'CONTAINED'
  attackConfidence: number;
  autonomousActionsCount: number;
  containmentSuccessRate: number;
  devicesUnderInvestigation: number;
  activeAttackCount: number;
}

// Helper to seed 45 baseline logs for a specific agent
const generateBaselineLogs = (agentName: string): AgentLog[] => {
  const logs: AgentLog[] = [];
  const now = Date.now();
  
  const templates: Record<string, string[]> = {
    'Network Monitor': [
      'Initializing LSTM network monitor pipeline on interface eth0.',
      'Isolation Forest model weights verified. Hash: 8fa2b38.',
      'Calculated sequence entropy: 0.142 (within baseline).',
      'Ingressing TCP handshake tracking active.',
      'ICMP packet rate within normal threshold bounds.',
      'No packet headers deviations observed.',
      'VLAN baseline traffic scanned. Zero sequence anomalies.',
      'LSTM temporal window slide shift complete.',
      'BPS rate normal at 4.2 MB/s.',
      'No TCP duplicate ACKs or packet dropouts detected.'
    ],
    'IoT Guardian': [
      'IoT Guardian Autoencoder active on thread group #2.',
      'Reconstruction loss baseline verified (Average: 0.034).',
      'Clinical telemetry telemetry poll: heart_rate=74, spo2=98.',
      'Device esp32-hr-sim-001 hardware baseline matching.',
      'Battery telemetry normal: 94% charge.',
      'Sensor drift tolerance calibration complete.',
      'Heartbeat consistency ratio: 1.0 (Optimal).',
      'Autoencoder training weights loaded: weights_v4.2.bin.',
      'MQTT client connected to broker at port 1883.',
      'No telemetry mutations or spoof parameters detected.'
    ],
    'Threat Intelligence': [
      'Threat Intel Agent synchronized with TAXII server feed.',
      'STIX XML parser validated. Ingesting feed updates.',
      'AlienVault OTX database sync complete. 4,120 IOCs cached.',
      'Local IP blacklist lookup table rebuilt. Index verified.',
      'DNS malware domain query parser active.',
      'Zero matches found in active connection state scanning.',
      'IP classification neural network online.',
      'Mitre ATT&CK taxonomy index initialized.',
      'Ingested STIX threat report #29124.',
      'APT campaign signature matching engine idling.'
    ],
    'Incident Response': [
      'Incident Response playbook routing system active.',
      'Firewall rule table checked: ALLOW_ALL_INTERNAL_IOT active.',
      'VLAN routing tables verified. Sandbox network standby.',
      'Playbook dry-run verification: quarantined test successful.',
      'Zero active alerts in containment queue.',
      'Autonomous blocking policy rules armed.',
      'API endpoint token verification: Valid.',
      'Subnet isolation triggers testing complete.',
      'Incident severity scoring weights calibrated.',
      'Quarantine routing table validated. Ready.'
    ],
    'Compliance Audit': [
      'Compliance Audit Agent active. Cryptographic hashing armed.',
      'HIPAA Access Control compliance §164.312(a)(1) check passed.',
      'Sealed transaction record to SHA-256 ledger.',
      'Block verification chain scanned: 0 anomalies detected.',
      'Audit log compaction complete. Ledger size: 24.2 MB.',
      'Administrative access tracking log validated.',
      'Cryptographic ledger node synced with primary broker.',
      'HIPAA Transmission Security audit §164.312(e) complete.',
      'Immutable audit trail integrity validation: 100% compliant.',
      'System compliance score calculated: 98%.'
    ]
  };

  const agentTemplates = templates[agentName] || templates['Network Monitor'];

  for (let i = 0; i < 45; i++) {
    const timeOffset = (45 - i) * 30 * 1000; // 30 seconds apart
    const logTime = new Date(now - timeOffset).toLocaleTimeString();
    const template = agentTemplates[i % agentTemplates.length];
    
    logs.push({
      agent: agentName,
      msg: `[INFO] ${template}`,
      time: logTime,
      status: 'info'
    });
  }

  return logs;
};

export const useStore = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const [attackActive, setAttackActive] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  // Selected attack target: 'agent1_ddos' | 'agent2_spoof' | 'agent3_c2' | 'agent4_vlan'
  const [attackType, setAttackType] = useState<string>('agent1_ddos');

  // Master log database for each of the 5 agents
  const [agent1Logs, setAgent1Logs] = useState<AgentLog[]>([]);
  const [agent2Logs, setAgent2Logs] = useState<AgentLog[]>([]);
  const [agent3Logs, setAgent3Logs] = useState<AgentLog[]>([]);
  const [agent4Logs, setAgent4Logs] = useState<AgentLog[]>([]);
  const [agent5Logs, setAgent5Logs] = useState<AgentLog[]>([]);

  // Initialize logs on start
  useEffect(() => {
    setAgent1Logs(generateBaselineLogs('Network Monitor'));
    setAgent2Logs(generateBaselineLogs('IoT Guardian'));
    setAgent3Logs(generateBaselineLogs('Threat Intelligence'));
    setAgent4Logs(generateBaselineLogs('Incident Response'));
    setAgent5Logs(generateBaselineLogs('Compliance Audit'));
  }, []);

  // Evolving simulation state metrics
  const [networkMetrics, setNetworkMetrics] = useState<NetworkMetrics>({
    packetRate: 15,
    entropyScore: 0.15,
    anomalyProbability: 2,
    sequenceMismatch: 0.05,
    lateralMovementConfidence: 0,
    beaconIntervalDetected: 'None',
    trafficHistory: [],
    preventionActive: false,
    throttleLevel: 'None (Unthrottled)'
  });

  const [deviceMetrics, setDeviceMetrics] = useState<DeviceMetrics>({
    reconstructionLoss: 0.034,
    telemetryMutation: 0,
    sensorDrift: 0,
    heartbeatConsistency: 'Consistent',
    deviceIntegrityScore: 98,
    spoofProbability: 1,
    heartRate: 75,
    spo2: 98,
    ecgWaveform: [],
    preventionActive: false,
    telemetryIntercepted: false
  });

  const [threatIntelMetrics, setThreatIntelMetrics] = useState<ThreatIntelMetrics>({
    mitreMapping: 'None',
    iocConfidence: 0,
    malwareFamily: 'None',
    c2Communication: 'Idle',
    threatActorSimilarity: 0,
    campaignClassification: 'None',
    attackOrigins: [
      { name: 'North America Node', lat: 37.7749, lng: -122.4194, infected: false, label: 'Secure' },
      { name: 'East Europe C2', lat: 50.4501, lng: 30.5234, infected: false, label: 'C2 Host (Inactive)' },
      { name: 'East Asia Botnet', lat: 31.2304, lng: 121.4737, infected: false, label: 'Proxy Target (Normal)' },
      { name: 'Local Hospital Subnet', lat: 40.7128, lng: -74.0060, infected: true, label: 'ICU Monitor' }
    ],
    threatFeed: [],
    preventionActive: false,
    ipBlocked: 'None'
  });

  const [incidentMetrics, setIncidentMetrics] = useState<IncidentMetrics>({
    quarantineActions: [],
    firewallRuleExecution: 'Rule: ALLOW_ALL_INTERNAL_IOT',
    vlanIsolation: false,
    containmentTimeline: [],
    attackMitigationStatus: 'Standby',
    decisionTree: { threatScore: 4, iocMatch: false, containmentProtocol: 'INACTIVE' },
    preventionActive: false
  });

  const [complianceMetrics, setComplianceMetrics] = useState<ComplianceMetrics>({
    auditBlocks: [
      { id: 1040, hash: '3e827facd1b32087c53d10042f9fa21e900', prevHash: '72c38827fa10042f9fa21e900827facd1b32', hipaa: 'HIPAA §164.312(a)(1) ACCESS CONTROL', timestamp: new Date(Date.now() - 60000).toISOString(), status: 'PASSED' },
      { id: 1041, hash: 'ef72183cfab32087c53d10042f9fa21e901', prevHash: '3e827facd1b32087c53d10042f9fa21e900', hipaa: 'HIPAA §164.312(d) AUTHENTICATION', timestamp: new Date(Date.now() - 30000).toISOString(), status: 'PASSED' }
    ],
    tamperAttemptActive: false,
    lastTamperTime: '',
    tamperPrevented: false
  });

  const [attackerMetrics, setAttackerMetrics] = useState<AttackerMetrics>({
    attackProgression: 0,
    mutationEngine: 'Idle',
    evasionAttempts: [],
    attackConfidence: 0,
    infectionSpread: 'None',
    privilegeEscalation: 'None',
    attackType: 'agent1_ddos'
  });

  const [globalMetrics, setGlobalMetrics] = useState<GlobalMetrics>({
    threatLevel: 'SAFE',
    attackConfidence: 0,
    autonomousActionsCount: 42,
    containmentSuccessRate: 98,
    devicesUnderInvestigation: 0,
    activeAttackCount: 0
  });

  const [collabMessages, setCollabMessages] = useState<any[]>([]);

  // 1. Trigger attack state toggle in the backend
  const toggleAttack = async (active: boolean) => {
    try {
      const res = await fetch(`${BACKEND_REST_URL}/simulation/attack-toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attack_active: active, attack_type: attackType })
      });
      if (res.ok) {
        setAttackActive(active);
      }
    } catch (err) {
      console.error("Failed to toggle attack simulation:", err);
      setAttackActive(active);
    }
  };

  // 2. Reset the simulation (clears logs and resets device status)
  const resetSimulation = async () => {
    try {
      await fetch(`${BACKEND_REST_URL}/simulation/reset`, {
        method: 'POST'
      });
    } catch (err) {
      console.error("Failed to reset simulation:", err);
    }
    
    // Client-side reset
    setAttackActive(false);
    setDevices(prev => prev.map(d => ({ ...d, status: 'active' })));
    setCollabMessages([]);
    setAlerts([]);
    setGlobalMetrics({
      threatLevel: 'SAFE',
      attackConfidence: 0,
      autonomousActionsCount: 42,
      containmentSuccessRate: 98,
      devicesUnderInvestigation: 0,
      activeAttackCount: 0
    });
    setComplianceMetrics({
      auditBlocks: [
        { id: 1040, hash: '3e827facd1b32087c53d10042f9fa21e900', prevHash: '72c38827fa10042f9fa21e900827facd1b32', hipaa: 'HIPAA §164.312(a)(1) ACCESS CONTROL', timestamp: new Date(Date.now() - 60000).toISOString(), status: 'PASSED' },
        { id: 1041, hash: 'ef72183cfab32087c53d10042f9fa21e901', prevHash: '3e827facd1b32087c53d10042f9fa21e900', hipaa: 'HIPAA §164.312(d) AUTHENTICATION', timestamp: new Date(Date.now() - 30000).toISOString(), status: 'PASSED' }
      ],
      tamperAttemptActive: false,
      lastTamperTime: '',
      tamperPrevented: false
    });

    setAgent1Logs(generateBaselineLogs('Network Monitor'));
    setAgent2Logs(generateBaselineLogs('IoT Guardian'));
    setAgent3Logs(generateBaselineLogs('Threat Intelligence'));
    setAgent4Logs(generateBaselineLogs('Incident Response'));
    setAgent5Logs(generateBaselineLogs('Compliance Audit'));
  };

  const forceQuarantine = async (deviceId: string) => {
    try {
      await fetch(`${BACKEND_REST_URL}/devices/${deviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'quarantined' })
      });
    } catch (err) { console.error(err); }

    setDevices(prev => prev.map(d => d.device_id === deviceId ? { ...d, status: 'quarantined' } : d));
  };

  const escalateIncident = async (alertId: number) => {
    try {
      await fetch(`${BACKEND_REST_URL}/simulation/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_name: 'Incident Response',
          status: 'logged',
          message: `Manual Override: Incident #${alertId} escalated.`
        })
      });
    } catch (err) { console.error(err); }
  };

  // Tamper simulation for Agent 5
  const forceTamperLedger = () => {
    setComplianceMetrics(prev => {
      const timestamp = new Date().toLocaleTimeString();
      const blocks = [...prev.auditBlocks];
      if (blocks.length > 1) {
        blocks[blocks.length - 1] = {
          ...blocks[blocks.length - 1],
          hash: 'CORRUPTED_HASH_38120fa78',
          status: 'TAMPER_ALERT'
        };
      }
      return {
        ...prev,
        auditBlocks: blocks,
        tamperAttemptActive: true,
        lastTamperTime: timestamp,
        tamperPrevented: false
      };
    });

    // Append tamper alert to logs
    setAgent5Logs(prev => [
      ...prev,
      {
        agent: 'Compliance Audit',
        msg: '[ALERT] [IDENTIFICATION] Critical audit blockchain collision! Hash mismatch at Block #1041.',
        time: new Date().toLocaleTimeString(),
        status: 'attack'
      },
      {
        agent: 'Compliance Audit',
        msg: '[ACTION] [STOPPING] Suspended ledger commits. Isolating corrupted block entry state.',
        time: new Date().toLocaleTimeString(),
        status: 'warning'
      },
      {
        agent: 'Compliance Audit',
        msg: '[POLICY] [PREVENTION] Enforced verification protocol rollback trigger.',
        time: new Date().toLocaleTimeString(),
        status: 'warning'
      },
      {
        agent: 'Compliance Audit',
        msg: '[INFO] [SOLUTION] Trigger cryptographic rollback repair. Permanent solution: Implement cluster-distributed validation to prevent DB local write overrides.',
        time: new Date().toLocaleTimeString(),
        status: 'info'
      }
    ].slice(-50));
  };

  const triggerSelfHealLedger = () => {
    setComplianceMetrics(prev => {
      const blocks = [...prev.auditBlocks];
      if (blocks.length > 1) {
        blocks[blocks.length - 1] = {
          ...blocks[blocks.length - 1],
          hash: 'ef72183cfab32087c53d10042f9fa21e901',
          status: 'VERIFIED & RECOVERED'
        };
      }
      return {
        ...prev,
        auditBlocks: blocks,
        tamperAttemptActive: false,
        tamperPrevented: true
      };
    });

    setAgent5Logs(prev => [
      ...prev,
      {
        agent: 'Compliance Audit',
        msg: '[ACTION] [SELF-HEALING] Reconstructed block #1041 matching parent hash ef72183cf.',
        time: new Date().toLocaleTimeString(),
        status: 'success'
      },
      {
        agent: 'Compliance Audit',
        msg: '[SUCCESS] Ledger integrity restored. 100% compliance matching HIPAA audit requirements.',
        time: new Date().toLocaleTimeString(),
        status: 'success'
      }
    ].slice(-50));
  };

  const generateHash = (prevHash: string, data: string) => {
    let hash = 0;
    const str = prevHash + data;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0') + 'b32087c53d10042f9fa21e90' + (data.length % 9);
  };

  // Real-time loop driving dynamic, correlated telemetry
  useEffect(() => {
    let timer = 0;
    const interval = setInterval(() => {
      timer += 1;
      const isAttacking = attackActive;
      const progress = (timer * 20) % 120;

      // Reset logs if not attacking and timer resets
      if (!isAttacking) {
        timer = 0;
      }

      // 1. Attacker Progress state machine
      setAttackerMetrics(prev => {
        if (!isAttacking) {
          return {
            attackProgression: 0,
            mutationEngine: 'Offlined - Inactive',
            evasionAttempts: [],
            attackConfidence: 0,
            infectionSpread: 'None',
            privilegeEscalation: 'None',
            attackType
          };
        }
        
        let mutation = 'Polymorphic Encoder Mode';
        let evasion = ['Obfuscated TCP Payloads', 'Fragmented IP Packets'];
        let priv = 'Scanning SUID binaries...';
        let infection = 'Local Subnet Probe';

        if (progress > 30) {
          mutation = 'Telemetry Mutation Engine [v2.4] active';
          evasion.push('Faux heartbeat sequence injecting');
          priv = 'Attempting buffer overflow on socket listener';
        }
        if (progress > 60) {
          mutation = 'Evasion Engine mutation cycle #3';
          evasion.push('Noise injection in telemetry drift');
          priv = 'Privilege escalation target: root via CVE-2024-21626';
          infection = 'ICU Monitor esp32-hr-sim-001 compromised';
        }
        if (progress > 90) {
          mutation = 'Payload finalized: Poisoning active';
          priv = 'ROOT PRIVILEGES ACQUIRED';
          infection = 'Lateral propagation attempt blocked by VLAN';
        }

        return {
          attackProgression: progress,
          mutationEngine: mutation,
          evasionAttempts: evasion,
          attackConfidence: 94,
          infectionSpread: infection,
          privilegeEscalation: priv,
          attackType
        };
      });

      // 2. Correlated network metrics updates
      setNetworkMetrics(prev => {
        let baseRate = Math.floor(Math.random() * 8) + 12; // normal
        let baseEntropy = parseFloat((Math.random() * 0.08 + 0.12).toFixed(3));
        let anomalyProb = Math.floor(Math.random() * 3) + 1;
        let mismatch = parseFloat((Math.random() * 0.02 + 0.01).toFixed(3));
        let latMoveConf = 0;
        let beaconInterval = 'None';
        let prevActive = false;
        let throttle = 'None (Unthrottled)';

        if (isAttacking && attackType === 'agent1_ddos') {
          if (progress < 50) {
            baseRate = Math.floor(Math.random() * 500) + 2400; // Attack peak
            baseEntropy = parseFloat((Math.random() * 0.05 + 0.94).toFixed(3));
            anomalyProb = 99;
            mismatch = 0.88;
            latMoveConf = 15;
            beaconInterval = 'Heavy TCP SYN flood';
          } else {
            prevActive = true;
            baseRate = 12; // throttled back to normal rate
            baseEntropy = 0.14;
            anomalyProb = 3;
            mismatch = 0.02;
            throttle = 'eBPF Filter active - Rate-limiting port 80/443';
          }
        }

        const newHistory = [...prev.trafficHistory, {
          time: new Date().toLocaleTimeString(),
          packets: baseRate,
          entropy: baseEntropy,
          mismatch: mismatch
        }].slice(-25);

        return {
          packetRate: baseRate,
          entropyScore: baseEntropy,
          anomalyProbability: anomalyProb,
          sequenceMismatch: mismatch,
          lateralMovementConfidence: latMoveConf,
          beaconIntervalDetected: beaconInterval,
          trafficHistory: newHistory,
          preventionActive: prevActive,
          throttleLevel: throttle
        };
      });

      // 3. Healthcare Telemetry metrics updates (Agent 2)
      setDeviceMetrics(prev => {
        let reconLoss = parseFloat((Math.random() * 0.02 + 0.02).toFixed(4));
        let teleMutation = 0;
        let sensDrift = 0;
        let consistency = 'Consistent';
        let integrity = 98;
        let spoofProb = 1;
        let hr = Math.floor(Math.random() * 8) + 72; // 72-80 BPM
        let o2 = Math.floor(Math.random() * 2) + 98; // 98-99%
        let prevActive = false;
        let intercepted = false;

        // ECG normal waveform builder
        let ecg: number[] = [];
        for (let i = 0; i < 20; i++) {
          const tick = (timer * 20 + i) % 20;
          if (tick === 5) ecg.push(1.5);
          else if (tick === 4) ecg.push(-0.2);
          else if (tick === 6) ecg.push(-0.4);
          else if (tick === 10) ecg.push(0.3);
          else ecg.push(0);
        }

        if (isAttacking && attackType === 'agent2_spoof') {
          if (progress < 50) {
            reconLoss = 0.942;
            teleMutation = 95;
            sensDrift = 42;
            consistency = 'Critical Discrepancy';
            integrity = 14;
            spoofProb = 99;
            hr = 220; // Spoofed
            o2 = 81;  // Spoofed
            intercepted = false;
            ecg = ecg.map(v => v + (Math.random() * 1.5 - 0.75));
          } else {
            prevActive = true;
            intercepted = true;
            reconLoss = 0.025;
            teleMutation = 0;
            sensDrift = 0;
            consistency = 'Reconstructed Baseline';
            integrity = 98;
            spoofProb = 1;
            hr = 74; // Restored
            o2 = 98; // Restored
          }
        }

        return {
          reconstructionLoss: reconLoss,
          telemetryMutation: teleMutation,
          sensorDrift: sensDrift,
          heartbeatConsistency: consistency,
          deviceIntegrityScore: integrity,
          spoofProbability: spoofProb,
          heartRate: hr,
          spo2: o2,
          ecgWaveform: ecg,
          preventionActive: prevActive,
          telemetryIntercepted: intercepted
        };
      });

      // 4. Threat Intelligence (Agent 3)
      setThreatIntelMetrics(prev => {
        let mitre = 'None';
        let malware = 'None';
        let similarity = 0;
        let confidence = 0;
        let classification = 'None';
        let c2State = 'Idle';
        let prevActive = false;
        let blockedIp = 'None';

        if (isAttacking && attackType === 'agent3_c2') {
          if (progress < 50) {
            mitre = 'T1071 (Standard Application Layer Protocol)';
            malware = 'Mirai-C2 Variant';
            similarity = 96;
            confidence = 98;
            classification = 'Active Beaconing detected';
            c2State = 'Exfiltrating medical packets to C2 IP 45.33.32.156';
          } else {
            prevActive = true;
            blockedIp = '45.33.32.156';
            c2State = 'Severed - IP Blocked';
            mitre = 'T1071 (Blocked)';
            malware = 'Mirai-C2 Variant';
            similarity = 96;
            confidence = 98;
            classification = 'Contained Beaconing';
          }
        }

        const origins = prev.attackOrigins.map(o => {
          if (o.name === 'East Europe C2') {
            return { ...o, infected: isAttacking && attackType === 'agent3_c2' && progress < 50, label: isAttacking && attackType === 'agent3_c2' && progress < 50 ? 'ACTIVE ATTACK ORIGIN' : 'Blocked' };
          }
          return o;
        });

        return {
          mitreMapping: mitre,
          iocConfidence: confidence,
          malwareFamily: malware,
          c2Communication: c2State,
          threatActorSimilarity: similarity,
          campaignClassification: classification,
          attackOrigins: origins,
          threatFeed: [
            { indicator: '45.33.32.156', type: 'ipv4-addr', confidence: 98, source: 'AlienVault OTX', time: new Date().toLocaleTimeString(), threat_type: 'Mirai Beacon', mitre: 'T1071' }
          ],
          preventionActive: prevActive,
          ipBlocked: blockedIp
        };
      });

      // 5. Incident Response (Agent 4)
      setIncidentMetrics(prev => {
        let actions = prev.quarantineActions;
        let fw = 'Rule: ALLOW_ALL_INTERNAL_IOT';
        let vlan = false;
        let timeline = prev.containmentTimeline;
        let mitigationStatus = 'Standby';
        let treeScore = 8;
        let prevActive = false;

        if (isAttacking && attackType === 'agent4_vlan') {
          if (progress < 50) {
            actions = ['✓ Lateral scan detected'];
            fw = 'Rule: ALLOW_ALL_INTERNAL_IOT';
            vlan = false;
            mitigationStatus = 'Evaluating brute-force source...';
            treeScore = 48;
            timeline = [{ time: new Date().toLocaleTimeString(), action: 'Intrusion scan detected on port 22', status: 'ALERTING' }];
          } else {
            prevActive = true;
            actions = ['✓ Lateral scan detected', '✓ Device Quarantined', '✓ VLAN Isolation Executed'];
            fw = 'Rule: ISOLATE_VLAN_ICU_999';
            vlan = true;
            mitigationStatus = 'FULLY QUARANTINED';
            treeScore = 96;
            timeline = [
              { time: new Date().toLocaleTimeString(), action: 'Intrusion scan detected on port 22', status: 'ALERTING' },
              { time: new Date().toLocaleTimeString(), action: 'Executing dynamic VLAN isolation', status: 'COMPLETED' },
              { time: new Date().toLocaleTimeString(), action: 'Interface esp32-hr-sim-001 disabled', status: 'COMPLETED' }
            ];

            setDevices(prevDevs => prevDevs.map(d => d.device_id === 'esp32-hr-sim-001' ? { ...d, status: 'quarantined' } : d));
          }
        }

        return {
          quarantineActions: actions,
          firewallRuleExecution: fw,
          vlanIsolation: vlan,
          containmentTimeline: timeline,
          attackMitigationStatus: mitigationStatus,
          decisionTree: { threatScore: treeScore, iocMatch: isAttacking && attackType === 'agent4_vlan', containmentProtocol: prevActive ? 'EXECUTED' : 'EVALUATING' },
          preventionActive: prevActive
        };
      });

      // 6. Cryptographic HIPAA Compliance (Agent 5)
      setComplianceMetrics(prev => {
        if (isAttacking && progress > 60 && prev.auditBlocks.length === 2) {
          const blocks = [...prev.auditBlocks];
          const newBlockId = 1042;
          const prevHashVal = blocks[blocks.length - 1]?.hash || 'ef72183cfab32087c53d10042f9fa21e901';
          const payloadString = `MITIGATION_LOG-${attackType}-${newBlockId}`;
          const currentHashVal = generateHash(prevHashVal, payloadString);

          blocks.push({
            id: newBlockId,
            hash: currentHashVal,
            prevHash: prevHashVal,
            hipaa: 'HIPAA §164.308(a)(6)(ii) AUTOMATED INCIDENT REPORTING',
            timestamp: new Date().toISOString(),
            status: 'VERIFIED & LOCKED'
          });

          return { ...prev, auditBlocks: blocks };
        }
        return prev;
      });

      // 7. Global Dashboard metrics
      setGlobalMetrics(prev => {
        if (!isAttacking) {
          return {
            threatLevel: 'SAFE',
            attackConfidence: 0,
            autonomousActionsCount: prev.autonomousActionsCount,
            containmentSuccessRate: 98,
            devicesUnderInvestigation: 0,
            activeAttackCount: 0
          };
        }
        let lvl = 'SAFE';
        let conf = 0;
        let underInv = 0;
        let activeAtk = 0;

        if (progress < 50) {
          lvl = 'CRITICAL';
          conf = 95;
          underInv = 1;
          activeAtk = 1;
        } else {
          lvl = 'CONTAINED';
          conf = 95;
          underInv = 0;
          activeAtk = 0;
        }

        return {
          threatLevel: lvl,
          attackConfidence: conf,
          autonomousActionsCount: prev.autonomousActionsCount + (progress > 50 ? 1 : 0),
          containmentSuccessRate: 98,
          devicesUnderInvestigation: underInv,
          activeAttackCount: activeAtk
        };
      });

      // 8. Dynamic Log Appending for each of the 5 agents
      if (isAttacking) {
        const timestamp = new Date().toLocaleTimeString();

        // --- AGENT 1 LOGIC ---
        if (attackType === 'agent1_ddos') {
          if (progress === 20) {
            setAgent1Logs(prev => [
              ...prev,
              { agent: 'Network Monitor', msg: '[ALERT] [IDENTIFICATION] LSTM flags abnormal packet frequency spike on eth0! (2,400 pkts/s exceeds threshold 200)', time: timestamp, status: 'attack' }
            ].slice(-50));
          }
          else if (progress === 40) {
            setAgent1Logs(prev => [
              ...prev,
              { agent: 'Network Monitor', msg: '[ACTION] [STOPPING] Enforcing eBPF filter rule drop. Dropping TCP SYN packets from attack source.', time: timestamp, status: 'warning' }
            ].slice(-50));
          }
          else if (progress === 60) {
            setAgent1Logs(prev => [
              ...prev,
              { agent: 'Network Monitor', msg: '[POLICY] [PREVENTION] Applied automated rate-limiting policy to port 80/443 on IoT gateway subnet.', time: timestamp, status: 'warning' },
              { agent: 'Network Monitor', msg: '[INFO] [SOLUTION] Permanent Solution: Configure ingress QoS queue shaping, enable syncookies on host kernel, and deploy edge DDoS scrubbers.', time: timestamp, status: 'info' }
            ].slice(-50));
            
            // Log block creation in Agent 5
            setAgent5Logs(prev => [
              ...prev,
              { agent: 'Compliance Audit', msg: '[ALERT] [IDENTIFICATION] Detected mitigation completion. Creating block #1042 verification signature.', time: timestamp, status: 'warning' },
              { agent: 'Compliance Audit', msg: '[SUCCESS] HIPAA transaction logged successfully to hash ledger. Block hash: 39af20f782ba.', time: timestamp, status: 'success' }
            ].slice(-50));
          }
          else if (progress === 80) {
            setAgent1Logs(prev => [
              ...prev,
              { agent: 'Network Monitor', msg: '[ACTION] [SELF-HEALING] Reconstructed traffic rules. Traffic ingestion rate restored to nominal bounds (12 pkts/sec).', time: timestamp, status: 'success' }
            ].slice(-50));
          }
          else if (progress === 100) {
            setAgent1Logs(prev => [
              ...prev,
              { agent: 'Network Monitor', msg: '[SUCCESS] Network Monitor threat resolved. Subnet status restored to SECURE.', time: timestamp, status: 'success' }
            ].slice(-50));
          }
        }

        // --- AGENT 2 LOGIC ---
        if (attackType === 'agent2_spoof') {
          if (progress === 20) {
            setAgent2Logs(prev => [
              ...prev,
              { agent: 'IoT Guardian', msg: '[ALERT] [IDENTIFICATION] Clinical bounds check failed! Heart rate (220 BPM) and SpO2 (81%) reconstructed with high error loss (0.942).', time: timestamp, status: 'attack' }
            ].slice(-50));
          }
          else if (progress === 40) {
            setAgent2Logs(prev => [
              ...prev,
              { agent: 'IoT Guardian', msg: '[ACTION] [STOPPING] Intercepting data telemetry stream. Reverting local device state updates.', time: timestamp, status: 'warning' }
            ].slice(-50));
          }
          else if (progress === 60) {
            setAgent2Logs(prev => [
              ...prev,
              { agent: 'IoT Guardian', msg: '[POLICY] [PREVENTION] Enforced dynamic baseline mutation rejection. Telemetry from device quarantined.', time: timestamp, status: 'warning' },
              { agent: 'IoT Guardian', msg: '[INFO] [SOLUTION] Permanent Solution: Implement cryptographically signed telemetry frames from device firmware (HMAC-SHA256) and enroll devices in mutual TLS (mTLS).', time: timestamp, status: 'info' }
            ].slice(-50));

            setAgent5Logs(prev => [
              ...prev,
              { agent: 'Compliance Audit', msg: '[ALERT] [IDENTIFICATION] Device telemetry exception registered. Generating blockchain report.', time: timestamp, status: 'warning' },
              { agent: 'Compliance Audit', msg: '[SUCCESS] Registered Block #1042. Clinical Data Integrity check passed (§164.312(c)).', time: timestamp, status: 'success' }
            ].slice(-50));
          }
          else if (progress === 80) {
            setAgent2Logs(prev => [
              ...prev,
              { agent: 'IoT Guardian', msg: '[ACTION] [SELF-HEALING] Telemetry values returned within clinical bounds. Restoring device status to ACTIVE.', time: timestamp, status: 'success' }
            ].slice(-50));
          }
          else if (progress === 100) {
            setAgent2Logs(prev => [
              ...prev,
              { agent: 'IoT Guardian', msg: '[SUCCESS] IoT telemetry verification successful. Patient heart rate monitoring baseline is SECURE.', time: timestamp, status: 'success' }
            ].slice(-50));
          }
        }

        // --- AGENT 3 LOGIC ---
        if (attackType === 'agent3_c2') {
          if (progress === 20) {
            setAgent3Logs(prev => [
              ...prev,
              { agent: 'Threat Intelligence', msg: '[ALERT] [IDENTIFICATION] STIX NLP matcher flags connection target IP 45.33.32.156. Matches APT41 Command & Control feed.', time: timestamp, status: 'attack' }
            ].slice(-50));
          }
          else if (progress === 40) {
            setAgent3Logs(prev => [
              ...prev,
              { agent: 'Threat Intelligence', msg: '[ACTION] [STOPPING] Severed socket connection to remote C2. DNS cache query invalidated.', time: timestamp, status: 'warning' }
            ].slice(-50));
          }
          else if (progress === 60) {
            setAgent3Logs(prev => [
              ...prev,
              { agent: 'Threat Intelligence', msg: '[POLICY] [PREVENTION] Injected firewall IP drop rule. Blocked all ingress/egress to remote subnet 45.33.32.0/24.', time: timestamp, status: 'warning' },
              { agent: 'Threat Intelligence', msg: '[INFO] [SOLUTION] Permanent Solution: Configure DNS firewalls (RPZ), restrict outbound access to whitelisted medical proxy domains, and enforce zero-trust egress routing.', time: timestamp, status: 'info' }
            ].slice(-50));

            setAgent5Logs(prev => [
              ...prev,
              { agent: 'Compliance Audit', msg: '[ALERT] [IDENTIFICATION] External C2 signature matched. Sealing transmission logs.', time: timestamp, status: 'warning' },
              { agent: 'Compliance Audit', msg: '[SUCCESS] Block #1042 verified and sealed. HIPAA Access Control check passed (§164.312(a)).', time: timestamp, status: 'success' }
            ].slice(-50));
          }
          else if (progress === 80) {
            setAgent3Logs(prev => [
              ...prev,
              { agent: 'Threat Intelligence', msg: '[ACTION] [SELF-HEALING] Egress connections verified clean. Dynamic firewall rule cleanup triggered.', time: timestamp, status: 'success' }
            ].slice(-50));
          }
          else if (progress === 100) {
            setAgent3Logs(prev => [
              ...prev,
              { agent: 'Threat Intelligence', msg: '[SUCCESS] C2 connection completely severed. Threat intelligence alert status cleared.', time: timestamp, status: 'success' }
            ].slice(-50));
          }
        }

        // --- AGENT 4 LOGIC ---
        if (attackType === 'agent4_vlan') {
          if (progress === 20) {
            setAgent4Logs(prev => [
              ...prev,
              { agent: 'Incident Response', msg: '[ALERT] [IDENTIFICATION] Port scan anomaly detected on subnet VLAN_ICU. Port 22 SSH brute-force attempts exceeded threshold (50/min).', time: timestamp, status: 'attack' }
            ].slice(-50));
          }
          else if (progress === 40) {
            setAgent4Logs(prev => [
              ...prev,
              { agent: 'Incident Response', msg: '[ACTION] [STOPPING] Deployed quarantine playbook. Disabling interface link for device esp32-hr-sim-001.', time: timestamp, status: 'warning' }
            ].slice(-50));
          }
          else if (progress === 60) {
            setAgent4Logs(prev => [
              ...prev,
              { agent: 'Incident Response', msg: '[POLICY] [PREVENTION] VLAN Sandbox 999 enforced. Dynamic routing rule ALLOW dropped.', time: timestamp, status: 'warning' },
              { agent: 'Incident Response', msg: '[INFO] [SOLUTION] Permanent Solution: Restrict SSH to bastion hosts, enforce public key authorization with MFA, and apply micro-segmentation inside the clinical network.', time: timestamp, status: 'info' }
            ].slice(-50));

            setAgent5Logs(prev => [
              ...prev,
              { agent: 'Compliance Audit', msg: '[ALERT] [IDENTIFICATION] Security Incident quarantine timeline completed. Signing audit chain.', time: timestamp, status: 'warning' },
              { agent: 'Compliance Audit', msg: '[SUCCESS] Block #1042 verification complete. NIST Incident Response mapping signed successfully.', time: timestamp, status: 'success' }
            ].slice(-50));
          }
          else if (progress === 80) {
            setAgent4Logs(prev => [
              ...prev,
              { agent: 'Incident Response', msg: '[ACTION] [SELF-HEALING] Micro-segmentation access rules restored. SSH authentication limits applied.', time: timestamp, status: 'success' }
            ].slice(-50));
          }
          else if (progress === 100) {
            setAgent4Logs(prev => [
              ...prev,
              { agent: 'Incident Response', msg: '[SUCCESS] Restored dynamic SSH authentication bounds. VLAN segment status is SECURE.', time: timestamp, status: 'success' }
            ].slice(-50));
          }
        }

        // --- AGENT 5 LOGIC ---
        if (attackType === 'agent5_tamper') {
          if (progress === 20) {
            setComplianceMetrics(prev => {
              const blocks = [...prev.auditBlocks];
              if (blocks.length > 1 && blocks[blocks.length - 1].status !== 'TAMPER_ALERT') {
                blocks[blocks.length - 1] = {
                  ...blocks[blocks.length - 1],
                  hash: 'CORRUPTED_HASH_38120fa78',
                  status: 'TAMPER_ALERT'
                };
              }
              return {
                ...prev,
                auditBlocks: blocks,
                tamperAttemptActive: true,
                lastTamperTime: timestamp,
                tamperPrevented: false
              };
            });
            setAgent5Logs(prev => [
              ...prev,
              { agent: 'Compliance Audit', msg: '[ALERT] [IDENTIFICATION] Critical audit blockchain collision! Hash mismatch at Block #1041.', time: timestamp, status: 'attack' }
            ].slice(-50));
          }
          else if (progress === 40) {
            setAgent5Logs(prev => [
              ...prev,
              { agent: 'Compliance Audit', msg: '[ACTION] [STOPPING] Suspended ledger commits. Isolating corrupted block entry state.', time: timestamp, status: 'warning' }
            ].slice(-50));
          }
          else if (progress === 60) {
            setAgent5Logs(prev => [
              ...prev,
              { agent: 'Compliance Audit', msg: '[POLICY] [PREVENTION] Enforced verification protocol rollback trigger.', time: timestamp, status: 'warning' },
              { agent: 'Compliance Audit', msg: '[INFO] [SOLUTION] Trigger cryptographic rollback repair. Permanent solution: Implement cluster-distributed validation to prevent DB local write overrides.', time: timestamp, status: 'info' }
            ].slice(-50));
          }
          else if (progress === 80) {
            setComplianceMetrics(prev => {
              const blocks = [...prev.auditBlocks];
              if (blocks.length > 1) {
                blocks[blocks.length - 1] = {
                  ...blocks[blocks.length - 1],
                  hash: 'ef72183cfab32087c53d10042f9fa21e901',
                  status: 'VERIFIED & RECOVERED'
                };
              }
              return {
                ...prev,
                auditBlocks: blocks,
                tamperAttemptActive: false,
                tamperPrevented: true
              };
            });
            setAgent5Logs(prev => [
              ...prev,
              { agent: 'Compliance Audit', msg: '[ACTION] [SELF-HEALING] Reconstructed block #1041 matching parent hash ef72183cf.', time: timestamp, status: 'success' },
              { agent: 'Compliance Audit', msg: '[SUCCESS] Ledger integrity restored. 100% compliance matching HIPAA audit requirements.', time: timestamp, status: 'success' }
            ].slice(-50));
          }
        }

        // Update unified collab messages for historical dashboard ticker
        setCollabMessages(prev => {
          const combined = [
            ...agent1Logs.filter(l => l.status !== 'info'),
            ...agent2Logs.filter(l => l.status !== 'info'),
            ...agent3Logs.filter(l => l.status !== 'info'),
            ...agent4Logs.filter(l => l.status !== 'info'),
            ...agent5Logs.filter(l => l.status !== 'info')
          ];
          return combined.sort((a, b) => a.time.localeCompare(b.time)).slice(-40);
        });
      }

    }, 1200);

    return () => clearInterval(interval);
  }, [attackActive, attackType, agent1Logs, agent2Logs, agent3Logs, agent4Logs, agent5Logs]);

  useEffect(() => {
    // Fetch initial state
    const fetchInitialData = async () => {
      try {
        const [devicesRes, alertsRes, attackRes] = await Promise.all([
          fetch(`${BACKEND_REST_URL}/devices/`),
          fetch(`${BACKEND_REST_URL}/alerts/`),
          fetch(`${BACKEND_REST_URL}/simulation/attack-status`)
        ]);

        if (devicesRes.ok) {
          const devs = await devicesRes.json();
          setDevices(devs);
        }
        if (alertsRes.ok) {
          const alrts = await alertsRes.json();
          alrts.sort((a: Alert, b: Alert) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setAlerts(alrts.slice(0, 50));
        }
        if (attackRes.ok) {
          const attackStatus = await attackRes.json();
          setAttackActive(attackStatus.attack_active);
          if (attackStatus.attack_type) {
            setAttackType(attackStatus.attack_type);
          }
        }
      } catch (err) {
        console.error("Failed to fetch initial data:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchInitialData();

    // Setup WebSocket for live updates
    const ws = new WebSocket(BACKEND_WS_URL);
    
    ws.onopen = () => {
      console.log("Connected to MediSentinel live WebSocket");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { topic, data } = msg;

        if (topic === 'devices/auto_registered') {
          setDevices(prev => {
            if (prev.some(d => d.device_id === data.device_id)) return prev;
            return [...prev, data];
          });
        }
        else if (topic === 'devices/telemetry') {
           setDevices(prev => prev.map(d => 
             d.device_id === data.device_id 
              ? { 
                  ...d, 
                  status: data.status || d.status,
                  last_seen: new Date().toISOString(),
                  metadata_json: {
                    ...d.metadata_json,
                    heart_rate: data.heart_rate !== undefined ? data.heart_rate : d.metadata_json?.heart_rate,
                    spo2: data.spo2 !== undefined ? data.spo2 : d.metadata_json?.spo2,
                    battery_level: data.battery_level !== undefined ? data.battery_level : d.metadata_json?.battery_level,
                    network: data.network !== undefined ? data.network : d.metadata_json?.network
                  }
                } 
              : d
           ));
        }
        else if (topic === 'simulation/attack_toggle') {
          setAttackActive(data.attack_active);
          if (data.attack_type) {
            setAttackType(data.attack_type);
          }
        }
        else if (topic === 'simulation/agent_log') {
          const logEntry = {
            agent: data.agent_name,
            msg: data.message,
            time: new Date(data.timestamp || new Date()).toLocaleTimeString(),
            status: data.status
          };
          if (data.agent_name === 'Network Monitor') {
            setAgent1Logs(prev => [...prev, logEntry].slice(-50));
          } else if (data.agent_name === 'IoT Guardian') {
            setAgent2Logs(prev => [...prev, logEntry].slice(-50));
          } else if (data.agent_name === 'Threat Intelligence') {
            setAgent3Logs(prev => [...prev, logEntry].slice(-50));
          } else if (data.agent_name === 'Incident Response') {
            setAgent4Logs(prev => [...prev, logEntry].slice(-50));
          } else if (data.agent_name === 'Compliance Audit') {
            setAgent5Logs(prev => [...prev, logEntry].slice(-50));
          }
          if (data.status !== 'info') {
            setCollabMessages(prev => [...prev, logEntry].slice(-40));
          }
        }
        else if (topic === 'alerts' || topic === 'anomalies') {
            const isDeviceAnomaly = data.type?.includes("Device") || data.severity === "critical";
            
            const newAlert: Alert = {
              id: data.id || Math.floor(Math.random() * 1000000),
              device_id: data.device_id || "UNKNOWN",
              type: data.type || (isDeviceAnomaly ? 'Device Behavior Anomaly' : 'Network Anomaly'),
              severity: data.severity || (isDeviceAnomaly ? 'critical' : 'high'),
              description: data.description || 'Abnormal behavior detected by AI Agents.',
              timestamp: data.timestamp || new Date().toISOString(),
              is_resolved: false
            };

            setAlerts(prev => [newAlert, ...prev].slice(0, 50));
        }
      } catch (e) {
        console.error("Failed parsing WS message", e);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
    };

    return () => {
      ws.close();
    };
  }, []);

  return { 
    devices, 
    alerts, 
    agentLogs, 
    attackActive, 
    toggleAttack, 
    resetSimulation, 
    forceQuarantine, 
    escalateIncident, 
    loading,
    attackType,
    setAttackType,
    networkMetrics,
    deviceMetrics,
    threatIntelMetrics,
    incidentMetrics,
    complianceMetrics,
    attackerMetrics,
    globalMetrics,
    collabMessages,
    forceTamperLedger,
    triggerSelfHealLedger,
    agent1Logs,
    agent2Logs,
    agent3Logs,
    agent4Logs,
    agent5Logs
  };
};
