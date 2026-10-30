/**
 * Leitura das respostas da Evolution (lib/evolution-parse.ts) — o que a tela
 * WhatsApp precisa acertar sem rede: estado, número a partir do ownerJid, QR
 * corrente vs. sessão aberta, ack do teste de entrega, e o que volta para o
 * `chatwoot/set` ao pausar/religar a ponte (sem nulos, sem campos que o set
 * não conhece, token intacto).
 */
import { describe, it, expect } from "vitest";
import {
  parseState,
  parseInstance,
  parseConnectionState,
  parseConnect,
  parseSendResult,
  parseMessageStatus,
  isDelivered,
  phoneFromJid,
  disconnectReasonLabel,
  bridgePayload,
  bridgeEnabled,
} from "@/lib/evolution-parse";

// Foto real de 16/09 (token trocado), sem os blocos que não importam.
const clínica = {
  id: "704af026-2613-4e41-b1dc-c1c880293a25",
  name: "clinitrack-clinica",
  connectionStatus: "close",
  ownerJid: "5513996690572@s.whatsapp.net",
  profileName: "clínica Atendimento",
  integration: "WHATSAPP-BAILEYS",
  number: null,
  token: "xxx",
  disconnectionReasonCode: 403,
  disconnectionAt: "2026-08-28T21:37:16.996Z",
};

describe("estado", () => {
  it("só conhece open/connecting; o resto é close", () => {
    expect(parseState("open")).toBe("open");
    expect(parseState("connecting")).toBe("connecting");
    expect(parseState("close")).toBe("close");
    expect(parseState("refused")).toBe("close");
    expect(parseState(undefined)).toBe("close");
  });

  it("connectionState aninhado em instance", () => {
    expect(parseConnectionState({ instance: { instanceName: "x", state: "open" } })).toBe("open");
    expect(parseConnectionState({})).toBe("close");
  });
});

describe("instância", () => {
  it("lê o array do fetchInstances filtrado", () => {
    const i = parseInstance([clínica]);
    expect(i).toEqual({
      name: "clinitrack-clinica",
      state: "close",
      phone: "+5513996690572",
      profileName: "clínica Atendimento",
      disconnectCode: 403,
      disconnectAt: "2026-08-28T21:37:16.996Z",
    });
  });

  it("vazio ou sem nome → null; ownerJid ausente → telefone null", () => {
    expect(parseInstance([])).toBeNull();
    expect(parseInstance({ connectionStatus: "open" })).toBeNull();
    expect(parseInstance({ name: "nova", connectionStatus: "open" })?.phone).toBeNull();
  });

  it("ownerJid com sufixo de dispositivo e LID", () => {
    expect(phoneFromJid("5511944488999:12@s.whatsapp.net")).toBe("+5511944488999");
    expect(phoneFromJid("123@lid")).toBeNull();
    expect(phoneFromJid(null)).toBeNull();
  });
});

describe("connect", () => {
  it("QR corrente: base64 vira data URL se vier cru, count ≥ 1", () => {
    const r = parseConnect({ pairingCode: null, code: "2@abc", base64: "iVBORw0KGgo=", count: 3 });
    expect(r).toEqual({ kind: "qr", base64: "data:image/png;base64,iVBORw0KGgo=", code: "2@abc", count: 3 });
    const r2 = parseConnect({ base64: "data:image/png;base64,AAA", count: 0 });
    expect(r2).toMatchObject({ kind: "qr", base64: "data:image/png;base64,AAA", count: 1, code: null });
  });

  it("sessão aberta: sem QR, estado", () => {
    expect(parseConnect({ instance: { instanceName: "x", state: "open" } })).toEqual({ kind: "state", state: "open" });
    expect(parseConnect(null)).toEqual({ kind: "state", state: "close" });
  });
});

