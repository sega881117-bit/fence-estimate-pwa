import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {estimateExpiresAt, isEstimateExpired, retainRecentEstimates, ESTIMATE_LIFETIME_MS} from '../lib/estimate-history.mjs';

// Exercise the actual React effect with a controlled clock and browser events.
const source = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const marker = '  useEffect(() => {\n    if (!ready) return;\n    const cleanup = () => {';
const start = source.indexOf(marker);
assert.ok(start >= 0);
const body = source.slice(start + '  useEffect(() => {'.length, source.indexOf('  }, [ready, library, activeId, deleted]);', start));
const run = new Function('ready', 'library', 'activeId', 'deleted', 'localStorage', 'window', 'document', 'setLibrary', 'setActiveId', 'setDeleted', 'setStorageMessage', 'estimateExpiresAt', 'isEstimateExpired', 'retainRecentEstimates', 'SAVED_KEY', 'Date', body);
const created = Date.parse('2026-10-21T10:00:00Z');
const old = {id:'old', updatedAt:new Date(created).toISOString()};
const recent = {id:'recent', updatedAt:new Date(created + 60000).toISOString()};

function harness(now, library, activeId = 'old', deleted = null) {
  const events = new Map();
  const state = {library, activeId, deleted, message:'', now};
  const storage = new Map();
  const document = {visibilityState:'visible', addEventListener:(name, handler) => events.set(name, handler), removeEventListener:name => events.delete(name)};
  const window = {setTimeout:(callback, delay) => {state.timer = {callback, delay}; return 1;}, clearTimeout:() => {state.timer = null;}, addEventListener:(name, handler) => events.set(name, handler), removeEventListener:name => events.delete(name)};
  const clock = {now:() => state.now};
  const keep = entries => retainRecentEstimates(entries, state.now);
  const expired = entry => isEstimateExpired(entry, state.now);
  const dispose = run(true, library, activeId, deleted, {setItem:(key, value) => storage.set(key,value)}, window, document, value => {state.library=value;}, value => {state.activeId=value;}, value => {state.deleted=value;}, value => {state.message=value;}, estimateExpiresAt, expired, keep, 'library', clock);
  return {state, storage, events, document, dispose};
}

const deadline = created + ESTIMATE_LIFETIME_MS;
const open = harness(deadline - 1000, [old, recent]);
assert.equal(open.state.timer.delay, 1000);
assert.equal(open.storage.size, 0);
open.state.now = deadline;
open.state.timer.callback();
assert.deepEqual(open.state.library, [recent]);
assert.deepEqual(JSON.parse(open.storage.get('library')), [recent]);
assert.equal(open.state.activeId, null);
assert.match(open.state.message, /72/);
open.dispose();
assert.equal(open.events.size, 0);
assert.equal(open.state.timer, null);

const resumed = harness(deadline - 1000, [old, recent]);
resumed.state.now = deadline + 1;
resumed.document.visibilityState = 'hidden';
resumed.events.get('visibilitychange')();
assert.equal(resumed.state.library.length, 2);
resumed.document.visibilityState = 'visible';
resumed.events.get('visibilitychange')();
assert.deepEqual(resumed.state.library, [recent]);
resumed.dispose();

const alreadyExpired = harness(deadline, [old, recent]);
assert.deepEqual(alreadyExpired.state.library, [recent]);
alreadyExpired.dispose();
const undo = harness(deadline - 1000, [recent], null, old);
assert.equal(undo.state.timer.delay, 1000);
undo.state.now = deadline;
undo.state.timer.callback();
assert.equal(undo.state.deleted, null);
undo.dispose();
console.log('PASS: live expiry timer, durable storage cleanup, active snapshot unlink, visibility resume, expired-on-mount cleanup, undo expiry and listener disposal');
