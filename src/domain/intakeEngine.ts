import type {
  ClientCase,
  Emotion,
  IntakeSession,
  InterpretedTurn,
  KnowledgeEntry,
  ToolReceipt,
} from './casework';

export interface ResolvedTurn {
  session: IntakeSession;
  receipt: ToolReceipt;
  revealedText?: string;
}

export interface ClaimComparison {
  claimId: string;
  knowledgeId: string;
  slot: ClientCase['facts'][number]['slot'];
  valid: boolean;
}

export function compareClaim(
  caseData: ClientCase,
  claimId: string,
  knowledgeId: string,
  knowledge: readonly KnowledgeEntry[],
): ClaimComparison {
  const claim = caseData.openingClaims.find((candidate) => candidate.id === claimId);
  const entry = knowledge.find((candidate) => candidate.id === knowledgeId);
  const revealedFact = claim?.revealFactId
    ? caseData.facts.find((fact) => fact.id === claim.revealFactId)
    : undefined;
  return {
    claimId,
    knowledgeId,
    slot: revealedFact?.slot ?? claim?.slot ?? 'target',
    valid: Boolean(claim && entry && claim.knowledgeIds.includes(entry.id)),
  };
}

export function resolveTurn(
  caseData: ClientCase,
  session: IntakeSession,
  turnId: string,
  interpretation: InterpretedTurn,
  knowledge: readonly KnowledgeEntry[],
): ResolvedTurn {
  if (session.usedTurnIds.includes(turnId)) {
    const previousReceipt = session.receipts[turnId];
    if (!previousReceipt) throw new Error('처리된 턴의 영수증이 없다.');
    return {
      session,
      receipt: previousReceipt,
    };
  }

  const visibleKnowledge = new Set(knowledge.map((entry) => entry.id));
  const validKnowledgeIds = interpretation.citedKnowledgeIds.filter((id) => visibleKnowledge.has(id));
  const disclosed = new Set(session.disclosedFactIds);
  const targetFacts = caseData.facts.filter((fact) => interpretation.targetSlots.includes(fact.slot));
  const revealable = targetFacts.filter((fact) => {
    if (disclosed.has(fact.id) || fact.ownerKnowledge === 'unknown') return false;
    if (fact.disclosure !== 'concealed') return true;
    return fact.requiredKnowledgeIds.some((id) => validKnowledgeIds.includes(id));
  });

  const revealed = revealable.slice(0, 1);
  revealed.forEach((fact) => disclosed.add(fact.id));

  const unsupportedAttack = interpretation.tone === 'hostile' && revealed.length === 0 && validKnowledgeIds.length === 0;
  const repeatedQuestion = targetFacts.length > 0 && targetFacts.every((fact) => disclosed.has(fact.id)) && revealed.length === 0 && validKnowledgeIds.length === 0;
  const patienceDelta = unsupportedAttack || repeatedQuestion ? -1 : 0;
  const guardDelta = validKnowledgeIds.length > 0 ? -1 : unsupportedAttack ? 1 : interpretation.intent === 'reassure' ? -1 : 0;

  let agreedReward: number | undefined;
  let counterOffer: number | undefined;
  if (interpretation.intent === 'negotiate' && interpretation.offerAmount !== undefined) {
    const requested = Math.max(0, Math.round(interpretation.offerAmount));
    if (requested <= caseData.budgetCap) agreedReward = Math.max(session.reward, requested);
    else counterOffer = Math.max(session.reward, caseData.budgetCap);
  }

  const patience = clamp(session.patience + patienceDelta, 0, 4);
  const guard = clamp(session.guard + guardDelta, 0, 2);
  const emotion = emotionOf(patience, guard, unsupportedAttack);
  const reaction = revealed[0]?.response
    ?? (agreedReward !== undefined ? `좋소. 은화 ${agreedReward}닢으로 합시다.` : undefined)
    ?? (counterOffer !== undefined ? `${counterOffer}닢이 한계요. 그 이상은 못 냅니다.` : undefined)
    ?? (interpretation.confidence < 0.65 ? '무슨 뜻인지 다시 말해 주시겠어요?' : undefined)
    ?? (unsupportedAttack ? '근거도 없이 사람을 몰아붙이지 마시오.' : undefined)
    ?? '그건 제가 아는 범위에서는 더 말씀드리기 어렵군요.';
  const receipt: ToolReceipt = {
    turnId,
    revealedFactIds: revealed.map((fact) => fact.id),
    validKnowledgeIds,
    patienceDelta,
    guardDelta,
    agreedReward,
    counterOffer,
    reaction,
  };
  const nextSession: IntakeSession = {
    ...session,
    patience,
    guard,
    emotion,
    reward: agreedReward ?? counterOffer ?? session.reward,
    disclosedFactIds: [...disclosed],
    usedTurnIds: [...session.usedTurnIds, turnId],
    receipts: { ...session.receipts, [turnId]: receipt },
  };

  return {
    session: nextSession,
    revealedText: revealed[0]?.value,
    receipt,
  };
}

function emotionOf(patience: number, guard: number, attacked: boolean): Emotion {
  if (patience === 0 || attacked) return 'angry';
  if (guard >= 2) return 'guarded';
  if (patience <= 2 || guard === 0) return 'uneasy';
  return 'calm';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
