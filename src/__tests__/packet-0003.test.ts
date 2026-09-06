/**
 * TDD Tests — Storage Core + Profile Layer
 * Test file: src/__tests__/packet-0003.test.ts
 * Implementation files (to be created):
 *   src/storage/core.ts (safeGet, safeSet, removeKey, newId)
 *   src/storage/profile.ts (loadProfile, saveProfile, clearAll)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { ServiceProfile, SaveResult } from "@/lib/types";

// These will be implemented after tests are written
// import { safeGet, safeSet, removeKey, newId } from "@/storage/core";
// import { loadProfile, saveProfile, clearAll } from "@/storage/profile";

/**
 * AC-1: safeGet<T>(key, fallback): T with JSON parse failure resilience
 * Tests that malformed JSON in localStorage doesn't crash the app.
 */
describe("safeGet: localStorage read with JSON parse failure handling", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("AC-1.1: returns stored JSON value when valid", async () => {
    const { safeGet } = await import("@/storage/core");
    const testData = { name: "Alice", age: 30 };
    localStorage.setItem("test-key", JSON.stringify(testData));

    const result = safeGet<typeof testData>("test-key", { name: "fallback", age: 0 });
    expect(result.name).toBe("Alice");
    expect(result.age).toBe(30);
  });

  it("AC-1.2: returns fallback when key doesn't exist", async () => {
    const { safeGet } = await import("@/storage/core");
    const fallback = { name: "fallback", age: 0 };

    const result = safeGet<typeof fallback>("nonexistent-key", fallback);
    expect(result).toEqual(fallback);
  });

  it("AC-1.3: returns fallback without throwing when JSON is malformed", async () => {
    const { safeGet } = await import("@/storage/core");
    const fallback = { name: "default", count: 0 };
    localStorage.setItem("broken-key", "{ invalid json }}}");

    // Should NOT throw, should return fallback
    const result = safeGet<typeof fallback>("broken-key", fallback);
    expect(result).toEqual(fallback);
  });

  it("AC-1.4: returns fallback when stored value is null string", async () => {
    const { safeGet } = await import("@/storage/core");
    const fallback = { value: "default" };
    localStorage.setItem("null-key", "null");

    const result = safeGet<typeof fallback>("null-key", fallback);
    expect(result).toEqual(fallback);
  });
});

/**
 * AC-2: safeSet<T>(key, value): SaveResult<T> with QuotaExceededError handling
 * Tests that storage quota errors are caught and reported gracefully.
 */
describe("safeSet: localStorage write with QuotaExceededError handling", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("AC-2.1: successfully stores and returns { ok: true } when space available", async () => {
    const { safeSet } = await import("@/storage/core");
    const testData = { id: "123", name: "Bob" };

    const result = safeSet<typeof testData>("store-key", testData);
    expect(result.ok).toBe(true);
    expect(localStorage.getItem("store-key")).toBe(JSON.stringify(testData));
  });

  it("AC-2.2: returns { ok: false, error: '저장 공간이 부족해요' } on QuotaExceededError", async () => {
    const { safeSet } = await import("@/storage/core");

    // Mock localStorage.setItem to throw QuotaExceededError
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = vi.fn(() => {
      const err = new Error("QuotaExceededError");
      err.name = "QuotaExceededError";
      throw err;
    });

    const result = safeSet<{ data: string }>("key", { data: "test" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("저장 공간이 부족해요");
    }

    // Restore
    localStorage.setItem = originalSetItem;
  });

  it("AC-2.3: app doesn't crash when QuotaExceededError occurs", async () => {
    const { safeSet } = await import("@/storage/core");

    const originalSetItem = localStorage.setItem;
    let callCount = 0;
    localStorage.setItem = vi.fn(() => {
      callCount++;
      const err = new Error("QuotaExceededError");
      err.name = "QuotaExceededError";
      throw err;
    });

    // This should NOT throw to the caller
    expect(() => {
      safeSet<{ test: string }>("key", { test: "value" });
    }).not.toThrow();

    expect(callCount).toBe(1);
    localStorage.setItem = originalSetItem;
  });

  it("AC-2.4: returns { ok: true } for empty values", async () => {
    const { safeSet } = await import("@/storage/core");
    const emptyObj = {};

    const result = safeSet<typeof emptyObj>("empty-key", emptyObj);
    expect(result.ok).toBe(true);
  });
});

