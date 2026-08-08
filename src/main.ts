import "./presentation/styles/base.css";

// 배포 파이프라인 확인용 최소 화면. Day 1에 실제 창구 화면으로 교체된다.
const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app 요소를 찾을 수 없다");

app.innerHTML = `
  <main class="desk">
    <h1 class="desk__title">Help Wanted</h1>
    <p class="desk__subtitle">사람을 구합니다</p>
    <p class="desk__note">빌드와 배포가 정상 동작합니다.</p>
  </main>
`;
