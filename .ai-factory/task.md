# TASK — EnlistPay

> SPEC(EnlistPay) 기준 구현 태스크 분해. 각 태스크는 1 코딩 세션(10분 이내) 단위이며, 완료 시점마다 `tsc --noEmit` + `vite build` 가 통과해야 한다.
> 경로 규칙: 도메인 계산 = `src/domain/`, 영속 계층 = `src/storage/`, 화면 = `src/pages/`, 조립 부품 = `src/components/`.

---

## Epic 1. 타입 & 상수 (데이터 계약)

**Risk Analysis**
- **Complexity**: Low
- **Risk factors**
  - 타입이 늦게 확정되면 이후 도메인/화면 태스크가 각자 다른 필드명을 만들어 병합 시 충돌한다.
  - `RouteState` 없이 페이지부터 만들면 `/savings/result` 가 `location.state` 를 임의 형태로 받아 새로고침 시 크래시한다(실사고 패턴).
  - 급여표 상수를 화면에 하드코딩하면 연도 개정 시 전 화면 수정이 필요해진다.
- **Mitigation**: 타입·상수를 최우선 태스크로 고정하고, Epic 2 이후 모든 태스크가 `src/domain/types.ts` 만 import 하도록 Depends 를 강제한다. `RouteState` 를 Task 1.1 DoD 에 포함해 페이지 태스크가 시작되기 전에 계약을 확정한다.

---

### Task 1.1 도메인 타입 + RouteState 정의
- **Description**: SPEC Data Models 의 모든 엔티티/파생 타입과 화면 간 전달 계약(`RouteState`)을 순수 타입으로 선언한다. 런타임 코드(함수·상수) 0줄.
- **DoD**:
  - `src/domain/types.ts` 에 다음이 export 된다: `Branch`, `Rank`, `VacationType`, `VacationDirection`, `ISODate`, `ServiceProfile`, `VacationRecord`, `PayTable`, `SavingsInput`, `SavingsResult`, `AppFlags`, `ServiceStatus`, `RankPeriod`, `MonthlyPayRow`, `SaveResult<T> = { ok: true; value: T } | { ok: false; error: string }`.
  - 동일 파일에 `RouteState` 를 선언한다:
    ```ts
    export type RouteState = {
      '/onboarding': null;
      '/': null;
      '/rank': null;
      '/pay': null;
      '/vacation': null;
      '/savings': null;
      '/savings/result': { input: SavingsInput; result: SavingsResult } | null;
      '/settings': null;
    };
    ```
  - 파일 상단 주석에 수신 측 필수 패턴을 명시한다: `const state = (useLocation().state as RouteState['/savings/result']) ?? null; if (!state) return <Navigate to="/savings" replace />;` — 구조분해 직접 사용 금지.
  - `src/lib/types.ts` 는 `export * from '../domain/types'` 재export 배럴로만 존재한다.
  - `ServiceProfile.schemaVersion` 은 리터럴 타입 `1`.
  - `tsc --noEmit` 통과, 런타임 import 0건.
- **Covers**: (직접 AC 없음 — F1~F8 전 AC의 타입 기반. `RouteState` 계약은 F7-AC5 의 전제)
- **Files**: `src/domain/types.ts`, `src/lib/types.ts`
- **Depends on**: none

---

### Task 1.2 급여표 상수 + 날짜 유틸 + 전역일 계산
- **Description**: 연도별 내장 상수 테이블과 `Asia/Seoul` 로컬 자정 기준 날짜 유틸을 만들고, 그 위에 `calcDischargeDate` 를 구현한다.
- **DoD**:
  - `src/domain/payTable.ts`: SPEC 그대로의 `PAY_TABLE_2025` (`monthlyPay`, `annualLeaveDays`, `defaultServiceMonths`) 와 `BRANCH_LABEL: Record<Branch, string>`(육군/해군/공군/해병대/사회복무), `RANK_LABEL: Record<Rank, string>`(이병/일병/상병/병장) export.
  - `src/domain/date.ts`: `parseISO(s): Date | null`(형식+실존일 검증, `2026-13-45` → `null`), `toISO(d)`, `todayISO()`, `addMonthsClamped(iso, m)`(월말 오버플로는 대상 월 마지막 날로 클램프), `addDays(iso, n)`, `diffDays(a, b)`, `daysInMonth(ym)`, `formatKoreanDate(iso)` → `2027년 7월 4일 (토)`, `formatWon(n)` → `900,000원`.
  - `src/domain/dday.ts` 에 `calcDischargeDate({ enlistDate, serviceMonths })` 구현: `addMonthsClamped(enlistDate, m)` 후 `-1일`.
  - 금지 API 미사용: `Temporal`, `Array.prototype.at`, `structuredClone`, 정규식 lookbehind.
  - 단위 테스트 `src/domain/__tests__/date.test.ts`: `calcDischargeDate('2026-01-05', 18) === '2027-07-04'`, `calcDischargeDate('2026-01-31', 1) === '2026-02-27'`, `parseISO('abcd-99-99') === null` 통과.
- **Covers**: [F1-AC1]
- **Files**: `src/domain/payTable.ts`, `src/domain/date.ts`, `src/domain/dday.ts`, `src/domain/__tests__/date.test.ts`
- **Depends on**: Task 1.1

---

## Epic 2. 도메인 계산 엔진 (순수 함수)

**Risk Analysis**
- **Complexity**: Medium
- **Risk factors**
  - 일할 계산/진급 경계일에서 off-by-one 이 발생하면 D-day·급여·계급이 전부 1일씩 틀어진다(F1-AC2 의 `elapsedDays 178`, F5-AC1 의 `653,226원` 이 곧바로 깨짐).
  - 계산을 화면 컴포넌트에 인라인으로 작성하면 테스트가 불가능해지고 화면마다 값이 달라진다.
  - 복무기간 8개월 미만 등 짧은 구간에서 배열 길이가 4로 고정되면 도달 불가 계급이 렌더된다.
- **Mitigation**: 화면 태스크(Epic 5)보다 먼저 순수 함수 + 단위 테스트를 확정하고, 각 태스크 DoD 에 SPEC 의 기대값을 그대로 테스트 케이스로 박아 넣는다. 화면은 계산 결과를 렌더만 한다.

---

### Task 2.1 복무 현황 계산 (`calcServiceStatus`)
- **Description**: 입대 전/복무 중/전역 후 3단계를 구분하고 총일수·경과일·잔여일·진행률을 계산한다.
- **DoD**:
  - `src/domain/dday.ts` 에 `calcServiceStatus(profile: ServiceProfile, todayISO: string): ServiceStatus` 추가.
  - `totalDays = diffDays(enlist, discharge) + 1`, `elapsedDays = clamp(diffDays(enlist, today) + 1, 0, totalDays)`, `remainingDays = max(diffDays(today, discharge), 0)`, `progressPercent = round1(elapsed/total*100)`.
  - `phase`: `today < enlistDate` → `BEFORE_ENLIST`(elapsedDays 0, progressPercent 0), `today > dischargeDate` → `DISCHARGED`(elapsedDays = totalDays, remainingDays 0, progressPercent 100), 그 외 `IN_SERVICE`.
  - 입대 전 D-day 산출용 `calcDaysUntilEnlist(profile, todayISO)` 도 export(홈 히어로 `입대까지 D-244` 용).
  - 테스트: `{enlistDate:'2026-01-05', serviceMonths:18}` / `2026-07-01` → `{ totalDays:546, elapsedDays:178, remainingDays:368, progressPercent:32.6, phase:'IN_SERVICE' }`, `2025-12-25` → `{ phase:'BEFORE_ENLIST', elapsedDays:0, progressPercent:0, remainingDays:556 }`, `2027-08-01` → `{ phase:'DISCHARGED', elapsedDays:546, remainingDays:0, progressPercent:100 }`.
