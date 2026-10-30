import "server-only";

/**
 * Cliente HTTP INTERNO do Chatwoot (rede docker, http://chatwoot-web:3000), adaptado do
 * lib/chatwoot-api.ts do CliniTrack 2.0. O painel não tem banco: tudo que ele mostra e grava
 * passa por aqui, SEMPRE com o token de quem está logado (o access_token que o próprio
 * Chatwoot devolve no login). Assim a resposta sai com o nome do atendente e as permissões
 * são as do Chatwoot (agente só vê as caixas de que é membro).
 *
 * Exceção única: `liga a integração` do WhatsApp usa o token do bot (CHATWOOT_BOT_TOKEN),
 * em lib/whatsapp — é o mesmo usuário que a Evolution usa para criar a inbox.
 *
 * Os mappers toleram os dois formatos do Chatwoot 4.x (lista plana ou aninhada em
 * `payload` / `data.payload`); formatos conferidos com curl em 30/10/2026 na conta 20.
 */

export const CHATWOOT_BASE = (process.env.CHATWOOT_INTERNAL_URL || "").replace(/\/+$/, "");
export const ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID || "";

export class ChatwootApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ChatwootApiError";
    this.status = status;
  }
}

type Json = Record<string, unknown>;
type Method = "GET" | "POST" | "PUT" | "PATCH";

