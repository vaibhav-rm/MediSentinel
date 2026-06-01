import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, ShieldAlert, Globe, ShieldCheck } from 'lucide-react';
import { useStore } from '../useStore';

const NetworkMonitor: React.FC = () => {
  const { alerts, agentLogs, attackActive } = useStore();
  const [data, setData] = useState<any[]>([]);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  // Filter logs for this agent
  const myLogs = agentLogs.filter(log => log.agent_name === 'Network Monitor');

  // Auto scroll logs
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [myLogs]);

  // Seed initial chart data
  useEffect(() => {
    const initialData = Array.from({ length: 20 }, (_, i) => ({
      time: new Date(Date.now() - (20 - i) * 1000).toLocaleTimeString(),
      packets: Math.floor(Math.random() * 20) + 10,
    }));
    setData(initialData);
  }, []);

  // Update chart data periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setData(prev => {
        const basePackets = attackActive 
          ? Math.floor(Math.random() * 40) + 110 // attack spike 110-150 pkts/s
          : Math.floor(Math.random() * 25) + 10; // normal 10-35 pkts/s
        
        const newArr = [...prev.slice(1), {
          time: new Date().toLocaleTimeString(),
          packets: basePackets
        }];
        return newArr;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [attackActive]);

  const networkAlerts = alerts.filter(a => a.type.toLowerCase().includes('network'));

  return (
    <div className="main-content">
      <div className="header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity color="var(--color-primary)" />
            Network Monitor Panel
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>AI-Powered packet inspection and anomaly sequencing.</p>
        </div>
        <div>
          {attackActive ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,0,85,0.15)', border: '1px solid var(--color-danger)', color: 'var(--color-danger)', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold' }}>
              <ShieldAlert size={18} /> INTRUSION SIMULATION ACTIVE
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,255,136,0.1)', border: '1px solid var(--color-success)', color: 'var(--color-success)', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold' }}>
              <ShieldCheck size={18} /> NETWORK TRAFFIC SECURE
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div className="glass-panel" style={{ padding: '24px', height: '350px' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-primary)' }}>Live Traffic (Packets/sec)</h2>
          <ResponsiveContainer width="100%" height="80%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="time" stroke="var(--text-muted)" tick={{fill: 'var(--text-muted)'}} />
              <YAxis stroke="var(--text-muted)" tick={{fill: 'var(--text-muted)'}} />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid var(--color-primary)' }} />
              <Line type="monotone" dataKey="packets" stroke={attackActive ? 'var(--color-danger)' : 'var(--color-primary)'} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe color="var(--color-accent)" /> Geographic IP Map
          </h2>
          <div style={{ background: 'rgba(0,0,0,0.3)', height: '170px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
            <p style={{ color: 'var(--text-muted)' }}>Map visualization active</p>
          </div>
          <div style={{ marginTop: '16px', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>45.33.32.156</span>
              <span style={{ color: attackActive ? 'var(--color-danger)' : 'var(--color-accent)', fontWeight: attackActive ? 'bold' : 'normal' }}>
                {attackActive ? 'C2 Beacon (Active)' : 'C2 Beacon (Idle)'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>104.21.14.99</span>
              <span style={{ color: 'var(--text-muted)' }}>Data Sync (Internal)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Network Monitor Agent Operations Log */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} color="var(--color-primary)" /> Agent 1: Isolation Forest & LSTM Log Stream
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
            <div style={{ color: 'var(--text-muted)' }}>&gt;_ Awaiting network traffic sequence analysis...</div>
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

      <div className="glass-panel" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-primary)' }}>Detected Anomalies</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Timestamp</th>
              <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Source</th>
              <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Type</th>
              <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Severity</th>
              <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>AI Confidence</th>
            </tr>
          </thead>
          <tbody>
            {networkAlerts.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No network anomalies detected.</td>
              </tr>
            ) : networkAlerts.map(alert => (
              <tr key={alert.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '12px 8px', fontSize: '0.9rem' }}>{new Date(alert.timestamp).toLocaleTimeString()}</td>
                <td style={{ padding: '12px 8px', fontSize: '0.9rem' }}>{alert.device_id}</td>
                <td style={{ padding: '12px 8px', fontSize: '0.9rem' }}>{alert.type}</td>
                <td style={{ padding: '12px 8px' }}>
                  <span className={`live-badge`} style={{ 
                    color: alert.severity === 'critical' ? 'var(--color-danger)' : 
                           alert.severity === 'high' ? 'var(--color-accent)' : 'var(--color-warning)'
                  }}>
                    {alert.severity.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: '12px 8px', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ background: 'rgba(0, 243, 255, 0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(0, 243, 255, 0.3)' }}>LSTM: {Math.floor(Math.random() * 5) + 94}%</div>
                    <div style={{ background: 'rgba(255, 0, 85, 0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255, 0, 85, 0.3)' }}>iForest: Yes</div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default NetworkMonitor;
