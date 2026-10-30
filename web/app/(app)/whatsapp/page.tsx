import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { getView, type WhatsappView } from "@/lib/whatsapp";
import { PageHeader } from "@/components/ui/panel";
import { Notice } from "@/components/ui/badge";
import { ConnectionCard } from "@/components/whatsapp/connection-card";

export const metadata: Metadata = { title: "WhatsApp" };
export const dynamic = "force-dynamic";

/**
 * WhatsApp: o número do Henrique, conectado ou não, e o pareamento pelo QR sem ninguém entrar
 * no servidor. Só administradores da conta no Chatwoot. Freios em lib/whatsapp-gate.ts;
 * coreografia em ./actions.ts; procedimento manual equivalente em docs/runbooks/01-parear-whatsapp.md.
 */
export default async function WhatsappPage() {
  const a = await requireAdmin();
  let view: WhatsappView | null = null;
  let erro: string | null = null;
  try {
    view = await getView(a.id);
  } catch (e) {
    erro = e instanceof Error ? e.message : "Não consegui ler o estado na Evolution.";
  }
  return (
    <div>
      <PageHeader eyebrow="Sistema" title="WhatsApp" description="O número que recebe os leads. Conecte pelo QR; o painel liga o Chatwoot quando a conexão firmar." />
      {erro ? <Notice tone="danger">{erro}</Notice> : null}
      {view ? <ConnectionCard initial={view} /> : null}
    </div>
  );
}