- **Covers**: [F1-AC2, F1-AC4]
- **Files**: `src/domain/dday.ts`, `src/domain/__tests__/dday.test.ts`
- **Depends on**: Task 1.2

---

### Task 2.2 계급 구간 계산 (`calcRankPeriods` / `getRankAt` / `getNextPromotion`)
- **Description**: 이병 2개월 → 일병 6개월 → 상병 6개월 → 병장(잔여 전체) 규칙으로 계급 구간을 산출하고, 특정 날짜의 계급과 다음 진급 D-day 를 계산한다.
- **DoD**:
  - `src/domain/rank.ts` 에 `calcRankPeriods(profile): RankPeriod[]`, `getRankAt(profile, iso): Rank | null`(입대 전/전역 후 `null`), `getNextPromotion(profile, iso): { rank: Rank; date: ISODate; dday: number } | null` 구현.
  - 구간 경계는 `startDate = 이전 구간 endDate + 1일`, `endDate = addMonthsClamped(start, 기간) - 1일`, 마지막 구간 `endDate = dischargeDate`.
  - 전역일 이후로 넘어가는 계급 구간은 배열에서 제외한다(복무 6개월 → 2행만 반환, 마지막 행 endDate = dischargeDate).
  - `isEarlyDischargeBeforeSergeant(profile): boolean` export (F4-AC5 안내 문구용).
  - 테스트: 18개월 프로필 → 4행이 SPEC F1-AC3 의 4개 객체와 정확히 일치, `getRankAt(p,'2026-07-01') === 'PFC'`, `getNextPromotion(p,'2026-07-01')` → `{ rank:'CORPORAL', date:'2026-09-05', dday:66 }`, `serviceMonths:6` → `[이병 2026.01.05~2026.03.04, 일병 2026.03.05~2026.07.04]` 2행.
- **Covers**: [F1-AC3]
- **Files**: `src/domain/rank.ts`, `src/domain/__tests__/rank.test.ts`
- **Depends on**: Task 2.1

---

### Task 2.3 월별 급여 계산 (`calcMonthlyPayRows`)
- **Description**: 입대월~전역월의 월별 급여 행과 누적/계급별 합계를 계산한다. 첫 달·전역 달만 일할, 나머지는 전액.
- **DoD**:
  - `src/domain/pay.ts` 에 `calcMonthlyPayRows(profile, table): MonthlyPayRow[]`, `sumPaidUntil(rows, todayISO): number`(오늘까지 받은 급여), `sumByRank(rows): Record<Rank, number>` 구현.
  - 월 기준 계급은 해당 월 15일(전역 월은 전역일) 기준 `getRankAt` 결과를 사용.
  - 일할: `round(monthlyPay * servedDays / daysInMonth)`, 중간 달은 `servedDays === daysInMonth` 이므로 전액.
  - 입대 전 프로필이면 `sumPaidUntil` 은 `0` 을 반환한다.
  - 테스트: 18개월 프로필 → `rows.length === 19`, `rows[0]` 이 `{ yearMonth:'2026-01', rank:'PRIVATE', servedDays:27, daysInMonth:31, amount:653226 }`, `2026-07` 행 amount `900000`.
- **Covers**: [F5-AC1]
- **Files**: `src/domain/pay.ts`, `src/domain/__tests__/pay.test.ts`
- **Depends on**: Task 2.2

---

### Task 2.4 휴가 잔여 계산 + 적금 계산
- **Description**: 잔여 휴가 집계 함수와 단리 적립식 적금 계산 함수를 각각 순수 함수로 구현한다.
- **DoD**:
  - `src/domain/vacation.ts`: `calcVacationSummary(branch, records, table): { granted: number; used: number; remaining: number }`. `granted = annualLeaveDays[branch] + Σ(direction==='GRANT'.days)`, `used = Σ(direction==='USE'.days)`, `remaining = granted - used`(음수 허용).
  - `src/domain/savings.ts`: `calcSavings(input: SavingsInput): SavingsResult`. `principal = monthlyDeposit * months`, `interest = round(monthlyDeposit * (annualRatePercent/100/12) * months*(months+1)/2)`, `govMatch = useGovMatch ? principal : 0`, `total = principal + interest + govMatch`.
  - `validateSavingsInput(input): string | null` export — 납입액 0 → `"월 납입액을 입력해주세요"`, >550000 → `"월 납입액은 550,000원 이하로 입력해주세요"`, 금리 <0.1 또는 >20 → `"금리는 0.1% ~ 20.0% 사이로 입력해주세요"`.
  - 테스트: `{400000, 12, 5.0, true}` → `{ principal:4800000, interest:130000, govMatch:4800000, total:9730000 }`, `useGovMatch:false` → `total:4930000`. 휴가: ARMY + `[REWARD/GRANT 4, ANNUAL/USE 6.5]` → `{ granted:28, used:6.5, remaining:21.5 }`.
- **Covers**: [F7-AC1] (+ F6-AC1 계산부)
- **Files**: `src/domain/vacation.ts`, `src/domain/savings.ts`, `src/domain/__tests__/savings.test.ts`, `src/domain/__tests__/vacation.test.ts`
- **Depends on**: Task 1.2

---

## Epic 3. 저장 계층 (localStorage)

**Risk Analysis**
- **Complexity**: Medium
- **Risk factors**
  - `JSON.parse` 실패나 `QuotaExceededError` 가 그대로 throw 되면 앱 전체가 흰 화면이 된다.
  - `console.error` 호출이 남으면 F8-AC4(콘솔 에러 0건)로 검수 반려.
  - 휴가 기록 무제한 저장 시 5MB 한도 접근(항목당 ~150B × 무제한).
  - `crypto.randomUUID()` 미지원 기기(Android 7 WebView)에서 ID 생성이 크래시.
- **Mitigation**: 모든 IO 를 Task 3.1 의 단일 래퍼로 통과시키고 결과를 `SaveResult` 로 반환(throw 금지). 200개 상한을 Task 3.3 DoD 에 못박고, ID 폴백을 3.1 에서 먼저 만든 뒤 3.3 이 사용하게 순서를 고정한다.

---

