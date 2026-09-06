import type { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Asset } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";

export type TabItem = {
  label: string;
  /** Asset.ContentIcon 등(선택). 없으면 라벨만 표시. */
  icon?: ReactNode;
  /**
   * TDS 아이콘 이름(선택, 예: "icon-home-mono"). 활성 여부에 따라 색이 바뀌어야 하므로
   * 완성된 노드(icon)가 아니라 이름으로 받아 여기서 색을 입힌다.
   * ⚠️ CDN에 없는 이름을 주면 TDS가 렌더 중 throw한다(403 → "Wrong URL") — 검증된 이름만.
   */
  iconName?: string;
  path: string;
};

/**
 * 하단 탭 네비게이션 (App-in-Toss 미니앱용).
 *
 * Pre-built (재구현 금지): 메인 네비게이션이 2~5개 탭이면 직접 만들지 말고 이걸 써라.
 * ⚠️ 'TDS TabBar'는 존재하지 않는다(검증된 export 아님 — Tab은 상단 콘텐츠 전환용).
 * 직접 nav를 만들면 활성탭을 솔리드 버튼(파란 알약)으로 그리는 실수를 한다.
 * 이 컴포넌트는 네이티브 토스처럼 활성탭을 '아이콘+라벨 컬러 틴트'로만 표시한다
 * (배경 알약/Button variant=fill 금지). 활성 판정은 현재 경로(useLocation)로 자동.
 */
export function FloatingTabBar({ items, activePath }: { items: TabItem[]; activePath?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  // 라우트 구조가 활성 탭을 알려주면(App의 TabScreen) 그 값을 쓰고, 없으면 현재 경로로 판정한다.
  const currentPath = activePath ?? location.pathname;

  return (
    <nav
      role="tablist"
      aria-label="메인 네비게이션"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10,
        display: "flex",
        justifyContent: "space-around",
        alignItems: "stretch",
        paddingTop: 6,
        paddingLeft: 8,
        paddingRight: 8,
        // 홈 인디케이터 영역까지 내려가지 않도록 safe-area만큼 더 띄운다.
        paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
        backgroundColor: "var(--adaptiveBackground)",
        borderTop: "1px solid var(--adaptiveGrey200)",
      }}
    >
      {items.map((item) => {
        const active = currentPath === item.path;
        return (
          <button
            key={item.path}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={item.label}
            onClick={() => {
              if (active) return;
              try {
                Promise.resolve(generateHapticFeedback({ type: "tickWeak" })).catch(() => {});
              } catch {
                /* WebView 밖에서는 throw — 무시 */
              }
              navigate(item.path);
            }}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              padding: "4px 0",
              minHeight: 44,
              border: "none",
              background: "none",
              cursor: "pointer",
              // 활성=브랜드 컬러 틴트, 비활성=중간 회색. 솔리드 배경/알약 없음.
              color: active ? "var(--adaptiveBlue500)" : "var(--adaptiveGrey700)",
              fontSize: 11,
              fontWeight: active ? 700 : 500,
            }}
          >
            {item.iconName ? (
              <Asset.ContentIcon
                name={item.iconName}
                alt=""
                color={active ? "var(--adaptiveBlue500)" : "var(--adaptiveGrey700)"}
                style={{ width: 22, height: 22 }}
              />
            ) : (
              item.icon
            )}
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
