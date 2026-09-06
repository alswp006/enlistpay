import { addDays, addMonthsClamped, diffDays, todayISO } from "./date";
import { calcDischargeDate } from "./dday";
import { PAY_TABLE_2025, RANK_LABEL } from "./payTable";
import type { Branch, ISODate, Rank, RankPeriod, ServiceProfile } from "./types";
import type { MilitaryBranch, RankInfo, User } from "@/lib/contract";

const RANK_MONTHS: { rank: Rank; months: number }[] = [
  { rank: "PRIVATE", months: 2 },
  { rank: "PFC", months: 6 },
  { rank: "CORPORAL", months: 6 },
];

export function calcRankPeriods(profile: ServiceProfile): RankPeriod[] {
  const { enlistDate, dischargeDate } = profile;
  const periods: RankPeriod[] = [];
  let cursor: ISODate = enlistDate;

  for (const { rank, months } of RANK_MONTHS) {
    const periodEnd = addDays(addMonthsClamped(cursor, months), -1);
    if (periodEnd >= dischargeDate) {
      periods.push({
        rank,
        startDate: cursor,
        endDate: dischargeDate,
        monthlyPay: PAY_TABLE_2025.monthlyPay[rank],
      });
      return periods;
    }
    periods.push({
      rank,
      startDate: cursor,
      endDate: periodEnd,
      monthlyPay: PAY_TABLE_2025.monthlyPay[rank],
    });
    cursor = addDays(periodEnd, 1);
  }

  periods.push({
    rank: "SERGEANT",
    startDate: cursor,
    endDate: dischargeDate,
    monthlyPay: PAY_TABLE_2025.monthlyPay.SERGEANT,
  });
  return periods;
}

export function getRankAt(profile: ServiceProfile, iso: ISODate): Rank | null {
  if (iso < profile.enlistDate || iso > profile.dischargeDate) return null;
  const period = calcRankPeriods(profile).find((p) => iso >= p.startDate && iso <= p.endDate);
  return period?.rank ?? null;
}

export function getNextPromotion(
  profile: ServiceProfile,
  iso: ISODate,
): { rank: Rank; date: ISODate; dday: number } | null {
  const periods = calcRankPeriods(profile);
  const index = periods.findIndex((p) => iso >= p.startDate && iso <= p.endDate);
  if (index === -1) return null;
  const next = periods[index + 1];
  if (!next) return null;
  return { rank: next.rank, date: next.startDate, dday: diffDays(iso, next.startDate) };
}

export function isEarlyDischargeBeforeSergeant(profile: ServiceProfile): boolean {
  const periods = calcRankPeriods(profile);
  return periods[periods.length - 1]?.rank !== "SERGEANT";
}

// contract.ts의 MilitaryBranch(4종)는 domain Branch(5종, SOCIAL 포함)의 부분집합이라
// 역매핑이 항상 성립한다 (SOCIAL은 User 쪽에 대응값이 없어 나타날 수 없음).
const MILITARY_TO_BRANCH: Record<MilitaryBranch, Branch> = {
  ARMY: "ARMY",
  NAVY: "NAVY",
  AIR_FORCE: "AIR_FORCE",
  MARINE_CORPS: "MARINE",
};

/** Contract-mandated next-rank calculation (src/lib/contract.ts: calculateNextRankFn) */
export function calculateNextRank(user: User): RankInfo {
  const branch = MILITARY_TO_BRANCH[user.militaryBranch];
  const enlistDate = user.enlistmentDate;
  const serviceMonths = PAY_TABLE_2025.defaultServiceMonths[branch];
  const dischargeDate = user.dischargeDate ?? calcDischargeDate({ enlistDate, serviceMonths });

  const profile: ServiceProfile = {
    schemaVersion: 1,
    branch,
    enlistDate,
    serviceMonths,
    dischargeDate,
    nickname: "",
    createdAt: 0,
    updatedAt: 0,
  };

  const today = todayISO();
  const anchor: ISODate = today < enlistDate ? enlistDate : today > dischargeDate ? dischargeDate : today;

  const next = getNextPromotion(profile, anchor);
  if (next) {
    return {
      rank: RANK_LABEL[next.rank],
      promotionDate: next.date,
      daysUntilPromotion: Math.max(0, next.dday),
    };
  }

  const currentRank = getRankAt(profile, anchor);
  return { rank: RANK_LABEL[currentRank ?? "PRIVATE"] };
}
