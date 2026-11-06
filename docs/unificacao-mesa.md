# Unificação do Tablebola no One History

Registro do diagnóstico (Fase 0), das decisões e do andamento. O pedido autorizou seguir sem pausas entre as fases, então as recomendações abaixo foram aplicadas como padrão. Cada uma pode ser trocada depois.

## Arquitetura escolhida

**Opção 1: o cliente do Tablebola vira uma rota só de cliente do Next, com um servidor Node próprio que roda o Next e o Socket.IO no mesmo processo e na mesma porta.**

| | Opção 1: dentro do Next | Opção 2: Vite em monorepo |
|---|---|---|
| Mesmo login | Direto: mesma origem, cookie no handshake | Exige proxy para manter a mesma origem |
| `npm run dev` único | Sim | Precisa de dois processos |
| Build e deploy | Um só | Dois builds e cópia dos arquivos do Vite |
| Tempo real entre ficha e mesa | Mesmo processo: um evento interno basta | Mesmo servidor só se houver proxy e integração extra |
| Custo | Servidor próprio em vez de `next start` | Menos mudança no código, mais peças para sempre |

### Impacto no deploy

- **Vercel não serve:** ela não mantém conexões Socket.IO.
- **Serve:** um serviço Node de longa duração, com **uma única instância** (Railway, Render, Fly.io ou VPS). O estado da mesa e o aviso entre ficha e mesa ficam na memória do processo.
- **Banco:** disco permanente com SQLite (`dados/`), ou Turso se a hospedagem não tiver disco. O plano completo está na seção "Deploy".

## Dependências novas no One History

| Pacote | Por quê |
|---|---|
| `pixi.js` | Desenha o mapa, os tokens e a névoa |
| `socket.io` | Servidor de tempo real da mesa |
| `socket.io-client` | Conexão do navegador, na mesa e na ficha |
| `zustand` | Estado da mesa no navegador, como o Tablebola já usa |
| `lucide-react` | Ícones dos painéis da mesa |
| `tsx` | Roda `servidor.ts` e o código TypeScript da mesa em produção, sem etapa extra de compilação |

Ficam de fora: `react-router-dom` (o Next faz as rotas), `tailwindcss`, `clsx`, `tailwind-merge` e `class-variance-authority` (só serviam a dois componentes, trocados por CSS simples), `dotenv` (o Next já carrega o ambiente), `vite` e `concurrently`.

## O que vira uma coisa só

| Tema | One History | Tablebola | Como fica |
|---|---|---|---|
| Identidade | Conta e sessão em cookie | UUID no cliente | Conta do One History; o cookie é validado no handshake |
| Sala | Campanha | Código de 6 letras | A campanha é a sala |
| GM | Mestre da campanha | Primeiro a entrar | Mestre da campanha, sempre lido do banco |
| Jogador | Membro da campanha | Quem entrou | Membro da campanha |
| Dados | `crypto.randomInt`, d20 + bônus | Parser completo | Parser do Tablebola para tudo, mantendo o formato das rolagens atuais |
| Chat | Só rolagens, no banco | Tudo, na memória | Rolagens em `rolagens`, texto em `mensagens_mesa` |
| Vida e mana | `fichas.dados` | Campos do token | O token vinculado espelha a ficha; quem manda é a ficha |
| Tempo real | Consulta a cada 3 s | Socket.IO | Socket.IO; a consulta continua como reserva |
| Persistência | Banco | Memória | Tabelas `mesas` e `mesa_imagens` |

## Decisões tomadas

1. **Pasta do código:** `mesa/`, trazida com `git subtree`, preservando o histórico.
2. **Idioma do código portado:** os nomes em inglês do Tablebola ficam como estão, porque renomear milhares de linhas só traria risco. Código novo segue em português.
3. **Estilos isolados:** a página da mesa carrega só o próprio CSS, para as classes `chat-*` dos dois projetos não colidirem. Por isso, o caminho entre o site e a mesa recarrega a página.
4. **Visual:** a mesa adota as fontes do One History e mantém o tema escuro com dourado, que combina com o mapa. A troca de tema é só CSS, se preferir outro.
5. **Espectador:** não existe no banco. O mestre pode marcar um membro como espectador dentro da mesa, e isso fica salvo com a mesa. Mestre nunca deixa de ser GM, e ninguém mais pode virar GM.
6. **Remover na mesa:** tira a pessoa só da mesa até o servidor reiniciar. Remover da campanha continua sendo na página da campanha, e também tira a pessoa da mesa na hora.
7. **Privacidade da vida:** hoje um colega não vê vida nem mana de outra ficha. Isso vale na mesa: em token vinculado, esses valores só chegam ao mestre e ao dono da ficha. Tokens sem ficha seguem visíveis para todos, como no Tablebola.
8. **Vínculo:** só o mestre ou o dono da ficha vincula, e a ficha precisa estar na campanha. Se a ficha sair da campanha ou for apagada, o token é desvinculado sozinho.
9. **Vida e mana no token vinculado:** só o mestre e o dono da ficha alteram. O máximo vem sempre da ficha.
10. **Chat do site:** as páginas de ficha e de campanha continuam mostrando só rolagens. A mesa mostra rolagens e texto.
11. **Migração do chat:** nenhum dado é reescrito. Rolagens antigas aparecem na mesa como texto, e as novas guardam também os dados completos.
12. **Integração antiga:** removida com sua aprovação: rotas `/api/integracao`, chaves, `/embutido` e mini-ficha por chave. A tabela `chaves_integracao` continua no banco, sem uso, porque as migrações são só aditivas.
13. **Merge:** o trabalho acontece na branch `mesa-unificada`, com merge em `main` deste repositório depois de testado, como você autorizou. A produção passa a exigir o servidor próprio em vez de `next start`. O repositório `Table_Bola` não é alterado.

