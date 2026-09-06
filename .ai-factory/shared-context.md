# Shared Context (auto-generated — do NOT modify)


## 패킷 간 계약 (src/lib/contract.ts — 자동 생성, 수정 금지)
여기 선언된 이름·인자·반환 타입은 확정이다. 기반 패킷은 이대로 구현하고,
화면 패킷은 이대로 호출하라. 다르게 만들지 마라.

```typescript
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

/** Rank timeline data used in Rank page (0012) and Pay calculation (0007) (구현: 패킷 
```

## Shared Types Contract (IMPORT these, do NOT redefine)
```typescript
export * from '../domain/types';

```

## Existing Codebase (import and use these — do NOT recreate)
### File Tree (src/)
  App.tsx
  components/
    AdSlot.tsx
    Amount.tsx
    BottomCTA.tsx
    Card.tsx
    CountUp.tsx
    FloatingTabBar.tsx
    MiniBar.tsx
    PageShell.tsx
    ScreenScaffold.tsx
    Sparkline.tsx
    StateView.tsx
    SummaryHero.tsx
    TossPurchase.tsx
    TossRewardAd.tsx
  domain/
    __tests__/
    date.ts
    dday.ts
    pay.ts
    payTable.ts
    rank.ts
    savings.ts
    types.ts
    vacation.ts
  hooks/
  lib/
    contract.ts
    storage.ts
    types.ts
    utils.ts
  main.tsx
  pages/
    Home.tsx
    NotFound.tsx
    Onboarding.tsx
    Pay.tsx
    Rank.tsx
    Savings.tsx
    SavingsResult.tsx
    Settings.tsx
    Vacation.tsx
    __TdsGallery.tsx
  storage/
    __tests__/
    core.ts
    flags.ts
    profile.ts
    savingsInput.ts
    vacation.ts
  styles/
    globals.css
    reward-ad.css
  types/
  vite-env.d.ts

### Exports (src/lib/)
- contract.ts: export type MilitaryBranch = 'ARMY' | 'NAVY' | 'AIR_FORCE' | 'MARINE_CORPS'; export type User =; export type RouteState =; export type parseSeoulDateFn = (dateString: string) => Date; export type formatSeoulDateFn = (date: Date, format?: string) => string; export type PayTable =; export type StorageKey = 'profile' | 'vacation' | 'flags' | 'savingsInput'; export type storageGetFn = <T>(key: StorageKey) => Promise<T | null>
- storage.ts: export function getItem<T>(key: string): T | null; export function setItem<T>(key: string, value: T): void; export function removeItem(key: string): void
- utils.ts: export function cn(...classes: (string | boolean | undefined | null)[]): string; export function formatNumber(n: number): string; export function formatCurrency(n: number, currency = 'KRW'): string

### Components (src/components/)
- AdSlot.tsx: AdSlot
- Amount.tsx: Amount
- BottomCTA.tsx: SubmitFooter, ButtonStack
- Card.tsx: Card
- CountUp.tsx: CountUp
- FloatingTabBar.tsx: FloatingTabBar
- MiniBar.tsx: MiniBar
- PageShell.tsx: PageShell
- ScreenScaffold.tsx: ScreenScaffold
- Sparkline.tsx: Sparkline
- StateView.tsx: EmptyState, LoadingState
- SummaryHero.tsx: SummaryHero
- TossPurchase.tsx: TossPurchase
- TossRewardAd.tsx: TossRewardAd
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.

## Already Implemented (do NOT duplicate or overwrite)
- 0001: 도메인 타입 + RouteState 계약 정의 (files: src/domain/types.ts, src/lib/types.ts)
- 0002: 급여표 상수 + Asia/Seoul 날짜 유틸 (files: src/domain/payTable.ts, src/domain/date.ts, src/domain/__tests__/date.test.ts)
- 0003: storage 코어 래퍼 + 프로필 저장소 (files: src/storage/core.ts, src/storage/profile.ts, src/storage/__tests__/profile.test.ts)
- 0004: 휴가 · 플래그 · 적금입력 저장소 (files: src/storage/vacation.ts, src/storage/flags.ts, src/storage/savingsInput.ts, src/storage/__tests__/vacation.test.ts)
- 0005: 복무 현황 계산 (전역일 · D-day · 진행률) (files: src/domain/dday.ts, src/domain/__tests__/dday.test.ts)
- 0006: 계급 구간 · 다음 진급 계산 (files: src/domain/rank.ts, src/domain/__tests__/rank.test.ts)
- 0007: 월별 급여 계산 · 누적 합계 (files: src/domain/pay.ts, src/domain/__tests__/pay.test.ts)
- 0008: 휴가 집계 · 적금 계산 + 입력 검증 (files: src/domain/vacation.ts, src/domain/savings.ts, src/domain/__tests__/savings.test.ts)

