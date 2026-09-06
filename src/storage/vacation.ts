import type { SaveResult, VacationRecord } from "@/lib/types";
import type { VacationRecord as ContractVacationRecord } from "@/lib/contract";
import { addDays, diffDays } from "@/domain/date";
import { newId, safeGet, safeSet } from "./core";

const VACATION_KEY = "enlistpay:vacations";
const MAX_VACATIONS = 200;

function sortVacations(list: VacationRecord[]): VacationRecord[] {
  return [...list].sort((a, b) => {
    if (a.date !== b.date) return a.date > b.date ? -1 : 1;
    return b.createdAt - a.createdAt;
  });
}

function readAll(): VacationRecord[] {
  const stored = safeGet<VacationRecord[]>(VACATION_KEY, []);
  return Array.isArray(stored) ? stored : [];
}

export function loadVacations(): VacationRecord[] {
  return sortVacations(readAll());
}

export function addVacation(record: VacationRecord): SaveResult {
  const list = readAll();
  if (list.length >= MAX_VACATIONS) {
    return { ok: false, error: "기록은 200개까지 저장할 수 있어요" };
  }
  return safeSet(VACATION_KEY, sortVacations([...list, record]));
}

export function removeVacation(id: string): SaveResult {
  const list = readAll();
  const next = list.filter((v) => v.id !== id);
  return safeSet(VACATION_KEY, sortVacations(next));
}

// contract.ts의 VacationRecord는 단일 종류('LEAVE'만 실사용 — 도메인엔 결석 개념이
// 없음)의 날짜 구간(startDate~endDate)으로 단순화돼 있고, 도메인 VacationRecord는
// 종류(ANNUAL/REWARD/CONSOLATION/PETITION)·방향(GRANT/USE)·days로 더 세분화돼 있다.
// 어댑터는 이 둘을 date+days ↔ startDate+endDate로 변환한다.
function toContractRecord(record: VacationRecord): ContractVacationRecord {
  const days = Math.max(1, record.days);
  return {
    id: record.id,
    startDate: record.date,
    endDate: addDays(record.date, days - 1),
    type: "LEAVE",
    notes: record.memo || undefined,
  };
}

/** Contract-mandated read (src/lib/contract.ts: getVacationRecordsFn) */
export async function getVacationRecords(): Promise<ContractVacationRecord[]> {
  return loadVacations().map(toContractRecord);
}

/** Contract-mandated write (src/lib/contract.ts: addVacationRecordFn) */
export async function addVacationRecord(
  record: Omit<ContractVacationRecord, "id">
): Promise<ContractVacationRecord> {
  const days = Math.max(1, diffDays(record.startDate, record.endDate) + 1);
  const domainRecord: VacationRecord = {
    id: newId(),
    type: "ANNUAL",
    direction: "USE",
    days,
    date: record.startDate,
    memo: record.notes ?? "",
    createdAt: Date.now(),
  };
  const result = addVacation(domainRecord);
  if (!result.ok) throw new Error(result.error);
  return toContractRecord(domainRecord);
}
