import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Skeleton, Spacing } from "@toss/tds-mobile";
import type { AppFlags, ServiceProfile, VacationRecord } from "@/lib/types";
import { newId } from "@/storage/core";
import { clearAll as clearProfile, loadProfile, saveProfile as persistProfile } from "@/storage/profile";
import { loadFlags, saveFlags } from "@/storage/flags";
import {
  addVacation as persistAddVacation,
  loadVacations,
  removeVacation as persistRemoveVacation,
} from "@/storage/vacation";

const DEFAULT_FLAGS: AppFlags = {
  onboardingDone: false,
  rewardUnlockedUntil: 0,
  payTableYear: 2025,
  disclaimerAckAt: 0,
};

export interface AppDataContextValue {
  profile: ServiceProfile | null;
  vacations: VacationRecord[];
  flags: AppFlags;
  ready: boolean;
  saveProfile: (profile: ServiceProfile) => void;
  addVacation: (record: Omit<VacationRecord, "id" | "createdAt">) => void;
  removeVacation: (id: string) => void;
  updateFlags: (partial: Partial<AppFlags>) => void;
  resetAll: () => void;
}

function sortVacations(list: VacationRecord[]): VacationRecord[] {
  return [...list].sort((a, b) => {
    if (a.date !== b.date) return a.date > b.date ? -1 : 1;
    return b.createdAt - a.createdAt;
  });
}

export const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<ServiceProfile | null>(null);
  const [vacations, setVacations] = useState<VacationRecord[]>([]);
  const [flags, setFlags] = useState<AppFlags>(DEFAULT_FLAGS);

  // 마운트 1회만 localStorage를 읽는다 — 이후 갱신은 로컬 state + 쓰기 전용으로 처리한다.
  // 마이크로태스크로 미뤄 최초 렌더에서는 항상 로딩 UI가 먼저 보이게 한다.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setProfile(loadProfile());
      setVacations(loadVacations());
      setFlags(loadFlags());
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveProfile = useCallback((next: ServiceProfile) => {
    persistProfile(next);
    setProfile(next);
  }, []);

  const handleAddVacation = useCallback((record: Omit<VacationRecord, "id" | "createdAt">) => {
    const full: VacationRecord = { ...record, id: newId(), createdAt: Date.now() };
    const result = persistAddVacation(full);
    if (!result.ok) return;
    setVacations((prev) => sortVacations([...prev, full]));
  }, []);

  const handleRemoveVacation = useCallback((id: string) => {
    persistRemoveVacation(id);
    setVacations((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const handleUpdateFlags = useCallback((partial: Partial<AppFlags>) => {
    const next = saveFlags(partial);
    setFlags(next);
  }, []);

  const handleResetAll = useCallback(() => {
    clearProfile();
    vacations.forEach((v) => persistRemoveVacation(v.id));
    const next = saveFlags(DEFAULT_FLAGS);
    setProfile(null);
    setVacations([]);
    setFlags(next);
  }, [vacations]);

  const value = useMemo<AppDataContextValue>(
    () => ({
      profile,
      vacations,
      flags,
      ready,
      saveProfile: handleSaveProfile,
      addVacation: handleAddVacation,
      removeVacation: handleRemoveVacation,
      updateFlags: handleUpdateFlags,
      resetAll: handleResetAll,
    }),
    [profile, vacations, flags, ready, handleSaveProfile, handleAddVacation, handleRemoveVacation, handleUpdateFlags, handleResetAll],
  );

  if (!ready) {
    return (
      <div style={{ padding: 16 }}>
        <Skeleton />
        <Spacing size={12} />
        <Skeleton />
        <Spacing size={12} />
        <Skeleton />
      </div>
    );
  }

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}
