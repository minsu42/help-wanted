# Tech Debt Register

3일 마감 프로젝트다. 여기 있는 항목은 **지금 고치지 않기로 의식적으로 결정한 것**이지,
발견하지 못한 것이 아니다. 각 항목은 발견 시점의 스토리로 추적된다.

우선순위 기준: 게임이 동작하지 않는 것은 여기 오지 않는다(그건 버그다). 여기 있는 것은
전부 "동작하지만 나중에 물릴 수 있는 것"이다.

---

## Open

- **2026-08-08** (Story 002 — 의뢰 생성): 유혹 의뢰의 배수 적용 지점이 **설계 판단으로
  결정됐고 아직 검토받지 않았다.** 현재 구현은 위험 1.6배 · 총 보상 3.2배(= 위험당 단가
  2배)다. 대안 해석은 총 보상 2.0배(단가 1.25배)이며 유혹의 강도가 크게 달라진다.
  economy-designer 검토 대상. 뒤집으려면 `contract.ts`의 `baseReward` 한 줄이다.
  출처: `production/stories/story-002-contract-generation.md`

- **2026-08-08** (Story 002 — 의뢰 생성): `knownBy` 가중치가 `tenureYears^1.5`이므로
  **근속 0년은 영영 뽑히지 않는다.** 기본 명부에서 2~3명이 정보망에서 완전히 제외된다.
  "갓 들어온 사람이 상단주를 알 리 없다"는 해석으로 두었으나 systems-designer 확인이
  필요하다. 바꾸려면 가중치를 `(tenureYears + 1)^exponent`로 옮기면 된다.
  출처: `production/stories/story-002-contract-generation.md`

## Resolved

- **2026-08-08 해결** (Story 001에서 발견, Story 002에서 해소): `names.json` 정적
  import. `src/domain/person.ts`를 신설해 `NamePool`을 주입받도록 바꿨다.
  의뢰인도 같은 이름 생성 로직이 필요해 어차피 공통화가 필요했고, 그 김에 해소됐다.
  **이름 고갈 throw 경로가 처음으로 테스트 가능해졌다**
  (`test_exhausted_name_pool_throws`). 부수 효과로 모험가와 의뢰인이 이름 집합을
  공유할 수 있게 되어 둘 사이의 동명이인도 막힌다.

- **2026-08-08 해결** (Story 001에서 발견, Story 002에서 해소): `tenureYears` 경계값
  도달 검증. `test_range_boundaries_are_actually_reachable`이 이제 `capability`와
  `tenureYears` 양쪽의 최소·최대를 함께 확인한다. story-002의 `knownBy` 가중 추출이
  실제로 이 값을 쓰게 되면서 시급해진 항목이었다.

- **2026-08-08 해결** (Story 001에서 발견, Story 002에서 해소): `pickTwoTraits`의
  `TRAITS.length >= 2` 불변식. 주석 대신 명시적 가드를 넣어 도메인 메시지로 던진다
  (`성격 태그가 N개뿐이다 — 서로 다른 2개를 뽑을 수 없다`).

- **2026-08-08 해결** (Story 001에서 발견, 전 스토리 영향): story-002~019의 Test
  Evidence 경로가 전부 `*_test.ts` 형식이라 `vitest.config.ts`의
  `include: ["tests/**/*.test.ts"]`에 수집되지 않았다. 그대로 뒀으면 테스트가 실패하는
  게 아니라 **조용히 실행되지 않았다** — 침묵이라 알아채기 어려운 종류다. 10개 파일
  (002·003·004·005·006·009·011·012·013·015)을 `*.test.ts`로 일괄 정정했다.
  `trust_memory_test.ts`는 파일 명명 규칙(camelCase)에 맞춰 `trustMemory.test.ts`가 됐다.
