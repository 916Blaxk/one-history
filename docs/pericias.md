# Perícias

Os nomes, as chaves e as regras vêm de `lib/regras.ts` e `lib/servidor/rotas.ts`. Se mudar uma perícia lá, atualize este documento.

As descrições aparecem na ficha e ficam em `PERICIAS`, em `lib/regras.ts`. Elas são sugestões, não mudam nenhuma regra e podem ser trocadas.

A numeração é corrida, na ordem do código. O documento do sistema pulava de 4 para 13, e ficou decidido que não há perícias nesses números.

## Como funcionam

- **Valor:** cada perícia guarda um valor por ficha, que começa em 0.
- **Treino e Outros:** Treino é o valor da perícia: gasta SP e define o dado adicional. Outros é um bônus livre, sem gastar SP.
- **Rolagem:** rolar uma perícia é d20 + dado adicional do treino + bônus (Treino + Outros). O servidor lê os valores, e o navegador não escolhe o bônus.
- **Atributo:** cada perícia mostra o atributo da lista do sistema, mas ele não soma na rolagem. Aguarda a decisão de quem criou o sistema. Sorte não está na lista.
- **SP:** a soma do Treino de todas as perícias é o SP gasto. O SP total vem do estágio do núcleo mais o ajuste do mestre.
- **Travas do jogador:** o jogador não sobe uma perícia além do SP total nem do limite que o mestre definir para ela.
- **Mestre:** o mestre pode deixar um valor acima do limite. Depois disso, o jogador só pode baixar esse valor.

## Dado adicional

Só as perícias têm dado adicional. Elementos, armas, corpo e mente rolam d20 + valor.

| Valor da perícia | Dado |
| --- | --- |
| 0 | Nenhum |
| 1 a 5 | 1d2 |
| 6 a 10 | 1d4 |
| 11 a 15 | 1d6 |
| 16 a 20 | 1d8 |
| 21 ou mais | 1d10 |

O documento do sistema vai até 25. Acima disso, o dado continua em 1d10.

## SP e vida por estágio do núcleo

Cada estágio soma ao que os anteriores já deram.

| Estágio | SP | SP acumulado | Vida | Vida acumulada |
| --- | --- | --- | --- | --- |
| Vermelho escuro | 15 | 15 | 0 | 0 |
| Vermelho sólido | 5 | 20 | 2 | 2 |
| Vermelho claro | 5 | 25 | 2 | 4 |
| Laranja escuro | 7 | 32 | 3 | 7 |
| Laranja sólido | 7 | 39 | 3 | 10 |
| Laranja claro | 7 | 46 | 3 | 13 |
| Amarelo escuro | 10 | 56 | 5 | 18 |
| Amarelo sólido | 10 | 66 | 5 | 23 |
| Amarelo claro | 10 | 76 | 5 | 28 |
| Prata escuro | 15 | 91 | 10 | 38 |
| Prata fosco | 15 | 106 | 10 | 48 |
| Prata brilhante | 15 | 121 | 10 | 58 |
| Branco | 40 | 161 | 40 | 98 |

## Lista

### Combate

| Nº | Perícia | Chave | Atributo | Descrição sugerida |
| --- | --- | --- | --- | --- |
| 1 | Luta desarmada | `lutaDesarmada` | Destreza | Atacar e se defender sem armas. |
| 2 | Esquiva | `esquiva` | Destreza | Sair do caminho de um ataque ou perigo. |
| 3 | Aparar | `aparar` | Tração | Bloquear ou desviar um golpe com arma ou escudo. |
| 4 | Arremesso | `arremesso` | Tração | Lançar objetos e armas de arremesso com precisão. |

### Magia

| Nº | Perícia | Chave | Atributo | Descrição sugerida |
| --- | --- | --- | --- | --- |
| 5 | Encantar | `encantar` | Onipotência | Imbuir objetos com efeitos mágicos. |
| 6 | Canalização mágica | `canalizacaoMagica` | Onipotência | Conduzir mana pelo corpo ou por um objeto com estabilidade. |
| 7 | Controle de mana | `controleMana` | Onipotência | Dosar a mana e evitar desperdício ou descontrole. |
| 8 | Ritualística | `ritualistica` | Onipotência | Conduzir rituais e entender seus círculos e etapas. |
| 9 | Identificação mágica | `identificacaoMagica` | Onisciência | Reconhecer magias, encantamentos e seus efeitos. |
| 10 | Extração de núcleo | `extracaoNucleo` | Onisciência | Retirar o núcleo de uma criatura sem danificá-lo. |
| 11 | Resistência espiritual | `resistenciaEspiritual` | Onipotência | Resistir a influências sobre a mente e o espírito. |

### Físicas e movimentação

| Nº | Perícia | Chave | Atributo | Descrição sugerida |
| --- | --- | --- | --- | --- |
| 12 | Acrobacia | `acrobacia` | Destreza | Saltar, rolar e fazer manobras corporais. |
| 13 | Escalada | `escalada` | Destreza | Subir muros, árvores e encostas. |
| 14 | Natação | `natacao` | Destreza | Nadar, mergulhar e resistir a correntezas. |
| 15 | Corrida | `corrida` | Destreza | Correr rápido e manter o ritmo em perseguições. |
| 16 | Equilíbrio | `equilibrio` | Destreza | Manter-se de pé em superfícies estreitas ou instáveis. |
| 17 | Furtividade | `furtividade` | Destreza | Mover-se sem ser visto ou ouvido. |
| 18 | Sobrevivência | `sobrevivencia` | Onisciência | Achar abrigo, água e caminho em ambientes hostis. |

