# SPEC — EnlistPay

> 앱인토스 미니앱 · Vite + React + TypeScript + TDS(@toss/tds-mobile) + React Router + localStorage
> PRD(EnlistPay) 기준 확장 스펙. 본 문서의 모든 AC는 기계 검증 가능(구체 값 포함) 형태로 작성됨.

---

## Common Principles

### CP-1. 기술/구조 원칙
- 라우팅은 `react-router-dom`의 `BrowserRouter` 기반 클라이언트 라우팅만 사용한다. 서버 코드 없음, 외부 API 호출 없음.
- 모든 영속 데이터는 `localStorage`에 저장한다(템플릿 제공 storage helper 사용). 총 사용량 5MB 미만.
- 날짜/급여/휴가/적금 계산은 전부 순수 함수로 `src/domain/`에 분리한다(`dday.ts`, `rank.ts`, `pay.ts`, `vacation.ts`, `savings.ts`). UI 컴포넌트 안에서 계산 로직을 인라인으로 작성하지 않는다 — 단위 테스트 대상.
- 날짜는 `YYYY-MM-DD` 문자열로 저장하고, 계산 시 `Asia/Seoul` 로컬 자정(00:00:00)으로 정규화한 뒤 비교한다. `Date` 객체를 직접 localStorage에 저장하지 않는다.
- 호환성: Android 7+/iOS 16+ 대응. `Temporal`, `Array.prototype.at`, `structuredClone`, 정규식 lookbehind 등 최신 전용 API 사용 금지. `crypto.randomUUID()`는 미지원 폴백(`ep-${Date.now()}-${Math.random().toString(36).slice(2,8)}`)을 반드시 둔다.

### CP-2. UI 원칙 (TDS)
- 모든 화면은 템플릿의 `ScreenScaffold`(또는 `PageShell`)로 감싼다. raw `div` 페이지 골격 금지.
- TDS 핵심 컴포넌트(`Top`, `ListRow`, `Button`, `TextField`, `Paragraph.Text`, `Chip`, `Switch`, `AlertDialog`, `BottomSheet`, `Toast`, `Tab`, `Spacing`, `Card`, `Asset.ContentIcon`)만 사용. shadcn/ui, MUI, Ant Design, Chakra 사용 금지.
- 여백은 TDS `Spacing`(size prop 필수)으로만 조절한다. TDS 컴포넌트에 Tailwind/인라인 padding·margin 덮어쓰기 금지. 커스텀 CSS는 flex/grid 배치에만 허용.
- 색상은 `var(--tds-color-*)` CSS 변수 또는 TDS 컴포넌트 기본값만 사용. HEX 하드코딩(`#FFFFFF`, `#333` 등) 금지 — 다크모드 필수 지원.
- 하단 탭 내비게이션은 템플릿 제공 `src/components/FloatingTabBar`를 사용한다(TDS에 TabBar 없음). `Tab`은 화면 내부 콘텐츠 전환에만 사용.
- 모든 탭 가능한 요소의 터치 타겟은 최소 44×44px.
- 1차 액션 버튼은 `SubmitFooter`(하단 고정) 또는 `display="block"` 버튼. 좌측 글자폭 버튼 금지.

### CP-3. 인증/정책
- 토스 앱이 유저 세션을 자동 제공한다. 로그인 화면·로그인 호출 없음. 유저 식별이 필요한 지점은 없으며, 필요 시 `getIsTossLoginIntegratedService()`로 연동 여부만 확인한다.
- 외부 도메인 이탈 금지: `window.location.href`, `window.open`으로 외부 URL 이동 코드가 소스에 존재하지 않는다.
- 외부 분석 솔루션(GA, Amplitude, Sentry 등) 미사용.
- 앱 설치 유도 문구/배너/링크 금지.
- **생성형 AI 미사용**: EnlistPay의 모든 결과(D-day, 월급, 휴가, 적금)는 결정론적 산술 계산이다. 따라서 "AI가 생성한 결과입니다" 고지 의무 비해당. 대신 CP-4의 계산 고지를 표시한다.
- `grantPromotionReward`는 MVP에서 호출하지 않는다(F8 AC로 가드).

### CP-4. 수익화
- 배너: `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />` — 콘텐츠 섹션 사이 또는 콘텐츠 최하단(FloatingTabBar 위 `Spacing size={24}` 확보). 콘텐츠 위에 겹치는 배치 금지, sticky 금지.
- 리워드: `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>` — `/pay`의 "누적 급여 상세"(월별 내역 + 누적 총액)를 게이팅한다.
- IAP 미사용(PRD Monetization: ads).

### CP-5. 계산 고지(면책)
- 급여표·정기휴가 일수·적금 조건은 앱 내장 상수(연도별)이며 실제 지급액과 다를 수 있다. 계산 결과가 노출되는 모든 화면 하단에 `Paragraph.Text`로 "실제 지급액은 부대·개인 사정에 따라 다를 수 있어요. 참고용 계산 결과예요." 를 표시한다.

---

## Data Models

### 공통 타입

```ts
// src/domain/types.ts
export type Branch = 'ARMY' | 'NAVY' | 'AIR_FORCE' | 'MARINE' | 'SOCIAL';
export type Rank = 'PRIVATE' | 'PFC' | 'CORPORAL' | 'SERGEANT'; // 이병/일병/상병/병장
export type VacationType = 'ANNUAL' | 'REWARD' | 'CONSOLATION' | 'PETITION'; // 정기/포상/위로/청원
export type VacationDirection = 'GRANT' | 'USE'; // 부여/사용
export type ISODate = string; // 'YYYY-MM-DD'
```

### ServiceProfile — 복무 프로필 (단일 레코드)

| field | type | constraints |
|---|---|---|
| `schemaVersion` | `1` | 고정값 1 |
| `branch` | `Branch` | 필수 |
| `enlistDate` | `ISODate` | 필수. `1990-01-01` ≤ date ≤ 오늘+3년 |
| `serviceMonths` | `number` | 정수. ARMY/MARINE=18, NAVY=20, AIR_FORCE=21, SOCIAL=21 (설정에서 12~24 수동 조정 가능) |
| `dischargeDate` | `ISODate` | 파생 캐시값. `addMonths(enlistDate, serviceMonths) - 1일` |
| `nickname` | `string` | 0~10자. 빈 문자열 허용 |
| `createdAt` | `number` | epoch ms |
| `updatedAt` | `number` | epoch ms |

```ts
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
```

### VacationRecord — 휴가 부여/사용 기록

| field | type | constraints |
|---|---|---|
| `id` | `string` | UUID 또는 폴백 ID |
| `type` | `VacationType` | 필수 |
| `direction` | `GRANT \| USE` | 필수 |
| `days` | `number` | 0.5 단위, 0.5 ≤ days ≤ 30 |
| `date` | `ISODate` | 필수. `enlistDate` ≤ date ≤ `dischargeDate` |
| `memo` | `string` | 0~30자 |
| `createdAt` | `number` | epoch ms |

```ts
export interface VacationRecord {
  id: string;
  type: VacationType;
  direction: VacationDirection;
  days: number;
  date: ISODate;
  memo: string;
  createdAt: number;
}
```

### PayTable — 연도별 급여/휴가 상수 (앱 내장, 읽기 전용)

```ts
export interface PayTable {
  year: number;                          // 2025
  monthlyPay: Record<Rank, number>;      // 원
  annualLeaveDays: Record<Branch, number>; // 정기휴가 총 부여일
  defaultServiceMonths: Record<Branch, number>;
}

export const PAY_TABLE_2025: PayTable = {
  year: 2025,
  monthlyPay: { PRIVATE: 750000, PFC: 900000, CORPORAL: 1200000, SERGEANT: 1500000 },
  annualLeaveDays: { ARMY: 24, MARINE: 24, NAVY: 27, AIR_FORCE: 28, SOCIAL: 28 },
  defaultServiceMonths: { ARMY: 18, MARINE: 18, NAVY: 20, AIR_FORCE: 21, SOCIAL: 21 },
};
```

### SavingsInput / SavingsResult — 적금 시뮬레이션

