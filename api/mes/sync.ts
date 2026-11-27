import { sendJson, type CompatRequest, type CompatResponse } from '../_lib/http.js';

export default function handler(req: CompatRequest, res: CompatResponse) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  sendJson(res, 200, {
    syncedAt: new Date().toISOString(),
    connectors: [
      { name: 'MES OPC-UA SCADA Bridge', status: 'Connected', recordsPolled: 148 },
      { name: 'LIMS Analytical Assay Feed', status: 'Connected', recordsPolled: 24 },
      { name: 'QMS Historical CAPA Vault', status: 'Connected', recordsPolled: 12 },
    ],
  });
}
