/* Testes da mesa pelo socket, contra o site compilado e um banco temporário. Rode `npx next build` antes. */
/* eslint-disable @typescript-eslint/no-explicit-any -- o teste lê o que chega do socket sem tipo, como um cliente qualquer */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const PORTA = 3459;
const base = `http://127.0.0.1:${PORTA}`;
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'one-history-mesa-'));
const banco = path.join(pasta, 'teste.db');
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
let servidor: ChildProcess;
let seq = 0;

async function subir() {
  servidor = spawn(process.execPath, ['scripts/servidor-teste.mjs', String(PORTA)], { stdio: 'ignore', env: { ...process.env, BANCO_TESTE: banco } });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${base}/api/conta`)).status === 401) return; } catch { /* ainda subindo */ }
    await new Promise(ok => setTimeout(ok, 300));
  }
  throw new Error('O servidor de teste não subiu.');
}
function derrubar() {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F']);
  else servidor.kill('SIGKILL');
}

async function novaConta(nome: string) {
  const ip = `10.1.0.${++seq}`;
  let cookie = '';
  const c = async (metodo: string, url: string, corpo?: unknown) => {
    const r = await fetch(base + url, {
      method: metodo,
      headers: { 'X-Forwarded-For': ip, ...(metodo !== 'GET' ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: metodo !== 'GET' ? JSON.stringify(corpo ?? {}) : undefined,
    });
    const definido = r.headers.get('set-cookie');
    if (definido) cookie = definido.split(';')[0];
    return { status: r.status, corpo: await r.json().catch(() => null) as any };
  };
  const r = await c('POST', '/api/conta/cadastro', { nome, email: `m${seq}-${Date.now()}@exemplo.com`, senha: 'senha-forte-1' });
  expect(r.status).toBe(201);
  return { c, id: r.corpo.usuario.id as string, nome, cookie: () => cookie };
}
type Conta = Awaited<ReturnType<typeof novaConta>>;

/* Guarda tudo o que chega, para o teste esperar por uma condição sem perder o que veio antes. */
class Cliente {
  socket: Socket;
  eventos: any[] = [];
  snapshot: any = null;
  erroConexao: string | null = null;
  tokens = new Map<string, any>();
  constructor(cabecalhos: Record<string, string>) {
    this.socket = io(base, { extraHeaders: cabecalhos, transports: ['websocket'], reconnection: false, forceNew: true });
    this.socket.on('connect_error', (e: Error) => { this.erroConexao = e.message; });
    this.socket.on('room:snapshot', (s: any) => {
      this.snapshot = s;
      this.tokens = new Map(s.tokens.map((t: any) => [t.id, t]));
    });
    this.socket.on('room:event', (e: any) => {
      this.eventos.push(e);
      if (e.token) this.tokens.set(e.token.id, e.token);
      if (e.type === 'token:removed') this.tokens.delete(e.id);
    });
  }
  comando(m: object) { this.socket.emit('room:command', m); }
  ultimoToken(id: string) { return this.tokens.get(id); }
  fechar() { this.socket.disconnect(); }
}
async function ate<T>(fn: () => T, ms = 4000): Promise<NonNullable<T>> {
  const fim = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v) return v as NonNullable<T>;
    if (Date.now() > fim) throw new Error('A condição não aconteceu a tempo: ' + fn.toString());
    await new Promise(ok => setTimeout(ok, 15));
  }
}
const abertos: Cliente[] = [];
function conectar(conta: Conta) {
  const cliente = new Cliente({ Cookie: conta.cookie() });
  abertos.push(cliente);
  return cliente;
}
async function entrar(conta: Conta, campanhaId: string) {
  const cliente = conectar(conta);
  await ate(() => cliente.socket.connected);
  cliente.socket.emit('room:join', { campanhaId, papel: 'gm', role: 'gm' });
  await ate(() => cliente.snapshot);
  return cliente;
}
let idToken = 0;
function novoToken(mudancas: object = {}) {
  return { id: `t${++idToken}`, name: 'Herói', x: 0, y: 0, size: 1, rotation: 0, spriteIds: [], activeSpriteId: null, flipX: false, color: '#806247', ownerIds: [], hidden: false, ...mudancas };
}
async function criarToken(cliente: Cliente, mudancas: object = {}) {
  const token = novoToken(mudancas);
  cliente.comando({ type: 'token:create', token, sprites: [] });
  await ate(() => cliente.ultimoToken(token.id));
  return token.id;
}
async function mesaCompleta() {
  const mestre = await novaConta('Mestra'), jogador = await novaConta('Jogador'), colega = await novaConta('Colega'), fora = await novaConta('Fora');
  const { campanha } = (await mestre.c('POST', '/api/campanhas', { nome: 'A Queda' })).corpo;
  const { codigo } = (await mestre.c('GET', `/api/campanhas/${campanha.id}`)).corpo.campanha;
  await jogador.c('POST', `/api/convites/${codigo}/entrar`);
  await colega.c('POST', `/api/convites/${codigo}/entrar`);
  const ficha = (await jogador.c('POST', '/api/fichas', { dados: { nome: 'Kael', corpo: { vitalidade: 5, destreza: 7 } } })).corpo.ficha;
  await jogador.c('POST', `/api/campanhas/${campanha.id}/fichas`, { fichaId: ficha.id });
  return { mestre, jogador, colega, fora, id: campanha.id as string, ficha };
}

beforeAll(subir);
afterAll(() => {
  for (const c of abertos) c.fechar();
  derrubar();
  fs.rmSync(pasta, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

describe('autenticação do socket', () => {
  it('sem sessão, com sessão falsa ou de outra origem, a conexão é recusada', async () => {
    const sem = new Cliente({});
    await ate(() => sem.erroConexao);
    expect(sem.erroConexao).toBe('nao-autenticado');
    const falsa = new Cliente({ Cookie: 'oh_sessao=inventado' });
    await ate(() => falsa.erroConexao);
    expect(falsa.erroConexao).toBe('nao-autenticado');
    const conta = await novaConta('Origem');
    const estranha = new Cliente({ Cookie: conta.cookie(), Origin: 'https://outro-site.exemplo.com' });
    await ate(() => estranha.erroConexao);
    expect(estranha.socket.connected).toBe(false);
  });

  it('sair da conta não dá acesso a uma nova conexão', async () => {
    const conta = await novaConta('Saída');
    const cookie = conta.cookie();
    await conta.c('POST', '/api/conta/sair');
    const cliente = new Cliente({ Cookie: cookie });
    await ate(() => cliente.erroConexao);
    expect(cliente.erroConexao).toBe('nao-autenticado');
  });

  it('quem não é da campanha não entra, e campanha inexistente responde igual', async () => {
    const { fora, id } = await mesaCompleta();
    for (const campanhaId of [id, 'naoexiste']) {
      const cliente = conectar(fora);
      await ate(() => cliente.socket.connected);
      cliente.socket.emit('room:join', { campanhaId });
      await ate(() => cliente.eventos.some(e => e.type === 'room:denied'));
      expect(cliente.snapshot).toBeNull();
      cliente.comando({ type: 'chat:send', message: { type: 'normal', text: 'oi' } });
    }
  });

  it('a página da mesa também recusa quem não participa', async () => {
    const { fora, id, mestre } = await mesaCompleta();
    const pagina = (conta: Conta) => fetch(`${base}/campanhas/${id}/mesa`, { headers: { Cookie: conta.cookie() } }).then(r => r.text());
    expect(await pagina(fora)).toContain('Campanha não encontrada');
    expect(await pagina(mestre)).not.toContain('Campanha não encontrada');
  });
});

describe('papéis vêm do banco', () => {
  it('o mestre é GM mesmo entrando depois, e o papel enviado pelo cliente é ignorado', async () => {
    const { mestre, jogador, id } = await mesaCompleta();
    const j = await entrar(jogador, id);
    expect(j.snapshot.role).toBe('player');
    expect(j.snapshot.selfId).toBe(jogador.id);
    const m = await entrar(mestre, id);
    expect(m.snapshot.role).toBe('gm');
    expect(m.snapshot.selfId).toBe(mestre.id);
  });

  it('jogador não usa os controles do mestre', async () => {
    const { mestre, jogador, id } = await mesaCompleta();
    const j = await entrar(jogador, id);
    const m = await entrar(mestre, id);
    const negados = () => j.eventos.filter(e => e.type === 'permission:error').length;
    for (const [i, comando] of ([
      { type: 'grid:update', grid: { enabled: false, cellSize: 50, opacity: 0.3 } },
      { type: 'fog:traco', camada: 'mundo', revelar: false, raio: 2, pontos: [0, 0] },
      { type: 'fog:cobrir', camada: 'c1' },
      { type: 'fog:limpar', camada: 'mundo' },
      { type: 'fog:clear' },
      { type: 'scene:update', id: 'c1', oculto: false },
      { type: 'player:role', playerKey: jogador.id, role: 'spectator' },
      { type: 'player:remove', playerKey: mestre.id },
    ] as object[]).entries()) {
      j.comando(comando);
      await ate(() => negados() === i + 1);
    }
    m.comando({ type: 'fog:traco', camada: 'mundo', revelar: false, raio: 1, pontos: [0, 0] });
    await ate(() => j.eventos.some(e => e.type === 'fog:traco'));
  });

  it('cenário oculto só chega ao jogador quando o mestre mostra, já com a névoa pronta', async () => {
    const { mestre, jogador, id } = await mesaCompleta();
    const m = await entrar(mestre, id);
    const j = await entrar(jogador, id);
    m.comando({ type: 'scene:add', scene: { id: 'prep', imageUrl: PIXEL, x: 500, y: 0, width: 100, height: 100, nome: 'Caverna', oculto: true } });
    await ate(() => m.eventos.some(e => e.type === 'scene:added' && e.scene.id === 'prep'));
    m.comando({ type: 'fog:cobrir', camada: 'prep' });
    m.comando({ type: 'fog:traco', camada: 'prep', revelar: true, raio: 1, pontos: [0, 0, 3, 4] });
    m.comando({ type: 'scene:move', id: 'prep', x: 600, y: 10 });
    await ate(() => m.eventos.some(e => e.type === 'scene:moved'));
    expect(m.eventos.some(e => e.type === 'fog:camada' && e.camada === 'prep')).toBe(true);
    m.comando({ type: 'chat:send', message: { type: 'normal', text: 'barreira' } });
    await ate(() => j.eventos.some(e => e.message?.text === 'barreira'));
    expect(j.eventos.some(e => /^(scene|fog):/.test(e.type))).toBe(false);

    /* Quem entra depois também não recebe a imagem. */
    const outra = await entrar(jogador, id);
    expect(outra.snapshot.scenes).toEqual([]);
    expect(outra.snapshot.nevoa).toEqual({});

    m.comando({ type: 'scene:update', id: 'prep', oculto: false });
    const chegou = await ate(() => j.eventos.find(e => e.type === 'scene:added'));
    expect(chegou.scene).toMatchObject({ id: 'prep', nome: 'Caverna', x: 600, y: 10, oculto: false });
    expect(chegou.focar).toBe(true);
    expect(chegou.nevoa).toEqual([{ tipo: 'cobrir' }, { tipo: 'traco', revelar: true, raio: 1, pontos: [0, 0, 3, 4] }]);

    m.comando({ type: 'fog:traco', camada: 'prep', revelar: true, raio: 2, pontos: [9, 9] });
    await ate(() => j.eventos.some(e => e.type === 'fog:traco' && e.camada === 'prep'));
    /* Quem pinta já desenhou o traço: receber de volta o repetiria na lista. */
    expect(m.eventos.some(e => e.type === 'fog:traco')).toBe(false);

    m.comando({ type: 'scene:update', id: 'prep', oculto: true });
    await ate(() => j.eventos.some(e => e.type === 'scene:removed' && e.id === 'prep'));
    const depois = await entrar(jogador, id);
    expect(depois.snapshot.scenes).toEqual([]);
    expect((await entrar(mestre, id)).snapshot.nevoa.prep).toHaveLength(3);
  });

  it('token vinculado acompanha os status da ficha, sem a foto dela', async () => {
    const { mestre, jogador, ficha, id } = await mesaCompleta();
    const m = await entrar(mestre, id);
    const j = await entrar(jogador, id);
    const t = await criarToken(j, { name: 'Kael' });
    j.comando({ type: 'token:update', id: t, changes: { characterId: ficha.id } });
    await ate(() => m.ultimoToken(t)?.characterId === ficha.id);

    await jogador.c('PATCH', `/api/fichas/${ficha.id}`, { foto: PIXEL, vidaAtual: 5, manaAtual: 7 });
    const atualizado = await ate(() => { const k = m.ultimoToken(t); return k.hpCurrent === 5 && k; });
    expect(atualizado).toMatchObject({ hpCurrent: 5, manaCurrent: 7, spriteIds: [], activeSpriteId: null });
    expect(atualizado.fotoFichaV).toBeUndefined();

    j.comando({ type: 'token:update', id: t, changes: { characterId: null } });
    await ate(() => m.ultimoToken(t).characterId === undefined);
    expect(m.ultimoToken(t).hpCurrent).toBeUndefined();
  });

  it('ficha que entra na campanha ganha um token, e ele acompanha a ficha', async () => {
    const { mestre, jogador, ficha, id } = await mesaCompleta();
    const m = await entrar(mestre, id);
    const j = await entrar(jogador, id);
    const daFicha = (c: any, fichaId: string) => [...c.tokens.values()].filter((k: any) => k.characterId === fichaId) as any[];

    /* A ficha entrou com a mesa fechada: o token nasce ao abrir, com o que veio dela. */
    const [doJogador] = daFicha(m, ficha.id);
    expect(daFicha(m, ficha.id)).toHaveLength(1);
    expect(doJogador).toMatchObject({ name: 'Kael', hidden: false, ownerIds: [jogador.id], hpCurrent: 25, hpMax: 25, automatico: true });
    expect(daFicha(j, ficha.id)).toHaveLength(1);

    await jogador.c('PATCH', `/api/fichas/${ficha.id}`, { nome: 'Kael, o Bravo' });
    await ate(() => m.ultimoToken(doJogador.id).name === 'Kael, o Bravo');
    /* O dono renomeou: daqui em diante, o nome do token é dele. */
    j.comando({ type: 'token:update', id: doJogador.id, changes: { name: 'Disfarce' } });
    await ate(() => m.ultimoToken(doJogador.id).name === 'Disfarce');
    await jogador.c('PATCH', `/api/fichas/${ficha.id}`, { nome: 'Kael', vidaAtual: 3 });
    await ate(() => m.ultimoToken(doJogador.id).hpCurrent === 3);
    expect(m.ultimoToken(doJogador.id).name).toBe('Disfarce');

    /* Ficha privada do mestre, com a mesa aberta: o token nasce oculto. */
    const npc = (await mestre.c('POST', '/api/fichas', { dados: { nome: 'Vilão' } })).corpo.ficha;
    await mestre.c('POST', `/api/campanhas/${id}/fichas`, { fichaId: npc.id });
    const noMestre = await ate(() => daFicha(m, npc.id)[0]);
    expect(noMestre).toMatchObject({ name: 'Vilão', hidden: true, ownerIds: [] });
    expect(daFicha(j, npc.id)).toHaveLength(0);

    /* Mesmo mostrado no mapa, ele não entrega o nome enquanto a ficha for privada. */
    m.comando({ type: 'token:update', id: noMestre.id, changes: { hidden: false } });
    const visto = await ate(() => j.ultimoToken(noMestre.id));
    expect(visto.name).toBe('???');
    expect(JSON.stringify(visto)).not.toContain('Vilão');
    await mestre.c('PATCH', `/api/fichas/${npc.id}`, { publica: true });
    await ate(() => j.ultimoToken(noMestre.id).name === 'Vilão');

    /* Token apagado não volta sozinho. */
    m.comando({ type: 'token:remove', id: noMestre.id });
    await ate(() => !m.ultimoToken(noMestre.id));
    const outra = (await mestre.c('POST', '/api/fichas', { dados: { nome: 'Outra' } })).corpo.ficha;
    await mestre.c('POST', `/api/campanhas/${id}/fichas`, { fichaId: outra.id });
    await ate(() => daFicha(m, outra.id).length === 1);
    expect(daFicha(m, npc.id)).toHaveLength(0);

    /* A ficha saiu da campanha: o token sai junto. Se voltar, ganha outro. */
    await jogador.c('DELETE', `/api/campanhas/${id}/fichas/${ficha.id}`);
    await ate(() => daFicha(m, ficha.id).length === 0);
    await jogador.c('POST', `/api/campanhas/${id}/fichas`, { fichaId: ficha.id });
    await ate(() => daFicha(m, ficha.id).length === 1);
    expect(daFicha(m, ficha.id)[0].id).not.toBe(doJogador.id);
  });

  it('combate: ordem, vez e iniciativa respeitam o papel e os tokens ocultos', async () => {
    const { mestre, jogador, colega, ficha, id } = await mesaCompleta();
    const m = await entrar(mestre, id);
    const j = await entrar(jogador, id);
    const col = await entrar(colega, id);
    const heroi = [...m.tokens.values()].find((k: any) => k.characterId === ficha.id) as any;
    const oculto = await criarToken(m, { name: 'Emboscada', hidden: true });
    const estado = (c: any) => [...c.eventos].reverse().find((e: any) => e.type === 'combate:estado')?.combate;
    const negados = (c: any) => c.eventos.filter((e: any) => e.type === 'permission:error').length;

    j.comando({ type: 'combate:iniciar' });
    await ate(() => negados(j) === 1);
    m.comando({ type: 'combate:iniciar' });
    await ate(() => estado(j)?.lista.length === 1);
    expect(estado(j).lista[0].tokenId).toBe(heroi.id);

    /* O token oculto entra na ordem, e o jogador continua sem saber. */
    m.comando({ type: 'combate:entrar', tokenId: oculto });
    await ate(() => estado(m)?.lista.length === 2);
    m.comando({ type: 'combate:iniciativa', tokenId: oculto, valor: 30 });
    await ate(() => estado(m).lista.find((e: any) => e.tokenId === oculto).iniciativa === 30);
    expect(JSON.stringify(estado(j))).not.toContain(oculto);

    /* O dono rola a própria iniciativa, com a Destreza da ficha. O colega não pode. */
    col.comando({ type: 'combate:rolar', tokenId: heroi.id });
    await ate(() => negados(col) === 1);
    j.comando({ type: 'combate:rolar', tokenId: heroi.id });
    await ate(() => estado(j).lista[0].iniciativa !== null);
    const rolagem = await ate(() => j.eventos.find((e: any) => e.message?.label === 'Iniciativa'));
    expect(rolagem.message.roll.expression ?? rolagem.message.text).toContain('1d20+7');
    expect(estado(j).lista[0].iniciativa).toBeGreaterThanOrEqual(8);

    /* A vez do oculto não aparece para o jogador, que também não pode passá-la. */
    m.comando({ type: 'combate:vez', direcao: 1 });
    await ate(() => estado(m).vez === oculto);
    await ate(() => estado(j).vez === null);
    j.comando({ type: 'combate:vez', direcao: 1 });
    await ate(() => negados(j) === 2);
    m.comando({ type: 'combate:vez', direcao: 1 });
    await ate(() => estado(j).vez === heroi.id);
    j.comando({ type: 'combate:vez', direcao: 1 });
    await ate(() => estado(m).rodada === 2);

    /* Token apagado sai da ordem. */
    m.comando({ type: 'token:remove', id: oculto });
    await ate(() => estado(m).lista.length === 1);
    expect((await entrar(jogador, id)).snapshot.combate.rodada).toBe(2);
    m.comando({ type: 'combate:encerrar' });
    await ate(() => estado(j) === null);
  });

  it('cenário: escala, trava e desfazer da névoa, sem reenviar imagens a cada ajuste', async () => {
    const { mestre, jogador, id } = await mesaCompleta();
    const m = await entrar(mestre, id);
    const j = await entrar(jogador, id);
    m.comando({ type: 'scene:add', scene: { id: 'mapa', imageUrl: PIXEL, x: 0, y: 0, width: 100, height: 100, oculto: true } });
    await ate(() => m.eventos.some(e => e.type === 'scene:added'));
    m.comando({ type: 'scene:update', id: 'mapa', escala: 2.5 });
    await ate(() => m.eventos.some(e => e.type === 'scene:updated' && e.escala === 2.5));
    m.comando({ type: 'scene:update', id: 'mapa', escala: 99 });
    m.comando({ type: 'fog:traco', camada: 'mapa', revelar: false, raio: 5, pontos: [0, 0], g: 'um' });
    m.comando({ type: 'fog:traco', camada: 'mapa', revelar: false, raio: 5, pontos: [9, 9], g: 'um' });
    m.comando({ type: 'fog:traco', camada: 'mapa', revelar: false, raio: 5, pontos: [1, 1], g: 'dois' });
    m.comando({ type: 'fog:desfazer', camada: 'mapa', g: 'um' });
    const desfeito = await ate(() => m.eventos.find(e => e.type === 'fog:camada'));
    expect(desfeito.ops.map((op: any) => op.g)).toEqual(['dois']);

    /* Ao mostrar, o cenário já vai travado, com a escala escolhida. */
    m.comando({ type: 'scene:update', id: 'mapa', oculto: false });
    const chegou = await ate(() => j.eventos.find(e => e.type === 'scene:added'));
    expect(chegou.scene).toMatchObject({ escala: 2.5, travado: true, imageUrl: PIXEL });

    /* A grade não leva imagens, e um snapshot geral só leva o que mudou. */
    const antes = j.eventos.length;
    m.comando({ type: 'grid:update', grid: { enabled: true, cellSize: 60, opacity: 0.3 } });
    const grade = await ate(() => j.eventos.slice(antes).find(e => e.type === 'grid:updated'));
    expect(grade.grid.cellSize).toBe(60);
    expect(JSON.stringify(grade)).not.toContain('base64');
    m.comando({ type: 'player:role', playerKey: jogador.id, role: 'spectator' });
    await ate(() => j.snapshot.role === 'spectator');
    expect(j.snapshot.scenes[0].imageUrl).toBe('');
    expect((await entrar(jogador, id)).snapshot.scenes[0].imageUrl).toBe(PIXEL);

    /* Ping só para quem joga, e o foco só para o mestre. */
    j.comando({ type: 'mapa:ping', x: 1, y: 1 });
    await ate(() => j.eventos.some(e => e.type === 'permission:error'));
    m.comando({ type: 'mapa:ping', x: 5, y: 6 });
    await ate(() => j.eventos.some(e => e.type === 'mapa:ping' && e.x === 5));
    m.comando({ type: 'mapa:focar', x: 7, y: 8 });
    await ate(() => j.eventos.some(e => e.type === 'mapa:focar' && e.y === 8));
    expect(m.eventos.some(e => e.type === 'mapa:focar')).toBe(false);
  });

  it('abaixo da metade da vida, o sprite sangrando vale para todos, sem revelar a vida', async () => {
    const { mestre, jogador, colega, ficha, id } = await mesaCompleta();
    const m = await entrar(mestre, id);
    const j = await entrar(jogador, id);
    const col = await entrar(colega, id);
    const heroi = [...j.tokens.values()].find((k: any) => k.characterId === ficha.id) as any;
    j.comando({ type: 'token:sprite:add', id: heroi.id, sprite: { id: 'normal', label: 'Normal', imageUrl: PIXEL }, vaga: 'normal' });
    await ate(() => j.ultimoToken(heroi.id).activeSpriteId === 'normal');
    j.comando({ type: 'token:sprite:add', id: heroi.id, sprite: { id: 'ferido', label: 'Sangrando', imageUrl: PIXEL }, vaga: 'machucado' });
    await ate(() => j.ultimoToken(heroi.id).spriteSangrandoId === 'ferido');
    expect(j.ultimoToken(heroi.id).activeSpriteId).toBe('normal');

    /* Em cheio, ninguém vê sangrando. O máximo do Kael é 25. */
    await ate(() => col.ultimoToken(heroi.id)?.spriteSangrandoId === 'ferido');
    expect(col.ultimoToken(heroi.id).sangrando).toBe(false);
    await jogador.c('PATCH', `/api/fichas/${ficha.id}`, { vidaAtual: 13 });
    await ate(() => m.ultimoToken(heroi.id).hpCurrent === 13);
    expect(col.ultimoToken(heroi.id).sangrando).toBe(false);
    await jogador.c('PATCH', `/api/fichas/${ficha.id}`, { vidaAtual: 12 });
    await ate(() => col.ultimoToken(heroi.id).sangrando === true);
    expect(col.ultimoToken(heroi.id).hpCurrent).toBeUndefined();
    await jogador.c('PATCH', `/api/fichas/${ficha.id}`, { vidaAtual: 25 });
    await ate(() => col.ultimoToken(heroi.id).sangrando === false);

    /* Um sprite sangrando novo substitui o anterior, e remover não deixa referência solta. */
    j.comando({ type: 'token:sprite:add', id: heroi.id, sprite: { id: 'ferido2', label: 'Sangrando', imageUrl: PIXEL }, vaga: 'machucado' });
    await ate(() => j.ultimoToken(heroi.id).spriteSangrandoId === 'ferido2');
    expect(j.ultimoToken(heroi.id).spriteIds).toEqual(['normal', 'ferido2']);
    j.comando({ type: 'token:sprite:remove', id: heroi.id, spriteId: 'ferido2' });
    await ate(() => j.ultimoToken(heroi.id).spriteIds.length === 1);
    expect(j.ultimoToken(heroi.id).spriteSangrandoId).toBeUndefined();

    /* Sem sprite normal, o sangrando não vira o sprite do dia a dia. */
    const novo = await criarToken(m, { name: 'Só ferido' });
    m.comando({ type: 'token:sprite:add', id: novo, sprite: { id: 'so', label: 'Sangrando', imageUrl: PIXEL }, vaga: 'machucado' });
    await ate(() => m.ultimoToken(novo).spriteSangrandoId === 'so');
    expect(m.ultimoToken(novo).activeSpriteId).toBeNull();
  });

  it('cada vaga guarda uma imagem, e o botão Armado é do dono e do mestre', async () => {
    const { mestre, jogador, colega, ficha, id } = await mesaCompleta();
    const m = await entrar(mestre, id);
    const j = await entrar(jogador, id);
    const col = await entrar(colega, id);
    const heroi = [...j.tokens.values()].find((k: any) => k.characterId === ficha.id) as any;
    const colocar = (spriteId: string, vaga: string) => j.comando({ type: 'token:sprite:add', id: heroi.id, sprite: { id: spriteId, label: vaga, imageUrl: PIXEL }, vaga });

    colocar('n1', 'normal');
    await ate(() => j.ultimoToken(heroi.id).activeSpriteId === 'n1');
    colocar('a1', 'armado');
    await ate(() => j.ultimoToken(heroi.id).spriteArmadoId === 'a1');
    expect(j.ultimoToken(heroi.id).activeSpriteId).toBe('n1');

    /* Trocar a imagem de uma vaga não acumula nem mexe nas outras. */
    colocar('n2', 'normal');
    await ate(() => j.ultimoToken(heroi.id).activeSpriteId === 'n2');
    expect(j.ultimoToken(heroi.id).spriteIds).toEqual(['a1', 'n2']);
    expect(j.ultimoToken(heroi.id).spriteArmadoId).toBe('a1');
    colocar('a2', 'armado');
    await ate(() => j.ultimoToken(heroi.id).spriteArmadoId === 'a2');
    expect(j.ultimoToken(heroi.id).spriteIds).toEqual(['n2', 'a2']);

    j.comando({ type: 'token:update', id: heroi.id, changes: { armado: true } });
    await ate(() => col.ultimoToken(heroi.id)?.armado === true);
    col.comando({ type: 'token:update', id: heroi.id, changes: { armado: false } });
    await ate(() => col.eventos.some(e => e.type === 'permission:error'));
    expect(m.ultimoToken(heroi.id).armado).toBe(true);
    m.comando({ type: 'token:update', id: heroi.id, changes: { armado: false } });
    await ate(() => j.ultimoToken(heroi.id).armado === false);
    j.comando({ type: 'token:update', id: heroi.id, changes: { armado: true } });
    await ate(() => j.ultimoToken(heroi.id).armado === true);

    /* Sem a imagem, o token deixa de estar armado. */
    j.comando({ type: 'token:sprite:remove', id: heroi.id, spriteId: 'a2' });
    await ate(() => j.ultimoToken(heroi.id).spriteArmadoId === undefined);
    expect(j.ultimoToken(heroi.id).armado).toBeUndefined();
    expect(j.ultimoToken(heroi.id).activeSpriteId).toBe('n2');
  });

  it('condições ficam no token e têm limite', async () => {
    const { mestre, jogador, ficha, id } = await mesaCompleta();
    const m = await entrar(mestre, id);
    const j = await entrar(jogador, id);
    const heroi = [...j.tokens.values()].find((k: any) => k.characterId === ficha.id) as any;
    j.comando({ type: 'token:update', id: heroi.id, changes: { condicoes: ['Caído', 'Cego'] } });
    await ate(() => m.ultimoToken(heroi.id).condicoes?.length === 2);
    j.comando({ type: 'token:update', id: heroi.id, changes: { condicoes: Array(11).fill('Caído') } });
    j.comando({ type: 'token:update', id: heroi.id, changes: { name: 'Depois' } });
    await ate(() => m.ultimoToken(heroi.id).name === 'Depois');
    expect(m.ultimoToken(heroi.id).condicoes).toEqual(['Caído', 'Cego']);
  });

  it('rolagem de ficha privada do mestre aparece na mesa como Mestre', async () => {
    const { mestre, jogador, id } = await mesaCompleta();
    const npc = (await mestre.c('POST', '/api/fichas', { dados: { nome: 'Vilão', corpo: { destreza: 3 } } })).corpo.ficha;
    await mestre.c('POST', `/api/campanhas/${id}/fichas`, { fichaId: npc.id });
    const m = await entrar(mestre, id);
    const j = await entrar(jogador, id);
    m.comando({ type: 'ficha:rolar', fichaId: npc.id, acao: 'corpo.destreza' });
    const privada = (await ate(() => j.eventos.find(e => e.type === 'chat:message'))).message;
    expect(privada.author).toBe('Mestre');
    expect(JSON.stringify(privada)).not.toContain('Vilão');
    await mestre.c('PATCH', `/api/fichas/${npc.id}`, { publica: true });
    m.comando({ type: 'ficha:rolar', fichaId: npc.id, acao: 'corpo.destreza' });
    await ate(() => j.eventos.some(e => e.type === 'chat:message' && e.message.author === 'Vilão'));
  });

  it('token tem largura e altura próprias, dentro dos limites, e cada eixo se alinha à grade', async () => {
    const { mestre, jogador, id } = await mesaCompleta();
    const m = await entrar(mestre, id);
    const j = await entrar(jogador, id);
    const t = await criarToken(m, { name: 'Alto' });
    m.comando({ type: 'token:update', id: t, changes: { size: 1.5, altura: 3 } });
    await ate(() => m.ultimoToken(t).altura === 3);
    expect(m.ultimoToken(t).size).toBe(1.5);
    for (const ruim of [{ altura: 99 }, { size: 0 }, { altura: 1.1 }]) m.comando({ type: 'token:update', id: t, changes: ruim });
    m.comando({ type: 'token:update', id: t, changes: { name: 'Depois' } });
    await ate(() => m.ultimoToken(t).name === 'Depois');
    expect(m.ultimoToken(t)).toMatchObject({ size: 1.5, altura: 3 });
    m.comando({ type: 'token:move', id: t, position: { x: 100, y: 100 }, final: true });
    const movido = await ate(() => j.eventos.find(e => e.type === 'token:moved' && e.final));
    expect(movido.position).toEqual({ x: 122.5, y: 105 });
  });

  it('ninguém vira GM, e espectador só assiste', async () => {
    const { mestre, jogador, id } = await mesaCompleta();
    const m = await entrar(mestre, id);
    const j = await entrar(jogador, id);
    m.comando({ type: 'player:role', playerKey: jogador.id, role: 'gm' });
    m.comando({ type: 'player:role', playerKey: mestre.id, role: 'spectator' });
    await ate(() => m.eventos.some(e => e.type === 'permission:error'));
    expect(j.snapshot.role).toBe('player');
    m.comando({ type: 'player:role', playerKey: jogador.id, role: 'spectator' });
    await ate(() => j.snapshot.role === 'spectator');
    j.comando({ type: 'chat:roll', expression: '1d20' });
    await ate(() => j.eventos.some(e => e.type === 'permission:error'));
    expect(j.eventos.some(e => e.type === 'chat:message')).toBe(false);
  });

  it('quem é removido da campanha sai da mesa na hora, e campanha apagada fecha a mesa', async () => {
    const { mestre, jogador, colega, id } = await mesaCompleta();
    const m = await entrar(mestre, id);
    const j = await entrar(jogador, id);
    const col = await entrar(colega, id);
    expect((await mestre.c('DELETE', `/api/campanhas/${id}/membros/${colega.id}`)).status).toBe(200);
    await ate(() => col.eventos.some(e => e.type === 'player:kicked'));
    await ate(() => !col.socket.connected);
    await ate(() => !m.snapshot.players.some((p: any) => p.id === colega.id));
    expect(j.socket.connected).toBe(true);
    expect((await mestre.c('DELETE', `/api/campanhas/${id}`)).status).toBe(200);
    await ate(() => j.eventos.some(e => e.type === 'room:denied'));
    await ate(() => !m.socket.connected);
  });
});

describe('fichas na mesa', () => {
  it('só o dono ou o mestre vinculam, e só ficha da campanha', async () => {
    const { mestre, jogador, colega, id, ficha } = await mesaCompleta();
    const col = await entrar(colega, id);
    const t = await criarToken(col);
    col.comando({ type: 'token:update', id: t, changes: { characterId: ficha.id } });
    await ate(() => col.eventos.some(e => e.type === 'permission:error'));
    expect(col.ultimoToken(t).characterId).toBeUndefined();

    const m = await entrar(mestre, id);
    const solta = (await mestre.c('POST', '/api/fichas', { dados: { nome: 'Solta' } })).corpo.ficha;
    const tm = await criarToken(m);
    m.comando({ type: 'token:update', id: tm, changes: { characterId: solta.id } });
    await ate(() => m.eventos.some(e => e.type === 'permission:error'));
    m.comando({ type: 'token:update', id: tm, changes: { characterId: ficha.id } });
    const vinculado = await ate(() => { const k = m.ultimoToken(tm); return k?.characterId === ficha.id && k; });
    expect(vinculado).toMatchObject({ hpCurrent: 25, hpMax: 25, manaCurrent: 30, manaMax: 30 });
    expect(vinculado.ownerIds).toContain(jogador.id);
  });

  it('um token não nasce vinculado: a checagem não pode ser pulada', async () => {
    const { colega, id, ficha } = await mesaCompleta();
    const col = await entrar(colega, id);
    const t = await criarToken(col, { characterId: ficha.id });
    expect(col.ultimoToken(t).characterId).toBeUndefined();
  });

  it('vida muda nos dois sentidos em menos de 1 s, sem laço e respeitando o máximo', async () => {
    const { mestre, jogador, id, ficha } = await mesaCompleta();
    const m = await entrar(mestre, id);
    const j = await entrar(jogador, id);
    const t = await criarToken(j);
    j.comando({ type: 'token:update', id: t, changes: { characterId: ficha.id } });
    await ate(() => j.ultimoToken(t).characterId === ficha.id && m.ultimoToken(t)?.characterId === ficha.id);

    const vidaNaFicha = async () => (await jogador.c('GET', `/api/fichas/${ficha.id}`)).corpo.ficha.vidaAtual;

    /* Do token para a ficha. */
    let inicio = Date.now();
    j.comando({ type: 'token:update', id: t, changes: { hpCurrent: 10 } });
    await ate(() => m.ultimoToken(t).hpCurrent === 10, 1000);
    expect(await vidaNaFicha()).toBe(10);
    expect(Date.now() - inicio).toBeLessThan(1000);

    /* Da ficha para o token. */
    inicio = Date.now();
    expect((await jogador.c('PATCH', `/api/fichas/${ficha.id}`, { vidaAtual: 18 })).status).toBe(200);
    await ate(() => m.ultimoToken(t).hpCurrent === 18 && j.ultimoToken(t).hpCurrent === 18, 1000);
    expect(Date.now() - inicio).toBeLessThan(1000);

    /* Máximo. */
    j.comando({ type: 'token:update', id: t, changes: { hpCurrent: 5000 } });
    await ate(() => m.ultimoToken(t).hpCurrent === 25);
    expect(await vidaNaFicha()).toBe(25);

    /* Mudar a vitalidade muda o máximo do token. */
    await jogador.c('PATCH', `/api/fichas/${ficha.id}`, { corpo: { vitalidade: 6 } });
    await ate(() => m.ultimoToken(t).hpMax === 27);

    /* Sem laço: parado, nada mais chega. */
    await new Promise(ok => setTimeout(ok, 300));
    const antes = m.eventos.length;
    await new Promise(ok => setTimeout(ok, 1500));
    expect(m.eventos.filter((e, i) => i >= antes && e.type === 'token:updated')).toHaveLength(0);

    /* O máximo de um token vinculado não muda por fora. */
    j.comando({ type: 'token:update', id: t, changes: { hpMax: 999 } });
    await ate(() => j.eventos.some(e => e.type === 'permission:error'));
  });

  it('colega não recebe a vida da ficha e não altera', async () => {
    const { jogador, colega, mestre, id, ficha } = await mesaCompleta();
    const j = await entrar(jogador, id);
    const col = await entrar(colega, id);
    const m = await entrar(mestre, id);
    const t = await criarToken(m);
    m.comando({ type: 'token:update', id: t, changes: { characterId: ficha.id, ownerIds: [colega.id, jogador.id] } });
    const noColega = await ate(() => { const k = col.ultimoToken(t); return k?.characterId === ficha.id && k; });
    expect(noColega.hpCurrent).toBeUndefined();
    expect(noColega.manaMax).toBeUndefined();
    await ate(() => j.ultimoToken(t)?.hpCurrent === 25);
    col.comando({ type: 'token:update', id: t, changes: { hpCurrent: 1 } });
    await ate(() => col.eventos.some(e => e.type === 'permission:error'));
    expect((await jogador.c('GET', `/api/fichas/${ficha.id}`)).corpo.ficha.vidaAtual).toBe(25);
    expect(JSON.stringify((await entrar(colega, id)).snapshot.tokens)).not.toContain('hpCurrent');
  });

  it('ficha que sai da campanha desvincula o token', async () => {
    const { jogador, id, ficha } = await mesaCompleta();
    const j = await entrar(jogador, id);
    const t = await criarToken(j);
    j.comando({ type: 'token:update', id: t, changes: { characterId: ficha.id } });
    await ate(() => j.ultimoToken(t).characterId === ficha.id);
    await jogador.c('DELETE', `/api/campanhas/${id}/fichas/${ficha.id}`);
    await ate(() => j.ultimoToken(t).characterId === undefined);
    expect(j.ultimoToken(t).hpCurrent).toBeUndefined();
  });
});

describe('rolagens e chat', () => {
  it('rolagem pela ficha usa o valor guardado, aparece para todos e no chat do site', async () => {
    const { mestre, jogador, colega, id, ficha } = await mesaCompleta();
    const j = await entrar(jogador, id);
    const m = await entrar(mestre, id);
    const col = await entrar(colega, id);
    j.comando({ type: 'ficha:rolar', fichaId: ficha.id, acao: 'corpo.destreza', bonus: 500 });
    const noMestre = (await ate(() => m.eventos.find(e => e.type === 'chat:message'))).message;
    await ate(() => col.eventos.some(e => e.type === 'chat:message'));
    expect(noMestre.label).toBe('Destreza');
    expect(noMestre.author).toBe('Kael');
    expect(noMestre.roll.expression).toBe('1d20+7');
    expect(noMestre.roll.total).toBeGreaterThanOrEqual(8);
    expect(noMestre.roll.total).toBeLessThanOrEqual(27);
    const noSite = (await jogador.c('GET', `/api/campanhas/${id}/chat`)).corpo.mensagens;
    expect(noSite[noSite.length - 1]).toMatchObject({ rotulo: 'Destreza', total: noMestre.roll.total, autor: 'Kael' });

    col.comando({ type: 'ficha:rolar', fichaId: ficha.id, acao: 'corpo.destreza' });
    await ate(() => col.eventos.some(e => e.type === 'permission:error'));
    j.comando({ type: 'ficha:rolar', fichaId: ficha.id, acao: 'constructor.x' });
    await ate(() => j.eventos.some(e => e.type === 'permission:error'));
  });

  it('o chat de dados tem um motor só: rolagem do site chega à mesa, e da mesa chega ao site', async () => {
    const { mestre, jogador, id } = await mesaCompleta();
    const m = await entrar(mestre, id);
    const r = (await jogador.c('POST', `/api/campanhas/${id}/rolar`, { lados: 20, bonus: 3 })).corpo.rolagem;
    expect(r.det).toMatch(/^d20 \(\d+\) \+ 3$/);
    const chegou = (await ate(() => m.eventos.find(e => e.type === 'chat:message' && e.message.id === r.id))).message;
    expect(chegou.roll.total).toBe(r.total);

    m.comando({ type: 'chat:roll', expression: '2d20kh1+5', label: 'Ataque' });
    const mesa = (await ate(() => m.eventos.find(e => e.type === 'chat:message' && e.message.label === 'Ataque'))).message;
    expect(mesa.roll.groups[0].selection).toBe('kh');
    const noSite = (await jogador.c('GET', `/api/campanhas/${id}/chat`)).corpo.mensagens;
    expect(noSite[noSite.length - 1]).toMatchObject({ rotulo: 'Ataque', total: mesa.roll.total });
    expect(noSite[noSite.length - 1].det).toContain('2d20kh1');

    m.comando({ type: 'chat:roll', expression: 'alert(1)' });
    await ate(() => m.eventos.some(e => e.type === 'chat:error'));
  });

  it('o chat fica no banco, e sussurro só chega a quem deve', async () => {
    const { mestre, jogador, colega, id } = await mesaCompleta();
    const m = await entrar(mestre, id);
    const j = await entrar(jogador, id);
    const col = await entrar(colega, id);
    j.comando({ type: 'chat:send', message: { type: 'normal', text: 'olá, mesa' } });
    await ate(() => col.eventos.some(e => e.message?.text === 'olá, mesa'));
    j.comando({ type: 'chat:send', message: { type: 'whisper', text: 'segredo', recipient: 'Mestra' } });
    await ate(() => m.eventos.some(e => e.message?.text === 'segredo'));
    await new Promise(ok => setTimeout(ok, 200));
    expect(col.eventos.some(e => e.message?.text === 'segredo')).toBe(false);
    const novo = await entrar(colega, id);
    const textos = novo.snapshot.messages.map((x: any) => x.text);
    expect(textos).toContain('olá, mesa');
    expect(textos).not.toContain('segredo');
  });

  it('comando malformado é ignorado sem derrubar a conexão', async () => {
    const { mestre, id } = await mesaCompleta();
    const m = await entrar(mestre, id);
    for (const ruim of [null, 'texto', {}, { type: 'inventado' }, { type: 'token:create', token: 5, sprites: [] }, { type: 'fog:traco', camada: 'mundo', revelar: true, raio: 999, pontos: ['a'] }, { type: 'fog:traco', camada: 'mundo', revelar: true, raio: 1, pontos: [1, 2, 3] }, { type: 'chat:roll', expression: 'x'.repeat(500) }]) {
      m.socket.emit('room:command', ruim);
    }
    m.comando({ type: 'chat:send', message: { type: 'normal', text: 'ainda aqui' } });
    await ate(() => m.eventos.some(e => e.message?.text === 'ainda aqui'));
    expect(m.socket.connected).toBe(true);
  });
});

describe('persistência', () => {
  it('a mesa continua igual depois de derrubar o servidor', async () => {
    const { mestre, jogador, id, ficha } = await mesaCompleta();
    const m = await entrar(mestre, id);
    const t = await criarToken(m, { name: 'Salvo', hidden: true });
    m.comando({ type: 'token:sprite:add', id: t, sprite: { id: 's1', label: 'Rosto', imageUrl: PIXEL }, vaga: 'normal' });
    await ate(() => m.ultimoToken(t).spriteIds.length === 1);
    m.comando({ type: 'token:update', id: t, changes: { characterId: ficha.id } });
    await ate(() => m.ultimoToken(t).characterId === ficha.id);
    m.comando({ type: 'grid:update', grid: { enabled: true, cellSize: 50, opacity: 0.3 } });
    m.comando({ type: 'fog:traco', camada: 'mundo', revelar: false, raio: 1, pontos: [0, 0] });
    m.comando({ type: 'scene:add', scene: { id: 'c1', imageUrl: PIXEL, x: 10, y: 20, width: 100, height: 200, nome: 'Salão', oculto: true } });
    m.comando({ type: 'player:role', playerKey: jogador.id, role: 'spectator' });
    m.comando({ type: 'chat:send', message: { type: 'normal', text: 'antes de cair' } });
    m.comando({ type: 'chat:roll', expression: '1d6' });
    await ate(() => m.eventos.filter(e => e.type === 'chat:message').length >= 2);
    await ate(() => m.eventos.some(e => e.type === 'scene:added'));
    /* Mais que o intervalo de salvamento. A queda é sem aviso: nada de salvar ao sair. */
    await new Promise(ok => setTimeout(ok, 1600));
    derrubar();
    for (const c of abertos.splice(0)) c.fechar();
    await subir();

    const volta = await entrar(mestre, id);
    const s = volta.snapshot;
    expect(s.role).toBe('gm');
    expect(s.grid).toEqual({ enabled: true, cellSize: 50, opacity: 0.3 });
    expect(s.nevoa.mundo).toEqual([{ tipo: 'traco', revelar: false, raio: 1, pontos: [0, 0] }]);
    expect(s.scenes).toEqual([{ id: 'c1', imageUrl: PIXEL, x: 10, y: 20, width: 100, height: 200, nome: 'Salão', oculto: true }]);
    /* O que foi vinculado à mão e o que nasceu com a ficha: reiniciar não cria outro. */
    expect(s.tokens.filter((x: any) => x.characterId === ficha.id)).toHaveLength(2);
    const token = s.tokens.find((x: any) => x.id === t);
    expect(token).toMatchObject({ name: 'Salvo', hidden: true, characterId: ficha.id, hpCurrent: 25, activeSpriteId: 's1' });
    expect(s.spritesByTokenId[t]).toEqual([{ id: 's1', label: 'Rosto', imageUrl: PIXEL }]);
    const textos = s.messages.map((x: any) => x.text);
    expect(textos).toContain('antes de cair');
    expect(s.messages.some((x: any) => x.type === 'roll' && x.roll?.expression === '1d6')).toBe(true);
    const j = await entrar(jogador, id);
    expect(j.snapshot.role).toBe('spectator');
    expect(j.snapshot.tokens.some((x: any) => x.id === t)).toBe(false);
  }, 60000);
});
