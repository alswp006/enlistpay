import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { mockTds, mockAppsInToss, mockRouter, mockNavigate } from "@/__tests__/__helpers__/mocks";
import type { AppFlags } from "@/lib/types";

mockTds();
mockAppsInToss();
mockRouter();

const mockSaveProfile = vi.fn();
const mockUpdateFlags = vi.fn();

const DEFAULT_FLAGS: AppFlags = {
  onboardingDone: false,
  rewardUnlockedUntil: 0,
  payTableYear: 2025,
  disclaimerAckAt: 0,
};

let mockFlags: AppFlags = { ...DEFAULT_FLAGS };

vi.mock("@/app/useAppData", () => ({
  useAppData: () => ({
    profile: null,
    vacations: [],
    flags: mockFlags,
    ready: true,
    saveProfile: mockSaveProfile,
    addVacation: vi.fn(),
    removeVacation: vi.fn(),
    updateFlags: mockUpdateFlags,
    resetAll: vi.fn(),
  }),
}));

import Onboarding from "@/pages/Onboarding";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";

function renderPage() {
  return render(
    React.createElement(MemoryRouter, { initialEntries: ["/onboarding"] }, React.createElement(Onboarding)),
  );
}

const BRANCH_MONTHS: Array<{ label: string; months: number }> = [
  { label: "육군", months: 18 },
  { label: "해군", months: 20 },
  { label: "공군", months: 21 },
  { label: "해병대", months: 18 },
  { label: "사회복무", months: 21 },
];

describe("packet-0010: 온보딩 화면 — 군별 선택 · 입대일 검증 · 전역일 미리보기", () => {
  beforeEach(() => {
    mockFlags = { ...DEFAULT_FLAGS };
  });

  it("AC-1[P0]: 군별 Chip 탭 시 단일 선택 유지 + serviceMonths 자동 세팅 + 미리보기 즉시 갱신 + haptic tickWeak", () => {
    renderPage();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "2026-01-05" } });

    for (const { label, months } of BRANCH_MONTHS) {
      fireEvent.click(screen.getByRole("button", { name: label }));

      const card = screen.getByTestId("discharge-preview-card");
      expect(card.textContent).toMatch(new RegExp(`복무 ${months}개월`));

      const selected = BRANCH_MONTHS.map((b) => screen.getByRole("button", { name: b.label })).filter(
        (btn) => btn.getAttribute("aria-pressed") === "true",
      );
      expect(selected).toHaveLength(1);
      expect(selected[0].textContent).toBe(label);
    }

    expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "tickWeak" });
  });

  it("AC-2[P0]: 입대일 미입력/실존하지 않는 날짜/1990년 이전 날짜는 인라인 에러 + 시작하기 disabled", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "육군" }));
    const dateInput = screen.getByRole("textbox");
    const submitBtn = () => screen.getByRole("button", { name: "시작하기" }) as HTMLButtonElement;

    fireEvent.change(dateInput, { target: { value: "" } });
    expect(screen.getByRole("alert").textContent).toBe("입대일을 입력해주세요");
    expect(submitBtn().disabled).toBe(true);

    fireEvent.change(dateInput, { target: { value: "2026-13-45" } });
    expect(screen.getByRole("alert").textContent).toBe("존재하지 않는 날짜예요");
    expect(submitBtn().disabled).toBe(true);

    fireEvent.change(dateInput, { target: { value: "1989-12-31" } });
    expect(screen.getByRole("alert").textContent).toBe("입대일은 1990년 1월 1일 이후로 입력해주세요");
    expect(submitBtn().disabled).toBe(true);
  });

  it("AC-3: 2026-01-05 입대 + 육군 선택 시 discharge-preview-card에 2027년 7월 4일 · 복무 18개월 표시", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "육군" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "2026-01-05" } });

    const card = screen.getByTestId("discharge-preview-card");
    expect(card.textContent).toMatch(/2027년 7월 4일/);
    expect(card.textContent).toMatch(/복무 18개월/);
  });

  it("AC-4[P0]: 시작하기 탭 시 haptic success → saveProfile + onboardingDone 저장 → Toast → navigate('/', {replace:true})", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "육군" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "2026-01-05" } });

    const submitBtn = screen.getByRole("button", { name: "시작하기" }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBeFalsy();
    fireEvent.click(submitBtn);

    expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "success" });
    expect(mockSaveProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        branch: "ARMY",
        enlistDate: "2026-01-05",
        serviceMonths: 18,
        dischargeDate: "2027-07-04",
      }),
    );
    expect(mockUpdateFlags).toHaveBeenCalledWith(expect.objectContaining({ onboardingDone: true }));

    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/전역일이 계산됐어요/));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true }));
  });

  it("AC-5: flags.onboardingDone===true 상태로 /onboarding 진입 시 폼 렌더 없이 '/'로 replace 이동한다", () => {
    mockFlags = { ...DEFAULT_FLAGS, onboardingDone: true };

    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/onboarding"] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: "/onboarding", element: React.createElement(Onboarding) }),
          React.createElement(Route, { path: "/", element: React.createElement("div", null, "home page") }),
        ),
      ),
    );

    expect(screen.getByText("home page")).not.toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "시작하기" })).toBeNull();
  });
});
