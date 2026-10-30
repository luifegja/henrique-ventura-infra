import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Fuso de exibição. As datas do Chatwoot vêm em UTC; o contêiner
 * de produção roda em UTC, então fixar o fuso aqui evita a hora +3.
 */
export const DISPLAY_TZ = "America/Sao_Paulo";

export function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Tempo relativo curto: "agora", "5 min", "3 h", "2 d", "12 ago". */
export function formatRelativeTime(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const sec = Math.round((Date.now() - date.getTime()) / 1000);
  if (sec < 45) return "agora";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min`;
  const hour = Math.round(min / 60);
  if (hour < 24) return `${hour} h`;
  const day = Math.round(hour / 24);
  if (day < 7) return `${day} d`;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: DISPLAY_TZ }).format(date);
}

/** "25 ago, 14:30" */
export function formatDateTime(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const date = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: DISPLAY_TZ,
  }).format(date);
}

/** "segunda-feira, 21 de setembro de 2026, 14:23" — para o tooltip de toda data abreviada. */
export function formatDateTimeFull(input: string | Date | null | undefined): string {
  if (!input) return "";
  const date = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: DISPLAY_TZ }).format(date);
}

/** "25/08/2026" */
export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const date = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: DISPLAY_TZ }).format(date);
}

/**
 * "+554998222592" → "+55 49 9822-2592" (só para exibição). Número de fora do
 * Brasil ganha o código do país separado e o resto em grupos de quatro, para
 * não aparecer como uma sequência de 14 dígitos colada.
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const d = phone.replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("55")) {
    return `+55 ${d.slice(2, 4)} ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  if (d.length === 12 && d.startsWith("55")) {
    return `+55 ${d.slice(2, 4)} ${d.slice(4, 8)}-${d.slice(8)}`;
  }
  if (d.length >= 10) {
    const cc = d.startsWith("1") ? 1 : d.startsWith("7") ? 1 : 2;
    const rest = d.slice(cc).replace(/(\d{4})(?=\d)/g, "$1 ");
    return `+${d.slice(0, cc)} ${rest}`;
  }
  return phone;
}

/** Nome do lead na tela: vazio ou de uma letra vira "Sem nome". O telefone fica ao lado. */
export function displayName(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  return n.length >= 2 ? n : "Sem nome";
}

/** Idade curta, sempre relativa: "agora", "5 min", "3 h", "27 d", "3 meses". Para "há quanto tempo". */
export function formatAge(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const sec = Math.round((Date.now() - date.getTime()) / 1000);
  if (sec < 45) return "agora";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min`;
  const hour = Math.round(min / 60);
  if (hour < 24) return `${hour} h`;
  const day = Math.round(hour / 24);
  if (day < 60) return `${day} d`;
  const month = Math.round(day / 30);
  return `${month} ${month === 1 ? "mês" : "meses"}`;
}

/** Dias inteiros desde a data (para destacar o que passou de um limite). */
export function daysSince(input: string | Date): number {
  const date = typeof input === "string" ? new Date(input) : input;
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

export function toIso(v: string | Date | null | undefined): string | null {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}
