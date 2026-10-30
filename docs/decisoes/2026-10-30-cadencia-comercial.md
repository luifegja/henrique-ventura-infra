# Cadência comercial como atributo de contato (lista) no Chatwoot

- **Data:** 30/10/2026
- **Quem decidiu:** Luiz
- **Estado:** em vigor

## Contexto

O Henrique precisa ver, em cada contato, em que ponto da jornada de atendimento o lead
está ("4️⃣ Cadência comercial" na lista de necessidades dele). O Chatwoot não tem funil
nativo; o primeiro passo do projeto é só Chatwoot + Evolution, sem banco nem n8n.

## Decisão

Atributo personalizado de **contato**, tipo **lista**, na conta 20:

| Campo | Valor |
|---|---|
| chave | `cadencia_comercial` |
| nome | Cadência comercial |
| descrição | Etapa do lead na cadência comercial (jornada de atendimento). |
| valores (nesta ordem) | Lead · 1º contato · Qualificação · Agendamento · Reunião diagnóstico · Follow up · Contrato enviado · Pagamento |

Criado por `scripts/cria-atributos-chatwoot.sh` (definição id 17 no Chatwoot).

## Por quê

- **Lista, não texto:** vira menu na ficha do contato (sem erro de digitação) e filtro na
  lista de contatos ("todos em Reunião diagnóstico").
- **Contato, não conversa:** a etapa é do lead e sobrevive a conversas novas.
- **Não etiquetas (labels):** etiqueta permite várias ao mesmo tempo; a etapa é uma só.

## Consequências

- Mudar a lista: editar `ATRIBUTOS` no script e rodar de novo, com decisão nova aqui.
  **Renomear** um valor não altera os contatos que já têm o nome antigo.
- Se um dia houver automação (n8n/robô), ela grava em `custom_attributes.cadencia_comercial`
  com exatamente estes textos (o Chatwoot faz merge no `PUT /contacts/{id}`).
