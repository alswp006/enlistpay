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
export type MilitaryBranch = type MilitaryBranch = 'ARMY' | 'NAVY' | 'AIR_FORCE' | 'MARINE_CORPS';

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

/** Rank timeline data used in Rank page (0012) and Pay calcu
```

## Shared Types Contract (IMPORT these, do NOT redefine)
```typescript
// Domain types — add your app-specific types here
export {};

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
  hooks/
  lib/
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
  styles/
    globals.css
    reward-ad.css
  types/
  vite-env.d.ts

### Exports (src/lib/)
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