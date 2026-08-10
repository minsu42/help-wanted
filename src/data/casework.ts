import type { ClientCase, KnowledgeEntry, PartyCandidate } from '../domain/casework';

/**
 * 의뢰서에 기재할 수 있는 준비 항목의 고정 순서.
 *
 * 사건별 `requiredPreparations`를 앞에 붙여 목록을 만들면 정답이 항상 맨 앞에 오므로,
 * 플레이어가 백과사전을 읽지 않고 위치만으로 답을 맞힐 수 있다. 순서는 사건과 무관하게 고정한다.
 */
export const PREPARATION_OPTIONS: readonly string[] = [
  '길잡이',
  '방패',
  '마력 감지',
  '은 가루',
  '화염 도구',
  '응급 처치',
  '도적 경계',
];

export const KNOWLEDGE: readonly KnowledgeEntry[] = [
  { id: 'k-mimic-scratches', book: 'bestiary', category: '위장종', tags: ['괴물', '위장종', 'C급'], title: '상자형 미믹', text: '상자형 미믹은 경첩처럼 나란한 긁힘과 금속성 침을 남긴다.', imageQuadrant: 'mimic', size: '상자 1개 크기 · 높이 1.2m', habitat: '창고, 지하 저장고, 폐허', traces: '평행한 긁힘, 끈적한 금속성 침', traits: '물건으로 위장해 가까이 온 먹이를 붙잡는다.', weakness: '불, 강한 알코올', danger: 'C' },
  { id: 'k-mimic-fire', book: 'bestiary', category: '위장종', tags: ['괴물', '위장종', '약점'], title: '미믹 대응 기록', text: '미믹의 접착성 혀는 불과 강한 알코올에 약하다.', imageQuadrant: 'mimic', size: '개체별 편차 큼', habitat: '밀폐된 실내', traces: '바닥을 끈 흔적', traits: '첫 공격은 혀로 무장 해제한다.', weakness: '화염 도구, 알코올', danger: 'C' },
  { id: 'k-wisp-cold', book: 'bestiary', category: '정령종', tags: ['괴물', '정령종', 'C급'], title: '늪불 도깨비', text: '푸른 불빛과 급격한 냉기는 늪불 도깨비의 징후다. 은 가루가 길잡이가 된다.', imageQuadrant: 'wisp', size: '불꽃 하나 약 30cm', habitat: '습지, 돌무덤, 검은 버드나무', traces: '푸른 불빛, 여름에도 서리는 냉기', traits: '여럿이 빛을 이어 길을 잃게 만든다.', weakness: '은 가루로 진로 고정', danger: 'C' },
  { id: 'k-troll', book: 'bestiary', category: '거인종', tags: ['괴물', '거인종', 'B급'], title: '이끼 다리 트롤', text: '성체 트롤은 사람 두 배 높이이며 젖은 이끼가 붙은 피부를 빠르게 재생한다.', imageQuadrant: 'troll', size: '성체 3.2~4m', habitat: '돌다리, 협곡, 습한 동굴', traces: '맨발 자국, 부서진 돌, 이끼 냄새', traits: '완력과 재생력이 높지만 둔하다.', weakness: '불로 재생 억제', danger: 'B' },
  { id: 'k-smuggling', book: 'rules', category: '접수 금지', tags: ['규정', '접수 금지', '마력'], title: '금지 화물 조항 7', text: '봉인 없는 마력석 운반은 밀수로 간주하며 길드는 접수할 수 없다.', imageQuadrant: 'crystal' },
  { id: 'k-seal-standard', book: 'rules', category: '화물 규정', tags: ['규정', '마력', '증빙'], title: '마력석 봉인 기준', text: '합법 마력석은 마법사 조합의 청동 봉인과 운송장을 함께 제시해야 한다.', imageQuadrant: 'crystal' },
  { id: 'k-c-rate', book: 'rules', category: '표준 보수', tags: ['규정', '시세', 'C급'], title: 'C급 시세', text: 'C급 의뢰의 최소 보수는 은화 24닢이다.' },
  { id: 'k-b-rate', book: 'rules', category: '표준 보수', tags: ['규정', '시세', 'B급'], title: 'B급 시세', text: 'B급 의뢰의 최소 보수는 은화 36닢이다.' },
  { id: 'k-magic-premium', book: 'rules', category: '위험수당', tags: ['규정', '시세', '마력'], title: '마력 위험수당', text: '마력성 위험에는 기본 보수의 20% 이상을 가산한다.', imageQuadrant: 'crystal' },
  { id: 'k-rescue-rule', book: 'rules', category: '목표 우선순위', tags: ['규정', '구조', '생존자'], title: '구조 우선 원칙', text: '생존자 가능성이 있는 의뢰는 회수보다 구조를 우선 기록한다.' },
];

