import test from 'node:test';
import assert from 'node:assert/strict';
import { localModelArguments, parseLocalModelOutput, validateLocalModelRequest } from './localModelBridge.js';
import { callLocalCli } from '../src/Game/AI/localCliProvider.js';
import { getModelCallCounts } from '../src/Game/AI/modelCallCounter.js';

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

const effortRequest = { provider: 'claude-cli', systemPrompt: 'Game rules', history: [{ role: 'user', parts: [{ text: 'Hello' }] }] };

test('the bridge validates the effort level and defaults it to medium', () => {
  assert.equal(validateLocalModelRequest(effortRequest).effort, 'medium');
  for (const effort of ['low', 'medium', 'high']) assert.equal(validateLocalModelRequest({ ...effortRequest, effort }).effort, effort);
  for (const effort of ['max', 'LOW', '', 3, null, '--effort']) {
    assert.throws(() => validateLocalModelRequest({ ...effortRequest, effort }), { message: 'Ogiltig ansträngningsnivå.' });
  }
});

test('effort reaches the Claude and Codex arguments', () => {
  const claude = localModelArguments('claude-cli', { effort: 'low' });
  assert.equal(claude[claude.indexOf('--effort') + 1], 'low');
  assert.equal(localModelArguments('claude-cli', {})[localModelArguments('claude-cli', {}).indexOf('--effort') + 1], 'medium');
  const codex = localModelArguments('codex-cli', { directory: 'C:/isolated', effort: 'high' });
  assert.equal(codex[codex.indexOf('model_reasoning_effort="high"') - 1], '-c');
  assert.ok(localModelArguments('codex-cli', { directory: 'C:/isolated' }).includes('model_reasoning_effort="medium"'));
});

// Runs callLocalCli against a mocked fetch and returns the request body it sent.
async function sentBody(provider, options) {
  const realFetch = globalThis.fetch;
  let body = null;
  globalThis.fetch = async (_url, init) => {
    body = JSON.parse(init.body);
    const line = JSON.stringify({ type: 'result', text: 'ok' }) + '\n';
    return { ok: true, status: 200, body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(line)); controller.close(); } }) };
  };
  try { await callLocalCli(provider, 'system', [], options); } finally { globalThis.fetch = realFetch; }
  return body;
}

test('callLocalCli sends effort and picks the model per provider', async () => {
  assert.equal((await sentBody('claude-cli', { entrySettings: { model: 'sonnet' } })).effort, 'medium');
  assert.equal((await sentBody('claude-cli', { entrySettings: { model: 'sonnet' } })).model, 'sonnet');
  const interactiveClaude = await sentBody('claude-cli', { interactive: true, effort: 'low', entrySettings: { model: 'sonnet' } });
  assert.equal(interactiveClaude.model, 'claude-sonnet-5-5');
  assert.equal(interactiveClaude.effort, 'low');
  const interactiveCodex = await sentBody('codex-cli', { interactive: true, effort: 'low', entrySettings: { model: 'gpt-5-codex' } });
  assert.equal(interactiveCodex.model, 'gpt-5-codex');
  assert.equal(interactiveCodex.effort, 'low');
  assert.equal((await sentBody('claude-cli', { interactive: false, entrySettings: {} })).model, '');
});

test('callLocalCli counts every call by kind', async () => {
  const before = getModelCallCounts();
  await sentBody('claude-cli', { callKind: 'interpret' });
  await sentBody('claude-cli', {});
  const after = getModelCallCounts();
  assert.equal(after.total - before.total, 2);
  assert.equal((after.byKind.interpret || 0) - (before.byKind.interpret || 0), 1);
  assert.equal((after.byKind.year || 0) - (before.byKind.year || 0), 1);
});

test('localModelArguments refuses an effort outside the whitelist', () => {
  for (const provider of ['claude-cli', 'codex-cli']) {
    for (const effort of ['max', 'LOW', '', null, 3, 'low"; rm -rf /']) {
      assert.throws(() => localModelArguments(provider, { directory: 'C:/isolated', effort }), { message: 'Ogiltig ansträngningsnivå.' });
    }
  }
});
