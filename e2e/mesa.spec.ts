import { expect, test, type Browser, type Page } from '@playwright/test';

let seq = 0;
const unico = () => `${Date.now()}-${++seq}`;

async function novaPessoa(browser: Browser, nome: string): Promise<Page> {
  const contexto = await browser.newContext();
  const pagina = await contexto.newPage();
  await pagina.goto('/entrar');
  await pagina.getByRole('tab', { name: 'Criar conta' }).click();
  await pagina.getByLabel('Seu nome na mesa').fill(nome);
  await pagina.getByLabel('E-mail').fill(`${unico()}@exemplo.com`);
  await pagina.getByLabel(/^Senha/).fill('senha-forte-1');
  await pagina.getByRole('button', { name: 'Criar conta', exact: true }).last().click();
  await expect(pagina.getByRole('heading', { name: 'Minhas fichas' })).toBeVisible();
  return pagina;
}

async function criarFicha(p: Page, nome: string) {
  await p.getByRole('button', { name: /Nova ficha|Criar a primeira ficha/ }).first().click();
  await expect(p.getByLabel('Nome', { exact: true })).toBeVisible();
  await p.getByLabel('Nome', { exact: true }).fill(nome);
  await expect(p.getByRole('heading', { name: nome })).toBeVisible();
  await expect(p.getByRole('status').filter({ hasText: 'Salvo' })).toBeVisible();
}

/* Monta a mesa pela API: estes testes são sobre a ficha, não sobre o fluxo de convite. */
async function levarFichaParaMesa(mestre: Page, jogador: Page, nomeCampanha: string) {
  const fichaId = jogador.url().split('/').pop()!;
  const { campanha } = await (await mestre.request.post('/api/campanhas', { data: { nome: nomeCampanha, descricao: '' } })).json();
  const detalhe = await (await mestre.request.get(`/api/campanhas/${campanha.id}`)).json();
  await jogador.request.post(`/api/convites/${detalhe.campanha.codigo}/entrar`, { data: {} });
  await jogador.request.post(`/api/campanhas/${campanha.id}/fichas`, { data: { fichaId } });
  return fichaId;
}

test('sem login, a página pedida volta depois de entrar', async ({ browser }) => {
  const p = await (await browser.newContext()).newPage();
  await p.goto('/campanhas');
  await expect(p).toHaveURL(/\/entrar\?destino=%2Fcampanhas/);
  await p.getByRole('tab', { name: 'Criar conta' }).click();
  await p.getByLabel('Seu nome na mesa').fill('Volta');
  await p.getByLabel('E-mail').fill(`${unico()}@exemplo.com`);
  await p.getByLabel(/^Senha/).fill('senha-forte-1');
  await p.getByRole('button', { name: 'Criar conta', exact: true }).last().click();
  await expect(p).toHaveURL(/\/campanhas$/);
});

test('senha errada mostra o motivo e não entra', async ({ page }) => {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('ninguem@exemplo.com');
  await page.getByLabel(/^Senha/).fill('qualquer-coisa');
  await page.getByRole('button', { name: 'Entrar', exact: true }).last().click();
  await expect(page.getByRole('alert').filter({ hasText: 'E-mail ou senha incorretos.' })).toBeVisible();
});

test('ficha: vida e mana seguem as fórmulas, editar salva e sobrevive a recarregar', async ({ browser }) => {
  const p = await novaPessoa(browser, 'Ana');
  await criarFicha(p, 'Mirela');
  await p.getByRole('button', { name: 'Aumentar Vitalidade' }).click();
  await p.getByRole('button', { name: 'Aumentar Vitalidade' }).click();
  await expect(p.getByText('15 + vitalidade 2 × 2 = 19')).toBeVisible();
  await expect(p.locator('#v-vidaAtual')).toHaveValue('19');

  /* Digitar em tenacidade não mexe na vida. */
  await p.locator('#a-corpo-tenacidade').fill('9');
  await p.locator('#a-corpo-tenacidade').press('Enter');
  await expect(p.getByText('15 + vitalidade 2 × 2 = 19')).toBeVisible();

  await p.locator('#a-mente-onipotencia').fill('7');
  await p.locator('#a-mente-onipotencia').press('Enter');
  await p.locator('label.tier').filter({ hasText: 'Tier 2' }).click();
  await expect(p.getByText(/30 \+ onipotência 7 × 2,3 \(tier 2\) = 46/)).toBeVisible();
  await expect(p.locator('#v-manaAtual')).toHaveValue('46');

  await p.getByRole('button', { name: '−5' }).first().click();
  await expect(p.locator('#v-vidaAtual')).toHaveValue('14');
  await expect(p.getByRole('status').filter({ hasText: 'Salvo' })).toBeVisible();
  await p.waitForTimeout(900);
  await p.reload();
  await expect(p.locator('#v-vidaAtual')).toHaveValue('14');
  await expect(p.locator('#a-corpo-tenacidade')).toHaveValue('9');
  await expect(p.getByRole('heading', { name: 'Mirela' })).toBeVisible();
});

