import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import type {
  BatchDefectAlert,
  ChatMessage,
  UserRole,
} from './src/types/pharma.js';
import {
  generateChatResponse,
  generateRootCauseExplanation,
} from './api/_lib/aiEngine.js';
import {
  parseCsvBatchPayload,
  parseJsonBatchPayload,
  sanitizeString,
} from './api/_lib/ingestParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

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
