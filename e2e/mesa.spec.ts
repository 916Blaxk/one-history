import { expect, test, type Browser, type Page } from '@playwright/test';

let seq = 0;
const unico = () => `${Date.now()}-${++seq}`;

async function novaPessoa(browser: Browser, nome: string): Promise<Page> {
  /* Cada pessoa com um endereço: o cadastro aceita 20 contas por IP. */
  const contexto = await browser.newContext({ extraHTTPHeaders: { 'X-Forwarded-For': `10.1.0.${++seq}` } });
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

  /* Digitar em tração não mexe na vida. */
  await p.locator('#a-corpo-tracao').fill('9');
  await p.locator('#a-corpo-tracao').press('Enter');
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
  await expect(p.locator('#a-corpo-tracao')).toHaveValue('9');
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
  await expect(p.locator('.chat-popup')).toBeVisible();
  await expect(p.locator('.msg').first().locator('.msg-rotulo')).toHaveText('Destreza');
  await expect(p.locator('.msg').first().locator('.msg-det')).toHaveText(/^d20 \(\d+\) \+ 7$/);
});

test('foto: entra inteira, sem corte, e o ajuste escolhe o trecho', async ({ browser }) => {
  const p = await novaPessoa(browser, 'Lia');
  await criarFicha(p, 'Retrato');

  /* Imagem larga: metade vermelha, metade azul. Um corte automático perderia as duas pontas. */
  const png = await p.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 800; c.height = 200;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 400, 200);
    ctx.fillStyle = '#0000ff'; ctx.fillRect(400, 0, 400, 200);
    return c.toDataURL('image/png').split(',')[1]!;
  });
  const escolher = () => p.locator('#foto-arquivo').setInputFiles({ name: 'larga.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  const pixel = (x: number, y: number) => p.locator('.retrato img').evaluate(async (el: HTMLImageElement, [x, y]) => {
    await el.decode();
    const c = document.createElement('canvas');
    c.width = el.naturalWidth; c.height = el.naturalHeight;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(el, 0, 0);
    return [...ctx.getImageData(x!, y!, 1, 1).data];
  }, [x, y]);
  const vermelho = ([r, g, b, a]: number[]) => r! > 200 && g! < 60 && b! < 60 && a! > 200;
  const azul = ([r, g, b, a]: number[]) => b! > 200 && r! < 60 && g! < 60 && a! > 200;

  /* Cancelar não muda nada. */
  await escolher();
  await expect(p.getByRole('dialog', { name: 'Ajustar a foto' })).toBeVisible();
  await p.getByRole('button', { name: 'Cancelar' }).click();
  await expect(p.getByRole('dialog')).toHaveCount(0);
  await expect(p.locator('.retrato img')).toHaveCount(0);

  /* Sem mexer: as duas pontas aparecem, e o que sobra na moldura fica vazio. */
  await escolher();
  await p.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(p.getByRole('dialog')).toHaveCount(0);
  await expect(p.locator('.retrato img')).toBeVisible();
  await expect.poll(() => pixel(3, 200).then(vermelho)).toBe(true);
  expect(azul(await pixel(316, 200))).toBe(true);
  expect((await pixel(160, 5))[3]).toBe(0);

  /* Com zoom e arraste: a moldura fica cheia, só com o trecho escolhido. */
  const srcAntes = await p.locator('.retrato img').getAttribute('src');
  await escolher();
  await p.getByLabel('Zoom').evaluate((el: HTMLInputElement) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, el.max);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const moldura = (await p.locator('.ajuste-foto-moldura').boundingBox())!;
  await p.mouse.move(moldura.x + moldura.width / 2, moldura.y + moldura.height / 2);
  await p.mouse.down();
  await p.mouse.move(moldura.x + moldura.width, moldura.y + moldura.height / 2, { steps: 4 });
  await p.mouse.up();
  await p.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect.poll(() => p.locator('.retrato img').getAttribute('src')).not.toBe(srcAntes);
  await expect.poll(() => pixel(160, 200).then(vermelho)).toBe(true);
  expect(vermelho(await pixel(3, 5))).toBe(true);
  expect(vermelho(await pixel(316, 395))).toBe(true);

  /* Reajustar não pede o arquivo de novo: abre como ficou, e a imagem inteira continua disponível. */
  const srcCortada = await p.locator('.retrato img').getAttribute('src');
  await p.getByRole('button', { name: 'Ajustar', exact: true }).click();
  await expect(p.getByRole('dialog', { name: 'Ajustar a foto' })).toBeVisible();
  await expect.poll(() => p.getByLabel('Zoom').inputValue().then(Number)).toBeGreaterThan(1);
  await p.getByRole('button', { name: 'Ver inteira' }).click();
  await p.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect.poll(() => p.locator('.retrato img').getAttribute('src')).not.toBe(srcCortada);
  await expect.poll(() => pixel(3, 200).then(vermelho)).toBe(true);
  expect(azul(await pixel(316, 200))).toBe(true);
  /* Duas vezes: reajustar de novo não pode perder o original. */
  await p.reload();
  await p.getByRole('button', { name: 'Ajustar', exact: true }).click();
  await expect(p.getByRole('dialog', { name: 'Ajustar a foto' })).toBeVisible();
  await expect(p.getByLabel('Zoom')).toHaveValue('1');
  await p.getByRole('button', { name: 'Cancelar' }).click();
});

