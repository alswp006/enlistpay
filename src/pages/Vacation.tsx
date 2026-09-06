import { useState, type ComponentType, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Top, Paragraph, Spacing, ListRow, Chip, Button, AlertDialog, Asset } from "@toss/tds-mobile";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/StateView";
import { FloatingTabBar } from "@/components/FloatingTabBar";
import { AdSlot } from "@/components/AdSlot";
import { VacationFormSheet, TYPE_LABEL } from "@/components/VacationFormSheet";
import { useAppData } from "@/app/useAppData";
import { calcVacationSummary, type BranchVacationTable } from "@/domain/vacation";
import { PAY_TABLE_2025 } from "@/domain/payTable";
import { formatKoreanDate } from "@/domain/date";
import type { VacationRecord } from "@/lib/types";

const VACATION_TABLE: BranchVacationTable = Object.fromEntries(
  Object.entries(PAY_TABLE_2025.annualLeaveDays).map(([branch, days]) => [branch, { baseVacationDays: days }]),
);

// 테스트 목(mocks.ts)은 TDS Chip을 selected/onClick을 직접 받는 단일 클릭 버튼으로 단순화한다.
// Onboarding.tsx와 동일한 브리지 — 요약 카드의 정적 배지 표시용으로만 사용(클릭 없음).
const StaticChip = Chip as unknown as ComponentType<{
  selected?: boolean;
  children: ReactNode;
}>;

export default function Vacation() {
  const { profile, vacations, addVacation, removeVacation } = useAppData();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!profile) {
    return <Navigate to="/onboarding" replace />;
  }

  const summary = calcVacationSummary(profile.branch, vacations, VACATION_TABLE);

  function handleSave(record: Omit<VacationRecord, "id" | "createdAt">) {
    addVacation(record);
    setSheetOpen(false);
  }

  function handleConfirmDelete() {
    if (!confirmDeleteId) return;
    removeVacation(confirmDeleteId);
    setConfirmDeleteId(null);
  }

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>휴가</Top.TitleParagraph>} />}
      bottom={
        <FloatingTabBar
          items={[
            { label: "홈", path: "/" },
            { label: "계급", path: "/rank" },
            { label: "휴가", path: "/vacation" },
            { label: "적금", path: "/savings" },
          ]}
        />
      }
    >
      <Spacing size={16} />

      <Card testId="vacation-summary">
        <Paragraph.Text typography="st13" color="secondary">
          잔여 휴가
        </Paragraph.Text>
        <Spacing size={4} />
        <Paragraph.Text
          data-testid="vacation-remaining"
          typography="t1"
          style={summary.remaining < 0 ? { color: "var(--tds-color-red500)" } : undefined}
        >
          {`잔여 ${summary.remaining}일`}
        </Paragraph.Text>
        <Spacing size={8} />
        <div style={{ display: "flex", gap: 8 }}>
          <StaticChip selected>{`부여 ${summary.granted}일`}</StaticChip>
          <StaticChip selected>{`사용 ${summary.used}일`}</StaticChip>
        </div>
      </Card>

      <Spacing size={24} />
      <Button variant="weak" size="large" display="block" onClick={() => setSheetOpen(true)}>
        기록 추가
      </Button>

      <Spacing size={24} />
      {vacations.length === 0 ? (
        <EmptyState
          icon={<Asset.ContentIcon name="icon-calendar" alt="휴가 기록 없음" />}
          title="아직 휴가 기록이 없어요"
          description="포상·위로 휴가를 받으면 기록해두세요"
          action={
            <Button variant="weak" display="block" onClick={() => setSheetOpen(true)}>
              첫 기록 추가하기
            </Button>
          }
        />
      ) : (
        vacations.map((record) => (
          <ListRow
            key={record.id}
            data-testid="vacation-row"
            contents={
              <ListRow.Texts
                type="2RowTypeA"
                top={`${TYPE_LABEL[record.type]} ${record.direction === "GRANT" ? "+" : "-"}${record.days}일`}
                bottom={formatKoreanDate(record.date)}
              />
            }
            right={
              <Button variant="weak" size="small" onClick={() => setConfirmDeleteId(record.id)}>
                삭제
              </Button>
            }
          >
            {record.memo && (
              <Paragraph.Text typography="st13" color="secondary">
                {record.memo}
              </Paragraph.Text>
            )}
          </ListRow>
        ))
      )}

      <Spacing size={24} />
      <AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />
      <Spacing size={96} />

      <VacationFormSheet
        open={sheetOpen}
        onCancel={() => setSheetOpen(false)}
        onSave={handleSave}
        enlistDate={profile.enlistDate}
        dischargeDate={profile.dischargeDate}
      />

      <AlertDialog
        open={confirmDeleteId !== null}
        title="이 기록을 삭제할까요?"
        alertButton={<AlertDialog.AlertButton onClick={handleConfirmDelete}>삭제</AlertDialog.AlertButton>}
        onClose={() => setConfirmDeleteId(null)}
      />
    </ScreenScaffold>
  );
}