/**
 * AC-3: removeKey(key): void
 * Tests that removal works cleanly.
 */
describe("removeKey: localStorage deletion", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("AC-3.1: removes key when it exists", async () => {
    const { removeKey } = await import("@/storage/core");
    localStorage.setItem("to-remove", "value");

    removeKey("to-remove");
    expect(localStorage.getItem("to-remove")).toBe(null);
  });

  it("AC-3.2: doesn't throw when removing nonexistent key", async () => {
    const { removeKey } = await import("@/storage/core");

    expect(() => {
      removeKey("does-not-exist");
    }).not.toThrow();
  });
});

/**
 * AC-4: newId(): string with UUID + fallback pattern
 * Tests ID generation and fallback mechanism for devices without crypto.randomUUID.
 */
describe("newId: ID generation with crypto.randomUUID fallback", () => {
  it("AC-4.1: returns crypto.randomUUID when available", async () => {
    const { newId } = await import("@/storage/core");

    // If crypto.randomUUID is available (most modern envs)
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      const id = newId();
      // UUID format: 8-4-4-4-12 hex digits
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    }
  });

  it("AC-4.2: returns fallback pattern ep-{timestamp}-{6-char random} when no crypto.randomUUID", async () => {
    const { newId } = await import("@/storage/core");

    // Temporarily hide crypto.randomUUID if it exists
    const originalRandomUUID = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", {
      value: undefined,
      writable: true,
    });

    const id = newId();
    // Fallback format: ep-{timestamp}-{6-char alphanumeric}
    expect(id).toMatch(/^ep-\d+-[a-zA-Z0-9]{6}$/);

    // Verify timestamp is roughly now
    const [prefix, timestamp, random] = id.split("-");
    expect(prefix).toBe("ep");
    const ts = parseInt(timestamp, 10);
    expect(ts).toBeGreaterThan(Date.now() - 1000); // Within last second
    expect(ts).toBeLessThanOrEqual(Date.now());

    // Restore
    Object.defineProperty(crypto, "randomUUID", {
      value: originalRandomUUID,
      writable: true,
    });
  });

  it("AC-4.3: generates 1000 unique IDs (no collisions)", async () => {
    const { newId } = await import("@/storage/core");

    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(newId());
    }

    expect(ids.size).toBe(1000);
  });

  it("AC-4.4: fallback random segment is always 6 alphanumeric chars", async () => {
    const { newId } = await import("@/storage/core");

    // Hide crypto.randomUUID
    const originalRandomUUID = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", {
      value: undefined,
      writable: true,
    });

    for (let i = 0; i < 10; i++) {
      const id = newId();
      const [, , random] = id.split("-");
      expect(random).toMatch(/^[a-zA-Z0-9]{6}$/);
    }

    // Restore
    Object.defineProperty(crypto, "randomUUID", {
      value: originalRandomUUID,
      writable: true,
    });
  });
});

/**
 * AC-5: loadProfile(): ServiceProfile | null with schemaVersion validation
 * Tests profile loading and schema version handling.
 */