test('fadiga: encerrar cena reduz a mana total de vez e 100% esconde o nome', async ({ browser }) => {
  const p = await novaPessoa(browser, 'Bia');
  await criarFicha(p, 'Kael');
  await p.locator('#a-mente-onipotencia').fill('7');
  await p.locator('#a-mente-onipotencia').press('Enter');
  await p.locator('label.tier').filter({ hasText: 'Tier 2' }).click();
  await expect(p.locator('#v-manaAtual')).toHaveValue('46');

  await p.getByRole('button', { name: /^80%/ }).click();
  await expect(p.locator('article.ficha')).toHaveAttribute('data-estagio', '80');
  await p.getByRole('button', { name: 'Encerrar cena: −9 de mana total' }).click();
  await expect(p.getByText(/menos 9 perdida = 37/)).toBeVisible();
  await expect(p.locator('#v-manaAtual')).toHaveValue('37');
  await expect(p.getByLabel('Mana total perdida para sempre')).toHaveValue('9');

  await p.getByRole('button', { name: /^99%/ }).click();
  await expect(p.locator('.fenda')).toBeVisible();
  await p.getByRole('button', { name: /^100%/ }).click();
  await expect(p.getByRole('heading', { name: '???' })).toBeVisible();
  await expect(p.getByLabel('Nome', { exact: true })).toHaveValue('Kael');

  /* A correção manual da perda continua possível. */
  await p.getByRole('button', { name: /^00%/ }).click();
  await expect(p.getByRole('heading', { name: 'Kael' })).toBeVisible();
  await p.getByLabel('Mana total perdida para sempre').fill('0');
  await p.getByLabel('Mana total perdida para sempre').press('Enter');
  await expect(p.getByText(/= 46$/)).toBeVisible();
});

test('rolar atributo mostra d20 + valor', async ({ browser }) => {
  const p = await novaPessoa(browser, 'Cid');
  await criarFicha(p, 'Rola');
  await p.locator('#a-corpo-destreza').fill('7');
  await p.locator('#a-corpo-destreza').press('Enter');
  await p.getByRole('button', { name: 'Rolar d20 mais Destreza' }).click();
  await expect(p.locator('.chat-flutuante')).toBeVisible();
  await expect(p.locator('.msg').first().locator('.msg-rotulo')).toHaveText('Destreza');
  await expect(p.locator('.msg').first().locator('.msg-det')).toHaveText(/^d20 \(\d+\) \+ 7$/);
});

test('só o mestre muda o núcleo, que soma na mana; perícia conta SP e continua depois de recarregar', async ({ browser }) => {
  const p = await novaPessoa(browser, 'Mestra Nia');
  const jogador = await novaPessoa(browser, 'Jogador Noa');
  await criarFicha(jogador, 'Nucleada');
  await expect(jogador.getByLabel('Estágio do núcleo')).toBeDisabled();
  const fichaId = await levarFichaParaMesa(p, jogador, 'Núcleos');
  await jogador.reload();
  await expect(jogador.getByLabel('Estágio do núcleo')).toBeDisabled();
  await expect(jogador.getByText('Só o mestre da campanha muda o estágio do núcleo.')).toBeVisible();

  await p.goto(`/fichas/${fichaId}`);
  await p.getByLabel('Estágio do núcleo').selectOption({ label: 'Laranja escuro' });
  await expect(p.getByText('Total até aqui: +7 de mana, −2 de gasto universal de mana, 32 SP')).toBeVisible();
  await expect(p.getByText(/\+ núcleo 7 = 37$/)).toBeVisible();

  await p.getByText('Combate', { exact: true }).click();
  await p.locator('#a-pericias-esquiva').fill('4');
  await p.locator('#a-pericias-esquiva').press('Enter');
  await expect(p.getByText('4 de 32 SP usados')).toBeVisible();
  await expect(p.getByRole('status').filter({ hasText: 'Salvo' })).toBeVisible();

  await p.reload();
  await expect(p.getByLabel('Estágio do núcleo')).toHaveValue('3');
  await expect(p.getByText('4 de 32 SP usados')).toBeVisible();
});

