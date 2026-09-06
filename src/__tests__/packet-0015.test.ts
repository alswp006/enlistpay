import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss, mockRouter, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { addDays } from "@/domain/date";
import { calcSavings, validateSavingsInput } from "@/domain/savings";
import { loadSavingsInput } from "@/storage/savingsInput";
import type { ServiceProfile, SavingsInput } from "@/lib/types";

mockTds();
mockAppsInToss();
mockRouter();

const SAVINGS_INPUT_KEY = "enlistpay:savings-input";
const TODAY = "2026-06-01";

// 잔여 복무 600일(~20개월) — 18개월 상한 캡을 명확히 검증하기 위한 프로필
const LONG_REMAIN_PROFILE: ServiceProfile = {
  schemaVersion: 1,
  branch: "AIR_FORCE",
  enlistDate: "2026-01-05",
  serviceMonths: 21,
  dischargeDate: addDays(TODAY, 600),
  nickname: "",
  createdAt: 0,
  updatedAt: 0,
};

// 잔여 복무 60일(정확히 2개월) — 상한에 걸리지 않는 실제 잔여값 반영을 검증
const SHORT_REMAIN_PROFILE: ServiceProfile = {
  ...LONG_REMAIN_PROFILE,
  dischargeDate: addDays(TODAY, 60),
};

let mockProfile: ServiceProfile | null = LONG_REMAIN_PROFILE;

vi.mock("@/app/useAppData", () => ({
  useAppData: () => ({
    profile: mockProfile,
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

import Savings from "@/pages/Savings";

function renderSavings() {
  return render(React.createElement(MemoryRouter, { initialEntries: ["/savings"] }, React.createElement(Savings)));
}

function getDepositInput() {
  return screen.getByPlaceholderText("예: 400,000원") as HTMLInputElement;
}
function getMonthsInput() {
  return screen.getByPlaceholderText("예: 18") as HTMLInputElement;
}
function getRateInput() {
  return screen.getByPlaceholderText("예: 5.0") as HTMLInputElement;
}
function getCalcButton() {
  return screen.getByRole("button", { name: "계산하기" });
}

describe("적금 시뮬레이션 입력 화면", () => {
  beforeEach(() => {
    mockProfile = LONG_REMAIN_PROFILE;
    mockNavigate.mockClear();
    vi.mocked(generateHapticFeedback).mockClear();
    vi.setSystemTime(new Date(`${TODAY}T03:00:00Z`)); // KST 정오
  });

  it("AC-1[P0]: 저장값이 없으면 기본값(월 40만원 · min(잔여,18)개월 · 연 5.0% · 매칭 on)으로 프리필된다", () => {
    renderSavings();

    expect(Number(getDepositInput().value)).toBe(400000);
    expect(Number(getMonthsInput().value)).toBe(18); // 잔여 ~20개월 → 18개월 상한 캡
    expect(Number(getRateInput().value)).toBe(5);
    expect(screen.getByRole("switch")).toHaveProperty("checked", true);
  });

  it("AC-1[P0]: 잔여 복무가 18개월 미만이면 그 값 그대로 프리필된다(상한에 걸리지 않음)", () => {
    mockProfile = SHORT_REMAIN_PROFILE;
    renderSavings();

    expect(Number(getMonthsInput().value)).toBe(2); // 잔여 정확히 60일 = 2개월
  });

  it("AC-1[P0]: localStorage에 저장된 이전 입력값이 있으면 기본값 대신 그 값으로 복원된다", () => {
    const saved: SavingsInput = { monthlyDeposit: 300000, months: 10, annualRatePercent: 3.5, useGovMatch: false };
    localStorage.setItem(SAVINGS_INPUT_KEY, JSON.stringify(saved));

    renderSavings();

    expect(Number(getDepositInput().value)).toBe(300000);
    expect(Number(getMonthsInput().value)).toBe(10);
    expect(Number(getRateInput().value)).toBe(3.5);
    expect(screen.getByRole("switch")).toHaveProperty("checked", false);
  });

  it("AC-2[P0]: 월 납입액은 10,000원 단위로 반영되며 0원·상한 초과 시 인라인 에러와 계산하기 비활성화가 뜬다", () => {
    renderSavings();
    const depositInput = getDepositInput();

    // 10,000원 단위 반영 — 437,000 → 440,000으로 스냅
    fireEvent.change(depositInput, { target: { value: "437000" } });
    expect(Number(depositInput.value)).toBe(440000);

    // 0원 → 에러 + 비활성
    fireEvent.change(depositInput, { target: { value: "0" } });
    expect(screen.getByText("월 납입액을 입력해주세요")).not.toBeNull();
    expect(getCalcButton().hasAttribute("disabled")).toBe(true);

    // 상한(550,000원) 초과 → 에러 + 비활성
    fireEvent.change(depositInput, { target: { value: "560000" } });
    expect(screen.getByText("월 납입액은 550,000원 이하로 입력해주세요")).not.toBeNull();
    expect(getCalcButton().hasAttribute("disabled")).toBe(true);
  });

  it("AC-3[P0]: 금리가 0.1 미만이거나 20.0 초과이면 인라인 에러가 뜬다", () => {
    renderSavings();
    const rateInput = getRateInput();

    fireEvent.change(rateInput, { target: { value: "0.05" } });
    expect(screen.getByText("금리는 0.1% ~ 20.0% 사이로 입력해주세요")).not.toBeNull();
    expect(getCalcButton().hasAttribute("disabled")).toBe(true);

    fireEvent.change(rateInput, { target: { value: "20.1" } });
    expect(screen.getByText("금리는 0.1% ~ 20.0% 사이로 입력해주세요")).not.toBeNull();
    expect(getCalcButton().hasAttribute("disabled")).toBe(true);
  });

  it("AC-4: 정부 매칭 Switch를 끄면 안내 문구가 바뀌고 tickWeak 햅틱이 호출된다", () => {
    renderSavings();
    const govSwitch = screen.getByRole("switch") as HTMLInputElement;
    expect(govSwitch.checked).toBe(true);

    fireEvent.click(govSwitch);

    expect(screen.getByText("매칭지원금 없이 계산해요")).not.toBeNull();
    expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "tickWeak" });
  });

  it("AC-5[P0]: '계산하기' 탭 시 유효한 입력이면 saveSavingsInput 후 RouteState 계약대로 navigate된다", () => {
    renderSavings();

    fireEvent.click(getCalcButton());

    const expectedInput: SavingsInput = {
      monthlyDeposit: 400000,
      months: 18,
      annualRatePercent: 5,
      useGovMatch: true,
    };
    const expectedResult = calcSavings(expectedInput);
    expect(validateSavingsInput(expectedInput)).toBeNull();

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/savings/result", {
      state: { input: expectedInput, result: expectedResult },
    });

    // saveSavingsInput이 실제로 localStorage에 반영됐는지 확인
    expect(loadSavingsInput()).toEqual(expectedInput);
  });

  it("AC-5: 검증 실패 상태에서는 '계산하기'를 눌러도 navigate가 호출되지 않는다", () => {
    renderSavings();
    fireEvent.change(getDepositInput(), { target: { value: "0" } });

    fireEvent.click(getCalcButton());

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
