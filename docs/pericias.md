# Perícias

Os nomes, as chaves e as regras vêm de `lib/regras.ts` e `lib/servidor/rotas.ts`. Se mudar uma perícia lá, atualize este documento.

As descrições são sugestões e ainda não aparecem na ficha, porque o código guarda só o nome de cada perícia. Elas não mudam nenhuma regra e podem ser trocadas.

A numeração segue o documento do sistema, que pula de 4 para 13. Os números 5 a 12 não têm perícia no documento nem no código.

## Como funcionam

- **Valor:** cada perícia guarda um valor por ficha, que começa em 0.
- **Rolagem:** rolar uma perícia é sempre d20 + o valor guardado na ficha. O servidor lê o valor, e o navegador não escolhe o bônus.
- **SP:** a soma dos valores de todas as perícias é o SP gasto. O SP total vem do estágio do núcleo mais o ajuste do mestre.
- **Travas do jogador:** o jogador não sobe uma perícia além do SP total nem do limite que o mestre definir para ela.
- **Mestre:** o mestre pode deixar um valor acima do limite. Depois disso, o jogador só pode baixar esse valor.

## SP por estágio do núcleo

Cada estágio soma ao que os anteriores já deram.

| Estágio | SP do estágio | SP acumulado |
| --- | --- | --- |
| Vermelho escuro | 15 | 15 |
| Vermelho sólido | 5 | 20 |
| Vermelho claro | 5 | 25 |
| Laranja escuro | 7 | 32 |
| Laranja sólido | 7 | 39 |
| Laranja claro | 7 | 46 |
| Amarelo escuro | 10 | 56 |
| Amarelo sólido | 10 | 66 |
| Amarelo claro | 10 | 76 |
| Prata escuro | 15 | 91 |
| Prata fosco | 15 | 106 |
| Prata brilhante | 15 | 121 |
| Branco | 40 | 161 |

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
| 13 | Acrobacia | `acrobacia` | Saltar, rolar e fazer manobras corporais. |
| 14 | Escalada | `escalada` | Subir muros, árvores e encostas. |
| 15 | Natação | `natacao` | Nadar, mergulhar e resistir a correntezas. |
| 16 | Corrida | `corrida` | Correr rápido e manter o ritmo em perseguições. |
| 17 | Equilíbrio | `equilibrio` | Manter-se de pé em superfícies estreitas ou instáveis. |
| 18 | Furtividade | `furtividade` | Mover-se sem ser visto ou ouvido. |
| 19 | Sobrevivência | `sobrevivencia` | Achar abrigo, água e caminho em ambientes hostis. |

### Conhecimento

| Nº | Perícia | Chave | Descrição sugerida |
| --- | --- | --- | --- |
| 20 | História | `historia` | Conhecer eventos, povos e figuras do passado. |
| 21 | Geografia | `geografia` | Conhecer regiões, rotas, climas e mapas. |
| 22 | Religião | `religiao` | Conhecer crenças, cultos, ritos e símbolos sagrados. |
| 23 | Mitologia | `mitologia` | Conhecer lendas, deuses e contos antigos. |
| 24 | Investigação | `investigacao` | Procurar pistas e deduzir o que aconteceu. |
| 25 | Medicina | `medicina` | Diagnosticar e tratar ferimentos e doenças sem magia. |
| 26 | Alquimia | `alquimia` | Identificar e preparar poções, venenos e reagentes. |
| 27 | Engenharia | `engenharia` | Projetar, entender e consertar máquinas e mecanismos. |
| 28 | Arquitetura | `arquitetura` | Entender construções, estruturas e seus pontos fracos. |
| 29 | Matemática | `matematica` | Fazer cálculos e resolver problemas lógicos. |
| 30 | Linguística | `linguistica` | Entender idiomas, dialetos e escritas desconhecidas. |
| 31 | Estratégia militar | `estrategiaMilitar` | Planejar batalhas e ler táticas inimigas. |

### Sociais

