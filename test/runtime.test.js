import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createApp } from '../server.js';
import { createChatHandler } from '../api/chat.js';
import sessionHandler from '../api/session.js';
import { calculate, runCalculation } from '../lib/calculations.js';
import { encodeSession, newSession, readSession } from '../lib/session.js';
import { config } from '../lib/config.js';
import { PUBLIC_POLICY } from '../lib/policy.js';

const original = { ...process.env };
before(() => {
  process.env.OPENAI_API_KEY = 'unit-test-not-a-real-key';
  process.env.OPENAI_MODEL = 'unit-test-model';
  for (const name of ['OPENAI_VECTOR_STORE_ID', 'MAX_MESSAGE_CHARS', 'MAX_OUTPUT_TOKENS', 'FILE_SEARCH_MAX_RESULTS', 'NODE_ENV', 'VERCEL']) delete process.env[name];
});
after(() => {
  for (const name of Object.keys(process.env)) if (!(name in original)) delete process.env[name];
  Object.assign(process.env, original);
});

function request(body = { message: 'Hola' }, headers = {}) {
  return { method: 'POST', headers: { host: 'localhost:3000', 'content-type': 'application/json', ...headers }, body };
}
function response() {
  return { statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; }, setHeader(key, value) { this.headers[key.toLowerCase()] = value; }, json(data) { this.data = data; return this; } };
}
function cookie(res) { return res.headers['set-cookie'].split(';')[0]; }
function answer(id = 'resp_test') { return { id, status: 'completed', output: [], output_text: 'Respuesta de prueba.' }; }