```ts
export interface SavingsInput {
  monthlyDeposit: number;    // 10000 ~ 550000, 10000원 단위
  months: number;            // 1 ~ 24 (기본: 잔여 복무 개월, 최대 18)
  annualRatePercent: number; // 0.1 ~ 20.0, 소수 1자리 (기본 5.0)
  useGovMatch: boolean;      // 정부 매칭지원금 100% 포함 여부 (기본 true)
}

export interface SavingsResult {
  principal: number; // monthlyDeposit * months
  interest: number;  // 단리 적립식, 원 단위 반올림
  govMatch: number;  // useGovMatch ? principal : 0
  total: number;     // principal + interest + govMatch
}
```

### AppFlags — 앱 상태 플래그

```ts
export interface AppFlags {
  onboardingDone: boolean;
  rewardUnlockedUntil: number; // epoch ms. 리워드 광고 시청 완료 시 now + 86400000
  payTableYear: number;        // 2025
  disclaimerAckAt: number;     // 계산 고지 확인 시각 (0이면 미확인)
}
```

### 파생(계산) 타입 — 저장하지 않음

```ts
export interface ServiceStatus {
  enlistDate: ISODate;
  dischargeDate: ISODate;
  totalDays: number;      // 전역일 - 입대일 + 1
  elapsedDays: number;    // 오늘 - 입대일 + 1 (0 하한, totalDays 상한)
  remainingDays: number;  // 전역일 - 오늘 (0 하한) = D-day 값
  progressPercent: number; // (elapsedDays / totalDays) * 100, 소수 1자리
  phase: 'BEFORE_ENLIST' | 'IN_SERVICE' | 'DISCHARGED';
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
  amount: number;    // 원 단위 반올림
}
```

---

## Feature List

---

### F1. 복무 계산 엔진 & 저장 계층

- **Description**: 입대일·군별 정보로 전역일, 총 복무일, 경과일, 진행률, 계급 구간을 계산하는 순수 함수 모듈과 localStorage 영속 계층을 구현한다. 화면 없이 도메인 로직과 저장/로드/마이그레이션만 담당하며, 이후 모든 기능(F2~F7)이 이 모듈을 재사용한다. 계급 구간 규칙은 이병 2개월 → 일병 6개월 → 상병 6개월 → 병장(잔여 전체)이다.
- **Data**: `ServiceProfile`, `PayTable`, `AppFlags`, 파생 타입 `ServiceStatus`/`RankPeriod`
- **API**: 없음 (외부 호출 없음)
- **Requirements**: `src/domain/dday.ts`(`calcDischargeDate`, `calcServiceStatus`), `src/domain/rank.ts`(`calcRankPeriods`, `getRankAt`, `getNextPromotion`), `src/storage/profile.ts`(`loadProfile`, `saveProfile`, `clearAll`)

- **AC-1 [U][P0]**: Scenario: 전역일 계산
  Given `PAY_TABLE_2025`가 로드된 상태에서
  When `calcDischargeDate({ enlistDate: "2026-01-05", serviceMonths: 18 })` 호출
  Then `"2027-07-04"` 를 반환한다 (입대일 + 18개월 − 1일)
  And `calcDischargeDate({ enlistDate: "2026-01-31", serviceMonths: 1 })` 는 `"2026-02-27"` 을 반환한다 (월말 오버플로는 해당 월 마지막 날로 클램프 후 −1일)

- **AC-2 [U][P0]**: Scenario: 복무 현황 계산
  Given 프로필 `{ branch: "ARMY", enlistDate: "2026-01-05", serviceMonths: 18 }` 이고 오늘이 `2026-07-01` 일 때
  When `calcServiceStatus(profile, "2026-07-01")` 호출
  Then `{ dischargeDate: "2027-07-04", totalDays: 546, elapsedDays: 178, remainingDays: 368, progressPercent: 32.6, phase: "IN_SERVICE" }` 를 반환한다

- **AC-3 [E][P0]**: Scenario: 계급 구간 및 현재 계급
  Given 프로필 `{ branch: "ARMY", enlistDate: "2026-01-05", serviceMonths: 18 }` 일 때
  When `calcRankPeriods(profile)` 호출
  Then 길이 4의 배열을 반환하며 각 항목은
  `{ rank: "PRIVATE", startDate: "2026-01-05", endDate: "2026-03-04", monthlyPay: 750000 }`,
  `{ rank: "PFC", startDate: "2026-03-05", endDate: "2026-09-04", monthlyPay: 900000 }`,
  `{ rank: "CORPORAL", startDate: "2026-09-05", endDate: "2027-03-04", monthlyPay: 1200000 }`,
  `{ rank: "SERGEANT", startDate: "2027-03-05", endDate: "2027-07-04", monthlyPay: 1500000 }` 이다
  And `getRankAt(profile, "2026-07-01")` 는 `"PFC"` 를 반환한다
  And `getNextPromotion(profile, "2026-07-01")` 는 `{ rank: "CORPORAL", date: "2026-09-05", dday: 66 }` 를 반환한다

- **AC-4 [S][P0]**: Scenario: 입대 전 / 전역 후 상태 구분
  Given 프로필 `{ enlistDate: "2026-01-05", serviceMonths: 18 }` 일 때
  When `calcServiceStatus(profile, "2025-12-25")` 호출
  Then `{ phase: "BEFORE_ENLIST", elapsedDays: 0, progressPercent: 0, remainingDays: 556 }` 를 반환한다
  And `calcServiceStatus(profile, "2027-08-01")` 는 `{ phase: "DISCHARGED", elapsedDays: 546, remainingDays: 0, progressPercent: 100 }` 를 반환한다

- **AC-5 [W][P1]**: Scenario: 잘못된 입대일 입력 거부
  Given 저장 요청이 들어올 때
  When `saveProfile({ branch: "ARMY", enlistDate: "1989-12-31", serviceMonths: 18 })` 호출
  Then `Error` 를 throw 하지 않고 `{ ok: false, error: "입대일은 1990년 1월 1일 이후로 입력해주세요" }` 를 반환한다
  And `saveProfile({ ..., enlistDate: "abcd-99-99" })` 는 `{ ok: false, error: "입대일 형식이 올바르지 않아요" }` 를 반환한다

- **AC-6 [W][P1]**: Scenario: localStorage 쓰기 실패 처리
  Given `localStorage.setItem` 이 `QuotaExceededError` 를 throw 하는 상태에서
  When `saveProfile(validProfile)` 호출
  Then 앱이 크래시하지 않고 `{ ok: false, error: "저장 공간이 부족해요. 설정에서 기록을 정리해주세요" }` 를 반환한다
  And `console.error` 를 호출하지 않는다

- **AC-7 [W][P1]**: Scenario: 손상된 저장 데이터 복구
  Given `localStorage["enlistpay.profile.v1"]` 값이 `"{not-json"` 일 때
  When `loadProfile()` 호출
  Then `null` 을 반환하고 해당 키를 삭제한다
  And 앱은 온보딩 미완료 상태로 동작한다

- **AC-8 [U][P1]**: Scenario: 프로필 미존재(빈 상태) 신호
  Given `localStorage` 에 `enlistpay.profile.v1` 키가 없을 때
  When `loadProfile()` 호출
  Then `null` 을 반환하고 `AppFlags.onboardingDone` 은 `false` 로 평가된다

---

### F2. 온보딩 — 입대 정보 입력

- **Description**: 최초 실행 시 군별과 입대일을 입력받아 `ServiceProfile`을 생성하는 단일 화면이다. 군별 선택 시 복무기간이 자동 세팅되고, 입력 즉시 전역일 미리보기가 갱신된다. 저장 후 홈(`/`)으로 replace 이동한다.
- **Data**: `ServiceProfile`, `AppFlags`
- **API**: 없음
- **Requirements**: 화면 `/onboarding`. TDS `Top`, `Chip`(군별 선택), `TextField`(입대일 YYYY-MM-DD, `inputMode="numeric"`), `Card`(전역일 미리보기), `SubmitFooter` + `Button display="block"`, `Toast`

