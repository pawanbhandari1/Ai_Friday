import { GoogleGenAI, Type } from '@google/genai';
import {
  AiExplanationPayload,
  BatchDefectAlert,
  ChatMessage,
  CorrectiveStep,
  UserRole,
} from '../src/types/pharma';

function getValidApiKey(): { provider: 'gemini' | 'openai' | 'none'; key: string } {
  const llmKey = (process.env.LLM_API_KEY || '').trim();
  const geminiKey = (process.env.GEMINI_API_KEY || '').trim();

  if (llmKey && llmKey !== 'MY_GEMINI_API_KEY' && llmKey !== 'MY_LLM_API_KEY') {
    if (llmKey.startsWith('sk-')) {
      return { provider: 'openai', key: llmKey };
    }
    return { provider: 'gemini', key: llmKey };
  }

  if (geminiKey && geminiKey !== 'MY_GEMINI_API_KEY') {
    return { provider: 'gemini', key: geminiKey };
  }

  return { provider: 'none', key: '' };
}

function getChronologicalDrifts(defect: BatchDefectAlert) {
  return [...defect.cppParameters]
    .filter((p) => p.isOutOfSpec && p.firstDriftTimestamp !== '—')
    .sort((a, b) => a.firstDriftTimestamp.localeCompare(b.firstDriftTimestamp));
}

