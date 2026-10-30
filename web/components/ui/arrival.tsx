"use client";

import * as React from "react";
import { countAt, prefersReducedMotion } from "@/lib/motion";

/**
 * A chegada ao Painel (M1/M2): os contadores sobem até o valor e as barras
 * crescem, só na primeira vez que a tela abre na sessão do navegador.
 *
 * Só vale para navegação dentro do painel (o login entra por `router.push`).
 * Num recarregamento o servidor já pintou os números certos; contar de novo a
 * partir do zero seria um pisca, então a chegada fica para a próxima sessão.
 */
const ArrivalCtx = React.createContext(false);
const noop = () => () => {};

export function Arrival({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  // No SSR e na hidratação vale o snapshot do servidor (true); montado no
  // cliente, false. O useState só lê isso uma vez, na montagem.
  const hydrating = React.useSyncExternalStore(noop, () => false, () => true);
  const key = `henriqueventura-arrival:${id}`;
  const [active, setActive] = React.useState(() => {
    if (hydrating || prefersReducedMotion()) return false;
    try {
      return window.sessionStorage.getItem(key) !== "1";
    } catch {
      return false;
    }
  });

  React.useEffect(() => {
    try {
      window.sessionStorage.setItem(key, "1");
    } catch {
      /* sem storage: a chegada pode repetir, sem prejuízo */
    }
    if (!active) return;
    const t = window.setTimeout(() => setActive(false), 1500);
    return () => window.clearTimeout(t);
  }, [key, active]);

  return (
    <ArrivalCtx.Provider value={active}>
      <div className={className} data-arrival={active ? "" : undefined}>
        {children}
      </div>
    </ArrivalCtx.Provider>
  );
}

export function useArrival(): boolean {
  return React.useContext(ArrivalCtx);
}

const COUNT_MS = 700;

/** Número que conta de zero até o valor na chegada; fora dela, só o número. */
export function CountUp({ value, delay = 0 }: { value: number; delay?: number }) {
  const arrival = useArrival();
  const [shown, setShown] = React.useState(() => (arrival ? 0 : value));

  React.useEffect(() => {
    if (!arrival) {
      setShown(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now() + delay;
    const step = (now: number) => {
      const elapsed = Math.max(0, now - t0);
      setShown(countAt(value, elapsed, COUNT_MS));
      if (elapsed < COUNT_MS) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [arrival, value, delay]);

  return <>{shown.toLocaleString("pt-BR")}</>;
}
