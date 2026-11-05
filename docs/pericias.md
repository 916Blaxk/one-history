# Perícias

Os nomes, as chaves e as regras vêm de `lib/regras.ts` e `lib/servidor/rotas.ts`. Se mudar uma perícia lá, atualize este documento.

As descrições aparecem na ficha e ficam em `PERICIAS`, em `lib/regras.ts`. Elas são sugestões, não mudam nenhuma regra e podem ser trocadas.

A numeração é corrida, na ordem do código. O documento do sistema pulava de 4 para 13, e ficou decidido que não há perícias nesses números.

## Como funcionam

- **Valor:** cada perícia guarda um valor por ficha, que começa em 0.
- **Rolagem:** rolar uma perícia é d20 + dado adicional + o valor guardado na ficha. O servidor lê o valor, e o navegador não escolhe o bônus.
- **SP:** a soma dos valores de todas as perícias é o SP gasto. O SP total vem do estágio do núcleo mais o ajuste do mestre.
- **Travas do jogador:** o jogador não sobe uma perícia além do SP total nem do limite que o mestre definir para ela.
- **Mestre:** o mestre pode deixar um valor acima do limite. Depois disso, o jogador só pode baixar esse valor.

## Dado adicional

Só as perícias têm dado adicional. Atributos, armas, corpo e mente rolam d20 + valor.

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

| Nº | Perícia | Chave | Descrição sugerida |
| --- | --- | --- | --- |
| 1 | Luta desarmada | `lutaDesarmada` | Atacar e se defender sem armas. |
| 2 | Esquiva | `esquiva` | Sair do caminho de um ataque ou perigo. |
| 3 | Aparar | `aparar` | Bloquear ou desviar um golpe com arma ou escudo. |
| 4 | Arremesso | `arremesso` | Lançar objetos e armas de arremesso com precisão. |

### Físicas e movimentação

| Nº | Perícia | Chave | Descrição sugerida |
| --- | --- | --- | --- |
| 5 | Acrobacia | `acrobacia` | Saltar, rolar e fazer manobras corporais. |
| 6 | Escalada | `escalada` | Subir muros, árvores e encostas. |
| 7 | Natação | `natacao` | Nadar, mergulhar e resistir a correntezas. |
| 8 | Corrida | `corrida` | Correr rápido e manter o ritmo em perseguições. |
| 9 | Equilíbrio | `equilibrio` | Manter-se de pé em superfícies estreitas ou instáveis. |
| 10 | Furtividade | `furtividade` | Mover-se sem ser visto ou ouvido. |
| 11 | Sobrevivência | `sobrevivencia` | Achar abrigo, água e caminho em ambientes hostis. |

### Conhecimento

| Nº | Perícia | Chave | Descrição sugerida |
| --- | --- | --- | --- |
| 12 | História | `historia` | Conhecer eventos, povos e figuras do passado. |
| 13 | Geografia | `geografia` | Conhecer regiões, rotas, climas e mapas. |
| 14 | Religião | `religiao` | Conhecer crenças, cultos, ritos e símbolos sagrados. |
| 15 | Mitologia | `mitologia` | Conhecer lendas, deuses e contos antigos. |
| 16 | Investigação | `investigacao` | Procurar pistas e deduzir o que aconteceu. |
| 17 | Medicina | `medicina` | Diagnosticar e tratar ferimentos e doenças sem magia. |
| 18 | Alquimia | `alquimia` | Identificar e preparar poções, venenos e reagentes. |
| 19 | Engenharia | `engenharia` | Projetar, entender e consertar máquinas e mecanismos. |
| 20 | Arquitetura | `arquitetura` | Entender construções, estruturas e seus pontos fracos. |
| 21 | Matemática | `matematica` | Fazer cálculos e resolver problemas lógicos. |
| 22 | Linguística | `linguistica` | Entender idiomas, dialetos e escritas desconhecidas. |
| 23 | Estratégia militar | `estrategiaMilitar` | Planejar batalhas e ler táticas inimigas. |

### Sociais

