/** Agrupamento do quadro: etapa do contato, fallback para Lead e busca. */
import { describe, it, expect } from "vitest";
import { agrupaPorEtapa, casaBusca, etapaDe, CADENCIA_PADRAO } from "@/lib/cadencia";

const etapas = [...CADENCIA_PADRAO];
const c = (id: number, v?: unknown) => ({ id, attrs: v === undefined ? {} : { cadencia_comercial: v } });

describe("etapaDe", () => {
  it("usa o valor gravado quando está na lista", () => {
    expect(etapaDe({ cadencia_comercial: "Qualificação" }, etapas)).toBe("Qualificação");
  });
  it("sem etapa vai para Lead", () => {
    expect(etapaDe({}, etapas)).toBe("Lead");
    expect(etapaDe(null, etapas)).toBe("Lead");
    expect(etapaDe({ cadencia_comercial: "  " }, etapas)).toBe("Lead");
  });
  it("valor que saiu da lista (renomeado) também vai para Lead", () => {
    expect(etapaDe({ cadencia_comercial: "Proposta" }, etapas)).toBe("Lead");
    expect(etapaDe({ cadencia_comercial: 3 }, etapas)).toBe("Lead");
  });
  it("respeita a lista vinda do Chatwoot", () => {
    expect(etapaDe({}, ["Novo", "Fechado"])).toBe("Novo");
  });
});

describe("agrupaPorEtapa", () => {
  it("cria todas as colunas na ordem e mantém a ordem dos contatos", () => {
    const cols = agrupaPorEtapa([c(1, "Pagamento"), c(2), c(3, "Pagamento"), c(4, "xyz")], etapas);
    expect(Object.keys(cols)).toEqual(etapas);
    expect(cols["Lead"]!.map((x) => x.id)).toEqual([2, 4]);
    expect(cols["Pagamento"]!.map((x) => x.id)).toEqual([1, 3]);
    expect(cols["Agendamento"]).toEqual([]);
  });
});

describe("casaBusca", () => {
  it("nome sem acento e sem caixa", () => {
    expect(casaBusca("joao", "João da Silva", null)).toBe(true);
    expect(casaBusca("MARIA", "maria", null)).toBe(true);
    expect(casaBusca("pedro", "João", null)).toBe(false);
  });
  it("telefone pelos dígitos", () => {
    expect(casaBusca("99197", null, "+55 13 99197-2240")).toBe(true);
    expect(casaBusca("(13) 99197", null, "+5513991972240")).toBe(true);
    expect(casaBusca("1234", "Ana", "+5513991972240")).toBe(false);
  });
  it("busca vazia casa tudo", () => {
    expect(casaBusca("  ", null, null)).toBe(true);
  });
});
