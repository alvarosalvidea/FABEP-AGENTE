import { config } from '../lib/config.js';
import { prepare } from '../lib/http.js';
export default function health(req, res) {
  if (!prepare(req, res, 'GET')) return;
  try { config({ requireOpenAI: true }); res.status(200).json({ ok: true, service: 'fabep-agente', status: 'ok', configured: true }); }
  catch { res.status(503).json({ ok: false, service: 'fabep-agente', status: 'configuration_required', configured: false }); }
}
