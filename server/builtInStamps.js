// When the built-in scenario counts as the player's edit. Both library stores stamp an untouched
// built-in with one clock read for createdAt and updatedAt, and an edit moves updatedAt on. Records
// written before that single read came in took two reads, which can sit a millisecond apart. A gap
// under one second is that write; a player's edit takes longer than a second after the stamp.
export const LEGACY_STAMP_GAP_MS = 1000;

export const builtInMetaEdited = (meta) => {
  if (meta?.updatedAt === meta?.createdAt) return false;
  const gap = Date.parse(meta?.updatedAt) - Date.parse(meta?.createdAt);
  return !(Math.abs(gap) < LEGACY_STAMP_GAP_MS);
};
