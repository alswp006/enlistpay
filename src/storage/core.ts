import type { SaveResult } from "@/lib/types";
import type { StorageKey } from "@/lib/contract";

export function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed === null ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}

export function safeSet<T>(key: string, value: T): SaveResult {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch {
    return { ok: false, error: "저장 공간이 부족해요" };
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // no-op: storage unavailable
  }
}

const STORAGE_NAMESPACE = "enlistpay";

function namespacedKey(key: StorageKey): string {
  return `${STORAGE_NAMESPACE}:${key}`;
}

/** Contract-mandated repository abstraction (src/lib/contract.ts: storageGetFn) */
export async function storageGet<T>(key: StorageKey): Promise<T | null> {
  return safeGet<T | null>(namespacedKey(key), null);
}

/** Contract-mandated repository abstraction (src/lib/contract.ts: storageSetFn) */
export async function storageSet<T>(key: StorageKey, value: T): Promise<void> {
  safeSet(namespacedKey(key), value);
}

const ID_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function randomSegment(): string {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  }
  return out;
}

export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ep-${Date.now()}-${randomSegment()}`;
}