test('mestre define bônus e limites; jogador para neles e nos SP', async ({ browser }) => {
  const mestre = await novaPessoa(browser, 'Mestra Ina');
  const jogador = await novaPessoa(browser, 'Jogador Ivo');
  await criarFicha(jogador, 'Travada');
  const fichaId = await levarFichaParaMesa(mestre, jogador, 'Limites');

  /* O jogador não tem os controles do mestre e para nos 15 SP do primeiro estágio. */
  await jogador.reload();
  await expect(jogador.getByLabel('Bônus do mestre em SP')).toHaveCount(0);
  await expect(jogador.getByRole('button', { name: 'Definir limites' })).toHaveCount(0);
  await jogador.getByText('Combate', { exact: true }).click();
  await jogador.locator('#a-pericias-esquiva').fill('40');
  await jogador.locator('#a-pericias-esquiva').press('Enter');
  await expect(jogador.locator('#a-pericias-esquiva')).toHaveValue('15');
  await expect(jogador.getByText('15 de 15 SP usados')).toBeVisible();
  await expect(jogador.getByRole('button', { name: 'Aumentar Aparar' })).toBeDisabled();
  await expect(jogador.getByRole('status').filter({ hasText: 'Salvo' })).toBeVisible();

  await mestre.goto(`/fichas/${fichaId}`);
  await mestre.getByLabel('Bônus do mestre em vida').fill('10');
  await mestre.getByLabel('Bônus do mestre em vida').press('Enter');
  await expect(mestre.getByText('15 + vitalidade 0 × 2 + mestre 10 = 25')).toBeVisible();
  await mestre.getByLabel('Bônus do mestre em SP').fill('5');
  await mestre.getByLabel('Bônus do mestre em SP').press('Enter');
  await expect(mestre.getByText('15 de 20 SP usados')).toBeVisible();
  await mestre.getByRole('button', { name: 'Definir limites' }).click();
  await mestre.getByText('Combate', { exact: true }).click();
  await mestre.getByLabel('Limite de Aparar').fill('2');
  await expect(mestre.getByRole('status').filter({ hasText: 'Salvo' })).toBeVisible();

  await jogador.reload();
  await jogador.getByText('Combate', { exact: true }).click();
  await expect(jogador.getByText('Máx. 2')).toBeVisible();
  await jogador.locator('#a-pericias-aparar').fill('9');
  await jogador.locator('#a-pericias-aparar').press('Enter');
  await expect(jogador.locator('#a-pericias-aparar')).toHaveValue('2');
  await expect(jogador.getByText('17 de 20 SP usados')).toBeVisible();
});