| Nº | Perícia | Chave | Descrição sugerida |
| --- | --- | --- | --- |
| 32 | Intimidação | `intimidacao` | Impor medo por presença ou ameaça. |
| 33 | Enganação | `enganacao` | Mentir e convencer alguém do que é falso. |
| 34 | Atuação | `atuacao` | Interpretar um papel ou emoção de forma convincente. |
| 35 | Etiqueta | `etiqueta` | Seguir costumes e se portar bem em cada meio social. |
| 36 | Liderança | `lideranca` | Inspirar e coordenar um grupo. |
| 37 | Interrogatório | `interrogatorio` | Extrair informação de quem não quer falar. |
| 38 | Sedução | `seducao` | Usar charme e atração para influenciar alguém. |
| 39 | Negociação | `negociacao` | Barganhar preços, acordos e tréguas. |
| 40 | Disfarce | `disfarce` | Mudar a aparência para se passar por outra pessoa. |
| 41 | Domesticação | `domesticacao` | Acalmar, treinar e conduzir animais. |

### Exploração e utilidade

| Nº | Perícia | Chave | Descrição sugerida |
| --- | --- | --- | --- |
| 42 | Rastreamento | `rastreamento` | Seguir pegadas e sinais de passagem. |
| 43 | Caça | `caca` | Localizar, emboscar e abater presas. |
| 44 | Arrombamento | `arrombamento` | Abrir fechaduras e passar por trancas. |
| 45 | Truques | `truques` | Fazer prestidigitação e pequenos golpes de mão. |
| 46 | Pilotagem | `pilotagem` | Conduzir veículos e embarcações. |

### Profissões e ofícios

| Nº | Perícia | Chave | Descrição sugerida |
| --- | --- | --- | --- |
| 47 | Profissão | `profissao` | Exercer um ofício escolhido pelo personagem. |
| 48 | Música | `musica` | Tocar instrumentos, cantar e compor. |
| 49 | Dança | `danca` | Dançar com técnica, em apresentações ou eventos. |
| 50 | Escultura | `escultura` | Criar e avaliar obras em pedra, madeira ou argila. |
| 51 | Criptografia | `criptografia` | Criar e decifrar códigos e mensagens secretas. |
| 52 | Conhecimento de criaturas | `conhecimentoCriaturas` | Identificar criaturas, seus hábitos e fraquezas. |
| 53 | Conhecimento de artefatos | `conhecimentoArtefatos` | Reconhecer artefatos, sua origem e sua função. |
| 54 | Canalização mágica | `canalizacaoMagica` | Conduzir mana pelo corpo ou por um objeto com estabilidade. |
| 55 | Controle de mana | `controleMana` | Dosar a mana e evitar desperdício ou descontrole. |
| 56 | Ritualística | `ritualistica` | Conduzir rituais e entender seus círculos e etapas. |
| 57 | Identificação mágica | `identificacaoMagica` | Reconhecer magias, encantamentos e seus efeitos. |
| 58 | Resistência espiritual | `resistenciaEspiritual` | Resistir a influências sobre a mente e o espírito. |

### Perícias adicionais

| Nº | Perícia | Chave | Descrição sugerida |
| --- | --- | --- | --- |
| 59 | Encantar | `encantar` | Imbuir objetos com efeitos mágicos. |
| 60 | Tecnologia | `tecnologia` | Entender e operar dispositivos avançados. |
| 61 | Extração de núcleo | `extracaoNucleo` | Retirar o núcleo de uma criatura sem danificá-lo. |
| 62 | Metalúrgica | `metalurgica` | Trabalhar metais e forjar peças. |
| Sem número | Sorte | `sorte` | Contar com o acaso quando nenhuma outra perícia se aplica. |

## Diferenças entre o documento do sistema e o código

Nenhuma destas diferenças foi alterada no código. Falta decidir qual lado vale em cada uma.

| Assunto | Documento | Código |
| --- | --- | --- |
| Perícias 5 a 12 | A numeração pula de 4 para 13 | Não existem |
| Sorte | Não aparece | Existe |
| Encantar, Tecnologia, Extração de núcleo e Metalúrgica | Em "Profissões e ofícios" | Em "Perícias adicionais" |
| PV por estágio do núcleo | +2, +2, +3, +3, +3, +5, +5, +5, +10, +10, +10 e +40 | Não soma: a vida é 15 + vitalidade × 2 + ajuste do mestre |
| Vermelho escuro | "Nenhum efeito" | Dá 15 SP |
| Dado adicional por perícia (1–5: 1d2, 6–10: 1d4, 11–15: 1d6, 16–20: 1d8, 21–25: 1d10) | Existe | Não existe: a rolagem é só d20 + valor |
