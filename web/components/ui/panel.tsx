import * as React from "react";
import { cn } from "@/lib/utils";

/** Superfície com borda (nada de sombra). */
export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded border border-line bg-surface", className)} {...props} />;
}

/** Título de seção: serifa pequena + filete. */
export function SectionTitle({
  children,
  aside,
  className,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 border-b border-line px-4 py-2.5", className)}>
      <h2 className="font-display text-md">{children}</h2>
      {aside ? <div className="text-xs text-ink-muted">{aside}</div> : null}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
      <div className="min-w-0">
        {eyebrow ? <div className="eyebrow mb-1">{eyebrow}</div> : null}
        <h1 className="text-xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/**
 * Painel sem conteúdo: uma linha discreta, não uma caixa tracejada. Numa
 * ficha nova, metade dos painéis está vazia; o vazio não pode ocupar a tela.
 */
export function EmptyState({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("px-4 py-3 text-sm text-ink-muted", className)}>{children}</p>;
}

/** Par rótulo/valor em listas descritivas. */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children ?? "—"}</dd>
    </div>
  );
}
