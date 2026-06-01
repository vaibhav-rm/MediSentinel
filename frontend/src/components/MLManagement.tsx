import React, { useState, useEffect, useRef } from 'react';
import { BrainCircuit, Cpu, Target, Shield, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';
import { useStore } from '../useStore';

const MLManagement: React.FC = () => {
  const { agentLogs, attackActive, toggleAttack, resetSimulation } = useStore();
  const [models, setModels] = useState<any[]>([]);
  const [robustness, setRobustness] = useState<any>({});
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  // Filter logs for Agent 2: IoT Guardian
  const myLogs = agentLogs.filter(log => log.agent_name === 'IoT Guardian');

  // Auto scroll logs
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [myLogs]);

  useEffect(() => {
    setModels([
      { id: 1, name: "Network LSTM", version: "v1.2.4", dataset: "CICIDS-2018", accuracy: 96.8, fpr: 1.4, last_retrained: "2026-04-25T10:00:00Z", status: "active" },
      { id: 2, name: "Isolation Forest", version: "v2.0.1", dataset: "NSL-KDD", accuracy: 95.2, fpr: 2.1, last_retrained: "2026-04-20T10:00:00Z", status: "active" },
      { id: 3, name: "IoT Autoencoder", version: "v1.0.0", dataset: "IoTID20", accuracy: 98.1, fpr: 0.8, last_retrained: "2026-04-28T14:30:00Z", status: "active" }
    ]);
    setRobustness({ evasion_resistance: 92, poisoning_resistance: 88, extraction_resistance: 95, overall_art_score: 91.6 });
  }, []);

  return (
    <div className="main-content">
      <div className="header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <BrainCircuit color="var(--color-primary)" />
            ML Model Management
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Configure neural autoencoders and threat sequencing classifiers.</p>
        </div>
      </div>

      {/* Interactive Simulation Switch Card */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px', border: attackActive ? '1px solid rgba(255,0,85,0.3)' : '1px solid rgba(0,255,136,0.2)', background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {attackActive ? <AlertTriangle color="var(--color-danger)" /> : <ShieldCheck color="var(--color-success)" />}
              Interactive Threat Simulation Control
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
              {attackActive 
                ? "Simulating spoofed telemetry payloads (High heart rate & anomalous SpO2) on IoT streams." 
                : "IoT device streams are normal, secure, and fully compliant."}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button 
              onClick={() => toggleAttack(!attackActive)}
              style={{
                background: attackActive ? 'var(--color-danger)' : 'var(--color-primary)',
                color: '#000',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              {attackActive ? "Stop Attack Simulation" : "Start Attack Simulation"}
            </button>
            <button 
              onClick={resetSimulation}
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                padding: '10px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RefreshCw size={16} /> Reset
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(0,243,255,0.1)', padding: '12px', borderRadius: '8px' }}>
            <Target size={24} color="var(--color-primary)" />
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Avg Accuracy</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
              {attackActive ? '94.1%' : '96.7%'}
            </div>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(255,0,85,0.1)', padding: '12px', borderRadius: '8px' }}>
            <Target size={24} color="var(--color-danger)" />
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Avg False Positive</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
              {attackActive ? '1.8%' : '1.4%'}
            </div>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(0,255,136,0.1)', padding: '12px', borderRadius: '8px' }}>
            <Cpu size={24} color="var(--color-success)" />
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>System CPU Overhead</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{attackActive ? '5.8%' : '2.4%'}</div>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(255,204,0,0.1)', padding: '12px', borderRadius: '8px' }}>
            <Shield size={24} color="var(--color-warning)" />
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>ART Robustness</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{robustness.overall_art_score}</div>
          </div>
        </div>
      </div>

      {/* IoT Guardian Agent Log Stream */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BrainCircuit size={18} color="var(--color-accent)" /> Agent 2: Deep Learning Autoencoder behavioral log
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
            <div style={{ color: 'var(--text-muted)' }}>&gt;_ Awaiting behavior sequence telemetry...</div>
          ) : (
            myLogs.map((log, i) => (
              <div key={i} style={{ marginBottom: '6px', color: log.status === 'anomaly' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
              </div>
            ))
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-primary)' }}>Model Registry</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Model Name</th>
              <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Version</th>
              <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Training Dataset</th>
              <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Accuracy</th>
              <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>FPR</th>
              <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Last Retrained</th>
            </tr>
          </thead>
          <tbody>
            {models.map(m => (
              <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '12px 8px', fontWeight: 'bold', color: 'var(--color-primary)' }}>{m.name}</td>
                <td style={{ padding: '12px 8px' }}>{m.version}</td>
                <td style={{ padding: '12px 8px', fontSize: '0.9rem' }}>{m.dataset}</td>
                <td style={{ padding: '12px 8px', color: 'var(--color-success)' }}>{m.accuracy}%</td>
                <td style={{ padding: '12px 8px', color: 'var(--color-danger)' }}>{m.fpr}%</td>
                <td style={{ padding: '12px 8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{new Date(m.last_retrained).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--text-primary)' }}>Adversarial Robustness (IBM ART)</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Evasion Resistance</span><span>{robustness.evasion_resistance}%</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Poisoning Resistance</span><span>{robustness.poisoning_resistance}%</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Extraction Resistance</span><span>{robustness.extraction_resistance}%</span></div>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--text-primary)' }}>Federated Learning Pipeline</h2>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            <p style={{ marginBottom: '8px' }}>Connected to 3 regional hospital nodes. Global weight aggregation occurs every 48 hours.</p>
            <button style={{ padding: '8px 16px', background: 'rgba(0,243,255,0.1)', border: '1px solid rgba(0,243,255,0.3)', color: 'var(--color-primary)', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Force Sync Weights
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MLManagement;
