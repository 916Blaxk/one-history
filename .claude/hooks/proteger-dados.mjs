/* Hook PreToolUse: protege o banco real em dados/. Recusa comandos que apagam ou sobrescrevem os dados
   e pede confirmação antes dos que gravam neles. É uma rede de segurança, não um isolamento: um script
   qualquer ainda pode escrever no banco. */
import fs from 'node:fs';

let comando = '';
try {
  comando = JSON.parse(fs.readFileSync(0, 'utf8')).tool_input?.command ?? '';
} catch {
  process.exit(0);
}

const INICIO = String.raw`^(?:\w+=\S*\s+)*(?:(?:cmd(?:\.exe)?\s+/c|(?:powershell|pwsh)(?:\.exe)?(?:\s+-\w+)*|bash\s+-c)\s+["']?)?`;
const TOCA_DADOS = /(?:^|[\s"'=\\/])dados(?:[\\/\s"'*]|$)|one-history\.db/i;
const DESTRUTIVO = new RegExp(INICIO + String.raw`(?:rm|rmdir|rd|del|erase|ri|mv|move|ren|rename|remove-item|move-item|rename-item|clear-content|clear-item|set-content|add-content|out-file|truncate|shred|tee|dd)\b`, 'i');
const COPIA = new RegExp(INICIO + String.raw`(?:cp|copy|copy-item|xcopy|robocopy)\b`, 'i');
const REDIRECIONA = />{1,2}\s*["']?(?:[^\s"'>]*[\\/])?(?:dados[\\/]|one-history\.db)/i;
const GRAVA_NO_BANCO = new RegExp(INICIO + String.raw`(?:npm\s+(?:run\s+)?(?:db:migrar|build|dev|start|senha)\b|node\s+\S*(?:migrar|redefinir-senha)\.mjs)`, 'i');

function destinoDaCopia(trecho) {
  const partes = trecho.split(/\s+/).slice(1).filter(p => !/^-/.test(p) && !/^\/[A-Za-z:]+$/.test(p));
  return partes.at(-1) ?? '';
}

function responder(decisao, motivo) {
  console.log(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decisao, permissionDecisionReason: motivo },
  }));
  process.exit(0);
}

const trechos = comando.split(/\s*(?:&&|\|\||[;|&\n])\s*/);
const apaga = trechos.some(t =>
  (DESTRUTIVO.test(t) && TOCA_DADOS.test(t))
  || (COPIA.test(t) && TOCA_DADOS.test(destinoDaCopia(t)))
  || (/\bfind\b.*\s-delete\b/i.test(t) && TOCA_DADOS.test(t))
  || (/\bnew-item\b.*\s-force\b/i.test(t) && TOCA_DADOS.test(t)));

if (apaga || REDIRECIONA.test(comando)) {
  responder('deny', 'dados/ guarda os dados reais e não há histórico para recuperar. Este comando apagaria ou sobrescreveria esses arquivos. Se for mesmo necessário, peça para a pessoa fazer isso.');
}
if (trechos.some(t => GRAVA_NO_BANCO.test(t))) {
  responder('ask', 'Este comando pode gravar no banco real em dados/ (aplica migrações ou redefine senha). Para só compilar, use npx next build.');
}
