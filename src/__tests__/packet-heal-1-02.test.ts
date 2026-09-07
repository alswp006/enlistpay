import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { mockAll } from "@/__tests__/__helpers__/mocks";

mockAll();

import AdFooterSlot from "@/components/AdFooterSlot";

afterEach(() => {
  vi.unstubAllEnvs();
});

// ── scripts/policy-scan.mjs 실행 헬퍼 (실제 CLI 실행) ──
const SCRIPT_PATH = fileURLToPath(new URL("../../scripts/policy-scan.mjs", import.meta.url));
const SRC_DIR = fileURLToPath(new URL("../../src", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PACKAGE_JSON_PATH = fileURLToPath(new URL("../../package.json", import.meta.url));

function runScan(target: string): { code: number; output: string } {
  try {
    const output = execFileSync("node", [SCRIPT_PATH, target], { encoding: "utf8" });
    return { code: 0, output };
  } catch (e: any) {
    return { code: typeof e.status === "number" ? e.status : 1, output: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

function makeFixtureDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "policy-scan-heal-"));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content, "utf8");
  }
  return dir;
}

describe("배너 슬롯 래퍼 · 햅틱 헬퍼 · 자기검출 없는 정책 스캔 (0019 재작성)", () => {
  // ── AC-1: AdFooterSlot은 default export ──
  it("AC-1[P0]: AdFooterSlot을 default export로 제공하며 AdSlot을 Spacing(24) 두 개 사이에 배치한다", () => {
    vi.stubEnv("VITE_TOSS_AD_GROUP_ID", "test-ad-group");
    const { container } = render(React.createElement(AdFooterSlot));

    const spacings = container.querySelectorAll('[data-spacing="24"]');
    expect(spacings.length).toBe(2);

    const adSlot = container.querySelector(".ad-slot") as HTMLElement | null;
    expect(adSlot).not.toBeNull();
    expect(adSlot!.getAttribute("data-ad-group-id")).toBe("test-ad-group");
  });

  it("AC-1: sticky/fixed 포지셔닝을 쓰지 않는다(FloatingTabBar와 겹침 방지)", () => {
    const { container } = render(React.createElement(AdFooterSlot));
    expect(container.innerHTML).not.toMatch(/position:\s*(fixed|sticky)/);
  });

  // ── AC-2: useHaptic ──
  it("AC-2[P0]: useHaptic.ts가 tapCta·tapToggle을 export한다", async () => {
    const mod = await import("@/hooks/useHaptic");
    // export 형태는 named 함수 useHaptic()이 { tapCta, tapToggle }을 반환하는 훅
    expect(typeof mod.useHaptic).toBe("function");
    const result = mod.useHaptic();
    expect(typeof result.tapCta).toBe("function");
    expect(typeof result.tapToggle).toBe("function");
  });

  it("AC-2[P0]: tapCta는 success, tapToggle은 tickWeak 타입으로 generateHapticFeedback을 호출한다", async () => {
    const { generateHapticFeedback } = await import("@apps-in-toss/web-framework");
    const { useHaptic } = await import("@/hooks/useHaptic");
    const { tapCta, tapToggle } = useHaptic();

    tapCta();
    expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "success" });

    tapToggle();
    expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "tickWeak" });
  });

  // ── AC-3 (핵심): 정책 스캔은 자기 자신을 위반으로 잡지 않는다 ──
  it("AC-3[P0]: policy-scan.mjs가 자기 자신을 스캔해도 위반 0건, exit code 0이다", () => {
    const { code, output } = runScan(SCRIPT_PATH);
    expect(code).toBe(0);
    expect(output).not.toMatch(/policy-scan\.mjs:\d+/);
  });

  it("AC-3[P0]: 현재 코드베이스(src) 전체 스캔은 위반 0건으로 exit code 0이다", () => {
    const { code, output } = runScan(SRC_DIR);
    expect(code).toBe(0);
    expect(output).not.toMatch(/\.tsx?:\d+/);
  });

  // ── AC-4: 금지 SDK import·HEX 하드코딩은 여전히 검출돼야 한다 ──
  it("AC-4[P0]: 금지 SDK import(stripe)와 HEX 하드코딩을 담은 임시 파일을 넣으면 파일·라인이 출력되고 exit code 1이다", () => {
    const dir = makeFixtureDir({
      "bad-sdk.ts": 'import Stripe from "stripe";\n',
      "bad-hex.tsx": 'const style = { color: "#FFFFFF" };\n',
    });
    const { code, output } = runScan(dir);
    rmSync(dir, { recursive: true, force: true });

    expect(code).toBe(1);
    expect(output).toMatch(/bad-sdk\.ts:1/);
    expect(output).toMatch(/bad-hex\.tsx:1/);
  });

  it("AC-4[P0]: 금지 UI 라이브러리(@mui) import와 외부 이탈(window.open)을 검출한다", () => {
    const dir = makeFixtureDir({
      "bad-mui.tsx": 'import { Button } from "@mui/material";\n',
      "bad-open.ts": 'function go() {\n  window.open("https://example.com");\n}\n', // gate-allow: 정책 스캔 검증용 픽스처(실제 네비게이션 아님)
    });
    const { code, output } = runScan(dir);
    rmSync(dir, { recursive: true, force: true });

    expect(code).toBe(1);
    expect(output).toMatch(/bad-mui\.tsx:1/);
    expect(output).toMatch(/bad-open\.ts:2/);
  });

  // ── AC-4 보강: node_modules/dist는 스캔 대상에서 제외 ──
  it("AC-4: node_modules·dist 디렉터리는 스캔에서 제외된다", () => {
    const dir = makeFixtureDir({});
    const nm = join(dir, "node_modules", "pkg");
    const dist = join(dir, "dist");
    execFileSync("mkdir", ["-p", nm]);
    execFileSync("mkdir", ["-p", dist]);
    writeFileSync(join(nm, "index.ts"), 'import Stripe from "stripe";\n', "utf8");
    writeFileSync(join(dist, "bundle.ts"), 'import Stripe from "stripe";\n', "utf8");

    const { code } = runScan(dir);
    rmSync(dir, { recursive: true, force: true });

    expect(code).toBe(0);
  });

  // ── package.json에 policy-scan 스크립트가 등록돼 있다 ──
  it("package.json에 'policy-scan': 'node scripts/policy-scan.mjs' 스크립트가 등록돼 있다", () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8"));
    expect(pkg.scripts["policy-scan"]).toBe("node scripts/policy-scan.mjs");
  });

  // ── AC-5: App.tsx / main.tsx는 절대 수정되지 않는다 ──
  it("AC-5[P0]: App.tsx와 main.tsx는 HEAD 대비 diff가 0줄이다", () => {
    const diff = execFileSync("git", ["diff", "--stat", "HEAD", "--", "src/App.tsx", "src/main.tsx"], {
      encoding: "utf8",
      cwd: REPO_ROOT,
    }).trim();
    expect(diff).toBe("");
  });
});
