import React, { useRef } from 'react';
import { ShieldAlert, Play, Square, RotateCcw, FileJson, Cpu, Network, Activity, Shield, FileCheck, Terminal } from 'lucide-react';
import { useStore } from '../useStore';

const AttackSimulationHub: React.FC = () => {
  const { devices, agentLogs, attackActive, toggleAttack, resetSimulation } = useStore();
  const fileDownloadRef = useRef<HTMLAnchorElement>(null);

  // Filter logs by agent
  const getAgentLogs = (agentName: string) => {
    return agentLogs
      .filter(log => log.agent_name === agentName)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  // Get status color based on current attack and agent logs
  const getAgentStatus = (agentName: string) => {
    const logs = getAgentLogs(agentName);
    if (!attackActive) return { text: 'MONITORING', color: 'var(--color-success)', glow: '0 0 10px var(--color-success)' };
    
    const latestLog = logs[0];
    if (latestLog && (latestLog.status === 'anomaly' || latestLog.status === 'mitigated' || latestLog.status === 'logged')) {
      if (agentName === 'IncidentResponse') {
        return { text: 'MITIGATED', color: 'var(--color-primary)', glow: '0 0 10px var(--color-primary)' };
      }
      return { text: 'THREAT DETECTED', color: 'var(--color-danger)', glow: '0 0 10px var(--color-danger)' };
    }
    
    return { text: 'PROCESSING', color: 'var(--color-accent)', glow: '0 0 10px var(--color-accent)' };
  };

  // Export logs to JSON
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(agentLogs, null, 2));
    if (fileDownloadRef.current) {
      fileDownloadRef.current.setAttribute("href", dataStr);
      fileDownloadRef.current.setAttribute("download", `medisentinel_simulation_audit_${Date.now()}.json`);
      fileDownloadRef.current.click();
    }
  };

  const activeDevice = devices.find(d => d.device_id === 'esp32-hr-sim-001');

  return (
    <div className="main-content">
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ShieldAlert color="var(--color-accent)" size={32} />
            Attack Simulation & Threat Prevention Hub
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Trigger interactive telemetry injection and observe the multi-agent defense loop.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={handleExportJSON}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            disabled={agentLogs.length === 0}
          >
            <FileJson size={16} /> Export Logs (JSON)
          </button>
          <a ref={fileDownloadRef} style={{ display: 'none' }} />
          <button 
            onClick={resetSimulation}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            <RotateCcw size={16} /> Reset Stack
          </button>
        </div>
      </div>

      {/* Control Panel Card */}
      <div className="glass-panel" style={{ 
        padding: '24px', 
        marginBottom: '24px', 
        border: attackActive ? '1px solid rgba(255, 0, 85, 0.4)' : '1px solid rgba(0, 243, 255, 0.1)',
        boxShadow: attackActive ? '0 0 25px rgba(255, 0, 85, 0.15)' : '0 0 15px rgba(0, 243, 255, 0.05)',
        transition: 'all 0.4s ease'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', margin: '0 0 8px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              Simulation Status: {attackActive ? (
                <span style={{ color: 'var(--color-danger)', fontWeight: 'bold', textShadow: '0 0 8px rgba(255,0,85,0.4)' }}>ACTIVE ATTACK RUNNING</span>
              ) : (
                <span style={{ color: 'var(--color-success)' }}>NORMAL / SECURE DATA STREAM</span>
              )}
            </h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Target Device: <strong style={{ color: 'var(--text-primary)' }}>esp32-hr-sim-001</strong> | 
              Device Status: <span style={{ color: activeDevice?.status === 'quarantined' ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: 'bold' }}>{activeDevice?.status?.toUpperCase() || 'OFFLINE'}</span>
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '1rem', fontWeight: 600, color: attackActive ? 'var(--color-danger)' : 'var(--text-muted)' }}>
              {attackActive ? 'Stop Attack Simulation' : 'Inject Telemetry Attack'}
            </span>
            <button
              onClick={() => toggleAttack(!attackActive)}
              style={{
                width: '60px',
                height: '32px',
                borderRadius: '16px',
                backgroundColor: attackActive ? 'var(--color-danger)' : 'rgba(255,255,255,0.1)',
                border: 'none',
                position: 'relative',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: attackActive ? '0 0 15px var(--color-danger)' : 'none'
              }}
            >
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: '#fff',
                position: 'absolute',
                top: '4px',
                left: attackActive ? '32px' : '4px',
                transition: 'all 0.3s ease'
              }} />
            </button>
          </div>
        </div>

        {/* Vital stats during attack simulation */}
        {activeDevice?.metadata_json && (
          <div style={{ display: 'flex', gap: '24px', marginTop: '20px', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Live Heart Rate:</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: activeDevice.metadata_json.heart_rate > 150 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                {activeDevice.metadata_json.heart_rate} BPM
              </div>
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Live SpO2 Level:</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: activeDevice.metadata_json.spo2 < 90 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                {activeDevice.metadata_json.spo2}%
              </div>
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Packet Rate:</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: activeDevice.metadata_json.network?.packet_rate > 50 ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                {activeDevice.metadata_json.network?.packet_rate || 0} pkts/s
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grid of the 5 Security Agents */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* Agent 1: Network Monitor */}
        <AgentCard 
          name="Network Monitor"
          icon={<Network size={20} />}
          role="Monitors all inbound/outbound traffic for anomalies and known attack signatures"
          technique="LSTM + Isolation Forest"
          status={getAgentStatus("Network Monitor")}
          logs={getAgentLogs("Network Monitor")}
        />

        {/* Agent 2: IoT Guardian */}
        <AgentCard 
          name="IoT Guardian"
          icon={<Cpu size={20} />}
          role="Tracks Medical IoT device behavior, flags unusual command patterns or firmware changes"
          technique="Autoencoder + Rule Engine"
          status={getAgentStatus("IoT Guardian")}
          logs={getAgentLogs("IoT Guardian")}
        />

        {/* Agent 3: Threat Intelligence */}
        <AgentCard 
          name="Threat Intelligence"
          icon={<Activity size={20} />}
          role="Continuously ingests external threat feeds and updates local threat signatures"
          technique="NLP + STIX/TAXII Feeds"
          status={getAgentStatus("Threat Intelligence")}
          logs={getAgentLogs("Threat Intelligence")}
        />

        {/* Agent 4: Incident Response */}
        <AgentCard 
          name="Incident Response"
          icon={<Shield size={20} />}
          role="Executes autonomous containment — quarantine, block, alert, backup trigger"
          technique="Decision Tree + Policy Engine"
          status={getAgentStatus("Incident Response")}
          logs={getAgentLogs("Incident Response")}
        />

        {/* Agent 5: Compliance Audit */}
        <AgentCard 
          name="Compliance Audit"
          icon={<FileCheck size={20} />}
          role="Maintains logs, generates HIPAA-compliant audit trails, flags policy violations"
          technique="Log Parser + Report Generator"
          status={getAgentStatus("Compliance Audit")}
          logs={getAgentLogs("Compliance Audit")}
        />

      </div>
    </div>
  );
};

// Internal AgentCard Helper Component
interface AgentCardProps {
  name: string;
  icon: React.ReactNode;
  technique: string;
  status: { text: string; color: string; glow: string };
  logs: any[];
}

const AgentCard: React.FC<AgentCardProps> = ({ name, icon, technique, status, logs }) => {
  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '420px', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ color: 'var(--color-primary)' }}>{icon}</div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{name}</h3>
        </div>
        <span style={{ 
          fontSize: '0.75rem', 
          fontWeight: 'bold', 
          color: status.color, 
          border: `1px solid ${status.color}`, 
          padding: '2px 8px', 
          borderRadius: '4px',
          boxShadow: status.glow
        }}>
          {status.text}
        </span>
      </div>
      
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
        <strong>Model:</strong> {technique}
      </div>

      <div style={{ 
        flexGrow: 1, 
        backgroundColor: 'rgba(0,0,0,0.3)', 
        borderRadius: '8px', 
        padding: '12px', 
        overflowY: 'auto',
        fontFamily: 'Courier New, monospace',
        fontSize: '0.8rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        border: '1px solid rgba(255,255,255,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-primary)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px', marginBottom: '4px' }}>
          <Terminal size={12} />
          <span>Real-time Operations Log</span>
        </div>
        {logs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '50px' }}>
            Listening for event telemetry...
          </div>
        ) : (
          logs.map((log, idx) => (
            <div key={idx} style={{ 
              color: log.status === 'anomaly' || log.status === 'mitigated' ? 'var(--color-danger)' : 'var(--text-primary)',
              lineHeight: 1.4,
              borderLeft: `2px solid ${log.status === 'anomaly' || log.status === 'mitigated' ? 'var(--color-danger)' : 'var(--color-primary)'}`,
              paddingLeft: '8px'
            }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginRight: '4px' }}>
                [{new Date(log.timestamp).toLocaleTimeString()}]
              </span>
              {log.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AttackSimulationHub;
