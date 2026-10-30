# Painel sem banco: o Chatwoot é a fonte da verdade, e o login é o do Chatwoot

- **Data:** 30/10/2026
- **Quem decidiu:** Luiz (escopo: kanban por etapa, atendimentos com resposta, parear o WhatsApp,
  sem agentes de IA; base do CliniTrack 2.0) — desenho técnico pelo Claude, aprovado no plano
  (`docs/plano.md`)
- **Estado:** em vigor

## Contexto

O Henrique precisa de três telas no começo: ver os leads num quadro pela cadência comercial,
acompanhar e responder os atendimentos, e parear o WhatsApp sem ninguém entrar no servidor. O
CliniTrack 2.0 tem as três, mas todas leem o banco dele (funis, conversas espelhadas pelo n8n,
estado do WhatsApp em `integrations`). Aqui não há n8n nem robô.

## Decisão

1. **Sem banco.** O quadro lê os contatos e a definição do atributo `cadencia_comercial` direto
   da API do Chatwoot; arrastar faz `PUT /contacts/{id}`. Atendimentos lê e responde pela API.
2. **Login = usuário do Chatwoot.** O painel chama `POST /auth/sign_in` pela rede interna, aceita
   só membros da conta 20 e guarda o `access_token` da pessoa no JWT cifrado do Auth.js. O token é
   lido só no servidor (`web/lib/session.ts`); a sessão que vai ao navegador não o leva.
3. **Toda chamada com o token de quem está logado.** A resposta sai com o nome do atendente; o
   que cada um vê e pode fazer é o que o Chatwoot permite (agente só vê caixas de que é membro;
   a tela WhatsApp exige administrador da conta).
4. **WhatsApp com a chave da instância.** `HENRIQUEVENTURA_EVOLUTION_INSTANCE_KEY` só abre a
   instância `henriqueventura` (outra instância responde 401, conferido). Os freios do CliniTrack
   (3 tentativas/24 h, 6 h depois de "conta restringida", uma pessoa por vez) ficam na memória do
   processo (`web/lib/whatsapp-gate.ts`); o fim do pareamento sem leitura é um temporizador no
   servidor (não há vigia no n8n). A espera de 5 min em `open` antes de ligar o Chatwoot vem do
   GymTrack.

## Por quê

- Um banco só para espelhar o Chatwoot traria sincronização (webhook, n8n) e duas verdades.
- Login próprio exigiria tabela de usuários e uma segunda senha; com o do Chatwoot, criar
  acesso é um passo só (`scripts/cria-usuario-chatwoot.sh`).

## Consequências aceitas

- **Contador de tentativas zera se o contêiner reiniciar.** Os 5 min de espera recomeçam sozinhos.
- **Quadro lê até 40 páginas de contatos (600)**, os de atividade mais recente; acima disso
  aparece um aviso. Se a base crescer, filtrar por etapa (`/contacts/filter`) ou ter banco.
- **Cada login abre uma sessão no Chatwoot** (ele guarda até 25 por usuário e descarta a mais
  antiga). Sair do painel não revoga o token da pessoa (é o mesmo token da tela de perfil do Chatwoot).
- **Usuário com verificação em duas etapas no Chatwoot** não entra no painel (mensagem clara).
- Para agente, a listagem de contatos do Chatwoot repetiu um contato no teste; o cliente
  deduplica por id.

## Emendas

- **30/10/2026, criar lead.** Pedido do Luiz: criar leads pelo painel, espelhados no Chatwoot.
  Sem banco, "espelhado" é criar o próprio contato no Chatwoot (`POST /contacts`) com o token de
  quem está logado: nome, WhatsApp em E.164 (o formato que a Evolution usa para casar o contato
  quando o lead escrever), e-mail opcional, `cadencia_comercial` com a etapa escolhida e a
  observação como nota (`POST /contacts/{id}/notes`). Antes de criar, busca pelo mesmo WhatsApp
  e, se houver, aponta o existente em vez de duplicar. Não abre conversa nem manda mensagem:
  isso depende do WhatsApp pareado e fica para quando o Luiz pedir.
