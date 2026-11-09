/*! Open Historia - intervention availability lifecycle, AGPL-3.0-or-later (see LICENSE). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { worldForSnapshot } from '../../runtime/snapshotWorld.js';

// Run the actual component's availability hooks with a tiny effect scheduler.
// A round update can render before the final journal snapshot is persisted.
const source = readFileSync(new URL('./time.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf('    const [canInterveneTurn, setCanInterveneTurn] = useState(false);');
const end = source.indexOf('\n\n    // Stop the round', start);
assert.ok(start >= 0 && end > start);
const code = `${source.slice(start, end)}\nreturn canInterveneTurn;`;
const createRender = new Function('useState', 'useEffect', 'gameData', 'worldState', 'isLoading', 'skipInFlight', 'canInterveneInLastTurn', 'window', code);

function driver(read, window = new EventTarget()) {
  let state = false, previous, cleanup;
  return {
    render({ round = 1, date = 'start', loading = false, skipping = false } = {}) {
      const useState = () => [state, value => { state = typeof value === 'function' ? value(state) : value; }];
      const useEffect = (effect, deps) => {
        if (!previous || deps.some((v, i) => !Object.is(v, previous[i]))) {
          cleanup?.(); previous = deps; cleanup = effect();
        }
      };
      return createRender(useState, useEffect, { round }, { simulationHistory: [{ date }] }, loading, skipping, read, window);
    },
    value: () => state,
    notify: () => window.dispatchEvent(new Event("oh:rollback-snapshots-updated")),
  };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('availability refreshes when the journal persists after round publication', async () => {
  let journal = false;
  const d = driver(async () => journal);
  d.render(); await settle(); assert.equal(d.value(), false);
  d.render({ round: 2, date: 'end', loading: true, skipping: true }); await settle();
  assert.equal(d.value(), false);
  journal = true;
  d.render({ round: 2, date: 'end', loading: false, skipping: false }); await settle();
  assert.equal(d.value(), true);
});

test('a stale pending read cannot enable intervention during a newer turn', async () => {
  let resolveOld; const old = new Promise(resolve => { resolveOld = resolve; });
  let count = 0;
  const d = driver(() => ++count === 1 ? old : Promise.resolve(false));
  d.render(); d.render({ round: 2, date: 'end', loading: true, skipping: true });
  resolveOld(true); await settle(); assert.equal(d.value(), false);
  d.render({ round: 2, date: 'end' }); await settle(); assert.equal(d.value(), false);
});

test('the finalized snapshot refreshes availability without a Timeline loading transition', async () => {
  let journal = false; const d = driver(async () => journal);
  d.render({ round: 2, date: 'end' }); await settle(); assert.equal(d.value(), false);
  journal = true; d.notify(); await settle(); assert.equal(d.value(), true);
});

test('the real snapshot capture announces only after persistence completes', async () => {
  const gameplay = readFileSync(new URL('../AI/gameplay.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
  const from=gameplay.indexOf('const captureRollbackSnapshot = async');
  const to=gameplay.indexOf('// Restore points, newest first',from);
  assert.ok(from >= 0 && to > from);
  let finish, calls=0;
  const writing=new Promise(resolve => { finish=resolve; });
  const deps={ readJson:async()=>[], writeJson:async()=>writing, JSON_URLS:{snapshots:'snapshots'},
    cloneValue:structuredClone, worldForSnapshot, MAX_ROLLBACK_SNAPSHOTS:12, window:{dispatchEvent:()=>calls++}, Event:class { constructor(type) { this.type=type; } }, console };
  const capture=new Function(...Object.keys(deps),`${gameplay.slice(from,to)}\nreturn captureRollbackSnapshot;`)(...Object.values(deps));
  const work=capture({ round:1,fromDate:'1200-01-01',toDate:'1201-01-01',game:{},world:{},events:[],actions:[],chat:[],colors:{} });
  await settle(); assert.equal(calls,0);
  finish(); await work; assert.equal(calls,1);
});

test('a finalized first-turn snapshot refreshes the actual undo count', async () => {
  const from=source.indexOf('    // How many turns can be undone');
  const to=source.indexOf('    // stayOnHistory',from);
  assert.ok(from >= 0 && to > from);
  const effectSource=source.slice(from,to);
  let count=0, snapshots=0; const listeners=new Set();
  const deps={ useEffect:fn=>fn(), gameData:{round:2}, isLoading:false, skipInFlight:false,
    loadRollbackSnapshotCount:async()=>snapshots, setUndoCount:value=>{count=value;},
    window:{addEventListener:(_,fn)=>listeners.add(fn),removeEventListener:(_,fn)=>listeners.delete(fn)} };
  new Function(...Object.keys(deps),effectSource)(...Object.values(deps));
  await settle(); assert.equal(count,0);
  snapshots=1; for(const fn of listeners) fn(); await settle(); assert.equal(count,1);
});

test('actual snapshot capture wakes the actual availability effect after persistence', async () => {
  const gameplay=readFileSync(new URL('../AI/gameplay.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
  const from=gameplay.indexOf('const captureRollbackSnapshot = async');
  const to=gameplay.indexOf('// Restore points, newest first',from);
  assert.ok(from >= 0 && to > from);
  const bus=new EventTarget(); let journal=false, finish;
  const d=driver(async()=>journal,bus);
  d.render({round:2,date:'end'}); await settle(); assert.equal(d.value(),false);
  const writing=new Promise(resolve=>{finish=()=>{journal=true; resolve();};});
  const deps={readJson:async()=>[],writeJson:async()=>writing,JSON_URLS:{snapshots:'snapshots'},
    cloneValue:structuredClone,worldForSnapshot,MAX_ROLLBACK_SNAPSHOTS:12,window:bus,Event,console};
  const capture=new Function(...Object.keys(deps),`${gameplay.slice(from,to)}\nreturn captureRollbackSnapshot;`)(...Object.values(deps));
  const work=capture({round:1,fromDate:'1200-01-01',toDate:'1201-01-01',game:{},world:{},events:[],actions:[],chat:[],colors:{}});
  await settle(); assert.equal(d.value(),false);
  finish(); await work; await settle(); assert.equal(d.value(),true);
});
