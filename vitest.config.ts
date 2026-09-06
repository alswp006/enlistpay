import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Playwright 비주얼 스펙은 e2e/에 있다 — vitest 실행에서 제외(기본 제외 + e2e).
    // .ai-factory/qa-pack의 시나리오도 Playwright 스펙이다 — vitest가 집어 들면
    // "Playwright Test did not expect test() to be called here"로 무조건 실패한다.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', '.ai-factory/**'],
    // 워커 폭발 방지(실사고 2026-07-21 global OOM/exit 137): vitest 기본은 CPU 코어 수만큼
    // 포크를 띄운다(16스레드 머신=최대 16개, 각 수백 MB) → jsdom 로드까지 겹쳐 WSL 총 메모리
    // 소진. 미니앱은 테스트 파일이 3~5개라 2포크로 충분하고 메모리를 8배 이상 줄인다.
    pool: 'forks',
    poolOptions: { forks: { minForks: 1, maxForks: 2 } },
    // 테스트 파일만 SSR 변환으로 읽는다. 클라이언트 변환에 끼는 vite:asset-import-meta-url
    // 플러그인이 `new URL('../../scripts/x.mjs', import.meta.url)`을 자산 URL(http://…)로
    // 재작성해 fileURLToPath가 ERR_INVALID_URL_SCHEME으로 죽기 때문(scripts/policy-scan.mjs를
    // execFileSync로 실행하는 packet-0019 테스트). 컴포넌트 모듈 변환은 그대로 둔다.
    testTransformMode: { ssr: ['**/*.test.ts', '**/*.test.tsx'] },
  },
});
