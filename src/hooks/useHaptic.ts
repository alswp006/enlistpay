import { generateHapticFeedback } from "@apps-in-toss/web-framework";

/**
 * 햅틱 피드백 헬퍼.
 *
 * WebView 밖(로컬 브라우저·jsdom)에서는 SDK가 false를 반환하는 게 아니라 throw한다 →
 * 가드하지 않으면 핸들러가 터져 화면이 죽는다. 실패는 조용히 삼킨다.
 */
function fire(type: "success" | "tickWeak") {
  try {
    generateHapticFeedback({ type });
  } catch {
    /* 네이티브 브릿지 없음 — 무시 */
  }
}

export function useHaptic() {
  /** 1차 CTA(계산하기·저장) — 묵직한 성공 진동 */
  const tapCta = () => fire("success");
  /** 토글·칩 선택 — 가벼운 틱 */
  const tapToggle = () => fire("tickWeak");

  return { tapCta, tapToggle };
}

export default useHaptic;
