# AI Client Agent Worker

이 Worker는 Help Wanted의 AI 의뢰인 보안 경계다. 브라우저가 공급자 API를 직접 호출하지 않으며, AI는 게임 상태를 직접 변경하지 않는다.

## Endpoint

```text
GET  /health
POST /interpret
POST /respond
```

- `/interpret`: 플레이어의 한 문장을 허용된 사실·자료 ID로 구조화한다.
- 클라이언트 규칙 엔진: 사실 공개, 인내, 경계와 보수를 판정하고 `ToolReceipt`를 만든다.
- `/respond`: 승인된 반응과 공개 사실만 받아 의뢰인의 한국어 대사로 표현한다.

## Environment

- `LLM_API_KEY`: 공급자 API 키
- `PROVIDER`: `nvidia` 또는 `openai`
- `MODEL`: OpenAI 호환 Chat Completions 모델
- `ALLOWED_ORIGINS`: 쉼표로 구분한 게임 배포 출처
- `DAILY_CALL_CAP`: 일일 호출 상한
- `RATE_LIMIT_PER_MINUTE`: IP당 분당 상한

```bash
cd workers/intake-proxy
npx wrangler secret put LLM_API_KEY
npx wrangler deploy
```

게임 빌드에는 배포된 Worker의 기준 URL을 `VITE_AGENT_ENDPOINT`로 주입한다. API 키와 시스템 프롬프트는 브라우저 번들에 포함하지 않는다.

로컬에서는 저장소 루트의 `.env.example`을 `.env.local`로 복사하고 배포 주소를 넣는다.

```text
VITE_AGENT_ENDPOINT=https://help-wanted-intake.nan2026.workers.dev
```

주소가 없을 때 `npm run dev`는 화면과 규칙 검증을 위한 개발 시뮬레이터를 사용한다. 이 상태는 실제 모델 호출이 아니며 게임 헤더에 `개발 시뮬레이터`로 표시된다. 주소가 있고 `/health`가 성공하면 `실시간 AI`로 표시되며, 응답 요청에는 최근 12턴과 최신 플레이어 문장, 인물의 태도가 포함된다.
