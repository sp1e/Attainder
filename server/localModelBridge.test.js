import test from 'node:test';
import assert from 'node:assert/strict';
import { localModelArguments, parseLocalModelOutput, validateLocalModelRequest } from './localModelBridge.js';

test('local model input never supplies executable options or unbounded prompts', () => {
  const valid = { provider: 'codex-cli', systemPrompt: 'Game rules', history: [{ role: 'user', parts: [{ text: 'Hello' }] }] };
  assert.equal(validateLocalModelRequest(valid).provider, 'codex-cli');
  assert.throws(() => validateLocalModelRequest({ ...valid, provider: 'powershell' }));
  assert.throws(() => validateLocalModelRequest({ ...valid, model: '--dangerously-bypass-approvals-and-sandbox' }));
  assert.throws(() => validateLocalModelRequest({ ...valid, systemPrompt: 'X'.repeat(1600000) }));
  const request = validateLocalModelRequest({ ...valid, executable: 'evil.exe', cwd: 'C:/', args: ['--tools', 'all'] });
  assert.equal(request.executable, undefined);
  assert.equal(request.args, undefined);
});

test('CLI invocations disable computer tools and keep existing authentication separate', () => {
  const codex = localModelArguments('codex-cli', { directory: 'C:/isolated', schemaFile: 'C:/isolated/answer.json' });
  assert.ok(codex.includes('--ignore-user-config'));
  assert.ok(codex.includes('read-only'));
  assert.ok(codex.includes('shell_tool'));
  for (const feature of ['apps', 'plugins', 'remote_plugin', 'multi_agent', 'view_image', 'image_generation', 'hooks']) {
    assert.equal(codex[codex.indexOf(feature) - 1], '--disable');
  }
  assert.ok(codex.includes('web_search="disabled"'));
  assert.ok(!codex.some(arg => arg.includes('bypass')));
  const claude = localModelArguments('claude-cli', {});
  assert.equal(claude[claude.indexOf('--tools') + 1], '');
  assert.ok(claude.includes('--restricted'));
  assert.ok(claude.includes('--strict-mcp-config'));
  assert.equal(claude[claude.indexOf('--output-format') + 1], 'stream-json');
  assert.equal(claude[claude.indexOf('--effort') + 1], 'medium');
  assert.ok(!claude.includes('--bare'), 'bare skips the existing OAuth login');
});

test('only final model text is returned, never reasoning or process diagnostics', () => {
  const output = [
    { type: 'item.completed', item: { type: 'reasoning', text: 'private reasoning' } },
    { type: 'item.completed', item: { type: 'agent_message', text: '{"answer":"ok"}' } },
    { type: 'turn.completed', usage: { input_tokens: 20, output_tokens: 8 } },
  ].map(JSON.stringify).join('\n');
  const result = parseLocalModelOutput('codex-cli', output);
  assert.equal(result.text, '{"answer":"ok"}');
  assert.equal(result.usage.input_tokens, 20);
  assert.throws(() => parseLocalModelOutput('codex-cli', '{"type":"turn.failed","error":{"message":"No login"}}'));
  assert.throws(() => parseLocalModelOutput('claude-cli', '{"is_error":true,"result":"No login"}'));
  assert.equal(parseLocalModelOutput('claude-cli', '{"result":"Välkommen","usage":{"input_tokens":1}}').text, 'Välkommen');
  assert.equal(parseLocalModelOutput('claude-cli', '{"type":"assistant","message":{"content":[{"type":"thinking","thinking":"private"}]}}\n{"type":"result","is_error":false,"result":"Spelsvar","usage":{"input_tokens":2}}').text, 'Spelsvar');
  assert.throws(() => parseLocalModelOutput('claude-cli', '{"type":"assistant","message":"unfinished"}'));
});

test('Codex strict transport unwraps optional game fields without changing their semantics', () => {
  const game = { events: [], summary: 'Ett år i Hadara', optionalField: null };
  const event = JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify({ gameResponse: JSON.stringify(game) }) } });
  const result = parseLocalModelOutput('codex-cli', event, { unwrapGameResponse: true });
  assert.deepEqual(JSON.parse(result.text), game);
  assert.throws(() => parseLocalModelOutput('codex-cli', JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: '{"gameResponse":null}' } }), { unwrapGameResponse: true }));
});
