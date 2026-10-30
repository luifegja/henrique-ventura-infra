import * as React from "react";
import { cn } from "@/lib/utils";

/** Tabela densa: linhas de 32px, cabeçalho em versalete, números tabulares. */
export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded border border-line bg-surface">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-surface-2/70 text-left text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
      {children}
    </thead>
  );
}

export function TH({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("h-8 px-3 font-semibold", className)} {...props} />;
}

export function TBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <tbody className={cn("divide-y divide-line", className)}>{children}</tbody>;
}

export function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("h-8 transition-colors duration-1 hover:bg-surface-2/70", className)} {...props} />;
}

export function TD({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-3 py-1 align-middle", className)} {...props} />;
}
