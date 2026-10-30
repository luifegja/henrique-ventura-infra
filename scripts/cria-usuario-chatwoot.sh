#!/usr/bin/env bash
# ============================================================
# Dá acesso à conta "Henrique Ventura" do Chatwoot a um atendente humano.
# Roda NO SERVIDOR. Idempotente: se o e-mail já tem usuário, só cria o vínculo com a conta
# (a senha dele fica como está).
#
#   bash scripts/cria-usuario-chatwoot.sh "Henrique Ventura" henrique@exemplo.com [administrator|agent]
#
# Usuário novo: a senha aparece UMA vez na tela. Entregue à pessoa e não grave em lugar nenhum.
# ============================================================
set -euo pipefail
ENVF=/opt/henriqueventura/.env
NOME="${1:?nome}"; EMAIL="${2:?e-mail}"; PAPEL="${3:-administrator}"
[[ "$PAPEL" =~ ^(administrator|agent)$ ]] || { echo "papel inválido: $PAPEL" >&2; exit 2; }
[[ "$EMAIL" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]] || { echo "e-mail inválido" >&2; exit 2; }
CONTA="$(grep '^CHATWOOT_ACCOUNT_ID=' "$ENVF" | cut -d= -f2-)"
[[ "$CONTA" =~ ^[0-9]+$ ]] || { echo "CHATWOOT_ACCOUNT_ID ausente em $ENVF (rode cria-conta-chatwoot.sh)" >&2; exit 1; }

docker exec -i -e CONTA="$CONTA" -e NOME="$NOME" -e EMAIL="$EMAIL" -e PAPEL="$PAPEL" \
  advotrack-chatwoot-web bundle exec rails runner - 2>/dev/null <<'RUBY' | grep -E '^(usuário|SENHA)'
account = Account.find(ENV.fetch('CONTA'))
abort "conta #{account.id} não é a do Henrique Ventura" unless account.name == 'Henrique Ventura'
email = ENV.fetch('EMAIL').downcase
user = User.find_by(email: email)
senha = nil
if user.nil?
  senha = SecureRandom.base58(14) + 'aA1!'
  user = User.create!(name: ENV.fetch('NOME'), email: email, password: senha, confirmed_at: Time.current)
end
au = AccountUser.find_or_create_by!(account: account, user: user) { |x| x.role = ENV.fetch('PAPEL') }
puts "usuário #{user.id} (#{email}) na conta #{account.id} como #{au.role}"
puts(senha ? "SENHA (mostrada uma vez): #{senha}" : "usuário já existia: senha inalterada")
RUBY
