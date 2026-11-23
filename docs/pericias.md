# Perícias

Os nomes, as chaves e as regras vêm de `lib/regras.ts` e `lib/servidor/rotas.ts`. Se mudar uma perícia lá, atualize este documento.

As descrições aparecem na ficha e ficam em `PERICIAS`, em `lib/regras.ts`. Elas são sugestões, não mudam nenhuma regra e podem ser trocadas.

A numeração é corrida, na ordem do código. O documento do sistema pulava de 4 para 13, e ficou decidido que não há perícias nesses números.

## Como funcionam

- **Valor:** cada perícia guarda um valor por ficha, que começa em 0.
- **Treino e Outros:** Treino é o valor da perícia e gasta PP. Outros é um bônus livre, sem gastar PP.
- **Rolagem:** rolar uma perícia é d20 com a vantagem do atributo + bônus (Treino + Outros). O servidor lê os valores, e o navegador não escolhe o bônus.
- **Atributo:** cada perícia usa o atributo da lista do sistema, que dá vantagem, mas o valor dele não soma no resultado. Na ficha, dá para trocar o atributo de qualquer perícia. Sorte e Combate são sem atributo por padrão e rolam sem vantagem.
- **Nomes dos atributos:** Genialidade e Determinação guardam as chaves antigas `onisciencia` e `onipotencia`, para as fichas gravadas não precisarem de migração.
- **PP (pontos de perícia):** a soma do Treino de todas as perícias é o PP gasto. A ficha começa com 20 PP, mais o bônus da ficha.
- **AP (pontos de atributo):** a soma de atributos, armas e elementos, inclusive os criados, é o AP gasto. A ficha começa com 25 AP, mais o que o núcleo der e o bônus da ficha.
- **Limites:** cada perícia tem limite de 5, mais o bônus de limite da ficha, e o mestre o aumenta quando quiser. Também é possível definir o limite de uma perícia, de um atributo, de uma arma ou de um elemento.
- **Edição:** o dono e o mestre editam toda a ficha. Totais e limites só avisam, em destaque: nenhum número bloqueia a edição, e a mesa confere.

## Vantagem

Regra passada por Arthur Baldo, que criou o sistema, em 7 de novembro de 2026. Substitui a tabela de dado adicional (1d2 a 1d10).

A cada 15 pontos em um atributo, a rolagem desse atributo e das perícias dele ganha 1 dado de vantagem. Cada vantagem rola mais um d20, e fica o maior. O valor do atributo nunca soma no resultado.

| Atributo | Vantagem | Dados |
| --- | --- | --- |
| 0 a 14 | 0 | 1d20 |
| 15 a 29 | 1 | 2d20, fica o maior |
| 30 a 44 | 2 | 3d20, fica o maior |

Exemplo: com 15 de Destreza e 5 de Esquiva, esquivar rola 2d20, fica o maior, e soma 5.

- **Atributos:** rolar o próprio atributo tem a vantagem dele e não soma nada. Com 15 de Destreza, rola 2d20 e fica o maior. A iniciativa é uma rolagem de Destreza.
- **Sorte:** é sem atributo e rola sem vantagem, por decisão de quem criou o sistema.
- **Elementos e armas:** têm 1 dado de vantagem a cada 15 pontos e somam 1/3 do valor, para baixo. Com 15 de Fogo, rola 2d20, fica o maior, e soma 5.

## Progressão do núcleo

Tabela passada por Arthur Baldo em 7 de novembro de 2026. Cada estágio soma ao que os anteriores já deram, e o total de AP parte dos 25 iniciais.

| Estágio | Mana | Gasto universal | AP | AP total |
| --- | --- | --- | --- | --- |
| Vermelho escuro | 0 | 0 | 0 | 25 |
| Vermelho sólido | +2 | 0 | +7 | 32 |
| Vermelho claro | +2 | 0 | +7 | 39 |
| Laranja escuro | +3 | −2 | +10 | 49 |
| Laranja sólido | +3 | 0 | +10 | 59 |
| Laranja claro | +3 | 0 | +10 | 69 |
| Amarelo escuro | +5 | −3 | +10 | 79 |
| Amarelo sólido | +5 | 0 | +15 | 94 |
| Amarelo claro | +5 | 0 | +15 | 109 |
| Prata escuro | +10 | −5 | +15 | 124 |
| Prata fosco | +10 | 0 | +20 | 144 |
| Prata brilhante | +10 | 0 | +20 | 164 |
| Branco | +50 | −10 | +50 | 214 |

