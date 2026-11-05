/* Testes de ponta a ponta da API, contra o site compilado e um banco temporário. Rode `npm run build` antes. */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const PORTA = 3457;
const base = `http://127.0.0.1:${PORTA}`;
const ORIGEM_MESA = 'https://mesa.exemplo.com';
let servidor: ChildProcess;

let ipSeq = 0;
function cliente() {
  let cookie = '';
  /* Cada cliente simula um endereço diferente, para os testes não baterem no limite de cadastros por IP. */
  const ip = `10.0.0.${++ipSeq}`;
  return async (metodo: string, url: string, corpo?: unknown, cabecalhos: Record<string, string> = {}) => {
    const r = await fetch(base + url, {
      method: metodo,
      headers: {
        'X-Forwarded-For': ip,
        ...(metodo !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...cabecalhos,
      },
      body: metodo !== 'GET' ? JSON.stringify(corpo ?? {}) : undefined,
    });
    const definido = r.headers.get('set-cookie');
    if (definido) cookie = definido.split(';')[0];
    return { status: r.status, corpo: await r.json().catch(() => null) as any, cookieBruto: definido };
  };
}
type Cliente = ReturnType<typeof cliente>;

let seq = 0;
async function novaConta(nome = 'Pessoa') {
  const c = cliente();
  const email = `p${++seq}-${Date.now()}@exemplo.com`;
  const r = await c('POST', '/api/conta/cadastro', { nome, email, senha: 'senha-forte-1' });
  expect(r.status).toBe(201);
  return { c, email, id: r.corpo.usuario.id as string };
}
const novaFicha = async (c: Cliente, dados: object = {}) => (await c('POST', '/api/fichas', { dados })).corpo.ficha;

async function mesa() {
  const mestre = await novaConta('Mestre'), jog = await novaConta('Jogador'), intruso = await novaConta('Intruso');
  const c = (await mestre.c('POST', '/api/campanhas', { nome: 'A Queda', descricao: 'Teste' })).corpo.campanha;
  const codigo = (await mestre.c('GET', `/api/campanhas/${c.id}`)).corpo.campanha.codigo as string;
  const f = await novaFicha(jog.c, { nome: 'Kael', fadiga: 62 });
  return { mestre, jog, intruso, c, codigo, f };
}

beforeAll(async () => {
  const construido = spawnSync(process.execPath, ['-e', "process.exit(require('fs').existsSync('.next/BUILD_ID')?0:1)"]);
  if (construido.status !== 0) throw new Error('Rode `npm run build` antes dos testes.');
  servidor = spawn(process.execPath, ['scripts/servidor-teste.mjs', String(PORTA)], { stdio: 'ignore', env: { ...process.env, ORIGENS_TABLEBOLA: ORIGEM_MESA } });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base + '/api/conta')).status === 401) return; } catch { /* ainda subindo */ }
    await new Promise(ok => setTimeout(ok, 300));
  }
  throw new Error('O servidor de teste não subiu.');
});
afterAll(() => {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F']);
  else servidor.kill();
});

