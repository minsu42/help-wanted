/**
 * 가중 추출 — 두 곳에서 쓰인다.
 *
 * - 의뢰 생성: 근속이 길수록 의뢰인을 알 확률이 높다 (`contract.ts`)
 * - 파견 판정: 역량이 낮을수록 사상자가 될 확률이 높다 (`dispatch.ts`)
 *
 * 한 줄짜리 누적합이지만 **복사해 두면 조용히 갈라진다.** 확률 코드의 미묘한 차이는
 * 테스트가 통과하는 채로 분포만 어긋나므로 눈에 띄지 않는다. 그래서 한 곳에 둔다.
 */
import type { Rng } from './rng';

/**
 * 가중치 배열에서 인덱스 하나를 뽑는다.
 *
 * **모든 가중치가 유한한 양수여야 한다.** 0이나 음수, `Infinity`, `NaN`이 섞이면
 * 분포가 조용히 망가지므로 호출자가 미리 걸러야 한다 — 여기서 관대하게 처리하면
 * 버그가 "가끔 이상한 사람이 뽑힌다"로 나타나 추적이 불가능해진다.
 *
 * @throws 배열이 비었거나 유한한 양수가 아닌 가중치가 있을 때
 */
export function rollWeightedIndex(rng: Rng, weights: readonly number[]): number {
  if (weights.length === 0) {
    throw new Error('rollWeightedIndex(): 빈 가중치 배열에서 고를 수 없다');
  }
  for (const weight of weights) {
    if (!Number.isFinite(weight) || weight <= 0) {
      throw new Error(`rollWeightedIndex(): 가중치는 유한한 양수여야 한다 (받은 값: ${weight})`);
    }
  }

  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = rng.next() * total;

  for (let index = 0; index < weights.length; index += 1) {
    roll -= weights[index];
    if (roll < 0) return index;
  }

  // 부동소수 오차로 끝까지 도달한 경우. 모든 가중치가 양수이므로 마지막이 정답이다.
  return weights.length - 1;
}
