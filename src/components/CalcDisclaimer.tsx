import { Paragraph, Spacing } from "@toss/tds-mobile";

export function CalcDisclaimer() {
  return (
    <>
      <Spacing size={16} />
      <Paragraph.Text typography="st13" color="tertiary">
        실제 지급액은 부대·개인 사정에 따라 다를 수 있어요. 참고용 계산 결과예요.
      </Paragraph.Text>
    </>
  );
}
