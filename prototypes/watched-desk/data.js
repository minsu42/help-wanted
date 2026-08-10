/* 프로토 5 · 3회차 — 길드마스터북 프로토 전용 사본.
   플레이 판정: "너무 대놓고 정보가 적혀 있다" → 문장을 **개념·통념·소문** 층위로
   다시 썼다. id·태그는 본선 데이터(src/data/quest-templates.json)와 동일하므로
   **판정(태그 매칭)은 한 글자도 안 바뀐다** — 바뀌는 것은 책과 정답 사이의
   추론 거리뿐이다. 본선 파일은 건드리지 않는다 (prototype-code.md).

   재작성 원칙:
   - 사실 진술("~있다") → 통념·전문("~라고들 한다", "~라는 말이 돈다")
   - 시나리오 대사와 낱말이 겹치지 않게 (1:1 짝맞추기 방지)
   - 단, 식별에 필요한 개념(발가락 셋, 무리, 쇳내…)은 남긴다 — 흐리는 게 아니라 멀리 둔다 */

window.PROTO_HANDBOOK = [
  // ---- 도감 — 사냥꾼과 의원의 통념 ----
  { id:'hb-troll', book:'도감', hintTags:['짐승','발자국'], leverageTag:null,
    text:'늙은 사냥꾼은 자국을 보면 발가락부터 센다 — 셋이면 트롤, 다섯이면 곰이라 했다' },
  { id:'hb-brood', book:'도감', hintTags:['무리','개체수'], leverageTag:null,
    text:'뼈가 한군데 쌓인 산은 사냥꾼도 접는다. 새끼 친 짐승이 가장 사납다고들 한다' },
  { id:'hb-goblin', book:'도감', hintTags:['무리','짐승'], leverageTag:null,
    text:'고블린 하나는 아이도 쫓는다지만, 여럿이 몰리면 어른도 밤길을 접는다' },
  { id:'hb-rust', book:'도감', hintTags:['물','병'], leverageTag:null,
    text:'물에서 쇠 맛이 나면 노인들은 두레박이 아니라 위쪽 물길을 의심하라 했다' },
  { id:'hb-plague', book:'도감', hintTags:['병','개체수'], leverageTag:null,
    text:'역병이 돌면 약장수는 집집을 보고, 의원은 그 집들이 어느 우물을 쓰는지 본다' },

  // ---- 지역 — 떠도는 소문 ----
  { id:'hb-oldmine', book:'지역', hintTags:['지형','서쪽숲'], leverageTag:'절차',
    text:'물레방아 노인은 위쪽 비탈에 발을 안 들인다 — 까닭을 묻는 사람마다 들은 답이 달랐다' },
  { id:'hb-landtitle', book:'지역', hintTags:['지형'], leverageTag:'절차',
    text:'그 비탈 땅문서를 두고 몇 해째 다툼이 있다는 소문이 있다. 누구 땅인지 아무도 잘라 말하지 못한다' },
  { id:'hb-creek', book:'지역', hintTags:[], leverageTag:null,
    text:'개울이 어는 철이면 다리 없는 마을에도 낯선 발자국이 는다' },
  { id:'hb-market', book:'지역', hintTags:[], leverageTag:null,
    text:'장이 서는 날엔 낯선 얼굴이 섞여도 아무도 이상하게 여기지 않는다' },
  { id:'hb-mine', book:'지역', hintTags:['폐광','물'], leverageTag:'체면',
    text:'북쪽 폐광이 버려진 건 광맥이 아니라 물 때문이었다고, 늙은 광부들은 말한다' },

  // ---- 조직 — 뒷말 ----
  { id:'hb-millguild', book:'조직', hintTags:['지형'], leverageTag:'절차',
    text:'그 일대에서는 나무 한 짐을 내리는 데도 조합 도장이 먼저라는 말이 있다' },
  { id:'hb-lordlumber', book:'조직', hintTags:[], leverageTag:'체면',
    text:'작년부터 서쪽 숲 벌목권이 누구 손에 있는지, 술자리마다 답이 다르다' },
  { id:'hb-thief', book:'조직', hintTags:['도둑','장터'], leverageTag:'절차',
    text:'파수는 장터 앞길만 돈다 — 뒷골목 등불은 상인들이 사비로 단다는 뒷말이 있다' },
  { id:'hb-inside', book:'조직', hintTags:['도둑'], leverageTag:'손익',
    text:'부수지 않고 열린 문은 문이 아니라 사람을 조사하라는 뜻이라고들 한다' },

  // ---- 시세 — 장부의 상식 ----
  { id:'hb-rate', book:'시세', hintTags:[], leverageTag:'손익',
    text:'조사 일은 은 쉰 닢 안팎이 시세지만, 급한 쪽 사정 따라 오르내린다' },
  { id:'hb-hazardpay', book:'시세', hintTags:['짐승'], leverageTag:'손익',
    text:'덩치 큰 짐승이 끼면 위험 수당이 따로 붙는 것이 관례다' },
  { id:'hb-headcount', book:'시세', hintTags:['개체수'], leverageTag:'손익',
    text:'상대 머릿수가 늘면 파티도 키워야 하니, 값은 배로 뛰기 마련이다' },
  { id:'hb-ledger', book:'시세', hintTags:['손실'], leverageTag:'손익',
    text:'곡식 한 자루가 은 두 닢 반 — 창고가 비면 무엇이 얼마나 샜는지부터 셈하는 법이다' },
];
