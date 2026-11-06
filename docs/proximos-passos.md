# Próximos passos

Última atualização: 6 de novembro de 2026.

## Situação

- **Site:** https://one-history-production.up.railway.app
- **Publicação:** cada envio para a branch `main` publica sozinho no Railway. Veja [publicar.md](publicar.md).
- **Banco:** SQLite em volume do Railway, montado em `/data`, com 500 MB.
- **Forma de trabalho:** direto na `main`, com commit e envio ao terminar cada tarefa, depois dos testes.
- **Regras e perícias:** decisões em [pericias.md](pericias.md).

## Decisões em aberto

1. **Perícia acima de 25:** hoje, o dado adicional fica em 1d10. Aguarda a pessoa que criou o sistema, que decide as regras de dados.

## Decisões tomadas

- **Brecha da fadiga (6 de novembro de 2026):** quando a ficha sai de uma campanha, o servidor guarda a fadiga dela. Se a ficha voltar para a mesma campanha, a fadiga volta a esse valor, e o registro da ficha mostra a mudança. Em outra campanha, a ficha entra com a fadiga atual.
- **Quem cria elemento (6 de novembro de 2026):** o dono da ficha e o mestre.
- **Fusão e variação de elementos (6 de novembro de 2026):** partem de elementos base ou de elementos já criados na ficha. Um elemento usado em outro não pode ser removido antes dele.
- **Encerrar cena (6 de novembro de 2026):** em campanha, só o mestre. Fora de campanha, o dono da ficha, como na fadiga.
- **Imagens do token (6 de novembro de 2026):** o token não usa a foto da ficha. Tem três vagas: Normal, Machucado (abaixo da metade da vida) e Armado (por botão, do dono e do mestre). O machucado vem na frente do armado.
- **Retirada de fundo (6 de novembro de 2026):** feita por cor, no navegador, nas imagens do token, com uma barra de força. Funciona melhor em fundo liso; foto com fundo complexo pediria um modelo de IA, cerca de 55 MB na primeira vez.

## Pendências

- **Fichas antigas:** `dados/one-history.db` está em outro PC. Levar antes de os jogadores criarem contas, porque a cópia exige um banco vazio.
- **Turso:** opcional, para ver e editar os dados com mais facilidade. O caminho está em [publicar.md](publicar.md).
- **Backup externo:** as cópias diárias ficam no mesmo volume do banco. Baixar uma de vez em quando.
- **Plano do Railway:** conferir preço e limite no painel.
- **Verificação de saúde:** definir o caminho `/entrar` nas configurações do serviço no Railway.
- **Google Doc do sistema:** renumerar as perícias e incluir Sorte.
- **Sessão de teste:** jogar com 3 ou 4 pessoas em internet real.
- **Celular de verdade:** conferir o entalhe do iPhone, o teclado aberto e, na mesa, arrastar token, pintar névoa e usar a régua com o dedo.
- **Lint:** restam erros do tipo `any` no código.
- **Ferramentas opcionais:** `chrome-devtools-mcp` e `21st` não foram instalados.
- **Depois da sessão de teste:** avaliar rolar o dano da magia e o que mais fizer falta.

## Para continuar em outro PC

```bash
git clone https://github.com/916Blaxk/one-history.git
cd one-history
npm install
npx next build
node scripts/servidor-teste.mjs 3457
```

Depois, abra http://localhost:3457. Esse comando usa um banco temporário e não toca em dados reais.
