# STATUS — Henrique Ventura

Documento vivo. Última atualização: **30/10/2026** (sessão 1: provisionamento + painel).

## Onde estamos

| Frente | Estado |
|---|---|
| Repositório | ✅ `git@github.com:luifegja/henrique-ventura-infra.git` (origin, `main` em dia) |
| Servidor | ✅ `/opt/henriqueventura` (700) + `.env` (600, 5 variáveis) + `docker-compose.yml` + `backups/` |
| Chatwoot | ✅ conta **20** "Henrique Ventura" (locale pt_BR); Luiz (id 4) administrador; bot id 16 agente |
| Cadência comercial | ✅ atributo de contato `cadencia_comercial` (lista, definição 17): Lead → 1º contato → Qualificação → Agendamento → Reunião diagnóstico → Follow up → Contrato enviado → Pagamento |
| Evolution | ✅ instância `henriqueventura` (Baileys, sem Chatwoot ainda), estado `close`. A chave da instância só abre a nossa (401 nas outras, conferido) |
| Painel | ✅ `henriqueventura-web:0.1.0` healthy em `127.0.0.1:3600`. Telas Leads (quadro), Atendimentos (ler, responder, resolver, etapa) e WhatsApp (pareamento com freios + espera de 5 min + liga o Chatwoot). Login com usuário do Chatwoot. typecheck/lint verdes, Vitest 28/28, **bateria de ponta a ponta 23/23** (`scripts/teste-ponta-a-ponta.py`, tudo apagado no fim) |
| Domínio | ✅ **no ar em `https://henriqueventura.advotrack.com.br`** (30/10 15:35, com o "pode" do Luiz): bloco no fim do Caddyfile (backup `/opt/advotrack/caddy/Caddyfile.bak-20261030-153546-henriqueventura`), validado num Caddy descartável e no contêiner, reload sem reinício; Let's Encrypt até 28/01/2027; `/login` 200; vizinhos com os mesmos códigos de antes. ⛔ **avisar o Vítor** (espelho no repo do AdvoTrack) |
| WhatsApp | ⛔ não pareado — aguarda o número e alguém com o aparelho; pela tela WhatsApp do painel (ou `docs/runbooks/01-parear-whatsapp.md`) |
| Henrique no Chatwoot/painel | ✅ usuário 21 `henrique@henriqueventura.local` (provisório, a pedido do Luiz), **administrador só da conta 20** (conferido: nenhuma outra conta); senha entregue ao Luiz no chat, não gravada. ⛔ trocar pelo e-mail real quando vier |

## Próximos passos

1. Avisar o Vítor do bloco novo no Caddyfile (e de que `litoralindica.advotrack.com.br` já respondia 000 antes da mudança).
2. E-mail real do Henrique → trocar o e-mail do usuário 21 (o login muda; a senha continua).
3. Pareamento pela tela WhatsApp (Henrique com o celular na mão) → 5 min → o painel liga o
   Chatwoot e põe bot + administradores na inbox → mensagem do celular do Luiz cai em Atendimentos.

## Decisões

- 30/10/2026: slug `henriqueventura`; campo como lista de contato
  (`docs/decisoes/2026-10-30-cadencia-comercial.md`).
- 30/10/2026: painel sem banco, Chatwoot como fonte da verdade, login do Chatwoot, sem agentes
  de IA; responder pelo painel; contato sem etapa em Lead
  (`docs/decisoes/2026-10-30-painel-sem-banco.md`; plano em `docs/plano.md`).

## Armadilhas

- O `rails runner` do Chatwoot escreve log (RubyLLM, Sidekiq) na saída padrão: os scripts
  filtram as linhas que interessam.
- `liga-chatwoot-evolution.sh` usa o token do bot (agente), como o GymTrack (inbox 16 da
  conta 16 nasceu assim). Se a inbox não aparecer, o script avisa: conferir o log da
  Evolution antes de qualquer outra coisa.
- O `access_token` só vem no `POST /auth/sign_in` se a conta tiver `api_and_webhooks` ligado (a
  20 tem). Se um dia sumir, o login do painel responde "O Chatwoot não liberou o acesso por API".
- Para agente, `GET /contacts` do Chatwoot repetiu um contato (bateria de 30/10); o cliente
  deduplica por id.
- O primeiro `docker build` do painel falhou uma vez sem erro claro (provável download das fontes
  do Google no `next build`); o seguinte passou. Se repetir: `docker build --progress=plain`.
- `isVisible()` do Playwright não espera; a bateria usa `waitFor` (helper `ve`).
- Estado do pareamento é memória do processo: reiniciar o contêiner zera as tentativas do dia.
