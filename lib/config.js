export class ConfigurationError extends Error {}
function integer(name, fallback, min, max) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) throw new ConfigurationError(name);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new ConfigurationError(name);
  return value;
}
export function config({ requireOpenAI = false } = {}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim();
  const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID?.trim();
  if (requireOpenAI && (!apiKey || !model)) throw new ConfigurationError('OpenAI no configurado');
  if (vectorStoreId && !/^vs_[A-Za-z0-9_-]+$/.test(vectorStoreId)) throw new ConfigurationError('Vector store inválido');
  return { apiKey, model, vectorStoreId,
    maxMessageChars: integer('MAX_MESSAGE_CHARS', 6000, 1, 12000),
    maxOutputTokens: integer('MAX_OUTPUT_TOKENS', 2000, 128, 8000),
    fileSearchMaxResults: integer('FILE_SEARCH_MAX_RESULTS', 6, 1, 50) };
}
