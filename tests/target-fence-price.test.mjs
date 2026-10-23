import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

const source = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const formatter = source.match(/^const money = (.+);$/m)?.[1];
assert.ok(formatter);
const money = new Function('return ' + formatter.replace('value: number', 'value'))();
const fractional = deriveFenceUnitPrice({ targetTotal: 248000, length: 90, fixedTotal: 8000 });
assert.equal(fractional.ok, true);
assert.equal(fractional.fenceAmount, 240000);
assert.ok(fractional.unitPrice > 2666 && fractional.unitPrice < 2667);
for (const amount of [fractional.unitPrice, 2100, 17.5, 248000.25, 0]) {
  const display = money(amount).replace(/[\s\u00a0\u202f]/g, '');
  assert.equal(display, Math.round(amount) + 'руб.');
}
assert.ok(!source.includes('money(item.unitPrice,'));
console.log('PASS: whole-ruble display including fractional target-derived unit prices; exact quote amounts preserved');
