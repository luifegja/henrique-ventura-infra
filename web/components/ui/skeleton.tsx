import { cn } from "@/lib/utils";

/**
 * Bloco cinza com uma varredura discreta. Usado nos `loading.tsx` para a tela
 * já mostrar a forma do que vem enquanto o servidor responde — a alternativa
 * era a tela anterior congelar sem aviso.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-shimmer rounded bg-[linear-gradient(90deg,rgb(var(--surface-2))_0%,rgb(var(--line)/0.55)_50%,rgb(var(--surface-2))_100%)] bg-[length:200%_100%]",
        className,
      )}
      {...props}
    />
  );
}

/** Cabeçalho de página em esqueleto: olho, título, descrição. */
export function PageHeaderSkeleton({ actions = 0 }: { actions?: number }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-3.5 w-72" />
      </div>
      {actions > 0 ? (
        <div className="flex gap-2">
          {Array.from({ length: actions }, (_, i) => (
            <Skeleton key={i} className="h-8 w-28" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Tabela em esqueleto: cabeçalho e N linhas de 32 px. */
export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded border border-line bg-surface">
      <div className="flex h-8 items-center gap-6 bg-surface-2/70 px-3">
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} className="h-2.5 w-16" />
        ))}
      </div>
      <div className="divide-y divide-line">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex h-8 items-center gap-6 px-3">
            {Array.from({ length: cols }, (_, c) => (
              <Skeleton key={c} className={cn("h-3", c === 0 ? "w-36" : c === cols - 1 ? "ml-auto w-12" : "w-24")} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Painel com título e N linhas de texto. */
export function PanelSkeleton({ lines = 4, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("rounded border border-line bg-surface", className)}>
      <div className="flex items-baseline justify-between border-b border-line px-4 py-2.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="space-y-2.5 px-4 py-3">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className={cn("h-3", i % 3 === 2 ? "w-1/2" : "w-5/6")} />
        ))}
      </div>
    </div>
  );
}
