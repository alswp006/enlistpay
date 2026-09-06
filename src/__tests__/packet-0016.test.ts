import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { mockTds, mockAppsInToss, mockRouter, mockNavigate, mockLocation } from "@/__tests__/__helpers__/mocks";
import { calcSavings } from "@/domain/savings";
import { saveSavingsInput, loadSavingsInput } from "@/storage/savingsInput";
import type { SavingsInput } from "@/lib/types";

mockTds();
mockAppsInToss();
mockRouter();

import SavingsResult from "@/pages/SavingsResult";

// mocks.ts의 useLocation 스텁은 항상 이 mockLocation 객체를 반환한다(호이스팅된 vi.mock).
// 타입은 `state: null`로 굳어 있으므로(strict mode) 테스트별로 any 캐스팅해 덮어쓴다.
function setLocationState(state: unknown) {
  (mockLocation as unknown as { state: unknown }).state = state;
}

const GOV_MATCH_INPUT: SavingsInput = {
  monthlyDeposit: 400000,
  months: 12,
  annualRatePercent: 5.0,
  useGovMatch: true,
};

const NO_GOV_MATCH_INPUT: SavingsInput = {
  ...GOV_MATCH_INPUT,
  useGovMatch: false,
};

function renderResult(initialPath = "/savings/result") {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [initialPath] },
      React.createElement(
        Routes,
        null,
        React.createElement(Route, { path: "/savings/result", element: React.createElement(SavingsResult) }),
        React.createElement(Route, { path: "/savings", element: React.createElement("div", null, "savings-input-page") }),
      ),
    ),
  );
}

describe("적금 결과 화면 (state null 방어)", () => {
  beforeEach(() => {
    setLocationState(null);
    mockNavigate.mockClear();
    localStorage.clear();
  });

  it("AC-1[P0]: location.state가 null이면 크래시 없이 /savings로 replace 이동한다", () => {
    setLocationState(null);
    renderResult();

    expect(screen.getByText("savings-input-page")).not.toBeNull();
    expect(screen.queryByText("원금")).toBeNull();
  });

  it("AC-1[P0]: state가 있으면 리다이렉트하지 않고 결과 화면 자체가 렌더된다", () => {
    setLocationState({ input: GOV_MATCH_INPUT, result: calcSavings(GOV_MATCH_INPUT) });
    renderResult();

    expect(screen.queryByText("savings-input-page")).toBeNull();
    expect(screen.getByText("9,730,000원")).not.toBeNull();
  });

  it("AC-2: 매칭지원금 포함 입력의 히어로 총액과 원금/이자/매칭지원금이 각각 콤마 3자리로 표시된다", () => {
    setLocationState({ input: GOV_MATCH_INPUT, result: calcSavings(GOV_MATCH_INPUT) });
    renderResult();

    expect(screen.getByText("9,730,000원")).not.toBeNull(); // 총액
    expect(screen.getByText("130,000원")).not.toBeNull(); // 이자
    expect(screen.getAllByText("4,800,000원")).toHaveLength(2); // 원금 + 매칭지원금(동일 금액)
    expect(screen.getByText("원금")).not.toBeNull();
    expect(screen.getByText(/이자/)).not.toBeNull();
    expect(screen.getByText(/정부 매칭지원금/)).not.toBeNull();
  });

  it("AC-3: useGovMatch가 false면 매칭지원금 행이 없고 총액은 4,930,000원이다", () => {
    setLocationState({ input: NO_GOV_MATCH_INPUT, result: calcSavings(NO_GOV_MATCH_INPUT) });
    renderResult();

    expect(screen.getByText("4,930,000원")).not.toBeNull(); // 총액(매칭 제외)
    expect(screen.queryByText(/정부 매칭지원금/)).toBeNull();
    expect(screen.getByText("4,800,000원")).not.toBeNull(); // 원금은 그대로 표시
  });

  it("AC-4[P0]: '조건 바꾸기' 탭 시 navigate('/savings')로 이동하고 저장된 입력은 그대로 남아 있다", () => {
    saveSavingsInput(GOV_MATCH_INPUT);
    setLocationState({ input: GOV_MATCH_INPUT, result: calcSavings(GOV_MATCH_INPUT) });
    renderResult();

    fireEvent.click(screen.getByRole("button", { name: "조건 바꾸기" }));

    expect(mockNavigate).toHaveBeenCalledWith("/savings");
    expect(loadSavingsInput()).toEqual(GOV_MATCH_INPUT);
  });

  it("AC-5: 하단에 AdSlot 배너(Spacing 24 확보, sticky 아님)와 CalcDisclaimer가 배치된다", () => {
    setLocationState({ input: GOV_MATCH_INPUT, result: calcSavings(GOV_MATCH_INPUT) });
    const { container } = renderResult();

    const adSlot = container.querySelector("[data-ad-group-id]");
    expect(adSlot).not.toBeNull();
    expect(adSlot?.previousElementSibling?.getAttribute("data-spacing")).toBe("24");
    expect(adSlot?.getAttribute("style") ?? "").not.toMatch(/position:\s*(fixed|sticky)/);
    expect(screen.getByText(/참고용 계산 결과예요/)).not.toBeNull();
  });
});
