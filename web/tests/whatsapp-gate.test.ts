/** Freios do pareamento sem banco: tentativas, restrição, uma pessoa por vez e a espera de 5 min. */
import { describe, it, expect } from "vitest";
import { emptyMem, gate, stabilizeLeft, PAIRING_TIMEOUT_MS, STABILIZE_MS, ATTEMPT_WINDOW_MS } from "@/lib/whatsapp-gate";

const T = 1_800_000_000_000;

describe("gate", () => {
  it("livre no começo", () => {
    expect(gate(emptyMem(), T, 4)).toEqual({ ok: true, resume: false });
  });
  it("3 tentativas em 24 h travam até a mais antiga vencer", () => {
    const m = emptyMem();
    m.attempts = [T - 3_000, T - 2_000, T - 1_000];
    expect(gate(m, T, 4)).toEqual({ ok: false, reason: "daily_limit", until: T - 3_000 + ATTEMPT_WINDOW_MS });
    m.attempts = [T - ATTEMPT_WINDOW_MS - 1, T - 2_000, T - 1_000];
    expect(gate(m, T, 4).ok).toBe(true);
  });
  it("restrição vale até o fim do prazo", () => {
    const m = emptyMem();
    m.restrictedUntil = T + 1;
    expect(gate(m, T, 4)).toMatchObject({ ok: false, reason: "restricted" });
    expect(gate(m, T + 2, 4).ok).toBe(true);
  });
  it("uma pessoa por vez; a mesma pessoa retoma sem gastar tentativa", () => {
    const m = emptyMem();
    m.pairing = { startedAt: T - 1_000, by: 4 };
    expect(gate(m, T, 4)).toEqual({ ok: true, resume: true });
    expect(gate(m, T, 7)).toMatchObject({ ok: false, reason: "pairing_in_progress" });
    expect(gate(m, T - 1_000 + PAIRING_TIMEOUT_MS, 7).ok).toBe(true);
  });
});

describe("stabilizeLeft", () => {
  it("null sem espera; conta até zero", () => {
    const m = emptyMem();
    expect(stabilizeLeft(m, T)).toBeNull();
    m.stabilizingSince = T;
    expect(stabilizeLeft(m, T + 60_000)).toBe(STABILIZE_MS - 60_000);
    expect(stabilizeLeft(m, T + STABILIZE_MS + 1)).toBe(0);
  });
});
