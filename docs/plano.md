# Henrique Ventura — painel web (kanban, atendimentos, WhatsApp)

## Contexto

O provisionamento de 30/10/2026 já está feito em `~/projetos/henriqueventura`, ainda sem
commit:
- conta **20** do Chatwoot (bot 16, Luiz administrador);
- atributo de contato `cadencia_comercial` (lista, definição 17, 8 etapas);
- instância `henriqueventura` na Evolution (`close`);
- scripts e documentação.

Agora o Luiz quer um painel em `https://henriqueventura.advotrack.com.br` (DNS `A` →
`167.233.131.109` criado por ele) com três telas: **kanban dos leads por etapa**,
**atendimentos** (ler e responder) e **parear o WhatsApp**. A base é a do CliniTrack 2.0, para
não começar do zero. **Sem agentes de IA**: o atendimento é humano. O repositório é
`luifegja/henrique-ventura-infra` (existe e está vazio).

## Decisões

- **Sem banco próprio. O Chatwoot é a fonte da verdade.** A etapa fica em
  `custom_attributes.cadencia_comercial` do contato; as conversas são as do Chatwoot.
- **Login com o usuário do Chatwoot** (mesmo e-mail e senha):
  - o painel chama `POST http://chatwoot-web:3000/auth/sign_in` e só aceita quem é membro da conta 20;
  - o `access_token` da pessoa fica na sessão JWT do Auth.js, que é cifrada;
  - todas as chamadas usam o token de quem está logado, então **a resposta sai com o nome
    certo** e as permissões são as do próprio Chatwoot;
  - não há senha nova nem tabela de usuários.
- **Kanban:**
  - 8 colunas, na ordem dos valores da definição 17, lidos da API (mudar a lista no script muda o kanban);
  - contato sem etapa aparece em **Lead**;
  - arrastar faz `PUT /contacts/{id}` com `custom_attributes` (o Chatwoot faz merge).
- **Responder pelo painel:** `POST /conversations/{id}/messages` com o token do atendente
  (sai no WhatsApp pela integração).
- **Tela do WhatsApp só para administradores da conta 20.** Usa a **chave da instância**
  (`HENRIQUEVENTURA_EVOLUTION_INSTANCE_KEY`), nunca a chave global.
- **Estado do pareamento em memória do processo:** tentativas (3 por dia), "QR lido" e
  início da estabilização. Se o contêiner reiniciar, o pior caso é refazer a verificação.
- **Nomes:**
  - contêiner `henriqueventura-web`, imagem `henriqueventura-web:0.1.0`;
  - porta `127.0.0.1:3600` (livre);
  - compose `name: henriqueventura`, rede externa `advotrack`.

## Isolamento (pedido do Luiz nesta sessão)

- **Outros projetos são só leitura.** CliniTrack 2.0, GymTrack e AdvoTrack: só `cat`, `cp`
  **de lá para cá** e `git log`. Nunca editar, commitar, rodar scripts ou mexer em contêineres
  deles. O `git status --short` de cada um tem de terminar igual ao do início (anotar no começo).
- **Escrita só em:**
  - `~/projetos/henriqueventura`;
  - `/opt/henriqueventura`;
  - contêiner `henriqueventura-web`;
  - conta 20 do Chatwoot;
  - instância `henriqueventura`.
- **Única exceção compartilhada: o Caddyfile do AdvoTrack** (passo 5), e só com o "pode
  aplicar" do Luiz no momento.

## O que reaproveitar

| Item | Origem | O que muda na cópia |
|---|---|---|
| `web/` (Next 15.5, Auth.js v5 beta.25, Tailwind 3.4, kit `components/ui/*`, `@dnd-kit`) | `~/projetos/sistema-atendimento-clinitrack-2.0` | sai `drizzle-orm`, `pg`, `openai`, `bcryptjs` |
| `web/Dockerfile` (node 22 alpine, standalone) | CliniTrack 2.0 | sai o placeholder `DATABASE_URL` |
| `next.config.mjs` | CliniTrack 2.0 | sai `serverExternalPackages` |
| Shell: `app/layout.tsx`, `app/(app)/layout.tsx`, `components/layout/{sidebar,nav,theme-toggle}.tsx`, `components/providers.tsx`, `tailwind.config.ts`, `app/globals.css`, `lib/utils.ts`, `lib/actions/result.ts` | CliniTrack 2.0 | sem seletor de clínica, banners com banco, modo técnico e marca CliniTrack; chaves `henriqueventura-theme` |
| Login: `lib/auth/auth.config.ts`, `app/(auth)/login/page.tsx`, `components/auth/login-form.tsx`, `middleware.ts` | CliniTrack 2.0 | `authorize()` passa a usar o `sign_in` do Chatwoot; JWT guarda `cwToken`, `cwUserId`, `role`; somem `clinics`, `activeClientId` e `/select-clinic` |
| Kanban: `components/funnels/kanban-board.tsx` | CliniTrack 2.0 | `BoardStep`/`BoardCard` alimentados pelo Chatwoot; `moveCard` vira server action com `PUT` |
| Conversa: `components/conversations/message-thread.tsx`; polling de `components/leads/live-thread.tsx` | CliniTrack 2.0 | — |
| Cliente Chatwoot `lib/chatwoot-api.ts` | CliniTrack 2.0 | `call()` ganha PUT; novas funções: `signIn`, `listContacts` (paginado), `updateContactAttrs`, `getAttributeDefinition`, `listConversations`, `listMessages`, `sendMessage`, `addInboxMembers` |
| Evolution: `lib/evolution-api.ts`, `lib/evolution-parse.ts` e testes | CliniTrack 2.0 | usa a chave da instância; texto do `deliveryCheck` |
| Pareamento: `app/(app)/whatsapp/actions.ts`, `components/whatsapp/connection-card.tsx` | CliniTrack 2.0 | mantém a correção da sessão dupla de 30/10: decidir pelo `connectionState` ao vivo, `qrLido` e um teste por vez |
| Estabilização de 5 min antes de ligar o Chatwoot | GymTrack `web/app/(app)/whatsapp/actions.ts` | estado em memória em vez de banco |
| Deploy: `scripts/implanta-web.sh`, `infra/docker-compose.yml`, `infra/caddy/bloco-clinitrack.md` | CliniTrack 2.0 | nomes, porta e variáveis deste projeto |

