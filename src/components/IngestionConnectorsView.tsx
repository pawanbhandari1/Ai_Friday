import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Database,
  Download,
  FileCode2,
  Lock,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import { BatchDefectAlert } from '../types/pharma';

interface IngestionConnectorsViewProps {
  onIngestAlert: (newAlert: BatchDefectAlert) => void;
  privacyShieldEnabled: boolean;
  onTogglePrivacyShield: () => void;
  autoRefreshEnabled: boolean;
  onToggleAutoRefresh: () => void;
  lastSyncedAt: string;
  isSyncing: boolean;
  onManualSync: () => void;
  alerts: BatchDefectAlert[];
}

const SAMPLE_JSON_PAYLOAD = {
  deviationId: 'DEV-2026-0499',
  lineId: 'LINE-01',
  lineName: 'Line 1: High-Speed Tablet Compression',
  equipmentName: 'Fette 2090i Rotary Press',
  batchLotNumber: 'LOT-LOSA-7712B',
  drugSku: 'Losartan Potassium 50 mg Film-Coated Tablets',
  defectCode: 'QC-TAB-CHIP-05',
  defectTitle: 'Tablet Edge Chipping & High Ejection Force',
  severity: 'Critical Hold',
  batchHoldRisk: 'High — Sub-Lot Hold Recommended',
  batchValueAtRiskUsd: 172000,
  inspectionSummary:
    'Vision camera flagged 2.7% edge chipping along punch stations #05–#12 accompanied by rising lower punch ejection resistance.',
  limsContext: 'Granule moisture LOD nominal at 1.9%; magnesium stearate blend uniformity verified.',
  mesBatchStage: 'Main Compression · Stage 2',
  cppParameters: [
    {
      id: 'ejectionForce',
      name: 'Lower Punch Ejection Force',
      unit: 'N',
      goldenMin: 80,
      goldenMax: 180,
      targetNominal: 120,
      currentValue: 265,
      firstDriftTimestamp: '14:06',
      cpk: 0.56,
      zScore: 3.3,
    },
  ],
  telemetrySeries: [
    { timestamp: '13:58', ejectionForce: 122 },
    { timestamp: '14:02', ejectionForce: 145 },
    { timestamp: '14:06', ejectionForce: 198 },
    { timestamp: '14:10', ejectionForce: 238 },
    { timestamp: '14:14', ejectionForce: 265 },
  ],
};

const SAMPLE_CSV_PAYLOAD = `batchLotNumber,defectTitle,lineName,drugSku,cppName,cppUnit,goldenMin,goldenMax,timestamp,cppValue
LOT-AMOX-6204A,Fluid-Bed Granule Agglomeration,Line 2: Fluid-Bed Granulation & Drying,Amoxicillin 500 mg Granules,Spray Atomization Pressure,bar,2.2,2.8,14:00,2.5
LOT-AMOX-6204A,Fluid-Bed Granule Agglomeration,Line 2: Fluid-Bed Granulation & Drying,Amoxicillin 500 mg Granules,Spray Atomization Pressure,bar,2.2,2.8,14:04,2.3
LOT-AMOX-6204A,Fluid-Bed Granule Agglomeration,Line 2: Fluid-Bed Granulation & Drying,Amoxicillin 500 mg Granules,Spray Atomization Pressure,bar,2.2,2.8,14:08,1.7
LOT-AMOX-6204A,Fluid-Bed Granule Agglomeration,Line 2: Fluid-Bed Granulation & Drying,Amoxicillin 500 mg Granules,Spray Atomization Pressure,bar,2.2,2.8,14:12,1.4`;

