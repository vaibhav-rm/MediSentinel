import React, { useEffect, useRef } from 'react';
import { Shield, CheckCircle, Clock, AlertTriangle, ShieldAlert, ShieldCheck, Terminal, Server, Key, GitFork } from 'lucide-react';
import { useStore } from '../useStore';

const IncidentResponse: React.FC = () => {
  const { 
    alerts, 
    attackActive, 
    forceQuarantine, 
    escalateIncident,
    incidentMetrics,
    deviceMetrics,
    agent4Logs,
    attackType
  } = useStore();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll logs without page jump
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [agent4Logs]);
  
  const activeIncidents = [...alerts].filter(a => !a.is_resolved).sort((a, b) => {
    const sevScore: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    return (sevScore[b.severity] || 0) - (sevScore[a.severity] || 0);
  });

  return (
    <div className="main-content">
      {/* Header */}
      <div className="header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Shield color="var(--color-primary)" />
            Incident Response Console (Agent 4)
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Real-time playbook execution, automated firewall injection, and VLAN quarantine orchestration.</p>
        </div>
        <div>
          {attackActive ? (
            <div className="pulse-border" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,0,60,0.15)', border: '1px solid var(--color-accent)', color: 'var(--color-accent)', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold' }}>
              <ShieldAlert size={18} /> THREAT MITIGATION ACTIVE
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,255,136,0.1)', border: '1px solid var(--color-success)', color: 'var(--color-success)', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold' }}>
              <ShieldCheck size={18} /> POSTURE SECURE: SHIELD PASSIVE
            </div>
          )}
        </div>
      </div>

      {/* Autonomous Decisions Tree & Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Playbook Decision Tree Flow Visualizer */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GitFork size={18} color="var(--color-secondary)" /> Playbook Decision Flow Tree
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(0,0,0,0.5)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
            {/* Step 1 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', borderRadius: '6px', background: attackActive ? 'rgba(189, 0, 255, 0.1)' : 'rgba(255,255,255,0.02)', border: attackActive ? '1px solid var(--color-secondary)' : '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>STEP 1: METRIC DEVIATION CHECK</span>
                <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>LSTM Sequence Entropy Threshold &gt; 0.85</div>
              </div>
              <span style={{ fontSize: '0.8rem', color: attackActive ? 'var(--color-secondary)' : 'var(--text-muted)' }}>
                {attackActive ? 'TRUE (Entropy: 0.92)' : 'FALSE'}
              </span>
            </div>

            {/* Down Arrow */}
            <div style={{ textAlign: 'center', fontSize: '1rem', color: attackActive ? 'var(--color-secondary)' : 'var(--text-muted)', height: '12px', lineHeight: '12px' }}>▼</div>

            {/* Step 2 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', borderRadius: '6px', background: attackActive && incidentMetrics.decisionTree.iocMatch ? 'rgba(255, 184, 0, 0.1)' : 'rgba(255,255,255,0.02)', border: attackActive && incidentMetrics.decisionTree.iocMatch ? '1px solid var(--color-warning)' : '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>STEP 2: CORRELATION SCAN</span>
                <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>STIX/TAXII Threat Feed IOC Matching IP/Hash</div>
              </div>
              <span style={{ fontSize: '0.8rem', color: attackActive && incidentMetrics.decisionTree.iocMatch ? 'var(--color-warning)' : 'var(--text-muted)' }}>
                {attackActive && incidentMetrics.decisionTree.iocMatch ? 'IOC MATCHED' : 'AWAITING'}
              </span>
            </div>

            {/* Down Arrow */}
            <div style={{ textAlign: 'center', fontSize: '1rem', color: attackActive && incidentMetrics.decisionTree.iocMatch ? 'var(--color-warning)' : 'var(--text-muted)', height: '12px', lineHeight: '12px' }}>▼</div>

            {/* Step 3 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', borderRadius: '6px', background: attackActive && incidentMetrics.decisionTree.containmentProtocol === 'EXECUTED' ? 'rgba(255, 0, 60, 0.15)' : 'rgba(255,255,255,0.02)', border: attackActive && incidentMetrics.decisionTree.containmentProtocol === 'EXECUTED' ? '1px solid var(--color-accent)' : '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>STEP 3: CONTAINMENT ENFORCEMENT</span>
                <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>VLAN Isolation & Device Interface Quarantine</div>
              </div>
              <span style={{ fontSize: '0.8rem', color: attackActive && incidentMetrics.decisionTree.containmentProtocol === 'EXECUTED' ? 'var(--color-accent)' : 'var(--text-muted)', fontWeight: 'bold' }}>
                {attackActive && incidentMetrics.decisionTree.containmentProtocol === 'EXECUTED' ? 'ENFORCED' : 'INACTIVE'}
              </span>
            </div>
          </div>
        </div>

        {/* Real-time Incident response statistics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-primary)' }}>Playbook Execution Stats</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ background: 'rgba(7,7,10,0.5)', padding: '16px', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '2rem', color: attackActive ? 'var(--color-accent)' : 'var(--color-success)', fontWeight: 'bold', fontFamily: 'monospace' }}>
                  {attackActive ? '1.24s' : '0.00s'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Autonomous Quarantine Time</div>
              </div>
              <div style={{ background: 'rgba(7,7,10,0.5)', padding: '16px', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '2rem', color: 'var(--color-primary)', fontWeight: 'bold', fontFamily: 'monospace' }}>
                  {attackActive ? '43' : '42'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Mitigated Incidents (24h)</div>
              </div>
            </div>
          </div>

          {/* Active firewall rules display */}
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Server size={14} color="var(--color-primary)" /> Enforced Firewall Rule
            </div>
            <div style={{ background: 'rgba(0,0,0,0.5)', fontFamily: 'monospace', padding: '10px', borderRadius: '6px', fontSize: '0.8rem', color: attackActive ? 'var(--color-accent)' : 'var(--color-success)', border: '1px solid rgba(255,255,255,0.05)' }}>
              {incidentMetrics.firewallRuleExecution}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Active Incident Queue */}
        <div className="glass-panel" style={{ padding: '24px', height: '360px', overflowY: 'auto' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-primary)' }}>Active Incident Queue</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {!attackActive ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '60px' }}>
                <CheckCircle size={32} color="var(--color-success)" style={{ margin: '0 auto 12px', display: 'block', opacity: 0.6 }} />
                No active threats detected. Network secure.
              </div>
            ) : (
              <div style={{ 
                background: 'rgba(255,255,255,0.02)', 
                border: '1px solid rgba(255,0,85,0.3)',
                borderRadius: '8px', padding: '16px' 
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem', fontFamily: 'monospace' }}>esp32-hr-sim-001</div>
                  <span className="live-badge" style={{ color: 'var(--color-accent)', border: '1px solid var(--color-accent)' }}>
                    CRITICAL
                  </span>
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Device telemetry spoofing of heart rate ({deviceMetrics.heartRate} BPM) violates clinical bounds. Outbound beacon to C2 server detected.
                </p>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={14} color="var(--text-muted)" />
                    <span style={{ color: 'var(--text-muted)' }}>{new Date().toLocaleTimeString()}</span>
                  </div>
                  <div style={{ color: incidentMetrics.decisionTree.containmentProtocol === 'EXECUTED' ? 'var(--color-success)' : 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {incidentMetrics.decisionTree.containmentProtocol === 'EXECUTED' ? '✓ Playbook Deployed' : '● Mitigating...'}
                  </div>
                </div>
                
                {/* Manual Actions */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => forceQuarantine('esp32-hr-sim-001')} style={{ flex: 1, padding: '8px', background: 'rgba(255,0,60,0.1)', border: '1px solid rgba(255,0,60,0.3)', color: 'var(--color-accent)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>Enforce Quarantine</button>
                  <button onClick={() => escalateIncident(442)} style={{ flex: 1, padding: '8px', background: 'rgba(0,243,255,0.1)', border: '1px solid rgba(0,243,255,0.3)', color: 'var(--color-primary)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>Escalate Alert</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live Quarantine containment timeline */}
        <div className="glass-panel" style={{ padding: '24px', height: '360px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-primary)' }}>Containment Timeline</h2>
          <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
            {!attackActive ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '60px' }}>Awaiting incident escalation to generate timeline...</div>
            ) : (
              incidentMetrics.containmentTimeline.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-accent)', boxShadow: '0 0 8px var(--color-accent)' }}></div>
                    {idx < incidentMetrics.containmentTimeline.length - 1 && <div style={{ width: '2px', flexGrow: 1, backgroundColor: 'rgba(255,255,255,0.1)' }}></div>}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{item.action}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.time} | status: {item.status}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Incident Response Agent Logs */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal size={18} color="var(--color-primary)" /> Agent 4: Incident Response Orchestration Logs
        </h2>
        <div ref={scrollRef} style={{ 
          background: 'rgba(7,7,10,0.85)', 
          fontFamily: 'monospace', 
          fontSize: '0.85rem', 
          padding: '16px', 
          borderRadius: '8px', 
          border: '1px solid rgba(255,255,255,0.05)', 
          height: '180px', 
          overflowY: 'auto' 
        }}>
          {agent4Logs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>&gt;_ Playbooks armed. Awaiting alert propagation from Agent 3 (Threat Intel)...</div>
          ) : (
            agent4Logs.map((msg, i) => (
              <div key={i} style={{ marginBottom: '6px', color: msg.status === 'anomaly' || msg.status === 'attack' ? 'var(--color-accent)' : msg.status === 'warning' ? 'var(--color-warning)' : 'var(--color-success)' }}>
                [{msg.time}] &lt;{msg.agent}&gt; {msg.msg}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default IncidentResponse;