## Available exports from existing files
// src/App.tsx
export default function App() {

// src/components/AdSlot.tsx
export function AdSlot({ adGroupId, className, variant, theme }: AdSlotProps) {

// src/components/Amount.tsx
export function Amount({

// src/components/BottomCTA.tsx
export function SubmitFooter({
export function ButtonStack({

// src/components/Card.tsx
export function Card({

// src/components/CountUp.tsx
export function CountUp({

// src/components/FloatingTabBar.tsx
export type TabItem = {
export function FloatingTabBar({ items }: { items: TabItem[] }) {

// src/components/MiniBar.tsx
export function MiniBar({

// src/components/PageShell.tsx
export function PageShell({ children, style }: { children: ReactNode; style?: CSSProperties }) {

// src/components/ScreenScaffold.tsx
export function ScreenScaffold({

// src/components/Sparkline.tsx
export function Sparkline({

// src/components/StateView.tsx
export function EmptyState({
export function LoadingState({

// src/components/SummaryHero.tsx
export function SummaryHero({

// src/components/TossPurchase.tsx
export interface TossPurchaseResult {
export function TossPurchase({

// src/components/TossRewardAd.tsx
export function TossRewardAd({

// src/domain/date.ts
export function daysInMonth(year: number, month: number): number {
export function parseISO(iso: string): Date | null {
export function toISO(date: Date): ISODate {
export function todayISO(): ISODate {
export function addMonthsClamped(iso: ISODate, months: number): ISODate {
export function addDays(iso: ISODate, days: number): ISODate {
export function diffDays(from: ISODate, to: ISODate): number {
export function formatKoreanDate(iso: ISODate): string {
export function parseSeoulDate(dateString: string): Date {
export function formatSeoulDate(date: Date, format: string = "YYYY-MM-DD"): string {

// src/domain/dday.ts
export function calcDischargeDate({
export function calcServiceStatus(profile: ServiceProfile, todayISO: ISODate): ServiceStatus {
export function calcDaysUnti

## Memory Index (자동 학습 — 힌트로만 사용, 실제 코드 확인 필수)

Available topics: deploy(2), general(12), testing(1), ui(1)

Key lessons (verify against actual code before applying):
- [general] 화면·라우팅 등 소비자 모듈은 그것이 import하는 생산자 모듈이 병합된 뒤에만 병합하고, 순서를 지킬 수 없으면 소비자 병합과 동시에 최소 플레이스홀더를 만들어 매 병합 직후 타입체크와 빌드가 항상 통과하도록 유지하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 전역 라우팅·탭바·Provider 배선은 개별 화면보다 먼저(초반 20% 안에) 완료하고 미구현 화면은 스텁 라우트로 연결해, 시간 예산이 소진돼도 앱이 항상 실행 가능한 상태를 유지하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 저장·데이터 접근 등 기반 계층 패킷은 이를 import 하는 화면 패킷보다 반드시 먼저 완료·병합하고, 미완료면 상위 화면 패킷 병합을 차단하라 — 빈 기반 모듈 하나가 전 라우트 스모크를 무너뜨린다. (60% · 타 앱 1회 — 맹신 금지)
- [general] 외부에서 들어온 모든 값(라우터 state, 로컬 저장소, 부분 입력 폼)은 사용 직전에 배열·객체 기본값으로 정규화하고, 테이블/맵 조회 결과는 존재 확인 후에만 하위 속성이나 length에 접근하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 의존 그래프 최하층의 타입·계약 파일은 런타임 코드 0줄의 순수 선언으로 가장 먼저 단독 타입체크를 통과시키고, 파일 생성은 셸 명령이 아닌 허용된 편집 도구로만 하게 강제하라. (60% · 타 앱 1회 — 맹신 금지)