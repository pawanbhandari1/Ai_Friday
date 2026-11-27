import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PRODUCTION_LINES } from '../data/pharmaSeed';
import { BatchDefectAlert } from '../types/pharma';

export interface PlantStreamPoint {
  timestamp: string;
  'LINE-01': number;
  'LINE-02': number;
  'LINE-03': number;
  'LINE-04': number;
}

interface LinesTelemetryViewProps {
  alerts: BatchDefectAlert[];
  plantStream: PlantStreamPoint[];
  liveStreamEnabled: boolean;
  isDark: boolean;
  onJumpToAlert: (alertId: string) => void;
}

export const LinesTelemetryView: React.FC<LinesTelemetryViewProps> = ({
  alerts,
  plantStream,
  liveStreamEnabled,
  isDark,
  onJumpToAlert,
}) => {
  const chartData = PRODUCTION_LINES.map((line) => ({
    name: line.lineId,
    fullName: line.lineName,
    beforeAi: line.meanResolutionMinBefore,
    withAi: line.meanResolutionMinWithAi,
    scrapSavedK: Math.round(line.scrapSavedUsd / 1000),
  }));

  const latestPlantPt = plantStream[plantStream.length - 1];

  return (
    <div className="space-y-5">
      {/* 4 Production Line Status Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {PRODUCTION_LINES.map((line) => {
          const matchingAlert = alerts.find((a) => a.lineId === line.lineId);
          const status = matchingAlert ? matchingAlert.severity : 'Nominal';
          const statusStyle =
            status === 'Critical Hold'
              ? 'text-rose-600 dark:text-rose-400'
              : status === 'Warning'
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-emerald-600 dark:text-emerald-400';
          const glyph = status === 'Critical Hold' ? '✖' : status === 'Warning' ? '▲' : '●';
          const liveOee =
            latestPlantPt && line.lineId in latestPlantPt
              ? Number(latestPlantPt[line.lineId as keyof PlantStreamPoint])
              : line.oeePct;

          return (
            <div
              key={line.lineId}
              className="glass-panel rounded-[22px] p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-slate-500 dark:text-slate-400">
                    {line.lineId}
                  </span>
                  <span className={`font-medium ${statusStyle}`}>
                    {glyph} {status === 'Resolved' ? 'Nominal' : status}
                  </span>
                </div>
                <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white mt-1.5">
                  {line.lineName}
                </h3>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {line.equipment}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200/80 dark:border-white/10 text-xs">
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Active Lot</div>
                  <div className="font-mono font-medium text-slate-900 dark:text-white mt-0.5">
                    {line.currentBatch}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Live Line OEE</div>
                  <div className="font-mono font-medium text-slate-900 dark:text-white mt-0.5">
                    {liveOee.toFixed(1)}%
                  </div>
                </div>
              </div>

              {matchingAlert && (
                <button
                  type="button"
                  onClick={() => onJumpToAlert(matchingAlert.id)}
                  className="w-full py-2 px-3 rounded-xl text-xs font-medium glass-surface-subtle hover:bg-sky-500/15 text-sky-600 dark:text-sky-400 transition-colors cursor-pointer"
                >
                  Inspect {matchingAlert.deviationId} in Copilot
                </button>
              )}
            </div>
          );
        })}
      </section>

      {/* Live Multi-Line SCADA Stability & OEE Telemetry Stream */}
      <section className="glass-panel rounded-[22px] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Real-Time Multi-Line SCADA Stability & OEE Stream
              </h3>
              {liveStreamEnabled && (
                <span className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Continuous 1.8s rolling OPC-UA telemetry across Tablet Compression, Granulation, Sterile Vial Filling, and Blister Inspection
            </p>
          </div>
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
            Window: {plantStream.length} ticks
          </span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={plantStream} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
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
                domain={[65, 100]}
                tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
                axisLine={false}
                tickLine={false}
                unit="%"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)',
                  borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.1)',
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line
                type="monotone"
                dataKey="LINE-01"
                name="Line 1 (Tablet Press)"
                stroke="#f43f5e"
                strokeWidth={2.2}
                isAnimationActive={false}
                dot={{ r: 2.5 }}
              />
              <Line
                type="monotone"
                dataKey="LINE-02"
                name="Line 2 (Fluid-Bed Dryer)"
                stroke="#f59e0b"
                strokeWidth={2.2}
                isAnimationActive={false}
                dot={{ r: 2.5 }}
              />
              <Line
                type="monotone"
                dataKey="LINE-03"
                name="Line 3 (Sterile Isolator)"
                stroke="#0ea5e9"
                strokeWidth={2.2}
                isAnimationActive={false}
                dot={{ r: 2.5 }}
              />
              <Line
                type="monotone"
                dataKey="LINE-04"
                name="Line 4 (Blister Vision)"
                stroke="#10b981"
                strokeWidth={2.2}
                isAnimationActive={false}
                dot={{ r: 2.5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Cross-Line Comparison Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-panel rounded-[22px] p-5 sm:p-6 space-y-4">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Mean Deviation Resolution Time (Baseline vs. GenAI Copilot)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Minutes from SCADA/vision quality alarm to GMP-verified corrective execution
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDark ? 'rgba(148,163,184,0.14)' : 'rgba(15,23,42,0.08)'}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  unit="m"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)',
                    borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.1)',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar
                  dataKey="beforeAi"
                  name="Manual Siloed Investigation (min)"
                  fill="#64748b"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="withAi"
                  name="With GenAI Copilot (min)"
                  fill="#0ea5e9"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel rounded-[22px] p-5 sm:p-6 space-y-4">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Batch Scrap & Rework Protected by Production Line ($k)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Quarterly cumulative rework & hold avoidance across Lines 1–4
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDark ? 'rgba(148,163,184,0.14)' : 'rgba(15,23,42,0.08)'}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  unit="k"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)',
                    borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.1)',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Bar
                  dataKey="scrapSavedK"
                  name="Protected Batch Value ($k)"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Cross-Line High-Density CPP Telemetry Matrix */}
      <section className="glass-panel rounded-[22px] p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Live Critical Process Parameter (CPP) Control Matrix
          </h3>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            All 4 Automated GMP Suites
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400">
                <th className="py-2.5 pr-3 font-medium">Line / Lot</th>
                <th className="py-2.5 px-3 font-medium">CPP Sensor</th>
                <th className="py-2.5 px-3 font-medium text-right">Current</th>
                <th className="py-2.5 px-3 font-medium text-right">Golden Range</th>
                <th className="py-2.5 px-3 font-medium text-right">Cpk</th>
                <th className="py-2.5 pl-3 font-medium text-right">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/5">
              {alerts.flatMap((alert) =>
                alert.cppParameters.map((p) => (
                  <tr
                    key={`${alert.id}-${p.id}`}
                    onClick={() => onJumpToAlert(alert.id)}
                    className="hover:bg-slate-100/70 dark:hover:bg-white/5 cursor-pointer"
                  >
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {alert.lineId}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {alert.batchLotNumber}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-200">{p.name}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 dark:text-white">
                      {p.currentValue} {p.unit}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500 dark:text-slate-400">
                      {p.goldenMin}–{p.goldenMax} {p.unit}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                      {p.cpk.toFixed(2)}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-medium">
                      {p.isOutOfSpec ? (
                        <span className="text-rose-600 dark:text-rose-400">▲ Out of Spec</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">● In Spec</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
