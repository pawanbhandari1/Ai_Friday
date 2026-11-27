import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Lock, Moon, Pause, RefreshCw, ShieldCheck, Sun } from 'lucide-react';
import { INITIAL_DEFECT_ALERTS, PRODUCTION_LINES } from './data/pharmaSeed';
import { BatchDefectAlert, CppTelemetryPoint, DemoUser, FeedbackEntry } from './types/pharma';
import { SignInScreen } from './components/SignInScreen';
import { TopBar, WorkspaceTab } from './components/TopBar';
import { MetricsRibbon } from './components/MetricsRibbon';
import { DefectCopilotWorkspace } from './components/DefectCopilotWorkspace';
import { LinesTelemetryView, PlantStreamPoint } from './components/LinesTelemetryView';
import { IngestionConnectorsView } from './components/IngestionConnectorsView';

function stepSensorValue(
  currentValue: number,
  targetNominal: number,
  goldenMin: number,
  goldenMax: number,
  isOutOfSpec: boolean,
  isResolved: boolean,
  tick: number,
  seedOffset: number
): number {
  const span = Math.max(Math.abs(goldenMax - goldenMin), 1);
  const precision = span < 5 ? 2 : span < 30 ? 1 : 0;

  if (isResolved || !isOutOfSpec) {
    const wave = Math.sin((tick + seedOffset) * 0.7) * (span * 0.14);
    const jitter = (Math.random() - 0.5) * (span * 0.08);
    const next = Math.min(
      goldenMax - span * 0.05,
      Math.max(goldenMin + span * 0.05, targetNominal + wave + jitter)
    );
    return Number(next.toFixed(precision));
  }

  // Keep out-of-spec parameter realistically oscillating in its drifted zone
  const driftDirection = currentValue >= targetNominal ? 1 : -1;
  const anchor =
    driftDirection > 0
      ? Math.max(currentValue, goldenMax + span * 0.35)
      : Math.min(currentValue, goldenMin - span * 0.35);
  const wave = Math.sin((tick + seedOffset) * 0.85) * (span * 0.16);
  const jitter = (Math.random() - 0.5) * (span * 0.12);
  // Smooth blend from anchor + oscillation
  let next = anchor * 0.25 + currentValue * 0.75 + wave * 0.5 + jitter;
  if (driftDirection > 0 && next <= goldenMax) {
    next = goldenMax + span * 0.22 + Math.abs(jitter);
  } else if (driftDirection < 0 && next >= goldenMin) {
    next = goldenMin - span * 0.22 - Math.abs(jitter);
  }
  return Number(next.toFixed(precision));
}

