/**
 * Cadência comercial: o atributo de contato `cadencia_comercial` (lista) da conta do
 * Henrique no Chatwoot. As etapas vêm da definição do atributo (scripts/cria-atributos-chatwoot.sh);
 * esta lista é só o fallback se a leitura falhar. Decisão: docs/decisoes/2026-10-30-cadencia-comercial.md.
 *
 * Arquivo puro (sem servidor): usado no quadro, na conversa e nos testes.
 */
export const CADENCIA_KEY = "cadencia_comercial";

export const CADENCIA_PADRAO = [
  "Lead",
  "1º contato",
  "Qualificação",
  "Agendamento",
  "Reunião diagnóstico",
  "Follow up",
  "Contrato enviado",
  "Pagamento",
] as const;

/**
 * Etapa de um contato. Sem etapa, ou com um valor que não está mais na lista (renomeado
 * no Chatwoot), o contato aparece na primeira etapa (Lead) — decisão do Luiz, 30/10/2026.
 */
export function etapaDe(attrs: Record<string, unknown> | null | undefined, etapas: readonly string[]): string {
  const v = attrs?.[CADENCIA_KEY];
  const s = typeof v === "string" ? v.trim() : "";
  return s && etapas.includes(s) ? s : (etapas[0] ?? "Lead");
}

/** Agrupa por etapa, preservando a ordem de entrada (mais recentes primeiro). */
export function agrupaPorEtapa<T extends { attrs: Record<string, unknown> }>(itens: T[], etapas: readonly string[]): Record<string, T[]> {
  const cols: Record<string, T[]> = {};
  for (const e of etapas) cols[e] = [];
  for (const it of itens) cols[etapaDe(it.attrs, etapas)]!.push(it);
  return cols;
}

/** Busca sem acento e sem caixa; telefone compara só os dígitos. */
export function normaliza(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function casaBusca(q: string, nome: string | null, telefone: string | null): boolean {
  const nq = normaliza(q);
  if (!nq) return true;
  if (normaliza(nome ?? "").includes(nq)) return true;
  const dq = nq.replace(/\D/g, "");
  return !!dq && (telefone ?? "").replace(/\D/g, "").includes(dq);
}
