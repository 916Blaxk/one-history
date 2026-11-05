import { GRUPOS } from '@/lib/regras';

/* Os cinco atributos em um pentágono. A escala sobe de 5 em 5 para o maior valor sempre caber. */
export default function Pentagrama({ valores }: { valores: Record<string, number> }) {
  const cx = 170, cy = 134, R = 92;
  const itens = GRUPOS.elementos;
  const nums = itens.map(([k]) => valores[k]);
  const teto = Math.max(10, Math.ceil(Math.max(...nums) / 5) * 5);
  const ponto = (i: number, r: number): [number, number] => {
    const a = (-90 + i * 72) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const lista = (r: (i: number) => number) => itens.map((_, i) => ponto(i, r(i)).map(n => n.toFixed(1)).join(',')).join(' ');
  const [mx, my] = ponto(0, R * .5);
  const [tx, ty] = ponto(0, R);
  return (
    <svg viewBox="0 0 340 262" role="img" aria-label={`Pentágono dos cinco atributos: ${itens.map(([k, r]) => `${r} ${valores[k]}`).join(', ')}`}>
      {[.5, 1].map(fr => <polygon key={fr} points={lista(() => R * fr)} fill="none" stroke="var(--linha)" />)}
      {itens.map(([k], i) => {
        const [x, y] = ponto(i, R);
        return <line key={k} x1={cx} y1={cy} x2={x.toFixed(1)} y2={y.toFixed(1)} stroke="var(--linha)" />;
      })}
      <polygon points={lista(i => R * nums[i] / teto)} fill="var(--ouro)" fillOpacity=".22" stroke="var(--ouro)" strokeWidth="1.5" />
      {itens.map(([k, rotulo], i) => {
        const [x, y] = ponto(i, R * nums[i] / teto);
        const [lx, ly] = ponto(i, R + 12);
        const ancora = i === 0 ? 'middle' : i < 3 ? 'start' : 'end';
        const dy = i === 0 ? -2 : i === 1 || i === 4 ? 4 : 12;
        return (
          <g key={k}>
            <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r="4" fill={`var(--${k})`} />
            <text x={lx.toFixed(1)} y={(ly + dy).toFixed(1)} textAnchor={ancora} fontSize="14" fill="var(--tinta)" style={{ fontFamily: 'var(--f-rotulo)', letterSpacing: '.04em' }}>
              {rotulo} <tspan fontWeight="700" fill={`var(--${k})`}>{nums[i]}</tspan>
            </text>
          </g>
        );
      })}
      <text x={(mx + 5).toFixed(1)} y={(my + 4).toFixed(1)} fontSize="11" fill="var(--tinta-2)" style={{ fontFamily: 'var(--f-texto)' }}>{teto / 2}</text>
      <text x={(tx + 5).toFixed(1)} y={(ty + 11).toFixed(1)} fontSize="11" fill="var(--tinta-2)" style={{ fontFamily: 'var(--f-texto)' }}>{teto}</text>
    </svg>
  );
}
