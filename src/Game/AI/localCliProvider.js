// Local desktop transport. The server launches an installed, tool-disabled CLI
// with its existing login; no credential is copied into the game or browser.
export async function callLocalCli(provider, systemPrompt, history, options = {}) {
  const response = await fetch('/api/local-models/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: options.signal,
    body: JSON.stringify({ provider, model: options.entrySettings?.model || '', systemPrompt, history, schema: options.tool?.schema || null }),
  });
  options.onRequest?.(response.status);
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error || `Lokal modellanslutning: HTTP ${response.status}`);
  }
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let pending = '', result = null;
  const consume = line => {
    if (!line.trim()) return;
    const item = JSON.parse(line);
    if (item.type === 'error') throw new Error(item.error);
    if (item.type === 'result') result = item;
    options.onActivity?.();
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split('\n'); pending = lines.pop();
      for (const line of lines) consume(line);
    }
    pending += decoder.decode(); consume(pending);
  } finally { reader.releaseLock(); }
  if (!result?.text) throw new Error('Det lokala modellprogrammet lämnade inget svar.');
  if (result.usage) options.onUsage?.({ usage: result.usage });
  options.onChunk?.(result.text);
  if (!options.tool) return result.text;
  let toolInput = null;
  try { toolInput = JSON.parse(result.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); } catch { /* game salvage/validation handles incomplete JSON */ }
  return { rawText: result.text, toolInput };
}
