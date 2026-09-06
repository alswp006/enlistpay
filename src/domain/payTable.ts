import type { Branch, PayTable, Rank } from "./types";

export const PAY_TABLE_2025: PayTable = {
  year: 2025,
  monthlyPay: {
    PRIVATE: 750000,
    PFC: 900000,
    CORPORAL: 1200000,
    SERGEANT: 1500000,
  },
  annualLeaveDays: {
    ARMY: 24,
    MARINE: 24,
    NAVY: 27,
    AIR_FORCE: 28,
    SOCIAL: 28,
  },
  defaultServiceMonths: {
    ARMY: 18,
    MARINE: 18,
    NAVY: 20,
    AIR_FORCE: 21,
    SOCIAL: 21,
  },
};

export const BRANCH_LABEL: Record<Branch, string> = {
  ARMY: "육군",
  NAVY: "해군",
  AIR_FORCE: "공군",
  MARINE: "해병대",
  SOCIAL: "사회복무",
};

export const RANK_LABEL: Record<Rank, string> = {
  PRIVATE: "이병",
  PFC: "일병",
  CORPORAL: "상병",
  SERGEANT: "병장",
};
