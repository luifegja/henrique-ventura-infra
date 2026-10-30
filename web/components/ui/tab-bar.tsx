"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { EASE_OUT, prefersReducedMotion } from "@/lib/motion";

export type TabItem = { href: string; label: React.ReactNode; active: boolean };

/**
 * Última posição do traço de cada barra de abas. Guardada fora do componente
 * porque algumas abas vivem na página (e não num layout): a barra remonta a
 * cada troca, e é daqui que o traço sabe de onde deslizar.
 */
const last = new Map<string, { left: number; width: number; at: number }>();
/** Passado disso, a troca não foi um clique na aba: o traço aparece parado. */
const RECENT_MS = 8000;

/**
 * Abas com o traço de acento que desliza até a aba ativa (M5). Sem JS, cada
 * aba ativa desenha a própria borda; depois de medir, o traço assume.
 */
export function TabBar({ id, label, tabs, className }: { id: string; label: string; tabs: TabItem[]; className?: string }) {
  const navRef = React.useRef<HTMLElement>(null);
  const barRef = React.useRef<HTMLSpanElement>(null);
  const [ready, setReady] = React.useState(false);
  const activeHref = tabs.find((t) => t.active)?.href ?? null;

  React.useLayoutEffect(() => {
    const nav = navRef.current;
    const bar = barRef.current;
    const el = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !bar || !el) {
      setReady(false);
      return;
    }
    const to = { left: el.offsetLeft, width: el.offsetWidth };
    bar.style.transform = `translateX(${to.left}px)`;
    bar.style.width = `${to.width}px`;
    const from = last.get(id);
    last.set(id, { ...to, at: Date.now() });
    setReady(true);
    if (from && Date.now() - from.at < RECENT_MS && (from.left !== to.left || from.width !== to.width) && !prefersReducedMotion()) {
      bar.animate(
        [
          { transform: `translateX(${from.left}px)`, width: `${from.width}px` },
          { transform: `translateX(${to.left}px)`, width: `${to.width}px` },
        ],
        { duration: 220, easing: EASE_OUT },
      );
    }
  }, [id, activeHref]);

  return (
    <nav ref={navRef} className={cn("relative mb-4 flex gap-1 border-b border-line", className)} aria-label={label}>
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm",
            t.active ? "font-medium text-ink" : "border-transparent text-ink-muted hover:text-ink",
            t.active && (ready ? "border-transparent" : "border-accent"),
          )}
        >
          {t.label}
        </Link>
      ))}
      <span ref={barRef} aria-hidden className={cn("pointer-events-none absolute bottom-[-1px] left-0 h-0.5 bg-accent", !ready && "hidden")} />
    </nav>
  );
}
