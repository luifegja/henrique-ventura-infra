"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Bloco que entra e sai deslizando quando aparece ou some com a tela aberta
 * (M23: a faixa "com a equipe" da ficha). Ao sumir, guarda o último conteúdo
 * até a animação terminar. Na montagem não anima: quem abre a ficha já vê o
 * estado atual parado.
 */
export function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const present = children != null && children !== false;
  const [kept, setKept] = React.useState<React.ReactNode>(present ? children : null);
  const [wasPresent, setWasPresent] = React.useState(present);
  const [phase, setPhase] = React.useState<"idle" | "enter" | "leave">("idle");

  if (present !== wasPresent) {
    setWasPresent(present);
    setPhase(present ? "enter" : "leave");
  }
  if (present && kept !== children) setKept(children);

  if (!kept) return null;
  return (
    <div
      className={cn("grid", phase === "enter" && "animate-expand", phase === "leave" && "animate-collapse", className)}
      onAnimationEnd={(e) => {
        if (e.target !== e.currentTarget) return;
        if (phase === "leave") setKept(null);
        setPhase("idle");
      }}
    >
      <div className={cn("min-h-0", phase !== "idle" && "overflow-hidden")}>{kept}</div>
    </div>
  );
}
