import { describe, it, expect } from "vitest";
import { calcSavings, validateSavingsInput } from "@/domain/savings";
import type { SavingsInput } from "@/lib/types";

describe("F8: 적금 계산 · 입력 검증 (packet-0008)", () => {
  describe("AC-2: 정부매칭 포함 계산", () => {
    it("월 40만원 × 12개월, 5% 연율, 정부매칭 100% → 총 973만원", () => {
      const input: SavingsInput = {
        monthlyDeposit: 400000,
        months: 12,
        annualRatePercent: 5.0,
        useGovMatch: true,
      };

      expect(calcSavings(input)).toEqual({
        principal: 4800000,
        interest: 130000,
        govMatch: 4800000,
        total: 9730000,
      });
    });
  });

  describe("AC-3: 정부매칭 미포함 계산", () => {
    it("동일 조건에서 useGovMatch:false → govMatch 0, total 493만원", () => {
      const input: SavingsInput = {
        monthlyDeposit: 400000,
        months: 12,
        annualRatePercent: 5.0,
        useGovMatch: false,
      };

      const result = calcSavings(input);
      expect(result.govMatch).toBe(0);
      expect(result.total).toBe(4930000);
    });
  });

  describe("AC-4: 입력 검증", () => {
    it("monthlyDeposit=0 → 월 납입액 안내 메시지", () => {
      expect(
        validateSavingsInput({ monthlyDeposit: 0, months: 12, annualRatePercent: 5.0, useGovMatch: false })
      ).toBe("월 납입액을 입력해주세요");
    });

    it("monthlyDeposit=550001 → 상한 초과 메시지", () => {
      expect(
        validateSavingsInput({ monthlyDeposit: 550001, months: 12, annualRatePercent: 5.0, useGovMatch: false })
      ).toBe("월 납입액은 550,000원 이하로 입력해주세요");
    });

    it("annualRatePercent가 범위 밖(0.05, 20.1)이면 금리 안내 메시지", () => {
      expect(
        validateSavingsInput({ monthlyDeposit: 400000, months: 12, annualRatePercent: 0.05, useGovMatch: false })
      ).toBe("금리는 0.1% ~ 20.0% 사이로 입력해주세요");
      expect(
        validateSavingsInput({ monthlyDeposit: 400000, months: 12, annualRatePercent: 20.1, useGovMatch: false })
      ).toBe("금리는 0.1% ~ 20.0% 사이로 입력해주세요");
    });

    it("정상 입력 → null 반환", () => {
      expect(
        validateSavingsInput({ monthlyDeposit: 400000, months: 12, annualRatePercent: 5.0, useGovMatch: true })
      ).toBeNull();
    });
  });
});
