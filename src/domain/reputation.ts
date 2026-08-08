/**
 * 신뢰·기억 갱신 — 착취가 정보망을 스스로 조이게 만드는 회로.
 *
 * MDA의 Expression 축("정직한 중개인이 될지 착취자가 될지")을 지탱하는 유일한
 * 기계적 장치다. 이것이 없으면 관대할 이유가 게임 안에 존재하지 않는다.
 *
 * 출처: `design/quick-specs/dispatch-resolution-2026-08-08.md` §5,
 * `design/quick-specs/rumor-network-2026-08-08.md` §6,
 * `production/stories/story-013-trust-memory.md`
 *
 * ## 판정은 순수 함수로, 적용은 호출자가
 *
 * `economy.ts`의 관례를 그대로 따른다 — 이 파일은 "trust가 얼마가 되는지",
 * "어떤 `Memory`가 붙는지"만 계산해 돌려주고 `Person`을 직접 건드리지 않는다.
 * `Person.trust`/`Person.memories`가 이미 가변 필드라 여기서 바로 mutate해도 동작은
 * 하겠지만, 그러면 이 판정이 실제 명부(roster) 없이는 단위 테스트를 할 수 없게 된다.
 * `resolveDispatchSettlement`가 `GameState`를 몰라도 되는 것과 같은 이유로, 이 함수도
 * `Person` 전체가 아니라 `id`·`trust`만 받고 최종값을 돌려준다 — 명부에 적는 것은
 * 호출자(`gameState.ts`)의 몫이다.
 *
 * `dispatch.ts`의 판정과 이 판정을 분리한 이유도 같다: 파견 판정은 "누가 죽었는가"만
 * 답하고, 그 답이 신뢰와 기억에 어떻게 번지는지는 완전히 다른 규칙이다. 섞으면
 * 파견 판정 테스트가 신뢰 공식까지 알아야 하게 된다.
 *
 * ## 사망의 trust 범위는 길드 전체, `Memory` 범위는 파티다
 *
 * 두 범위가 다른 것이 의도다. 스토리 AC가 사망에 대해서만 "생존 **길드원** 전체에게"
 * 라고 적고 있고, Implementation Notes도 "한 번의 은폐가 정보망 **전체**를 눈에 띄게
 * 조인다"고 한다 — 이것이 착취를 억제하는 유일한 기계적 장치이므로, 파티원 한둘의
 * `trust`만 깎으면 그 압력이 성립하지 않는다. 사람이 죽었다는 소식은 홀에 퍼진다.
 *
 * 반면 `Memory`는 파티에만 남는다. `lostComrade`의 1인 파티 엣지 케이스("아무에게도
 * 안 남는다")가 그것을 못박는다 — 동료를 잃은 것은 거기 있었던 사람의 경험이고,
 * 소식을 들은 것과는 다르다.
 *
 * 그래서 이 함수는 파티와 **파티 밖 생존 길드원**({@link bystanders})을 따로 받는다.
 * 후자는 trust 변동만 받고 `Memory`는 받지 않는다. 인자를 나눠 받는 대신 roster
 * 전체를 넘기게 하지 않는 이유는 "판정은 좁은 타입만 본다"는 경계를 지키기 위해서다 —
 * 누가 길드원이고 누가 살아 있는지 거르는 일은 호출자(`gameState.ts`)가 한다.
 *
 * ## 사망자는 이 판정 이후 존재하지 않는 사람이다
 *
 * 죽은 사람에게는 `trust`도 `Memory`도 남기지 않는다 — 죽은 사람은 다시 홀에
 * 나타나지 않으므로 그 값을 읽을 소비처가 없고, 남기면 "죽은 사람의 신뢰"라는 의미
 * 없는 상태만 늘어난다.
 */
import type { DispatchResult } from './dispatch';
import type { Memory, MemoryKind, Person } from './types';

/**
 * 이 판정이 실제로 보는 사람의 부분.
 *
 * `trust`는 새 값을 계산하는 데 필요한 현재값이고, `id`는 결과를 어느 사람에게
 * 적어야 하는지 알려준다. 이름·성격·기억 이력은 이 판정에 필요 없다 — `rumor.ts`의
 * `RumorTalker`가 좁게 받는 것과 같은 이유다.
 */
