# Handoff — usar a infraestrutura do AdvoTrack em um projeto irmão

> **Para o Claude Code que está lendo isto:** este arquivo é o seu manual de acesso à
> infraestrutura compartilhada com o AdvoTrack. Leia-o inteiro antes de executar qualquer
> comando. A seção 0 diz o que fazer na primeira sessão e quais perguntas fazer ao Luiz.
> Quem define **o que** o projeto novo faz é o Luiz; este documento só diz **onde** e
> **como** você trabalha sem atrapalhar o que já está no ar.

Escrito em 14/09/2026 pelo Vítor (com o Claude da sessão do AdvoTrack). Vale para qualquer
projeto que vá rodar no servidor `advotrack-prod` ao lado do AdvoTrack. Os segredos
**não** estão aqui nem em cópia nenhuma: vivem em `/opt/advotrack/.env` (permissão 600) e
você os lê de lá quando precisar (com `sudo`). O pacote `CREDENCIAIS.md`, que o Vítor
envia ao Luiz por canal seguro e o Luiz guarda em `~/handoff/CREDENCIAIS.md` (permissão
600) no servidor, traz a chave SSH, o mapa de qual variável serve para quê e o
inventário do que já existe.

---

## 0. Primeira sessão: o que fazer ao ler este arquivo

Faça nesta ordem. Não crie nada antes do passo 4.

1. **Descubra onde você está rodando.** `hostname` deve responder `advotrack-prod`
   (Modo A, o recomendado, §2.1). Se não responder isso, você está na máquina do Luiz
   (Modo B, §2.2) e precisa da chave SSH do pacote de credenciais.
2. **Leia as regras de convivência (§1) e memorize as auto-verificações (§1.4).** Elas
   existem porque este servidor atende clientes reais por WhatsApp, em produção, agora.
3. **Rode o teste de fumaça (§2.3).** Se algo falhar, pare e diga ao Luiz o que falhou.
   Não tente "consertar" a infraestrutura: ela não é sua.
4. **Pergunte ao Luiz, numa mensagem só, numerada:**
   1. Nome do projeto e o **slug** (minúsculas, sem espaço nem acento, ex.: `xpto`). O slug
      vira prefixo de tudo: pasta, banco, papel do Postgres, instância da Evolution, conta
      do Chatwoot, nome dos workflows, repositório. Sem slug, nada é criado.
   2. Em que modo ele quer trabalhar: no servidor pelo VS Code Remote-SSH (Modo A) ou na
      máquina dele com túneis (Modo B).
   3. GitHub: nome do repositório, se é na conta `luifegja`, se quer espelho na conta do
      Vítor (`VitorAf0nso`) e um **token (PAT)** temporário para você criar o repositório e
      registrar a chave de deploy (§5). O token é usado na sessão e descartado; nunca vai
      para disco.
   4. WhatsApp: qual número vai ser pareado, se é pessoal ou business, quem está com o
      aparelho na mão e quando pode parear (pareamento exige uma pessoa ao telefone, §4.6).
   5. Chatwoot: precisa de caixa de entrada humana? Quem vai atender? E-mail e nome para o
      login dele (a senha você gera e entrega).
   6. LLM: chave própria (preferível) ou a chave da casa (`OPENAI_API_KEY` do `.env` do
      AdvoTrack)? Qual modelo?
   7. Precisa de painel web ou de qualquer coisa com domínio próprio? Se sim, isso passa
      pelo Caddy e pelo DNS, que só o Vítor mexe (§4.8): peça já para ele avisar o Vítor.
   8. O que o robô faz: público, funil, gatilhos, horário, tom. **Não assuma nada do
      AdvoTrack.** O AdvoTrack é referência de engenharia (§6), não de produto.
5. Com as respostas 1 a 3 em mãos, monte o esqueleto do projeto (§6.1), crie o banco (§4.3)
   e o repositório (§5). Só depois avance para Chatwoot, Evolution e n8n, na ordem do §4.
6. Ao fim de **toda** sessão: atualize o `STATUS.md` do projeto novo, faça commit e push
   (§5.4). Documentação faz parte da entrega, não vem depois.

---

## 1. Regras de convivência (não negociáveis)

O servidor `advotrack-prod` hospeda, em produção, o atendimento por WhatsApp do escritório
WFSA Advogados (AdvoTrack) **e** o de um segundo cliente, a Garcia Imóveis (projeto
ImobTrack: banco `garcia`, contas 4 e 5 do Chatwoot, instâncias próprias na Evolution,
workflows `… - Garcia` e `[LAB] … - Ana` no n8n), além do código de outros projetos do
Vítor. Um `docker compose down` no lugar errado tira o WhatsApp de dois clientes do ar.
O inventário atual está no §3 de `CREDENCIAIS.md`. Por isso:

### 1.1 O que é somente leitura para você

