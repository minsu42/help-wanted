/**
 * 서술 텍스트 조립 — 템플릿 치환 엔진.
 *
 * **3일 프로젝트 1순위 킬러에 대한 유일한 방어선이다** — 대화 콘텐츠 작성량 폭발.
 * 문장은 코드가 아니라 `src/data/text.json`에 있고, 이 파일은 자리를 채울 뿐이다.
 * 이것을 먼저 만들어 두면 이후 스토리들이 문장을 손으로 쓸 유혹을 구조적으로 차단당한다.
 *
 * ## 의도적으로 원시적이다
 *
 * 정규식 치환 한 줄이 전부다. 조건 분기나 반복 같은 것을 넣기 시작하면 **템플릿 엔진을
 * 만드는 일 자체가 스코프 폭발**이 된다. 필요한 것은 `{name}`을 이름으로 바꾸는 것뿐이다.
 *
 * ## 빠진 값에 던지는 이유
 *
 * 조용히 넘어가면 화면에 `{name}은 돌아오지 않았다`가 그대로 나가고, 그것을 발견하는
 * 시점은 심사 중이다. 게다가 변형마다 쓰는 자리표시자가 달라서 **어떤 시드에서만
 * 터지는** 형태가 되기 쉽다. 그래서 {@link narrate}는 문장을 고르기 **전에**
 * `_vars` 선언으로 먼저 검사한다 — 실패를 시드와 무관하게 만드는 것이 요점이다.
 */
import type { Rng } from './rng';
import type { Trait } from './types';

/** 자리표시자에 넣을 값. 숫자는 그대로 넘겨도 된다 — 위험도가 자주 들어온다. */
export type TemplateVars = Readonly<Record<string, string | number>>;

/** 상황 하나의 문안 묶음. */
export interface SituationBank {
  /** 이 상황이 요구하는 자리표시자. 변형마다 다를 수 있으므로 여기서 한 번에 선언한다 */
  readonly _vars: readonly string[];
  /** 성격 태그별 어휘 집합. `default`는 반드시 있어야 한다 */
  readonly lines: Readonly<Record<string, readonly string[]>>;
}

/** `src/data/text.json`의 모양. */
export interface TextBank {
  readonly situations: Readonly<Record<string, SituationBank>>;
}

/** 어느 성격에도 걸리지 않을 때 쓰는 어휘 집합의 키. */
const FALLBACK_VARIANT = 'default';

const PLACEHOLDER = /\{(\w+)\}/g;

/**
 * `{key}` 자리표시자를 값으로 바꾼다.
 *
 * 빈 문자열은 **정상 값이다** — 누락과 구분한다. 값을 일부러 비우는 경우가 있고,
 * 그것까지 막으면 호출자가 공백 한 칸을 넣는 우회를 하게 된다.
 *
 * @throws 템플릿이 요구하는 자리표시자에 값이 없을 때
 */
export function render(template: string, vars: TemplateVars): string {
  return template.replace(PLACEHOLDER, (_match, key: string) => {
    const value = vars[key];
    if (value === undefined) {
      throw new Error(`자리표시자 {${key}}에 넣을 값이 없다 — "${template}"`);
    }
    return String(value);
  });
}

/**
 * 상황과 성격에 맞는 문장을 하나 골라 조립한다.
 *
 * 성격 태그는 **주어진 순서대로** 확인해서 처음 걸리는 것을 쓴다. 한 사람이 두 개를
 * 가지므로 규칙이 없으면 어느 쪽이 이길지 모르고, 그러면 결정론이 깨진다.
 *
 * @param traits 인물의 성격 태그. 앞에 있는 것이 우선한다
 * @throws 정의되지 않은 상황이거나, `default` 어휘가 없거나, 필요한 값이 빠졌을 때
 */
export function narrate(
  bank: TextBank,
  situation: string,
  traits: readonly Trait[],
  vars: TemplateVars,
  rng: Rng,
): string {
  const entry = bank.situations[situation];
  if (entry === undefined) {
    throw new Error(`정의되지 않은 서술 상황이다 (${situation})`);
  }

  // 문장을 고르기 전에 검사한다. 고른 뒤에 검사하면 그 변형이 뽑힌 시드에서만 터진다.
  const missing = entry._vars.filter((name) => vars[name] === undefined);
  if (missing.length > 0) {
    throw new Error(`상황 ${situation}에 필요한 값이 빠졌다: ${missing.join(', ')}`);
  }

  return render(rng.pick(variantFor(entry, traits, situation)), vars);
}

/** 성격에 맞는 어휘 집합을 고른다. 걸리는 것이 없으면 `default`. */
function variantFor(
  entry: SituationBank,
  traits: readonly Trait[],
  situation: string,
): readonly string[] {
  for (const trait of traits) {
    const lines = entry.lines[trait];
    if (lines !== undefined && lines.length > 0) return lines;
  }

  const fallback = entry.lines[FALLBACK_VARIANT];
  if (fallback === undefined || fallback.length === 0) {
    throw new Error(`상황 ${situation}에 ${FALLBACK_VARIANT} 문안이 없다`);
  }
  return fallback;
}
