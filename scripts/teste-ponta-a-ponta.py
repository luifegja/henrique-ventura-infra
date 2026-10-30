#!/usr/bin/env python3
"""
Bateria de ponta a ponta do painel, com navegador de verdade (Playwright).

Prepara na conta 20 do Chatwoot, só com coisas marcadas "e2e":
  - dois usuários temporários: e2e-admin@henriqueventura.local (administrador) e
    e2e-agente@henriqueventura.local (agente), por scripts/cria-usuario-chatwoot.sh;
  - uma caixa de entrada de API "e2e-painel" (não é WhatsApp: nada sai para ninguém);
  - um contato "E2E Lead Teste" (+55 00 00000-0001) com uma conversa e uma mensagem.
Roda scripts/e2e/teste-painel.mjs no contêiner mcr.microsoft.com/playwright:v1.64.1-noble
contra o painel local (http://localhost:3600), confere pela API o que o navegador fez e
apaga tudo no fim, inclusive se falhar.

Uso (no servidor):  python3 -I scripts/teste-ponta-a-ponta.py
Capturas em OUT (padrão: /tmp/henriqueventura-e2e; nunca no repositório).
"""
import json
import os
import pathlib
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

AQUI = pathlib.Path(__file__).resolve().parent
ENVF = "/opt/henriqueventura/.env"
CW = "https://chat.advotrack.com.br"
BASE = os.environ.get("BASE", "http://localhost:3600")
OUT = os.environ.get("OUT", "/tmp/henriqueventura-e2e")
ADMIN = "e2e-admin@henriqueventura.local"
AGENTE = "e2e-agente@henriqueventura.local"
TELEFONE = "+5500000000001"


def env(nome):
    for linha in open(ENVF):
        if linha.startswith(nome + "="):
            return linha.split("=", 1)[1].strip()
    sys.exit(f"{nome} ausente em {ENVF}")


CONTA = env("CHATWOOT_ACCOUNT_ID")
assert CONTA == "20", "a bateria só roda na conta 20 (Henrique Ventura)"


def http(metodo, caminho, token=None, corpo=None):
    req = urllib.request.Request(CW + caminho, method=metodo, data=None if corpo is None else json.dumps(corpo).encode())
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Api-Access-Token", token)  # com hífen: o Caddy descarta cabeçalho com underscore
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            t = r.read().decode()
            return json.loads(t) if t else {}
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{metodo} {caminho} -> {e.code}: {e.read()[:200]!r}")


def api(metodo, caminho, token, corpo=None):
    return http(metodo, f"/api/v1/accounts/{CONTA}{caminho}", token, corpo)


def cria_usuario(nome, email, papel):
    p = subprocess.run(["bash", str(AQUI / "cria-usuario-chatwoot.sh"), nome, email, papel], capture_output=True, text=True, timeout=180)
    m = re.search(r"SENHA \(mostrada uma vez\): (\S+)", p.stdout)
    if not m:
        sys.exit(f"não consegui criar {email} (ele já existia?): {p.stdout[-300:]} {p.stderr[-300:]}")
    return m.group(1)


def apaga_usuarios():
    ruby = """
account = Account.find(ENV.fetch('CONTA'))
abort 'conta errada' unless account.name == 'Henrique Ventura'
User.where(email: ['%s', '%s']).find_each do |u|
  next unless u.email.start_with?('e2e-') && u.email.end_with?('@henriqueventura.local')
  u.destroy!
  puts "  usuário #{u.email} apagado"
end
""" % (ADMIN, AGENTE)
    p = subprocess.run(["docker", "exec", "-i", "-e", f"CONTA={CONTA}", "advotrack-chatwoot-web", "bundle", "exec", "rails", "runner", "-"],
                       input=ruby, capture_output=True, text=True, timeout=180)
    print("\n".join(l for l in p.stdout.splitlines() if l.startswith("  usuário")))


def limpa(token):
    if not token:
        return
    try:
        for c in api("GET", "/contacts/search?q=E2E", token).get("payload", []):
            if (c.get("name") or "").startswith("E2E "):
                api("DELETE", f"/contacts/{c['id']}", token)
                print(f"  contato {c['id']} apagado")
        for i in api("GET", "/inboxes", token).get("payload", []):
            if i.get("name") == "e2e-painel":
                api("DELETE", f"/inboxes/{i['id']}", token)
                print(f"  caixa {i['id']} apagada")
    except Exception as e:  # noqa: BLE001
        print(f"  limpeza parcial: {e}")


resultados = []


def confere(caso, ok, detalhe=""):
    resultados.append((caso, bool(ok), detalhe))
    print(("  ok   " if ok else "  FALHOU ") + caso + (f" — {detalhe}" if detalhe and not ok else ""))


