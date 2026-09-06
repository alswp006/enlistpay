import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, waitFor, act, renderHook } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { mockTds } from "@/__tests__/__helpers__/mocks";
import { seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import type { ServiceProfile, AppFlags } from "@/lib/types";

mockTds();

import { AppDataProvider } from "@/app/AppDataProvider";
import { useAppData } from "@/app/useAppData";
import { RequireProfile, RedirectIfOnboarded } from "@/components/RouteGuard";
import { useRewardUnlock } from "@/hooks/useRewardUnlock";
import { CalcDisclaimer } from "@/components/CalcDisclaimer";

const VALID_PROFILE: ServiceProfile = {
  schemaVersion: 1,
  branch: "ARMY",
  enlistDate: "2025-01-01",
  serviceMonths: 18,
  dischargeDate: "2026-07-01",
  nickname: "철수",
  createdAt: 1,
  updatedAt: 1,
};

const DEFAULT_FLAGS: AppFlags = {
  onboardingDone: false,
  rewardUnlockedUntil: 0,
  payTableYear: 2025,
  disclaimerAckAt: 0,
};

function ErrorProbe() {
  useAppData();
  return null;
}

function Probe() {
  const data = useAppData();
  if (!data.ready) return null;
  return React.createElement(
    "div",
    null,
    React.createElement("span", { "data-testid": "ready" }, String(data.ready)),
    React.createElement("span", { "data-testid": "profile" }, data.profile ? data.profile.nickname : "none"),
    React.createElement("span", { "data-testid": "vacations-len" }, String(data.vacations.length)),
    React.createElement("span", { "data-testid": "onboarding-done" }, String(data.flags.onboardingDone)),
    React.createElement(
      "span",
      { "data-testid": "fn-check" },
      [
        typeof data.saveProfile,
        typeof data.addVacation,
        typeof data.removeVacation,
        typeof data.updateFlags,
        typeof data.resetAll,
      ].join(","),
    ),
    React.createElement(
      "button",
      { onClick: () => data.saveProfile(VALID_PROFILE) },
      "save-profile-btn",
    ),
  );
}

describe("packet-0009: 앱 데이터 컨텍스트 · 라우트 가드 · 계산 고지 컴포넌트", () => {
  describe("AC-1: AppDataProvider / useAppData", () => {
    it("AC-1[P0]: Provider 밖에서 useAppData()를 호출하면 정확한 에러 메시지를 던진다", () => {
      expect(() => render(React.createElement(ErrorProbe))).toThrow(
        "AppDataProvider 안에서 사용해주세요",
      );
    });

    it("AC-1[P0]: profile/vacations/flags/ready와 saveProfile/addVacation/removeVacation/updateFlags/resetAll을 제공한다", async () => {
      render(React.createElement(AppDataProvider, null, React.createElement(Probe)));

      await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));

      expect(screen.getByTestId("profile").textContent).toBe("none");
      expect(screen.getByTestId("vacations-len").textContent).toBe("0");
      expect(screen.getByTestId("onboarding-done").textContent).toBe("false");
      expect(screen.getByTestId("fn-check").textContent).toBe(
        "function,function,function,function,function",
      );
    });
  });

  describe("AC-2: 로딩 UI + 마운트 1회 읽기", () => {
    it("AC-2: ready가 false인 동안 자식 대신 로딩 UI를 렌더하고, 마운트 이후 갱신 시 localStorage를 재조회하지 않는다", async () => {
      const getItemSpy = vi.spyOn(Storage.prototype, "getItem");

      render(React.createElement(AppDataProvider, null, React.createElement(Probe)));

      // 데이터 준비 전: Probe(자식)이 렌더되지 않고 로딩 UI가 대신 보인다
      expect(screen.queryByTestId("ready")).toBeNull();

      await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));

      const readsAfterMount = getItemSpy.mock.calls.length;
      expect(readsAfterMount).toBeGreaterThan(0);

      getItemSpy.mockClear();
      act(() => {
        screen.getByText("save-profile-btn").click();
      });

      // saveProfile은 로컬 상태 갱신 + localStorage 쓰기(setItem)만 하고, 재조회(getItem)는 하지 않는다
      expect(getItemSpy.mock.calls.length).toBe(0);
      await waitFor(() => expect(screen.getByTestId("profile").textContent).toBe("철수"));
    });
  });

  describe("AC-3: RouteGuard (RequireProfile / RedirectIfOnboarded)", () => {
    function renderGuardedApp(guard: "require" | "redirect", initialPath: string) {
      const ProtectedElement =
        guard === "require"
          ? React.createElement(RequireProfile, null, React.createElement("div", null, "protected content"))
          : React.createElement(RedirectIfOnboarded, null, React.createElement("div", null, "onboarding form"));

      return render(
        React.createElement(
          AppDataProvider,
          null,
          React.createElement(
            MemoryRouter,
            { initialEntries: [initialPath] },
            React.createElement(
              Routes,
              null,
              React.createElement(Route, {
                path: guard === "require" ? "/" : "/onboarding",
                element: ProtectedElement,
              }),
              guard === "require"
                ? React.createElement(Route, { path: "/onboarding", element: React.createElement("div", null, "onboarding page") })
                : React.createElement(Route, { path: "/", element: React.createElement("div", null, "home page") }),
            ),
          ),
        ),
      );
    }

    it("AC-3[P0]: RequireProfile은 profile===null이면 /onboarding으로 리다이렉트한다", async () => {
      renderGuardedApp("require", "/");

      await waitFor(() => expect(screen.queryByText("onboarding page")).not.toBeNull());
      expect(screen.queryByText("protected content")).toBeNull();
    });

    it("AC-3[P0]: RequireProfile은 프로필이 있고 onboardingDone===true이면 children을 렌더한다", async () => {
      seedLocalStorage({
        "enlistpay:profile": VALID_PROFILE,
        "enlistpay:flags": { ...DEFAULT_FLAGS, onboardingDone: true },
      });

      renderGuardedApp("require", "/");

      await waitFor(() => expect(screen.queryByText("protected content")).not.toBeNull());
      expect(screen.queryByText("onboarding page")).toBeNull();
    });

    it("AC-3: RequireProfile은 profile은 있어도 onboardingDone!==true이면 /onboarding으로 리다이렉트한다", async () => {
      seedLocalStorage({
        "enlistpay:profile": VALID_PROFILE,
        "enlistpay:flags": { ...DEFAULT_FLAGS, onboardingDone: false },
      });

      renderGuardedApp("require", "/");

      await waitFor(() => expect(screen.queryByText("onboarding page")).not.toBeNull());
      expect(screen.queryByText("protected content")).toBeNull();
    });

    it("AC-3: RedirectIfOnboarded은 onboardingDone===true이면 '/'로 리다이렉트하고, 아니면 children을 렌더한다", async () => {
      // case 1: 온보딩 완료 → '/'로 리다이렉트
      seedLocalStorage({
        "enlistpay:profile": VALID_PROFILE,
        "enlistpay:flags": { ...DEFAULT_FLAGS, onboardingDone: true },
      });
      const { unmount } = renderGuardedApp("redirect", "/onboarding");

      await waitFor(() => expect(screen.queryByText("home page")).not.toBeNull());
      expect(screen.queryByText("onboarding form")).toBeNull();
      unmount();

      // case 2: 온보딩 미완료 → children(온보딩 폼) 렌더
      localStorage.clear();
      renderGuardedApp("redirect", "/onboarding");

      await waitFor(() => expect(screen.queryByText("onboarding form")).not.toBeNull());
      expect(screen.queryByText("home page")).toBeNull();
    });
  });

  describe("AC-4: useRewardUnlock", () => {
    function renderRewardHook() {
      return renderHook(() => useRewardUnlock(), {
        wrapper: ({ children }) => React.createElement(AppDataProvider, null, children),
      });
    }

    it("AC-4[P0]: rewardUnlockedUntil이 미래 시각이면 unlocked=true, 과거/0이면 unlocked=false", async () => {
      seedLocalStorage({
        "enlistpay:flags": { ...DEFAULT_FLAGS, rewardUnlockedUntil: Date.now() + 60_000 },
      });

      const { result } = renderRewardHook();
      await waitFor(() => expect(result.current).toBeDefined());
      expect(result.current.unlocked).toBe(true);

      localStorage.clear();
      seedLocalStorage({
        "enlistpay:flags": { ...DEFAULT_FLAGS, rewardUnlockedUntil: Date.now() - 60_000 },
      });

      const { result: result2 } = renderRewardHook();
      await waitFor(() => expect(result2.current).toBeDefined());
      expect(result2.current.unlocked).toBe(false);
    });

    it("AC-4[P0]: unlock() 호출 시 flags.rewardUnlockedUntil을 now+86400000(24시간)으로 저장하고 unlocked=true가 된다", async () => {
      const { result } = renderRewardHook();
      await waitFor(() => expect(result.current).toBeDefined());
      expect(result.current.unlocked).toBe(false);

      const before = Date.now();
      act(() => {
        result.current.unlock();
      });
      const after = Date.now();

      await waitFor(() => expect(result.current.unlocked).toBe(true));

      const stored = JSON.parse(localStorage.getItem("enlistpay:flags") ?? "{}");
      expect(stored.rewardUnlockedUntil).toBeGreaterThanOrEqual(before + 86_400_000);
      expect(stored.rewardUnlockedUntil).toBeLessThanOrEqual(after + 86_400_000);
    });
  });

  describe("AC-5: CalcDisclaimer", () => {
    it("AC-5[P0]: 정확한 고지 문구를 typography='st13' color='tertiary'로 렌더하고 HEX 색상을 하드코딩하지 않는다", () => {
      const { container } = render(React.createElement(CalcDisclaimer));

      const el = screen.getByText(
        "실제 지급액은 부대·개인 사정에 따라 다를 수 있어요. 참고용 계산 결과예요.",
      );
      expect(el.getAttribute("data-typography")).toBe("st13");
      expect(el.getAttribute("color")).toBe("tertiary");
      expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    });
  });
});
