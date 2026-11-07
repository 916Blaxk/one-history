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
  await jogador.getByRole('button', { name: 'Rolar Destreza: 1d20' }).click();
  await expect(jogador.locator('.chat-roll-label').last()).toHaveText('Destreza');
  await mestre.getByRole('button', { name: 'Abrir chat' }).click();
  await expect(mestre.locator('.chat-roll-label').last()).toHaveText('Destreza');
  await expect(mestre.locator('.dice-roll-expression').last()).toHaveText(/1d20/);

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
  expect(fundo).toBe('rgb(11, 14, 26)');
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
  await jogador.getByRole('button', { name: 'Rolar d20 de Destreza' }).click();
  await expect(jogador.locator('.chat-popup')).toBeVisible();
  await expect(jogador.locator('.msg').first().locator('.msg-det')).toHaveText(/^d20 \(\d+\)$/);
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
  await mestre.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(mestre.locator('.scene-status')).toHaveText('Oculto');

  /* O centro da tela é o centro do cenário. Os pontos fogem das linhas da grade. */
  const CENTRO = { x: 712, y: 512 };
  const ACIMA = { x: 712, y: 412 };
  await expect.poll(async () => (await corNaTela(mestre, CENTRO.x, CENTRO.y)).r).toBeGreaterThan(90);
  expect((await corNaTela(jogador, CENTRO.x, CENTRO.y)).r).toBeLessThan(40);

  mestre.once('dialog', d => void d.accept());
  await mestre.getByRole('button', { name: 'Cobrir de névoa: caverna' }).click();
  /* O vermelho do mapa tem r = 224: a névoa cobre por inteiro, também para o mestre. */
  await expect.poll(async () => (await corNaTela(mestre, ACIMA.x, ACIMA.y)).r).toBeLessThan(25);
  const coberto = await corNaTela(mestre, CENTRO.x, CENTRO.y);

  /* O pincel abre um caminho estreito, que não segue a grade. */
  await mestre.getByRole('button', { name: 'Revelar', exact: true }).click();
  await mestre.mouse.move(600, 512);
  await mestre.mouse.down();
  await mestre.mouse.move(800, 512, { steps: 12 });
  await mestre.mouse.up();
  await mestre.getByRole('button', { name: 'Revelar', exact: true }).click();
  await expect.poll(async () => (await corNaTela(mestre, CENTRO.x, CENTRO.y)).r).toBeGreaterThan(coberto.r + 20);
  expect((await corNaTela(mestre, ACIMA.x, ACIMA.y)).r).toBeLessThan(25);
  expect((await corNaTela(jogador, CENTRO.x, CENTRO.y)).r).toBeLessThan(40);

  /* Ao mostrar, o jogador vai direto ao cenário, com a névoa já opaca fora do caminho. */
  await mestre.getByRole('button', { name: 'Mostrar aos jogadores: caverna' }).click();
  await expect(mestre.locator('.scene-status')).toHaveText('Visível');
  await expect.poll(async () => (await corNaTela(jogador, CENTRO.x, CENTRO.y)).r).toBeGreaterThan(180);
  const fora = await corNaTela(jogador, ACIMA.x, ACIMA.y);
  expect(fora.r).toBeLessThan(25);

  /* A névoa continua igual depois de recarregar. */
  await expect.poll(async () => { await jogador.waitForTimeout(1200); await jogador.reload(); await expect(jogador.getByText('Conectado')).toBeVisible({ timeout: 15000 }); return (await corNaTela(jogador, ACIMA.x, ACIMA.y)).r; }, { timeout: 30000 }).toBeLessThan(25);
  await expect.poll(async () => (await corNaTela(jogador, CENTRO.x, CENTRO.y)).r).toBeGreaterThan(180);

  /* Largura e altura mudam separadas. */
  await mestre.getByRole('button', { name: 'Novo token' }).first().click();
  await expect(mestre.getByLabel('Largura do token')).toBeVisible();
  await mestre.getByLabel('Largura do token').fill('1.5');
  await mestre.getByLabel('Altura do token').fill('3');
  await expect(mestre.locator('.range-control', { hasText: 'Largura' })).toContainText('1,5 células');
  await expect(mestre.locator('.range-control', { hasText: 'Altura' })).toContainText('3 células');
});

