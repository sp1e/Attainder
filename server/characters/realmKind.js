import { POLITY_KINDS, POLITY_KIND_LABELS_SV, SUCCESSION_LAW_LABELS_SV } from './content.js';

/** Additive migration: a save written before polity kinds rules a state. Draws nothing. */
export function ensureRealmKind(state) {
  if (state.realm && !Object.hasOwn(state.realm, 'kind')) state.realm.kind = 'state';
  return state;
}

export function validateRealmKind(state) {
  if (!POLITY_KINDS.includes(state.realm?.kind)) throw new Error('Sparfilens rikestyp är okänd.');
}

export function presentRealm(state) {
  const { kind, successionLaw } = state.realm;
  return {
    kind, kindLabelSv: POLITY_KIND_LABELS_SV[kind] ?? kind,
    successionLaw, successionLawLabelSv: SUCCESSION_LAW_LABELS_SV[successionLaw] ?? successionLaw,
  };
}
