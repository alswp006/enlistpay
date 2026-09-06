import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAppData } from "@/app/useAppData";

export function RequireProfile({ children }: { children: ReactNode }) {
  const { profile, flags } = useAppData();
  if (profile === null || flags.onboardingDone !== true) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}

export function RedirectIfOnboarded({ children }: { children: ReactNode }) {
  const { flags } = useAppData();
  if (flags.onboardingDone === true) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