| Caminho / recurso | Regra |
|---|---|
| `/opt/advotrack/` (stack do AdvoTrack) | **Nunca edite, crie ou apague nada aqui.** Ler é permitido. |
| `~/referencia/sistema-atendimento-advotrack/` (cópia do repositório do AdvoTrack) | **Leitura para inspiração.** Nunca edite, nunca `git add/commit/push`. O `git status --short` de lá tem de continuar como você encontrou. |
| `/root/` (home do Vítor, com os outros projetos) e `/home/` de outros usuários | Não é seu. Não use `sudo` para entrar lá, mesmo que consiga. |
| `/opt/advotrack/.env` | `sudo grep '^NOME=' /opt/advotrack/.env \| cut -d= -f2-` para ler **uma** variável quando precisar. Nunca `cat` inteiro no chat, nunca copie para arquivo. |
| Contêineres `advotrack-*` | Nunca `stop`, `restart`, `rm`, `kill`, `exec` que altere estado. `docker logs` e `docker exec … psql` **somente leitura** são permitidos (§4.3). |
| Bancos `advotrack`, `chatwoot`, `n8n`, `evolution`, `garcia` | Nunca `INSERT/UPDATE/DELETE/ALTER/DROP`. Leitura só em sessão `read only` (§4.3.2). |
| Conta 3 do Chatwoot (WFSA), inboxes 1 e 5, usuário-bot id 3, webhooks da conta 3 | Não toque. Sua conta é outra (§4.5). |
| Contas 2 (IA Soluções), 4 e 5 (Garcia) do Chatwoot; banco `garcia` | Idem: são de outros projetos. Não toque. |
| Instâncias da Evolution que não tenham o seu slug | Nunca `logout`, `delete`, `restart`, `connect`, `chatwoot/set`. Consultar (`GET`) é permitido. |
| Workflows do n8n sem o seu prefixo (`advotrack - …`, `… - Garcia`, `[LAB] … - Ana`) | Nunca abra para editar, ative, desative, execute ou apague. Ler o JSON no repositório é o caminho para se inspirar. |
| Credenciais do n8n `advotrack-db`, `chatwoot-wfsa-bot…`, `OpenAI Luiz e Vitor` | Não use nos seus workflows. Crie as suas, com o seu slug no nome (§4.4). |

### 1.2 O que é proibido em qualquer circunstância

- `docker compose down|stop|restart|rm` fora de `/opt/<slug>` ou sem `-p <slug>`.
- `docker system prune`, `docker volume rm`, `docker volume prune`, `docker network rm advotrack`, `docker image rm` de imagem que não seja sua.
- `apt upgrade`, `apt remove`, `reboot`, `shutdown`, `systemctl restart docker`.
- Qualquer alteração em UFW, iptables, `DOCKER-USER`, fail2ban, `sshd_config`, Caddy (`/opt/advotrack/caddy/Caddyfile`) ou DNS. Isso é do Vítor (§4.8).
- Publicar porta de contêiner em `0.0.0.0` ou em 80/443. **Só `127.0.0.1:` ou nenhuma porta.** O Docker fura o UFW; a proteção `DOCKER-USER` só cobre 80/443.
- Reusar as portas 5432, 6379, 8080 do host.
- Imagem `:latest` em qualquer contêiner. Versão fixada sempre.
- Copiar segredo do AdvoTrack para o repositório do projeto novo, para chat, para issue, para o `STATUS.md`. Segredo vive em `/opt/<slug>/.env` (600) e nas credenciais do n8n.
- Commitar `CREDENCIAIS.md`, `.env`, chaves SSH, `node_modules/`, `__pycache__/`.
- `git push --force` em qualquer repositório.
- Enviar mensagem de WhatsApp para número que não seja do Luiz/Vítor durante testes. Leads reais da WFSA nunca.
- Rodar `scripts/*.sh` ou `scripts/*.py` do AdvoTrack. Eles agem na produção da WFSA. Copie a ideia, não execute.

### 1.3 Recursos compartilhados: seja leve

A máquina tem 8 vCPU / 16 GB. O AdvoTrack usa ~3 GB. Antes de subir um contêiner novo,
`free -h` e `df -h /`. Não suba Postgres, Redis, n8n, Chatwoot ou Evolution próprios: use
os existentes (§4). Se o Luiz quiser instâncias separadas, a resposta certa é outro
servidor, não outra cópia aqui.

### 1.4 Auto-verificações antes de cada comando de risco

Faça mentalmente (ou com `pwd`/`echo`) antes de executar:

- `docker compose …` → estou em `/opt/<slug>` **e** o arquivo tem `name: <slug>`?
- `docker stop|restart|rm|exec` → o nome do contêiner começa com `<slug>-`?
- `psql` → tem `-d <slug>` e `-U <slug>`? Se for outro banco, a sessão é `read only`?
- `curl …/instance/…` na Evolution → o nome da instância é o meu slug?
- Chamada à API do n8n que escreve (`POST/PUT/PATCH/DELETE`) → o workflow tem nome com o meu prefixo?
- `git …` → `git rev-parse --show-toplevel` aponta para `/home/luiz/projetos/<slug>`?
- Vou escrever em arquivo → o caminho começa com `/home/luiz/projetos/<slug>` ou `/opt/<slug>`?
- `sudo …` → é para ler uma variável do `.env` ou criar `/opt/<slug>`? Qualquer outro uso: pare.

Se qualquer resposta for "não", pare e pergunte ao Luiz.

---

## 2. Como trabalhar

### 2.1 Modo A (recomendado): no servidor, via VS Code Remote-SSH

É exatamente como o Vítor trabalha no AdvoTrack. Tudo é local: `docker`, `psql` por
`docker exec`, Evolution em `127.0.0.1:8080`, n8n e Chatwoot pela URL pública. Nenhum
túnel, nenhum `scp`.

