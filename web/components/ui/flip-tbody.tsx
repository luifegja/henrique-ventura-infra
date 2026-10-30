"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { EASE_OUT, flipDelta, prefersReducedMotion } from "@/lib/motion";

type Snap = Map<string, { rect: DOMRect; node: HTMLTableRowElement; widths: number[] }>;

/**
 * Corpo de tabela que anima a troca de ordem ou de filtro (M25): as linhas
 * que continuam deslizam até a posição nova e as que saíram esmaecem no lugar
 * onde estavam. As novas entram pela cascata da página (classe `cascade`).
 * Cada linha precisa de `data-key`.
 *
 * É componente de classe porque só `getSnapshotBeforeUpdate` mede o DOM antes
 * de o React trocar as linhas — e as que saem já não existem depois.
 */
export class FlipTBody extends React.Component<{ className?: string; children: React.ReactNode }> {
  private body = React.createRef<HTMLTableSectionElement>();

  private rows(): HTMLTableRowElement[] {
    return Array.from(this.body.current?.querySelectorAll<HTMLTableRowElement>(":scope > tr[data-key]") ?? []);
  }

  getSnapshotBeforeUpdate(): Snap | null {
    if (prefersReducedMotion()) return null;
    const snap: Snap = new Map();
    for (const tr of this.rows()) {
      snap.set(tr.dataset.key!, { rect: tr.getBoundingClientRect(), node: tr, widths: Array.from(tr.cells).map((td) => td.getBoundingClientRect().width) });
    }
    return snap;
  }

  componentDidUpdate(_p: unknown, _s: unknown, snap: Snap | null) {
    if (!snap || !snap.size) return;
    const seen = new Set<string>();
    for (const tr of this.rows()) {
      const key = tr.dataset.key!;
      seen.add(key);
      const was = snap.get(key);
      const d = was ? flipDelta(was.rect, tr.getBoundingClientRect()) : null;
      if (d) tr.animate([{ transform: `translate(0, ${d.dy}px)` }, { transform: "none" }], { duration: 240, easing: EASE_OUT });
    }
    // As que saíram: uma cópia parada onde a linha estava, esmaecendo por cima.
    const table = this.body.current?.closest("table");
    for (const [key, was] of snap) {
      if (seen.has(key) || !table) continue;
      const ghost = document.createElement("table");
      ghost.className = table.className;
      ghost.setAttribute("aria-hidden", "true");
      Object.assign(ghost.style, {
        position: "fixed",
        left: `${was.rect.left}px`,
        top: `${was.rect.top}px`,
        width: `${was.rect.width}px`,
        tableLayout: "fixed",
        background: "rgb(var(--surface))",
        pointerEvents: "none",
        zIndex: "5",
      });
      const tbody = document.createElement("tbody");
      const row = was.node.cloneNode(true) as HTMLTableRowElement;
      Array.from(row.cells).forEach((td, i) => (td.style.width = `${was.widths[i] ?? 0}px`));
      tbody.appendChild(row);
      ghost.appendChild(tbody);
      document.body.appendChild(ghost);
      const a = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: EASE_OUT, fill: "forwards" });
      a.onfinish = () => ghost.remove();
    }
  }

  render() {
    return (
      <tbody ref={this.body} className={cn("divide-y divide-line", this.props.className)}>
        {this.props.children}
      </tbody>
    );
  }
}
