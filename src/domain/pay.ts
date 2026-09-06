import { addDays, daysInMonth, diffDays, todayISO } from "./date";
import { calcDischargeDate } from "./dday";
import { getRankAt } from "./rank";
import type { Branch, ISODate, MonthlyPayRow, PayTable, Rank, ServiceProfile } from "./types";
import { PAY_TABLE_2025 } from "./payTable";
import type { MilitaryBranch, PaySummary, User } from "@/lib/contract";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function firstDayOfYearMonth(yearMonth: string): ISODate {
  return `${yearMonth}-01`;
}

function lastDayOfYearMonth(yearMonth: string): ISODate {
  const [year, month] = yearMonth.split("-").map(Number);
  return `${yearMonth}-${pad2(daysInMonth(year, month))}`;
}

/**
 * 입대월부터 전역월까지 월별 급여 행을 계산한다.
 * 계급 판정 앵커는 각 행의 "그 달 1일"(전역월은 전역일) — rank.ts의 실제 진급 경계일이
 * 매달 같은 일자(입대일 day)에 걸리므로, 진급이 일어난 달 자체는 이전 계급으로 표시되고
 * 다음 달부터 새 계급으로 표시된다(그 달 안에서 실제로 지급된 옛 계급 일수가 대다수인 셈).
 */
export function calcMonthlyPayRows(profile: ServiceProfile, table: PayTable): MonthlyPayRow[] {
  const { enlistDate, dischargeDate } = profile;
  const [enlistYear, enlistMonth] = enlistDate.slice(0, 7).split("-").map(Number);
  const [dischargeYear, dischargeMonth] = dischargeDate.slice(0, 7).split("-").map(Number);
  const totalMonths = (dischargeYear - enlistYear) * 12 + (dischargeMonth - enlistMonth) + 1;

  const rows: MonthlyPayRow[] = [];

  for (let i = 0; i < totalMonths; i++) {
    const total = enlistYear * 12 + (enlistMonth - 1) + i;
    const year = Math.floor(total / 12);
    const month = (total % 12) + 1;
    const yearMonth = `${year}-${pad2(month)}`;
    const dim = daysInMonth(year, month);
    const firstOfMonth = firstDayOfYearMonth(yearMonth);
    const lastOfMonth = lastDayOfYearMonth(yearMonth);
    const isLast = i === totalMonths - 1;

    const rowStart = enlistDate > firstOfMonth ? enlistDate : firstOfMonth;
    const rowEnd = dischargeDate < lastOfMonth ? dischargeDate : lastOfMonth;
    const servedDays = diffDays(rowStart, rowEnd) + 1;

    const anchor = isLast ? dischargeDate : rowStart;
    // anchor는 항상 [enlistDate, dischargeDate] 구간 안이므로 getRankAt은 null을 반환하지 않는다.
    const rank = getRankAt(profile, anchor) as Rank;

    const monthlyPay = table.monthlyPay[rank];
    const amount = servedDays === dim ? monthlyPay : Math.round((monthlyPay * servedDays) / dim);

    rows.push({ yearMonth, rank, servedDays, daysInMonth: dim, amount });
  }

  return rows;
}

/** 각 행이 실제로 지급 확정되는 날짜(월말, 전역월은 전역일) 기준 누적 합계. */
export function sumPaidUntil(rows: MonthlyPayRow[], todayISO: ISODate): number {
  let sum = 0;
  rows.forEach((row, i) => {
    const isLast = i === rows.length - 1;
    const effectiveEnd = isLast
      ? addDays(firstDayOfYearMonth(row.yearMonth), row.servedDays - 1)
      : lastDayOfYearMonth(row.yearMonth);
    if (effectiveEnd <= todayISO) sum += row.amount;
  });
  return sum;
}

export function sumByRank(rows: MonthlyPayRow[]): Record<Rank, number> {
  const result: Record<Rank, number> = { PRIVATE: 0, PFC: 0, CORPORAL: 0, SERGEANT: 0 };
  for (const row of rows) result[row.rank] += row.amount;
  return result;
}

// contract.ts의 MilitaryBranch(4종)는 domain Branch(5종, SOCIAL 포함)의 부분집합이라
// 역매핑이 항상 성립한다 (SOCIAL은 User 쪽에 대응값이 없어 나타날 수 없음).
const MILITARY_TO_BRANCH: Record<MilitaryBranch, Branch> = {
  ARMY: "ARMY",
  NAVY: "NAVY",
  AIR_FORCE: "AIR_FORCE",
  MARINE_CORPS: "MARINE",
};

/** 각 행이 오늘 기준으로 실제 지급 확정됐는지 여부 (sumPaidUntil과 동일한 지급 확정 기준). */
function isPaidByToday(rows: MonthlyPayRow[], index: number, todayIso: ISODate): boolean {
  const row = rows[index];
  const isLast = index === rows.length - 1;
  const effectiveEnd = isLast
    ? addDays(firstDayOfYearMonth(row.yearMonth), row.servedDays - 1)
    : lastDayOfYearMonth(row.yearMonth);
  return effectiveEnd <= todayIso;
}

/** Contract-mandated cumulative pay calculation (src/lib/contract.ts: calculatePaySummaryFn) */
export function calculatePaySummary(user: User): PaySummary {
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

  const rows = calcMonthlyPayRows(profile, PAY_TABLE_2025);
  const today = todayISO();
  const paidRows = rows.filter((_, i) => isPaidByToday(rows, i, today));

  return {
    totalKrw: paidRows.reduce((sum, row) => sum + row.amount, 0),
    monthlyBreakdown: paidRows.map((row) => ({ month: row.yearMonth, amountKrw: row.amount })),
  };
}
