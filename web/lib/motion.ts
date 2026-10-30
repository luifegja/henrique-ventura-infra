/**
 * Movimento do painel (docs/decisoes/2026-09-25-movimento-do-painel.md).
 * A curva e as durações espelham os tokens de app/globals.css; aqui ficam só
 * para o que o CSS não alcança (Web Animations API e contagens).
 */

export const EASE_OUT = "cubic-bezier(0.2, 0.7, 0.2, 1)";
export const DUR = { 1: 120, 2: 180, 3: 260 } as const;

/**
 * O CSS global zera animações CSS com `prefers-reduced-motion`, mas não as
 * da Web Animations API nem contagens em JS: quem anima por script pergunta aqui.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function easeOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - c, 3);
}

/** Valor mostrado pela contagem (M1) no instante `elapsed` de uma animação de `duration` ms. */
export function countAt(value: number, elapsed: number, duration: number): number {
  if (duration <= 0) return value;
  return Math.round(easeOutCubic(elapsed / duration) * value);
}

/** Deslocamento de um elemento entre duas medições (a técnica FLIP). Zero quando mal se mexeu. */
export function flipDelta(from: { left: number; top: number }, to: { left: number; top: number }): { dx: number; dy: number } | null {
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  return Math.abs(dx) < 1 && Math.abs(dy) < 1 ? null : { dx, dy };
}