export function buildDeterministicExplanation(
  defect: BatchDefectAlert,
  role: UserRole,
  privacyShieldEnabled: boolean
): AiExplanationPayload {
  const drifts = getChronologicalDrifts(defect);
  const firstDrift = drifts[0] ?? defect.cppParameters[0];
  const topCapa = defect.historicalCapas[0];
  const redactedFields = privacyShieldEnabled
    ? ['API Compound Name', 'Excipient Formulation Ratio', 'Proprietary Thermal/Binder Spec']
    : [];

  let probableRootCauseTitle = `${firstDrift?.name ?? 'Process Parameter'} Drift Driving ${defect.defectTitle}`;
  let confidencePct = topCapa ? Math.min(97, topCapa.similarityPct + 2) : 89;
  let plainLanguageSummary = '';
  let qaTechnicalSummary = '';
  let correctiveActions: CorrectiveStep[] = [];
  let recommendedHoldAction = '';

  if (defect.id === 'alert-line1-capping') {
    probableRootCauseTitle = 'Air Entrapment from High Turret Speed & Pre-Compression Loss';
    confidencePct = 95;
    plainLanguageSummary =
      'The tablet press was sped up to 68 RPM (above the safe 45–55 RPM window), while the gentle pre-squeeze force dropped to 1.4 kN. Because the powder was squeezed too fast without pushing trapped air out first, tablets are cracking at the top ("capping") when the main punch hits at 24.6 kN.';
    qaTechnicalSummary =
      `Chronological SCADA correlation confirms turret speed excursion at 13:56 UTC (68 RPM, Z=+2.9) preceded pre-compression pressure decay at 13:58 UTC (1.4 kN, Cpk=0.64) and compensatory main compression overload at 14:04 UTC (24.6 kN, Cpk=0.58). LIMS LOD is nominal (1.85%), ruling out granulation moisture and isolating mechanical air-entrapment elastic recovery matching ${topCapa?.capaId ?? 'historical CAPA'}.`;
    recommendedHoldAction =
      'Segregate Bin #B-104 sub-lot produced after 13:56 UTC into QA Quarantine Hold pending AQL friability & hardness re-test.';
    correctiveActions = [
      {
        id: 'step-1',
        priority: 'Immediate',
        operatorInstruction: 'Pause turret run and tag tablets produced since 13:56 UTC in QA Quarantine Hold Bin.',
        qaTechnicalDetail: 'Apply electronic sub-lot hold in MES from timestamp 13:56 UTC (68 RPM trigger) per SOP-QA-204.',
        gmpReference: '21 CFR 211.110 / SOP-QA-204',
        requiresDualSignOff: true,
      },
      {
        id: 'step-2',
        priority: 'Immediate',
        operatorInstruction: 'Lower turret speed back inside 45–55 RPM (set to 50 RPM nominal).',
        qaTechnicalDetail: 'Restore dwell time >18 ms by returning rotary speed to validated 50 RPM golden-batch setpoint.',
        gmpReference: 'Master Batch Record MBR-ATRV-40',
        requiresDualSignOff: false,
      },
      {
        id: 'step-3',
        priority: 'Verification',
        operatorInstruction: 'Restore Pre-Compression Force to 3.0 kN and lower Main Compression Force to 18.0 kN.',
        qaTechnicalDetail: 'Re-pressurize pre-compression hydraulic accumulator to 3.0 ± 0.2 kN; reset main force PID target to 18.0 kN.',
        gmpReference: 'SOP-ENG-114 §4.2',
        requiresDualSignOff: false,
      },
      {
        id: 'step-4',
        priority: 'Preventive',
        operatorInstruction: 'Run 20-tablet check: verify zero capping, hardness 110–125 N, and friability <0.5% before resuming.',
        qaTechnicalDetail: 'Execute IPC AQL n=20 composite (USP <1216> friability & breaking force) and log dual-operator verification.',
        gmpReference: 'USP <1216> / IPC-TAB-09',
        requiresDualSignOff: true,
      },
    ];
  } else if (defect.id === 'alert-line2-moisture') {
    probableRootCauseTitle = 'Exhaust Filter Clogging Starving Drying Airflow & Inlet Heat';
    confidencePct = 93;
    plainLanguageSummary =
      'The dryer exhaust filter bag got partially blocked, dropping airflow from 2,600 down to 2,050 m³/h. With stale air unable to escape, the heater lowered inlet air to 54.8 °C, leaving granules too damp (3.1% moisture vs. 2.2% max).';
    qaTechnicalSummary =
      `Exhaust airflow decayed first at 13:48 UTC (2,050 m³/h, Z=-2.8) followed by PID inlet temperature sag at 13:52 UTC (54.8 °C, Cpk=0.72) and NIR moisture rise to 3.1% LOD at 14:00 UTC. Matches ${topCapa?.capaId ?? 'CAPA-2025-0311'} filter sock ΔP fouling signature.`;
    recommendedHoldAction =
      'Hold Bowl #FB-02 discharge transfer; complete controlled secondary drying inside GPCG-300 before milling.';
    correctiveActions = [
      {
        id: 'step-1',
        priority: 'Immediate',
        operatorInstruction: 'Keep granules inside the dryer bowl and pause discharge to milling.',
        qaTechnicalDetail: 'Place MES hold on Bowl #FB-02 transfer chute; prevent downstream hopper bridging and sticking.',
        gmpReference: 'SOP-GRN-088',
        requiresDualSignOff: false,
      },
      {
        id: 'step-2',
        priority: 'Immediate',
        operatorInstruction: 'Trigger a dual-bank pneumatic filter shake cycle and confirm exhaust ΔP drops below 900 Pa.',
        qaTechnicalDetail: 'Execute alternating filter-bag pulse clean; verify exhaust airflow recovers to 2,500–2,700 m³/h.',
        gmpReference: 'Glatt OEM-SOP-09',
        requiresDualSignOff: false,
      },
      {
        id: 'step-3',
        priority: 'Verification',
        operatorInstruction: 'Bring inlet air temperature back to 65.0 °C and dry for 10–12 minutes until NIR reads ≤1.9%.',
        qaTechnicalDetail: 'Resume validated 65.0 °C ± 1.5 °C thermal profile under continuous NIR PAT monitoring.',
        gmpReference: 'MBR-MTFM-500 §6.3',
        requiresDualSignOff: false,
      },
      {
        id: 'step-4',
        priority: 'Preventive',
        operatorInstruction: 'Pull one composite LIMS moisture sample and get QA sign-off before releasing batch.',
        qaTechnicalDetail: 'Confirm composite Karl Fischer / LOD result 1.5–2.2% in LIMS prior to GMP release.',
        gmpReference: 'USP <731> / QA-REL-04',
        requiresDualSignOff: true,
      },
    ];
  } else if (defect.id === 'alert-line3-vialfill') {
    probableRootCauseTitle = 'Surge Vessel Nitrogen Head-Pressure Decay Causing Underfill';
    confidencePct = 96;
    plainLanguageSummary =
      'Nitrogen pressure on top of the liquid supply tank fell from 0.50 bar to 0.31 bar starting at 13:50 UTC. Because less pressure is pushing liquid into the sterile pump tubes, vials are receiving 18.9 mL instead of the required 20.1 mL.';
    qaTechnicalSummary =
      `Surge tank nitrogen blanket pressure dropped below 0.45 bar LSL at 13:50 UTC (0.31 bar, Z=-3.6), directly causing peristaltic manifold intake starvation by 13:54 UTC (18.9 mL, Cpk=0.49). Isolator Grade A differential pressure remained positive (+15.8 Pa), confirming zero sterility breach. 96% match to ${topCapa?.capaId ?? 'CAPA-2026-0041'}.`;
    recommendedHoldAction =
      'Engage immediate aseptic line pause via HMI; quarantine checkweigher bracket since 13:50 UTC for 100% weight reconciliation.';
    correctiveActions = [
      {
        id: 'step-1',
        priority: 'Immediate',
        operatorInstruction: 'Pause filling on the HMI (do NOT open isolator doors) and lock reject/quarantine tray since 13:50 UTC.',
        qaTechnicalDetail: 'Maintain Grade A barrier integrity (+15.8 Pa); segregate suspect vial bracket per USP <905> underfill protocol.',
        gmpReference: 'EU GMP Annex 1 / SOP-STR-302',
        requiresDualSignOff: true,
      },
      {
        id: 'step-2',
        priority: 'Immediate',
        operatorInstruction: 'Adjust the external nitrogen blanket regulator back to 0.50 bar and confirm gauge holds steady.',
        qaTechnicalDetail: 'Inspect sterile N2 supply regulator diaphragm stability; restore surge tank head pressure to 0.50 ± 0.02 bar.',
        gmpReference: 'SOP-STR-310 §3.4',
        requiresDualSignOff: false,
      },
      {
        id: 'step-3',
        priority: 'Verification',
        operatorInstruction: 'Run 3 consecutive dry-check gravimetric weighings (target 19.8–20.4 mL across all 4 heads).',
        qaTechnicalDetail: 'Verify all four peristaltic pump heads deliver 20.1 ± 0.2 mL with RSD <0.5% before restarting run.',
        gmpReference: 'IPC-STR-012',
        requiresDualSignOff: true,
      },
    ];
  } else if (defect.id === 'alert-line4-blister') {
    probableRootCauseTitle = 'Elevated Web Speed Outpacing Sealing Platen Thermal Recovery';
    confidencePct = 92;
    plainLanguageSummary =
      'The blister line speed was increased to 348 blisters/min while the heated sealing plate cooled down to 169.4 °C (needs 185–195 °C). The foil did not melt-bond tightly enough, causing tiny pin-hole air leaks.';
    qaTechnicalSummary =
      `Line cadence exceeded 320 blisters/min USL at 13:38 UTC (348/min, Z=+2.5), inducing thermal drawdown on sealing platen Zone-2 at 13:42 UTC (169.4 °C, Cpk=0.61). Dwell pressure remained nominal (4.5 bar), confirming thermal-dwell energy deficit matching ${topCapa?.capaId ?? 'CAPA-2025-0589'}.`;
    recommendedHoldAction =
      'Divert blister cards sealed after 13:38 UTC into HVLD Quarantine Reject Bin; re-verify with ASTM D3078 dye test.';
    correctiveActions = [
      {
        id: 'step-1',
        priority: 'Immediate',
        operatorInstruction: 'Reduce blister line speed back to 300 blisters/min and divert recent trays to Quarantine Bin.',
        qaTechnicalDetail: 'Restore cycle rate to validated 280–320 blisters/min window; bracket suspect reel segment since 13:38 UTC.',
        gmpReference: 'SOP-PKG-041',
        requiresDualSignOff: false,
      },
      {
        id: 'step-2',
        priority: 'Immediate',
        operatorInstruction: 'Check Zone-2 heater power & allow sealing platen to soak back to 190.0 °C before restarting.',
        qaTechnicalDetail: 'Verify Zone-2 SSR output & thermocouple continuity; stabilize platen at 190.0 ± 2.0 °C.',
        gmpReference: 'MBR-ROSU-20 §8.1',
        requiresDualSignOff: false,
      },
      {
        id: 'step-3',
        priority: 'Verification',
        operatorInstruction: 'Run 50-pack methylene blue vacuum leak test and confirm 0 leaks with HVLD.',
        qaTechnicalDetail: 'Execute USP <1207> / ASTM D3078 vacuum dye ingress test (0/50 failures) and log QA release.',
        gmpReference: 'USP <1207> / QC-PKG-08',
        requiresDualSignOff: true,
      },
    ];
  } else {
    // Generic dynamic deterministic fallback for uploaded or resolved defects
    const oosList = defect.cppParameters.filter((p) => p.isOutOfSpec);
    plainLanguageSummary =
      oosList.length > 0
        ? `Process sensor ${firstDrift.name} moved outside its normal safe zone (${firstDrift.goldenMin}–${firstDrift.goldenMax} ${firstDrift.unit}) starting at ${firstDrift.firstDriftTimestamp}. Bring ${firstDrift.name} back to ${firstDrift.targetNominal} ${firstDrift.unit} and inspect recent product before continuing.`
        : `All monitored machine parameters for ${defect.batchLotNumber} are currently within golden-batch control limits (${defect.severity}).`;
    qaTechnicalSummary =
      oosList.length > 0
        ? `Multivariate CPP correlation isolated ${firstDrift.name} excursion at ${firstDrift.firstDriftTimestamp} (${firstDrift.currentValue} ${firstDrift.unit}, Z=${firstDrift.zScore}, Cpk=${firstDrift.cpk}) correlating with ${defect.defectTitle}.`
        : `Post-correction verification confirms Cpk >= 1.48 across critical parameters for ${defect.batchLotNumber}.`;
    recommendedHoldAction =
      defect.severity === 'Resolved'
        ? 'No active hold; batch cleared under QA electronic signature.'
        : `Place sub-lot produced after ${firstDrift?.firstDriftTimestamp ?? defect.detectedAt} on QA Hold pending IPC verification.`;
    correctiveActions = [
      {
        id: 'step-1',
        priority: 'Immediate',
        operatorInstruction: `Pause ${defect.equipmentName} and isolate product manufactured after ${firstDrift?.firstDriftTimestamp ?? defect.detectedAt}.`,
        qaTechnicalDetail: `Initiate MES sub-lot quarantine bracket for ${defect.batchLotNumber}.`,
        gmpReference: '21 CFR 211.110',
        requiresDualSignOff: true,
      },
      {
        id: 'step-2',
        priority: 'Verification',
        operatorInstruction: `Restore ${firstDrift?.name ?? 'primary CPP'} to ${firstDrift?.targetNominal ?? 'nominal'} ${firstDrift?.unit ?? ''}.`,
        qaTechnicalDetail: `Return parameter inside validated golden-batch range (${firstDrift?.goldenMin}–${firstDrift?.goldenMax} ${firstDrift?.unit}).`,
        gmpReference: `MBR-${defect.lineId}`,
        requiresDualSignOff: false,
      },
      {
        id: 'step-3',
        priority: 'Preventive',
        operatorInstruction: 'Perform in-process quality check on 20 samples and document QA sign-off.',
        qaTechnicalDetail: 'Verify IPC compliance and update deviation log.',
        gmpReference: 'QMS-CAPA-SOP',
        requiresDualSignOff: true,
      },
    ];
  }

  const correlatedAnomalySequence =
    drifts.length > 0
      ? drifts.map(
          (d, idx) =>
            `${idx + 1}. [${d.firstDriftTimestamp}] ${d.name} drifted to ${d.currentValue} ${d.unit} (Spec: ${d.goldenMin}–${d.goldenMax} ${d.unit}, Z=${d.zScore > 0 ? '+' : ''}${d.zScore})`
        )
      : ['1. All CPPs stabilized within golden-batch control limits following corrective intervention.'];

  const estimatedBatchValueProtectedUsd =
    defect.severity === 'Resolved'
      ? defect.batchValueAtRiskUsd
      : Math.round(defect.batchValueAtRiskUsd * 0.92);

  return {
    defectId: defect.id,
    generatedAt: new Date().toISOString(),
    sourceEngine: 'deterministic-gmp',
    privacyRedactedFields: redactedFields,
    probableRootCauseTitle,
    confidencePct,
    plainLanguageSummary:
      role === 'operator'
        ? plainLanguageSummary
        : `${plainLanguageSummary} (${qaTechnicalSummary})`,
    qaTechnicalSummary,
    correlatedAnomalySequence,
    correctiveActions,
    estimatedBatchValueProtectedUsd,
    recommendedHoldAction,
  };
}

