#!/usr/bin/env bash
# ============================================================
# Cria a instância "henriqueventura" na Evolution compartilhada (manual §4.6), SEM QR code
# e SEM integração com o Chatwoot: o pareamento é outro passo (docs/runbooks/01-parear-whatsapp.md).
# Roda NO SERVIDOR. Idempotente: se a instância já existe, só mostra o estado.
#
#   bash scripts/cria-instancia-evolution.sh
#
# Grava a apikey DA INSTÂNCIA (o "hash" da resposta) como HENRIQUEVENTURA_EVOLUTION_INSTANCE_KEY
# em /opt/henriqueventura/.env. A chave global só é usada aqui, para criar; nunca é impressa.
# ============================================================
set -euo pipefail
INST=henriqueventura
ENVF=/opt/henriqueventura/.env
EVO=http://127.0.0.1:8080
[[ -w "$ENVF" ]] || { echo "$ENVF não existe ou não é gravável" >&2; exit 1; }
API="$(sudo grep '^EVOLUTION_API_KEY=' /opt/advotrack/.env | cut -d= -f2- | grep . | tail -n1)"
[[ -n "$API" ]] || { echo "EVOLUTION_API_KEY não encontrada" >&2; exit 1; }

existe="$(curl -s -m 20 -H "apikey: $API" "$EVO/instance/fetchInstances?instanceName=$INST" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('sim' if isinstance(d,list) and any(i.get('name')=='$INST' for i in d) else 'nao')")"

if [[ "$existe" == "nao" ]]; then
  resp="$(curl -s -m 30 -X POST -H "apikey: $API" -H 'Content-Type: application/json' \
    -d "{\"instanceName\":\"$INST\",\"integration\":\"WHATSAPP-BAILEYS\",\"qrcode\":false}" "$EVO/instance/create")"
  chave="$(printf '%s' "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); h=d.get('hash'); print(h.get('apikey','') if isinstance(h,dict) else (h or ''))")"
  [[ -n "$chave" ]] || { echo "criação falhou: $(printf '%s' "$resp" | head -c 300)" >&2; exit 1; }
  if grep -q '^HENRIQUEVENTURA_EVOLUTION_INSTANCE_KEY=' "$ENVF"; then
    echo "  .env já tinha HENRIQUEVENTURA_EVOLUTION_INSTANCE_KEY — confira à mão" >&2; exit 1
  fi
  printf 'HENRIQUEVENTURA_EVOLUTION_INSTANCE_KEY=%s\n' "$chave" >> "$ENVF"
  echo "  instância $INST criada; chave da instância gravada no .env"
else
  echo "  instância $INST já existe"
fi

K="$(grep '^HENRIQUEVENTURA_EVOLUTION_INSTANCE_KEY=' "$ENVF" | cut -d= -f2-)"
echo "  estado: $(curl -s -m 20 -H "apikey: $K" "$EVO/instance/connectionState/$INST")"
