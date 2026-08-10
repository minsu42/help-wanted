/**
 * LLM 게이트웨이 — **이 저장소에서 네트워크를 아는 유일한 모듈이다.**
 *
 * `.claude/docs/technical-preferences.md`의 금지 조항이 이것을 요구한다:
 * *"네트워크 호출은 LLM 게이트웨이 모듈 한 곳에만. `src/domain/**`은 여전히
 * `fetch`를 몰라야 한다."* 그래서 이 파일은 `src/domain/`에 있지 않고,
 * 도메인 타입을 하나도 import하지 않는다 — 의존 방향이 반대로 서면 순수 함수
 * 규약이 조용히 무너진다.
 *
 * ## 던지지 않는다
 *
 * 모든 실패 경로가 `null`로 수렴한다. 호출자는 `null`이면 폴백(고정 문안 조립)
 * 으로 간다 — ADR-003 D5가 *"폴백만으로 완주 가능해야 한다"* 고 못박았고,
 * 예외를 던지면 화면이 그 규칙을 지키려고 try/catch를 사방에 두르게 된다.
 * **여기서 삼키고 `source`로 알린다.**
 *
 * ## 검증을 두 번 하는 이유
 *
 * Worker도 같은 id 화이트리스트 검증을 한다 (`workers/intake-proxy/worker.js`).
 * 중복이지만 의도한 중복이다 — 프록시를 갈아 끼우거나 로컬 목으로 바꿔도
 * **LLM이 게임 상태에 닿지 못한다**(ADR-003 D3)는 성질이 클라이언트 쪽에서
 * 혼자 성립해야 한다.
 */

/** 플레이어가 지금 물을 수 있는 것. `topic`은 **화제의 이름**이지 내용이 아니다. */
export interface TurnCandidate {
  readonly id: string;
  /**
   * 물어볼 거리의 이름. 예: `'발자국의 생김새'`.
   *
   * ⚠ **여기에 사실 원문을 넣으면 안 된다.** 프로토 3회차에서 후보에 `fact`를
   * 실었더니 의뢰인이 묻지도 않은 답을 먼저 말했다 — ADR-003 D6 위반이다
   * (`prototypes/flow-intake/README.md` ①).
   */
  readonly topic: string;
}

/** 플레이어가 들이댈 수 있는 것 — 이미 아는 사실. 이쪽은 내용을 실어도 된다. */
export interface TurnClue {
  readonly id: string;
  readonly text: string;
}

/** 최근 대화 한 줄. */
export interface TurnHistoryLine {
  readonly who: string;
  readonly text: string;
}

/** 한 턴의 컨텍스트. **판정이 끝난 뒤** 그 결과를 연기시키려고 보내는 것이다. */
export interface TurnRequest {
  readonly occupation: string;
  /** 방금 판정으로 공개가 허가된 사실 하나. 없으면 비운다 (D6). */
  readonly saidFact?: string;
  /** 연기 지시(예: `'조급하다'`). 상태가 아니라 질감이다. */
  readonly mood?: string;
  readonly candidates: readonly TurnCandidate[];
  readonly clues: readonly TurnClue[];
  readonly history: readonly TurnHistoryLine[];
}

/** 길드마스터가 할 수 있는 말 하나. 반드시 우리가 준 id 중 하나를 가리킨다. */
export type TurnOption =
  | { readonly text: string; readonly nodeId: string }
  | { readonly text: string; readonly clueId: string };

/** 한 턴의 산출물. */
export interface GeneratedTurn {
  readonly say: string;
  readonly options: readonly TurnOption[];
}

/** 게이트웨이 설정. `fetchImpl`이 주입 가능한 것이 테스트 전략의 전부다. */
export interface GatewayConfig {
  /** 프록시 Worker의 기준 URL. 끝의 `/`는 있어도 없어도 된다 */
  readonly endpoint: string;
  /** ADR-003 D7: 8초를 넘기면 폴백으로 간다 */
  readonly timeoutMs?: number;
  /** 기본은 전역 `fetch`. 테스트는 목을 넣는다 */
  readonly fetchImpl?: typeof fetch;
}