### Task 3.1 storage 코어 래퍼 (안전 IO + ID 생성)
- **Description**: 모든 localStorage 접근이 거치는 단일 래퍼를 만든다. 파싱 실패 복구, 쿼터 초과 처리, ID 생성 폴백 포함.
- **DoD**:
  - `src/storage/core.ts` 에 `STORAGE_KEYS = { profile:'enlistpay.profile.v1', vacations:'enlistpay.vacations.v1', savings:'enlistpay.savings.v1', flags:'enlistpay.flags.v1' } as const` export.
  - `readJSON<T>(key): T | null` — `JSON.parse` 실패 시 `localStorage.removeItem(key)` 후 `null` 반환. `console.error`/`console.warn` 호출 0건.
  - `writeJSON(key, value): SaveResult<void>` — 성공 `{ok:true}`, `QuotaExceededError` 포함 모든 예외에서 `{ ok:false, error:'저장 공간이 부족해요. 설정에서 기록을 정리해주세요' }` 반환(throw 금지).
  - `removeKeys(keys: string[]): void`, `clearAll(): void`(4개 키 전부 제거).
  - `newId(): string` — `typeof crypto?.randomUUID === 'function'` 이면 사용, 아니면 `` `ep-${Date.now()}-${Math.random().toString(36).slice(2,8)}` ``.
  - 테스트: `setItem` 을 throw 하도록 모킹해도 `writeJSON` 이 예외를 전파하지 않고 `{ok:false}` 를 반환. `'{not-json'` 저장 후 `readJSON` → `null` 이고 키가 삭제됨.
- **Covers**: [F1-AC6, F1-AC7]
- **Files**: `src/storage/core.ts`, `src/storage/__tests__/core.test.ts`
- **Depends on**: Task 1.1

---

### Task 3.2 프로필 저장소 (`profile.ts`)
- **Description**: `ServiceProfile` 의 로드/검증/저장/초기화를 구현한다. 저장 시 `dischargeDate` 파생값을 자동 갱신한다.
- **DoD**:
  - `src/storage/profile.ts` 에 `loadProfile(): ServiceProfile | null`, `saveProfile(input): SaveResult<ServiceProfile>`, `clearAllData(): void` 구현.
  - `saveProfile` 검증 순서: 형식(`parseISO === null` → `{ ok:false, error:'입대일 형식이 올바르지 않아요' }`) → 하한(`< 1990-01-01` → `'입대일은 1990년 1월 1일 이후로 입력해주세요'`) → 상한(`> 오늘+3년` → `'입대일이 너무 먼 미래예요'`) → `serviceMonths` 12~24 범위.
  - 검증 통과 시 `dischargeDate = calcDischargeDate(...)`, `schemaVersion: 1`, `createdAt`(신규만), `updatedAt = Date.now()` 를 채워 `writeJSON` 호출. 쿼터 실패는 `core` 의 에러 문자열을 그대로 전달.
  - `loadProfile` 은 `schemaVersion !== 1` 이거나 필수 필드 누락이면 키 삭제 후 `null` 반환. 어떤 경로에서도 throw/`console.error` 없음.
  - 테스트: `enlistDate:'1989-12-31'` → `{ok:false, error:'입대일은 1990년 1월 1일 이후로 입력해주세요'}`, `'abcd-99-99'` → 형식 에러, 키 미존재 → `loadProfile() === null`.
- **Covers**: [F1-AC5, F1-AC6, F1-AC7, F1-AC8]
- **Files**: `src/storage/profile.ts`, `src/storage/__tests__/profile.test.ts`
- **Depends on**: Task 3.1, Task 1.2
---

### Task 3.3 휴가/적금/플래그 저장소
- **Description**: 나머지 3개 키의 CRUD 를 구현한다. 휴가 기록 200개 상한과 리워드 잠금 해제 시각 갱신을 포함한다.
- **DoD**:
  - `src/storage/vacations.ts`: `loadVacations(): VacationRecord[]`(파싱 실패/비배열 → `[]`), `addVacation(rec: Omit<VacationRecord,'id'|'createdAt'>): SaveResult<VacationRecord>`, `removeVacation(id): SaveResult<void>`.
  - `addVacation` 은 `id = newId()`, `createdAt = Date.now()` 를 채우고 배열 **선두**에 추가한다. 기존 길이가 200 이상이면 `{ ok:false, error:'휴가 기록은 최대 200개까지 저장할 수 있어요' }` 반환(저장 시도 없음). 쓰기 실패 시 메모리 배열을 롤백한다.
  - `days` 검증: `< 0.5` → `'휴가 일수는 0.5일 이상 입력해주세요'`, `> 30` → `'휴가 일수는 30일 이하로 입력해주세요'`, 0.5 단위가 아니면 0.5 단위로 반올림.
  - `src/storage/savings.ts`: `loadSavingsInput(): SavingsInput | null`, `saveSavingsInput(input): SaveResult<void>`.
  - `src/storage/flags.ts`: `loadFlags(): AppFlags`(기본값 `{ onboardingDone:false, rewardUnlockedUntil:0, payTableYear:2025, disclaimerAckAt:0 }`), `saveFlags(patch: Partial<AppFlags>): SaveResult<void>`, `unlockReward(): SaveResult<number>`(= `Date.now() + 86400000` 저장 후 반환), `isRewardUnlocked(now = Date.now()): boolean`.
  - 테스트: 200개 상태에서 추가 → `{ok:false}` 이고 배열 길이 200 유지. `unlockReward()` 후 `loadFlags().rewardUnlockedUntil - Date.now()` 가 86,400,000 ± 1000ms.
- **Covers**: [F5-AC2(저장부), F6-AC2(저장부), F6-AC3(저장부), F6-AC4(검증부), F7-AC2(저장부)]
- **Files**: `src/storage/vacations.ts`, `src/storage/savings.ts`, `src/storage/flags.ts`, `src/storage/__tests__/vacations.test.ts`
- **Depends on**: Task 3.1

---

## Epic 4. 앱 상태 & 전역 가드

**Risk Analysis**
- **Complexity**: Medium
- **Risk factors**
  - 각 페이지가 개별적으로 `loadProfile()` 을 호출하면 첫 프레임 깜빡임과 리다이렉트 중복이 발생하고, 설정에서 입대일을 수정해도 홈 D-day 가 갱신되지 않는다(F8-AC1 실패).
  - 가드가 없으면 프로필 없는 상태의 `/rank`·`/pay` 직접 진입이 `null.enlistDate` 접근으로 크래시한다.
  - ErrorBoundary 부재 시 단일 컴포넌트 예외가 앱 전체 흰 화면으로 이어진다.
- **Mitigation**: 상태 계층(4.1)과 가드(4.2)를 페이지 태스크보다 먼저 완료해, 모든 페이지가 `useAppData()` 훅 하나만 쓰고 방어 로직을 재구현하지 않도록 한다.

---

### Task 4.1 앱 데이터 컨텍스트 (`AppDataProvider` + 훅)
- **Description**: 프로필·휴가·플래그를 앱 진입 시 1회 로드해 컨텍스트로 공유하고, 변경 시 localStorage 와 동기화한다.
- **DoD**:
  - `src/state/AppDataProvider.tsx` 에 `AppDataProvider` 와 `useAppData()` 구현. 값: `{ status: 'loading' | 'ready', profile, vacations, flags, updateProfile(input), addVacationRecord(rec), deleteVacationRecord(id), unlockRewardNow(), resetAll() }`.
  - 마운트 시 `useEffect` 로 storage 를 읽고 `status` 를 `ready` 로 전환한다. 초기 렌더 1프레임은 `loading` — 각 페이지 스켈레톤이 이 값을 사용한다.
  - 모든 mutate 함수는 `SaveResult` 를 반환하고(throw 금지), 성공 시에만 React state 를 갱신한다(실패 시 UI 상태 롤백 유지).
  - `updateProfile` 성공 시 `dischargeDate`/`updatedAt` 이 갱신된 새 객체로 state 를 교체해, 이를 구독하는 홈 D-day 가 즉시 재계산된다.
  - `resetAll()` 은 `clearAll()` 호출 후 `profile=null, vacations=[], flags=기본값` 으로 리셋한다.
  - `src/main.tsx` 가 `AppDataProvider` 로 앱을 감싼 상태로 빌드 통과.
