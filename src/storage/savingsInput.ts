import type { SavingsInput } from "@/lib/types";
import { safeGet, safeSet } from "./core";

const SAVINGS_INPUT_KEY = "enlistpay:savings-input";

export function loadSavingsInput(): SavingsInput | null {
  return safeGet<SavingsInput | null>(SAVINGS_INPUT_KEY, null);
}

export function saveSavingsInput(input: SavingsInput): void {
  safeSet(SAVINGS_INPUT_KEY, input);
}