describe("loadProfile: load and validate ServiceProfile", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("AC-5.1: returns null when profile key doesn't exist", async () => {
    const { loadProfile } = await import("@/storage/profile");

    const result = loadProfile();
    expect(result).toBeNull();
  });

  it("AC-5.2: returns ServiceProfile when valid profile exists", async () => {
    const { loadProfile, saveProfile } = await import("@/storage/profile");

    const testProfile: ServiceProfile = {
      schemaVersion: 1,
      branch: "ARMY",
      enlistDate: "2022-01-15",
      serviceMonths: 18,
      dischargeDate: "2023-07-15",
      nickname: "Tiger",
      createdAt: 1000000,
      updatedAt: 1000000,
    };

    saveProfile(testProfile);
    const loaded = loadProfile();

    expect(loaded).not.toBeNull();
    expect(loaded?.branch).toBe("ARMY");
    expect(loaded?.nickname).toBe("Tiger");
    expect(loaded?.schemaVersion).toBe(1);
  });

  it("AC-5.3: returns null and deletes key when schemaVersion !== 1", async () => {
    const { loadProfile } = await import("@/storage/profile");

    // Simulate outdated profile with schemaVersion 0
    const outdatedProfile = {
      schemaVersion: 0,
      branch: "NAVY",
      nickname: "Old",
    };
    localStorage.setItem("enlistpay:profile", JSON.stringify(outdatedProfile));

    const result = loadProfile();
    expect(result).toBeNull();
    expect(localStorage.getItem("enlistpay:profile")).toBeNull();
  });

  it("AC-5.4: returns null when stored JSON is malformed", async () => {
    const { loadProfile } = await import("@/storage/profile");

    localStorage.setItem("enlistpay:profile", "{ broken json }}}");

    const result = loadProfile();
    expect(result).toBeNull();
  });

  it("AC-5.5: profile key is exactly 'enlistpay:profile'", async () => {
    const { saveProfile, loadProfile } = await import("@/storage/profile");

    const profile: ServiceProfile = {
      schemaVersion: 1,
      branch: "AIR_FORCE",
      enlistDate: "2023-06-01",
      serviceMonths: 12,
      dischargeDate: "2024-06-01",
      nickname: "Sky",
      createdAt: 2000000,
      updatedAt: 2000000,
    };

    saveProfile(profile);

    // Verify the exact key is used
    const rawValue = localStorage.getItem("enlistpay:profile");
    expect(rawValue).not.toBeNull();
    expect(JSON.parse(rawValue!)).toMatchObject({
      schemaVersion: 1,
      branch: "AIR_FORCE",
    });
  });
});

/**
 * AC-6: saveProfile(p): SaveResult<ServiceProfile>
 * Tests profile saving with success/error handling.
 */
describe("saveProfile: save ServiceProfile with result type", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("AC-6.1: returns { ok: true } on successful save", async () => {
    const { saveProfile } = await import("@/storage/profile");

    const profile: ServiceProfile = {
      schemaVersion: 1,
      branch: "MARINE",
      enlistDate: "2021-03-10",
      serviceMonths: 24,
      dischargeDate: "2023-03-10",
      nickname: "Warrior",
      createdAt: 3000000,
      updatedAt: 3000000,
    };

    const result = saveProfile(profile);
    expect(result.ok).toBe(true);
  });

  it("AC-6.2: returns { ok: false, error: '저장 공간이 부족해요' } on QuotaExceededError", async () => {
    const { saveProfile } = await import("@/storage/profile");

    const originalSetItem = localStorage.setItem;
    localStorage.setItem = vi.fn(() => {
      const err = new Error("QuotaExceededError");
      err.name = "QuotaExceededError";
      throw err;
    });

    const profile: ServiceProfile = {
      schemaVersion: 1,
      branch: "SOCIAL",
      enlistDate: "2023-01-01",
      serviceMonths: 6,
      dischargeDate: "2023-07-01",
      nickname: "Guard",
      createdAt: 4000000,
      updatedAt: 4000000,
    };

    const result = saveProfile(profile);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("저장 공간이 부족해요");
    }

    localStorage.setItem = originalSetItem;
  });

  it("AC-6.3: persists profile to localStorage with exact key", async () => {
    const { saveProfile } = await import("@/storage/profile");

    const profile: ServiceProfile = {
      schemaVersion: 1,
      branch: "ARMY",
      enlistDate: "2022-01-01",
      serviceMonths: 18,
      dischargeDate: "2023-07-01",
      nickname: "Soldier",
      createdAt: 5000000,
      updatedAt: 5000000,
    };

    saveProfile(profile);

    const stored = localStorage.getItem("enlistpay:profile");
    expect(stored).not.toBeNull();

    const parsed = JSON.parse(stored!);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.nickname).toBe("Soldier");
    expect(parsed.branch).toBe("ARMY");
  });
});

/**
 * AC-7: clearAll(): void
 * Tests complete profile wipeout.
 */
describe("clearAll: clear all profile storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("AC-7.1: removes profile key when it exists", async () => {
    const { saveProfile, clearAll } = await import("@/storage/profile");

    const profile: ServiceProfile = {
      schemaVersion: 1,
      branch: "ARMY",
      enlistDate: "2022-01-01",
      serviceMonths: 18,
      dischargeDate: "2023-07-01",
      nickname: "Test",
      createdAt: 1000000,
      updatedAt: 1000000,
    };

    saveProfile(profile);
    expect(localStorage.getItem("enlistpay:profile")).not.toBeNull();

    clearAll();
    expect(localStorage.getItem("enlistpay:profile")).toBeNull();
  });

  it("AC-7.2: doesn't throw when profile key doesn't exist", async () => {
    const { clearAll } = await import("@/storage/profile");

    expect(() => {
      clearAll();
    }).not.toThrow();
  });

  it("AC-7.3: returns void", async () => {
    const { clearAll } = await import("@/storage/profile");

    const result = clearAll();
    expect(result).toBeUndefined();
  });
});

