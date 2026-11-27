import { sendJson, type CompatRequest, type CompatResponse } from './_lib/http.js';

export default function handler(req: CompatRequest, res: CompatResponse) {
  if (req.method && req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const hasKey = Boolean(
    (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') ||
      (process.env.LLM_API_KEY && process.env.LLM_API_KEY !== 'MY_GEMINI_API_KEY')
  );

  sendJson(res, 200, {
    status: 'ok',
    aiMode: hasKey ? 'live-llm-with-gmp-fallback' : 'deterministic-gmp-engine',
    timestamp: new Date().toISOString(),
  });
}
