import React, { useRef } from 'react';
import { ShieldAlert, Play, Square, RotateCcw, FileJson, Cpu, Network, Radio, Shield, Lock, Terminal, Activity } from 'lucide-react';
import { useStore } from '../useStore';

const AttackSimulationHub: React.FC = () => {
  const {
    devices,
    attackActive,
    toggleAttack,
    resetSimulation,
    attackType,
    setAttackType,
    networkMetrics,
    deviceMetrics,
    threatIntelMetrics,
    incidentMetrics,
    complianceMetrics,
    agent1Logs,
    agent2Logs,
    agent3Logs,
    agent4Logs,
    agent5Logs,
    forceTamperLedger,
    triggerSelfHealLedger
  } = useStore();

  const fileDownloadRef = useRef<HTMLAnchorElement>(null);

  const handleExportJSON = () => {
    const allLogs = [
      ...agent1Logs,
      ...agent2Logs,
      ...agent3Logs,
      ...agent4Logs,
      ...agent5Logs
    ];
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allLogs, null, 2));
    if (fileDownloadRef.current) {
      fileDownloadRef.current.setAttribute("href", dataStr);
      fileDownloadRef.current.setAttribute("download", `medisentinel_telemetry_audit_${Date.now()}.json`);
      fileDownloadRef.current.click();
    }
  };

  const activeDevice = devices.find(d => d.device_id === 'esp32-hr-sim-001') || { device_id: 'esp32-hr-sim-001', status: 'active' };

  return (
    <div className="main-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Panel */}
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
            <ShieldAlert color="var(--color-accent)" size={32} />
            Multi-Agent Cyber Security Range
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Trigger real-time attack simulations to evaluate automated identification, stopping, prevention, and compliance ledger logging.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={handleExportJSON} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileJson size={16} /> Export Consolidated Logs
          </button>
          <button onClick={resetSimulation} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <RotateCcw size={16} /> Reset Dashboard
          </button>
        </div>
      </div>

      {/* Cyber Range Controller */}
      <div className="glass-panel" style={{
        padding: '24px',
        border: attackActive ? '1px solid rgba(255,0,85,0.3)' : '1px solid rgba(0,255,136,0.15)',
        boxShadow: attackActive ? '0 0 20px rgba(255,0,85,0.1)' : '0 0 15px rgba(0,255,136,0.05)',
        transition: 'all 0.3s ease'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="live-dot" style={{ backgroundColor: attackActive ? 'var(--color-accent)' : 'var(--color-success)' }}></span>
              <h2 style={{ fontSize: '1.3rem', margin: 0, color: 'var(--text-primary)' }}>
                {attackActive ? 'SIMULATION IN PROGRESS' : 'SIMULATION RANGE READY'}
              </h2>
            </div>
            <p style={{ margin: '6px 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Select a target agent and click Trigger to simulate live network anomalies and trace mitigation sequences.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <select
              value={attackType}
              onChange={(e) => setAttackType(e.target.value)}
              disabled={attackActive}
              style={{
                background: 'rgba(0,0,0,0.5)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '10px 16px',
                borderRadius: '6px',
                outline: 'none',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              <option value="agent1_ddos">Agent 1: TCP SYN DDoS Flood</option>
              <option value="agent2_spoof">Agent 2: Telemetry Poisoning</option>
              <option value="agent3_c2">Agent 3: C2 Beacon Tunneling</option>
              <option value="agent4_vlan">Agent 4: VLAN Lateral Movement</option>
              <option value="agent5_tamper">Agent 5: Cryptographic Ledger Tampering</option>
            </select>

            <button
              onClick={() => toggleAttack(!attackActive)}
              style={{
                background: attackActive ? 'var(--color-accent)' : 'var(--color-primary)',
                color: '#000',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                boxShadow: attackActive ? '0 0 15px var(--color-accent)' : 'none'
              }}
            >
              {attackActive ? <Square size={16} /> : <Play size={16} />}
              {attackActive ? 'Stop Simulation' : 'Launch Payload'}
            </button>
          </div>
        </div>
      </div>

      {/* Grid of the 5 Security Agents with Custom Interfaces */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px' }}>
        
        {/* ==================== AGENT 1: NETWORK MONITOR ==================== */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '3px solid var(--color-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Network color="var(--color-primary)" />
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>Agent 1: Network Monitor</h3>
            </div>
            <span className="live-badge" style={{ 
              color: attackActive && attackType === 'agent1_ddos' ? (networkMetrics.preventionActive ? 'var(--color-success)' : 'var(--color-accent)') : 'var(--color-success)',
              border: `1px solid ${attackActive && attackType === 'agent1_ddos' ? (networkMetrics.preventionActive ? 'var(--color-success)' : 'var(--color-accent)') : 'var(--color-success)'}`
            }}>
              {attackActive && attackType === 'agent1_ddos' ? (networkMetrics.preventionActive ? 'THROTTLED & PREVENTED' : 'DDoS ATTACK ACTIVE') : 'MONITORING'}
            </span>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <strong>Detection Logic:</strong> LSTM sequence analysis and Isolation Forest outlier calculation.
          </div>

          {/* Identification, Stopping, Prevention & Solution blocks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.8rem' }}>
              <strong style={{ color: 'var(--color-primary)' }}>1. IDENTIFICATION:</strong>{' '}
              {attackActive && attackType === 'agent1_ddos' ? 'LSTM detected packet rate spike to 2,400 pkts/s (exceeds threshold 200 pkts/s)' : 'Monitoring packet sequence entropy for baseline anomalies.'}
            </div>
            <div style={{ fontSize: '0.8rem' }}>
              <strong style={{ color: 'var(--color-primary)' }}>2. STOPPING (CONTAINMENT):</strong>{' '}
              {attackActive && attackType === 'agent1_ddos' ? 'Injected eBPF XDP filter to drop ingress TCP SYN packets from attack source.' : 'eBPF dynamic packet filters inactive.'}
            </div>
            <div style={{ fontSize: '0.8rem' }}>
              <strong style={{ color: 'var(--color-success)' }}>3. PREVENTION & SOLUTION:</strong>{' '}
              <span style={{ color: 'var(--text-muted)' }}>Configure ingress rate-limiting, enable TCP syncookies in host sysctl, and deploy edge scrubbing centers.</span>
            </div>
          </div>

          {/* Real-time Agent Log Console (Last 50 Logs) */}
          <AgentConsole name="Network Monitor" logs={agent1Logs} />
        </div>

        {/* ==================== AGENT 2: IoT GUARDIAN ==================== */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '3px solid var(--color-secondary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Cpu color="var(--color-secondary)" />
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>Agent 2: IoT Guardian</h3>
            </div>
            <span className="live-badge" style={{ 
              color: attackActive && attackType === 'agent2_spoof' ? (deviceMetrics.preventionActive ? 'var(--color-success)' : 'var(--color-accent)') : 'var(--color-success)',
              border: `1px solid ${attackActive && attackType === 'agent2_spoof' ? (deviceMetrics.preventionActive ? 'var(--color-success)' : 'var(--color-accent)') : 'var(--color-success)'}`
            }}>
              {attackActive && attackType === 'agent2_spoof' ? (deviceMetrics.preventionActive ? 'MUTATION INTERCEPTED' : 'POISONING ACTIVE') : 'MONITORING'}
            </span>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <strong>Detection Logic:</strong> Deep learning autoencoder evaluating reconstruction loss thresholds.
          </div>

          {/* Identification, Stopping, Prevention & Solution blocks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.8rem' }}>
              <strong style={{ color: 'var(--color-secondary)' }}>1. IDENTIFICATION:</strong>{' '}
              {attackActive && attackType === 'agent2_spoof' ? 'Autoencoder reconstruction loss spiked to 0.942 (exceeds threshold 0.50)' : 'Monitoring ECG/HR sensor telemetry consistency.'}
            </div>
            <div style={{ fontSize: '0.8rem' }}>
              <strong style={{ color: 'var(--color-secondary)' }}>2. STOPPING (CONTAINMENT):</strong>{' '}
              {attackActive && attackType === 'agent2_spoof' ? 'Intercepted data stream, isolated state registers, and rejected spoofed payload.' : 'Telemetry payload interceptors inactive.'}
            </div>
            <div style={{ fontSize: '0.8rem' }}>
              <strong style={{ color: 'var(--color-success)' }}>3. PREVENTION & SOLUTION:</strong>{' '}
              <span style={{ color: 'var(--text-muted)' }}>Implement HMAC-SHA256 frame signing in firmware, require mutual TLS (mTLS), and enforce secure boot.</span>
            </div>
          </div>

          {/* Real-time Agent Log Console (Last 50 Logs) */}
          <AgentConsole name="IoT Guardian" logs={agent2Logs} />
        </div>

        {/* ==================== AGENT 3: THREAT INTELLIGENCE ==================== */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '3px solid var(--color-warning)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Radio color="var(--color-warning)" />
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>Agent 3: Threat Intelligence</h3>
            </div>
            <span className="live-badge" style={{ 
              color: attackActive && attackType === 'agent3_c2' ? (threatIntelMetrics.preventionActive ? 'var(--color-success)' : 'var(--color-accent)') : 'var(--color-success)',
              border: `1px solid ${attackActive && attackType === 'agent3_c2' ? (threatIntelMetrics.preventionActive ? 'var(--color-success)' : 'var(--color-accent)') : 'var(--color-success)'}`
            }}>
              {attackActive && attackType === 'agent3_c2' ? (threatIntelMetrics.preventionActive ? 'IP PORT BLOCKED' : 'C2 BEACONING ACTIVE') : 'MONITORING'}
            </span>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <strong>Detection Logic:</strong> STIX/TAXII threat feed correlation & outbound request NLP lookup.
          </div>

          {/* Identification, Stopping, Prevention & Solution blocks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.8rem' }}>
              <strong style={{ color: 'var(--color-warning)' }}>1. IDENTIFICATION:</strong>{' '}
              {attackActive && attackType === 'agent3_c2' ? 'Outbound socket connection to 45.33.32.156 matches active blacklisted APT41 feed' : 'Scanning egress domain queries against threat intelligence indexes.'}
            </div>
            <div style={{ fontSize: '0.8rem' }}>
              <strong style={{ color: 'var(--color-warning)' }}>2. STOPPING (CONTAINMENT):</strong>{' '}
              {attackActive && attackType === 'agent3_c2' ? 'Injected firewall drop policy denying outbound traffic to C2 IP subnet.' : 'Egress IP address filters inactive.'}
            </div>
            <div style={{ fontSize: '0.8rem' }}>
              <strong style={{ color: 'var(--color-success)' }}>3. PREVENTION & SOLUTION:</strong>{' '}
              <span style={{ color: 'var(--text-muted)' }}>Configure Response Policy Zones (RPZ) in DNS, routing through whitelisted proxies, and zero-trust routing.</span>
            </div>
          </div>

          {/* Real-time Agent Log Console (Last 50 Logs) */}
          <AgentConsole name="Threat Intelligence" logs={agent3Logs} />
        </div>

        {/* ==================== AGENT 4: INCIDENT RESPONSE ==================== */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '3px solid var(--color-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Shield color="var(--color-primary)" />
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>Agent 4: Incident Response</h3>
            </div>
            <span className="live-badge" style={{ 
              color: attackActive && attackType === 'agent4_vlan' ? (incidentMetrics.preventionActive ? 'var(--color-success)' : 'var(--color-accent)') : 'var(--color-success)',
              border: `1px solid ${attackActive && attackType === 'agent4_vlan' ? (incidentMetrics.preventionActive ? 'var(--color-success)' : 'var(--color-accent)') : 'var(--color-success)'}`
            }}>
              {attackActive && attackType === 'agent4_vlan' ? (incidentMetrics.preventionActive ? 'VLAN ISOLATED' : 'LATERAL ACTIVE') : 'MONITORING'}
            </span>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <strong>Detection Logic:</strong> Policy playbooks mapped to Mitre ATT&CK tactics.
          </div>

          {/* Identification, Stopping, Prevention & Solution blocks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.8rem' }}>
              <strong style={{ color: 'var(--color-primary)' }}>1. IDENTIFICATION:</strong>{' '}
              {attackActive && attackType === 'agent4_vlan' ? 'Port scan detected on VLAN_ICU. Port 22 SSH brute-force attempts exceeded 50/min.' : 'Awaiting threat validation to trigger containment playbooks.'}
            </div>
            <div style={{ fontSize: '0.8rem' }}>
              <strong style={{ color: 'var(--color-primary)' }}>2. STOPPING (CONTAINMENT):</strong>{' '}
              {attackActive && attackType === 'agent4_vlan' ? 'Triggered VLAN quarantine. Disconnected device port and routed device to sandbox VLAN 999.' : 'VLAN containment actions standby.'}
            </div>
            <div style={{ fontSize: '0.8rem' }}>
              <strong style={{ color: 'var(--color-success)' }}>3. PREVENTION & SOLUTION:</strong>{' '}
              <span style={{ color: 'var(--text-muted)' }}>Restrict host access to bastion servers, deploy MFA for SSH keys, and configure micro-segmentation.</span>
            </div>
          </div>

          {/* Real-time Agent Log Console (Last 50 Logs) */}
          <AgentConsole name="Incident Response" logs={agent4Logs} />
        </div>

        {/* ==================== AGENT 5: COMPLIANCE AUDIT ==================== */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '3px solid var(--color-success)', gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Lock color="var(--color-success)" />
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>Agent 5: Compliance Audit (Cryptographic Hash Validation)</h3>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={forceTamperLedger}
                disabled={complianceMetrics.tamperAttemptActive}
                style={{
                  background: 'rgba(255,0,85,0.1)',
                  color: 'var(--color-accent)',
                  border: '1px solid rgba(255,0,85,0.3)',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 'bold'
                }}
              >
                Simulate Blockchain Tamper
              </button>
              {complianceMetrics.tamperAttemptActive && (
                <button 
                  onClick={triggerSelfHealLedger}
                  style={{
                    background: 'rgba(0,255,136,0.1)',
                    color: 'var(--color-success)',
                    border: '1px solid rgba(0,255,136,0.3)',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    animation: 'pulse 1s infinite alternate'
                  }}
                >
                  Apply Self-Healing Rollback
                </button>
              )}
            </div>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <strong>Detection Logic:</strong> Blockchain ledger storing SHA-256 blocks with cryptographic parent matching.
          </div>

          {/* Interactive Block Visuals */}
          <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', padding: '8px 0' }}>
            {complianceMetrics.auditBlocks.map((block, idx) => (
              <div 
                key={block.id} 
                style={{
                  flexShrink: 0,
                  width: '280px',
                  background: 'rgba(0,0,0,0.5)',
                  border: block.status === 'TAMPER_ALERT' ? '1px solid var(--color-accent)' : '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '6px',
                  padding: '12px',
                  boxShadow: block.status === 'TAMPER_ALERT' ? '0 0 12px rgba(255,0,85,0.2)' : 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>BLOCK #{block.id}</span>
                  <span style={{ color: block.status === 'TAMPER_ALERT' ? 'var(--color-accent)' : 'var(--color-success)', fontWeight: 'bold' }}>{block.status}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  Hash: {block.hash}
                </div>
                {idx > 0 && (
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginTop: '2px' }}>
                    Prev Hash: {block.prevHash}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Compliance Info panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.8rem' }}>
              <strong style={{ color: 'var(--color-success)' }}>1. IDENTIFICATION:</strong>{' '}
              {complianceMetrics.tamperAttemptActive ? 'Detected unauthorized local modification of ledger database. Hash chain verification failed!' : 'Ledger hashing routine checking block signature parents.'}
            </div>
            <div style={{ fontSize: '0.8rem' }}>
              <strong style={{ color: 'var(--color-success)' }}>2. STOPPING (CONTAINMENT):</strong>{' '}
              {complianceMetrics.tamperAttemptActive ? 'Suspended block writing and isolated corrupted block #1041 state.' : 'Verification scans running.'}
            </div>
            <div style={{ fontSize: '0.8rem' }}>
              <strong style={{ color: 'var(--color-success)' }}>3. PREVENTION & SOLUTION:</strong>{' '}
              <span style={{ color: 'var(--text-muted)' }}>Implement cluster consensus validation mechanisms (e.g. Raft) to prevent local ledger database write overrides.</span>
            </div>
          </div>

          {/* Real-time Agent Log Console (Last 50 Logs) */}
          <AgentConsole name="Compliance Audit" logs={agent5Logs} />
        </div>

      </div>
    </div>
  );
};

// Console logger subcomponent (Showing last 50 logs)
interface AgentConsoleProps {
  name: string;
  logs: any[];
}

const AgentConsole: React.FC<AgentConsoleProps> = ({ name, logs }) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '220px', background: '#050508', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#09090e', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <Terminal size={12} />
        <span>Agent Operations Feed (Last {logs.length} entries)</span>
      </div>
      <div ref={scrollRef} style={{ flexGrow: 1, padding: '12px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {logs.map((m, idx) => (
          <div key={idx} style={{ 
            color: m.status === 'attack' ? 'var(--color-accent)' : 
                   m.status === 'warning' ? 'var(--color-warning)' : 
                   m.status === 'success' ? 'var(--color-success)' : 'var(--text-primary)',
            lineHeight: '1.4',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}>
            [{m.time}] &lt;{name}&gt; {m.msg}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AttackSimulationHub;
