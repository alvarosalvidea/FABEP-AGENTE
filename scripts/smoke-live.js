// Prueba optativa que consume la cuota existente de OpenAI. Nunca ejecutar en build/CI.
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import { config } from '../lib/config.js';
import { createChatHandler } from '../api/chat.js';
import sessionHandler from '../api/session.js';
import { readSession } from '../lib/session.js';
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env'), quiet: true });
const settings = config({ requireOpenAI: true });
const client = new OpenAI({ apiKey: settings.apiKey, timeout: 45000, maxRetries: 0 });
let providerFailure = null;
let providerCalls = 0;
let toolOutputs = 0;
let currentCookie;
const chat = createChatHandler({ createResponse: async params => {
  providerCalls++;
  if (Array.isArray(params.input)) toolOutputs += params.input.filter(item => item.type === 'function_call_output').length;
  try { return await client.responses.create(params); }
  catch (error) {
    providerFailure = { httpStatus: error.status || null, code: ['insufficient_quota', 'model_not_found', 'invalid_api_key'].includes(error.code) ? error.code : 'provider_error' };
    throw error;
  }
} });
function request(message) {
  return { method: 'POST', headers: { host: 'localhost', 'content-type': 'application/json', ...(currentCookie ? { cookie: currentCookie } : {}) }, body: message === null ? {} : { message } };
}
function result() {
  return { code: 200, headers: {}, status(code) { this.code = code; return this; }, setHeader(key, value) { this.headers[key] = value; }, json(data) { this.data = data; } };
}
async function ask(message) {
  const res = result(); await chat(request(message), res);
  assert.equal(res.code, 200, 'El proveedor no completó la consulta.');
  currentCookie = res.headers['Set-Cookie'].split(';')[0];
  assert.ok(readSession(request('')).previous);
  return res.data.text;
}
try {
  const first = await ask('¿De qué marca es este asistente? Respondé sólo una oración.');
  assert.match(first, /fabep/i);
  const quantity = await ask('Usá la herramienta de cálculo para dosificar una masa total A+B de 1600 gramos de Fabep Alta Dureza. Indicá A y B en gramos.');
  assert.match(quantity, /1[.\s,]?000/); assert.match(quantity, /600/); assert.ok(toolOutputs > 0);
  const context = await ask('¿Qué producto te pedí calcular en mi consulta anterior? Respondé sólo el nombre.');
  assert.match(context, /alta dureza/i);
  const old = readSession(request('')).id;
  const reset = result(); sessionHandler(request(null), reset);
  assert.equal(reset.code, 200);
  currentCookie = reset.headers['Set-Cookie'].split(';')[0];
  const next = readSession(request(''));
  assert.equal(next.previous, null); assert.notEqual(next.id, old);
  console.log(JSON.stringify({ status: 'passed', conversations: 1, turns: 3, providerCalls, deterministicToolOutputs: toolOutputs, continuity: true, reset: true }));
} catch {
  console.log(JSON.stringify({ status: 'failed', providerFailure, providerCalls, deterministicToolOutputs: toolOutputs }));
  process.exitCode = 1;
}