export type ReputationTarget = Pick<Person, 'id' | 'trust'>;

/** 이 판정이 실제로 보는 파견 결과의 부분. `ratio`·`uncertainty` 등 판정 근거는 필요 없다. */
export type AftermathOutcome = Pick<DispatchResult, 'outcome' | 'casualtyId'>;

/** 신뢰·기억 갱신에 필요한 수치. 전부 `balance.json`의 `rumor` 절에서 온다. */
export interface ReputationConfig {
  /** 사상자가 아닌 파티원에게 붙는 trust 증가분 */
  readonly trustOnSurvive: number;
  /** 부상당한 본인에게 붙는 trust 감소분(음수) */
  readonly trustOnWound: number;
  /** 사망 사건에서 살아 돌아온 파티원 전원에게 붙는 trust 감소분(음수) */
  readonly trustOnDeath: number;
  /** `concealedKnownRisk`인 사망에서 `trustOnDeath`에 추가로 더해지는 감소분(음수) */
  readonly trustOnDeceit: number;
  /**
   * 공개 위험도(`statedRisk`)가 이 값 이상이면 `sentToDanger`, 미만이면 `sentSafe`로
   * 기억된다.
   *
   * **`balance.json`에 이 의미로 이름 붙은 노브가 아직 없다.** 어떤 값을 주입할지는
   * 배선하는 쪽이 결정할 사항이라 여기서는 순수한 설정 인자로만 받는다 — 후보와
   * 근거는 보고서에 남긴다.
   */
  readonly dangerThreshold: number;
}

/**
 * 신뢰가 새로 얼마가 되는지. 이미 0~1로 클램프된 **최종값**이다.
 *
 * `economy.ts`가 델타가 아니라 최종 `funds`/`reputation`을 돌려주는 것과 같은
 * 이유다 — 호출자는 클램프 규칙을 다시 알 필요 없이 그대로 대입하면 된다.
 */
export interface TrustUpdate {
  readonly personId: string;
  readonly trust: number;
}

/** 이번 판정으로 새로 붙는 기억 한 조각과 그 대상. */
export interface MemoryUpdate {
  readonly personId: string;
  readonly memory: Memory;
}

/** 파견 결과 한 건이 신뢰·기억에 남기는 흔적. */
export interface DispatchAftermath {
  readonly trustUpdates: readonly TrustUpdate[];
  readonly memoryUpdates: readonly MemoryUpdate[];
}

/**
 * trust 스케일의 하한·상한. 튜닝 노브가 아니라 축 자체의 정의이므로 설정으로 받지
 * 않는다 — `economy.ts`의 `REPUTATION_FLOOR`/`REPUTATION_CEILING`과 같은 근거다.
 */
const TRUST_FLOOR = 0;
const TRUST_CEILING = 1;

/**
 * trust에 증감을 적용하고 0~1로 클램프한다.
 *
 * `economy.ts`의 `applyReputation`과 정확히 같은 모양이다 — 축 이름만 다르다.
 */
export function applyTrust(trust: number, delta: number): number {
  return Math.min(TRUST_CEILING, Math.max(TRUST_FLOOR, trust + delta));
}

