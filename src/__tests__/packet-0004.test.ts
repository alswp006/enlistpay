import { describe, it, expect, beforeEach } from "vitest";
import type { VacationRecord, AppFlags, SavingsInput } from "@/lib/types";

/**
 * Packet 0004: 휴가 · 플래그 · 적금입력 저장소
 *
 * TDD Red Phase — tests BEFORE implementation.
 * These tests describe the expected behavior of three storage modules:
 * - vacation.ts: loadVacations, addVacation, removeVacation
 * - flags.ts: loadFlags, saveFlags
 * - savingsInput.ts: loadSavingsInput, saveSavingsInput
 */

describe("AC-1: vacation.ts exports loadVacations, addVacation, removeVacation", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should export loadVacations, addVacation, removeVacation functions", async () => {
    const vacation = await import("@/storage/vacation");
    expect(typeof vacation.loadVacations).toBe("function");
    expect(typeof vacation.addVacation).toBe("function");
    expect(typeof vacation.removeVacation).toBe("function");
  });

  it("should use 'enlistpay:vacations' as storage key", async () => {
    const vacation = await import("@/storage/vacation");
    const mockVacation: VacationRecord = {
      id: "test-1",
      type: "ANNUAL",
      direction: "GRANT",
      days: 5,
      date: "2026-09-07",
      memo: "Test vacation",
      createdAt: Date.now(),
    };

    const addResult = await vacation.addVacation(mockVacation);
    expect(addResult.ok).toBe(true);

    const stored = localStorage.getItem("enlistpay:vacations");
    expect(stored).not.toBeNull();
    expect(stored).toContain("test-1");
  });
});

describe("AC-2: loadVacations returns date desc sorted, enforces 200-item limit", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should return empty array when no vacations stored", async () => {
    const vacation = await import("@/storage/vacation");
    const result = await vacation.loadVacations();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("should return vacations sorted by date DESC, then createdAt DESC", async () => {
    const vacation = await import("@/storage/vacation");

    const v1: VacationRecord = {
      id: "v1",
      type: "ANNUAL",
      direction: "USE",
      days: 3,
      date: "2026-09-05",
      memo: "Vacation 1",
      createdAt: 1000,
    };
    const v2: VacationRecord = {
      id: "v2",
      type: "REWARD",
      direction: "GRANT",
      days: 5,
      date: "2026-09-10", // Later date
      memo: "Vacation 2",
      createdAt: 2000,
    };
    const v3: VacationRecord = {
      id: "v3",
      type: "ANNUAL",
      direction: "USE",
      days: 2,
      date: "2026-09-10", // Same date as v2, but earlier createdAt
      memo: "Vacation 3",
      createdAt: 1500,
    };

    // Add in non-sorted order
    await vacation.addVacation(v1);
    await vacation.addVacation(v3);
    await vacation.addVacation(v2);

    const loaded = await vacation.loadVacations();

    // Should be: v2 (2026-09-10, createdAt=2000), v3 (2026-09-10, createdAt=1500), v1 (2026-09-05, createdAt=1000)
    expect(loaded.length).toBe(3);
    expect(loaded[0].id).toBe("v2");
    expect(loaded[0].date).toBe("2026-09-10");
    expect(loaded[0].createdAt).toBe(2000);

    expect(loaded[1].id).toBe("v3");
    expect(loaded[1].date).toBe("2026-09-10");
    expect(loaded[1].createdAt).toBe(1500);

    expect(loaded[2].id).toBe("v1");
    expect(loaded[2].date).toBe("2026-09-05");
  });

  it("should reject addVacation when exceeding 200 items", async () => {
    const vacation = await import("@/storage/vacation");

    // Add 200 vacations
    for (let i = 0; i < 200; i++) {
      const v: VacationRecord = {
        id: `v${i}`,
        type: "ANNUAL",
        direction: "USE",
        days: 1,
        date: "2026-09-07",
        memo: `Vacation ${i}`,
        createdAt: i,
      };
      const result = await vacation.addVacation(v);
      expect(result.ok).toBe(true);
    }

    // Try to add 201st
    const v201: VacationRecord = {
      id: "v200",
      type: "ANNUAL",
      direction: "USE",
      days: 1,
      date: "2026-09-07",
      memo: "Vacation 200",
      createdAt: 200,
    };

    const result = await vacation.addVacation(v201);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("기록은 200개까지 저장할 수 있어요");
    }

    // Verify still 200 items
    const loaded = await vacation.loadVacations();
    expect(loaded.length).toBe(200);
  });

  it("should allow removeVacation to succeed when count < 200", async () => {
    const vacation = await import("@/storage/vacation");

    const v1: VacationRecord = {
      id: "remove-test",
      type: "ANNUAL",
      direction: "USE",
      days: 5,
      date: "2026-09-07",
      memo: "To remove",
      createdAt: Date.now(),
    };

    const addResult = await vacation.addVacation(v1);
    expect(addResult.ok).toBe(true);

    const removeResult = await vacation.removeVacation("remove-test");
    expect(removeResult.ok).toBe(true);

    const loaded = await vacation.loadVacations();
    expect(loaded.length).toBe(0);
  });
});

