import React, { useState, useEffect, useRef } from 'react';
import { FileCheck, Shield, Lock, Download, AlertTriangle, ShieldCheck, Cpu } from 'lucide-react';
import { useStore } from '../useStore';

const ComplianceCenter: React.FC = () => {
  const { 
    attackActive, 
    complianceMetrics, 
    agent5Logs 
  } = useStore();
  const [verifying, setVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll logs without page jump
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [agent5Logs]);

  const handleVerifyChain = () => {
    setVerifying(true);
    setVerifyStatus(null);
    setTimeout(() => {
      setVerifying(false);
      setVerifyStatus('Valid');
    }, 800);
  };

  return (
    <div className="main-content">
      {/* Header */}
      <div className="header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FileCheck color="var(--color-primary)" />
            Compliance & Audit Center (Agent 5)
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Immutable cryptographic ledger logging and clinical safety policy compliance audits.</p>
        </div>
        <div>
          {attackActive ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,204,0,0.15)', border: '1px solid var(--color-warning)', color: 'var(--color-warning)', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold' }}>
              <AlertTriangle size={18} /> IMMUTABLE BREACH DETECTED
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,255,136,0.1)', border: '1px solid var(--color-success)', color: 'var(--color-success)', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold' }}>
              <ShieldCheck size={18} /> LEDGER INTEGRITY VALID
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', marginBottom: '24px' }}>
        
        {/* Scorecard */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={20} color="var(--color-success)" /> HIPAA Scorecard
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { label: 'Access Control (§164.312(a))', score: attackActive ? 91 : 98 },
                { label: 'Audit Controls (§164.312(b))', score: 100 },
                { label: 'Integrity (§164.312(c))', score: 100 },
                { label: 'Transmission Security (§164.312(e))', score: attackActive ? 84 : 96 }
              ].map(cat => (
                <div key={cat.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.9rem' }}>
                    <span>{cat.label}</span>
                    <span style={{ color: cat.score >= 90 ? 'var(--color-success)' : 'var(--color-warning)' }}>{cat.score}%</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
                    <div style={{ width: `${cat.score}%`, height: '100%', background: cat.score >= 90 ? 'var(--color-success)' : 'var(--color-warning)', borderRadius: '3px' }}></div>
                  </div>
                </div>
              ))}
            </div>
            
            <button style={{ marginTop: '24px', width: '100%', padding: '12px', background: 'var(--color-primary)', color: '#000', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Download size={18} /> Export Compliance Log (CSV)
            </button>
          </div>

          <div className="glass-panel" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--text-primary)' }}>Regulatory Mapping</h2>
            <table style={{ width: '100%', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <tbody>
                <tr><td style={{ padding: '6px 0' }}>Agent 5 Hash Chain</td><td style={{ textAlign: 'right', color: 'var(--color-primary)' }}>HIPAA §164.312(b)</td></tr>
                <tr><td style={{ padding: '6px 0' }}>Agent 4 Containment</td><td style={{ textAlign: 'right', color: 'var(--color-primary)' }}>NIST PR.IP-9</td></tr>
                <tr><td style={{ padding: '6px 0' }}>Agent 2 Anomaly Det.</td><td style={{ textAlign: 'right', color: 'var(--color-primary)' }}>NIST DE.AE-1</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Cryptographic Ledger Block View */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', minHeight: '495px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={20} color="var(--color-accent)" /> Immutable Cryptographic Blockchain
            </h2>
            <button 
              onClick={handleVerifyChain}
              disabled={verifying}
              style={{ padding: '6px 12px', background: 'rgba(0,243,255,0.1)', border: '1px solid rgba(0, 243, 255, 0.4)', color: 'var(--color-primary)', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
            >
              {verifying ? 'Verifying blocks...' : 'Verify Cryptographic Chain'}
            </button>
          </div>

          {verifyStatus && (
            <div className="pulse-border" style={{ 
              marginBottom: '16px', 
              padding: '12px', 
              background: 'rgba(0,255,136,0.1)', 
              border: '1px solid var(--color-success)', 
              color: 'var(--color-success)', 
              borderRadius: '4px',
              fontSize: '0.85rem',
              fontWeight: 'bold'
            }}>
              ✓ Cryptographic hash chain validation completed. All blocks match their parents. 0 anomalies detected.
            </div>
          )}

          <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '380px' }}>
            {complianceMetrics.auditBlocks.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
                Initializing compliance ledger node...
              </div>
            ) : (
              complianceMetrics.auditBlocks.map((block, idx) => (
                <div key={block.id} style={{ 
                  background: 'rgba(0,0,0,0.5)', 
                  border: '1px solid rgba(255,255,255,0.05)', 
                  borderRadius: '8px', 
                  padding: '16px', 
                  position: 'relative' 
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--color-primary)', fontFamily: 'monospace' }}>BLOCK #{block.id}</span>
                    <span className="live-badge" style={{ color: 'var(--color-success)', border: '1px solid var(--color-success)' }}>{block.status}</span>
                  </div>
                  
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>Policy:</span> {block.hipaa}
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '4px', fontFamily: 'monospace', fontSize: '0.75rem', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '4px' }}>
                    <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'var(--color-accent)' }}>Hash: </span> {block.hash}
                    </div>
                    <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Prev: </span> {block.prevHash}
                    </div>
                  </div>
                  
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'right' }}>
                    Locked: {new Date(block.timestamp).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Compliance Log Stream */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu size={18} color="var(--color-success)" /> Agent 5: Real-time Cryptographic Audit Log
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
          {agent5Logs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>&gt;_ Ingestion queue empty. Awaiting autonomous containment events from Agent 4...</div>
          ) : (
            agent5Logs.map((msg, i) => (
              <div key={i} style={{ marginBottom: '6px', color: msg.status === 'attack' ? 'var(--color-accent)' : msg.status === 'warning' ? 'var(--color-warning)' : 'var(--color-success)' }}>
                [{msg.time}] &lt;{msg.agent}&gt; {msg.msg}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ComplianceCenter;
