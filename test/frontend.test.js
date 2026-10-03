import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

class Element {
  constructor() { this.children = []; this.listeners = {}; this.value = ''; this.attributes = {}; this.classList = { add: value => { this.errorClass = value; } }; }
  addEventListener(name, action) { this.listeners[name] = action; }
  appendChild(child) { this.children.push(child); }
  replaceChildren() { this.children = []; }
  setAttribute(key, value) { this.attributes[key] = value; }
  focus() { this.focused = true; }
}
function browser(fetchImpl, legacy = false) {
  const elements = Object.fromEntries(['form', 'input', 'messages', 'send', 'new-conversation', 'status'].map(name => [`#${name}`, new Element()]));
  if (legacy) {
    for (const [old, next] of [['form', 'chat-form'], ['input', 'message'], ['messages', 'log'], ['new-conversation', 'new-chat']]) {
      elements[`#${next}`] = elements[`#${old}`]; delete elements[`#${old}`];
    }
  }
  vm.runInNewContext(source, { document: { querySelector: id => elements[id], createElement: () => new Element() }, fetch: fetchImpl, AbortController, setTimeout, clearTimeout, TypeError, Error });
  return elements;
}
test('frontend llama /api/chat, muestra texto seguro y bloquea envíos simultáneos', async () => {
  let finish;
  const calls = [];
  const elements = browser(async (url, options) => { calls.push({ url, options }); await new Promise(resolve => { finish = resolve; }); return { ok: true, json: async () => ({ text: '<script>no ejecutar</script>' }) }; });
  elements['#input'].value = 'Hola';
  const pending = elements['#form'].listeners.submit({ preventDefault() {} });
  assert.equal(elements['#send'].disabled, true);
  elements['#input'].value = 'Segundo'; await elements['#form'].listeners.submit({ preventDefault() {} }); assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/chat'); assert.deepEqual(JSON.parse(calls[0].options.body), { message: 'Hola' }); assert.equal(calls[0].options.credentials, 'same-origin');
  finish(); await pending;
  assert.equal(elements['#messages'].children[1].textContent, '<script>no ejecutar</script>');
  assert.equal(elements['#send'].disabled, false);
});
test('frontend conserva los IDs y clases existentes de GitHub', async () => {
  const elements = browser(async () => ({ ok: true, json: async () => ({ text: 'Texto de prueba' }) }), true);
  elements['#message'].value = 'Hola'; await elements['#chat-form'].listeners.submit({ preventDefault() {} });
  assert.equal(elements['#log'].children[0].className, 'msg user');
  assert.equal(elements['#log'].children[1].className, 'msg assistant');
  assert.equal(elements['#log'].children[1].textContent, 'Texto de prueba');
});
test('frontend muestra error HTTP y restaura consulta para reintentar', async () => {
  const elements = browser(async () => ({ ok: false, json: async () => ({ error: 'El asistente está ocupado.' }) }));
  elements['#input'].value = 'Consulta'; await elements['#form'].listeners.submit({ preventDefault() {} });
  assert.equal(elements['#messages'].children[1].textContent, 'El asistente está ocupado.'); assert.equal(elements['#input'].value, 'Consulta'); assert.equal(elements['#send'].disabled, false);
});
test('Nueva conversación usa /api/session y limpia sólo después de confirmar éxito', async () => {
  const calls = [];
  const elements = browser(async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ ok: true }) }; });
  elements['#messages'].children.push(new Element()); elements['#input'].value = 'Borrador';
  await elements['#new-conversation'].listeners.click();
  assert.equal(calls[0].url, '/api/session'); assert.equal(calls[0].options.body, '{}');
  assert.equal(elements['#messages'].children.length, 1); assert.equal(elements['#input'].value, '');
  const failed = browser(async () => ({ ok: false, json: async () => ({ error: 'No disponible' }) }));
  const previous = new Element(); failed['#messages'].children.push(previous); await failed['#new-conversation'].listeners.click();
  assert.equal(failed['#messages'].children[0], previous);
});
