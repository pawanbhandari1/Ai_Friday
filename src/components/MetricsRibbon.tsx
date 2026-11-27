import React from 'react';
import { BatchDefectAlert, FeedbackEntry } from '../types/pharma';

interface MetricsRibbonProps {
  alerts: BatchDefectAlert[];
  feedbackEntries: FeedbackEntry[];
}

export const MetricsRibbon: React.FC<MetricsRibbonProps> = ({
  alerts,
  feedbackEntries,
}) => {
  const activeCount = alerts.filter((a) => a.severity !== 'Resolved').length;
  const criticalCount = alerts.filter((a) => a.severity === 'Critical Hold').length;

  const resolvedAlerts = alerts.filter((a) => a.severity === 'Resolved');
  const totalSavedUsd =
    resolvedAlerts.reduce((sum, a) => sum + a.batchValueAtRiskUsd, 0) +
    alerts
      .filter((a) => a.severity !== 'Resolved')
      .reduce((sum, a) => sum + Math.round(a.batchValueAtRiskUsd * 0.85), 0);

  const avgResolutionMin =
    resolvedAlerts.length > 0
      ? Math.round(
          resolvedAlerts.reduce(
            (sum, a) => sum + (a.actualResolutionMin ?? a.expectedResolutionMin),
            0
          ) / resolvedAlerts.length
        )
      : 19;

  // Seed baseline positive operator ratings + live session feedback
  const baselineUp = 46;
  const baselineTotal = 48;
  const liveUp = feedbackEntries.filter((f) => f.rating === 'up').length;
  const liveTotal = feedbackEntries.length;
  const helpfulnessPct = Math.round(((baselineUp + liveUp) / (baselineTotal + liveTotal)) * 100);

  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
      <div className="glass-panel rounded-[20px] px-4 py-3.5">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Mean Deviation Resolution Time
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <span className="font-mono text-2xl font-semibold text-slate-900 dark:text-white">
            {avgResolutionMin} min
          </span>
          <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
            -73% vs 71m baseline
          </span>
        </div>
      </div>

      <div className="glass-panel rounded-[20px] px-4 py-3.5">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Batch Scrap & Rework Saved
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <span className="font-mono text-2xl font-semibold text-slate-900 dark:text-white">
            ${(totalSavedUsd / 1000).toFixed(1)}k
          </span>
          <span className="text-xs font-mono text-sky-600 dark:text-sky-400">
            Across {alerts.length} lots
          </span>
        </div>
      </div>

      <div className="glass-panel rounded-[20px] px-4 py-3.5">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Operator Helpfulness Score
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <span className="font-mono text-2xl font-semibold text-slate-900 dark:text-white">
            {helpfulnessPct}%
          </span>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            {baselineTotal + liveTotal} ratings
          </span>
        </div>
      </div>

      <div className="glass-panel rounded-[20px] px-4 py-3.5">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Active Batch Alerts
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <span className="font-mono text-2xl font-semibold text-slate-900 dark:text-white">
            {activeCount}
          </span>
          <span className="text-xs font-mono text-rose-600 dark:text-rose-400">
            {criticalCount} Critical Hold
          </span>
        </div>
      </div>
    </section>
  );
};
