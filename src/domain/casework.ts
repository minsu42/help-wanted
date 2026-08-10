export type CommissionSlot = 'objective' | 'target' | 'scale' | 'location' | 'trait';
export type FactConfidence = 'confirmed' | 'inferred' | 'unknown';
export type RiskGrade = 'D' | 'C' | 'B' | 'A' | 'S';
export type Emotion = 'calm' | 'uneasy' | 'guarded' | 'angry';
export type Intent = 'ask' | 'challenge' | 'negotiate' | 'accuse' | 'reassure' | 'other';

export interface KnowledgeEntry {
  id: string;
  book: 'bestiary' | 'rules';
  title: string;
  text: string;
  category: string;
  tags: readonly string[];
  imageQuadrant?: 'mimic' | 'wisp' | 'troll' | 'crystal';
  size?: string;
  habitat?: string;
  traces?: string;
  traits?: string;
  weakness?: string;
  danger?: RiskGrade;
}

export interface ClientClaim {
  id: string;
  slot: CommissionSlot;
  text: string;
  knowledgeIds: readonly string[];
  revealFactId?: string;
}

export interface CaseFact {
  id: string;
  slot: CommissionSlot;
  label: string;
  value: string;
  response: string;
  ownerKnowledge: 'knows' | 'misunderstands' | 'unknown';
  disclosure: 'voluntary' | 'askable' | 'concealed';
  requiredKnowledgeIds: readonly string[];
}

export interface ClientCase {
  id: string;
  clientName: string;
  occupation: string;
  portraitIndex: number;
  premise: string;
  opening: string;
  motive: string;
  demeanor: string;
  facts: readonly CaseFact[];
  openingClaims: readonly ClientClaim[];
  baseReward: number;
  budgetCap: number;
  threat: number;
  correctRisk: RiskGrade;
  requiredPreparations: readonly string[];
  illegal: boolean;
}

export interface PartyCandidate {
  id: string;
  name: string;
  grade: RiskGrade;
  power: number;
  specialties: readonly string[];
  quote: string;
  minimumReward: number;
}

export interface PartyApplication {
  partyId: string;
  score: number;
  status: 'applied' | 'refused';
  reason: string;
}

export interface DialogueTurn {
  id: string;
  speaker: 'player' | 'client' | 'system';
  text: string;
}

export interface InterpretedTurn {
  intent: Intent;
  targetSlots: CommissionSlot[];
  assertedFactIds: string[];
  citedKnowledgeIds: string[];
  offerAmount?: number;
  tone: 'supportive' | 'neutral' | 'hostile';
  confidence: number;
}

export interface ToolReceipt {
  turnId: string;
  revealedFactIds: string[];
  validKnowledgeIds: string[];
  patienceDelta: number;
  guardDelta: number;
  agreedReward?: number;
  counterOffer?: number;
  reaction: string;
}

export interface IntakeSession {
  caseId: string;
  patience: number;
  guard: number;
  emotion: Emotion;
  reward: number;
  disclosedFactIds: string[];
  turns: DialogueTurn[];
  usedTurnIds: string[];
  receipts: Record<string, ToolReceipt>;
  challengedClaimIds: string[];
}

export interface CommissionEntry {
  factId?: string;
  confidence: FactConfidence;
}

export interface CommissionSheet {
  entries: Record<CommissionSlot, CommissionEntry>;
  risk: RiskGrade;
  preparations: string[];
  accepted: boolean;
  partyId?: string;
}

export interface DispatchResult {
  caseId: string;
  score: number;
  completeness: number;
  preparation: number;
  outcome: 'complete' | 'success' | 'injured' | 'failed' | 'death' | 'rejected' | 'unassigned';
  reward: number;
  notes: string[];
}

export const COMMISSION_SLOTS: readonly CommissionSlot[] = [
  'objective',
  'target',
  'scale',
  'location',
  'trait',
];

export const SLOT_LABELS: Readonly<Record<CommissionSlot, string>> = {
  objective: '목표',
  target: '대상',
  scale: '규모',
  location: '장소·경로',
  trait: '특징·약점',
};

export const RISK_POWER: Readonly<Record<RiskGrade, number>> = {
  D: 1,
  C: 2,
  B: 3,
  A: 4,
  S: 5,
};

export function createSession(caseData: ClientCase): IntakeSession {
  const voluntary = caseData.facts.filter((fact) => fact.disclosure === 'voluntary').map((fact) => fact.id);
  return {
    caseId: caseData.id,
    patience: 4,
    guard: 1,
    emotion: 'calm',
    reward: caseData.baseReward,
    disclosedFactIds: voluntary,
    turns: [
      { id: `${caseData.id}-opening`, speaker: 'client', text: caseData.opening },
    ],
    usedTurnIds: [],
    receipts: {},
    challengedClaimIds: [],
  };
}

export function emptyCommission(): CommissionSheet {
  return {
    entries: {
      objective: { confidence: 'unknown' },
      target: { confidence: 'unknown' },
      scale: { confidence: 'unknown' },
      location: { confidence: 'unknown' },
      trait: { confidence: 'unknown' },
    },
    risk: 'D',
    preparations: [],
    accepted: true,
  };
}
