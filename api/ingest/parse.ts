import type { Request, Response } from 'express';
import { parseCsvBatchPayload, parseJsonBatchPayload } from '../../server/ingestParser';
import { BatchDefectAlert } from '../../src/types/pharma';

export default function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const rawBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { format, content } = (rawBody || {}) as { format?: string; content?: string };

    if (typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({ valid: false, error: 'File content cannot be empty.' });
      return;
    }
    if (content.length > 250_000) {
      res.status(413).json({ valid: false, error: 'Uploaded payload exceeds 250 KB safety limit.' });
      return;
    }

    let parsedAlert: BatchDefectAlert;
    if (format === 'csv') {
      parsedAlert = parseCsvBatchPayload(content);
    } else {
      const jsonObj = JSON.parse(content);
      parsedAlert = parseJsonBatchPayload(jsonObj);
    }

    res.status(200).json({ valid: true, alert: parsedAlert });
  } catch (err) {
    res.status(400).json({
      valid: false,
      error: err instanceof Error ? err.message : 'Schema validation failed.',
    });
  }
}