- **Vida:** o núcleo não dá mais vida. Ela vem de pontos de atributo, pela Vitalidade, ou de itens.
- **PP:** o núcleo não dá PP. O mestre distribui ao longo do RPG, pelo campo de bônus da ficha.

## Lista

### Combate

| Nº | Perícia | Chave | Atributo | Descrição sugerida |
| --- | --- | --- | --- | --- |
| 1 | Combate | `combate` | — | Lutar com armas e técnicas de combate. |
| 2 | Luta desarmada | `lutaDesarmada` | Destreza | Atacar e se defender sem armas. |
| 3 | Esquiva | `esquiva` | Destreza | Sair do caminho de um ataque ou perigo. |
| 4 | Aparar | `aparar` | Tração | Bloquear ou desviar um golpe com arma ou escudo. |
| 5 | Arremesso | `arremesso` | Tração | Lançar objetos e armas de arremesso com precisão. |

### Magia

| Nº | Perícia | Chave | Atributo | Descrição sugerida |
| --- | --- | --- | --- | --- |
| 6 | Encantar | `encantar` | Determinação | Imbuir objetos com efeitos mágicos. |
| 7 | Canalização mágica | `canalizacaoMagica` | Determinação | Conduzir mana pelo corpo ou por um objeto com estabilidade. |
| 8 | Controle de mana | `controleMana` | Determinação | Dosar a mana e evitar desperdício ou descontrole. |
| 9 | Ritualística | `ritualistica` | Determinação | Conduzir rituais e entender seus círculos e etapas. |
| 10 | Identificação mágica | `identificacaoMagica` | Genialidade | Reconhecer magias, encantamentos e seus efeitos. |
| 11 | Extração de núcleo | `extracaoNucleo` | Genialidade | Retirar o núcleo de uma criatura sem danificá-lo. |
| 12 | Resistência espiritual | `resistenciaEspiritual` | Determinação | Resistir a influências sobre a mente e o espírito. |

### Físicas e movimentação

| Nº | Perícia | Chave | Atributo | Descrição sugerida |
| --- | --- | --- | --- | --- |
| 13 | Acrobacia | `acrobacia` | Destreza | Saltar, rolar e fazer manobras corporais. |
| 14 | Escalada | `escalada` | Destreza | Subir muros, árvores e encostas. |
| 15 | Natação | `natacao` | Destreza | Nadar, mergulhar e resistir a correntezas. |
| 16 | Corrida | `corrida` | Destreza | Correr rápido e manter o ritmo em perseguições. |
| 17 | Equilíbrio | `equilibrio` | Destreza | Manter-se de pé em superfícies estreitas ou instáveis. |
| 18 | Furtividade | `furtividade` | Destreza | Mover-se sem ser visto ou ouvido. |
| 19 | Sobrevivência | `sobrevivencia` | Genialidade | Achar abrigo, água e caminho em ambientes hostis. |

### Conhecimento

| Nº | Perícia | Chave | Atributo | Descrição sugerida |
| --- | --- | --- | --- | --- |
| 20 | História | `historia` | Genialidade | Conhecer eventos, povos e figuras do passado. |
| 21 | Geografia | `geografia` | Genialidade | Conhecer regiões, rotas, climas e mapas. |
| 22 | Religião | `religiao` | Determinação | Conhecer crenças, cultos, ritos e símbolos sagrados. |
| 23 | Mitologia | `mitologia` | Genialidade | Conhecer lendas, deuses e contos antigos. |
| 24 | Investigação | `investigacao` | Genialidade | Procurar pistas e deduzir o que aconteceu. |
| 25 | Medicina | `medicina` | Genialidade | Diagnosticar e tratar ferimentos e doenças sem magia. |
| 26 | Alquimia | `alquimia` | Genialidade | Identificar e preparar poções, venenos e reagentes. |
| 27 | Engenharia | `engenharia` | Genialidade | Projetar, entender e consertar máquinas e mecanismos. |
| 28 | Arquitetura | `arquitetura` | Genialidade | Entender construções, estruturas e seus pontos fracos. |
| 29 | Matemática | `matematica` | Genialidade | Fazer cálculos e resolver problemas lógicos. |
| 30 | Linguística | `linguistica` | Genialidade | Entender idiomas, dialetos e escritas desconhecidas. |
| 31 | Estratégia militar | `estrategiaMilitar` | Genialidade | Planejar batalhas e ler táticas inimigas. |
| 32 | Tecnologia | `tecnologia` | Genialidade | Entender e operar dispositivos avançados. |