async function call(token: string, method: Method, path: string, body?: Json): Promise<unknown> {
  if (!CHATWOOT_BASE || !ACCOUNT_ID) throw new ChatwootApiError(0, "CHATWOOT_INTERNAL_URL/CHATWOOT_ACCOUNT_ID ausentes neste ambiente.");
  if (!token) throw new ChatwootApiError(401, "Sessão sem token do Chatwoot: entre de novo.");
  const url = `${CHATWOOT_BASE}/api/v1/accounts/${ACCOUNT_ID}${path}`;
  const res = await fetch(url, {
    method,
    headers: { api_access_token: token, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const text = await res.text();
  if (!res.ok) throw new ChatwootApiError(res.status, `Chatwoot respondeu ${res.status} em ${method} ${path}: ${text.slice(0, 300)}`);
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new ChatwootApiError(res.status, `Chatwoot devolveu corpo ilegível em ${path}: ${text.slice(0, 120)}`);
  }
}

/** Lista que pode vir plana, em `payload` ou em `data.payload`. */
function list(j: unknown): Json[] {
  if (Array.isArray(j)) return j as Json[];
  const o = (j ?? {}) as Json;
  if (Array.isArray(o.payload)) return o.payload as Json[];
  const d = o.data as Json | undefined;
  if (d && Array.isArray(d.payload)) return d.payload as Json[];
  return [];
}
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const int = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};
/** Chatwoot manda datas em segundos (unix) na maioria dos campos e ISO em alguns. */
function iso(v: unknown): string | null {
  if (typeof v === "number" && v > 0) return new Date(v * 1000).toISOString();
  if (typeof v === "string" && v) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

// ---------------------------------------------------------------- login

export type ChatwootLogin =
  | { ok: true; userId: number; name: string; email: string; token: string; role: "administrator" | "agent" }
  | { ok: false; reason: "credenciais" | "sem_conta" | "mfa" | "sem_token" | "indisponivel" };

/**
 * POST /auth/sign_in (devise_token_auth). Só aceita quem é membro da conta do Henrique.
 * O `access_token` só vem preenchido se a conta tiver o recurso api_and_webhooks (a 20 tem).
 * Cada login abre uma sessão no Chatwoot (o Chatwoot guarda até 25 e descarta a mais antiga).
 */
export async function signInChatwoot(email: string, password: string): Promise<ChatwootLogin> {
  if (!CHATWOOT_BASE || !ACCOUNT_ID) return { ok: false, reason: "indisponivel" };
  let res: Response;
  try {
    res = await fetch(`${CHATWOOT_BASE}/auth/sign_in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, reason: "indisponivel" };
  }
  if (res.status === 206) return { ok: false, reason: "mfa" };
  if (res.status === 401) return { ok: false, reason: "credenciais" };
  if (!res.ok) return { ok: false, reason: "indisponivel" };
  const body = (await res.json().catch(() => ({}))) as Json;
  const d = (body.data ?? {}) as Json;
  const accounts = Array.isArray(d.accounts) ? (d.accounts as Json[]) : [];
  const mine = accounts.find((a) => String(a.id) === ACCOUNT_ID);
  if (!mine) return { ok: false, reason: "sem_conta" };
  const token = str(d.access_token);
  const userId = int(d.id);
  if (!token || !userId) return { ok: false, reason: "sem_token" };
  return {
    ok: true,
    userId,
    name: str(d.available_name) ?? str(d.name) ?? email,
    email: str(d.email) ?? email,
    token,
    role: mine.role === "administrator" ? "administrator" : "agent",
  };
}

// ---------------------------------------------------------------- atributos

export async function getListAttributeValues(token: string, key: string): Promise<string[]> {
  const defs = list(await call(token, "GET", "/custom_attribute_definitions?attribute_model=contact_attribute"));
  const d = defs.find((x) => x.attribute_key === key);
  return Array.isArray(d?.attribute_values) ? (d!.attribute_values as unknown[]).map(String) : [];
}

// ---------------------------------------------------------------- contatos

export type Contact = {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  attrs: Record<string, unknown>;
  lastActivityAt: string | null;
  thumbnail: string | null;
};

function toContact(c: Json): Contact {
  return {
    id: int(c.id) ?? 0,
    name: str(c.name),
    phone: str(c.phone_number),
    email: str(c.email),
    attrs: (c.custom_attributes && typeof c.custom_attributes === "object" ? c.custom_attributes : {}) as Record<string, unknown>,
    lastActivityAt: iso(c.last_activity_at),
    thumbnail: str(c.thumbnail),
  };
}

/** Contatos mais recentes primeiro, 15 por página no Chatwoot; para em `maxPages`. */
export async function listContacts(token: string, maxPages = 40): Promise<{ contacts: Contact[]; truncated: boolean }> {
  // Por id: para agente a listagem do Chatwoot pode repetir um contato (visto em 30/10/2026).
  const out = new Map<number, Contact>();
  for (let page = 1; page <= maxPages; page++) {
    const j = (await call(token, "GET", `/contacts?page=${page}&sort=-last_activity_at`)) as Json;
    const batch = list(j).map(toContact).filter((c) => c.id > 0);
    for (const c of batch) if (!out.has(c.id)) out.set(c.id, c);
    const total = Number((j.meta as Json | undefined)?.count ?? 0);
    if (batch.length === 0 || out.size >= total) return { contacts: [...out.values()], truncated: false };
  }
  return { contacts: [...out.values()], truncated: true };
}

/** O Chatwoot faz merge de custom_attributes no PUT: só a chave enviada muda. */
export async function updateContactAttribute(token: string, contactId: number, key: string, value: string): Promise<void> {
  await call(token, "PUT", `/contacts/${contactId}`, { custom_attributes: { [key]: value } });
}

export async function getContact(token: string, contactId: number): Promise<Contact> {
  const j = (await call(token, "GET", `/contacts/${contactId}`)) as Json;
  return toContact((j.payload as Json) ?? j);
}

// ---------------------------------------------------------------- conversas

export type ConversationStatus = "open" | "pending" | "resolved" | "snoozed";

export type Conversation = {
  id: number;
  status: ConversationStatus;
  inboxId: number | null;
  contact: Contact;
  lastMessage: string | null;
  lastActivityAt: string | null;
  unread: number;
};

function toConversation(c: Json): Conversation {
  const meta = (c.meta ?? {}) as Json;
  const sender = (meta.sender ?? {}) as Json;
  const msgs = Array.isArray(c.messages) ? (c.messages as Json[]) : [];
  const last = (c.last_non_activity_message as Json | undefined) ?? msgs[msgs.length - 1];
  return {
    id: int(c.id) ?? 0,
    status: (str(c.status) ?? "open") as ConversationStatus,
    inboxId: int(c.inbox_id),
    contact: toContact(sender),
    lastMessage: last ? str(last.content) : null,
    lastActivityAt: iso(c.last_activity_at) ?? iso(c.timestamp),
    unread: Number(c.unread_count ?? 0) || 0,
  };
}

export async function listConversations(token: string, status: ConversationStatus | "all", page = 1): Promise<Conversation[]> {
  const j = await call(token, "GET", `/conversations?status=${status}&assignee_type=all&page=${page}`);
  return list(j).map(toConversation).filter((c) => c.id > 0);
}

export async function getConversation(token: string, id: number): Promise<Conversation> {
  return toConversation((await call(token, "GET", `/conversations/${id}`)) as Json);
}

export async function listContactConversations(token: string, contactId: number): Promise<Conversation[]> {
  return list(await call(token, "GET", `/contacts/${contactId}/conversations`)).map(toConversation).filter((c) => c.id > 0);
}

export async function toggleConversationStatus(token: string, id: number, status: "open" | "resolved"): Promise<void> {
  await call(token, "POST", `/conversations/${id}/toggle_status`, { status });
}

// ---------------------------------------------------------------- mensagens

export type Message = {
  id: number;
  /** 0 entrada (lead), 1 saída (equipe), 2 atividade do sistema, 3 template. */
  direction: "in" | "out" | "activity";
  content: string | null;
  private: boolean;
  senderName: string | null;
  createdAt: string;
  attachments: { type: string; url: string | null }[];
};

function toMessage(m: Json): Message {
  const t = Number(m.message_type);
  const sender = (m.sender ?? {}) as Json;
  const atts = Array.isArray(m.attachments) ? (m.attachments as Json[]) : [];
  return {
    id: int(m.id) ?? 0,
    direction: t === 0 ? "in" : t === 2 ? "activity" : "out",
    content: str(m.content),
    private: m.private === true,
    senderName: str(sender.available_name) ?? str(sender.name),
    createdAt: iso(m.created_at) ?? new Date().toISOString(),
    attachments: atts.map((a) => ({ type: str(a.file_type) ?? "file", url: str(a.data_url) })),
  };
}

/** As 20 mais recentes (ordem crescente); `after` filtra só as novas para o polling. */
export async function listMessages(token: string, conversationId: number, afterId?: number): Promise<Message[]> {
  const msgs = list(await call(token, "GET", `/conversations/${conversationId}/messages`)).map(toMessage).filter((m) => m.id > 0);
  msgs.sort((a, b) => a.id - b.id);
  return afterId ? msgs.filter((m) => m.id > afterId) : msgs;
}

export async function sendMessage(token: string, conversationId: number, content: string): Promise<Message> {
  const j = (await call(token, "POST", `/conversations/${conversationId}/messages`, { content, message_type: "outgoing", private: false })) as Json;
  return toMessage(j);
}

// ---------------------------------------------------------------- inbox (pareamento)

export async function findInboxByName(token: string, name: string): Promise<number | null> {
  const inboxes = list(await call(token, "GET", "/inboxes"));
  return int(inboxes.find((i) => i.name === name)?.id);
}

/** Lista de membros da conta (só administrador consegue). */
export async function listAgents(token: string): Promise<{ id: number; role: string; email: string | null }[]> {
  return list(await call(token, "GET", "/agents")).map((a) => ({ id: int(a.id) ?? 0, role: String(a.role ?? ""), email: str(a.email) }));
}

/** POST /inbox_members só ACRESCENTA (o PATCH é que substitui a lista). Exige administrador. */
export async function addInboxMembers(token: string, inboxId: number, userIds: number[]): Promise<void> {
  if (!userIds.length) return;
  await call(token, "POST", "/inbox_members", { inbox_id: inboxId, user_ids: userIds });
}

/** Deep-link público ("Abrir no Chatwoot"). */
export function chatwootUrl(conversationId?: number | null): string | null {
  const base = (process.env.CHATWOOT_PUBLIC_URL || "").replace(/\/+$/, "");
  if (!base || !ACCOUNT_ID) return null;
  return conversationId ? `${base}/app/accounts/${ACCOUNT_ID}/conversations/${conversationId}` : `${base}/app/accounts/${ACCOUNT_ID}`;
}