describe('contas', () => {
  it('senha nunca volta na resposta', async () => {
    const { c } = await novaConta();
    expect(JSON.stringify((await c('GET', '/api/conta')).corpo)).not.toMatch(/senha/i);
  });

  it('cookie de sessão é HttpOnly e SameSite', async () => {
    const r = await cliente()('POST', '/api/conta/cadastro', { nome: 'Cookie', email: `cookie-${Date.now()}@exemplo.com`, senha: 'senha-forte-1' });
    expect(r.cookieBruto).toMatch(/HttpOnly/);
    expect(r.cookieBruto).toMatch(/SameSite=Lax/);
  });

  it('cadastro recusa e-mail repetido, senha curta e e-mail inválido', async () => {
    const { email } = await novaConta();
    const c = cliente();
    expect((await c('POST', '/api/conta/cadastro', { nome: 'Outra', email: email.toUpperCase(), senha: 'senha-forte-1' })).status).toBe(409);
    const curta = await c('POST', '/api/conta/cadastro', { nome: 'Outra', email: 'novo@exemplo.com', senha: '123' });
    expect(curta.status).toBe(400);
    expect(curta.corpo.erro).toMatch(/8 caracteres/);
    expect((await c('POST', '/api/conta/cadastro', { nome: 'Outra', email: 'sem-arroba', senha: 'senha-forte-1' })).status).toBe(400);
  });

  it('login, sair e bloqueio após muitas tentativas', async () => {
    const { email } = await novaConta();
    const c = cliente();
    expect((await c('GET', '/api/conta')).status).toBe(401);
    expect((await c('POST', '/api/conta/entrar', { email, senha: 'errada-123' })).status).toBe(401);
    expect((await c('POST', '/api/conta/entrar', { email, senha: 'senha-forte-1' })).status).toBe(200);
    expect((await c('GET', '/api/conta')).status).toBe(200);
    await c('POST', '/api/conta/sair');
    expect((await c('GET', '/api/conta')).status).toBe(401);
    for (let i = 0; i < 10; i++) await c('POST', '/api/conta/entrar', { email, senha: 'errada-123' });
    expect((await c('POST', '/api/conta/entrar', { email, senha: 'senha-forte-1' })).status).toBe(429);
  });

  it('e-mail inexistente recebe a mesma resposta que senha errada', async () => {
    const { email } = await novaConta();
    const c = cliente();
    const a = await c('POST', '/api/conta/entrar', { email, senha: 'errada-123' });
    const b = await c('POST', '/api/conta/entrar', { email: 'ninguem@exemplo.com', senha: 'errada-123' });
    expect(a.status).toBe(b.status);
    expect(a.corpo.erro).toBe(b.corpo.erro);
  });

  it('trocar a senha desconecta os outros aparelhos', async () => {
    const { c, email } = await novaConta();
    const outro = cliente();
    await outro('POST', '/api/conta/entrar', { email, senha: 'senha-forte-1' });
    expect((await c('POST', '/api/conta/senha', { atual: 'errada-000', nova: 'senha-nova-22' })).status).toBe(400);
    expect((await c('POST', '/api/conta/senha', { atual: 'senha-forte-1', nova: 'senha-nova-22' })).status).toBe(200);
    expect((await c('GET', '/api/conta')).status).toBe(200);
    expect((await outro('GET', '/api/conta')).status).toBe(401);
  });

  it('pedido de outra origem é recusado', async () => {
    const { c } = await novaConta();
    expect((await c('POST', '/api/fichas', {}, { Origin: 'https://site-malicioso.com' })).status).toBe(403);
  });

  it('excluir conta exige a senha e preserva as fichas dos jogadores', async () => {
    const { mestre, jog, c, codigo, f } = await mesa();
    await jog.c('POST', `/api/convites/${codigo}/entrar`);
    await jog.c('POST', `/api/campanhas/${c.id}/fichas`, { fichaId: f.id });
    const fichaMestre = await novaFicha(mestre.c, { nome: 'NPC' });
    expect((await mestre.c('DELETE', '/api/conta', { senha: 'errada-000' })).status).toBe(400);
    expect((await mestre.c('DELETE', '/api/conta', { senha: 'senha-forte-1' })).status).toBe(200);
    expect((await mestre.c('GET', '/api/conta')).status).toBe(401);
    expect((await jog.c('GET', `/api/campanhas/${c.id}`)).status).toBe(404);
    expect((await jog.c('GET', `/api/fichas/${f.id}`)).corpo.ficha.campanhaId).toBeNull();
    expect((await jog.c('GET', `/api/fichas/${fichaMestre.id}`)).status).toBe(404);
    expect((await cliente()('POST', '/api/conta/entrar', { email: mestre.email, senha: 'senha-forte-1' })).status).toBe(401);
  });
});

describe('fichas', () => {
  it('ficha de outra pessoa não pode ser lida, editada, apagada nem rolada', async () => {
    const a = await novaConta('Ana'), b = await novaConta('Bia');
    const f = await novaFicha(a.c, { nome: 'Secreta' });
    expect((await b.c('GET', `/api/fichas/${f.id}`)).status).toBe(404);
    expect((await b.c('PATCH', `/api/fichas/${f.id}`, { nome: 'Hack' })).status).toBe(404);
    expect((await b.c('DELETE', `/api/fichas/${f.id}`)).status).toBe(404);
    expect((await b.c('POST', `/api/fichas/${f.id}/rolar`, { lados: 20 })).status).toBe(404);
    expect((await a.c('GET', `/api/fichas/${f.id}`)).corpo.ficha.nome).toBe('Secreta');
  });

  it('PATCH não muda dono nem campanha, trava as regras e mescla só o que veio', async () => {
    const a = await novaConta();
    const f = await novaFicha(a.c, { corpo: { tracao: 4 } });
    const { ficha } = (await a.c('PATCH', `/api/fichas/${f.id}`, { donoId: 'outro', campanhaId: 'x', vidaAtual: 9999, fadiga: 500, corpo: { vitalidade: 2 } })).corpo;
    expect(ficha.donoId).toBe(a.id);
    expect(ficha.campanhaId).toBeNull();
    expect(ficha.vidaAtual).toBe(19);
    expect(ficha.fadiga).toBe(100);
    expect(ficha.corpo.tracao).toBe(4);
  });

  it('duas edições simultâneas em campos diferentes não se apagam', async () => {
    const a = await novaConta();
    const f = await novaFicha(a.c);
    await Promise.all([
      a.c('PATCH', `/api/fichas/${f.id}`, { nome: 'Novo nome' }),
      a.c('PATCH', `/api/fichas/${f.id}`, { fadiga: 40 }),
      a.c('PATCH', `/api/fichas/${f.id}`, { raca: 'Humana' }),
    ]);
    const { ficha } = (await a.c('GET', `/api/fichas/${f.id}`)).corpo;
    expect([ficha.nome, ficha.fadiga, ficha.raca]).toEqual(['Novo nome', 40, 'Humana']);
  });

  it('foto com conteúdo que não é imagem é recusada; foto válida só abre para quem tem acesso', async () => {
    const a = await novaConta(), b = await novaConta();
    const f = await novaFicha(a.c);
    expect((await a.c('PATCH', `/api/fichas/${f.id}`, { foto: 'data:text/html;base64,PHNjcmlwdD4=' })).status).toBe(400);
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const { ficha } = (await a.c('PATCH', `/api/fichas/${f.id}`, { foto: png })).corpo;
    expect(ficha.fotoV).toBeGreaterThan(0);
    expect(JSON.stringify(ficha)).not.toContain('base64');
    expect((await a.c('GET', `/api/fichas/${f.id}/foto`)).status).toBe(200);
    expect((await b.c('GET', `/api/fichas/${f.id}/foto`)).status).toBe(404);
  });

  it('encerrar cena reduz a mana total na ficha e registra', async () => {
    const a = await novaConta();
    const f = await novaFicha(a.c, { mente: { onipotencia: 7 }, tier: 2, fadiga: 80 });
    const { ficha } = (await a.c('POST', `/api/fichas/${f.id}/encerrar-cena`)).corpo;
    expect(ficha.manaPerdida).toBe(9); // 20% de 46, para baixo
    expect(ficha.registro[0].txt).toMatch(/−9 de mana total/);
    const relida = (await a.c('GET', `/api/fichas/${f.id}`)).corpo.ficha;
    expect(relida.manaPerdida).toBe(9);
  });
});