export async function generateRootCauseExplanation(
  defect: BatchDefectAlert,
  role: UserRole,
  privacyShieldEnabled: boolean
): Promise<AiExplanationPayload> {
  const { provider, key } = getValidApiKey();
  const redactedFields = privacyShieldEnabled
    ? ['API Compound Name', 'Excipient Formulation Ratio', 'Proprietary Thermal/Binder Spec']
    : [];

  if (provider === 'none') {
    return buildDeterministicExplanation(defect, role, privacyShieldEnabled);
  }

  const sanitizedDefect = {
    deviationId: defect.deviationId,
    lineName: defect.lineName,
    equipmentName: defect.equipmentName,
    batchLotNumber: defect.batchLotNumber,
    drugSku: privacyShieldEnabled ? defect.maskedDrugSku : defect.drugSku,
    defectTitle: defect.defectTitle,
    severity: defect.severity,
    detectedAt: defect.detectedAt,
    batchValueAtRiskUsd: defect.batchValueAtRiskUsd,
    inspectionSummary: defect.inspectionSummary,
    limsContext: defect.limsContext,
    cppParameters: defect.cppParameters,
    historicalCapas: defect.historicalCapas,
  };

  const systemPrompt =
    role === 'operator'
      ? 'You are an expert GMP pharmaceutical cleanroom quality assistant speaking to a line operator. Explain root causes in clear, jargon-free plain language and give safe, prioritized, GMP-compliant step-by-step instructions. Never invent parameters not in the provided telemetry.'
      : 'You are a principal pharmaceutical QA & process validation engineer. Provide rigorous statistical CPP correlation (Cpk, Z-score, chronological drift), 21 CFR Part 211 / EU GMP references, and prioritized CAPA-aligned remediation steps grounded strictly in the provided telemetry.';

  const userPrompt = `Analyze this pharmaceutical batch deviation and return structured JSON matching the schema:\n${JSON.stringify(
    sanitizedDefect
  )}`;

  try {
    if (provider === 'gemini') {
      const ai = new GoogleGenAI({
        apiKey: key,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              probableRootCauseTitle: { type: Type.STRING },
              confidencePct: { type: Type.INTEGER },
              plainLanguageSummary: { type: Type.STRING },
              qaTechnicalSummary: { type: Type.STRING },
              correlatedAnomalySequence: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              recommendedHoldAction: { type: Type.STRING },
              estimatedBatchValueProtectedUsd: { type: Type.INTEGER },
              correctiveActions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    priority: { type: Type.STRING },
                    operatorInstruction: { type: Type.STRING },
                    qaTechnicalDetail: { type: Type.STRING },
                    gmpReference: { type: Type.STRING },
                    requiresDualSignOff: { type: Type.BOOLEAN },
                  },
                },
              },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      if (parsed.probableRootCauseTitle && Array.isArray(parsed.correctiveActions)) {
        return {
          defectId: defect.id,
          generatedAt: new Date().toISOString(),
          sourceEngine: 'gemini',
          privacyRedactedFields: redactedFields,
          probableRootCauseTitle: parsed.probableRootCauseTitle,
          confidencePct: Number(parsed.confidencePct) || 92,
          plainLanguageSummary: parsed.plainLanguageSummary || '',
          qaTechnicalSummary: parsed.qaTechnicalSummary || '',
          correlatedAnomalySequence: parsed.correlatedAnomalySequence || [],
          correctiveActions: parsed.correctiveActions.map((c: CorrectiveStep, idx: number) => ({
            id: c.id || `step-${idx + 1}`,
            priority:
              c.priority === 'Immediate' || c.priority === 'Verification' || c.priority === 'Preventive'
                ? c.priority
                : 'Immediate',
            operatorInstruction: c.operatorInstruction || '',
            qaTechnicalDetail: c.qaTechnicalDetail || '',
            gmpReference: c.gmpReference || '21 CFR 211.110',
            requiresDualSignOff: Boolean(c.requiresDualSignOff),
          })),
          estimatedBatchValueProtectedUsd:
            Number(parsed.estimatedBatchValueProtectedUsd) || Math.round(defect.batchValueAtRiskUsd * 0.92),
          recommendedHoldAction: parsed.recommendedHoldAction || 'Verify sub-lot quarantine per SOP.',
        };
      }
    } else if (provider === 'openai') {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: `${systemPrompt} Respond in valid JSON with keys: probableRootCauseTitle, confidencePct, plainLanguageSummary, qaTechnicalSummary, correlatedAnomalySequence (string[]), recommendedHoldAction, estimatedBatchValueProtectedUsd (number), correctiveActions (array of {id, priority, operatorInstruction, qaTechnicalDetail, gmpReference, requiresDualSignOff}).` },
            { role: 'user', content: userPrompt },
          ],
        }),
      });
      if (resp.ok) {
        const data = (await resp.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          if (parsed.probableRootCauseTitle && Array.isArray(parsed.correctiveActions)) {
            return {
              defectId: defect.id,
              generatedAt: new Date().toISOString(),
              sourceEngine: 'gemini',
              privacyRedactedFields: redactedFields,
              ...parsed,
            };
          }
        }
      }
    }
  } catch (err) {
    console.warn('[AI Engine] Falling back to deterministic GMP engine:', err instanceof Error ? err.message : err);
  }

  return buildDeterministicExplanation(defect, role, privacyShieldEnabled);
}

