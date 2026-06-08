import React, { useState } from 'react';
import { Map as MapIcon, Info, HeartPulse, Activity, AlertTriangle, ShieldCheck, Cpu } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { useStore } from '../useStore';
import type { Device } from '../types';

const DEPARTMENTS = [
  { id: 'icu', name: 'Intensive Care Unit (ICU)' },
  { id: 'radiology', name: 'Radiology' },
  { id: 'pharmacy', name: 'Pharmacy' },
  { id: 'er', name: 'Emergency Room (ER)' }
];

const IoTMap: React.FC = () => {
  const { 
    devices, 
    alerts, 
    attackActive, 
    deviceMetrics,
    attackType
  } = useStore();
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  // Distribute devices among departments deterministically for demo
  const getDept = (d: Device) => {
    const hash = d.device_id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return DEPARTMENTS[hash % DEPARTMENTS.length];
  };

  const getDeviceColor = (d: Device) => {
    if (d.status === 'quarantined') return 'var(--color-accent)'; // Red
    const deviceAlerts = alerts.filter(a => a.device_id === d.device_id && !a.is_resolved);
    if (deviceAlerts.some(a => a.severity === 'critical') || (d.device_id === 'esp32-hr-sim-001' && attackActive)) {
      return 'var(--color-accent)';
    }
    if (deviceAlerts.some(a => a.severity === 'high')) return 'var(--color-warning)';
    return 'var(--color-success)';
  };

  const getDeviceRiskScore = (d: Device) => {
    if (d.device_id === 'esp32-hr-sim-001') {
      return attackActive ? (d.status === 'quarantined' ? 95 : 88) : 5;
    }
    if (d.status === 'quarantined') return 95;
    return 8;
  };

  // Pulse rate logic based on status
  const getDeviceHeartRate = (d: Device) => {
    if (d.device_id === 'esp32-hr-sim-001') {
      return deviceMetrics.heartRate;
    }
    return 74;
  };

  // SpO2 logic
  const getDeviceSpO2 = (d: Device) => {
    if (d.device_id === 'esp32-hr-sim-001') {
      return deviceMetrics.spo2;
    }
    return 98;
  };

  return (
    <div className="main-content" style={{ display: 'flex', gap: '24px', height: '100%', flexDirection: 'column' }}>
      <div style={{ marginBottom: '8px' }}>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <MapIcon color="var(--color-primary)" />
          IoT Device Guardian Map
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>Real-time telemetry integrity monitoring & deep-learning behavioral anomaly detection.</p>
      </div>

      <div style={{ display: 'flex', gap: '24px', flexGrow: 1 }}>
        {/* Main Department Map */}
        <div style={{ flexGrow: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '16px', height: 'calc(100vh - 200px)' }}>
            {DEPARTMENTS.map(dept => {
              const deptDevices = devices.filter(d => getDept(d).id === dept.id);
              // Include the sim device under ER or ICU
              const hasAttackDevice = dept.id === 'icu' && devices.some(d => d.device_id === 'esp32-hr-sim-001');
              const finalDeptDevices = deptDevices.filter(d => d.device_id !== 'esp32-hr-sim-001');
              if (dept.id === 'icu' && devices.some(d => d.device_id === 'esp32-hr-sim-001')) {
                finalDeptDevices.push(devices.find(d => d.device_id === 'esp32-hr-sim-001')!);
              }

              const compromisedCount = finalDeptDevices.filter(d => getDeviceColor(d) === 'var(--color-accent)').length;
              
              return (
                <div key={dept.id} className="glass-panel" style={{ padding: '24px', position: 'relative', overflow: 'hidden', border: compromisedCount > 0 ? '1px solid rgba(255, 0, 60, 0.3)' : '1px solid rgba(255,255,255,0.05)' }}>
                  <h3 style={{ margin: 0, color: 'var(--text-primary)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '16px' }}>{dept.name}</h3>
                  
                  <div style={{ position: 'absolute', top: 24, right: 24, fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                    <div>Total Monitored: {finalDeptDevices.length}</div>
                    <div style={{ color: compromisedCount > 0 ? 'var(--color-accent)' : 'var(--color-success)', fontWeight: 'bold' }}>
                      Alerts: {compromisedCount}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '16px' }}>
                    {finalDeptDevices.map(device => {
                      const isOffline = device.device_id !== 'esp32-hr-sim-001';
                      const color = isOffline ? 'var(--text-muted)' : getDeviceColor(device);
                      const isQuarantined = device.status === 'quarantined';
                      const isCompromised = color === 'var(--color-accent)' && !isQuarantined && !isOffline;

                      return (
                        <div 
                          key={device.device_id}
                          onClick={() => setSelectedDevice(device)}
                          className={isCompromised ? "pulse-border" : ""}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            background: selectedDevice?.device_id === device.device_id ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.3)',
                            border: `1px solid ${selectedDevice?.device_id === device.device_id ? color : 'rgba(255,255,255,0.05)'}`,
                            padding: '12px', borderRadius: '8px', cursor: 'pointer',
                            transition: 'all 0.2s', width: '220px',
                            boxShadow: selectedDevice?.device_id === device.device_id ? `0 0 15px ${color}44` : 'none',
                            opacity: (isQuarantined || isOffline) ? 0.6 : 1
                          }}
                          title={device.device_id}
                        >
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%', backgroundColor: color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            boxShadow: isOffline ? 'none' : `0 0 10px ${color}66`,
                            animation: isCompromised ? 'pulse 1s infinite alternate' : 'none'
                          }}>
                            <HeartPulse size={16} color="#000" style={{ animation: isCompromised ? 'ping 0.8s infinite' : 'none' }} />
                          </div>
                          <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: isOffline ? 'var(--text-muted)' : 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                              {device.device_id}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                              {isOffline ? 'SIMULATED (OFFLINE)' : device.device_type.replace('_', ' ')}
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
        <div className="glass-panel" style={{ width: '380px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Info size={20} /> Device Details
          </h2>
          
          {selectedDevice ? (
            (() => {
              const activeDevice = devices.find(d => d.device_id === selectedDevice.device_id) || selectedDevice;
              const isSim = activeDevice.device_id === 'esp32-hr-sim-001';
              const color = getDeviceColor(activeDevice);
              
              // Map ECG array to Recharts format
              const ecgData = isSim 
                ? deviceMetrics.ecgWaveform.map((val, idx) => ({ idx, val }))
                : [0, 0.2, -0.1, 1.5, -0.3, 0.2, 0, 0].map((val, idx) => ({ idx, val }));

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Device ID</label>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'monospace' }}>{activeDevice.device_id}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Type</label>
                    <div style={{ textTransform: 'capitalize' }}>{activeDevice.device_type.replace('_', ' ')}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status</label>
                    <div>
                      <span className="live-badge" style={{ color: color, border: `1px solid ${color}` }}>
                        <span className="live-dot" style={{ backgroundColor: color }}></span>
                        {activeDevice.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  
                  {/* Real-time Telemetry values */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Heart Rate</label>
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: getDeviceHeartRate(activeDevice) > 130 || getDeviceHeartRate(activeDevice) === 0 ? 'var(--color-accent)' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <HeartPulse size={16} color={getDeviceHeartRate(activeDevice) > 130 ? 'var(--color-accent)' : 'var(--color-success)'} />
                        {getDeviceHeartRate(activeDevice) > 0 ? `${getDeviceHeartRate(activeDevice)} BPM` : 'OFFLINE'}
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SpO2 Level</label>
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: getDeviceSpO2(activeDevice) < 90 || getDeviceSpO2(activeDevice) === 0 ? 'var(--color-accent)' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Activity size={16} color={getDeviceSpO2(activeDevice) < 90 ? 'var(--color-accent)' : 'var(--color-success)'} />
                        {getDeviceSpO2(activeDevice) > 0 ? `${getDeviceSpO2(activeDevice)}%` : 'OFFLINE'}
                      </div>
                    </div>
                  </div>

                  {/* Dynamic ECG Waveform */}
                  <div style={{ background: '#050508', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Live ECG Monitor</span>
                      <span style={{ color: color, fontWeight: 'bold' }}>
                        {activeDevice.status === 'quarantined' ? 'SEVERED' : (attackActive && isSim ? 'ARRHYTHMIA' : 'NORMAL')}
                      </span>
                    </div>
                    <div style={{ height: '70px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={ecgData}>
                          <Line type="monotone" dataKey="val" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Deep Learning Security Telemetry (Agent 2) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Autoencoder Loss:</span>
                      <span style={{ fontFamily: 'monospace', color: isSim && attackActive && activeDevice.status !== 'quarantined' ? 'var(--color-accent)' : 'var(--color-success)' }}>
                        {isSim ? deviceMetrics.reconstructionLoss.toFixed(4) : '0.0124'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Telemetry Mutation:</span>
                      <span style={{ color: isSim && attackActive && activeDevice.status !== 'quarantined' ? 'var(--color-accent)' : 'var(--text-main)' }}>
                        {isSim ? `${deviceMetrics.telemetryMutation}%` : '0%'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Sensor Drift Deviation:</span>
                      <span style={{ color: isSim && attackActive && activeDevice.status !== 'quarantined' ? 'var(--color-accent)' : 'var(--text-main)' }}>
                        {isSim ? `+${deviceMetrics.sensorDrift}%` : '0%'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Heartbeat Consistency:</span>
                      <span style={{ color: isSim && attackActive && activeDevice.status !== 'quarantined' ? 'var(--color-accent)' : 'var(--color-success)' }}>
                        {isSim ? deviceMetrics.heartbeatConsistency : 'Consistent'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Spoof Probability:</span>
                      <span style={{ color: isSim && attackActive && activeDevice.status !== 'quarantined' ? 'var(--color-accent)' : 'var(--color-success)' }}>
                        {isSim ? `${deviceMetrics.spoofProbability}%` : '0.4%'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Overall Integrity Score</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <div style={{ flexGrow: 1, height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${isSim ? deviceMetrics.deviceIntegrityScore : 98}%`, height: '100%', backgroundColor: color }}></div>
                      </div>
                      <span style={{ fontSize: '0.9rem' }}>{isSim ? deviceMetrics.deviceIntegrityScore : 98}/100</span>
                    </div>
                  </div>
                  
                  <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Cpu size={14} /> Passive Neural Protection
                      </label>
                      <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '32px', height: '16px' }}>
                        <input type="checkbox" defaultChecked style={{ opacity: 0, width: 0, height: 0 }} />
                        <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'var(--color-primary)', transition: '.4s', borderRadius: '16px' }}></span>
                      </label>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                      <AlertTriangle size={12} style={{ display: 'inline', marginRight: '4px' }} />
                      Disabling neural protection removes real-time reconstruction screening.
                    </p>
                  </div>
                </div>
              );
            })()
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '50px', padding: '16px' }}>
              <HeartPulse size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px', display: 'block', opacity: 0.5 }} />
              Select any medical device from the wing departments to analyze live telemetry waveforms and autoencoder diagnostics.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IoTMap;
