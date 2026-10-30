#!/usr/bin/env bash
# Implanta o painel (web/) do Henrique Ventura, rodando NO PRÓPRIO servidor.
# Molde: scripts/implanta-web.sh do CliniTrack 2.0.
#
#   1. copia infra/docker-compose.yml para /opt/henriqueventura (backup do anterior, se houver)
#   2. build da imagem henriqueventura-web:0.1.0 a partir do repositório
#   3. `docker compose -p henriqueventura up -d --no-deps web` — recria SÓ o nosso contêiner
#   4. espera o healthcheck e confere /login = 200
#
# Nunca roda down/restart/stop, e nunca toca contêiner que não seja henriqueventura-*.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
STACK=/opt/henriqueventura
TS="$(date +%Y%m%d-%H%M%S)"
[[ -f "$STACK/.env" ]] || { echo "$STACK/.env não existe" >&2; exit 1; }
grep -q '^name: henriqueventura$' "$REPO/infra/docker-compose.yml" || { echo "compose sem name: henriqueventura" >&2; exit 1; }
for v in HENRIQUEVENTURA_WEB_AUTH_SECRET CHATWOOT_ACCOUNT_ID CHATWOOT_BOT_TOKEN CHATWOOT_BOT_USER_ID HENRIQUEVENTURA_EVOLUTION_INSTANCE_KEY; do
  grep -q "^$v=." "$STACK/.env" || { echo "falta $v em $STACK/.env" >&2; exit 1; }
done

echo "== 1. compose"
mkdir -p "$STACK/backups"
[[ -f "$STACK/docker-compose.yml" ]] && cp -p "$STACK/docker-compose.yml" "$STACK/backups/docker-compose.yml.$TS"
cp "$REPO/infra/docker-compose.yml" "$STACK/docker-compose.yml"

echo "== 2. build da imagem"
docker build -q -t henriqueventura-web:0.1.0 "$REPO/web"

echo "== 3. contêiner web"
cd "$STACK"
docker compose -p henriqueventura up -d --no-deps web

echo "== 4. healthcheck"
for _ in $(seq 1 30); do
  st="$(docker inspect -f '{{.State.Health.Status}}' henriqueventura-web 2>/dev/null || echo desconhecido)"
  if [ "$st" = healthy ]; then
    echo "web: healthy; /login = $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3600/login)"
    exit 0
  fi
  sleep 5
done
echo "web não ficou healthy em 150 s (último estado: $st) — ver: docker logs --tail 50 henriqueventura-web" >&2
exit 1
