import { addDays, daysInMonth, diffDays } from "./date";
import { getRankAt } from "./rank";
import type { ISODate, MonthlyPayRow, PayTable, Rank, ServiceProfile } from "./types";

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
