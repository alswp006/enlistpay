import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import fs from "node:fs";
import path from "node:path";
import { mockTds, mockAppsInToss, mockNavigate } from "@/__tests__/__helpers__/mocks";
import type { AppFlags, ServiceProfile } from "@/lib/types";

mockTds();
mockAppsInToss();

// react-router-dom: keep the real useLocation (FloatingTabBar/RouteGuard depend on it
// reflecting the actual MemoryRouter path) — only stub useNavigate for assertions.
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const FULL_TERM_PROFILE: ServiceProfile = {
  schemaVersion: 1,
  branch: "ARMY",
  enlistDate: "2026-01-05",
  serviceMonths: 18,
  dischargeDate: "2027-07-04",
  nickname: "",
  createdAt: 0,
  updatedAt: 0,
};

const ONBOARDED_FLAGS: AppFlags = {
  onboardingDone: true,
  rewardUnlockedUntil: 0,
  payTableYear: 2025,
  disclaimerAckAt: 0,
};

const NOT_ONBOARDED_FLAGS: AppFlags = {
  onboardingDone: false,
  rewardUnlockedUntil: 0,
  payTableYear: 2025,
  disclaimerAckAt: 0,
};

let mockProfile: ServiceProfile | null = FULL_TERM_PROFILE;
let mockFlags: AppFlags = { ...ONBOARDED_FLAGS };

vi.mock("@/app/useAppData", () => ({
  useAppData: () => ({
    profile: mockProfile,
    vacations: [],
    flags: mockFlags,
    ready: true,
    saveProfile: vi.fn(),
    addVacation: vi.fn(),
    removeVacation: vi.fn(),
    updateFlags: vi.fn(),
    resetAll: vi.fn(),
  }),
}));

