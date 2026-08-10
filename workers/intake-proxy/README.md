# 청취 프록시 Worker

게임 본체(GitHub Pages)와 LLM 공급자 사이에 서는 **전용 엔드포인트 하나**.
근거와 결정은 `docs/architecture/adr-003-runtime-llm-and-proxy.md`가 소유한다 —
이 문서는 **운영 절차만** 적는다.

```
GitHub Pages (게임)  ──fetch──▶  이 Worker  ──▶ NVIDIA NIM (1순위)
                                            └─▶ OpenAI      (예비)
```

## 왜 프록시가 필요한가 (한 줄)

NVIDIA(1순위)는 **CORS 헤더를 주지 않아** 브라우저에서 직접 못 부르고, 키를
클라이언트에 두면 공개 저장소에 키를 올리는 것과 같다. 프록시를 세우면 두 문제가
한 번에 닫힌다.

## 엔드포인트

| 메서드 | 경로 | 용도 |
| ---- | ---- | ---- |
| `GET` | `/health` | 기동 시 헬스체크. 죽어 있으면 게임은 폴백 모드로 진행한다 (D5) |
| `POST` | `/turn` | 턴 하나. `{say, options[]}`를 돌려준다 |

`POST /turn` 요청 본문 — **프롬프트가 아니라 구조화된 턴 컨텍스트다.**

```json
{
  "occupation": "주민",
  "saidFact": "사람 발만 한데 발가락이 셋이었다",
  "mood": "조급하다",
  "candidates": [{ "id": "d-toes", "topic": "발자국의 생김새" }],
  "clues":      [{ "id": "c-bones", "text": "뼈가 쌓여 있었다" }],
  "history":    [{ "who": "의뢰인", "text": "부디 좀 도와주십시오." }]
}
```

> ⚠ **`candidates`에는 `topic`(물어볼 거리의 이름)만 싣는다. 사실 원문을 실으면
> 의뢰인이 묻지도 않은 답을 먼저 말한다** — ADR-003 D6 위반이며 프로토 3회차에서
> 실제로 터진 사고다 (`prototypes/flow-intake/README.md` ①).

응답:

```json
{ "say": "그날 이후로 밤에 못 나갑니다.",
  "options": [{ "text": "발자국은 어떻게 생겼습니까?", "nodeId": "d-toes" }] }
```

`options[]`의 id는 **요청에 실려 온 id 집합 안의 것만** 살아남는다. Worker와
클라이언트(`src/llm/gateway.ts`)가 같은 검증을 두 번 한다 — 어느 한쪽만 고쳐도
뚫리지 않게 하기 위해서다 (D3).

## 배포 절차

`wrangler`가 필요하다. 번들에 들어가지 않으므로 런타임 의존성 0 원칙과 무관하다 (D8).

```bash
npm install -D wrangler
```

```bash
npx wrangler login
```

키를 넣는다 — **이 저장소에 키가 들어가는 경로는 존재하지 않는다.**

```bash
npx wrangler secret put LLM_API_KEY --config workers/intake-proxy/wrangler.toml
```

배포한다.

```bash
npx wrangler deploy --config workers/intake-proxy/wrangler.toml
```

로컬에서 돌릴 때는 `.dev.vars.example`을 `.dev.vars`로 복사해 키를 넣는다
(`.dev.vars`는 gitignore된다).

```bash
npx wrangler dev --config workers/intake-proxy/wrangler.toml
```

## 설정 (`wrangler.toml`의 `[vars]`)

| 이름 | 기본값 | 뜻 |
| ---- | ---- | ---- |
| `PROVIDER` | `nvidia` | `nvidia` \| `openai`. **공급자 전환은 여기다** — 클라이언트는 공급자를 모른다 |
| `MODEL` | `meta/llama-3.1-70b-instruct` | 모델 id. 클라이언트가 고르지 못한다 |
| `ALLOWED_ORIGINS` | Pages + localhost | 쉼표 구분. 목록 밖 출처는 403 |
| `RATE_LIMIT_PER_MINUTE` | `20` | IP당 |
| `DAILY_CALL_CAP` | `3000` | 전체 |

시크릿은 `LLM_API_KEY` 하나뿐이다.

## 검증 (배포 후 한 번)

```bash
curl -i https://<worker>.workers.dev/health
```

`ADR-003`의 Verification 표 중 이 Worker가 책임지는 항목:

- Pages origin에서 호출이 성립한다 → 배포된 게임에서 `/turn` 200 + CORS 통과
- 키가 클라이언트에 없다 → `dist/` 산출물에서 키 패턴 grep 0건
- 프록시가 죽어도 완주 가능 → Worker를 내린 채로 하루 진행

## 알려진 한계

**레이트 리밋은 격리(isolate) 단위 best-effort다.** Worker 인스턴스가 여러 개 뜨면
각자 세므로 실제 상한이 설정값의 배수가 될 수 있다. 정확한 상한이 필요하면 KV나
Durable Object를 붙여야 하는데, 그것은 **무상태 Worker를 유지한다는 ADR-003의
결정을 건드리는 일**이라 여기서 임의로 하지 않았다. NVIDIA 무료 크레딧 기준에서는
남용의 피해가 돈이 아니라 쿼터로 한정된다.