function buildInitialPlantStream(): PlantStreamPoint[] {
  const now = Date.now();
  return Array.from({ length: 12 }, (_, idx) => {
    const t = new Date(now - (11 - idx) * 2000);
    const label = t.toLocaleTimeString([], {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    return {
      timestamp: label,
      'LINE-01': Number((78.5 + Math.sin(idx * 0.6) * 2.1).toFixed(1)),
      'LINE-02': Number((86.0 + Math.cos(idx * 0.5) * 1.4).toFixed(1)),
      'LINE-03': Number((80.2 + Math.sin(idx * 0.75 + 1) * 2.4).toFixed(1)),
      'LINE-04': Number((91.4 + Math.cos(idx * 0.4 + 2) * 1.1).toFixed(1)),
    };
  });
}

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
  const [liveStreamEnabled, setLiveStreamEnabled] = useState(true);
  const [plantStream, setPlantStream] = useState<PlantStreamPoint[]>(buildInitialPlantStream);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
  const [feedbackEntries, setFeedbackEntries] = useState<FeedbackEntry[]>([]);
  const tickRef = useRef(0);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  // Live 1.8s SCADA Telemetry Stream across all lines & batch alerts
  useEffect(() => {
    if (!currentUser || !liveStreamEnabled) return;
    const interval = setInterval(() => {
      tickRef.current += 1;
      const tick = tickRef.current;
      const nowLabel = new Date().toLocaleTimeString([], {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      setAlerts((prevAlerts) => {
        const updated = prevAlerts.map((alert, alertIdx) => {
          const isResolved = alert.severity === 'Resolved';
          const nextPoint: CppTelemetryPoint = { timestamp: nowLabel };

          const nextParams = alert.cppParameters.map((p, paramIdx) => {
            const nextVal = stepSensorValue(
              p.currentValue,
              p.targetNominal,
              p.goldenMin,
              p.goldenMax,
              p.isOutOfSpec,
              isResolved,
              tick,
              alertIdx * 3 + paramIdx
            );
            nextPoint[p.id] = nextVal;
            return {
              ...p,
              currentValue: nextVal,
            };
          });

          const nextSeries = [...alert.telemetrySeries, nextPoint].slice(-14);
          return {
            ...alert,
            cppParameters: nextParams,
            telemetrySeries: nextSeries,
          };
        });

        // Also push corresponding plant-wide stability point for Lines 1–4
        setPlantStream((prevStream) => {
          const lineScore = (lineId: string, baseOee: number, offset: number) => {
            const lineAlerts = updated.filter((a) => a.lineId === lineId);
            const hasCritical = lineAlerts.some((a) => a.severity === 'Critical Hold');
            const hasWarning = lineAlerts.some((a) => a.severity === 'Warning');
            const penalty = hasCritical ? -4.2 : hasWarning ? -1.6 : 4.5;
            const wave = Math.sin((tick + offset) * 0.7) * 1.3 + (Math.random() - 0.5) * 0.9;
            return Number(Math.min(99.2, Math.max(68.0, baseOee + penalty + wave)).toFixed(1));
          };

          const pt: PlantStreamPoint = {
            timestamp: nowLabel,
            'LINE-01': lineScore('LINE-01', PRODUCTION_LINES[0].oeePct, 1),
            'LINE-02': lineScore('LINE-02', PRODUCTION_LINES[1].oeePct, 2),
            'LINE-03': lineScore('LINE-03', PRODUCTION_LINES[2].oeePct, 3),
            'LINE-04': lineScore('LINE-04', PRODUCTION_LINES[3].oeePct, 4),
          };
          return [...prevStream, pt].slice(-14);
        });

        return updated;
      });
    }, 1800);

    return () => clearInterval(interval);
  }, [currentUser, liveStreamEnabled]);

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
    const nowLabel = new Date().toLocaleTimeString([], {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    setAlerts((prev) =>
      prev.map((alert) => {
        if (alert.id !== id) return alert;
        const recoveredPoint: CppTelemetryPoint = { timestamp: nowLabel };
        const nextParams = alert.cppParameters.map((p) => {
          recoveredPoint[p.id] = p.targetNominal;
          return {
            ...p,
            currentValue: p.targetNominal,
            isOutOfSpec: false,
            cpk: 1.46,
            zScore: 0.1,
          };
        });
        return {
          ...alert,
          severity: 'Resolved',
          batchHoldRisk: 'Cleared — Batch Released Under QA Electronic Signature',
          actualResolutionMin: alert.expectedResolutionMin,
          signedOffBy: `${currentUser.name} (${currentUser.title})`,
          signedOffAt: signOffTime,
          cppParameters: nextParams,
          telemetrySeries: [...alert.telemetrySeries, recoveredPoint].slice(-14),
        };
      })
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
              onClick={() => setLiveStreamEnabled((s) => !s)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                liveStreamEnabled
                  ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                  : 'glass-surface-subtle text-slate-600 dark:text-slate-300'
              }`}
            >
              {liveStreamEnabled ? (
                <Activity className="w-3.5 h-3.5" />
              ) : (
                <Pause className="w-3.5 h-3.5" />
              )}
              <span>SCADA Stream: {liveStreamEnabled ? 'Live (1.8s)' : 'Paused'}</span>
            </button>

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
            liveStreamEnabled={liveStreamEnabled}
            onResolveAlert={handleResolveAlert}
            onSubmitFeedback={handleSubmitFeedback}
            feedbackEntries={feedbackEntries}
          />
        )}

        {activeTab === 'telemetry' && (
          <LinesTelemetryView
            alerts={alerts}
            plantStream={plantStream}
            liveStreamEnabled={liveStreamEnabled}
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
