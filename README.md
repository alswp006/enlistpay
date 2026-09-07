🇰🇷 [한국어](./README.ko.md)

# EnlistPay

앱인토스 (Vite + React + TDS) 입대 예정자와 현역 장병을 위한 전역일 D-day 계산과 계급별 월급·휴가 적립 현황을 한눈에 보여주는 앱 입영 대상자·현역 장병이 전역일 계산, 계급별 월급 인상 시점, 휴가 일수를 여러 사이트에서 따로 찾아야 하고 매년 인상되는 병사 월급 반영이 번거로움

## Tech Stack

- React 18.0.0
- TypeScript
- Vitest

## Routes

| Path | Description |
|------|-------------|
| `/Home` | Home |
| `/NotFound` | NotFound |
| `/Onboarding` | Onboarding |
| `/Pay` | Pay |
| `/Rank` | Rank |
| `/Savings` | Savings |
| `/SavingsResult` | SavingsResult |
| `/Settings` | Settings |
| `/Vacation` | Vacation |

## Getting Started

```bash
pnpm install
pnpm dev
```

## Development

```bash
pnpm typecheck    # Type checking
pnpm test         # Run tests
pnpm build        # Production build
```

## Design Documents

See `.ai-factory/` directory for full design artifacts:
- `prd.md` — Product Requirements Document
- `spec.md` — Technical Specification
- `task.md` — Epic/Task Breakdown

---
Built with [AI Factory](https://github.com/alswp006/ai-factory) · Last synced: 2026-09-06
