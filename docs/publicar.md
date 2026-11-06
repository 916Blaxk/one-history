# Publicar o One History

O site roda como um único serviço Node, com banco no Turso. Depois de configurado, cada envio para a branch `main` publica o site sozinho.

Os nomes de botões do Railway e do Turso podem mudar. Se algo estiver diferente, procure pelo mesmo conceito.

## 1. Banco no Turso

1. Crie uma conta em [turso.tech](https://turso.tech) e crie um banco, na região mais próxima dos jogadores.
2. Anote a URL do banco, que começa com `libsql://`, e gere um token de acesso.
3. Guarde o token só nas variáveis da hospedagem. Ele dá acesso total ao banco, então não o coloque no GitHub nem em conversas.

## 2. Levar os dados atuais

Faça isto no PC que tem `dados/one-history.db`, com o site parado. O banco de origem só é lido, e a cópia se recusa a gravar em um destino que já tenha dados.

```bash
DESTINO_TOKEN=seu-token node scripts/copiar-banco.mjs file:dados/one-history.db libsql://seu-banco.turso.io
```

No PowerShell, defina antes a variável com `$env:DESTINO_TOKEN = 'seu-token'`.

Se não houver dados para levar, pule este passo: as tabelas são criadas ao iniciar o site.

## 3. Site no Railway

1. Crie uma conta em [railway.com](https://railway.com) e autorize o acesso ao repositório `916Blaxk/one-history`.
2. Crie um projeto a partir desse repositório, usando a branch `main`. Os comandos de build e início já estão em `railway.json`.
3. Defina as variáveis:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | A URL `libsql://` do Turso |
| `DATABASE_AUTH_TOKEN` | O token do Turso |

4. Não defina `NODE_ENV=production` nas variáveis: o build precisa das dependências de desenvolvimento, e o servidor já define esse valor ao iniciar.
5. Mantenha **uma única instância**, sem escala automática. Duas instâncias teriam mesas diferentes na memória.
6. Gere um domínio público para o serviço. Ele já vem com HTTPS, que protege as senhas e o cookie.

## 4. Conferir

1. Crie uma conta e uma campanha, e entre na mesa.
2. Veja se o indicador mostra **Conectado**.
3. Mova um token, recarregue a página e confira se ele continua no lugar.
4. Faça uma sessão de teste com os jogadores antes de usar valendo.

Se o indicador não conectar, confira se a hospedagem aceita WebSocket. Sem isso, o Socket.IO continua funcionando por requisições HTTP, com mais demora.

## Atualizar depois

Envie o código para a `main`. O Railway recompila e publica em alguns minutos. Migrações novas rodam ao iniciar, antes de o site abrir.

Evite publicar durante uma sessão: o site fica fora por alguns instantes, e a mesa reconecta sozinha ao voltar.

## Ver e editar os dados

Use o painel do Turso, ou `turso db shell nome-do-banco` no terminal.

- **Campo `dados` das fichas:** é um JSON. Uma edição errada pode alterar ou apagar valores quando o site reprocessar a ficha.
- **Tabela `mesas`:** edite só com a mesa fechada há mais de 30 minutos ou com o site parado. O estado de uma mesa aberta fica na memória e sobrescreve o banco.
- **Antes de mudanças grandes:** faça uma cópia, como abaixo.

## Backup

Com Turso, confira no painel quais cópias o plano oferece. Para guardar uma cópia no seu computador:

```bash
ORIGEM_TOKEN=seu-token node scripts/copiar-banco.mjs libsql://seu-banco.turso.io file:copias/one-history-AAAAMMDD.db
```

O arquivo contém as contas e as fichas de todos, então não o coloque no GitHub. Este repositório é público.

Para restaurar, copie o arquivo para um banco novo e vazio com o mesmo comando, invertendo origem e destino, e aponte `DATABASE_URL` para ele.

## Alternativa: banco em volume

Sem Turso, crie um volume permanente no Railway e use `DATABASE_URL=file:/caminho/do/volume/one-history.db`. Cada gravação fica mais rápida, porque não passa pela rede, mas ver e editar os dados fica mais difícil.

Nesse caso, o servidor faz uma cópia por dia em `backups/`, na mesma pasta do banco, e guarda as 7 mais recentes. Defina `BACKUP_DIR` para usar outra pasta. Essas cópias ficam no mesmo volume, então baixe uma de vez em quando.
