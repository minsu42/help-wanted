import {
  COMMISSION_SLOTS,
  RISK_POWER,
  type ClientCase,
  type CommissionSheet,
  type DispatchResult,
  type PartyApplication,
  type PartyCandidate,
} from './casework';

export function getPartyApplications(
  sheet: CommissionSheet,
  parties: readonly PartyCandidate[],
  agreedReward: number,
): PartyApplication[] {
  const recordedRisk = RISK_POWER[sheet.risk];
  return parties.map((party) => {
    const rewardRatio = agreedReward / party.minimumReward;
    const gradeFit = Math.abs(RISK_POWER[party.grade] - recordedRisk) <= 1 ? 1 : 0;
    const capabilityFit = sheet.preparations.length === 0
      ? 0.5
      : sheet.preparations.filter((tag) => party.specialties.includes(tag)).length / sheet.preparations.length;
    const score = round1(Math.min(2, rewardRatio) + gradeFit + capabilityFit);
    const status: PartyApplication['status'] = rewardRatio >= 0.8 && gradeFit === 1 && score >= 2.3 ? 'applied' : 'refused';
    const reason = status === 'applied'
      ? capabilityFit >= 1 ? '요구 준비를 모두 갖췄다.' : '기록된 위험과 보수를 감당할 수 있다.'
      : rewardRatio < 0.8 ? '보수가 파티 기준에 미달한다.' : gradeFit === 0 ? '기록된 위험 등급이 활동 범위와 맞지 않는다.' : '요구 준비를 충족하기 어렵다.';
    return { partyId: party.id, score, status, reason };
  }).sort((a, b) => b.score - a.score);
}

export function resolveDispatch(
  caseData: ClientCase,
  sheet: CommissionSheet,
  party: PartyCandidate | undefined,
  agreedReward: number,
  disclosedFactIds: readonly string[],
): DispatchResult {
  if (!sheet.accepted) {
    return {
      caseId: caseData.id,
      score: 0,
      completeness: 0,
      preparation: 0,
      outcome: 'rejected',
      reward: caseData.illegal ? 8 : 0,
      notes: [caseData.illegal ? '금지 의뢰를 거절해 길드 규정을 지켰다.' : '의뢰를 거절해 모험가는 파견되지 않았다.'],
    };
  }

  if (!party) {
    return {
      caseId: caseData.id,
      score: 0,
      completeness: 0,
      preparation: 0,
      outcome: 'unassigned',
      reward: 0,
      notes: ['게시했으나 어느 파티에도 인계하지 않아 의뢰가 그대로 마감됐다.'],
    };
  }

  const scores = COMMISSION_SLOTS.map((slot) => {
    const fact = caseData.facts.find((candidate) => candidate.id === sheet.entries[slot]);
    // 확보하지 않았거나 다른 칸의 사실을 끼워 넣은 기재는 점수가 되지 않는다.
    if (!fact || !disclosedFactIds.includes(fact.id) || fact.slot !== slot) return 0;
    return 1;
  });
  const completeness = round1(4 * scores.reduce<number>((sum, value) => sum + value, 0) / COMMISSION_SLOTS.length);
  const matchedPreparation = caseData.requiredPreparations.filter((need) =>
    sheet.preparations.includes(need) || party.specialties.includes(need),
  ).length;
  const preparation = round1(caseData.requiredPreparations.length === 0
    ? 0
    : 2 * matchedPreparation / caseData.requiredPreparations.length);
  const riskPenalty = RISK_POWER[sheet.risk] < RISK_POWER[caseData.correctRisk] ? 1 : 0;
  const score = round1(party.power + completeness + preparation - caseData.threat - riskPenalty);
  const outcome = score >= 4 ? 'complete' : score >= 2 ? 'success' : score >= 0 ? 'injured' : score >= -2 ? 'failed' : 'death';
  const notes = [
    `파티 전력 ${party.power}, 정보 충실도 ${completeness}, 준비도 ${preparation}, 실제 위협 ${caseData.threat}.`,
    riskPenalty ? '위험 등급을 낮게 적어 파티가 경계를 늦췄다.' : '위험 등급이 실제 위협을 감당할 수준이었다.',
    matchedPreparation === caseData.requiredPreparations.length ? '필수 준비가 모두 갖춰졌다.' : '필수 준비가 부족했다.',
  ];
  return { caseId: caseData.id, score, completeness, preparation, outcome, reward: outcome === 'death' ? 0 : agreedReward, notes };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
