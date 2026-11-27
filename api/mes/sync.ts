import type { Request, Response } from 'express';

export default function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  res.status(200).json({
    syncedAt: new Date().toISOString(),
    connectors: [
      { name: 'MES OPC-UA SCADA Bridge', status: 'Connected', recordsPolled: 148 },
      { name: 'LIMS Analytical Assay Feed', status: 'Connected', recordsPolled: 24 },
      { name: 'QMS Historical CAPA Vault', status: 'Connected', recordsPolled: 12 },
    ],
  });
}
