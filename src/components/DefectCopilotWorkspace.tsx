import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CheckCircle2,
  CheckSquare,
  FileCheck2,
  Lock,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Square,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { EXPECTED_QUESTIONS } from '../data/pharmaSeed';
import {
  AiExplanationPayload,
  BatchDefectAlert,
  ChatMessage,
  DefectSeverity,
  DemoUser,
  FeedbackEntry,
} from '../types/pharma';

interface DefectCopilotWorkspaceProps {
  alerts: BatchDefectAlert[];
  selectedAlertId: string;
  onSelectAlert: (id: string) => void;
  currentUser: DemoUser;
  privacyShieldEnabled: boolean;
  isDark: boolean;
  onResolveAlert: (id: string) => void;
  onSubmitFeedback: (entry: FeedbackEntry) => void;
  feedbackEntries: FeedbackEntry[];
}

function renderFormattedText(raw: string): React.ReactNode {
  const lines = raw.split('\n');
  return lines.map((line, lineIdx) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={lineIdx} className={lineIdx > 0 ? 'mt-1.5' : ''}>
        {parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={pIdx} className="font-semibold text-slate-900 dark:text-white">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return <React.Fragment key={pIdx}>{part}</React.Fragment>;
        })}
      </p>
    );
  });
}

function severityLabel(severity: DefectSeverity): { glyph: string; classes: string } {
  if (severity === 'Critical Hold') {
    return {
      glyph: '✖',
      classes: 'text-rose-600 dark:text-rose-400 font-medium',
    };
  }
  if (severity === 'Warning') {
    return {
      glyph: '▲',
      classes: 'text-amber-600 dark:text-amber-400 font-medium',
    };
  }
  return {
    glyph: '●',
    classes: 'text-emerald-600 dark:text-emerald-400 font-medium',
  };
}

