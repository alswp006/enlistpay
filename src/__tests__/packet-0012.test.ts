import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss, mockRouter, mockNavigate } from "@/__tests__/__helpers__/mocks";
import type { AppFlags, ServiceProfile } from "@/lib/types";
import { calcRankPeriods, getNextPromotion, isEarlyDischargeBeforeSergeant } from "@/domain/rank";
import { RANK_LABEL } from "@/domain/payTable";
import { formatWon } from "@/domain/date";

mockTds();
mockAppsInToss();
mockRouter();

const DEFAULT_FLAGS: AppFlags = {
  onboardingDone: true,
  rewardUnlockedUntil: 0,
  payTableYear: 2025,
  disclaimerAckAt: 0,
};

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

const EARLY_DISCHARGE_PROFILE: ServiceProfile = {
  ...FULL_TERM_PROFILE,
  serviceMonths: 6,
  dischargeDate: "2026-07-04",
};

let mockProfile: ServiceProfile | null = FULL_TERM_PROFILE;

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

import Rank from "@/pages/Rank";

function renderRank() {
  return render(React.createElement(MemoryRouter, { initialEntries: ["/rank"] }, React.createElement(Rank)));
}

describe("계급·진급 타임라인 화면", () => {
  beforeEach(() => {
    mockProfile = FULL_TERM_PROFILE;
    mockNavigate.mockClear();
  });

  it("AC-1[P0]: calcRankPeriods 각 구간이 ListRow(left=계급명·contents=기간·right=월급)로 렌더된다", () => {
    vi.setSystemTime(new Date("2026-02-01T00:00:00+09:00"));
    const periods = calcRankPeriods(FULL_TERM_PROFILE);
    expect(periods).toHaveLength(4);

    renderRank();

    const rows = screen.getAllByRole("listitem");
    expect(rows.length).toBeGreaterThanOrEqual(4);

    const privateRow = rows.find((r) => r.textContent?.includes(RANK_LABEL.PRIVATE));
    expect(privateRow).toBeTruthy();
    expect(privateRow!.textContent).toMatch(/2026\.01\.05 ~ 2026\.03\.04/);
    expect(privateRow!.textContent).toMatch(new RegExp(formatWon(750000).replace(/[,.]/g, "\\$&")));

    const sergeantRow = rows.find((r) => r.textContent?.includes(RANK_LABEL.SERGEANT));
    expect(sergeantRow).toBeTruthy();
    expect(sergeantRow!.textContent).toMatch(/2027\.03\.05 ~ 2027\.07\.04/);
    expect(sergeantRow!.textContent).toMatch(/1,500,000원/);
  });

  it("AC-2[P0]: 오늘이 속한 구간 행에 aria-current='true'가 부여되고 Chip'지금' 또는 var(--tds-color-*) 강조 배경이 적용된다", () => {
    vi.setSystemTime(new Date("2026-07-01T00:00:00+09:00")); // PFC 구간(2026-03-05~2026-09-04)

    renderRank();

    const rows = screen.getAllByRole("listitem");
    const currentRows = rows.filter((r) => r.getAttribute("aria-current") === "true");
    expect(currentRows).toHaveLength(1);

    const currentRow = currentRows[0];
    expect(currentRow.textContent).toContain(RANK_LABEL.PFC);

    const chip = within(currentRow).queryByText("지금");
    const bg = currentRow.style.backgroundColor;
    expect(Boolean(chip) || bg.length > 0).toBe(true);
    if (bg) {
      expect(bg).toMatch(/^var\(--tds-color-/);
      expect(bg).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    }
  });

  it("AC-3[P0]: 진급 전이면 상단 요약에 'N까지 D-일수 · 날짜'가, 병장 구간이면 '마지막 계급이에요'가 표시된다", () => {
    vi.setSystemTime(new Date("2026-07-01T00:00:00+09:00"));
    const next = getNextPromotion(FULL_TERM_PROFILE, "2026-07-01");
    expect(next).toEqual({ rank: "CORPORAL", date: "2026-09-05", dday: 66 });

    const { unmount } = renderRank();
    expect(screen.getByText(/상병까지 D-66 · 2026년 9월 5일/)).not.toBeNull();
    unmount();

    vi.setSystemTime(new Date("2027-04-01T00:00:00+09:00"));
    expect(getNextPromotion(FULL_TERM_PROFILE, "2027-04-01")).toBeNull();

    renderRank();
    expect(screen.getByText("마지막 계급이에요")).not.toBeNull();
  });

  it("AC-4[P0]: 병장 진급 전 전역 프로필은 안내 문구가 추가되고, 존재하지 않는 계급 행은 렌더되지 않는다", () => {
    mockProfile = EARLY_DISCHARGE_PROFILE;
    vi.setSystemTime(new Date("2026-04-01T00:00:00+09:00"));

    expect(isEarlyDischargeBeforeSergeant(EARLY_DISCHARGE_PROFILE)).toBe(true);
    const periods = calcRankPeriods(EARLY_DISCHARGE_PROFILE);
    expect(periods.map((p) => p.rank)).toEqual(["PRIVATE", "PFC"]);

    renderRank();

    const rows = screen.getAllByRole("listitem");
    expect(rows.some((r) => r.textContent?.includes(RANK_LABEL.CORPORAL))).toBe(false);
    expect(rows.some((r) => r.textContent?.includes(RANK_LABEL.SERGEANT))).toBe(false);

    expect(screen.getByText("복무 기간이 짧아 병장 진급 전에 전역해요")).not.toBeNull();
  });

  it("AC-5[P0]: 화면 하단에 /pay로 이동하는 전체폭 Button과 CalcDisclaimer가 렌더된다", () => {
    vi.setSystemTime(new Date("2026-07-01T00:00:00+09:00"));
    renderRank();

    const buttons = screen.getAllByRole("button");
    let payButton: HTMLElement | null = null;
    for (const btn of buttons) {
      mockNavigate.mockClear();
      fireEvent.click(btn);
      if (mockNavigate.mock.calls.length > 0 && mockNavigate.mock.calls[0][0] === "/pay") {
        payButton = btn;
        break;
      }
    }

    expect(payButton).not.toBeNull();
    expect(payButton!.getAttribute("display")).toBe("block");

    expect(screen.getByText(/실제 지급액은 부대·개인 사정에 따라 다를 수 있어요/)).not.toBeNull();
  });
});
