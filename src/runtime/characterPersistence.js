// A persisted pre-write journal makes a multi-document turn recoverable after
// a failed write or a browser/process exit. Storage is injected for fault tests.
const clone = (value) => JSON.parse(JSON.stringify(value));
const KEYS = ["actions", "events", "game", "colors", "chat"];

export const recoverCharacterTransaction = async (world, io) => {
  const journal = world?.characterTransaction;
  if (!journal) return false;
  await io.assertCurrent();
  const snapshots = await io.readSnapshots();
  const snapshot = snapshots.find((entry) => entry.id === journal.snapshotId);
  if (!snapshot?.state?.world || !snapshot?.state?.game) {
    throw new Error("En avbruten sparning saknar sin återställningspunkt. Originalet har behållits; återställ en tidigare sparfil.");
  }
  for (const key of KEYS) {
    if (snapshot.state[key] === undefined) continue;
    await io.assertCurrent();
    await io.write(key, clone(snapshot.state[key]), { emitEvents: false });
  }
  await io.assertCurrent();
  await io.write("world", clone(snapshot.state.world));
  await io.publish?.(snapshot.state);
  return true;
};

export const commitCharacterTransaction = async ({ id, base, next, io }) => {
  await io.assertCurrent();
  const prior = await io.readSnapshots();
  const snapshot = {
    id: `character-snapshot:${id}`, round: base.game.round,
    fromDate: base.game.gameDate, toDate: next.game.gameDate,
    capturedAt: new Date().toISOString(), state: clone(base),
  };
  // Failure here changes no campaign document. The journal always points to a
  // restore point already on disk, rather than one written after the damage.
  await io.writeSnapshots([snapshot, ...prior.filter((entry) => entry.id !== snapshot.id)].slice(0, 12));
  await io.assertCurrent();
  await io.write("world", { ...base.world, characterTransaction: { id, snapshotId: snapshot.id } }, { emitEvents: false });
  try {
    for (const key of KEYS) {
      if (next[key] === undefined) continue;
      await io.assertCurrent();
      await io.write(key, next[key], { emitEvents: false });
    }
    await io.assertCurrent();
    await io.write("world", { ...next.world, characterTransaction: null });
    await io.publish?.(next);
  } catch (error) {
    // A campaign switch must not roll the old campaign into the newly opened
    // one. assertCurrent prevents that; the old journal remains recoverable.
    try {
      await recoverCharacterTransaction({ characterTransaction: { snapshotId: snapshot.id } }, io);
    } catch (recoveryError) {
      error.recoveryError = recoveryError;
    }
    throw error;
  }
  return next;
};
