import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import fs from "node:fs";
import path from "node:path";
import { mockTds, mockAppsInToss, mockRouter, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { saveProfile as persistProfile } from "@/storage/profile";
import { calcDischargeDate } from "@/domain/dday";
import { formatKoreanDate } from "@/domain/date";
import { BRANCH_LABEL } from "@/domain/payTable";
import type { ServiceProfile } from "@/lib/types";

mockTds();
mockAppsInToss();
mockRouter();

const PROFILE_KEY = "enlistpay:profile";
const VACATIONS_KEY = "enlistpay:vacations";
const FLAGS_KEY = "enlistpay:flags";
const SAVINGS_INPUT_KEY = "enlistpay:savings-input";

const INITIAL_PROFILE: ServiceProfile = {
  schemaVersion: 1,
  branch: "ARMY",
  enlistDate: "2026-01-05",
  serviceMonths: 18,
  dischargeDate: calcDischargeDate({ enlistDate: "2026-01-05", serviceMonths: 18 }),
  nickname: "",
  createdAt: 1,
  updatedAt: 1,
};

let mockProfile: ServiceProfile | null = INITIAL_PROFILE;
const saveProfileImpl = vi.fn((next: ServiceProfile) => {
  persistProfile(next);
  mockProfile = next;
});
const resetAllImpl = vi.fn(() => {
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(VACATIONS_KEY);
  localStorage.removeItem(FLAGS_KEY);
  localStorage.removeItem(SAVINGS_INPUT_KEY);
  mockProfile = null;
});

// useAppData가 실제 훅처럼 리렌더를 트리거해야 "수정 즉시 화면에 반영"을 같은 렌더 세션
// 안에서 검증할 수 있다(packet-0014와 동일한 패턴). vi.mock factory는 호이스팅되므로
// 최상단 import 대신 동적 import로 React를 가져온다.
vi.mock("@/app/useAppData", async () => {
  const React = await import("react");
  return {
    useAppData: () => {
      const [, bump] = React.useState(0);
      return {
        profile: mockProfile,
        vacations: [],
        flags: { onboardingDone: true, rewardUnlockedUntil: 0, payTableYear: 2025, disclaimerAckAt: 0 },
        ready: true,
        saveProfile: (next: ServiceProfile) => {
          saveProfileImpl(next);
          bump((n: number) => n + 1);
        },
        addVacation: vi.fn(),
        removeVacation: vi.fn(),
        updateFlags: vi.fn(),
        resetAll: () => {
          resetAllImpl();
          bump((n: number) => n + 1);
        },
      };
    },
  };
});

import Settings from "@/pages/Settings";

function renderSettings() {
  return render(React.createElement(MemoryRouter, { initialEntries: ["/settings"] }, React.createElement(Settings)));
}

function readStoredProfile(): ServiceProfile | null {
  const raw = localStorage.getItem(PROFILE_KEY);
  return raw ? JSON.parse(raw) : null;
}

describe("[부가] 설정 화면 — 입대 정보 수정 · 데이터 초기화 · 정책 고지", () => {
  beforeEach(() => {
    localStorage.clear();
    mockProfile = { ...INITIAL_PROFILE };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(INITIAL_PROFILE));
    localStorage.setItem(VACATIONS_KEY, JSON.stringify([]));
    localStorage.setItem(FLAGS_KEY, JSON.stringify({ onboardingDone: true, rewardUnlockedUntil: 0, payTableYear: 2025, disclaimerAckAt: 0 }));
    localStorage.setItem(SAVINGS_INPUT_KEY, JSON.stringify({ monthlyDeposit: 400000, months: 12, annualRatePercent: 5, useGovMatch: true }));
    saveProfileImpl.mockClear();
    resetAllImpl.mockClear();
    mockNavigate.mockClear();
  });

  it("AC-1: 현재 프로필이 카드 안 ListRow 3행(군별/입대일/예상 전역일)으로 표시된다", () => {
    renderSettings();

    const card = screen.getByTestId("profile-summary-card");
    const rows = within(card).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(card.textContent).toContain(BRANCH_LABEL.ARMY);
    expect(card.textContent).toContain(formatKoreanDate(INITIAL_PROFILE.enlistDate));
    expect(card.textContent).toContain(formatKoreanDate(INITIAL_PROFILE.dischargeDate));
  });

  it("AC-1: 입대일 수정 시 dischargeDate가 즉시 재계산돼 화면과 localStorage에 함께 반영된다", () => {
    renderSettings();

    const enlistInput = screen.getByPlaceholderText("2026-01-05") as HTMLInputElement;
    fireEvent.change(enlistInput, { target: { value: "2026-03-01" } });

    const expectedDischarge = calcDischargeDate({ enlistDate: "2026-03-01", serviceMonths: 18 });

    expect(screen.getByText(formatKoreanDate(expectedDischarge))).not.toBeNull();
    expect(saveProfileImpl).toHaveBeenCalled();
    const stored = readStoredProfile();
    expect(stored?.enlistDate).toBe("2026-03-01");
    expect(stored?.dischargeDate).toBe(expectedDischarge);
  });

  it("AC-1: 복무 개월 수정 시 dischargeDate가 즉시 재계산돼 화면과 localStorage에 함께 반영된다", () => {
    renderSettings();

    const monthsInput = screen.getByPlaceholderText("예: 18") as HTMLInputElement;
    fireEvent.change(monthsInput, { target: { value: "21" } });

    const expectedDischarge = calcDischargeDate({ enlistDate: INITIAL_PROFILE.enlistDate, serviceMonths: 21 });

    expect(screen.getByText(formatKoreanDate(expectedDischarge))).not.toBeNull();
    const stored = readStoredProfile();
    expect(stored?.serviceMonths).toBe(21);
    expect(stored?.dischargeDate).toBe(expectedDischarge);
  });

  it("AC-2: 복무 개월이 12 미만이면 인라인 에러가 뜨고 저장되지 않으며, 유효값 입력 시 에러가 사라지고 저장된다", () => {
    renderSettings();
    saveProfileImpl.mockClear();

    const monthsInput = screen.getByPlaceholderText("예: 18") as HTMLInputElement;
    fireEvent.change(monthsInput, { target: { value: "11" } });

    expect(screen.getByRole("alert").textContent).toBe("복무 기간은 12~24개월 사이로 입력해주세요");
    expect(saveProfileImpl).not.toHaveBeenCalled();
    expect(readStoredProfile()?.serviceMonths).toBe(18);

    fireEvent.change(monthsInput, { target: { value: "25" } });
    expect(screen.getByRole("alert").textContent).toBe("복무 기간은 12~24개월 사이로 입력해주세요");
    expect(saveProfileImpl).not.toHaveBeenCalled();

    fireEvent.change(monthsInput, { target: { value: "20" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(saveProfileImpl).toHaveBeenCalled();
    expect(readStoredProfile()?.serviceMonths).toBe(20);
  });

  it("AC-3: '데이터 초기화' 탭 시 AlertDialog가 열리고, '닫기'로는 아무것도 지워지지 않는다", () => {
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "데이터 초기화" }));

    const dialog = screen.getByRole("alertdialog");
    expect(dialog.getAttribute("aria-label")).toBe("모든 기록을 지울까요?");
    expect(within(dialog).getByText("닫기")).not.toBeNull();
    expect(within(dialog).getByRole("button", { name: "초기화" })).not.toBeNull();

    fireEvent.click(within(dialog).getByRole("button", { name: "닫기" }));

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(resetAllImpl).not.toHaveBeenCalled();
    expect(localStorage.getItem(PROFILE_KEY)).not.toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("AC-3: 초기화 확인 시 enlistpay:* 키 4개가 모두 제거되고 navigate('/onboarding', { replace: true })가 실행된다", () => {
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "데이터 초기화" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "초기화" }));

    expect(localStorage.getItem(PROFILE_KEY)).toBeNull();
    expect(localStorage.getItem(VACATIONS_KEY)).toBeNull();
    expect(localStorage.getItem(FLAGS_KEY)).toBeNull();
    expect(localStorage.getItem(SAVINGS_INPUT_KEY)).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("/onboarding", { replace: true });
  });

  it("AC-4: 기기 변경 데이터 이전 불가 안내와 급여표 기준 연도가 표시되고 외부 이동 호출이 소스에 없다", () => {
    renderSettings();

    expect(screen.getByText(/기기를 바꾸면 기록이 옮겨지지 않아요/)).not.toBeNull();
    expect(screen.getByText(/2025년 기준/)).not.toBeNull();

    const anchors = document.querySelectorAll("a[href^='http']");
    expect(anchors.length).toBe(0);

    const source = fs.readFileSync(path.resolve(__dirname, "../pages/Settings.tsx"), "utf-8");
    expect(source).not.toMatch(/window\.open/);
    expect(source).not.toMatch(/window\.location\.href/);
  });

  it("AC-5: 소스에 외부 로그인/결제/광고 SDK import와 grantPromotionReward 호출이 없다", () => {
    const source = fs.readFileSync(path.resolve(__dirname, "../pages/Settings.tsx"), "utf-8");

    expect(source).not.toMatch(/grantPromotionReward/);
    expect(source).not.toMatch(/\bIAP\b/);
    expect(source).not.toMatch(/TossAds/);
    expect(source).not.toMatch(/loadFullScreenAd|showFullScreenAd/);
    expect(source.includes("@ai-factory:placeholder")).toBe(false);
  });
});
