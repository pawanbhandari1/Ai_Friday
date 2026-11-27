import type { IncomingMessage, ServerResponse } from 'http';

export interface CompatRequest extends IncomingMessage {
  body?: unknown;
  method?: string;
}

export interface CompatResponse extends ServerResponse {
  status?: (code: number) => CompatResponse;
  json?: (data: unknown) => void;
}

export async function readJsonBody(req: CompatRequest): Promise<Record<string, unknown>> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      return (req.body ? JSON.parse(req.body) : {}) as Record<string, unknown>;
    }
    if (Buffer.isBuffer(req.body)) {
      const str = req.body.toString('utf8');
      return (str ? JSON.parse(str) : {}) as Record<string, unknown>;
    }
    if (typeof req.body === 'object') {
      return req.body as Record<string, unknown>;
    }
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

export function sendJson(res: CompatResponse, statusCode: number, data: unknown): void {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    const statusRes = res.status(statusCode);
    if (typeof statusRes?.json === 'function') {
      statusRes.json(data);
      return;
    }
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}
