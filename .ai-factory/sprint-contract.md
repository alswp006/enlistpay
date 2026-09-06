# Sprint Contract: Router Wiring + Global Provider + TabBar + NotFound

## Overview
App.tsx에서 BrowserRouter(main.tsx, 기존), AppDataProvider, ErrorBoundary, FloatingTabBar를 배선하고, 8개 라우트 + NotFound 경로를 검증한다. NotFound.tsx 자리 페이지를 실제 404 화면으로 교체한다.

## Files to Create/Modify

### 1. `src/App.tsx`
**현재**: AppDataProvider + Routes (8개 라우트 + NotFound)
**변경**: 
- ErrorBoundary로 <Routes>를 감싼다 (SDK throw 가드)
- FloatingTabBar 추가 (하단 탭 네비, 2~5탭 선택 가능)
- 라우트 경로는 유지 (변경 금지)

### 2. `src/pages/NotFound.tsx`
**현재**: @ai-factory:placeholder 자리 페이지
**변경**:
- 마커 제거 후 실제 404 화면으로 통째로 교체
- PageShell + Top("404") + 안내 메시지 + "홈으로" 버튼(SubmitFooter 또는 display="block")
- TDS 컴포넌트 + Asset.ContentIcon 사용

### 3. `src/components/ErrorBoundary.tsx` (신규)
**생성**: React Error Boundary
- SDK throw 에러 catch (흰 화면 방지)
- fallback UI: 다시 시도 버튼 포함
- console.error 명시 (검수 기준)

## Shared Types (types.ts에서 import)
- RouteState (있으면) — navigate state 타입
- 도메인 타입 필요시 domain/types.ts 확인

## Validation Checklist
- [ ] `npx tsc --noEmit` — TypeScript 에러 0개
- [ ] `npx vitest run` — 테스트 통과 (존재 시)
- [ ] `npm run test:visual` — e2e/__shots__/*.png 스크린샷 정상 렌더
- [ ] `npx vite build` — 빌드 성공 (<100MB)
- [ ] `/invalid` 또는 미정의 경로 접근 → NotFound 렌더
- [ ] 마커 `@ai-factory:placeholder` NotFound.tsx에서 제거됨
- [ ] main.tsx 미수정 확인 (@AI:ANCHOR)

## Absolute Prohibitions
- ❌ main.tsx 수정
- ❌ App.tsx 라우트 경로 삭제
- ❌ NotFound.tsx에 placeholder 마커 남김
- ❌ ErrorBoundary 없이 SDK 호출 노출
- ❌ 커스텀 CSS로 TDS 덮어쓰기
- ❌ 콘솔 에러 방치

## Related Context
- spec.md: 8개 화면 목록 + 라우트 경로
- FloatingTabBar 구현체: src/components/ (기존)
- PageShell/ScreenScaffold: src/components/ (기존)
