# Help Wanted

**비밀과 사정을 가진 AI 의뢰인을 자유롭게 심문하고 보수를 협상해, 자료집으로 거짓을 가려내고 모험가의 생사를 좌우하는 의뢰서를 작성하는 중세 판타지 길드 접수 심사 게임.**

NAN 2026 Game × AI Hackathon 예선 제출을 목표로 한다.

## 플레이

플레이어는 왕도 모험가 길드의 신입 접수 심사관이다.

1. 의뢰인의 선제 진술을 듣는다.
2. 자신의 문장으로 자유롭게 질문한다.
3. 자료집 조항과 증빙을 읽고 필요한 근거를 문장 안에 직접 언급한다.
4. 보수와 위험수당을 협상한다.
5. 확보한 사실로 의뢰서를 작성한다.
6. 적합한 파티에 인계한다.
7. 실제 사건과 생환 결과를 대조한다.

별도의 공감·압박·논증 버튼은 없다. 말투는 플레이어가 쓴 문장에서 드러나고, 핵심 사실 공개와 결과는 규칙 엔진이 검증한다.

## AI 설계

AI 의뢰인은 플레이어 발화를 이해하고, 이전 대화를 기억하고, 허용된 게임 도구를 요청하며, 결과를 캐릭터로 연기한다.

- AI: 자연어 이해, 도구 선택, 대사·표정 연기
- 규칙 엔진: 진실, 정보 공개, 지불 한도, 의뢰서, 성공·부상·사망

AI는 핵심 런타임이다. 연결되지 않으면 새 심문 턴을 진행하지 않는다.

## 실행

```bash
npm install
npm run dev
npm run check
```

로컬 Vite 개발 서버는 API 키 없이 규칙과 UI를 확인할 수 있는 개발 전용 에이전트 시뮬레이터를 사용한다. 프로덕션 빌드는 배포된 AI Worker 주소가 필요하다.

```bash
VITE_AGENT_ENDPOINT=https://<worker-host> npm run build
```

Windows PowerShell에서는 `$env:VITE_AGENT_ENDPOINT='https://<worker-host>'`를 먼저 설정한다. 주소가 없거나 헬스체크에 실패하면 게임은 심문을 시작하지 않는다.

## 기술 기준

- TypeScript 5.5.4 strict
- Vite 7.3.6
- DOM + CSS
- Vitest + happy-dom
- Cloudflare Worker 기반 AI 에이전트 게이트웨이
- 런타임 npm 의존성 0개

## 정본 문서

- [게임 콘셉트](design/gdd/game-concept.md)
- [한 문장 자유 심문](design/gdd/intake-dialogue.md)
- [AI 의뢰인 에이전트](design/gdd/ai-client-agent.md)
- [의뢰서·인계·결과](design/gdd/commission-dispatch.md)
- [시스템 인덱스](design/gdd/systems-index.md)
- [시장조사](design/research/nan2026-market-2026-08-10.md)
- [제작 로드맵](production/roadmap.md)

## 구조

```text
src/domain/        순수 게임 규칙
src/data/          사건·자료집·파티·밸런스
src/llm/           AI 게이트웨이와 검증
src/presentation/  DOM 화면과 CSS
workers/           AI 프롬프트·도구 오케스트레이션
tests/             규칙·통합·화면 테스트
```
