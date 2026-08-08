import { defineConfig } from "vitest/config";

// 규칙 테스트는 브라우저 없이 돈다. 여기서 DOM 환경을 기본으로 켜면 도메인 로직이
// 실수로 브라우저 API에 기대도 테스트가 통과해 버리므로 node 환경을 유지한다.
// DOM이 필요한 테스트는 파일 상단에 @vitest-environment happy-dom 을 적는다.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
