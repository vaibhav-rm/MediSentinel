import React, { useEffect, useRef } from 'react';
import { Shield, CheckCircle, Clock, AlertTriangle, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useStore } from '../useStore';

const IncidentResponse: React.FC = () => {
  const { alerts, agentLogs, attackActive, forceQuarantine, escalateIncident } = useStore();
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  // Filter logs for this agent
  const myLogs = agentLogs.filter(log => log.agent_name === 'Incident Response');

  // Auto scroll logs
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [myLogs]);
  
  // Sort critical first
  const activeIncidents = [...alerts].filter(a => !a.is_resolved).sort((a, b) => {
    const sevScore: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    return (sevScore[b.severity] || 0) - (sevScore[a.severity] || 0);
  });

  const getContainmentAction = (alert: any) => {
    if (alert.severity === 'critical') return { action: 'Device Quarantined', status: 'Success', color: 'var(--color-success)' };
    if (alert.severity === 'high') return { action: 'Traffic Blocked', status: 'Pending Approval', color: 'var(--color-warning)' };
    return { action: 'Alert Logged', status: 'Completed', color: 'var(--text-muted)' };
  };

  return (
    <div className="main-content">
      <div className="header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Shield color="var(--color-primary)" />
            Incident Response Console
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Real-time automated incident containment and quarantine playbook execution.</p>
        </div>
        <div>
          {attackActive ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,0,85,0.15)', border: '1px solid var(--color-danger)', color: 'var(--color-danger)', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold' }}>
              <ShieldAlert size={18} /> THREAT MITIGATION ACTIVE
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,255,136,0.1)', border: '1px solid var(--color-success)', color: 'var(--color-success)', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold' }}>
              <ShieldCheck size={18} /> SHIELD PASSIVE MODE ACTIVE
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        
        {/* Active Incident Queue */}
        <div className="glass-panel" style={{ padding: '24px', height: '420px', overflowY: 'auto' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-primary)' }}>Active Incident Queue</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {activeIncidents.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px' }}>No active incidents.</div>
            ) : activeIncidents.map(incident => {
              const containment = getContainmentAction(incident);
              return (
                <div key={incident.id} style={{ 
                  background: 'rgba(255,255,255,0.02)', 
                  border: `1px solid ${incident.severity === 'critical' ? 'rgba(255,0,85,0.3)' : 'rgba(255,255,255,0.05)'}`,
                  borderRadius: '8px', padding: '16px' 
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{incident.device_id}</div>
                    <span className="live-badge" style={{ 
                      color: incident.severity === 'critical' ? 'var(--color-danger)' : 'var(--color-accent)' 
                    }}>
                      {incident.severity.toUpperCase()}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px' }}>{incident.description}</p>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={14} color="var(--text-muted)" />
                      <span style={{ color: 'var(--text-muted)' }}>{new Date(incident.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div style={{ color: containment.color, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {containment.status === 'Success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                      {containment.action} ({containment.status})
                    </div>
                  </div>
                  
                  {/* Manual Actions */}
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '8px' }}>
                    <button onClick={() => forceQuarantine(incident.device_id)} style={{ flex: 1, padding: '8px', background: 'rgba(255,0,85,0.1)', border: '1px solid rgba(255,0,85,0.3)', color: 'var(--color-danger)', borderRadius: '4px', cursor: 'pointer' }}>Force Quarantine</button>
                    <button onClick={() => escalateIncident(incident.id)} style={{ flex: 1, padding: '8px', background: 'rgba(0,243,255,0.1)', border: '1px solid rgba(0,243,255,0.3)', color: 'var(--color-primary)', borderRadius: '4px', cursor: 'pointer' }}>Escalate to CISO</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Playbooks & Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-primary)' }}>Autonomous Response Metrics</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', color: attackActive ? 'var(--color-accent)' : 'var(--color-success)', fontWeight: 'bold' }}>
                  {attackActive ? '1.8s' : '0s'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Response Quarantine Latency</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>
                  {attackActive ? '143' : '142'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Automated Actions (24h)</div>
              </div>
            </div>
          </div>
          
          <div className="glass-panel" style={{ padding: '24px', flexGrow: 1, height: '240px', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-primary)' }}>Containment Action Log</h2>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {attackActive && (
                <div style={{ padding: '12px', background: 'rgba(255,0,85,0.05)', borderRadius: '4px', borderLeft: '3px solid var(--color-danger)' }}>
                  <strong>Agent 4 (Incident Response)</strong> automatically quarantined device <strong>esp32-hr-sim-001</strong> following critical telemetry spoofing. (Justification: Policy ID 992)
                </div>
              )}
              <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', borderLeft: '3px solid var(--color-success)' }}>
                <strong>Agent 4</strong> automatically quarantined MED-ESP32-001 following Critical Autoencoder alert. (Justification: Policy ID 441)
              </div>
              <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', borderLeft: '3px solid var(--color-warning)' }}>
                <strong>Analyst Override:</strong> John Doe cancelled network block on 10.0.0.42. (Justification: Approved clinical data transfer)
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Incident Response Agent Logs */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={18} color="var(--color-primary)" /> Agent 4: Incident Response Playbook Log Stream
        </h2>
        <div style={{ 
          background: 'rgba(0,0,0,0.6)', 
          fontFamily: 'monospace', 
          fontSize: '0.85rem', 
          padding: '16px', 
          borderRadius: '8px', 
          border: '1px solid rgba(255,255,255,0.05)', 
          height: '180px', 
          overflowY: 'auto' 
        }}>
          {myLogs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>&gt;_ Awaiting playbook activation parameters...</div>
          ) : (
            myLogs.map((log, i) => (
              <div key={i} style={{ marginBottom: '6px', color: log.status === 'mitigated' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
              </div>
            ))
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
};

export default IncidentResponse;
