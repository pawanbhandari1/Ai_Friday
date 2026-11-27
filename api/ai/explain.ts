import { generateRootCauseExplanation } from '../_lib/aiEngine.js';
import { readJsonBody, sendJson, type CompatRequest, type CompatResponse } from '../_lib/http.js';
import type { BatchDefectAlert, UserRole } from '../../src/types/pharma.js';

export default async function handler(req: CompatRequest, res: CompatResponse) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const { defect, role, privacyShieldEnabled } = body as {
      defect?: BatchDefectAlert;
      role?: UserRole;
      privacyShieldEnabled?: boolean;
    };

    if (!defect || !defect.id || !Array.isArray(defect.cppParameters)) {
      sendJson(res, 400, { error: 'Invalid batch defect payload.' });
      return;
    }

    const safeRole: UserRole = role === 'qa_engineer' ? 'qa_engineer' : 'operator';
    const explanation = await generateRootCauseExplanation(
      defect,
      safeRole,
      privacyShieldEnabled !== false
    );
    sendJson(res, 200, explanation);
  } catch (err) {
    sendJson(res, 500, {
      error: err instanceof Error ? err.message : 'Failed to generate AI explanation.',
    });
  }
}
