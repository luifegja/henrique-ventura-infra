import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAgent } from "@/lib/session";
import {
  chatwootUrl,
  getConversation,
  getListAttributeValues,
  listContactConversations,
  listConversations,
  listMessages,
  type Conversation,
  type ConversationStatus,
  type Message,
} from "@/lib/chatwoot-api";
import { CADENCIA_KEY, CADENCIA_PADRAO, etapaDe } from "@/lib/cadencia";
import { PageHeader, EmptyState } from "@/components/ui/panel";
import { Notice } from "@/components/ui/badge";
import { When } from "@/components/ui/when";
import { ConversationView } from "@/components/conversations/conversation-view";
import { cn, displayName, formatPhone } from "@/lib/utils";

export const metadata: Metadata = { title: "Atendimentos" };
export const dynamic = "force-dynamic";

const FILTROS: { v: ConversationStatus | "all"; label: string }[] = [
  { v: "open", label: "Abertas" },
  { v: "pending", label: "Pendentes" },
  { v: "resolved", label: "Resolvidas" },
  { v: "all", label: "Todas" },
];

/**
 * Atendimentos: conversas da conta do Henrique no Chatwoot (só as caixas de que o
 * atendente é membro — regra do próprio Chatwoot), com resposta pelo painel.
 * ?status= filtra; ?c= abre uma conversa; ?contato= (vindo do quadro) abre a mais recente.
 */
export default async function AtendimentosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; c?: string; contato?: string }>;
}) {
  const agent = await requireAgent();
  const sp = await searchParams;
  const status = (FILTROS.find((f) => f.v === sp.status)?.v ?? "open") as ConversationStatus | "all";

  if (sp.contato && /^\d+$/.test(sp.contato)) {
    let alvo: number | null = null;
    try {
      const convs = await listContactConversations(agent.token, Number(sp.contato));
      alvo = convs.sort((a, b) => (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? ""))[0]?.id ?? null;
    } catch {
      /* cai na lista */
    }
    redirect(alvo ? `/atendimentos?status=all&c=${alvo}` : `/atendimentos?status=${status}`);
  }

  let conversas: Conversation[] = [];
  let etapas: string[] = [...CADENCIA_PADRAO];
  let erro: string | null = null;
  try {
    const [cs, vals] = await Promise.all([listConversations(agent.token, status), getListAttributeValues(agent.token, CADENCIA_KEY)]);
    conversas = cs;
    if (vals.length) etapas = vals;
  } catch {
    erro = "Não foi possível ler as conversas no Chatwoot agora.";
  }

  const selId = sp.c && /^\d+$/.test(sp.c) ? Number(sp.c) : null;
  let sel: Conversation | null = null;
  let mensagens: Message[] = [];
  if (selId) {
    try {
      [sel, mensagens] = await Promise.all([getConversation(agent.token, selId), listMessages(agent.token, selId)]);
    } catch {
      erro = erro ?? "Esta conversa não foi encontrada (ou você não é membro da caixa dela).";
    }
  }

  const href = (p: { status?: string; c?: number | null }) => {
    const q = new URLSearchParams();
    q.set("status", p.status ?? status);
    if (p.c) q.set("c", String(p.c));
    return `/atendimentos?${q.toString()}`;
  };

  return (
    <div>
      <PageHeader eyebrow="WhatsApp" title="Atendimentos" description="Conversas do Chatwoot. A resposta sai pelo WhatsApp com o seu nome." />
      {erro ? <Notice tone="danger" className="mb-3">{erro}</Notice> : null}
      <div className="grid min-h-[70vh] grid-cols-[320px_minmax(0,1fr)] overflow-hidden rounded border border-line bg-surface">
        <aside className="flex min-h-0 flex-col border-r border-line">
          <nav className="flex gap-1 border-b border-line p-2" aria-label="Filtrar conversas">
            {FILTROS.map((f) => (
              <Link
                key={f.v}
                href={href({ status: f.v, c: selId })}
                aria-current={f.v === status ? "page" : undefined}
                className={cn("rounded px-2 py-1 text-xs", f.v === status ? "bg-surface-2 font-medium text-ink" : "text-ink-muted hover:text-ink")}
              >
                {f.label}
              </Link>
            ))}
          </nav>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {conversas.length === 0 ? <EmptyState>Nenhuma conversa neste filtro.</EmptyState> : null}
            {conversas.map((c) => (
              <li key={c.id}>
                <Link
                  href={href({ c: c.id })}
                  aria-current={c.id === selId ? "true" : undefined}
                  className={cn("block border-b border-line/60 px-3 py-2.5 hover:bg-surface-2/60", c.id === selId && "bg-accent-soft/50")}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{displayName(c.contact.name)}</span>
                    <span className="shrink-0 text-xs text-ink-muted">
                      <When value={c.lastActivityAt} />
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-ink-muted">
                    <span className="truncate">{c.lastMessage ?? (c.contact.phone ? formatPhone(c.contact.phone) : "—")}</span>
                    {c.unread > 0 ? <span className="shrink-0 rounded-full bg-accent-fill px-1.5 text-[10px] text-on-accent-fill">{c.unread}</span> : null}
                  </div>
                  <div className="mt-1 text-[11px] text-ink-muted/80">{etapaDe(c.contact.attrs, etapas)}</div>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
        <section className="flex min-h-0 flex-col">
          {sel ? (
            <ConversationView
              key={sel.id}
              conversationId={sel.id}
              contactId={sel.contact.id}
              contactName={displayName(sel.contact.name)}
              contactPhone={sel.contact.phone ? formatPhone(sel.contact.phone) : null}
              status={sel.status}
              etapa={etapaDe(sel.contact.attrs, etapas)}
              etapas={etapas}
              initial={mensagens}
              chatwootHref={chatwootUrl(sel.id)}
            />
          ) : (
            <div className="grid flex-1 place-items-center p-8 text-sm text-ink-muted">Escolha uma conversa na lista.</div>
          )}
        </section>
      </div>
    </div>
  );
}
