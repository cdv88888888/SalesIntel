import test from 'node:test';
import assert from 'node:assert/strict';
import { assessCadence, medianGapDays, sortByVolume, assessAccounts } from '../cadence.js';

const TODAY = '2026-11-10';
const addDays = (iso, n) => new Date(Date.parse(iso) + n * 86400000).toISOString().slice(0, 10);
const daysAgo = n => addDays(TODAY, -n);
// Orders every `gap` days, the last one `d` days ago, `count` orders in total.
const series = (gap, d, count) => Array.from({ length: count }, (_, i) => daysAgo(d + gap * (count - 1 - i)));
const flat = (dates, kg = 100) => Object.fromEntries(dates.map(x => [x, kg]));
const run = (dates, kgByDate = flat(dates)) => assessCadence({ orderDates: dates, kgByDate, today: TODAY });

test('median gap: odd number of gaps', () => {
  // gaps 5, 10, 30 -> 10
  assert.equal(medianGapDays(['2026-01-01', '2026-01-06', '2026-01-16', '2026-02-15']), 10);
});

test('median gap: even number of gaps averages the middle two', () => {
  // gaps 10, 20 -> 15
  assert.equal(medianGapDays(['2026-01-01', '2026-01-11', '2026-01-31']), 15);
});

test('median gap: unsorted input and duplicate dates', () => {
  assert.equal(medianGapDays(['2026-01-11', '2026-01-01', '2026-01-01', '2026-01-21']), 10);
  assert.equal(medianGapDays(['2026-01-01']), null);
});

test('NEW with 2 orders: no x, no dates', () => {
  const r = run(series(10, 5, 2));
  assert.equal(r.status, 'NEW');
  assert.equal(r.x, null);
  assert.equal(r.orderCount, 2);
  assert.equal(r.dueDate, null);
  assert.equal(r.atRiskDate, null);
  assert.equal(r.d, 5);
});

test('NEW with no orders at all', () => {
  const r = run([]);
  assert.equal(r.status, 'NEW');
  assert.equal(r.lastOrderDate, null);
  assert.equal(r.d, null);
});

test('3 orders is enough for a status', () => {
  assert.equal(run(series(10, 0, 3)).status, 'HEALTHY');
});

// x = 10: Proactive from day 8, At Risk from day 12, Lost from day 40.
test('boundary: one day before ceil(0.8x) is HEALTHY, exactly at it PROACTIVE', () => {
  assert.equal(run(series(10, 7, 4)).status, 'HEALTHY');
  assert.equal(run(series(10, 8, 4)).status, 'PROACTIVE');
});

test('boundary: just below 1.2x is PROACTIVE, exactly at it AT_RISK', () => {
  assert.equal(run(series(10, 11, 4)).status, 'PROACTIVE');
  assert.equal(run(series(10, 12, 4)).status, 'AT_RISK');
});

test('boundary: just below 4x is AT_RISK, exactly at it LOST', () => {
  assert.equal(run(series(10, 39, 4)).status, 'AT_RISK');
  assert.equal(run(series(10, 40, 4)).status, 'LOST');
});

test('boundary with fractional x (x = 7.5): ceil(0.8x)=6, 1.2x=9, 4x=30', () => {
  // gaps 5, 10 -> x = 7.5
  const at = d => run([daysAgo(d + 15), daysAgo(d + 10), daysAgo(d)]);
  assert.equal(at(0).x, 7.5);
  assert.equal(at(5).status, 'HEALTHY');
  assert.equal(at(6).status, 'PROACTIVE');
  assert.equal(at(8).status, 'PROACTIVE');
  assert.equal(at(9).status, 'AT_RISK');
  assert.equal(at(29).status, 'AT_RISK');
  assert.equal(at(30).status, 'LOST');
});

test('dueDate and atRiskDate come from the last order', () => {
  const dates = series(10, 3, 4);
  const r = run(dates);
  assert.equal(r.dueDate, addDays(daysAgo(3), 8));
  assert.equal(r.atRiskDate, addDays(daysAgo(3), 12));
  assert.equal(r.lastOrderDate, daysAgo(3));
});

