import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { deriveFenceUnitPrice } from '../lib/target-fence-price.mjs';

// Exercise the actual component calculation, including all shared add-ons.
const source = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('const materials ='), source.indexOf('export default function Home'));
const calculation = source.split('const quote = useMemo(() => {')[1].split('}, [s]);')[0];
const context = vm.createContext({ deriveFenceUnitPrice });
vm.runInContext(ts.transpileModule(helpers + '\nfunction calculate(s: State) {' + calculation + '\n}', { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context);
const run = expression => JSON.parse(JSON.stringify(vm.runInContext(expression, context)));
const input = "{ ...initial, length: 40, extraSections: [{ id: 'second', material: 'picket_single', height: '1.8', length: 30, fencePrice: '' }] }";
const mixed = run('calculate(' + input + ')');
assert.equal(mixed.list[0].amount, 84000);
assert.equal(mixed.list[1].amount, 64500);
assert.match(mixed.list[1].title, /1,8/);
assert.equal(mixed.list.filter(item => item.title === 'Доставка').length, 1);
assert.equal(mixed.list.at(-1).amount, 8000);
assert.equal(mixed.total, 186500);
assert.equal(run('calculate({ ...' + input + ", mode: 'fence' })").total, 156500);
assert.equal(run('calculate({ ...' + input + ", deliveryPrice: 7000 })").total, 185500);
const target = run('calculate({ ...' + input + ", targetTotal: 200000, targetSection: 'second' })");
assert.equal(target.total, 200000);
assert.equal(target.list[0].amount, 84000);
assert.equal(target.list[1].amount, 78000);
assert.equal(target.list[1].unitPrice, 2600);
assert.equal(run('calculate({ ...' + input + ", targetTotal: 200000, targetSection: 'first' })").total, 200000);
assert.ok(run('calculate({ ...' + input + ", targetTotal: 10000 })").targetError);
assert.equal(run('calculate({ ...initial, length: 70 })').total, 185000);
assert.equal(run("calculate({ ...initial, length: 40, extraSections: [{ id: 'second', material: 'picket_single', height: '2', length: 90, fencePrice: 3000 }] })").list.at(-1).amount, 12000);
console.log('PASS: multiple materials, heights, delivery tiers, manual prices, target totals, legacy single section');

for (const [width, expected] of [['4', 100000], ['5', 110000]]) {
  const options = "{ ...initial, slidingEnabled: true, slidingAutomation: true, slidingWidth: '" + width + "', slidingCount: 2 }";
  const quote = run('calculate(' + options + ')');
  const gates = quote.list.find(item => item.title.startsWith('Откатные'));
  assert.equal(gates.unitPrice, expected);
  assert.equal(gates.amount, expected * 2);
  assert.match(gates.title, /RTech 1000/);
  assert.match(gates.details.join(' '), /2 пульта, сигнальная лампа/);
  assert.match(gates.details.join(' '), /длина 2 м/);
  assert.equal(run('fixedTotalFor(' + options + ')'), quote.total - quote.list[0].amount);
  const target = run('calculate({ ...' + options + ', targetTotal: 500000 })');
  assert.equal(target.total, 500000);
  assert.equal(target.list.find(item => item.title.startsWith('Откатные')).amount, expected * 2);
}
assert.equal(run("slidingUnitFor({ ...initial, slidingAutomation: false, slidingWidth: '4' })"), 69000);
assert.equal(run("slidingUnitFor({ ...initial, slidingAutomation: false, slidingWidth: '5' })"), 75000);
assert.equal(run("slidingUnitFor({ ...initial, slidingAutomation: true, slidingWidth: '4.5' })"), null);
assert.equal(run("slidingUnitFor({ ...initial, slidingAutomation: true, slidingWidth: '4.5', slidingPrice: 105000 })"), 105000);
assert.equal(run("calculate({ ...initial, slidingEnabled: false, slidingAutomation: true })").total, run('calculate(initial)').total);
console.log('PASS: automated sliding gates, quantities, description, manual prices and target totals');

const trimQuote = run('calculate({ ...initial, pTrim: 20 })');
const trim = trimQuote.list.find(item => item.title === 'Декоративная П-планка');
assert.equal(trim.quantity, 20);
assert.equal(trim.unitPrice, 250);
assert.equal(trim.amount, 5000);
assert.equal(trimQuote.total, run('calculate(initial)').total + 5000);
assert.equal(run('fixedTotalFor({ ...initial, pTrim: 20 })'), trimQuote.total - trimQuote.list[0].amount);
assert.equal(run('calculate({ ...initial, pTrim: 20, targetTotal: 200000 })').total, 200000);
assert.equal(run('calculate({ ...initial, pTrim: 2.5 })').list.find(item => item.title === 'Декоративная П-планка').amount, 625);
assert.ok(!run('calculate(initial)').list.some(item => item.title === 'Декоративная П-планка'));
console.log('PASS: P-trim quantity, fractional metres, total and target-total calculation');
