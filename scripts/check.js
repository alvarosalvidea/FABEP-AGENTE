import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PUBLIC_FILES } from './files.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failed = false;
for (const file of PUBLIC_FILES) {
  const absolute = path.join(root, file);
  const source = readFileSync(absolute, 'utf8');
  if (/\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{16,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(source)) {
    console.error(`Posible secreto en ${file}.`); failed = true;
  }
  if (file.endsWith('.json')) JSON.parse(source);
  if (file.endsWith('.js')) {
    const check = spawnSync(process.execPath, ['--check', absolute], { encoding: 'utf8' });
    if (check.status !== 0) { console.error(check.stderr); failed = true; }
  }
}
for (const file of ['api/chat.js', 'api/session.js', 'api/calculate.js', 'api/health.js', 'server.js']) await import(pathToFileURL(path.join(root, file)).href);
const frontend = readFileSync(path.join(root, 'public/app.js'), 'utf8');
if (/OPENAI_API_KEY|process\.env|innerHTML/.test(frontend)) throw new Error('Contenido inseguro en frontend.');
for (const directory of ['public', 'api', 'lib', 'scripts', 'test', '.github']) {
  for (const item of readdirSync(path.join(root, directory), { recursive: true, withFileTypes: true })) {
    if (!item.isFile()) continue;
    const relative = path.relative(root, path.join(item.parentPath, item.name)).replaceAll('\\', '/');
    if (!PUBLIC_FILES.includes(relative)) { console.error(`Archivo fuera de lista pública: ${relative}`); failed = true; }
  }
}
if (failed) process.exitCode = 1;
else console.log(`Sintaxis, imports, JSON y revisión de secretos: ${PUBLIC_FILES.length} archivos públicos verificados.`);
