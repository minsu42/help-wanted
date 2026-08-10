export type CommissionSlot = 'objective' | 'target' | 'scale' | 'location' | 'trait';
export type RiskGrade = 'D' | 'C' | 'B' | 'A' | 'S';
export type Emotion = 'calm' | 'uneasy' | 'guarded' | 'angry';
export type Intent = 'ask' | 'challenge' | 'negotiate' | 'accuse' | 'reassure' | 'other';

export interface KnowledgeEntry {
  id: string;
  /** 이 조항이 게시판에 붙는 날. 없으면 첫날부터 유효하다. */
  activeFromDay?: number;
  /**
   * 이 항목을 자료집에 올린 파견 보고의 사건 id.
   *
   * 길드 자료집은 누가 앉아서 쓴 것이 아니라 **돌아온 파티의 보고로 채워진다.**
   * 해당 사건의 보고가 도착하기 전에는 존재하지 않는다.
   */
  unlockedByCase?: string;
  /** 책 하단에 찍히는 출처 각주. */
  source?: string;
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

/**
 * 아침 공문 — 그날부터 게시 심사에 적용되는 길드 지침.
 *
 * 판정은 **의뢰서에 적힌 내용만** 본다. 사건의 실제 진실을 참조하는 지침은 만들지 않는다.
 * 그렇게 하면 반려 문구가 곧 정답 공개가 되어 대조 퍼즐이 무너진다.
 */
export interface Directive {
  id: string;
  activeFromDay: number;
  title: string;
  text: string;
  /** 위반이면 반려 사유를 반환하고, 통과면 undefined를 반환한다. */
  violation: (sheet: CommissionSheet) => string | undefined;
}

export interface CommissionSheet {
  /** 칸마다 확보한 사실 하나를 고르거나 비워 둔다. 확신도 등급은 두지 않는다. */
  entries: Record<CommissionSlot, string | undefined>;
  risk: RiskGrade;
  preparations: string[];
  accepted: boolean;
  partyId?: string;
}

/**
 * 파견에서 돌아온 쪽의 진술서.
 *
 * 판정 숫자(`정보 0.4 · 준비 1 · 위협 4`)는 **왜 죽었는지를 말해 주지 않는다.**
 * 어느 칸이 비어서 무엇을 마주쳤는지는 다녀온 사람만 알고, 기둥 6은 그 입을
 * 거쳐야만 코드 밖으로 나온다. 문장은 손으로 쓰지 않고 슬롯별 템플릿으로 조립한다.
 */
export interface FieldReport {
  /** 진술한 사람 — 전멸이면 시신을 수습한 쪽이 대신 적는다. */
  speaker: string;
  lines: readonly string[];
}

export interface DispatchResult {
  caseId: string;
  score: number;
  completeness: number;
  preparation: number;
  outcome: 'complete' | 'success' | 'injured' | 'failed' | 'death' | 'rejected' | 'unassigned';
  reward: number;
  notes: string[];
  /** 파견이 실제로 나간 경우에만 있다. 거절·미인계에는 진술할 사람이 없다. */
  report?: FieldReport;
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
    entries: { objective: undefined, target: undefined, scale: undefined, location: undefined, trait: undefined },
    risk: 'D',
    preparations: [],
    accepted: true,
  };
}
