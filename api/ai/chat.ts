import { generateChatResponse } from '../_lib/aiEngine.js';
import { readJsonBody, sendJson, type CompatRequest, type CompatResponse } from '../_lib/http.js';
import { sanitizeString } from '../_lib/ingestParser.js';
import type { BatchDefectAlert, ChatMessage, UserRole } from '../../src/types/pharma.js';

export default async function handler(req: CompatRequest, res: CompatResponse) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const { defect, role, message, history, privacyShieldEnabled } = body as {
      defect?: BatchDefectAlert;
      role?: UserRole;
      message?: string;
      history?: ChatMessage[];
      privacyShieldEnabled?: boolean;
    };

    const cleanMessage = sanitizeString(message, 600);
    if (!defect || !cleanMessage) {
      sendJson(res, 400, { error: 'Defect context and question message are required.' });
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
    sendJson(res, 200, reply);
  } catch (err) {
    sendJson(res, 500, {
      error: err instanceof Error ? err.message : 'Failed to generate copilot reply.',
    });
  }
}
