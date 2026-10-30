# Henrique Ventura — atendimento comercial por WhatsApp

WhatsApp do Henrique Ventura ligado ao Chatwoot, com a etapa de cada lead marcada no
campo **Cadência comercial** da ficha do contato.

## Como usar (atendente)

Painel: **https://henriqueventura.advotrack.com.br**, com o **mesmo e-mail e senha do
Chatwoot**.

- **Leads** — um quadro com as etapas da cadência (Lead, 1º contato, Qualificação,
  Agendamento, Reunião diagnóstico, Follow up, Contrato enviado, Pagamento). Arraste o cartão
  para mudar a etapa; contato novo aparece em Lead. Clique no nome para abrir a conversa.
  **Novo lead** (botão no alto) cria o contato direto no Chatwoot: nome, WhatsApp, e-mail
  (opcional), etapa e observação (vira nota no contato). WhatsApp que já é de outro lead não é
  duplicado: a tela mostra quem é.
- **Atendimentos** — conversas do WhatsApp (abertas, pendentes, resolvidas). Responda na caixa
  de baixo (Enter envia; a mensagem sai com o seu nome), troque a etapa no alto, resolva ou
  reabra, ou abra no Chatwoot.
- **WhatsApp** (só administradores) — estado do número e o botão **Conectar** (QR). Peça o QR
  só com o celular já em *Aparelhos conectados → Conectar um aparelho*. Depois de conectar, o
  painel espera 5 minutos e liga o Chatwoot sozinho; deixe a tela aberta.

Tudo também funciona direto no Chatwoot (https://chat.advotrack.com.br, conta **Henrique
Ventura**): a etapa fica em **Atributos do contato → Cadência comercial**, e **Contatos →
Filtrar** lista os leads de uma etapa.

## Onde está cada coisa

- `CLAUDE.md` — contexto, regras do servidor compartilhado, nomes reais.
- `STATUS.md` — onde estamos e o que falta.
- `web/` — o painel (Next.js); `infra/` — compose e bloco do Caddy.
- `scripts/` — provisionamento (conta, usuários, atributos, instância, integração), implantação
  e a bateria de ponta a ponta.
- `docs/runbooks/` — infraestrutura (00) e pareamento do WhatsApp (01).
- `docs/decisoes/` — por que cada coisa é como é.
- `docs/plano.md` — plano aprovado em 30/10/2026.
