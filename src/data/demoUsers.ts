import { DemoUser } from '../types/pharma';

export const DEMO_USERS: DemoUser[] = [
  {
    id: 'user-operator-aarav',
    employeeId: 'EMP-OP-1042',
    name: 'Aarav Sharma',
    title: 'Cleanroom Line Operator',
    department: 'Oral Solid Dosage · Suite B',
    assignedLine: 'Line 1 Tablet Compression',
    role: 'operator',
    avatarPath: '/src/assets/images/avatar_aarav_sharma_1795760573008.jpg',
    clearance: 'GMP Level 2 · Cleanroom Floor',
  },
  {
    id: 'user-qa-priya',
    employeeId: 'EMP-QA-0218',
    name: 'Dr. Priya Nair',
    title: 'Senior QA / Validation Engineer',
    department: 'Quality Assurance & CAPA Governance',
    assignedLine: 'Plant-Wide Lines 1–4',
    role: 'qa_engineer',
    avatarPath: '/src/assets/images/avatar_priya_nair_1795760573612.jpg',
    clearance: '21 CFR Part 11 · Batch Release Authority',
  },
];
