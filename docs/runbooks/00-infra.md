# Runbook — infraestrutura e operação do dia a dia

Como opero o `henriqueventura` no servidor compartilhado `advotrack-prod`. O porquê de cada
regra está em `docs/handoff-projeto-irmao.md` e `~/handoff/handoff-servidor.md`.

## Onde está cada coisa

| Coisa | Onde |
|---|---|
| Código | `~/projetos/henriqueventura` |
| Segredos | `/opt/henriqueventura/.env` (600): `CHATWOOT_ACCOUNT_ID`, `CHATWOOT_BOT_USER_ID`, `CHATWOOT_BOT_TOKEN`, `HENRIQUEVENTURA_EVOLUTION_INSTANCE_KEY` |
| Chatwoot | https://chat.advotrack.com.br, conta 20 |
| Evolution | `http://127.0.0.1:8080`, instância `henriqueventura` |

## Teste de fumaça (início de toda sessão)

```bash
hostname                                                   # advotrack-prod
docker ps --format '{{.Names}}' | grep -c '^advotrack-'    # 9
docker exec advotrack-postgres pg_isready -U postgres      # accepting connections
curl -s -o /dev/null -w '%{http_code}\n' https://chat.advotrack.com.br          # 200
K=$(grep '^HENRIQUEVENTURA_EVOLUTION_INSTANCE_KEY=' /opt/henriqueventura/.env | cut -d= -f2-)
curl -s -H "apikey: $K" http://127.0.0.1:8080/instance/connectionState/henriqueventura
git -C ~/referencia/sistema-atendimento-advotrack status --short | wc -l        # anote (90 em 30/10)
free -h; df -h /
```

## Provisionamento (feito em 30/10/2026; refazer só se algo sumir)

```bash
sudo mkdir -p /opt/henriqueventura && sudo chown luiz:luiz /opt/henriqueventura && chmod 700 /opt/henriqueventura
touch /opt/henriqueventura/.env && chmod 600 /opt/henriqueventura/.env
cd ~/projetos/henriqueventura
bash scripts/cria-conta-chatwoot.sh
bash scripts/cria-atributos-chatwoot.sh
bash scripts/cria-instancia-evolution.sh
bash scripts/cria-usuario-chatwoot.sh "Henrique Ventura" <e-mail>      # senha aparece uma vez
# depois do pareamento (runbook 01):
bash scripts/liga-chatwoot-evolution.sh
```

## "Estou atrapalhando os vizinhos?" (fim de toda sessão)

```bash
docker ps --format '{{.Names}} {{.Status}}' | grep '^advotrack-'      # 9 linhas Up, nenhuma Restarting
git -C ~/referencia/sistema-atendimento-advotrack status --short | wc -l   # igual ao início
API=$(sudo grep '^EVOLUTION_API_KEY=' /opt/advotrack/.env | cut -d= -f2- | grep . | tail -n1)
curl -s -H "apikey: $API" http://127.0.0.1:8080/instance/fetchInstances \
  | python3 -c "import sys,json; print(sorted((i['name'],i['connectionStatus']) for i in json.load(sys.stdin)))"   # vizinhos iguais ao início
free -h
```

Mudou e não foi você → avise o Luiz na hora, com comando e saída. Nunca "restaure" nada
dos outros por conta própria.