- **AC-1 [E][P0]**: Scenario: 온보딩 저장 성공
  Given `/onboarding` 화면에서 프로필이 없는 상태일 때
  When 군별 `육군` Chip 선택 후 입대일 `2026-01-05` 입력, "시작하기" 버튼 탭
  Then `localStorage["enlistpay.profile.v1"]` 에 `{ branch: "ARMY", enlistDate: "2026-01-05", serviceMonths: 18, dischargeDate: "2027-07-04", schemaVersion: 1 }` 가 저장된다
  And `Toast` 로 "전역일이 계산됐어요" 가 표시된다
  And `navigate("/", { replace: true })` 로 이동한다

- **AC-2 [E][P0]**: Scenario: 군별 선택 시 복무기간 자동 반영
  Given `/onboarding` 화면에서 입대일 `2026-01-05` 가 입력된 상태일 때
  When 군별 Chip `공군` 을 탭
  Then 복무기간 표시가 `21개월` 로 바뀌고 전역일 미리보기가 `2027-10-04` 로 갱신된다
  And `해군` 탭 시 `20개월` / `2027-09-04` 로 갱신된다

- **AC-3 [W][P1]**: Scenario: 미입력 상태 제출 차단
  Given `/onboarding` 화면에서 군별만 선택하고 입대일이 빈 문자열일 때
  When "시작하기" 버튼 탭
  Then 저장이 발생하지 않고 TextField 하단에 "입대일을 입력해주세요" 에러 메시지가 표시된다
  And "시작하기" 버튼은 `disabled` 상태를 유지한다

- **AC-4 [W][P1]**: Scenario: 형식 오류 입대일 거부
  Given `/onboarding` 화면일 때
  When 입대일에 `2026-13-45` 를 입력하고 "시작하기" 탭
  Then "존재하지 않는 날짜예요" 에러 메시지가 표시되고 저장되지 않는다

- **AC-5 [S][P1]**: Scenario: 이미 온보딩 완료된 상태 접근
  Given `AppFlags.onboardingDone === true` 이고 프로필이 존재할 때
  When 사용자가 `/onboarding` 으로 직접 진입
  Then 즉시 `navigate("/", { replace: true })` 로 리다이렉트한다

- **AC-6 [U][P1]**: Scenario: 모바일 키보드 대응
  Given `/onboarding` 화면에서 입대일 TextField 가 포커스될 때
  Then `inputMode="numeric"` 숫자 키보드가 노출되고, 하단 고정 `SubmitFooter` 버튼이 키보드에 가려지지 않도록 콘텐츠 영역이 스크롤된다
  And 키보드 노출 중에도 "시작하기" 버튼 높이는 48px 이상을 유지한다

- **AC-7 [U][P2]**: Scenario: 레이아웃 계약
  Given `/onboarding` 렌더링 시
  Then 화면은 `ScreenScaffold` 로 감싸이고, 전역일 미리보기는 `data-testid="discharge-preview-card"` 인 TDS `Card` 1개 안에 표시되며 전역일 텍스트는 t3 강조 타이포로 렌더된다
  And 모든 군별 Chip 의 터치 타겟 높이는 44px 이상이다

---

### F3. 홈 — D-day 대시보드

- **Description**: 매일 확인하는 앱의 핵심 화면으로, 전역 D-day를 CountUp 히어로로 크게 보여주고 복무 진행률·현재 계급·이번 달 급여·다음 진급 D-day를 카드로 요약한다. 각 요약 카드는 상세 화면(`/rank`, `/pay`, `/vacation`)으로 이동하는 진입점이다. 배너 광고는 콘텐츠 최하단에 배치한다.
- **Data**: `ServiceProfile`, `PayTable`, `VacationRecord`(잔여 휴가 요약)
- **API**: 없음
- **Requirements**: 화면 `/`. TDS `Top`, `Card`, `ListRow`, `Chip`, `Paragraph.Text`, 템플릿 `SummaryHero`(CountUp), `AdSlot`, `FloatingTabBar`

- **AC-1 [U][P0]**: Scenario: D-day 히어로 표시
  Given 프로필 `{ branch: "ARMY", enlistDate: "2026-01-05", serviceMonths: 18 }` 이고 오늘이 `2026-07-01` 일 때
  When `/` 진입
  Then `data-testid="dday-hero"` 요소에 `368` 이 CountUp으로 표시되고 라벨은 `D-368` 형식이다
  And 부제로 `전역일 2027년 7월 4일 (토)` 이 표시된다

- **AC-2 [U][P0]**: Scenario: 요약 카드 구성 및 레이아웃 계약
  Given 위 프로필/날짜 조건에서 `/` 진입 시
  Then `data-testid="summary-card"` 인 TDS `Card` 가 3개 렌더되며 각각 다음 값을 포함한다:
  진행률 카드 `32.6%`, 현재 계급 카드 `일병`, 이번 달 급여 카드 `900,000원`
  And 다음 진급 카드는 `상병까지 D-66` 을 표시한다
  And 진행률 카드는 `data-testid="progress-bar"` 를 가지며 `aria-valuenow="32.6"` 이다

- **AC-3 [E][P0]**: Scenario: 상세 화면 이동
  Given `/` 화면에서
  When 현재 계급 카드를 탭
  Then `navigate("/rank")` 가 호출된다
  And 이번 달 급여 카드 탭 시 `navigate("/pay")` 가 호출된다

- **AC-4 [S][P1]**: Scenario: 입대 전 상태 표시
  Given 프로필 `{ enlistDate: "2027-03-02", serviceMonths: 18 }` 이고 오늘이 `2026-07-01` 일 때
  When `/` 진입
  Then 히어로는 `입대까지 D-244` 를 표시하고, 현재 계급 카드는 `입대 전` 을 표시한다
  And 이번 달 급여 카드는 `0원` 을 표시한다

- **AC-5 [S][P1]**: Scenario: 전역 완료 상태 표시
  Given 프로필 `{ enlistDate: "2024-01-05", serviceMonths: 18 }` 이고 오늘이 `2026-07-01` 일 때
  When `/` 진입
  Then 히어로는 `전역 완료` 텍스트와 진행률 `100%` 를 표시하고 CountUp 숫자는 렌더되지 않는다

- **AC-6 [W][P1]**: Scenario: 프로필 없음(빈 상태)
  Given `loadProfile()` 이 `null` 을 반환할 때
  When `/` 진입
  Then `navigate("/onboarding", { replace: true })` 로 이동한다
  And 리다이렉트 전 화면에는 `Asset.ContentIcon` 과 "입대 정보를 먼저 입력해주세요" 빈 상태가 렌더되며 `console.error` 는 발생하지 않는다

- **AC-7 [S][P1]**: Scenario: 로딩 상태
  Given `/` 진입 직후 localStorage 읽기가 완료되지 않은 프레임에서
  Then `data-testid="home-skeleton"` 스켈레톤이 표시되고, 읽기 완료 후 200ms 이내에 실제 값으로 교체된다

- **AC-8 [U][P1]**: Scenario: 광고 배치
  Given `/` 화면 렌더 시
  Then `AdSlot` 은 마지막 요약 카드 아래, `FloatingTabBar` 위에 배치되며 그 사이에 `Spacing size={24}` 가 존재한다
  And `AdSlot` 컨테이너는 `position: fixed`/`sticky` 를 사용하지 않고 어떤 카드와도 겹치지 않는다

---

### F4. 계급·진급 타임라인 & 월급 요약

- **Description**: 이병부터 병장까지의 진급 예정일과 계급별 월급을 타임라인 형태로 보여주는 화면이다. 현재 계급은 강조 표시하고, 지난 계급/현재/예정 상태를 시각적으로 구분한다. 계급별 총 수령 예상액(구간 개월 × 월급)을 함께 제공한다.
- **Data**: `ServiceProfile`, `PayTable`, 파생 `RankPeriod`
- **API**: 없음
- **Requirements**: 화면 `/rank`. TDS `Top`, `ListRow`(계급 4행), `Chip`(현재 계급 배지), `Card`, `Paragraph.Text`, `AdSlot`

- **AC-1 [U][P0]**: Scenario: 타임라인 4행 렌더
  Given 프로필 `{ branch: "ARMY", enlistDate: "2026-01-05", serviceMonths: 18 }` 로 `/rank` 진입 시
  Then `data-testid="rank-row"` 요소가 4개 렌더되고 순서는 `이병 → 일병 → 상병 → 병장` 이다
  And 각 행은 기간과 월급을 표시한다: 이병 `2026.01.05 ~ 2026.03.04 · 750,000원`, 일병 `2026.03.05 ~ 2026.09.04 · 900,000원`, 상병 `2026.09.05 ~ 2027.03.04 · 1,200,000원`, 병장 `2027.03.05 ~ 2027.07.04 · 1,500,000원`

