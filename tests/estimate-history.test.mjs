import assert from 'node:assert/strict';
import { estimateMatches } from '../lib/estimate-history.mjs';

const state = {length: 20, height: '2', material: 'profile_one', paint: 0, swingEnabled: true, swingCount: 1, wicketCount: 1, fencePrice: 2100, extraSections: []};
const prices = {profile_single_2_0: 2100, delivery_0_60: 6000};
const entry = structuredClone({id:'original', state, prices, total:78000});
const original = JSON.stringify(entry);
assert.equal(estimateMatches(entry, structuredClone(state), {...prices}, 78000), true);
assert.equal(estimateMatches(entry, Object.fromEntries(Object.entries(state).reverse()), Object.fromEntries(Object.entries(prices).reverse()), 78000), true);
for (const change of [{length:30}, {height:'1.8'}, {material:'picket_single'}, {paint:20}, {swingEnabled:false}, {swingCount:2}, {wicketCount:2}, {fencePrice:2200}, {extraSections:[{id:'second',length:10}]}]) {
  assert.equal(estimateMatches(entry, {...state,...change}, prices, 78000), false, JSON.stringify(change));
}
// Even when adjustments cancel out and the total stays the same, preserve both versions.
assert.equal(estimateMatches(entry, {...state, length:10, fencePrice:4200}, prices, 78000), false);
assert.equal(estimateMatches(entry, state, {...prices, profile_single_2_0:2200}, 78000), false);
assert.equal(estimateMatches(entry, state, prices, 79000), false);
assert.equal(estimateMatches({...entry,prices:{...prices,version:'2026-10-21'}}, state, prices, 78000), true);
assert.equal(estimateMatches(undefined, state, prices, 78000), false);
assert.equal(JSON.stringify(entry), original);
console.log('PASS: unchanged snapshots, all input changes, same-total variants, changed prices, legacy metadata and original immutability');
