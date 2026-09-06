// @ai-factory:wiring-first — 스캐폴드가 설계(SPEC 화면 표·패킷 목록)로부터 결정론으로 깐 라우트 골격이다.
// 진입점(App.tsx) 패킷: 처음부터 다시 쓰지 마라 — SPEC과 경로를 대조·보완하고, 전역 Provider(광고/결제 SDK·앱 상태)를
//   <Routes>를 감싸는 자리에 끼워라. 라우트 경로는 지우지 말고 고쳐라(화면 파일은 이 경로로 navigate한다).
// 화면 패킷: 이 파일을 건드리지 마라 — 자기 페이지 파일(자리 페이지)만 통째로 교체한다.
import { lazy, Suspense, type ReactNode } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppDataProvider } from './app/AppDataProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FloatingTabBar, type TabItem } from './components/FloatingTabBar';
import { RequireProfile, RedirectIfOnboarded } from './components/RouteGuard';
import Home from './pages/Home';
import Onboarding from './pages/Onboarding';
import Rank from './pages/Rank';
import Pay from './pages/Pay';
import Vacation from './pages/Vacation';
import Savings from './pages/Savings';
import SavingsResult from './pages/SavingsResult';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

// Dev-only TDS Gallery route — `import.meta.env.DEV` is statically replaced
// (true in dev, false in prod) so the entire import + Route is tree-shaken
// from production builds. Verify with: `grep -r "TdsGallery" dist/` → empty.
const DevTdsGallery = import.meta.env.DEV
  ? lazy(() => import('./pages/__TdsGallery'))
  : null;

// iconName은 static.toss.im에 실재하는 이름만 — 없는 이름은 TDS가 렌더 중 throw한다(2026-09-07 실측).
const TAB_ITEMS: TabItem[] = [
  { label: '홈', path: '/', iconName: 'icon-home-mono' },
  { label: '계급', path: '/rank', iconName: 'icon-medal-mono' },
  { label: '휴가', path: '/vacation', iconName: 'icon-sun-mono' },
  { label: '적금', path: '/savings', iconName: 'icon-bank-mono' },
];

/**
 * 하단 탭바가 붙는 화면 래퍼.
 *
 * 탭바 노출 여부는 경로 문자열 비교가 아니라 라우트 구조로 정한다 — 온보딩·적금 결과처럼
 * 몰입이 필요한 화면은 이 래퍼를 쓰지 않으면 그만이라 조건이 한 곳에서 새지 않는다.
 * `activePath`는 탭이 아닌 화면(급여·설정)에서는 비워 어떤 탭도 활성으로 보이지 않게 한다.
 */
function TabScreen({ activePath, children }: { activePath?: string; children: ReactNode }) {
  return (
    <>
      {children}
      <FloatingTabBar items={TAB_ITEMS} activePath={activePath ?? ''} />
    </>
  );
}

export default function App() {
  return (
    // @ai-factory:providers — 전역 Provider는 <Routes>를 감싸는 이 자리에 둔다(main.tsx는 @AI:ANCHOR, 수정 금지).
    // ErrorBoundary가 가장 바깥 — Provider 초기화(로컬 저장소·SDK)에서 throw해도 흰 화면 대신 폴백이 뜬다.
    <ErrorBoundary>
      <AppDataProvider>
        <Routes>
          <Route
            path="/"
            element={
              <RequireProfile>
                <TabScreen activePath="/">
                  <Home />
                </TabScreen>
              </RequireProfile>
            }
          />
          <Route
            path="/onboarding"
            element={
              <RedirectIfOnboarded>
                <Onboarding />
              </RedirectIfOnboarded>
            }
          />
          <Route
            path="/rank"
            element={
              <RequireProfile>
                <TabScreen activePath="/rank">
                  <Rank />
                </TabScreen>
              </RequireProfile>
            }
          />
          <Route
            path="/pay"
            element={
              <RequireProfile>
                <TabScreen>
                  <Pay />
                </TabScreen>
              </RequireProfile>
            }
          />
          <Route
            path="/vacation"
            element={
              <RequireProfile>
                <TabScreen activePath="/vacation">
                  <Vacation />
                </TabScreen>
              </RequireProfile>
            }
          />
          <Route
            path="/savings"
            element={
              <RequireProfile>
                <TabScreen activePath="/savings">
                  <Savings />
                </TabScreen>
              </RequireProfile>
            }
          />
          <Route path="/savings/result" element={<SavingsResult />} />
          <Route
            path="/settings"
            element={
              <RequireProfile>
                <TabScreen>
                  <Settings />
                </TabScreen>
              </RequireProfile>
            }
          />
          <Route path="*" element={<NotFound />} />
          {DevTdsGallery && (
            <Route
              path="/__tds-gallery"
              element={
                <Suspense fallback={null}>
                  <DevTdsGallery />
                </Suspense>
              }
            />
          )}
        </Routes>
      </AppDataProvider>
    </ErrorBoundary>
  );
}