apaga_usuarios()  # sobra de rodada anterior
token = None
rc = 1
try:
    senha_admin = cria_usuario("E2E Admin", ADMIN, "administrator")
    senha_agente = cria_usuario("E2E Agente", AGENTE, "agent")
    login = http("POST", "/auth/sign_in", corpo={"email": ADMIN, "password": senha_admin})
    token = login["data"]["access_token"]
    admin_id = login["data"]["id"]
    agente_id = http("POST", "/auth/sign_in", corpo={"email": AGENTE, "password": senha_agente})["data"]["id"]
    limpa(token)

    inbox = api("POST", "/inboxes", token, {"name": "e2e-painel", "channel": {"type": "api", "webhook_url": ""}})
    api("POST", "/inbox_members", token, {"inbox_id": inbox["id"], "user_ids": [admin_id, agente_id]})
    contato = api("POST", "/contacts", token, {"name": "E2E Lead Teste", "phone_number": TELEFONE, "inbox_id": inbox["id"]})["payload"]
    cid = contato["contact"]["id"]
    source = contato["contact_inbox"]["source_id"]
    conv = api("POST", "/conversations", token, {"source_id": source, "inbox_id": inbox["id"], "contact_id": cid})
    api("POST", f"/conversations/{conv['id']}/messages", token, {"content": "Olá, quero saber da reunião de diagnóstico.", "message_type": "incoming"})
    print(f"== preparado: caixa {inbox['id']}, contato {cid}, conversa {conv['id']}")

    pathlib.Path(OUT).mkdir(parents=True, exist_ok=True)
    for f in pathlib.Path(OUT).glob("*"):
        f.unlink()
    e = {"BASE": BASE, "OUT": "/out", "ADMIN_EMAIL": ADMIN, "ADMIN_PW": senha_admin, "AGENTE_EMAIL": AGENTE, "AGENTE_PW": senha_agente,
         "CONTATO_ID": str(cid), "CONV_ID": str(conv["id"])}
    cmd = ["docker", "run", "--rm", "--name", "henriqueventura-e2e", "--network", "host", "--ipc=host", "--user", f"{os.getuid()}:{os.getgid()}",
           "-e", "HOME=/tmp", "-e", "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1", "-e", "npm_config_update_notifier=false",
           "-v", f"{AQUI / 'e2e'}:/e2e:ro", "-v", f"{OUT}:/out"]
    for k in e:
        cmd += ["-e", k]  # valores pelo ambiente herdado, não pela linha de comando
    cmd += ["mcr.microsoft.com/playwright:v1.64.1-noble", "sh", "-c",
            "mkdir -p /tmp/pw && cd /tmp/pw && npm init -y >/dev/null && npm i --silent --no-audit --no-fund playwright@1.64.1 "
            "&& cp /e2e/teste-painel.mjs . && node teste-painel.mjs"]
    print("== navegador")
    p = subprocess.run(cmd, env={**os.environ, **e}, text=True, capture_output=True, timeout=900)
    if p.returncode != 0:
        print(p.stdout[-1500:], p.stderr[-1500:])
    for r in json.loads((pathlib.Path(OUT) / "resultados.json").read_text()):
        confere("navegador: " + r["caso"], r["ok"], r.get("detalhe", ""))

    print("== conferindo no Chatwoot")
    time.sleep(2)
    c = api("GET", f"/contacts/{cid}", token)["payload"]
    confere("etapa gravada no contato = Agendamento", c.get("custom_attributes", {}).get("cadencia_comercial") == "Agendamento",
            str(c.get("custom_attributes")))
    msgs = api("GET", f"/conversations/{conv['id']}/messages", token)["payload"]
    saida = [m for m in msgs if m.get("message_type") == 1 and "Resposta E2E pelo painel" in (m.get("content") or "")]
    confere("resposta do painel chegou ao Chatwoot", len(saida) == 1, f"{len(saida)} mensagens")
    confere("resposta saiu com o nome do atendente", bool(saida) and (saida[0].get("sender") or {}).get("name") == "E2E Agente",
            str(saida[0].get("sender") if saida else None))
    st = api("GET", f"/conversations/{conv['id']}", token).get("status")
    confere("conversa resolvida pelo painel", st == "resolved", st)
    novos = [x for x in api("GET", "/contacts/search?q=E2E%20Lead%20Novo", token).get("payload", []) if x.get("name") == "E2E Lead Novo"]
    confere("lead novo existe no Chatwoot (uma vez)", len(novos) == 1, f"{len(novos)} contatos")
    if novos:
        n = novos[0]
        confere("lead novo com WhatsApp em E.164", n.get("phone_number") == "+5500000000002", n.get("phone_number"))
        confere("lead novo com e-mail", n.get("email") == "e2e-lead-novo@exemplo.com", n.get("email"))
        confere("lead novo com etapa Qualificação", (n.get("custom_attributes") or {}).get("cadencia_comercial") == "Qualificação", n.get("custom_attributes"))
        notas = api("GET", f"/contacts/{n['id']}/notes", token)
        notas = notas if isinstance(notas, list) else notas.get("payload", [])
        confere("observação virou nota no contato", any("Nota E2E: veio por indicação." in (x.get("content") or "") for x in notas), str(notas)[:200])
    dup = [x for x in api("GET", "/contacts/search?q=E2E%20Duplicado", token).get("payload", [])]
    confere("duplicado não foi criado no Chatwoot", len(dup) == 0, f"{len(dup)}")
    rc = 0 if all(ok for _, ok, _ in resultados) else 1
finally:
    print("== limpeza")
    limpa(token)
    apaga_usuarios()

total = len(resultados)
print(f"== {sum(1 for _, ok, _ in resultados if ok)}/{total} {'VERDE' if rc == 0 else 'VERMELHO'} (capturas em {OUT})")
sys.exit(rc)
