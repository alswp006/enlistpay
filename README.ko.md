🇺🇸 [English](./README.md)

# EnlistPay

앱인토스 (Vite + React + TDS) 입대 예정자와 현역 장병을 위한 전역일 D-day 계산과 계급별 월급·휴가 적립 현황을 한눈에 보여주는 앱

입영 대상자와 현역 장병이 전역일 계산, 계급별 월급 인상 시점, 휴가 일수를 여러 사이트에서 따로 찾아야 하고 매년 인상되는 병사 월급 반영이 번거로운 문제를 해결합니다.

## 기술 스택

- React 18.0.0
- TypeScript
- Vitest

## 라우트

| 경로 | 설명 |
|------|------|
| `/Home` | 홈 |
| `/NotFound` | 찾을 수 없음 |
| `/Onboarding` | 온보딩 |
| `/Pay` | 급여 |
| `/Rank` | 계급 |
| `/Savings` | 적립 |
| `/SavingsResult` | 적립 결과 |
| `/Settings` | 설정 |
| `/Vacation` | 휴가 |

## 시작하기

```bash
pnpm install
pnpm dev
```

## 개발

```bash
pnpm typecheck    # 타입 검사
pnpm test         # 테스트 실행
pnpm build        # 프로덕션 빌드
```

## 설계 문서

`.ai-factory/` 디렉토리에서 전체 설계 산출물을 확인하세요:
- `prd.md` — 제품 요구사항 문서
- `spec.md` — 기술 명세
- `task.md` — 에픽/태스크 분석

---

Built with [AI Factory](https://github.com/alswp006/ai-factory) · Last synced: 2026-09-06
