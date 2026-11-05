# Contrato de integração com o Tablebola

Como o Tablebola lê uma ficha do One History, atualiza vida e mana e recebe pedidos de rolagem. A versão atual do formato é `schemaVersion: 1`.

## Regras gerais

- **Quem rola é o Tablebola.** A ficha só entrega a expressão de dados. Ela nunca decide o resultado dentro da sala.
- **O token guarda só o id da ficha** (`characterId`). O id sozinho não abre nada.
- **O acesso vem de uma chave de integração**, criada pelo dono da ficha. O Tablebola não tem login, então ser GM da sala não comprova nada para este site. Para o GM ler a ficha, o dono entrega uma chave a ele.
- **A chave nunca vai para o token nem para o estado da sala.** Guarde-a no navegador de quem a recebeu.

## Configuração

| Variável | Onde | Valor |
|---|---|---|
| `ORIGENS_TABLEBOLA` | Site de fichas | Origens exatas separadas por vírgula, como `https://table-bola.vercel.app,http://localhost:5173` |

Só valem `https` e, em `localhost` e `127.0.0.1`, `http`. Curinga, caminho e barra final invalidam a entrada. Vazia, nenhuma origem é aceita. Depois de mudar a variável, reinicie o servidor; não é preciso compilar de novo.

## Chaves de integração

O dono cria e revoga as chaves no painel **Integração com o Tablebola**, na própria ficha. As rotas abaixo usam a sessão do dono e não aceitam outra origem.

| Método e rota | Corpo | Resposta |
|---|---|---|
| `GET /api/fichas/:id/chaves` | | `{ chaves: [{ id, rotulo, criadoEm }] }` |
| `POST /api/fichas/:id/chaves` | `{ rotulo }` | `{ chave, segredo }`, com status 201 |
| `DELETE /api/fichas/:id/chaves/:chaveId` | `{}` | `{ ok: true }` |

- O `segredo` aparece uma única vez. O banco guarda só o hash.
- Cada ficha tem no máximo 10 chaves.
- Revogar vale no pedido seguinte. Apagar a ficha ou a conta apaga as chaves.
- **Quem tem a chave lê a ficha inteira, inclusive inventário e anotações, e altera vida e mana atuais.** Ela não altera mais nada.

## API

Envie `Authorization: Bearer <segredo>`. Todo pedido com corpo precisa de `Content-Type: application/json`.

| Método e rota | Uso |
|---|---|
| `GET /api/integracao/fichas/:id/resumo` | Resumo leve, para consultar a cada 3 s |
| `GET /api/integracao/fichas/:id/retrato` | Imagem do retrato |
| `PATCH /api/integracao/fichas/:id/recursos` | Atualiza vida e mana atuais |
| `GET /api/integracao/fichas/:id` | Ficha completa, usada pela tela embutida |

### Permissões

| Situação | Status |
|---|---|
| Chave certa para esta ficha | 200 |
| Chave errada, revogada ou de outra ficha | 404 |
| Sem chave nem sessão | 401 |
| Sessão de quem pode editar a ficha (dono ou mestre), só em pedido do próprio site | 200 |
| Sessão de outra pessoa | 404 |
| Origem fora de `ORIGENS_TABLEBOLA` | 403 |

As origens da lista recebem `Access-Control-Allow-Origin` só nestas rotas, sem `Allow-Credentials`. As demais rotas do site continuam fechadas para outras origens.

### Resumo

```json
{
  "schemaVersion": 1,
  "id": "fePOeHPjmFKtn",
  "nome": "Kael",
  "atualizado": 1793900000000,
  "retrato": { "versao": 1793900000000, "url": "/api/integracao/fichas/fePOeHPjmFKtn/retrato" },
  "recursos": [
    { "id": "vida", "rotulo": "Vida", "atual": 10, "max": 25 },
    { "id": "mana", "rotulo": "Mana", "atual": 51, "max": 51 }
  ],
  "acoes": [
    { "id": "pericias.esquiva", "grupo": "pericias", "categoria": "Combate", "rotulo": "Esquiva", "valor": 4, "expressao": "1d20+4" }
  ],
  "magias": [
    { "id": "m1", "nome": "Faísca", "elemento": "fogo", "custo": 3 }
  ]
}
```

