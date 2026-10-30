import { cn } from "@/lib/utils";

/** Monograma "HV" no ouro velho do item ativo da barra lateral (`--spine-accent`). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center rounded bg-spine-accent font-display text-[11px] font-semibold text-accent shadow-[inset_0_1px_0_rgba(255,255,255,.35)]",
        className,
      )}
      aria-hidden="true"
    >
      HV
    </span>
  );
}

/** Wordmark: monograma + "Henrique Ventura" em Fraunces. Herda a cor do texto de quem o usa. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-display text-lg font-semibold tracking-tight", className)}>
      <LogoMark className="h-6 w-6" />
      <span className="leading-tight">
        Henrique <span className="text-spine-accent">Ventura</span>
      </span>
    </span>
  );
}
