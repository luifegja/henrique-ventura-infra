import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { TH } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Cabeçalho de coluna ordenável: um link com `sort`/`dir` na URL. Clicar na coluna ativa
 * inverte a direção; a ativa mostra a seta e `aria-sort`. Era função local de /leads;
 * desde 22/10 serve também a /conversations.
 */
export function SortTH({
  href,
  active,
  dir,
  children,
  className,
}: {
  /** Destino do clique (já com sort e dir trocados). */
  href: string;
  active: boolean;
  dir: "asc" | "desc";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TH className={className} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}>
      <Link href={href} className={cn("inline-flex items-center gap-1 hover:text-ink", active && "text-ink")}>
        {children}
        {active ? dir === "asc" ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden /> : null}
      </Link>
    </TH>
  );
}
