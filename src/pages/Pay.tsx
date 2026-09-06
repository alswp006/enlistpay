import { Top, Paragraph, Spacing, ListRow, Button, Asset } from '@toss/tds-mobile';
import { Navigate, useNavigate } from 'react-router-dom';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SummaryHero } from '../components/SummaryHero';
import { Amount } from '../components/Amount';
import { Card } from '../components/Card';
import { AdSlot } from '../components/AdSlot';
import { CalcDisclaimer } from '../components/CalcDisclaimer';
import { EmptyState } from '../components/StateView';
import { TossRewardAd } from '@/components/TossRewardAd';
import { useAppData } from '../app/useAppData';
import { useRewardUnlock } from '../hooks/useRewardUnlock';
import { calcServiceStatus } from '../domain/dday';
import { calcMonthlyPayRows, sumPaidUntil } from '../domain/pay';
import { PAY_TABLE_2025, RANK_LABEL } from '../domain/payTable';
import { todayISO, formatWon, formatKoreanDate } from '../domain/date';

function formatYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  return `${year}년 ${month}월`;
}

export default function Pay() {
  const navigate = useNavigate();
  const { profile } = useAppData();
  const { unlocked, unlock } = useRewardUnlock();

  if (!profile) {
    return <Navigate to="/onboarding" replace />;
  }

  const today = todayISO();
  const status = calcServiceStatus(profile, today);

  if (status.phase === 'BEFORE_ENLIST') {
    return (
      <ScreenScaffold top={<Top title={<Top.TitleParagraph>누적 급여</Top.TitleParagraph>} />}>
        <Spacing size={16} />
        <EmptyState
          icon={<Asset.ContentIcon name="icon-lock" alt="입대 전" />}
          title="아직 입대 전이에요"
          description="입대하면 그날부터 급여가 쌓여요"
          action={
            <Button variant="weak" display="block" onClick={() => navigate('/')}>
              홈으로
            </Button>
          }
        />
        <CalcDisclaimer />
        <Spacing size={24} />
      </ScreenScaffold>
    );
  }

  const rows = calcMonthlyPayRows(profile, PAY_TABLE_2025);
  const total = sumPaidUntil(rows, today);

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>누적 급여</Top.TitleParagraph>} />}
    >
      <Spacing size={16} />

      <SummaryHero
        testId="pay-hero"
        label="지금까지 받은 급여"
        value={<Amount value={total} unit="원" typography="t1" />}
        caption={`${formatKoreanDate(profile.enlistDate)} 입대 기준`}
      />

      <Spacing size={24} />

      {unlocked ? (
        rows.map((row) => (
          <ListRow
            key={row.yearMonth}
            data-testid="pay-row"
            contents={
              <ListRow.Texts
                type="2RowTypeA"
                top={formatYearMonth(row.yearMonth)}
                bottom={`${RANK_LABEL[row.rank]} · ${row.servedDays}/${row.daysInMonth}일`}
              />
            }
            right={<Paragraph.Text typography="t6">{formatWon(row.amount)}</Paragraph.Text>}
          />
        ))
      ) : (
        <TossRewardAd
          slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}
          buttonText="광고 보고 상세 내역 확인하기"
          description="한 번 보면 24시간 동안 계속 볼 수 있어요"
          onRewarded={unlock}
        >
          <Card testId="pay-locked">
            <Asset.ContentIcon name="icon-lock" alt="잠김" />
            <Spacing size={8} />
            <Paragraph.Text typography="t5">광고 보고 상세 내역 확인하기</Paragraph.Text>
            <Spacing size={4} />
            <Paragraph.Text typography="st13" color="secondary">
              한 번 보면 24시간 동안 계속 볼 수 있어요
            </Paragraph.Text>
          </Card>
        </TossRewardAd>
      )}

      <Spacing size={24} />
      <AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />
      <CalcDisclaimer />
      <Spacing size={88} />
    </ScreenScaffold>
  );
}