- `retrato` é `null` quando não há foto. A `url` é relativa ao site de fichas e exige a chave, então uma tag `<img>` não consegue usá-la: busque com `fetch` e mostre o `blob`.
- `acoes` traz as 73 rolagens da ficha.
- `expressao` é sempre `1d20`, `1d20+N` ou `1d20-N`. As rolagens da ficha são d20 mais o valor, e esse formato é válido no chat do Tablebola.
- `magias[].custo` já desconta o gasto universal de mana do núcleo.
- `atualizado` só cresce. Use-o para ignorar uma resposta antiga.

### Atualizar recursos

```http
PATCH /api/integracao/fichas/:id/recursos
Authorization: Bearer <segredo>
Content-Type: application/json

{ "vidaAtual": 10 }
```

- Aceita `vidaAtual`, `manaAtual` ou os dois, como inteiros de 0 a 999999. Qualquer outro campo ou valor recebe 400.
- Acima do máximo da ficha, o valor é cortado no máximo. Use o valor da resposta, e não o enviado.
- O máximo não muda por esta rota. Só a ficha o define.
- Resposta: `{ recursos, atualizado, ficha }`.

### Tempo real

A atualização é por consulta. Com a ficha aberta, a tela do site lê a cada 3 s, e o Tablebola deve fazer o mesmo com o resumo. A mudança aparece em até 3 s nos dois lados. Com a ficha embutida aberta, a mensagem `oh:recursos` avisa antes disso.

## Modo embutido

```text
{site de fichas}/embutido/fichas/:id#chave=<segredo>
```

- A chave vai no fragmento (`#`), que não é enviado ao servidor nem em `Referer`.
- Só esta rota aceita iframe, e só das origens da lista (`frame-ancestors`). As outras páginas continuam com `frame-ancestors 'none'`.
- Sem menu, chat, duplicar, apagar, trocar foto, encerrar cena ou edição de ficha. Só vida e mana mudam, inclusive ao conjurar uma magia.

### Mensagens (`postMessage`)

1. O Tablebola envia `tablebola:ola` ao iframe, repetindo a cada 200 ms até receber `oh:pronto`, porque o iframe pode ainda estar carregando.
2. A ficha confere se a mensagem veio da janela pai e de origem da lista. Caso contrário, ignora.
3. A ficha passa a falar só com essa origem, nunca com `*`.

| Direção | Mensagem |
|---|---|
| Tablebola para ficha | `{ tipo: 'tablebola:ola' }` |
| Ficha para Tablebola | `{ tipo: 'oh:pronto', schemaVersion, fichaId }` |
| Ficha para Tablebola | `{ tipo: 'oh:rolagem', schemaVersion, fichaId, acao, rotulo, expressao }` |
| Ficha para Tablebola | `{ tipo: 'oh:recursos', schemaVersion, fichaId, recursos }` |

O Tablebola **deve** conferir `event.origin` contra a origem do site de fichas e `event.source` contra o iframe. Depois deve mandar `expressao` ao próprio servidor, que valida e sorteia. Não confie no conteúdo só por ter vindo do iframe.

Sem o aperto de mão, clicar em rolar não envia nada e a ficha avisa que não está conectada.

## Compatibilidade do `schemaVersion`

- **Sem mudar a versão:** acrescentar campo novo. O Tablebola deve ignorar o que não conhece.
- **Subindo a versão:** remover ou renomear campo, mudar tipo ou significado, ou mudar o formato de `expressao`.
- **Versão maior que a conhecida:** o Tablebola não usa os dados, mostra um aviso e mantém o token como está.
- Mudança que sobe a versão também atualiza este documento.

## Limitações conhecidas

- **Rede local:** o navegador bloqueia iframe de um site público para um endereço local (`ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`). Teste com os dois em `localhost` ou com os dois publicados. O site na Vercel não embute uma ficha rodando na sua máquina.
- **Publicação:** o site de fichas precisa de `https` e de um banco permanente (veja o `README.md`) para ser usado de fora.
- **Última gravação vence:** vida e mana são valores absolutos. Se a ficha e a sala mudarem o mesmo recurso ao mesmo tempo, fica o último.

## Como trocar a forma de acesso

Toda a decisão de acesso está na função `autorizarIntegracao`, em `lib/servidor/rotas.ts`. Para usar outro modelo, como login no Tablebola ou Supabase, troque essa função. O resumo, as expressões e as mensagens não dependem dela.
