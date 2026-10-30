"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Botão de copiar do painel (M21): ao copiar, o ícone vira um ✓ que se desenha,
 * em verde, e volta em 1,4 s — o mesmo ✓ do botão "Salvo". As duas versões do
 * rótulo ficam empilhadas, então o botão não muda de largura.
 * `text` pode ser uma função (o conteúdo só é montado no clique).
 */
export function CopyButton({
  text,
  label,
  doneLabel = "copiado",
  onResult,
  className,
  ...props
}: Omit<ButtonProps, "onClick" | "children"> & {
  text: string | (() => string | null);
  label: React.ReactNode;
  doneLabel?: string;
  onResult?: (ok: boolean) => void;
}) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<number | undefined>(undefined);
  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    const value = typeof text === "function" ? text() : text;
    if (value == null) return;
    try {
      await navigator.clipboard.writeText(value);
      window.clearTimeout(timer.current);
      setCopied(true);
      timer.current = window.setTimeout(() => setCopied(false), 1400);
      onResult?.(true);
    } catch {
      onResult?.(false);
    }
  }

  return (
    <Button size="sm" variant="secondary" {...props} onClick={copy} className={cn(copied && "border-state-won/50 text-state-won", className)}>
      <span className="grid [&>*]:[grid-area:1/1]">
        <span className={cn("inline-flex items-center gap-1.5", copied && "invisible")}>
          <Copy aria-hidden />
          {label}
        </span>
        <span className={cn("inline-flex items-center justify-center gap-1.5", !copied && "invisible")} aria-hidden={!copied}>
          <Check className={copied ? "draw-check" : undefined} strokeWidth={2.5} aria-hidden />
          <span className={copied ? "animate-fade" : undefined}>{doneLabel}</span>
        </span>
      </span>
    </Button>
  );
}