test('mesa: mapa, névoa, combate, magia e ferramentas na mesma sessão', async ({ browser }) => {
  test.setTimeout(120_000);
  const { mestre, jogador, campanhaId, fichaId } = await montar(browser);
  const erros: string[] = [];
  for (const p of [mestre, jogador]) {
    p.on('pageerror', e => erros.push(e.message));
    p.on('dialog', d => void d.accept());
  }
  await jogador.request.patch(`/api/fichas/${fichaId}`, { data: { magias: [{ id: 'm1', nome: 'Bola de fogo', elemento: 'fogo', custo: 10, alcance: '', duracao: '', descricao: '' }] } });
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
  await mestre.locator('input[type=file]').first().setInputFiles({ name: 'salao.png', mimeType: 'image/png', buffer: Buffer.from(imagem, 'base64') });
  await mestre.getByRole('button', { name: 'Salvar', exact: true }).click();

  /* Em 150%, o cenário alcança um ponto que antes ficava fora dele. */
  const BORDA = { x: 300, y: 512 };
  await expect(mestre.getByLabel('Tamanho de salao')).toBeVisible();
  expect((await corNaTela(mestre, BORDA.x, BORDA.y)).r).toBeLessThan(40);
  await mestre.getByLabel('Tamanho de salao').fill('150');
  await expect.poll(async () => (await corNaTela(mestre, BORDA.x, BORDA.y)).r).toBeGreaterThan(90);

  /* Travado, arrastar não move o cenário. */
  await mestre.getByRole('button', { name: 'Travar: salao' }).click();
  await expect(mestre.getByRole('button', { name: 'Destravar: salao' })).toBeVisible();
  await mestre.mouse.move(500, 400);
  await mestre.mouse.down();
  await mestre.mouse.move(800, 400, { steps: 4 });
  await mestre.mouse.up();
  await mestre.waitForTimeout(300);
  expect((await corNaTela(mestre, BORDA.x, BORDA.y)).r).toBeGreaterThan(90);

  /* Desfazer tira o último traço inteiro, mesmo depois de vários envios. */
  const CENTRO = { x: 712, y: 512 };
  await mestre.getByRole('button', { name: 'Cobrir de névoa: salao' }).click();
  await expect.poll(async () => (await corNaTela(mestre, CENTRO.x, CENTRO.y)).r).toBeLessThan(90);
  const coberto = (await corNaTela(mestre, CENTRO.x, CENTRO.y)).r;
  await mestre.getByRole('button', { name: 'Revelar', exact: true }).click();
  await mestre.mouse.move(600, CENTRO.y);
  await mestre.mouse.down();
  await mestre.mouse.move(800, CENTRO.y, { steps: 12 });
  await mestre.mouse.up();
  await mestre.getByRole('button', { name: 'Revelar', exact: true }).click();
  await expect.poll(async () => (await corNaTela(mestre, CENTRO.x, CENTRO.y)).r).toBeGreaterThan(coberto + 20);
  await mestre.getByRole('button', { name: 'Desfazer o último traço' }).click();
  await expect.poll(async () => (await corNaTela(mestre, CENTRO.x, CENTRO.y)).r).toBeLessThan(coberto + 5);

  /* Combate: o mestre conduz, e o jogador passa a própria vez. */
  await mestre.getByRole('button', { name: 'Iniciar combate' }).click();
  const ordem = jogador.getByRole('region', { name: 'Ordem de combate' });
  await expect(ordem).toContainText('Kael');
  await mestre.getByRole('button', { name: 'Rolar faltantes' }).click();
  await expect(mestre.getByLabel('Iniciativa de Kael', { exact: true })).not.toHaveValue('');
  await expect(ordem.locator('b').last()).not.toHaveText('—');
  await mestre.getByRole('button', { name: 'Começar' }).click();
  await expect(ordem.locator('li[aria-current=true]')).toContainText('Kael');
  await jogador.getByRole('button', { name: 'Passar a vez' }).click();
  await expect(ordem).toContainText('Rodada 2');  await mestre.getByRole('button', { name: 'Encerrar', exact: true }).click();
  await expect(ordem).toHaveCount(0);

  /* O token da ficha: condição, magia e fadiga sem sair da mesa. */
  await jogador.mouse.click(525, 745);
  await expect(jogador.getByLabel('PV atual')).toHaveValue('25');
  await jogador.getByRole('button', { name: 'Caído' }).click();
  await expect(jogador.getByRole('button', { name: 'Caído' })).toHaveAttribute('aria-pressed', 'true');
  await jogador.locator('.mini-sheet-group summary', { hasText: 'Magias' }).click();
  await jogador.getByRole('button', { name: 'Conjurar Bola de fogo' }).click();
  await expect(jogador.locator('.mini-sheet-identity')).toContainText('Mana: 20');
  await expect(jogador.getByLabel('Mana atual')).toHaveValue('20');
  /* O dono edita a fadiga e encerra a cena, como o mestre, e vê o que o mestre mudar. */
  await mestre.request.patch(`/api/fichas/${fichaId}`, { data: { fadiga: 60 } });
  await expect(jogador.getByLabel('Fadiga mental (%)')).toHaveValue('60');
  await expect(jogador.getByRole('button', { name: 'Encerrar cena' })).toBeVisible();
  await mestre.request.post(`/api/fichas/${fichaId}/encerrar-cena`, { data: {} });
  await expect.poll(async () => (await (await jogador.request.get(`/api/fichas/${fichaId}`)).json()).ficha.manaPerdida).toBeGreaterThan(0);
  /* O jogador não remove o token da ficha: a tecla nem pergunta. O mestre confirma e remove. */
  let perguntas = 0;
  jogador.on('dialog', () => { perguntas += 1; });
  await jogador.locator('canvas').focus();
  await jogador.keyboard.press('Delete');
  await jogador.waitForTimeout(300);
  expect(perguntas).toBe(0);
  await expect(jogador.getByLabel('PV atual')).toBeVisible();
  await mestre.mouse.click(525, 745);
  await expect(mestre.getByLabel('PV atual')).toHaveValue('25');
  await mestre.getByLabel('Fadiga mental (%)').fill('70');
  await mestre.getByLabel('Fadiga mental (%)').press('Enter');
  await expect.poll(async () => (await (await mestre.request.get(`/api/fichas/${fichaId}`)).json()).ficha.fadiga).toBe(70);
  await mestre.locator('canvas').focus();
  await mestre.keyboard.press('Delete');
  await expect(mestre.getByLabel('PV atual')).toHaveCount(0);
  await expect(jogador.getByLabel('PV atual')).toHaveCount(0);

  /* Régua e ping não atrapalham o mapa. */
  await mestre.getByRole('button', { name: 'Medir' }).click();
  await mestre.mouse.move(400, 800);
  await mestre.mouse.down();
  await mestre.mouse.move(610, 800, { steps: 3 });  await mestre.mouse.up();
  await mestre.getByRole('button', { name: 'Medir' }).click();
  await mestre.getByRole('button', { name: 'Ping' }).click();
  await mestre.mouse.click(500, 850);
  await mestre.getByRole('button', { name: 'Ping' }).click();
  await mestre.getByRole('button', { name: 'Levar todos' }).click();

  expect(erros).toEqual([]);
});

