import { expect, test, type Browser, type Page } from '@playwright/test';

let seq = 0;

async function novaPessoa(browser: Browser, nome: string): Promise<Page> {
  /* Cada pessoa com um endereço: o cadastro aceita 20 contas por IP. */
  const contexto = await browser.newContext({ viewport: { width: 1400, height: 1000 }, extraHTTPHeaders: { 'X-Forwarded-For': `10.2.0.${++seq}` } });
  const pagina = await contexto.newPage();
  await pagina.goto('/entrar');
  await pagina.getByRole('tab', { name: 'Criar conta' }).click();
  await pagina.getByLabel('Seu nome na mesa').fill(nome);
  await pagina.getByLabel('E-mail').fill(`mesa-${Date.now()}-${++seq}@exemplo.com`);
  await pagina.getByLabel(/^Senha/).fill('senha-forte-1');
  await pagina.getByRole('button', { name: 'Criar conta', exact: true }).last().click();
  await expect(pagina.getByRole('heading', { name: 'Minhas fichas' })).toBeVisible();
  return pagina;
}

/* A campanha e a ficha entram pela API: estes testes são sobre a mesa. */
async function montar(browser: Browser) {
  const mestre = await novaPessoa(browser, 'Mestra Dora');
  const jogador = await novaPessoa(browser, 'Jogador Eli');
  const { campanha } = await (await mestre.request.post('/api/campanhas', { data: { nome: 'A Queda de Vael', descricao: '' } })).json();
  const detalhe = await (await mestre.request.get(`/api/campanhas/${campanha.id}`)).json();
  await jogador.request.post(`/api/convites/${detalhe.campanha.codigo}/entrar`, { data: {} });
  const { ficha } = await (await jogador.request.post('/api/fichas', { data: { dados: { nome: 'Kael', corpo: { vitalidade: 5, destreza: 7 } } } })).json();
  await jogador.request.post(`/api/campanhas/${campanha.id}/fichas`, { data: { fichaId: ficha.id } });
  return { mestre, jogador, campanhaId: campanha.id as string, fichaId: ficha.id as string };
}

async function abrirMesa(p: Page, campanhaId: string) {
  await p.goto(`/campanhas/${campanhaId}`);
  await p.getByRole('link', { name: 'Mesa', exact: true }).click();
  await expect(p).toHaveURL(new RegExp(`/campanhas/${campanhaId}/mesa$`));
  await expect(p.getByText('Conectado')).toBeVisible({ timeout: 15000 });
}

test('sem login, a mesa pede para entrar e volta para ela', async ({ browser }) => {
  const p = await (await browser.newContext()).newPage();
  await p.goto('/campanhas/qualquer/mesa');
  await expect(p).toHaveURL(/\/entrar\?destino=/);
});

test('quem não é da campanha não abre a mesa', async ({ browser }) => {
  const { campanhaId } = await montar(browser);
  const fora = await novaPessoa(browser, 'De Fora');
  await fora.goto(`/campanhas/${campanhaId}/mesa`);
  await expect(fora.getByText('Campanha não encontrada')).toBeVisible();
  await expect(fora.locator('canvas')).toHaveCount(0);
});