export const CASES: readonly ClientCase[] = [
  {
    id: 'case-rat-cellar', clientName: '마라', occupation: '양조장 주인', portraitIndex: 0,
    premise: '양조장 지하에서 사라지는 술통',
    opening: '사흘 전부터 지하 저장고의 술통이 깨지고 있어요. 큰 쥐 짓이라고 생각했는데, 어젯밤에는 빈 상자 하나가 반대편 벽으로 옮겨져 있더군요. 바닥에는 나란한 긁힌 자국이 났고 끈적한 쇳내도 났어요. 술통을 찾아주면 은화 18닢을 드리죠.',
    motive: '양조장의 평판을 지키고 싶다.', demeanor: '성실하지만 괴물 지식이 부족해 관찰을 엉뚱하게 해석한다.',
    baseReward: 18, budgetCap: 30, threat: 4, correctRisk: 'C', requiredPreparations: ['화염 도구', '방패'], illegal: false,
    openingClaims: [
      { id: 'c1-rat', slot: 'target', text: '큰 쥐가 술통을 망쳤다', knowledgeIds: ['k-mimic-scratches'], revealFactId: 'f1-target' },
      { id: 'c1-box', slot: 'trait', text: '빈 상자가 밤새 반대편 벽으로 옮겨졌다', knowledgeIds: ['k-mimic-scratches'], revealFactId: 'f1-trait' },
      { id: 'c1-scratch', slot: 'trait', text: '바닥에 나란한 긁힘과 끈적한 쇳내가 남았다', knowledgeIds: ['k-mimic-scratches'], revealFactId: 'f1-trait' },
    ],
    facts: [
      { id: 'f1-objective', slot: 'objective', label: '사라진 술통 회수', value: '술통 회수와 저장고 안전 확보', response: '술통도 필요하지만, 다시 들어갈 수 있게 안을 정리해 주세요.', ownerKnowledge: 'knows', disclosure: 'voluntary', requiredKnowledgeIds: [] },
      { id: 'f1-target', slot: 'target', label: '큰 쥐', value: '상자형 미믹', response: '그러고 보니 쥐를 직접 본 적은 없어요. 움직인 건 그 상자뿐이었군요.', ownerKnowledge: 'misunderstands', disclosure: 'askable', requiredKnowledgeIds: [] },
      { id: 'f1-scale', slot: 'scale', label: '한 개체', value: '미믹 1개체', response: '움직인 상자는 하나뿐이었어요.', ownerKnowledge: 'knows', disclosure: 'askable', requiredKnowledgeIds: [] },
      { id: 'f1-location', slot: 'location', label: '지하 저장고', value: '양조장 지하 저장고 오른쪽 두 번째 칸', response: '계단을 내려가면 오른쪽 두 번째 칸이에요.', ownerKnowledge: 'knows', disclosure: 'askable', requiredKnowledgeIds: [] },
      { id: 'f1-trait', slot: 'trait', label: '평행한 긁힘', value: '평행한 긁힘과 금속성 침', response: '맞아요. 흠집이 경첩 간격처럼 나란했고 술통에는 끈적한 쇳내가 났어요.', ownerKnowledge: 'knows', disclosure: 'concealed', requiredKnowledgeIds: ['k-mimic-scratches'] },
    ],
  },
  {
    id: 'case-sealed-cart', clientName: '베른', occupation: '교역상', portraitIndex: 1,
    premise: '봉인 없는 화물 마차 호위',
    opening: '약재 상자 여섯 개를 실은 마차 한 대를 북문 밖 폐채석장까지 호위해 주시오. 정문은 붐비니 옛 샛길로 가면 되고, 상자는 절대 열 필요 없소. 천 틈으로 푸른빛이 조금 새지만 보존 약품 탓이오. 쉬운 길이니 은화 20닢이면 충분하오.',
    motive: '밀수 화물을 들키지 않고 운반하려 한다.', demeanor: '말이 빠르고 세부 질문을 거래 방해로 몰아붙이는 기만형 상인.',
    baseReward: 20, budgetCap: 42, threat: 6, correctRisk: 'B', requiredPreparations: ['마력 감지', '도적 경계'], illegal: true,
    openingClaims: [
      { id: 'c2-herb', slot: 'target', text: '화물은 평범한 약재 상자다', knowledgeIds: ['k-smuggling', 'k-seal-standard'], revealFactId: 'f2-target' },
      { id: 'c2-route', slot: 'location', text: '정문 대신 폐채석장 샛길이 더 편하다', knowledgeIds: ['k-smuggling'], revealFactId: 'f2-location' },
      { id: 'c2-glow', slot: 'trait', text: '푸른빛은 보존 약품 탓이다', knowledgeIds: ['k-magic-premium'], revealFactId: 'f2-trait' },
      { id: 'c2-sealed', slot: 'target', text: '상자는 열거나 봉인을 확인할 필요가 없다', knowledgeIds: ['k-seal-standard', 'k-smuggling'], revealFactId: 'f2-target' },
    ],
    facts: [
      { id: 'f2-objective', slot: 'objective', label: '마차 호위', value: '마차 호위', response: '목적은 마차를 북문 바깥 폐채석장까지 보내는 것이오.', ownerKnowledge: 'knows', disclosure: 'voluntary', requiredKnowledgeIds: [] },
      { id: 'f2-target', slot: 'target', label: '약재 상자', value: '봉인 없는 마력석 상자', response: '…조합 봉인이 없는 건 맞소. 하지만 물건 자체는 진짜 마력석이오.', ownerKnowledge: 'knows', disclosure: 'concealed', requiredKnowledgeIds: ['k-smuggling', 'k-seal-standard'] },
      { id: 'f2-scale', slot: 'scale', label: '마차 한 대', value: '마차 1대와 상자 6개', response: '마차 하나, 상자는 여섯이오.', ownerKnowledge: 'knows', disclosure: 'askable', requiredKnowledgeIds: [] },
      { id: 'f2-location', slot: 'location', label: '북문 폐채석장', value: '순찰을 피하는 북문 폐채석장 길', response: '정문 순찰을 피하려는 길이오. 그게 그렇게 큰 죄요?', ownerKnowledge: 'knows', disclosure: 'askable', requiredKnowledgeIds: [] },
      { id: 'f2-trait', slot: 'trait', label: '푸른빛 누출', value: '상자 틈에서 새는 마력과 냉기', response: '천이 들린 틈으로 푸른빛과 냉기가 새는 건 사실이오.', ownerKnowledge: 'knows', disclosure: 'concealed', requiredKnowledgeIds: ['k-magic-premium'] },
    ],
  },
  {
    id: 'case-marsh-lights', clientName: '루엔', occupation: '목동', portraitIndex: 2,
    premise: '늪에서 사라진 동생',
    opening: '동생이 어젯밤 갈대 늪 북쪽으로 양을 찾으러 갔다가 돌아오지 않았어요. 검은 버드나무 쪽에 푸른 눈 같은 불빛이 처음 둘, 나중에는 셋 떠다녔고 가까이 갈수록 여름인데도 입김이 났어요. 저는 눈이 빛나는 짐승이라고 생각했어요. 제발 짐승을 쫓고 동생을 찾아 주세요.',
    motive: '동생을 구하고 싶지만 자신이 본 불빛을 야수의 눈으로 오해한다.', demeanor: '겁먹었지만 질문에는 최대한 정확히 기억을 되짚는 협조형 목격자.',
    baseReward: 16, budgetCap: 34, threat: 5, correctRisk: 'C', requiredPreparations: ['은 가루', '길잡이'], illegal: false,
    openingClaims: [
      { id: 'c3-beast', slot: 'target', text: '푸른 눈이 빛나는 짐승이 있다', knowledgeIds: ['k-wisp-cold'], revealFactId: 'f3-target' },
      { id: 'c3-three', slot: 'scale', text: '불빛은 둘에서 셋으로 늘었다', knowledgeIds: ['k-wisp-cold'], revealFactId: 'f3-scale' },
      { id: 'c3-cold', slot: 'trait', text: '불빛에 가까울수록 한여름에도 입김이 났다', knowledgeIds: ['k-wisp-cold'], revealFactId: 'f3-trait' },
      { id: 'c3-remove', slot: 'objective', text: '짐승을 쫓아내는 것이 우선이다', knowledgeIds: ['k-rescue-rule'], revealFactId: 'f3-objective' },
    ],
    facts: [
      { id: 'f3-objective', slot: 'objective', label: '짐승 제거', value: '실종자 구조', response: '맞아요. 무엇보다 동생을 먼저 찾아야 해요. 아직 살아 있을 거예요.', ownerKnowledge: 'knows', disclosure: 'concealed', requiredKnowledgeIds: ['k-rescue-rule'] },
      { id: 'f3-target', slot: 'target', label: '눈이 빛나는 짐승', value: '늪불 도깨비', response: '몸은 못 봤어요. 푸른 눈 같은 불빛만 허공에 떠다녔죠.', ownerKnowledge: 'misunderstands', disclosure: 'askable', requiredKnowledgeIds: [] },
      { id: 'f3-scale', slot: 'scale', label: '불빛 여러 개', value: '늪불 도깨비 3개체', response: '처음엔 둘이었는데 늪 안쪽에서 하나가 더 켜졌어요.', ownerKnowledge: 'knows', disclosure: 'askable', requiredKnowledgeIds: [] },
      { id: 'f3-location', slot: 'location', label: '갈대 늪 북쪽', value: '갈대 늪 북쪽 돌무덤 길', response: '북쪽 돌무덤을 지나 검은 버드나무 쪽이에요.', ownerKnowledge: 'knows', disclosure: 'voluntary', requiredKnowledgeIds: [] },
      { id: 'f3-trait', slot: 'trait', label: '푸른 불빛과 냉기', value: '푸른 불빛 주변의 급격한 냉기', response: '네, 불빛 가까이에서만 입김이 났어요.', ownerKnowledge: 'knows', disclosure: 'concealed', requiredKnowledgeIds: ['k-wisp-cold'] },
    ],
  },
  {
    id: 'case-troll-bridge', clientName: '오르사', occupation: '석교지기', portraitIndex: 3,
    premise: '이끼 다리를 점거한 트롤',
    opening: '서쪽 돌다리를 트롤 한 마리가 막고 통행세를 뜯고 있소. 키는 사람 둘을 포갠 만큼 크고 어깨에는 젖은 이끼가 붙었지. 경비병이 팔을 베었는데 상처가 눈앞에서 닫히는 것도 봤소. 숨길 것 없소. 불을 다룰 수 있는 B급 파티라면 은화 38닢을 내겠소.',
    motive: '주민 통행을 빨리 복구하고 부상자를 더 만들지 않으려 한다.', demeanor: '관찰과 책임 범위를 분명히 말하고 정당한 비용을 치르는 정직한 실무자.',
    baseReward: 38, budgetCap: 46, threat: 6, correctRisk: 'B', requiredPreparations: ['화염 도구', '방패'], illegal: false,
    openingClaims: [
      { id: 'c4-troll', slot: 'target', text: '다리를 막은 것은 트롤 한 마리다', knowledgeIds: ['k-troll'], revealFactId: 'f4-target' },
      { id: 'c4-size', slot: 'scale', text: '키는 사람 둘을 포갠 정도다', knowledgeIds: ['k-troll'], revealFactId: 'f4-scale' },
      { id: 'c4-heal', slot: 'trait', text: '베인 상처가 눈앞에서 재생했다', knowledgeIds: ['k-troll'], revealFactId: 'f4-trait' },
      { id: 'c4-rate', slot: 'objective', text: 'B급 파티에 은화 38닢을 지급한다', knowledgeIds: ['k-b-rate'] },
    ],
    facts: [
      { id: 'f4-objective', slot: 'objective', label: '다리 해방', value: '트롤 격퇴와 통행 복구', response: '죽이는 것보다 다리에서 몰아내고 통행을 되찾는 게 목적이오.', ownerKnowledge: 'knows', disclosure: 'voluntary', requiredKnowledgeIds: [] },
      { id: 'f4-target', slot: 'target', label: '트롤', value: '이끼 다리 트롤', response: '그래, 도감의 그림과 같은 트롤이오. 위장도 다른 개체도 없었소.', ownerKnowledge: 'knows', disclosure: 'askable', requiredKnowledgeIds: [] },
      { id: 'f4-scale', slot: 'scale', label: '한 마리', value: '성체 트롤 1개체', response: '확인한 건 성체 한 마리뿐이오.', ownerKnowledge: 'knows', disclosure: 'voluntary', requiredKnowledgeIds: [] },
      { id: 'f4-location', slot: 'location', label: '서쪽 돌다리', value: '서쪽 협곡의 단일 돌다리', response: '협곡을 건너는 다리는 거기 하나뿐이라 우회가 어렵소.', ownerKnowledge: 'knows', disclosure: 'voluntary', requiredKnowledgeIds: [] },
      { id: 'f4-trait', slot: 'trait', label: '빠른 재생', value: '젖은 이끼 피부의 빠른 재생', response: '상처가 닫히는 걸 세 사람이 함께 봤소. 불로 막아야 할 거요.', ownerKnowledge: 'knows', disclosure: 'askable', requiredKnowledgeIds: [] },
    ],
  },
  {
    id: 'case-ranger-wisps', clientName: '세라드', occupation: '늪지 순찰자', portraitIndex: 0,
    premise: '늪불에 갇힌 약초꾼 구조',
    opening: '약초꾼 둘이 남쪽 습지의 돌무덤 지대에 고립됐습니다. 푸른 늪불 네 개가 길을 빙빙 돌리고 있고, 제가 뿌린 은 가루 표식만은 피하더군요. 두 사람의 횃불이 아직 보여 생존 가능성이 높습니다. 제거보다 구조를 먼저 기록해 주십시오. 은화 28닢을 준비했습니다.',
    motive: '확인한 사실을 정확히 전달해 구조대의 시간을 아끼려 한다.', demeanor: '괴물 지식이 풍부하고 접수원을 동료 전문가로 대하는 정직한 전문가형.',
    baseReward: 28, budgetCap: 36, threat: 5, correctRisk: 'C', requiredPreparations: ['은 가루', '길잡이'], illegal: false,
    openingClaims: [
      { id: 'c5-wisp', slot: 'target', text: '푸른 늪불 네 개가 길을 왜곡한다', knowledgeIds: ['k-wisp-cold'], revealFactId: 'f5-target' },
      { id: 'c5-silver', slot: 'trait', text: '늪불은 은 가루 표식을 피했다', knowledgeIds: ['k-wisp-cold'], revealFactId: 'f5-trait' },
      { id: 'c5-rescue', slot: 'objective', text: '생존자 구조를 제거보다 먼저 해야 한다', knowledgeIds: ['k-rescue-rule'], revealFactId: 'f5-objective' },
      { id: 'c5-rate', slot: 'objective', text: 'C급 구조에 은화 28닢을 지급한다', knowledgeIds: ['k-c-rate'] },
    ],
    facts: [
      { id: 'f5-objective', slot: 'objective', label: '약초꾼 구조', value: '고립된 약초꾼 2명 구조', response: '맞습니다. 늪불과 싸우는 것보다 두 사람을 안전한 길로 빼내는 게 먼저입니다.', ownerKnowledge: 'knows', disclosure: 'voluntary', requiredKnowledgeIds: [] },
      { id: 'f5-target', slot: 'target', label: '늪불', value: '늪불 도깨비', response: '도감의 늪불 도깨비가 맞습니다. 움직임과 냉기까지 확인했습니다.', ownerKnowledge: 'knows', disclosure: 'voluntary', requiredKnowledgeIds: [] },
      { id: 'f5-scale', slot: 'scale', label: '네 개체', value: '늪불 도깨비 4개체', response: '네 개가 서로 자리를 바꾸지만 수는 변하지 않았습니다.', ownerKnowledge: 'knows', disclosure: 'voluntary', requiredKnowledgeIds: [] },
      { id: 'f5-location', slot: 'location', label: '남쪽 돌무덤', value: '남쪽 습지 돌무덤 지대', response: '남쪽 제방에서 세 번째 돌무덤 안쪽입니다.', ownerKnowledge: 'knows', disclosure: 'voluntary', requiredKnowledgeIds: [] },
      { id: 'f5-trait', slot: 'trait', label: '은 가루 회피', value: '은 가루로 안전 경로 표시 가능', response: '은 가루 선을 넘지 않았습니다. 길잡이가 선을 이어 주면 됩니다.', ownerKnowledge: 'knows', disclosure: 'askable', requiredKnowledgeIds: [] },
    ],
  },
  {
    id: 'case-crystal-accident', clientName: '티아', occupation: '마법사 조합 견습생', portraitIndex: 1,
    premise: '파손된 마력석 상자 봉쇄',
    opening: '제가 운반하던 조합 마력석 상자 하나가 동문 검문소 앞에서 떨어져 금이 갔습니다. 청동 봉인과 운송장은 모두 여기 있고, 숨길 생각도 없습니다. 다만 틈에서 푸른빛과 냉기가 새어 경비병들이 접근하지 못하고 있어요. 운반이 아니라 현장 봉쇄와 회수를 의뢰합니다. 지금 가진 돈은 은화 30닢입니다.',
    motive: '자신의 실수를 인정하고 추가 피해가 나기 전에 합법적으로 수습하려 한다.', demeanor: '죄책감 때문에 서두르지만 증빙과 질문에 숨김없이 답하는 자진신고형.',
    baseReward: 30, budgetCap: 45, threat: 6, correctRisk: 'B', requiredPreparations: ['마력 감지', '응급 처치'], illegal: false,
    openingClaims: [
      { id: 'c6-seal', slot: 'target', text: '청동 봉인과 운송장을 모두 제시했다', knowledgeIds: ['k-seal-standard'], revealFactId: 'f6-target' },
      { id: 'c6-leak', slot: 'trait', text: '금 간 틈에서 푸른빛과 냉기가 샌다', knowledgeIds: ['k-magic-premium'], revealFactId: 'f6-trait' },
      { id: 'c6-clean', slot: 'objective', text: '운반이 아니라 현장 봉쇄와 회수 의뢰다', knowledgeIds: ['k-smuggling'], revealFactId: 'f6-objective' },
      { id: 'c6-pay', slot: 'objective', text: '마력 사고 수습에 은화 30닢을 제시한다', knowledgeIds: ['k-b-rate', 'k-magic-premium'] },
    ],
    facts: [
      { id: 'f6-objective', slot: 'objective', label: '현장 봉쇄', value: '검문소 봉쇄와 마력석 회수', response: '네. 다른 곳으로 옮기기 전에 현장을 막고 누출부터 안정시켜 주세요.', ownerKnowledge: 'knows', disclosure: 'voluntary', requiredKnowledgeIds: [] },
      { id: 'f6-target', slot: 'target', label: '합법 마력석', value: '조합 봉인된 파손 마력석 상자', response: '봉인 번호와 운송장이 일치합니다. 상자가 깨진 건 제 과실이에요.', ownerKnowledge: 'knows', disclosure: 'voluntary', requiredKnowledgeIds: [] },
      { id: 'f6-scale', slot: 'scale', label: '상자 하나', value: '파손 상자 1개', response: '떨어진 것은 한 상자뿐이고 나머지는 조합이 회수했습니다.', ownerKnowledge: 'knows', disclosure: 'askable', requiredKnowledgeIds: [] },
      { id: 'f6-location', slot: 'location', label: '동문 검문소', value: '동문 검문소 외곽 격리선', response: '동문 바깥 격리선 안에 그대로 두었습니다.', ownerKnowledge: 'knows', disclosure: 'voluntary', requiredKnowledgeIds: [] },
      { id: 'f6-trait', slot: 'trait', label: '마력 누출', value: '푸른 마력광과 급격한 냉기 누출', response: '빛이 맥박처럼 강해지고 주변 금속에 성에가 끼고 있습니다.', ownerKnowledge: 'knows', disclosure: 'askable', requiredKnowledgeIds: [] },
    ],
  },
];

