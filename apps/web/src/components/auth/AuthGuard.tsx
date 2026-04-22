"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function AuthGuard({ children, fallback }: AuthGuardProps) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  useEffect(() => {
    // Don't redirect until Zustand has read the persisted token from
    // localStorage, otherwise authenticated users get bounced to /auth on
    // every hard refresh in the tiny window before rehydration completes.
    if (isHydrated && !isAuthenticated) {
      router.replace("/auth?mode=login");
    }
  }, [isHydrated, isAuthenticated, router]);

  if (!isHydrated || !isAuthenticated) {
    return fallback || (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary-500" />
      </div>
    );
  }

  return <>{children}</>;
}