test('mesa: o token tem três imagens, sem a foto da ficha e sem o fundo', async ({ browser }) => {
  const { jogador, campanhaId, fichaId } = await montar(browser);
  /* Personagem colorido sobre fundo branco, para ver o fundo sair. */
  const imagemDaCor = (cor: string) => jogador.evaluate((c) => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const contexto = canvas.getContext('2d')!;
    contexto.fillStyle = '#ffffff';
    contexto.fillRect(0, 0, 64, 64);
    contexto.fillStyle = c;
    contexto.fillRect(4, 4, 56, 56);
    return canvas.toDataURL('image/png');
  }, cor);
  const colocar = async (vaga: string, cor: string) => {
    const png = (await imagemDaCor(cor)).split(',')[1]!;
    await jogador.getByLabel(`Arquivo da imagem ${vaga}`).setInputFiles({ name: `${vaga}.png`, mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await expect(jogador.getByRole('dialog', { name: `Ajustar a imagem ${vaga}` })).toBeVisible();
    await jogador.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(jogador.getByAltText(`Imagem ${vaga} atual`)).toBeVisible();
  };

  /* A foto da ficha fica na ficha: o token não usa. */
  await jogador.request.patch(`/api/fichas/${fichaId}`, { data: { foto: await imagemDaCor('#e02020') } });
  await abrirMesa(jogador, campanhaId);
  const PONTO = { x: 540, y: 700 };
  await jogador.waitForTimeout(1500);
  expect((await corNaTela(jogador, PONTO.x, PONTO.y)).r).toBeLessThan(150);

  await jogador.mouse.click(525, 745);
  await expect(jogador.getByRole('button', { name: 'Armado', exact: true })).toBeDisabled();
  await colocar('Normal', '#2040e0');
  await expect.poll(async () => (await corNaTela(jogador, PONTO.x, PONTO.y)).b).toBeGreaterThan(180);

  /* O fundo branco saiu, e o personagem ficou. */
  const pixel = (x: number, y: number) => jogador.getByAltText('Imagem Normal atual').evaluate(async (el: HTMLImageElement, [x, y]) => {
    await el.decode();
    const c = document.createElement('canvas');
    c.width = el.naturalWidth; c.height = el.naturalHeight;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(el, 0, 0);
    return [...ctx.getImageData(x!, y!, 1, 1).data];
  }, [x, y]);
  expect((await pixel(1, 1))[3]).toBe(0);
  expect((await pixel(32, 32))[3]).toBe(255);

  /* Reajustar abre o original, sem pedir o arquivo, e guarda a força usada. */
  await jogador.getByRole('button', { name: 'Ajustar imagem Normal' }).click();
  await expect(jogador.getByRole('dialog', { name: 'Ajustar a imagem Normal' })).toBeVisible();
  await expect(jogador.getByLabel('Retirar fundo')).toHaveValue('25');
  await jogador.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(jogador.getByRole('dialog')).toHaveCount(0);
  await expect(jogador.getByAltText('Imagem Normal atual')).toBeVisible();
  await expect.poll(async () => (await corNaTela(jogador, PONTO.x, PONTO.y)).b).toBeGreaterThan(180);

  /* Em cheio, continua a normal. Abaixo da metade, troca, e volta ao curar. */
  await colocar('Machucado', '#e02020');
  expect((await corNaTela(jogador, PONTO.x, PONTO.y)).b).toBeGreaterThan(180);
  await jogador.getByLabel('PV atual').fill('12');
  await expect.poll(async () => (await corNaTela(jogador, PONTO.x, PONTO.y)).r).toBeGreaterThan(180);
  await jogador.getByLabel('PV atual').fill('25');
  await expect.poll(async () => (await corNaTela(jogador, PONTO.x, PONTO.y)).b).toBeGreaterThan(180);

  /* O botão Armado troca a imagem, mas o machucado vem na frente. */
  await colocar('Armado', '#20c040');
  expect((await corNaTela(jogador, PONTO.x, PONTO.y)).b).toBeGreaterThan(180);
  await jogador.getByRole('button', { name: 'Armado', exact: true }).click();
  await expect.poll(async () => (await corNaTela(jogador, PONTO.x, PONTO.y)).g).toBeGreaterThan(150);
  /* O atalho no próprio token, ao lado do botão de espelhar, faz o mesmo que o botão do painel. */
  const BOTAO_NO_TOKEN = { x: 549, y: 839 };
  await jogador.mouse.click(BOTAO_NO_TOKEN.x, BOTAO_NO_TOKEN.y);
  await expect(jogador.getByRole('button', { name: 'Armado', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(async () => (await corNaTela(jogador, PONTO.x, PONTO.y)).b).toBeGreaterThan(180);
  await jogador.mouse.click(BOTAO_NO_TOKEN.x, BOTAO_NO_TOKEN.y);
  await expect(jogador.getByRole('button', { name: 'Armado', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await jogador.getByLabel('PV atual').fill('12');
  await expect.poll(async () => (await corNaTela(jogador, PONTO.x, PONTO.y)).r).toBeGreaterThan(180);
  await jogador.getByLabel('PV atual').fill('25');
  await expect.poll(async () => (await corNaTela(jogador, PONTO.x, PONTO.y)).g).toBeGreaterThan(150);

  /* Sem a imagem Armado, volta a normal e o botão desliga. */
  await jogador.getByRole('button', { name: 'Remover imagem Armado' }).click();
  await expect.poll(async () => (await corNaTela(jogador, PONTO.x, PONTO.y)).b).toBeGreaterThan(180);
  await expect(jogador.getByRole('button', { name: 'Armado', exact: true })).toBeDisabled();
});