export const IngestionConnectorsView: React.FC<IngestionConnectorsViewProps> = ({
  onIngestAlert,
  privacyShieldEnabled,
  onTogglePrivacyShield,
  autoRefreshEnabled,
  onToggleAutoRefresh,
  lastSyncedAt,
  isSyncing,
  onManualSync,
  alerts,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const submitPayloadToServer = async (format: 'json' | 'csv', content: string) => {
    setIsValidating(true);
    setUploadStatus(null);
    try {
      const res = await fetch('/api/ingest/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, content }),
      });
      const data = (await res.json()) as {
        valid?: boolean;
        alert?: BatchDefectAlert;
        error?: string;
      };
      if (!res.ok || !data.valid || !data.alert) {
        throw new Error(data.error || 'Schema validation failed.');
      }
      setUploadStatus({
        type: 'success',
        message: `Validated ${format.toUpperCase()} schema for ${data.alert.batchLotNumber} (${data.alert.defectTitle}). Opening AI explanation...`,
      });
      onIngestAlert(data.alert);
    } catch (err) {
      setUploadStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to parse uploaded file.',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    const isCsv = file.name.toLowerCase().endsWith('.csv');
    const isJson = file.name.toLowerCase().endsWith('.json');
    if (!isCsv && !isJson) {
      setUploadStatus({
        type: 'error',
        message: 'Unsupported file extension. Please upload a .json or .csv batch payload.',
      });
      return;
    }
    const text = await file.text();
    await submitPayloadToServer(isCsv ? 'csv' : 'json', text);
  };

  const downloadSample = (format: 'json' | 'csv') => {
    const content =
      format === 'json' ? JSON.stringify(SAMPLE_JSON_PAYLOAD, null, 2) : SAMPLE_CSV_PAYLOAD;
    const blob = new Blob([content], {
      type: format === 'json' ? 'application/json' : 'text/csv',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = format === 'json' ? 'sample_tablet_deviation.json' : 'sample_granulation_cpp.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const samplePreviewAlert = alerts[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Left: JSON & CSV Uploader + 1-Click Sample Payloads */}
      <section className="lg:col-span-6 glass-panel rounded-[22px] p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Batch Quality & SCADA Log Ingestion (JSON / CSV)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Upload exported MES/LIMS inspection payloads or load a validated sample payload to run automatic schema checks and instant GenAI root-cause analysis.
          </p>
        </div>

        {/* Drag & Drop Zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFileChange(e.dataTransfer.files?.[0]);
          }}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 dark:border-white/20 hover:border-sky-500 rounded-2xl p-8 text-center transition-colors cursor-pointer glass-surface-subtle"
        >
          <UploadCloud className="w-8 h-8 text-sky-600 dark:text-sky-400 mx-auto mb-2.5" />
          <div className="text-sm font-medium text-slate-900 dark:text-white">
            Drop .json or .csv batch report here, or click to browse
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Server validates required batchLotNumber, defectTitle, and CPP telemetry bounds
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv"
            className="hidden"
            onChange={(e) => handleFileChange(e.target.files?.[0])}
          />
        </div>

        {uploadStatus && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
              uploadStatus.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{uploadStatus.message}</span>
          </div>
        )}

        {/* 1-Click Sample Payloads */}
        <div className="space-y-3 pt-2 border-t border-slate-200/80 dark:border-white/10">
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            1-Click Sample Pharmaceutical Payloads
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl glass-surface-subtle space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
                <FileCode2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                Tablet Edge Chipping (.JSON)
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Fette 2090i Ejection Force excursion (265 N vs. 80–180 N limit)
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isValidating}
                  onClick={() =>
                    submitPayloadToServer('json', JSON.stringify(SAMPLE_JSON_PAYLOAD))
                  }
                  className="flex-1 py-1.5 px-2.5 rounded-lg text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white cursor-pointer"
                >
                  Ingest & Explain
                </button>
                <button
                  type="button"
                  onClick={() => downloadSample('json')}
                  title="Download sample JSON"
                  className="p-1.5 rounded-lg glass-surface-subtle hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-xl glass-surface-subtle space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
                <FileCode2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Granule Agglomeration (.CSV)
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Line 2 Spray Atomization Pressure drop (1.4 bar vs. 2.2–2.8 bar)
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isValidating}
                  onClick={() => submitPayloadToServer('csv', SAMPLE_CSV_PAYLOAD)}
                  className="flex-1 py-1.5 px-2.5 rounded-lg text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white cursor-pointer"
                >
                  Ingest & Explain
                </button>
                <button
                  type="button"
                  onClick={() => downloadSample('csv')}
                  title="Download sample CSV"
                  className="p-1.5 rounded-lg glass-surface-subtle hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Right: Simulated MES/LIMS Connectors & Proprietary Formulation Privacy Shield */}
      <section className="lg:col-span-6 space-y-5">
        <div className="glass-panel rounded-[22px] p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                MES & LIMS API Connectors
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleAutoRefresh}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  autoRefreshEnabled
                    ? 'bg-emerald-600 text-white'
                    : 'glass-surface-subtle text-slate-700 dark:text-slate-200'
                }`}
              >
                Auto-Refresh: {autoRefreshEnabled ? 'ON (15s)' : 'OFF'}
              </button>
              <button
                type="button"
                onClick={onManualSync}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                Sync MES Feed
              </button>
            </div>
          </div>

          <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Last Synced: {lastSyncedAt}
          </div>

          <div className="divide-y divide-slate-200/70 dark:divide-white/10 text-xs">
            {[
              {
                name: 'MES SCADA OPC-UA Bridge',
                endpoint: 'opc.tcp://mes-core.plant01.internal:4840/cpp-stream',
                status: '● Connected',
              },
              {
                name: 'LIMS Analytical Assay Feed',
                endpoint: 'https://lims.plant01.internal/api/v2/batch-coa',
                status: '● Connected',
              },
              {
                name: 'QMS Historical CAPA Vault',
                endpoint: 'https://qms.plant01.internal/api/v1/capa-embeddings',
                status: '● Connected',
              },
            ].map((conn) => (
              <div key={conn.name} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 dark:text-white">{conn.name}</div>
                  <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {conn.endpoint}
                  </div>
                </div>
                <span className="font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
                  {conn.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Data Privacy & Proprietary Formulation Shield */}
        <div className="glass-panel rounded-[22px] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Data Privacy & Proprietary Formulation Shield
              </h3>
            </div>
            <button
              type="button"
              onClick={onTogglePrivacyShield}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                privacyShieldEnabled
                  ? 'bg-sky-600 text-white'
                  : 'glass-surface-subtle text-slate-700 dark:text-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              {privacyShieldEnabled ? 'Masking Active' : 'Masking Off'}
            </button>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Before any batch deviation context leaves the cleanroom edge server for GenAI reasoning, proprietary API compound names, excipient ratios, and trade-secret thermal profiles are automatically anonymized.
          </p>

          {samplePreviewAlert && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl glass-surface-subtle space-y-1">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Internal MES Record
                </div>
                <div className="font-mono text-slate-800 dark:text-slate-200">
                  {samplePreviewAlert.drugSku}
                </div>
              </div>
              <div className="p-3 rounded-xl glass-surface-subtle space-y-1">
                <div className="text-[11px] font-medium text-sky-600 dark:text-sky-400">
                  Redacted GenAI Payload
                </div>
                <div className="font-mono text-slate-800 dark:text-slate-200">
                  {privacyShieldEnabled
                    ? samplePreviewAlert.maskedDrugSku
                    : samplePreviewAlert.drugSku}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
