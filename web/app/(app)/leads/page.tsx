import type { Metadata } from "next";
import { requireAgent } from "@/lib/session";
import { getListAttributeValues, listContacts } from "@/lib/chatwoot-api";
import { CADENCIA_KEY, CADENCIA_PADRAO } from "@/lib/cadencia";
import { PageHeader } from "@/components/ui/panel";
import { Notice } from "@/components/ui/badge";
import { KanbanBoard, type BoardCard } from "@/components/leads/kanban-board";

export const metadata: Metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

/**
 * Quadro dos leads pela cadência comercial. Fonte única: o Chatwoot (contatos da conta e
 * a definição do atributo `cadencia_comercial`). Mudar a lista de etapas no
 * scripts/cria-atributos-chatwoot.sh muda as colunas daqui.
 */
export default async function LeadsPage() {
  const agent = await requireAgent();
  let etapas: string[] = [...CADENCIA_PADRAO];
  let cards: BoardCard[] = [];
  let truncated = false;
  let error: string | null = null;
  try {
    const [vals, res] = await Promise.all([getListAttributeValues(agent.token, CADENCIA_KEY), listContacts(agent.token)]);
    if (vals.length) etapas = vals;
    truncated = res.truncated;
    cards = res.contacts.map((c) => ({ id: c.id, name: c.name, phone: c.phone, attrs: c.attrs, lastActivityAt: c.lastActivityAt }));
  } catch {
    error = "Não foi possível ler os contatos no Chatwoot agora. A tela tenta de novo sozinha.";
  }

  return (
    <div>
      <PageHeader
        eyebrow="Cadência comercial"
        title="Leads"
        description="Arraste o cartão para mudar a etapa. A etapa fica gravada no contato do Chatwoot."
      />
      {error ? <Notice tone="danger" className="mb-3">{error}</Notice> : null}
      {truncated ? (
        <Notice tone="info" className="mb-3">
          Mostrando os {cards.length} contatos com atividade mais recente.
        </Notice>
      ) : null}
      <KanbanBoard etapas={etapas} cards={cards} />
    </div>
  );
}
