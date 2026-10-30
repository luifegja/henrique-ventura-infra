# CLAUDE.md — Henrique Ventura

Contexto e regras para sessões de IA neste repositório. Leia inteiro antes de agir;
depois leia `STATUS.md`. Antes de qualquer comando no servidor, leia também
`~/handoff/handoff-servidor.md` e `docs/handoff-projeto-irmao.md` (§1: regras de
convivência, não negociáveis).

## O que é

Atendimento comercial do **Henrique Ventura** por WhatsApp, feito por pessoas (sem agentes
de IA): o número dele ligado à Evolution, as conversas caindo numa conta própria do Chatwoot,
cada contato marcado com a etapa da **cadência comercial** (atributo `cadencia_comercial`), e
um **painel** em `https://henriqueventura.advotrack.com.br` com três telas: Leads (quadro por
etapa), Atendimentos (ler e responder) e WhatsApp (parear pelo QR). Sem banco e sem n8n:
o Chatwoot é a fonte da verdade (`docs/decisoes/2026-10-30-painel-sem-banco.md`).

## Infraestrutura compartilhada

Roda no `advotrack-prod`, **ao lado de clientes em produção** (AdvoTrack, Garcia,
ImobTrack, Litoral Indica, GymTrack, EnglishGrade…). Resumo das regras:

- **Só é nosso**: `~/projetos/henriqueventura`, `/opt/henriqueventura`, o contêiner
  `henriqueventura-web`, a instância `henriqueventura` da Evolution, a conta 20 "Henrique
  Ventura" do Chatwoot e o usuário `bot@henriqueventura.local`. Todo o resto é só leitura.
- **CliniTrack 2.0, GymTrack e EnglishGrade são referência de código**: ler e copiar de lá
  para cá; nunca editar, commitar ou rodar scripts deles.
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
| Painel | contêiner `henriqueventura-web`, imagem `henriqueventura-web:0.1.0`, `127.0.0.1:3600` → `https://henriqueventura.advotrack.com.br` |
| Compose | `infra/docker-compose.yml` (`name: henriqueventura`, rede externa `advotrack`), copiado para `/opt/henriqueventura/` por `scripts/implanta-web.sh` |
| Variáveis do `.env` | `CHATWOOT_ACCOUNT_ID`, `CHATWOOT_BOT_USER_ID`, `CHATWOOT_BOT_TOKEN`, `HENRIQUEVENTURA_EVOLUTION_INSTANCE_KEY`, `HENRIQUEVENTURA_WEB_AUTH_SECRET` |

## Scripts (todos rodam no servidor e são idempotentes)

| Script | Faz |
|---|---|
| `scripts/cria-conta-chatwoot.sh` | conta, Luiz admin, bot agente; grava ids e token no `.env` |
| `scripts/cria-usuario-chatwoot.sh "Nome" email [administrator\|agent]` | atendente humano na conta 20 |
| `scripts/cria-atributos-chatwoot.sh` | cria/atualiza os atributos de contato (lista `ATRIBUTOS` no próprio script) |
| `scripts/cria-instancia-evolution.sh` | instância sem QR e sem Chatwoot; grava a chave da instância |
| `scripts/liga-chatwoot-evolution.sh [desligar]` | integração Chatwoot na instância (só com `open` estável) + membros da inbox — alternativa manual à tela WhatsApp |
| `scripts/implanta-web.sh` | build da imagem a partir do repositório e troca só do contêiner `henriqueventura-web` |
| `python3 -I scripts/teste-ponta-a-ponta.py` | bateria no navegador (Playwright): cria usuários/caixa/lead `e2e`, testa as três telas, confere no Chatwoot e apaga tudo |

## Painel (`web/`)

Next.js 15 + Auth.js v5 (Credentials) + Tailwind; base copiada do CliniTrack 2.0 sem banco e
sem multi-cliente. Peças que não se negociam:

- **Login é o do Chatwoot** (`lib/chatwoot-api.ts` → `signInChatwoot`); só membros da conta 20.
  O token do Chatwoot da pessoa fica no JWT e é lido **só no servidor** (`lib/session.ts`);
  o callback `session` não o expõe ao navegador.
- **Toda chamada ao Chatwoot usa o token de quem está logado** (nunca o do bot), pela rede
  interna `http://chatwoot-web:3000`. O token do bot só liga a integração da Evolution.
- **Etapas = valores da definição do atributo** (lidos na hora); sem etapa → Lead
  (`lib/cadencia.ts`, testado).
- **WhatsApp**: chave da instância, freios em `lib/whatsapp-gate.ts` (testado), estado em memória
  (`lib/whatsapp.ts`), coreografia em `app/(app)/whatsapp/actions.ts` (decidir pelo estado VIVO;
  QR lido → nunca chamar `connect` de novo; 3 min sem leitura → `logout` por temporizador; 5 min
  em `open` → liga o Chatwoot e põe bot + administradores na inbox).
- Server Actions devolvem `ActionResult` e nunca lançam para o cliente.
- Sem node no host: checagens em contêiner descartável:

  ```bash
  cd ~/projetos/henriqueventura/web && docker run --rm --name henriqueventura-build -u 1000:1000 -e HOME=/tmp \
    -v "$PWD":/app -w /app node:22.23.4-alpine sh -c "npm ci && npm run typecheck && npm run lint && npm test"
  ```

## Convenções

- Documentação em português do Brasil; padrões em `docs/padroes-de-documentacao.md`.
- Decisões em `docs/decisoes/AAAA-MM-DD-assunto.md`; mudança na lista da cadência = decisão nova.
- Commits em português, uma linha, sem `feat:`/`fix:`; nunca `--force`.
- Herdados do AdvoTrack que já valem aqui: o bot é identificado por `sender.id`, nunca por
  marcador no texto; `POST /labels` do Chatwoot sobrescreve (GET → merge → POST); API do
  Chatwoot de dentro da rede (`http://chatwoot-web:3000`), porque o Caddy descarta
  cabeçalhos com underscore.