- **AC-2 [S][P0]**: Scenario: 현재 계급 강조
  Given 오늘이 `2026-07-01` 일 때
  When `/rank` 진입
  Then 일병 행에 `data-testid="rank-current-badge"` 인 TDS `Chip` 이 "현재" 라벨로 표시되고, 나머지 3개 행에는 해당 배지가 없다

- **AC-3 [E][P0]**: Scenario: 누적 급여 상세로 이동
  Given `/rank` 화면 하단의 "누적 급여 상세 보기" 버튼이 있을 때
  When 버튼 탭
  Then `navigate("/pay")` 가 호출된다

- **AC-4 [U][P1]**: Scenario: 레이아웃 계약
  Given `/rank` 렌더 시
  Then 화면은 `ScreenScaffold` 로 감싸이고, 타임라인은 `data-testid="rank-timeline-card"` 인 TDS `Card` 1개로 묶인다
  And "누적 급여 상세 보기" 버튼은 `display="block"` 이며 높이 48px 이상이다

- **AC-5 [W][P1]**: Scenario: 복무기간이 8개월 미만인 경우
  Given 프로필 `{ enlistDate: "2026-01-05", serviceMonths: 6 }` 일 때
  When `/rank` 진입
  Then 도달 불가능한 계급 행은 렌더하지 않고 `이병(2026.01.05~2026.03.04)`, `일병(2026.03.05~2026.07.04)` 2행만 표시한다
  And 안내 문구 "복무기간 기준 병장 진급 전 전역 예정이에요" 가 표시된다

- **AC-6 [W][P1]**: Scenario: 프로필 없음 방어
  Given `loadProfile()` 이 `null` 을 반환할 때
  When `/rank` 로 직접 진입
  Then `navigate("/onboarding", { replace: true })` 로 이동하고 크래시나 `console.error` 가 발생하지 않는다

- **AC-7 [S][P1]**: Scenario: 로딩/빈 상태
  Given `/rank` 진입 직후 계산 완료 전 프레임에서
  Then `data-testid="rank-skeleton"` 이 4행 형태로 표시된다

- **AC-8 [U][P2]**: Scenario: 계산 고지 표시
  Given `/rank` 렌더 시
  Then 화면 최하단에 "실제 지급액은 부대·개인 사정에 따라 다를 수 있어요. 참고용 계산 결과예요." 문구가 `Paragraph.Text` 로 표시된다

---

### F5. 누적 급여 상세 (리워드 광고 게이팅)

- **Description**: 입대일부터 전역일까지 월별 급여 내역과 누적 총액을 계산해 보여주는 상세 화면이다. 월 단위 계산은 해당 월 15일(전역 월은 전역일) 기준 계급의 월급을 적용하고, 첫 달과 전역 달은 일할 계산한다. 상세 내역은 `TossRewardAd` 로 게이팅하며, 시청 완료 후 24시간 동안 잠금이 해제된다.
- **Data**: `ServiceProfile`, `PayTable`, `AppFlags.rewardUnlockedUntil`, 파생 `MonthlyPayRow[]`
- **API**: 없음
- **Requirements**: 화면 `/pay`. TDS `Top`, `Card`, `ListRow`(월별 행), `Button`, 템플릿 `SummaryHero`(누적 총액 CountUp), `MiniBar`(계급별 비중), `TossRewardAd`, `AdSlot`

- **AC-1 [U][P0]**: Scenario: 월별 급여 일할 계산
  Given 프로필 `{ branch: "ARMY", enlistDate: "2026-01-05", serviceMonths: 18 }` 일 때
  When `calcMonthlyPayRows(profile, PAY_TABLE_2025)` 호출
  Then 배열 길이는 `19` (2026-01 ~ 2027-07) 이다
  And 첫 행은 `{ yearMonth: "2026-01", rank: "PRIVATE", servedDays: 27, daysInMonth: 31, amount: 653226 }` 이다 (750000 × 27/31, 반올림)
  And `{ yearMonth: "2026-07" }` 행의 amount 는 `900000` (전월 만근) 이다

- **AC-2 [E][P0]**: Scenario: 리워드 광고 시청 후 상세 공개
  Given `AppFlags.rewardUnlockedUntil < Date.now()` 인 상태로 `/pay` 진입
  When "광고 보고 상세 내역 확인하기" 버튼 탭 후 `TossRewardAd` 광고 시청이 완료됨
  Then `data-testid="pay-detail-list"` 월별 내역 19행과 `data-testid="pay-total-hero"` 누적 총액이 표시된다
  And `localStorage["enlistpay.flags.v1"].rewardUnlockedUntil` 이 `Date.now() + 86400000` 으로 갱신된다

- **AC-3 [S][P0]**: Scenario: 잠금 해제 유효기간 내 재진입
  Given `AppFlags.rewardUnlockedUntil = Date.now() + 3600000` 인 상태에서
  When `/pay` 진입
  Then 광고 게이트 없이 즉시 월별 내역과 누적 총액이 표시된다
  And `data-testid="reward-gate-cta"` 버튼은 렌더되지 않는다

- **AC-4 [S][P1]**: Scenario: 잠금 상태 미리보기
  Given `AppFlags.rewardUnlockedUntil < Date.now()` 인 상태로 `/pay` 진입 시
  Then 지금까지 받은 급여 요약 1개 카드(`data-testid="pay-summary-card"`)만 표시되고, 월별 내역 영역은 블러 처리된 플레이스홀더 3행으로 렌더된다
  And `data-testid="reward-gate-cta"` 버튼(높이 48px 이상)이 표시된다

- **AC-5 [W][P1]**: Scenario: 광고 로드 실패
  Given 광고 SDK가 로드 실패 또는 사용자가 광고를 중도 종료했을 때
  When `TossRewardAd` 가 실패 콜백을 반환
  Then `Toast` 로 "광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요" 를 표시한다
  And `rewardUnlockedUntil` 은 변경되지 않고 잠금 상태를 유지하며 `console.error` 는 호출하지 않는다

- **AC-6 [W][P1]**: Scenario: 입대 전 상태에서의 누적 급여
  Given 프로필 `{ enlistDate: "2027-03-02", serviceMonths: 18 }` 이고 오늘이 `2026-07-01` 일 때
  When `/pay` 진입
  Then 지금까지 받은 급여는 `0원` 으로 표시되고, `Asset.ContentIcon` 과 함께 "아직 복무를 시작하지 않았어요" 빈 상태가 표시된다
  And 전역까지 받을 예상 총액은 광고 게이트 뒤에서 확인 가능하다

- **AC-7 [U][P1]**: Scenario: 긴 목록 스크롤 성능
  Given 월별 내역이 19행 이상일 때
  When `/pay` 상세가 표시됨
  Then 목록은 세로 스크롤 컨테이너 안에서 렌더되며, 행 수가 40을 초과하면 가상 스크롤(윈도잉, 화면당 최대 20행 마운트)을 적용한다

- **AC-8 [U][P1]**: Scenario: 레이아웃/표현 계약
  Given 잠금 해제 상태의 `/pay` 렌더 시
  Then 누적 총액은 `SummaryHero value` CountUp으로 t2 강조 타이포로 표시된다
  And 계급별 급여 비중은 `data-testid="pay-rank-minibar"` 인 `MiniBar` 4개(이병/일병/상병/병장)로 시각화된다
  And `AdSlot` 배너는 월별 내역 목록 아래에 배치되며 목록과 겹치지 않는다

---

### F6. 휴가 적립·사용 관리

