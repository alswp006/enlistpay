import { describe, it, expect } from "vitest";
import { calcVacationSummary, type VacationRecord } from "@/domain/vacation";
import { calcSavings, validateSavingsInput, type SavingsInput } from "@/domain/savings";

// 테스트용 PAY_TABLE (2025년도 가정)
const PAY_TABLE_2025 = {
  ARMY: {
    baseVacationDays: 28,
    ranks: {
      "이병": { minExp: 0, maxExp: 12 },
      "상병": { minExp: 12, maxExp: 24 },
      "병장": { minExp: 24, maxExp: 36 },
    },
  },
};

describe("AC-1: 휴가 집계 (군별 정기휴가 + 기록)", () => {
  it("AC-1[P0]: 연간 휴가 28일(ARMY 기본) + 보상 4일 부여 - 6.5일 사용 = 21.5일 잔여", () => {
    const records: VacationRecord[] = [
      { type: "REWARD", direction: "GRANT", days: 4 },
      { type: "ANNUAL", direction: "USE", days: 6.5 },
    ];

    const result = calcVacationSummary("ARMY", records, PAY_TABLE_2025);

    expect(result.granted).toBe(28);
    expect(result.used).toBe(6.5);
    expect(result.remaining).toBe(21.5);
  });

  it("AC-1[P0]: 연간 휴가 초과 사용 시 remaining이 음수가 될 수 있다 (경고하지만 허용)", () => {
    const records: VacationRecord[] = [
      { type: "ANNUAL", direction: "USE", days: 35 },
    ];

    const result = calcVacationSummary("ARMY", records, PAY_TABLE_2025);

    expect(result.granted).toBe(28);
    expect(result.used).toBe(35);
    expect(result.remaining).toBe(-7);
  });

  it("AC-1: 부여 기록 여러 건 합산", () => {
    const records: VacationRecord[] = [
      { type: "REWARD", direction: "GRANT", days: 4 },
      { type: "REWARD", direction: "GRANT", days: 2 },
      { type: "ANNUAL", direction: "USE", days: 10 },
    ];

    const result = calcVacationSummary("ARMY", records, PAY_TABLE_2025);

    expect(result.granted).toBe(34); // 28 + 4 + 2
    expect(result.used).toBe(10);
    expect(result.remaining).toBe(24);
  });
});

describe("AC-2: 적금 계산 - 정부매칭 포함", () => {
  it("AC-2[P0]: 월 400,000원 × 12개월, 5% 연율, 정부매칭 100% → 9,730,000원", () => {
    const input: SavingsInput = {
      monthlyDeposit: 400000,
      months: 12,
      annualRatePercent: 5.0,
      useGovMatch: true,
    };

    const result = calcSavings(input);

    expect(result.principal).toBe(4800000); // 400,000 × 12
    expect(result.interest).toBe(130000);
    expect(result.govMatch).toBe(4800000); // 정부매칭은 원금과 동일
    expect(result.total).toBe(9730000); // 4,800,000 + 130,000 + 4,800,000
  });

  it("AC-2: 단리 이자 계산 검증 (400,000 × (1+2+...+12)/12 × 5%)", () => {
    // 단리 적금: 이자 = 월납입액 × (평균 기간) × 연율
    // 평균 기간 = (1 + 2 + ... + 12) / 12 = 78/12 = 6.5
    // 이자 = 400,000 × 6.5 × 0.05 = 130,000
    const input: SavingsInput = {
      monthlyDeposit: 400000,
      months: 12,
      annualRatePercent: 5.0,
      useGovMatch: false,
    };

    const result = calcSavings(input);

    expect(result.interest).toBe(130000);
    expect(result.principal + result.interest).toBe(4930000);
  });
});

describe("AC-3: 적금 계산 - 정부매칭 미포함", () => {
  it("AC-3[P0]: 동일 조건에서 useGovMatch:false → govMatch:0, total:4,930,000", () => {
    const input: SavingsInput = {
      monthlyDeposit: 400000,
      months: 12,
      annualRatePercent: 5.0,
      useGovMatch: false,
    };

    const result = calcSavings(input);

    expect(result.govMatch).toBe(0);
    expect(result.total).toBe(4930000); // principal + interest만
    expect(result.principal).toBe(4800000);
    expect(result.interest).toBe(130000);
  });

  it("AC-3: 6개월, 금리 3%일 때 이자 계산 검증", () => {
    // 평균 기간 = (1 + 2 + ... + 6) / 6 = 21/6 = 3.5
    // 이자 = 500,000 × 3.5 × 0.03 = 52,500
    const input: SavingsInput = {
      monthlyDeposit: 500000,
      months: 6,
      annualRatePercent: 3.0,
      useGovMatch: false,
    };

    const result = calcSavings(input);

    expect(result.principal).toBe(3000000); // 500,000 × 6
    expect(result.interest).toBe(52500);
    expect(result.total).toBe(3052500);
  });
});

