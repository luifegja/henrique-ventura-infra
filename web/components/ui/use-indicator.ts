"use client";

import * as React from "react";
import { prefersReducedMotion } from "@/lib/motion";

export type IndicatorBox = { top: number; left: number; width: number; height: number; animate: boolean };

/**
 * Mede o item escolhido dentro de um contêiner (position: relative) para um
 * fundo único deslizar até ele (M17, na linha do M4 e do M5). `activeKey` muda
 * quando a escolha muda; a primeira medição e as de redimensionamento não
 * animam. Sem medição (antes da hidratação), quem usa pinta o item escolhido
 * do jeito antigo.
 */
export function useIndicator<T extends HTMLElement>(selector: string, activeKey: string) {
  const ref = React.useRef<T>(null);
  const [box, setBox] = React.useState<IndicatorBox | null>(null);

  const measure = React.useCallback(
    (animate: boolean) => {
      const el = ref.current?.querySelector<HTMLElement>(selector);
      setBox((prev) =>
        el ? { top: el.offsetTop, left: el.offsetLeft, width: el.offsetWidth, height: el.offsetHeight, animate: animate && prev !== null && !prefersReducedMotion() } : null,
      );
    },
    [selector],
  );

  React.useLayoutEffect(() => measure(true), [measure, activeKey]);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure(false));
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  const style: React.CSSProperties | undefined = box
    ? { transform: `translate(${box.left}px, ${box.top}px)`, width: box.width, height: box.height }
    : undefined;
  return { ref, box, style };
}