### Sociais

| Nº | Perícia | Chave | Atributo | Descrição sugerida |
| --- | --- | --- | --- | --- |
| 33 | Intimidação | `intimidacao` | Encanto | Impor medo por presença ou ameaça. |
| 34 | Enganação | `enganacao` | Encanto | Mentir e convencer alguém do que é falso. |
| 35 | Atuação | `atuacao` | Encanto | Interpretar um papel ou emoção de forma convincente. |
| 36 | Etiqueta | `etiqueta` | Encanto | Seguir costumes e se portar bem em cada meio social. |
| 37 | Liderança | `lideranca` | Encanto | Inspirar e coordenar um grupo. |
| 38 | Interrogatório | `interrogatorio` | Encanto | Extrair informação de quem não quer falar. |
| 39 | Sedução | `seducao` | Encanto | Usar charme e atração para influenciar alguém. |
| 40 | Negociação | `negociacao` | Encanto | Barganhar preços, acordos e tréguas. |
| 41 | Disfarce | `disfarce` | Encanto | Mudar a aparência para se passar por outra pessoa. |
| 42 | Domesticação | `domesticacao` | Encanto | Acalmar, treinar e conduzir animais. |

### Exploração e utilidade

| Nº | Perícia | Chave | Atributo | Descrição sugerida |
| --- | --- | --- | --- | --- |
| 43 | Rastreamento | `rastreamento` | Determinação | Seguir pegadas e sinais de passagem. |
| 44 | Caça | `caca` | Genialidade | Localizar, emboscar e abater presas. |
| 45 | Arrombamento | `arrombamento` | Destreza | Abrir fechaduras e passar por trancas. |
| 46 | Truques | `truques` | Destreza | Fazer prestidigitação e pequenos golpes de mão. |
| 47 | Pilotagem | `pilotagem` | Destreza | Conduzir veículos e embarcações. |
| 48 | Sorte | `sorte` | — | Contar com o acaso quando nenhuma outra perícia se aplica. |

### Profissões e ofícios

| Nº | Perícia | Chave | Atributo | Descrição sugerida |
| --- | --- | --- | --- | --- |
| 49 | Profissão | `profissao` | Genialidade | Exercer um ofício escolhido pelo personagem. |
| 50 | Música | `musica` | Determinação | Tocar instrumentos, cantar e compor. |
| 51 | Dança | `danca` | Destreza | Dançar com técnica, em apresentações ou eventos. |
| 52 | Escultura | `escultura` | Determinação | Criar e avaliar obras em pedra, madeira ou argila. |
| 53 | Criptografia | `criptografia` | Genialidade | Criar e decifrar códigos e mensagens secretas. |
| 54 | Conhecimento de criaturas | `conhecimentoCriaturas` | Genialidade | Identificar criaturas, seus hábitos e fraquezas. |
| 55 | Conhecimento de artefatos | `conhecimentoArtefatos` | Genialidade | Reconhecer artefatos, sua origem e sua função. |
| 56 | Metalúrgica | `metalurgica` | Genialidade | Trabalhar metais e forjar peças. |

## Decisões sobre o documento do sistema

O documento e o código divergiam nestes pontos. Qualquer decisão pode mudar depois.

| Assunto | Decisão |
| --- | --- |
| Vida por estágio do núcleo | Saiu, por decisão de quem criou o sistema |
| Dado adicional por perícia | Saiu: virou vantagem por atributo, por decisão de quem criou o sistema |
| Sorte | Segue o código: existe, e o documento não a citava |
| Perícias adicionais | Foram distribuídas: Encantar e Extração de núcleo em Magia, Tecnologia em Conhecimento, Metalúrgica em Profissões e ofícios, Sorte em Exploração e utilidade |
| Classe Magia | Criada a pedido, com as perícias mágicas que estavam em Profissões e ofícios |
| Perícias 5 a 12 | Não existem, e a numeração passou a ser corrida |
