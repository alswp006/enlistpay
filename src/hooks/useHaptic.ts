import { generateHapticFeedback } from "@apps-in-toss/web-framework";

export function useHaptic() {
  const tapCta = () => {
    try {
      generateHapticFeedback({ type: "success" });
    } catch {
      /* SDK unavailable — silent */
    }
  };

  const tapToggle = () => {
    try {
      generateHapticFeedback({ type: "tickWeak" });
    } catch {
      /* SDK unavailable — silent */
    }
  };

  return { tapCta, tapToggle };
}