test('several transactions on one day count as one order', () => {
  // Two orders on distinct days plus a third day listed three times.
  const dates = [daysAgo(20), daysAgo(10), daysAgo(0), daysAgo(0), daysAgo(0)];
  const r = run(dates, { [daysAgo(20)]: 100, [daysAgo(10)]: 100, [daysAgo(0)]: 300 });
  assert.equal(r.orderCount, 3);
  assert.equal(r.x, 10);
  assert.equal(r.avgKgPerOrder, 500 / 3);
  // Only 2 distinct days => NEW
  assert.equal(run([daysAgo(10), daysAgo(0), daysAgo(0), daysAgo(0)]).status, 'NEW');
});

test('declining: true when recent avg is under 80% of the 24-month avg', () => {
  // 9 old orders of 100 kg, 1 recent order of 20 kg: window avg 92, recent 20.
  const old = Array.from({ length: 9 }, (_, i) => daysAgo(400 - i * 10));
  const recent = daysAgo(10);
  const kg = { ...flat(old, 100), [recent]: 20 };
  const r = run([...old, recent], kg);
  assert.equal(r.declining, true);
  assert.equal(r.recentAvgKgPerOrder, 20);
});

test('declining: false when recent avg is at or above 80% of the window avg', () => {
  // recent avg well under the window avg -> declining
  const old = [daysAgo(300), daysAgo(200), daysAgo(150), daysAgo(120)];
  const recent = [daysAgo(30), daysAgo(10)];
  const kg = { ...flat(old, 110), ...flat(recent, 70) };
  assert.equal(run([...old, ...recent], kg).declining, true);
  const kg2 = { ...flat(old, 100), ...flat(recent, 100) };
  assert.equal(run([...old, ...recent], kg2).declining, false);
  // exactly 80%: orders 80,80 recent vs overall avg 100 => 4 old at 110 + 2 at 80 = 600/6 = 100
  const kg3 = { ...flat(old, 110), ...flat(recent, 80) };
  assert.equal(run([...old, ...recent], kg3).declining, false);
});

test('declining: false when there are no orders in the last 3 months', () => {
  const dates = series(30, 120, 4); // last order 120 days ago
  const r = run(dates, flat(dates, 100));
  assert.equal(r.recentAvgKgPerOrder, null);
  assert.equal(r.declining, false);
});

test('declining is independent of status', () => {
  const dates = [daysAgo(500), daysAgo(400), daysAgo(300), daysAgo(200), daysAgo(1)];
  const r = run(dates, { ...flat(dates, 100), [daysAgo(1)]: 10 });
  assert.equal(r.status, 'HEALTHY');
  assert.equal(r.declining, true);
});

test('24-month window excludes older orders', () => {
  // 3 old orders (more than 24 months back) and 2 recent: only 2 count => NEW.
  const old = [daysAgo(900), daysAgo(880), daysAgo(860)];
  const recent = [daysAgo(20), daysAgo(10)];
  const r = run([...old, ...recent]);
  assert.equal(r.orderCount, 2);
  assert.equal(r.status, 'NEW');
  // An order exactly 24 months ago is inside the window; a day earlier is out.
  assert.equal(run(['2024-11-10', '2025-06-01', '2026-06-01']).orderCount, 3);
  assert.equal(run(['2024-11-09', '2025-06-01', '2026-06-01']).orderCount, 2);
});

test('old orders do not affect x', () => {
  const old = [daysAgo(1000), daysAgo(990)];
  const r = run([...old, ...series(10, 0, 3)]);
  assert.equal(r.x, 10);
});

test('sortByVolume: biggest average kg per order first, input untouched', () => {
  const input = [{ id: 'a', avgKgPerOrder: 10 }, { id: 'b', avgKgPerOrder: 300 }, { id: 'c', avgKgPerOrder: 50 }];
  assert.deepEqual(sortByVolume(input).map(a => a.id), ['b', 'c', 'a']);
  assert.deepEqual(input.map(a => a.id), ['a', 'b', 'c']);
});

test('assessAccounts groups rows per account and sorts by volume', () => {
  const rows = [];
  for (const d of series(10, 0, 3)) rows.push({ id: 'small', name: 'Small', classification: 'A', date: d, kg: 50 });
  for (const d of series(10, 0, 3)) rows.push({ id: 'big', name: 'Big', classification: 'B', date: { value: d }, kg: 500 });
  const out = assessAccounts(rows, TODAY);
  assert.deepEqual(out.map(a => a.id), ['big', 'small']);
  assert.equal(out[0].orders.length, 3);
  assert.equal(out[0].cadence.status, 'HEALTHY');
});
