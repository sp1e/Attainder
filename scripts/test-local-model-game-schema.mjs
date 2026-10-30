import { generateWithLocalModel } from '../server/localModelBridge.js';
import { JUMP_FORWARD_TOOL, validateGameplayPayload } from '../src/Game/AI/gameplaySchemas.js';

const provider = process.argv[2] || 'codex-cli';
const started = Date.now();
const result = await generateWithLocalModel({
  provider,
  systemPrompt: 'You are testing the real strategy game timeline response schema. This is a synthetic transport check, with no saved campaign. Return a valid response matching the supplied schema.',
  history: [{ role: 'user', parts: [{ text: 'Fictional ancient kingdom Hadara, year -0300-01-01 to -0299-01-01. No player orders. The year passes peacefully. Return the smallest valid timeline result with the final stop date, no invented wars, and no character proposals. Text must be Swedish.' }] }],
  schema: JUMP_FORWARD_TOOL.schema,
});
const parsed = JSON.parse(result.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
const validation = validateGameplayPayload('jumpForward', parsed);
console.log(JSON.stringify({ provider, elapsedMs: Date.now() - started, validation, response: parsed, usage: result.usage }));
