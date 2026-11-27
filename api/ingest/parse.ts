import { readJsonBody, sendJson, type CompatRequest, type CompatResponse } from '../_lib/http.js';
import { parseCsvBatchPayload, parseJsonBatchPayload } from '../_lib/ingestParser.js';
import type { BatchDefectAlert } from '../../src/types/pharma.js';

export default async function handler(req: CompatRequest, res: CompatResponse) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const { format, content } = body as { format?: string; content?: string };

    if (typeof content !== 'string' || content.trim().length === 0) {
      sendJson(res, 400, { valid: false, error: 'File content cannot be empty.' });
      return;
    }
    if (content.length > 250_000) {
      sendJson(res, 413, { valid: false, error: 'Uploaded payload exceeds 250 KB safety limit.' });
      return;
    }

    let parsedAlert: BatchDefectAlert;
    if (format === 'csv') {
      parsedAlert = parseCsvBatchPayload(content);
    } else {
      const jsonObj = JSON.parse(content);
      parsedAlert = parseJsonBatchPayload(jsonObj);
    }

    sendJson(res, 200, { valid: true, alert: parsedAlert });
  } catch (err) {
    sendJson(res, 400, {
      valid: false,
      error: err instanceof Error ? err.message : 'Schema validation failed.',
    });
  }
}
