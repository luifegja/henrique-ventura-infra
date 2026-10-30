"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";
import { Notice } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { criarLead } from "@/app/(app)/leads/actions";
import { leadSchema, normalizaTelefone } from "@/lib/lead";
import { formatPhone } from "@/lib/utils";

type Campos = { nome: string; telefone: string; email: string; etapa: string; observacao: string };
type Erros = Partial<Record<keyof Campos, string>>;

/**
 * "Novo lead": cria o contato direto no Chatwoot (com a etapa da cadência), então ele aparece no
 * quadro e nos Contatos do Chatwoot ao mesmo tempo. Validação igual no navegador e no servidor
 * (lib/lead.ts). WhatsApp repetido não cria duplicado: a tela aponta o lead que já existe.
 */
export function NovoLead({ etapas }: { etapas: string[] }) {
  const router = useRouter();
  const toast = useToast();
  const vazio: Campos = { nome: "", telefone: "", email: "", etapa: etapas[0] ?? "Lead", observacao: "" };
  const [aberto, setAberto] = React.useState(false);
  const [v, setV] = React.useState<Campos>(vazio);
  const [erros, setErros] = React.useState<Erros>({});
  const [erro, setErro] = React.useState<string | null>(null);
  const [existente, setExistente] = React.useState<{ id: number; nome: string } | null>(null);
  const [busy, setBusy] = React.useState(false);

  const fechar = React.useCallback(() => {
    if (busy) return;
    setAberto(false);
    setV(vazio);
    setErros({});
    setErro(null);
    setExistente(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  React.useEffect(() => {
    if (!aberto) return;
    document.getElementById("lead-nome")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [aberto, fechar]);

  const set = (k: keyof Campos) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setV((cur) => ({ ...cur, [k]: e.target.value }));
    if (erros[k]) setErros((cur) => ({ ...cur, [k]: undefined }));
  };

  const previa = (() => {
    const r = normalizaTelefone(v.telefone);
    return v.telefone.trim() && r.ok ? formatPhone(r.e164) : null;
  })();

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setExistente(null);
    const p = leadSchema.safeParse(v);
    if (!p.success) {
      const f = p.error.flatten().fieldErrors;
      setErros(Object.fromEntries(Object.entries(f).map(([k, m]) => [k, m?.[0]])) as Erros);
      return;
    }
    setBusy(true);
    const res = await criarLead(v);
    setBusy(false);
    if (!res.ok) {
      if (res.existente) setExistente(res.existente);
      if (res.fieldErrors) setErros(Object.fromEntries(Object.entries(res.fieldErrors).map(([k, m]) => [k, m[0]])) as Erros);
      setErro(res.error);
      return;
    }
    toast.ok(`${p.data.nome} entrou em ${p.data.etapa}.`, res.data?.notaOk ? "Contato criado no Chatwoot." : "Contato criado no Chatwoot, mas a observação não foi gravada.");
    setAberto(false);
    setV(vazio);
    router.refresh();
  }

  return (
    <>
      <Button variant="primary" onClick={() => setAberto(true)}>
        <Plus aria-hidden /> Novo lead
      </Button>
      {aberto ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-ink/30 p-4" onMouseDown={(e) => e.target === e.currentTarget && fechar()}>
          <div role="dialog" aria-modal="true" aria-labelledby="novo-lead-titulo" className="w-full max-w-[460px] rounded border border-line bg-surface shadow-[0_24px_48px_-24px_rgb(var(--ink)/0.5)]">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <h2 id="novo-lead-titulo" className="font-display text-md">
                Novo lead
              </h2>
              <button type="button" onClick={fechar} className="rounded p-1 text-ink-muted hover:text-ink" aria-label="Fechar">
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <form onSubmit={salvar} className="space-y-3 px-4 py-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="lead-nome">Nome</Label>
                <Input id="lead-nome" value={v.nome} onChange={set("nome")} aria-invalid={!!erros.nome} autoComplete="off" />
                <FieldError>{erros.nome}</FieldError>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-telefone">WhatsApp</Label>
                <Input id="lead-telefone" value={v.telefone} onChange={set("telefone")} aria-invalid={!!erros.telefone} placeholder="(13) 99197-2240" inputMode="tel" autoComplete="off" />
                {erros.telefone ? <FieldError>{erros.telefone}</FieldError> : previa ? <p className="text-xs text-ink-muted">Vai como {previa}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-email">E-mail (opcional)</Label>
                <Input id="lead-email" type="email" value={v.email} onChange={set("email")} aria-invalid={!!erros.email} autoComplete="off" />
                <FieldError>{erros.email}</FieldError>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-etapa">Etapa da cadência</Label>
                <Select id="lead-etapa" value={v.etapa} onChange={set("etapa")} className="w-full">
                  {etapas.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-obs">Observação (opcional)</Label>
                <Textarea id="lead-obs" rows={3} value={v.observacao} onChange={set("observacao")} aria-invalid={!!erros.observacao} placeholder="Como chegou, o que procura… Vira uma nota no contato do Chatwoot." />
                <FieldError>{erros.observacao}</FieldError>
              </div>
              {erro ? (
                <Notice tone="danger">
                  {erro}{" "}
                  {existente ? (
                    <Link href={`/atendimentos?contato=${existente.id}`} className="underline" onClick={fechar}>
                      Abrir o lead existente
                    </Link>
                  ) : null}
                </Notice>
              ) : null}
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={fechar} disabled={busy}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" pending={busy}>
                  Criar lead
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
