"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  pointerWithin,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Search, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { cn, formatPhone, displayName } from "@/lib/utils";
import { When } from "@/components/ui/when";
import { Rolling } from "@/components/ui/rolling";
import { agrupaPorEtapa, casaBusca } from "@/lib/cadencia";
import { moveContact } from "@/app/(app)/leads/actions";
import { EASE_OUT, flipDelta, prefersReducedMotion } from "@/lib/motion";

export type BoardCard = {
  id: number;
  name: string | null;
  phone: string | null;
  attrs: Record<string, unknown>;
  lastActivityAt: string | null;
};
type Columns = Record<string, BoardCard[]>;
/** O cartão erguido: mesma escala e inclinação no arraste e no início do pouso. */
const LIFT = "scale(1.03) rotate(1.5deg)";
const key = (id: number) => String(id);

/**
 * Quadro da cadência comercial (base: components/funnels/kanban-board.tsx do CliniTrack 2.0,
 * sem a parte de IA). Colunas = valores do atributo `cadencia_comercial`; contato sem etapa
 * fica em Lead. Atualização otimista: se o Chatwoot recusar, o cartão volta. Recarrega a cada
 * 25 s para mostrar o que outro atendente mudou (no painel ou no próprio Chatwoot).
 */
export function KanbanBoard({ etapas, cards }: { etapas: string[]; cards: BoardCard[] }) {
  const router = useRouter();
  const toast = useToast();
  const [cols, setCols] = React.useState<Columns>(() => agrupaPorEtapa(cards, etapas));
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [settledId, setSettledId] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const visible = React.useCallback((c: BoardCard) => casaBusca(q, c.name, c.phone), [q]);

  /**
   * Pouso: antes de soltar, medimos todos os cartões; depois da atualização otimista, cada
   * um desliza do lugar antigo para o novo. Só na soltura; a recarga de 25 s não anima.
   */
  const boardRef = React.useRef<HTMLDivElement>(null);
  const landing = React.useRef<{ rects: Map<string, DOMRect>; dropped: { id: string; left: number; top: number } | null } | null>(null);
  const measure = () => {
    const rects = new Map<string, DOMRect>();
    boardRef.current?.querySelectorAll<HTMLElement>("[data-card-id]").forEach((el) => rects.set(el.dataset.cardId!, el.getBoundingClientRect()));
    return rects;
  };
  React.useLayoutEffect(() => {
    const l = landing.current;
    landing.current = null;
    if (!l || prefersReducedMotion()) return;
    boardRef.current?.querySelectorAll<HTMLElement>("[data-card-id]").forEach((el) => {
      const id = el.dataset.cardId!;
      const now = el.getBoundingClientRect();
      if (l.dropped?.id === id) {
        const d = flipDelta(l.dropped, now) ?? { dx: 0, dy: 0 };
        el.animate([{ transform: `translate(${d.dx}px, ${d.dy}px) ${LIFT}` }, { transform: "none" }], { duration: 260, easing: EASE_OUT });
        return;
      }
      const was = l.rects.get(id);
      const d = was ? flipDelta(was, now) : null;
      if (d) el.animate([{ transform: `translate(${d.dx}px, ${d.dy}px)` }, { transform: "none" }], { duration: 220, easing: EASE_OUT });
    });
  }, [cols]);

  // O servidor mandou dados novos (recarga ou depois de mover): reagrupa.
  React.useEffect(() => {
    setCols(agrupaPorEtapa(cards, etapas));
  }, [cards, etapas]);

  const dragging = React.useRef(false);
  dragging.current = activeId !== null;
  React.useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible" || dragging.current) return;
      router.refresh();
    };
    const t = window.setInterval(tick, 25_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const all = React.useMemo(() => Object.values(cols).flat(), [cols]);
  const activeCard = all.find((c) => key(c.id) === activeId) ?? null;

  function columnOf(id: string) {
    for (const [k, list] of Object.entries(cols)) if (list.some((c) => key(c.id) === id)) return k;
    return null;
  }

  async function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    setActiveId(null);
    const over = e.over ? String(e.over.id) : null;
    if (!over) return;
    const from = columnOf(id);
    if (!from || from === over) return;
    const card = cols[from]!.find((c) => key(c.id) === id);
    if (!card) return;
    const snapshot = cols;
    const dropRect = e.active.rect.current.translated;
    landing.current = { rects: measure(), dropped: dropRect ? { id, left: dropRect.left, top: dropRect.top } : null };
    setCols((prev) => {
      const next: Columns = {};
      for (const [k, v] of Object.entries(prev)) next[k] = v.slice();
      next[from] = next[from]!.filter((c) => key(c.id) !== id);
      next[over] = [{ ...card, attrs: { ...card.attrs, cadencia_comercial: over } }, ...(next[over] ?? [])];
      return next;
    });
    setSettledId(id);
    const res = await moveContact({ contactId: card.id, etapa: over });
    if (!res.ok) {
      setCols(snapshot);
      setSettledId(null);
      toast.error("O cartão voltou para onde estava.", res.error);
      return;
    }
    toast.ok(`${displayName(card.name)} → ${over}`);
    router.refresh();
  }

  const total = all.length;
  const shown = all.filter(visible).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nome ou telefone"
            aria-label="Buscar no quadro"
            className="h-7 w-56 rounded border border-line bg-surface pl-7 pr-7 text-xs text-ink placeholder:text-ink-muted/70"
          />
          {q ? (
            <button type="button" onClick={() => setQ("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-muted hover:text-ink" aria-label="Limpar busca">
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </label>
        <span className="text-xs text-ink-muted">
          {shown !== total ? `${shown} de ${total}` : `${total} ${total === 1 ? "lead" : "leads"}`}
        </span>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={(e: DragStartEvent) => {
          setSettledId(null);
          setActiveId(String(e.active.id));
        }}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div ref={boardRef} className="flex items-start gap-3 overflow-x-auto pb-3">
          {etapas.map((etapa, i) => (
            <Column key={etapa} id={etapa} index={i + 1} title={etapa} cards={(cols[etapa] ?? []).filter(visible)} activeId={activeId} settledId={settledId} />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>{activeCard ? <CardBody card={activeCard} dragging /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({
  id,
  index,
  title,
  cards,
  activeId,
  settledId,
}: {
  id: string;
  index: number;
  title: string;
  cards: BoardCard[];
  activeId: string | null;
  settledId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section className="flex min-w-[220px] max-w-[300px] flex-1 basis-[220px] flex-col" aria-label={title}>
      <header className="mb-1.5 flex items-baseline justify-between px-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="font-mono text-xs text-ink-muted">{String(index).padStart(2, "0")}</span>
          <h3 className="truncate font-display text-base">{title}</h3>
        </div>
        <span className="font-mono text-xs text-ink-muted">
          <Rolling value={cards.length} />
        </span>
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[120px] flex-1 flex-col gap-1.5 rounded border bg-surface-2/50 p-1.5 transition-colors duration-2",
          isOver ? "border-accent bg-accent-soft/60" : "border-line",
        )}
      >
        {cards.length === 0 ? (
          <p className="px-1 pt-1 text-xs text-ink-muted/60">vazio</p>
        ) : (
          cards.map((c) => <DraggableCard key={c.id} card={c} dimmed={activeId === key(c.id)} settled={settledId === key(c.id)} />)
        )}
      </div>
    </section>
  );
}

function DraggableCard({ card, dimmed, settled }: { card: BoardCard; dimmed: boolean; settled: boolean }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: key(card.id) });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-card-id={key(card.id)}
      className={cn("cursor-grab touch-none transition-opacity duration-1 active:cursor-grabbing", dimmed && "opacity-40")}
    >
      <CardBody card={card} settled={settled} />
    </div>
  );
}

function CardBody({ card, dragging, settled }: { card: BoardCard; dragging?: boolean; settled?: boolean }) {
  return (
    <article
      className={cn(
        "rounded border border-line bg-surface px-2.5 py-2 transition-[border-color,box-shadow] duration-1 ease-out hover:border-ink/30",
        dragging && "rotate-[1.5deg] scale-[1.03] animate-lift border-accent shadow-[0_14px_28px_-14px_rgb(var(--ink)/0.55)]",
        settled && "animate-settle",
      )}
      aria-label={card.name ?? card.phone ?? `Contato ${card.id}`}
    >
      <Link
        href={`/atendimentos?contato=${card.id}`}
        onPointerDown={(e) => e.stopPropagation()}
        className="block min-w-0 truncate text-sm font-medium text-ink hover:text-accent hover:underline"
        title="Abrir o atendimento mais recente"
      >
        {displayName(card.name)}
      </Link>
      {card.phone ? <div className="mt-0.5 font-mono text-xs text-ink-muted">{formatPhone(card.phone)}</div> : null}
      <div className="mt-1.5 text-xs text-ink-muted" title="Última atividade no Chatwoot">
        {card.lastActivityAt ? (
          <>
            ativo há <When value={card.lastActivityAt} mode="age" warnAfterDays={7} />
          </>
        ) : (
          "sem atividade"
        )}
      </div>
    </article>
  );
}