## Telas

1. **`/login`** — e-mail e senha do Chatwoot. Erro único "e-mail ou senha inválidos" e
   "sem acesso à conta Henrique Ventura".
2. **`/leads` (kanban, tela inicial)**
   - colunas da cadência, cada uma com a contagem;
   - cartão com nome, telefone e "última atividade"; o clique abre o atendimento mais recente;
   - busca por nome ou telefone;
   - arrastar grava com atualização otimista, toast e desfazer em caso de erro;
   - atualiza a cada 25 s.
3. **`/atendimentos`**
   - lista à esquerda: filtro abertas/pendentes/resolvidas, nome, prévia e etapa;
   - conversa à direita: histórico com polling de 4 s e caixa de resposta (Enter envia,
     Shift+Enter quebra linha);
   - seletor de etapa da cadência no cabeçalho;
   - botões "resolver/reabrir" e link "Abrir no Chatwoot".
4. **`/whatsapp`** (só administradores)
   - estados: desconectado → pareando (QR, 3 min, `logout` ao cancelar ou estourar o tempo)
     → estabilizando (teste de entrega para o número do Luiz e 5 min em `open`) → conectado;
   - ao conectar, liga a integração com o Chatwoot (`chatwoot/set` com o token do bot);
   - em seguida põe bot e administradores na inbox via `POST /inbox_members`, com o token do
     administrador logado;
   - botão "Desconectar" com confirmação.

## Passos

1. **Repositório:**
   - remote `origin git@github.com:luifegja/henrique-ventura-infra.git`;
   - primeiro commit com o que já existe; push.
2. **`web/`:**
   - copiar a base, cortar banco e multi-cliente, trocar a marca;
   - menu com Leads, Atendimentos e WhatsApp (este último só para administradores).
3. **Login pelo Chatwoot**, depois **kanban**, **atendimentos** e **WhatsApp**, cada um num commit.
4. **Infra:**
   - `infra/docker-compose.yml` com as variáveis: `AUTH_SECRET`, `AUTH_URL`,
     `AUTH_TRUST_HOST`, `CHATWOOT_INTERNAL_URL`, `CHATWOOT_PUBLIC_URL`, `CHATWOOT_ACCOUNT_ID`,
     `CHATWOOT_BOT_TOKEN`, `EVOLUTION_INTERNAL_URL`, `HENRIQUEVENTURA_EVOLUTION_INSTANCE_KEY`,
     `TESTE_ENTREGA_PARA`;
   - `AUTH_SECRET` novo no `.env`;
   - `scripts/implanta-web.sh` (build, `compose -p henriqueventura up -d --no-deps web`,
     esperar o healthcheck, `/login` responder 200).
5. **Caddy**, só com o "pode aplicar" do Luiz no momento:
   - conferir antes que o DNS resolve;
   - bloco `henriqueventura.advotrack.com.br` → `henriqueventura-web:3000`;
   - backup, `validate`, `reload`;
   - vizinhos continuam respondendo 200;
   - bloco documentado em `infra/caddy/` para o Vítor espelhar.
6. **Docs:** `CLAUDE.md`, `STATUS.md`, `README.md` (manual do atendente), runbook 00 (deploy) e
   runbook 01 (pareamento pela tela, com os scripts como alternativa); decisão
   `docs/decisoes/2026-10-30-painel-sem-banco.md`.
7. **Henrique:** acesso pelo `scripts/cria-usuario-chatwoot.sh` assim que o Luiz passar o e-mail.
   A mesma senha vale para o painel e para o Chatwoot.

Regras de sempre:
- disco do servidor em 85% (23 GB livres): imagem pequena, sem Playwright;
- nada fora do slug.

## Verificação

- `typecheck`, `lint`, `vitest` e `next build` no `node:22` alpine (o host não tem node).
  Testes de agrupamento do kanban (sem etapa vai para Lead, valor desconhecido também) e dos
  parsers da Evolution.
- Local (`127.0.0.1:3600`):
  - login do Luiz funciona; usuário sem a conta 20 é recusado;
  - contato de teste criado na conta 20 aparece em Lead, é arrastado para "Qualificação",
    e o Chatwoot mostra a mesma etapa na ficha;
  - contato apagado no fim.
- Atendimentos: conversa na inbox de API de teste da conta 20 (criada só para isso e apagada
  depois), resposta enviada pelo painel aparece no Chatwoot com o nome do Luiz. Ensaio real
  pelo WhatsApp só depois do pareamento, com o celular do Luiz.
- WhatsApp: a tela mostra "desconectado"; QR gerado só com o Henrique na linha. Cancelar faz
  `logout` e a instância volta a `close`.
- Público: `https://henriqueventura.advotrack.com.br/login` responde 200; vizinhos iguais a
  antes; checagem "estou atrapalhando os vizinhos?" (`docs/runbooks/00-infra.md`).
