# Próximos passos

Última atualização: 8 de novembro de 2026.

## Situação

- **Site:** https://one-history-production.up.railway.app
- **Publicação:** cada envio para a branch `main` publica sozinho no Railway. Veja [publicar.md](publicar.md).
- **Banco:** SQLite em volume do Railway, montado em `/data`, com 500 MB.
- **Forma de trabalho:** direto na `main`, com commit e envio ao terminar cada tarefa, depois dos testes.
- **Regras e perícias:** decisões em [pericias.md](pericias.md).

## Decisões em aberto

Nenhuma no momento.

## Decisões tomadas

- **Biblioteca de monstros (8 de novembro de 2026):** o mestre salva um token pronto, com nome, tamanho, cor, vida e mana máximas e as três imagens, e coloca cópias dele em qualquer campanha em que é mestre. Cada cópia nasce com vida e mana cheias e ganha número quando o nome se repete, como Goblin 2. A biblioteca é da conta, com até 100 monstros, e apagar um monstro dela não tira da mesa as cópias já colocadas. Desde o mesmo dia, a biblioteca guarda a imagem original e o ajuste, então a cópia colocada pode ser reajustada sem perder qualidade. Cada monstro tem uma ficha em texto livre, com até 4.000 caracteres, para ataques, resistências e lembretes, que só o mestre vê na biblioteca. A ficha não aparece no token colocado.
- **Prata escuro (8 de novembro de 2026):** o "+10pv" da tabela de Arthur foi um erro. O núcleo não dá vida em nenhum estágio, como o site já fazia.

- **Tokens ligados ao cenário (7 de novembro de 2026):** o token do mestre pertence ao cenário onde foi criado ou solto. Com o cenário oculto, os jogadores não recebem o token. Ao mostrar, ele aparece junto, menos os marcados como ocultos, e acompanha o cenário quando ele é movido, sem encaixar na grade. Personagens de jogador ficam fora dessa regra. Apagar um cenário oculto deixa os tokens dele ocultos. Tokens antigos só entram em um cenário quando forem arrastados de novo.
- **Progressão do núcleo (7 de novembro de 2026):** cada estágio dá AP, além de mana e gasto universal, e não dá mais vida nem PP. Veja [pericias.md](pericias.md).