No computador do Luiz, uma vez:

```bash
# 1. salve a chave privada do pacote de credenciais em ~/.ssh/id_ed25519_advotrack_luiz  (chmod 600)
# 2. acrescente ao ~/.ssh/config:
Host advotrack-prod
  HostName 167.233.131.109
  User luiz
  IdentityFile ~/.ssh/id_ed25519_advotrack_luiz
  IdentitiesOnly yes
# 3. teste
ssh advotrack-prod hostname        # → advotrack-prod
```

Depois: VS Code → Remote-SSH → `advotrack-prod` → abrir a pasta `~/projetos/<slug>`
(`/home/luiz/projetos/<slug>`) → Claude Code na extensão.

O usuário `luiz` é só do Luiz: home, `~/.claude/` (login, memória, configurações) e
`~/.ssh/` próprios. Ele está no grupo `docker` (todo comando `docker` funciona sem
`sudo`) e tem `sudo` sem senha, para ler `/opt/advotrack/.env` e criar `/opt/<slug>`.
O Vítor trabalha como `root`; vocês não dividem nada além do servidor.

O repositório do AdvoTrack, para inspiração, está copiado em
`~/referencia/sistema-atendimento-advotrack/` (instantâneo que o Vítor atualiza quando
regenera o pacote). É leitura: nunca edite, nunca faça push de lá.

### 2.2 Modo B: na máquina do Luiz, com túneis

Só se o Luiz preferir. Postgres e Evolution não têm porta pública, então:

```bash
ssh -f -N -L 5433:127.0.0.1:5432 -L 8080:127.0.0.1:8080 advotrack-prod
# Postgres:   psql "postgres://<slug>:<senha>@127.0.0.1:5433/<slug>"
# Evolution:  http://127.0.0.1:8080  (Manager em http://localhost:8080/manager/ — a barra final é obrigatória)
# n8n:        https://n8n.advotrack.com.br  (UI e API)
# Chatwoot:   https://chat.advotrack.com.br
```

Comandos que precisam de `docker exec` (criar conta no Chatwoot, ler logs) rodam por
`ssh advotrack-prod '…'`. Os scripts do AdvoTrack mostram o padrão: detectam se
`/opt/advotrack/.env` existe e, se não, prefixam tudo com `ssh` (ver
`scripts/publica-prompts.sh` linhas 60-66).

### 2.3 Teste de fumaça (rode na primeira sessão e sempre que algo parecer estranho)

```bash
hostname                                                        # advotrack-prod
docker ps --format '{{.Names}}' | grep -c '^advotrack-'         # 8
docker exec advotrack-postgres pg_isready -U postgres           # accepting connections
curl -s -o /dev/null -w '%{http_code}\n' https://n8n.advotrack.com.br/healthz     # 200
curl -s -o /dev/null -w '%{http_code}\n' https://chat.advotrack.com.br            # 200
EVOLUTION_API_KEY=$(sudo grep '^EVOLUTION_API_KEY=' /opt/advotrack/.env | cut -d= -f2- | grep . | tail -n1)        # não imprima
ADVOTRACK_N8N_API_KEY=$(sudo grep '^ADVOTRACK_N8N_API_KEY=' /opt/advotrack/.env | cut -d= -f2- | grep . | tail -n1)
curl -s -H "apikey: $EVOLUTION_API_KEY" http://127.0.0.1:8080/instance/fetchInstances | head -c 200; echo
curl -s -H "X-N8N-API-KEY: $ADVOTRACK_N8N_API_KEY" 'https://n8n.advotrack.com.br/api/v1/workflows?limit=1' | head -c 200; echo
docker ps >/dev/null && echo "docker ok"                        # grupo docker funcionando
git -C ~/referencia/sistema-atendimento-advotrack status --short | wc -l      # anote: tem de ser igual no fim da sessão
free -h; df -h /
```

---

## 3. Mapa da infraestrutura

Servidor `advotrack-prod`: Hetzner CX43, Falkenstein, Ubuntu 26.04, IP `167.233.131.109`.
Docker 29.7 + Compose v5.4. Stack em `/opt/advotrack` (compose project `advotrack`, rede
Docker `advotrack`). Tudo versionado em `infra/` do repositório do AdvoTrack.

| Serviço | Contêiner | Interno (rede `advotrack`) | No host | Público |
|---|---|---|---|---|
| PostgreSQL 17 + pgvector | `advotrack-postgres` | `postgres:5432` | `127.0.0.1:5432` | não |
| Redis 7 | `advotrack-redis` | `redis:6379` | `127.0.0.1:6379` | não |
| n8n 2.34.6 | `advotrack-n8n` | `n8n:5678` | — | https://n8n.advotrack.com.br |
| Chatwoot 4.16.2 | `advotrack-chatwoot-web` / `-worker` | `chatwoot-web:3000` | — | https://chat.advotrack.com.br |
| Evolution API 2.4.0-rc2 (+ctxfix) | `advotrack-evolution` | `evolution:8080` | `127.0.0.1:8080` | não |
| Painel AdvoTrack (Next.js) | `advotrack-web` | `web:3000` | — | https://app.advotrack.com.br |
| Caddy 2.11 (TLS) | `advotrack-caddy` | — | 80/443 | sim |

