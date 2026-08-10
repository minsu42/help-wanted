import { describe, expect, it } from "vitest";
import {
  createLlmGateway,
  validateTurn,
  type TurnRequest,
} from "../../../src/llm/gateway";

/** 후보 둘·단서 하나짜리 기준 턴. 각 테스트가 필요한 축만 덮어쓴다. */
const REQUEST: TurnRequest = {
  occupation: "주민",
  candidates: [
    { id: "d-toes", topic: "발자국의 생김새" },
    { id: "d-night", topic: "그날 밤의 일" },
  ],
  clues: [{ id: "c-bones", text: "뼈가 쌓여 있었다" }],
  history: [{ who: "의뢰인", text: "부디 좀 도와주십시오." }],
};

/** 한 번 호출되고 정해진 본문을 돌려주는 목. 보낸 요청도 같이 기록한다. */
function mockFetch(body: unknown, init: { ok?: boolean } = {}) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const impl = (async (url: unknown, options?: RequestInit) => {
    calls.push({ url: String(url), init: options });
    return {
      ok: init.ok ?? true,
      json: async () => body,
    } as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

function gatewayWith(body: unknown, init: { ok?: boolean } = {}) {
  const { impl, calls } = mockFetch(body, init);
  return { gateway: createLlmGateway({ endpoint: "https://proxy.test/", fetchImpl: impl }), calls };
}

describe("requestTurn", () => {
  it("test_valid_response_is_returned_as_is", async () => {
    const { gateway } = gatewayWith({
      say: "그날 이후로 밤에 못 나갑니다.",
      options: [{ text: "발자국은 어떻게 생겼습니까?", nodeId: "d-toes" }],
    });

    const turn = await gateway.requestTurn(REQUEST);

    expect(turn).toEqual({
      say: "그날 이후로 밤에 못 나갑니다.",
      options: [{ text: "발자국은 어떻게 생겼습니까?", nodeId: "d-toes" }],
    });
  });

  it("test_posts_topic_not_fact_to_the_proxy", async () => {
    // 후보에 사실 원문이 실리면 연기자가 답을 먼저 말한다 (ADR-003 D6).
    // 게이트웨이는 `topic`만 실어 보낸다 — 그 계약을 여기서 못박는다.
    const { gateway, calls } = gatewayWith({ say: "네…", options: [] });

    await gateway.requestTurn(REQUEST);

    const body = JSON.parse(String(calls[0]?.init?.body));
    expect(calls[0]?.url).toBe("https://proxy.test/turn");
    expect(body.candidates).toEqual([
      { id: "d-toes", topic: "발자국의 생김새" },
      { id: "d-night", topic: "그날 밤의 일" },
    ]);
  });

  it("test_option_with_unknown_id_is_dropped", async () => {
    // LLM이 지어낸 id는 게임 상태에 닿으면 안 된다 (ADR-003 D3).
    const { gateway } = gatewayWith({
      say: "무섭습니다.",
      options: [
        { text: "지어낸 화제입니다", nodeId: "d-invented" },
        { text: "그날 밤 이야기를 해 주시죠.", nodeId: "d-night" },
      ],
    });

    const turn = await gateway.requestTurn(REQUEST);

    expect(turn?.options).toEqual([{ text: "그날 밤 이야기를 해 주시죠.", nodeId: "d-night" }]);
  });

  it("test_clue_option_is_accepted_when_id_is_known", async () => {
    const { gateway } = gatewayWith({
      say: "그, 그건…",
      options: [{ text: "뼈가 쌓여 있었다더군요.", clueId: "c-bones" }],
    });

    const turn = await gateway.requestTurn(REQUEST);

    expect(turn?.options).toEqual([{ text: "뼈가 쌓여 있었다더군요.", clueId: "c-bones" }]);
  });

  it("test_options_are_capped_at_three", async () => {
    const { gateway } = gatewayWith({
      say: "…",
      options: Array.from({ length: 6 }, (_, i) => ({ text: `말 ${i}`, nodeId: "d-toes" })),
    });

    const turn = await gateway.requestTurn(REQUEST);

    expect(turn?.options).toHaveLength(3);
  });

  it("test_empty_options_is_valid", async () => {
    // 후보가 없는 국면이 실제로 있다. 선택지 0개는 실패가 아니다.
    const { gateway } = gatewayWith({ say: "부디 좀 봐 주십시오.", options: [] });

    const turn = await gateway.requestTurn(REQUEST);

    expect(turn).toEqual({ say: "부디 좀 봐 주십시오.", options: [] });
  });

  it("test_missing_say_falls_back", async () => {
    const { gateway } = gatewayWith({ options: [] });

    expect(await gateway.requestTurn(REQUEST)).toBeNull();
  });

  it("test_http_error_falls_back", async () => {
    const { gateway } = gatewayWith({ error: "upstream_failed" }, { ok: false });

    expect(await gateway.requestTurn(REQUEST)).toBeNull();
  });

  it("test_network_failure_falls_back_instead_of_throwing", async () => {
    // 던지면 화면이 try/catch로 뒤덮인다. 폴백은 예외가 아니라 값이어야 한다 (D5).
    const impl = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const gateway = createLlmGateway({ endpoint: "https://proxy.test", fetchImpl: impl });

    expect(await gateway.requestTurn(REQUEST)).toBeNull();
  });

  it("test_timeout_falls_back", async () => {
    // ADR-003 D7: 예산을 넘긴 응답은 없는 것으로 친다.
    const impl = ((_url: unknown, options?: RequestInit) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      })) as unknown as typeof fetch;
    const gateway = createLlmGateway({
      endpoint: "https://proxy.test",
      fetchImpl: impl,
      timeoutMs: 10,
    });

    expect(await gateway.requestTurn(REQUEST)).toBeNull();
  });
});

describe("checkHealth", () => {
  it("test_healthy_proxy_reports_true", async () => {
    const { gateway, calls } = gatewayWith({ ok: true });

    expect(await gateway.checkHealth()).toBe(true);
    expect(calls[0]?.url).toBe("https://proxy.test/health");
  });

  it("test_dead_proxy_reports_false", async () => {
    const impl = (async () => {
      throw new Error("dns");
    }) as unknown as typeof fetch;
    const gateway = createLlmGateway({ endpoint: "https://proxy.test", fetchImpl: impl });

    expect(await gateway.checkHealth()).toBe(false);
  });
});

describe("validateTurn", () => {
  it("test_non_object_is_rejected", () => {
    expect(validateTurn("문자열", REQUEST)).toBeNull();
    expect(validateTurn(null, REQUEST)).toBeNull();
    expect(validateTurn(42, REQUEST)).toBeNull();
  });

  it("test_option_without_any_id_is_dropped", () => {
    const turn = validateTurn({ say: "네", options: [{ text: "아무 말" }] }, REQUEST);

    expect(turn?.options).toEqual([]);
  });

  it("test_say_is_trimmed_and_capped", () => {
    const turn = validateTurn({ say: `  ${"가".repeat(500)}  `, options: [] }, REQUEST);

    expect(turn?.say).toHaveLength(400);
  });
});
