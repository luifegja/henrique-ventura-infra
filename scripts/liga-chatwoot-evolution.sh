#!/usr/bin/env bash
# ============================================================
# Liga a integração Chatwoot na instância "henriqueventura" da Evolution — SÓ DEPOIS do
# pareamento estável (docs/runbooks/01-parear-whatsapp.md, passo "Depois de parear").
# A Evolution cria sozinha a inbox "henriqueventura" na conta do Chatwoot; em seguida o
# script garante o bot e o Luiz como membros dela (o bot precisa ser membro para responder).
# Roda NO SERVIDOR. Idempotente.
#
#   bash scripts/liga-chatwoot-evolution.sh            # liga
#   bash scripts/liga-chatwoot-evolution.sh desligar   # desliga (antes de re-parear)
# ============================================================
set -euo pipefail
INST=henriqueventura
ENVF=/opt/henriqueventura/.env
EVO=http://127.0.0.1:8080
v() { grep "^$1=" "$ENVF" | cut -d= -f2- | tail -n1; }
K="$(v HENRIQUEVENTURA_EVOLUTION_INSTANCE_KEY)"; CONTA="$(v CHATWOOT_ACCOUNT_ID)"; BOT="$(v CHATWOOT_BOT_TOKEN)"
[[ -n "$K" && "$CONTA" =~ ^[0-9]+$ && -n "$BOT" ]] || { echo "faltam variáveis em $ENVF" >&2; exit 1; }

if [[ "${1:-}" == "desligar" ]]; then
  curl -s -m 30 -X POST -H "apikey: $K" -H 'Content-Type: application/json' \
    -d '{"enabled":false,"accountId":"","token":"","url":"","nameInbox":""}' "$EVO/chatwoot/set/$INST" | head -c 200; echo
  exit 0
fi

estado="$(curl -s -m 20 -H "apikey: $K" "$EVO/instance/connectionState/$INST")"
case "$estado" in *'"open"'*) ;; *) echo "instância não está open ($estado): pareie antes" >&2; exit 1;; esac

corpo="$(CONTA="$CONTA" BOT="$BOT" INST="$INST" python3 -c "import json,os; print(json.dumps({
  'enabled': True, 'accountId': os.environ['CONTA'], 'token': os.environ['BOT'], 'url': 'http://chatwoot-web:3000',
  'nameInbox': os.environ['INST'], 'signMsg': False, 'reopenConversation': True, 'conversationPending': False,
  'mergeBrazilContacts': True, 'importContacts': False, 'importMessages': False, 'daysLimitImportMessages': 0,
  'autoCreate': True, 'organization': 'Henrique Ventura', 'logo': ''}))")"
code="$(curl -s -m 30 -o /dev/null -w '%{http_code}' -X POST -H "apikey: $K" -H 'Content-Type: application/json' \
  -d "$corpo" "$EVO/chatwoot/set/$INST")"
echo "  chatwoot/set: HTTP $code"
sleep 5

docker exec -i -e CONTA="$CONTA" -e INST="$INST" advotrack-chatwoot-web bundle exec rails runner - 2>/dev/null <<'RUBY' | grep -E '^  '
account = Account.find(ENV.fetch('CONTA'))
abort "conta #{account.id} não é a do Henrique Ventura" unless account.name == 'Henrique Ventura'
inbox = account.inboxes.find_by(name: ENV.fetch('INST'))
if inbox.nil?
  puts "  inbox #{ENV['INST']} ainda não apareceu na conta #{account.id}: confira o log da Evolution"
else
  account.account_users.includes(:user).each do |au|
    next unless au.user.email.end_with?('@henriqueventura.local') || au.administrator?
    InboxMember.find_or_create_by!(inbox: inbox, user: au.user)
  end
  puts "  inbox #{inbox.id} (#{inbox.name}); membros: #{inbox.members.pluck(:email).join(', ')}"
end
RUBY
