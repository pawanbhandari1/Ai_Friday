import { useCallback, useEffect, useState } from 'react';
import { Lock, Moon, RefreshCw, ShieldCheck, Sun } from 'lucide-react';
import { INITIAL_DEFECT_ALERTS } from './data/pharmaSeed';
import { BatchDefectAlert, DemoUser, FeedbackEntry } from './types/pharma';
import { SignInScreen } from './components/SignInScreen';
import { TopBar, WorkspaceTab } from './components/TopBar';
import { MetricsRibbon } from './components/MetricsRibbon';
import { DefectCopilotWorkspace } from './components/DefectCopilotWorkspace';
import { LinesTelemetryView } from './components/LinesTelemetryView';
import { IngestionConnectorsView } from './components/IngestionConnectorsView';

export default function App() {
  const [currentUser, setCurrentUser] = useState<DemoUser | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('copilot');
  const [isDark, setIsDark] = useState(true);
  const [alerts, setAlerts] = useState<BatchDefectAlert[]>(INITIAL_DEFECT_ALERTS);
  const [selectedAlertId, setSelectedAlertId] = useState<string>(
    INITIAL_DEFECT_ALERTS[0].id
  );
  const [privacyShieldEnabled, setPrivacyShieldEnabled] = useState(true);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
  const [feedbackEntries, setFeedbackEntries] = useState<FeedbackEntry[]>([]);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  const handleManualSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/mes/sync', { method: 'POST' });
      if (res.ok) {
        setLastSyncedAt(
          new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );
      }
    } catch {
      // Keep UI responsive
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const timer = setInterval(() => {
      handleManualSync();
    }, 15000);
    return () => clearInterval(timer);
  }, [autoRefreshEnabled, handleManualSync]);

  const handleResolveAlert = (id: string) => {
    if (!currentUser) return;
    const signOffTime = `${String(new Date().getUTCHours()).padStart(2, '0')}:${String(
      new Date().getUTCMinutes()
    ).padStart(2, '0')} UTC`;
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === id
          ? {
              ...alert,
              severity: 'Resolved',
              batchHoldRisk: 'Cleared — Batch Released Under QA Electronic Signature',
              actualResolutionMin: alert.expectedResolutionMin,
              signedOffBy: `${currentUser.name} (${currentUser.title})`,
              signedOffAt: signOffTime,
              cppParameters: alert.cppParameters.map((p) => ({
                ...p,
                currentValue: p.targetNominal,
                isOutOfSpec: false,
                cpk: 1.46,
                zScore: 0.1,
              })),
            }
          : alert
      )
    );
  };

  const handleIngestAlert = (newAlert: BatchDefectAlert) => {
    setAlerts((prev) => [newAlert, ...prev]);
    setSelectedAlertId(newAlert.id);
    setActiveTab('copilot');
  };

  const handleSubmitFeedback = (entry: FeedbackEntry) => {
    setFeedbackEntries((prev) => [...prev, entry]);
  };

  if (!currentUser) {
    return (
      <SignInScreen
        onSelectUser={(user) => {
          setCurrentUser(user);
          setActiveTab('copilot');
        }}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
      />
    );
  }

  return (
    <div className="min-h-screen cleanroom-mesh-bg text-slate-900 dark:text-slate-100 flex flex-col">
      <TopBar
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        currentUser={currentUser}
        onSwitchUser={(u) => setCurrentUser(u)}
        onSignOut={() => setCurrentUser(null)}
      />

      <main className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5 space-y-5 flex-1">
        {/* Workspace Control Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {activeTab === 'copilot'
                ? 'GMP Batch Quality Copilot'
                : activeTab === 'telemetry'
                ? 'Production Lines & MES Telemetry'
                : 'Batch Ingestion & MES / LIMS Connectors'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {currentUser.role === 'operator'
                ? `Operator View · ${currentUser.assignedLine} · Plain-language root causes & cleanroom checklists`
                : `QA Validation View · ${currentUser.assignedLine} · Cpk statistical correlation, CAPA logs & batch sign-off`}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setPrivacyShieldEnabled((p) => !p)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                privacyShieldEnabled
                  ? 'bg-sky-600/15 text-sky-700 dark:text-sky-300 border border-sky-500/30'
                  : 'glass-surface-subtle text-slate-600 dark:text-slate-300'
              }`}
            >
              {privacyShieldEnabled ? (
                <Lock className="w-3.5 h-3.5" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5" />
              )}
              <span>
                Formulation Shield: {privacyShieldEnabled ? 'Masked' : 'Unmasked'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium glass-surface-subtle hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-sky-500' : ''}`} />
              <span>Sync MES ({lastSyncedAt})</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDark((d) => !d)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium glass-surface-subtle hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isDark ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-sky-600" />
              )}
              <span>{isDark ? 'Cleanroom Light' : 'Midnight Glass'}</span>
            </button>
          </div>
        </div>

        {/* Live Impact & Resolution KPI Ribbon */}
        <MetricsRibbon alerts={alerts} feedbackEntries={feedbackEntries} />

        {/* Active Workspace View */}
        {activeTab === 'copilot' && (
          <DefectCopilotWorkspace
            alerts={alerts}
            selectedAlertId={selectedAlertId}
            onSelectAlert={setSelectedAlertId}
            currentUser={currentUser}
            privacyShieldEnabled={privacyShieldEnabled}
            isDark={isDark}
            onResolveAlert={handleResolveAlert}
            onSubmitFeedback={handleSubmitFeedback}
            feedbackEntries={feedbackEntries}
          />
        )}

        {activeTab === 'telemetry' && (
          <LinesTelemetryView
            alerts={alerts}
            isDark={isDark}
            onJumpToAlert={(id) => {
              setSelectedAlertId(id);
              setActiveTab('copilot');
            }}
          />
        )}

        {activeTab === 'ingestion' && (
          <IngestionConnectorsView
            onIngestAlert={handleIngestAlert}
            privacyShieldEnabled={privacyShieldEnabled}
            onTogglePrivacyShield={() => setPrivacyShieldEnabled((p) => !p)}
            autoRefreshEnabled={autoRefreshEnabled}
            onToggleAutoRefresh={() => setAutoRefreshEnabled((a) => !a)}
            lastSyncedAt={lastSyncedAt}
            isSyncing={isSyncing}
            onManualSync={handleManualSync}
            alerts={alerts}
          />
        )}
      </main>
    </div>
  );
}