describe("AC-4: 입력 검증", () => {
  it("AC-4[P0]: monthlyDeposit=0 → 에러 메시지 '월 납입액을 입력해주세요'", () => {
    const input: Partial<SavingsInput> = {
      monthlyDeposit: 0,
      months: 12,
      annualRatePercent: 5.0,
      useGovMatch: false,
    };

    const error = validateSavingsInput(input);

    expect(error).toBe("월 납입액을 입력해주세요");
  });

  it("AC-4[P0]: monthlyDeposit=550,001 → 에러 메시지 '월 납입액은 550,000원 이하로 입력해주세요'", () => {
    const input: Partial<SavingsInput> = {
      monthlyDeposit: 550001,
      months: 12,
      annualRatePercent: 5.0,
      useGovMatch: false,
    };

    const error = validateSavingsInput(input);

    expect(error).toBe("월 납입액은 550,000원 이하로 입력해주세요");
  });

  it("AC-4[P0]: annualRatePercent=0.05 → 에러 메시지 '금리는 0.1% ~ 20.0% 사이로 입력해주세요'", () => {
    const input: Partial<SavingsInput> = {
      monthlyDeposit: 400000,
      months: 12,
      annualRatePercent: 0.05,
      useGovMatch: false,
    };

    const error = validateSavingsInput(input);

    expect(error).toBe("금리는 0.1% ~ 20.0% 사이로 입력해주세요");
  });

  it("AC-4[P0]: annualRatePercent=20.1 → 에러 메시지 '금리는 0.1% ~ 20.0% 사이로 입력해주세요'", () => {
    const input: Partial<SavingsInput> = {
      monthlyDeposit: 400000,
      months: 12,
      annualRatePercent: 20.1,
      useGovMatch: false,
    };

    const error = validateSavingsInput(input);

    expect(error).toBe("금리는 0.1% ~ 20.0% 사이로 입력해주세요");
  });

  it("AC-4[P0]: 정상 입력 → null 반환", () => {
    const input: Partial<SavingsInput> = {
      monthlyDeposit: 400000,
      months: 12,
      annualRatePercent: 5.0,
      useGovMatch: true,
    };

    const error = validateSavingsInput(input);

    expect(error).toBeNull();
  });

  it("AC-4: 경계값 테스트 - monthlyDeposit=550,000 (정상)", () => {
    const input: Partial<SavingsInput> = {
      monthlyDeposit: 550000,
      months: 12,
      annualRatePercent: 5.0,
      useGovMatch: false,
    };

    const error = validateSavingsInput(input);

    expect(error).toBeNull();
  });

  it("AC-4: 경계값 테스트 - annualRatePercent=0.1 (하한, 정상)", () => {
    const input: Partial<SavingsInput> = {
      monthlyDeposit: 400000,
      months: 12,
      annualRatePercent: 0.1,
      useGovMatch: false,
    };

    const error = validateSavingsInput(input);

    expect(error).toBeNull();
  });

  it("AC-4: 경계값 테스트 - annualRatePercent=20.0 (상한, 정상)", () => {
    const input: Partial<SavingsInput> = {
      monthlyDeposit: 400000,
      months: 12,
      annualRatePercent: 20.0,
      useGovMatch: false,
    };

    const error = validateSavingsInput(input);

    expect(error).toBeNull();
  });

  it("AC-4: 음수 입력 검증 - monthlyDeposit=-100000", () => {
    const input: Partial<SavingsInput> = {
      monthlyDeposit: -100000,
      months: 12,
      annualRatePercent: 5.0,
      useGovMatch: false,
    };

    const error = validateSavingsInput(input);

    // 음수도 0과 같은 카테고리로 처리
    expect(error).toBe("월 납입액을 입력해주세요");
  });

  it("AC-4: 음수 입력 검증 - annualRatePercent=-0.5", () => {
    const input: Partial<SavingsInput> = {
      monthlyDeposit: 400000,
      months: 12,
      annualRatePercent: -0.5,
      useGovMatch: false,
    };

    const error = validateSavingsInput(input);

    expect(error).toBe("금리는 0.1% ~ 20.0% 사이로 입력해주세요");
  });
});

describe("AC-5: 모든 테스트 통과", () => {
  it("AC-5: vacation.ts와 savings.ts 모든 도메인 로직 검증 완료", () => {
    // AC-1 검증
    const vacationResult = calcVacationSummary(
      "ARMY",
      [
        { type: "REWARD", direction: "GRANT", days: 4 },
        { type: "ANNUAL", direction: "USE", days: 6.5 },
      ],
      PAY_TABLE_2025
    );
    expect(vacationResult).toEqual({ granted: 28, used: 6.5, remaining: 21.5 });

    // AC-2 검증
    const savingsWithMatch = calcSavings({
      monthlyDeposit: 400000,
      months: 12,
      annualRatePercent: 5.0,
      useGovMatch: true,
    });
    expect(savingsWithMatch).toEqual({
      principal: 4800000,
      interest: 130000,
      govMatch: 4800000,
      total: 9730000,
    });

    // AC-3 검증
    const savingsNoMatch = calcSavings({
      monthlyDeposit: 400000,
      months: 12,
      annualRatePercent: 5.0,
      useGovMatch: false,
    });
    expect(savingsNoMatch.govMatch).toBe(0);
    expect(savingsNoMatch.total).toBe(4930000);

    // AC-4 검증 (정상 입력)
    const validInput = validateSavingsInput({
      monthlyDeposit: 400000,
      months: 12,
      annualRatePercent: 5.0,
      useGovMatch: true,
    });
    expect(validInput).toBeNull();
  });
});
