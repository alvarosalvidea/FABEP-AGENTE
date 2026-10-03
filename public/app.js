const form = document.querySelector('#form') || document.querySelector('#chat-form');
const input = document.querySelector('#input') || document.querySelector('#message');
const messages = document.querySelector('#messages') || document.querySelector('#log');
const send = document.querySelector('#send');
const reset = document.querySelector('#new-conversation') || document.querySelector('#new-chat');
const status = document.querySelector('#status');
let busy = false;
const legacyLayout = Boolean(document.querySelector('#chat-form'));

function add(text, className) {
  const element = document.createElement('div');
  element.className = legacyLayout ? className === 'user' ? 'msg user' : 'msg assistant' : className;
  element.textContent = text;
  messages.appendChild(element);
  messages.scrollTop = messages.scrollHeight;
  return element;
}
function setBusy(value, text = '') {
  busy = value;
  send.disabled = value;
  reset.disabled = value;
  input.disabled = value;
  status.textContent = text;
  messages.setAttribute('aria-busy', String(value));
}
async function post(url, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 65000);
  try {
    const response = await fetch(url, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload), signal: controller.signal
    });
    let data;
    try { data = await response.json(); }
    catch { throw new Error('El servidor no devolvió una respuesta válida. Intentá nuevamente.'); }
    if (!response.ok) throw new Error(data.error || 'No se pudo procesar la consulta.');
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('La respuesta demoró demasiado. Intentá nuevamente.');
    if (error instanceof TypeError) throw new Error('No pude conectarme. Revisá tu conexión e intentá nuevamente.');
    throw error;
  } finally { clearTimeout(timer); }
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  const message = input.value.trim();
  if (busy || !message) return;
  add(message, 'user');
  input.value = '';
  const loading = add('Consultando…', 'bot');
  setBusy(true, 'Procesando tu consulta…');
  try {
    const data = await post('/api/chat', { message });
    if (typeof data.text !== 'string' || !data.text.trim()) throw new Error('No se recibió una respuesta. Intentá nuevamente.');
    loading.textContent = data.text;
  } catch (error) {
    loading.textContent = error.message;
    loading.classList.add('error');
    input.value = message;
  } finally { setBusy(false); input.focus(); messages.scrollTop = messages.scrollHeight; }
});
reset.addEventListener('click', async () => {
  if (busy) return;
  setBusy(true, 'Iniciando una conversación…');
  try {
    const data = await post('/api/session', {});
    if (!data.ok) throw new Error('No se pudo iniciar una conversación.');
    messages.replaceChildren();
    add('Hola. ¿En qué trabajo o producto Fabep te puedo ayudar?', 'bot');
    input.value = '';
  } catch (error) { add(error.message, 'bot error'); }
  finally { setBusy(false); input.focus(); }
});
