import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import chat from './api/chat.js';
import session from './api/session.js';
import calculate from './api/calculate.js';
import health from './api/health.js';
import { securityHeaders } from './lib/http.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(directory, '.env'), quiet: true });
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => { securityHeaders(res); next(); });
  app.use(express.json({ limit: '24kb', strict: true }));
  app.all('/api/chat', chat);
  app.all('/api/session', session);
  app.all('/api/calculate', calculate);
  app.all('/api/health', health);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
  app.use(express.static(path.join(directory, 'public'), { dotfiles: 'deny' }));
  app.use((error, _req, res, _next) => {
    const status = error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 500;
    res.status(status).json({ error: status === 413 ? 'La consulta es demasiado extensa.' : status === 400 ? 'El JSON enviado no es válido.' : 'No se pudo procesar la consulta.' });
  });
  return app;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  createApp().listen(process.env.PORT || 3000, '127.0.0.1', () => console.log('Asistente Fabep disponible en localhost.'));
}
