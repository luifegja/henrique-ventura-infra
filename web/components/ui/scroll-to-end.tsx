"use client";

import * as React from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Área rolável que abre já no fim (a conversa começa pela última mensagem) e
 * oferece "início" quando o topo saiu de vista. Sem tocar no conteúdo.
 */
export function ScrollToEnd({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [atTop, setAtTop] = React.useState(true);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    const onScroll = () => setAtTop(el.scrollTop < 40);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className="relative">
      <div ref={ref} className={className}>
        {children}
      </div>
      <button
        type="button"
        onClick={() => ref.current?.scrollTo({ top: 0, behavior: "smooth" })}
        className={cn(
          "absolute right-3 top-2 inline-flex items-center gap-1 rounded border border-line bg-surface px-2 py-0.5 text-xs text-ink-muted shadow-[0_4px_12px_-6px_rgb(var(--ink)/0.3)] hover:text-ink",
          atTop ? "pointer-events-none opacity-0" : "opacity-100",
        )}
        aria-hidden={atTop}
        tabIndex={atTop ? -1 : 0}
      >
        <ArrowUp className="size-3" aria-hidden /> início
      </button>
    </div>
  );
}
