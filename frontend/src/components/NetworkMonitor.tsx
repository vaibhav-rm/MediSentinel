import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, ShieldAlert, Globe, ShieldCheck, Terminal, Server, AlertTriangle } from 'lucide-react';
import { useStore } from '../useStore';

const NetworkMonitor: React.FC = () => {
  const { 
    alerts, 
    attackActive, 
    networkMetrics, 
    agent1Logs,
    attackType
  } = useStore();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll logs without page jump
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [agent1Logs]);

  const networkAlerts = alerts.filter(a => a.type.toLowerCase().includes('network') || a.severity === 'critical');

  return (
    <div className="main-content">
      {/* Header Panel */}
      <div className="header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity color="var(--color-primary)" />
            Network Monitor Panel
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>AI-Powered packet entropy inspection and LSTM sequence matching.</p>
        </div>
        <div>
          {attackActive ? (
            <div className="pulse-border" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,0,60,0.15)', border: '1px solid var(--color-accent)', color: 'var(--color-accent)', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold' }}>
              <ShieldAlert size={18} /> THREAT DETECTED: {attackType.replace('_', ' ').toUpperCase()}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,255,136,0.1)', border: '1px solid var(--color-success)', color: 'var(--color-success)', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold' }}>
              <ShieldCheck size={18} /> SECURITY POSTURE: SAFE
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Key Performance Metrics */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="glass-panel stat-card" style={{ borderLeft: attackActive ? '3px solid var(--color-accent)' : '3px solid var(--color-primary)' }}>
          <div className="stat-title"><Server size={16} /> Packet Ingestion Rate</div>
          <div className="stat-value" style={{ color: attackActive ? 'var(--color-accent)' : 'var(--color-primary)' }}>
            {networkMetrics.packetRate} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>pkts/sec</span>
          </div>
          <div className="stat-trend trend-up">
            {attackActive ? '▲ Traffic Surge Detected' : '● Baseline Stable'}
          </div>
        </div>

        <div className="glass-panel stat-card" style={{ borderLeft: '3px solid var(--color-secondary)' }}>
          <div className="stat-title"><Activity size={16} /> Packet Entropy Score</div>
          <div className="stat-value" style={{ color: networkMetrics.entropyScore > 0.6 ? 'var(--color-accent)' : 'var(--text-main)' }}>
            {networkMetrics.entropyScore.toFixed(3)}
          </div>
          <div className="stat-trend" style={{ color: networkMetrics.entropyScore > 0.6 ? 'var(--color-accent)' : 'var(--color-success)' }}>
            {networkMetrics.entropyScore > 0.6 ? '▲ Anomaly: High Randomness' : '● Uniform Entropy'}
          </div>
        </div>

        <div className="glass-panel stat-card" style={{ borderLeft: '3px solid var(--color-warning)' }}>
          <div className="stat-title"><AlertTriangle size={16} /> LSTM Sequence Mismatch</div>
          <div className="stat-value" style={{ color: networkMetrics.sequenceMismatch > 0.5 ? 'var(--color-warning)' : 'var(--text-main)' }}>
            {(networkMetrics.sequenceMismatch * 100).toFixed(1)}%
          </div>
          <div className="stat-trend" style={{ color: networkMetrics.sequenceMismatch > 0.5 ? 'var(--color-warning)' : 'var(--color-success)' }}>
            {networkMetrics.sequenceMismatch > 0.5 ? '▲ Drift Detected' : '● Sequence Matched'}
          </div>
        </div>

        <div className="glass-panel stat-card" style={{ borderLeft: '3px solid var(--color-success)' }}>
          <div className="stat-title"><Globe size={16} /> Lateral Movement Risk</div>
          <div className="stat-value">
            {networkMetrics.lateralMovementConfidence}%
          </div>
          <div className="stat-trend" style={{ color: networkMetrics.lateralMovementConfidence > 50 ? 'var(--color-accent)' : 'var(--color-success)' }}>
            {networkMetrics.lateralMovementConfidence > 50 ? '▲ East-West Propagation' : '● Confined Node'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Main Chart Card */}
        <div className="glass-panel" style={{ padding: '24px', height: '380px' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Live AI Telemetry Sequencing</span>
            {attackActive && <span style={{ fontSize: '0.8rem', color: 'var(--color-accent)', animation: 'pulse 1s infinite alternate' }}>● Real-time Attack Flow</span>}
          </h2>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={networkMetrics.trafficHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="time" stroke="var(--text-muted)" tick={{fill: 'var(--text-muted)', fontSize: 10}} />
              <YAxis yAxisId="left" stroke="var(--color-primary)" tick={{fill: 'var(--color-primary)'}} />
              <YAxis yAxisId="right" orientation="right" stroke="var(--color-secondary)" tick={{fill: 'var(--color-secondary)'}} />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(7, 7, 10, 0.95)', border: '1px solid rgba(0, 243, 255, 0.3)', borderRadius: '8px' }} />
              <Legend />
              <Line yAxisId="left" type="monotone" name="Packets/s" dataKey="packets" stroke="var(--color-primary)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
              <Line yAxisId="right" type="monotone" name="Entropy" dataKey="entropy" stroke="var(--color-secondary)" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line yAxisId="right" type="monotone" name="Seq Mismatch" dataKey="mismatch" stroke="var(--color-warning)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Threat Map Panel */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe color="var(--color-accent)" /> Active C2 Beacon Map
          </h2>
          
          <div style={{ flexGrow: 1, position: 'relative', overflow: 'hidden', borderRadius: '8px' }}>
            {/* Custom SVG World Map Grid */}
            <svg viewBox="0 0 320 160" style={{ width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px' }}>
              {/* Background grid dots */}
              <defs>
                <pattern id="dotGrid" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1" fill="rgba(255, 255, 255, 0.08)" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#dotGrid)" />

              {/* Node Connections & Attacks */}
              {attackActive && !networkMetrics.preventionActive && (
                <>
                  {/* East Europe to ICU line */}
                  <path d="M 200 60 Q 140 50 110 80" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeDasharray="5,5" style={{ animation: 'dash 2s linear infinite' }} />
                  {/* East Asia to ICU line */}
                  <path d="M 260 70 Q 180 60 110 80" fill="none" stroke="var(--color-accent)" strokeWidth="1" strokeDasharray="5,5" style={{ animation: 'dash 3s linear infinite' }} />
                  
                  {/* Pulsing Target Ring */}
                  <circle cx="110" cy="80" r="10" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" style={{ transformOrigin: '110px 80px', animation: 'ping 1.5s infinite' }} />
                </>
              )}

              {/* Secure or quarantined indicator */}
              {attackActive && networkMetrics.preventionActive && (
                <>
                  {/* Severed Indicator */}
                  <path d="M 200 60 Q 140 50 110 80" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeDasharray="3,3" />
                  <line x1="150" y1="65" x2="160" y2="75" stroke="var(--color-accent)" strokeWidth="3" />
                  <line x1="160" y1="65" x2="150" y2="75" stroke="var(--color-accent)" strokeWidth="3" />
                  <text x="135" y="55" fill="var(--color-accent)" fontSize="8" fontWeight="bold">BLOCK ENFORCED</text>
                </>
              )}

              {/* Map Nodes */}
              {/* ICU target node */}
              <circle cx="110" cy="80" r="5" fill={attackActive ? (networkMetrics.preventionActive ? 'var(--color-success)' : 'var(--color-accent)') : 'var(--color-success)'} />
              <text x="115" y="85" fill="var(--text-main)" fontSize="7">ICU Monitor</text>

              {/* North America Node */}
              <circle cx="50" cy="65" r="4" fill="var(--color-success)" />
              <text x="55" y="62" fill="var(--text-muted)" fontSize="6">NA Hub</text>

              {/* East Europe C2 */}
              <circle cx="200" cy="60" r="4" fill={attackActive && !networkMetrics.preventionActive ? 'var(--color-accent)' : 'var(--text-muted)'} />
              <text x="205" y="58" fill="var(--text-muted)" fontSize="6">EU-C2</text>

              {/* East Asia Proxy */}
              <circle cx="260" cy="70" r="4" fill={attackActive && !networkMetrics.preventionActive ? 'var(--color-accent)' : 'var(--text-muted)'} />
              <text x="265" y="68" fill="var(--text-muted)" fontSize="6">AS-Proxy</text>
            </svg>
          </div>

          <div style={{ marginTop: '16px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontFamily: 'monospace' }}>45.33.32.156 (EU-C2)</span>
              <span style={{ color: attackActive ? (networkMetrics.preventionActive ? 'var(--color-success)' : 'var(--color-accent)') : 'var(--text-muted)', fontWeight: 'bold' }}>
                {attackActive ? (networkMetrics.preventionActive ? 'Mitigated / Blocked' : 'Beacons Detected') : 'Standby'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Interval Tracker:</span>
              <span style={{ color: 'var(--color-primary)', fontFamily: 'monospace' }}>{networkMetrics.beaconIntervalDetected}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Network Monitor Agent Operations Log */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal size={18} color="var(--color-primary)" /> Agent 1: Dual LSTM & iForest Collaboration Feed
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
          {agent1Logs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>&gt;_ System idling. Listening on raw_data Kafka queue... No anomalies detected.</div>
          ) : (
            agent1Logs.map((msg, i) => (
              <div key={i} style={{ marginBottom: '6px', color: msg.status === 'anomaly' || msg.status === 'attack' ? 'var(--color-accent)' : msg.status === 'warning' ? 'var(--color-warning)' : 'var(--color-success)' }}>
                [{msg.time}] &lt;{msg.agent}&gt; {msg.msg}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Anomalies Table */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-primary)' }}>Correlated Network Events</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Timestamp</th>
              <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Target Host</th>
              <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Signature Type</th>
              <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Severity</th>
              <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>AI Confidence Stats</th>
            </tr>
          </thead>
          <tbody>
            {!attackActive ? (
              <tr>
                <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No network anomalies detected. System secure.</td>
              </tr>
            ) : (
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '12px 8px', fontSize: '0.9rem' }}>{new Date().toLocaleTimeString()}</td>
                <td style={{ padding: '12px 8px', fontSize: '0.9rem', color: 'var(--color-primary)' }}>esp32-hr-sim-001</td>
                <td style={{ padding: '12px 8px', fontSize: '0.9rem' }}>{attackType.replace('_', ' ').toUpperCase()}</td>
                <td style={{ padding: '12px 8px' }}>
                  <span className={`live-badge`} style={{ color: 'var(--color-accent)', border: '1px solid var(--color-accent)' }}>
                    CRITICAL
                  </span>
                </td>
                <td style={{ padding: '12px 8px', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ background: 'rgba(0, 243, 255, 0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(0, 243, 255, 0.3)' }}>LSTM: 94.2%</div>
                    <div style={{ background: 'rgba(255, 0, 85, 0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255, 0, 85, 0.3)' }}>iForest: outlier</div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default NetworkMonitor;
