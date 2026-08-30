import assert from 'node:assert/strict';
import { deriveFenceUnitPrice } from '../lib/target-fence-price.mjs';

const standard = deriveFenceUnitPrice({ targetTotal: 100000, length: 20, fixedTotal: 17000 + 13000 + 6000 });
assert.deepEqual(standard, { ok: true, unitPrice: 3200, fenceAmount: 64000 });

const manualOverrides = deriveFenceUnitPrice({ targetTotal: 180000, length: 25, fixedTotal: 2 * 25000 + 19000 + 9000 + 2000 });
assert.deepEqual(manualOverrides, { ok: true, unitPrice: 4000, fenceAmount: 100000 });

const onlyFence = deriveFenceUnitPrice({ targetTotal: 80000, length: 20, fixedTotal: 0 });
assert.deepEqual(onlyFence, { ok: true, unitPrice: 4000, fenceAmount: 80000 });

const belowFixed = deriveFenceUnitPrice({ targetTotal: 35000, length: 20, fixedTotal: 36000 });
assert.equal(belowFixed.ok, false);

console.log('PASS: target-total pricing scenarios');
