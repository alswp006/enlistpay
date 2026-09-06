import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss, mockRouter, mockNavigate } from "@/__tests__/__helpers__/mocks";
import type { AppFlags, ServiceProfile } from "@/lib/types";
import { calcMonthlyPayRows, sumPaidUntil } from "@/domain/pay";
import { PAY_TABLE_2025, RANK_LABEL } from "@/domain/payTable";
import { formatWon, todayISO } from "@/domain/date";
import { formatNumber } from "@/lib/utils";

mockTds();
mockAppsInToss();
mockRouter();

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

const BEFORE_ENLIST_PROFILE: ServiceProfile = {
  ...FULL_TERM_PROFILE,
  enlistDate: "2099-01-05",
  dischargeDate: "2100-07-04",
};

const DEFAULT_FLAGS: AppFlags = {
  onboardingDone: true,
  rewardUnlockedUntil: 0,
  payTableYear: 2025,
  disclaimerAckAt: 0,
};

const REWARD_DURATION_MS = 24 * 60 * 60 * 1000;

let mockProfile: ServiceProfile | null = FULL_TERM_PROFILE;
let mockFlags: AppFlags = { ...DEFAULT_FLAGS };
const mockUpdateFlags = vi.fn((partial: Partial<AppFlags>) => {
  mockFlags = { ...mockFlags, ...partial };
});

vi.mock("@/app/useAppData", () => ({
  useAppData: () => ({
    profile: mockProfile,
    vacations: [],
    flags: mockFlags,
    ready: true,
    saveProfile: vi.fn(),
    addVacation: vi.fn(),
    removeVacation: vi.fn(),
    updateFlags: mockUpdateFlags,
    resetAll: vi.fn(),
  }),
}));

let capturedAdProps: Record<string, unknown> | null = null;
vi.mock("@/components/TossRewardAd", () => ({
  TossRewardAd: (props: any) => {
    capturedAdProps = props;
    return React.createElement(
      "button",
      { onClick: () => props.onRewarded?.() },
      props.buttonText ?? "광고 보고 상세 내역 확인하기",
    );
  },
}));

import Pay from "@/pages/Pay";

function renderPay() {
  return render(React.createElement(MemoryRouter, { initialEntries: ["/pay"] }, React.createElement(Pay)));
}

describe("누적 급여 화면 — 리워드 광고 게이트 · 월별 내역", () => {
  beforeEach(() => {
    mockProfile = FULL_TERM_PROFILE;
    mockFlags = { ...DEFAULT_FLAGS };
    mockUpdateFlags.mockClear();
    mockNavigate.mockClear();
    capturedAdProps = null;
    vi.setSystemTime(new Date("2026-08-01T00:00:00+09:00"));
  });

  it("AC-1[P0]: 잠금 상태에서는 TossRewardAd 게이트만 노출되고 금액 목록 DOM은 렌더되지 않는다", () => {
    renderPay();

    expect(capturedAdProps).not.toBeNull();
    expect(capturedAdProps && "slotId" in capturedAdProps).toBe(true);
    expect(screen.getByText("광고 보고 상세 내역 확인하기")).not.toBeNull();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.queryByText(formatWon(653226))).toBeNull();
  });

  it("AC-2[P0]: 광고 시청 완료(unlock) 시 flags.rewardUnlockedUntil이 now+24시간으로 저장된다", () => {
    renderPay();
    const watchButton = screen.getByText("광고 보고 상세 내역 확인하기");
    fireEvent.click(watchButton);

    expect(mockUpdateFlags).toHaveBeenCalledTimes(1);
    const saved = mockUpdateFlags.mock.calls[0][0] as Partial<AppFlags>;
    expect(saved.rewardUnlockedUntil).toBe(Date.now() + REWARD_DURATION_MS);
    expect(mockFlags.rewardUnlockedUntil).toBe(Date.now() + REWARD_DURATION_MS);
  });

  it("AC-2[P0]: 24시간 내 재방문(새로고침 시뮬레이션)에서는 게이트 없이 목록이 바로 보인다", () => {
    mockFlags = { ...DEFAULT_FLAGS, rewardUnlockedUntil: Date.now() + 60 * 60 * 1000 };
    renderPay();

    expect(capturedAdProps).toBeNull();
    expect(screen.queryAllByRole("listitem").length).toBeGreaterThan(0);
  });

  it("AC-3: 해제 상태에서 calcMonthlyPayRows 결과가 ListRow 목록으로 렌더된다(1월 653,226원 · 7월 900,000원)", () => {
    mockFlags = { ...DEFAULT_FLAGS, rewardUnlockedUntil: Date.now() + 60 * 60 * 1000 };
    const rows = calcMonthlyPayRows(FULL_TERM_PROFILE, PAY_TABLE_2025);
    expect(rows[0]).toMatchObject({ yearMonth: "2026-01", rank: "PRIVATE", amount: 653226 });
    const julyRow = rows.find((r) => r.yearMonth === "2026-07");
    expect(julyRow).toMatchObject({ rank: "PFC", amount: 900000 });

    renderPay();

    const listItems = screen.getAllByRole("listitem");
    expect(listItems[0].textContent).toMatch(/2026년\s*0?1월/);
    expect(listItems[0].textContent).toContain(RANK_LABEL.PRIVATE);
    expect(listItems[0].textContent).toContain(formatWon(653226));

    const julyItem = listItems.find((el) => /2026년\s*0?7월/.test(el.textContent ?? ""));
    expect(julyItem).toBeTruthy();
    expect(julyItem!.textContent).toContain(formatWon(900000));
  });

  it("AC-4: 히어로에 sumPaidUntil 기반 누적 총액이 콤마 포맷으로 표시되고 19행 전체가 렌더된다", () => {
    mockFlags = { ...DEFAULT_FLAGS, rewardUnlockedUntil: Date.now() + 60 * 60 * 1000 };
    const rows = calcMonthlyPayRows(FULL_TERM_PROFILE, PAY_TABLE_2025);
    expect(rows).toHaveLength(19);
    const total = sumPaidUntil(rows, todayISO());
    expect(total).toBeGreaterThan(0);

    renderPay();

    expect(screen.getByText(new RegExp(`${formatNumber(total)}원`))).not.toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(19);
  });

  it("AC-5: 입대 전 프로필은 빈 상태를 렌더하고 광고 게이트를 노출하지 않으며 CalcDisclaimer가 표시된다", () => {
    mockProfile = BEFORE_ENLIST_PROFILE;
    renderPay();

    expect(capturedAdProps).toBeNull();
    expect(screen.getByText("아직 입대 전이에요")).not.toBeNull();

    const homeButton = screen.getByRole("button", { name: "홈으로" });
    fireEvent.click(homeButton);
    expect(mockNavigate).toHaveBeenCalledWith("/");

    expect(screen.getByText(/실제 지급액은 부대·개인 사정에 따라 다를 수 있어요/)).not.toBeNull();
  });
});