Três camadas de firewall (Hetzner Cloud Firewall, UFW, `DOCKER-USER`): só 22/80/443
entram. Detalhes e diagnóstico em `docs/runbooks/00-infra.md` do AdvoTrack.

Onde cada segredo mora: `/opt/advotrack/.env` (600, do root). Você **lê** de lá quando
precisar (`sudo grep '^NOME=' /opt/advotrack/.env | cut -d= -f2- | grep . | tail -n1`) e nunca imprime o
valor no chat.
`CREDENCIAIS.md` é o mapa (variável → uso permitido), não uma cópia dos valores.

---

## 4. Como usar cada serviço no projeto novo

Ordem recomendada: pasta e `.env` → banco → repositório → Chatwoot → Evolution → n8n.

### 4.1 Pasta da stack e `.env`

```bash
SLUG=<slug>
sudo mkdir -p /opt/$SLUG && sudo chown luiz:luiz /opt/$SLUG && chmod 700 /opt/$SLUG
touch /opt/$SLUG/.env && chmod 600 /opt/$SLUG/.env
```

Se o projeto tiver contêineres próprios (um painel, por exemplo), o
`/opt/$SLUG/docker-compose.yml` deve:

```yaml
name: <slug>                      # compose project separado: `docker compose ps` aqui não vê o AdvoTrack
networks:
  advotrack:
    external: true                # entra na rede existente para falar com postgres/chatwoot-web/n8n pelo nome
services:
  api:
    image: minha/imagem:1.2.3     # versão fixada, nunca :latest
    container_name: <slug>-api
    networks: [advotrack]
    ports:
      - "127.0.0.1:3100:3000"     # só loopback; porta livre (confira com ss -tlnp)
```

Fonte de verdade é o repositório (`infra/`), espelhado em `/opt/<slug>` por `cp`/`scp`.
Nunca edite direto em `/opt`.

### 4.2 Docker

```bash
cd /opt/<slug> && docker compose ps            # só o seu projeto
docker compose -p <slug> logs -f api
docker logs --tail 200 advotrack-n8n           # ler logs do AdvoTrack é permitido
```

### 4.3 PostgreSQL

Um Postgres, um banco por sistema, cada um com usuário e senha próprios (`advotrack`,
`chatwoot`, `n8n`, `evolution`, `garcia`). O seu é o sexto. Dentro do contêiner, o socket local
é `trust`: `docker exec … psql -U postgres` não pede senha. Fora dele, sempre pede.

#### 4.3.1 Criar o banco do projeto (uma vez)

```bash
SLUG=<slug>; PW=$(openssl rand -hex 24)
docker exec -i advotrack-postgres psql -U postgres -v ON_ERROR_STOP=1 <<SQL
CREATE ROLE ${SLUG} LOGIN PASSWORD '${PW}';
CREATE DATABASE ${SLUG} OWNER ${SLUG};
SQL
docker exec -i advotrack-postgres psql -U postgres -d $SLUG -v ON_ERROR_STOP=1 \
  -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto;' -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
printf '%s_DB_PASSWORD=%s\n' "${SLUG^^}" "$PW" >> /opt/$SLUG/.env
```

Daí em diante: `docker exec -i advotrack-postgres psql -U <slug> -d <slug>` (servidor) ou
`postgres://<slug>:<senha>@postgres:5432/<slug>` (de dentro da rede `advotrack`, é isso
que vai na credencial do n8n). O superusuário `postgres` só nesse bootstrap.

Migrações: numeradas, idempotentes, nunca editadas depois de aplicadas, com o cabeçalho
do `docs/padroes-de-documentacao.md` do AdvoTrack. Como aplicar e registrar: copie o
esquema de `db/README.md` e a tabela `schema_migrations` da migração 001.

#### 4.3.2 Olhar o banco do AdvoTrack para se inspirar (somente leitura)

O esquema inteiro está em `db/migrations/*.sql` e explicado em `docs/data-model.md`:
prefira ler os arquivos. Se precisar ver dado vivo (ex.: como um evento fica gravado):

```bash
docker exec -i advotrack-postgres psql -U advotrack -d advotrack \
  -c "SET default_transaction_read_only = on;" \
  -c "SELECT event_type, count(*) FROM system_events GROUP BY 1 ORDER BY 2 DESC LIMIT 20;"
```

O `SET … read_only` no início de **toda** sessão é obrigatório. Tabelas de dados têm RLS:
para ver linhas, `SELECT set_config('app.current_client_id', get_client_by_chatwoot_inbox('1')::text, false);`
(inbox 1 = WFSA produção, 5 = sandbox de testes). Dados de leads são de clientes reais:
não copie conteúdo de conversa para documentos nem para o chat.

### 4.4 n8n

- UI: https://n8n.advotrack.com.br. O Luiz já tem o login (é o mesmo do Vítor, o dono
  da instância). Com ele, gere uma chave de API própria em Settings → n8n API, com o
  slug no rótulo, para não depender da chave do AdvoTrack.
- API pública: `https://n8n.advotrack.com.br/api/v1`, cabeçalho `X-N8N-API-KEY`. A chave
  em `ADVOTRACK_N8N_API_KEY` do `.env` do AdvoTrack funciona; melhor ainda é o Luiz
  gerar a própria (Settings → n8n API) e guardar em
  `/opt/<slug>/.env` como `<SLUG>_N8N_API_KEY`.
