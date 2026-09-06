import { describe, it, expect } from "vitest";
import { PAY_TABLE_2025, BRANCH_LABEL, RANK_LABEL } from "@/domain/payTable";
import {
  parseISO,
  toISO,
  todayISO,
  addMonthsClamped,
  addDays,
  diffDays,
  daysInMonth,
  formatKoreanDate,
  formatWon,
} from "@/domain/date";

describe("AC-1[P0]: PAY_TABLE_2025 salary constants", () => {
  it("AC-1: should export PAY_TABLE_2025.monthlyPay with all ranks", () => {
    expect(PAY_TABLE_2025.monthlyPay).toBeDefined();
    expect(PAY_TABLE_2025.monthlyPay.PRIVATE).toBe(750000);
    expect(PAY_TABLE_2025.monthlyPay.PFC).toBe(900000);
    expect(PAY_TABLE_2025.monthlyPay.CORPORAL).toBe(1200000);
    expect(PAY_TABLE_2025.monthlyPay.SERGEANT).toBe(1500000);
  });

  it("AC-1: should export PAY_TABLE_2025.annualLeaveDays with correct days per branch", () => {
    expect(PAY_TABLE_2025.annualLeaveDays).toBeDefined();
    expect(PAY_TABLE_2025.annualLeaveDays.ARMY).toBe(24);
    expect(PAY_TABLE_2025.annualLeaveDays.MARINE).toBe(24);
    expect(PAY_TABLE_2025.annualLeaveDays.NAVY).toBe(27);
    expect(PAY_TABLE_2025.annualLeaveDays.AIR_FORCE).toBe(28);
    expect(PAY_TABLE_2025.annualLeaveDays.SOCIAL).toBe(28);
  });

  it("AC-1: should export PAY_TABLE_2025.defaultServiceMonths with correct duration per branch", () => {
    expect(PAY_TABLE_2025.defaultServiceMonths).toBeDefined();
    expect(PAY_TABLE_2025.defaultServiceMonths.ARMY).toBe(18);
    expect(PAY_TABLE_2025.defaultServiceMonths.MARINE).toBe(18);
    expect(PAY_TABLE_2025.defaultServiceMonths.NAVY).toBe(20);
    expect(PAY_TABLE_2025.defaultServiceMonths.AIR_FORCE).toBe(21);
    expect(PAY_TABLE_2025.defaultServiceMonths.SOCIAL).toBe(21);
  });

  it("AC-1: should export BRANCH_LABEL with Korean branch names", () => {
    expect(BRANCH_LABEL).toBeDefined();
    expect(BRANCH_LABEL.ARMY).toBe("육군");
    expect(BRANCH_LABEL.MARINE).toBe("해병대");
    expect(BRANCH_LABEL.NAVY).toBe("해군");
    expect(BRANCH_LABEL.AIR_FORCE).toBe("공군");
    expect(BRANCH_LABEL.SOCIAL).toBe("사회복무");
  });

  it("AC-1: should export RANK_LABEL with Korean rank names", () => {
    expect(RANK_LABEL).toBeDefined();
    expect(RANK_LABEL.PRIVATE).toBe("이병");
    expect(RANK_LABEL.PFC).toBe("일병");
    expect(RANK_LABEL.CORPORAL).toBe("상병");
    expect(RANK_LABEL.SERGEANT).toBe("병장");
  });
});

describe("AC-2[P0]: Date utility functions", () => {
  it("AC-2: should export all required date utility functions", () => {
    expect(typeof parseISO).toBe("function");
    expect(typeof toISO).toBe("function");
    expect(typeof todayISO).toBe("function");
    expect(typeof addMonthsClamped).toBe("function");
    expect(typeof addDays).toBe("function");
    expect(typeof diffDays).toBe("function");
    expect(typeof daysInMonth).toBe("function");
    expect(typeof formatKoreanDate).toBe("function");
    expect(typeof formatWon).toBe("function");
  });

  it("AC-2: parseISO should parse valid ISO date string 2026-01-15", () => {
    const result = parseISO("2026-01-15");
    expect(result).not.toBeNull();
    expect(toISO(result!)).toBe("2026-01-15");
  });

  it("AC-2: parseISO should return null for invalid date string with month 13", () => {
    const result = parseISO("2026-13-45");
    expect(result).toBeNull();
  });

  it("AC-2: parseISO should return null for completely invalid format", () => {
    const result = parseISO("abcd-99-99");
    expect(result).toBeNull();
  });

  it("should round-trip: parseISO -> toISO -> parseISO", () => {
    const original = "2026-06-15";
    const parsed1 = parseISO(original);
    expect(parsed1).not.toBeNull();

    const iso = toISO(parsed1!);
    expect(iso).toBe(original);

    const parsed2 = parseISO(iso);
    expect(parsed2).not.toBeNull();
  });
});

