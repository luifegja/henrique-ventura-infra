/** Lead novo: telefone em E.164 para o Chatwoot e validação do formulário. */
import { describe, it, expect } from "vitest";
import { leadSchema, normalizaTelefone } from "@/lib/lead";

describe("normalizaTelefone", () => {
  it.each([
    ["(13) 99197-2240", "+5513991972240"],
    ["13 99197 2240", "+5513991972240"],
    ["013991972240", "+5513991972240"],
    ["5513991972240", "+5513991972240"],
    ["+55 13 99197-2240", "+5513991972240"],
    ["(11) 3333-4444", "+551133334444"],
    ["+1 415 555 0100", "+14155550100"],
  ])("%s → %s", (entrada, saida) => {
    expect(normalizaTelefone(entrada)).toEqual({ ok: true, e164: saida });
  });

  it.each([[""], ["123"], ["99197-2240"], ["(13) 89197-2240"], ["(10) 99197-2240"], ["+12"]])("recusa %s", (entrada) => {
    expect(normalizaTelefone(entrada).ok).toBe(false);
  });
});

describe("leadSchema", () => {
  const base = { nome: "Maria Souza", telefone: "(13) 99197-2240", email: "", etapa: "Lead", observacao: "" };
  it("aceita o mínimo (nome + WhatsApp)", () => {
    expect(leadSchema.safeParse(base).success).toBe(true);
  });
  it("e-mail opcional, mas válido se vier", () => {
    expect(leadSchema.safeParse({ ...base, email: "maria@exemplo.com" }).success).toBe(true);
    expect(leadSchema.safeParse({ ...base, email: "maria@" }).success).toBe(false);
  });
  it("nome curto e telefone ruim dão erro no campo certo", () => {
    const r = leadSchema.safeParse({ ...base, nome: "M", telefone: "123" });
    expect(r.success).toBe(false);
    const campos = r.success ? [] : Object.keys(r.error.flatten().fieldErrors);
    expect(campos.sort()).toEqual(["nome", "telefone"]);
  });
});
