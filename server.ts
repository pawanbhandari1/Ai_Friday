import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  BatchDefectAlert,
  ChatMessage,
  CppParameterSpec,
  CppTelemetryPoint,
  UserRole,
} from './src/types/pharma';
import {
  generateChatResponse,
  generateRootCauseExplanation,
} from './server/aiEngine';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

function sanitizeString(input: unknown, maxLen = 400): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[<>]/g, '').trim().slice(0, maxLen);
}

function parseCsvBatchPayload(rawCsv: string): BatchDefectAlert {
  const lines = rawCsv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('CSV must include a header row and at least one telemetry/defect row.');
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const required = ['batchlotnumber', 'defecttitle', 'cppname', 'cppvalue', 'goldenmin', 'goldenmax'];
  const missing = required.filter((req) => !headers.includes(req));
  if (missing.length > 0) {
    throw new Error(`Missing required CSV columns: ${missing.join(', ')}`);
  }

  const idx = (col: string) => headers.indexOf(col);
  const rows = lines.slice(1).map((line) => line.split(',').map((v) => v.trim()));
  const firstRow = rows[0];

  const batchLotNumber = sanitizeString(firstRow[idx('batchlotnumber')], 40) || 'LOT-CSV-9901A';
  const defectTitle = sanitizeString(firstRow[idx('defecttitle')], 80) || 'Uploaded Process Deviation';
  const lineName =
    idx('linename') >= 0
      ? sanitizeString(firstRow[idx('linename')], 80)
      : 'Line 1: High-Speed Tablet Compression';
  const drugSku =
    idx('drugsku') >= 0
      ? sanitizeString(firstRow[idx('drugsku')], 80)
      : 'Custom Uploaded Oral Solid Dose Batch';
  const cppName = sanitizeString(firstRow[idx('cppname')], 60) || 'Primary Process Parameter';
  const cppUnit = idx('cppunit') >= 0 ? sanitizeString(firstRow[idx('cppunit')], 20) : 'units';
  const goldenMin = Number(firstRow[idx('goldenmin')]) || 10;
  const goldenMax = Number(firstRow[idx('goldenmax')]) || 20;

  const series: CppTelemetryPoint[] = rows.slice(0, 20).map((r, i) => {
    const val = Number(r[idx('cppvalue')]);
    const ts =
      idx('timestamp') >= 0 && r[idx('timestamp')]
        ? sanitizeString(r[idx('timestamp')], 16)
        : `14:${String(i * 2).padStart(2, '0')}`;
    return {
      timestamp: ts,
      uploadedParam: Number.isFinite(val) ? val : goldenMin,
    };
  });

  const latestVal = Number(series[series.length - 1]?.uploadedParam ?? goldenMax);
  const isOutOfSpec = latestVal < goldenMin || latestVal > goldenMax;
  const firstDrift =
    series.find((pt) => {
      const v = Number(pt.uploadedParam);
      return v < goldenMin || v > goldenMax;
    })?.timestamp ?? '14:04';

  const paramSpec: CppParameterSpec = {
    id: 'uploadedParam',
    name: cppName,
    unit: cppUnit,
    goldenMin,
    goldenMax,
    targetNominal: Number(((goldenMin + goldenMax) / 2).toFixed(2)),
    currentValue: latestVal,
    firstDriftTimestamp: String(firstDrift),
    cpk: isOutOfSpec ? 0.62 : 1.44,
    zScore: isOutOfSpec ? 2.9 : 0.4,
    isOutOfSpec,
  };

  return {
    id: `alert-upload-${Date.now()}`,
    deviationId: `DEV-2026-${Math.floor(500 + Math.random() * 450)}`,
    lineId: 'LINE-01',
    lineName,
    equipmentName: 'MES Imported Equipment Feed',
    batchLotNumber,
    drugSku,
    maskedDrugSku: `SKU-MASKED-${batchLotNumber.slice(-4)} [Formulation Redacted]`,
    proprietaryFormulaNote: 'Proprietary formulation metadata masked automatically on ingestion.',
    defectCode: 'QC-INGEST-CSV',
    defectTitle,
    severity: isOutOfSpec ? 'Critical Hold' : 'Warning',
    detectedAt: `${String(new Date().getUTCHours()).padStart(2, '0')}:${String(
      new Date().getUTCMinutes()
    ).padStart(2, '0')} UTC`,
    batchHoldRisk: 'High — Pending AI Verification & QA Review',
    batchValueAtRiskUsd: 165000,
    inspectionSummary: `Ingested CSV quality & SCADA payload for ${batchLotNumber} (${rows.length} telemetry ticks). ${cppName} measured ${latestVal} ${cppUnit} vs. validated ${goldenMin}–${goldenMax} ${cppUnit}.`,
    limsContext: 'LIMS composite sample pending verification alongside uploaded MES log.',
    mesBatchStage: 'Uploaded Batch Inspection Stream',
    expectedResolutionMin: 18,
    cppParameters: [paramSpec],
    telemetrySeries: series,
    historicalCapas: [
      {
        capaId: 'CAPA-2025-0402',
        similarityPct: 89,
        pastLotNumber: 'LOT-HIST-4410A',
        occurredDate: '2025-10-11',
        verifiedRootCause: `${cppName} drift outside validated ${goldenMin}–${goldenMax} ${cppUnit} control window.`,
        correctiveActionTaken: `Quarantined post-drift sub-lot and restored ${cppName} to ${paramSpec.targetNominal} ${cppUnit}.`,
        resolutionSuccessRate: 96,
        resolutionTimeMin: 19,
      },
    ],
  };
}