test('chat de dados: abre ao rolar, guarda o histórico e continua depois de recarregar', async ({ browser }) => {
  const p = await novaPessoa(browser, 'Ivo');
  await criarFicha(p, 'Solo');

  /* Fechado no início, sem cobrir a ficha. */
  await expect(p.locator('.chat-flutuante')).toHaveCount(0);
  await p.getByRole('button', { name: 'Chat de dados' }).click();
  await expect(p.getByText('Só você vê: esta ficha não está em campanha')).toBeVisible();
  await expect(p.getByText('Nenhuma rolagem ainda.')).toBeVisible();

  /* Rolagem livre por dentro do chat, com bônus. */
  await p.locator('#chat-bonus').fill('3');
  await p.getByRole('button', { name: 'Rolar d6', exact: true }).click();
  await expect(p.locator('.msg')).toHaveCount(1);
  await expect(p.locator('.msg-det').first()).toHaveText(/^d6 \(\d\) \+ 3$/);
  await expect(p.locator('.msg-minha')).toHaveCount(1);

  /* O total para no resultado certo depois de girar. */
  const det = (await p.locator('.msg-det').first().textContent())!;
  const esperado = Number(det.match(/\((\d)\)/)![1]) + 3;
  await expect(p.locator('.msg-total').first()).toHaveText(String(esperado));

  /* Fechar com Esc; rolar pela ficha abre de novo sozinho. */
  await p.keyboard.press('Escape');
  await expect(p.locator('.chat-flutuante')).toHaveCount(0);
  await p.getByRole('button', { name: 'Rolar d20 mais Tração' }).click();
  await expect(p.locator('.msg')).toHaveCount(2);
  await expect(p.locator('.msg-rotulo').last()).toHaveText('Tração');
  await expect(p.getByRole('status').filter({ hasText: 'Salvo' })).toBeVisible();

  /* O histórico vem do banco: sobrevive a recarregar, na ordem certa. */
  await p.reload();
  await p.getByRole('button', { name: 'Chat de dados' }).click();
  await expect(p.locator('.msg')).toHaveCount(2);
  await expect(p.locator('.msg-det').first()).toHaveText(/^d6 /);
  await expect(p.locator('.msg-rotulo').last()).toHaveText('Tração');
  await expect(p.locator('.chat-dia')).toHaveText(['Hoje']);
});

test('chat de dados: o d20 não fica coberto pelo chat aberto no computador', async ({ browser }) => {
  const p = await novaPessoa(browser, 'Jaci');
  await p.setViewportSize({ width: 1280, height: 800 });
  await criarFicha(p, 'Cobertura');
  await p.getByRole('button', { name: 'Rolar d20 mais Destreza' }).click();
  await expect(p.locator('.chat-flutuante')).toBeVisible();
  /* Se o chat estivesse por cima, este segundo clique falharia. */
  await p.getByRole('button', { name: 'Rolar d20 mais Destreza' }).click();
  await expect(p.locator('.msg')).toHaveCount(2);
});

