import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss, mockRouter, mockNavigate } from "@/__tests__/__helpers__/mocks";
import type { AppFlags, ServiceProfile } from "@/lib/types";
import { calcServiceStatus, calcDaysUntilEnlist } from "@/domain/dday";

mockTds();
mockAppsInToss();
mockRouter();

const DEFAULT_FLAGS: AppFlags = {
  onboardingDone: true,
  rewardUnlockedUntil: 0,
  payTableYear: 2025,
  disclaimerAckAt: 0,
};

const PROFILE: ServiceProfile = {
  schemaVersion: 1,
  branch: "ARMY",
  enlistDate: "2026-01-05",
  serviceMonths: 18,
  dischargeDate: "2027-07-04",
  nickname: "",
  createdAt: 0,
  updatedAt: 0,
};

let mockProfile: ServiceProfile | null = PROFILE;

vi.mock("@/app/useAppData", () => ({
  useAppData: () => ({
    profile: mockProfile,
    vacations: [],
    flags: DEFAULT_FLAGS,
    ready: true,
    saveProfile: vi.fn(),
    addVacation: vi.fn(),
    removeVacation: vi.fn(),
    updateFlags: vi.fn(),
    resetAll: vi.fn(),
  }),
}));

import Home from "@/pages/Home";

function renderHome() {
  return render(React.createElement(MemoryRouter, { initialEntries: ["/"] }, React.createElement(Home)));
}

describe("홈 — D-day 히어로 · 요약 카드 4종 · 배너", () => {
  beforeEach(() => {
    mockProfile = PROFILE;
  });

  it("AC-1: IN_SERVICE 상태에서 dday-hero에 '전역까지' · calcServiceStatus 기반 D-값 · 전역일 캡션이 표시된다", () => {
    vi.setSystemTime(new Date("2026-07-01T00:00:00+09:00"));

    const status = calcServiceStatus(PROFILE, "2026-07-01");
    expect(status.phase).toBe("IN_SERVICE");
    expect(status.remainingDays).toBe(368);

    renderHome();

    const hero = screen.getByTestId("dday-hero");
    expect(hero.textContent).toMatch(/전역까지/);
    expect(hero.textContent).toMatch(new RegExp(`D-${status.remainingDays}`));
    expect(hero.textContent).toMatch(/전역일 2027년 7월 4일 \(일\)/);
  });

  it("AC-2: BEFORE_ENLIST면 '입대까지' + calcDaysUntilEnlist 기반 D-값, DISCHARGED면 '전역했어요' + 진행률 100%가 표시된다", () => {
    vi.setSystemTime(new Date("2025-12-01T00:00:00+09:00"));
    const daysUntil = calcDaysUntilEnlist(PROFILE, "2025-12-01");
    expect(daysUntil).toBe(35);

    const { unmount } = renderHome();
    const beforeHero = screen.getByTestId("dday-hero");
    expect(beforeHero.textContent).toMatch(/입대까지/);
    expect(beforeHero.textContent).toMatch(new RegExp(`D-${daysUntil}`));
    unmount();

    vi.setSystemTime(new Date("2027-08-01T00:00:00+09:00"));
    const status = calcServiceStatus(PROFILE, "2027-08-01");
    expect(status.phase).toBe("DISCHARGED");
    expect(status.progressPercent).toBe(100);

    renderHome();
    const afterHero = screen.getByTestId("dday-hero");
    expect(afterHero.textContent).toMatch(/전역했어요/);
    expect(afterHero.textContent).toMatch(/100%/);
    expect(afterHero.textContent).not.toMatch(/D-\d/);
  });

  it("AC-3: 요약 카드 4개가 2열 grid로 렌더되고, 탭 시 순서대로 /rank·/rank·/pay·/vacation으로 navigate하며 카드 높이는 88px 이상이다", () => {
    vi.setSystemTime(new Date("2026-07-01T00:00:00+09:00"));
    renderHome();

    const cards = screen.getAllByTestId("summary-card");
    expect(cards).toHaveLength(4);
    expect(cards.map((c) => c.textContent)).toEqual([
      expect.stringMatching(/복무 진행률/),
      expect.stringMatching(/현재 계급/),
      expect.stringMatching(/이번 달 급여/),
      expect.stringMatching(/잔여 휴가/),
    ]);

    for (const card of cards) {
      const minHeight = parseFloat(card.style.minHeight || getComputedStyle(card).minHeight || "0");
      expect(minHeight).toBeGreaterThanOrEqual(88);
    }

    cards.forEach((card) => fireEvent.click(card));
    expect(mockNavigate.mock.calls.map((c) => c[0])).toEqual(["/rank", "/rank", "/pay", "/vacation"]);
  });

  it("AC-4: progress-bar가 role='progressbar' aria-valuenow=progressPercent를 가지며 내부 바 width가 progressPercent와 같다", () => {
    vi.setSystemTime(new Date("2026-07-01T00:00:00+09:00"));
    const status = calcServiceStatus(PROFILE, "2026-07-01");

    renderHome();

    const bar = screen.getByTestId("progress-bar");
    expect(bar.getAttribute("role")).toBe("progressbar");
    expect(Number(bar.getAttribute("aria-valuenow"))).toBeCloseTo(status.progressPercent, 0);

    const fill = bar.firstElementChild as HTMLElement;
    const width = parseFloat(fill.style.width);
    expect(width).toBeCloseTo(status.progressPercent, 0);
  });

  it("AC-5: 카드 그리드 아래 Spacing(24) 후 AdSlot(env adGroupId)과 CalcDisclaimer가 렌더되고, 배너는 sticky가 아니며 FloatingTabBar와 별개다", () => {
    vi.stubEnv("VITE_TOSS_AD_GROUP_ID", "test-ad-group");
    vi.setSystemTime(new Date("2026-07-01T00:00:00+09:00"));
    renderHome();

    const adSlot = document.querySelector(".ad-slot") as HTMLElement;
    expect(adSlot).not.toBeNull();
    expect(adSlot.getAttribute("data-ad-group-id")).toBe("test-ad-group");
    expect(getComputedStyle(adSlot).position).not.toBe("fixed");
    expect(getComputedStyle(adSlot).position).not.toBe("sticky");

    expect(screen.getByText(/실제 지급액은 부대·개인 사정에 따라 다를 수 있어요/)).not.toBeNull();

    const tabBar = screen.queryByRole("tablist", { name: "메인 네비게이션" });
    if (tabBar) {
      expect(tabBar.contains(adSlot)).toBe(false);
    }

    vi.unstubAllEnvs();
  });
});
