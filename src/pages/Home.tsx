import { Top, Paragraph, Spacing, IconButton } from '@toss/tds-mobile';
import { Navigate, useNavigate } from 'react-router-dom';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SummaryHero } from '../components/SummaryHero';
import { Card } from '../components/Card';
import { Amount } from '../components/Amount';
import { AdSlot } from '../components/AdSlot';
import { CalcDisclaimer } from '../components/CalcDisclaimer';
import { useAppData } from '../app/useAppData';
import { calcServiceStatus, calcDaysUntilEnlist } from '../domain/dday';
import { getRankAt } from '../domain/rank';
import { calcMonthlyPayRows } from '../domain/pay';
import { calcVacationSummary, type BranchVacationTable } from '../domain/vacation';
import { PAY_TABLE_2025, RANK_LABEL } from '../domain/payTable';
import { todayISO, formatKoreanDate } from '../domain/date';

const VACATION_TABLE: BranchVacationTable = Object.fromEntries(
  Object.entries(PAY_TABLE_2025.annualLeaveDays).map(([branch, days]) => [branch, { baseVacationDays: days }]),
);

export default function Home() {
  const navigate = useNavigate();
  const { profile, vacations } = useAppData();

  if (!profile) {
    return <Navigate to="/onboarding" replace />;
  }

  const today = todayISO();
  const status = calcServiceStatus(profile, today);

  let heroLabel: string;
  let heroValue: string;
  let heroCaption: string;

  if (status.phase === 'BEFORE_ENLIST') {
    const daysUntil = calcDaysUntilEnlist(profile, today);
    heroLabel = '입대까지';
    heroValue = `D-${daysUntil}`;
    heroCaption = `입대일 ${formatKoreanDate(profile.enlistDate)}`;
  } else if (status.phase === 'DISCHARGED') {
    heroLabel = '전역했어요';
    heroValue = `${status.progressPercent}%`;
    heroCaption = `전역일 ${formatKoreanDate(status.dischargeDate)}`;
  } else {
    heroLabel = '전역까지';
    heroValue = `D-${status.remainingDays}`;
    heroCaption = `전역일 ${formatKoreanDate(status.dischargeDate)}`;
  }

  const rankAnchor =
    status.phase === 'BEFORE_ENLIST' ? profile.enlistDate : status.phase === 'DISCHARGED' ? profile.dischargeDate : today;
  const currentRank = getRankAt(profile, rankAnchor);
  const rankLabel = currentRank ? RANK_LABEL[currentRank] : '-';

  const monthlyRows = calcMonthlyPayRows(profile, PAY_TABLE_2025);
  const thisMonthPay = monthlyRows.find((row) => row.yearMonth === today.slice(0, 7))?.amount ?? 0;

  const vacationSummary = calcVacationSummary(profile.branch, vacations, VACATION_TABLE);

  const progressLabel = `${status.progressPercent.toFixed(1)}%`;

  return (
    <ScreenScaffold
      top={
        <Top
          title={<Top.TitleParagraph>EnlistPay</Top.TitleParagraph>}
          right={<IconButton aria-label="설정" name="icon-setting-mono" onClick={() => navigate('/settings')} />}
        />
      }
    >
      <Spacing size={16} />

      <SummaryHero
        testId="dday-hero"
        label={heroLabel}
        value={<Paragraph.Text typography="t1">{heroValue}</Paragraph.Text>}
        caption={heroCaption}
      />

      <Spacing size={24} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Card testId="summary-card" style={{ minHeight: 88 }} onClick={() => navigate('/rank')}>
          <Paragraph.Text typography="st13" color="secondary">
            복무 진행률
          </Paragraph.Text>
          <Spacing size={4} />
          <Paragraph.Text typography="t3">{progressLabel}</Paragraph.Text>
          <Spacing size={8} />
          <div
            data-testid="progress-bar"
            role="progressbar"
            aria-valuenow={status.progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{ height: 6, borderRadius: 3, backgroundColor: 'var(--adaptiveGrey200)' }}
          >
            <div
              style={{
                width: `${status.progressPercent}%`,
                height: '100%',
                borderRadius: 3,
                backgroundColor: 'var(--adaptiveBlue500)',
              }}
            />
          </div>
        </Card>

        <Card testId="summary-card" style={{ minHeight: 88 }} onClick={() => navigate('/rank')}>
          <Paragraph.Text typography="st13" color="secondary">
            현재 계급
          </Paragraph.Text>
          <Spacing size={4} />
          <Paragraph.Text typography="t3">{rankLabel}</Paragraph.Text>
        </Card>

        <Card testId="summary-card" style={{ minHeight: 88 }} onClick={() => navigate('/pay')}>
          <Paragraph.Text typography="st13" color="secondary">
            이번 달 급여
          </Paragraph.Text>
          <Spacing size={4} />
          <Amount value={thisMonthPay} unit="원" typography="t3" />
        </Card>

        <Card testId="summary-card" style={{ minHeight: 88 }} onClick={() => navigate('/vacation')}>
          <Paragraph.Text typography="st13" color="secondary">
            잔여 휴가
          </Paragraph.Text>
          <Spacing size={4} />
          <Amount value={vacationSummary.remaining} unit="일" typography="t3" />
        </Card>
      </div>

      <Spacing size={24} />

      <AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />
      <CalcDisclaimer />

      <Spacing size={88} />
    </ScreenScaffold>
  );
}
