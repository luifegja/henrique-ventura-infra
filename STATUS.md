# STATUS — Henrique Ventura

Documento vivo. Última atualização: **30/10/2026** (sessão 1: provisionamento).

## Onde estamos

| Frente | Estado |
|---|---|
| Repositório | ✅ `luifegja/henrique-ventura-infra` (origin) |
| Servidor | ✅ `/opt/henriqueventura` (700) + `.env` (600, 4 variáveis) |
| Chatwoot | ✅ conta **20** "Henrique Ventura" (locale pt_BR); Luiz (id 4) administrador; bot id 16 agente |
| Cadência comercial | ✅ atributo de contato `cadencia_comercial` (lista, definição 17) com Lead → 1º contato → Qualificação → Agendamento → Reunião diagnóstico → Follow up → Contrato enviado → Pagamento. Script rodado 3× (idempotente). ⛔ falta o teste na tela pelo Luiz |
| Evolution | ✅ instância `henriqueventura` criada (Baileys, sem QR, sem Chatwoot), estado `close` |
| WhatsApp | ⛔ não pareado — aguarda número e alguém com o aparelho (`docs/runbooks/01-parear-whatsapp.md`) |
| Henrique no Chatwoot | ⛔ aguarda o e-mail dele (`scripts/cria-usuario-chatwoot.sh`) |

## Próximos passos

1. E-mail do Henrique → `bash scripts/cria-usuario-chatwoot.sh "Henrique Ventura" <e-mail>`
   (senha mostrada uma vez, entregue a ele).
2. Pareamento do número do Henrique (runbook 01) → `bash scripts/liga-chatwoot-evolution.sh`
   → mensagem de teste do celular do Luiz cai na inbox.
3. Teste na tela: contato de teste → Cadência comercial → 8 opções → escolher → salvar → apagar.

## Decisões

- 30/10/2026: slug `henriqueventura`; primeira entrega só Chatwoot + Evolution + campo,
  sem banco/n8n/IA (`docs/plano.md`); campo como lista de contato
  (`docs/decisoes/2026-10-30-cadencia-comercial.md`).

## Armadilhas

- O `rails runner` do Chatwoot escreve log (RubyLLM, Sidekiq) na saída padrão: os scripts
  filtram as linhas que interessam.
- `liga-chatwoot-evolution.sh` usa o token do bot (agente), como o GymTrack (inbox 16 da
  conta 16 nasceu assim). Se a inbox não aparecer, o script avisa: conferir o log da
  Evolution antes de qualquer outra coisa.
