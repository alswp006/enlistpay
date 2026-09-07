import { Spacing } from "@toss/tds-mobile";
import { AdSlot } from "./AdSlot";

/**
 * 본문 맨 아래에 붙이는 공용 배너 슬롯.
 *
 * 위아래 24px 여백 + safe-area 하단 패딩으로 FloatingTabBar와 겹치지 않게 한다.
 * position: fixed/sticky를 쓰지 않는다 — 탭바가 이미 하단을 점유하고 있어
 * 고정 배치하면 탭 위에 겹쳐 뜬다.
 */
export function AdFooterSlot() {
  return (
    <div style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}>
      <Spacing size={24} />
      <AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />
      <Spacing size={24} />
    </div>
  );
}

export default AdFooterSlot;
