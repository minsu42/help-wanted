/**
 * 길드 홀 출석 판정 — 오늘 홀에 누가 있는지 정한다.
 *
 * 이 게임은 플레이어에게 "하루 N회 대화권"을 주지 않는다. 대신 **그날 홀에 누가
 * 있는가**를 세계가 정한다. 희소성이 예산이 아니라 사실에서 온다 — 기둥 2("세상은
 * 사람의 입을 통해서만 도착한다")와 맞추기 위한 선택이다.
 *
 * ## 숨은 교훈은 코드로 설명하지 않는다
 *
 * `onMission` / `injured` / `dead`는 후보에서 그냥 빠진다. "베테랑을 긴 의뢰에 보내면
 * 정보가 마른다"는 것을 플레이어가 스스로 알아채야 하는 설계이므로, 여기에 그것을
 * 알려주는 주석 이상의 코드(경고, 로그 등)를 두지 않는다.
 *
 * ## 등급 상승이 "다음 날부터" 반영되는 이유는 이 파일에 없다
 *
 * 이 함수는 넘겨받은 `config.hallAttendanceMax`를 그대로 쓸 뿐이다. "다음 날부터"는
 * 호출자(`gameState.ts`의 `advanceDay`)가 그날 시점의 `currentTier`를 읽어 넘기는
 * 타이밍이 보장한다 — 등급을 올린 날의 `advanceDay`는 이미 지나갔으므로, 다음
 * `advanceDay` 호출 때 자연히 새 상한이 적용된다.
 *
 * 출처: `design/quick-specs/rumor-network-2026-08-08.md` §3,
 * `production/stories/story-010-guild-hall.md`
 */
import type { Rng } from './rng';
import type { Adventurer } from './types';
import { rollWeightedIndex } from './weighted';

/**
 * 홀 출석 판정에 필요한 수치.
 *
 * `hallAttendanceMin` / `visitorMin` / `visitorMax`는 `balance.json`의 `rumor` 절에서
 * 오고, `hallAttendanceMax`는 그 절에 **없다** — 현재 길드 등급
 * (`GuildTier.hallAttendanceMax`)에서 온다. 두 출처를 하나로 합쳐 넘기는 것은
 * 호출자의 책임이다. 이 파일은 어느 쪽이 balance.json이고 어느 쪽이 등급표인지 몰라도
 * 되게 한다.
 */
export interface HallConfig {
  readonly hallAttendanceMin: number;
  readonly hallAttendanceMax: number;
  readonly visitorMin: number;
  readonly visitorMax: number;
}

/**
 * 오늘 길드 홀 출석자.
 *
 * 길드원과 외부인을 **배열을 나눠서** 구분한다 — 다음 웨이브의 화면이 시각적으로
 * 구분해야 하고(길드원/외부인), 외부인은 사실을 말하지 않지만 인맥은 알려준다는 규칙
 * 차이가 이 구분에서 그대로 갈린다.
 *
 * id만 담는다. {@link ActiveDispatch.partyIds}와 같은 이유다 — `GameState.roster`가
 * 유일한 사람 저장소여야 한다. 여기 `Adventurer` 객체를 복제해 두면, 그 사람이 그날
 * 이후 다치거나 죽었을 때 "출석 기록 속 인물"과 "실제 명부" 두 벌의 진실이 생긴다.
 */
export interface HallAttendance {
  readonly guildMemberIds: readonly string[];
  readonly visitorIds: readonly string[];
}

/**
 * 오늘 길드 홀에 누가 있는지 뽑는다.
 *
 * 같은 `rng` 상태에서 부르면 같은 결과가 나온다 — **하루에 한 번만** 불러야 한다.
 * 반환값을 어딘가에 저장해 두고 화면이 재렌더될 때마다 이 함수를 다시 부르면, 같은
 * 날인데 출석자가 바뀌는 모순이 생긴다. (저장 위치는 이 파일의 책임이 아니다 — 호출자
 * 쪽 문서 참조)
 *
 * 후보가 요청 인원보다 적으면 있는 만큼만 돌려주고 던지지 않는다. 사망이 누적되면
 * 후보 부족이 실제로 일어나는 상황이기 때문이다.
 *
 * @param roster 월드 모험가 풀 전체 (길드원 + 외부인). `GameState.roster`를 그대로
 *   넘긴다 — 이 함수가 알아서 소속과 상태로 걸러낸다
 * @param rng 시드 재현성을 위해 상태를 들고 있는 rng. 새로 만들지 말고 `GameState.rng`를
 *   그대로 넘긴다
 */
export function resolveHallAttendance(
  roster: readonly Adventurer[],
  rng: Rng,
  config: HallConfig,
): HallAttendance {
  // onMission / injured / dead는 예외를 나열하는 대신 그냥 후보에서 빠진다.
  const guildCandidates = roster.filter(
    (person) => person.inGuild && person.status === 'available',
  );
  const visitorCandidates = roster.filter(
    (person) => !person.inGuild && person.status === 'available',
  );

  const guildWanted = rng.int(config.hallAttendanceMin, config.hallAttendanceMax);
  const visitorWanted = rng.int(config.visitorMin, config.visitorMax);

  return {
    guildMemberIds: pickDistinctIds(rng, guildCandidates, guildWanted),
    visitorIds: pickDistinctIds(rng, visitorCandidates, visitorWanted),
  };
}

/**
 * 후보 중 서로 다른 `count`명의 id를 뽑는다.
 *
 * 가중치를 전부 1로 주고 `weighted.ts`의 `rollWeightedIndex`를 재사용한다. 홀 출석은
 * 근속 가중치 같은 것이 없어 균등 추출이면 충분하지만, "인덱스를 뽑고 뽑힌 자리를
 * 제거하는" 복원 없는 추출 로직 자체를 이 파일에 새로 쓰지 않기 위해서다 —
 * `contract.ts`의 `pickByTenureWeight`와 같은 이유(`weighted.ts` 상단 주석 참조:
 * "복사해 두면 조용히 갈라진다").
 *
 * `count`가 후보 수보다 크면 후보 수만큼만 뽑는다 — 던지지 않는다.
 */
function pickDistinctIds(
  rng: Rng,
  candidates: readonly Adventurer[],
  count: number,
): readonly string[] {
  const remaining = [...candidates];
  const chosen: string[] = [];
  const wanted = Math.min(count, remaining.length);

  for (let picked = 0; picked < wanted; picked += 1) {
    const index = rollWeightedIndex(rng, remaining.map(() => 1));
    chosen.push(remaining[index].id);
    remaining.splice(index, 1);
  }

  return chosen;
}