| Nº | Perícia | Chave | Descrição sugerida |
| --- | --- | --- | --- |
| 24 | Intimidação | `intimidacao` | Impor medo por presença ou ameaça. |
| 25 | Enganação | `enganacao` | Mentir e convencer alguém do que é falso. |
| 26 | Atuação | `atuacao` | Interpretar um papel ou emoção de forma convincente. |
| 27 | Etiqueta | `etiqueta` | Seguir costumes e se portar bem em cada meio social. |
| 28 | Liderança | `lideranca` | Inspirar e coordenar um grupo. |
| 29 | Interrogatório | `interrogatorio` | Extrair informação de quem não quer falar. |
| 30 | Sedução | `seducao` | Usar charme e atração para influenciar alguém. |
| 31 | Negociação | `negociacao` | Barganhar preços, acordos e tréguas. |
| 32 | Disfarce | `disfarce` | Mudar a aparência para se passar por outra pessoa. |
| 33 | Domesticação | `domesticacao` | Acalmar, treinar e conduzir animais. |

### Exploração e utilidade

| Nº | Perícia | Chave | Descrição sugerida |
| --- | --- | --- | --- |
| 34 | Rastreamento | `rastreamento` | Seguir pegadas e sinais de passagem. |
| 35 | Caça | `caca` | Localizar, emboscar e abater presas. |
| 36 | Arrombamento | `arrombamento` | Abrir fechaduras e passar por trancas. |
| 37 | Truques | `truques` | Fazer prestidigitação e pequenos golpes de mão. |
| 38 | Pilotagem | `pilotagem` | Conduzir veículos e embarcações. |

### Profissões e ofícios

| Nº | Perícia | Chave | Descrição sugerida |
| --- | --- | --- | --- |
| 39 | Profissão | `profissao` | Exercer um ofício escolhido pelo personagem. |
| 40 | Música | `musica` | Tocar instrumentos, cantar e compor. |
| 41 | Dança | `danca` | Dançar com técnica, em apresentações ou eventos. |
| 42 | Escultura | `escultura` | Criar e avaliar obras em pedra, madeira ou argila. |
| 43 | Criptografia | `criptografia` | Criar e decifrar códigos e mensagens secretas. |
| 44 | Conhecimento de criaturas | `conhecimentoCriaturas` | Identificar criaturas, seus hábitos e fraquezas. |
| 45 | Conhecimento de artefatos | `conhecimentoArtefatos` | Reconhecer artefatos, sua origem e sua função. |
| 46 | Canalização mágica | `canalizacaoMagica` | Conduzir mana pelo corpo ou por um objeto com estabilidade. |
| 47 | Controle de mana | `controleMana` | Dosar a mana e evitar desperdício ou descontrole. |
| 48 | Ritualística | `ritualistica` | Conduzir rituais e entender seus círculos e etapas. |
| 49 | Identificação mágica | `identificacaoMagica` | Reconhecer magias, encantamentos e seus efeitos. |
| 50 | Resistência espiritual | `resistenciaEspiritual` | Resistir a influências sobre a mente e o espírito. |

### Perícias adicionais

| Nº | Perícia | Chave | Descrição sugerida |
| --- | --- | --- | --- |
| 51 | Encantar | `encantar` | Imbuir objetos com efeitos mágicos. |
| 52 | Tecnologia | `tecnologia` | Entender e operar dispositivos avançados. |
| 53 | Extração de núcleo | `extracaoNucleo` | Retirar o núcleo de uma criatura sem danificá-lo. |
| 54 | Metalúrgica | `metalurgica` | Trabalhar metais e forjar peças. |
| 55 | Sorte | `sorte` | Contar com o acaso quando nenhuma outra perícia se aplica. |

## Decisões sobre o documento do sistema

O documento e o código divergiam nestes pontos. Qualquer decisão pode mudar depois.

| Assunto | Decisão |
| --- | --- |
| Vida por estágio do núcleo | Segue o documento |
| Dado adicional por perícia | Segue o documento |
| Vermelho escuro | Segue o código: dá 15 SP, e o documento dizia "nenhum efeito" |
| Sorte | Segue o código: existe, e o documento não a citava |
| Encantar, Tecnologia, Extração de núcleo e Metalúrgica | Segue o código: ficam em "Perícias adicionais" |
| Perícias 5 a 12 | Não existem, e a numeração passou a ser corrida |
