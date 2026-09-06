import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { screen } from "@testing-library/react";
import { mockAll, mockLocation } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";

mockAll();

vi.mock("@apps-in-toss/web-framework", () => ({
  generateHapticFeedback: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/app/useAppData", () => ({
  useAppData: () => ({
    profile: {
      branch: "ARMY",
      enlistDate: "2026-01-05",
      serviceMonths: 18,
      dischargeDate: "2027-07-05",
      updatedAt: 0,
    },
    vacations: [],
    flags: { onboardingDone: true, rewardUnlockedUntil: 0, payTableYear: 2025, disclaimerAckAt: 0 },
    ready: true,
    saveProfile: vi.fn(),
    addVacation: vi.fn(),
    removeVacation: vi.fn(),
    updateFlags: vi.fn(),
    resetAll: vi.fn(),
  }),
}));

import SavingsResult from "@/pages/SavingsResult";
import Settings from "@/pages/Settings";

const SRC_ROOT = path.resolve(__dirname, "..");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf-8");
}

describe("라우터 배선 복구 — 미구현 페이지 플레이스홀더로 tsc·빌드 통과", () => {
  it("AC-3[P0]: SavingsResult 소스는 RouteState 캐스팅 패턴을 그대로 쓰고 구조분해를 직접 하지 않는다", () => {
    const src = readSource("pages/SavingsResult.tsx");
    expect(src).toContain(
      `const state = (useLocation().state as RouteState["/savings/result"]) ?? null;`,
    );
    // useLocation() 결과를 바로 구조분해하는 패턴( const { state } = useLocation() )은 금지
    expect(src).not.toMatch(/const\s*\{\s*state\s*\}\s*=\s*useLocation\(\)/);
  });

  // mockAll()이 useLocation을 정적 mockLocation 객체로 가로챈다(MemoryRouter의
  // initialEntries state는 무시됨) — state가 있는 케이스는 mockLocation.state를 직접 세팅한다.
  // (memory: mocks-helper-hijacks-uselocation)
  afterEach(() => {
    mockLocation.state = null;
  });

  it("AC-3[P0]: state가 있으면 SavingsResult가 결과 값을 화면에 렌더한다", () => {
    (mockLocation as { state: unknown }).state = {
      input: { monthlyDeposit: 100000, months: 18, annualRatePercent: 5, useGovMatch: true },
      result: { principal: 1800000, interest: 90000, govMatch: 400000, total: 2290000 },
    };
    renderWithRouter(React.createElement(SavingsResult));
    expect(screen.getByText("계산 결과")).not.toBeNull();
    expect(screen.getByText(/월 100,000원/)).not.toBeNull();
  });

  it("AC-3: state가 null이면 SavingsResult가 크래시 없이 /savings로 리다이렉트한다(NotFound 미노출)", () => {
    mockLocation.state = null;
    renderWithRouter(React.createElement(SavingsResult));
    // Navigate가 렌더되면 이 컴포넌트 자체 콘텐츠("계산 결과")는 나타나지 않는다
    expect(screen.queryByText("계산 결과")).toBeNull();
  });

  it("AC-4[P0]: Settings와 SavingsResult 모두 default export 함수 컴포넌트이며 크래시 없이 렌더된다", () => {
    expect(typeof SavingsResult).toBe("function");
    expect(typeof Settings).toBe("function");

    renderWithRouter(React.createElement(Settings));
    expect(screen.getByText("설정")).not.toBeNull();
  });

  it("AC-4: App.tsx가 SavingsResult·Settings를 정확한 상대 경로에서 default import 한다", () => {
    const appSrc = readSource("App.tsx");
    expect(appSrc).toMatch(/import\s+SavingsResult\s+from\s+['"]\.\/pages\/SavingsResult['"]/);
    expect(appSrc).toMatch(/import\s+Settings\s+from\s+['"]\.\/pages\/Settings['"]/);
    expect(appSrc).toContain('<Route path="/savings/result" element={<SavingsResult />} />');
  });

  it("AC-5: SavingsResult.tsx와 Settings.tsx에 HEX 색상 리터럴·외부 이탈 API가 없다", () => {
    const files = ["pages/SavingsResult.tsx", "pages/Settings.tsx"];
    for (const file of files) {
      const src = readSource(file);
      expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(src).not.toContain("window.open");
      expect(src).not.toContain("window.location.href");
    }
  });

  it("AC-1/AC-2: 두 페이지 모두 react-router-dom과 @toss/tds-mobile만 라우팅/디자인 시스템으로 사용한다(다른 라우터 import 없음)", () => {
    const files = ["pages/SavingsResult.tsx", "pages/Settings.tsx"];
    for (const file of files) {
      const src = readSource(file);
      expect(src).not.toContain("next/router");
      expect(src).toContain("react-router-dom");
    }
  });
});
