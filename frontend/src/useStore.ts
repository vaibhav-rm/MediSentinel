import { useState, useEffect } from 'react';
import type { Device, Alert, ThreatIntelType, AuditLogType } from './types';

const BACKEND_REST_URL = 'http://localhost:8000';
const BACKEND_WS_URL = 'ws://localhost:8000/ws';

export interface AgentLog {
  agent_name: string;
  status: string;
  message: string;
  timestamp: string;
}

export const useStore = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [threatIntel, setThreatIntel] = useState<ThreatIntelType[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogType[]>([]);
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const [attackActive, setAttackActive] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  // 1. Trigger attack state toggle in the backend
  const toggleAttack = async (active: boolean) => {
    try {
      const res = await fetch(`${BACKEND_REST_URL}/simulation/attack-toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attack_active: active })
      });
      if (res.ok) {
        setAttackActive(active);
      }
    } catch (err) {
      console.error("Failed to toggle attack simulation:", err);
    }
  };

  // 2. Reset the simulation (clears logs and resets device status)
  const resetSimulation = async () => {
    try {
      const res = await fetch(`${BACKEND_REST_URL}/simulation/reset`, {
        method: 'POST'
      });
      if (res.ok) {
        setAgentLogs([]);
        setDevices(prev => prev.map(d => ({ ...d, status: 'active' })));
      }
    } catch (err) {
      console.error("Failed to reset simulation:", err);
    }
  };

  // 3. Manual actions
  const forceQuarantine = async (device_id: string) => {
    try {
      await fetch(`${BACKEND_REST_URL}/devices/${device_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'quarantined' })
      });
      await fetch(`${BACKEND_REST_URL}/simulation/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_name: 'Incident Response',
          status: 'mitigated',
          message: `Manual Analyst Override: Quarantine enforced on ${device_id}`
        })
      });
    } catch(err) { console.error(err); }
  };

  const escalateIncident = async (alert_id: number) => {
    try {
      await fetch(`${BACKEND_REST_URL}/simulation/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_name: 'Incident Response',
          status: 'logged',
          message: `Manual Analyst Override: Alert #${alert_id} escalated to CISO.`
        })
      });
    } catch(err) { console.error(err); }
  };

  useEffect(() => {
    // Fetch initial state
    const fetchInitialData = async () => {
      try {
        const [devicesRes, alertsRes, attackRes, logsRes] = await Promise.all([
          fetch(`${BACKEND_REST_URL}/devices/`),
          fetch(`${BACKEND_REST_URL}/alerts/`),
          fetch(`${BACKEND_REST_URL}/simulation/attack-status`),
          fetch(`${BACKEND_REST_URL}/simulation/logs`)
        ]);

        if (devicesRes.ok) {
          const devs = await devicesRes.json();
          setDevices(devs);
        }
        if (alertsRes.ok) {
          const alrts = await alertsRes.json();
          alrts.sort((a: Alert, b: Alert) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setAlerts(alrts.slice(0, 50));
        }
        if (attackRes.ok) {
          const attackStatus = await attackRes.json();
          setAttackActive(attackStatus.attack_active);
        }
        if (logsRes.ok) {
          const logs = await logsRes.json();
          setAgentLogs(logs);
        }
      } catch (err) {
        console.error("Failed to fetch initial data:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchInitialData();

    // Setup WebSocket for live updates
    const ws = new WebSocket(BACKEND_WS_URL);
    
    ws.onopen = () => {
      console.log("Connected to MediSentinel live WebSocket");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { topic, data } = msg;

        // Custom event for visualizing network blips
        window.dispatchEvent(new CustomEvent('live-network-event'));

        if (topic === 'devices/auto_registered') {
          setDevices(prev => {
            if (prev.some(d => d.device_id === data.device_id)) return prev;
            return [...prev, data];
          });
        }
        else if (topic === 'devices/telemetry') {
           setDevices(prev => prev.map(d => 
             d.device_id === data.device_id 
              ? { 
                  ...d, 
                  status: data.status || d.status,
                  last_seen: new Date().toISOString(),
                  metadata_json: {
                    ...d.metadata_json,
                    heart_rate: data.heart_rate !== undefined ? data.heart_rate : d.metadata_json?.heart_rate,
                    spo2: data.spo2 !== undefined ? data.spo2 : d.metadata_json?.spo2,
                    battery_level: data.battery_level !== undefined ? data.battery_level : d.metadata_json?.battery_level,
                    network: data.network !== undefined ? data.network : d.metadata_json?.network
                  }
                } 
              : d
           ));
        }
        else if (topic === 'simulation/agent_log') {
          setAgentLogs(prev => [...prev, data]);
        }
        else if (topic === 'simulation/attack_toggle') {
          setAttackActive(data.attack_active);
        }
        else if (topic === 'simulation/reset') {
          setAgentLogs([]);
          setDevices(prev => prev.map(d => ({ ...d, status: 'active' })));
        }
        else if (topic === 'alerts' || topic === 'anomalies') {
            const isDeviceAnomaly = data.type?.includes("Device") || data.severity === "critical";
            
            const newAlert: Alert = {
              id: data.id || Math.floor(Math.random() * 1000000),
              device_id: data.device_id || "UNKNOWN",
              type: data.type || (isDeviceAnomaly ? 'Device Behavior Anomaly' : 'Network Anomaly'),
              severity: data.severity || (isDeviceAnomaly ? 'critical' : 'high'),
              description: data.description || 'Abnormal behavior detected by AI Agents.',
              timestamp: data.timestamp || new Date().toISOString(),
              is_resolved: false
            };

            setAlerts(prev => [newAlert, ...prev].slice(0, 50));

            // Auto-quarantine on critical
            if (newAlert.severity === 'critical') {
                setDevices(prev => prev.map(d => 
                    d.device_id === newAlert.device_id ? {...d, status: 'quarantined'} : d
                ));
            }
        }
      } catch (e) {
        console.error("Failed parsing WS message", e);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
    };

    return () => {
      ws.close();
    };
  }, []);

  return { devices, alerts, threatIntel, auditLogs, agentLogs, attackActive, toggleAttack, resetSimulation, forceQuarantine, escalateIncident, loading };
};
