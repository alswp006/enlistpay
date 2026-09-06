import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss, mockRouter, mockNavigate } from "@/__tests__/__helpers__/mocks";
import type { AppFlags, ServiceProfile, VacationRecord } from "@/lib/types";
import { calcVacationSummary, type BranchVacationTable } from "@/domain/vacation";
import { PAY_TABLE_2025 } from "@/domain/payTable";

mockTds();
mockAppsInToss();
mockRouter();

const VACATION_TABLE: BranchVacationTable = Object.fromEntries(
  Object.entries(PAY_TABLE_2025.annualLeaveDays).map(([branch, days]) => [branch, { baseVacationDays: days }]),
);

const PROFILE: ServiceProfile = {
  schemaVersion: 1,
  branch: "AIR_FORCE",
  enlistDate: "2026-01-05",
  serviceMonths: 21,
  dischargeDate: "2027-10-04",
  nickname: "",
  createdAt: 0,
  updatedAt: 0,
};

const DEFAULT_FLAGS: AppFlags = {
  onboardingDone: true,
  rewardUnlockedUntil: 0,
  payTableYear: 2025,
  disclaimerAckAt: 0,
};

let mockProfile: ServiceProfile | null = PROFILE;
let vacationsStore: VacationRecord[] = [];

const addVacationImpl = vi.fn((record: Omit<VacationRecord, "id" | "createdAt">) => {
  vacationsStore = [
    { ...record, id: `v-${vacationsStore.length + 1}`, createdAt: Date.now() },
    ...vacationsStore,
  ];
});
const removeVacationImpl = vi.fn((id: string) => {
  vacationsStore = vacationsStore.filter((v) => v.id !== id);
});

// useAppData가 실제 훅처럼 React.useState로 리렌더를 트리거해야 "저장 즉시 목록에
// 반영된다"(AC-5)를 같은 렌더 세션 안에서 검증할 수 있다. vi.mock factory는 호이스팅되므로
// 최상단 import 대신 동적 import로 React를 가져온다.
vi.mock("@/app/useAppData", async () => {
  const React = await import("react");
  return {
    useAppData: () => {
      const [, bump] = React.useState(0);
      return {
        profile: mockProfile,
        vacations: vacationsStore,
        flags: DEFAULT_FLAGS,
        ready: true,
        saveProfile: vi.fn(),
        addVacation: (record: any) => {
          addVacationImpl(record);
          bump((n: number) => n + 1);
        },
        removeVacation: (id: string) => {
          removeVacationImpl(id);
          bump((n: number) => n + 1);
        },
        updateFlags: vi.fn(),
        resetAll: vi.fn(),
      };
    },
  };
});

import Vacation from "@/pages/Vacation";

function renderVacation() {
  return render(React.createElement(MemoryRouter, { initialEntries: ["/vacation"] }, React.createElement(Vacation)));
}

function openSheet() {
  fireEvent.click(screen.getByRole("button", { name: "기록 추가" }));
  return screen.getByRole("dialog");
}

