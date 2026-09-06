import { Component, type ErrorInfo, type ReactNode } from "react";
import { Asset, Button, Paragraph, Spacing } from "@toss/tds-mobile";
import { PageShell } from "./PageShell";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * 렌더 중 발생한 예외를 잡아 흰 화면을 막는 최상위 경계.
 *
 * 토스 WebView 밖(브라우저·검수자 PC)에서는 SDK 호출이 false를 반환하는 게 아니라 throw한다.
 * 개별 화면의 try/catch를 빠져나온 예외가 여기서 멈추지 않으면 React 트리 전체가 언마운트되고
 * 첫 화면부터 흰 화면이 된다 — 검수 즉시 반려 사유.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // 개발 중 원인 추적용. 프로덕션 WebView에서는 이 경로가 실행되지 않는 것이 정상이다.
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <PageShell>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60dvh",
            padding: "0 16px",
            textAlign: "center",
          }}
        >
          <Asset.ContentIcon name="icon-warning-circle" alt="화면 오류" style={{ width: 48, height: 48 }} />
          <Spacing size={16} />
          <Paragraph.Text typography="t5">문제가 생겼어요</Paragraph.Text>
          <Spacing size={8} />
          <Paragraph.Text typography="st13" color="secondary">
            화면을 그리다 멈췄어요. 다시 시도하면 이어서 볼 수 있어요.
          </Paragraph.Text>
          <Spacing size={24} />
          <div style={{ width: "100%" }}>
            <Button variant="fill" display="block" onClick={this.handleRetry}>
              재시도
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }
}