describe("teste de entrega", () => {
  it("sendText devolve key.id e status", () => {
    expect(parseSendResult({ key: { remoteJid: "5513996690572@s.whatsapp.net", fromMe: true, id: "3EB0ABC" }, status: "PENDING" })).toEqual({
      keyId: "3EB0ABC",
      remoteJid: "5513996690572@s.whatsapp.net",
      status: "PENDING",
    });
    expect(parseSendResult("x")).toEqual({ keyId: null, remoteJid: null, status: null });
  });

  it("findStatusMessage: pega o ack mais avançado do keyId, ignorando outros ids", () => {
    const rows = [
      { keyId: "3EB0ABC", status: "PENDING" },
      { keyId: "OUTRO", status: "READ" },
      { keyId: "3EB0ABC", status: "SERVER_ACK" },
      { keyId: "3EB0ABC", status: "DELIVERY_ACK" },
    ];
    expect(parseMessageStatus(rows, "3EB0ABC")).toBe("DELIVERY_ACK");
    expect(parseMessageStatus({ messageUpdate: rows.slice(0, 1) }, "3EB0ABC")).toBe("PENDING");
    expect(parseMessageStatus([], "3EB0ABC")).toBeNull();
    expect(parseMessageStatus([{ key: { id: "3EB0ABC" }, status: "read" }], "3EB0ABC")).toBe("READ");
  });

  it("formato real de 16/09: número LID grava remoteJid @lid — o id basta", () => {
    const real = [{ id: "cmu4i26o503gapb5wt57ctc1z", keyId: "3EB0CB7E399E0E712996B6", remoteJid: "164452334837845@lid", fromMe: true, participant: null, pollUpdates: null, status: "SERVER_ACK", messageId: "cmu4i0vf703dvpb5w5xxy2qhu", instanceId: "704af026" }];
    expect(parseMessageStatus(real, "3EB0CB7E399E0E712996B6")).toBe("SERVER_ACK");
    expect(isDelivered(parseMessageStatus(real, "3EB0CB7E399E0E712996B6"))).toBe(true);
  });

  it("entregue = SERVER_ACK ou além; PENDING não", () => {
    expect(isDelivered("PENDING")).toBe(false);
    expect(isDelivered("SERVER_ACK")).toBe(true);
    expect(isDelivered("READ")).toBe(true);
    expect(isDelivered(null)).toBe(false);
  });
});

describe("motivo da queda", () => {
  it("403 e 401 têm leitura própria; desconhecido mostra o código", () => {
    expect(disconnectReasonLabel(403)).toMatch(/recusou/);
    expect(disconnectReasonLabel(401)).toMatch(/desvinculou/);
    expect(disconnectReasonLabel(440)).toMatch(/outro lugar/);
    expect(disconnectReasonLabel(999)).toContain("999");
    expect(disconnectReasonLabel(null)).toMatch(/encerrada/);
  });
});

describe("ponte com o Chatwoot", () => {
  // Foto real do GET /chatwoot/find de 16/09 (token trocado).
  const found = {
    enabled: true,
    accountId: "3",
    token: "TOKEN-ADMIN",
    url: "http://chatwoot-web:3000",
    nameInbox: "WhatsApp Comercial",
    signMsg: false,
    signDelimiter: null,
    reopenConversation: true,
    conversationPending: false,
    mergeBrazilContacts: true,
    importContacts: false,
    importMessages: false,
    daysLimitImportMessages: 60,
    organization: null,
    logo: null,
    ignoreJids: [],
    webhook_url: "http://evolution:8080/chatwoot/webhook/clinitrack-clinica",
  };

  it("pausar: mesmo objeto com enabled=false, sem nulos nem webhook_url, token intacto, autoCreate", () => {
    const p = bridgePayload(found, false);
    expect(p).toEqual({
      enabled: false,
      autoCreate: true,
      accountId: "3",
      token: "TOKEN-ADMIN",
      url: "http://chatwoot-web:3000",
      nameInbox: "WhatsApp Comercial",
      signMsg: false,
      reopenConversation: true,
      conversationPending: false,
      mergeBrazilContacts: true,
      importContacts: false,
      importMessages: false,
      daysLimitImportMessages: 60,
      ignoreJids: [],
    });
    expect(p).not.toHaveProperty("webhook_url");
    expect(p).not.toHaveProperty("signDelimiter");
  });

  it("religar: enabled=true", () => {
    expect(bridgePayload({ ...found, enabled: false }, true).enabled).toBe(true);
  });

  it("bridgeEnabled só com enabled === true", () => {
    expect(bridgeEnabled(found)).toBe(true);
    expect(bridgeEnabled({ ...found, enabled: false })).toBe(false);
    expect(bridgeEnabled(null)).toBe(false);
    expect(bridgeEnabled({})).toBe(false);
  });
});
