# One History

Fichas, campanhas e mesa virtual para o sistema de RPG One History: contas com login, campanhas com convite, mapa com tokens e névoa, e rolagem de dados.

## Rodar no seu computador

Precisa do Node.js 20.9 ou mais novo.

```
npm install
npm run build
npm start
```

Abra http://localhost:3000. Para desenvolver com recarga automática, use `npm run dev`.

Os dados ficam em `dados/one-history.db`. Para fazer backup, copie essa pasta com o site parado.

## Como funciona

- **Conta:** cada pessoa cria a própria conta com e-mail e senha.
- **Fichas:** pertencem à conta de quem criou. Cada ficha entra em uma campanha por vez.
- **Campanha:** quem cria vira mestre e recebe um código e um link de convite. Gerar um código novo invalida o anterior.
- **Mestre:** vê e edita as fichas da campanha, muda o estágio do núcleo, ajusta vida, mana e SP máximos, define limites para cada atributo, arma e perícia, remove jogadores e exclui a campanha. Não apaga fichas de ninguém.
- **Jogador:** vê a própria ficha completa. Das fichas dos colegas, só nome, foto e raça.
- **Fichas do mestre:** na campanha dele, são privadas: os jogadores não as veem, e as rolagens delas aparecem como "Mestre". O mestre pode tornar cada uma pública, e aí os jogadores veem nome, foto e raça.
- **Magias:** cada ficha tem uma aba de feitiços. Conjurar desconta da mana o custo menos o gasto universal do núcleo.
- **Mesa:** a página da campanha tem o botão **Mesa**, com mapa, tokens, cenários, névoa e chat. O mestre pode preparar cenários ocultos antes da sessão, com a névoa pronta, e mostrar cada um quando quiser. O mestre é o GM, e os membros são jogadores. Um token pode usar uma ficha da campanha: ele passa a mostrar a foto dela, e a vida e a mana acompanham a ficha na hora.
- **Chat de dados:** abre sozinho ao rolar e mostra cada rolagem como mensagem. Em campanha, todos da mesa veem. Fora dela, só o dono da ficha. Cada chat guarda as 500 rolagens mais recentes.
- **Ao vivo:** a mesa e a ficha conversam na hora por Socket.IO. As telas de campanha, ficha e chat também se atualizam sozinhas a cada 3 segundos.

## Esqueceu a senha

O site não envia e-mail. Quem administra o servidor gera uma senha temporária:

```
npm run senha -- pessoa@exemplo.com
```

## Publicar na internet

O site precisa de um serviço Node sempre ligado, em **uma única instância**, porque a mesa mantém conexões abertas e parte do estado na memória. A Vercel não serve. O passo a passo está em `docs/unificacao-mesa.md`.

- **Com disco permanente** (VPS, Render com disco, Railway com volume): rode `npm run build` e `npm start`. A hospedagem define a variável `PORT`. Mantenha a pasta `dados/` em um volume permanente.
- **Sem disco permanente:** crie um banco no Turso e defina `DATABASE_URL` e `DATABASE_AUTH_TOKEN` (veja `.env.example`).

Use sempre HTTPS em produção: é o que protege as senhas no caminho.

## Testes

```
npm run build
npm test            # regras, API e mesa, com banco temporário
npm run test:e2e    # navegador real (usa o Edge instalado no Windows)
```

## Estrutura

- `lib/regras.ts`: regras do sistema (vida, mana, fadiga). Para mudar uma fórmula, é aqui.
- `lib/servidor/rotas.ts`: toda a API, com as permissões.
- `lib/servidor/schema.ts`: tabelas do banco. Depois de mudar, rode `npm run db:gerar`.
- `app/`: as telas.
- `servidor.ts`: o servidor único, com o Next e o Socket.IO no mesmo processo.
- `mesa/`: a mesa virtual. `mesa/src` roda no navegador, e `mesa/server` no servidor.
