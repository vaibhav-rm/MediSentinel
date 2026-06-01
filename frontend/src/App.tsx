import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import NetworkMonitor from './components/NetworkMonitor';
import IoTMap from './components/IoTMap';
import ThreatIntel from './components/ThreatIntel';
import IncidentResponse from './components/IncidentResponse';
import ComplianceCenter from './components/ComplianceCenter';
import MLManagement from './components/MLManagement';
import AttackSimulationHub from './components/AttackSimulationHub';
import Settings from './components/Settings';
import { useStore } from './useStore';

function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const { devices, alerts } = useStore();

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard />;
      case 'network':
        return <NetworkMonitor />;
      case 'iot_map':
        return <IoTMap />;
      case 'threat_intel':
        return <ThreatIntel />;
      case 'incident_response':
        return <IncidentResponse />;
      case 'compliance':
        return <ComplianceCenter />;
      case 'ml_models':
        return <MLManagement />;
      case 'simulation_hub':
        return <AttackSimulationHub />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      {renderView()}
    </div>
  );
}

export default App;
