import type { Request, Response } from 'express';

export default function handler(req: Request, res: Response) {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const hasKey = Boolean(
    (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') ||
      (process.env.LLM_API_KEY && process.env.LLM_API_KEY !== 'MY_GEMINI_API_KEY')
  );

  res.status(200).json({
    status: 'ok',
    aiMode: hasKey ? 'live-llm-with-gmp-fallback' : 'deterministic-gmp-engine',
    timestamp: new Date().toISOString(),
  });
}
