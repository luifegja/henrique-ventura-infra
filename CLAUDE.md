# CLAUDE.md — Henrique Ventura

Contexto e regras para sessões de IA neste repositório. Leia inteiro antes de agir;
depois leia `STATUS.md`. Antes de qualquer comando no servidor, leia também
`~/handoff/handoff-servidor.md` e `docs/handoff-projeto-irmao.md` (§1: regras de
convivência, não negociáveis).

## O que é

Atendimento comercial do **Henrique Ventura** por WhatsApp: o número dele ligado à
Evolution, as conversas caindo numa conta própria do Chatwoot, e cada contato marcado com
a etapa da **cadência comercial** (atributo `cadencia_comercial`). Por enquanto sem banco,
sem n8n e sem robô de IA (decisão de 30/10/2026, `docs/plano.md`).

## Infraestrutura compartilhada

Roda no `advotrack-prod`, **ao lado de clientes em produção** (AdvoTrack, Garcia,
ImobTrack, Litoral Indica, GymTrack, EnglishGrade…). Resumo das regras:

- **Só é nosso**: `~/projetos/henriqueventura`, `/opt/henriqueventura`, a instância
  `henriqueventura` da Evolution, a conta 20 "Henrique Ventura" do Chatwoot e o usuário
  `bot@henriqueventura.local`. Todo o resto é só leitura.
- **Nunca**: `logout/delete/restart/connect/chatwoot/set` em instância sem o slug; mexer em
  outra conta do Chatwoot; `docker compose` fora de `/opt/henriqueventura`; `prune`,
  `volume rm`, `apt`, `reboot`; UFW, iptables, sshd, Caddy, DNS; copiar segredo de outro
  projeto; `git push --force`; WhatsApp de teste para número que não seja do Luiz/Vítor.
- **rails runner** no `advotrack-chatwoot-web`: só pelos scripts deste repositório, que
  conferem que a conta é a "Henrique Ventura" antes de escrever.
- **Segredos** em `/opt/henriqueventura/.env` (600). Ler uma variável sem imprimir:
  `grep '^NOME=' /opt/henriqueventura/.env | cut -d= -f2-`. Nunca em repositório, chat ou
  `STATUS.md`. Senhas de pessoas aparecem uma vez na tela e não são gravadas.
- **Pareamento do WhatsApp**: só por `docs/runbooks/01-parear-whatsapp.md` (Chatwoot
  desligado ao parear; cada tentativa custa).
- **Início e fim de sessão**: `docs/runbooks/00-infra.md` (teste de fumaça e "estou
  atrapalhando os vizinhos?"). Fim de sessão: `STATUS.md`, commit e push.

## Nomes reais

| Coisa | Nome |
|---|---|
| Slug | `henriqueventura` |
| Código | `/home/luiz/projetos/henriqueventura` |
| Repositório | `luifegja/henrique-ventura-infra` (privado) |
| Stack e segredos | `/opt/henriqueventura/` (700, dono `luiz`) e `.env` (600) |
| Chatwoot | conta **20** "Henrique Ventura"; bot id **16** (`bot@henriqueventura.local`, agente); Luiz (id 4) administrador |
| Atributo de contato | `cadencia_comercial` (lista) — `scripts/cria-atributos-chatwoot.sh` |
| Evolution | instância `henriqueventura` (Baileys); chave em `HENRIQUEVENTURA_EVOLUTION_INSTANCE_KEY` |
| Inbox WhatsApp | `henriqueventura`, criada pela Evolution ao ligar a integração (depois do pareamento) |
| Variáveis do `.env` | `CHATWOOT_ACCOUNT_ID`, `CHATWOOT_BOT_USER_ID`, `CHATWOOT_BOT_TOKEN`, `HENRIQUEVENTURA_EVOLUTION_INSTANCE_KEY` |

## Scripts (todos rodam no servidor e são idempotentes)

| Script | Faz |
|---|---|
| `scripts/cria-conta-chatwoot.sh` | conta, Luiz admin, bot agente; grava ids e token no `.env` |
| `scripts/cria-usuario-chatwoot.sh "Nome" email [administrator\|agent]` | atendente humano na conta 20 |
| `scripts/cria-atributos-chatwoot.sh` | cria/atualiza os atributos de contato (lista `ATRIBUTOS` no próprio script) |
| `scripts/cria-instancia-evolution.sh` | instância sem QR e sem Chatwoot; grava a chave da instância |
| `scripts/liga-chatwoot-evolution.sh [desligar]` | integração Chatwoot na instância (só com `open` estável) + membros da inbox |

## Convenções

- Documentação em português do Brasil; padrões em `docs/padroes-de-documentacao.md`.
- Decisões em `docs/decisoes/AAAA-MM-DD-assunto.md`; mudança na lista da cadência = decisão nova.
- Commits em português, uma linha, sem `feat:`/`fix:`; nunca `--force`.
- Herdados do AdvoTrack que já valem aqui: o bot é identificado por `sender.id`, nunca por
  marcador no texto; `POST /labels` do Chatwoot sobrescreve (GET → merge → POST); API do
  Chatwoot de dentro da rede (`http://chatwoot-web:3000`), porque o Caddy descarta
  cabeçalhos com underscore.
