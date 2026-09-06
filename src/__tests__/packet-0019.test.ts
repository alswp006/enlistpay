import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, renderHook } from "@testing-library/react";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { mockAll } from "@/__tests__/__helpers__/mocks";

mockAll();

import { AdFooterSlot } from "@/components/AdFooterSlot";
import { useHaptic } from "@/hooks/useHaptic";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";

afterEach(() => {
  vi.unstubAllEnvs();
});

// ── scripts/policy-scan.mjs 실행 헬퍼 (실제 CLI 실행 — AC 문구 "실행 시"를 그대로 검증) ──
const SCRIPT_PATH = fileURLToPath(new URL("../../scripts/policy-scan.mjs", import.meta.url));
const SRC_DIR = fileURLToPath(new URL("../../src", import.meta.url));

function runScan(dir: string): { code: number; output: string } {
  try {
    const output = execFileSync("node", [SCRIPT_PATH, dir], { encoding: "utf8" });
    return { code: 0, output };
  } catch (e: any) {
    return { code: typeof e.status === "number" ? e.status : 1, output: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

function makeFixtureDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "policy-scan-"));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content, "utf8");
  }
  return dir;
}

describe("배너 슬롯 래퍼 · 햅틱 헬퍼 · 검수 정책 정적 스캔", () => {
  // ── AC-1: AdFooterSlot ──
  it("AC-1[P0]: AdSlot을 Spacing(24) 두 개로 감싸고 하위에 safe-area paddingBottom을 적용하며 sticky/fixed를 쓰지 않는다", () => {
    vi.stubEnv("VITE_TOSS_AD_GROUP_ID", "test-ad-group");
    const { container } = render(React.createElement(AdFooterSlot));

    const spacings = container.querySelectorAll('[data-spacing="24"]');
    expect(spacings.length).toBe(2);

    const adSlot = container.querySelector(".ad-slot") as HTMLElement | null;
    expect(adSlot).not.toBeNull();
    expect(adSlot!.getAttribute("data-ad-group-id")).toBe("test-ad-group");

    const paddedEl = container.querySelector('[style*="safe-area-inset-bottom"]') as HTMLElement | null;
    expect(paddedEl).not.toBeNull();
    expect(paddedEl!.style.paddingBottom).toContain("24px");
    expect(paddedEl!.style.paddingBottom).toContain("env(safe-area-inset-bottom)");

    expect(container.innerHTML).not.toMatch(/position:\s*(fixed|sticky)/);
  });

  it("AC-1: 광고 그룹 ID 환경변수가 없어도 크래시하지 않고 렌더된다", () => {
    expect(() => render(React.createElement(AdFooterSlot))).not.toThrow();
  });

  // ── AC-2: useHaptic ──
  it("AC-2[P0]: tapCta()는 generateHapticFeedback을 success 타입으로 호출한다", () => {
    const { result } = renderHook(() => useHaptic());
    result.current.tapCta();
    expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "success" });
  });

  it("AC-2[P0]: tapToggle()은 generateHapticFeedback을 tickWeak 타입으로 호출한다", () => {
    const { result } = renderHook(() => useHaptic());
    result.current.tapToggle();
    expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "tickWeak" });
  });

  it("AC-2: SDK 호출이 throw해도 크래시하지 않고 조용히 삼킨다", () => {
    const before = (generateHapticFeedback as any).mock.calls.length;
    (generateHapticFeedback as any).mockImplementationOnce(() => {
      throw new Error("no native bridge");
    });
    const { result } = renderHook(() => useHaptic());
    expect(() => result.current.tapCta()).not.toThrow();
    expect((generateHapticFeedback as any).mock.calls.length).toBe(before + 1);
  });

  // ── AC-3: 금지 SDK import · 외부 이탈 · 설치 유도 문구 ──
  it("AC-3[P0]: 금지 SDK import·외부 이탈(location.href)·설치 유도 문구가 있으면 exit code 1과 file:line을 출력한다", () => {
    const dir = makeFixtureDir({
      "bad-sdk.ts": 'import Stripe from "stripe";\n',
      "bad-nav.ts": 'window.location.href = "https://example.com";\n', // gate-allow: 정책 스캔 검증용 픽스처 문자열(실제 네비게이션 아님)
      "bad-copy.tsx": "export const Msg = () => <p>지금 앱을 다운로드하세요</p>;\n",
    });
    const { code, output } = runScan(dir);
    rmSync(dir, { recursive: true, force: true });

    expect(code).toBe(1);
    expect(output).toMatch(/bad-sdk\.ts:1/);
    expect(output).toMatch(/bad-nav\.ts:1/);
    expect(output).toMatch(/bad-copy\.tsx:1/);
  });

  it("AC-3[P0]: window.open과 금지 SDK 이름(admob)을 라인 단위로 검출한다", () => {
    const dir = makeFixtureDir({
      "bad-open.ts": 'function go() {\n  window.open("https://example.com");\n}\n', // gate-allow: 정책 스캔 검증용 픽스처 문자열(실제 네비게이션 아님)
      "bad-admob.ts": 'import { AdMobBanner } from "react-native-admob";\n',
    });
    const { code, output } = runScan(dir);
    rmSync(dir, { recursive: true, force: true });

    expect(code).toBe(1);
    expect(output).toMatch(/bad-open\.ts:2/);
    expect(output).toMatch(/bad-admob\.ts:1/);
  });

  // ── AC-4: HEX 하드코딩 · 금지 UI 라이브러리 · 현재 코드베이스 통과 ──
  it("AC-4[P0]: HEX 하드코딩과 shadcn/@mui/antd/@chakra-ui import를 검출하되 CSS 변수 폴백 hex는 통과시킨다", () => {
    const dir = makeFixtureDir({
      "bad-hex.tsx": 'const style = { color: "#FFFFFF" };\n',
      "bad-hex2.tsx": 'const style = { background: "#333" };\n',
      "bad-mui.tsx": 'import { Button } from "@mui/material";\n',
      "bad-antd.tsx": 'import { Button } from "antd";\n',
      "bad-chakra.tsx": 'import { Box } from "@chakra-ui/react";\n',
      "ok-hex-fallback.css": "color: var(--tds-color-grey500, #6B7684);\n",
    });
    const { code, output } = runScan(dir);
    rmSync(dir, { recursive: true, force: true });

    expect(code).toBe(1);
    expect(output).toMatch(/bad-hex\.tsx:1/);
    expect(output).toMatch(/bad-mui\.tsx:1/);
    expect(output).toMatch(/bad-antd\.tsx:1/);
    expect(output).toMatch(/bad-chakra\.tsx:1/);
    expect(output).not.toMatch(/ok-hex-fallback\.css/);
  });

  it("AC-4[P0]: __tests__ 디렉터리는 스캔에서 제외된다 (테스트 픽스처 문자열 자기 오탐 방지)", () => {
    const dir = makeFixtureDir({});
    mkdirSync(join(dir, "__tests__"), { recursive: true });
    writeFileSync(join(dir, "__tests__", "fixture.ts"), 'import Stripe from "stripe";\n', "utf8");

    const { code } = runScan(dir);
    rmSync(dir, { recursive: true, force: true });

    expect(code).toBe(0);
  });

  it("AC-4[P0]: 현재 코드베이스(src) 전체 스캔은 위반 0건으로 exit code 0이다", () => {
    const { code, output } = runScan(SRC_DIR);
    expect(code).toBe(0);
    expect(output).not.toMatch(/\.tsx?:\d+/);
  });

  // ── AC-5: grantPromotionReward 호출 · TDS 인라인 padding/margin ──
  it("AC-5: grantPromotionReward 호출과 TDS 컴포넌트 인라인 padding/margin을 함께 리포트하고 file:line으로 출력한다", () => {
    const dir = makeFixtureDir({
      "bad-promo.ts": 'grantPromotionReward({ promotionCode: "X", amount: 1000 });\n',
      "bad-spacing.tsx": "<ListRow style={{ padding: 16 }} />;\n",
    });
    const { code, output } = runScan(dir);
    rmSync(dir, { recursive: true, force: true });

    expect(code).toBe(1);
    expect(output).toMatch(/bad-promo\.ts:1/);
    expect(output).toMatch(/bad-spacing\.tsx:1/);
  });
});