export const DefectCopilotWorkspace: React.FC<DefectCopilotWorkspaceProps> = ({
  alerts,
  selectedAlertId,
  onSelectAlert,
  currentUser,
  privacyShieldEnabled,
  isDark,
  onResolveAlert,
  onSubmitFeedback,
  feedbackEntries,
}) => {
  const [severityFilter, setSeverityFilter] = useState<'All' | DefectSeverity>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedParamId, setSelectedParamId] = useState<string>('');
  const [explanation, setExplanation] = useState<AiExplanationPayload | null>(null);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});
  const [chatHistoryByDefect, setChatHistoryByDefect] = useState<Record<string, ChatMessage[]>>({});
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);

  // Feedback local draft
  const [draftRating, setDraftRating] = useState<'up' | 'down' | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSubmittedMsg, setFeedbackSubmittedMsg] = useState<string | null>(null);

  const selectedAlert = useMemo(
    () => alerts.find((a) => a.id === selectedAlertId) ?? alerts[0],
    [alerts, selectedAlertId]
  );

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      const matchesFilter = severityFilter === 'All' || a.severity === severityFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        a.defectTitle.toLowerCase().includes(q) ||
        a.batchLotNumber.toLowerCase().includes(q) ||
        a.lineName.toLowerCase().includes(q) ||
        a.deviationId.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [alerts, severityFilter, searchQuery]);

  // Reset active CPP chart param when switching defect
  useEffect(() => {
    if (selectedAlert?.cppParameters.length) {
      setSelectedParamId(selectedAlert.cppParameters[0].id);
    }
    setCheckedSteps({});
    setDraftRating(null);
    setFeedbackComment('');
    setFeedbackSubmittedMsg(null);
  }, [selectedAlert?.id]);

  // Fetch GenAI root-cause explanation whenever defect, role, or privacy shield changes
  useEffect(() => {
    if (!selectedAlert) return;
    let cancelled = false;
    const fetchExplanation = async () => {
      setIsLoadingExplanation(true);
      try {
        const res = await fetch('/api/ai/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            defect: selectedAlert,
            role: currentUser.role,
            privacyShieldEnabled,
          }),
        });
        if (!res.ok) throw new Error('Failed to load AI explanation');
        const data = (await res.json()) as AiExplanationPayload;
        if (!cancelled) {
          setExplanation(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) {
          setIsLoadingExplanation(false);
        }
      }
    };
    fetchExplanation();
    return () => {
      cancelled = true;
    };
  }, [selectedAlert?.id, selectedAlert?.severity, currentUser.role, privacyShieldEnabled]);

  const activeParam = useMemo(() => {
    if (!selectedAlert) return null;
    return (
      selectedAlert.cppParameters.find((p) => p.id === selectedParamId) ??
      selectedAlert.cppParameters[0]
    );
  }, [selectedAlert, selectedParamId]);

  const currentChatMessages = chatHistoryByDefect[selectedAlert?.id ?? ''] ?? [];

  const handleAskQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || !selectedAlert || isSendingChat) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const existing = chatHistoryByDefect[selectedAlert.id] ?? [];
    const nextHistory = [...existing, userMsg];
    setChatHistoryByDefect((prev) => ({ ...prev, [selectedAlert.id]: nextHistory }));
    setChatInput('');
    setIsSendingChat(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defect: selectedAlert,
          role: currentUser.role,
          message: trimmed,
          history: nextHistory,
          privacyShieldEnabled,
        }),
      });
      const data = (await res.json()) as {
        text: string;
        citations?: string[];
        sourceEngine?: 'gemini' | 'deterministic-gmp';
      };

      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        sender: 'assistant',
        text: data.text || 'Unable to generate response.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        citations: data.citations ?? [],
        sourceEngine: data.sourceEngine,
      };
      setChatHistoryByDefect((prev) => ({
        ...prev,
        [selectedAlert.id]: [...nextHistory, aiMsg],
      }));
    } catch {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: 'Connection interrupted while querying GMP Copilot. Please retry.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatHistoryByDefect((prev) => ({
        ...prev,
        [selectedAlert.id]: [...nextHistory, errMsg],
      }));
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleFeedbackSave = () => {
    if (!draftRating || !selectedAlert) return;
    onSubmitFeedback({
      defectId: selectedAlert.id,
      rating: draftRating,
      comment: feedbackComment.trim(),
      submittedAt: new Date().toISOString(),
      submittedBy: currentUser.name,
    });
    setFeedbackSubmittedMsg('Feedback logged to QMS Copilot accuracy ledger.');
    setFeedbackComment('');
  };

  if (!selectedAlert) {
    return (
      <div className="glass-panel rounded-[22px] p-10 text-center">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          No batch deviations currently loaded. Use Ingestion & MES to import a batch payload.
        </p>
      </div>
    );
  }

  const sevMeta = severityLabel(selectedAlert.severity);
  const existingFeedbackCount = feedbackEntries.filter((f) => f.defectId === selectedAlert.id).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* LEFT COLUMN: Batch Alert Queue */}
      <aside className="lg:col-span-4 glass-panel rounded-[22px] p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Active Batch Defect Queue
          </h2>
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
            {filteredAlerts.length} of {alerts.length}
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by lot #, line, or defect..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-white/15 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          />
        </div>

        {/* Interactive Filter Segmented Control */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900/70 overflow-x-auto">
          {(['All', 'Critical Hold', 'Warning', 'Resolved'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setSeverityFilter(tab)}
              className={`px-2.5 py-1.5 text-[11px] font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                severityFilter === tab
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Queue Rows */}
        <div className="divide-y divide-slate-200/70 dark:divide-white/10">
          {filteredAlerts.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              No batch alerts match the active filter.
            </div>
          ) : (
            filteredAlerts.map((alert) => {
              const isSelected = alert.id === selectedAlert.id;
              const s = severityLabel(alert.severity);
              return (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => onSelectAlert(alert.id)}
                  className={`w-full text-left py-3.5 px-3 rounded-xl transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-sky-500/12 dark:bg-sky-400/15'
                      : 'hover:bg-slate-100/80 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className={s.classes}>
                      {s.glyph} {alert.severity}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {alert.detectedAt}
                    </span>
                  </div>
                  <div className="font-display text-sm font-semibold text-slate-900 dark:text-white mt-1">
                    {alert.defectTitle}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {alert.batchLotNumber}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{alert.lineName.split(':')[0]}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">${(alert.batchValueAtRiskUsd / 1000).toFixed(1)}k</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* RIGHT COLUMN: Correlated Context + CPP Chart + AI Explanation + Copilot Chat */}
      <div className="lg:col-span-8 space-y-5">
        {/* 1. Unified Batch Defect, LIMS & CAPA Context + Telemetry Chart */}
        <section className="glass-panel rounded-[22px] p-5 sm:p-6 space-y-5">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-white/10">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                <span className={sevMeta.classes}>
                  {sevMeta.glyph} {selectedAlert.severity}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{selectedAlert.deviationId}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{selectedAlert.batchLotNumber}</span>
                <span aria-hidden="true">·</span>
                <span>{selectedAlert.equipmentName}</span>
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white">
                {selectedAlert.defectTitle}
              </h2>
              <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2 flex-wrap">
                {privacyShieldEnabled && (
                  <Lock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                )}
                <span>
                  {privacyShieldEnabled ? selectedAlert.maskedDrugSku : selectedAlert.drugSku}
                </span>
                <span aria-hidden="true">·</span>
                <span>{selectedAlert.batchHoldRisk}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Batch Value at Risk</div>
                <div className="font-mono text-lg font-semibold text-slate-900 dark:text-white">
                  ${selectedAlert.batchValueAtRiskUsd.toLocaleString()}
                </div>
              </div>
              {currentUser.role === 'qa_engineer' && selectedAlert.severity !== 'Resolved' && (
                <button
                  type="button"
                  onClick={() => onResolveAlert(selectedAlert.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors whitespace-nowrap cursor-pointer"
                >
                  <FileCheck2 className="w-3.5 h-3.5" />
                  QA Sign-Off & Clear Hold
                </button>
              )}
            </div>
          </div>

          {selectedAlert.signedOffBy && (
            <div className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3.5 py-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                Electronic QA Sign-Off completed by <strong>{selectedAlert.signedOffBy}</strong> at{' '}
                {selectedAlert.signedOffAt}. Batch cleared for downstream release.
              </span>
            </div>
          )}

          {/* Silo-Breaking Side-by-Side Context: Quality/LIMS vs. Historical CAPAs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2.5">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Quality Inspection & LIMS Context
              </div>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {selectedAlert.inspectionSummary}
              </p>
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                <strong className="text-slate-700 dark:text-slate-200">LIMS Assay:</strong>{' '}
                {selectedAlert.limsContext}
              </p>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                Stage: {selectedAlert.mesBatchStage}
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Matched Historical CAPA Resolutions
              </div>
              <div className="space-y-2.5">
                {selectedAlert.historicalCapas.map((capa) => (
                  <div
                    key={capa.capaId}
                    className="p-3 rounded-xl glass-surface-subtle text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-sky-600 dark:text-sky-400">
                        {capa.capaId} · {capa.pastLotNumber}
                      </span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">
                        {capa.similarityPct}% match · {capa.resolutionSuccessRate}% success
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                      {capa.verifiedRootCause}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Action: {capa.correctiveActionTaken} ({capa.resolutionTimeMin} min)
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive MES / SCADA Critical Process Parameter Chart */}
          {activeParam && (
            <div className="pt-4 border-t border-slate-200/80 dark:border-white/10 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Correlated MES & SCADA Process Parameter Telemetry
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Shaded band marks validated Golden-Batch limits ({activeParam.goldenMin}–
                    {activeParam.goldenMax} {activeParam.unit}) · Current:{' '}
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      {activeParam.currentValue} {activeParam.unit}
                    </span>
                  </div>
                </div>

                {/* Parameter Tabs */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900/70 overflow-x-auto">
                  {selectedAlert.cppParameters.map((param) => (
                    <button
                      key={param.id}
                      type="button"
                      onClick={() => setSelectedParamId(param.id)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                        activeParam.id === param.id
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {param.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={selectedAlert.telemetrySeries}
                    margin={{ top: 10, right: 16, left: 0, bottom: 4 }}
                  >
                    <defs>
                      <linearGradient id="cppFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={isDark ? 'rgba(148,163,184,0.14)' : 'rgba(15,23,42,0.08)'}
                    />
                    <XAxis
                      dataKey="timestamp"
                      tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)',
                        borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.1)',
                        borderRadius: '12px',
                        fontSize: '12px',
                      }}
                    />
                    <ReferenceArea
                      y1={activeParam.goldenMin}
                      y2={activeParam.goldenMax}
                      fill="#10b981"
                      fillOpacity={0.12}
                    />
                    <ReferenceLine
                      y={activeParam.goldenMax}
                      stroke="#10b981"
                      strokeDasharray="4 4"
                      label={{
                        value: `USL ${activeParam.goldenMax}`,
                        position: 'insideTopRight',
                        fill: '#10b981',
                        fontSize: 10,
                      }}
                    />
                    <ReferenceLine
                      y={activeParam.goldenMin}
                      stroke="#10b981"
                      strokeDasharray="4 4"
                      label={{
                        value: `LSL ${activeParam.goldenMin}`,
                        position: 'insideBottomRight',
                        fill: '#10b981',
                        fontSize: 10,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey={activeParam.id}
                      name={`${activeParam.name} (${activeParam.unit})`}
                      stroke={activeParam.isOutOfSpec ? '#f43f5e' : '#0ea5e9'}
                      strokeWidth={2.5}
                      fill="url(#cppFill)"
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* QA Engineer Exclusive Statistical Correlation Matrix */}
              {currentUser.role === 'qa_engineer' && (
                <div className="overflow-x-auto pt-2">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400">
                        <th className="py-2 pr-3 font-medium">Critical Process Parameter</th>
                        <th className="py-2 px-3 font-medium text-right">Current</th>
                        <th className="py-2 px-3 font-medium text-right">Golden Spec</th>
                        <th className="py-2 px-3 font-medium text-right">Cpk</th>
                        <th className="py-2 px-3 font-medium text-right">Z-Score</th>
                        <th className="py-2 pl-3 font-medium text-right">First Drift</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 dark:divide-white/5 font-mono">
                      {selectedAlert.cppParameters.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-100/60 dark:hover:bg-white/5">
                          <td className="py-2 pr-3 font-sans font-medium text-slate-800 dark:text-slate-200">
                            {p.name}
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-semibold ${
                              p.isOutOfSpec
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {p.currentValue} {p.unit}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-300">
                            {p.goldenMin}–{p.goldenMax} {p.unit}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                            {p.cpk.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                            {p.zScore > 0 ? `+${p.zScore.toFixed(1)}` : p.zScore.toFixed(1)}
                          </td>
                          <td className="py-2 pl-3 text-right text-slate-600 dark:text-slate-300">
                            {p.firstDriftTimestamp}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 2. GenAI Root-Cause Explanation & GMP Corrective Action Checklist */}
        <section className="glass-panel rounded-[22px] p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-sky-600 dark:text-sky-400">
                GenAI Root-Cause & GMP Remediation Engine
                {explanation?.privacyRedactedFields.length
                  ? ' · Proprietary Formulation Masked'
                  : ''}
              </div>
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white mt-0.5">
                {isLoadingExplanation
                  ? 'Correlating SCADA, LIMS & CAPA history...'
                  : explanation?.probableRootCauseTitle}
              </h3>
            </div>

            {explanation && !isLoadingExplanation && (
              <div className="flex items-center gap-4 shrink-0">
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Confidence</div>
                  <div className="font-mono text-base font-semibold text-emerald-600 dark:text-emerald-400">
                    {explanation.confidencePct}%
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Est. Value Protected
                  </div>
                  <div className="font-mono text-base font-semibold text-slate-900 dark:text-white">
                    ${explanation.estimatedBatchValueProtectedUsd.toLocaleString()}
                  </div>
                </div>
              </div>
            )}
          </div>

          {isLoadingExplanation ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-5/6" />
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-4/6" />
              <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl w-full mt-2" />
            </div>
          ) : explanation ? (
            <>
              {/* Plain-Language + Technical Summary */}
              <div className="space-y-3">
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                  {explanation.plainLanguageSummary}
                </p>

                <div className="p-3.5 rounded-xl glass-surface-subtle text-xs space-y-1.5">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                    Recommended Sub-Lot Quarantine Action
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">
                    {explanation.recommendedHoldAction}
                  </p>
                </div>
              </div>

              {/* Correlated CPP Sequence */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Correlated CPP / Machine Drift Sequence
                </div>
                <div className="space-y-1.5 font-mono text-xs text-slate-600 dark:text-slate-300">
                  {explanation.correlatedAnomalySequence.map((line, i) => (
                    <div key={i} className="px-3 py-2 rounded-xl glass-surface-subtle">
                      {line}
                    </div>
                  ))}
                </div>
              </div>

              {/* Prioritized Step-by-Step GMP Corrective Actions */}
              <div className="space-y-2.5">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Prioritized GMP-Safe Corrective Actions (Click to Check Off)
                </div>
                <div className="space-y-2">
                  {explanation.correctiveActions.map((step) => {
                    const checked = Boolean(checkedSteps[step.id]);
                    const text =
                      currentUser.role === 'operator'
                        ? step.operatorInstruction
                        : step.qaTechnicalDetail;
                    return (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() =>
                          setCheckedSteps((prev) => ({ ...prev, [step.id]: !prev[step.id] }))
                        }
                        className={`w-full text-left p-3.5 rounded-xl border transition-colors flex items-start gap-3 cursor-pointer ${
                          checked
                            ? 'bg-emerald-500/10 border-emerald-500/30'
                            : 'glass-surface-subtle hover:bg-white/80 dark:hover:bg-slate-800/70'
                        }`}
                      >
                        {checked ? (
                          <CheckSquare className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span
                              className={`font-semibold ${
                                step.priority === 'Immediate'
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : step.priority === 'Verification'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-sky-600 dark:text-sky-400'
                              }`}
                            >
                              {step.priority}
                            </span>
                            <span className="font-mono text-slate-500 dark:text-slate-400">
                              {step.gmpReference}
                              {step.requiresDualSignOff ? ' · Dual Sign-Off' : ''}
                            </span>
                          </div>
                          <p
                            className={`text-xs mt-1 leading-relaxed ${
                              checked
                                ? 'line-through text-slate-500 dark:text-slate-400'
                                : 'text-slate-800 dark:text-slate-100'
                            }`}
                          >
                            {text}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Operator Helpfulness Feedback Loop */}
              <div className="pt-4 border-t border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-600 dark:text-slate-300">
                    Was this explanation clear and actionable?
                  </span>
                  <button
                    type="button"
                    onClick={() => setDraftRating('up')}
                    aria-label="Helpful explanation"
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      draftRating === 'up'
                        ? 'bg-emerald-600 text-white'
                        : 'glass-surface-subtle text-slate-700 dark:text-slate-200 hover:bg-emerald-500/15'
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    Helpful
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftRating('down')}
                    aria-label="Needs clarification"
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      draftRating === 'down'
                        ? 'bg-rose-600 text-white'
                        : 'glass-surface-subtle text-slate-700 dark:text-slate-200 hover:bg-rose-500/15'
                    }`}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                    Needs Detail
                  </button>
                  {existingFeedbackCount > 0 && (
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      ({existingFeedbackCount} logged)
                    </span>
                  )}
                </div>

                {draftRating && (
                  <div className="flex items-center gap-2 flex-1 sm:max-w-sm">
                    <input
                      type="text"
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                      placeholder="Optional shift note..."
                      className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-white/15 text-slate-900 dark:text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleFeedbackSave}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white whitespace-nowrap cursor-pointer"
                    >
                      Save
                    </button>
                  </div>
                )}

                {feedbackSubmittedMsg && !draftRating && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400">
                    {feedbackSubmittedMsg}
                  </span>
                )}
              </div>
            </>
          ) : null}
        </section>

        {/* 3. Interactive Follow-Up Q&A Copilot Dialog (With Expected Questions) */}
        <section className="glass-panel rounded-[22px] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Batch-Grounded Follow-Up Q&A Copilot
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Grounded in {selectedAlert.batchLotNumber} · {selectedAlert.deviationId}
            </span>
          </div>

          {/* Expected Question Chips */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Expected Shift & QA Questions (Click to Ask)
            </div>
            <div className="flex flex-wrap gap-2">
              {EXPECTED_QUESTIONS.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  disabled={isSendingChat}
                  onClick={() => handleAskQuestion(q.text)}
                  className="text-left px-3 py-1.5 rounded-xl text-xs font-medium glass-surface-subtle hover:bg-sky-500/15 hover:border-sky-400/50 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {q.text}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation Thread */}
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {currentChatMessages.length === 0 ? (
              <div className="p-4 rounded-xl glass-surface-subtle text-xs text-slate-500 dark:text-slate-400">
                Select any expected question above or ask a custom question about{' '}
                <strong>{selectedAlert.defectTitle}</strong> on{' '}
                <span className="font-mono">{selectedAlert.batchLotNumber}</span>.
              </div>
            ) : (
              currentChatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'ml-8 bg-sky-600 text-white'
                      : 'mr-4 glass-surface-subtle text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1 opacity-75 text-[11px]">
                    <span className="font-medium">
                      {msg.sender === 'user' ? currentUser.name : 'GMP Quality Copilot'}
                    </span>
                    <span className="font-mono">{msg.timestamp}</span>
                  </div>
                  <div>{msg.sender === 'user' ? msg.text : renderFormattedText(msg.text)}</div>
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-2 pt-1.5 border-t border-slate-200/60 dark:border-white/10 text-[11px] font-mono text-sky-600 dark:text-sky-400">
                      Refs: {msg.citations.join(' · ')}
                    </div>
                  )}
                </div>
              ))
            )}
            {isSendingChat && (
              <div className="p-3 rounded-2xl mr-8 glass-surface-subtle text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-500" />
                Correlating batch telemetry and CAPA records...
              </div>
            )}
          </div>

          {/* Custom Question Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAskQuestion(chatInput);
            }}
            className="flex items-center gap-2 pt-1"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={`Ask about ${selectedAlert.batchLotNumber} CPPs, hold boundaries, or SOP steps...`}
              className="flex-1 px-3.5 py-2.5 text-xs rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-white/15 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || isSendingChat}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white transition-colors whitespace-nowrap cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              Ask Copilot
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};
