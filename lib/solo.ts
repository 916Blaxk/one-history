/* O solo de guitarra do crítico. É sintetizado na hora, com Web Audio: não há arquivo de som para baixar
   e a CSP do site continua sem liberar mídia de fora. Duas ondas dente de serra levemente desafinadas
   passam por uma distorção e por um filtro de caixa de guitarra; um eco curto dá o espaço de palco.
   A frase é uma subida rápida na pentatônica de mi menor, um bend gritado no alto e um power chord no fim. */

let contexto: AudioContext | null = null;

const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function curvaDistorcao(forca: number) {
  const n = 2048;
  const curva = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curva[i] = Math.tanh(forca * x) / Math.tanh(forca);
  }
  return curva;
}

/* [nota MIDI, duração em segundos]. 64 = mi da quarta corda solta uma oitava acima. */
const SUBIDA: [number, number][] = [
  [64, .06], [67, .06], [69, .06], [71, .06], [74, .06], [76, .06], [79, .06], [81, .06], [83, .06], [86, .07],
];
const DESCIDA: [number, number][] = [[86, .055], [83, .055], [81, .055], [79, .055], [76, .055], [74, .055], [71, .07]];

export function tocarSolo() {
  try {
    const Contexto = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Contexto) return;
    contexto ??= new Contexto();
    const ac = contexto;
    if (ac.state === 'suspended') void ac.resume();
    const t0 = ac.currentTime + .03;

    /* Cadeia: notas → distorção → corte de graves → presença → caixa → volume, com eco em paralelo. */
    const entrada = ac.createGain();
    entrada.gain.value = 0;
    const distorcao = ac.createWaveShaper();
    distorcao.curve = curvaDistorcao(7);
    distorcao.oversample = '4x';
    const graves = ac.createBiquadFilter();
    graves.type = 'highpass'; graves.frequency.value = 110;
    const presenca = ac.createBiquadFilter();
    presenca.type = 'peaking'; presenca.frequency.value = 1900; presenca.gain.value = 7; presenca.Q.value = 1;
    const caixa = ac.createBiquadFilter();
    caixa.type = 'lowpass'; caixa.frequency.value = 4800; caixa.Q.value = .8;
    const volume = ac.createGain();
    volume.gain.value = .16;
    const eco = ac.createDelay(1);
    eco.delayTime.value = .17;
    const retorno = ac.createGain();
    retorno.gain.value = .3;
    const molhado = ac.createGain();
    molhado.gain.value = .3;
    entrada.connect(distorcao).connect(graves).connect(presenca).connect(caixa).connect(volume).connect(ac.destination);
    caixa.connect(eco).connect(retorno).connect(eco);
    eco.connect(molhado).connect(volume);

    const cordas = [-7, 7].map(desafino => {
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.detune.value = desafino;
      o.connect(entrada);
      return o;
    });
    const tocarEm = (f: number, t: number) => cordas.forEach(o => o.frequency.setValueAtTime(f, t));
    /* Cada nota é palhetada: o volume cai um instante e volta com ataque rápido. */
    const palhetar = (t: number, dur: number, pico = 1) => {
      entrada.gain.setValueAtTime(.0001, t);
      entrada.gain.linearRampToValueAtTime(pico, t + .006);
      entrada.gain.exponentialRampToValueAtTime(pico * .55, t + dur * .95);
    };

    let t = t0;
    for (const [nota, dur] of SUBIDA) { tocarEm(freq(nota), t); palhetar(t, dur); t += dur; }

    /* O bend: sai de ré e sobe um tom até mi, segura e vibra. */
    const bend = .5;
    palhetar(t, bend, 1.1);
    cordas.forEach(o => {
      o.frequency.setValueAtTime(freq(86), t);
      o.frequency.linearRampToValueAtTime(freq(88), t + .11);
    });
    const vibrato = ac.createOscillator();
    vibrato.frequency.value = 6.5;
    const profundidade = ac.createGain();
    profundidade.gain.setValueAtTime(0, t);
    profundidade.gain.linearRampToValueAtTime(38, t + .22);
    vibrato.connect(profundidade);
    cordas.forEach(o => profundidade.connect(o.detune));
    t += bend;
    profundidade.gain.setValueAtTime(0, t);

    for (const [nota, dur] of DESCIDA) { tocarEm(freq(nota), t); palhetar(t, dur); t += dur; }

    /* Power chord de mi no fim: tônica, quinta e oitava juntas. */
    const acorde = .55;
    palhetar(t, acorde, 1.2);
    tocarEm(freq(52), t);
    const extras = [freq(59), freq(64)].map(f => {
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const g = ac.createGain();
      g.gain.setValueAtTime(0, ac.currentTime);
      g.gain.setValueAtTime(.8, t);
      o.connect(g).connect(entrada);
      return o;
    });
    profundidade.gain.linearRampToValueAtTime(22, t + acorde);
    t += acorde;
    entrada.gain.setTargetAtTime(.0001, t, .08);

    const fim = t + .6;
    for (const o of [...cordas, vibrato]) { o.start(t0); o.stop(fim); }
    for (const o of extras) { o.start(t0); o.stop(fim); }
    /* Solta a cadeia depois do eco morrer, para os nós não se acumularem a cada crítico. */
    window.setTimeout(() => { volume.disconnect(); retorno.disconnect(); }, (fim - ac.currentTime + 1.5) * 1000);
  } catch {
    /* Navegador sem áudio: o crítico continua com as chamas, só sem som. */
  }
}
