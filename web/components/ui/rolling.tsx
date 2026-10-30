"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Número que rola como odômetro quando muda (M11): o velho sai por cima e o
 * novo entra por baixo (ou o contrário, se diminuiu). Na montagem não anima —
 * só mudança de valor chama o olho. Com `prefers-reduced-motion`, o CSS global
 * zera as durações e a troca fica instantânea.
 */
export function Rolling({ value, className, format }: { value: number; className?: string; format?: (n: number) => string }) {
  const fmt = format ?? ((n: number) => n.toLocaleString("pt-BR"));
  const [s, setS] = React.useState({ cur: value, prev: null as number | null, up: true, n: 0 });

  if (value !== s.cur) setS({ cur: value, prev: s.cur, up: value > s.cur, n: s.n + 1 });

  return (
    <span className={cn("relative inline-flex overflow-hidden align-bottom tabular-nums", className)}>
      {s.prev !== null ? (
        <span
          key={`p${s.n}`}
          aria-hidden
          className={cn("absolute inset-0", s.up ? "animate-odo-out-up" : "animate-odo-out-down")}
          onAnimationEnd={() => setS((x) => (x.n === s.n ? { ...x, prev: null } : x))}
        >
          {fmt(s.prev)}
        </span>
      ) : null}
      <span key={`c${s.n}`} className={s.n === 0 ? undefined : s.up ? "animate-odo-in-up" : "animate-odo-in-down"}>
        {fmt(s.cur)}
      </span>
    </span>
  );
}
