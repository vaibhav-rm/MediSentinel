import React from 'react';
import { Activity, ShieldAlert, Cpu, HardDrive, Clock, FileCheck, Shield, CheckCircle, BellRing } from 'lucide-react';
import { useStore } from '../useStore';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

const Dashboard = () => {
  const { 
    alerts, 
    attackActive, 
    globalMetrics, 
    collabMessages, 
    networkMetrics,
    deviceMetrics
  } = useStore();

  const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !a.is_resolved);
  
  // Rolling timeline based on network metrics history
  const timelineData = networkMetrics.trafficHistory.length > 0 
    ? networkMetrics.trafficHistory.map((h, i) => ({ idx: i, packets: h.packets }))
    : Array.from({length: 20}, (_, i) => ({ idx: i, packets: 15 + Math.floor(Math.random() * 8) }));

  return (
    <div className="main-content">
      {/* Header Panel */}
      <div className="header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Global Security Posture</h1>
          <p style={{ color: 'var(--text-muted)' }}>AI-driven cybersecurity state machine monitoring critical healthcare systems.</p>
        </div>
        <div>
          <span className="live-badge" style={{ 
            fontSize: '1rem', 
            padding: '8px 16px', 
            borderRadius: '6px', 
            fontWeight: 'bold',
            color: globalMetrics.threatLevel === 'SAFE' ? 'var(--color-success)' : 
                   globalMetrics.threatLevel === 'SUSPICIOUS' ? 'var(--color-warning)' : 'var(--color-accent)',
            border: `1px solid ${
              globalMetrics.threatLevel === 'SAFE' ? 'var(--color-success)' : 
              globalMetrics.threatLevel === 'SUSPICIOUS' ? 'var(--color-warning)' : 'var(--color-accent)'
            }`,
            animation: attackActive ? 'pulse 1s infinite alternate' : 'none'
          }}>
            <span className="live-dot" style={{ 
              backgroundColor: globalMetrics.threatLevel === 'SAFE' ? 'var(--color-success)' : 
                             globalMetrics.threatLevel === 'SUSPICIOUS' ? 'var(--color-warning)' : 'var(--color-accent)' 
            }}></span>
            SYSTEM STATE: {globalMetrics.threatLevel}
          </span>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="glass-panel stat-card" style={{ borderLeft: '3px solid var(--color-accent)' }}>
          <div className="stat-title"><ShieldAlert size={16} /> Active Threats</div>
          <div className="stat-value" style={{ color: attackActive ? 'var(--color-accent)' : 'var(--text-main)' }}>
            {globalMetrics.activeAttackCount}
          </div>
          <div className="stat-trend" style={{ color: 'var(--text-muted)' }}>
            {attackActive ? '▲ Malicious payloads running' : '● No active attacks'}
          </div>
        </div>

        <div className="glass-panel stat-card" style={{ borderLeft: '3px solid var(--color-primary)' }}>
          <div className="stat-title"><Clock size={16} /> Detection Latency</div>
          <div className="stat-value" style={{ color: 'var(--color-primary)' }}>
            {attackActive ? '1.14s' : '0.00s'}
          </div>
          <div className="stat-trend trend-up">
            ▲ Real-time ingestion
          </div>
        </div>

        <div className="glass-panel stat-card" style={{ borderLeft: '3px solid var(--color-secondary)' }}>
          <div className="stat-title"><Activity size={16} /> Autonomous Actions</div>
          <div className="stat-value" style={{ color: 'var(--color-secondary)' }}>
            {globalMetrics.autonomousActionsCount}
          </div>
          <div className="stat-trend" style={{ color: 'var(--color-success)' }}>
            {attackActive ? '▲ Playbook quarantined' : '● Policies active'}
          </div>
        </div>

        <div className="glass-panel stat-card" style={{ borderLeft: '3px solid var(--color-success)' }}>
          <div className="stat-title"><FileCheck size={16} /> HIPAA Score</div>
          <div className="stat-value" style={{ color: 'var(--color-success)' }}>
            {attackActive ? '94%' : '98%'}
          </div>
          <div className="stat-trend" style={{ color: 'var(--color-success)' }}>
            ● Immutable block locked
          </div>
        </div>
      </div>

      {/* Agents Health Banner */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        {[
          { name: 'Agent 1: Network LSTM', status: attackActive && networkMetrics.packetRate === 0 ? 'Muted' : 'Healthy', ping: '12ms', color: attackActive && networkMetrics.packetRate === 0 ? 'var(--text-muted)' : 'var(--color-success)' },
          { name: 'Agent 2: IoT Autoencoder', status: attackActive && deviceMetrics.reconstructionLoss > 0.5 ? 'Alerting' : 'Healthy', ping: '8ms', color: attackActive && deviceMetrics.reconstructionLoss > 0.5 ? 'var(--color-accent)' : 'var(--color-success)' },
          { name: 'Agent 3: Threat Ingest', status: attackActive ? 'Active' : 'Healthy', ping: '45ms', color: 'var(--color-success)' },
          { name: 'Agent 4: Incident IR', status: attackActive ? 'Mitigating' : 'Active', ping: '5ms', color: attackActive ? 'var(--color-accent)' : 'var(--color-success)' },
          { name: 'Agent 5: Compliance Ledger', status: attackActive ? 'Signing Block' : 'Healthy', ping: '2ms', color: 'var(--color-success)' }
        ].map((agent, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: agent.color, boxShadow: `0 0 8px ${agent.color}`, animation: agent.status === 'Alerting' || agent.status === 'Mitigating' ? 'pulse 0.8s infinite alternate' : 'none' }}></div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{agent.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{agent.status} • {agent.ping}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Content Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Main Chart */}
          <div className="glass-panel" style={{ padding: '24px', height: '260px' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-primary)' }}>Rolling Cyber Threat Timeline</h2>
            <div style={{ height: '80%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData}>
                  <YAxis hide domain={[0, 'dataMax + 10']} />
                  <Line type="monotone" dataKey="packets" stroke={attackActive ? 'var(--color-accent)' : 'var(--color-primary)'} strokeWidth={3} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* System Performance Overview */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-primary)' }}>Agent Processing Metrics</h2>
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <Cpu size={32} color="var(--color-primary)" style={{ marginBottom: '8px' }} />
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'monospace' }}>
                  {attackActive ? '8.4%' : '2.1%'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pipeline CPU</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <HardDrive size={32} color="var(--color-primary)" style={{ marginBottom: '8px' }} />
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'monospace' }}>
                  {attackActive ? '18.9%' : '14.2%'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>JVM Heap</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <Activity size={32} color="var(--color-primary)" style={{ marginBottom: '8px' }} />
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'monospace' }}>
                  {attackActive ? '1,240 msg/s' : '415 msg/s'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Kafka Ingress</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right side: Multi-agent logical correlation feed */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '420px' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BellRing color="var(--color-accent)" size={20} /> Multi-Agent Correlation
          </h2>
          
          <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {collabMessages.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '60px', fontSize: '0.9rem' }}>
                <CheckCircle size={32} color="var(--color-success)" style={{ margin: '0 auto 12px', display: 'block', opacity: 0.5 }} />
                AI agents idling. Baselines secure.
              </div>
            ) : (
              collabMessages.map((msg, i) => (
                <div key={i} style={{ 
                  background: 'rgba(255,255,255,0.01)', 
                  border: '1px solid rgba(255,255,255,0.05)', 
                  borderRadius: '6px', 
                  padding: '10px',
                  fontSize: '0.8rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontWeight: 'bold' }}>
                    <span style={{ 
                      color: msg.status === 'attack' ? 'var(--color-accent)' : 
                             msg.status === 'warning' ? 'var(--color-warning)' : 'var(--color-success)'
                    }}>
                      {msg.agent.toUpperCase()}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>{msg.time}</span>
                  </div>
                  <div style={{ color: 'var(--text-main)' }}>{msg.msg}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