export interface LlmGateway {
  /**
   * 프록시가 살아 있는지 한 번 묻는다 (D5의 기동 시 헬스체크).
   * 실패는 예외가 아니라 `false`다.
   */
  checkHealth(): Promise<boolean>;
  /** 한 턴을 생성한다. 실패·스키마 위반·타임아웃이면 `null` — 호출자는 폴백으로 간다. */
  requestTurn(request: TurnRequest): Promise<GeneratedTurn | null>;
}

/** ADR-003 D7의 대사 표기 예산. 초과하면 폴백 경로로 처리한다. */
const DEFAULT_TIMEOUT_MS = 8000;

/** 화면이 감당할 수 있는 상한. 연기가 길어지면 잘라서 보여준다. */
const MAX_SAY_CHARS = 400;
const MAX_OPTIONS = 3;

export function createLlmGateway(config: GatewayConfig): LlmGateway {
  const base = config.endpoint.replace(/\/+$/, '');
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const doFetch = config.fetchImpl ?? globalThis.fetch;

  async function post(path: string, body: unknown): Promise<unknown | null> {
    if (!doFetch) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await doFetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) return null;
      return (await res.json()) as unknown;
    } catch {
      // 네트워크 단절·타임아웃·JSON 파싱 실패가 전부 여기로 온다. 전부 폴백이다.
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async checkHealth(): Promise<boolean> {
      if (!doFetch) return false;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await doFetch(`${base}/health`, { signal: controller.signal });
        return res.ok;
      } catch {
        return false;
      } finally {
        clearTimeout(timer);
      }
    },

    async requestTurn(request: TurnRequest): Promise<GeneratedTurn | null> {
      const payload = await post('/turn', {
        occupation: request.occupation,
        saidFact: request.saidFact ?? '',
        mood: request.mood ?? '',
        candidates: request.candidates.map((c) => ({ id: c.id, topic: c.topic })),
        clues: request.clues.map((c) => ({ id: c.id, text: c.text })),
        history: request.history.map((h) => ({ who: h.who, text: h.text })),
      });
      return payload === null ? null : validateTurn(payload, request);
    },
  };
}

/**
 * 응답을 우리 규약에 맞게 깎는다. **우리가 준 id 밖의 선택지는 버린다** —
 * 이 한 줄이 ADR-003 D3("LLM은 게임 상태에 직접 손대지 못한다")의 실물이다.
 *
 * `say`가 비면 턴 자체가 성립하지 않으므로 `null`이다. 반면 `options`가 비는 것은
 * 정상이다 — 후보가 없는 국면이 실제로 있다.
 */
export function validateTurn(raw: unknown, request: TurnRequest): GeneratedTurn | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;

  const say = typeof record.say === 'string' ? record.say.trim().slice(0, MAX_SAY_CHARS) : '';
  if (!say) return null;

  const nodeIds = new Set(request.candidates.map((c) => c.id));
  const clueIds = new Set(request.clues.map((c) => c.id));
  const rawOptions = Array.isArray(record.options) ? record.options : [];

  const options: TurnOption[] = [];
  for (const item of rawOptions) {
    if (options.length >= MAX_OPTIONS) break;
    if (typeof item !== 'object' || item === null) continue;
    const option = item as Record<string, unknown>;
    const text = typeof option.text === 'string' ? option.text.trim() : '';
    if (!text) continue;
    const nodeId = typeof option.nodeId === 'string' ? option.nodeId : '';
    const clueId = typeof option.clueId === 'string' ? option.clueId : '';
    if (nodeId && nodeIds.has(nodeId)) options.push({ text, nodeId });
    else if (clueId && clueIds.has(clueId)) options.push({ text, clueId });
  }

  return { say, options };
}