- **Description**: 군별 정기휴가 일수를 자동 부여하고, 포상·위로·청원 휴가의 부여/사용 기록을 사용자가 직접 추가·삭제할 수 있는 화면이다. 잔여 휴가 = (자동 정기휴가 + 부여 기록 합) − (사용 기록 합) 으로 계산한다. 기록 추가는 별도 라우트 없이 BottomSheet로 처리한다.
- **Data**: `VacationRecord[]`, `ServiceProfile`, `PayTable.annualLeaveDays`
- **API**: 없음
- **Requirements**: 화면 `/vacation`. TDS `Top`, `Card`(잔여 요약), `ListRow`(기록), `BottomSheet`(추가 폼), `Chip`(휴가 종류), `TextField`(일수/메모), `Button`, `AlertDialog`(삭제 확인), `Toast`, `AdSlot`

- **AC-1 [U][P0]**: Scenario: 정기휴가 자동 부여 및 잔여 계산
  Given 프로필 `{ branch: "ARMY" }` 이고 저장된 `VacationRecord` 가 `[{ type: "REWARD", direction: "GRANT", days: 4 }, { type: "ANNUAL", direction: "USE", days: 6.5 }]` 일 때
  When `/vacation` 진입
  Then `data-testid="vacation-summary-card"` 에 총 부여 `28일`, 사용 `6.5일`, 잔여 `21.5일` 이 표시된다 (정기 24 + 포상 4 − 사용 6.5)

- **AC-2 [E][P0]**: Scenario: 휴가 사용 기록 추가
  Given `/vacation` 화면에서 "기록 추가" 버튼을 탭해 `BottomSheet` 가 열린 상태일 때
  When `{ type: "REWARD", direction: "USE", days: 3, date: "2026-08-10", memo: "포상 휴가" }` 를 입력하고 "저장" 탭
  Then `localStorage["enlistpay.vacations.v1"]` 배열에 항목이 1개 추가되고 `id`, `createdAt` 이 채워진다
  And `BottomSheet` 가 닫히고 `Toast` "휴가 기록을 저장했어요" 가 표시되며 목록 최상단에 새 항목이 나타난다

- **AC-3 [E][P0]**: Scenario: 기록 삭제
  Given 목록에 `id: "v-1"` 항목이 있을 때
  When 해당 `ListRow` 의 삭제 버튼 탭 → `AlertDialog` 에서 "삭제" 확인
  Then 해당 항목이 localStorage 배열에서 제거되고 `Toast` "기록을 삭제했어요" 가 표시된다
  And `AlertDialog` 에서 "취소" 탭 시 배열 길이는 변하지 않는다

- **AC-4 [W][P1]**: Scenario: 잘못된 일수 입력 거부
  Given 기록 추가 `BottomSheet` 가 열린 상태일 때
  When `{ days: 0, date: "2026-08-10" }` 로 저장 탭
  Then "휴가 일수는 0.5일 이상 입력해주세요" 에러 메시지가 표시되고 저장되지 않는다
  And `{ days: 31 }` 입력 시 "휴가 일수는 30일 이하로 입력해주세요" 가 표시된다

- **AC-5 [W][P1]**: Scenario: 잔여 일수 초과 사용 경고
  Given 잔여 휴가가 `2일` 인 상태에서
  When `{ direction: "USE", days: 5 }` 로 저장 탭
  Then `AlertDialog` "잔여 휴가(2일)보다 많아요. 그래도 저장할까요?" 가 표시된다
  And "저장" 확인 시 기록은 저장되고 잔여 표시는 `-3일` 로 음수 표기된다

- **AC-6 [S][P1]**: Scenario: 빈 상태 / 로딩 상태
  Given `VacationRecord` 배열이 빈 배열일 때
  When `/vacation` 진입
  Then `Asset.ContentIcon` 과 "아직 휴가 기록이 없어요. 포상 휴가를 받으면 기록해보세요" 빈 상태가 표시된다
  And 진입 직후 읽기 완료 전 프레임에는 `data-testid="vacation-skeleton"` 이 표시된다

- **AC-7 [U][P1]**: Scenario: 목록 스크롤 및 터치 타겟
  Given 기록이 100개 저장된 상태에서 `/vacation` 진입 시
  Then 목록은 세로 스크롤되며 최초 마운트 행은 20개 이하이고 스크롤 시 추가 로드된다
  And 각 `ListRow` 와 삭제 버튼의 터치 타겟은 44px 이상이다

- **AC-8 [U][P1]**: Scenario: 모바일 키보드 대응
  Given 기록 추가 `BottomSheet` 에서 일수 TextField 포커스 시
  Then `inputMode="decimal"` 키보드가 노출되고, BottomSheet 내부 저장 버튼이 키보드에 가려지지 않도록 시트 콘텐츠가 스크롤된다

---

### F7. 전역 후 목돈 적금 시뮬레이션

- **Description**: 월 납입액·납입 개월·금리·정부 매칭 여부를 입력받아 만기 수령액을 계산하는 시뮬레이터다. 이자는 단리 적립식(`P × r/12 × n(n+1)/2`)으로 계산하고, 정부 매칭지원금은 원금의 100%로 반영한다. 입력 화면(`/savings`)과 결과 화면(`/savings/result`)을 분리하고, 결과는 navigate state로 전달한다.
- **Data**: `SavingsInput`, `SavingsResult`, `ServiceProfile`(기본 납입 개월 산출)
- **API**: 없음
- **Requirements**: 화면 `/savings`, `/savings/result`. TDS `Top`, `TextField`, `Switch`(정부 매칭), `Chip`(빠른 금액), `Card`, `SubmitFooter`, 템플릿 `SummaryHero`, `MiniBar`(원금/이자/매칭 비중), `AdSlot`

- **AC-1 [U][P0]**: Scenario: 만기 수령액 계산
  Given `calcSavings` 순수 함수가 있을 때
  When `calcSavings({ monthlyDeposit: 400000, months: 12, annualRatePercent: 5.0, useGovMatch: true })` 호출
  Then `{ principal: 4800000, interest: 130000, govMatch: 4800000, total: 9730000 }` 를 반환한다
  And `useGovMatch: false` 인 경우 `{ principal: 4800000, interest: 130000, govMatch: 0, total: 4930000 }` 를 반환한다

- **AC-2 [E][P0]**: Scenario: 시뮬레이션 실행 및 결과 이동
  Given `/savings` 화면에서 `{ monthlyDeposit: 400000, months: 12, annualRatePercent: 5.0, useGovMatch: true }` 가 입력된 상태일 때
  When "결과 보기" 버튼 탭
  Then `navigate("/savings/result", { state: { input: SavingsInput, result: SavingsResult } })` 가 호출된다
  And `localStorage["enlistpay.savings.v1"]` 에 마지막 입력값이 저장된다

- **AC-3 [U][P0]**: Scenario: 기본값 프리필
  Given 프로필 `{ enlistDate: "2026-01-05", serviceMonths: 18 }` 이고 오늘이 `2026-07-01` 이며 `enlistpay.savings.v1` 이 없을 때
  When `/savings` 진입
  Then `monthlyDeposit` 은 `400000`, `annualRatePercent` 는 `5.0`, `useGovMatch` 는 `true`, `months` 는 잔여 복무 개월 `12` 로 프리필된다 (잔여 개월 = floor(remainingDays/30.4), 최대 18)

- **AC-4 [W][P1]**: Scenario: 납입액 상한 초과 거부
  Given `/savings` 화면일 때
  When `monthlyDeposit` 에 `600000` 입력 후 "결과 보기" 탭
  Then "월 납입액은 550,000원 이하로 입력해주세요" 에러 메시지가 표시되고 이동이 발생하지 않는다
  And `monthlyDeposit` 이 `0` 인 경우 "월 납입액을 입력해주세요" 가 표시된다

- **AC-5 [W][P1]**: Scenario: 결과 화면 직접 진입 방어
  Given 사용자가 `/savings/result` 로 `location.state === null` 인 상태로 직접 진입했을 때
  Then 계산 결과를 렌더하지 않고 `navigate("/savings", { replace: true })` 로 이동한다
  And `console.error` 및 크래시가 발생하지 않는다

- **AC-6 [W][P1]**: Scenario: 비정상 금리 입력 거부
  Given `/savings` 화면일 때
  When `annualRatePercent` 에 `-1` 또는 `25` 입력 후 "결과 보기" 탭
  Then "금리는 0.1% ~ 20.0% 사이로 입력해주세요" 에러 메시지가 표시되고 이동이 발생하지 않는다

