import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-8 w-full rounded border border-line bg-surface px-2.5 text-sm text-ink placeholder:text-ink-muted/70 disabled:opacity-50 aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex w-full rounded border border-line bg-surface px-2.5 py-2 text-sm leading-relaxed text-ink placeholder:text-ink-muted/70 disabled:opacity-50 aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-8 rounded border border-line bg-surface px-2 text-sm text-ink disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
