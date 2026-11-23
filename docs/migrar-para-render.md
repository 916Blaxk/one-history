# Migrar do Railway para o Render + Turso

Guia para tirar o site do Railway e colocá-lo de graça no Render, com o banco no Turso. Escrito em 23 de novembro de 2026.

**Por quê:** o Railway cobra. O plano grátis do Render, junto com o Turso, não cobra nada e não pede cartão.

**O que muda para os jogadores:** o endereço do site muda. Depois de 15 minutos sem ninguém usar, o servidor dorme, e o primeiro acesso leva cerca de 1 minuto para abrir. A mesa reconecta sozinha quando ele volta.

**Ordem obrigatória:** copie os dados para o Turso **antes** de criar o serviço no Render. O build do Render roda as migrações e cria as tabelas no Turso. Depois disso, a cópia se recusa a gravar, para não apagar dados de verdade.

O `render.yaml` na raiz do repositório já tem toda a configuração do Render. Os nomes de botões dos painéis podem mudar. Se algo estiver diferente, procure pelo mesmo conceito.

## 1. Criar o banco no Turso

1. Crie a conta em https://turso.tech, entrando com o GitHub.
2. Crie um banco chamado `one-history`, na região **AWS us-east-1 (Virginia)**. É a mesma região do Render, então cada consulta fica rápida.
3. Anote a URL do banco, que começa com `libsql://`.
4. Gere um token do banco, sem data de validade, e guarde num lugar seguro. Ele dá acesso total aos dados. Não coloque no GitHub, que é público, nem em conversas.

## 2. Instalar e entrar no Railway CLI

No PowerShell:

```powershell
npm install -g @railway/cli
railway login
```

O `railway login` abre o navegador para autorizar. Sem navegador, use `railway login --browserless`, que mostra um link e um código.

Depois, ligue a pasta do projeto ao serviço do Railway:

```powershell
cd caminho\do\one-history
railway link
```

Escolha o projeto e o serviço do One History. Para conferir, rode `railway status`.

## 3. Copiar os dados do Railway para o Turso

1. Avise os jogadores e combine um horário sem ninguém no site. Tudo o que for gravado depois da cópia fica só no Railway e se perde.
2. Abra um terminal dentro do servidor do Railway:

   ```powershell
   railway ssh
   ```

3. Já dentro do servidor, rode os comandos abaixo. O `read -s` pede o token sem mostrar o que você digita e sem gravá-lo no histórico. Cole o token do Turso e aperte Enter.

   ```sh
   read -s DESTINO_TOKEN && export DESTINO_TOKEN
   node scripts/copiar-banco.mjs file:/data/one-history.db libsql://SEU-BANCO.turso.io
   ```

   Troque `libsql://SEU-BANCO.turso.io` pela URL do passo 1. O banco do Railway só é lido, nunca alterado.

4. Saia com `exit`.

Se aparecer `O destino já tem dados`, o banco do Turso não está vazio. Isso acontece se o Render já rodou antes da cópia. Nesse caso, apague o banco no painel do Turso, crie de novo vazio e repita este passo.

Para conferir, abra o banco no painel do Turso, vá no editor de SQL e rode `SELECT count(*) FROM usuarios;` e `SELECT count(*) FROM fichas;`. Os números devem bater com o site atual.

## 4. Criar o site no Render

1. Crie a conta em https://render.com, entrando com o GitHub, e libere o acesso ao repositório `916Blaxk/one-history`.
2. No painel, vá em **New > Blueprint** e escolha o repositório `916Blaxk/one-history`, branch `main`.
3. O Render lê o `render.yaml` e pede duas variáveis:

   | Variável | Valor |
   |---|---|
   | `DATABASE_URL` | A URL `libsql://` do Turso |
   | `DATABASE_AUTH_TOKEN` | O token do banco no Turso |

4. Confirme e espere o primeiro deploy, que leva alguns minutos. O log deve terminar com `One History em http://localhost:...`.
5. O endereço do site aparece no topo do serviço, algo como `https://one-history.onrender.com`.

Não defina `NODE_ENV=production`, porque o build precisa das dependências de desenvolvimento. Não aumente o número de instâncias: duas instâncias teriam mesas diferentes na memória.

## 5. Conferir

1. Entre com uma conta que já existia e veja se as fichas e campanhas estão lá.
2. Abra a mesa de uma campanha e veja se o indicador mostra **Conectado**.
3. Mova um token, recarregue a página e confira se ele continua no lugar.
4. Deixe o site parado por 20 minutos e abra de novo. Deve levar cerca de 1 minuto e depois funcionar normalmente.

## 6. Trocar de vez

1. Passe o endereço novo aos jogadores.
2. Antes de desligar o Railway, guarde uma cópia do banco do Railway no seu computador. Siga **Download automático** em [publicar.md](publicar.md), ou baixe pelo `railway ssh`.
3. No painel do Railway, pare o serviço. Espere alguns dias com o Render funcionando e só então apague o projeto e o volume.
4. **Backup automático:** a tarefa `One History - baixar backup` do Agendador de Tarefas usa o `railway ssh`, e vai falhar depois que o Railway sair. Apague a tarefa e passe a copiar do Turso, no PowerShell:

   ```powershell
   $env:ORIGEM_TOKEN = 'token-do-turso'
   node scripts/copiar-banco.mjs libsql://SEU-BANCO.turso.io file:copias/one-history-AAAAMMDD.db
   ```

   O arquivo contém as contas e as fichas de todos. Não o coloque no GitHub.
5. Atualize [proximos-passos.md](proximos-passos.md) e [publicar.md](publicar.md) com o endereço novo e o banco no Turso.

## Se der errado

- **O build falha no Render por falta de memória:** o plano grátis tem 512 MB. Veja o log do build e procure por `JavaScript heap out of memory`.
- **O site abre, mas sem dados:** confira se `DATABASE_URL` aponta para o banco certo do Turso, e não para um banco novo.
- **Voltar para o Railway:** enquanto o serviço e o volume do Railway existirem, basta religá-lo e passar o endereço antigo de novo. O que foi gravado no Render fica só no Turso.