- **AC-7 [U][P1]**: Scenario: 결과 화면 레이아웃/표현 계약
  Given `/savings/result` 가 유효한 state 로 렌더될 때
  Then `data-testid="savings-total-hero"` 에 `9,730,000원` 이 `SummaryHero` CountUp t2 타이포로 표시된다
  And `data-testid="savings-breakdown-card"` 인 TDS `Card` 안에 원금 `4,800,000원`, 이자 `130,000원`, 정부지원금 `4,800,000원` 3행이 `ListRow` 로 표시된다
  And 구성 비중은 `data-testid="savings-minibar"` 인 `MiniBar` 3개로 시각화된다
  And `AdSlot` 배너는 breakdown 카드 아래에 배치된다

- **AC-8 [S][P1]**: Scenario: 계산 중 상태
  Given "결과 보기" 버튼을 탭한 직후 계산·네비게이션이 완료되기 전 상태에서
  Then 버튼은 `loading` 상태로 전환되어 중복 탭이 무시되며, 300ms 이내에 `/savings/result` 로 전환된다

---

### F8. 설정 · 데이터 관리 · 검수 정책 준수

- **Description**: 입대 정보 수정, 급여표 연도 확인, 계산 고지 확인, 전체 데이터 초기화를 제공하는 화면이자, 앱 전역에 적용되는 토스 검수 정책 가드를 구현한다. 라우팅 가드(온보딩 미완료 시 리다이렉트)와 전역 에러 바운더리도 이 기능에 포함된다.
- **Data**: `ServiceProfile`, `VacationRecord[]`, `AppFlags`
- **API**: 없음
- **Requirements**: 화면 `/settings`. TDS `Top`, `ListRow`, `Switch`, `AlertDialog`, `Button`, `Toast`, `Paragraph.Text`, 전역 `ErrorBoundary`

- **AC-1 [E][P0]**: Scenario: 입대 정보 수정
  Given `/settings` 에서 "입대 정보 수정" `ListRow` 를 탭해 `BottomSheet` 가 열린 상태일 때
  When 입대일을 `2026-02-01` 로 변경하고 "저장" 탭
  Then `ServiceProfile.enlistDate = "2026-02-01"`, `dischargeDate = "2027-07-31"`, `updatedAt` 이 갱신되어 저장된다
  And `Toast` "입대 정보를 수정했어요" 가 표시되고 `/` 의 D-day 값이 새 전역일 기준으로 재계산된다

- **AC-2 [E][P0]**: Scenario: 전체 데이터 초기화
  Given `/settings` 화면에서
  When "데이터 초기화" 탭 → `AlertDialog` "모든 기록이 삭제돼요. 삭제할까요?" 에서 "삭제" 확인
  Then `enlistpay.profile.v1`, `enlistpay.vacations.v1`, `enlistpay.savings.v1`, `enlistpay.flags.v1` 4개 키가 모두 제거된다
  And `navigate("/onboarding", { replace: true })` 로 이동한다

- **AC-3 [W][P0]**: Scenario: 외부 도메인 이탈 차단
  Given 프로덕션 빌드 산출물에서
  Then `window.open(` 및 `window.location.href =` 호출이 소스 전체에 0건이다
  And 외부 도메인 `http(s)://` 링크를 가진 `<a>` 태그가 0건이며, 앱 설치 유도 문구("설치", "다운로드")가 0건이다

- **AC-4 [U][P0]**: Scenario: 콘솔 에러 및 네트워크 정책
  Given 프로덕션 빌드에서 `/onboarding → / → /rank → /pay → /vacation → /savings → /savings/result → /settings` 전 화면을 순회할 때
  Then `console.error` 출력이 0건이다
  And 앱 자체 코드에서 발생하는 외부 도메인 fetch/XHR 요청이 0건이므로 CORS 에러가 0건이다
  And 외부 분석 SDK(GA, Amplitude 등) 스크립트가 번들에 0건 포함된다

- **AC-5 [U][P0]**: Scenario: 다크모드 및 색상 정책
  Given 소스 전체(`src/**/*.{ts,tsx,css}`)를 검사할 때
  Then HEX 색상 리터럴(`#RGB`, `#RRGGBB`) 이 0건이며 색상은 `var(--tds-color-*)` 또는 TDS 컴포넌트 기본값만 사용한다
  And 다크모드에서 모든 화면의 텍스트/배경 대비가 TDS 토큰 기본값으로 유지된다

- **AC-6 [U][P1]**: Scenario: 프로모션 API 미사용 가드
  Given MVP 빌드에서
  Then `grantPromotionReward` 호출이 소스에 0건이다
  And 추후 도입 시 `amount ≤ 5000` 검증 함수를 통과하지 않으면 호출하지 않는다

- **AC-7 [W][P1]**: Scenario: 전역 에러 바운더리
  Given 임의 화면 렌더 중 자식 컴포넌트가 예외를 throw 할 때
  Then `ErrorBoundary` 가 "일시적인 오류가 발생했어요" 화면과 "홈으로 이동" 버튼을 표시한다
  And 버튼 탭 시 `navigate("/", { replace: true })` 로 복구되며 저장된 데이터는 삭제되지 않는다

- **AC-8 [U][P1]**: Scenario: 미정의 경로 처리 및 빈 상태
  Given 사용자가 `/unknown-path` 로 진입할 때
  Then `Asset.ContentIcon` 과 "존재하지 않는 화면이에요" 빈 상태와 "홈으로" 버튼(높이 48px 이상)이 표시된다
  And 버튼 탭 시 `/` 로 이동한다

---

## Screen Definitions

### 공통 내비게이션 구조
- `FloatingTabBar` 탭 4개: `홈(/)`, `계급(/rank)`, `휴가(/vacation)`, `적금(/savings)`. 각 탭 아이템 터치 타겟 48×48px.
- `/onboarding`, `/pay`, `/savings/result`, `/settings` 는 탭바를 표시하지 않고 `Top` 좌측 뒤로가기를 제공한다.
- 라우트 가드: `/onboarding` 을 제외한 모든 라우트는 `loadProfile() === null` 이면 `/onboarding` 으로 replace 이동.

---

### S1. 온보딩 — `/onboarding`
- **TDS 컴포넌트**: `Top`(타이틀 "입대 정보 입력"), `Chip`(군별 5종: 육군/해군/공군/해병대/사회복무), `TextField`(입대일, `inputMode="numeric"`, placeholder `2026-01-05`), `TextField`(닉네임, optional), `Card`(전역일 미리보기), `Spacing`, `Button display="block"` in `SubmitFooter`, `Toast`
- **레이아웃 계약**: `ScreenScaffold` 골격. 미리보기는 `data-testid="discharge-preview-card"` Card 1개, 전역일은 t3 강조 타이포 + 복무기간 `Chip` 배지.
- **상태**: 로딩 없음(로컬 전용) / 빈 상태 없음 / 에러 = TextField 하단 인라인 에러 메시지
- **터치**: Chip 44px 이상, 제출 버튼 48px, 하단 고정 footer
- **키보드**: 숫자 키보드, 포커스 시 해당 필드가 뷰포트 중앙으로 스크롤, footer 버튼 가려짐 방지
- **광고**: 없음 (온보딩 화면 광고 미배치)
- **Navigation state contract**
  - Incoming: `location.state = null`
  - Outgoing: 저장 성공 → `navigate('/', { replace: true })` (state 없음)

---

### S2. 홈 D-day 대시보드 — `/`
- **TDS 컴포넌트**: `Top`(우측 설정 아이콘 버튼), `SummaryHero`(CountUp D-day), `Card` ×3~4, `ListRow`, `Chip`(현재 계급), `Paragraph.Text`(고지), `AdSlot`, `FloatingTabBar`
- **레이아웃 계약**: `ScreenScaffold` 골격. 히어로 `data-testid="dday-hero"` (t1 CountUp) → `Spacing size={24}` → `data-testid="summary-card"` Card 3개(진행률/현재 계급/이번 달 급여) 2열 grid → 다음 진급 Card → `Spacing size={24}` → `AdSlot` → `Spacing size={24}` → 탭바.
- **표현**: 진행률은 `data-testid="progress-bar"` 프로그레스 바 + 퍼센트 텍스트, 이번 달 급여는 t3 강조 + 원화 콤마 포맷.
- **상태**: 로딩 = `data-testid="home-skeleton"` / 빈 상태 = 프로필 없음 → 온보딩 리다이렉트 / 에러 = ErrorBoundary
- **터치**: 각 요약 Card 전체가 탭 영역(높이 88px 이상), 설정 아이콘 44px
- **스크롤**: 세로 스크롤 1페이지, 가상 스크롤 불필요
- **Navigation state contract**
  - Incoming: `location.state = null`
  - Outgoing: 계급 Card → `navigate('/rank')` / 급여 Card → `navigate('/pay')` / 휴가 Card → `navigate('/vacation')` / 설정 아이콘 → `navigate('/settings')` — 모두 state 없음

