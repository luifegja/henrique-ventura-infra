import { formatAge, formatDateTime, formatDateTimeFull, formatRelativeTime, daysSince, cn } from "@/lib/utils";

/**
 * Uma data na tela, sempre com a data completa no tooltip. Uma regra só:
 * `relative` (agora, 5 min, 3 h, 2 d, 12 ago) para listas cronológicas;
 * `age` (sempre relativo: 27 d, 3 meses) para "há quanto tempo" — casos parados,
 * cartões do Kanban, fila da equipe; `datetime` (25 ago, 14:30) para registros.
 * Fonte normal, números tabulares — monoespaçada é para telefone e id.
 * `warnAfterDays` pinta em vermelho discreto o que passou do limite.
 */
export function When({
  value,
  mode = "relative",
  empty = "—",
  warnAfterDays,
  className,
}: {
  value: string | Date | null | undefined;
  mode?: "relative" | "age" | "datetime";
  empty?: string;
  warnAfterDays?: number;
  className?: string;
}) {
  if (!value) return <span className={className}>{empty}</span>;
  const iso = typeof value === "string" ? value : value.toISOString();
  const late = warnAfterDays != null && daysSince(value) >= warnAfterDays;
  return (
    <time dateTime={iso} title={formatDateTimeFull(value)} className={cn("tabular-nums", late && "text-danger", className)}>
      {mode === "relative" ? formatRelativeTime(value) : mode === "age" ? formatAge(value) : formatDateTime(value)}
    </time>
  );
}