describe('campanhas', () => {
  it('fluxo completo: criar, entrar pelo código, adicionar ficha', async () => {
    const { mestre, jog, c, codigo, f } = await mesa();
    expect(codigo).toMatch(/^[A-Z2-9]{8}$/);
    const previa = await jog.c('GET', `/api/convites/${codigo.toLowerCase()}`);
    expect(previa.corpo.campanha.nome).toBe('A Queda');
    expect(previa.corpo.jaParticipa).toBe(false);
    expect((await jog.c('POST', `/api/convites/${codigo}/entrar`)).status).toBe(200);
    await jog.c('POST', `/api/convites/${codigo}/entrar`); // entrar duas vezes não duplica
    expect((await jog.c('POST', `/api/campanhas/${c.id}/fichas`, { fichaId: f.id })).status).toBe(200);
    const visao = (await mestre.c('GET', `/api/campanhas/${c.id}`)).corpo;
    expect(visao.membros).toHaveLength(2);
    expect(visao.fichas[0].nome).toBe('Kael');
    const listas = (await jog.c('GET', '/api/campanhas')).corpo;
    expect(listas.jogador).toHaveLength(1);
    expect(listas.mestre).toHaveLength(0);
  });

  it('campanha é invisível para quem não participa e o código fica só com o mestre', async () => {
    const { jog, intruso, c, codigo } = await mesa();
    expect((await intruso.c('GET', `/api/campanhas/${c.id}`)).status).toBe(404);
    expect((await intruso.c('POST', `/api/campanhas/${c.id}/rolar`, { lados: 20 })).status).toBe(404);
    await jog.c('POST', `/api/convites/${codigo}/entrar`);
    expect((await jog.c('GET', `/api/campanhas/${c.id}`)).corpo.campanha.codigo).toBeUndefined();
    expect((await jog.c('POST', `/api/campanhas/${c.id}/codigo`)).status).toBe(403);
    expect((await jog.c('DELETE', `/api/campanhas/${c.id}`)).status).toBe(403);
  });

  it('mestre edita a ficha do jogador; colega não vê vida nem fadiga; mestre não apaga', async () => {
    const { mestre, jog, c, codigo, f } = await mesa();
    const colega = await novaConta('Colega');
    await jog.c('POST', `/api/convites/${codigo}/entrar`);
    await colega.c('POST', `/api/convites/${codigo}/entrar`);
    await jog.c('POST', `/api/campanhas/${c.id}/fichas`, { fichaId: f.id });
    expect((await mestre.c('PATCH', `/api/fichas/${f.id}`, { vidaAtual: 5 })).corpo.ficha.vidaAtual).toBe(5);
    expect((await mestre.c('GET', `/api/campanhas/${c.id}`)).corpo.fichas[0].fadiga).toBe(62);
    const doColega = (await colega.c('GET', `/api/campanhas/${c.id}`)).corpo.fichas[0];
    expect(doColega.nome).toBe('Kael');
    for (const campo of ['fadiga', 'vidaAtual', 'manaAtual', 'vidaMax', 'manaMax']) expect(doColega[campo]).toBeUndefined();
    expect((await colega.c('GET', `/api/fichas/${f.id}`)).status).toBe(404);
    expect((await jog.c('GET', `/api/campanhas/${c.id}`)).corpo.fichas[0].fadiga).toBe(62);
    expect((await mestre.c('DELETE', `/api/fichas/${f.id}`)).status).toBe(403);
  });

  it('ficha não entra em duas campanhas nem o mestre adiciona ficha alheia', async () => {
    const { mestre, jog, c, codigo, f } = await mesa();
    await jog.c('POST', `/api/convites/${codigo}/entrar`);
    await jog.c('POST', `/api/campanhas/${c.id}/fichas`, { fichaId: f.id });
    const outra = (await jog.c('POST', '/api/campanhas', { nome: 'Outra mesa' })).corpo.campanha;
    expect((await jog.c('POST', `/api/campanhas/${outra.id}/fichas`, { fichaId: f.id })).status).toBe(409);
    const alheia = await novaFicha(jog.c, { nome: 'Alheia' });
    expect((await mestre.c('POST', `/api/campanhas/${c.id}/fichas`, { fichaId: alheia.id })).status).toBe(404);
  });

  it('remover jogador tira a ficha da campanha e corta o acesso do mestre a ela', async () => {
    const { mestre, jog, intruso, c, codigo, f } = await mesa();
    await jog.c('POST', `/api/convites/${codigo}/entrar`);
    await jog.c('POST', `/api/campanhas/${c.id}/fichas`, { fichaId: f.id });
    expect((await intruso.c('DELETE', `/api/campanhas/${c.id}/membros/${jog.id}`)).status).toBe(404);
    expect((await mestre.c('DELETE', `/api/campanhas/${c.id}/membros/${mestre.id}`)).status).toBe(400);
    expect((await mestre.c('DELETE', `/api/campanhas/${c.id}/membros/${jog.id}`)).status).toBe(200);
    expect((await jog.c('GET', `/api/campanhas/${c.id}`)).status).toBe(404);
    expect((await mestre.c('GET', `/api/fichas/${f.id}`)).status).toBe(404);
    expect((await jog.c('GET', `/api/fichas/${f.id}`)).corpo.ficha.campanhaId).toBeNull();
  });

  it('jogador sai sozinho e leva a ficha; excluir campanha preserva as fichas', async () => {
    const { mestre, jog, c, codigo, f } = await mesa();
    await jog.c('POST', `/api/convites/${codigo}/entrar`);
    await jog.c('POST', `/api/campanhas/${c.id}/fichas`, { fichaId: f.id });
    expect((await jog.c('DELETE', `/api/campanhas/${c.id}/membros/${jog.id}`)).status).toBe(200);
    expect((await jog.c('GET', `/api/fichas/${f.id}`)).corpo.ficha.campanhaId).toBeNull();
    await jog.c('POST', `/api/convites/${codigo}/entrar`);
    await jog.c('POST', `/api/campanhas/${c.id}/fichas`, { fichaId: f.id });
    expect((await mestre.c('DELETE', `/api/campanhas/${c.id}`)).status).toBe(200);
    expect((await jog.c('GET', `/api/fichas/${f.id}`)).corpo.ficha.campanhaId).toBeNull();
  });

  it('gerar código novo invalida o antigo', async () => {
    const { mestre, intruso, c, codigo } = await mesa();
    const novo = (await mestre.c('POST', `/api/campanhas/${c.id}/codigo`)).corpo.codigo;
    expect(novo).not.toBe(codigo);
    expect((await intruso.c('POST', `/api/convites/${codigo}/entrar`)).status).toBe(404);
    expect((await intruso.c('POST', `/api/convites/${novo}/entrar`)).status).toBe(200);
  });

  it('rolagem de atributo é d20 + valor guardado, sem aceitar bônus do navegador, e aparece no registro', async () => {
    const { mestre, jog, c, codigo } = await mesa();
    await jog.c('POST', `/api/convites/${codigo}/entrar`);
    const f = await novaFicha(jog.c, { nome: 'Rola', corpo: { destreza: 7 } });
    await jog.c('POST', `/api/campanhas/${c.id}/fichas`, { fichaId: f.id });
    const r = (await jog.c('POST', `/api/fichas/${f.id}/rolar`, { atributo: 'corpo.destreza', lados: 100, bonus: 500 })).corpo.rolagem;
    expect(r.total).toBeGreaterThanOrEqual(8);
    expect(r.total).toBeLessThanOrEqual(27);
    expect(r.rotulo).toBe('Destreza');
    expect(r.det).toMatch(/^d20 \(\d+\) \+ 7$/);
    const { mensagens } = (await mestre.c('GET', `/api/campanhas/${c.id}/chat`)).corpo;
    expect(mensagens[0].autor).toBe('Rola');
    expect(mensagens[0].total).toBe(r.total);
    expect(mensagens[0].minha).toBe(false);
    expect((await jog.c('POST', `/api/fichas/${f.id}/rolar`, { lados: 7 })).status).toBe(400);
    expect((await jog.c('POST', `/api/fichas/${f.id}/rolar`, { atributo: 'constructor.x' })).status).toBe(400);
  });

  it('só o mestre muda o núcleo; perícias são salvas e entram na rolagem', async () => {
    const { mestre, jog, c, codigo } = await mesa();
    await jog.c('POST', `/api/convites/${codigo}/entrar`);
    const f = await novaFicha(jog.c, { nome: 'Núcleo', mente: { onipotencia: 7 }, nucleo: 12 });
    expect(f.nucleo).toBe(0);
    expect(f.pericias.esquiva).toBe(0);
    expect((await jog.c('PATCH', `/api/fichas/${f.id}`, { nucleo: 12 })).corpo.ficha.nucleo).toBe(0);
    await jog.c('POST', `/api/campanhas/${c.id}/fichas`, { fichaId: f.id });
    expect((await jog.c('PATCH', `/api/fichas/${f.id}`, { nucleo: 12 })).corpo.ficha.nucleo).toBe(0);

    const doMestre = (await mestre.c('PATCH', `/api/fichas/${f.id}`, { nucleo: 3, manaAtual: 51 })).corpo.ficha;
    expect(doMestre.nucleo).toBe(3);
    expect(doMestre.manaAtual).toBe(51);
    const salva = (await jog.c('PATCH', `/api/fichas/${f.id}`, { pericias: { esquiva: 4 } })).corpo.ficha;
    expect(salva.nucleo).toBe(3);
    expect(salva.pericias.esquiva).toBe(4);
    expect(salva.pericias.medicina).toBe(0);
    const r = (await jog.c('POST', `/api/fichas/${f.id}/rolar`, { atributo: 'pericias.esquiva' })).corpo.rolagem;
    expect(r.rotulo).toBe('Esquiva');
    expect(r.det).toMatch(/^d20 \(\d+\) \+ 4$/);
  });

  it('só o mestre muda bônus e limites; o jogador para neles e nos SP', async () => {
    const { mestre, jog, c, codigo, f } = await mesa();
    await jog.c('POST', `/api/convites/${codigo}/entrar`);
    await jog.c('POST', `/api/campanhas/${c.id}/fichas`, { fichaId: f.id });

    const tentativa = (await jog.c('PATCH', `/api/fichas/${f.id}`, { ajustes: { sp: 500 }, limites: { 'corpo.tracao': 999 } })).corpo.ficha;
    expect(tentativa.ajustes.sp).toBe(0);
    expect(tentativa.limites).toEqual({});

    const doMestre = (await mestre.c('PATCH', `/api/fichas/${f.id}`, { ajustes: { vida: 10, sp: 5 }, limites: { 'corpo.tracao': 3 } })).corpo.ficha;
    expect(doMestre.ajustes).toEqual({ vida: 10, mana: 0, sp: 5 });
    expect(doMestre.limites).toEqual({ 'corpo.tracao': 3 });

    const cortada = (await jog.c('PATCH', `/api/fichas/${f.id}`, { corpo: { tracao: 9 }, pericias: { esquiva: 50 } })).corpo.ficha;
    expect(cortada.corpo.tracao).toBe(3);
    expect(cortada.pericias.esquiva).toBe(20);
    expect(cortada.ajustes.vida).toBe(10);

    const acima = (await mestre.c('PATCH', `/api/fichas/${f.id}`, { corpo: { tracao: 9 }, pericias: { esquiva: 50 } })).corpo.ficha;
    expect(acima.corpo.tracao).toBe(9);
    expect(acima.pericias.esquiva).toBe(50);

    const desceu = (await jog.c('PATCH', `/api/fichas/${f.id}`, { pericias: { esquiva: 40 } })).corpo.ficha;
    expect(desceu.pericias.esquiva).toBe(40);
    const retirou = (await mestre.c('PATCH', `/api/fichas/${f.id}`, { limites: { 'corpo.tracao': null } })).corpo.ficha;
    expect(retirou.limites).toEqual({});
  });

  it('ficha criada ou importada não traz bônus e não passa dos SP', async () => {
    const { c } = await novaConta('Importa');
    const f = await novaFicha(c, { ajustes: { mana: 500, sp: 500 }, limites: { 'corpo.tracao': 1 }, pericias: { esquiva: 90 } });
    expect(f.ajustes).toEqual({ vida: 0, mana: 0, sp: 0 });
    expect(f.limites).toEqual({});
    expect(f.pericias.esquiva).toBe(15);
  });

  it('fora de campanha o dono não muda bônus nem limites', async () => {
    const { c } = await novaConta('Solo');
    const f = await novaFicha(c);
    const r = (await c('PATCH', `/api/fichas/${f.id}`, { ajustes: { vida: 50 } })).corpo.ficha;
    expect(r.ajustes.vida).toBe(0);
  });
});

