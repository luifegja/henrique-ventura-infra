# Padrões de documentação

Herdado do CliniTrack, onde esse rigor provou seu valor: um ano depois, dava para
entender por que cada decisão foi tomada sem falar com quem a tomou. **A documentação
faz parte da entrega, não vem depois.**

A pergunta que todo artefato deste repositório precisa responder é: _"daqui a seis
meses, alguém — inclusive uma sessão de IA sem memória — consegue entender isto sem
perguntar a ninguém?"_

---

## 1. Migrações SQL

Cada migração é **numerada, idempotente e nunca editada depois de aplicada**. Se algo
está errado, cria-se a próxima migração corrigindo.

### Estrutura obrigatória

```sql
-- ============================================================
-- 0NN — Título curto e direto
-- Referência à decisão que originou (documento, fase ou pergunta do grupo).
--
-- APLICAR COMO SUPERUSER.        <- só quando for o caso
--
-- O que muda:
--   1. tabela.coluna — para que serve, com o valor semântico de NULL.
--   2. nome_da_funcao() — o que faz e quais validações aplica.
--
-- Por que assim: o raciocínio de design. Alternativas descartadas e o motivo.
--   Esta seção é a mais importante do arquivo — o "o quê" se lê no SQL,
--   o "por quê" só existe aqui.
-- ============================================================

BEGIN;

-- 1. Primeiro bloco ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS exemplo (...);

COMMENT ON TABLE exemplo IS 'Uma frase dizendo o que a tabela representa.';
COMMENT ON COLUMN exemplo.campo IS 'O que guarda e o que significa vazio/NULL.';

COMMIT;
```

### Regras

- **`COMMENT ON`** em toda tabela e em toda coluna cujo significado não seja óbvio pelo
  nome. É documentação que viaja com o banco e sobrevive ao repositório.
- **Idempotência**: `IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `ON CONFLICT DO NOTHING`.
  A migração precisa poder rodar duas vezes sem estragar nada.
- **Invariantes em `CHECK`**, com comentário explicando a regra de negócio que a origina.
- **Transação explícita** (`BEGIN`/`COMMIT`), salvo quando o comando não puder rodar em
  transação — e aí o cabeçalho diz isso.
- **Funções `SECURITY DEFINER`**: explicar no cabeçalho por que precisam ser, e quem
  recebe `GRANT EXECUTE`.
- **Soft-fail em funções chamadas pelo n8n**: devolver `jsonb {ok:false, reason}` em vez
  de lançar exceção, para que o pipeline nunca quebre por regra de negócio.

---

## 2. Workflows do n8n

Todo workflow tem **dois arquivos**: o `n8n/exports/NN-nome.json` (o que roda) e o
`n8n/specs/NN-nome.md` (por que roda assim).

A spec descreve: propósito, gatilho, entradas e saídas, inventário de nós com o que cada
um faz, funções SQL chamadas, dependências de outros workflows, tratamento de erro e as
decisões de design. Quando o export divergir da spec, **a spec é atualizada no mesmo
commit** — divergência silenciosa entre os dois foi fonte real de perda de feature no
CliniTrack (ver `docs/contexto-inicial/analises/08`).

---

## 3. Prompts dos agentes

Prompts são código: vivem em `prompts/`, versionados, com comentário de cabeçalho
explicando o papel do agente, quais marcadores de saída ele pode emitir e o que cada um
dispara no banco. Mudança de prompt que altera o contrato de saída exige atualizar a
spec do workflow que o consome.

---

## 4. Runbooks

Um runbook responde "como eu faço X quando preciso", não "como funciona". Comandos
copiáveis, na ordem, com o resultado esperado. Se um passo exige decisão humana, o
runbook diz qual é o critério.

Todo runbook termina com uma seção de **diagnóstico rápido**: os comandos que respondem
"está tudo bem?" e "o que quebrou?".

---

## 5. STATUS.md

Atualizado **ao fim de toda sessão de trabalho**, com:

- o que ficou pronto (e como verificar);
- o que está em andamento e o que trava;
- decisões tomadas, com o motivo — em tabela, para consulta rápida;
- **armadilhas descobertas**: comportamento inesperado que custou tempo para diagnosticar.
  Esta seção é a que mais economiza horas no futuro.

---

## 6. Diário de bordo

`docs/diario-de-bordo.md` guarda o registro cronológico das sessões: o que foi feito, o
que quebrou no caminho e como foi resolvido. O `STATUS.md` responde "onde estamos"; o
diário responde "como chegamos aqui".

---

## 7. Decisões de arquitetura

Decisão que muda o rumo do sistema vira arquivo em `docs/decisoes/AAAA-MM-DD-assunto.md`
com: contexto, opções consideradas, escolha, motivo e consequências aceitas.

Regra prática: se alguém no futuro puder olhar o código e pensar _"por que fizeram
assim? é claramente pior"_, a decisão precisa de registro.

---

## 8. Comentários no código

Comentar **o porquê**, nunca o quê. `-- soma 1 ao contador` é ruído; `-- +1 porque a
posição no Kanban é 1-indexada para a recepção` é documentação.

Onde houver contorno de bug de terceiro, o comentário cita o comportamento que obriga o
contorno — como o `FORCE_SSL` desligado no `docker-compose.yml`, que registra a queda de
cabeçalhos com underscore pelo Caddy.
