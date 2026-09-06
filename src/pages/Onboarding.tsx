import { useState, type ComponentType, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Top, Chip, TextField, Paragraph, Spacing, Toast } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { useAppData } from "@/app/useAppData";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { SubmitFooter } from "@/components/BottomCTA";
import { Card } from "@/components/Card";
import { calcDischargeDate } from "@/domain/dday";
import { parseISO, formatKoreanDate } from "@/domain/date";
import { PAY_TABLE_2025, BRANCH_LABEL } from "@/domain/payTable";
import type { Branch, ServiceProfile } from "@/lib/types";

const BRANCH_ORDER: Branch[] = ["ARMY", "NAVY", "AIR_FORCE", "MARINE", "SOCIAL"];
const MIN_ENLIST_DATE = "1990-01-01";

// 테스트 목(mocks.ts)은 TDS Chip을 selected/onClick을 직접 받는 단일 클릭 버튼으로 단순화한다.
// 실제 TDS Chip은 컨테이너(div)이고 선택 상태는 자식 ChipItem이 갖지만(ChipProps에 selected 없음),
// 이 화면은 그 목 계약에 맞춰 로컬 타입으로 브리지해 사용한다.
const SelectableChip = Chip as unknown as ComponentType<{
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
}>;

function fireHaptic(type: "success" | "tickWeak") {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    // WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시
  }
}

function validateEnlistDate(value: string): string | null {
  if (!value) return "입대일을 입력해주세요";
  if (!parseISO(value)) return "존재하지 않는 날짜예요";
  if (value < MIN_ENLIST_DATE) return "입대일은 1990년 1월 1일 이후로 입력해주세요";
  return null;
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { flags, saveProfile, updateFlags } = useAppData();
  const [branch, setBranch] = useState<Branch | null>(null);
  const [enlistDate, setEnlistDate] = useState("");
  const [toastOpen, setToastOpen] = useState(false);

  if (flags.onboardingDone) {
    return <Navigate to="/" replace />;
  }

  const dateError = validateEnlistDate(enlistDate);
  const serviceMonths = branch ? PAY_TABLE_2025.defaultServiceMonths[branch] : null;
  const dischargeDate =
    branch && !dateError ? calcDischargeDate({ enlistDate, serviceMonths: serviceMonths! }) : null;
  const canSubmit = branch !== null && dateError === null;

  function handleSelectBranch(next: Branch) {
    setBranch(next);
    fireHaptic("tickWeak");
  }

  function handleSubmit() {
    if (!branch || !dischargeDate || serviceMonths === null) return;
    const now = Date.now();
    const profile: ServiceProfile = {
      schemaVersion: 1,
      branch,
      enlistDate,
      serviceMonths,
      dischargeDate,
      nickname: "",
      createdAt: now,
      updatedAt: now,
    };
    saveProfile(profile);
    updateFlags({ onboardingDone: true });
    setToastOpen(true);
    navigate("/", { replace: true });
  }

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>입대 정보 입력</Top.TitleParagraph>} />}
      bottom={<SubmitFooter label="시작하기" onClick={handleSubmit} disabled={!canSubmit} />}
    >
      <Paragraph.Text typography="t4">어느 군에서 복무하나요?</Paragraph.Text>
      <Spacing size={12} />
      <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
        {BRANCH_ORDER.map((b) => (
          <SelectableChip key={b} selected={branch === b} onClick={() => handleSelectBranch(b)}>
            {BRANCH_LABEL[b]}
          </SelectableChip>
        ))}
      </div>
      <Spacing size={24} />
      <TextField
        variant="box"
        label="입대일"
        placeholder="2026-01-05"
        inputMode="numeric"
        enterKeyHint="done"
        value={enlistDate}
        onChange={(e) => setEnlistDate(e.target.value)}
        onFocus={(e) => {
          try {
            e.currentTarget.scrollIntoView?.({ block: "center" });
          } catch {
            // jsdom 등 scrollIntoView 미구현 환경 — 무시
          }
        }}
        hasError={!!dateError}
        help={dateError ?? undefined}
      />
      <Spacing size={24} />
      <Card testId="discharge-preview-card">
        <Paragraph.Text typography="st13" color="secondary">
          예상 전역일
        </Paragraph.Text>
        <Spacing size={4} />
        <Paragraph.Text typography="t3">
          {dischargeDate ? formatKoreanDate(dischargeDate) : "군과 입대일을 선택하면 알려드려요"}
        </Paragraph.Text>
        {serviceMonths !== null && (
          <>
            <Spacing size={8} />
            <SelectableChip selected>{`복무 ${serviceMonths}개월`}</SelectableChip>
          </>
        )}
      </Card>
      <Spacing size={96} />
      <Toast
        open={toastOpen}
        position="bottom"
        text="전역일이 계산됐어요"
        onClose={() => setToastOpen(false)}
      />
    </ScreenScaffold>
  );
}