- **A chave da API enxerga todos os workflows.** Por isso o seu importador tem de filtrar
  por prefixo, como o do AdvoTrack (`scripts/importa-workflows-n8n.py`: "nunca toca em
  workflow que não seja `advotrack - *`"). Nome dos seus: `<slug> - NN - descrição`.
- Credenciais do n8n: crie `<slug>-db` (Postgres: host `postgres`, banco/usuário `<slug>`,
  porta 5432, sem SSL), `<slug>-chatwoot-bot` (Header Auth `api_access_token`) e a sua de
  LLM. Nunca as do AdvoTrack.
- Error workflow: crie o seu (`<slug> - ERR - erro do n8n`). Não aponte para o do AdvoTrack.
- Webhooks: o caminho é global na instância. Use `<slug>-…` (ex.:
  `https://n8n.advotrack.com.br/webhook/<slug>-ingest-message`). O Chatwoot entrega por
  dentro da rede: `http://n8n:5678/webhook/<slug>-ingest-message`.
- Padrão que vale copiar: os exports JSON são **gerados** de Python (`n8n/build/n8nlib.py`
  + `wfNN.py` → `gera_exports.py`) e importados pela API; a spec `.md` de cada workflow é
  atualizada no mesmo commit. Ler `n8n/specs/README.md` primeiro.
- Diagnóstico sem abrir a UI: `scripts/n8n-execucao.py` (copie e troque o filtro de nome).
- Versão 2.34.6 com task runners: no Code node não existe Luxon; use `Intl.DateTimeFormat`
  com `America/Sao_Paulo`.

### 4.5 Chatwoot

Uma instalação, várias contas isoladas. A WFSA é a conta 3; a Garcia, 4 e 5; a 2 ("IA
Soluções") é a da empresa. **Crie a sua** pelo console do Rails (não precisa de super admin):

```bash
docker exec -i advotrack-chatwoot-web bundle exec rails runner - <<'RUBY'
slug = '<slug>'; nome_conta = '<Nome do cliente>'
email_luiz = '<email do Luiz>'; nome_luiz = 'Luiz'
senha_luiz = SecureRandom.base58(16); senha_bot = SecureRandom.base58(24)

account = Account.find_by(name: nome_conta) || Account.create!(name: nome_conta)
luiz = User.find_by(email: email_luiz) ||
       User.create!(name: nome_luiz, email: email_luiz, password: senha_luiz, confirmed_at: Time.current)
AccountUser.find_or_create_by!(account: account, user: luiz) { |au| au.role = :administrator }
bot = User.find_by(email: "bot@#{slug}.local") ||
      User.create!(name: "Bot #{slug}", email: "bot@#{slug}.local", password: senha_bot, confirmed_at: Time.current)
AccountUser.find_or_create_by!(account: account, user: bot) { |au| au.role = :agent }

puts "CHATWOOT_ACCOUNT_ID=#{account.id}"
puts "CHATWOOT_BOT_USER_ID=#{bot.id}"
puts "CHATWOOT_BOT_TOKEN=#{bot.access_token.token}"
puts "LOGIN_LUIZ=#{email_luiz} senha=#{luiz.persisted? && luiz.created_at > 1.minute.ago ? senha_luiz : '(já existia, senha inalterada)'}"
RUBY
```

Grave `CHATWOOT_ACCOUNT_ID`, `CHATWOOT_BOT_USER_ID` e `CHATWOOT_BOT_TOKEN` em
`/opt/<slug>/.env`. A senha do Luiz vai para ele por canal seguro, não para arquivo.

Regras herdadas que continuam valendo:

- A inbox de WhatsApp é criada **pela Evolution** (integração nativa, §4.6), não à mão.
- O usuário-bot precisa ser membro da inbox para mandar mensagem e mexer em labels.
- `POST /labels` sobrescreve a lista inteira: sempre GET → merge → POST.
- Identifique a mensagem do próprio bot pelo `sender.id` no eco do webhook, nunca por
  marcador no texto.
- Webhook da conta para o n8n: `account.webhooks.create!(name:, url: 'http://n8n:5678/webhook/<slug>-…', subscriptions: ['message_created'])`
  via rails runner. Guarde o `secret` retornado e valide a assinatura no workflow
  (o WF-01 do AdvoTrack mostra como; migração 026).
- A instalação já tem `SAFE_FETCH_ALLOW_PRIVATE_NETWORK=true` e `FORCE_SSL=false`, os
  dois contornos sem os quais webhook interno e integração com a Evolution não funcionam
  (comentários no `infra/docker-compose.yml`). Não peça para mudar.
- API do Chatwoot de dentro da rede: `http://chatwoot-web:3000/api/v1/accounts/<id>/…`
  com cabeçalho `api_access_token`. Pela URL pública o Caddy descarta cabeçalhos com
  underscore e você recebe 401.

### 4.6 Evolution API (WhatsApp)

Uma Evolution, várias instâncias. A chave global `EVOLUTION_API_KEY` abre todas — por
isso a regra do §1.1 sobre instâncias alheias. Ao criar a sua, a resposta traz um
`hash` (apikey **da instância**): guarde em `/opt/<slug>/.env` e use ele no dia a dia.

```bash
API=$(sudo grep '^EVOLUTION_API_KEY=' /opt/advotrack/.env | cut -d= -f2- | grep . | tail -n1)      # não imprimir
curl -s -X POST -H "apikey: $API" -H 'Content-Type: application/json' \
  -d '{"instanceName":"<slug>","integration":"WHATSAPP-BAILEYS","qrcode":false}' \
  http://127.0.0.1:8080/instance/create
curl -s -H "apikey: $API" http://127.0.0.1:8080/instance/connectionState/<slug>
```

**Pareamento**: siga `docs/runbooks/01-parear-whatsapp.md` do AdvoTrack à risca. Regra de
ouro de lá: parear com a integração do Chatwoot **desligada**, confirmar estável, só
então ligar. O WhatsApp pune tentativas em excesso com horas de bloqueio.

Ligar a integração com o Chatwoot depois de estável (a inbox aparece sozinha na sua
conta; `GET /chatwoot/find/<instância-da-wfsa>` mostra, somente leitura, o formato que
funciona hoje):

```bash
curl -s -X POST -H "apikey: $API" -H 'Content-Type: application/json' -d '{
  "enabled": true, "accountId": "<CHATWOOT_ACCOUNT_ID>", "token": "<CHATWOOT_BOT_TOKEN>",
  "url": "<mesma url que a instância da WFSA usa>", "nameInbox": "<slug>",
  "signMsg": false, "reopenConversation": true, "conversationPending": false,
  "importContacts": false, "importMessages": false, "autoCreate": true,
  "organization": "<Nome do cliente>", "logo": ""}' \
  http://127.0.0.1:8080/chatwoot/set/<slug>
```

A build instalada é `2.4.0-rc2` com o patch de `contextInfo` (citações, menções e
referral de anúncio chegam no webhook). Decisão em `docs/decisoes/2026-09-14-evolution-contextinfo.md`.
Logs: `docker logs -f --since 1m advotrack-evolution 2>&1 | grep -viE deviceListMetadata`.

### 4.7 Redis

`redis://:<REDIS_PASSWORD>@redis:6379/<n>`. Os índices 0 (Chatwoot) e 1 (Evolution)
estão em uso. Se precisar, use outro índice e prefixe as chaves com o slug. Senha em
`REDIS_PASSWORD` do `.env` do AdvoTrack.

### 4.8 Caddy, DNS e portas públicas: só o Vítor

Domínio novo (`xpto.advotrack.com.br` ou outro), site novo no Caddy, porta pública,
firewall: você **escreve a mudança proposta** (o bloco do `Caddyfile`, o registro DNS) e
o Luiz manda para o Vítor aplicar. Enquanto isso, tudo que precisa de URL pública usa o
que já existe (n8n e Chatwoot).

### 4.9 LLM

Se o Luiz usar a chave da casa (OpenAI, `OPENAI_API_KEY` no `.env` do AdvoTrack), ela vira
uma credencial **nova** no n8n com o seu slug no nome; nunca reutilize a credencial
`OpenAI Luiz e Vitor`. Armadilhas registradas em
`docs/decisoes/2026-09-08-troca-dos-modelos-da-openai.md` (nomes de modelo que não
existem, `max_tokens` × modelos de raciocínio, nó Agent sem raciocínio).

---

## 5. GitHub

Não há `gh` nem token do GitHub gravado no servidor. O padrão do Vítor é **uma chave de
deploy por repositório**, com um alias no `~/.ssh/config`; os remotes ficam
`git@gh-<sigla>-origin:conta/repo.git` (veja `git -C ~/referencia/sistema-atendimento-advotrack remote -v`).

O Vítor também vai trabalhar neste repositório, com o próprio clone em `/root/projetos/<slug>`.
Por isso o Luiz o adiciona como colaborador no GitHub (Settings → Collaborators →
`VitorAf0nso`) e, quando ele mandar a chave pública dele, você a registra como segunda
deploy key (mesmo comando do §5.1, outro `title`). Sincronização entre os dois é sempre
pelo GitHub: `git pull` antes de começar, `git push` ao terminar.

### 5.1 Criar o repositório e a chave (com o PAT do Luiz, na sessão)

```bash
SLUG=<slug>; REPO=<nome-do-repo>; CONTA=luifegja
read -rs GH_PAT   # o Luiz cola o token; nunca vai para arquivo nem para o chat

ssh-keygen -q -t ed25519 -N '' -C "deploy $SLUG @ advotrack-prod" -f ~/.ssh/id_ed25519_gh_$SLUG

cat >> ~/.ssh/config <<EOF

Host gh-$SLUG-origin
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_gh_$SLUG
  IdentitiesOnly yes
EOF

curl -s -H "Authorization: Bearer $GH_PAT" -H "Accept: application/vnd.github+json" \
  https://api.github.com/user/repos -d "{\"name\":\"$REPO\",\"private\":true,\"auto_init\":false}" | head -c 300
curl -s -H "Authorization: Bearer $GH_PAT" -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/$CONTA/$REPO/keys \
  -d "{\"title\":\"advotrack-prod ($SLUG)\",\"key\":\"$(cat ~/.ssh/id_ed25519_gh_$SLUG.pub)\",\"read_only\":false}" | head -c 300
unset GH_PAT

mkdir -p ~/projetos/$SLUG && cd ~/projetos/$SLUG && git init -b main
git remote add origin git@gh-$SLUG-origin:$CONTA/$REPO.git
ssh -T git@gh-$SLUG-origin 2>&1 | head -1       # "Hi $CONTA/$REPO! You've successfully authenticated…"
```

Se o Luiz não quiser dar PAT: ele cria o repositório no site, e você entrega a chave
pública (`cat ~/.ssh/id_ed25519_gh_$SLUG.pub`) para ele colar em Settings → Deploy keys
com *Allow write access*.

### 5.2 Espelho na conta do Vítor (se combinado)

Os projetos compartilhados têm `origin` na conta do Luiz e um remote `espelho` na conta
do Vítor. Se o Luiz quiser o mesmo, o Vítor cria o repositório espelho e registra a
mesma chave pública lá; você adiciona `Host gh-$SLUG-espelho` no `~/.ssh/config` e
`git remote add espelho git@gh-$SLUG-espelho:VitorAf0nso/$REPO.git`. A cada push:
`git push origin main && git push espelho --all`.

### 5.3 Identidade dos commits

```bash
git config --global user.name "<nome do Luiz>"; git config --global user.email "<email do Luiz>"   # o usuário luiz é só seu
```

### 5.4 Estilo

- Mensagens em português, uma linha de resumo no imperativo/substantivo, sem prefixo
  `feat:`/`fix:` (ex.: `Sandbox no ar (inbox 5) + espelha-prompts-sandbox.sh`). Corpo só
  quando o porquê não cabe no título.
- Commits pequenos e frequentes; `STATUS.md` atualizado no último commit da sessão.
- `.gitignore` desde o primeiro commit: `.env*`, `!.env.example`, `node_modules/`,
  `__pycache__/`, `*.pyc`, `CREDENCIAIS*`, `*.pem`, `id_ed25519*`.
- Nunca `--force`, nunca reescrever histórico já enviado.
- Push ao fim de cada sessão: `git push origin main` (e `espelho`, se existir).

---

## 6. Estrutura do projeto novo

### 6.1 Esqueleto (o mesmo do AdvoTrack, que provou funcionar)

```
~/projetos/<slug>/          (= /home/luiz/projetos/<slug>/ ; o clone do Vítor fica em /root/projetos/<slug>/)
├── CLAUDE.md                     # contexto para sessões de IA: o que é, regras, infra, vocabulário
├── README.md                     # para humanos: o que é, como rodar, onde está cada coisa
├── STATUS.md                     # documento vivo: onde estamos, pronto, em andamento, decisões, armadilhas
├── db/
│   ├── README.md                 # como aplicar e conferir migrações
│   ├── migrations/               # 001_…sql numeradas, idempotentes, com cabeçalho-padrão
│   ├── seeds/                    # dados iniciais do cliente (nunca segredo)
│   └── tests/                    # baterias SQL em transação revertida
├── n8n/
│   ├── build/                    # wfNN.py + n8nlib.py + gera_exports.py → gera os exports
│   ├── exports/                  # NN-nome.json (o que roda) — gerado, nunca editado à mão
│   └── specs/                    # NN-nome.md (por que roda assim) + README.md (mapa e runbook)
├── prompts/                      # prompts são código: versionados, com cabeçalho explicando papel e marcadores
├── scripts/                      # importa-workflows, publica-prompts, diagnóstico… sempre filtrando pelo slug
├── infra/                        # docker-compose.yml do projeto (se houver contêiner próprio), espelhado em /opt/<slug>
└── docs/
    ├── padroes-de-documentacao.md   # copie o do AdvoTrack tal como está
    ├── data-model.md
    ├── diario-de-bordo.md           # cronológico: o que foi feito, o que quebrou, como resolveu
    ├── decisoes/AAAA-MM-DD-assunto.md
    ├── runbooks/NN-assunto.md       # "como faço X", comandos copiáveis, termina em diagnóstico rápido
    └── handoff-*.md                 # estado + armadilhas + próximos passos ao encerrar uma frente
```

Copie de `~/referencia/sistema-atendimento-advotrack/` estes arquivos como ponto de
partida (e adapte): `docs/padroes-de-documentacao.md` (inteiro), o cabeçalho de qualquer
migração, `n8n/specs/README.md` (estrutura), `db/README.md` (estrutura), `.gitignore`.

### 6.2 `CLAUDE.md` do projeto novo: o que precisa ter

1. Uma frase do que é o sistema e para quem.
2. **Infra compartilhada com o AdvoTrack: ler `docs/handoff-projeto-irmao.md`** (copie este
   arquivo para lá) e as regras do §1 resumidas.
3. Slug, nomes reais (banco, conta do Chatwoot, instância, prefixo dos workflows, portas).
4. Arquitetura em uma frase e as decisões que não se negociam.
5. Convenções técnicas herdadas (§7).
6. Como rodar/deployar (comandos).

---

## 7. O que ler no AdvoTrack para se inspirar (e o que cada coisa ensina)

Caminhos relativos a `~/referencia/sistema-atendimento-advotrack/`. Leia na ordem; é
meio dia de leitura e economiza semanas.

| Leia | Aprende |
|---|---|
| `CLAUDE.md`, `STATUS.md` | Como o projeto se apresenta a uma sessão de IA; o que é "documento vivo" |
| `docs/padroes-de-documentacao.md` | Os padrões que você vai copiar tal como estão |
| `n8n/specs/README.md` | Mapa dos workflows, quem chama quem, credenciais, runbook de importação, diagnóstico |
| `n8n/specs/01-…` → `10-…` → `02-…` → `03-…` → `11-…` → `07-…` → `ERR-…` | Ingestão com assinatura, trava + debounce + buffer de mensagens, triagem, especialista com roteiro em blocos, envio "picotado" em bolhas com espera, follow-up com cron e claim, tratamento de erro |
| `n8n/build/n8nlib.py`, `wf10.py`, `gera_exports.py` | Gerar JSON de workflow a partir de Python: nós, conexões, credenciais por placeholder, `pairedItem`, `executeOnce` |
| `scripts/importa-workflows-n8n.py`, `n8n-execucao.py` | Importar/atualizar pela API filtrando por prefixo; inspecionar execução nó a nó |
| `db/migrations/011`–`013`, `012`, `015`, `017`, `030`–`037`, `025` | Barramento de eventos, ingestão do webhook, trava/buffer da IA, contexto do agente, motor de recuperação/follow-up, publicação de versão de prompt |
| `docs/data-model.md` | O modelo como um todo e as dívidas corrigidas no port |
| `prompts/*.md`, `prompts/kb/` | Prompt com cabeçalho documental, marcadores de saída, base de conhecimento separada |
| `docs/decisoes/` | Por que cada coisa é como é: queda de sessão da Evolution, relógio do Chatwoot, feedback do cliente em baterias, modelos da OpenAI |
| `docs/runbooks/00-infra.md`, `01-parear-whatsapp.md` | Operação e pareamento sem derrubar a sessão |
| `infra/docker-compose.yml` (os comentários) | Todo contorno de bug de terceiro que já foi pago |
| `docs/handoff-*.md` | Como se escreve um handoff que uma sessão sem memória consegue retomar |

Não portados no AdvoTrack (e talvez também não no seu): agenda (WF-04/06), event bus
externo (08), dry-run (12).

---

## 8. Convenções técnicas herdadas (custaram caro; herde de graça)

- Portas de contêiner: sempre `127.0.0.1` ou rede interna. O Docker fura o UFW.
- Chatwoot `POST /labels` sobrescreve: GET → merge → POST. Nenhuma Automation Rule nativa toca labels.
- Code node do n8n em modo all-items: `.item` colapsa para o item 0. `pairedItem` explícito sempre (foi a causa de um vazamento entre clientes no CliniTrack).
- `executeOnce: true` em nós depois de Postgres com múltiplos statements (evita fan-out).
- `queryReplacement` sempre como array literal.
- Datas em pt-BR com `Intl.DateTimeFormat` e `America/Sao_Paulo` (sem Luxon no Code node).
- Bot identificado por `sender.id`, nunca por marcador na mensagem.
- Regra de negócio nunca vira exceção no n8n: função SQL devolve `{ok:false, reason}`; execução vermelha é bug.
- Prompt entra no banco só por função de publicação versionada, nunca por seed/migração.
- Segredo cifrado na aplicação, não no Postgres (o Postgres loga parâmetros).
- Chatwoot grava `NOW()` em `timestamp without time zone`: o banco `chatwoot` está com `timezone = 'UTC'`; não "corrija".
- Sincronização pós-pareamento da Evolution abre centenas de conexões: `ulimits.nofile` alto já está no compose compartilhado.

---

## 9. "Estou atrapalhando o AdvoTrack?" (rode ao fim de cada sessão)

```bash
docker ps --format '{{.Names}} {{.Status}}' | grep '^advotrack-'                  # 8 linhas, todas Up, nenhuma "Restarting"
git -C ~/referencia/sistema-atendimento-advotrack status --short | wc -l           # igual ao do início
docker exec -i advotrack-postgres psql -U advotrack -d advotrack -At \
  -c "SET default_transaction_read_only = on;" \
  -c "SELECT count(*) FROM system_events WHERE event_type LIKE 'n8n.error%' AND created_at > now() - interval '2 hours';"   # 0, ou igual ao de antes
curl -s -H "X-N8N-API-KEY: $ADVOTRACK_N8N_API_KEY" 'https://n8n.advotrack.com.br/api/v1/workflows?limit=100' \
  | python3 -c "import sys,json; print(sorted((w['name'],w['active']) for w in json.load(sys.stdin)['data'] if w['name'].startswith('advotrack')))"   # mesmos nomes e estados de antes
free -h
```

Se algo mudou e não foi você: diga ao Luiz na hora, com o comando e a saída, para ele
avisar o Vítor. Se foi você: desfaça o que for seu e avise do mesmo jeito. Nunca tente
"restaurar" algo do AdvoTrack por conta própria.

---

## 10. Quando envolver o Vítor

- Domínio, Caddy, DNS, firewall, porta pública (§4.8).
- Usuário no n8n para o Luiz.
- Repositório espelho na conta dele (§5.2).
- Qualquer coisa que exija `docker compose` em `/opt/advotrack` (por exemplo, subir a versão de um serviço compartilhado).
- Qualquer sinal de que o AdvoTrack mudou de comportamento durante a sua sessão (§9).
- Rotação da chave SSH `luiz-claude-code` e de qualquer segredo do `.env` do AdvoTrack que o projeto novo tenha usado, ao fim do trabalho.
