import type { Branch, SaveResult, ServiceProfile } from "@/lib/types";
import type { MilitaryBranch, Profile, User } from "@/lib/contract";
import { removeKey, safeGet, safeSet } from "./core";

const PROFILE_KEY = "enlistpay:profile";

// contract.ts의 MilitaryBranch(4종)는 domain Branch(5종, SOCIAL 포함)보다 좁다 —
// SOCIAL(사회복무요원)은 군이 아니므로 매핑 불가한 값을 ARMY로 낮춰 보수적으로 취급한다.
const BRANCH_TO_MILITARY: Record<Branch, MilitaryBranch> = {
  ARMY: "ARMY",
  NAVY: "NAVY",
  AIR_FORCE: "AIR_FORCE",
  MARINE: "MARINE_CORPS",
  SOCIAL: "ARMY",
};

export function loadProfile(): ServiceProfile | null {
  const profile = safeGet<ServiceProfile | null>(PROFILE_KEY, null);
  if (!profile || profile.schemaVersion !== 1) {
    if (profile) removeKey(PROFILE_KEY);
    return null;
  }
  return profile;
}

export function saveProfile(profile: ServiceProfile): SaveResult {
  return safeSet(PROFILE_KEY, profile);
}

/** Contract-mandated profile read (src/lib/contract.ts: getProfileFn), adapted from ServiceProfile */
export async function getProfile(): Promise<Profile | null> {
  const profile = loadProfile();
  if (!profile) return null;
  const user: User = {
    id: "local",
    militaryBranch: BRANCH_TO_MILITARY[profile.branch],
    enlistmentDate: profile.enlistDate,
    dischargeDate: profile.dischargeDate,
  };
  return {
    user,
    createdAt: new Date(profile.createdAt).toISOString(),
    updatedAt: new Date(profile.updatedAt).toISOString(),
  };
}

export function clearAll(): void {
  removeKey(PROFILE_KEY);
}
