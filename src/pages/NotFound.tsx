import { Asset, Button, Paragraph, Spacing, Top } from "@toss/tds-mobile";
import { useNavigate } from "react-router-dom";
import { ScreenScaffold } from "@/components/ScreenScaffold";

/** 정의되지 않은 경로(오래된 링크·오타 URL)로 들어왔을 때 보여주는 화면. */
export default function NotFound() {
  const navigate = useNavigate();

  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>EnlistPay</Top.TitleParagraph>} />}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "50dvh",
          textAlign: "center",
        }}
      >
        <Asset.ContentIcon name="icon-warning-circle" alt="없는 화면" style={{ width: 48, height: 48 }} />
        <Spacing size={16} />
        <Paragraph.Text typography="t5">없는 화면이에요</Paragraph.Text>
        <Spacing size={8} />
        <Paragraph.Text typography="st13" color="secondary">
          주소가 바뀌었거나 사라진 화면이에요. 홈에서 다시 찾아보세요.
        </Paragraph.Text>
      </div>

      <Spacing size={24} />

      <Button variant="fill" display="block" onClick={() => navigate("/")}>
        홈으로 가기
      </Button>

      <Spacing size={24} />
    </ScreenScaffold>
  );
}
