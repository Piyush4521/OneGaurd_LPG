import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { CriticalBanner } from './components/CriticalBanner';
import { SimulationBar } from './components/SimulationBar';
import { Footer } from './components/Footer';
import { DashboardView } from './views/DashboardView';
import { DevicesView } from './views/DevicesView';
import { HistoryView } from './views/HistoryView';
import { SettingsView } from './views/SettingsView';
import { PrivacyView } from './views/PrivacyView';
import { TermsView } from './views/TermsView';
import { AccountView } from './views/AccountView';
import { dataService } from './services/dataService';
import { DeviceTelemetry, DeviceMetadata, AlertEvent, UserSettings } from './types/telemetry';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [telemetry, setTelemetry] = useState<DeviceTelemetry>(dataService.getTelemetry());
  const [device] = useState<DeviceMetadata>(dataService.getDeviceMetadata());
  const [settings, setSettings] = useState<UserSettings>(dataService.getSettings());
  const [events, setEvents] = useState<AlertEvent[]>(dataService.getEvents());

  useEffect(() => {
    const unsubscribe = dataService.subscribeTelemetry((updatedTelemetry) => {
      setTelemetry(updatedTelemetry);
      setEvents(dataService.getEvents());
    });
    return () => unsubscribe();
  }, []);

  const handleAcknowledgeEvent = (id: string) => {
    dataService.acknowledgeEvent(id);
    setEvents(dataService.getEvents());
  };

  const handleSaveSettings = (newSettings: UserSettings) => {
    dataService.saveSettings(newSettings);
    setSettings(newSettings);
  };

  const handleTriggerTestAlert = () => {
    dataService.triggerTestAlert();
    setEvents(dataService.getEvents());
  };

  const handleDismissLeak = () => {
    dataService.setSimulationState('normal');
  };

  return (
    <div className="app-container">
      {/* High-Contrast Critical Warning Banner */}
      <CriticalBanner
        telemetry={telemetry}
        onAcknowledge={handleDismissLeak}
      />

      {/* Main Header & Navigation */}
      <Header
        currentView={currentView}
        onNavigate={setCurrentView}
        telemetry={telemetry}
      />

      {/* Application Content Area */}
      <main className="main-content">
        {/* Hardware Diagnostic & State Simulation Bar */}
        <SimulationBar />

        {/* View Routing */}
        {currentView === 'dashboard' && (
          <DashboardView
            telemetry={telemetry}
            device={device}
            settings={settings}
            events={events}
            onAcknowledgeEvent={handleAcknowledgeEvent}
            onNavigate={setCurrentView}
          />
        )}

        {currentView === 'devices' && (
          <DevicesView
            device={device}
            telemetry={telemetry}
          />
        )}

        {currentView === 'history' && (
          <HistoryView
            events={events}
            onAcknowledge={handleAcknowledgeEvent}
          />
        )}

        {currentView === 'settings' && (
          <SettingsView
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onTriggerTestAlert={handleTriggerTestAlert}
          />
        )}

        {currentView === 'privacy' && (
          <PrivacyView onBack={() => setCurrentView('dashboard')} />
        )}

        {currentView === 'terms' && (
          <TermsView onBack={() => setCurrentView('dashboard')} />
        )}

        {currentView === 'account' && (
          <AccountView onNavigate={setCurrentView} />
        )}
      </main>

      {/* Footer with Policy Links and Custom Domain Status */}
      <Footer onNavigate={setCurrentView} />
    </div>
  );
};
export default App;