- **Covers**: [F3-AC7, F4-AC7, F8-AC1(상태 재계산부), F8-AC2(초기화부)]
- **Files**: `src/state/AppDataProvider.tsx`, `src/main.tsx`
- **Depends on**: Task 3.2, Task 3.3

---

### Task 4.2 라우트 가드 + ErrorBoundary + NotFound
- **Description**: 온보딩 미완료 리다이렉트 가드, 전역 에러 바운더리, 미정의 경로 화면을 만든다. 아직 라우터에 배선하지 않아도 되며 컴포넌트 단위로 완성한다.
- **DoD**:
  - `src/routes/RequireProfile.tsx`: `status==='loading'` 이면 `children` 대신 스켈레톤 슬롯(`props.fallback`)을 렌더, `status==='ready' && profile===null` 이면 `<Navigate to="/onboarding" replace />`, 그 외 `children`. `console.error` 0건.
  - `src/components/ErrorBoundary.tsx`: 클래스 컴포넌트. `componentDidCatch` 에서 `console.error` 를 호출하지 않고 내부 state 만 갱신. fallback UI 는 `ScreenScaffold` + `Asset.ContentIcon` + `Paragraph.Text` "일시적인 오류가 발생했어요" + `Button display="block"`(높이 48px) "홈으로 이동" → 탭 시 `window.history` 조작 없이 `navigate('/', { replace: true })`(라우터 훅 주입용 래퍼 함수 props). 저장 키는 삭제하지 않는다.
  - `src/pages/NotFoundPage.tsx`: `Asset.ContentIcon` + "존재하지 않는 화면이에요" + `Button display="block"`(48px) "홈으로" → `navigate('/')`.
  - 세 컴포넌트 모두 TDS 컴포넌트만 사용, HEX 색상 0건, Tailwind padding/margin 덮어쓰기 0건, 간격은 `Spacing size={...}`.
- **Covers**: [F3-AC6(가드부), F4-AC6(가드부), F8-AC7, F8-AC8]
- **Files**: `src/routes/RequireProfile.tsx`, `src/components/ErrorBoundary.tsx`, `src/pages/NotFoundPage.tsx`
- **Depends on**: Task 4.1

---

## Epic 5. 화면 (한 태스크 = 한 화면/한 상태)

**Risk Analysis**
- **Complexity**: High
- **Risk factors**
  - TDS 컴포넌트에 인라인 padding/margin 을 덮어써 UI 가 깨지고 검수 반려.
  - `/savings/result` 를 새로고침하거나 직접 진입하면 `location.state === null` 상태로 `.map()` 이 호출돼 크래시(실사고 2026-08-03 SplitMate 패턴, 완주율 0%).
  - `/pay` 리워드 게이트 상태가 잠금/해제 두 갈래라 한 태스크에 넣으면 10분을 초과하고 잠금 상태가 미완성으로 남는다.
  - 광고 배너를 콘텐츠 위에 겹치거나 sticky 로 배치하면 반려.
  - 100개 이상 목록을 전량 마운트하면 저사양 기기에서 스크롤이 끊긴다.
- **Mitigation**: 화면당 최대 8개 AC 를 UI 골격/상호작용 두 태스크로 쪼개고, state 를 받는 `/savings/result` 는 "state null 방어"를 별도 DoD 항목 + AC 로 명시한다. 광고 배치·고지 문구는 Epic 6 에서 전 화면 일괄 점검한다.

---

### Task 5.1 온보딩 화면 골격 + 전역일 미리보기
- **Description**: `/onboarding` 의 정적 골격(군별 Chip 5종, 입대일/닉네임 TextField, 전역일 미리보기 Card, SubmitFooter)을 만들고, 입력에 따라 미리보기가 실시간 갱신되게 한다.
- **DoD**:
  - `src/pages/OnboardingPage.tsx` 를 `ScreenScaffold` + `Top`(타이틀 "입대 정보 입력") 으로 구성. raw `div` 페이지 골격 0건.
  - 군별 `Chip` 5개(육군/해군/공군/해병대/사회복무), 각 터치 타겟 높이 ≥ 44px. 선택 시 `serviceMonths` 가 `PAY_TABLE_2025.defaultServiceMonths` 로 세팅되고 `21개월` 형태의 배지 텍스트가 갱신된다.
  - 입대일 `TextField`(`inputMode="numeric"`, placeholder `2026-01-05`), 닉네임 `TextField`(최대 10자, optional).
  - `data-testid="discharge-preview-card"` 인 TDS `Card` 1개에 `calcDischargeDate` 결과를 t3 강조 타이포로 표시. 입력 유효 시 즉시 갱신: 공군 선택 → `21개월` / `2027-10-04`, 해군 → `20개월` / `2027-09-04`.
  - 하단 고정 `SubmitFooter` + `Button display="block"`(높이 ≥ 48px, 좌측 글자폭 버튼 금지). 필드 포커스 시 콘텐츠 영역이 스크롤되어 footer 버튼이 키보드에 가려지지 않는다.
  - 간격은 `Spacing size={...}` 만 사용. 광고 미배치.
- **Covers**: [F2-AC2, F2-AC6, F2-AC7]
- **Files**: `src/pages/OnboardingPage.tsx`
- **Depends on**: Task 4.1, Task 1.2

---

### Task 5.2 온보딩 검증 · 저장 · 진입 가드
- **Description**: 온보딩의 인라인 검증, 저장, Toast, 리다이렉트를 붙여 플로우를 완성한다.
- **DoD**:
  - "시작하기" 버튼은 군별 미선택 또는 입대일 빈 문자열이면 `disabled` 유지. 빈 상태로 제출 시도 시 TextField 하단에 "입대일을 입력해주세요" 인라인 에러.
  - `2026-13-45` 입력 후 제출 → "존재하지 않는 날짜예요" 인라인 에러, 저장 미발생(`localStorage` 키 미생성).
  - 유효 입력 제출 → `updateProfile` 로 `{ branch:'ARMY', enlistDate:'2026-01-05', serviceMonths:18, dischargeDate:'2027-07-04', schemaVersion:1 }` 저장 + `flags.onboardingDone = true` 저장 → `Toast` "전역일이 계산됐어요" → `navigate('/', { replace: true })`.
  - 저장 실패(`{ok:false}`) 시 화면 유지 + Toast 에 반환된 에러 문자열 표시, 크래시/`console.error` 0건.
  - 마운트 시 `status==='ready' && profile !== null` 이면 즉시 `<Navigate to="/" replace />`.
- **Covers**: [F2-AC1, F2-AC3, F2-AC4, F2-AC5]
- **Files**: `src/pages/OnboardingPage.tsx`
- **Depends on**: Task 5.1

---

