# Tablebola

VTT de navegador feito para jogar com amigos. A interface roda com Vite; salas usam um servidor Node.js com Socket.IO e estado em memória.

## Desenvolvimento

1. `npm install`
2. Copie `.env.example` para `.env` (os valores locais já funcionam).
3. `npm run dev:all` inicia Vite e o servidor Socket.IO. `npm run dev:vite` inicia apenas a interface.

O servidor local usa `http://localhost:3001` e oferece `GET /health`. A rota `/mesa` continua independente da rede. O estado compartilhado existe apenas na memória do servidor e é removido 30 minutos depois que todos saem.

Na mesa, o mestre pode adicionar várias imagens de cenário, arrastá-las pelo mapa e removê-las no painel Mapa. Os controles de Fog of war permitem ocultar ou revelar áreas com pincel ajustável e limpar a névoa. Essas alterações sincronizam entre os jogadores da sala.

## Fichas do One History

Com `VITE_FICHAS_URL` definida, o painel do token permite vincular uma ficha pelo id e informar a chave criada pelo dono da ficha. O token guarda só o id. A chave fica no navegador de quem a recebeu e não passa pelo servidor do Tablebola.

No site de fichas, inclua a origem do Tablebola em `ORIGENS_TABLEBOLA`. O navegador bloqueia um site público de embutir uma ficha rodando na máquina local, então teste com os dois em `localhost` ou com os dois publicados. O contrato está em https://github.com/916Blaxk/one-history/blob/main/docs/contrato-integracao.md.

## Deploy do servidor Node

Crie um serviço Node (por exemplo, Render) usando a raiz deste repositório:

- Build command: `npm install && npm run server:build`
- Start command: `npm run server:start`
- Variáveis: `PORT` é fornecida pela plataforma; defina `ALLOWED_ORIGINS` com a URL da aplicação web, sem barra final. Separe origens adicionais por vírgula.

Na Vercel, configure `VITE_SERVER_URL` com a URL completa do serviço, incluindo protocolo, por exemplo `https://tablebola.onrender.com`, e faça novo deploy da interface. O servidor permite localhost automaticamente fora de produção; em produção, configure os domínios exatos em `ALLOWED_ORIGINS`.
