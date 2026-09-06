import { useState, type ComponentType, type FocusEvent, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Top, TextField, Chip, ListRow, Switch, Paragraph, Spacing, Button } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { useAppData } from "@/app/useAppData";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { CalcDisclaimer } from "@/components/CalcDisclaimer";
import { calcSavings, validateSavingsInput } from "@/domain/savings";
import { loadSavingsInput, saveSavingsInput } from "@/storage/savingsInput";
import { diffDays, todayISO } from "@/domain/date";
import type { SavingsInput, ServiceProfile } from "@/lib/types";

const DEPOSIT_STEP = 10000;
const MAX_DEPOSIT = 550000;
const MAX_PREFILL_MONTHS = 18;

// 테스트 목(mocks.ts)은 TDS Chip을 onClick 단일 클릭 버튼으로 단순화한다 — Onboarding.tsx와 동일 브리지.
const PresetChip = Chip as unknown as ComponentType<{ children: ReactNode; onClick?: () => void }>;

function fireHaptic(type: "success" | "tickWeak") {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    // WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시
  }
}

function scrollFieldIntoView(e: FocusEvent<HTMLInputElement>) {
  try {
    e.currentTarget.scrollIntoView?.({ block: "center" });
  } catch {
    // jsdom 등 scrollIntoView 미구현 환경 — 무시
  }
}

function snapDeposit(value: number): number {
  const clamped = Math.max(0, value);
  return Math.round(clamped / DEPOSIT_STEP) * DEPOSIT_STEP;
}

function defaultMonths(profile: ServiceProfile | null): number {
  if (!profile) return MAX_PREFILL_MONTHS;
  const remainingMonths = Math.round(diffDays(todayISO(), profile.dischargeDate) / 30);
  return Math.max(1, Math.min(remainingMonths, MAX_PREFILL_MONTHS));
}

function defaultInput(profile: ServiceProfile | null): SavingsInput {
  return {
    monthlyDeposit: 400000,
    months: defaultMonths(profile),
    annualRatePercent: 5.0,
    useGovMatch: true,
  };
}

export default function Savings() {
  const navigate = useNavigate();
  const { profile } = useAppData();
  const [input, setInput] = useState<SavingsInput>(() => loadSavingsInput() ?? defaultInput(profile));

  if (!profile) {
    return <Navigate to="/onboarding" replace />;
  }

  const validationError = validateSavingsInput(input);
  const depositError = validationError?.startsWith("월 납입액") ? validationError : null;
  const rateError = validationError?.startsWith("금리") ? validationError : null;

  function handleDepositChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/[^0-9]/g, "");
    setInput((prev) => ({ ...prev, monthlyDeposit: snapDeposit(Number(digits || "0")) }));
  }

  function handleMonthsChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/[^0-9]/g, "");
    setInput((prev) => ({ ...prev, months: Number(digits || "0") }));
  }

  function handleRateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9.]/g, "");
    setInput((prev) => ({ ...prev, annualRatePercent: raw === "" ? 0 : Number(raw) }));
  }

  function handlePresetTap(nextDeposit: number) {
    fireHaptic("tickWeak");
    setInput((prev) => ({ ...prev, monthlyDeposit: snapDeposit(nextDeposit) }));
  }

  function handleGovMatchToggle() {
    fireHaptic("tickWeak");
    setInput((prev) => ({ ...prev, useGovMatch: !prev.useGovMatch }));
  }

  function handleSubmit() {
    if (validateSavingsInput(input) !== null) return;
    fireHaptic("success");
    saveSavingsInput(input);
    navigate("/savings/result", { state: { input, result: calcSavings(input) } });
  }

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>적금 시뮬레이션</Top.TitleParagraph>} />}
    >
      <Paragraph.Text typography="st13" color="secondary">
        매달 얼마씩 모을까요?
      </Paragraph.Text>
      <Spacing size={12} />
      <TextField
        variant="box"
        label="월 납입액"
        placeholder="예: 400,000원"
        inputMode="numeric"
        enterKeyHint="next"
        suffix="원"
        value={String(input.monthlyDeposit)}
        onChange={handleDepositChange}
        onFocus={scrollFieldIntoView}
        hasError={!!depositError}
        help={depositError ?? undefined}
      />
      <Spacing size={8} />
      <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
        <PresetChip onClick={() => handlePresetTap(input.monthlyDeposit + 100000)}>+10만</PresetChip>
        <PresetChip onClick={() => handlePresetTap(input.monthlyDeposit + 300000)}>+30만</PresetChip>
        <PresetChip onClick={() => handlePresetTap(MAX_DEPOSIT)}>55만(최대)</PresetChip>
      </div>
      <Spacing size={16} />
      <TextField
        variant="box"
        label="납입 기간(개월)"
        placeholder="예: 18"
        inputMode="numeric"
        enterKeyHint="next"
        value={String(input.months)}
        onChange={handleMonthsChange}
        onFocus={scrollFieldIntoView}
      />
      <Spacing size={16} />
      <TextField
        variant="box"
        label="연 금리(%)"
        placeholder="예: 5.0"
        inputMode="decimal"
        enterKeyHint="done"
        suffix="%"
        value={String(input.annualRatePercent)}
        onChange={handleRateChange}
        onFocus={scrollFieldIntoView}
        hasError={!!rateError}
        help={rateError ?? undefined}
      />
      <Spacing size={16} />
      <ListRow
        contents={
          <ListRow.Texts
            type="2RowTypeA"
            top="정부 매칭지원금 포함"
            bottom={input.useGovMatch ? "매칭지원금 포함해서 계산해요" : "매칭지원금 없이 계산해요"}
          />
        }
        right={<Switch checked={input.useGovMatch} onChange={handleGovMatchToggle} />}
      />
      <Spacing size={24} />
      {/* 하단 고정 CTA 대신 흐름 안의 전체폭 버튼 — 이 화면은 탭 루트라 탭바와 겹치면 안 된다. */}
      <Button variant="fill" display="block" onClick={handleSubmit} disabled={validationError !== null}>
        계산하기
      </Button>
      <CalcDisclaimer />
      <Spacing size={96} />
    </ScreenScaffold>
  );
}
