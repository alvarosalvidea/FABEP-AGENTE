import { mkdirSync, copyFileSync, existsSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { PUBLIC_FILES } from './files.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = spawnSync(process.execPath, [path.join(root, 'scripts/check.js')], { stdio: 'inherit' });
if (check.status !== 0) process.exit(1);
// Carpeta nueva para cada exportación; nunca borrar ni sobrescribir trabajo anterior.
const target = path.join(root, 'release', `fabep-agent-${Date.now()}`);
if (existsSync(path.join(root, 'release')) && lstatSync(path.join(root, 'release')).isSymbolicLink()) throw new Error('release no puede ser un enlace.');
for (const file of PUBLIC_FILES) {
  if (lstatSync(path.join(root, file)).isSymbolicLink()) throw new Error('No exportar enlaces.');
  const destination = path.join(target, file);
  mkdirSync(path.dirname(destination), { recursive: true });
  copyFileSync(path.join(root, file), destination);
}
console.log(`Paquete público sin .env, documentos internos ni node_modules: ${target}`);
