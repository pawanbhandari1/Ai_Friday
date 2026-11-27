export type UserRole = 'operator' | 'qa_engineer';

export interface DemoUser {
  id: string;
  employeeId: string;
  name: string;
  title: string;
  department: string;
  assignedLine: string;
  role: UserRole;
  avatarPath: string;
  clearance: string;
}

export type DefectSeverity = 'Critical Hold' | 'Warning' | 'Resolved';

export interface CppParameterSpec {
  id: string;
  name: string;
  unit: string;
  goldenMin: number;
  goldenMax: number;
  targetNominal: number;
  currentValue: number;
  firstDriftTimestamp: string;
  cpk: number;
  zScore: number;
  isOutOfSpec: boolean;
}

export interface CppTelemetryPoint {
  timestamp: string;
  [paramId: string]: number | string;
}

export interface HistoricalCapaRecord {
  capaId: string;
  similarityPct: number;
  pastLotNumber: string;
  occurredDate: string;
  verifiedRootCause: string;
  correctiveActionTaken: string;
  resolutionSuccessRate: number;
  resolutionTimeMin: number;
}

export interface CorrectiveStep {
  id: string;
  priority: 'Immediate' | 'Verification' | 'Preventive';
  operatorInstruction: string;
  qaTechnicalDetail: string;
  gmpReference: string;
  requiresDualSignOff: boolean;
}

export interface AiExplanationPayload {
  defectId: string;
  generatedAt: string;
  sourceEngine: 'gemini' | 'deterministic-gmp';
  privacyRedactedFields: string[];
  probableRootCauseTitle: string;
  confidencePct: number;
  plainLanguageSummary: string;
  qaTechnicalSummary: string;
  correlatedAnomalySequence: string[];
  correctiveActions: CorrectiveStep[];
  estimatedBatchValueProtectedUsd: number;
  recommendedHoldAction: string;
}

export interface BatchDefectAlert {
  id: string;
  deviationId: string;
  lineId: string;
  lineName: string;
  equipmentName: string;
  batchLotNumber: string;
  drugSku: string;
  maskedDrugSku: string;
  proprietaryFormulaNote: string;
  defectCode: string;
  defectTitle: string;
  severity: DefectSeverity;
  detectedAt: string;
  batchHoldRisk: string;
  batchValueAtRiskUsd: number;
  inspectionSummary: string;
  limsContext: string;
  mesBatchStage: string;
  cppParameters: CppParameterSpec[];
  telemetrySeries: CppTelemetryPoint[];
  historicalCapas: HistoricalCapaRecord[];
  expectedResolutionMin: number;
  actualResolutionMin?: number;
  signedOffBy?: string;
  signedOffAt?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  citations?: string[];
  sourceEngine?: 'gemini' | 'deterministic-gmp';
}

export interface FeedbackEntry {
  defectId: string;
  rating: 'up' | 'down';
  comment: string;
  submittedAt: string;
  submittedBy: string;
}

export interface ProductionLineSummary {
  lineId: string;
  lineName: string;
  equipment: string;
  currentBatch: string;
  stage: string;
  oeePct: number;
  meanResolutionMinBefore: number;
  meanResolutionMinWithAi: number;
  scrapSavedUsd: number;
  activeAlerts: number;
  status: 'Critical Hold' | 'Warning' | 'Nominal';
}
