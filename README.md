# One History

Fichas e campanhas para o sistema de RPG One History: contas com login, campanhas com convite, mesa do mestre ao vivo e rolagem de dados.

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
- **Mestre:** vê e edita as fichas da campanha, remove jogadores e exclui a campanha. Não apaga fichas de ninguém.
- **Jogador:** vê a própria ficha completa. Das fichas dos colegas, só nome, foto e raça.
- **Chat de dados:** abre sozinho ao rolar e mostra cada rolagem como mensagem. Em campanha, todos da mesa veem. Fora dela, só o dono da ficha. Cada chat guarda as 500 rolagens mais recentes.
- **Ao vivo:** as telas de campanha, ficha e chat se atualizam sozinhas a cada 3 segundos.

## Esqueceu a senha

O site não envia e-mail. Quem administra o servidor gera uma senha temporária:

```
npm run senha -- pessoa@exemplo.com
```

## Publicar na internet

- **Servidor com disco permanente** (VPS, Render com disco, Railway com volume): rode `npm run build` e `npm start`. A hospedagem define a variável `PORT`. Mantenha a pasta `dados/` em um volume permanente.
- **Vercel:** não tem disco permanente. Crie um banco no Turso e defina `DATABASE_URL` e `DATABASE_AUTH_TOKEN` (veja `.env.example`).

Use sempre HTTPS em produção: é o que protege as senhas no caminho.

## Testes

```
npm run build
npm test            # regras e API, com banco temporário
npm run test:e2e    # navegador real (usa o Edge instalado no Windows)
```

## Estrutura

- `lib/regras.ts`: regras do sistema (vida, mana, fadiga). Para mudar uma fórmula, é aqui.
- `lib/servidor/rotas.ts`: toda a API, com as permissões.
- `lib/servidor/schema.ts`: tabelas do banco. Depois de mudar, rode `npm run db:gerar`.
- `app/`: as telas.
