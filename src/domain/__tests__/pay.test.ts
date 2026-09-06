import { describe, it, expect } from "vitest";
import {
  calcMonthlyPayRows,
  sumPaidUntil,
  sumByRank,
  calculatePaySummary,
} from "@/domain/pay";
import { PAY_TABLE_2025 } from "@/domain/payTable";
import type { ServiceProfile, Rank } from "@/lib/types";
import type { User } from "@/lib/contract";

describe("F5: 월별 급여 계산 · 누적 합계 (packet-0007)", () => {
  const profile: ServiceProfile = {
    schemaVersion: 1,
    branch: "ARMY",
    enlistDate: "2026-01-05",
    serviceMonths: 18,
    dischargeDate: "2027-07-04",
    nickname: "",
    createdAt: 0,
    updatedAt: 0,
  };

  describe("AC-1: Export functions", () => {
    it("should export calcMonthlyPayRows function", () => {
      expect(typeof calcMonthlyPayRows).toBe("function");
    });

    it("should export sumPaidUntil function", () => {
      expect(typeof sumPaidUntil).toBe("function");
    });

    it("should export sumByRank function", () => {
      expect(typeof sumByRank).toBe("function");
    });
  });

  describe("AC-2: 첫 달 일할 계산", () => {
    it("should calculate 19 rows for 18-month service (2026-01 ~ 2027-07)", () => {
      const rows = calcMonthlyPayRows(profile, PAY_TABLE_2025);
      expect(rows).toHaveLength(19);
    });

    it("should calculate first month with partial days and correct amount", () => {
      const rows = calcMonthlyPayRows(profile, PAY_TABLE_2025);
      const firstRow = rows[0];

      expect(firstRow.yearMonth).toBe("2026-01");
      expect(firstRow.rank).toBe("PRIVATE");
      expect(firstRow.servedDays).toBe(27); // 2026-01-05 ~ 2026-01-31
      expect(firstRow.daysInMonth).toBe(31);
      expect(firstRow.amount).toBe(653226); // 750000 × 27/31, rounded
    });

    it("should have correct yearMonth sequence starting from enlist month", () => {
      const rows = calcMonthlyPayRows(profile, PAY_TABLE_2025);

      expect(rows[0].yearMonth).toBe("2026-01");
      expect(rows[1].yearMonth).toBe("2026-02");
      expect(rows[18].yearMonth).toBe("2027-07");
    });
  });

  describe("AC-3: 중간 달 전액 급여", () => {
    it("should calculate full month for July (2026-07) with full-month amount", () => {
      const rows = calcMonthlyPayRows(profile, PAY_TABLE_2025);
      const julyRow = rows.find((r) => r.yearMonth === "2026-07");

      expect(julyRow).toBeDefined();
      expect(julyRow!.amount).toBe(900000); // Full month PFC salary
      expect(julyRow!.servedDays).toBe(31);
      expect(julyRow!.daysInMonth).toBe(31);
      expect(julyRow!.rank).toBe("PFC");
    });

    it("should have full days for non-first and non-last months", () => {
      const rows = calcMonthlyPayRows(profile, PAY_TABLE_2025);

      // Check middle months (not first or last)
      for (let i = 1; i < rows.length - 1; i++) {
        const row = rows[i];
        expect(row.servedDays).toBe(row.daysInMonth);
      }
    });
  });

  describe("AC-4: sumPaidUntil 누적 합계", () => {
    it("should return cumulative sum until specified date (2026-07-01 excludes July)", () => {
      const rows = calcMonthlyPayRows(profile, PAY_TABLE_2025);
      const sum = sumPaidUntil(rows, "2026-07-01");

      // Sum from 2026-01 to 2026-06 (July excluded)
      const expected = rows
        .filter((r) => r.yearMonth < "2026-07")
        .reduce((acc, row) => acc + row.amount, 0);

      expect(sum).toBe(expected);
      expect(sum).toBeGreaterThan(0);
    });

    it("should return 0 for BEFORE_ENLIST phase (date before enlist month)", () => {
      const rows = calcMonthlyPayRows(profile, PAY_TABLE_2025);

      // Date before enlist date (2026-01-05) means no service started
      const sum = sumPaidUntil(rows, "2025-12-31");

      expect(sum).toBe(0);
    });

    it("should return full sum until discharge date", () => {
      const rows = calcMonthlyPayRows(profile, PAY_TABLE_2025);
      const sum = sumPaidUntil(rows, "2027-07-04");

      const totalRows = rows.reduce((acc, row) => acc + row.amount, 0);
      expect(sum).toBe(totalRows);
    });

    it("should handle mid-month dates correctly", () => {
      const rows = calcMonthlyPayRows(profile, PAY_TABLE_2025);

      // Date in the middle of a month should include months before that month
      const sumMid = sumPaidUntil(rows, "2026-05-15");
      const expectedMid = rows
        .filter((r) => r.yearMonth < "2026-05")
        .reduce((acc, row) => acc + row.amount, 0);

      expect(sumMid).toBe(expectedMid);
    });
  });

  describe("AC-5: sumByRank 계급별 합계", () => {
    it("should sum by rank and all ranks total match row total", () => {
      const rows = calcMonthlyPayRows(profile, PAY_TABLE_2025);
      const byRank = sumByRank(rows);

      const totalByRank = (Object.values(byRank) as number[]).reduce(
        (a, b) => a + b,
        0
      );
      const totalRows = rows.reduce((acc, row) => acc + row.amount, 0);

      expect(totalByRank).toBe(totalRows);
    });

    it("should have all four ranks with amounts > 0", () => {
      const rows = calcMonthlyPayRows(profile, PAY_TABLE_2025);
      const byRank = sumByRank(rows);

      const ranks: Rank[] = ["PRIVATE", "PFC", "CORPORAL", "SERGEANT"];
      for (const rank of ranks) {
        expect(byRank[rank]).toBeGreaterThan(0);
      }
    });

    it("should calculate PRIVATE total correctly", () => {
      const rows = calcMonthlyPayRows(profile, PAY_TABLE_2025);
      const byRank = sumByRank(rows);

      const privateRows = rows.filter((r) => r.rank === "PRIVATE");
      const expectedPrivate = privateRows.reduce((acc, row) => acc + row.amount, 0);

      expect(byRank.PRIVATE).toBe(expectedPrivate);
    });

    it("should calculate PFC total correctly", () => {
      const rows = calcMonthlyPayRows(profile, PAY_TABLE_2025);
      const byRank = sumByRank(rows);

      const pfcRows = rows.filter((r) => r.rank === "PFC");
      const expectedPFC = pfcRows.reduce((acc, row) => acc + row.amount, 0);

      expect(byRank.PFC).toBe(expectedPFC);
    });
  });

  describe("Rank transitions", () => {
    it("should reflect rank promotions across months based on 15th of month", () => {
      const rows = calcMonthlyPayRows(profile, PAY_TABLE_2025);

      // PRIVATE: 2026-01 ~ 2026-03
      expect(rows.find((r) => r.yearMonth === "2026-01")?.rank).toBe("PRIVATE");
      expect(rows.find((r) => r.yearMonth === "2026-03")?.rank).toBe("PRIVATE");

      // PFC: 2026-03 (15th onward) ~ 2026-09
      expect(rows.find((r) => r.yearMonth === "2026-03")?.rank).toBe("PRIVATE"); // Before 15th still counts as PRIVATE
      expect(rows.find((r) => r.yearMonth === "2026-04")?.rank).toBe("PFC"); // After March 15th
      expect(rows.find((r) => r.yearMonth === "2026-09")?.rank).toBe("PFC");

      // CORPORAL: 2026-09 (15th onward) ~ 2027-03
      expect(rows.find((r) => r.yearMonth === "2026-10")?.rank).toBe("CORPORAL");

      // SERGEANT: 2027-03 (15th onward) ~ 2027-07
      expect(rows.find((r) => r.yearMonth === "2027-04")?.rank).toBe("SERGEANT");
    });
  });

  describe("Discharge month calculation", () => {
    it("should calculate last month (discharge month) with partial days", () => {
      const rows = calcMonthlyPayRows(profile, PAY_TABLE_2025);
      const lastRow = rows[rows.length - 1];

      expect(lastRow.yearMonth).toBe("2027-07");
      expect(lastRow.servedDays).toBeLessThanOrEqual(31);
      expect(lastRow.daysInMonth).toBe(31);
      // 2027-07-04 (discharge) - 2027-07-01 + 1 = 4 days
      expect(lastRow.servedDays).toBe(4);
    });
  });

  describe("calculatePaySummary (contract-mandated, packet-0007)", () => {
    it("should export calculatePaySummary function", () => {
      expect(typeof calculatePaySummary).toBe("function");
    });

    it("should sum all months for a discharged user (fully in the past)", () => {
      const user: User = {
        id: "u1",
        militaryBranch: "ARMY",
        enlistmentDate: "2024-01-05",
        dischargeDate: "2025-07-04",
      };
      const rows = calcMonthlyPayRows(
        { schemaVersion: 1, branch: "ARMY", enlistDate: "2024-01-05", serviceMonths: 18, dischargeDate: "2025-07-04", nickname: "", createdAt: 0, updatedAt: 0 },
        PAY_TABLE_2025,
      );
      const expectedTotal = rows.reduce((sum, row) => sum + row.amount, 0);

      const summary = calculatePaySummary(user);

      expect(summary.totalKrw).toBe(expectedTotal);
      expect(summary.monthlyBreakdown).toHaveLength(19);
      expect(summary.monthlyBreakdown[0]).toEqual({ month: "2024-01", amountKrw: rows[0].amount });
    });

    it("should return 0 total and empty breakdown before enlistment", () => {
      const user: User = {
        id: "u2",
        militaryBranch: "NAVY",
        enlistmentDate: "2099-01-05",
      };

      const summary = calculatePaySummary(user);

      expect(summary.totalKrw).toBe(0);
      expect(summary.monthlyBreakdown).toEqual([]);
    });

    it("should derive dischargeDate from branch default service months when omitted", () => {
      const user: User = {
        id: "u3",
        militaryBranch: "AIR_FORCE",
        enlistmentDate: "2024-01-05",
      };

      const summary = calculatePaySummary(user);

      expect(summary.totalKrw).toBeGreaterThan(0);
      expect(summary.monthlyBreakdown.length).toBeGreaterThan(0);
    });
  });
});
