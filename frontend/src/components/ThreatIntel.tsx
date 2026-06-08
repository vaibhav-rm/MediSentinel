import React, { useEffect, useRef } from 'react';
import { Database, AlertTriangle, ShieldCheck, UserX, Cpu, Radio, Network } from 'lucide-react';
import { useStore } from '../useStore';

const ThreatIntel: React.FC = () => {
  const { 
    attackActive, 
    threatIntelMetrics, 
    agent3Logs,
    attackType
  } = useStore();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll logs without page jump
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [agent3Logs]);

  const agents = ['Network Monitor', 'IoT Guardian', 'Incident Response', 'Compliance Audit'];

  return (
    <div className="main-content">
      {/* Header */}
      <div className="header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Database color="var(--color-primary)" />
            Threat Intelligence (Agent 3)
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Real-time STIX/TAXII threat feed correlation & NLP entity extraction.</p>
        </div>
        <div>
          {attackActive ? (
            <div className="pulse-border" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,0,60,0.15)', border: '1px solid var(--color-accent)', color: 'var(--color-accent)', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold' }}>
              <AlertTriangle size={18} /> ACTIVE IOC PROPAGATED
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,255,136,0.1)', border: '1px solid var(--color-success)', color: 'var(--color-success)', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold' }}>
              <ShieldCheck size={18} /> THREAT INTEL STABLE
            </div>
          )}
        </div>
      </div>

      {/* NLP & Threat Analytics cards */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="glass-panel stat-card" style={{ borderLeft: '3px solid var(--color-primary)' }}>
          <div className="stat-title"><Radio size={16} /> Campaign Classification</div>
          <div className="stat-value" style={{ fontSize: '1.25rem', marginTop: '12px', color: attackActive ? 'var(--color-accent)' : 'var(--text-main)' }}>
            {attackActive ? threatIntelMetrics.campaignClassification : 'No Active Threat'}
          </div>
          <div className="stat-trend trend-up" style={{ fontSize: '0.8rem' }}>
            {attackActive ? '▲ Matching feed indicators' : '● Ingestion cycle idle'}
          </div>
        </div>

        <div className="glass-panel stat-card" style={{ borderLeft: '3px solid var(--color-secondary)' }}>
          <div className="stat-title"><Network size={16} /> MITRE ATT&CK Mapping</div>
          <div className="stat-value" style={{ fontSize: '1.25rem', marginTop: '12px', fontFamily: 'monospace', color: attackActive ? 'var(--color-secondary)' : 'var(--text-main)' }}>
            {attackActive ? threatIntelMetrics.mitreMapping : 'None'}
          </div>
          <div className="stat-trend" style={{ color: 'var(--color-success)', fontSize: '0.8rem' }}>
            {attackActive ? '▲ Dynamic rule injection' : '● Standard filters'}
          </div>
        </div>

        <div className="glass-panel stat-card" style={{ borderLeft: '3px solid var(--color-warning)' }}>
          <div className="stat-title"><AlertTriangle size={16} /> C2 Connection State</div>
          <div className="stat-value" style={{ fontSize: '1rem', marginTop: '12px', fontFamily: 'monospace', color: attackActive ? 'var(--color-warning)' : 'var(--text-main)' }}>
            {attackActive ? threatIntelMetrics.c2Communication : 'Idle'}
          </div>
          <div className="stat-trend" style={{ fontSize: '0.8rem' }}>
            {attackActive ? '▲ Telemetry route hijacked' : '● Encryption active'}
          </div>
        </div>

        <div className="glass-panel stat-card" style={{ borderLeft: '3px solid var(--color-success)' }}>
          <div className="stat-title"><UserX size={16} /> Threat Actor Similarity</div>
          <div className="stat-value" style={{ color: attackActive ? 'var(--color-accent)' : 'var(--text-main)' }}>
            {attackActive ? `${threatIntelMetrics.threatActorSimilarity}%` : '0%'}
          </div>
          <div className="stat-trend" style={{ fontSize: '0.8rem' }}>
            {attackActive ? '▲ Heavy overlap with APT41' : '● No matching profile'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* IOC Table */}
        <div className="glass-panel" style={{ padding: '24px', minHeight: '380px' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-primary)' }}>Live STIX/TAXII IOC Ingestion</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Indicator</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Type</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>NLP Confidence</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Threat Source</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>MITRE Tactic</th>
              </tr>
            </thead>
            <tbody>
              {!attackActive ? (
                <tr>
                  <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Awaiting next STIX poll cycle. Safe baselines active.
                  </td>
                </tr>
              ) : (
                threatIntelMetrics.threatFeed.map((ioc, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px 8px', fontFamily: 'monospace', color: 'var(--color-primary)' }}>{ioc.indicator}</td>
                    <td style={{ padding: '12px 8px', textTransform: 'uppercase', fontSize: '0.8rem' }}>{ioc.type}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '50px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
                          <div style={{ width: `${ioc.confidence}%`, height: '100%', background: 'var(--color-primary)', borderRadius: '3px' }}></div>
                        </div>
                        <span style={{ fontSize: '0.8rem' }}>{ioc.confidence}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 8px', fontSize: '0.9rem' }}>{ioc.source}</td>
                    <td style={{ padding: '12px 8px', fontSize: '0.8rem', color: 'var(--color-secondary)', fontFamily: 'monospace' }}>
                      {ioc.mitre}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Sidebar details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Signature propagation sync */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="var(--color-success)" /> Signature Sync
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {agents.map(agent => (
                <div key={agent} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{agent}</span>
                  <span style={{ fontSize: '0.8rem', color: attackActive ? 'var(--color-success)' : 'var(--text-muted)', background: attackActive ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.02)', padding: '2px 6px', borderRadius: '4px' }}>
                    {attackActive ? 'SYNCED' : 'STANDBY'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Threat profile */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserX size={18} color="var(--color-accent)" /> Threat Profile
            </h3>
            <div style={{ background: 'rgba(255,0,60,0.03)', border: '1px solid rgba(255,0,60,0.15)', padding: '16px', borderRadius: '8px' }}>
              <div style={{ fontWeight: 'bold', color: attackActive ? 'var(--color-accent)' : 'var(--text-main)', marginBottom: '8px' }}>
                {attackActive ? 'APT41 (Medical Focus)' : 'Idle Profiler'}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                {attackActive 
                  ? `Correlated attack vectors matched signature database. High risk to EHR database targets and hospital medical IoT devices.` 
                  : `Awaiting active threat indicators to compute profile similarity indices.`}
              </p>
              {attackActive && <div style={{ marginTop: '12px', fontSize: '0.75rem', color: 'var(--color-secondary)' }}>Tactics: T1071 C2, T1486 Encrypt</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Threat intelligence logs */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu size={18} color="var(--color-primary)" /> Agent 3: STIX/TAXII NLP Entity Ingestion Logs
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
          {agent3Logs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>&gt;_ Polling STIX endpoints: AlienVault OTX, IBM X-Force, VirusTotal. No correlated indicators.</div>
          ) : (
            agent3Logs.map((msg, i) => (
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

export default ThreatIntel;
