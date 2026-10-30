# Bloco do Caddy para o painel do Henrique Ventura

O Caddy é compartilhado (`advotrack-caddy`, arquivo `/opt/advotrack/caddy/Caddyfile`, do root).
O bloco só entra com o **"pode aplicar" do Luiz no momento**, com backup, `validate` e `reload`,
e o Vítor é avisado (o espelho em `infra/caddy/Caddyfile` do repositório do AdvoTrack é dele).

DNS: `henriqueventura.advotrack.com.br A 167.233.131.109`, criado pelo Luiz no Registro.br em
30/10/2026 (resolvendo no mesmo dia).

## Bloco (fim do Caddyfile; nenhum outro bloco é tocado)

```caddyfile
# Henrique Ventura — painel (conteiner henriqueventura-web, compose /opt/henriqueventura).
# Chamar sempre pelo container_name: o alias `web` e compartilhado por varios projetos.
henriqueventura.advotrack.com.br {
	encode zstd gzip
	reverse_proxy henriqueventura-web:3000 {
		header_up X-Forwarded-Proto https
	}
}
```

## Como aplicar (roteiro do EnglishGrade, docs/runbooks/00-infra.md de lá)

```bash
S=<pasta de trabalho>; F=/opt/advotrack/caddy/Caddyfile; IMG=$(docker inspect advotrack-caddy --format '{{.Config.Image}}')
# 1. a configuração em execução é a do arquivo? (se não, há mudança alheia pendente: pare)
docker exec advotrack-caddy wget -qO- http://127.0.0.1:2019/config/ > $S/rodando.json
sudo cat $F > $S/atual.caddy
docker run --rm --network none -v $S/atual.caddy:/etc/caddy/Caddyfile:ro $IMG caddy adapt --config /etc/caddy/Caddyfile --adapter caddyfile > $S/atual.json
python3 -c "import json;print(json.load(open('$S/rodando.json'))==json.load(open('$S/atual.json')))"   # True
# 2. candidato = atual + bloco; validar num Caddy descartável, sem rede
cat $S/atual.caddy $S/bloco.caddy > $S/candidato.caddy
docker run --rm --network none -v $S/candidato.caddy:/etc/caddy/Caddyfile:ro $IMG caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
# 3. backup e escrita que preserva o inode (bind mount de arquivo único: nada de sed -i)
sudo cp -a $F $F.bak-$(date +%Y%m%d-%H%M%S)-henriqueventura
sudo tee -a $F < $S/bloco.caddy > /dev/null
docker exec advotrack-caddy cat /etc/caddy/Caddyfile | cmp - $S/candidato.caddy
docker exec advotrack-caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker exec advotrack-caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
curl -s -o /dev/null -w '%{http_code}\n' https://henriqueventura.advotrack.com.br/login     # 200
for d in app n8n chat imobtrack gymtrack lp clinitrack englishgrade; do printf '%s ' $d; curl -s -o /dev/null -w '%{http_code}\n' https://$d.advotrack.com.br/; done   # iguais a antes
```

Voltar atrás: `sudo cat <backup> | sudo tee $F > /dev/null` e o mesmo `validate` + `reload`.
