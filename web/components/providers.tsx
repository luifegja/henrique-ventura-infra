"use client";

import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "@/components/ui/toast";
import { Tooltips } from "@/components/ui/tooltips";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        {children}
        <Tooltips />
      </ToastProvider>
    </SessionProvider>
  );
}
