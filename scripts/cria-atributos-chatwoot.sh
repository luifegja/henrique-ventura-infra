#!/usr/bin/env bash
# ============================================================
# Cria/atualiza os atributos de CONTATO da conta "Henrique Ventura" no Chatwoot.
# Roda NO SERVIDOR. Idempotente: casa por attribute_key; se nome, descrição ou valores
# mudaram aqui, atualiza a definição (os valores já gravados nos contatos não mudam).
# Ideia do scripts/cria-atributos-chatwoot.sh do AdvoTrack, mas por rails runner: a conta
# nova não tem token de administrador e o bot é só agente.
#
#   bash scripts/cria-atributos-chatwoot.sh
#
# Para mudar a lista, edite ATRIBUTOS abaixo, rode de novo e registre em docs/decisoes/.
# Cuidado ao RENOMEAR um valor: contatos com o nome antigo continuam com o nome antigo.
# ============================================================
set -euo pipefail
ENVF=/opt/henriqueventura/.env
CONTA="$(grep '^CHATWOOT_ACCOUNT_ID=' "$ENVF" | cut -d= -f2-)"
[[ "$CONTA" =~ ^[0-9]+$ ]] || { echo "CHATWOOT_ACCOUNT_ID ausente em $ENVF" >&2; exit 1; }

# key | nome | tipo (text, number, currency, percent, link, date, list, checkbox) | descrição | valores (JSON, só list)
ATRIBUTOS="$(cat <<'JSON'
[
  {"key": "cadencia_comercial",
   "nome": "Cadência comercial",
   "tipo": "list",
   "descricao": "Etapa do lead na cadência comercial (jornada de atendimento).",
   "valores": ["Lead", "1º contato", "Qualificação", "Agendamento", "Reunião diagnóstico",
               "Follow up", "Contrato enviado", "Pagamento"]}
]
JSON
)"

echo "== atributos de contato na conta $CONTA"
docker exec -i -e CONTA="$CONTA" -e ATRIBUTOS="$ATRIBUTOS" \
  advotrack-chatwoot-web bundle exec rails runner - 2>/dev/null <<'RUBY' | grep -E '^(  |== )'
account = Account.find(ENV.fetch('CONTA'))
abort "conta #{account.id} não é a do Henrique Ventura" unless account.name == 'Henrique Ventura'
JSON.parse(ENV.fetch('ATRIBUTOS')).each do |a|
  d = CustomAttributeDefinition.find_or_initialize_by(account: account, attribute_key: a['key'],
                                                       attribute_model: :contact_attribute)
  d.assign_attributes(attribute_display_name: a['nome'], attribute_display_type: a['tipo'],
                      attribute_description: a['descricao'], attribute_values: a['valores'] || [])
  estado = d.new_record? ? 'criado' : (d.changed? ? "atualizado (#{d.changed.join(', ')})" : 'sem mudança')
  d.save! if d.new_record? || d.changed?
  puts "  #{a['key']}: #{estado}"
end
puts "== conferindo"
CustomAttributeDefinition.where(account: account, attribute_model: :contact_attribute).order(:id).each do |d|
  puts "  #{d.attribute_key} (#{d.attribute_display_type}) #{d.attribute_display_name}: #{d.attribute_values.join(' → ')}"
end
RUBY