test('vida máxima: o jogador digita o total, e a vitalidade continua somando', async ({ browser }) => {
  const p = await novaPessoa(browser, 'Tom');
  await criarFicha(p, 'Vigoroso');
  await expect(p.locator('#a-corpo-tenacidade')).toHaveCount(0);
  await p.getByLabel('Vida máxima').fill('40');
  await p.getByLabel('Vida máxima').press('Enter');
  await expect(p.getByText('15 + vitalidade 0 × 2 + ajuste 25 = 40')).toBeVisible();
  await p.locator('#a-corpo-vitalidade').fill('5');
  await p.locator('#a-corpo-vitalidade').press('Enter');
  await expect(p.getByText('15 + vitalidade 5 × 2 + ajuste 25 = 50')).toBeVisible();
  await expect(p.getByLabel('Vida máxima')).toHaveValue('50');
  await expect(p.getByRole('status').filter({ hasText: 'Salvo' })).toBeVisible();
  await p.reload();
  await expect(p.getByLabel('Vida máxima')).toHaveValue('50');
});

test('elementos: a ficha começa sem nenhum, e o jogador adiciona e remove os dele', async ({ browser }) => {
  const p = await novaPessoa(browser, 'Ana');
  await criarFicha(p, 'Maga');
  await expect(p.getByText('Nenhum elemento ainda.')).toBeVisible();
  await expect(p.locator('[data-grupo="elementos"]')).toHaveCount(0);
  await p.getByLabel('Adicionar elemento').selectOption('agua');
  await expect(p.getByRole('button', { name: 'Rolar d20 mais Água' })).toBeVisible();
  await expect(p.getByRole('button', { name: 'Rolar d20 mais Fogo' })).toHaveCount(0);
  await p.locator('#a-elementos-agua').fill('3');
  await p.locator('#a-elementos-agua').press('Enter');
  await expect(p.getByRole('status').filter({ hasText: 'Salvo' })).toBeVisible();
  await p.reload();
  await expect(p.locator('#a-elementos-agua')).toHaveValue('3');
  await expect(p.getByLabel('Adicionar elemento').locator('option', { hasText: 'Água' })).toHaveCount(0);
  await p.getByRole('button', { name: 'Remover Água' }).click();
  await p.getByRole('button', { name: 'Confirmar: remover' }).click();
  await expect(p.getByText('Nenhum elemento ainda.')).toBeVisible();
  await expect(p.getByRole('status').filter({ hasText: 'Salvo' })).toBeVisible();
  await p.reload();
  await expect(p.getByText('Nenhum elemento ainda.')).toBeVisible();

  /* O gráfico é de corpo e mente, nos atributos. */
  await expect(p.getByRole('img', { name: /Gráfico de corpo e mente: Tração 0/ })).toBeVisible();
});

