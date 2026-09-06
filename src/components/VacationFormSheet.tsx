import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { BottomSheet, Chip, TextField, Button, Paragraph, Spacing } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import type { ISODate, VacationDirection, VacationRecord, VacationType } from "@/lib/types";

export const TYPE_LABEL: Record<VacationType, string> = {
  ANNUAL: "정기",
  REWARD: "포상",
  CONSOLATION: "위로",
  PETITION: "청원",
};

const DIRECTION_LABEL: Record<VacationDirection, string> = {
  GRANT: "부여",
  USE: "사용",
};

const TYPE_ORDER: VacationType[] = ["ANNUAL", "REWARD", "CONSOLATION", "PETITION"];
const DIRECTION_ORDER: VacationDirection[] = ["GRANT", "USE"];

const DAYS_ERROR = "휴가는 0.5일 단위로 0.5~30일까지 입력할 수 있어요";
const DATE_RANGE_ERROR = "복무 기간 안의 날짜로 입력해주세요";

// 테스트 목(mocks.ts)은 TDS Chip을 selected/onClick을 직접 받는 단일 클릭 버튼으로 단순화한다.
// Onboarding.tsx와 동일한 브리지 — 그 목 계약에 맞춰 로컬 타입으로 캐스팅해 사용한다.
const SelectableChip = Chip as unknown as ComponentType<{
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
}>;

function fireHaptic(type: "success" | "tickWeak") {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

function validateDays(days: number): string | null {
  if (!Number.isFinite(days) || days < 0.5 || days > 30) return DAYS_ERROR;
  if (Math.abs(days * 2 - Math.round(days * 2)) > 1e-9) return DAYS_ERROR;
  return null;
}

function validateDate(date: string, enlistDate: ISODate, dischargeDate: ISODate): string | null {
  if (!date) return "날짜를 입력해주세요";
  if (date < enlistDate || date > dischargeDate) return DATE_RANGE_ERROR;
  return null;
}

interface VacationFormSheetProps {
  open: boolean;
  onCancel: () => void;
  onSave: (record: Omit<VacationRecord, "id" | "createdAt">) => void;
  enlistDate: ISODate;
  dischargeDate: ISODate;
}

/**
 * BottomSheet 휴가 기록 입력 폼 — 종류/방향 Chip + 일수·날짜·메모 TextField.
 * Pre-built 아님(패킷 전용 컴포넌트) — Vacation.tsx가 open 상태를 소유한다.
 */
export function VacationFormSheet({
  open,
  onCancel,
  onSave,
  enlistDate,
  dischargeDate,
}: VacationFormSheetProps) {
  const [type, setType] = useState<VacationType>("ANNUAL");
  const [direction, setDirection] = useState<VacationDirection>("USE");
  const [daysInput, setDaysInput] = useState("");
  const [date, setDate] = useState("");
  const [memo, setMemo] = useState("");

  useEffect(() => {
    if (!open) return;
    setType("ANNUAL");
    setDirection("USE");
    setDaysInput("");
    setDate("");
    setMemo("");
  }, [open]);

  const days = Number(daysInput);
  const daysError = validateDays(days);
  const dateError = validateDate(date, enlistDate, dischargeDate);
  const isValid = daysError === null && dateError === null;

  function handleSave() {
    if (!isValid) return;
    fireHaptic("success");
    onSave({ type, direction, days, date, memo: memo.trim() });
  }

  return (
    <BottomSheet open={open} onDimmerClick={onCancel}>
      <Paragraph.Text typography="t3">기록 추가</Paragraph.Text>
      <Spacing size={16} />

      <Paragraph.Text typography="st13" color="secondary">
        종류
      </Paragraph.Text>
      <Spacing size={8} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TYPE_ORDER.map((t) => (
          <SelectableChip
            key={t}
            selected={type === t}
            onClick={() => {
              setType(t);
              fireHaptic("tickWeak");
            }}
          >
            {TYPE_LABEL[t]}
          </SelectableChip>
        ))}
      </div>

      <Spacing size={16} />
      <Paragraph.Text typography="st13" color="secondary">
        부여 · 사용
      </Paragraph.Text>
      <Spacing size={8} />
      <div style={{ display: "flex", gap: 8 }}>
        {DIRECTION_ORDER.map((d) => (
          <SelectableChip
            key={d}
            selected={direction === d}
            onClick={() => {
              setDirection(d);
              fireHaptic("tickWeak");
            }}
          >
            {DIRECTION_LABEL[d]}
          </SelectableChip>
        ))}
      </div>

      <Spacing size={16} />
      <TextField
        variant="box"
        label="일수"
        placeholder="예: 3.5"
        inputMode="decimal"
        enterKeyHint="next"
        value={daysInput}
        onChange={(e) => setDaysInput(e.target.value)}
        hasError={!!daysError}
        help={daysError ?? undefined}
      />

      <Spacing size={16} />
      <TextField
        variant="box"
        label="날짜"
        placeholder="2026-03-01"
        inputMode="numeric"
        enterKeyHint="next"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        hasError={!!dateError}
        help={dateError ?? undefined}
      />

      <Spacing size={16} />
      <TextField
        variant="box"
        label="메모"
        placeholder="예: 포상 휴가 사용"
        enterKeyHint="done"
        maxLength={30}
        value={memo}
        onChange={(e) => setMemo(e.target.value.slice(0, 30))}
      />
      <Spacing size={4} />
      <Paragraph.Text typography="st13" color="tertiary">
        {`${memo.length}/30자`}
      </Paragraph.Text>

      <Spacing size={24} />
      <Button variant="fill" display="block" disabled={!isValid} onClick={handleSave}>
        휴가 기록 저장
      </Button>
      <Spacing size={24} />
    </BottomSheet>
  );
}