// App.tsx renders the real AppDataProvider — replace with a synchronous passthrough
// so tests don't depend on its async localStorage-load microtask / Skeleton phase.
vi.mock("@/app/AppDataProvider", () => ({
  AppDataProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import App from "@/App";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function renderAppAt(path: string) {
  return render(React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(App)));
}

describe("라우터 배선 + 전역 Provider + 탭바 + NotFound", () => {
  beforeEach(() => {
    mockProfile = FULL_TERM_PROFILE;
    mockFlags = { ...ONBOARDED_FLAGS };
    mockNavigate.mockClear();
  });

  it("AC-1[P0]: 8개 라우트 모두 진입 시 흰 화면 없이 콘텐츠가 렌더된다", () => {
    const cases: Array<{ path: string; profile: ServiceProfile | null; flags: AppFlags }> = [
      { path: "/", profile: FULL_TERM_PROFILE, flags: ONBOARDED_FLAGS },
      { path: "/rank", profile: FULL_TERM_PROFILE, flags: ONBOARDED_FLAGS },
      { path: "/pay", profile: FULL_TERM_PROFILE, flags: ONBOARDED_FLAGS },
      { path: "/vacation", profile: FULL_TERM_PROFILE, flags: ONBOARDED_FLAGS },
      { path: "/savings", profile: FULL_TERM_PROFILE, flags: ONBOARDED_FLAGS },
      { path: "/savings/result", profile: FULL_TERM_PROFILE, flags: ONBOARDED_FLAGS },
      { path: "/settings", profile: FULL_TERM_PROFILE, flags: ONBOARDED_FLAGS },
      { path: "/onboarding", profile: null, flags: NOT_ONBOARDED_FLAGS },
    ];

    for (const { path: routePath, profile, flags } of cases) {
      mockProfile = profile;
      mockFlags = flags;
      const { container, unmount } = renderAppAt(routePath);
      expect(container.textContent, `route ${routePath} should not be blank`).not.toBe("");
      expect(container.textContent!.trim().length, `route ${routePath} should render content`).toBeGreaterThan(0);
      unmount();
    }
  });

  it("AC-1[P0]: 홈(/)은 'EnlistPay' 타이틀을, 온보딩은 '입대 정보 입력' 타이틀을 렌더한다", () => {
    mockProfile = FULL_TERM_PROFILE;
    mockFlags = ONBOARDED_FLAGS;
    const home = renderAppAt("/");
    expect(screen.getByText("EnlistPay")).not.toBeNull();
    home.unmount();

    mockProfile = null;
    mockFlags = NOT_ONBOARDED_FLAGS;
    renderAppAt("/onboarding");
    expect(screen.getByText("입대 정보 입력")).not.toBeNull();
  });

  it("AC-2[P0]: 프로필이 없으면 보호 라우트(/) 진입 시 온보딩 화면으로 리다이렉트된다", () => {
    mockProfile = null;
    mockFlags = NOT_ONBOARDED_FLAGS;
    renderAppAt("/");

    expect(screen.getByText("입대 정보 입력")).not.toBeNull();
    expect(screen.queryByText("EnlistPay")).toBeNull();
  });

  it("AC-2[P0]: 온보딩 완료 상태로 /onboarding 진입 시 홈으로 리다이렉트된다", () => {
    mockProfile = FULL_TERM_PROFILE;
    mockFlags = ONBOARDED_FLAGS;
    renderAppAt("/onboarding");

    expect(screen.getByText("EnlistPay")).not.toBeNull();
    expect(screen.queryByText("입대 정보 입력")).toBeNull();
  });

  it("AC-3: FloatingTabBar는 홈/계급/휴가/적금 4탭이며 현재 경로 탭만 활성 틴트가 적용된다", () => {
    mockProfile = FULL_TERM_PROFILE;
    mockFlags = ONBOARDED_FLAGS;

    const home = renderAppAt("/");
    const homeTabs = screen.getAllByRole("tab");
    expect(homeTabs.map((t) => t.getAttribute("aria-label"))).toEqual(["홈", "계급", "휴가", "적금"]);
    const homeTab = homeTabs.find((t) => t.getAttribute("aria-label") === "홈")!;
    const rankTabOnHome = homeTabs.find((t) => t.getAttribute("aria-label") === "계급")!;
    expect(homeTab.getAttribute("aria-selected")).toBe("true");
    expect(rankTabOnHome.getAttribute("aria-selected")).toBe("false");
    home.unmount();

    const rank = renderAppAt("/rank");
    const rankTabs = screen.getAllByRole("tab");
    const rankTab = rankTabs.find((t) => t.getAttribute("aria-label") === "계급")!;
    const homeTabOnRank = rankTabs.find((t) => t.getAttribute("aria-label") === "홈")!;
    expect(rankTab.getAttribute("aria-selected")).toBe("true");
    expect(homeTabOnRank.getAttribute("aria-selected")).toBe("false");
    rank.unmount();
  });

  it("AC-3: /onboarding과 /savings/result에서는 탭바가 렌더되지 않는다", () => {
    mockProfile = null;
    mockFlags = NOT_ONBOARDED_FLAGS;
    const onboarding = renderAppAt("/onboarding");
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    onboarding.unmount();

    mockProfile = FULL_TERM_PROFILE;
    mockFlags = ONBOARDED_FLAGS;
    renderAppAt("/savings/result");
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
  });

  it("AC-4: 탭바는 position:fixed이며 paddingBottom으로 safe-area를 확보해 콘텐츠를 가리지 않는다", () => {
    mockProfile = FULL_TERM_PROFILE;
    mockFlags = ONBOARDED_FLAGS;
    renderAppAt("/");

    const tabbar = screen.getByRole("tablist");
    expect(tabbar.style.position).toBe("fixed");
    expect(tabbar.style.paddingBottom).toBe("calc(12px + env(safe-area-inset-bottom))");
  });

  it("AC-5[P0]: 정의되지 않은 경로(/foo)는 NotFound 화면을 렌더하고 '홈으로 가기' 클릭 시 '/'로 이동한다", () => {
    mockProfile = FULL_TERM_PROFILE;
    mockFlags = ONBOARDED_FLAGS;
    renderAppAt("/foo");

    expect(screen.getByText("없는 화면이에요")).not.toBeNull();
    expect(document.querySelector("[data-content-icon]")).not.toBeNull();

    const homeButton = screen.getByRole("button", { name: "홈으로 가기" });
    homeButton.click();
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("AC-5[P0]: ErrorBoundary는 하위 렌더 에러를 잡아 재시도 버튼이 있는 폴백 UI를 보여준다", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    function Boom(): React.ReactElement {
      throw new Error("test render crash");
    }

    render(
      React.createElement(
        ErrorBoundary,
        null,
        React.createElement(Boom),
      ),
    );

    expect(screen.getByRole("button", { name: /재시도/ })).not.toBeNull();
    expect(document.body.textContent!.length).toBeGreaterThan(0);

    consoleErrorSpy.mockRestore();
  });

  it("AC-5: main.tsx는 이 패킷에서 수정되지 않는다 (@AI:ANCHOR 보존)", () => {
    const mainTsxPath = path.resolve(__dirname, "../main.tsx");
    const content = fs.readFileSync(mainTsxPath, "utf-8");

    expect(content.startsWith("// @AI:ANCHOR")).toBe(true);
    expect(content).toContain("TDSMobileAITProvider");
  });
});
