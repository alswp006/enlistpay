import { describe, it, expect } from "vitest";
import {
  loadVacations,
  addVacation,
  removeVacation,
  getVacationRecords,
  addVacationRecord,
} from "@/storage/vacation";
import { loadFlags, saveFlags } from "@/storage/flags";
import { loadSavingsInput, saveSavingsInput } from "@/storage/savingsInput";
import type { VacationRecord } from "@/lib/types";

function makeVacation(overrides: Partial<VacationRecord> = {}): VacationRecord {
  return {
    id: "v-test",
    type: "ANNUAL",
    direction: "USE",
    days: 1,
    date: "2026-09-07",
    memo: "메모",
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("storage/vacation", () => {
  it("loadVacations returns [] when empty", () => {
    expect(loadVacations()).toEqual([]);
  });

  it("addVacation persists and loadVacations returns it sorted", () => {
    const older = makeVacation({ id: "a", date: "2026-09-01", createdAt: 1 });
    const newer = makeVacation({ id: "b", date: "2026-09-05", createdAt: 2 });
    expect(addVacation(older).ok).toBe(true);
    expect(addVacation(newer).ok).toBe(true);

    const loaded = loadVacations();
    expect(loaded.map((v) => v.id)).toEqual(["b", "a"]);
  });

  it("removeVacation removes the matching record", () => {
    addVacation(makeVacation({ id: "to-remove" }));
    const result = removeVacation("to-remove");
    expect(result.ok).toBe(true);
    expect(loadVacations()).toEqual([]);
  });
});

describe("storage/vacation contract adapter", () => {
  it("getVacationRecords returns [] when empty", async () => {
    expect(await getVacationRecords()).toEqual([]);
  });

  it("addVacationRecord persists and getVacationRecords returns it as a date range", async () => {
    const saved = await addVacationRecord({
      startDate: "2026-09-01",
      endDate: "2026-09-03",
      type: "LEAVE",
      notes: "여름 휴가",
    });
    expect(saved.startDate).toBe("2026-09-01");
    expect(saved.endDate).toBe("2026-09-03");
    expect(saved.notes).toBe("여름 휴가");

    const loaded = await getVacationRecords();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toEqual(saved);
  });
});

describe("storage/flags", () => {
  it("loadFlags returns defaults when empty", () => {
    expect(loadFlags()).toEqual({
      onboardingDone: false,
      rewardUnlockedUntil: 0,
      payTableYear: 2025,
      disclaimerAckAt: 0,
    });
  });

  it("saveFlags merges partial updates and persists them", () => {
    const updated = saveFlags({ onboardingDone: true });
    expect(updated.onboardingDone).toBe(true);
    expect(loadFlags().onboardingDone).toBe(true);
  });
});

describe("storage/savingsInput", () => {
  it("loadSavingsInput returns null when empty", () => {
    expect(loadSavingsInput()).toBeNull();
  });

  it("saveSavingsInput/loadSavingsInput round-trip", () => {
    saveSavingsInput({ monthlyDeposit: 300000, months: 24, annualRatePercent: 5, useGovMatch: true });
    expect(loadSavingsInput()).toEqual({
      monthlyDeposit: 300000,
      months: 24,
      annualRatePercent: 5,
      useGovMatch: true,
    });
  });
});
