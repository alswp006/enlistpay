import { describe, it, expect } from "vitest";
import type { ServiceProfile, Rank } from "@/domain/types";
import {
  calcRankPeriods,
  getRankAt,
  getNextPromotion,
  isEarlyDischargeBeforeSergeant,
} from "@/domain/rank";

describe("packet-0006: 계급 구간 · 다음 진급 계산", () => {
  // AC-1: 함수 export 확인
  it("AC-1[P0]: exports calcRankPeriods function", () => {
    expect(typeof calcRankPeriods).toBe("function");
  });

  it("AC-1[P0]: exports getRankAt function", () => {
    expect(typeof getRankAt).toBe("function");
  });

  it("AC-1[P0]: exports getNextPromotion function", () => {
    expect(typeof getNextPromotion).toBe("function");
  });

  it("AC-1[P0]: exports isEarlyDischargeBeforeSergeant function", () => {
    expect(typeof isEarlyDischargeBeforeSergeant).toBe("function");
  });

  // AC-2: calcRankPeriods 반환값 구조 및 값 검증 (18개월 사례)
  describe("AC-2[P0]: calcRankPeriods with 18-month service", () => {
    it("should return array of length 4", () => {
      const profile: ServiceProfile = {
        schemaVersion: 1,
        branch: "ARMY",
        enlistDate: "2026-01-05",
        serviceMonths: 18,
        dischargeDate: "2027-07-04",
        nickname: "test",
        createdAt: 0,
        updatedAt: 0,
      };

      const periods = calcRankPeriods(profile);

      expect(periods).toHaveLength(4);
    });

    it("should have correct PRIVATE period (2 months)", () => {
      const profile: ServiceProfile = {
        schemaVersion: 1,
        branch: "ARMY",
        enlistDate: "2026-01-05",
        serviceMonths: 18,
        dischargeDate: "2027-07-04",
        nickname: "test",
        createdAt: 0,
        updatedAt: 0,
      };

      const periods = calcRankPeriods(profile);

      expect(periods[0].rank).toBe("PRIVATE");
      expect(periods[0].startDate).toBe("2026-01-05");
      expect(periods[0].endDate).toBe("2026-03-04");
      expect(periods[0].monthlyPay).toBe(750000);
    });

    it("should have correct PFC period (6 months)", () => {
      const profile: ServiceProfile = {
        schemaVersion: 1,
        branch: "ARMY",
        enlistDate: "2026-01-05",
        serviceMonths: 18,
        dischargeDate: "2027-07-04",
        nickname: "test",
        createdAt: 0,
        updatedAt: 0,
      };

      const periods = calcRankPeriods(profile);

      expect(periods[1].rank).toBe("PFC");
      expect(periods[1].startDate).toBe("2026-03-05");
      expect(periods[1].endDate).toBe("2026-09-04");
      expect(periods[1].monthlyPay).toBe(900000);
    });

    it("should have correct CORPORAL period (6 months)", () => {
      const profile: ServiceProfile = {
        schemaVersion: 1,
        branch: "ARMY",
        enlistDate: "2026-01-05",
        serviceMonths: 18,
        dischargeDate: "2027-07-04",
        nickname: "test",
        createdAt: 0,
        updatedAt: 0,
      };

      const periods = calcRankPeriods(profile);

      expect(periods[2].rank).toBe("CORPORAL");
      expect(periods[2].startDate).toBe("2026-09-05");
      expect(periods[2].endDate).toBe("2027-03-04");
      expect(periods[2].monthlyPay).toBe(1200000);
    });

    it("should have correct SERGEANT period (remaining months until discharge)", () => {
      const profile: ServiceProfile = {
        schemaVersion: 1,
        branch: "ARMY",
        enlistDate: "2026-01-05",
        serviceMonths: 18,
        dischargeDate: "2027-07-04",
        nickname: "test",
        createdAt: 0,
        updatedAt: 0,
      };

      const periods = calcRankPeriods(profile);

      expect(periods[3].rank).toBe("SERGEANT");
      expect(periods[3].startDate).toBe("2027-03-05");
      expect(periods[3].endDate).toBe("2027-07-04");
      expect(periods[3].monthlyPay).toBe(1500000);
    });

    it("should have last period endDate equal to dischargeDate", () => {
      const profile: ServiceProfile = {
        schemaVersion: 1,
        branch: "ARMY",
        enlistDate: "2026-01-05",
        serviceMonths: 18,
        dischargeDate: "2027-07-04",
        nickname: "test",
        createdAt: 0,
        updatedAt: 0,
      };

      const periods = calcRankPeriods(profile);

      expect(periods[periods.length - 1].endDate).toBe(profile.dischargeDate);
    });
  });

  // AC-3: getRankAt — 특정 날짜의 계급 조회
  describe("AC-3[P0]: getRankAt returns correct rank for given date", () => {
    const profile: ServiceProfile = {
      schemaVersion: 1,
      branch: "ARMY",
      enlistDate: "2026-01-05",
      serviceMonths: 18,
      dischargeDate: "2027-07-04",
      nickname: "test",
      createdAt: 0,
      updatedAt: 0,
    };

    it("should return PFC for date within PFC period (2026-07-01)", () => {
      const rank = getRankAt(profile, "2026-07-01");

      expect(rank).toBe("PFC");
    });

    it("should return PRIVATE for date within PRIVATE period (2026-01-05)", () => {
      const rank = getRankAt(profile, "2026-01-05");

      expect(rank).toBe("PRIVATE");
    });

    it("should return CORPORAL for date within CORPORAL period (2026-10-15)", () => {
      const rank = getRankAt(profile, "2026-10-15");

      expect(rank).toBe("CORPORAL");
    });

    it("should return SERGEANT for date within SERGEANT period (2027-05-01)", () => {
      const rank = getRankAt(profile, "2027-05-01");

      expect(rank).toBe("SERGEANT");
    });

    it("should return null for date before enlistment (2025-12-31)", () => {
      const rank = getRankAt(profile, "2025-12-31");

      expect(rank).toBeNull();
    });

    it("should return null for date after discharge (2027-07-05)", () => {
      const rank = getRankAt(profile, "2027-07-05");

      expect(rank).toBeNull();
    });
  });

  // AC-4: getNextPromotion — 다음 진급 정보 조회
  describe("AC-4[P0]: getNextPromotion returns next promotion or null", () => {
    const profile: ServiceProfile = {
      schemaVersion: 1,
      branch: "ARMY",
      enlistDate: "2026-01-05",
      serviceMonths: 18,
      dischargeDate: "2027-07-04",
      nickname: "test",
      createdAt: 0,
      updatedAt: 0,
    };

    it("should return next promotion (CORPORAL) from PFC period (2026-07-01)", () => {
      const next = getNextPromotion(profile, "2026-07-01");

      expect(next).not.toBeNull();
      expect(next?.rank).toBe("CORPORAL");
      expect(next?.date).toBe("2026-09-05");
      expect(next?.dday).toBe(66);
    });

    it("should return next promotion (PFC) from PRIVATE period (2026-01-05)", () => {
      const next = getNextPromotion(profile, "2026-01-05");

      expect(next).not.toBeNull();
      expect(next?.rank).toBe("PFC");
      expect(next?.date).toBe("2026-03-05");
      expect(next?.dday).toBe(59);
    });

    it("should return next promotion (SERGEANT) from CORPORAL period (2027-01-01)", () => {
      const next = getNextPromotion(profile, "2027-01-01");

      expect(next).not.toBeNull();
      expect(next?.rank).toBe("SERGEANT");
      expect(next?.date).toBe("2027-03-05");
      expect(next?.dday).toBe(63);
    });

    it("should return null during SERGEANT period (no more promotions, 2027-05-01)", () => {
      const next = getNextPromotion(profile, "2027-05-01");

      expect(next).toBeNull();
    });

    it("should return null for date before enlistment (2025-12-31)", () => {
      const next = getNextPromotion(profile, "2025-12-31");

      expect(next).toBeNull();
    });

    it("should return null for date after discharge (2027-07-05)", () => {
      const next = getNextPromotion(profile, "2027-07-05");

      expect(next).toBeNull();
    });
  });

  // AC-5: 조기 전역 시나리오 (상병에 도달 못함)
  describe("AC-5[P0]: early discharge before CORPORAL rank", () => {
    it("should return array length 2 for 6-month service", () => {
      const profile: ServiceProfile = {
        schemaVersion: 1,
        branch: "ARMY",
        enlistDate: "2026-01-05",
        serviceMonths: 6,
        dischargeDate: "2026-07-04",
        nickname: "test",
        createdAt: 0,
        updatedAt: 0,
      };

      const periods = calcRankPeriods(profile);

      expect(periods).toHaveLength(2);
    });

    it("should return PRIVATE and PFC only for 6-month service", () => {
      const profile: ServiceProfile = {
        schemaVersion: 1,
        branch: "ARMY",
        enlistDate: "2026-01-05",
        serviceMonths: 6,
        dischargeDate: "2026-07-04",
        nickname: "test",
        createdAt: 0,
        updatedAt: 0,
      };

      const periods = calcRankPeriods(profile);

      expect(periods[0].rank).toBe("PRIVATE");
      expect(periods[1].rank).toBe("PFC");
    });

    it("should have last endDate as dischargeDate for 6-month service", () => {
      const profile: ServiceProfile = {
        schemaVersion: 1,
        branch: "ARMY",
        enlistDate: "2026-01-05",
        serviceMonths: 6,
        dischargeDate: "2026-07-04",
        nickname: "test",
        createdAt: 0,
        updatedAt: 0,
      };

      const periods = calcRankPeriods(profile);

      expect(periods[1].endDate).toBe("2026-07-04");
    });

    it("should return true for isEarlyDischargeBeforeSergeant with 6-month service", () => {
      const profile: ServiceProfile = {
        schemaVersion: 1,
        branch: "ARMY",
        enlistDate: "2026-01-05",
        serviceMonths: 6,
        dischargeDate: "2026-07-04",
        nickname: "test",
        createdAt: 0,
        updatedAt: 0,
      };

      const result = isEarlyDischargeBeforeSergeant(profile);

      expect(result).toBe(true);
    });

    it("should return false for isEarlyDischargeBeforeSergeant with 18-month service", () => {
      const profile: ServiceProfile = {
        schemaVersion: 1,
        branch: "ARMY",
        enlistDate: "2026-01-05",
        serviceMonths: 18,
        dischargeDate: "2027-07-04",
        nickname: "test",
        createdAt: 0,
        updatedAt: 0,
      };

      const result = isEarlyDischargeBeforeSergeant(profile);

      expect(result).toBe(false);
    });
  });
});
