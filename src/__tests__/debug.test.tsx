import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss, mockNavigate } from "@/__tests__/__helpers__/mocks";
import type { AppFlags, ServiceProfile } from "@/lib/types";

mockTds();
mockAppsInToss();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const FULL_TERM_PROFILE: ServiceProfile = {
  schemaVersion: 1, branch: "ARMY", enlistDate: "2026-01-05", serviceMonths: 18,
  dischargeDate: "2027-07-04", nickname: "", createdAt: 0, updatedAt: 0,
};
const ONBOARDED_FLAGS: AppFlags = { onboardingDone: true, rewardUnlockedUntil: 0, payTableYear: 2025, disclaimerAckAt: 0 };

let mockProfile: ServiceProfile | null = FULL_TERM_PROFILE;
let mockFlags: AppFlags = { ...ONBOARDED_FLAGS };

vi.mock("@/app/useAppData", () => ({
  useAppData: () => ({
    profile: mockProfile, vacations: [], flags: mockFlags, ready: true,
    saveProfile: vi.fn(), addVacation: vi.fn(), removeVacation: vi.fn(), updateFlags: vi.fn(), resetAll: vi.fn(),
  }),
}));
vi.mock("@/app/AppDataProvider", () => ({ AppDataProvider: ({ children }: any) => children }));

import App from "@/App";

const SAVINGS_RESULT_STATE = {
  input: { monthlyDeposit: 400000, months: 18, annualRatePercent: 5, useGovMatch: true },
  result: { principal: 7200000, interest: 300000, govMatch: 1440000, total: 8940000 },
};

describe("debug", () => {
  it("debug savings result", () => {
    mockProfile = FULL_TERM_PROFILE;
    mockFlags = ONBOARDED_FLAGS;
    render(React.createElement(MemoryRouter, { initialEntries: [{ pathname: "/savings/result", state: SAVINGS_RESULT_STATE }] }, React.createElement(App)));
    console.log(document.body.innerHTML.slice(0, 2000));
    console.log("tablist:", screen.queryByRole("tablist"));
  });
});