---

### S3. 계급·진급 타임라인 — `/rank`
- **TDS 컴포넌트**: `Top`(뒤로가기 + "계급 & 월급"), `Card`, `ListRow` ×4, `Chip`("현재" 배지), `Button display="block"`, `Paragraph.Text`, `AdSlot`, `FloatingTabBar`
- **레이아웃 계약**: `ScreenScaffold` 골격. `data-testid="rank-timeline-card"` Card 1개 안에 `data-testid="rank-row"` 4행. 각 행: 좌측 계급명(t5 굵게) + 기간(t7), 우측 월급(t4 강조). 현재 계급 행은 `Chip` 배지 표시.
- **상태**: 로딩 = `data-testid="rank-skeleton"` 4행 / 빈 상태 = 계급 구간이 2개 미만이면 안내 문구 / 에러 = 프로필 없음 리다이렉트
- **터치**: "누적 급여 상세 보기" 버튼 48px, `display="block"`
- **광고**: `AdSlot` 은 버튼 아래, 고지 문구 위. 콘텐츠와 겹치지 않음
- **Navigation state contract**
  - Incoming: `location.state = null`
  - Outgoing: "누적 급여 상세 보기" → `navigate('/pay')` (state 없음)

---

### S4. 누적 급여 상세 — `/pay`
- **TDS 컴포넌트**: `Top`(뒤로가기 + "누적 급여"), `SummaryHero`(CountUp 총액), `Card`, `ListRow`(월별 19행), `MiniBar` ×4, `Button display="block"`, `TossRewardAd`, `AdSlot`, `Toast`, `Paragraph.Text`
- **레이아웃 계약**: `ScreenScaffold` 골격.
  - 잠금 상태: `data-testid="pay-summary-card"` Card 1개(지금까지 받은 급여) → 블러 플레이스홀더 3행 → `data-testid="reward-gate-cta"` `Button display="block"`(높이 48px) 를 `TossRewardAd` 로 감쌈.
  - 해제 상태: `data-testid="pay-total-hero"` `SummaryHero`(t2 CountUp) → `data-testid="pay-rank-minibar"` MiniBar 4개 → `data-testid="pay-detail-list"` 월별 `ListRow` 목록.
- **상태**: 로딩 = 스켈레톤 1 카드 + 3행 / 빈 상태 = 입대 전이면 `Asset.ContentIcon` + "아직 복무를 시작하지 않았어요" / 에러 = 광고 실패 Toast
- **스크롤**: 월별 목록 세로 스크롤. 행 수 > 40 이면 윈도잉(마운트 20행 이하)
- **터치**: 리워드 CTA 48px, 각 `ListRow` 44px 이상
- **광고**: 리워드(`TossRewardAd`, 상세 게이팅) + 배너(`AdSlot`, 목록 하단)
- **Navigation state contract**
  - Incoming: `location.state = null` (홈/계급 화면에서 state 없이 진입)
  - Outgoing: `Top` 뒤로가기 → `navigate(-1)`

---

### S5. 휴가 관리 — `/vacation`
- **TDS 컴포넌트**: `Top`("휴가"), `Card`(잔여 요약), `MiniBar`(사용/잔여 비율), `ListRow`(기록), `Button`("기록 추가"), `BottomSheet`(추가 폼), `Chip`(휴가 종류 4종 + 부여/사용 2종), `TextField`(일수 `inputMode="decimal"`, 날짜 `inputMode="numeric"`, 메모 최대 30자), `AlertDialog`(삭제/초과 확인), `Toast`, `Asset.ContentIcon`, `AdSlot`, `FloatingTabBar`
- **레이아웃 계약**: `ScreenScaffold` 골격. `data-testid="vacation-summary-card"` Card 1개(총 부여/사용/잔여 3지표, 잔여는 t2 강조) → `MiniBar`(사용 비율) → `Spacing size={16}` → 기록 목록 → `AdSlot` → 탭바. "기록 추가"는 `display="block"` 버튼.
- **상태**: 로딩 = `data-testid="vacation-skeleton"` / 빈 상태 = `Asset.ContentIcon` + "아직 휴가 기록이 없어요. 포상 휴가를 받으면 기록해보세요" / 에러 = 인라인 에러 메시지 + Toast
- **스크롤**: 기록 목록 세로 스크롤, 초기 20행 마운트 후 스크롤 추가 로드
- **키보드**: BottomSheet 내 입력 시 시트가 키보드 위로 올라오고 저장 버튼이 항상 보임
- **터치**: `ListRow` 및 삭제 버튼 44px 이상, "기록 추가" 48px
- **Navigation state contract**
  - Incoming: `location.state = null`
  - Outgoing: 없음 (기록 추가/삭제는 BottomSheet·AlertDialog 로 처리, 라우트 이동 없음)

---

### S6. 적금 시뮬레이션 입력 — `/savings`
- **TDS 컴포넌트**: `Top`("전역 목돈 계산"), `TextField`(월 납입액 `inputMode="numeric"`), `Chip`(빠른 금액 20만/30만/40만/55만), `TextField`(납입 개월 `inputMode="numeric"`), `TextField`(연 금리 `inputMode="decimal"`), `Switch`(정부 매칭지원금 포함), `ListRow`(Switch 행), `SubmitFooter` + `Button display="block"`, `Paragraph.Text`(고지), `FloatingTabBar`
- **레이아웃 계약**: `ScreenScaffold` 골격. 입력 필드는 `Spacing size={16}` 간격으로 세로 배치, 정부 매칭 토글은 `ListRow` + 우측 `Switch`. 1차 액션 "결과 보기"는 하단 고정 `SubmitFooter`.
- **상태**: 로딩 = 프리필 계산 전 필드 disabled(최대 1프레임) / 빈 상태 없음 / 에러 = 각 TextField 하단 인라인 에러
- **키보드**: 숫자 키보드, 포커스 시 footer 버튼 가려짐 방지
- **터치**: 빠른 금액 Chip 44px, Switch 행 높이 56px, 제출 48px
- **광고**: 없음 (입력 화면은 광고 미배치, 결과 화면에 배치)
- **Navigation state contract**
  - Incoming: `location.state = null`
  - Outgoing: "결과 보기" → `navigate('/savings/result', { state: { input: SavingsInput, result: SavingsResult } })`

---

### S7. 적금 결과 — `/savings/result`
- **TDS 컴포넌트**: `Top`(뒤로가기 + "예상 수령액"), `SummaryHero`(CountUp 총액), `Card`, `ListRow` ×3, `MiniBar` ×3, `Button display="block"`("조건 다시 설정"), `Paragraph.Text`(고지), `AdSlot`
- **레이아웃 계약**: `ScreenScaffold` 골격. `data-testid="savings-total-hero"`(t2 CountUp) → `Spacing size={24}` → `data-testid="savings-breakdown-card"` Card 1개(원금/이자/정부지원금 `ListRow` 3행) → `data-testid="savings-minibar"` MiniBar 3개 → `AdSlot` → 고지 문구.
- **상태**: 로딩 없음(state 로 전달된 계산 완료 값) / 빈 상태 = `location.state === null` 이면 `/savings` replace 리다이렉트 / 에러 = ErrorBoundary
- **터치**: "조건 다시 설정" 48px `display="block"`
- **Navigation state contract**
  - Incoming: `location.state = { input: SavingsInput; result: SavingsResult } | null`
  - Outgoing: "조건 다시 설정" → `navigate('/savings', { replace: true })` / state null → `navigate('/savings', { replace: true })`