describe("휴가 관리 화면 — 잔여 요약 · 기록 추가/삭제", () => {
  beforeEach(() => {
    mockProfile = PROFILE;
    vacationsStore = [];
    addVacationImpl.mockClear();
    removeVacationImpl.mockClear();
    mockNavigate.mockClear();
  });

  it("AC-1[P0]: 요약 카드가 calcVacationSummary 기반 '부여 28일 / 사용 6.5일 / 잔여 21.5일'로 렌더된다", () => {
    vacationsStore = [
      { id: "v0", type: "ANNUAL", direction: "USE", days: 6.5, date: "2026-03-01", memo: "정기휴가", createdAt: 1 },
    ];
    const summary = calcVacationSummary(PROFILE.branch, vacationsStore, VACATION_TABLE);
    expect(summary).toEqual({ granted: 28, used: 6.5, remaining: 21.5 });

    renderVacation();

    const summaryEl = screen.getByTestId("vacation-summary");
    expect(summaryEl.textContent).toContain("부여 28일");
    expect(summaryEl.textContent).toContain("사용 6.5일");
    expect(summaryEl.textContent).toContain("잔여 21.5일");
  });

  it("AC-1[P0]: 잔여가 음수이면 잔여 표시 색이 var(--tds-color-red500)로 바뀐다", () => {
    vacationsStore = [
      { id: "v0", type: "ANNUAL", direction: "USE", days: 30, date: "2026-03-01", memo: "정기휴가", createdAt: 1 },
    ];
    const summary = calcVacationSummary(PROFILE.branch, vacationsStore, VACATION_TABLE);
    expect(summary.remaining).toBe(-2);

    renderVacation();

    const remainingEl = screen.getByTestId("vacation-remaining");
    expect(remainingEl.textContent).toContain("-2일");
    expect(remainingEl.style.color).toBe("var(--tds-color-red500)");
  });

  it("AC-2[P0]: '기록 추가' 탭 시 BottomSheet가 열리고 종류 4종 · 부여/사용 2종 Chip과 입력 필드 3개가 렌더된다", () => {
    renderVacation();
    const dialog = openSheet();

    for (const label of ["정기", "포상", "위로", "청원"]) {
      expect(within(dialog).getByText(label)).not.toBeNull();
    }
    for (const label of ["부여", "사용"]) {
      expect(within(dialog).getByText(label)).not.toBeNull();
    }

    const inputs = dialog.querySelectorAll("input");
    expect(inputs.length).toBeGreaterThanOrEqual(3);
  });

  it("AC-3[P0]: 일수가 0.5 단위·0.5~30 범위를 벗어나면 인라인 에러가 뜨고 저장 버튼이 비활성화된다", () => {
    renderVacation();
    const dialog = openSheet();
    const inputs = dialog.querySelectorAll("input");
    const daysInput = inputs[0];
    const dateInput = inputs[1];

    fireEvent.change(dateInput, { target: { value: "2026-03-01" } });
    fireEvent.change(daysInput, { target: { value: "1.2" } });

    expect(within(dialog).getByText("휴가는 0.5일 단위로 0.5~30일까지 입력할 수 있어요")).not.toBeNull();
    expect(within(dialog).getByRole("button", { name: /저장/ }).hasAttribute("disabled")).toBe(true);

    fireEvent.change(daysInput, { target: { value: "31" } });
    expect(within(dialog).getByText("휴가는 0.5일 단위로 0.5~30일까지 입력할 수 있어요")).not.toBeNull();
    expect(within(dialog).getByRole("button", { name: /저장/ }).hasAttribute("disabled")).toBe(true);

    fireEvent.change(daysInput, { target: { value: "3.5" } });
    expect(within(dialog).queryByText("휴가는 0.5일 단위로 0.5~30일까지 입력할 수 있어요")).toBeNull();
    expect(within(dialog).getByRole("button", { name: /저장/ }).hasAttribute("disabled")).toBe(false);
  });

  it("AC-4[P0]: 날짜가 복무 기간(enlistDate~dischargeDate) 밖이면 에러가 뜨고 저장되지 않는다", () => {
    renderVacation();
    const dialog = openSheet();
    const inputs = dialog.querySelectorAll("input");
    const daysInput = inputs[0];
    const dateInput = inputs[1];

    fireEvent.change(daysInput, { target: { value: "2" } });
    fireEvent.change(dateInput, { target: { value: "2025-12-31" } }); // enlistDate(2026-01-05) 이전

    expect(within(dialog).getByText("복무 기간 안의 날짜로 입력해주세요")).not.toBeNull();
    const saveButton = within(dialog).getByRole("button", { name: /저장/ });
    expect(saveButton.hasAttribute("disabled")).toBe(true);
    fireEvent.click(saveButton);
    expect(addVacationImpl).not.toHaveBeenCalled();

    fireEvent.change(dateInput, { target: { value: "2027-10-05" } }); // dischargeDate(2027-10-04) 이후
    expect(within(dialog).getByText("복무 기간 안의 날짜로 입력해주세요")).not.toBeNull();
    expect(addVacationImpl).not.toHaveBeenCalled();
  });

  it("AC-5[P0]: 저장 성공 시 시트가 닫히고 목록 최상단에 새 기록이 나타나며 요약 잔여값이 재계산된다", () => {
    renderVacation();
    const dialog = openSheet();
    const inputs = dialog.querySelectorAll("input");
    const daysInput = inputs[0];
    const dateInput = inputs[1];
    const memoInput = inputs[2];

    fireEvent.click(within(dialog).getByText("사용"));
    fireEvent.change(daysInput, { target: { value: "3.5" } });
    fireEvent.change(dateInput, { target: { value: "2026-04-10" } });
    fireEvent.change(memoInput, { target: { value: "포상 휴가 사용" } });

    const saveButton = within(dialog).getByRole("button", { name: /저장/ });
    expect(saveButton.hasAttribute("disabled")).toBe(false);
    fireEvent.click(saveButton);

    expect(addVacationImpl).toHaveBeenCalledTimes(1);
    const saved = addVacationImpl.mock.calls[0][0];
    expect(saved).toMatchObject({ direction: "USE", days: 3.5, date: "2026-04-10", memo: "포상 휴가 사용" });

    expect(screen.queryByRole("dialog")).toBeNull();

    const rows = screen.getAllByRole("listitem");
    expect(rows[0].textContent).toContain("포상 휴가 사용");

    const summaryEl = screen.getByTestId("vacation-summary");
    expect(summaryEl.textContent).toContain("잔여 24.5일");
  });

  it("AC-5[P0]: localStorage에 저장된 기록은 다음 렌더(새로고침 시뮬레이션)에도 동일하게 복원된다", () => {
    vacationsStore = [
      { id: "v1", type: "ANNUAL", direction: "USE", days: 4, date: "2026-03-01", memo: "복원 확인용", createdAt: 1 },
    ];

    const { unmount } = renderVacation();
    expect(screen.getByText("복원 확인용")).not.toBeNull();
    unmount();

    renderVacation();
    expect(screen.getByText("복원 확인용")).not.toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("AC-5[P0]: 삭제 액션 탭 시 AlertDialog(닫기/삭제) 확인 후에만 목록에서 제거된다", () => {
    vacationsStore = [
      { id: "v1", type: "ANNUAL", direction: "USE", days: 2, date: "2026-03-01", memo: "삭제대상", createdAt: 1 },
    ];
    renderVacation();

    const row = screen.getByText("삭제대상").closest('[role="listitem"]') as HTMLElement;
    expect(row).not.toBeNull();

    fireEvent.click(within(row).getByRole("button", { name: /삭제/ }));

    const alertDialog = screen.getByRole("alertdialog");
    expect(within(alertDialog).getByText("닫기")).not.toBeNull();
    expect(within(alertDialog).getByRole("button", { name: "삭제" })).not.toBeNull();

    // 취소(닫기) 시에는 제거되지 않는다
    fireEvent.click(within(alertDialog).getByRole("button", { name: "닫기" }));
    expect(removeVacationImpl).not.toHaveBeenCalled();
    expect(screen.getByText("삭제대상")).not.toBeNull();

    // 다시 삭제 흐름을 열고 확정한다
    fireEvent.click(within(row).getByRole("button", { name: /삭제/ }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "삭제" }));

    expect(removeVacationImpl).toHaveBeenCalledWith("v1");
    expect(screen.queryByText("삭제대상")).toBeNull();
  });
});
