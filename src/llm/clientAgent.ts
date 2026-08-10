import type {
  ClientCase,
  IntakeSession,
  InterpretedTurn,
  KnowledgeEntry,
  ToolReceipt,
} from '../domain/casework';

export interface InterpretRequest {
  turnId: string;
  utterance: string;
  caseData: ClientCase;
  session: IntakeSession;
  knowledge: readonly KnowledgeEntry[];
}

export interface RespondRequest {
  turnId: string;
  utterance: string;
  caseData: ClientCase;
  session: IntakeSession;
  receipt: ToolReceipt;
}

export interface ClientAgent {
  readonly mode: 'remote' | 'development';
  checkHealth(): Promise<boolean>;
  interpret(request: InterpretRequest): Promise<InterpretedTurn>;
  respond(request: RespondRequest): Promise<string>;
}

export function createClientAgent(options: {
  endpoint?: string;
  fetchImpl?: typeof fetch;
  development?: boolean;
  timeoutMs?: number;
} = {}): ClientAgent {
  if (options.development) return createDevelopmentAgent();
  const endpoint = options.endpoint?.replace(/\/$/, '');
  if (!endpoint) return createDevelopmentAgent();
  return createResilientAgent(createRemoteAgent(endpoint, options.fetchImpl ?? fetch, options.timeoutMs ?? 8000));
}

/**
 * 원격 에이전트를 본선 경로로 쓰되, 연결·스키마 실패가 나면 규칙 기반 폴백으로 내려간다.
 *
 * 심사자가 링크를 여는 시점에 Worker가 죽어 있어도 게임이 첫 화면에서 끝나지 않아야 한다.
 * 한 번 내려간 뒤에는 세션이 끝날 때까지 폴백을 유지해 턴마다 8초씩 기다리지 않는다.
 */
export function createResilientAgent(remote: ClientAgent, fallback = createDevelopmentAgent()): ClientAgent {
  let degraded = false;
  async function withFallback<T>(run: () => Promise<T>, recover: () => Promise<T>): Promise<T> {
    if (degraded) return recover();
    try {
      return await run();
    } catch {
      degraded = true;
      return recover();
    }
  }
  return {
    get mode() { return degraded ? fallback.mode : remote.mode; },
    async checkHealth() {
      if (degraded) return true;
      if (await remote.checkHealth()) return true;
      degraded = true;
      return true;
    },
    interpret: (request) => withFallback(() => remote.interpret(request), () => fallback.interpret(request)),
    respond: (request) => withFallback(() => remote.respond(request), () => fallback.respond(request)),
  };
}

