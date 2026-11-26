import { GRUPOS } from '@/lib/regras';

const SIGLA: Record<string, string> = { tracao: 'TRA', vitalidade: 'VIT', destreza: 'DES', onisciencia: 'GEN', onipotencia: 'DET', encanto: 'ENC' };
const ITENS = [
  ...GRUPOS.corpo.map(([k, rotulo]) => ({ grupo: 'corpo' as const, k, rotulo })),
  ...GRUPOS.mente.map(([k, rotulo]) => ({ grupo: 'mente' as const, k, rotulo })),
];
const COR = { corpo: 'var(--primary-claro)', mente: 'var(--secondary-claro)' };

/* Corpo e mente em um só desenho. A escala sobe de 5 em 5 para o maior valor sempre caber.
   `compacto`: o emblema ao lado da lista de atributos, só com as siglas, porque os nomes e valores já estão na lista. */
export default function GraficoAtributos({ corpo, mente, compacto = false }: { corpo: Record<string, number>; mente: Record<string, number>; compacto?: boolean }) {
  const cx = 190, cy = 132, raio = 92;
  const nums = ITENS.map(({ grupo, k }) => (grupo === 'corpo' ? corpo : mente)[k] ?? 0);
  const teto = Math.max(10, Math.ceil(Math.max(...nums) / 5) * 5);
  const ponto = (i: number, r: number): [number, number] => {
    const a = (-90 + i * (360 / ITENS.length)) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const lista = (r: (i: number) => number) => ITENS.map((_, i) => ponto(i, r(i)).map(n => n.toFixed(1)).join(',')).join(' ');
  return (
    <svg viewBox={compacto ? '44 12 292 240' : '-40 0 460 264'} role="img" aria-label={`Gráfico de corpo e mente: ${ITENS.map(({ rotulo }, i) => `${rotulo} ${nums[i]}`).join(', ')}`}>
      {(compacto ? [1 / 3, 2 / 3, 1] : [.5, 1]).map(fr => <polygon key={fr} points={lista(() => raio * fr)} fill="none" stroke="var(--border)" />)}
      {ITENS.map(({ k }, i) => {
        const [x, y] = ponto(i, raio);
        return <line key={k} x1={cx} y1={cy} x2={x.toFixed(1)} y2={y.toFixed(1)} stroke="var(--border)" />;
      })}
      <polygon points={lista(i => raio * nums[i]! / teto)} fill="var(--secondary)" fillOpacity=".3" stroke="var(--secondary-claro)" strokeWidth="2" strokeLinejoin="round" />
      {ITENS.map(({ grupo, k, rotulo }, i) => {
        const [x, y] = ponto(i, raio * nums[i]! / teto);
        const [lx, ly] = ponto(i, raio + 14);
        const noEixo = Math.abs(lx - cx) < 1;
        return (
          <g key={k}>
            <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r={compacto ? 5 : 4} fill={COR[grupo]} />
            <text x={lx.toFixed(1)} y={(ly + (noEixo ? (ly < cy ? -2 : 12) : 5)).toFixed(1)} textAnchor={noEixo ? 'middle' : lx > cx ? 'start' : 'end'} fontSize={compacto ? 15 : 16} fontWeight={compacto ? 700 : undefined} fill={compacto ? COR[grupo] : 'var(--text)'}>
              {compacto ? SIGLA[k] : <>{rotulo} <tspan fontWeight="700" fill={COR[grupo]}>{nums[i]}</tspan></>}
            </text>
          </g>
        );
      })}
      {!compacto && <text x={cx + 5} y={cy - raio / 2 + 4} fontSize="11" fill="var(--text-muted)">{teto / 2}</text>}
    </svg>
  );
}
