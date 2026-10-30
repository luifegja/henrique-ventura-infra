"use client";

import * as React from "react";
import { Check, Smartphone, QrCode, Unplug, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/badge";
import { Panel, SectionTitle, Field } from "@/components/ui/panel";
import { disconnectReasonLabel } from "@/lib/evolution-parse";
import { cn, formatDateTime, formatPhone } from "@/lib/utils";
import {
  startPairing,
  refreshPairing,
  cancelPairing,
  disconnectWhatsapp,
  markRestricted,
  runDeliveryCheck,
  finishStabilization,
  getWhatsappView,
  type QrView,
} from "@/app/(app)/whatsapp/actions";
import type { WhatsappView } from "@/lib/whatsapp";

/**
 * Um estado só, grande: Conectado / Desconectado / Conectando (base: CliniTrack 2.0). O QR
 * aparece depois de a pessoa dizer que o celular já está na tela certa — cada QR pedido conta
 * contra a conta no WhatsApp. Polling de 2 s enquanto pareia, 10 s na espera de 5 min antes de
 * ligar o Chatwoot (GymTrack), 25 s em repouso.
 */

const POLL_PAIRING_MS = 2_000;
const POLL_IDLE_MS = 25_000;
/** O Baileys troca o QR a cada ~40 s (STATUS: "o QR vive menos de um minuto"). */
const QR_TTL_S = 40;
const PAIRING_TIMEOUT_S = 180;
const POLL_STABILIZE_MS = 10_000;

type Phase = "idle" | "instructions" | "pairing" | "checking";

export function ConnectionCard({ initial }: { initial: WhatsappView }) {
  const [wa, setWa] = React.useState<WhatsappView>(initial);
  const hasApi = wa.hasApi;
  const canEdit = true; // a página já exige administrador
  const resuming = wa.state !== "open" && !!wa.pairing?.byMe;
  const reload = React.useCallback(async () => {
    const r = await getWhatsappView();
    if (r.ok && r.data) setWa(r.data);
  }, []);

  const [phase, setPhase] = React.useState<Phase>(resuming ? "pairing" : "idle");
  const [qr, setQr] = React.useState<QrView | null>(null);
  const [qrAt, setQrAt] = React.useState<number>(0);
  const [startedAt, setStartedAt] = React.useState<number>(resuming && wa.pairing ? new Date(wa.pairing.startedAt).getTime() : 0);
  const [now, setNow] = React.useState<number>(() => Date.now());
  const [busy, setBusy] = React.useState<null | "start" | "cancel" | "disconnect" | "restrict">(null);
  const [error, setError] = React.useState<string | null>(null);
  const [okMsg, setOkMsg] = React.useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = React.useState(false);
  const [confirmRestrict, setConfirmRestrict] = React.useState(false);
  const [checkResult, setCheckResult] = React.useState<{ ok: boolean; status: string | null; error?: string } | null>(null);

  // Relógio de 1 s para o contador do QR e o tempo do pareamento.
  React.useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(t);
  }, []);

  const finishOpen = React.useCallback(async () => {
    setPhase("checking");
    setQr(null);
    setCheckResult(null);
    const res = await runDeliveryCheck();
    setCheckResult(res.ok ? (res.data ?? { ok: false, status: null, error: "não foi possível conferir" }) : { ok: false, status: null, error: res.error ?? "não foi possível conferir" });
    setPhase("idle");
    await reload();
  }, [reload]);

  // Polling curto enquanto pareia.
  React.useEffect(() => {
    if (phase !== "pairing") return;
    let alive = true;
    // Uma conferência por vez: `refreshPairing` pode levar até 20 s (o `connect` da
    // Evolution) e o intervalo é de 2 s. Chamadas sobrepostas abriam sessões em
    // paralelo (30/10).
    let emCurso = false;
    const tick = async () => {
      if (!alive || emCurso || document.visibilityState !== "visible") return;
      emCurso = true;
      let res: Awaited<ReturnType<typeof refreshPairing>>;
      try {
        res = await refreshPairing();
      } finally {
        emCurso = false;
      }
      if (!alive) return;
      if (!res.ok) {
        setError(res.error ?? "Não consegui conferir o estado.");
        return;
      }
      const v = res.data!;
      if (v.state === "open") {
        void finishOpen();
        return;
      }
      if (v.expired) {
        setPhase("idle");
        setQr(null);
        setOkMsg(null);
        setError("Não deu tempo: ninguém leu o QR em 3 minutos, então parei de gerar códigos. Tente de novo quando estiver com o celular na mão.");
        void reload();
        return;
      }
      if (v.qr) {
        setQr((prev) => {
          if (!prev || prev.count !== v.qr!.count || prev.base64 !== v.qr!.base64) {
            setQrAt(Date.now());
            return v.qr!;
          }
          return prev;
        });
      }
    };
    void tick();
    const t = window.setInterval(() => void tick(), POLL_PAIRING_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      alive = false;
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [phase, finishOpen, reload]);

  // Espera de 5 min com a sessão aberta: o servidor liga o Chatwoot quando der o tempo.
  React.useEffect(() => {
    if (phase !== "idle" || !wa.stabilizing || wa.state !== "open") return;
    let alive = true;
    let emCurso = false;
    const tick = async () => {
      if (!alive || emCurso) return;
      emCurso = true;
      try {
        const r = await finishStabilization();
        if (!alive) return;
        if (!r.ok) setError(r.error ?? "Não consegui ligar o Chatwoot.");
        else if (r.data?.done) {
          setOkMsg(r.data.note ?? "Pronto: o Chatwoot foi ligado. As mensagens do WhatsApp já chegam em Atendimentos.");
        }
        await reload();
      } finally {
        emCurso = false;
      }
    };
    const t = window.setInterval(() => void tick(), POLL_STABILIZE_MS);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [phase, wa.stabilizing, wa.state, reload]);

  // Em repouso: relê o estado a cada 25 s.
  React.useEffect(() => {
    if (phase !== "idle") return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      void reload();
    };
    const t = window.setInterval(tick, POLL_IDLE_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [phase, reload]);

  async function start() {
    setBusy("start");
    setError(null);
    setOkMsg(null);
    setCheckResult(null);
    const res = await startPairing();
    setBusy(null);
    if (!res.ok) {
      setError(res.error ?? "Não deu certo.");
      setPhase("idle");
      return;
    }
    const v = res.data!;
    if (v.state === "open") {
      setOkMsg("O número já estava conectado — era só a tela desatualizada. Nenhuma tentativa foi gasta.");
      setPhase("idle");
      void reload();
      return;
    }
    setStartedAt(Date.now());
    if (v.qr) {
      setQr(v.qr);
      setQrAt(Date.now());
    }
    setPhase("pairing");
  }

  async function cancel() {
    setBusy("cancel");
    const res = await cancelPairing();
    setBusy(null);
    setPhase("idle");
    setQr(null);
    if (!res.ok) setError(res.error ?? "Não consegui cancelar.");
    else setOkMsg("Pareamento cancelado. Nenhum código a mais será gerado.");
    void reload();
  }

  async function disconnect() {
    if (!confirmDisconnect) {
      setConfirmDisconnect(true);
      return;
    }
    setConfirmDisconnect(false);
    setBusy("disconnect");
    const res = await disconnectWhatsapp();
    setBusy(null);
    if (!res.ok) setError(res.error ?? "Não consegui desconectar.");
    else setOkMsg("Desconectado. As mensagens do WhatsApp param de chegar até conectar de novo.");
    void reload();
  }

  async function restricted() {
    if (!confirmRestrict) {
      setConfirmRestrict(true);
      return;
    }
    setConfirmRestrict(false);
    setBusy("restrict");
    const res = await markRestricted();
    setBusy(null);
    setPhase("idle");
    setQr(null);
    if (!res.ok) setError(res.error ?? "Não consegui registrar.");
    else setOkMsg("Registrado. O botão Conectar fica travado por 6 horas — é o tempo que o WhatsApp costuma levar para liberar. Insistir antes estende a punição.");
    void reload();
  }

  const qrAgeS = qrAt ? Math.floor((now - qrAt) / 1000) : 0;
  const qrLeftS = Math.max(0, QR_TTL_S - qrAgeS);
  const pairingLeftS = startedAt ? Math.max(0, PAIRING_TIMEOUT_S - Math.floor((now - startedAt) / 1000)) : PAIRING_TIMEOUT_S;

  const attemptsUsed = wa.attempts.length;
  const releaseAt = wa.gate.until ? new Date(wa.gate.until).getTime() : wa.attempts[0] ? new Date(wa.attempts[0]).getTime() + 24 * 3600 * 1000 : null;
  const gate = wa.gate;
  const stabLeftS = wa.stabilizing ? Math.max(0, Math.ceil((new Date(wa.stabilizing.readyAt).getTime() - now) / 1000)) : 0;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Panel>
        <SectionTitle aside={wa.checkedAt ? `conferido ${formatDateTime(wa.checkedAt)}` : undefined}>Estado da conexão</SectionTitle>

        <div className="px-4 py-4">
          <StatusLine state={phase === "pairing" ? "connecting" : phase === "checking" ? "checking" : wa.state} />

          {phase === "idle" && wa.state === "open" ? (
            <dl className="mt-3">
              <Field label="número">{wa.phone ? formatPhone(wa.phone) : "—"}</Field>
              <Field label="perfil">{wa.profileName ?? "—"}</Field>
              <Field label="mensagens">
                {wa.bridge === "on"
                  ? "chegando ao Chatwoot normalmente"
                  : wa.stabilizing
                    ? `confirmando que a conexão firmou; o Chatwoot liga em ${Math.floor(stabLeftS / 60)}:${String(stabLeftS % 60).padStart(2, "0")}`
                    : "integração com o Chatwoot desligada"}
              </Field>
            </dl>
          ) : null}

          {phase === "idle" && wa.state !== "open" ? (
            <p className="mt-2 text-sm text-ink-muted">
              {wa.state === "connecting"
                ? wa.pairing
                  ? "Alguém está pareando este número agora."
                  : "A Evolution está tentando conectar sem ninguém pareando."
                : wa.disconnectAt || wa.disconnectCode
                  ? `Caiu ${wa.disconnectAt ? `em ${formatDateTime(wa.disconnectAt)}` : ""}: ${disconnectReasonLabel(wa.disconnectCode)}. As mensagens não chegam até conectar de novo.`
                  : "Sem sessão. As mensagens do WhatsApp não chegam até conectar."}
            </p>
          ) : null}

          {phase === "instructions" ? (
            <div className="mt-3 space-y-3">
              <ol className="list-decimal space-y-1.5 pl-5 text-sm">
                <li>Abra esta página <strong>no computador ou tablet</strong> — é o celular do número que vai ler o QR.</li>
                <li>No celular, abra o WhatsApp → <strong>Configurações</strong> (ou os três pontos) → <strong>Aparelhos conectados</strong>.</li>
                <li>Toque em <strong>Conectar um aparelho</strong> e pare na tela da câmera.</li>
              </ol>
              <p className="text-sm text-ink-muted">
                Só clique abaixo com o celular já na tela da câmera: o QR dura uns 40 segundos e cada QR pedido conta contra a conta no WhatsApp.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="primary" onClick={start} disabled={busy !== null}>
                  <QrCode aria-hidden /> {busy === "start" ? "pedindo o QR…" : "Sim, mostrar o QR"}
                </Button>
                <Button type="button" onClick={() => setPhase("idle")} disabled={busy !== null}>
                  Ainda não
                </Button>
              </div>
            </div>
          ) : null}

          {phase === "pairing" ? (
            <div className="mt-3 grid gap-4 md:grid-cols-[auto_1fr]">
              <div className="flex flex-col items-center gap-2">
                {qr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qr.base64} alt="QR code para conectar o WhatsApp" width={264} height={264} className="rounded border border-line bg-white p-2" />
                ) : (
                  <div className="flex size-[264px] items-center justify-center rounded border border-dashed border-line text-sm text-ink-muted">
                    {startedAt && now - startedAt > 15_000 ? "confirmando com o WhatsApp…" : "gerando o QR…"}
                  </div>
                )}
                <div className="text-xs text-ink-muted" aria-live="polite">
                  {qr ? (qrLeftS > 0 ? `este QR vale por ${qrLeftS} s` : "trocando o QR…") : null}
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <p>Aponte a câmera do celular para o QR. Quando o WhatsApp confirmar, esta tela muda sozinha.</p>
                <p className="text-ink-muted">
                  Se o QR vencer, o próximo aparece aqui sozinho. Se ninguém ler em 3 minutos ({pairingLeftS} s restantes), eu paro de gerar códigos.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button type="button" onClick={cancel} disabled={busy !== null}>
                    <X aria-hidden /> {busy === "cancel" ? "cancelando…" : "Cancelar"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {phase === "checking" ? (
            <p className="mt-3 text-sm text-ink-muted">Conectou. Mandando uma mensagem de teste para o próprio número e esperando o WhatsApp confirmar a entrega…</p>
          ) : null}

          {checkResult ? (
            <Notice tone={checkResult.ok ? "ok" : "danger"} className="mt-3">
              {checkResult.ok
                ? "Teste de envio entregue: a conexão está boa. Em 5 minutos o painel liga o Chatwoot (deixe esta tela aberta)."
                : `A conexão subiu, mas o teste de envio não foi confirmado${checkResult.error ? ` (${checkResult.error})` : ""}. Se em alguns minutos as mensagens não chegarem, desconecte e tente de novo mais tarde — não insista agora.`}
            </Notice>
          ) : null}

          {error ? <Notice tone="danger" className="mt-3">{error}</Notice> : null}
          {okMsg ? <Notice tone="ok" className="mt-3">{okMsg}</Notice> : null}

          {!hasApi ? (
            <Notice tone="danger" className="mt-3">
              O ambiente não tem <code className="font-mono">EVOLUTION_INTERNAL_URL</code> / <code className="font-mono">HENRIQUEVENTURA_EVOLUTION_INSTANCE_KEY</code>: a tela fica somente leitura.
            </Notice>
          ) : null}

          {canEdit && hasApi && phase === "idle" ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {wa.state === "open" ? (
                <Button type="button" variant="danger" onClick={disconnect} disabled={busy !== null}>
                  <Unplug aria-hidden /> {busy === "disconnect" ? "desconectando…" : confirmDisconnect ? "Confirmar: desconectar" : "Desconectar"}
                </Button>
              ) : gate.ok ? (
                <Button type="button" variant="primary" onClick={() => { setError(null); setOkMsg(null); setPhase("instructions"); }} disabled={busy !== null}>
                  <Smartphone aria-hidden /> Conectar
                </Button>
              ) : (
                <GateMessage gate={gate} />
              )}
              {wa.state !== "open" ? (
                <Button type="button" variant={confirmRestrict ? "danger" : "ghost"} onClick={restricted} disabled={busy !== null}>
                  <ShieldAlert aria-hidden /> {busy === "restrict" ? "registrando…" : confirmRestrict ? "Confirmar: travar por 6 h" : "O celular disse “conta restringida”"}
                </Button>
              ) : null}
              {confirmDisconnect || confirmRestrict ? (
                <Button type="button" variant="ghost" onClick={() => { setConfirmDisconnect(false); setConfirmRestrict(false); }}>
                  Deixa
                </Button>
              ) : null}
            </div>
          ) : null}
          {!canEdit ? <p className="mt-3 text-xs text-ink-muted">Só administradores conectam ou desconectam o número.</p> : null}
        </div>

        <div className="border-t border-line px-4 py-2 text-xs text-ink-muted">
          Muitas tentativas de conexão ou muito envio automático podem restringir o número.
        </div>
      </Panel>

      <Panel className="h-fit">
        <SectionTitle>Tentativas</SectionTitle>
        <dl className="px-4 py-2">
          <Field label="últimas 24 h">
            {attemptsUsed} de 3 {attemptsUsed === 1 ? "tentativa usada" : "tentativas usadas"}
            {attemptsUsed >= 3 && releaseAt && releaseAt > now ? <span className="text-ink-muted"> · libera às {formatDateTime(new Date(releaseAt))}</span> : null}
          </Field>
          {wa.lastDelivery ? (
            <Field label="teste de envio">
              {formatDateTime(wa.lastDelivery.at)} · {wa.lastDelivery.ok ? "entregue" : "não confirmado"}
            </Field>
          ) : null}
          {wa.restrictedUntil && new Date(wa.restrictedUntil).getTime() > now ? (
            <Field label="travado até">{formatDateTime(wa.restrictedUntil)}</Field>
          ) : null}
          {wa.attempts.length ? (
            <Field label="quando">
              <ul className="space-y-0.5">
                {wa.attempts.map((a) => (
                  <li key={a}>{formatDateTime(a)}</li>
                ))}
              </ul>
            </Field>
          ) : null}
        </dl>
        <div className="border-t border-line px-4 py-3 text-xs text-ink-muted">
          <p>O WhatsApp conta pareamentos, quedas e QRs pedidos num mesmo dia. Passar do ponto dá &ldquo;conta restringida&rdquo; por ~6 h — e tentar de novo nesse meio tempo estende a punição.</p>
          <p className="mt-2">Por isso: só peça o QR com o celular na mão, e se o aparelho avisar restrição, use o botão ao lado em vez de tentar de novo.</p>
        </div>
      </Panel>
    </div>
  );
}

function StatusLine({ state }: { state: "open" | "connecting" | "close" | "checking" }) {
  // Chegar a "Conectado" vindo de outro estado, com a tela aberta, ganha um
  // momento (M14): o ponto solta um anel uma vez e um ✓ se desenha. Quem abre
  // a tela já conectado vê só o estado, como antes.
  const [prev, setPrev] = React.useState(state);
  const [celebrate, setCelebrate] = React.useState(false);
  if (state !== prev) {
    setPrev(state);
    setCelebrate(state === "open");
  }
  const meta =
    state === "open"
      ? { dot: "bg-state-won", text: "Conectado", cls: "text-state-won" }
      : state === "connecting"
        ? { dot: "bg-state-ai animate-pulse", text: "Conectando…", cls: "text-state-ai" }
        : state === "checking"
          ? { dot: "bg-state-ai animate-pulse", text: "Conectado — confirmando a entrega…", cls: "text-state-ai" }
          : { dot: "bg-danger", text: "Desconectado", cls: "text-danger" };
  return (
    <div className={cn("flex items-center gap-2.5 font-display text-xl", meta.cls)} role="status">
      <span className="relative inline-block size-3" aria-hidden>
        <span className={cn("absolute inset-0 rounded-full", meta.dot)} />
        {celebrate ? <span className="absolute inset-0 animate-ping-once rounded-full border-2 border-state-won" /> : null}
      </span>
      {meta.text}
      {celebrate ? <Check className="draw-check size-5" strokeWidth={2.4} aria-hidden /> : null}
    </div>
  );
}

function GateMessage({ gate }: { gate: WhatsappView["gate"] }) {
  const until = gate.until ? formatDateTime(gate.until) : null;
  const text =
    gate.reason === "restricted"
      ? `Conectar está travado${until ? ` até ${until}` : ""}: o WhatsApp restringiu a conta. Tentar antes estende a punição.`
      : gate.reason === "daily_limit"
        ? `Já foram 3 tentativas nas últimas 24 horas. Conectar libera${until ? ` às ${until}` : " amanhã"}.`
        : gate.reason === "pairing_in_progress"
          ? "Outra pessoa está pareando agora. Espere terminar (no máximo 3 minutos)."
          : "Conectar não está disponível agora.";
  return <Notice className="w-full">{text}</Notice>;
}
