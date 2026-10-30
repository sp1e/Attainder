import { generateWithLocalModel, localModelStatus } from '../server/localModelBridge.js';

const provider = process.argv[2] || 'codex-cli';
const status = await localModelStatus(provider);
console.log(JSON.stringify(status));
if (!status.authenticated) process.exitCode = 1;
else {
  const started = Date.now();
  const result = await generateWithLocalModel({
    provider, systemPrompt: 'This is a connection test for a strategy game. Return the requested short JSON object.',
    history: [{ role: 'user', parts: [{ text: 'Return {"connected":true,"message":"Hadara väntar"} exactly.' }] }],
    schema: { type: 'object', properties: { connected: { type: 'boolean' }, message: { type: 'string' } }, required: ['connected', 'message'], additionalProperties: false },
  });
  const parsed = JSON.parse(result.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  if (parsed.connected !== true || parsed.message !== 'Hadara väntar') throw new Error('Unexpected connection test response');
  console.log(JSON.stringify({ provider, passed: true, elapsedMs: Date.now() - started, response: parsed, usage: result.usage }));
}