test('mesa: mestre é GM, jogador usa a ficha, rola e a vida sincroniza nos dois lados', async ({ browser }) => {
  const { mestre, jogador, campanhaId, fichaId } = await montar(browser);
  const erros: string[] = [];
  for (const p of [mestre, jogador]) {
    p.on('pageerror', e => erros.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && /Content Security|unsafe-eval/i.test(m.text())) erros.push(m.text()); });
  }

  /* O jogador entra primeiro e, mesmo assim, não vira GM. */
  await abrirMesa(jogador, campanhaId);
  await expect(jogador.locator('.room-presence')).toContainText('Jogador Eli · Jogador');
  await expect(jogador.getByRole('button', { name: 'Adicionar cenários' })).toHaveCount(0);
  await expect(jogador.locator('canvas')).toBeVisible();
  await abrirMesa(mestre, campanhaId);
  await expect(mestre.locator('.room-presence')).toContainText('Mestra Dora · Mestre');
  await expect(mestre.getByRole('button', { name: 'Adicionar cenários' })).toBeVisible();

  /* Sem id nem chave: a ficha vem de uma lista, e o token novo já nasce selecionado. */
  await jogador.getByRole('button', { name: 'Novo token' }).first().click();
  await expect(jogador.getByLabel('PV atual')).toBeVisible();
  await expect(jogador.getByLabel('Usar a ficha')).toContainText('Kael');
  await jogador.getByRole('button', { name: 'Vincular ficha' }).click();
  await expect(jogador.getByLabel('PV atual')).toHaveValue('25');
  await expect(jogador.getByLabel('PV máximo')).toBeDisabled();
  await expect(jogador.locator('.mini-sheet-identity')).toContainText('Kael');

  /* Rolagem pela ficha aparece para os dois, com resultado do servidor. */
  await jogador.locator('.mini-sheet-group summary', { hasText: 'Corpo' }).click();
  await jogador.getByRole('button', { name: 'Rolar Destreza: 1d20+7' }).click();
  await expect(jogador.locator('.chat-roll-label').last()).toHaveText('Destreza');
  await mestre.getByRole('button', { name: 'Abrir chat' }).click();
  await expect(mestre.locator('.chat-roll-label').last()).toHaveText('Destreza');
  await expect(mestre.locator('.dice-roll-expression').last()).toHaveText(/1d20\+7/);

  /* Chat e rolagem por comando. */
  await jogador.getByLabel('Mensagem ou comando').fill('/r 2d20kh1+5');
  await jogador.getByLabel('Mensagem ou comando').press('Enter');
  await expect(mestre.locator('.dice-roll-expression').last()).toHaveText(/2d20kh1\+5/);
  await mestre.getByLabel('Mensagem ou comando').fill('Bem-vindos à mesa');
  await mestre.getByLabel('Mensagem ou comando').press('Enter');
  await expect(jogador.getByText('Bem-vindos à mesa')).toBeVisible();

  /* Vida: da mesa para a página da ficha, aberta ao lado, sem recarregar. */
  const pagFicha = await jogador.context().newPage();
  await pagFicha.goto(`/fichas/${fichaId}`);
  await expect(pagFicha.locator('#v-vidaAtual')).toHaveValue('25');
  await pagFicha.waitForTimeout(500);
  let inicio = Date.now();
  await jogador.getByLabel('PV atual').fill('10');
  await expect(pagFicha.locator('#v-vidaAtual')).toHaveValue('10', { timeout: 1000 });
  console.log(`token para ficha: ${Date.now() - inicio} ms`);

  /* E da página da ficha para a mesa. O salvamento da tela espera 500 ms pela próxima tecla. */
  inicio = Date.now();
  await pagFicha.locator('.cor-vida').getByRole('button', { name: '+5' }).click();
  await expect(jogador.getByLabel('PV atual')).toHaveValue('15', { timeout: 1000 });
  console.log(`ficha para token: ${Date.now() - inicio} ms`);

  /* Máximo. */
  await jogador.getByLabel('PV atual').fill('5000');
  await expect(jogador.getByLabel('PV atual')).toHaveValue('25');
  await expect(pagFicha.locator('#v-vidaAtual')).toHaveValue('25');
  await pagFicha.close();

  /* O estado volta depois de recarregar a página. */
  await jogador.reload();
  await expect(jogador.getByText('Conectado')).toBeVisible({ timeout: 15000 });
  await expect(jogador.getByText('Bem-vindos à mesa').or(jogador.getByRole('button', { name: 'Abrir chat' }))).toBeVisible();
  expect(erros).toEqual([]);

  /* A mesa usa só o próprio estilo, e o caminho de volta recarrega o do site. */
  const fundo = await mestre.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(fundo).toBe('rgb(16, 17, 20)');
  await mestre.getByRole('link', { name: /Voltar para A Queda de Vael/ }).click();
  await expect(mestre.getByRole('heading', { name: 'A Queda de Vael' })).toBeVisible();
  const fundoSite = await mestre.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(fundoSite).not.toBe('rgb(16, 17, 20)');
});

test('mesa: o mestre controla grade e névoa, e o que muda aparece para o jogador', async ({ browser }) => {
  const { mestre, jogador, campanhaId } = await montar(browser);
  await abrirMesa(mestre, campanhaId);
  await abrirMesa(jogador, campanhaId);

  await mestre.getByRole('button', { name: 'Novo token' }).first().click();
  await expect(mestre.getByLabel('Nome', { exact: true })).toBeVisible();
  await mestre.getByLabel('Nome', { exact: true }).fill('Dragão');
  await expect(mestre.getByLabel('Nome', { exact: true })).toHaveValue('Dragão');

  /* O jogador pode criar o próprio token, mas não controla a grade. */
  await jogador.getByRole('button', { name: 'Novo token' }).first().click();
  await expect(jogador.getByLabel('PV atual')).toBeVisible();
  await expect(jogador.getByLabel('Grid quadrado')).toHaveCount(0);

  /* Névoa pintada no mapa pelo mestre. */
  await mestre.keyboard.press('Escape');
  await mestre.getByRole('button', { name: 'Ocultar' }).click();
  await mestre.mouse.move(700, 300);
  await mestre.mouse.down();
  await mestre.mouse.move(760, 340, { steps: 4 });
  await mestre.mouse.up();
  await expect.poll(() => mestre.evaluate(() => document.body.innerText.includes('Limpar'))).toBe(true);

  await mestre.reload();
  await expect(mestre.getByText('Conectado')).toBeVisible({ timeout: 15000 });
  await expect(mestre.locator('.room-presence')).toContainText('Mestre');
});

