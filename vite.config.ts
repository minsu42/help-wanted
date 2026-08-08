import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages는 저장소 하위 경로(https://<user>.github.io/help-wanted/)로 서빙한다.
  // 상대 경로 빌드를 쓰지 않으면 배포 후 JS/CSS가 전부 404가 나면서 흰 화면만 뜬다.
  // 로컬 dev 서버에서는 증상이 드러나지 않으므로 이 한 줄을 지우면 배포에서만 깨진다.
  base: "./",
  build: {
    target: "es2020",
  },
});