## O que ficou pronto

| Fase | Resultado |
|---|---|
| 1. Tabletop no site | `/campanhas/:id/mesa`, botão **Mesa** na campanha, um único `npm run dev`, build e servidor |
| 2. Um login e uma permissão | A sala é a campanha; o socket valida o cookie e a origem; o papel vem do banco |
| 3. Fichas nativas | Lista de fichas no token; vida e mana gravadas pelo servidor; um motor de dados; chat no banco |
| 4. Persistência e limpeza | Tokens, imagens, grade, névoa, cenários e chat voltam depois de reiniciar; integração antiga removida |

## Rodar e testar

```powershell
npx next build
npx vitest run
npx playwright test
node scripts/servidor-teste.mjs 3457
```

O último comando abre o site em http://localhost:3457 com banco temporário. `npm run dev` também funciona, mas aplica as migrações no banco real `dados/one-history.db`.

**Roteiro com duas contas, em duas janelas (uma delas anônima):**
1. Na janela 1, crie a conta da mestra e uma campanha. Copie o link de convite.
2. Na janela 2, abra o link, crie a conta do jogador e entre na campanha. Crie uma ficha nela.
3. Nas duas janelas, clique em **Mesa**. A mestra aparece como Mestre, e o jogador como Jogador, mesmo que ele tenha entrado antes.
4. Na janela 2, clique em **Novo token**, escolha a ficha na lista e clique em **Vincular ficha**.
5. Abra um grupo de rolagens e clique em uma delas. O resultado aparece nas duas janelas.
6. Mude **PV atual** no token e confira a ficha aberta em outra aba. Depois mude a vida na ficha e confira o token.
7. Digite um valor acima do máximo. O token volta para o máximo.
8. Na janela 1, adicione um cenário, pinte névoa e escreva no chat. Na janela 2, confira que os controles do mestre não aparecem.
9. Pare e suba o servidor de novo usando o mesmo banco. A mesa volta igual.
10. Na janela 1, remova o jogador na página da campanha. A janela 2 sai da mesa na hora.

## Deploy

O passo a passo atual, com Turso e Railway, está em [publicar.md](publicar.md). Esta seção descreve a alternativa com volume permanente.

**Recomendação:** Railway ou Render, com um serviço Node e um volume permanente. Assim o banco continua sendo o SQLite de hoje, e levar os dados é copiar um arquivo. Turso é a alternativa para hospedagens sem volume, mas cada gravação passa pela rede e os dados precisam ser copiados de outra forma.

| Variável | Valor |
|---|---|
| `PORT` | Definida pela hospedagem |
| `DATABASE_URL` | `file:/caminho/do/volume/one-history.db`, ou a URL `libsql://` do Turso |
| `DATABASE_AUTH_TOKEN` | Só com Turso |

**Passo a passo:**
1. Faça backup de `dados/one-history.db`, com o site parado.
2. Crie o serviço apontando para este repositório, com o comando de build `npm install && npm run build` e o de início `npm start`.
3. Crie o volume permanente, defina `DATABASE_URL` e **mantenha uma única instância**, sem escala automática.
4. Copie o backup para o volume antes do primeiro início. O build aplica as migrações nele; elas só adicionam tabelas e colunas.
5. Ative o domínio com HTTPS, que protege as senhas e o cookie.
6. Abra uma campanha, entre na mesa e confira se o indicador mostra **Conectado**. Se a hospedagem usar proxy, ele precisa aceitar WebSocket; sem isso, o Socket.IO continua funcionando por requisições HTTP, com mais demora.

## Limites conhecidos

- **Uma instância só:** duas instâncias teriam mesas diferentes na memória.
- **Névoa:** cenário oculto não sai do servidor para os jogadores. Em cenário visível, a imagem chega inteira ao navegador, e a névoa só a cobre na tela. Cada traço fica guardado, até 100 mil pontos por mesa; Cobrir ou Limpar um cenário libera espaço.
- **Tamanho:** as imagens ficam no banco, até 12 sprites por token e 30 cenários por mesa, com menos de 1 MB cada. Vale acompanhar o tamanho do arquivo.
- **Última gravação vence:** se a ficha e a mesa mudarem a vida ao mesmo tempo, fica a última.
- **Chat de texto:** guarda as 500 mensagens mais recentes por campanha, como as rolagens.
- **Sussurro:** o comando `/w` procura o nome sem espaços, como no Tablebola. Quem tem espaço no nome não recebe sussurro por ele.
