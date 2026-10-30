export const DEFAULT_CAMPAIGN_SEED = 104729;

export function normalizeCampaignSeed(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_CAMPAIGN_SEED;
  if (typeof value === 'string' && !/^\d+$/.test(value.trim())) throw new Error('Kampanjfröet måste vara ett heltal mellan 1 och 4294967295.');
  if (!['string', 'number'].includes(typeof value)) throw new Error('Ogiltigt kampanjfrö.');
  const seed = Number(value);
  if (!Number.isSafeInteger(seed) || seed < 1 || seed > 4294967295) throw new Error('Kampanjfröet måste vara ett heltal mellan 1 och 4294967295.');
  return seed;
}
