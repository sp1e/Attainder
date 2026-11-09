import { isAdultCharacter } from './characterCapacity.js';
import { COUNCIL_SEATS } from './council.js';
import { isImprisoned } from './prisoners.js';

// The electors' vote for an elective crown (spec docs/superpowers/specs/2026-11-09-elector-votes-design.md). Reads only and draws nothing.
export const BALLOT_SIZE = 3;
export const OPINION_WEIGHT = 0.2;

const byId = (a, b) => a.id.localeCompare(b.id);

/** The council seat holders and the heads of every family not in exile: living, adult, free and never the old ruler. Sorted by id. */
export function electorsOf(state, oldRuler) {
  const heads = Object.values(state.families).filter((family) => !family.exiled).map((family) => family.headId);
  const ids = new Set([...COUNCIL_SEATS.map((id) => state.offices[id]?.holderId), ...heads]);
  const eligible = (person) => person && !person.diedAt && person.id !== oldRuler?.id && isAdultCharacter(person, state.date) && !isImprisoned(state, person.id);
  return [...ids].map((id) => state.people[id]).filter(eligible).sort(byId);
}

/** The ballot candidate the elector backs: the highest merit plus a fifth of the elector's opinion, the earlier on the ballot on a tie. A candidate backs themself. */
export function electorChoice(elector, ballot, score, opinion) {
  if (ballot.some((candidate) => candidate.id === elector.id)) return elector.id;
  let best = null, bestValue = -Infinity;
  for (const candidate of ballot) {
    const value = score(candidate) + opinion(elector.id, candidate.id) * OPINION_WEIGHT;
    if (value > bestValue) { best = candidate; bestValue = value; }
  }
  return best?.id ?? null;
}

// The house's adults stand for election; a house with only minors passes to the eldest without a vote; with the house gone the outsiders stand.
const ballotOf = (tiers) => (tiers.adults.length ? tiers.adults : tiers.minors.length ? [] : tiers.others).slice(0, BALLOT_SIZE);

/** The ballot from the tiers of electiveTiers, every elector's vote and the winner: most votes, the earlier on the ballot on a tie. With no electors the first on the ballot wins; with no ballot nobody does. */
export function tallyElection(state, oldRuler, tiers, score, opinion) {
  const ballot = ballotOf(tiers);
  const votes = (ballot.length ? electorsOf(state, oldRuler) : []).map((elector) => ({ electorId: elector.id, candidateId: electorChoice(elector, ballot, score, opinion) }));
  const count = (id) => votes.filter((vote) => vote.candidateId === id).length;
  const winner = ballot.reduce((best, candidate) => (!best || count(candidate.id) > count(best.id) ? candidate : best), null);
  return { ballot: ballot.map((candidate) => ({ id: candidate.id, votes: count(candidate.id) })), votes, winnerId: winner?.id ?? null };
}

/** The elective order with the winner of the vote first and everyone else where they stood. */
export function electionOrder(ordered, tally) {
  const winner = ordered.find((person) => person.id === tally.winnerId);
  return winner ? [winner, ...ordered.filter((person) => person !== winner)] : ordered;
}

const votesLabel = (candidate, tally, precision) => {
  if (!tally.votes.length) return 'inga elektorer röstar';
  if (precision !== 'three') return `${candidate.votes} av ${tally.votes.length} röster`;
  return candidate.id === tally.winnerId ? 'leder' : 'ligger efter';
};

/** The vote as the player sees it: each candidate's votes at 'five' or better, only who leads at 'three', and each elector's vote at 'exact'. Reads only. */
export function presentElection(state, tally, precision) {
  if (!tally.ballot.length) return null;
  const name = (id) => state.people[id]?.name ?? '';
  return {
    precision,
    candidates: tally.ballot.map((candidate) => ({ id: candidate.id, name: name(candidate.id), votesLabel: votesLabel(candidate, tally, precision) })),
    electors: precision === 'exact' ? tally.votes.map((vote) => ({ id: vote.electorId, name: name(vote.electorId), candidateName: name(vote.candidateId) })) : [],
  };
}
