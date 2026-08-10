import {
  COMMISSION_SLOTS,
  RISK_POWER,
  SLOT_LABELS,
  type ClientCase,
  type CommissionSlot,
  type CommissionSheet,
  type DispatchResult,
  type FieldReport,
  type PartyApplication,
  type PartyCandidate,
} from './casework';

/** 칸이 비어 있었을 때 현장에서 무슨 일이 벌어지는가. 슬롯마다 대가가 다르다. */
const BLANK_CONSEQUENCE: Readonly<Record<CommissionSlot, string>> = {
  objective: '무엇을 끝내야 하는지 적혀 있지 않아, 어디까지가 끝인지 현장에서 우리끼리 정했습니다',
  target: '상대가 적혀 있지 않았습니다. 마주치고 나서야 알았습니다',
  scale: '수가 적혀 있지 않아 인원을 늘리지 않고 갔습니다',
  location: '길이 적혀 있지 않아 해가 질 때까지 헤맸습니다',
  trait: '약점이 적혀 있지 않아, 통하지 않는 방법을 먼저 썼습니다',
};

/** 칸이 채워져 있었지만 현장과 달랐을 때. 빈칸보다 나쁘다 — 파티가 그것을 믿는다. */
const WRONG_CONSEQUENCE: Readonly<Record<CommissionSlot, string>> = {
  objective: '적힌 목표를 끝냈는데도 일이 끝나지 않았습니다',
  target: '적힌 상대를 잡으러 갔다가 다른 것을 만났습니다',
  scale: '적힌 수만큼만 준비해 갔습니다',
  location: '적힌 곳에는 아무것도 없었습니다',
  trait: '적힌 약점은 통하지 않았습니다',
};

const OUTCOME_VOICE: Readonly<Record<'complete' | 'success' | 'injured' | 'failed' | 'death', {
  speaker: (party: string) => string; opening: string;
}>> = {
  complete: { speaker: (party) => `${party} 대장`, opening: '서류대로였습니다. 다친 사람 없이 끝냈습니다.' },
  success: { speaker: (party) => `${party} 대장`, opening: '끝냈습니다. 다만 서류에 없던 것을 현장에서 메웠습니다.' },
  injured: { speaker: (party) => `${party} 생존자`, opening: '둘이 실려 왔습니다. 말할 수 있는 사람이 이것을 적습니다.' },
  failed: { speaker: (party) => `${party} 대장`, opening: '중간에 물러났습니다. 더 있었으면 시신을 세는 쪽이 됐습니다.' },
  death: { speaker: (party) => `${party} 수습을 다녀온 파발꾼`, opening: '돌아온 사람은 없습니다. 현장에서 이 진술서만 수거했습니다.' },
};

// 줄 수를 자르지 않는다. 다섯 칸을 다 비웠으면 다섯 줄을 읽는 것이 대가다 —
// 잘라내면 무엇 때문에 죽었는지가 조용히 사라진다 (최대 8줄).

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
  const report = buildFieldReport(caseData, sheet, party, disclosedFactIds, outcome, riskPenalty === 1);
  const notes = [
    `파티 전력 ${party.power}, 정보 충실도 ${completeness}, 준비도 ${preparation}, 실제 위협 ${caseData.threat}.`,
    riskPenalty ? '위험 등급을 낮게 적어 파티가 경계를 늦췄다.' : '위험 등급이 실제 위협을 감당할 수준이었다.',
    matchedPreparation === caseData.requiredPreparations.length ? '필수 준비가 모두 갖춰졌다.' : '필수 준비가 부족했다.',
  ];
  return { caseId: caseData.id, score, completeness, preparation, outcome, reward: outcome === 'death' ? 0 : agreedReward, notes, report };
}

/**
 * 현장 진술서를 조립한다.
 *
 * 순서가 곧 인과의 순서다: 누가 말하는가 → 등급을 잘못 읽어 무엇을 줄였는가 →
 * 없던 준비물 → 칸별로 비었거나 틀린 것. 진실(`fact.value`)은 **사후에만** 나온다 —
 * 파견 전에 새면 대조 퍼즐이 무너지고, 파견 후에 나오지 않으면 배울 것이 없다.
 */
function buildFieldReport(
  caseData: ClientCase,
  sheet: CommissionSheet,
  party: PartyCandidate,
  disclosedFactIds: readonly string[],
  outcome: 'complete' | 'success' | 'injured' | 'failed' | 'death',
  riskUnderstated: boolean,
): FieldReport {
  const voice = OUTCOME_VOICE[outcome];
  const lines = [voice.opening];

  if (riskUnderstated) {
    lines.push(`위험 등급이 ${sheet.risk}로 적혀 있어 그 수준으로 장비를 챙겼습니다. 실제는 ${caseData.correctRisk}였습니다.`);
  }
  const missing = caseData.requiredPreparations.filter((need) =>
    !sheet.preparations.includes(need) && !party.specialties.includes(need),
  );
  if (missing.length) {
    const listed = missing.join(' · ');
    lines.push(`${listed}${subjectParticle(listed)} 없었습니다. 그것 없이 할 수 있는 일이 아니었습니다.`);
  }

  for (const slot of COMMISSION_SLOTS) {
    const truth = caseData.facts.find((fact) => fact.slot === slot);
    const written = caseData.facts.find((fact) => fact.id === sheet.entries[slot]);
    const label = SLOT_LABELS[slot];
    if (!sheet.entries[slot]) {
      lines.push(`「${label}」 칸이 비어 있었습니다. ${BLANK_CONSEQUENCE[slot]}${truth ? ` — ${truth.value}` : ''}.`);
    } else if (!written || written.slot !== slot || !disclosedFactIds.includes(written.id)) {
      lines.push(`「${label}」에 적힌 것은 현장과 달랐습니다. ${WRONG_CONSEQUENCE[slot]}${truth ? ` — ${truth.value}` : ''}.`);
    }
  }

  // 서류가 완전했는데도 죽는 경우가 있다. 그때 접수원 탓을 하면 판정이 거짓말을 하는 셈이다.
  if (lines.length === 1) {
    lines.push(outcome === 'complete' || outcome === 'success'
      ? '적힌 것과 현장이 같았습니다. 그것만으로 절반은 끝난 일이었습니다.'
      : '서류에는 빠진 것이 없었습니다. 그래도 그것이 우리보다 셌습니다.');
  }
  return { speaker: voice.speaker(party.name), lines };
}

/**
 * 앞 낱말의 종성을 보고 주격 조사를 고른다 — 준비물 이름은 데이터에서 오므로
 * '이/가'를 문장에 박아 둘 수 없다 ("화염 도구이 없었습니다"가 그 결과였다).
 */
function subjectParticle(word: string): '이' | '가' {
  const last = word.trim().codePointAt(word.trim().length - 1) ?? 0;
  if (last < 0xac00 || last > 0xd7a3) return '가';
  return (last - 0xac00) % 28 === 0 ? '가' : '이';
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