function parseJsonBatchPayload(body: unknown): BatchDefectAlert {
  if (!body || typeof body !== 'object') {
    throw new Error('JSON payload must be an object.');
  }
  const data = body as Record<string, unknown>;
  const batchLotNumber = sanitizeString(data.batchLotNumber, 40);
  const defectTitle = sanitizeString(data.defectTitle, 100);
  if (!batchLotNumber || !defectTitle) {
    throw new Error('JSON payload requires "batchLotNumber" and "defectTitle" fields.');
  }

  const rawParams = Array.isArray(data.cppParameters) ? data.cppParameters : [];
  if (rawParams.length === 0) {
    throw new Error('JSON payload requires at least one entry in "cppParameters".');
  }

  const cppParameters: CppParameterSpec[] = rawParams.slice(0, 6).map((p, idx) => {
    const item = p as Record<string, unknown>;
    const goldenMin = Number(item.goldenMin ?? 0);
    const goldenMax = Number(item.goldenMax ?? 100);
    const currentValue = Number(item.currentValue ?? 0);
    const isOutOfSpec = currentValue < goldenMin || currentValue > goldenMax;
    return {
      id: sanitizeString(item.id, 30) || `param${idx + 1}`,
      name: sanitizeString(item.name, 60) || `Parameter ${idx + 1}`,
      unit: sanitizeString(item.unit, 20) || 'units',
      goldenMin,
      goldenMax,
      targetNominal: Number(item.targetNominal ?? (goldenMin + goldenMax) / 2),
      currentValue,
      firstDriftTimestamp: sanitizeString(item.firstDriftTimestamp, 16) || '14:05',
      cpk: Number(item.cpk ?? (isOutOfSpec ? 0.61 : 1.4)),
      zScore: Number(item.zScore ?? (isOutOfSpec ? 3.1 : 0.3)),
      isOutOfSpec,
    };
  });

  const primary = cppParameters[0];
  const rawSeries = Array.isArray(data.telemetrySeries) ? data.telemetrySeries : [];
  const telemetrySeries: CppTelemetryPoint[] =
    rawSeries.length > 0
      ? rawSeries.slice(0, 24).map((pt, i) => {
          const obj = pt as Record<string, unknown>;
          const cleanPt: CppTelemetryPoint = {
            timestamp: sanitizeString(obj.timestamp, 16) || `14:${String(i * 3).padStart(2, '0')}`,
          };
          for (const param of cppParameters) {
            const v = Number(obj[param.id]);
            cleanPt[param.id] = Number.isFinite(v) ? v : param.currentValue;
          }
          return cleanPt;
        })
      : [
          { timestamp: '13:50', [primary.id]: primary.targetNominal },
          { timestamp: '13:55', [primary.id]: primary.targetNominal },
          { timestamp: '14:00', [primary.id]: Number(((primary.targetNominal + primary.currentValue) / 2).toFixed(2)) },
          { timestamp: '14:05', [primary.id]: primary.currentValue },
        ];

  const severity =
    data.severity === 'Critical Hold' || data.severity === 'Warning' || data.severity === 'Resolved'
      ? data.severity
      : cppParameters.some((p) => p.isOutOfSpec)
      ? 'Critical Hold'
      : 'Warning';

  return {
    id: `alert-json-${Date.now()}`,
    deviationId: sanitizeString(data.deviationId, 30) || `DEV-2026-${Math.floor(500 + Math.random() * 450)}`,
    lineId: sanitizeString(data.lineId, 20) || 'LINE-02',
    lineName: sanitizeString(data.lineName, 80) || 'Line 2: Fluid-Bed Granulation & Drying',
    equipmentName: sanitizeString(data.equipmentName, 80) || 'Automated GMP Process Equipment',
    batchLotNumber,
    drugSku: sanitizeString(data.drugSku, 100) || 'Imported Pharmaceutical Product Batch',
    maskedDrugSku: `SKU-MASKED-${batchLotNumber.slice(-4)} [Formulation Redacted]`,
    proprietaryFormulaNote: 'Proprietary excipient & active synthesis metadata masked per IP Policy SEC-09.',
    defectCode: sanitizeString(data.defectCode, 30) || 'QC-INGEST-JSON',
    defectTitle,
    severity,
    detectedAt: `${String(new Date().getUTCHours()).padStart(2, '0')}:${String(
      new Date().getUTCMinutes()
    ).padStart(2, '0')} UTC`,
    batchHoldRisk: sanitizeString(data.batchHoldRisk, 100) || 'Elevated — Pending QA Evaluation',
    batchValueAtRiskUsd: Number(data.batchValueAtRiskUsd) || 155000,
    inspectionSummary:
      sanitizeString(data.inspectionSummary, 400) ||
      `Imported quality deviation report for ${batchLotNumber}.`,
    limsContext:
      sanitizeString(data.limsContext, 300) ||
      'LIMS analytical assay linked via JSON ingestion pipeline.',
    mesBatchStage: sanitizeString(data.mesBatchStage, 80) || 'Active Production Stage',
    expectedResolutionMin: Number(data.expectedResolutionMin) || 20,
    cppParameters,
    telemetrySeries,
    historicalCapas: [
      {
        capaId: 'CAPA-2025-0488',
        similarityPct: 91,
        pastLotNumber: 'LOT-REF-7102B',
        occurredDate: '2025-11-18',
        verifiedRootCause: `${primary.name} deviated to ${primary.currentValue} ${primary.unit} beyond validated limits.`,
        correctiveActionTaken: `Isolated post-excursion sub-lot and recalibrated ${primary.name} back to ${primary.targetNominal} ${primary.unit}.`,
        resolutionSuccessRate: 97,
        resolutionTimeMin: 20,
      },
    ],
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    const hasKey = Boolean(
      (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') ||
        (process.env.LLM_API_KEY && process.env.LLM_API_KEY !== 'MY_GEMINI_API_KEY')
    );
    res.json({
      status: 'ok',
      aiMode: hasKey ? 'live-llm-with-gmp-fallback' : 'deterministic-gmp-engine',
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/ai/explain', async (req: Request, res: Response) => {
    try {
      const { defect, role, privacyShieldEnabled } = req.body as {
        defect?: BatchDefectAlert;
        role?: UserRole;
        privacyShieldEnabled?: boolean;
      };
      if (!defect || !defect.id || !Array.isArray(defect.cppParameters)) {
        res.status(400).json({ error: 'Invalid batch defect payload.' });
        return;
      }
      const safeRole: UserRole = role === 'qa_engineer' ? 'qa_engineer' : 'operator';
      const explanation = await generateRootCauseExplanation(
        defect,
        safeRole,
        privacyShieldEnabled !== false
      );
      res.json(explanation);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to generate AI explanation.',
      });
    }
  });

  app.post('/api/ai/chat', async (req: Request, res: Response) => {
    try {
      const { defect, role, message, history, privacyShieldEnabled } = req.body as {
        defect?: BatchDefectAlert;
        role?: UserRole;
        message?: string;
        history?: ChatMessage[];
        privacyShieldEnabled?: boolean;
      };
      const cleanMessage = sanitizeString(message, 600);
      if (!defect || !cleanMessage) {
        res.status(400).json({ error: 'Defect context and question message are required.' });
        return;
      }
      const safeRole: UserRole = role === 'qa_engineer' ? 'qa_engineer' : 'operator';
      const reply = await generateChatResponse(
        defect,
        safeRole,
        cleanMessage,
        Array.isArray(history) ? history : [],
        privacyShieldEnabled !== false
      );
      res.json(reply);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to generate copilot reply.',
      });
    }
  });

  app.post('/api/ingest/parse', (req: Request, res: Response) => {
    try {
      const { format, content } = req.body as { format?: string; content?: string };
      if (typeof content !== 'string' || content.trim().length === 0) {
        res.status(400).json({ error: 'File content cannot be empty.' });
        return;
      }
      if (content.length > 250_000) {
        res.status(413).json({ error: 'Uploaded payload exceeds 250 KB safety limit.' });
        return;
      }

      let parsedAlert: BatchDefectAlert;
      if (format === 'csv') {
        parsedAlert = parseCsvBatchPayload(content);
      } else {
        const jsonObj = JSON.parse(content);
        parsedAlert = parseJsonBatchPayload(jsonObj);
      }

      res.json({ valid: true, alert: parsedAlert });
    } catch (err) {
      res.status(400).json({
        valid: false,
        error: err instanceof Error ? err.message : 'Schema validation failed.',
      });
    }
  });

  app.post('/api/mes/sync', (_req: Request, res: Response) => {
    res.json({
      syncedAt: new Date().toISOString(),
      connectors: [
        { name: 'MES OPC-UA SCADA Bridge', status: 'Connected', recordsPolled: 148 },
        { name: 'LIMS Analytical Assay Feed', status: 'Connected', recordsPolled: 24 },
        { name: 'QMS Historical CAPA Vault', status: 'Connected', recordsPolled: 12 },
      ],
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AetherPharma Quality Assistant server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