function createRemoteAgent(endpoint: string, fetchImpl: typeof fetch, timeoutMs: number): ClientAgent {
  async function request(path: string, body?: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${endpoint}${path}`, body === undefined ? { signal: controller.signal } : {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`agent_http_${response.status}`);
      return response.json();
    } finally {
      window.clearTimeout(timer);
    }
  }

  return {
    mode: 'remote',
    async checkHealth() {
      try {
        const payload = await request('/health');
        return isRecord(payload) && payload.ok === true;
      } catch {
        return false;
      }
    },
    async interpret(input) {
      const payload = await request('/interpret', publicInterpretPayload(input));
      const parsed = validateInterpretation(payload, input);
      if (!parsed) throw new Error('agent_schema_violation');
      return parsed;
    },
    async respond(input) {
      const payload = await request('/respond', {
        turnId: input.turnId,
        persona: {
          name: input.caseData.clientName,
          occupation: input.caseData.occupation,
          motive: input.caseData.motive,
          demeanor: input.caseData.demeanor,
          emotion: input.session.emotion,
        },
        playerUtterance: input.utterance,
        conversation: input.session.turns.slice(-12).map((turn) => ({ speaker: turn.speaker, text: turn.text })),
        publicFacts: input.caseData.facts
          .filter((fact) => input.session.disclosedFactIds.includes(fact.id))
          .map((fact) => ({ id: fact.id, value: fact.value })),
        approvedReaction: input.receipt.reaction,
      });
      if (!isRecord(payload) || typeof payload.utterance !== 'string') throw new Error('agent_schema_violation');
      const utterance = payload.utterance.trim().slice(0, 360);
      if (!utterance) throw new Error('agent_schema_violation');
      return utterance;
    },
  };
}

export function createDevelopmentAgent(): ClientAgent {
  return {
    mode: 'development',
    checkHealth: async () => true,
    async interpret(request) {
      await microDelay();
      return interpretLocally(request);
    },
    async respond(request) {
      await microDelay();
      const prefix = request.session.emotion === 'angry' ? '…' : request.session.emotion === 'guarded' ? '흠. ' : '';
      return `${prefix}${request.receipt.reaction}`.slice(0, 360);
    },
  };
}

function publicInterpretPayload(request: InterpretRequest): unknown {
  return {
    turnId: request.turnId,
    utterance: request.utterance,
    allowedSlots: ['objective', 'target', 'scale', 'location', 'trait'],
    allowedFacts: request.caseData.facts.map((fact) => ({ id: fact.id, slot: fact.slot, label: fact.label })),
    visibleKnowledge: request.knowledge.map((entry) => ({ id: entry.id, title: entry.title, text: entry.text })),
    publicFacts: request.caseData.facts
      .filter((fact) => request.session.disclosedFactIds.includes(fact.id))
      .map((fact) => ({ id: fact.id, value: fact.value })),
  };
}

function validateInterpretation(payload: unknown, request: InterpretRequest): InterpretedTurn | null {
  if (!isRecord(payload)) return null;
  const intents = ['ask', 'challenge', 'negotiate', 'accuse', 'reassure', 'other'] as const;
  const tones = ['supportive', 'neutral', 'hostile'] as const;
  const slots = ['objective', 'target', 'scale', 'location', 'trait'] as const;
  const intent = intents.find((value) => payload.intent === value);
  const tone = tones.find((value) => payload.tone === value);
  if (!intent || !tone) return null;
  const targetSlots = arrayOfAllowed(payload.targetSlots, slots);
  const factIds = request.caseData.facts.map((fact) => fact.id);
  const knowledgeIds = request.knowledge.map((entry) => entry.id);
  const confidence = typeof payload.confidence === 'number' ? clamp(payload.confidence, 0, 1) : 0;
  const amount = typeof payload.offerAmount === 'number' && Number.isFinite(payload.offerAmount)
    ? Math.max(0, Math.round(payload.offerAmount))
    : undefined;
  return {
    intent,
    tone,
    targetSlots,
    assertedFactIds: arrayOfAllowed(payload.assertedFactIds, factIds),
    citedKnowledgeIds: arrayOfAllowed(payload.citedKnowledgeIds, knowledgeIds),
    offerAmount: amount,
    confidence,
  };
}

function interpretLocally(request: InterpretRequest): InterpretedTurn {
  const text = request.utterance.toLowerCase();
  const targetSlots = new Set<InterpretedTurn['targetSlots'][number]>();
  if (has(text, ['왜', '목적', '구조', '회수', '호위', '무엇을'])) targetSlots.add('objective');
  if (has(text, ['누구', '무엇', '정체', '괴물', '짐승', '상자', '쥐', '화물'])) targetSlots.add('target');
  if (has(text, ['몇', '마리', '개', '규모', '수량'])) targetSlots.add('scale');
  if (has(text, ['어디', '장소', '길', '경로', '위치', '저장고', '늪', '채석장'])) targetSlots.add('location');
  if (has(text, ['흔적', '긁', '빛', '냉기', '약점', '특징', '냄새', '침'])) targetSlots.add('trait');
  if (targetSlots.size === 0) {
    const matching = request.caseData.facts.find((fact) => text.includes(fact.label.toLowerCase()));
    if (matching) targetSlots.add(matching.slot);
  }

  const citedKnowledgeIds = request.knowledge.filter((entry) => knowledgeMentioned(text, entry)).map((entry) => entry.id);
  const amountMatch = text.match(/(?:은화\s*)?(\d{1,3})(?:\s*닢)?/);
  const offerAmount = amountMatch?.[1] === undefined ? undefined : Number(amountMatch[1]);
  const hostile = has(text, ['거짓말', '범죄', '잡아', '당장', '속이']);
  const supportive = has(text, ['괜찮', '이해', '도와', '걱정', '천천히']);
  const negotiate = offerAmount !== undefined || has(text, ['보수', '은화', '수당', '시세']);
  const challenge = citedKnowledgeIds.length > 0 || has(text, ['그런데', '모순', '말이 다르']);
  return {
    intent: negotiate ? 'negotiate' : challenge ? 'challenge' : supportive ? 'reassure' : hostile ? 'accuse' : targetSlots.size > 0 ? 'ask' : 'other',
    targetSlots: [...targetSlots],
    assertedFactIds: [],
    citedKnowledgeIds,
    offerAmount,
    tone: hostile ? 'hostile' : supportive ? 'supportive' : 'neutral',
    confidence: targetSlots.size > 0 || negotiate || citedKnowledgeIds.length > 0 ? 0.9 : 0.45,
  };
}

function knowledgeMentioned(text: string, entry: KnowledgeEntry): boolean {
  const signatures: Record<string, readonly string[]> = {
    'k-mimic-scratches': ['평행', '나란한', '긁힘', '미믹'],
    'k-mimic-fire': ['불', '화염', '알코올', '접착'],
    'k-wisp-cold': ['푸른 불', '냉기', '입김', '늪불', '은 가루'],
    'k-smuggling': ['봉인', '마력석', '밀수', '금지 화물'],
    'k-seal-standard': ['청동 봉인', '운송장', '봉인 기준'],
    'k-c-rate': ['c급', '24', '최소 보수'],
    'k-b-rate': ['b급', '36', '최소 보수'],
    'k-magic-premium': ['위험수당', '20%', '마력 위험'],
    'k-rescue-rule': ['구조 우선', '생존자', '구조를 우선'],
  };
  return has(text, signatures[entry.id] ?? [entry.title.toLowerCase()]);
}

function has(text: string, fragments: readonly string[]): boolean {
  return fragments.some((fragment) => text.includes(fragment));
}

function arrayOfAllowed<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(value)) return [];
  const set = new Set(allowed);
  return [...new Set(value.filter((item): item is T => typeof item === 'string' && set.has(item as T)))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function microDelay(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 180));
}
