"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Aviso passageiro no canto inferior direito. Confirma o que uma ação fez
 * ("Devolvido à IA", "Observações salvas") sem ocupar espaço na tela; erro
 * fica até ser fechado. Uma fila só, a mais nova embaixo.
 *
 * O traço no pé mostra quanto falta e para com o mouse ou o foco em cima; é
 * ele (e não um setTimeout) que fecha o aviso. Ao sair, o aviso desliza para
 * a direita e a fila se fecha sem pulo (M8).
 *
 * Uso: `const toast = useToast(); toast.ok("Salvo.")`.
 */
export type ToastTone = "ok" | "danger" | "info";
type ToastAction = { label: string; onClick: () => void | Promise<void> };
type Toast = { id: number; tone: ToastTone; title: string; detail?: string; action?: ToastAction; ttl: number; leaving?: boolean };

type Api = {
  push: (tone: ToastTone, title: string, detail?: string, action?: ToastAction) => void;
  ok: (title: string, detail?: string, action?: ToastAction) => void;
  error: (title: string, detail?: string, action?: ToastAction) => void;
  info: (title: string, detail?: string, action?: ToastAction) => void;
};

const Ctx = React.createContext<Api | null>(null);
const TTL: Record<ToastTone, number> = { ok: 3500, info: 5000, danger: 0 };

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<Toast[]>([]);
  const seq = React.useRef(0);

  /** Marca como saindo; o item some de vez quando a animação de saída termina. */
  const dismiss = React.useCallback((id: number) => setItems((l) => l.map((t) => (t.id === id ? { ...t, leaving: true } : t))), []);
  const remove = React.useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = React.useCallback((tone: ToastTone, title: string, detail?: string, action?: ToastAction) => {
    const id = ++seq.current;
    // Com ação (Desfazer), fica mais tempo na tela.
    const ttl = action && TTL[tone] ? Math.max(TTL[tone], 8000) : TTL[tone];
    setItems((l) => [...l.slice(-3), { id, tone, title, detail, action, ttl }]);
  }, []);
  const api = React.useMemo<Api>(
    () => ({
      push,
      ok: (t, d, a) => push("ok", t, d, a),
      error: (t, d, a) => push("danger", t, d, a),
      info: (t, d, a) => push("info", t, d, a),
    }),
    [push],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(360px,calc(100vw-32px))] flex-col"
      >
        {items.map((t) => (
          // A linha da grade encolhe junto com a saída: quem está acima desce sem pular.
          <div
            key={t.id}
            className={cn("grid grid-rows-[1fr]", t.leaving && "animate-collapse")}
            onAnimationEnd={(e) => {
              if (t.leaving && e.target === e.currentTarget) remove(t.id);
            }}
          >
            <div className={cn("min-h-0 pt-2", t.leaving && "overflow-hidden")}>
              <ToastItem toast={t} onClose={() => dismiss(t.id)} />
            </div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

const ICON: Record<ToastTone, typeof Info> = { ok: CheckCircle2, danger: AlertCircle, info: Info };

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const Icon = ICON[toast.tone];
  return (
    <div
      role={toast.tone === "danger" ? "alert" : "status"}
      className={cn(
        "group pointer-events-auto relative flex items-start gap-2.5 overflow-hidden rounded border bg-surface px-3 py-2.5 text-sm text-ink",
        toast.leaving ? "animate-toast-out" : "animate-toast-in",
        "shadow-[0_1px_0_rgb(var(--ink)/0.04),0_8px_24px_-12px_rgb(var(--ink)/0.35)]",
        toast.tone === "ok" && "border-state-won/50",
        toast.tone === "danger" && "border-danger/60",
        toast.tone === "info" && "border-line",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          toast.tone === "ok" && "text-state-won",
          toast.tone === "danger" && "text-danger",
          toast.tone === "info" && "text-ink-muted",
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="font-medium">{toast.title}</div>
        {toast.detail ? <div className="mt-0.5 text-xs text-ink-muted">{toast.detail}</div> : null}
        {toast.action ? (
          <button
            type="button"
            onClick={() => {
              void toast.action!.onClick();
              onClose();
            }}
            className="mt-1 text-xs font-medium text-accent underline hover:no-underline"
          >
            {toast.action.label}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar aviso"
        className="-mr-1 -mt-0.5 rounded p-1 text-ink-muted hover:bg-surface-2 hover:text-ink"
      >
        <X className="size-3.5" aria-hidden />
      </button>
      {toast.ttl && !toast.leaving ? (
        <span
          aria-hidden
          className={cn(
            "toast-timer absolute inset-x-0 bottom-0 h-0.5 origin-left",
            toast.tone === "ok" ? "bg-state-won/55" : "bg-ink-muted/40",
          )}
          style={{ ["--toast-ttl" as string]: `${toast.ttl}ms` }}
          onAnimationEnd={onClose}
        />
      ) : null}
    </div>
  );
}

export function useToast(): Api {
  const api = React.useContext(Ctx);
  if (!api) throw new Error("useToast precisa do <ToastProvider> (components/providers.tsx).");
  return api;
}