### Task 5.3 홈 — D-day 히어로 & 상태 분기
- **Description**: `/` 상단 히어로와 3가지 복무 단계(입대 전/복무 중/전역 완료), 로딩 스켈레톤을 구현한다.
- **DoD**:
  - `src/pages/HomePage.tsx` 를 `ScreenScaffold` + `Top`(우측 설정 아이콘 버튼, 터치 타겟 44px) 으로 구성.
  - `data-testid="dday-hero"` 에 `SummaryHero` CountUp(t1). `IN_SERVICE` → 숫자 `368` + 라벨 `D-368`, 부제 `전역일 2027년 7월 4일 (토)`.
  - `BEFORE_ENLIST` → `입대까지 D-244` 표시. `DISCHARGED` → `전역 완료` 텍스트 + 진행률 `100%`, CountUp 숫자 노드는 렌더하지 않음.
  - `status==='loading'` 프레임에는 `data-testid="home-skeleton"` 렌더, `ready` 전환 후 실제 값 표시(추가 비동기 대기 0ms).
  - 히어로 아래 `Spacing size={24}`.
- **Covers**: [F3-AC1, F3-AC4(히어로부), F3-AC5, F3-AC7]
- **Files**: `src/pages/HomePage.tsx`
- **Depends on**: Task 4.2, Task 2.1

---

### Task 5.4 홈 — 요약 카드 · 네비게이션 · 배너
- **Description**: 진행률/현재 계급/이번 달 급여 카드 + 다음 진급 카드를 붙이고 상세 화면 이동과 배너를 배치한다.
- **DoD**:
  - `data-testid="summary-card"` 인 TDS `Card` 3개를 2열 grid(커스텀 CSS 는 grid 배치에만 사용)로 렌더. 값: 진행률 `32.6%`, 현재 계급 `일병`, 이번 달 급여 `900,000원`(콤마 포맷, t3 강조).
  - 진행률 카드는 `data-testid="progress-bar"` 를 가지며 `aria-valuenow="32.6"`.
  - 다음 진급 카드는 `상병까지 D-66` 표시(`getNextPromotion`). 다음 진급이 없으면 카드 대신 `병장 · 최고 계급` 표시.
  - `BEFORE_ENLIST` 일 때 현재 계급 카드 `입대 전`, 이번 달 급여 카드 `0원`.
  - 각 카드 전체가 탭 영역(높이 ≥ 88px): 계급 카드 → `navigate('/rank')`, 급여 카드 → `navigate('/pay')`, 휴가 카드/진행률 영역 → `navigate('/vacation')`, 설정 아이콘 → `navigate('/settings')`. 모두 state 미전달.
  - `profile === null && status==='ready'` 이면 `Asset.ContentIcon` + "입대 정보를 먼저 입력해주세요" 를 렌더한 뒤 `navigate('/onboarding', { replace: true })`, `console.error` 0건.
  - 마지막 카드 → `Spacing size={24}` → `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />` → `Spacing size={24}` → 탭바 영역 순서. `AdSlot` 컨테이너에 `position: fixed|sticky` 0건, 카드와 겹침 0건.
- **Covers**: [F3-AC2, F3-AC3, F3-AC4(카드부), F3-AC6, F3-AC8]
- **Files**: `src/pages/HomePage.tsx`, `src/components/home/SummaryCard.tsx`
- **Depends on**: Task 5.3, Task 2.2, Task 2.3

---

### Task 5.5 계급 타임라인 화면 — 렌더 & 현재 계급 강조
- **Description**: `/rank` 의 타임라인 카드(계급 행 + 기간 + 월급), 현재 계급 배지, 스켈레톤을 구현한다.
- **DoD**:
  - `src/pages/RankPage.tsx` = `ScreenScaffold` + `Top`(뒤로가기 + "계급 & 월급").
  - `data-testid="rank-timeline-card"` 인 TDS `Card` 1개 안에 `data-testid="rank-row"` `ListRow` 를 `calcRankPeriods` 순서대로 렌더. 18개월 프로필 → 4행(이병→일병→상병→병장).
  - 각 행 표기: 좌측 계급명(t5 굵게) + 기간 `2026.03.05 ~ 2026.09.04`(t7), 우측 월급 `900,000원`(t4 강조). SPEC F4-AC1 의 4행 문자열과 일치.
  - 현재 계급 행에만 `data-testid="rank-current-badge"` TDS `Chip`("현재"). 나머지 행에는 0건.
  - `status==='loading'` 프레임에 `data-testid="rank-skeleton"` 4행 렌더.
  - `ListRow` 에 padding prop/인라인 여백 사용 0건, 간격은 `Spacing`.
- **Covers**: [F4-AC1, F4-AC2, F4-AC4(카드 계약부), F4-AC7]
- **Files**: `src/pages/RankPage.tsx`
- **Depends on**: Task 4.2, Task 2.2

---

### Task 5.6 계급 화면 — 짧은 복무 예외 · CTA · 가드 · 고지
- **Description**: 8개월 미만 복무 케이스, `/pay` 이동 CTA, 프로필 없음 방어, 계산 고지 문구를 붙인다.
- **DoD**:
  - `isEarlyDischargeBeforeSergeant(profile) === true` 이면 도달 불가 계급 행을 렌더하지 않고(`serviceMonths:6` → 2행), 안내 `Paragraph.Text` "복무기간 기준 병장 진급 전 전역 예정이에요" 를 카드 하단에 표시.
  - "누적 급여 상세 보기" `Button display="block"`(높이 ≥ 48px) → 탭 시 `navigate('/pay')`(state 미전달).
  - `RequireProfile` 로 감싸져 프로필 `null` 진입 시 `/onboarding` replace 이동, 크래시·`console.error` 0건.
  - 화면 최하단에 공용 `DisclaimerText` 로 "실제 지급액은 부대·개인 사정에 따라 다를 수 있어요. 참고용 계산 결과예요." 표시(`Paragraph.Text`).
  - `src/components/DisclaimerText.tsx` 를 신규 생성해 이후 `/pay`, `/savings`, `/savings/result`, `/settings` 가 재사용한다.
- **Covers**: [F4-AC3, F4-AC4(버튼 계약부), F4-AC5, F4-AC6, F4-AC8]
- **Files**: `src/pages/RankPage.tsx`, `src/components/DisclaimerText.tsx`
- **Depends on**: Task 5.5

---

### Task 5.7 누적 급여 화면 — 잠금 상태 & 입대 전 빈 상태
- **Description**: `/pay` 의 기본(잠금) 화면을 만든다. 요약 카드 + 블러 플레이스홀더 + 리워드 CTA + 입대 전 빈 상태.
- **DoD**:
  - `src/pages/PayPage.tsx` = `ScreenScaffold` + `Top`(뒤로가기 + "누적 급여"), 탭바 미표시.
  - 잠금 판정은 `isRewardUnlocked()` 사용. 잠금 시 `data-testid="pay-summary-card"` Card 1개(지금까지 받은 급여 = `sumPaidUntil(rows, today)`, 원화 콤마) 만 표시.
  - 월별 내역 자리에는 블러 처리된 플레이스홀더 `ListRow` 3행(`src/components/pay/BlurredPlaceholder.tsx`, 블러는 커스텀 CSS `filter` 만 사용, TDS 여백 덮어쓰기 0건).
  - `data-testid="reward-gate-cta"` `Button display="block"`(높이 ≥ 48px) "광고 보고 상세 내역 확인하기" 표시.
  - `phase === 'BEFORE_ENLIST'` 이면 지금까지 받은 급여 `0원` + `Asset.ContentIcon` + "아직 복무를 시작하지 않았어요" 빈 상태를 표시하고, 리워드 CTA 는 그대로 유지(전역까지 예상 총액은 게이트 뒤에서 확인).
  - 로딩 프레임에는 카드 1개 + 3행 스켈레톤.
