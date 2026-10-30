"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import { Moon, Sun } from "lucide-react";
import { EASE_OUT, prefersReducedMotion } from "@/lib/motion";

const KEY = "henriqueventura-theme";

/**
 * Claro ↔ escuro; persiste no navegador (app/layout.tsx aplica antes da pintura).
 * O tema novo se espalha em círculo a partir do botão (M6) pela transição de
 * vista do navegador, só aqui e sem passar pelo roteador. Onde ela não existe,
 * ou com menos movimento, troca de uma vez como antes.
 */
export function ThemeToggle() {
  const [dark, setDark] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr) setDark(attr === "dark");
    else setDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);

  function apply(next: boolean) {
    flushSync(() => setDark(next));
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    try {
      localStorage.setItem(KEY, next ? "dark" : "light");
    } catch {
      /* sem storage: só nesta visita */
    }
  }

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    const next = !dark;
    if (typeof document.startViewTransition !== "function" || prefersReducedMotion()) {
      apply(next);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const t = document.startViewTransition(() => apply(next));
    t.ready
      .then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 480, easing: EASE_OUT, pseudoElement: "::view-transition-new(root)" },
        );
      })
      .catch(() => {
        /* transição abortada: o tema já trocou */
      });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded p-1 text-spine-ink/60 hover:bg-white/10 hover:text-spine-ink"
      aria-label={dark ? "Usar tema claro" : "Usar tema escuro"}
      title={dark ? "Tema claro" : "Tema escuro"}
    >
      {dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
    </button>
  );
}
