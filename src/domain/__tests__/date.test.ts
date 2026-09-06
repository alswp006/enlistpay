import { describe, it, expect } from "vitest";
import {
  parseISO,
  toISO,
  addMonthsClamped,
  addDays,
  diffDays,
  daysInMonth,
  formatKoreanDate,
  formatWon,
  parseSeoulDate,
  formatSeoulDate,
} from "@/domain/date";

describe("parseISO", () => {
  it("parses a valid date and round-trips through toISO", () => {
    const d = parseISO("2026-01-15");
    expect(d).not.toBeNull();
    expect(toISO(d!)).toBe("2026-01-15");
  });

  it("returns null for out-of-range month/day", () => {
    expect(parseISO("2026-13-45")).toBeNull();
  });

  it("returns null for a non-date string", () => {
    expect(parseISO("abcd-99-99")).toBeNull();
  });
});

describe("addMonthsClamped", () => {
  it("clamps month-end overflow to the target month's last day", () => {
    expect(addMonthsClamped("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("keeps the leap-year day when clamping into February", () => {
    expect(addMonthsClamped("2024-01-31", 1)).toBe("2024-02-29");
  });
});

describe("diffDays", () => {
  it("returns 177 for 2026-01-05 to 2026-07-01", () => {
    expect(diffDays("2026-01-05", "2026-07-01")).toBe(177);
  });
});

describe("daysInMonth", () => {
  it("handles leap and non-leap Februaries", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
  });
});

describe("formatKoreanDate", () => {
  it("formats with the correct weekday", () => {
    expect(formatKoreanDate("2027-07-04")).toBe("2027년 7월 4일 (일)");
  });
});

describe("formatWon", () => {
  it("adds thousand separators and the 원 suffix", () => {
    expect(formatWon(900000)).toBe("900,000원");
  });
});

describe("addDays", () => {
  it("crosses month boundaries correctly", () => {
    expect(addDays("2026-01-28", 5)).toBe("2026-02-02");
  });
});

describe("parseSeoulDate / formatSeoulDate", () => {
  it("round-trips a calendar date through Asia/Seoul midnight", () => {
    const d = parseSeoulDate("2026-01-15");
    expect(formatSeoulDate(d)).toBe("2026-01-15");
  });

  it("represents Seoul midnight as 15:00 UTC the previous day", () => {
    const d = parseSeoulDate("2026-01-15");
    expect(d.toISOString()).toBe("2026-01-14T15:00:00.000Z");
  });

  it("formats using custom tokens", () => {
    const d = parseSeoulDate("2027-07-04");
    expect(formatSeoulDate(d, "YYYY년 MM월 DD일")).toBe("2027년 07월 04일");
  });

  it("returns an empty string for an invalid date", () => {
    expect(formatSeoulDate(parseSeoulDate("abcd-99-99"))).toBe("");
  });
});
