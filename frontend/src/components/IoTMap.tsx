import React, { useState } from 'react';
import { Map as MapIcon, Info, HeartPulse, Activity } from 'lucide-react';
import { useStore } from '../useStore';
import type { Device } from '../types';

const DEPARTMENTS = [
  { id: 'icu', name: 'Intensive Care Unit (ICU)' },
  { id: 'radiology', name: 'Radiology' },
  { id: 'pharmacy', name: 'Pharmacy' },
  { id: 'er', name: 'Emergency Room (ER)' }
];

const IoTMap: React.FC = () => {
  const { devices, alerts } = useStore();
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  // Distribute devices among departments deterministically for demo
  const getDept = (d: Device) => {
    const hash = d.device_id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return DEPARTMENTS[hash % DEPARTMENTS.length];
  };

  const getDeviceColor = (d: Device) => {
    if (d.status === 'quarantined') return 'var(--color-danger)';
    const deviceAlerts = alerts.filter(a => a.device_id === d.device_id && !a.is_resolved);
    if (deviceAlerts.some(a => a.severity === 'critical')) return 'var(--color-danger)';
    if (deviceAlerts.some(a => a.severity === 'high')) return 'var(--color-accent)';
    return 'var(--color-success)';
  };

  const getDeviceRiskScore = (d: Device) => {
    const deviceAlerts = alerts.filter(a => a.device_id === d.device_id && !a.is_resolved);
    if (d.status === 'quarantined') return 95;
    if (deviceAlerts.some(a => a.severity === 'critical')) return Math.floor(Math.random() * 15) + 80;
    if (deviceAlerts.some(a => a.severity === 'high')) return Math.floor(Math.random() * 20) + 60;
    return Math.floor(Math.random() * 20) + 5;
  };

  return (
    <div className="main-content" style={{ display: 'flex', gap: '24px', height: '100%' }}>
      <div style={{ flexGrow: 1 }}>
        <h1 className="page-title" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <MapIcon color="var(--color-primary)" />
          IoT Device Map
        </h1>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '16px', height: 'calc(100vh - 150px)' }}>
          {DEPARTMENTS.map(dept => {
            const deptDevices = devices.filter(d => getDept(d).id === dept.id);
            const compromisedCount = deptDevices.filter(d => getDeviceColor(d) !== 'var(--color-success)').length;
            
            return (
              <div key={dept.id} className="glass-panel" style={{ padding: '24px', position: 'relative', overflow: 'hidden', border: compromisedCount > 0 ? '1px solid rgba(255, 0, 85, 0.3)' : '1px solid rgba(255,255,255,0.05)' }}>
                <h3 style={{ margin: 0, color: 'var(--text-primary)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '16px' }}>{dept.name}</h3>
                
                <div style={{ position: 'absolute', top: 24, right: 24, fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                  <div>Devices: {deptDevices.length}</div>
                  <div style={{ color: compromisedCount > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                    Alerts: {compromisedCount}
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '32px' }}>
                  {deptDevices.map(device => {
                    const color = getDeviceColor(device);
                    return (
                      <div 
                        key={device.device_id}
                        onClick={() => setSelectedDevice(device)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          background: selectedDevice?.device_id === device.device_id ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.3)',
                          border: `1px solid ${selectedDevice?.device_id === device.device_id ? color : 'rgba(255,255,255,0.05)'}`,
                          padding: '12px', borderRadius: '8px', cursor: 'pointer',
                          transition: 'all 0.2s', width: '220px',
                          boxShadow: selectedDevice?.device_id === device.device_id ? `0 0 15px ${color}44` : 'none'
                        }}
                        title={device.device_id}
                      >
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%', backgroundColor: color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          boxShadow: `0 0 10px ${color}66`
                        }}>
                          <HeartPulse size={16} color="#000" />
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            {device.device_id}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                            {device.device_type.replace('_', ' ')}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Device Detail Drawer */}
      <div className="glass-panel" style={{ width: '350px', padding: '24px', transition: 'all 0.3s ease', opacity: selectedDevice ? 1 : 0.5, pointerEvents: selectedDevice ? 'auto' : 'none' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '24px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Info size={20} /> Device Details
        </h2>
        
        {selectedDevice ? (
          (() => {
            const activeDevice = devices.find(d => d.device_id === selectedDevice.device_id) || selectedDevice;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Device ID</label>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{activeDevice.device_id}</div>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Type</label>
                  <div style={{ textTransform: 'capitalize' }}>{activeDevice.device_type.replace('_', ' ')}</div>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status</label>
                  <div>
                    <span className={`live-badge`} style={{ color: getDeviceColor(activeDevice) }}>
                      {activeDevice.status.toUpperCase()}
                    </span>
                  </div>
                </div>
                
                {/* Real-time Telemetry */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Heart Rate</label>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: activeDevice.metadata_json?.heart_rate > 150 ? 'var(--color-danger)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <HeartPulse size={16} color={activeDevice.metadata_json?.heart_rate > 150 ? 'var(--color-danger)' : 'var(--color-primary)'} />
                      {activeDevice.metadata_json?.heart_rate ? `${activeDevice.metadata_json.heart_rate} BPM` : 'Waiting...'}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SpO2 Level</label>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: activeDevice.metadata_json?.spo2 < 90 ? 'var(--color-danger)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Activity size={16} color={activeDevice.metadata_json?.spo2 < 90 ? 'var(--color-danger)' : 'var(--color-success)'} />
                      {activeDevice.metadata_json?.spo2 ? `${activeDevice.metadata_json.spo2}%` : 'Waiting...'}
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Risk Score</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flexGrow: 1, height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${getDeviceRiskScore(activeDevice)}%`, height: '100%', background: getDeviceColor(activeDevice) }}></div>
                    </div>
                    <span>{getDeviceRiskScore(activeDevice)}/100</span>
                  </div>
                </div>
                
                <div style={{ marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>Passive Monitoring</label>
                    <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '40px', height: '20px' }}>
                      <input type="checkbox" defaultChecked style={{ opacity: 0, width: 0, height: 0 }} />
                      <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'var(--color-primary)', transition: '.4s', borderRadius: '20px' }}></span>
                    </label>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                    <AlertTriangle size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    Disabling passive monitoring removes AI protection. Requires CISO approval.
                  </p>
                </div>
              </div>
            );
          })()
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '50px' }}>
            Select a device on the map to view details.
          </div>
        )}
      </div>
    </div>
  );
};

// Quick polyfill for the missing AlertTriangle import above
import { AlertTriangle } from 'lucide-react';

export default IoTMap;
