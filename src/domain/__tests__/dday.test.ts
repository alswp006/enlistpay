import { describe, it, expect, vi } from "vitest";
import { calcDischargeDate, calcServiceStatus, calcDaysUntilEnlist, calculateDday } from "@/domain/dday";
import type { ServiceProfile } from "@/lib/types";
import type { User } from "@/lib/contract";

describe("dday — 복무 현황 계산 (전역일 · D-day · 진행률)", () => {
  // AC-1: calcDischargeDate with standard 18-month service
  it("AC-1[P0]: calcDischargeDate calculates discharge date for 18 months", () => {
    const result = calcDischargeDate({ enlistDate: "2026-01-05", serviceMonths: 18 });
    expect(result).toBe("2027-07-04");
    expect(typeof result).toBe("string");
  });

  // AC-1: calcDischargeDate handles month-end day overflow
  it("AC-1[P0]: calcDischargeDate handles month-end dates (1 month, Jan 31 → Feb 27)", () => {
    const result = calcDischargeDate({ enlistDate: "2026-01-31", serviceMonths: 1 });
    expect(result).toBe("2026-02-27");
  });

  // AC-2: calcServiceStatus during active service (IN_SERVICE phase)
  it("AC-2[P0]: calcServiceStatus returns IN_SERVICE status with correct metrics", () => {
    const profile: ServiceProfile = {
      schemaVersion: 1,
      branch: "ARMY",
      enlistDate: "2026-01-05",
      serviceMonths: 18,
      dischargeDate: "2027-07-04",
      nickname: "test",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const result = calcServiceStatus(profile, "2026-07-01");

    // Check all expected fields
    expect(result.enlistDate).toBe("2026-01-05");
    expect(result.dischargeDate).toBe("2027-07-04");
    expect(result.totalDays).toBe(546);
    expect(result.elapsedDays).toBe(178);
    expect(result.remainingDays).toBe(368);
    expect(result.progressPercent).toBeCloseTo(32.6, 1); // 178 / 546 * 100 ≈ 32.6
    expect(result.phase).toBe("IN_SERVICE");
  });

  // AC-3: calcServiceStatus before enlistment (BEFORE_ENLIST phase)
  it("AC-3[P0]: calcServiceStatus returns BEFORE_ENLIST status before service begins", () => {
    const profile: ServiceProfile = {
      schemaVersion: 1,
      branch: "ARMY",
      enlistDate: "2026-01-05",
      serviceMonths: 18,
      dischargeDate: "2027-07-04",
      nickname: "test",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const result = calcServiceStatus(profile, "2025-12-25");

    expect(result.phase).toBe("BEFORE_ENLIST");
    expect(result.elapsedDays).toBe(0);
    expect(result.progressPercent).toBe(0);
    expect(result.remainingDays).toBe(556);
  });

  // AC-3: calcServiceStatus after discharge (DISCHARGED phase)
  it("AC-3[P0]: calcServiceStatus returns DISCHARGED status after service ends", () => {
    const profile: ServiceProfile = {
      schemaVersion: 1,
      branch: "ARMY",
      enlistDate: "2026-01-05",
      serviceMonths: 18,
      dischargeDate: "2027-07-04",
      nickname: "test",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const result = calcServiceStatus(profile, "2027-08-01");

    expect(result.phase).toBe("DISCHARGED");
    expect(result.elapsedDays).toBe(546);
    expect(result.remainingDays).toBe(0);
    expect(result.progressPercent).toBe(100);
  });

  // AC-4: calcDaysUntilEnlist returns positive value before enlistment
  it("AC-4[P0]: calcDaysUntilEnlist returns days remaining before enlistment", () => {
    const profile: ServiceProfile = {
      schemaVersion: 1,
      branch: "ARMY",
      enlistDate: "2026-01-05",
      serviceMonths: 18,
      dischargeDate: "2027-07-04",
      nickname: "test",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const result = calcDaysUntilEnlist(profile, "2025-12-25");

    expect(result).toBeGreaterThan(0);
    expect(result).toBe(11); // Dec 25 to Jan 5 = 11 days
  });

  // AC-4: calcDaysUntilEnlist returns 0 after enlistment
  it("AC-4[P0]: calcDaysUntilEnlist returns 0 after enlistment date", () => {
    const profile: ServiceProfile = {
      schemaVersion: 1,
      branch: "ARMY",
      enlistDate: "2026-01-05",
      serviceMonths: 18,
      dischargeDate: "2027-07-04",
      nickname: "test",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const result = calcDaysUntilEnlist(profile, "2026-07-01");

    expect(result).toBe(0);
  });

  // AC-4: calcDaysUntilEnlist returns 0 after discharge
  it("AC-4[P1]: calcDaysUntilEnlist returns 0 after discharge date", () => {
    const profile: ServiceProfile = {
      schemaVersion: 1,
      branch: "ARMY",
      enlistDate: "2026-01-05",
      serviceMonths: 18,
      dischargeDate: "2027-07-04",
      nickname: "test",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const result = calcDaysUntilEnlist(profile, "2027-08-01");

    expect(result).toBe(0);
  });

  // Edge case: on enlistment date itself
  it("Edge: calcServiceStatus on enlistment date starts counting", () => {
    const profile: ServiceProfile = {
      schemaVersion: 1,
      branch: "ARMY",
      enlistDate: "2026-01-05",
      serviceMonths: 18,
      dischargeDate: "2027-07-04",
      nickname: "test",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const result = calcServiceStatus(profile, "2026-01-05");

    expect(result.phase).toBe("IN_SERVICE");
    expect(result.elapsedDays).toBe(1); // first day counts as elapsed
    expect(result.remainingDays).toBe(545);
    expect(result.progressPercent).toBeCloseTo(0.18, 1); // 1 / 546 ≈ 0.18%
  });

  // Edge case: on discharge date (should still be IN_SERVICE, last day)
  it("Edge: calcServiceStatus on discharge date shows completion", () => {
    const profile: ServiceProfile = {
      schemaVersion: 1,
      branch: "ARMY",
      enlistDate: "2026-01-05",
      serviceMonths: 18,
      dischargeDate: "2027-07-04",
      nickname: "test",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const result = calcServiceStatus(profile, "2027-07-04");

    expect(result.phase).toBe("IN_SERVICE");
    expect(result.elapsedDays).toBe(546);
    expect(result.remainingDays).toBe(0);
    expect(result.progressPercent).toBe(100);
  });

  // calculateDday: contract-mandated adapter (src/lib/contract.ts: calculateDdayFn)
  it("calculateDday derives discharge date and progress from User (default service length)", () => {
    vi.setSystemTime(new Date("2026-07-01T00:00:00+09:00"));
    const user: User = { id: "u1", militaryBranch: "ARMY", enlistmentDate: "2026-01-05" };

    const result = calculateDday(user);

    expect(result.dischargeDate).toBe("2027-07-04");
    expect(result.daysServed).toBe(178);
    expect(result.daysRemaining).toBe(368);
    expect(result.progressPercent).toBeCloseTo(32.6, 1);
  });

  it("calculateDday uses an explicit dischargeDate when provided instead of the branch default", () => {
    vi.setSystemTime(new Date("2026-07-01T00:00:00+09:00"));
    const user: User = {
      id: "u1",
      militaryBranch: "NAVY",
      enlistmentDate: "2026-01-05",
      dischargeDate: "2026-12-31",
    };

    const result = calculateDday(user);

    expect(result.dischargeDate).toBe("2026-12-31");
  });
});
