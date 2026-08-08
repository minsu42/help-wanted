/**
 * 시드 기반 난수 생성기.
 *
 * `Math.random()`을 직접 쓰지 않는 이유: 같은 시드에 같은 입력이면 언제나 같은 결과가
 * 나와야 한다. 그 재현성이 없으면 밸런싱 중에 본 현상을 다시 만들 수 없고, 버그
 * 신고를 시드 하나로 주고받을 수도 없다.
 *
 * 알고리즘은 mulberry32 — 32비트 상태 하나로 도는 작고 빠른 PRNG다. 암호학적 용도가
 * 아니므로 품질보다 재현성과 크기가 중요하다.
 */
export interface Rng {
  /** 0 이상 1 미만의 실수 */
  next(): number;
  /** min 이상 max 이하의 정수 */
  int(min: number, max: number): number;
  /** 확률 p(0~1)로 참 */
  chance(p: number): boolean;
  /** 배열에서 하나를 고른다. 빈 배열이면 던진다 */
  pick<T>(items: readonly T[]): T;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int(min: number, max: number): number {
      if (max < min) throw new Error(`int(${min}, ${max}): max가 min보다 작다`);
      return min + Math.floor(next() * (max - min + 1));
    },
    chance(p: number): boolean {
      return next() < p;
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error("pick(): 빈 배열에서 고를 수 없다");
      return items[Math.floor(next() * items.length)]!;
    },
  };
}
