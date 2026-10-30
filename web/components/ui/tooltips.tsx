"use client";

import * as React from "react";

const DELAY = 300;
/** Passando de uma dica para outra logo em seguida, a próxima aparece sem espera. */
const GROUP_MS = 400;
const GAP = 8;

/**
 * Dicas do painel no lugar das do navegador (M19). Um componente só, montado
 * uma vez (components/providers.tsx), que atende todo elemento com `title`:
 * ao passar o mouse ou chegar pelo teclado, o `title` sai do elemento (o
 * navegador não mostra a dele) e volta ao sair, para leitores de tela e para
 * quem não tem JS. Assim os ~56 `title=` existentes e os que vierem ganham a
 * dica nova sem mudar uma linha, e sem biblioteca nova.
 *
 * Mouse e teclado sim; toque não (como a dica do navegador). Esc fecha.
 */
export function Tooltips() {
  React.useEffect(() => {
    let target: HTMLElement | null = null;
    let tip: HTMLDivElement | null = null;
    let timer = 0;
    let lastHiddenAt = 0;

    const text = (el: HTMLElement) => el.getAttribute("title") || el.dataset.tip || "";

    function hide() {
      window.clearTimeout(timer);
      if (tip) {
        tip.remove();
        tip = null;
        lastHiddenAt = Date.now();
      }
      if (target) {
        const t = target.dataset.tip;
        if (t && !target.hasAttribute("title")) target.setAttribute("title", t);
        target.removeAttribute("aria-describedby");
        target = null;
      }
    }

    function show(el: HTMLElement) {
      const label = text(el);
      if (!label) return;
      // O navegador não pode mostrar a dele por cima da nossa.
      el.dataset.tip = label;
      el.removeAttribute("title");
      target = el;
      const wait = Date.now() - lastHiddenAt < GROUP_MS ? 0 : DELAY;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (target !== el || !el.isConnected) return;
        tip = document.createElement("div");
        tip.id = "henriqueventura-tip";
        tip.setAttribute("role", "tooltip");
        tip.className = "tooltip";
        tip.textContent = label;
        // Dentro de um <dialog> aberto (a paleta), a dica precisa estar na mesma camada.
        (el.closest("dialog[open]") ?? document.body).appendChild(tip);
        el.setAttribute("aria-describedby", tip.id);
        place(el, tip);
      }, wait);
    }

    function place(el: HTMLElement, t: HTMLDivElement) {
      const r = el.getBoundingClientRect();
      const w = t.offsetWidth;
      const h = t.offsetHeight;
      const below = r.top - h - GAP < 4;
      const center = r.left + r.width / 2;
      const left = Math.min(Math.max(8, center - w / 2), window.innerWidth - w - 8);
      t.style.left = `${left}px`;
      t.style.top = `${below ? r.bottom + GAP : r.top - h - GAP}px`;
      t.style.setProperty("--arrow-x", `${Math.min(Math.max(10, center - left), w - 10)}px`);
      t.dataset.side = below ? "bottom" : "top";
    }

    const owner = (node: EventTarget | null) => (node instanceof Element ? (node.closest<HTMLElement>("[title], [data-tip]") ?? null) : null);

    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const el = owner(e.target);
      if (el === target) return;
      hide();
      if (el) show(el);
    };
    const onOut = (e: PointerEvent) => {
      if (!target) return;
      const to = e.relatedTarget;
      if (to instanceof Node && target.contains(to)) return;
      hide();
    };
    const onFocusIn = (e: FocusEvent) => {
      const el = owner(e.target);
      if (!el || !(e.target as Element).matches(":focus-visible")) return;
      hide();
      show(el);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };

    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("pointerdown", hide);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", hide);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", hide, true);
    return () => {
      hide();
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("pointerdown", hide);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", hide, true);
    };
  }, []);
  return null;
}
