import { addDays, addMonthsClamped, diffDays, todayISO } from "./date";
import { PAY_TABLE_2025 } from "./payTable";
import type { Branch, ISODate, ServiceProfile, ServiceStatus } from "./types";
import type { DdayResult, MilitaryBranch, User } from "@/lib/contract";

export function calcDischargeDate({
  enlistDate,
  serviceMonths,
}: {
  enlistDate: ISODate;
  serviceMonths: number;
}): ISODate {
  return addDays(addMonthsClamped(enlistDate, serviceMonths), -1);
}

export function calcServiceStatus(profile: ServiceProfile, todayISO: ISODate): ServiceStatus {
  const { enlistDate, dischargeDate } = profile;
  const totalDays = diffDays(enlistDate, dischargeDate) + 1;

  if (todayISO < enlistDate) {
    return {
      enlistDate,
      dischargeDate,
      totalDays,
      elapsedDays: 0,
      remainingDays: Math.max(0, diffDays(todayISO, dischargeDate)),
      progressPercent: 0,
      phase: "BEFORE_ENLIST",
    };
  }

  if (todayISO > dischargeDate) {
    return {
      enlistDate,
      dischargeDate,
      totalDays,
      elapsedDays: totalDays,
      remainingDays: 0,
      progressPercent: 100,
      phase: "DISCHARGED",
    };
  }

  const elapsedDays = diffDays(enlistDate, todayISO) + 1;
  return {
    enlistDate,
    dischargeDate,
    totalDays,
    elapsedDays,
    remainingDays: totalDays - elapsedDays,
    progressPercent: (elapsedDays / totalDays) * 100,
    phase: "IN_SERVICE",
  };
}

export function calcDaysUntilEnlist(profile: ServiceProfile, today: ISODate): number {
  if (today >= profile.enlistDate) return 0;
  return diffDays(today, profile.enlistDate);
}

// contract.ts의 MilitaryBranch(4종)는 domain Branch(5종, SOCIAL 포함)의 부분집합이라
// 역매핑이 항상 성립한다 (SOCIAL은 User 쪽에 대응값이 없어 나타날 수 없음).
const MILITARY_TO_BRANCH: Record<MilitaryBranch, Branch> = {
  ARMY: "ARMY",
  NAVY: "NAVY",
  AIR_FORCE: "AIR_FORCE",
  MARINE_CORPS: "MARINE",
};

/** Contract-mandated D-day calculation (src/lib/contract.ts: calculateDdayFn), adapted from calcServiceStatus */
export function calculateDday(user: User): DdayResult {
  const branch = MILITARY_TO_BRANCH[user.militaryBranch];
  const enlistDate = user.enlistmentDate;
  const serviceMonths = PAY_TABLE_2025.defaultServiceMonths[branch];
  const dischargeDate = user.dischargeDate ?? calcDischargeDate({ enlistDate, serviceMonths });

  const status = calcServiceStatus(
    {
      schemaVersion: 1,
      branch,
      enlistDate,
      serviceMonths,
      dischargeDate,
      nickname: "",
      createdAt: 0,
      updatedAt: 0,
    },
    todayISO(),
  );

  return {
    daysRemaining: status.remainingDays,
    daysServed: status.elapsedDays,
    progressPercent: status.progressPercent,
    dischargeDate: status.dischargeDate,
  };
}
