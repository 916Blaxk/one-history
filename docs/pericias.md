# Perícias

Os nomes, as chaves e as regras vêm de `lib/regras.ts` e `lib/servidor/rotas.ts`. Se mudar uma perícia lá, atualize este documento.

As descrições aparecem na ficha e ficam em `PERICIAS`, em `lib/regras.ts`. Elas são sugestões, não mudam nenhuma regra e podem ser trocadas.

A numeração é corrida, na ordem do código. O documento do sistema pulava de 4 para 13, e ficou decidido que não há perícias nesses números.

## Como funcionam

- **Valor:** cada perícia guarda um valor por ficha, que começa em 0.
- **Treino e Outros:** Treino é o valor da perícia e gasta PP. Outros é um bônus livre, sem gastar PP.
- **Rolagem:** rolar uma perícia é d20 com a vantagem do atributo + bônus (Treino + Outros). O servidor lê os valores, e o navegador não escolhe o bônus.
- **Atributo:** cada perícia usa o atributo da lista do sistema, que dá vantagem, mas o valor dele não soma no resultado. Sorte é sem atributo e rola sem vantagem.
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
| Vida por estágio do núcleo | Saiu, por decisão de quem criou o sistema |
| Dado adicional por perícia | Saiu: virou vantagem por atributo, por decisão de quem criou o sistema |
| Sorte | Segue o código: existe, e o documento não a citava |
| Perícias adicionais | Foram distribuídas: Encantar e Extração de núcleo em Magia, Tecnologia em Conhecimento, Metalúrgica em Profissões e ofícios, Sorte em Exploração e utilidade |
| Classe Magia | Criada a pedido, com as perícias mágicas que estavam em Profissões e ofícios |
| Perícias 5 a 12 | Não existem, e a numeração passou a ser corrida |
