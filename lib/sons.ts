/* Os sons das rolagens: dado comum, solo de guitarra no crítico e o som de desastre na falha.
   Tocam por Web Audio, e não por <audio>: o celular (Safari e Chrome) só libera som que começa num toque,
   e o resultado chega do servidor depois do toque. Destravar o contexto no clique (prepararSons) deixa
   o som tocar quando a resposta chegar. Os arquivos ficam em public/sons, na mesma origem: a CSP não muda. */

export type Som = 'dado' | 'solo' | 'desastre';
const ARQUIVOS: Record<Som, string> = { dado: '/sons/dado.mp3', solo: '/sons/solo.mp3', desastre: '/sons/desastre.mp3' };
const VOLUME: Record<Som, number> = { dado: .7, solo: .55, desastre: .7 };

/* Preferência deste navegador. Fica aqui, e não só no hook do tema, porque a rolagem lê fora do React. */
export const CHAVE_SOM = 'oh-som-critico';
export function somLigado() {
  try { return localStorage.getItem(CHAVE_SOM) !== 'nao'; } catch { return true; }
}

let contexto: AudioContext | null = null;
const buffers = new Map<Som, Promise<AudioBuffer | null>>();
/* Um som de cada vez: um crítico logo depois de outro não sobrepõe dois solos. */
let tocando: AudioBufferSourceNode | null = null;

function obterContexto() {
  if (contexto) return contexto;
  const Contexto = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  contexto = Contexto ? new Contexto() : null;
  return contexto;
}

function carregar(ac: AudioContext, som: Som) {
  let p = buffers.get(som);
  if (!p) {
    p = fetch(ARQUIVOS[som])
      .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      /* A forma com callback funciona também no Safari antigo, que não devolve promessa. */
      .then(dados => new Promise<AudioBuffer>((ok, erro) => ac.decodeAudioData(dados, ok, erro)))
      .catch(() => { buffers.delete(som); return null; });
    buffers.set(som, p);
  }
  return p;
}

/* Chamar dentro do clique, antes de qualquer await: é o toque que libera o áudio no celular. */
export function prepararSons() {
  if (!somLigado()) return;
  try {
    const ac = obterContexto();
    if (!ac) return;
    if (ac.state === 'suspended') void ac.resume();
    for (const som of Object.keys(ARQUIVOS) as Som[]) void carregar(ac, som);
  } catch { /* Sem áudio: a rolagem continua igual, só sem som. */ }
}

export async function tocarSom(som: Som) {
  if (!somLigado()) return;
  try {
    const ac = obterContexto();
    if (!ac) return;
    const buffer = await carregar(ac, som);
    if (!buffer) return;
    if (ac.state === 'suspended') await ac.resume();
    try { tocando?.stop(); } catch { /* já tinha terminado */ }
    const fonte = ac.createBufferSource();
    fonte.buffer = buffer;
    const volume = ac.createGain();
    volume.gain.value = VOLUME[som];
    fonte.connect(volume).connect(ac.destination);
    fonte.onended = () => { if (tocando === fonte) tocando = null; };
    tocando = fonte;
    fonte.start();
  } catch { /* Sem áudio: a rolagem continua igual, só sem som. */ }
}
