import * as React from "react";
import { cn } from "@/lib/utils";

/** Chip discreto; a cor vem do chamador (ex.: instanceStatusMeta().chip). */
export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium leading-4",
        className,
      )}
      {...props}
    />
  );
}

export function Notice({
  tone = "info",
  className,
  children,
}: {
  tone?: "info" | "danger" | "ok";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={cn(
        "rounded border px-3 py-2 text-sm",
        tone === "danger" && "border-danger/40 bg-danger/5 text-danger",
        tone === "ok" && "border-state-won/40 bg-state-won/5 text-state-won",
        tone === "info" && "border-line bg-surface-2/60 text-ink-muted",
        className,
      )}
    >
      {children}
    </div>
  );
}
