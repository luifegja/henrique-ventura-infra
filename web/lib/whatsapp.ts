import "server-only";
import { bridgeStatus, fetchInstance, hasEvolutionApi } from "@/lib/evolution-api";
import { emptyMem, gate, recentAttempts, stabilizeLeft, PAIRING_TIMEOUT_MS, STABILIZE_MS, type Mem } from "@/lib/whatsapp-gate";
import type { EvoState } from "@/lib/evolution-parse";

/**
 * Estado do pareamento na memória do processo. O painel roda num contêiner só; se ele
 * reiniciar, perde-se o contador de tentativas e a espera de estabilização recomeça
 * (getView reabre os 5 min quando acha a sessão aberta com o Chatwoot desligado).
 * `globalThis` para sobreviver ao recarregamento de módulos do `next dev`.
 */
const g = globalThis as unknown as { __henriqueventuraWa?: Mem };
export const mem: Mem = (g.__henriqueventuraWa ??= emptyMem());

export type WhatsappView = {
  hasApi: boolean;
  state: EvoState;
  phone: string | null;
  profileName: string | null;
  disconnectCode: number | null;
  disconnectAt: string | null;
  bridge: "on" | "off" | "none";
  pairing: { startedAt: string; byMe: boolean; expiresAt: string } | null;
  /** Sessão aberta esperando os 5 min para ligar o Chatwoot. */
  stabilizing: { since: string; readyAt: string; leftMs: number } | null;
  attempts: string[];
  restrictedUntil: string | null;
  gate: { ok: boolean; reason?: string; until?: string | null };
  lastDelivery: { at: string; ok: boolean; status: string | null; error: string | null } | null;
  checkedAt: string;
};

const iso = (n: number | null | undefined) => (n ? new Date(n).toISOString() : null);

export async function getView(userId: number): Promise<WhatsappView> {
  const now = Date.now();
  let info = null as Awaited<ReturnType<typeof fetchInstance>>;
  let bridge: WhatsappView["bridge"] = "none";
  if (hasEvolutionApi) {
    [info, bridge] = await Promise.all([fetchInstance(), bridgeStatus()]);
  }
  const state = info?.state ?? "close";
  // Aberta, sem Chatwoot ligado e sem espera em curso (contêiner reiniciado, ou pareada por
  // fora pelo runbook): começa a espera de 5 min. Fechada: não há o que esperar.
  if (state === "open" && bridge !== "on" && mem.stabilizingSince === null && !mem.pairing) mem.stabilizingSince = now;
  if (state !== "open" && mem.stabilizingSince !== null && !mem.pairing) mem.stabilizingSince = null;
  if (bridge === "on") mem.stabilizingSince = null;

  const left = stabilizeLeft(mem, now);
  const gt = gate(mem, now, userId);
  return {
    hasApi: hasEvolutionApi,
    state,
    phone: info?.phone ?? null,
    profileName: info?.profileName ?? null,
    disconnectCode: info?.disconnectCode ?? null,
    disconnectAt: info?.disconnectAt ?? null,
    bridge,
    pairing: mem.pairing
      ? { startedAt: iso(mem.pairing.startedAt)!, byMe: mem.pairing.by === userId, expiresAt: iso(mem.pairing.startedAt + PAIRING_TIMEOUT_MS)! }
      : null,
    stabilizing: left === null ? null : { since: iso(mem.stabilizingSince)!, readyAt: iso(mem.stabilizingSince! + STABILIZE_MS)!, leftMs: left },
    attempts: recentAttempts(mem, now).map((a) => iso(a)!),
    restrictedUntil: mem.restrictedUntil && mem.restrictedUntil > now ? iso(mem.restrictedUntil) : null,
    gate: gt.ok ? { ok: true } : { ok: false, reason: gt.reason, until: iso(gt.until) },
    lastDelivery: mem.lastDelivery ? { ...mem.lastDelivery, at: iso(mem.lastDelivery.at)! } : null,
    checkedAt: new Date(now).toISOString(),
  };
}