/**
 * 파견 결과 한 건을 파티의 trust·`Memory` 변화로 판정한다.
 *
 * 같은 입력이면 언제나 같은 결과다(순수 함수, `rng`를 쓰지 않는다 — 이 갱신에는
 * 확률이 없다). 사망자 본인은 `party`에 있어도 결과에 나타나지 않는다.
 *
 * ## 판정 순서
 *
 * 1. 사망자 본인이면 건너뛴다 — `trust`도 `Memory`도 남기지 않는다.
 * 2. 개인 결과(`survived`/`wounded`)를 정한다 — 사상자 본인이면 `wounded`, 아니면
 *    `survived`(사망 사건에서 살아 돌아온 사람도 본인은 다치지 않았으므로 `survived`다).
 * 3. trust 델타를 정한다 — 사망 사건이면 `trustOnDeath`(+ 침묵 시 `trustOnDeceit`)가
 *    개인 생존 보상을 **대체**한다. 미션이 실패로 끝난 이상 "나는 안 다쳤다"는
 *    상쇄되지 않는다는 것이 의도다. 사망이 아니면 사상자는 `trustOnWound`, 나머지는
 *    `trustOnSurvive`를 받는다.
 * 4. `sentToDanger`/`sentSafe`를 공개 위험도로 기록한다.
 * 5. 침묵했으면 `wasDeceived`를 추가한다 — 결과와 무관하게 항상 기록된다.
 * 6. 사망 사건이면 생존자 전원에게 `lostComrade`(`subjectId` = 사망자)를 추가한다.
 * 7. **사망 사건이면 파티 밖 생존 길드원도 같은 trust 델타를 받는다** — `Memory`는
 *    받지 않는다. 사망이 아닌 결과는 파티 밖으로 번지지 않는다(무사히 다녀온 일은
 *    소식거리가 아니다).
 *
 * @param party 파견에 나갔던 전원(사상자 포함)의 id·현재 trust
 * @param bystanders 파견에 나가지 않은 **살아 있는 길드원**. 사망 사건일 때만 쓰인다.
 *   사망자와 파티원을 여기 넣지 말 것 — 이중 적용된다
 * @param result 파견 판정 결과 중 `outcome`·`casualtyId`만
 * @param statedRisk 이 의뢰의 공개 위험도. `Memory`의 `sentToDanger`/`sentSafe`를 가른다
 * @param concealedKnownRisk 실제 위험을 알고도 고지하지 않았는가
 *   (`ActiveDispatch.concealedKnownRisk`)
 * @param day 기억에 찍힐 날짜
 */
export function resolveDispatchAftermath(
  party: readonly ReputationTarget[],
  bystanders: readonly ReputationTarget[],
  result: AftermathOutcome,
  statedRisk: number,
  concealedKnownRisk: boolean,
  day: number,
  config: ReputationConfig,
): DispatchAftermath {
  const dangerKind: MemoryKind =
    statedRisk >= config.dangerThreshold ? 'sentToDanger' : 'sentSafe';
  const casualtyDied = result.outcome === 'dead' && result.casualtyId !== undefined;

  const trustUpdates: TrustUpdate[] = [];
  const memoryUpdates: MemoryUpdate[] = [];

  for (const member of party) {
    const isCasualty = member.id === result.casualtyId;

    // 사망자 본인 — 다시 홀에 나타나지 않을 사람의 trust·Memory를 갱신해봐야 읽을
    // 소비처가 없다.
    if (isCasualty && casualtyDied) continue;

    const personalOutcome: MemoryKind = isCasualty ? 'wounded' : 'survived';

    const delta = casualtyDied
      ? config.trustOnDeath + (concealedKnownRisk ? config.trustOnDeceit : 0)
      : isCasualty
        ? config.trustOnWound
        : config.trustOnSurvive;

    trustUpdates.push({ personId: member.id, trust: applyTrust(member.trust, delta) });

    memoryUpdates.push({ personId: member.id, memory: { day, kind: dangerKind } });
    memoryUpdates.push({ personId: member.id, memory: { day, kind: personalOutcome } });

    if (concealedKnownRisk) {
      memoryUpdates.push({ personId: member.id, memory: { day, kind: 'wasDeceived' } });
    }

    if (casualtyDied) {
      memoryUpdates.push({
        personId: member.id,
        memory: { day, kind: 'lostComrade', subjectId: result.casualtyId },
      });
    }
  }

  // 사망 소식만 파티 밖으로 번진다. `Memory`는 붙이지 않는다 — 소식을 들은 것과
  // 거기 있었던 것은 다르며, 그 차이가 `lostComrade`의 의미를 지킨다.
  if (casualtyDied) {
    const deathDelta = config.trustOnDeath + (concealedKnownRisk ? config.trustOnDeceit : 0);
    for (const bystander of bystanders) {
      trustUpdates.push({
        personId: bystander.id,
        trust: applyTrust(bystander.trust, deathDelta),
      });
    }
  }

  return { trustUpdates, memoryUpdates };
}