test('a ficha continua igual fora da mesa, com rolagem e chat do site', async ({ browser }) => {
  const { jogador, fichaId } = await montar(browser);
  await jogador.goto(`/fichas/${fichaId}`);
  await jogador.getByRole('button', { name: 'Rolar d20 mais Destreza' }).click();
  await expect(jogador.locator('.chat-flutuante')).toBeVisible();
  await expect(jogador.locator('.msg').first().locator('.msg-det')).toHaveText(/^d20 \(\d+\) \+ 7$/);
});

/* Lê um pixel da tela: a névoa e os tokens são desenhados em WebGL, sem nada no HTML para conferir. */
async function corNaTela(p: Page, x: number, y: number) {
  const imagem = (await p.screenshot()).toString('base64');
  return p.evaluate(async ({ imagem, x, y }) => {
    const bitmap = new Image();
    bitmap.src = `data:image/png;base64,${imagem}`;
    await bitmap.decode();
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.naturalWidth;
    canvas.height = bitmap.naturalHeight;
    const contexto = canvas.getContext('2d')!;
    contexto.drawImage(bitmap, 0, 0);
    const [r, g, b] = contexto.getImageData(x, y, 1, 1).data;
    return { r, g, b };
  }, { imagem, x, y });
}

test('mesa: o mestre prepara o cenário oculto com névoa livre e mostra quando quiser', async ({ browser }) => {
  test.setTimeout(90_000);
  const { mestre, jogador, campanhaId } = await montar(browser);
  await abrirMesa(mestre, campanhaId);
  await abrirMesa(jogador, campanhaId);

  const imagem = await mestre.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 400;
    const contexto = canvas.getContext('2d')!;
    contexto.fillStyle = '#e02020';
    contexto.fillRect(0, 0, 600, 400);
    return canvas.toDataURL('image/png').split(',')[1]!;
  });
  await mestre.locator('input[type=file]').first().setInputFiles({ name: 'caverna.png', mimeType: 'image/png', buffer: Buffer.from(imagem, 'base64') });
  await expect(mestre.locator('.scene-status')).toHaveText('Oculto');

  /* O centro da tela é o centro do cenário. Os pontos fogem das linhas da grade. */
  const CENTRO = { x: 712, y: 512 };
  const ACIMA = { x: 712, y: 412 };
  await expect.poll(async () => (await corNaTela(mestre, CENTRO.x, CENTRO.y)).r).toBeGreaterThan(90);
  expect((await corNaTela(jogador, CENTRO.x, CENTRO.y)).r).toBeLessThan(40);

  await mestre.getByRole('button', { name: 'Cobrir de névoa: caverna' }).click();
  await expect.poll(async () => (await corNaTela(mestre, ACIMA.x, ACIMA.y)).r).toBeLessThan(90);
  const coberto = await corNaTela(mestre, CENTRO.x, CENTRO.y);

  /* O pincel abre um caminho estreito, que não segue a grade. */
  await mestre.getByRole('button', { name: 'Revelar', exact: true }).click();
  await mestre.mouse.move(600, 512);
  await mestre.mouse.down();
  await mestre.mouse.move(800, 512, { steps: 12 });
  await mestre.mouse.up();
  await mestre.getByRole('button', { name: 'Revelar', exact: true }).click();
  await expect.poll(async () => (await corNaTela(mestre, CENTRO.x, CENTRO.y)).r).toBeGreaterThan(coberto.r + 20);
  expect((await corNaTela(mestre, ACIMA.x, ACIMA.y)).r).toBeLessThan(90);
  expect((await corNaTela(jogador, CENTRO.x, CENTRO.y)).r).toBeLessThan(40);

  /* Ao mostrar, o jogador vai direto ao cenário, com a névoa já opaca fora do caminho. */
  await mestre.getByRole('button', { name: 'Mostrar aos jogadores: caverna' }).click();
  await expect(mestre.locator('.scene-status')).toHaveText('Visível');
  await expect.poll(async () => (await corNaTela(jogador, CENTRO.x, CENTRO.y)).r).toBeGreaterThan(180);
  const fora = await corNaTela(jogador, ACIMA.x, ACIMA.y);
  expect(fora.r).toBeLessThan(25);

  /* A névoa continua igual depois de recarregar. */
  await expect.poll(async () => { await jogador.waitForTimeout(1200); await jogador.reload(); await expect(jogador.getByText('Conectado')).toBeVisible({ timeout: 15000 }); return (await corNaTela(jogador, ACIMA.x, ACIMA.y)).r; }).toBeLessThan(25);
  await expect.poll(async () => (await corNaTela(jogador, CENTRO.x, CENTRO.y)).r).toBeGreaterThan(180);

  /* Largura e altura mudam separadas. */
  await mestre.getByRole('button', { name: 'Novo token' }).first().click();
  await expect(mestre.getByLabel('Largura do token')).toBeVisible();
  await mestre.getByLabel('Largura do token').fill('1.5');
  await mestre.getByLabel('Altura do token').fill('3');
  await expect(mestre.locator('.range-control', { hasText: 'Largura' })).toContainText('1,5 células');
  await expect(mestre.locator('.range-control', { hasText: 'Altura' })).toContainText('3 células');
});
