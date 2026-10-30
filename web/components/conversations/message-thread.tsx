import { Headset, Image as ImageIcon, Mic, Paperclip, FileText, Video, Lock } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";

/** Mensagem como o painel desenha (vinda de lib/chatwoot-api.ts, ou otimista do compositor). */
export type ThreadMessage = {
  id: number | string;
  direction: "in" | "out" | "activity";
  content: string | null;
  private: boolean;
  senderName: string | null;
  createdAt: string;
  attachments: { type: string; url: string | null }[];
  /** Linha otimista: enviada ao Chatwoot, resposta ainda não chegou. */
  pending?: boolean;
};

const MEDIA: Record<string, { icon: typeof Mic; label: string }> = {
  audio: { icon: Mic, label: "Áudio" },
  image: { icon: ImageIcon, label: "Imagem" },
  file: { icon: FileText, label: "Documento" },
  video: { icon: Video, label: "Vídeo" },
};

/** Conversa do Chatwoot (base: CliniTrack 2.0, sem a leitura de mídia pela IA). */
export function MessageThread({ messages }: { messages: ThreadMessage[] }) {
  if (messages.length === 0) return <p className="px-4 py-6 text-sm text-ink-muted">Nenhuma mensagem nesta conversa.</p>;
  return (
    <ol className="space-y-2 px-4 py-3">
      {messages.map((m) => (
        <li key={m.id}>
          {m.direction === "activity" ? (
            <p className="text-center text-xs text-ink-muted">
              {m.content} · {formatDateTime(m.createdAt)}
            </p>
          ) : (
            <Bubble message={m} />
          )}
        </li>
      ))}
    </ol>
  );
}

function Bubble({ message: m }: { message: ThreadMessage }) {
  const fromLead = m.direction === "in";
  const text = m.content?.trim() || null;
  return (
    <div className={cn("flex flex-col gap-0.5", fromLead ? "items-start" : "items-end")}>
      {!fromLead ? (
        <span className={cn("flex items-center gap-1 px-1 text-xs", m.private ? "text-ink-muted" : "text-state-human")}>
          {m.private ? <Lock className="size-3" aria-hidden /> : <Headset className="size-3" aria-hidden />}
          {m.private ? "Nota interna" : (m.senderName ?? "Equipe")}
        </span>
      ) : null}
      <div
        className={cn(
          "max-w-[76%] rounded border px-3 py-2 text-sm",
          fromLead ? "border-line bg-surface" : m.private ? "border-dashed border-line bg-surface-2" : "border-state-human/30 bg-state-human/[0.08]",
        )}
      >
        {m.attachments.map((a, i) => (
          <MediaChip key={i} type={a.type} url={a.url} />
        ))}
        {text ? <p className="whitespace-pre-wrap break-words leading-relaxed">{text}</p> : null}
      </div>
      <time className="px-1 text-xs text-ink-muted" dateTime={m.createdAt}>
        {m.pending ? "enviando…" : formatDateTime(m.createdAt)}
      </time>
    </div>
  );
}

function MediaChip({ type, url }: { type: string; url: string | null }) {
  const media = MEDIA[type] ?? { icon: Paperclip, label: "Anexo" };
  const Icon = media.icon;
  const cls = "mb-1 inline-flex items-center gap-1.5 rounded bg-surface-2 px-2 py-0.5 text-xs text-ink-muted";
  if (url && type === "audio")
    return (
      <span className="mb-1 block">
        <audio controls preload="none" src={url} className="h-8 max-w-full" />
      </span>
    );
  if (url && type === "image")
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mb-1 block">
        {/* eslint-disable-next-line @next/next/no-img-element -- anexo servido pelo Chatwoot */}
        <img src={url} alt="Imagem enviada" className="max-h-48 rounded" />
      </a>
    );
  if (!url)
    return (
      <span className={cls}>
        <Icon className="size-3" aria-hidden /> {media.label}
      </span>
    );
  return (
    <a href={url} target="_blank" rel="noreferrer" className={cn(cls, "hover:text-accent hover:underline")}>
      <Icon className="size-3" aria-hidden /> {media.label} ↗
    </a>
  );
}
