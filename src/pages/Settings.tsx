import { useState, type ComponentType, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Top, Paragraph, Spacing, ListRow, Chip, Button, TextField, AlertDialog, Toast } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { Card } from "@/components/Card";
import { useAppData } from "@/app/useAppData";
import { calcDischargeDate } from "@/domain/dday";
import { parseISO, formatKoreanDate } from "@/domain/date";
import { BRANCH_LABEL } from "@/domain/payTable";
import type { Branch, ServiceProfile } from "@/lib/types";

function fireHaptic(type: "success" | "tickWeak") {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    // WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시
  }
}

// 테스트 목(mocks.ts)은 TDS Chip을 selected/onClick을 직접 받는 단일 클릭 버튼으로 단순화한다.
// Onboarding.tsx와 동일한 브리지 — 그 목 계약에 맞춰 로컬 타입으로 우회한다.
const SelectableChip = Chip as unknown as ComponentType<{
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
}>;

const BRANCH_ORDER: Branch[] = ["ARMY", "NAVY", "AIR_FORCE", "MARINE", "SOCIAL"];
const MIN_SERVICE_MONTHS = 12;
const MAX_SERVICE_MONTHS = 24;

function validateServiceMonths(value: number): string | null {
  if (!Number.isFinite(value) || value < MIN_SERVICE_MONTHS || value > MAX_SERVICE_MONTHS) {
    return "복무 기간은 12~24개월 사이로 입력해주세요";
  }
  return null;
}

export default function Settings() {
  const navigate = useNavigate();
  const { profile, saveProfile, resetAll } = useAppData();
  const [enlistDraft, setEnlistDraft] = useState(profile?.enlistDate ?? "");
  const [monthsDraft, setMonthsDraft] = useState(String(profile?.serviceMonths ?? ""));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);

  if (!profile) {
    return <Navigate to="/onboarding" replace />;
  }

  const monthsNum = Number(monthsDraft);
  const monthsError = monthsDraft === "" ? null : validateServiceMonths(monthsNum);

  function commitProfile(partial: Partial<Pick<ServiceProfile, "branch" | "enlistDate" | "serviceMonths">>) {
    const branch = partial.branch ?? profile!.branch;
    const enlistDate = partial.enlistDate ?? profile!.enlistDate;
    const serviceMonths = partial.serviceMonths ?? profile!.serviceMonths;
    saveProfile({
      ...profile!,
      branch,
      enlistDate,
      serviceMonths,
      dischargeDate: calcDischargeDate({ enlistDate, serviceMonths }),
      updatedAt: Date.now(),
    });
    setToastOpen(true);
  }

  function handleBranchChange(branch: Branch) {
    fireHaptic("tickWeak");
    commitProfile({ branch });
  }

  function handleEnlistChange(value: string) {
    setEnlistDraft(value);
    if (!parseISO(value)) return;
    commitProfile({ enlistDate: value });
  }

  function handleMonthsChange(value: string) {
    setMonthsDraft(value);
    const num = Number(value);
    if (value === "" || !Number.isFinite(num)) return;
    if (validateServiceMonths(num)) return;
    commitProfile({ serviceMonths: num });
  }

  function handleReset() {
    resetAll();
    setConfirmOpen(false);
    navigate("/onboarding", { replace: true });
  }

  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>설정</Top.TitleParagraph>} />}>
      <Spacing size={16} />
      <Card testId="profile-summary-card">
        <ListRow contents={<ListRow.Texts type="2RowTypeA" top="군별" bottom={BRANCH_LABEL[profile.branch]} />} />
        <ListRow
          contents={<ListRow.Texts type="2RowTypeA" top="입대일" bottom={formatKoreanDate(profile.enlistDate)} />}
        />
        <ListRow
          contents={
            <ListRow.Texts type="2RowTypeA" top="예상 전역일" bottom={formatKoreanDate(profile.dischargeDate)} />
          }
        />
      </Card>

      <Spacing size={24} />
      <Paragraph.Text typography="t4">군별 변경</Paragraph.Text>
      <Spacing size={12} />
      <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
        {BRANCH_ORDER.map((b) => (
          <SelectableChip key={b} selected={profile.branch === b} onClick={() => handleBranchChange(b)}>
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
        value={enlistDraft}
        onChange={(e) => handleEnlistChange(e.target.value)}
      />

      <Spacing size={16} />
      <TextField
        variant="box"
        label="복무 개월"
        placeholder="예: 18"
        inputMode="numeric"
        enterKeyHint="done"
        value={monthsDraft}
        onChange={(e) => handleMonthsChange(e.target.value)}
        hasError={!!monthsError}
        help={monthsError ?? undefined}
      />

      <Spacing size={32} />
      <Paragraph.Text typography="st13" color="tertiary">
        기기를 바꾸면 기록이 옮겨지지 않아요. 급여표는 2025년 기준이에요.
      </Paragraph.Text>

      <Spacing size={24} />
      <Button variant="weak" size="large" display="block" onClick={() => setConfirmOpen(true)}>
        데이터 초기화
      </Button>

      <AlertDialog
        open={confirmOpen}
        title="모든 기록을 지울까요?"
        description="복무 정보와 휴가 기록이 모두 사라져요"
        alertButton={<AlertDialog.AlertButton onClick={handleReset}>초기화</AlertDialog.AlertButton>}
        onClose={() => setConfirmOpen(false)}
      />

      <Spacing size={96} />
      <Toast
        open={toastOpen}
        position="bottom"
        text="입대 정보를 수정했어요"
        onClose={() => setToastOpen(false)}
      />
    </ScreenScaffold>
  );
}
