import { describe, expect, it } from 'vitest';
import * as I from '../lib/integracao';
import { montarCsp } from '../lib/csp';
import * as R from '../lib/regras';

/* Mesma gramática de src/features/chat/dice-parser.ts do Tablebola, usada só para conferir o formato. */
function aceitaNoTablebola(expressao: string) {
  if (expressao.length > 120) return false;
  return /^\d*d\d+(?:\s*(?:kh|kl|dh|dl)\s*\d+)?!?(?:\s*[+-]\s*(?:\d*d\d+(?:\s*(?:kh|kl|dh|dl)\s*\d+)?!?|\d+))*$/i.test(expressao);
}

describe('expressões de dados', () => {
  it('converte o valor do atributo em d20 mais modificador', () => {
    expect(I.expressaoAtributo(0)).toBe('1d20');
    expect(I.expressaoAtributo(7)).toBe('1d20+7');
    expect(I.expressaoAtributo(-3)).toBe('1d20-3');
  });

  it('toda ação de rolagem sai válida para o chat do Tablebola', () => {
    const d = R.normalizar({ corpo: { destreza: 999 }, pericias: { sorte: 4 } });
    const acoes = I.acoesDeRolagem(d);
    expect(acoes).toHaveLength(73);
    for (const a of acoes) expect(aceitaNoTablebola(a.expressao), a.expressao).toBe(true);
    expect(acoes.find(a => a.id === 'corpo.destreza')?.expressao).toBe('1d20+999');
    expect(acoes.find(a => a.id === 'pericias.sorte')).toMatchObject({ rotulo: 'Sorte', categoria: 'Perícias adicionais', valor: 4, expressao: '1d20+4' });
  });
});

describe('resumo da ficha', () => {
  const dados = R.normalizar({
    nome: 'Kael', corpo: { vitalidade: 5 }, mente: { onipotencia: 7 }, nucleo: 3, vidaAtual: 10,
    magias: [{ id: 'm1', nome: 'Faísca', elemento: 'fogo', custo: 5, descricao: 'Texto longo que não vai no resumo' }],
  });

  it('traz versão, recursos, ações e magias com o custo já descontado', () => {
    const r = I.resumoDaFicha({ id: 'f1', dados, fotoV: 123, atualizado: 456 });
    expect(r.schemaVersion).toBe(1);
    expect(r).toMatchObject({ id: 'f1', nome: 'Kael', atualizado: 456, retrato: { versao: 123, url: '/api/integracao/fichas/f1/retrato' } });
    expect(r.recursos).toEqual([
      { id: 'vida', rotulo: 'Vida', atual: 10, max: 25 },
      { id: 'mana', rotulo: 'Mana', atual: 51, max: 51 },
    ]);
    expect(r.magias).toEqual([{ id: 'm1', nome: 'Faísca', elemento: 'fogo', custo: 3 }]);
    expect(JSON.stringify(r)).not.toContain('Texto longo');
  });

  it('funciona com ficha gravada antes dos campos novos e sem foto', () => {
    const r = I.resumoDaFicha({ id: 'f2', dados: { nome: '', mente: { onipotencia: 7 }, tier: 1 }, fotoV: 0, atualizado: 1 });
    expect(r.nome).toBe('Sem nome');
    expect(r.retrato).toBeNull();
    expect(r.recursos[1].max).toBe(44);
    expect(r.magias).toEqual([]);
  });
});

describe('origens permitidas', () => {
  it('lê só origens exatas e seguras', () => {
    expect(I.lerOrigens(' https://table-bola.vercel.app , http://localhost:5173,http://127.0.0.1:3999')).toEqual([
      'https://table-bola.vercel.app', 'http://localhost:5173', 'http://127.0.0.1:3999',
    ]);
    for (const ruim of ['*', 'https://*.vercel.app', 'http://site.com', 'https://site.com/', 'https://site.com/caminho', 'javascript:alert(1)', 'null', 'site.com', '']) {
      expect(I.lerOrigens(ruim), ruim).toEqual([]);
    }
    expect(I.lerOrigens(undefined)).toEqual([]);
  });

  it('compara a origem inteira', () => {
    const lista = ['https://table-bola.vercel.app'];
    expect(I.origemPermitida('https://table-bola.vercel.app', lista)).toBe(true);
    for (const outra of ['https://table-bola.vercel.app.evil.com', 'http://table-bola.vercel.app', 'https://evil.com', 'null', '', null, undefined]) {
      expect(I.origemPermitida(outra, lista), String(outra)).toBe(false);
    }
  });

  it('a política só libera iframe para as origens da lista', () => {
    expect(montarCsp(false)).toContain("frame-ancestors 'none'");
    expect(montarCsp(false, ['https://a.com', 'https://b.com'])).toContain('frame-ancestors https://a.com https://b.com');
  });
});

describe('magias', () => {
  it('normalizar limpa entradas inválidas e garante ids únicos', () => {
    const f = R.normalizar({ magias: [{ id: 'a', nome: 5, elemento: 'trevas', custo: -3 }, { id: 'a', nome: 'B', elemento: 'agua', custo: 99999 }, 'lixo'] });
    expect(f.magias).toHaveLength(3);
    expect(new Set(f.magias.map(m => m.id)).size).toBe(3);
    expect(f.magias[0]).toMatchObject({ id: 'a', nome: '', elemento: '', custo: 0 });
    expect(f.magias[1]).toMatchObject({ nome: 'B', elemento: 'agua', custo: 9999 });
    expect(R.normalizar({ magias: 'nada' }).magias).toEqual([]);
    expect(R.normalizar({ magias: Array.from({ length: 150 }, () => ({})) }).magias).toHaveLength(R.LIMITE_MAGIAS);
  });

  it('gasto universal desconta do custo sem deixar negativo', () => {
    expect(R.custoMagia({ nucleo: 0 }, { custo: 5 })).toBe(5);
    expect(R.custoMagia({ nucleo: 3 }, { custo: 5 })).toBe(3);
    expect(R.custoMagia({ nucleo: 12 }, { custo: 5 })).toBe(0);
  });
});
