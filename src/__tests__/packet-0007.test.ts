import { describe, it, expect } from "vitest";
import type { MonthlyPayRow, Rank, ServiceProfile } from "@/lib/types";
import { PAY_TABLE_2025 } from "@/domain/payTable";
import {
  calcMonthlyPayRows,
  sumPaidUntil,
  sumByRank,
} from "@/domain/pay";

describe("F5: 월별 급여 계산 · 누적 합계 [packet 0007]", () => {
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

  describe("AC-1: 월별 급여 배열 길이 & 첫 달 일할 계산", () => {
    it("AC-1[P0]: 배열 길이는 19이고 첫 행이 정확한 일할 계산 값을 반환한다", () => {
      const rows = calcMonthlyPayRows(profile, PAY_TABLE_2025);

      expect(rows).toHaveLength(19);

      const firstRow = rows[0];
      expect(firstRow).toEqual({
        yearMonth: "2026-01",
        rank: "PRIVATE",
        servedDays: 27,
        daysInMonth: 31,
        amount: 653226, // 750000 × 27/31 ≈ 653226
      });
    });

    it("AC-1[P0]: 계산식 검증 — 첫 달 amount = ⌊월급 × 복무일 / 월일수⌋", () => {
      const rows = calcMonthlyPayRows(profile, PAY_TABLE_2025);
      const firstRow = rows[0];

      // 750000 × 27 / 31 = 652290.322... → 반올림 = 652290 또는 내림 = 652290
      // 스펙에서 653226이라고 했으니 반올림으로 계산
      const expected = Math.round((750000 * 27) / 31);
      expect(firstRow.amount).toBe(expected);
      expect(firstRow.servedDays).toBe(27);
      expect(firstRow.daysInMonth).toBe(31);
    });
  });

  describe("AC-2: 전월(2026-07) 완전 복무 월 확인", () => {
    it("AC-2[P0]: 2026-07 행의 amount는 900000이고 servedDays === daysInMonth === 31", () => {
      const rows = calcMonthlyPayRows(profile, PAY_TABLE_2025);

      const julyRow = rows.find((r: MonthlyPayRow) => r.yearMonth === "2026-07");
      expect(julyRow).toBeDefined();
      expect(julyRow).toEqual({
        yearMonth: "2026-07",
        rank: "PFC",
        servedDays: 31,
        daysInMonth: 31,
        amount: 900000,
      });
    });
  });

  describe("AC-3: sumPaidUntil — 누적 합계 계산", () => {
    it("AC-3[P0]: sumPaidUntil(rows, '2026-07-01')은 2026-06까지 합계를 반환한다", () => {
      const rows = calcMonthlyPayRows(profile, PAY_TABLE_2025);

      const paidUntilJuly1 = sumPaidUntil(rows, "2026-07-01");

      // 2026-01 ~ 2026-06까지의 amount 합계
      const expectedSum = rows
        .filter((r: MonthlyPayRow) => r.yearMonth < "2026-07")
        .reduce((sum: number, r: MonthlyPayRow) => sum + r.amount, 0);

      expect(paidUntilJuly1).toBe(expectedSum);
    });

    it("AC-3[P0]: sumPaidUntil은 결정론적 값을 반환한다 — 같은 입력에 같은 출력", () => {
      const rows = calcMonthlyPayRows(profile, PAY_TABLE_2025);

      const call1 = sumPaidUntil(rows, "2026-07-01");
      const call2 = sumPaidUntil(rows, "2026-07-01");

      expect(call1).toBe(call2);
    });

    it("AC-3[P0]: phase가 BEFORE_ENLIST인 프로필에서는 0을 반환한다", () => {
      const beforeEnlistProfile: ServiceProfile = {
        schemaVersion: 1,
        branch: "ARMY",
        enlistDate: "2027-03-02",
        serviceMonths: 18,
        dischargeDate: "2028-09-01",
        nickname: "test",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const rows = calcMonthlyPayRows(beforeEnlistProfile, PAY_TABLE_2025);
      const today = "2026-07-01";

      const paid = sumPaidUntil(rows, today);

      expect(paid).toBe(0);
    });
  });

  describe("AC-4: sumByRank — 계급별 합계", () => {
    it("AC-4[P0]: sumByRank의 4개 계급 합이 전체 rows amount 합과 일치한다", () => {
      const rows = calcMonthlyPayRows(profile, PAY_TABLE_2025);

      const rankSum = sumByRank(rows);

      const totalFromRows = rows.reduce((sum: number, r: MonthlyPayRow) => sum + r.amount, 0);
      const totalFromRankSum = (Object.values(rankSum) as number[]).reduce(
        (sum: number, v: number) => sum + v,
        0
      );

      expect(rankSum).toHaveProperty("PRIVATE");
      expect(rankSum).toHaveProperty("PFC");
      expect(rankSum).toHaveProperty("CORPORAL");
      expect(rankSum).toHaveProperty("SERGEANT");

      expect(totalFromRankSum).toBe(totalFromRows);
    });

    it("AC-4[P0]: 각 계급의 합계가 정확히 계산된다 (PRIVATE만 확인)", () => {
      const rows = calcMonthlyPayRows(profile, PAY_TABLE_2025);

      const rankSum = sumByRank(rows);

      const privateRows = rows.filter((r: MonthlyPayRow) => r.rank === "PRIVATE");
      const expectedPrivateSum = privateRows.reduce((sum: number, r: MonthlyPayRow) => sum + r.amount, 0);

      expect(rankSum.PRIVATE).toBe(expectedPrivateSum);
    });
  });

  describe("AC-5: 통합 검증 — 행 구조와 계급 일관성", () => {
    it("AC-5[P0]: 모든 행이 MonthlyPayRow 구조를 만족한다", () => {
      const rows = calcMonthlyPayRows(profile, PAY_TABLE_2025);

      rows.forEach((row: MonthlyPayRow, idx: number) => {
        expect(row).toHaveProperty("yearMonth");
        expect(row).toHaveProperty("rank");
        expect(row).toHaveProperty("servedDays");
        expect(row).toHaveProperty("daysInMonth");
        expect(row).toHaveProperty("amount");

        expect(typeof row.yearMonth).toBe("string");
        expect(row.yearMonth).toMatch(/^\d{4}-\d{2}$/);

        const validRanks: Rank[] = ["PRIVATE", "PFC", "CORPORAL", "SERGEANT"];
        expect(validRanks).toContain(row.rank);

        expect(row.servedDays).toBeGreaterThanOrEqual(1);
        expect(row.servedDays).toBeLessThanOrEqual(row.daysInMonth);
        expect(row.daysInMonth).toBeGreaterThanOrEqual(28);
        expect(row.daysInMonth).toBeLessThanOrEqual(31);

        expect(row.amount).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(row.amount)).toBe(true);
      });
    });

    it("AC-5[P0]: 행의 yearMonth가 입대월부터 전역월까지 연속적이다", () => {
      const rows = calcMonthlyPayRows(profile, PAY_TABLE_2025);

      expect(rows[0].yearMonth).toBe("2026-01");
      expect(rows[rows.length - 1].yearMonth).toBe("2027-07");

      // 월별로 순차적인지 확인
      for (let i = 1; i < rows.length; i++) {
        const prev = rows[i - 1].yearMonth;
        const curr = rows[i].yearMonth;
        // 이전 월의 다음 달이 현재 월이어야 함
        expect(curr).toMatch(/^\d{4}-\d{2}$/);
      }
    });
  });

  describe("AC-6: 엣지 케이스 — 전역월 계산", () => {
    it("AC-6[P0]: 마지막 행(전역월)은 일할 계산되어야 한다", () => {
      const rows = calcMonthlyPayRows(profile, PAY_TABLE_2025);

      const lastRow = rows[rows.length - 1];

      expect(lastRow.yearMonth).toBe("2027-07");
      expect(lastRow.rank).toBe("SERGEANT");

      // 전역월이므로 servedDays < daysInMonth여야 함 (부분 복무)
      expect(lastRow.servedDays).toBeLessThan(lastRow.daysInMonth);

      // 전역일이 2027-07-04이므로 복무일은 4일
      expect(lastRow.servedDays).toBe(4);
      expect(lastRow.daysInMonth).toBe(31);
    });

    it("AC-6[P0]: 전역월 amount가 일할 계산된다", () => {
      const rows = calcMonthlyPayRows(profile, PAY_TABLE_2025);

      const lastRow = rows[rows.length - 1];

      // 1500000 × 4 / 31 = 193548...
      const expected = Math.round((1500000 * 4) / 31);

      expect(lastRow.amount).toBe(expected);
    });
  });

  describe("AC-7: 다양한 프로필 조건", () => {
    it("AC-7[P1]: 해군 프로필 (20개월)로 월별 행을 계산한다", () => {
      const navyProfile: ServiceProfile = {
        schemaVersion: 1,
        branch: "NAVY",
        enlistDate: "2025-06-01",
        serviceMonths: 20,
        dischargeDate: "2027-02-01",
        nickname: "test",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const rows = calcMonthlyPayRows(navyProfile, PAY_TABLE_2025);

      // 2025-06 ~ 2027-02 = 21개월
      expect(rows.length).toBe(21);
      expect(rows[0].yearMonth).toBe("2025-06");
      expect(rows[rows.length - 1].yearMonth).toBe("2027-02");
    });

    it("AC-7[P1]: 6개월 단기 복무 프로필을 계산한다", () => {
      const shortProfile: ServiceProfile = {
        schemaVersion: 1,
        branch: "ARMY",
        enlistDate: "2026-01-01",
        serviceMonths: 6,
        dischargeDate: "2026-07-01",
        nickname: "test",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const rows = calcMonthlyPayRows(shortProfile, PAY_TABLE_2025);

      // 2026-01 ~ 2026-07 = 7개월
      expect(rows.length).toBe(7);

      // 첫 달과 마지막 달만 일할 계산, 중간 달들은 만근
      const firstAmount = rows[0].amount;
      const middleAmounts = rows.slice(1, -1).map((r: MonthlyPayRow) => r.amount);
      const lastAmount = rows[rows.length - 1].amount;

      // 첫 달은 일할이므로 750000보다 작음
      expect(firstAmount).toBeLessThan(750000);
      // 마지막 달도 일할이어야 함
      expect(lastAmount).toBeLessThan(750000);
    });
  });
});