export function buildDeterministicChatReply(
  defect: BatchDefectAlert,
  role: UserRole,
  question: string
): { text: string; citations: string[] } {
  const q = question.toLowerCase();
  const drifts = getChronologicalDrifts(defect);
  const firstDrift = drifts[0] ?? defect.cppParameters[0];
  const secondDrift = drifts[1];
  const topCapa = defect.historicalCapas[0];
  const explanation = buildDeterministicExplanation(defect, role, true);

  if (q.includes('first') || q.includes('drifted') || q.includes('which machine parameter')) {
    const secondClause = secondDrift
      ? ` Following that initial shift, ${secondDrift.name} crossed its limit at ${secondDrift.firstDriftTimestamp} (${secondDrift.currentValue} ${secondDrift.unit}).`
      : '';
    return {
      text:
        role === 'operator'
          ? `**${firstDrift.name}** drifted out of spec first at **${firstDrift.firstDriftTimestamp}**. It moved to **${firstDrift.currentValue} ${firstDrift.unit}** (safe golden-batch window is **${firstDrift.goldenMin}–${firstDrift.goldenMax} ${firstDrift.unit}**).${secondClause} That early change triggered the downstream ${defect.defectTitle.toLowerCase()} alarm.`
          : `Chronological OPC-UA timestamp analysis confirms **${firstDrift.name}** was the leading indicator, breaching its validated golden-batch boundary (${firstDrift.goldenMin}–${firstDrift.goldenMax} ${firstDrift.unit}) at **${firstDrift.firstDriftTimestamp}** and reaching **${firstDrift.currentValue} ${firstDrift.unit}** (Z-score: ${firstDrift.zScore}, Cpk: ${firstDrift.cpk}).${secondClause}`,
      citations: [
        `MES-CPP: ${firstDrift.name} @ ${firstDrift.firstDriftTimestamp}`,
        `Spec: ${firstDrift.goldenMin}–${firstDrift.goldenMax} ${firstDrift.unit}`,
      ],
    };
  }

  if (q.includes('quarantine') || q.includes('sub-lot') || q.includes('hold')) {
    return {
      text:
        `**Yes — isolate the suspect sub-lot before making parameter adjustments.** ${explanation.recommendedHoldAction}\n\n` +
        `Specifically for **${defect.batchLotNumber}**, bracket all product manufactured from **${firstDrift.firstDriftTimestamp}** onward. Do not blend post-drift material with previously compliant output; protecting the rest of the **$${defect.batchValueAtRiskUsd.toLocaleString()}** batch avoids a full-lot rejection under 21 CFR 211.110.`,
      citations: [`Lot ${defect.batchLotNumber}`, `21 CFR 211.110`, `Drift onset ${firstDrift.firstDriftTimestamp}`],
    };
  }

  if (q.includes('previous') || q.includes('capa') || q.includes('history') || q.includes('occurred')) {
    if (!topCapa) {
      return {
        text: `No exact historical CAPA match was logged for this parameter profile on ${defect.lineName}; this event will be indexed as a baseline CAPA record upon QA sign-off.`,
        citations: [defect.deviationId],
      };
    }
    const extraCapa = defect.historicalCapas[1]
      ? `\n\nA secondary historical match (**${defect.historicalCapas[1].capaId}**, ${defect.historicalCapas[1].similarityPct}% similarity on ${defect.historicalCapas[1].pastLotNumber}) also resolved cleanly in ${defect.historicalCapas[1].resolutionTimeMin} min.`
      : '';
    return {
      text:
        `**Yes — ${topCapa.capaId} is a ${topCapa.similarityPct}% match** from lot **${topCapa.pastLotNumber}** (${topCapa.occurredDate}).\n\n` +
        `• **Verified Root Cause:** ${topCapa.verifiedRootCause}\n` +
        `• **Action That Worked:** ${topCapa.correctiveActionTaken}\n` +
        `• **Outcome:** ${topCapa.resolutionSuccessRate}% resolution success rate in **${topCapa.resolutionTimeMin} minutes**.${extraCapa}`,
      citations: [topCapa.capaId, `Lot ${topCapa.pastLotNumber}`, `${topCapa.resolutionSuccessRate}% Success`],
    };
  }

  if (q.includes('sequence') || q.includes('safest') || q.includes('step') || q.includes('bring') || q.includes('fix')) {
    const stepsText = explanation.correctiveActions
      .map(
        (s, idx) =>
          `${idx + 1}. **[${s.priority}]** ${
            role === 'operator' ? s.operatorInstruction : s.qaTechnicalDetail
          } _(${s.gmpReference})_`
      )
      .join('\n');
    return {
      text: `Follow this GMP-validated recovery sequence for **${defect.equipmentName}** (${defect.batchLotNumber}):\n\n${stepsText}`,
      citations: explanation.correctiveActions.map((s) => s.gmpReference),
    };
  }

  if (q.includes('simple') || q.includes('new shift') || q.includes('plain') || q.includes('explain')) {
    return {
      text:
        `**Simple Shift Summary for ${defect.lineName}:**\n\n` +
        `${explanation.plainLanguageSummary}\n\n` +
        `**What to do right now:** First set aside the recent suspect batch output since **${firstDrift.firstDriftTimestamp}**, then adjust **${firstDrift.name}** back to **${firstDrift.targetNominal} ${firstDrift.unit}** and run a quick quality check before restarting full production.`,
      citations: [`${defect.defectCode}`, `Target: ${firstDrift.targetNominal} ${firstDrift.unit}`],
    };
  }

  // Custom question dynamic handler
  return {
    text:
      `For **${defect.defectTitle}** on **${defect.batchLotNumber}** (${defect.equipmentName}):\n\n` +
      `• **Current Telemetry:** ${defect.cppParameters
        .map((p) => `${p.name} = ${p.currentValue} ${p.unit} (Spec ${p.goldenMin}–${p.goldenMax})`)
        .join('; ')}.\n` +
      `• **LIMS Context:** ${defect.limsContext}\n` +
      `• **Recommended Next Step:** ${explanation.correctiveActions[0]?.operatorInstruction ?? explanation.recommendedHoldAction}`,
    citations: [defect.deviationId, topCapa ? topCapa.capaId : defect.defectCode],
  };
}