---

### S8. 설정 — `/settings`
- **TDS 컴포넌트**: `Top`(뒤로가기 + "설정"), `ListRow`("입대 정보 수정", "급여표 기준 연도", "데이터 초기화", "앱 정보"), `BottomSheet`(입대 정보 수정 폼: `Chip` + `TextField`), `AlertDialog`(초기화 확인), `Toast`, `Paragraph.Text`(고지 전문)
- **레이아웃 계약**: `ScreenScaffold` 골격. 설정 항목은 `ListRow` 세로 나열, 파괴적 액션("데이터 초기화")은 마지막 그룹에 `Spacing size={24}` 로 분리.
- **상태**: 로딩 = 프로필 읽기 전 `ListRow` 값 자리 스켈레톤 / 빈 상태 없음 / 에러 = 저장 실패 시 Toast "저장 공간이 부족해요. 설정에서 기록을 정리해주세요"
- **터치**: 모든 `ListRow` 56px 높이
- **광고**: 없음
- **Navigation state contract**
  - Incoming: `location.state = null`
  - Outgoing: 초기화 확인 → `navigate('/onboarding', { replace: true })` / 뒤로가기 → `navigate(-1)`

---

## Data Storage

> 모든 키는 `enlistpay.` prefix + `.v1` suffix. 저장 전 `JSON.stringify`, 읽기 시 try/catch 파싱 실패 → 키 삭제 후 `null` 반환.

| localStorage key | shape | 예상 크기 | 비고 |
|---|---|---|---|
| `enlistpay.profile.v1` | `ServiceProfile` | ~220 B | 단일 객체 |
| `enlistpay.vacations.v1` | `VacationRecord[]` | 항목당 ~150 B × 최대 200개 ≈ 30 KB | 상한 200개, 초과 시 저장 거부 |
| `enlistpay.savings.v1` | `SavingsInput` | ~110 B | 마지막 입력값 |
| `enlistpay.flags.v1` | `AppFlags` | ~120 B | 리워드 잠금 해제 시각 포함 |

**총 예상 사용량: 약 31 KB (5MB 한도의 0.7%)**

### 저장 형태 예시

```jsonc
// enlistpay.profile.v1
{ "schemaVersion": 1, "branch": "ARMY", "enlistDate": "2026-01-05",
  "serviceMonths": 18, "dischargeDate": "2027-07-04", "nickname": "",
  "createdAt": 1767571200000, "updatedAt": 1767571200000 }

// enlistpay.vacations.v1
[ { "id": "ep-1767571200000-a1b2c3", "type": "REWARD", "direction": "GRANT",
    "days": 4, "date": "2026-08-10", "memo": "체력검정 우수", "createdAt": 1767571200000 } ]

// enlistpay.savings.v1
{ "monthlyDeposit": 400000, "months": 12, "annualRatePercent": 5.0, "useGovMatch": true }

// enlistpay.flags.v1
{ "onboardingDone": true, "rewardUnlockedUntil": 1767657600000,
  "payTableYear": 2025, "disclaimerAckAt": 1767571200000 }
```

### 용량 방어 규칙
- `VacationRecord` 배열 길이가 200을 초과하는 저장 요청은 `{ ok: false, error: "휴가 기록은 최대 200개까지 저장할 수 있어요" }` 를 반환한다.
- `setItem` 이 `QuotaExceededError` 를 throw 하면 상태를 롤백하고 Toast "저장 공간이 부족해요. 설정에서 기록을 정리해주세요" 를 표시한다.

---

## API Contract

**해당 없음 (외부 API 호출 0건).**

- EnlistPay는 서버 통신 없이 동작한다. 급여표·정기휴가 일수·복무기간·적금 조건은 앱 내장 상수(`src/domain/payTable.ts`)이며, 연도 개정 시 앱 재배포로 반영한다.
- 따라서 CORS 설정, 네트워크 에러 처리, 인증 토큰 전달이 필요한 지점이 없다. (F8 AC-4로 검증)
- 향후 연도별 급여표를 원격에서 받아야 할 경우에만 별도 Railway API 서버(`GET /pay-table?year=2026 → { year: number; monthlyPay: Record<Rank, number>; annualLeaveDays: Record<Branch, number> }`, 에러 시 `{ error: string }`)를 설계한다 — MVP 범위 외.

---

## Assumptions

1. **급여표(2025년 기준 가정)**: 이병 750,000원 / 일병 900,000원 / 상병 1,200,000원 / 병장 1,500,000원. 실제 공표 금액과 다를 경우 `PAY_TABLE_2025` 상수만 수정하면 전 화면에 반영된다.
2. **복무기간 기본값**: 육군·해병대 18개월, 해군 20개월, 공군·사회복무 21개월.
3. **진급 규칙**: 이병 2개월 → 일병 6개월 → 상병 6개월 → 병장 잔여 전체. 부대별 예외(진급 누락·조기 진급)는 반영하지 않으며 CP-5 고지로 안내한다.
4. **정기휴가 일수 가정**: 육군·해병대 24일, 해군 27일, 공군·사회복무 28일. 위로·청원·포상 휴가는 사용자가 직접 입력한다.
5. **월별 급여 계산 규칙**: 각 월의 15일(전역 월은 전역일) 기준 계급의 월급을 적용하고, 첫 달과 전역 달만 `월급 × 해당 월 복무일수 / 해당 월 총일수` 로 일할 계산하며 원 단위 반올림한다.
6. **적금 시뮬레이션**: 단리 적립식(`P × r/12 × n(n+1)/2`), 정부 매칭지원금 100%, 이자소득 비과세 가정. 은행 우대금리·중도해지·군 적금 자격 요건은 반영하지 않는다.
7. **리워드 잠금 해제 기간**: 광고 1회 시청 시 24시간(86,400,000ms) 해제. 매일 재방문 시 리워드 노출이 발생하는 구조로 PRD의 수익 가정과 정합한다.
8. 사용자는 1개의 복무 프로필만 관리한다(장병 가족이 여러 명을 추적하는 다중 프로필은 MVP 범위 외).
9. 토스 앱이 세션을 자동 제공하므로 별도 사용자 식별·서버 동기화가 없고, 기기 변경 시 데이터는 이전되지 않는다(설정 화면 안내 문구로 고지).
10. 앱 사용 언어는 한국어 단일이며, 통화 표기는 원(₩) 콤마 구분 3자리.

---

## Open Questions

1. **2026년 병사 봉급 확정치**: 2026년 계급별 월급 및 자산형성지원금(장병내일준비적금 매칭 한도) 확정 수치를 어느 시점 기준으로 내장할 것인가? (현재는 2025년 값으로 시드, 연도 선택 UI는 표시 전용)
2. **일할 계산 정책 검증**: 실제 군 급여 지급은 월 단위 전액 지급 방식인지 일할 계산인지 확인 필요. 확인 결과에 따라 F5 AC-1의 첫 달 금액(653,226원)이 750,000원으로 변경될 수 있다.
3. **사회복무요원 급여 체계**: 사회복무요원은 현역과 급여·휴가 체계가 다를 수 있어 별도 상수 테이블이 필요한지 확인 필요. (현재는 공군과 동일 값으로 가정)
4. **리워드 광고 해제 주기**: 24시간 해제가 적절한가, 아니면 매 진입마다 광고를 노출해 노출량을 높일 것인가? (UX 저해 vs. 수익 트레이드오프 — PRD 목표 MRR ₩337,000 기준 재검토 필요)
5. **D-day 위젯**: PRD Core Features 5번의 "위젯 화면"은 앱 내 홈 대시보드(S2)로 해석했다. OS 홈스크린 위젯은 네이티브 모듈이 필요해 MVP 범위 외로 두었는데, 이 해석이 맞는가?
6. **휴가 종류 확장**: 청원·위로 외에 병가·특별휴가 유형을 추가할 필요가 있는가? (현재 4종: 정기/포상/위로/청원)
7. **프로모션 캠페인**: 초기 사용자 확보를 위해 `grantPromotionReward`(1인 최대 5,000원)를 사용할 계획이 있는가? 있다면 promotionCode 발급 및 예산 상한 정책 필요.