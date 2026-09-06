import { useCallback, useMemo } from "react";
import { useAppData } from "@/app/useAppData";

const REWARD_DURATION_MS = 24 * 60 * 60 * 1000;

export function useRewardUnlock() {
  const { flags, updateFlags } = useAppData();

  const unlocked = useMemo(() => Date.now() < flags.rewardUnlockedUntil, [flags.rewardUnlockedUntil]);

  const unlock = useCallback(() => {
    updateFlags({ rewardUnlockedUntil: Date.now() + REWARD_DURATION_MS });
  }, [updateFlags]);

  return { unlocked, unlock };
}
