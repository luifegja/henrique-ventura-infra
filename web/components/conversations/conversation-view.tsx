"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, ExternalLink, RotateCcw, SendHorizontal } from "lucide-react";
import { MessageThread, type ThreadMessage } from "@/components/conversations/message-thread";
import { Textarea, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { mudarStatus, novasMensagens, responder } from "@/app/(app)/atendimentos/actions";
import { moveContact } from "@/app/(app)/leads/actions";
import type { Message } from "@/lib/chatwoot-api";

const POLL_MS = 4_000;
const MAX = 4096;

type Pending = { key: string; text: string; at: string };

/**
 * Conversa aberta, ao vivo (padrão do live-thread.tsx do CliniTrack 2.0):
 *  - a cada 4 s, com a aba visível, busca só as mensagens depois da última conhecida;
 *  - responder manda pelo Chatwoot com o token do atendente; a linha aparece na hora como
 *    "enviando…" e é trocada pela mensagem real que o Chatwoot devolve;
 *  - no cabeçalho: etapa da cadência (grava no contato), resolver/reabrir, abrir no Chatwoot.
 */
export function ConversationView({
  conversationId,
  contactId,
  contactName,
  contactPhone,
  status: statusInicial,
  etapa: etapaInicial,
  etapas,
  initial,
  chatwootHref,
}: {
  conversationId: number;
  contactId: number;
  contactName: string;
  contactPhone: string | null;
  status: string;
  etapa: string;
  etapas: string[];
  initial: Message[];
  chatwootHref: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [messages, setMessages] = React.useState<Message[]>(initial);
  const [pending, setPending] = React.useState<Pending[]>([]);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState(statusInicial);
  const [etapa, setEtapa] = React.useState(etapaInicial);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const polling = React.useRef(false);
  const lastId = React.useRef<number | null>(initial.length ? initial[initial.length - 1]!.id : null);

  const merge = React.useCallback((novas: Message[]) => {
    if (!novas.length) return;
    setMessages((cur) => {
      const known = new Set(cur.map((m) => m.id));
      const add = novas.filter((m) => !known.has(m.id));
      return add.length ? [...cur, ...add].sort((a, b) => a.id - b.id) : cur;
    });
    lastId.current = Math.max(lastId.current ?? 0, ...novas.map((m) => m.id));
  }, []);

  const refresh = React.useCallback(async () => {
    if (polling.current) return;
    polling.current = true;
    try {
      const res = await novasMensagens({ conversationId, afterId: lastId.current });
      if (res.ok && res.data) merge(res.data);
    } finally {
      polling.current = false;
    }
  }, [conversationId, merge]);

  React.useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const t = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, pending.length]);

  async function send() {
    const v = text.trim();
    if (busy || !v) return;
    if (v.length > MAX) {
      setError(`A mensagem passa de ${MAX} caracteres.`);
      return;
    }
    setBusy(true);
    setError(null);
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setPending((cur) => [...cur, { key, text: v, at: new Date().toISOString() }]);
    setText("");
    const res = await responder({ conversationId, text: v });
    setBusy(false);
    setPending((cur) => cur.filter((p) => p.key !== key));
    if (!res.ok) {
      setText(v);
      setError(res.error);
      return;
    }
    if (res.data) merge([res.data]);
    router.refresh();
  }

  async function trocaStatus() {
    const next = status === "resolved" ? "open" : "resolved";
    const res = await mudarStatus({ conversationId, status: next });
    if (!res.ok) return toast.error("Status não mudou.", res.error);
    setStatus(next);
    toast.ok(next === "resolved" ? "Conversa resolvida." : "Conversa reaberta.");
    router.refresh();
  }

  async function trocaEtapa(nova: string) {
    const antes = etapa;
    setEtapa(nova);
    const res = await moveContact({ contactId, etapa: nova });
    if (!res.ok) {
      setEtapa(antes);
      return toast.error("A etapa não mudou.", res.error);
    }
    toast.ok(`${contactName} → ${nova}`);
    router.refresh();
  }

  const timeline: ThreadMessage[] = [
    ...messages,
    ...pending.map((p) => ({
      id: "pending-" + p.key,
      direction: "out" as const,
      content: p.text,
      private: false,
      senderName: "Você",
      createdAt: p.at,
      attachments: [],
      pending: true,
    })),
  ];

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="truncate font-display text-md">{contactName}</h2>
          {contactPhone ? <div className="font-mono text-xs text-ink-muted">{contactPhone}</div> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-ink-muted">
            Cadência
            <Select value={etapa} onChange={(e) => void trocaEtapa(e.target.value)} aria-label="Etapa da cadência comercial" className="h-7 text-xs">
              {etapas.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </Select>
          </label>
          <Button size="sm" onClick={() => void trocaStatus()} title={status === "resolved" ? "Reabrir a conversa" : "Marcar como resolvida"}>
            {status === "resolved" ? <RotateCcw aria-hidden /> : <CheckCheck aria-hidden />}
            {status === "resolved" ? "Reabrir" : "Resolver"}
          </Button>
          {chatwootHref ? (
            <a href={chatwootHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-accent">
              Chatwoot <ExternalLink className="size-3" aria-hidden />
            </a>
          ) : null}
        </div>
      </header>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto" style={{ maxHeight: "60vh" }}>
        <MessageThread messages={timeline} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="space-y-2 border-t border-line px-4 py-3"
      >
        <Textarea
          rows={2}
          value={text}
          maxLength={MAX}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Responder pelo WhatsApp. Enter envia; Shift+Enter quebra a linha."
          aria-label="Resposta"
          disabled={busy}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-ink-muted">{status === "resolved" ? "Responder reabre a conversa no Chatwoot." : ""}</span>
          <Button type="submit" size="sm" variant="primary" pending={busy} disabled={!text.trim()}>
            <SendHorizontal aria-hidden /> Enviar
          </Button>
        </div>
        {error ? <Notice tone="danger">{error}</Notice> : null}
      </form>
    </>
  );
}
