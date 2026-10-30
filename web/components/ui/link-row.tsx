"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Linha de tabela que abre uma rota ao clicar em qualquer lugar dela. Cliques
 * em links, botões e campos dentro da linha seguem o próprio destino. O link
 * "de verdade" (o nome) continua lá para teclado e leitor de tela.
 */
export function LinkRow({ href, className, children, ...props }: React.HTMLAttributes<HTMLTableRowElement> & { href: string }) {
  const router = useRouter();
  return (
    <tr
      {...props}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
        if ((e.target as HTMLElement).closest("a, button, input, select, textarea, summary, label")) return;
        router.push(href);
      }}
      onMouseEnter={() => router.prefetch(href)}
      className={cn("h-8 cursor-pointer transition-colors duration-1 hover:bg-surface-2", className)}
    >
      {children}
    </tr>
  );
}
