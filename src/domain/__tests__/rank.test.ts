import { describe, it, expect, vi } from "vitest";
import { calcRankPeriods, getRankAt, getNextPromotion, isEarlyDischargeBeforeSergeant, calculateNextRank } from "@/domain/rank";
import type { ServiceProfile } from "@/lib/types";
import type { User } from "@/lib/contract";

const fullTermProfile: ServiceProfile = {
  schemaVersion: 1,
  branch: "ARMY",
  enlistDate: "2026-01-05",
  serviceMonths: 18,
  dischargeDate: "2027-07-04",
  nickname: "test",
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe("rank — 계급 구간 · 진급 계산", () => {
  // AC-3: full rank timeline for standard 18-month service
  it("AC-3[P0]: calcRankPeriods splits the timeline into PRIVATE→PFC→CORPORAL→SERGEANT", () => {
    const result = calcRankPeriods(fullTermProfile);

    expect(result).toEqual([
      { rank: "PRIVATE", startDate: "2026-01-05", endDate: "2026-03-04", monthlyPay: 750000 },
      { rank: "PFC", startDate: "2026-03-05", endDate: "2026-09-04", monthlyPay: 900000 },
      { rank: "CORPORAL", startDate: "2026-09-05", endDate: "2027-03-04", monthlyPay: 1200000 },
      { rank: "SERGEANT", startDate: "2027-03-05", endDate: "2027-07-04", monthlyPay: 1500000 },
    ]);
  });

  it("AC-3[P0]: getRankAt returns the rank in effect on a given date", () => {
    expect(getRankAt(fullTermProfile, "2026-07-01")).toBe("PFC");
  });

  it("AC-3[P0]: getNextPromotion returns the next rank, date, and D-day", () => {
    expect(getNextPromotion(fullTermProfile, "2026-07-01")).toEqual({
      rank: "CORPORAL",
      date: "2026-09-05",
      dday: 66,
    });
  });

  it("getNextPromotion returns null once SERGEANT (final rank) is reached", () => {
    expect(getNextPromotion(fullTermProfile, "2027-04-01")).toBeNull();
  });

  // AC-4: early discharge before reaching SERGEANT
  it("AC-4[P0]: isEarlyDischargeBeforeSergeant is true when service ends before SERGEANT", () => {
    const earlyProfile: ServiceProfile = {
      ...fullTermProfile,
      serviceMonths: 6,
      dischargeDate: "2026-07-04",
    };
    expect(isEarlyDischargeBeforeSergeant(earlyProfile)).toBe(true);
  });

  it("isEarlyDischargeBeforeSergeant is false for a full 18-month term", () => {
    expect(isEarlyDischargeBeforeSergeant(fullTermProfile)).toBe(false);
  });

  // calculateNextRank: contract-mandated adapter (src/lib/contract.ts: calculateNextRankFn)
  it("calculateNextRank derives the next promotion (계급 라벨 + D-day) from User", () => {
    vi.setSystemTime(new Date("2026-07-01T00:00:00+09:00"));
    const user: User = { id: "u1", militaryBranch: "ARMY", enlistmentDate: "2026-01-05" };

    const result = calculateNextRank(user);

    expect(result.rank).toBe("상병");
    expect(result.promotionDate).toBe("2026-09-05");
    expect(result.daysUntilPromotion).toBe(66);
  });

  it("calculateNextRank returns the current (final) rank with no promotion fields once SERGEANT is reached", () => {
    vi.setSystemTime(new Date("2027-04-01T00:00:00+09:00"));
    const user: User = { id: "u1", militaryBranch: "ARMY", enlistmentDate: "2026-01-05" };

    const result = calculateNextRank(user);

    expect(result.rank).toBe("병장");
    expect(result.promotionDate).toBeUndefined();
    expect(result.daysUntilPromotion).toBeUndefined();
  });

  it("calculateNextRank uses an explicit dischargeDate when provided instead of the branch default", () => {
    vi.setSystemTime(new Date("2026-07-01T00:00:00+09:00"));
    const user: User = {
      id: "u1",
      militaryBranch: "NAVY",
      enlistmentDate: "2026-01-05",
      dischargeDate: "2026-12-31",
    };

    const result = calculateNextRank(user);

    expect(result.rank).toBe("상병");
  });
});
