import type { Request, Response } from 'express';
import { generateRootCauseExplanation } from '../../server/aiEngine';
import { BatchDefectAlert, UserRole } from '../../src/types/pharma';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const rawBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { defect, role, privacyShieldEnabled } = (rawBody || {}) as {
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
    res.status(200).json(explanation);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to generate AI explanation.',
    });
  }
}
