import { Spacing } from "@toss/tds-mobile";
import { AdSlot } from "./AdSlot";

export function AdFooterSlot() {
  const adGroupId = import.meta.env.VITE_TOSS_AD_GROUP_ID;

  return (
    <div
      style={{
        paddingBottom: `calc(24px + env(safe-area-inset-bottom))`,
      }}
    >
      <Spacing size={24} />
      {adGroupId && <AdSlot adGroupId={adGroupId} />}
      <Spacing size={24} />
    </div>
  );
}
