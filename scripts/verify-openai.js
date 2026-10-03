import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../lib/config.js';
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env'), quiet: true });
try {
  const settings = config({ requireOpenAI: true });
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${settings.apiKey}` }, signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    console.log(JSON.stringify({ status: 'provider_rejected', httpStatus: response.status }));
    process.exitCode = 1;
  } else {
    const data = await response.json();
    const available = data.data.map(item => item.id);
    console.log(JSON.stringify({ status: 'connected', configuredModelAvailable: available.includes(settings.model), availableKnownModels: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini'].filter(model => available.includes(model)) }));
    if (!available.includes(settings.model)) process.exitCode = 1;
  }
} catch (error) {
  console.log(JSON.stringify({ status: 'connection_failed', reason: error.cause?.code || error.name }));
  process.exitCode = 1;
}
