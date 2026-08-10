# Story 002 — 심문 규칙 도구

## Goal

AI와 무관하게 사실 공개, 모순, 인내, 경계, 협상을 판정하는 순수 함수를 구현한다.

## Scope

- `askFact`
- `challengeClaim`
- `resolveToneEffect`
- `negotiateReward`
- `ToolReceipt`
- `sessionId + turnId` 멱등 처리

## Acceptance Criteria

- 지식 검증이 필요한 은폐는 문장 속 유효한 자료 인용 없이는 공개되지 않는다.
- 의뢰인이 모르는 사실은 어떤 입력에서도 공개되지 않는다.
- 같은 상태와 같은 도구 입력은 같은 영수증을 만든다.
- 동일 `turnId`를 두 번 처리해도 상태 변화는 한 번뿐이다.
- 지불 한도를 넘는 제안은 수락되지 않는다.
- 근거 없는 적대 발화는 인내를 감소시키지만 사실을 열지 않는다.
- `src/domain/**`은 AI 게이트웨이와 `fetch`를 import하지 않는다.
