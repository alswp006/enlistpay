import type { VacationType, VacationDirection } from "./types";
import type {
  VacationRecord as ContractVacationRecord,
  VacationSummary as ContractVacationSummary,
} from "@/lib/contract";
import { diffDays } from "./date";

export interface VacationRecord {
  type: VacationType;
  direction: VacationDirection;
  days: number;
}

export interface VacationSummary {
  granted: number;
  used: number;
  remaining: number;
}

export interface BranchVacationTable {
  [branch: string]: {
    baseVacationDays: number;
  };
}

export function calcVacationSummary(
  branch: string,
  records: VacationRecord[],
  payTable: BranchVacationTable
): VacationSummary {
  let granted = payTable[branch]?.baseVacationDays ?? 0;
  let used = 0;

  for (const record of records) {
    if (record.direction === "GRANT") {
      granted += record.days;
    } else if (record.direction === "USE") {
      used += record.days;
    }
  }

  return { granted, used, remaining: granted - used };
}

// contract.ts의 VacationRecord는 날짜 구간(startDate~endDate)과 종류(LEAVE|ABSENCE)만
// 담는다(부여/방향 개념 없음) — storage/vacation.ts의 어댑터가 만드는 모양과 동일하다.
// LEAVE는 실제로 사용한 휴가, ABSENCE는 아직 정식 휴가로 정산되지 않은 결석 일수로 본다.
function contractRecordDays(record: ContractVacationRecord): number {
  return Math.max(1, diffDays(record.startDate, record.endDate) + 1);
}

/** Contract-mandated aggregation (src/lib/contract.ts: calculateVacationSummaryFn) */
export function calculateVacationSummary(
  records: ContractVacationRecord[]
): ContractVacationSummary {
  let usedDays = 0;
  let totalDays = 0;

  for (const record of records) {
    const days = contractRecordDays(record);
    totalDays += days;
    if (record.type === "LEAVE") {
      usedDays += days;
    }
  }

  return { totalDays, usedDays, remainingDays: totalDays - usedDays };
}
