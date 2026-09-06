import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Top, ListRow, Paragraph, Spacing, Button } from "@toss/tds-mobile";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { SummaryHero } from "@/components/SummaryHero";
import { CountUp } from "@/components/CountUp";
import { Amount } from "@/components/Amount";
import { AdSlot } from "@/components/AdSlot";
import { CalcDisclaimer } from "@/components/CalcDisclaimer";
import type { RouteState } from "@/lib/types";

export default function SavingsResult() {
  const navigate = useNavigate();
  const state = (useLocation().state as RouteState["/savings/result"]) ?? null;

  if (!state) {
    return <Navigate to="/savings" replace />;
  }

  const { input, result } = state;

  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>계산 결과</Top.TitleParagraph>} />}>
      <SummaryHero
        testId="savings-hero"
        label="전역할 때 받는 돈"
        value={<CountUp value={result.total} unit="원" typography="t1" />}
        caption={`월 ${input.monthlyDeposit.toLocaleString("ko-KR")}원 · ${input.months}개월 · 연 ${input.annualRatePercent.toFixed(1)}%`}
      />
      <Spacing size={24} />

      <ListRow
        contents={<ListRow.Texts type="1RowTypeA" top="원금" />}
        right={<Amount value={result.principal} unit="원" typography="t6" />}
      />
      <ListRow
        contents={<ListRow.Texts type="1RowTypeA" top="이자" />}
        right={<Amount value={result.interest} unit="원" typography="t6" />}
      />
      {input.useGovMatch ? (
        <ListRow
          contents={<ListRow.Texts type="1RowTypeA" top="정부 매칭지원금" />}
          right={<Amount value={result.govMatch} unit="원" typography="t6" />}
        />
      ) : null}

      <Spacing size={24} />
      <Button variant="weak" size="large" display="block" onClick={() => navigate("/savings")}>
        조건 바꾸기
      </Button>

      <Spacing size={24} />
      <Paragraph.Text typography="st13" color="tertiary">
        단리·비과세를 가정한 참고용 계산이에요.
      </Paragraph.Text>

      <Spacing size={24} />
      <AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID ?? ""} />
      <CalcDisclaimer />

      <Spacing size={88} />
    </ScreenScaffold>
  );
}