describe('magias', () => {
  it('são salvas pelo PATCH, limpas pelo servidor, e o colega não as vê', async () => {
    const { jog, intruso, c, codigo, f } = await mesa();
    const magias = [{ id: 'a1', nome: 'Faísca', elemento: 'fogo', custo: 5, alcance: '9 m', duracao: 'Instantânea', descricao: 'Uma faísca.', extra: 'some' }];
    const salva = (await jog.c('PATCH', `/api/fichas/${f.id}`, { magias })).corpo.ficha;
    expect(salva.magias).toHaveLength(1);
    expect(salva.magias[0].nome).toBe('Faísca');
    expect(salva.magias[0].extra).toBeUndefined();
    await intruso.c('POST', `/api/convites/${codigo}/entrar`);
    await jog.c('POST', `/api/convites/${codigo}/entrar`);
    await jog.c('POST', `/api/campanhas/${c.id}/fichas`, { fichaId: f.id });
    expect(JSON.stringify((await intruso.c('GET', `/api/campanhas/${c.id}`)).corpo)).not.toContain('Faísca');
  });
});

describe('integração com o Tablebola', () => {
  async function fichaComChave(dados: object = { nome: 'Kael', corpo: { vitalidade: 5 } }) {
    const dono = await novaConta('Dona');
    const f = await novaFicha(dono.c, dados);
    const r = await dono.c('POST', `/api/fichas/${f.id}/chaves`, { rotulo: 'Mesa' });
    expect(r.status).toBe(201);
    return { dono, f, segredo: r.corpo.segredo as string, chave: r.corpo.chave };
  }
  const comChave = (url: string, segredo: string, init: RequestInit = {}) =>
    fetch(base + url, { ...init, headers: { Authorization: `Bearer ${segredo}`, ...init.headers } });

  it('o dono lê com a própria sessão; outro usuário e quem não tem chave não leem', async () => {
    const { dono, f } = await fichaComChave();
    const outro = await novaConta('Outra');
    const r = await dono.c('GET', `/api/integracao/fichas/${f.id}/resumo`);
    expect(r.status).toBe(200);
    expect(r.corpo.schemaVersion).toBe(1);
    expect(r.corpo.nome).toBe('Kael');
    expect(r.corpo.recursos[0]).toEqual({ id: 'vida', rotulo: 'Vida', atual: 25, max: 25 });
    expect(r.corpo.acoes.length).toBe(73);
    expect((await outro.c('GET', `/api/integracao/fichas/${f.id}/resumo`)).status).toBe(404);
    expect((await fetch(`${base}/api/integracao/fichas/${f.id}/resumo`)).status).toBe(401);
    /* Saber o id da ficha não abre nada: é só o que o token do Tablebola guarda. */
    expect((await fetch(`${base}/api/integracao/fichas/${f.id}`)).status).toBe(401);
  });

  it('a chave lê só a própria ficha; chave errada ou revogada recebe 404', async () => {
    const { dono, f, segredo, chave } = await fichaComChave();
    const outra = await novaFicha(dono.c, { nome: 'Outra' });
    expect((await comChave(`/api/integracao/fichas/${f.id}/resumo`, segredo)).status).toBe(200);
    expect((await comChave(`/api/integracao/fichas/${outra.id}/resumo`, segredo)).status).toBe(404);
    expect((await comChave(`/api/integracao/fichas/${f.id}/resumo`, 'ohi_errada-errada-errada-errada')).status).toBe(404);
    expect((await comChave(`/api/integracao/fichas/${f.id}/resumo`, 'invalida')).status).toBe(404);
    expect((await dono.c('DELETE', `/api/fichas/${f.id}/chaves/${chave.id}`)).status).toBe(200);
    expect((await comChave(`/api/integracao/fichas/${f.id}/resumo`, segredo)).status).toBe(404);
  });

  it('só o dono gerencia chaves, e o segredo não aparece na listagem', async () => {
    const { mestre, jog, intruso, c, codigo, f } = await mesa();
    await jog.c('POST', `/api/convites/${codigo}/entrar`);
    await jog.c('POST', `/api/campanhas/${c.id}/fichas`, { fichaId: f.id });
    const { segredo } = (await jog.c('POST', `/api/fichas/${f.id}/chaves`, { rotulo: 'Minha' })).corpo;
    const lista = await jog.c('GET', `/api/fichas/${f.id}/chaves`);
    expect(lista.corpo.chaves).toHaveLength(1);
    expect(JSON.stringify(lista.corpo)).not.toContain(segredo);
    expect((await mestre.c('POST', `/api/fichas/${f.id}/chaves`, { rotulo: 'Do mestre' })).status).toBe(403);
    expect((await mestre.c('GET', `/api/fichas/${f.id}/chaves`)).status).toBe(403);
    expect((await intruso.c('GET', `/api/fichas/${f.id}/chaves`)).status).toBe(404);
    expect((await jog.c('POST', `/api/fichas/${f.id}/chaves`, { rotulo: '   ' })).status).toBe(400);
  });

  it('recursos: atualiza, limita ao máximo, recusa o resto e aparece para o dono', async () => {
    const { dono, f, segredo } = await fichaComChave();
    const patch = (corpo: unknown) => comChave(`/api/integracao/fichas/${f.id}/recursos`, segredo, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
    });
    const ok = await patch({ vidaAtual: 3 });
    expect(ok.status).toBe(200);
    expect((await ok.json()).recursos[0].atual).toBe(3);
    expect((await dono.c('GET', `/api/fichas/${f.id}`)).corpo.ficha.vidaAtual).toBe(3);
    expect((await (await patch({ vidaAtual: 5000 })).json()).recursos[0].atual).toBe(25);
    for (const ruim of [{ nome: 'Hack' }, { vidaAtual: 1, nucleo: 12 }, { vidaAtual: -1 }, { vidaAtual: 1.5 }, { vidaAtual: '3' }, {}]) {
      expect((await patch(ruim)).status, JSON.stringify(ruim)).toBe(400);
    }
    const final = (await dono.c('GET', `/api/fichas/${f.id}`)).corpo.ficha;
    expect(final.nome).toBe('Kael');
    expect(final.nucleo).toBe(0);
    /* A chave não serve nas rotas normais da ficha. */
    expect((await comChave(`/api/fichas/${f.id}`, segredo)).status).toBe(401);
  });

  it('CORS: só a origem da lista recebe permissão, sem credenciais', async () => {
    const { f, segredo } = await fichaComChave();
    const url = `/api/integracao/fichas/${f.id}/resumo`;
    const permitida = await comChave(url, segredo, { headers: { Origin: ORIGEM_MESA } });
    expect(permitida.status).toBe(200);
    expect(permitida.headers.get('access-control-allow-origin')).toBe(ORIGEM_MESA);
    expect(permitida.headers.get('access-control-allow-credentials')).toBeNull();
    const negada = await comChave(url, segredo, { headers: { Origin: 'https://outro.exemplo.com' } });
    expect(negada.status).toBe(403);
    expect(negada.headers.get('access-control-allow-origin')).toBeNull();

    const preparo = await fetch(base + url, { method: 'OPTIONS', headers: { Origin: ORIGEM_MESA, 'Access-Control-Request-Method': 'PATCH' } });
    expect(preparo.status).toBe(204);
    expect(preparo.headers.get('access-control-allow-headers')).toContain('Authorization');
    const preparoNegado = await fetch(base + url, { method: 'OPTIONS', headers: { Origin: 'https://outro.exemplo.com' } });
    expect(preparoNegado.status).toBe(403);

    /* As rotas normais continuam fechadas para outras origens, mesmo para as da lista. */
    const comum = await fetch(`${base}/api/fichas`, { headers: { Origin: ORIGEM_MESA } });
    expect(comum.headers.get('access-control-allow-origin')).toBeNull();
    const c = cliente();
    expect((await c('POST', '/api/conta/entrar', { email: 'a@exemplo.com', senha: 'x' }, { Origin: ORIGEM_MESA })).status).toBe(403);
    expect((await fetch(`${base}/api/fichas`, { method: 'OPTIONS' })).status).toBe(204);
  });

  it('sessão vinda de outra origem não abre a ficha', async () => {
    const { f, dono } = await fichaComChave();
    const r = await dono.c('GET', `/api/integracao/fichas/${f.id}/resumo`, undefined, { Origin: ORIGEM_MESA });
    expect(r.status).toBe(401);
  });

  it('retrato: a chave lê; sem chave, não', async () => {
    const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const { dono, f, segredo } = await fichaComChave();
    await dono.c('PATCH', `/api/fichas/${f.id}`, { foto: pixel });
    const resumo = await (await comChave(`/api/integracao/fichas/${f.id}/resumo`, segredo)).json();
    expect(resumo.retrato.url).toBe(`/api/integracao/fichas/${f.id}/retrato`);
    const foto = await comChave(resumo.retrato.url, segredo);
    expect(foto.status).toBe(200);
    expect(foto.headers.get('content-type')).toBe('image/png');
    expect((await fetch(base + resumo.retrato.url)).status).toBe(401);
  });

  it('apagar a ficha ou a conta leva as chaves junto', async () => {
    const a = await fichaComChave();
    expect((await a.dono.c('DELETE', `/api/fichas/${a.f.id}`)).status).toBe(200);
    expect((await comChave(`/api/integracao/fichas/${a.f.id}/resumo`, a.segredo)).status).toBe(404);
    const b = await fichaComChave();
    expect((await b.dono.c('DELETE', '/api/conta', { senha: 'senha-forte-1' })).status).toBe(200);
    expect((await comChave(`/api/integracao/fichas/${b.f.id}/resumo`, b.segredo)).status).toBe(404);
  });

  it('só a rota embutida entra em iframe, e só nas origens da lista', async () => {
    const embutida = (await fetch(`${base}/embutido/fichas/qualquer`)).headers.get('content-security-policy');
    expect(embutida).toContain(`frame-ancestors ${ORIGEM_MESA}`);
    for (const caminho of ['/entrar', '/fichas', '/api/conta']) {
      expect((await fetch(base + caminho, { redirect: 'manual' })).headers.get('content-security-policy'), caminho).toContain("frame-ancestors 'none'");
    }
  });
});