test('habilidades: a aba cria, guarda e remove', async ({ browser }) => {
  const p = await novaPessoa(browser, 'Bob');
  await criarFicha(p, 'Hábil');
  await p.getByRole('tab', { name: /Habilidades/ }).click();
  await expect(p.getByText('Nenhuma habilidade ainda.')).toBeVisible();
  await p.getByRole('button', { name: 'Criar habilidade' }).click();
  await p.getByLabel('Nome da habilidade').fill('Passo sombrio');
  await p.getByLabel('O que ela faz').fill('Atravessa uma sombra próxima.');
  await expect(p.getByRole('status').filter({ hasText: 'Salvo' })).toBeVisible();
  await p.reload();
  await p.getByRole('tab', { name: /Habilidades \(1\)/ }).click();
  await expect(p.getByRole('button', { name: 'Passo sombrio' })).toBeVisible();
  await expect(p.getByText('Atravessa uma sombra próxima.')).toBeVisible();
  await p.getByRole('button', { name: 'Passo sombrio' }).click();
  await p.getByRole('button', { name: 'Remover habilidade' }).click();
  await p.getByRole('button', { name: 'Confirmar: remover habilidade' }).click();
  await expect(p.getByText('Nenhuma habilidade ainda.')).toBeVisible();
});

test('perícias: existe a classe Magia, e as adicionais foram distribuídas', async ({ browser }) => {
  const p = await novaPessoa(browser, 'Lua');
  await criarFicha(p, 'Arcana');
  await expect(p.getByText('Perícias adicionais')).toHaveCount(0);
  await p.getByRole('tab', { name: 'Perícias' }).click();

  /* Tabela única, em ordem alfabética, com o atributo de cada perícia. */
  const nomes = await p.locator('.pericias .pericia-nome').allTextContents();
  expect(nomes[0]).toBe('Acrobacia');
  expect(nomes).toEqual([...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR')));
  await expect(p.locator('.pericia-linha').filter({ hasText: 'Aparar' }).locator('.pericia-dados')).toHaveText('( TRA )');
  await expect(p.locator('.pericia-linha').filter({ hasText: 'Religião' }).locator('.pericia-dados')).toHaveText('( ONP )');

  /* A classe Magia fica no filtro. */
  await p.getByLabel('Filtrar perícias').selectOption('Magia');
  await expect(p.locator('#a-pericias-encantar')).toBeVisible();
  await expect(p.locator('#a-pericias-canalizacaoMagica')).toBeVisible();
  await expect(p.locator('#a-pericias-esquiva')).toHaveCount(0);
  await p.getByLabel('Filtrar perícias').selectOption('Todas');

  /* Treino gasta SP e acende a linha; Outros não gasta, e os dois somam no bônus e na rolagem. */
  const esquiva = p.locator('.pericia-linha').filter({ hasText: 'Esquiva' });
  await p.locator('#a-pericias-esquiva').fill('7');
  await p.locator('#a-pericias-esquiva').press('Enter');
  await p.getByLabel('Outros de Esquiva').fill('3');
  await p.getByLabel('Outros de Esquiva').press('Enter');
  await expect(esquiva.locator('.pericia-bonus')).toHaveText('( 10 )');
  await expect(esquiva).toHaveAttribute('data-treinada', 'true');
  await expect(p.getByText('7 de 15 SP usados')).toBeVisible();
  await expect(p.getByRole('status').filter({ hasText: 'Salvo' })).toBeVisible();
  await p.getByRole('button', { name: 'Rolar d20 mais Esquiva' }).click();
  await expect(p.locator('.chat-popup .msg-det')).toHaveText(/^d20 \(\d+\) \+ 10$/);
});

test('armas: a ficha traz as três categorias, sem as específicas', async ({ browser }) => {
  const p = await novaPessoa(browser, 'Rui');
  await criarFicha(p, 'Guerreiro');
  for (const nome of ['Armas leves', 'Armas médias', 'Armas pesadas']) await expect(p.getByRole('button', { name: `Rolar d20 mais ${nome}` })).toBeVisible();
  for (const nome of ['Espada', 'Arco', 'Rapieira', 'Machado', 'Adaga', 'Escudo']) await expect(p.getByRole('button', { name: `Rolar d20 mais ${nome}` })).toHaveCount(0);
  await p.locator('#a-armas-pesadas').fill('4');
  await p.locator('#a-armas-pesadas').press('Enter');
  await p.getByRole('button', { name: 'Rolar d20 mais Armas pesadas' }).click();
  await expect(p.locator('.chat-popup .msg-rotulo')).toHaveText('Armas pesadas');
  await expect(p.locator('.chat-popup .msg-det')).toHaveText(/^d20 \(\d+\) \+ 4$/);
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

  await p.getByRole('tab', { name: 'Perícias' }).click();
  await p.locator('#a-pericias-esquiva').fill('4');
  await p.locator('#a-pericias-esquiva').press('Enter');
  await expect(p.getByText('4 de 32 SP usados')).toBeVisible();
  await expect(p.getByRole('status').filter({ hasText: 'Salvo' })).toBeVisible();

  await p.reload();
  await expect(p.getByLabel('Estágio do núcleo')).toHaveValue('3');
  await p.getByRole('tab', { name: 'Perícias' }).click();
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
  await jogador.getByRole('tab', { name: 'Perícias' }).click();
  await jogador.locator('#a-pericias-esquiva').fill('40');
  await jogador.locator('#a-pericias-esquiva').press('Enter');
  await expect(jogador.locator('#a-pericias-esquiva')).toHaveValue('15');
  await expect(jogador.getByText('15 de 15 SP usados')).toBeVisible();
  /* Sem SP sobrando, o treino não sobe. */
  await jogador.locator('#a-pericias-aparar').fill('3');
  await jogador.locator('#a-pericias-aparar').press('Enter');
  await expect(jogador.locator('#a-pericias-aparar')).toHaveValue('0');
  await expect(jogador.getByRole('status').filter({ hasText: 'Salvo' })).toBeVisible();

  await mestre.goto(`/fichas/${fichaId}`);
  await mestre.getByLabel('Bônus do mestre em vida').fill('10');
  await mestre.getByLabel('Bônus do mestre em vida').press('Enter');
  await expect(mestre.getByText('15 + vitalidade 0 × 2 + ajuste 10 = 25')).toBeVisible();
  await mestre.getByRole('tab', { name: 'Perícias' }).click();
  await mestre.getByLabel('Bônus do mestre em SP').fill('5');
  await mestre.getByLabel('Bônus do mestre em SP').press('Enter');
  await expect(mestre.getByText('15 de 20 SP usados')).toBeVisible();
  await mestre.getByRole('button', { name: 'Definir limites' }).click();
  await mestre.getByLabel('Limite de Aparar').fill('2');
  await expect(mestre.getByRole('status').filter({ hasText: 'Salvo' })).toBeVisible();

  await jogador.reload();
  await jogador.getByRole('tab', { name: 'Perícias' }).click();
  await expect(jogador.getByText('Máx. 2')).toBeVisible();
  await jogador.locator('#a-pericias-aparar').fill('9');
  await jogador.locator('#a-pericias-aparar').press('Enter');
  await expect(jogador.locator('#a-pericias-aparar')).toHaveValue('2');
  await expect(jogador.getByText('17 de 20 SP usados')).toBeVisible();
});

test('magias: adicionar, conjurar com desconto de mana e continuar depois de recarregar', async ({ browser }) => {
  const p = await novaPessoa(browser, 'Maga Lia');
  await criarFicha(p, 'Conjuradora');
  await p.getByRole('tab', { name: /^Magias/ }).click();
  await expect(p.getByText('Nenhuma magia ainda.')).toBeVisible();
  await p.getByRole('button', { name: 'Adicionar magia' }).click();
  await p.getByLabel('Nome da magia').fill('Faísca');
  await p.getByRole('tab', { name: /Atributos/ }).click();
  await p.getByLabel('Adicionar elemento').selectOption('fogo');
  await p.getByRole('tab', { name: /Magias/ }).click();
  await p.getByLabel('Elemento', { exact: true }).selectOption({ label: 'Fogo' });
  await p.getByLabel('Custo de mana').fill('5');
  await p.getByLabel('Custo de mana').press('Enter');
  await p.getByLabel('Descrição').fill('Uma faísca pequena.');
  await expect(p.getByRole('status').filter({ hasText: 'Salvo' })).toBeVisible();

  await p.getByRole('button', { name: 'Conjurar Faísca' }).click();
  await expect(p.locator('#v-manaAtual')).toHaveValue('25');
  await expect(p.getByRole('status').filter({ hasText: 'Salvo' })).toBeVisible();

  await p.reload();
  await expect(p.locator('#v-manaAtual')).toHaveValue('25');
  await p.getByRole('tab', { name: 'Magias (1)' }).click();
  await p.getByRole('button', { name: /^Faísca/ }).click();
  await expect(p.getByLabel('Descrição')).toHaveValue('Uma faísca pequena.');

  /* Sem mana suficiente, nada é descontado. */
  await p.getByLabel('Custo de mana').fill('99');
  await p.getByLabel('Custo de mana').press('Enter');
  await p.getByRole('button', { name: 'Conjurar Faísca' }).click();
  await expect(p.getByText(/Mana insuficiente/)).toBeVisible();
  await expect(p.locator('#v-manaAtual')).toHaveValue('25');
});

test('chat de dados: pop-up ao rolar, histórico guardado e continua depois de recarregar', async ({ browser }) => {
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

  /* Com o chat aberto, rolar pela ficha cai nele, sem pop-up por cima. */
  await p.getByRole('button', { name: 'Rolar d20 mais Destreza' }).click();
  await expect(p.locator('.chat-flutuante .msg')).toHaveCount(2);
  await expect(p.locator('.chat-popup')).toHaveCount(0);

  /* Com o chat fechado, rolar pela ficha mostra só o resultado, e não o chat inteiro. */
  await p.keyboard.press('Escape');
  await expect(p.locator('.chat-flutuante')).toHaveCount(0);
  await p.getByRole('button', { name: 'Rolar d20 mais Tração' }).click();
  await expect(p.locator('.chat-popup .msg-rotulo')).toHaveText('Tração');
  await expect(p.locator('.chat-flutuante')).toHaveCount(0);
  await expect(p.getByRole('status').filter({ hasText: 'Salvo' })).toBeVisible();

  /* O pop-up só sai pelo X: nem Esc, nem clique fora, nem o tempo. A rolagem seguinte troca o resultado. */
  await p.keyboard.press('Escape');
  await p.locator('.folio').click({ position: { x: 2, y: 2 } });
  await p.waitForTimeout(5000);
  await expect(p.locator('.chat-popup')).toBeVisible();
  await p.getByRole('button', { name: 'Rolar d20 mais Destreza' }).click();
  await expect(p.locator('.chat-popup .msg-rotulo')).toHaveText('Destreza');
  await expect(p.locator('.chat-popup .msg')).toHaveCount(1);
  await p.getByRole('button', { name: 'Fechar o resultado da rolagem' }).click();
  await expect(p.locator('.chat-popup')).toHaveCount(0);

  /* A pílula abre o chat inteiro, com a rolagem do pop-up. Ao fechar, o pop-up não volta. */
  await p.getByRole('button', { name: 'Rolar d20 mais Tração' }).click();
  await expect(p.locator('.chat-popup')).toBeVisible();
  await p.getByRole('button', { name: 'Chat de dados' }).click();
  await expect(p.locator('.chat-flutuante .msg')).toHaveCount(5);
  await expect(p.locator('.chat-popup')).toHaveCount(0);
  await p.keyboard.press('Escape');
  await expect(p.locator('.chat-popup')).toHaveCount(0);

  /* O histórico vem do banco: sobrevive a recarregar, na ordem certa. */
  await p.reload();
  await p.getByRole('button', { name: 'Chat de dados' }).click();
  await expect(p.locator('.msg')).toHaveCount(5);
  await expect(p.locator('.msg-det').first()).toHaveText(/^d6 /);
  await expect(p.locator('.msg-rotulo').last()).toHaveText('Tração');
  await expect(p.locator('.chat-dia')).toHaveText(['Hoje']);
});

test('chat de dados: o d20 não fica coberto pelo pop-up nem pelo chat aberto no computador', async ({ browser }) => {
  const p = await novaPessoa(browser, 'Jaci');
  await p.setViewportSize({ width: 1280, height: 800 });
  await criarFicha(p, 'Cobertura');
  await p.getByRole('button', { name: 'Rolar d20 mais Destreza' }).click();
  await expect(p.locator('.chat-popup')).toBeVisible();
  /* Se algo estivesse por cima, estes cliques falhariam. */
  await p.getByRole('button', { name: 'Rolar d20 mais Destreza' }).click();
  await p.getByRole('button', { name: 'Chat de dados' }).click();
  await expect(p.locator('.chat-flutuante .msg')).toHaveCount(2);
  await p.getByRole('button', { name: 'Rolar d20 mais Destreza' }).click();
  await expect(p.locator('.chat-flutuante .msg')).toHaveCount(3);
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
  await expect(jogador.locator('.chat-popup .msg-rotulo')).toHaveText('Destreza');
  await jogador.getByRole('button', { name: 'Fechar o resultado da rolagem' }).click();
  await jogador.locator('.chat-pilula').click();
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

test('ficha do mestre: o jogador só vê depois que ele a torna pública', async ({ browser }) => {
  const mestre = await novaPessoa(browser, 'Mestra Ana');
  const jogador = await novaPessoa(browser, 'Jogador Bia');
  const { campanha } = await (await mestre.request.post('/api/campanhas', { data: { nome: 'Segredos', descricao: '' } })).json();
  const detalhe = await (await mestre.request.get(`/api/campanhas/${campanha.id}`)).json();
  await jogador.request.post(`/api/convites/${detalhe.campanha.codigo}/entrar`, { data: {} });
  const { ficha } = await (await mestre.request.post('/api/fichas', { data: { dados: { nome: 'Vilão Oculto' } } })).json();
  await mestre.request.post(`/api/campanhas/${campanha.id}/fichas`, { data: { fichaId: ficha.id } });

  await mestre.goto(`/campanhas/${campanha.id}`);
  await jogador.goto(`/campanhas/${campanha.id}`);
  await expect(mestre.getByText('Privada: os jogadores não veem')).toBeVisible();
  await expect(jogador.getByRole('heading', { name: 'Segredos' })).toBeVisible();
  await expect(jogador.getByText('Vilão Oculto')).toHaveCount(0);

  await mestre.getByRole('button', { name: 'Tornar pública' }).click();
  await expect(mestre.getByText('Pública: os jogadores veem nome, foto e raça')).toBeVisible();
  await expect(jogador.getByText('Vilão Oculto')).toBeVisible({ timeout: 8000 });

  await mestre.getByRole('button', { name: 'Tornar privada' }).click();
  await expect(jogador.getByText('Vilão Oculto')).toHaveCount(0, { timeout: 8000 });
});

test('ficha: criar elemento, dano na magia e fadiga só com o mestre', async ({ browser }) => {
  const mestre = await novaPessoa(browser, 'Mestra Ana');
  const jogador = await novaPessoa(browser, 'Jogador Bia');
  await criarFicha(jogador, 'Kael');
  const fichaId = jogador.url().split('/').pop()!;

  /* Fora de campanha não há mestre: o dono ainda controla a própria fadiga. */
  await expect(jogador.locator('#r-fadiga')).toBeEnabled();

  await jogador.getByRole('button', { name: '+ Criar elemento' }).click();
  await jogador.getByLabel('Nome do elemento').fill('Lava');
  await jogador.getByLabel('Tipo').selectOption('fusao');
  await jogador.getByLabel('Primeiro elemento').selectOption('fogo');
  await jogador.getByLabel('Segundo elemento').selectOption('terra');
  await jogador.getByRole('button', { name: 'Salvar elemento' }).click();
  await expect(jogador.getByText('Fusão de Fogo e Terra')).toBeVisible();
  await jogador.getByRole('button', { name: 'Aumentar Lava' }).click();
  await expect(jogador.getByRole('status').filter({ hasText: 'Salvo' })).toBeVisible();
  await jogador.getByRole('button', { name: 'Rolar d20 mais Lava' }).click();
  await expect(jogador.locator('.msg-rotulo').last()).toHaveText('Lava');
  await jogador.locator('.chat-fechar').click();

  /* A fusão também parte de elemento criado, que fica preso enquanto fizer parte dela. */
  await jogador.getByRole('button', { name: '+ Criar elemento' }).click();
  await jogador.getByLabel('Nome do elemento').fill('Obsidiana');
  await jogador.getByLabel('Tipo').selectOption('fusao');
  await jogador.getByLabel('Primeiro elemento').selectOption({ label: 'Lava' });
  await jogador.getByLabel('Segundo elemento').selectOption('agua');
  await jogador.getByRole('button', { name: 'Salvar elemento' }).click();
  await expect(jogador.getByText('Fusão de Lava e Água')).toBeVisible();
  await jogador.getByRole('button', { name: '+ Criar elemento' }).click();
  await jogador.getByLabel('Nome do elemento').fill('Magma');
  await jogador.getByLabel('Tipo').selectOption('variacao');
  await jogador.getByLabel('Elemento de origem').selectOption({ label: 'Lava' });
  await jogador.getByRole('button', { name: 'Salvar elemento' }).click();
  await expect(jogador.getByText('Variação de Lava')).toBeVisible();
  await jogador.getByRole('button', { name: 'Remover Lava' }).click();
  await jogador.getByRole('button', { name: 'Confirmar: remover' }).click();
  await expect(jogador.getByText('Lava faz parte de Obsidiana. Remova Obsidiana primeiro.')).toBeVisible();
  await expect(jogador.getByText('Fusão de Fogo e Terra')).toBeVisible();
  await expect(jogador.getByRole('status').filter({ hasText: 'Salvo' })).toBeVisible();

  await jogador.getByRole('tab', { name: /Magias/ }).click();
  await jogador.getByRole('button', { name: 'Adicionar magia' }).click();
  await jogador.getByLabel('Nome da magia').fill('Erupção');
  await jogador.getByLabel('Dano').fill('2d6+3');
  await jogador.getByLabel('Elemento', { exact: true }).selectOption({ label: 'Lava (Fusão de Fogo e Terra)' });
  await expect(jogador.locator('.magia-custo')).toContainText('Dano: 2d6+3');
  await expect(jogador.getByRole('status').filter({ hasText: 'Salvo' })).toBeVisible();

  const { campanha } = await (await mestre.request.post('/api/campanhas', { data: { nome: 'Regras', descricao: '' } })).json();
  const detalhe = await (await mestre.request.get(`/api/campanhas/${campanha.id}`)).json();
  await jogador.request.post(`/api/convites/${detalhe.campanha.codigo}/entrar`, { data: {} });
  await jogador.request.post(`/api/campanhas/${campanha.id}/fichas`, { data: { fichaId } });

  await jogador.reload();
  await expect(jogador.getByText('Só o mestre da campanha muda a fadiga mental.')).toBeVisible();
  await expect(jogador.locator('#r-fadiga')).toBeDisabled();
  await expect(jogador.locator('#v-fadiga')).toBeDisabled();
  await expect(jogador.getByRole('button', { name: /Sem fadiga/ })).toBeDisabled();

  await mestre.goto(`/fichas/${fichaId}`);
  await expect(mestre.locator('#r-fadiga')).toBeEnabled();
  await mestre.getByRole('button', { name: /Desgaste/ }).click();
  await expect(mestre.locator('#v-fadiga')).toHaveValue('20');
  await expect.poll(async () => { await jogador.reload(); return jogador.locator('#v-fadiga').inputValue(); }, { timeout: 15000 }).toBe('20');
});
