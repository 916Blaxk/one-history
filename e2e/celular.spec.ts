import { expect, test } from '@playwright/test';

/* O que precisa continuar valendo no celular: nada estoura a tela, e dá para tocar nos controles. */
test('celular: a ficha cabe na tela, uma parte por vez pelo menu, com botões para o dedo', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, extraHTTPHeaders: { 'X-Forwarded-For': '10.3.0.1' } });
  const p = await ctx.newPage();
  await p.goto('/entrar');
  /* O formulário cabe na primeira tela, sem rolar. */
  const caixa = await p.getByRole('button', { name: 'Entrar', exact: true }).last().boundingBox();
  expect(caixa!.y + caixa!.height).toBeLessThan(844);

  await p.getByRole('tab', { name: 'Criar conta' }).tap();
  await p.getByLabel('Seu nome na mesa').fill('Mestra');
  await p.getByLabel('E-mail').fill(`celular-${Date.now()}@exemplo.com`);
  await p.getByLabel(/^Senha/).fill('senha-forte-1');
  await p.getByRole('button', { name: 'Criar conta', exact: true }).last().tap();
  await expect(p.getByRole('heading', { name: 'Minhas fichas' })).toBeVisible();
  const { ficha } = await (await p.request.post('/api/fichas', { data: { dados: { nome: 'Kael' } } })).json();

  /* Não há barra embaixo: Minhas fichas e Campanhas ficam no topo, como ícones. */
  const link = await p.getByRole('link', { name: 'Campanhas' }).first().boundingBox();
  expect(link!.y).toBeLessThan(80);
  await p.getByRole('link', { name: 'Campanhas' }).first().tap();
  await expect(p).toHaveURL(/\/campanhas$/);

  await p.goto(`/fichas/${ficha.id}`);
  /* Começa no que se usa durante a cena; a barra de ações fica no menu. */
  await expect(p.locator('#v-vidaAtual')).toBeVisible();
  await expect(p.getByLabel('Nome', { exact: true })).toBeHidden();
  await expect(p.getByRole('button', { name: 'Duplicar' })).toBeHidden();
  await p.getByRole('button', { name: 'Abrir o menu da ficha' }).tap();
  await expect(p.getByRole('button', { name: 'Duplicar' })).toBeVisible();
  await p.getByRole('button', { name: 'Informações', exact: true }).tap();
  await expect(p.getByLabel('Nome', { exact: true })).toBeVisible();
  await expect(p.locator('#v-vidaAtual')).toBeHidden();
  await p.getByRole('button', { name: 'Abrir o menu da ficha' }).tap();
  await p.getByRole('button', { name: 'Atributos', exact: true }).tap();
  await p.getByLabel('Adicionar elemento').selectOption('fogo');

  const passo = await p.getByRole('button', { name: 'Aumentar Fogo' }).boundingBox();
  const rolar = await p.getByRole('button', { name: 'Rolar d20 mais Fogo' }).boundingBox();
  for (const alvo of [passo!, rolar!]) {
    expect(alvo.height).toBeGreaterThanOrEqual(44);
    expect(alvo.width).toBeGreaterThanOrEqual(40);
  }
  await p.getByRole('button', { name: 'Aumentar Fogo' }).tap();
  await expect(p.locator('#a-elementos-fogo')).toHaveValue('1');
  expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

  /* Nenhum campo com letra abaixo de 16 px: o iPhone daria zoom ao tocar. */
  const pequenos = await p.evaluate(() => [...document.querySelectorAll<HTMLElement>('input:not([type=range]):not([type=checkbox]):not([type=radio]), select, textarea')]
    .filter((e) => e.offsetParent && parseFloat(getComputedStyle(e).fontSize) < 16).map((e) => e.id || e.className));
  expect(pequenos).toEqual([]);
  await ctx.close();
});