describe("AC-3: flags.ts exports loadFlags, saveFlags with defaults", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should export loadFlags and saveFlags functions", async () => {
    const flags = await import("@/storage/flags");
    expect(typeof flags.loadFlags).toBe("function");
    expect(typeof flags.saveFlags).toBe("function");
  });

  it("should use 'enlistpay:flags' as storage key", async () => {
    const flags = await import("@/storage/flags");
    const partial: Partial<AppFlags> = { onboardingDone: true };
    await flags.saveFlags(partial);

    const stored = localStorage.getItem("enlistpay:flags");
    expect(stored).not.toBeNull();
    expect(stored).toContain("onboardingDone");
  });

  it("should return default AppFlags { onboardingDone: false, rewardUnlockedUntil: 0, payTableYear: 2025, disclaimerAckAt: 0 }", async () => {
    const flags = await import("@/storage/flags");
    const result = await flags.loadFlags();

    expect(result.onboardingDone).toBe(false);
    expect(result.rewardUnlockedUntil).toBe(0);
    expect(result.payTableYear).toBe(2025);
    expect(result.disclaimerAckAt).toBe(0);
  });

  it("should merge partial updates with defaults", async () => {
    const flags = await import("@/storage/flags");

    const partial: Partial<AppFlags> = {
      onboardingDone: true,
      rewardUnlockedUntil: 1234567890,
    };

    const updated = await flags.saveFlags(partial);
    expect(updated.onboardingDone).toBe(true);
    expect(updated.rewardUnlockedUntil).toBe(1234567890);
    expect(updated.payTableYear).toBe(2025);
    expect(updated.disclaimerAckAt).toBe(0);

    // Verify persistence
    const loaded = await flags.loadFlags();
    expect(loaded.onboardingDone).toBe(true);
    expect(loaded.rewardUnlockedUntil).toBe(1234567890);
    expect(loaded.payTableYear).toBe(2025);
    expect(loaded.disclaimerAckAt).toBe(0);
  });

  it("should allow updating individual flags without clearing others", async () => {
    const flags = await import("@/storage/flags");

    // Set initial
    await flags.saveFlags({ onboardingDone: true, payTableYear: 2026 });

    // Update only one field
    const result = await flags.saveFlags({ disclaimerAckAt: 9999 });

    expect(result.onboardingDone).toBe(true); // Preserved
    expect(result.payTableYear).toBe(2026); // Preserved
    expect(result.disclaimerAckAt).toBe(9999); // Updated
    expect(result.rewardUnlockedUntil).toBe(0); // Default
  });
});

