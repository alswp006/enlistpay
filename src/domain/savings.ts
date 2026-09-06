import type { SavingsInput, SavingsResult } from "./types";

export type { SavingsInput, SavingsResult };

const MIN_RATE_PERCENT = 0.1;
const MAX_RATE_PERCENT = 20.0;
const MAX_MONTHLY_DEPOSIT = 550000;

export function calcSavings(input: SavingsInput): SavingsResult {
  const { monthlyDeposit, months, annualRatePercent, useGovMatch } = input;

  const principal = monthlyDeposit * months;
  // 단리 적금: 매월 납입분이 만기까지 남은 개월수만큼 이자를 받음 → 평균 예치기간 = (n+1)/2
  const averageMonths = (months + 1) / 2;
  const interest = Math.round(monthlyDeposit * averageMonths * (annualRatePercent / 100));
  const govMatch = useGovMatch ? principal : 0;
  const total = principal + interest + govMatch;

  return { principal, interest, govMatch, total };
}

export function validateSavingsInput(input: Partial<SavingsInput>): string | null {
  const { monthlyDeposit, annualRatePercent } = input;

  if (monthlyDeposit === undefined || monthlyDeposit <= 0) {
    return "월 납입액을 입력해주세요";
  }
  if (monthlyDeposit > MAX_MONTHLY_DEPOSIT) {
    return "월 납입액은 550,000원 이하로 입력해주세요";
  }
  if (
    annualRatePercent === undefined ||
    annualRatePercent < MIN_RATE_PERCENT ||
    annualRatePercent > MAX_RATE_PERCENT
  ) {
    return "금리는 0.1% ~ 20.0% 사이로 입력해주세요";
  }

  return null;
}
