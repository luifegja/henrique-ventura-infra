#!/usr/bin/env bash
# ============================================================
# Cria (ou reencontra) a conta "Henrique Ventura" no Chatwoot compartilhado, com o Luiz
# como administrador e o usuário-bot como agente (manual do projeto irmão, §4.5).
# Roda NO SERVIDOR. Idempotente: reusa conta, usuários e vínculos que já existem.
#
#   bash scripts/cria-conta-chatwoot.sh
#
# Grava CHATWOOT_ACCOUNT_ID, CHATWOOT_BOT_USER_ID e CHATWOOT_BOT_TOKEN em
# /opt/henriqueventura/.env (só os que ainda não estão lá). Nada de segredo vai para a tela.
# Atendentes humanos (o Henrique e outros): scripts/cria-usuario-chatwoot.sh.
# ============================================================
set -euo pipefail
SLUG=henriqueventura
ENVF=/opt/$SLUG/.env
NOME_CONTA="Henrique Ventura"
EMAIL_LUIZ="lfca.consultor@gmail.com"
[[ -w "$ENVF" ]] || { echo "$ENVF não existe ou não é gravável" >&2; exit 1; }

saida="$(docker exec -i -e SLUG="$SLUG" -e NOME_CONTA="$NOME_CONTA" -e EMAIL_LUIZ="$EMAIL_LUIZ" \
  advotrack-chatwoot-web bundle exec rails runner - 2>/dev/null <<'RUBY'
slug = ENV.fetch('SLUG'); nome_conta = ENV.fetch('NOME_CONTA'); email_luiz = ENV.fetch('EMAIL_LUIZ')
account = Account.find_by(name: nome_conta) || Account.create!(name: nome_conta, locale: 'pt_BR')
luiz = User.find_by(email: email_luiz)
if luiz.nil?
  luiz = User.create!(name: 'Luiz', email: email_luiz, password: SecureRandom.base58(16) + 'aA1!', confirmed_at: Time.current)
  puts "AVISO=usuário do Luiz não existia: criado com senha aleatória; redefina pela tela de login"
end
AccountUser.find_or_create_by!(account: account, user: luiz) { |au| au.role = :administrator }
bot_email = "bot@#{slug}.local"
bot = User.find_by(email: bot_email) ||
      User.create!(name: 'Bot Henrique Ventura', email: bot_email, password: SecureRandom.base58(24) + 'aA1!', confirmed_at: Time.current)
AccountUser.find_or_create_by!(account: account, user: bot) { |au| au.role = :agent }
puts "CHATWOOT_ACCOUNT_ID=#{account.id}"
puts "CHATWOOT_BOT_USER_ID=#{bot.id}"
puts "CHATWOOT_BOT_TOKEN=#{bot.access_token.token}"
RUBY
)"

grava() { # NOME — copia a linha da saída do rails para o .env, se ainda não houver
  local nome="$1" linha
  linha="$(printf '%s\n' "$saida" | grep "^$nome=" | tail -n1 || true)"
  [[ -n "$linha" ]] || { echo "  $nome: ausente na saída do Chatwoot" >&2; exit 1; }
  if grep -q "^$nome=" "$ENVF"; then
    [[ "$(grep "^$nome=" "$ENVF" | tail -n1)" == "$linha" ]] && echo "  $nome: já no .env" \
      || { echo "  $nome: .env tem valor DIFERENTE do Chatwoot — confira à mão" >&2; exit 1; }
  else
    printf '%s\n' "$linha" >> "$ENVF"; echo "  $nome: gravado"
  fi
}
printf '%s\n' "$saida" | grep '^AVISO=' || true
grava CHATWOOT_ACCOUNT_ID
grava CHATWOOT_BOT_USER_ID
grava CHATWOOT_BOT_TOKEN
echo "conta: $(grep '^CHATWOOT_ACCOUNT_ID=' "$ENVF" | cut -d= -f2-) · bot: $(grep '^CHATWOOT_BOT_USER_ID=' "$ENVF" | cut -d= -f2-)"