describe("AC-4: savingsInput.ts exports loadSavingsInput, saveSavingsInput", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should export loadSavingsInput and saveSavingsInput functions", async () => {
    const savingsInput = await import("@/storage/savingsInput");
    expect(typeof savingsInput.loadSavingsInput).toBe("function");
    expect(typeof savingsInput.saveSavingsInput).toBe("function");
  });

  it("should use 'enlistpay:savings-input' as storage key", async () => {
    const savingsInput = await import("@/storage/savingsInput");
    const input: SavingsInput = {
      monthlyDeposit: 100000,
      months: 60,
      annualRatePercent: 2.5,
      useGovMatch: true,
    };

    await savingsInput.saveSavingsInput(input);

    const stored = localStorage.getItem("enlistpay:savings-input");
    expect(stored).not.toBeNull();
    expect(stored).toContain("monthlyDeposit");
    expect(stored).toContain("100000");
  });

  it("should save and retrieve SavingsInput with exact values", async () => {
    const savingsInput = await import("@/storage/savingsInput");
    const input: SavingsInput = {
      monthlyDeposit: 500000,
      months: 48,
      annualRatePercent: 3.2,
      useGovMatch: false,
    };

    await savingsInput.saveSavingsInput(input);
    const loaded = await savingsInput.loadSavingsInput();

    expect(loaded).not.toBeNull();
    if (loaded) {
      expect(loaded.monthlyDeposit).toBe(500000);
      expect(loaded.months).toBe(48);
      expect(loaded.annualRatePercent).toBe(3.2);
      expect(loaded.useGovMatch).toBe(false);
    }
  });

  it("should allow updating SavingsInput completely", async () => {
    const savingsInput = await import("@/storage/savingsInput");

    const input1: SavingsInput = {
      monthlyDeposit: 100000,
      months: 60,
      annualRatePercent: 2.5,
      useGovMatch: true,
    };
    await savingsInput.saveSavingsInput(input1);

    const input2: SavingsInput = {
      monthlyDeposit: 200000,
      months: 36,
      annualRatePercent: 3.5,
      useGovMatch: false,
    };
    await savingsInput.saveSavingsInput(input2);

    const loaded = await savingsInput.loadSavingsInput();
    expect(loaded?.monthlyDeposit).toBe(200000);
    expect(loaded?.months).toBe(36);
    expect(loaded?.annualRatePercent).toBe(3.5);
    expect(loaded?.useGovMatch).toBe(false);
  });
});

describe("AC-5: Empty values return sensible defaults", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should return empty array from loadVacations when nothing stored", async () => {
    const vacation = await import("@/storage/vacation");
    const result = await vacation.loadVacations();
    expect(result).toEqual([]);
  });

  it("should return default AppFlags from loadFlags when nothing stored", async () => {
    const flags = await import("@/storage/flags");
    const result = await flags.loadFlags();

    expect(result).toEqual({
      onboardingDone: false,
      rewardUnlockedUntil: 0,
      payTableYear: 2025,
      disclaimerAckAt: 0,
    });
  });

  it("should return null from loadSavingsInput when nothing stored", async () => {
    const savingsInput = await import("@/storage/savingsInput");
    const result = await savingsInput.loadSavingsInput();
    expect(result).toBeNull();
  });

  it("should handle corrupted localStorage gracefully", async () => {
    localStorage.setItem("enlistpay:vacations", "invalid-json{");
    localStorage.setItem("enlistpay:flags", "not-json");
    localStorage.setItem("enlistpay:savings-input", "broken[");

    const vacation = await import("@/storage/vacation");
    const flags = await import("@/storage/flags");
    const savingsInput = await import("@/storage/savingsInput");

    const v = await vacation.loadVacations();
    expect(v).toEqual([]);

    const f = await flags.loadFlags();
    expect(f.onboardingDone).toBe(false);

    const s = await savingsInput.loadSavingsInput();
    expect(s).toBeNull();
  });
});
