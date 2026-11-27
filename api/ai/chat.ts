import type { Request, Response } from 'express';
import { generateChatResponse } from '../../server/aiEngine';
import { sanitizeString } from '../../server/ingestParser';
import { BatchDefectAlert, ChatMessage, UserRole } from '../../src/types/pharma';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const rawBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { defect, role, message, history, privacyShieldEnabled } = (rawBody || {}) as {
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
    res.status(200).json(reply);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to generate copilot reply.',
    });
  }
}
