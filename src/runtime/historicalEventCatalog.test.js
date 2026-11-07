import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogLoader } from './historicalEventCatalog.js';

test('the loader memoizes success and retries after a failure', async () => {
  let calls = 0;
  const load = createCatalogLoader(async () => {
    calls += 1;
    if (calls === 1) throw new Error('offline');
    return { default: { events: [] } };
  });
  await assert.rejects(load(), /offline/);
  const [a, b] = await Promise.all([load(), load()]);
  assert.equal(a, b);
  await load();
  assert.equal(calls, 2);
});
