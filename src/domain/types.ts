/**
 * 도메인 타입 + RouteState 계약 — 순수 타입 선언 전용 파일. 런타임 코드 0줄.
 * 모든 도메인·저장·화면 패킷은 `@/lib/types`(배럴)를 통해 여기 타입만 import한다.
 *
 * RouteState 수신 패턴 (state가 있는 라우트에서 사용):
 * const state = (useLocation().state as RouteState['/savings/result']) ?? null;
 * if (!state) return <Navigate to="/savings" replace />;
 */

export type Branch = "ARMY" | "NAVY" | "AIR_FORCE" | "MARINE" | "SOCIAL";
export type Rank = "PRIVATE" | "PFC" | "CORPORAL" | "SERGEANT";
export type VacationType = "ANNUAL" | "REWARD" | "CONSOLATION" | "PETITION";
export type VacationDirection = "GRANT" | "USE";
export type ISODate = string; // 'YYYY-MM-DD'

export interface ServiceProfile {
  schemaVersion: 1;
  branch: Branch;
  enlistDate: ISODate;
  serviceMonths: number;
  dischargeDate: ISODate;
  nickname: string;
  createdAt: number;
  updatedAt: number;
}

export interface VacationRecord {
  id: string;
  type: VacationType;
  direction: VacationDirection;
  days: number;
  date: ISODate;
  memo: string;
  createdAt: number;
}

export interface PayTable {
  year: number;
  monthlyPay: Record<Rank, number>;
  annualLeaveDays: Record<Branch, number>;
  defaultServiceMonths: Record<Branch, number>;
}

export interface SavingsInput {
  monthlyDeposit: number;
  months: number;
  annualRatePercent: number;
  useGovMatch: boolean;
}

export interface SavingsResult {
  principal: number;
  interest: number;
  govMatch: number;
  total: number;
}

export interface AppFlags {
  onboardingDone: boolean;
  rewardUnlockedUntil: number;
  payTableYear: number;
  disclaimerAckAt: number;
}

export interface ServiceStatus {
  enlistDate: ISODate;
  dischargeDate: ISODate;
  totalDays: number;
  elapsedDays: number;
  remainingDays: number;
  progressPercent: number;
  phase: "BEFORE_ENLIST" | "IN_SERVICE" | "DISCHARGED";
}

export interface RankPeriod {
  rank: Rank;
  startDate: ISODate;
  endDate: ISODate;
  monthlyPay: number;
}

export interface MonthlyPayRow {
  yearMonth: string; // 'YYYY-MM'
  rank: Rank;
  servedDays: number;
  daysInMonth: number;
  amount: number;
}

export type SaveResult = { ok: true } | { ok: false; error: string };

export interface RouteState {
  "/onboarding": null;
  "/": null;
  "/rank": null;
  "/pay": null;
  "/vacation": null;
  "/savings": null;
  "/savings/result": { input: SavingsInput; result: SavingsResult } | null;
  "/settings": null;
}