export const PARTIES: readonly PartyCandidate[] = [
  { id: 'party-copper', name: '동전방패단', grade: 'C', power: 2, specialties: ['방패', '화염 도구'], quote: '좁은 곳의 괴물 사냥이라면 맡겨 주십시오.', minimumReward: 22 },
  { id: 'party-owl', name: '회색부엉이단', grade: 'B', power: 3, specialties: ['마력 감지', '도적 경계'], quote: '화물보다 의뢰인의 거짓말부터 확인하죠.', minimumReward: 34 },
  { id: 'party-reed', name: '갈대길잡이단', grade: 'C', power: 2, specialties: ['은 가루', '길잡이'], quote: '늪은 길을 아는 사람이 절반입니다.', minimumReward: 20 },
  { id: 'party-lantern', name: '붉은등불단', grade: 'B', power: 3, specialties: ['화염 도구', '마력 감지'], quote: '마력성 괴물과 정면으로 붙겠습니다.', minimumReward: 32 },
  { id: 'party-stag', name: '흰사슴단', grade: 'A', power: 4, specialties: ['길잡이', '응급 처치'], quote: '구조가 우선이라면 저희가 맞습니다.', minimumReward: 40 },
  { id: 'party-pawn', name: '초보 창끝단', grade: 'D', power: 1, specialties: ['방패'], quote: '정확한 의뢰서만 있다면 해보겠습니다.', minimumReward: 12 },
];
