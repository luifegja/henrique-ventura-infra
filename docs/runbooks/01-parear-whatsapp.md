# Runbook — Parear o WhatsApp do Henrique Ventura

Como conectar o número do Henrique à instância `henriqueventura` da Evolution sem que a
sessão caia. Baseado no `docs/runbooks/01-parear-whatsapp.md` do AdvoTrack (leitura em
`~/referencia/sistema-atendimento-advotrack/`) e no re-pareamento da Garcia de 13/10/2026.

**Recurso escasso:** cada pareamento exige alguém com o aparelho na mão, e o código/QR
expira em ~40 s. Cada código pedido conta como tentativa; excesso no mesmo dia gera
"conta restringida" (~6 h). Prepare tudo antes de chamar a pessoa.

## Regra de ouro

**Nunca pareie com a integração Chatwoot ligada.** Sequência segura: parear limpo →
confirmar estável (~5–10 min) → só então `bash scripts/liga-chatwoot-evolution.sh`.
A instância foi criada em 30/10/2026 sem integração; se um dia precisar re-parear,
desligue antes: `bash scripts/liga-chatwoot-evolution.sh desligar`.

## Antes de chamar a pessoa

```bash
K=$(grep '^HENRIQUEVENTURA_EVOLUTION_INSTANCE_KEY=' /opt/henriqueventura/.env | cut -d= -f2-)   # não imprimir
curl -s -H "apikey: $K" http://127.0.0.1:8080/instance/connectionState/henriqueventura   # "close"
curl -s -H "apikey: $K" http://127.0.0.1:8080/chatwoot/find/henriqueventura              # enabled false ou vazio
# segundo terminal:
docker logs -f --since 1m advotrack-evolution 2>&1 | grep -viE deviceListMetadata | grep -i henriqueventura
```

## O pareamento (com a pessoa ao telefone, na tela certa)

**Por código** (melhor quando a pessoa não está ao lado de uma tela): ela abre
*Configurações → Aparelhos conectados → Conectar um aparelho → Conectar com número de
telefone* e **para ali**. Só então:

```bash
curl -s -H "apikey: $K" "http://127.0.0.1:8080/instance/connect/henriqueventura?number=55DDNUMERO"
```

Dite o código; ela digita na hora. Cada chamada gera código novo e mata o anterior.

**Por QR** (pessoa vê a tela do VS Code ou recebe o print na hora): a mesma chamada sem
`?number=` devolve `base64` do QR; salve como PNG e abra no VS Code.

Confirmar:

```bash
curl -s -H "apikey: $K" http://127.0.0.1:8080/instance/connectionState/henriqueventura   # "open"
```

**Freio:** se ninguém parear, pare o ciclo de QR (a 2.4 não para sozinha):

```bash
curl -s -X DELETE -H "apikey: $K" http://127.0.0.1:8080/instance/logout/henriqueventura   # volta a "close"
```

## Depois de parear

1. Mandar um teste para o número do Luiz (nunca para lead) e conferir que saiu:

   ```bash
   curl -s -X POST -H "apikey: $K" -H 'Content-Type: application/json' \
     -d '{"number":"5513991972240","text":"teste de entrega - pode ignorar"}' \
     http://127.0.0.1:8080/message/sendText/henriqueventura
   ```

2. Observar o log ~10 min: `401/403/406` ou `device_removed` = sessão ruim. `408` é
   timeout, não ban.
3. Ligar o Chatwoot: `bash scripts/liga-chatwoot-evolution.sh` → a inbox
   `henriqueventura` aparece na conta "Henrique Ventura" com bot e administradores como
   membros.
4. Mandar uma mensagem do celular do Luiz para o número: tem de abrir conversa na inbox.
5. Atualizar `STATUS.md` (número pareado, data, inbox id).

## Diagnóstico rápido

| Sintoma | Leitura |
|---|---|
| "Conta restringida" no aparelho | parar; esperar o prazo; voltar com **uma** tentativa limpa |
| `open` e cai em ~2 min | integração Chatwoot estava ligada? desligar, `logout`, re-parear |
| `liga-chatwoot-evolution.sh` diz que a inbox não apareceu | `docker logs --since 5m advotrack-evolution 2>&1 \| grep -i chatwoot` |
| Mensagem chega no WhatsApp mas não no Chatwoot | `GET /chatwoot/find/henriqueventura` → `enabled: true`? bot é membro da inbox? |
