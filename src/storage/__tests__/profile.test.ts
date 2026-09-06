import { describe, it, expect, vi } from "vitest";
import { newId, safeGet, safeSet, removeKey, storageGet, storageSet } from "@/storage/core";
import { loadProfile, saveProfile, clearAll, getProfile } from "@/storage/profile";
import type { ServiceProfile } from "@/lib/types";

const PROFILE_KEY = "enlistpay:profile";

function makeProfile(overrides: Partial<ServiceProfile> = {}): ServiceProfile {
  return {
    schemaVersion: 1,
    branch: "ARMY",
    enlistDate: "2025-01-06",
    serviceMonths: 18,
    dischargeDate: "2026-07-05",
    nickname: "김이병",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("storage/core", () => {
  it("safeGet returns fallback when key is missing", () => {
    expect(safeGet("missing-key", "fallback")).toBe("fallback");
  });

  it("safeGet returns fallback (not throw) when stored JSON is malformed", () => {
    localStorage.setItem("broken", "{not valid json");
    expect(() => safeGet("broken", { a: 1 })).not.toThrow();
    expect(safeGet("broken", { a: 1 })).toEqual({ a: 1 });
  });

  it("safeSet/safeGet round-trip", () => {
    const result = safeSet("roundtrip", { value: 42 });
    expect(result).toEqual({ ok: true });
    expect(safeGet("roundtrip", null)).toEqual({ value: 42 });
  });

  it("removeKey deletes the stored value", () => {
    safeSet("to-remove", "x");
    removeKey("to-remove");
    expect(safeGet("to-remove", null)).toBeNull();
  });

  it("safeSet catches QuotaExceededError and returns a Korean error message", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    const result = safeSet("any", "x");
    expect(result).toEqual({ ok: false, error: "저장 공간이 부족해요" });
    spy.mockRestore();
  });

  it("newId falls back to ep-<timestamp>-<random> format when crypto.randomUUID is unavailable", () => {
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", { value: undefined, writable: true });
    const id = newId();
    expect(id).toMatch(/^ep-\d+-[a-zA-Z0-9]{6}$/);
    Object.defineProperty(crypto, "randomUUID", { value: original, writable: true });
  });

  it("newId produces 1000 unique ids", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId()));
    expect(ids.size).toBe(1000);
  });

  it("storageSet/storageGet round-trip through the 'enlistpay:<key>' namespace", async () => {
    await storageSet("flags", { onboardingDone: true });
    expect(await storageGet<{ onboardingDone: boolean }>("flags")).toEqual({ onboardingDone: true });
    expect(localStorage.getItem("enlistpay:flags")).not.toBeNull();
  });

  it("storageGet returns null for a key that was never set", async () => {
    expect(await storageGet("vacation")).toBeNull();
  });
});

describe("storage/profile", () => {
  it("loadProfile returns null when nothing is stored", () => {
    expect(loadProfile()).toBeNull();
  });

  it("saveProfile/loadProfile round-trip", () => {
    const profile = makeProfile();
    const result = saveProfile(profile);
    expect(result).toEqual({ ok: true });
    expect(loadProfile()).toEqual(profile);
  });

  it("loadProfile returns null and clears the key when schemaVersion mismatches", () => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...makeProfile(), schemaVersion: 2 }));
    expect(loadProfile()).toBeNull();
    expect(localStorage.getItem(PROFILE_KEY)).toBeNull();
  });

  it("clearAll removes the stored profile", () => {
    saveProfile(makeProfile());
    clearAll();
    expect(loadProfile()).toBeNull();
  });

  it("getProfile returns null when nothing is stored", async () => {
    expect(await getProfile()).toBeNull();
  });

  it("getProfile adapts the stored ServiceProfile into the contract's User shape", async () => {
    const profile = makeProfile({ branch: "MARINE", createdAt: 1000000, updatedAt: 2000000 });
    saveProfile(profile);

    const result = await getProfile();
    expect(result?.user).toEqual({
      id: "local",
      militaryBranch: "MARINE_CORPS",
      enlistmentDate: profile.enlistDate,
      dischargeDate: profile.dischargeDate,
    });
    expect(result?.createdAt).toBe(new Date(1000000).toISOString());
    expect(result?.updatedAt).toBe(new Date(2000000).toISOString());
  });
});
