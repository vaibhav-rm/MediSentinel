import React, { useState, useEffect, useRef } from 'react';
import { BrainCircuit, Cpu, Target, Shield, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';
import { useStore } from '../useStore';

const MLManagement: React.FC = () => {
  const { agent2Logs, attackActive, toggleAttack, resetSimulation } = useStore();
  const [models, setModels] = useState<any[]>([]);
  const [robustness, setRobustness] = useState<any>({});
  const terminalContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (terminalContainerRef.current) {
      terminalContainerRef.current.scrollTop = terminalContainerRef.current.scrollHeight;
    }
  }, [agent2Logs]);

  useEffect(() => {
    setModels([
      { id: 1, name: "Network LSTM", version: "v1.2.4", dataset: "CICIDS-2018", accuracy: 96.8, fpr: 1.4, last_retrained: new Date().toISOString(), status: "active" },
      { id: 2, name: "Isolation Forest", version: "v2.0.1", dataset: "NSL-KDD", accuracy: 95.2, fpr: 2.1, last_retrained: new Date().toISOString(), status: "active" },
      { id: 3, name: "IoT Autoencoder", version: "v1.0.0", dataset: "IoTID20", accuracy: 98.1, fpr: 0.8, last_retrained: new Date().toISOString(), status: "active" }
    ]);
    setRobustness({ evasion_resistance: 92, poisoning_resistance: 88, extraction_resistance: 95, overall_art_score: 91.6 });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setModels(prev => prev.map(m => {
        const accShift = (Math.random() - 0.5) * 0.4;
        const fprShift = (Math.random() - 0.5) * 0.1;
        return {
          ...m,
          accuracy: attackActive 
            ? Math.max(80, m.accuracy - Math.abs(accShift) * 5).toFixed(2) 
            : Math.min(99.9, m.accuracy + accShift).toFixed(2),
          fpr: attackActive 
            ? Math.min(10, m.fpr + Math.abs(fprShift) * 2).toFixed(2) 
            : Math.max(0.1, m.fpr + fprShift).toFixed(2),
          last_retrained: new Date().toISOString()
        };
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, [attackActive]);

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
        <div ref={terminalContainerRef} style={{ 
          background: 'rgba(0,0,0,0.6)', 
          fontFamily: 'monospace', 
          fontSize: '0.85rem', 
          padding: '16px', 
          borderRadius: '8px', 
          border: '1px solid rgba(255,255,255,0.05)', 
          height: '180px', 
          overflowY: 'auto',
          scrollBehavior: 'smooth'
        }}>
          {agent2Logs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>&gt;_ Awaiting behavior sequence telemetry...</div>
          ) : (
            agent2Logs.map((log, i) => (
              <div key={i} style={{ marginBottom: '6px', color: log.status === 'anomaly' ? 'var(--color-danger)' : log.status === 'success' ? 'var(--color-success)' : log.status === 'attack' ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                [{log.time}] {log.msg}
              </div>
            ))
          )}
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
                <td style={{ padding: '12px 8px', color: 'var(--color-success)' }}>{Number(m.accuracy).toFixed(1)}%</td>
                <td style={{ padding: '12px 8px', color: 'var(--color-danger)' }}>{Number(m.fpr).toFixed(1)}%</td>
                <td style={{ padding: '12px 8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{new Date(m.last_retrained).toLocaleTimeString()}</td>
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
