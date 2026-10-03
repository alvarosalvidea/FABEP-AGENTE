import OpenAI from 'openai';
import { config, ConfigurationError } from '../lib/config.js';
import { body, prepare } from '../lib/http.js';
import { readSession, writeSession } from '../lib/session.js';
import { PUBLIC_POLICY, humanHandoff, HANDOFF_TEXT, safetyIncident, SAFETY_TEXT } from '../lib/policy.js';
import { CALCULATE_TOOL, CALCULATION_TOOLS, calculate, runCalculation, CalculationError } from '../lib/calculations.js';
export function createChatHandler({ createResponse } = {}) {
  return async function chat(req, res) {
    if (!prepare(req, res, 'POST')) return;
    let input;
    try { input = body(req); } catch { return res.status(400).json({ error: 'Enviá un objeto JSON válido.' }); }
    if (typeof input.message !== 'string' || !input.message.trim()) return res.status(400).json({ error: 'Escribí una consulta.' });
    if (Object.keys(input).some(name => name !== 'message')) return res.status(400).json({ error: 'La consulta contiene campos no permitidos.' });
    try {
      const settings = config({ requireOpenAI: true });
      const message = input.message.trim();
      if (input.message.length > settings.maxMessageChars) return res.status(400).json({ error: `La consulta admite hasta ${settings.maxMessageChars} caracteres.` });
      const state = readSession(req);
      if (safetyIncident(message)) { res.status(200).json({ text: SAFETY_TEXT, safety: true, handoff: true }); return; }
      if (humanHandoff(message)) { res.status(200).json({ text: HANDOFF_TEXT, handoff: true }); return; }
      const client = createResponse ? null : new OpenAI({ apiKey: settings.apiKey, timeout: 45000, maxRetries: 0 });
      const tools = [CALCULATE_TOOL, ...CALCULATION_TOOLS];
      if (settings.vectorStoreId) tools.push({ type: 'file_search', vector_store_ids: [settings.vectorStoreId], max_num_results: settings.fileSearchMaxResults });
      const common = { model: settings.model, instructions: PUBLIC_POLICY, max_output_tokens: settings.maxOutputTokens, tools, store: true };
      const deadline = Date.now() + 50000;
      async function respond(params) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw new Error('Tiempo agotado');
        return createResponse ? createResponse(params) : client.responses.create(params, { timeout: Math.min(45000, remaining) });
      }
      let response = await respond({ ...common, input: message, ...(state.previous ? { previous_response_id: state.previous } : {}) });
      for (let round = 0; round < 3; round++) {
        const calls = (response.output || []).filter(item => item.type === 'function_call');
        if (!calls.length) break;
        if (calls.length > 8) throw new Error('Demasiadas herramientas');
        const outputs = calls.map(call => {
          let output;
          try {
            const args = JSON.parse(call.arguments);
            if (call.name === 'calculate_quantity') output = calculate(args);
            else if (CALCULATION_TOOLS.some(tool => tool.name === call.name)) output = runCalculation(call.name, args);
            else throw new CalculationError('Herramienta no disponible.');
          } catch (error) { output = { error: error instanceof CalculationError ? error.message : 'Argumentos de cálculo inválidos.' }; }
          return { type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(output) };
        });
        response = await respond({ ...common, previous_response_id: response.id, input: outputs });
      }
      if ((response.output || []).some(item => item.type === 'function_call') || response.status === 'incomplete' || response.status === 'failed' || typeof response.output_text !== 'string' || !response.output_text.trim() || !/^resp_[A-Za-z0-9_-]+$/.test(response.id)) throw new Error('Respuesta no completa');
      state.previous = response.id;
      state.turns++;
      writeSession(res, state);
      res.status(200).json({ text: response.output_text });
    } catch (error) {
      if (error instanceof ConfigurationError) return res.status(503).json({ error: 'El asistente aún requiere configuración del servidor.' });
      if (error.status === 429) return res.status(429).json({ error: 'El asistente está ocupado. Intentá nuevamente más tarde.' });
      res.status(502).json({ error: 'No se pudo obtener una respuesta. Intentá nuevamente o consultá con Álvaro o Susana.' });
    }
  };
}
export default createChatHandler();