- **Covers**: [F5-AC4, F5-AC6]
- **Files**: `src/pages/PayPage.tsx`, `src/components/pay/BlurredPlaceholder.tsx`
- **Depends on**: Task 5.6, Task 2.3, Task 3.3

---

### Task 5.8 누적 급여 화면 — 리워드 게이트 해제 & 상세 목록
- **Description**: `TossRewardAd` 로 CTA 를 감싸 상세를 해제하고, 총액 히어로 · 계급별 MiniBar · 월별 목록(윈도잉)을 렌더한다.
- **DoD**:
  - CTA 를 `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>` 로 감싼다. 시청 완료 콜백 → `unlockRewardNow()` 호출 → `flags.rewardUnlockedUntil === Date.now() + 86400000` 저장 → 상세 렌더로 전환.
  - 실패/중도 종료 콜백 → `Toast` "광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요", `rewardUnlockedUntil` 불변, 잠금 상태 유지, `console.error` 0건.
  - 진입 시 `rewardUnlockedUntil > Date.now()` 이면 게이트 없이 즉시 상세 렌더 + `data-testid="reward-gate-cta"` 노드 0건.
  - 해제 상태 구성: `data-testid="pay-total-hero"` `SummaryHero`(t2 CountUp 누적 총액) → `data-testid="pay-rank-minibar"` `MiniBar` 4개(이병/일병/상병/병장, `sumByRank` 비중) → `data-testid="pay-detail-list"` 월별 `ListRow`(18개월 프로필 기준 19행, 각 44px 이상).
  - 목록은 세로 스크롤 컨테이너 내부에 렌더하고, 행 수 > 40 이면 윈도잉 적용(동시 마운트 ≤ 20행).
  - 목록 아래에 `AdSlot` 배너 배치(목록과 겹침 0건, sticky 0건), 그 아래 `DisclaimerText`.
- **Covers**: [F5-AC2, F5-AC3, F5-AC5, F5-AC7, F5-AC8]
- **Files**: `src/pages/PayPage.tsx`, `src/components/pay/PayDetailList.tsx`
- **Depends on**: Task 5.7

---

### Task 5.9 휴가 화면 — 잔여 요약 & 기록 목록
- **Description**: `/vacation` 의 요약 카드, 사용 비율 MiniBar, 기록 목록, 빈 상태/스켈레톤을 구현한다.
- **DoD**:
  - `src/pages/VacationPage.tsx` = `ScreenScaffold` + `Top`("휴가") + 탭바 노출.
  - `data-testid="vacation-summary-card"` Card 1개에 총 부여/사용/잔여 3지표(잔여는 t2 강조). ARMY + `[REWARD/GRANT 4, ANNUAL/USE 6.5]` → `28일 / 6.5일 / 21.5일`. 잔여가 음수면 `-3일` 형태로 표기.
  - 요약 아래 `MiniBar`(사용 비율) → `Spacing size={16}` → 기록 목록.
  - 기록 `ListRow`: 좌측 `종류 배지 + 부여/사용 + 메모`, 우측 `일수`, 날짜 표기. 각 행 및 삭제 버튼 터치 타겟 ≥ 44px. 정렬은 `createdAt` 내림차순.
  - 기록 100개 저장 상태에서 최초 마운트 행 ≤ 20, 스크롤 시 추가 로드(무한 스크롤 또는 윈도잉).
  - 빈 배열이면 `Asset.ContentIcon` + "아직 휴가 기록이 없어요. 포상 휴가를 받으면 기록해보세요". 로딩 프레임에는 `data-testid="vacation-skeleton"`.
  - 목록 아래 `AdSlot` → `Spacing size={24}` → 탭바.
- **Covers**: [F6-AC1, F6-AC6, F6-AC7]
- **Files**: `src/pages/VacationPage.tsx`
- **Depends on**: Task 4.2, Task 2.4, Task 3.3

---

### Task 5.10 휴가 화면 — 기록 추가 BottomSheet & 삭제
- **Description**: 기록 추가 폼(BottomSheet), 입력 검증, 초과 사용 경고, 삭제 확인 다이얼로그를 구현한다. 라우트 이동 없음.
- **DoD**:
  - "기록 추가" `Button display="block"`(≥48px) 탭 → `BottomSheet` 오픈. 폼 요소: 종류 `Chip` 4종(정기/포상/위로/청원), 방향 `Chip` 2종(부여/사용), 일수 `TextField`(`inputMode="decimal"`), 날짜 `TextField`(`inputMode="numeric"`), 메모 `TextField`(최대 30자).
  - 저장 성공 → `addVacationRecord` 로 배열에 1건 추가(`id`, `createdAt` 채워짐) → 시트 닫힘 → `Toast` "휴가 기록을 저장했어요" → 목록 최상단에 새 항목 노출.
  - 검증: `days: 0` → "휴가 일수는 0.5일 이상 입력해주세요", `days: 31` → "휴가 일수는 30일 이하로 입력해주세요" 인라인 에러 + 저장 미발생. 날짜는 `enlistDate ≤ date ≤ dischargeDate` 범위 밖이면 인라인 에러.
  - `direction:'USE'` 이면서 `days > remaining` 이면 `AlertDialog` "잔여 휴가(2일)보다 많아요. 그래도 저장할까요?" 표시 → "저장" 확인 시 저장되고 요약 잔여가 `-3일` 로 갱신, "취소" 시 저장 미발생.
  - 삭제: `ListRow` 삭제 버튼 → `AlertDialog` → "삭제" 확인 시 해당 `id` 제거 + `Toast` "기록을 삭제했어요", "취소" 시 배열 길이 불변.
  - 일수 TextField 포커스 시 `inputMode="decimal"` 키보드가 뜨고 시트 콘텐츠가 스크롤되어 저장 버튼이 항상 보인다.
  - 200개 상한 초과 저장 시 반환 에러 문자열을 Toast 로 노출하고 시트를 유지한다.
- **Covers**: [F6-AC2, F6-AC3, F6-AC4, F6-AC5, F6-AC8]
- **Files**: `src/pages/VacationPage.tsx`, `src/components/vacation/VacationFormSheet.tsx`
- **Depends on**: Task 5.9

---

