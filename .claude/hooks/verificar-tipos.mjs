/* Hook PostToolUse: roda o tsc depois de editar .ts/.tsx. O projeto não tem linter, então é a única checagem rápida. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

let arquivo = '';
try {
  const entrada = JSON.parse(fs.readFileSync(0, 'utf8'));
  arquivo = entrada.tool_input?.file_path ?? entrada.tool_response?.filePath ?? '';
} catch {
  process.exit(0);
}
if (!/\.tsx?$/i.test(arquivo) || /[\\/](node_modules|\.next)[\\/]/.test(arquivo)) process.exit(0);

const r = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'], {
  cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
  encoding: 'utf8',
});
if (r.status !== 0) {
  const saida = (r.stdout || r.stderr || String(r.error ?? 'tsc falhou')).trim().split('\n').slice(0, 40).join('\n');
  console.error(saida);
  process.exit(2);
}
