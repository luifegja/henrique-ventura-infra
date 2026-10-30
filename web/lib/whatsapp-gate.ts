/**
 * Freios do pareamento (os mesmos do CliniTrack 2.0, migração 044, aqui sem banco):
 * 3 tentativas em 24 h, 6 h travado depois de "conta restringida", uma pessoa por vez,
 * pareamento expira em 3 min, e 5 min de sessão estável antes de ligar o Chatwoot (GymTrack).
 *
 * Funções puras sobre o estado guardado na memória do processo (lib/whatsapp.ts),
 * testadas em tests/whatsapp-gate.test.ts.
 */
export const PAIRING_TIMEOUT_MS = 3 * 60_000;
export const STABILIZE_MS = 5 * 60_000;
export const MAX_ATTEMPTS = 3;
export const ATTEMPT_WINDOW_MS = 24 * 3600_000;
export const RESTRICT_MS = 6 * 3600_000;

export type Mem = {
  pairing: { startedAt: number; by: number } | null;
  /** Início do pareamento cujo QR já foi lido (a Evolution reconecta sozinha; nunca chamar connect). */
  qrLidoEm: number | null;
  attempts: number[];
  restrictedUntil: number | null;
  /** Desde quando a sessão está `open` esperando para ligar o Chatwoot. */
  stabilizingSince: number | null;
  lastDelivery: { at: number; ok: boolean; status: string | null; error: string | null } | null;
};

export function emptyMem(): Mem {
  return { pairing: null, qrLidoEm: null, attempts: [], restrictedUntil: null, stabilizingSince: null, lastDelivery: null };
}

export type Gate =
  | { ok: true; resume: boolean }
  | { ok: false; reason: "restricted" | "daily_limit" | "pairing_in_progress"; until: number | null };

export function recentAttempts(mem: Mem, now: number): number[] {
  return mem.attempts.filter((a) => now - a < ATTEMPT_WINDOW_MS);
}

export function pairingActive(mem: Mem, now: number): boolean {
  return !!mem.pairing && now - mem.pairing.startedAt < PAIRING_TIMEOUT_MS;
}

/** Pode pedir QR agora? `resume`: a mesma pessoa já está pareando (não gasta tentativa). */
export function gate(mem: Mem, now: number, userId: number): Gate {
  if (mem.restrictedUntil && mem.restrictedUntil > now) return { ok: false, reason: "restricted", until: mem.restrictedUntil };
  if (pairingActive(mem, now)) {
    if (mem.pairing!.by === userId) return { ok: true, resume: true };
    return { ok: false, reason: "pairing_in_progress", until: mem.pairing!.startedAt + PAIRING_TIMEOUT_MS };
  }
  const recent = recentAttempts(mem, now);
  if (recent.length >= MAX_ATTEMPTS) return { ok: false, reason: "daily_limit", until: Math.min(...recent) + ATTEMPT_WINDOW_MS };
  return { ok: true, resume: false };
}

/** Quanto falta para ligar o Chatwoot (0 = pode ligar); null se não está estabilizando. */
export function stabilizeLeft(mem: Mem, now: number): number | null {
  if (mem.stabilizingSince === null) return null;
  return Math.max(0, mem.stabilizingSince + STABILIZE_MS - now);
}