### Task 5.11 적금 입력 화면 — 프리필 · 검증 · 결과 이동
- **Description**: `/savings` 입력 폼, 잔여 복무 기반 프리필, 인라인 검증, 결과 화면 네비게이션을 구현한다.
- **DoD**:
  - `src/pages/SavingsPage.tsx` = `ScreenScaffold` + `Top`("전역 목돈 계산") + 탭바 노출. 필드 간격 `Spacing size={16}`.
  - 필드: 월 납입액 `TextField`(`inputMode="numeric"`) + 빠른 금액 `Chip` 4개(20만/30만/40만/55만, 터치 44px), 납입 개월 `TextField`, 연 금리 `TextField`(`inputMode="decimal"`), 정부 매칭 `ListRow`(높이 56px) + 우측 `Switch`.
  - 프리필: `enlistpay.savings.v1` 존재 시 그 값, 없으면 `monthlyDeposit:400000`, `annualRatePercent:5.0`, `useGovMatch:true`, `months = min(floor(remainingDays/30.4), 18)`(2026-07-01 기준 `12`).
  - 검증(`validateSavingsInput`): 600000 → "월 납입액은 550,000원 이하로 입력해주세요", 0 → "월 납입액을 입력해주세요", 금리 `-1`/`25` → "금리는 0.1% ~ 20.0% 사이로 입력해주세요". 에러 시 인라인 표시 + `navigate` 미호출.
  - 통과 시 `saveSavingsInput(input)` 저장 후 `navigate('/savings/result', { state: { input, result } })` — state 타입은 `RouteState['/savings/result']` 와 일치.
  - 제출 버튼은 하단 고정 `SubmitFooter` + `display="block"`(≥48px). 탭 직후 `loading` 상태로 전환되어 중복 탭이 무시되고 300ms 이내 이동.
  - 광고 미배치, 하단에 `DisclaimerText`.
- **Covers**: [F7-AC2, F7-AC3, F7-AC4, F7-AC6, F7-AC8]
- **Files**: `src/pages/SavingsPage.tsx`
- **Depends on**: Task 4.2, Task 2.4, Task 3.3

---

### Task 5.12 적금 결과 화면 (state null 방어 포함)
- **Description**: `/savings/result` 에서 전달받은 계산 결과를 렌더하고, state 없는 직접 진입을 안전하게 처리한다.
- **DoD**:
  - **필수 방어 패턴**: `const state = (useLocation().state as RouteState['/savings/result']) ?? null; if (!state) return <Navigate to="/savings" replace />;` — 구조분해 즉시 사용/체이닝(`(useLocation().state as X).result.total`) 금지.
  - **state 없이 `/savings/result` 로 직접 진입하거나 새로고침해도 크래시하지 않고 `/savings` 로 replace 이동한다. `console.error` 0건.**
  - `ScreenScaffold` + `Top`(뒤로가기 + "예상 수령액").
  - `data-testid="savings-total-hero"` `SummaryHero` t2 CountUp 에 `9,730,000원` 표시 → `Spacing size={24}` → `data-testid="savings-breakdown-card"` Card 1개에 `ListRow` 3행(원금 `4,800,000원` / 이자 `130,000원` / 정부지원금 `4,800,000원`).
  - `data-testid="savings-minibar"` `MiniBar` 3개로 구성 비중 시각화.
  - breakdown 카드 아래 `AdSlot` → 하단 `DisclaimerText`.
  - "조건 다시 설정" `Button display="block"`(≥48px) → `navigate('/savings', { replace: true })`. 탭바 미표시.
- **Covers**: [F7-AC5, F7-AC7]
- **Files**: `src/pages/SavingsResultPage.tsx`
- **Depends on**: Task 5.11

---

### Task 5.13 설정 화면 — 입대 정보 수정 & 데이터 초기화
- **Description**: `/settings` 의 항목 리스트, 입대 정보 수정 BottomSheet, 초기화 AlertDialog 를 구현한다.
- **DoD**:
  - `src/pages/SettingsPage.tsx` = `ScreenScaffold` + `Top`(뒤로가기 + "설정"), 탭바 미표시. `ListRow` 4개("입대 정보 수정", "급여표 기준 연도"(값 `2025년`, 표시 전용), "앱 정보", "데이터 초기화"), 각 높이 56px.
  - 파괴적 액션("데이터 초기화")은 `Spacing size={24}` 로 분리된 마지막 그룹.
  - "입대 정보 수정" 탭 → `BottomSheet`(군별 `Chip` + 입대일 `TextField` + 복무기간). 입대일을 `2026-02-01` 로 저장 → `enlistDate='2026-02-01'`, `dischargeDate='2027-07-31'`, `updatedAt` 갱신 → `Toast` "입대 정보를 수정했어요" → 시트 닫힘. 홈 복귀 시 D-day 가 새 전역일 기준으로 재계산된다(컨텍스트 state 갱신으로 자동).
  - 저장 실패 시 Toast "저장 공간이 부족해요. 설정에서 기록을 정리해주세요" 표시, 값 롤백.
  - "데이터 초기화" 탭 → `AlertDialog` "모든 기록이 삭제돼요. 삭제할까요?" → "삭제" 확인 시 `enlistpay.profile.v1`, `enlistpay.vacations.v1`, `enlistpay.savings.v1`, `enlistpay.flags.v1` 4개 키 전부 제거 후 `navigate('/onboarding', { replace: true })`. "취소" 시 키 4개 모두 유지.
  - 하단에 기기 변경 시 데이터 미이전 안내 + `DisclaimerText` 전문 표시. 프로필 읽기 전 프레임은 `ListRow` 값 자리 스켈레톤.
- **Covers**: [F8-AC1, F8-AC2]
- **Files**: `src/pages/SettingsPage.tsx`, `src/components/settings/ProfileEditSheet.tsx`
- **Depends on**: Task 5.12, Task 4.1

---

## Epic 6. 통합 · 광고 배치 · 검수 정책

**Risk Analysis**
- **Complexity**: Medium
- **Risk factors**
  - 라우터 배선 누락 시 화면은 완성됐지만 도달 불가(완주율 0%).
  - 탭바가 `/pay`·`/savings/result`·`/settings`·`/onboarding` 에도 뜨면 화면 정의 위반이며 하단 콘텐츠를 가린다.
  - HEX 색상 1건, `window.open` 1건, 잔존 `console.error` 1건만으로도 검수 반려(F8-AC3/4/5).
  - 배너가 탭바에 가려지거나 sticky 로 남으면 반려.
- **Mitigation**: 모든 화면 완성 후 배선(6.1) → 광고/여백 일괄 점검(6.2) → 정적 스캔(6.3) 순으로 배치해, 스캔 시점에 검사 대상 소스가 전부 존재하도록 순서를 고정한다.

---

### Task 6.1 라우터 배선 + FloatingTabBar + 가드 적용
- **Description**: 전체 라우트를 `BrowserRouter` 로 연결하고 탭바 노출 규칙과 가드를 적용한다.
- **DoD**:
  - `src/App.tsx` 에 라우트 8개 + `*` 등록: `/onboarding`, `/`, `/rank`, `/pay`, `/vacation`, `/savings`, `/savings/result`, `/settings`, `*` → `NotFoundPage`.
  - `/onboarding` 을 제외한 모든 라우트를 `RequireProfile` 로 감싼다(프로필 `null` → `/onboarding` replace).
  - 전체를 `ErrorBoundary` 로 감싸고, `ErrorBoundary` 는 라우터 내부에 위치해 "홈으로 이동" 버튼이 `navigate('/', { replace: true })` 를 호출할 수 있게 한다.
  - `FloatingTabBar` 4탭(홈 `/`, 계급 `/rank`, 휴가 `/vacation`, 적금 `/savings`), 각 아이템 터치 타겟 48×48px. `/onboarding`, `/pay`, `/savings/result`, `/settings` 에서는 렌더하지 않는다.
  - `/unknown-path` 진입 시 `Asset.ContentIcon` + "존재하지 않는 화면이에요" + "홈으로" 버튼(≥48px) → 탭 시 `/` 이동.
  - `vite build` 통과, 전 라우트 수동 순회 시 흰 화면 0건.