describe("AC-3[P0]: Month clamping and day differences", () => {
  it("AC-3: addMonthsClamped should clamp 2026-01-31 + 1 month to 2026-02-28", () => {
    const result = addMonthsClamped("2026-01-31", 1);
    expect(result).toBe("2026-02-28");
    expect(result).not.toBe("2026-03-03");
  });

  it("AC-3: addMonthsClamped should handle leap year 2024-01-31 + 1 month = 2024-02-29", () => {
    const result = addMonthsClamped("2024-01-31", 1);
    expect(result).toBe("2024-02-29");
  });

  it("AC-3: addMonthsClamped should handle non-month-end dates normally", () => {
    const result = addMonthsClamped("2026-01-15", 1);
    expect(result).toBe("2026-02-15");
  });

  it("AC-3: diffDays should return 177 for 2026-01-05 to 2026-07-01", () => {
    const result = diffDays("2026-01-05", "2026-07-01");
    expect(result).toBe(177);
  });

  it("should calculate diffDays correctly for same date", () => {
    const result = diffDays("2026-01-15", "2026-01-15");
    expect(result).toBe(0);
  });

  it("should calculate daysInMonth for various months", () => {
    expect(daysInMonth(2026, 1)).toBe(31);  // January
    expect(daysInMonth(2026, 2)).toBe(28);  // February (non-leap)
    expect(daysInMonth(2024, 2)).toBe(29);  // February (leap year)
    expect(daysInMonth(2026, 4)).toBe(30);  // April
    expect(daysInMonth(2026, 12)).toBe(31); // December
  });
});

describe("AC-4[P0]: Korean date and won formatting", () => {
  it("AC-4: formatKoreanDate should format 2027-07-04 as '2027년 7월 4일 (일)' with correct Sunday", () => {
    const result = formatKoreanDate("2027-07-04");
    expect(result).toBe("2027년 7월 4일 (일)");
  });

  it("AC-4: formatKoreanDate should show correct day of week for Thursday 2026-01-01", () => {
    const result = formatKoreanDate("2026-01-01");
    expect(result).toBe("2026년 1월 1일 (목)");
  });

  it("AC-4: formatWon should format 900000 as '900,000원'", () => {
    const result = formatWon(900000);
    expect(result).toBe("900,000원");
  });

  it("AC-4: formatWon should format various amounts with comma separator", () => {
    expect(formatWon(1000)).toBe("1,000원");
    expect(formatWon(1000000)).toBe("1,000,000원");
    expect(formatWon(5000)).toBe("5,000원");
  });

  it("should format edge case: zero won", () => {
    const result = formatWon(0);
    expect(result).toBe("0원");
  });
});

describe("Additional date utility cases", () => {
  it("addDays should correctly add days to a date", () => {
    const result = addDays("2026-01-15", 10);
    expect(result).toBe("2026-01-25");
  });

  it("addDays should handle month boundary crossing", () => {
    const result = addDays("2026-01-28", 5);
    expect(result).toBe("2026-02-02");
  });

  it("addDays should handle year boundary", () => {
    const result = addDays("2025-12-28", 5);
    expect(result).toBe("2026-01-02");
  });

  it("todayISO should return date string in YYYY-MM-DD format", () => {
    const result = todayISO();
    expect(typeof result).toBe("string");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Verify it's a valid date string
    const parsed = parseISO(result);
    expect(parsed).not.toBeNull();
  });

  it("should handle multiple month additions with clamping", () => {
    const result = addMonthsClamped("2026-01-31", 3);
    expect(result).toBe("2026-04-30");
  });

  it("should handle negative month additions", () => {
    const result = addMonthsClamped("2026-05-15", -2);
    expect(result).toBe("2026-03-15");
  });
});

describe("Date utility edge cases", () => {
  it("should handle diffDays with reversed dates", () => {
    const result = diffDays("2026-07-01", "2026-01-05");
    // Should handle gracefully (either 0, -177, or absolute value)
    expect(typeof result).toBe("number");
    expect(Math.abs(result)).toBe(177);
  });

  it("should handle February 29 in leap year correctly", () => {
    const result = addDays("2024-02-29", 1);
    expect(result).toBe("2024-03-01");
  });
});