test('dosificación validada para todos los sistemas por masa total', () => {
  for (const [product, total, a, b] of [['plus_art', 800, 400, 400], ['alta_dureza', 1600, 1000, 600], ['mesas_de_rio', 800, 500, 300], ['multiproposito_2_1', 900, 600, 300]]) {
    const value = calculate({ type: 'mixture', product, totalGrams: total });
    assert.equal(value.aGrams, a); assert.equal(value.bGrams, b); assert.equal(value.aGrams + value.bGrams, total);
  }
});
test('separa litros geométricos de consumo validado; rechaza datos no válidos', () => {
  const volume = calculate({ type: 'volume', lengthCm: 100, widthCm: 50, thicknessCm: 1 });
  assert.equal(volume.litres, 5); assert.equal(volume.kilograms, undefined);
  assert.equal(calculate({ type: 'consumption', product: 'alta_dureza', areaM2: 2, thicknessMm: 1 }).kilograms, 2);
  for (const value of [0, -1, Infinity, NaN, '800', null, 1e10]) assert.throws(() => calculate({ type: 'mixture', product: 'plus_art', totalGrams: value }));
  assert.throws(() => calculate({ type: 'consumption', product: 'plus_art', areaM2: 1, thicknessMm: 1 }));
  assert.throws(() => calculate({ type: 'mixture', product: '__proto__', totalGrams: 1 }));
  assert.throws(() => calculate({ type: 'litres_to_kg', litres: 1 }));
});
test('sesión cifrada, autenticada, con vencimiento y límite de contexto', () => {
  const state = { ...newSession(), previous: 'resp_private' };
  const encoded = encodeSession(state);
  const raw = Buffer.from(encoded, 'base64url').toString();
  assert.ok(!raw.includes('resp_private')); assert.ok(!raw.includes(process.env.OPENAI_API_KEY));
  assert.equal(readSession(request({}, { cookie: `fabep_session=${encoded}` })).previous, 'resp_private');
  const altered = `${encoded[0] === 'A' ? 'B' : 'A'}${encoded.slice(1)}`;
  assert.equal(readSession(request({}, { cookie: `fabep_session=${altered}` })).previous, null);
  assert.equal(readSession(request({}, { cookie: `fabep_session=${encodeSession({ ...state, expires: 1 })}` })).previous, null);
  assert.equal(readSession(request({}, { cookie: `fabep_session=${encodeSession({ ...state, turns: 40 })}` })).previous, null);
});
test('Responses: modelo de entorno, política por turno e aislamiento de sesiones', async () => {
  const calls = [];
  const handler = createChatHandler({ createResponse: async params => { calls.push(params); return answer(`resp_${calls.length}`); } });
  const first = response(); await handler(request(), first);
  assert.equal(first.statusCode, 200); assert.equal(first.data.response_id, undefined);
  assert.equal(calls[0].model, 'unit-test-model'); assert.equal(calls[0].instructions, PUBLIC_POLICY);
  assert.equal(calls[0].previous_response_id, undefined); assert.equal(calls[0].store, true);
  const second = response(); await handler(request({ message: 'Continuemos' }, { cookie: cookie(first) }), second);
  assert.equal(calls[1].previous_response_id, 'resp_1'); assert.equal(calls[1].instructions, PUBLIC_POLICY);
  const other = response(); await handler(request(), other);
  assert.equal(calls[2].previous_response_id, undefined);
  const forged = response(); await handler(request({ message: 'Hola', previous_response_id: 'resp_other' }), forged);
  assert.equal(forged.statusCode, 400); assert.equal(calls.length, 3);
});
test('herramienta determinística continúa Responses con resultados exactos', async () => {
  const calls = [];
  const handler = createChatHandler({ createResponse: async params => {
    calls.push(params);
    if (calls.length === 1) return { id: 'resp_tool', output: [{ type: 'function_call', name: 'calculate_quantity', call_id: 'call_1', arguments: JSON.stringify({ type: 'mixture', product: 'alta_dureza', totalGrams: 1600 }) }] };
    return answer('resp_final');
  } });
  const res = response(); await handler(request({ message: 'Calculá 1600 g Alta Dureza' }), res);
  assert.equal(res.statusCode, 200); assert.equal(calls[1].previous_response_id, 'resp_tool');
  const calculation = JSON.parse(calls[1].input[0].output);
  assert.equal(calculation.aGrams, 1000); assert.equal(calculation.bGrams, 600);
  assert.equal(calls[1].instructions, PUBLIC_POLICY);
  assert.equal(readSession(request({}, { cookie: cookie(res) })).previous, 'resp_final');
});
test('File Search sólo cuando existe vector store; respeta límites configurados', async () => {
  process.env.OPENAI_VECTOR_STORE_ID = 'vs_public';
  process.env.FILE_SEARCH_MAX_RESULTS = '3';
  process.env.MAX_OUTPUT_TOKENS = '1500';
  let params;
  const handler = createChatHandler({ createResponse: async input => { params = input; return answer(); } });
  const res = response(); await handler(request(), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(params.tools.find(tool => tool.type === 'file_search'), { type: 'file_search', vector_store_ids: ['vs_public'], max_num_results: 3 });
  assert.equal(params.max_output_tokens, 1500);
  delete process.env.OPENAI_VECTOR_STORE_ID; delete process.env.FILE_SEARCH_MAX_RESULTS; delete process.env.MAX_OUTPUT_TOKENS;
});
test('métodos, JSON, origen, límites y errores no exponen detalles internos', async () => {
  let count = 0;
  const handler = createChatHandler({ createResponse: async () => { count++; throw Object.assign(new Error('private-provider-detail'), { status: 401 }); } });
  const get = response(); await handler({ ...request(), method: 'GET' }, get); assert.equal(get.statusCode, 405); assert.equal(get.headers.allow, 'POST');
  for (const invalid of [{ message: '' }, { message: 1 }, [], 'invalid json', { message: 'x'.repeat(6001) }]) {
    const res = response(); await handler(request(invalid), res); assert.equal(res.statusCode, 400);
  }
  const cross = response(); await handler(request(undefined, { origin: 'https://other.example' }), cross); assert.equal(cross.statusCode, 403);
  const missingType = response(); await handler(request(undefined, { 'content-type': 'text/plain' }), missingType); assert.equal(missingType.statusCode, 415);
  const failed = response(); await handler(request(), failed); assert.equal(failed.statusCode, 502); assert.ok(!JSON.stringify(failed.data).includes('private-provider-detail')); assert.equal(count, 1);
  const limited = response(); await createChatHandler({ createResponse: async () => { throw { status: 429 }; } })(request(), limited); assert.equal(limited.statusCode, 429);
  const incomplete = response(); await createChatHandler({ createResponse: async () => ({ ...answer(), status: 'incomplete' }) })(request(), incomplete); assert.equal(incomplete.statusCode, 502); assert.equal(incomplete.headers['set-cookie'], undefined);
});
test('configuración obligatoria sin modelo por defecto y números acotados', async () => {
  delete process.env.OPENAI_MODEL;
  assert.throws(() => config({ requireOpenAI: true }));
  const res = response(); await createChatHandler({ createResponse: async () => { throw new Error('No debe llamar'); } })(request(), res);
  assert.equal(res.statusCode, 503);
  process.env.OPENAI_MODEL = 'unit-test-model';
  for (const raw of ['-1', '0', '1.5', 'abc', '12001']) {
    process.env.MAX_MESSAGE_CHARS = raw; assert.throws(() => config());
  }
  delete process.env.MAX_MESSAGE_CHARS;
});
test('Nueva conversación cambia cookie, corta contexto y usa Secure en producción', async () => {
  process.env.VERCEL = '1';
  const old = newSession(); old.previous = 'resp_previous';
  const res = response(); sessionHandler(request({}, { cookie: `fabep_session=${encodeSession(old)}` }), res);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['set-cookie'], /HttpOnly; SameSite=Strict; Max-Age=\d+; Secure$/);
  const current = readSession(request({}, { cookie: cookie(res) }));
  assert.equal(current.previous, null); assert.notEqual(current.id, old.id);
  delete process.env.VERCEL;
});
test('solicitud humana explícita se deriva sin inventar envío de notificación', async () => {
  const res = response();
  await createChatHandler({ createResponse: async () => { throw new Error('No debe llamar'); } })(request({ message: 'Quiero hablar con una persona' }), res);
  assert.equal(res.statusCode, 200); assert.equal(res.data.handoff, true); assert.match(res.data.text, /no envía una notificación/);
});
test('incidentes tienen prioridad sobre la atención comercial humana', async () => {
  const res = response();
  await createChatHandler({ createResponse: async () => { throw new Error('No debe llamar'); } })(request({ message: 'Tengo una quemadura y quiero hablar con una persona' }), res);
  assert.equal(res.statusCode, 200); assert.equal(res.data.safety, true); assert.match(res.data.text, /emergencias/);
});
test('HTTP local: frontend, API, datos inválidos y archivos privados inaccesibles', async () => {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const page = await fetch(base); assert.equal(page.status, 200); assert.match(await page.text(), /new-chat/);
    assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
    assert.equal((await fetch(`${base}/app.js`)).status, 200);
    const health = await fetch(`${base}/api/health`); assert.equal(health.status, 200); assert.deepEqual(await health.json(), { ok: true, service: 'fabep-agente', status: 'ok', configured: true });
    const calculation = await fetch(`${base}/api/calculate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'volume', lengthCm: 100, widthCm: 50, thicknessCm: 1 }) });
    assert.equal((await calculation.json()).litres, 5);
    const reset = await fetch(`${base}/api/session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(reset.status, 200); assert.ok(reset.headers.get('set-cookie'));
    for (const location of ['/.env', '/server.js', '/package.json', '/knowledge/01_constitucion.md', '/lib/policy.js']) assert.equal((await fetch(`${base}${location}`)).status, 404);
    assert.equal((await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{broken' })).status, 400);
    assert.equal((await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'x'.repeat(25000) }) })).status, 413);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('HTTP real entre cliente y handler con Responses simulado: continuidad y reset', async () => {
  const calls = [];
  const app = express(); app.use(express.json());
  app.post('/api/chat', createChatHandler({ createResponse: async params => { calls.push(params); return answer(`resp_http${calls.length}`); } }));
  app.post('/api/session', sessionHandler);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let currentCookie;
  async function post(route, payload) {
    const result = await fetch(base + route, { method: 'POST', headers: { 'content-type': 'application/json', ...(currentCookie ? { cookie: currentCookie } : {}) }, body: JSON.stringify(payload) });
    if (result.headers.get('set-cookie')) currentCookie = result.headers.get('set-cookie').split(';')[0];
    assert.equal(result.status, 200); return result.json();
  }
  try {
    assert.equal((await post('/api/chat', { message: 'Hola' })).text, 'Respuesta de prueba.');
    await post('/api/chat', { message: 'Continuemos' }); assert.equal(calls[1].previous_response_id, 'resp_http1');
    await post('/api/session', {}); await post('/api/chat', { message: 'Nueva' }); assert.equal(calls[2].previous_response_id, undefined);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('SDK OpenAI instalado serializa Responses y extrae output_text sin conexión externa', async () => {
  const nativeFetch = globalThis.fetch;
  let sent;
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), 'https://api.openai.com/v1/responses');
    sent = JSON.parse(options.body);
    return new Response(JSON.stringify({
      id: 'resp_sdk', object: 'response', status: 'completed',
      output: [{ type: 'message', id: 'msg_sdk', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: 'Respuesta extraída por SDK.', annotations: [] }] }]
    }), { status: 200, headers: { 'content-type': 'application/json', 'x-request-id': 'unit-test' } });
  };
  try {
    const res = response(); await createChatHandler()(request(), res);
    assert.equal(res.statusCode, 200); assert.equal(res.data.text, 'Respuesta extraída por SDK.');
    assert.equal(sent.model, 'unit-test-model'); assert.equal(sent.instructions, PUBLIC_POLICY);
    assert.equal(sent.tools[0].name, 'calculate_quantity'); assert.equal(sent.tools.length, 4);
  } finally { globalThis.fetch = nativeFetch; }
});
test('compatibilidad con cálculos y unidades del repositorio GitHub', () => {
  assert.deepEqual(runCalculation('calculate_area', { length_m: 2, width_m: 3 }), { area_m2: 6, kind: 'geometric' });
  assert.equal(runCalculation('calculate_volume', { length_m: 1, width_m: 0.5, thickness_mm: 10 }).volume_l, 5);
  assert.equal(runCalculation('calculate_alta_dureza_reference', { area_m2: 2, thickness_mm: 1 }).reference_kg, 2);
  assert.throws(() => runCalculation('calculate_area', { length_m: true, width_m: 1 }));
  assert.throws(() => runCalculation('calculate_volume', { length_m: 1e308, width_m: 1e308, thickness_mm: 1 }));
});
test('HTTP conserva cálculos con campos snake_case y reset DELETE sin JSON', async () => {
  const server = createApp().listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const [payload, key, expected] of [
      [{ type: 'area', length_m: 2, width_m: 3 }, 'area_m2', 6],
      [{ type: 'volume', length_m: 1, width_m: 0.5, thickness_mm: 10 }, 'volume_l', 5],
      [{ type: 'alta_dureza_reference', area_m2: 2, thickness_mm: 1 }, 'reference_kg', 2]
    ]) {
      const res = await fetch(base + '/api/calculate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      assert.equal(res.status, 200); assert.equal((await res.json())[key], expected);
    }
    const reset = await fetch(base + '/api/session', { method: 'DELETE' });
    assert.equal(reset.status, 200); assert.equal((await reset.json()).ok, true);
    assert.equal((await fetch(base + '/api/session', { method: 'DELETE', headers: { origin: 'https://other.example' } })).status, 403);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('saldo o cuota agotados se diferencian de un límite temporal sin revelar datos de cuenta', async () => {
  for (const error of [
    { status: 429, code: 'credit_balance_exhausted' },
    { status: 429, error: { code: 'project_spend_limit_exceeded' } },
    { status: 429, error: { error: { code: 'insufficient_quota' } } }
  ]) {
    const res = response();
    await createChatHandler({ createResponse: async () => { throw error; } })(request(), res);
    assert.equal(res.statusCode, 503);
    assert.match(res.data.error, /temporalmente no disponible/);
    assert.ok(!JSON.stringify(res.data).includes('credit_balance'));
    assert.ok(!JSON.stringify(res.data).includes('quota'));
    assert.equal(res.headers['set-cookie'], undefined);
  }
  const limited = response();
  await createChatHandler({ createResponse: async () => { throw { status: 429, code: 'rate_limit_exceeded' }; } })(request(), limited);
  assert.equal(limited.statusCode, 429); assert.match(limited.data.error, /Intentá nuevamente/);
});