/**
 * Integration Tests: Profile lifecycle
 */
describe("Profile lifecycle: save → load → clear", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("INTEGRATION: create, load, update, clear profile roundtrip", async () => {
    const { saveProfile, loadProfile, clearAll } = await import("@/storage/profile");

    // Create
    const profile1: ServiceProfile = {
      schemaVersion: 1,
      branch: "ARMY",
      enlistDate: "2022-01-15",
      serviceMonths: 18,
      dischargeDate: "2023-07-15",
      nickname: "First",
      createdAt: 1000000,
      updatedAt: 1000000,
    };

    const saveResult1 = saveProfile(profile1);
    expect(saveResult1.ok).toBe(true);

    // Load and verify
    const loaded1 = loadProfile();
    expect(loaded1?.nickname).toBe("First");
    expect(loaded1?.branch).toBe("ARMY");

    // Update
    const profile2: ServiceProfile = {
      ...profile1,
      nickname: "Updated",
      updatedAt: 2000000,
    };

    const saveResult2 = saveProfile(profile2);
    expect(saveResult2.ok).toBe(true);

    // Load updated
    const loaded2 = loadProfile();
    expect(loaded2?.nickname).toBe("Updated");
    expect(loaded2?.updatedAt).toBe(2000000);

    // Clear
    clearAll();
    const loaded3 = loadProfile();
    expect(loaded3).toBeNull();
  });

  it("INTEGRATION: ID generation doesn't interfere with profile storage", async () => {
    const { newId } = await import("@/storage/core");
    const { saveProfile, loadProfile } = await import("@/storage/profile");

    // Generate some IDs
    const id1 = newId();
    const id2 = newId();
    expect(id1).not.toBe(id2);

    // Save profile (should use its own key)
    const profile: ServiceProfile = {
      schemaVersion: 1,
      branch: "NAVY",
      enlistDate: "2023-06-01",
      serviceMonths: 12,
      dischargeDate: "2024-06-01",
      nickname: "NavySeal",
      createdAt: 3000000,
      updatedAt: 3000000,
    };

    saveProfile(profile);

    // Profile key should be separate
    const stored = localStorage.getItem("enlistpay:profile");
    expect(stored).not.toBeNull();

    // Load should work
    const loaded = loadProfile();
    expect(loaded?.nickname).toBe("NavySeal");
  });
});

/**
 * Edge cases & robustness
 */
describe("Storage edge cases", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("EDGE: safeGet with circular reference in stored data", async () => {
    const { safeGet } = await import("@/storage/core");

    // Store data that can't be JSON (circular ref would fail JSON.stringify)
    // We simulate this by storing partial JSON
    localStorage.setItem("circular", '{"a":1,"b":[Infinity]}');

    const fallback = { a: 0, b: [] };
    const result = safeGet<typeof fallback>("circular", fallback);

    // Should either parse or return fallback
    expect(result).toBeDefined();
  });

  it("EDGE: saveProfile with very large nickname field", async () => {
    const { saveProfile, loadProfile } = await import("@/storage/profile");

    const largeNickname = "X".repeat(1000);
    const profile: ServiceProfile = {
      schemaVersion: 1,
      branch: "ARMY",
      enlistDate: "2022-01-01",
      serviceMonths: 18,
      dischargeDate: "2023-07-01",
      nickname: largeNickname,
      createdAt: 1000000,
      updatedAt: 1000000,
    };

    const result = saveProfile(profile);
    expect(result.ok).toBe(true);

    const loaded = loadProfile();
    expect(loaded?.nickname).toBe(largeNickname);
  });

  it("EDGE: newId called rapidly maintains uniqueness", async () => {
    const { newId } = await import("@/storage/core");

    const ids: string[] = [];
    for (let i = 0; i < 100; i++) {
      ids.push(newId());
    }

    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(100);
  });
});
