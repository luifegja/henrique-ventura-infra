import { cn } from "@/lib/utils";

/** Anel de 1.5px que gira. Herda a cor do texto; tamanho pelo `className`. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Carregando"
      className={cn(
        "inline-block size-3.5 shrink-0 animate-spin rounded-full border-[1.5px] border-current border-r-transparent",
        className,
      )}
    />
  );
}