### Conhecimento

| Nº | Perícia | Chave | Atributo | Descrição sugerida |
| --- | --- | --- | --- | --- |
| 19 | História | `historia` | Onisciência | Conhecer eventos, povos e figuras do passado. |
| 20 | Geografia | `geografia` | Onisciência | Conhecer regiões, rotas, climas e mapas. |
| 21 | Religião | `religiao` | Onipotência | Conhecer crenças, cultos, ritos e símbolos sagrados. |
| 22 | Mitologia | `mitologia` | Onisciência | Conhecer lendas, deuses e contos antigos. |
| 23 | Investigação | `investigacao` | Onisciência | Procurar pistas e deduzir o que aconteceu. |
| 24 | Medicina | `medicina` | Onisciência | Diagnosticar e tratar ferimentos e doenças sem magia. |
| 25 | Alquimia | `alquimia` | Onisciência | Identificar e preparar poções, venenos e reagentes. |
| 26 | Engenharia | `engenharia` | Onisciência | Projetar, entender e consertar máquinas e mecanismos. |
| 27 | Arquitetura | `arquitetura` | Onisciência | Entender construções, estruturas e seus pontos fracos. |
| 28 | Matemática | `matematica` | Onisciência | Fazer cálculos e resolver problemas lógicos. |
| 29 | Linguística | `linguistica` | Onisciência | Entender idiomas, dialetos e escritas desconhecidas. |
| 30 | Estratégia militar | `estrategiaMilitar` | Onisciência | Planejar batalhas e ler táticas inimigas. |
| 31 | Tecnologia | `tecnologia` | Onisciência | Entender e operar dispositivos avançados. |

### Sociais

| Nº | Perícia | Chave | Atributo | Descrição sugerida |
| --- | --- | --- | --- | --- |
| 32 | Intimidação | `intimidacao` | Encanto | Impor medo por presença ou ameaça. |
| 33 | Enganação | `enganacao` | Encanto | Mentir e convencer alguém do que é falso. |
| 34 | Atuação | `atuacao` | Encanto | Interpretar um papel ou emoção de forma convincente. |
| 35 | Etiqueta | `etiqueta` | Encanto | Seguir costumes e se portar bem em cada meio social. |
| 36 | Liderança | `lideranca` | Encanto | Inspirar e coordenar um grupo. |
| 37 | Interrogatório | `interrogatorio` | Encanto | Extrair informação de quem não quer falar. |
| 38 | Sedução | `seducao` | Encanto | Usar charme e atração para influenciar alguém. |
| 39 | Negociação | `negociacao` | Encanto | Barganhar preços, acordos e tréguas. |
| 40 | Disfarce | `disfarce` | Encanto | Mudar a aparência para se passar por outra pessoa. |
| 41 | Domesticação | `domesticacao` | Encanto | Acalmar, treinar e conduzir animais. |

### Exploração e utilidade

| Nº | Perícia | Chave | Atributo | Descrição sugerida |
| --- | --- | --- | --- | --- |
| 42 | Rastreamento | `rastreamento` | Onipotência | Seguir pegadas e sinais de passagem. |
| 43 | Caça | `caca` | Onisciência | Localizar, emboscar e abater presas. |
| 44 | Arrombamento | `arrombamento` | Destreza | Abrir fechaduras e passar por trancas. |
| 45 | Truques | `truques` | Destreza | Fazer prestidigitação e pequenos golpes de mão. |
| 46 | Pilotagem | `pilotagem` | Destreza | Conduzir veículos e embarcações. |
| 47 | Sorte | `sorte` | — | Contar com o acaso quando nenhuma outra perícia se aplica. |

### Profissões e ofícios

| Nº | Perícia | Chave | Atributo | Descrição sugerida |
| --- | --- | --- | --- | --- |
| 48 | Profissão | `profissao` | Onisciência | Exercer um ofício escolhido pelo personagem. |
| 49 | Música | `musica` | Onipotência | Tocar instrumentos, cantar e compor. |
| 50 | Dança | `danca` | Destreza | Dançar com técnica, em apresentações ou eventos. |
| 51 | Escultura | `escultura` | Onipotência | Criar e avaliar obras em pedra, madeira ou argila. |
| 52 | Criptografia | `criptografia` | Onisciência | Criar e decifrar códigos e mensagens secretas. |
| 53 | Conhecimento de criaturas | `conhecimentoCriaturas` | Onisciência | Identificar criaturas, seus hábitos e fraquezas. |
| 54 | Conhecimento de artefatos | `conhecimentoArtefatos` | Onisciência | Reconhecer artefatos, sua origem e sua função. |
| 55 | Metalúrgica | `metalurgica` | Onisciência | Trabalhar metais e forjar peças. |

## Decisões sobre o documento do sistema

O documento e o código divergiam nestes pontos. Qualquer decisão pode mudar depois.

| Assunto | Decisão |
| --- | --- |
| Vida por estágio do núcleo | Segue o documento |
| Dado adicional por perícia | Segue o documento |
| Vermelho escuro | Segue o código: dá 15 SP, e o documento dizia "nenhum efeito" |
| Sorte | Segue o código: existe, e o documento não a citava |
| Perícias adicionais | Foram distribuídas: Encantar e Extração de núcleo em Magia, Tecnologia em Conhecimento, Metalúrgica em Profissões e ofícios, Sorte em Exploração e utilidade |
| Classe Magia | Criada a pedido, com as perícias mágicas que estavam em Profissões e ofícios |
| Perícias 5 a 12 | Não existem, e a numeração passou a ser corrida |
