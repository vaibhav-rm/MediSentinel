import React from 'react';
import { Shield, Activity, HardDrive, AlertTriangle, ShieldAlert, Cpu, Settings, Network, Map, FileCheck, BrainCircuit } from 'lucide-react';

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView }) => {
  const navItems = [
    { id: 'dashboard', label: 'Global Dashboard', icon: Activity },
    { id: 'network', label: 'Network Monitor', icon: Network },
    { id: 'iot_map', label: 'IoT Device Map', icon: Map },
    { id: 'simulation_hub', label: 'Attack Simulation Hub', icon: ShieldAlert },
    { id: 'threat_intel', label: 'Threat Intel Feed', icon: AlertTriangle },
    { id: 'incident_response', label: 'Incident Response', icon: Shield },
    { id: 'compliance', label: 'Compliance & Audit', icon: FileCheck },
    { id: 'ml_models', label: 'ML Models', icon: BrainCircuit },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="sidebar">
      <div className="logo-container">
        <ShieldAlert size={36} className="logo-icon" />
        <span className="logo-text">MediSentinel</span>
      </div>
      
      <div className="nav-menu" style={{ marginTop: '20px', flexGrow: 1 }}>
        {navItems.map(item => (
          <button 
            key={item.id}
            onClick={() => setActiveView(item.id)} 
            className={`nav-item ${activeView === item.id ? 'active' : ''}`} 
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', marginBottom: '4px' }}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      
      <div className="glass-panel" style={{ padding: '20px', marginTop: 'auto', background: 'rgba(0,0,0,0.4)', textAlign: 'center', borderRadius: '12px', border: '1px solid rgba(0, 243, 255, 0.1)' }}>
        <Cpu size={24} color="var(--color-primary)" style={{ marginBottom: '8px' }} />
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>AI Orchestrator Online</p>
        <p style={{ color: 'var(--color-success)', fontWeight: 600, fontSize: '0.9rem' }}>5 Agents Active</p>
      </div>
    </nav>
  );
};

export default Sidebar;