describe('chat de dados', () => {
  it('rolagem de ficha fora de campanha fica salva e só o dono vê', async () => {
    const a = await novaConta('Ana'), b = await novaConta('Bia');
    const f = await novaFicha(a.c, { nome: 'Solo' });
    const r = (await a.c('POST', `/api/fichas/${f.id}/rolar`, { lados: 20, bonus: 2 })).corpo.rolagem;
    const chat = (await a.c('GET', `/api/fichas/${f.id}/chat`)).corpo;
    expect(chat.mensagens.map((m: any) => m.id)).toEqual([r.id]);
    expect(chat.mensagens[0].minha).toBe(true);
    expect((await b.c('GET', `/api/fichas/${f.id}/chat`)).status).toBe(404);
    expect((await cliente()('GET', `/api/fichas/${f.id}/chat`)).status).toBe(401);
  });

  it('o chat da campanha é de todos os membros e fechado para quem está fora', async () => {
    const { mestre, jog, intruso, c, codigo, f } = await mesa();
    await jog.c('POST', `/api/convites/${codigo}/entrar`);
    await jog.c('POST', `/api/campanhas/${c.id}/fichas`, { fichaId: f.id });
    await jog.c('POST', `/api/fichas/${f.id}/rolar`, { lados: 20 });
    await mestre.c('POST', `/api/campanhas/${c.id}/rolar`, { lados: 6, bonus: 1 });
    const visao = (await jog.c('GET', `/api/campanhas/${c.id}/chat`)).corpo.mensagens;
    expect(visao.map((m: any) => [m.autor, m.minha])).toEqual([['Kael', true], ['Mestre', false]]);
    const doMestre = (await mestre.c('GET', `/api/campanhas/${c.id}/chat`)).corpo.mensagens;
    expect(doMestre.map((m: any) => m.minha)).toEqual([false, true]);
    expect(JSON.stringify(doMestre)).not.toContain('usuarioId');
    expect((await intruso.c('GET', `/api/campanhas/${c.id}/chat`)).status).toBe(404);
    /* Depois de removido, o jogador perde o chat. */
    await mestre.c('DELETE', `/api/campanhas/${c.id}/membros/${jog.id}`);
    expect((await jog.c('GET', `/api/campanhas/${c.id}/chat`)).status).toBe(404);
  });

  it('histórico da ficha e da campanha não se misturam quando a ficha muda de lugar', async () => {
    const { jog, c, codigo, f } = await mesa();
    await jog.c('POST', `/api/convites/${codigo}/entrar`);
    await jog.c('POST', `/api/fichas/${f.id}/rolar`, { lados: 4 });
    await jog.c('POST', `/api/campanhas/${c.id}/fichas`, { fichaId: f.id });
    await jog.c('POST', `/api/fichas/${f.id}/rolar`, { lados: 8 });
    const daMesa = (await jog.c('GET', `/api/campanhas/${c.id}/chat`)).corpo.mensagens;
    expect(daMesa).toHaveLength(1);
    expect(daMesa[0].det).toMatch(/^d8 /);
    const soDela = (await jog.c('GET', `/api/fichas/${f.id}/chat`)).corpo.mensagens;
    expect(soDela).toHaveLength(1);
    expect(soDela[0].det).toMatch(/^d4 /);
  });

  it('entrega 50 por vez, em ordem, pagina sem repetir e guarda só as 500 mais recentes', async () => {
    const a = await novaConta();
    const f = await novaFicha(a.c, { nome: 'Muitas' });
    const criadas: string[] = [];
    for (let i = 0; i < 505; i++) criadas.push((await a.c('POST', `/api/fichas/${f.id}/rolar`, { lados: 20 })).corpo.rolagem.id);

    const url = `/api/fichas/${f.id}/chat`;
    const lidas: any[] = [];
    let pagina = (await a.c('GET', url)).corpo;
    expect(pagina.mensagens).toHaveLength(50);
    expect(pagina.temMais).toBe(true);
    lidas.unshift(...pagina.mensagens);
    while (pagina.temMais) {
      pagina = (await a.c('GET', `${url}?antes=${lidas[0].em}_${lidas[0].id}`)).corpo;
      lidas.unshift(...pagina.mensagens);
    }
    expect(lidas).toHaveLength(500);
    expect(new Set(lidas.map(m => m.id)).size).toBe(500);
    expect(lidas.every((m, i) => i === 0 || lidas[i - 1].em <= m.em)).toBe(true);
    /* As 500 mais recentes, exatamente. */
    expect(new Set(lidas.map(m => m.id))).toEqual(new Set(criadas.slice(5)));
    expect((await a.c('GET', `${url}?antes=lixo`)).status).toBe(400);
  }, 90000);

  it('apagar a ficha leva o histórico só dela, mas não o que já foi para a mesa', async () => {
    const { mestre, jog, c, codigo, f } = await mesa();
    await jog.c('POST', `/api/convites/${codigo}/entrar`);
    await jog.c('POST', `/api/campanhas/${c.id}/fichas`, { fichaId: f.id });
    await jog.c('POST', `/api/fichas/${f.id}/rolar`, { lados: 20 });
    expect((await jog.c('DELETE', `/api/fichas/${f.id}`)).status).toBe(200);
    const log = (await mestre.c('GET', `/api/campanhas/${c.id}/chat`)).corpo.mensagens;
    expect(log).toHaveLength(1);
    expect(log[0].autor).toBe('Kael');
    expect(log[0].fotoV).toBe(0);
  });

  it('excluir a conta apaga o nome da pessoa do histórico da mesa', async () => {
    const { mestre, jog, c, codigo } = await mesa();
    await jog.c('POST', `/api/convites/${codigo}/entrar`);
    await jog.c('POST', `/api/campanhas/${c.id}/rolar`, { lados: 20 });
    expect((await mestre.c('GET', `/api/campanhas/${c.id}/chat`)).corpo.mensagens[0].autor).toBe('Jogador');
    expect((await jog.c('DELETE', '/api/conta', { senha: 'senha-forte-1' })).status).toBe(200);
    const log = (await mestre.c('GET', `/api/campanhas/${c.id}/chat`)).corpo.mensagens;
    expect(log[0].autor).toBe('Conta removida');
    expect(log[0].minha).toBe(false);
  });
});