- **Covers**: [F8-AC8] (+ F3-AC6/F4-AC6 가드 배선 확정)
- **Files**: `src/App.tsx`, `src/components/FloatingTabBar.tsx`(노출 규칙만 수정)
- **Depends on**: Task 5.13, Task 4.2

---

### Task 6.2 광고 배치 · 여백 · 고지 문구 최종 점검
- **Description**: 배너/리워드 배치 규칙과 계산 고지 문구를 전 화면에서 통일하고, TDS 여백 규칙 위반을 제거한다.
- **DoD**:
  - `AdSlot` 배치 확인: `/`(마지막 카드 아래, 탭바 위, 양쪽 `Spacing size={24}`), `/rank`(CTA 버튼 아래·고지 위), `/pay`(월별 목록 아래), `/vacation`(목록 아래), `/savings/result`(breakdown 카드 아래). `/onboarding`, `/savings` 에는 0건.
  - 소스 전체에서 `AdSlot` 컨테이너의 `position: fixed|sticky` 사용 0건, 배너가 콘텐츠와 겹치는 지점 0건(탭바 화면은 배너와 탭바 사이 `Spacing size={24}` 확보).
  - 리워드는 `/pay` 1곳에서만 `TossRewardAd` 로 사용된다.
  - 계산 결과가 노출되는 전 화면(`/`, `/rank`, `/pay`, `/savings`, `/savings/result`, `/settings`)에 `DisclaimerText` 가 하단에 존재한다.
  - 정적 점검: TDS 컴포넌트(`ListRow`, `Button`, `Card`, `TextField`, `Chip`)에 `style={{ padding | margin }}` 또는 Tailwind `p-*|m-*` 적용 0건. 커스텀 CSS 는 flex/grid 배치 파일에만 존재.
  - 모든 1차 액션 버튼이 `display="block"` 이며 높이 ≥ 48px, 탭 가능한 요소 최소 44×44px.
- **Covers**: [F3-AC8(검증), F4-AC8(검증), F5-AC8(배너부), F7-AC7(배너부)]
- **Files**: `src/pages/*.tsx`, `src/components/DisclaimerText.tsx`
- **Depends on**: Task 6.1

---

### Task 6.3 검수 정책 정적 스캔 & 프로덕션 순회 검증
- **Description**: 토스 검수 반려 요인을 스크립트로 스캔하고, 프로덕션 빌드에서 전 화면을 순회해 콘솔/네트워크 정책을 검증한다.
- **DoD**:
  - `scripts/policy-check.mjs` 작성 후 `npm run policy-check` 로 실행, 아래 항목 전부 0건일 때만 exit 0:
    - `window.open(` , `window.location.href =` , 외부 `http(s)://` 를 `href` 로 가진 `<a>` 태그
    - 문구 "설치", "다운로드"(앱 설치 유도)
    - HEX 색상 리터럴 `#RGB`/`#RRGGBB` (`src/**/*.{ts,tsx,css}`)
    - `console.error(` / `console.warn(` 잔존 호출
    - `grantPromotionReward` 호출
    - 외부 분석 SDK import(`gtag`, `amplitude`, `@sentry`, `analytics`)
    - 금지 API(`Temporal`, `structuredClone`, `.at(`, 정규식 lookbehind)
  - 색상은 `var(--tds-color-*)` 또는 TDS 기본값만 사용됨을 확인하고, 다크모드 토글 상태에서 8개 화면 텍스트/배경 대비가 유지되는지 육안 확인.
  - `vite build` 후 프리뷰에서 `/onboarding → / → /rank → /pay → /vacation → /savings → /savings/result → /settings` 순회: `console.error` 0건, 앱 코드 발신 외부 도메인 fetch/XHR 0건(따라서 CORS 에러 0건), 번들 내 외부 분석 스크립트 0건.
  - `package.json` 에 `"policy-check"` 스크립트 등록.
- **Covers**: [F8-AC3, F8-AC4, F8-AC5, F8-AC6]
- **Files**: `scripts/policy-check.mjs`, `package.json`
- **Depends on**: Task 6.2

---

## AC Coverage

- **Total ACs in SPEC**: 63 (F1: 8, F2: 7, F3: 8, F4: 8, F5: 8, F6: 8, F7: 8, F8: 8)
- **Covered by tasks**: 63

| Feature | AC → Task |
|---|---|
| **F1** (8) | AC1→1.2 · AC2→2.1 · AC3→2.2 · AC4→2.1 · AC5→3.2 · AC6→3.1, 3.2 · AC7→3.1, 3.2 · AC8→3.2 |
| **F2** (7) | AC1→5.2 · AC2→5.1 · AC3→5.2 · AC4→5.2 · AC5→5.2 · AC6→5.1 · AC7→5.1 |
| **F3** (8) | AC1→5.3 · AC2→5.4 · AC3→5.4 · AC4→5.3, 5.4 · AC5→5.3 · AC6→4.2, 5.4 · AC7→4.1, 5.3 · AC8→5.4, 6.2 |
| **F4** (8) | AC1→5.5 · AC2→5.5 · AC3→5.6 · AC4→5.5, 5.6 · AC5→5.6 · AC6→4.2, 5.6 · AC7→4.1, 5.5 · AC8→5.6, 6.2 |
| **F5** (8) | AC1→2.3 · AC2→3.3, 5.8 · AC3→5.8 · AC4→5.7 · AC5→5.8 · AC6→5.7 · AC7→5.8 · AC8→5.8, 6.2 |
| **F6** (8) | AC1→2.4, 5.9 · AC2→3.3, 5.10 · AC3→3.3, 5.10 · AC4→3.3, 5.10 · AC5→5.10 · AC6→5.9 · AC7→5.9 · AC8→5.10 |
| **F7** (8) | AC1→2.4 · AC2→3.3, 5.11 · AC3→5.11 · AC4→5.11 · AC5→5.12 · AC6→5.11 · AC7→5.12, 6.2 · AC8→5.11 |
| **F8** (8) | AC1→4.1, 5.13 · AC2→4.1, 5.13 · AC3→6.3 · AC4→6.3 · AC5→6.3 · AC6→6.3 · AC7→4.2 · AC8→4.2, 6.1 |

- **Uncovered**: 0

### 추가 검증 항목 (실사고 방지 — SPEC AC 외 필수 DoD)
- **Task 5.12**: `/savings/result` 를 state 없이 직접 진입/새로고침해도 크래시하지 않고 `/savings` 로 복귀한다. (2026-08-03 SplitMate 사고 대응 — `location.state` 미확인 `.map()` 호출로 가상 사용자 3인 전원 결과 화면에서 완주 실패)
- **Task 4.2 / 6.1**: `/rank`, `/pay`, `/vacation`, `/savings`, `/settings` 를 프로필 없이 직접 진입해도 크래시 없이 `/onboarding` 으로 replace 이동한다.