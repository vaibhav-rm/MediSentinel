import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Database, ShieldCheck, UserX } from 'lucide-react';
import { useStore } from '../useStore';
import type { ThreatIntelType } from '../types';

const ThreatIntel: React.FC = () => {
  const { agentLogs, attackActive } = useStore();
  const [threatIntel, setThreatIntel] = useState<ThreatIntelType[]>([]);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  // Filter logs for Threat Intel agent
  const myLogs = agentLogs.filter(log => log.agent_name === 'Threat Intelligence');

  const fetchThreatIntel = async () => {
    try {
      const res = await fetch('http://localhost:8000/threat-intel/feed');
      if (res.ok) {
        const data = await res.json();
        setThreatIntel(data);
      }
    } catch (err) {
      console.error("Failed to fetch threat intel feed:", err);
    }
  };

  useEffect(() => {
    fetchThreatIntel();
    const interval = setInterval(fetchThreatIntel, 2500); // refresh feed
    return () => clearInterval(interval);
  }, []);

  // Auto scroll logs
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [myLogs]);

  // Mock propagation status
  const agents = ['Network Monitor', 'IoT Guardian', 'Incident Response'];
  const [propagated, setPropagated] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (threatIntel.length > 0) {
      const timer = setTimeout(() => {
        const newProp: Record<string, boolean> = {};
        agents.forEach(a => newProp[a] = true);
        setPropagated(newProp);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [threatIntel]);

  return (
    <div className="main-content">
      <div className="header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Database color="var(--color-primary)" />
            Threat Intelligence Feed
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>STIX/TAXII threat intel correlation and active signature synchronization.</p>
        </div>
        <div>
          {attackActive ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,0,85,0.15)', border: '1px solid var(--color-danger)', color: 'var(--color-danger)', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold' }}>
              <AlertTriangle size={18} /> CRITICAL IOC PROPAGATED
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,255,136,0.1)', border: '1px solid var(--color-success)', color: 'var(--color-success)', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold' }}>
              <ShieldCheck size={18} /> ALL FEEDS SYNCHRONIZED
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '24px', marginBottom: '24px' }}>
        
        {/* IOC Table */}
        <div className="glass-panel" style={{ padding: '24px', minHeight: '380px' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-primary)' }}>Live STIX/TAXII IOCs</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Indicator</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Type</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Confidence</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Source Feed</th>
                <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Date Added</th>
              </tr>
            </thead>
            <tbody>
              {threatIntel.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Awaiting feed ingestion...</td>
                </tr>
              ) : threatIntel.map((ioc, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px 8px', fontFamily: 'monospace', color: 'var(--color-primary)' }}>{ioc.indicator}</td>
                  <td style={{ padding: '12px 8px', textTransform: 'uppercase', fontSize: '0.8rem' }}>{ioc.type}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '50px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
                        <div style={{ width: `${ioc.confidence}%`, height: '100%', background: ioc.confidence > 80 ? 'var(--color-danger)' : 'var(--color-warning)', borderRadius: '3px' }}></div>
                      </div>
                      <span style={{ fontSize: '0.8rem' }}>{ioc.confidence}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 8px', fontSize: '0.9rem' }}>{ioc.source_feed}</td>
                  <td style={{ padding: '12px 8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {ioc.date_added ? new Date(ioc.date_added).toLocaleTimeString() : new Date().toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sidebar panels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Propagation Status */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="var(--color-success)" /> Signature Sync
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {agents.map(agent => (
                <div key={agent} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{agent}</span>
                  {propagated[agent] ? (
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-success)', background: 'rgba(0,255,136,0.1)', padding: '2px 6px', borderRadius: '4px' }}>Synced</span>
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-warning)', background: 'rgba(255,204,0,0.1)', padding: '2px 6px', borderRadius: '4px' }}>Pending</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Threat Actor Card */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserX size={18} color="var(--color-danger)" /> Known Threat Actors
            </h3>
            <div style={{ background: 'rgba(255,0,85,0.05)', border: '1px solid rgba(255,0,85,0.2)', padding: '16px', borderRadius: '8px' }}>
              <div style={{ fontWeight: 'bold', color: 'var(--color-danger)', marginBottom: '8px' }}>APT41 (Double Dragon)</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                State-sponsored espionage group. Frequently targets healthcare for IP theft. Associated with recent ransomware variants seen in IOC feed.
              </p>
              <div style={{ marginTop: '12px', fontSize: '0.7rem', color: 'var(--color-accent)' }}>Targets: Medical Imaging, EHR Databases</div>
            </div>
          </div>

        </div>
      </div>

      {/* Threat Intelligence Agent Logs */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Database size={18} color="var(--color-primary)" /> Agent 3: Threat Intelligence Log Stream
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
            <div style={{ color: 'var(--text-muted)' }}>&gt;_ Awaiting feed correlation checks...</div>
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
    </div>
  );
};

export default ThreatIntel;