export async function generateChatResponse(
  defect: BatchDefectAlert,
  role: UserRole,
  message: string,
  history: ChatMessage[],
  privacyShieldEnabled: boolean
): Promise<{ text: string; citations: string[]; sourceEngine: 'gemini' | 'deterministic-gmp' }> {
  const { provider, key } = getValidApiKey();

  if (provider === 'none') {
    const fallback = buildDeterministicChatReply(defect, role, message);
    return { ...fallback, sourceEngine: 'deterministic-gmp' };
  }

  const contextPayload = {
    deviationId: defect.deviationId,
    lineName: defect.lineName,
    equipmentName: defect.equipmentName,
    batchLotNumber: defect.batchLotNumber,
    drugSku: privacyShieldEnabled ? defect.maskedDrugSku : defect.drugSku,
    defectTitle: defect.defectTitle,
    severity: defect.severity,
    inspectionSummary: defect.inspectionSummary,
    limsContext: defect.limsContext,
    cppParameters: defect.cppParameters,
    historicalCapas: defect.historicalCapas,
    recentHistory: history.slice(-4).map((h) => ({ sender: h.sender, text: h.text })),
  };

  const systemInstruction =
    role === 'operator'
      ? 'You are a GMP cleanroom AI quality assistant answering a line operator. Be clear, practical, concise, and cite exact timestamps, CPP target limits, and CAPA IDs from the context.'
      : 'You are a senior GMP QA & validation AI copilot answering a Quality Assurance engineer. Cite exact CPP metrics (Cpk, Z-score, golden limits), 21 CFR Part 211 / USP references, and CAPA history from the context.';

  try {
    if (provider === 'gemini') {
      const ai = new GoogleGenAI({
        apiKey: key,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Batch & Telemetry Context:\n${JSON.stringify(contextPayload)}\n\nUser Question: ${message}`,
        config: { systemInstruction },
      });
      const text = (response.text ?? '').trim();
      if (text) {
        return {
          text,
          citations: [
            defect.deviationId,
            defect.historicalCapas[0]?.capaId ?? defect.defectCode,
          ],
          sourceEngine: 'gemini',
        };
      }
    } else if (provider === 'openai') {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemInstruction },
            {
              role: 'user',
              content: `Batch & Telemetry Context:\n${JSON.stringify(contextPayload)}\n\nUser Question: ${message}`,
            },
          ],
        }),
      });
      if (resp.ok) {
        const data = (await resp.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) {
          return {
            text,
            citations: [defect.deviationId, defect.historicalCapas[0]?.capaId ?? defect.defectCode],
            sourceEngine: 'gemini',
          };
        }
      }
    }
  } catch (err) {
    console.warn('[AI Chat] Falling back to deterministic GMP engine:', err instanceof Error ? err.message : err);
  }

  const fallback = buildDeterministicChatReply(defect, role, message);
  return { ...fallback, sourceEngine: 'deterministic-gmp' };
}