- **Edição da ficha (7 de novembro de 2026):** o dono e o mestre editam tudo, inclusive núcleo, fadiga, bônus, limites e encerrar cena. Totais e limites só avisam, em destaque, e nenhum número bloqueia. Só `publica` continua com o mestre, porque decide quem vê a ficha dele. A fadiga guardada na saída da campanha continua voltando ao retornar, mas o dono já pode mudá-la depois.
- **Pontos (7 de novembro de 2026):** a ficha começa com 25 AP, divididos entre atributos, armas e elementos, e 20 PP. O limite por perícia começa em 5, e o limite de atributos fica a critério do mestre.
- **Armas e elementos (7 de novembro de 2026):** 1 dado de vantagem a cada 15 pontos e soma de 1/3 do valor, para baixo.
- **Iniciativa e coluna Outros (7 de novembro de 2026):** a iniciativa é rolagem de Destreza, com vantagem e sem somar o valor. A coluna Outros fica e soma na rolagem.
- **Vantagem de atributo (7 de novembro de 2026):** a cada 15 pontos, 1 dado de vantagem, que é mais um d20, ficando o maior. O dado adicional de 1d2 a 1d10 saiu. O valor do atributo não soma, nem na rolagem dele mesmo. Sorte é sem atributo. Veja [pericias.md](pericias.md).
- **Névoa para o mestre (7 de novembro de 2026):** agora é 100% opaca, como para o jogador, a pedido do usuário. O mestre também não vê o mapa nem os tokens sob a névoa, e usa Revelar para abrir o caminho.
- **Brecha da fadiga (6 de novembro de 2026):** quando a ficha sai de uma campanha, o servidor guarda a fadiga dela. Se a ficha voltar para a mesma campanha, a fadiga volta a esse valor, e o registro da ficha mostra a mudança. Em outra campanha, a ficha entra com o maior valor entre a fadiga atual e a da última saída, e o mestre de lá pode corrigir.
- **Quem cria elemento (6 de novembro de 2026):** o dono da ficha e o mestre.
- **Fusão e variação de elementos (6 de novembro de 2026):** partem de elementos base ou de elementos já criados na ficha. Um elemento usado em outro não pode ser removido antes dele.
- **Imagens do token (6 de novembro de 2026):** o token não usa a foto da ficha. Tem três vagas: Normal, Machucado (abaixo da metade da vida) e Armado (por botão, do dono e do mestre). O machucado vem na frente do armado.
- **Armas (6 de novembro de 2026):** a ficha tem Armas leves, Armas médias e Armas pesadas, sem as específicas. Valores das armas antigas não foram convertidos.
- **Atributos e vida (6 de novembro de 2026):** Tenacidade saiu da ficha. O jogador pode mudar a vida máxima, e a diferença para a fórmula vira um ajuste, então vitalidade e núcleo continuam somando. Os limites que o mestre definir continuam valendo.
- **Ficha (6 de novembro de 2026):** a ficha começa sem elementos, e o jogador adiciona os dele. O gráfico mostra corpo e mente. Há uma aba de habilidades e uma classe de perícias Magia, e as perícias adicionais foram distribuídas.
- **Visual (8 de novembro de 2026):** o tomo de academia em tinta quente e dourado foi testado e desfeito a pedido do usuário. A ideia era usar The Beginning After the End e Infinite Mage como referência para outra coisa, não para trocar a paleta, então voltou o visual de 6 de novembro.
- **Visual (6 de novembro de 2026):** grimório arcano em azul e roxo, com Almendra, Cinzel e Spectral, selos de runas e efeitos lentos no fundo, que respeitam a opção de movimento reduzido. A Inter do primeiro redesenho saiu depois de um jogador achar que não combinava com magia. Tema claro não foi feito, porque a mesa tem muitas cores próprias. Vida, mana, elementos, fadiga e núcleo mantêm as próprias cores, porque elas têm significado no jogo.
- **Fichas antigas (6 de novembro de 2026):** não serão levadas. O site começa com o banco atual.
- **Retirada de fundo (6 de novembro de 2026):** feita por cor, no navegador, nas imagens do token, com uma barra de força. Funciona melhor em fundo liso; foto com fundo complexo pediria um modelo de IA, cerca de 55 MB na primeira vez.

## Pendências

- **Turso:** opcional, para ver e editar os dados com mais facilidade. O caminho está em [publicar.md](publicar.md).
- **Backup externo:** o PC do usuário baixa a cópia mais recente a cada 2 dias, pelo Agendador de Tarefas. Veja [publicar.md](publicar.md). Conferir de vez em quando `Documentos\one-history-backups\baixar-backup.log`.
- **Restauração no Railway:** testada no PC em 8 de novembro de 2026, com o passo a passo em [publicar.md](publicar.md). Falta um ensaio real no Railway, que perde o que for gravado depois da cópia escolhida.
- **Plano do Railway:** conferir preço e limite no painel.
- **Verificação de saúde:** definir o caminho `/entrar` nas configurações do serviço no Railway.
- **Google Doc do sistema:** renumerar as perícias e incluir Sorte.
- **Sessão de teste:** jogar com 3 ou 4 pessoas em internet real. Será marcada quando o mestre e os jogadores se reunirem.
- **Celular de verdade:** conferir o entalhe do iPhone, o teclado aberto e, na mesa, arrastar token, pintar névoa e usar a régua com o dedo.
- **Ferramentas opcionais:** `chrome-devtools-mcp` e `21st` não foram instalados.
- **Visual:** ficou o grimório azul e roxo. Falta saber para que o usuário queria usar os dois manhwas como referência.
- **Recuperação de senha:** não existe. O site não envia e-mail, e a troca de senha pede a senha atual. Para criar, é preciso escolher um serviço de e-mail, como o Resend, com conta e chave do usuário.
- **Tokens ligados ao cenário:** ainda não foram testados numa preparação real.
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
