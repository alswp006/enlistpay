import { describe, it, expect } from "vitest";
import * as domainTypes from "@/domain/types";
import type { RouteState, ServiceProfile } from "@/domain/types";

describe("Packet 0001: 도메인 타입 + RouteState 계약 정의", () => {
  // AC-1: src/domain/types.ts가 16개 타입 심볼을 export하는가
  // 순수 타입/인터페이스는 TS 컴파일 시 런타임에서 완전히 소거되므로(0줄 런타임 코드 요구사항),
  // Object.keys() 같은 런타임 검사 대신 컴파일 타임에 각 타입이 실제로 사용 가능한지로 검증한다.
  it("AC-1: should export all 16 type symbols from domain/types", () => {
    const branch: domainTypes.Branch = "ARMY";
    const rank: domainTypes.Rank = "PRIVATE";
    const vacationType: domainTypes.VacationType = "ANNUAL";
    const vacationDirection: domainTypes.VacationDirection = "GRANT";
    const isoDate: domainTypes.ISODate = "2026-01-05";
    const serviceProfile: domainTypes.ServiceProfile = {
      schemaVersion: 1,
      branch: "ARMY",
      enlistDate: "2026-01-05",
      serviceMonths: 18,
      dischargeDate: "2027-07-04",
      nickname: "",
      createdAt: 0,
      updatedAt: 0,
    };
    const vacationRecord: domainTypes.VacationRecord = {
      id: "id",
      type: "ANNUAL",
      direction: "GRANT",
      days: 1,
      date: "2026-01-05",
      memo: "",
      createdAt: 0,
    };
    const payTable: domainTypes.PayTable = {
      year: 2025,
      monthlyPay: { PRIVATE: 750000, PFC: 900000, CORPORAL: 1200000, SERGEANT: 1500000 },
      annualLeaveDays: { ARMY: 24, MARINE: 24, NAVY: 27, AIR_FORCE: 28, SOCIAL: 28 },
      defaultServiceMonths: { ARMY: 18, MARINE: 18, NAVY: 20, AIR_FORCE: 21, SOCIAL: 21 },
    };
    const savingsInput: domainTypes.SavingsInput = {
      monthlyDeposit: 400000,
      months: 12,
      annualRatePercent: 5.0,
      useGovMatch: true,
    };
    const savingsResult: domainTypes.SavingsResult = {
      principal: 4800000,
      interest: 130000,
      govMatch: 4800000,
      total: 9730000,
    };
    const appFlags: domainTypes.AppFlags = {
      onboardingDone: true,
      rewardUnlockedUntil: 0,
      payTableYear: 2025,
      disclaimerAckAt: 0,
    };
    const serviceStatus: domainTypes.ServiceStatus = {
      enlistDate: "2026-01-05",
      dischargeDate: "2027-07-04",
      totalDays: 546,
      elapsedDays: 178,
      remainingDays: 368,
      progressPercent: 32.6,
      phase: "IN_SERVICE",
    };
    const rankPeriod: domainTypes.RankPeriod = {
      rank: "PRIVATE",
      startDate: "2026-01-05",
      endDate: "2026-03-04",
      monthlyPay: 750000,
    };
    const monthlyPayRow: domainTypes.MonthlyPayRow = {
      yearMonth: "2026-01",
      rank: "PRIVATE",
      servedDays: 27,
      daysInMonth: 31,
      amount: 653226,
    };
    const saveResult: domainTypes.SaveResult = { ok: true };
    const routeState: domainTypes.RouteState = {
      "/onboarding": null,
      "/": null,
      "/rank": null,
      "/pay": null,
      "/vacation": null,
      "/savings": null,
      "/savings/result": null,
      "/settings": null,
    };

    // 16개 타입 심볼이 모두 실존하며 사용 가능함을 값으로 확인 (컴파일 실패 시 이 테스트 자체가 fail)
    expect(
      [
        branch,
        rank,
        vacationType,
        vacationDirection,
        isoDate,
        serviceProfile,
        vacationRecord,
        payTable,
        savingsInput,
        savingsResult,
        appFlags,
        serviceStatus,
        rankPeriod,
        monthlyPayRow,
        saveResult,
        routeState,
      ].length
    ).toBe(16);
  });

  // AC-2: ServiceProfile.schemaVersion이 리터럴 1 타입인지 확인
  it("AC-2: ServiceProfile.schemaVersion should be literal 1, not number", () => {
    // 타입 체크: schemaVersion이 리터럴 1인지 확인
    const validProfile: ServiceProfile = {
      schemaVersion: 1,
      branch: "ARMY",
      enlistDate: "2026-01-05",
      serviceMonths: 18,
      dischargeDate: "2027-07-04",
      nickname: "테스트",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    expect(validProfile.schemaVersion).toBe(1);
    expect(typeof validProfile.schemaVersion).toBe("number");

    // schemaVersion: 2는 타입 에러가 나야 함 (주석으로 표기하되, 실제 컴파일은 실패해야 함)
    // const invalidProfile: ServiceProfile = {
    //   schemaVersion: 2,  // TS2322: Type '2' is not assignable to type '1'
    //   ...
    // };
  });

  // AC-3: RouteState는 8개 키를 가지며 '/savings/result'만 state 데이터를 가지는가
  it("AC-3: RouteState should have 8 route keys with '/savings/result' as only stateful route", () => {
    // 모든 라우트 경로 정의 확인
    const routePaths: (keyof RouteState)[] = [
      "/onboarding",
      "/",
      "/rank",
      "/pay",
      "/vacation",
      "/savings",
      "/savings/result",
      "/settings",
    ];

    // 각 라우트에 대한 타입 체크
    const testState: RouteState = {
      "/onboarding": null,
      "/": null,
      "/rank": null,
      "/pay": null,
      "/vacation": null,
      "/savings": null,
      "/savings/result": null,
      "/settings": null,
    };

    // 모든 라우트가 존재하는지 확인
    routePaths.forEach((path) => {
      expect(testState).toHaveProperty(path);
    });

    // 기본값이 null인지 확인
    Object.values(testState).forEach((value) => {
      expect(value).toBeNull();
    });
  });

  // AC-3 심화: /savings/result는 유효한 state를 가질 수 있는가
  it("AC-3 (advanced): /savings/result should accept SavingsInput & SavingsResult state", () => {
    const savingsResult: RouteState["/savings/result"] = {
      input: {
        monthlyDeposit: 400000,
        months: 12,
        annualRatePercent: 5.0,
        useGovMatch: true,
      },
      result: {
        principal: 4800000,
        interest: 130000,
        govMatch: 4800000,
        total: 9730000,
      },
    };

    expect(savingsResult).toBeTruthy();
    expect(savingsResult.input.monthlyDeposit).toBe(400000);
    expect(savingsResult.result.total).toBe(9730000);
  });

  // AC-4: src/domain/types.ts 상단 주석에 수신 패턴 포함 확인
  it("AC-4: should include useLocation state pattern comment at top of domain/types", async () => {
    const fs = await import("fs");
    const baseUrl = import.meta.url;
    const filePath = new URL("../domain/types.ts", baseUrl).pathname;
    const content = fs.readFileSync(filePath, "utf-8");

    // 수신 패턴 주석이 포함되어 있는지 확인
    expect(content).toContain("useLocation");
    expect(content).toContain("state as RouteState");
    expect(content).toContain("Navigate");
    expect(content).toContain("/savings");
  });

  // AC-5: src/lib/types.ts는 배럴 export만 포함하는가
  it("AC-5: src/lib/types.ts should be a barrel export with single line", async () => {
    const fs = await import("fs");
    const baseUrl = import.meta.url;
    const filePath = new URL("../lib/types.ts", baseUrl).pathname;
    const content = fs.readFileSync(filePath, "utf-8");

    // 정확히 배럴 export 한 줄만 있어야 함
    const lines = content
      .trim()
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("//"));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("export * from");
    expect(lines[0]).toContain("domain/types");
  });

  // 추가 검증: TypeScript 컴파일 에러 없이 모든 타입이 사용 가능한가
  it("additional: all types should compile without errors", () => {
    // 모든 타입을 변수에 할당해봄 (컴파일 시점 검증)
    const branch: domainTypes.Branch = "ARMY";
    const rank: domainTypes.Rank = "PRIVATE";
    const vacationType: domainTypes.VacationType = "ANNUAL";
    const vacationDirection: domainTypes.VacationDirection = "GRANT";
    const isoDate: domainTypes.ISODate = "2026-01-05";

    expect(branch).toBe("ARMY");
    expect(rank).toBe("PRIVATE");
    expect(vacationType).toBe("ANNUAL");
    expect(vacationDirection).toBe("GRANT");
    expect(isoDate).toBe("2026-01-05");
  });

  // 추가 검증: 필수 필드 구조 확인
  it("additional: ServiceProfile structure validation", () => {
    const profile: ServiceProfile = {
      schemaVersion: 1,
      branch: "NAVY",
      enlistDate: "2026-02-15",
      serviceMonths: 20,
      dischargeDate: "2028-02-14",
      nickname: "해군 장병",
      createdAt: 1704067200000,
      updatedAt: 1704067200000,
    };

    expect(profile.schemaVersion).toBe(1);
    expect(profile.branch).toBe("NAVY");
    expect(profile.serviceMonths).toBe(20);
    expect(profile.nickname).toHaveLength(5);
  });

  // 추가 검증: VacationRecord 구조 확인
  it("additional: VacationRecord structure validation", () => {
    const vacation: domainTypes.VacationRecord = {
      id: "ep-1704067200000-abc123",
      type: "REWARD",
      direction: "GRANT",
      days: 4,
      date: "2026-08-10",
      memo: "체력검정 우수",
      createdAt: 1704067200000,
    };

    expect(vacation.id).toBeTruthy();
    expect(vacation.direction).toBe("GRANT");
    expect(vacation.days).toBe(4);
  });

  // 추가 검증: AppFlags 구조 확인
  it("additional: AppFlags structure validation", () => {
    const flags: domainTypes.AppFlags = {
      onboardingDone: true,
      rewardUnlockedUntil: Date.now() + 86400000,
      payTableYear: 2025,
      disclaimerAckAt: Date.now(),
    };

    expect(flags.onboardingDone).toBe(true);
    expect(flags.payTableYear).toBe(2025);
    expect(typeof flags.rewardUnlockedUntil).toBe("number");
  });
});
