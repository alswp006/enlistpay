import type { AppFlags } from "@/lib/types";
import { safeGet, safeSet } from "./core";

const FLAGS_KEY = "enlistpay:flags";

const DEFAULT_FLAGS: AppFlags = {
  onboardingDone: false,
  rewardUnlockedUntil: 0,
  payTableYear: 2025,
  disclaimerAckAt: 0,
};

export function loadFlags(): AppFlags {
  const stored = safeGet<Partial<AppFlags> | null>(FLAGS_KEY, null);
  if (!stored || typeof stored !== "object") return { ...DEFAULT_FLAGS };
  return { ...DEFAULT_FLAGS, ...stored };
}

export function saveFlags(partial: Partial<AppFlags>): AppFlags {
  const next = { ...loadFlags(), ...partial };
  safeSet(FLAGS_KEY, next);
  return next;
}
