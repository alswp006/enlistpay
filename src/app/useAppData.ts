import { useContext } from "react";
import { AppDataContext, type AppDataContextValue } from "@/app/AppDataProvider";

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error("AppDataProvider 안에서 사용해주세요");
  }
  return ctx;
}
