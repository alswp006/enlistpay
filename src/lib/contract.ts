/**
 * 패킷 간 인터페이스 계약 — 자동 생성. **수정하지 마라.**
 *
 * 기반 패킷은 여기 선언된 모양 그대로 구현하고, 화면 패킷은 여기 적힌 이름·인자·반환
 * 타입을 그대로 가정해도 된다. 추측이 어긋나 병합에서 무너지는 것을 막기 위한 파일이다.
 */

/** All domain logic and UI depend on military branch type (구현: 패킷 0001) */
export type MilitaryBranch = 'ARMY' | 'NAVY' | 'AIR_FORCE' | 'MARINE_CORPS';

/** Core entity used in storage (0003), calculations (0005-0008), and all pages (구현: 패킷 0001) */
export type User = { id: string; militaryBranch: MilitaryBranch; enlistmentDate: string; dischargeDate?: string };

/** Route state contract for navigation (0009, 0018) (구현: 패킷 0001) */
export type RouteState = { pathname: string; state?: { [key: string]: unknown } };

/** Ensures Asia/Seoul timezone consistency across calculations (구현: 패킷 0002) */
export type parseSeoulDateFn = (dateString: string) => Date;

/** Ensures Asia/Seoul timezone consistency across calculations (구현: 패킷 0002) */
export type formatSeoulDateFn = (date: Date, format?: string) => string;

/** Used by pay calculation (0007) and salary page (0013) (구현: 패킷 0002) */
export type PayTable = { [rank: string]: { base: number; allowance: number } };

/** Valid keys for storage core wrapper (구현: 패킷 0003) */
export type StorageKey = 'profile' | 'vacation' | 'flags' | 'savingsInput';

/** Core storage abstraction for all repositories (0003, 0004) (구현: 패킷 0003) */
export type storageGetFn = <T>(key: StorageKey) => Promise<T | null>;

/** Core storage abstraction for all repositories (0003, 0004) (구현: 패킷 0003) */
export type storageSetFn = <T>(key: StorageKey, value: T) => Promise<void>;

/** Profile storage contract for AppDataProvider (0009) and Settings (0017) (구현: 패킷 0003) */
export type Profile = { user: User; createdAt: string; updatedAt: string };

/** Load user profile in AppDataProvider (0009) (구현: 패킷 0003) */
export type getProfileFn = () => Promise<Profile | null>;

/** Save profile in Settings (0017) and Onboarding (0010) (구현: 패킷 0003) */
export type saveProfileFn = (profile: Profile) => Promise<void>;

/** Vacation data structure for storage (0004), calculation (0008), and Vacation page (0014) (구현: 패킷 0004) */
export type VacationRecord = { id: string; startDate: string; endDate: string; type: 'LEAVE' | 'ABSENCE'; notes?: string };

/** Load vacation records for aggregation (0008) and Vacation page (0014) (구현: 패킷 0004) */
export type getVacationRecordsFn = () => Promise<VacationRecord[]>;

/** Add vacation record in Vacation page (0014) (구현: 패킷 0004) */
export type addVacationRecordFn = (record: Omit<VacationRecord, 'id'>) => Promise<VacationRecord>;

/** D-day calculation result used in Home hero (0011) and Onboarding preview (0010) (구현: 패킷 0005) */
export type DdayResult = { daysRemaining: number; daysServed: number; progressPercent: number; dischargeDate: string };

/** Core calculation for Home and Onboarding pages (구현: 패킷 0005) */
export type calculateDdayFn = (user: User) => DdayResult;

/** Rank timeline data used in Rank page (0012) and Pay calculation (0007) (구현: 패킷 0006) */
export type RankInfo = { rank: string; promotionDate?: string; daysUntilPromotion?: number };

/** Next promotion info for Rank page (0012) (구현: 패킷 0006) */
export type calculateNextRankFn = (user: User) => RankInfo;

/** Cumulative pay data for Pay page (0013) and SavingsResult (0016) (구현: 패킷 0007) */
export type PaySummary = { totalKrw: number; monthlyBreakdown: Array<{ month: string; amountKrw: number }> };

/** Calculate total accumulated pay from enlistment to today (구현: 패킷 0007) */
export type calculatePaySummaryFn = (user: User) => PaySummary;

/** Vacation aggregation for Vacation page (0014) summary cards (구현: 패킷 0008) */
export type VacationSummary = { totalDays: number; usedDays: number; remainingDays: number };

/** Aggregate vacation days from records (구현: 패킷 0008) */
export type calculateVacationSummaryFn = (records: VacationRecord[]) => VacationSummary;