test('campanha: mestre convida, jogador entra pelo link, tudo aparece ao vivo', async ({ browser }) => {
  const mestre = await novaPessoa(browser, 'Mestra Dora');
  await mestre.goto('/campanhas');
  await mestre.getByLabel('Nome').fill('A Queda de Vael');
  await mestre.getByLabel('Descrição (opcional)').fill('Campanha de teste');
  await mestre.getByRole('button', { name: 'Criar e virar mestre' }).click();
  await expect(mestre.getByRole('heading', { name: 'A Queda de Vael' })).toBeVisible();
  await expect(mestre.getByText('Você é o mestre')).toBeVisible();
  const link = await mestre.locator('#link-convite').inputValue();
  expect(link).toMatch(/\/convite\/[A-Z2-9]{8}$/);

  /* O jogador abre o link sem estar logado: cria a conta e continua no convite. */
  const jogador = await (await browser.newContext()).newPage();
  await jogador.goto(link);
  await expect(jogador).toHaveURL(/\/entrar\?destino=/);
  await expect(jogador.getByText('Você recebeu um convite')).toBeVisible();
  await jogador.getByLabel('Seu nome na mesa').fill('Jogador Eli');
  await jogador.getByLabel('E-mail').fill(`${unico()}@exemplo.com`);
  await jogador.getByLabel(/^Senha/).fill('senha-forte-1');
  await jogador.getByRole('button', { name: 'Criar conta', exact: true }).last().click();
  await expect(jogador.getByRole('heading', { name: 'A Queda de Vael' })).toBeVisible();
  await jogador.getByRole('button', { name: 'Entrar na campanha' }).click();
  await expect(jogador.getByText('Você é jogador')).toBeVisible();

  await expect(mestre.locator('.membro').filter({ hasText: 'Jogador Eli' })).toBeVisible({ timeout: 10000 });

  await jogador.getByRole('button', { name: 'Criar ficha nova aqui' }).click();
  await jogador.getByLabel('Nome', { exact: true }).fill('Theo');
  await expect(jogador.getByRole('status').filter({ hasText: 'Salvo' })).toBeVisible();
  await jogador.waitForTimeout(900);

  /* O mestre vê a ficha aparecer sozinha e abre para editar. */
  const linha = mestre.locator('a.rol-linha').filter({ hasText: 'Theo' });
  await expect(linha).toBeVisible({ timeout: 10000 });
  await linha.click();
  await expect(mestre.getByText('Ficha de Jogador Eli')).toBeVisible();
  await mestre.getByRole('button', { name: /^60%/ }).click();
  await expect(mestre.getByRole('status').filter({ hasText: 'Salvo' })).toBeVisible();

  /* O dono vê a mudança do mestre sem recarregar. */
  await expect(jogador.locator('article.ficha')).toHaveAttribute('data-estagio', '60', { timeout: 10000 });

  /* A rolagem do jogador cai no registro da mesa do mestre. */
  await jogador.getByRole('button', { name: 'Rolar d20 mais Destreza' }).click();
  await mestre.getByRole('link', { name: /Voltar para A Queda de Vael/ }).click();
  const rolagemTheo = mestre.locator('.chat-painel .msg').filter({ hasText: 'Theo' }).first();
  await expect(rolagemTheo).toContainText('Destreza');
  await expect(rolagemTheo).toContainText('d20');
  await expect(rolagemTheo).not.toHaveClass(/msg-minha/);

  /* Rolagem do mestre chega ao chat do jogador sem abrir nada na frente dele: aparece a contagem. */
  await mestre.locator('.chat-painel').getByRole('button', { name: 'Rolar d100' }).click();
  await expect(mestre.locator('.chat-painel .msg-minha')).toHaveCount(1);
  await expect(jogador.locator('.chat-flutuante .msg').filter({ hasText: 'Mestra Dora' })).toHaveCount(1, { timeout: 10000 });
  await jogador.locator('.chat-fechar').click();
  await mestre.locator('.chat-painel').getByRole('button', { name: 'Rolar d4', exact: true }).click();
  await expect(jogador.locator('.chat-contagem')).toHaveText('1', { timeout: 10000 });
  await expect(jogador.locator('.chat-flutuante')).toHaveCount(0);
  await jogador.locator('.chat-pilula').click();
  await expect(jogador.locator('.chat-flutuante .msg').filter({ hasText: 'Mestra Dora' })).toHaveCount(2);

  /* Um terceiro entra pelo código e não vê a vida dos outros. */
  const codigo = (await mestre.locator('#codigo-convite').textContent())!;
  const colega = await novaPessoa(browser, 'Colega Fia');
  await colega.goto('/campanhas');
  await colega.getByLabel('Código do convite').fill(codigo);
  await colega.getByRole('button', { name: 'Continuar' }).click();
  await colega.getByRole('button', { name: 'Entrar na campanha' }).click();
  await expect(colega.getByText('Você é jogador')).toBeVisible();
  await expect(colega.locator('.rol-nome').filter({ hasText: 'Theo' })).toBeVisible();
  await expect(colega.getByText('Vida, mana e fadiga: só o mestre e o dono veem.')).toBeVisible();
  await expect(colega.locator('a.rol-linha')).toHaveCount(0);

  /* O mestre remove o colega; ele perde o acesso sozinho. */
  await mestre.locator('.membro').filter({ hasText: 'Colega Fia' }).getByRole('button', { name: 'Remover' }).click();
  await mestre.locator('.membro').filter({ hasText: 'Colega Fia' }).getByRole('button', { name: 'Confirmar' }).click();
  await expect(mestre.locator('.membro').filter({ hasText: 'Colega Fia' })).toHaveCount(0);
  await colega.reload();
  await expect(colega.getByRole('heading', { name: 'Não consegui abrir esta campanha' })).toBeVisible();
});

test('conta: trocar nome atualiza a navegação; código errado explica o problema', async ({ browser }) => {
  const p = await novaPessoa(browser, 'Gil');
  await p.getByRole('link', { name: 'Gil' }).click();
  await p.getByLabel('Nome').fill('Gilberto');
  await p.getByRole('button', { name: 'Salvar nome' }).click();
  await expect(p.getByRole('navigation').getByRole('link', { name: 'Gilberto' })).toBeVisible();

  await p.goto('/convite/NAOEXISTE');
  await expect(p.getByText('Esse código não abre nenhuma campanha.')).toBeVisible();
});
