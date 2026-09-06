import { Top, Paragraph, Spacing, ListRow, Chip, Button } from '@toss/tds-mobile';
import { Navigate, useNavigate } from 'react-router-dom';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { Card } from '../components/Card';
import { CalcDisclaimer } from '../components/CalcDisclaimer';
import { useAppData } from '../app/useAppData';
import { calcRankPeriods, getNextPromotion, isEarlyDischargeBeforeSergeant } from '../domain/rank';
import { RANK_LABEL } from '../domain/payTable';
import { todayISO, formatWon, formatKoreanDate } from '../domain/date';

function formatPeriodDate(iso: string): string {
  return iso.replace(/-/g, '.');
}

export default function Rank() {
  const navigate = useNavigate();
  const { profile } = useAppData();

  if (!profile) {
    return <Navigate to="/onboarding" replace />;
  }

  const today = todayISO();
  const anchor = today < profile.enlistDate ? profile.enlistDate : today > profile.dischargeDate ? profile.dischargeDate : today;

  const periods = calcRankPeriods(profile);
  const next = getNextPromotion(profile, anchor);
  const early = isEarlyDischargeBeforeSergeant(profile);

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>계급·진급</Top.TitleParagraph>} />}
    >
      <Spacing size={16} />

      <Card testId="next-promotion">
        <Paragraph.Text typography="st13" color="secondary">
          다음 진급
        </Paragraph.Text>
        <Spacing size={4} />
        {next ? (
          <Paragraph.Text typography="t3">
            {`${RANK_LABEL[next.rank]}까지 D-${next.dday} · ${formatKoreanDate(next.date)}`}
          </Paragraph.Text>
        ) : (
          <Paragraph.Text typography="t3">마지막 계급이에요</Paragraph.Text>
        )}
      </Card>

      <Spacing size={24} />

      {periods.map((p) => {
        const isNow = anchor >= p.startDate && anchor <= p.endDate;
        return (
          <ListRow
            key={p.rank}
            data-testid="rank-row"
            aria-current={isNow ? 'true' : undefined}
            left={<Paragraph.Text typography="t5">{RANK_LABEL[p.rank]}</Paragraph.Text>}
            contents={
              <ListRow.Texts
                type="2RowTypeA"
                top={`${formatPeriodDate(p.startDate)} ~ ${formatPeriodDate(p.endDate)}`}
                bottom={isNow ? '지금 이 계급이에요' : ''}
              />
            }
            right={<Paragraph.Text typography="st13">{formatWon(p.monthlyPay)}</Paragraph.Text>}
          >
            {isNow && <Chip>지금</Chip>}
          </ListRow>
        );
      })}

      {early && (
        <>
          <Spacing size={16} />
          <Paragraph.Text typography="st13" color="secondary">
            복무 기간이 짧아 병장 진급 전에 전역해요
          </Paragraph.Text>
        </>
      )}

      <Spacing size={24} />

      <Button variant="weak" size="large" display="block" onClick={() => navigate('/pay')}>
        누적 급여 보기
      </Button>

      <CalcDisclaimer />

      <Spacing size={88} />
    </ScreenScaffold>
  );
}
