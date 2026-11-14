'use strict';
const assert = require('node:assert/strict');
const P = require('./dist/engine.js');
const D = require('./dist/dialogues.js');
const N = require('./dist/npcs.js');
let count = 0;
function test(name, fn) { fn(); count++; console.log('PASS ' + name); }
function npc(type, options = {}) {
  return { id: 'npc-' + Math.random().toString(36).slice(2), type, label: type, colors: ['blue'], round: 1,
    status: 'available', scaled: false, stage: 1, chain: 'rocket', values: null, ...options };
}
test('original three-color battle A/B/C totals; no double multiplier', () => {
  const s = P.defaults(), n = npc('battle3', { colors: ['red', 'blue', 'yellow'] });
  for (const [boost, each, total] of [['A', 140, 420], ['B', 112, 336], ['C', 84, 252]]) {
    s.boost = boost; const r = P.reward(s, n); assert.equal(r.gain.red, each); assert.equal(P.sum(r.gain), total);
  }
});
test('Kukui A315/B252/C189 and fixed Blue400 per color', () => {
  const s = P.defaults();
  for (const [b, n] of [['A', 315], ['B', 252], ['C', 189]]) { s.boost = b; assert.equal(P.reward(s, npc('kukui')).gain.blue, n); assert.deepEqual(P.reward(s, npc('blue')).gain, P.vector(400)); }
});
test('story rewards unaffected by boost, including minimum1.7', () => {
  const s = P.defaults(); s.boost = 'D';
  assert.equal(P.reward(s, npc('story1')).gain.blue, 300);
  assert.equal(P.sum(P.reward(s, npc('story3', { colors: ['red', 'green', 'blue'] })).gain), 420);
});
test('author fixed-reward example reconciles each color and gap', () => {
  const s = P.defaults();
  for (const [i, type] of ['kukui', 'blue', 'midterm', 'final'].entries()) { s.round = i + 1; const n = npc(type, { round: i + 1 }); s.candidates.push(n); P.claim(s, n.id); }
  assert.deepEqual(s.stock, { red: 700, green: 700, blue: 1015, yellow: 850 });
  assert.deepEqual(P.totals(s).gap, { red: 740, green: 140, blue: 785, yellow: 570 });
  P.validate(s);
});
test('confirmed special stages210/420/630; future1260 not booked', () => {
  const s = P.defaults(), n = npc('special');
  assert.equal(P.reward(s, n).gain.blue, 210); assert.equal(P.sum(P.specialRemainder(s, n)), 1260);
  assert.equal(P.reward(s, { ...n, stage: 2 }).gain.blue, 420); assert.equal(P.reward(s, { ...n, stage: 3 }).gain.blue, 630);
  assert.equal(P.reward(s, { ...n, chain: 'wally', colors: ['red'] }).gain.red, 210);
  assert.equal(P.sum(s.stock), 0);
});
test('useful gain caps each color; unavailable and unknown excluded', () => {
  const s = P.defaults(); s.target = { red: 50, green: 0, blue: 500, yellow: 0 };
  const red = npc('story1', { colors: ['red'] }), blue = npc('custom', { values: { red: 0, green: 0, blue: 200, yellow: 0 } });
  s.candidates.push(red, blue, npc('blue', { status: 'seen' }), npc('custom'));
  assert.equal(P.rank(s)[0].npc.id, blue.id); assert.equal(P.rank(s).length, 2); assert.equal(P.evaluate(s, red).useful, 50);
});
test('tied usefulness prefers less overflow and zero targets never divide', () => {
  const s = P.defaults(); s.target = { ...P.vector(), red: 50 };
  s.candidates.push(npc('story1', { colors: ['red'] }), npc('custom', { values: { ...P.vector(), red: 50 } }));
  assert.equal(P.rank(s)[0].waste, 0); s.stock.red = 100; assert.equal(P.totals(s).gap.red, 0); assert.equal(P.totals(s).surplus.red, 50);
});
test('one claim per round, duplicate claim blocked, historical values frozen', () => {
  const s = P.defaults(), n = npc('kukui'); s.candidates.push(n, npc('story1')); P.claim(s, n.id);
  assert.throws(() => P.claim(s, n.id)); assert.throws(() => P.claim(s, s.candidates[1].id));
  assert.equal(P.rank(s).length, 0);
  s.boost = 'C'; s.rules.kukui = 100; assert.equal(s.stock.blue, 315); assert.equal(s.ledger[0].gain.blue, 315);
  P.validate(s); P.undo(s); assert.equal(s.stock.blue, 0); assert.equal(n.status, 'available');
});
test('calibration authoritative; undo calibration then reward restores stock', () => {
  const s = P.defaults(), n = npc('kukui'); s.candidates.push(n); P.claim(s, n.id);
  P.calibrate(s, { ...P.vector(), blue: 50 }); assert.equal(P.totals(s).current.blue, 50); P.validate(s);
  P.undo(s); assert.equal(s.stock.blue, 315); P.undo(s); assert.equal(s.stock.blue, 0); P.validate(s);
});
test('round-scoped recommendations and claim prevent future choices', () => {
  const s = P.defaults(), n = npc('blue', { round: 2 }); s.candidates.push(n);
  assert.equal(P.rank(s).length, 0); assert.throws(() => P.claim(s, n.id)); s.round = 2; assert.equal(P.rank(s).length, 1);
});
test('principal may reappear after skipping; claimed fixed reward cannot repeat', () => {
  const s = P.defaults(), first = npc('principal', { status: 'skipped' }), second = npc('principal', { round: 2 });
  s.candidates.push(first, second); P.validate(s); s.round = 2; P.claim(s, second.id); P.validate(s);
  const third = npc('principal', { round: 3 }); s.candidates.push(third); s.round = 3; assert.throws(() => P.claim(s, third.id));
});
test('rounding per color; fractional values stable', () => {
  const s = P.defaults(), n = npc('battle3', { colors: ['red', 'blue', 'yellow'] }); s.boost = 'custom'; s.customMultiplier = 2.1;
  assert.equal(P.reward(s, n).gain.red, 84); s.rules.battleBase = 1; s.rules.rounding = 'ceil'; assert.equal(P.reward(s, n).gain.red, 3);
  s.rules.rounding = 'floor'; assert.equal(P.reward(s, n).gain.red, 3);
});
test('unknown manual or battle rewards cannot be claimed', () => {
  const s = P.defaults(), n = npc('custom'); s.candidates.push(n); assert.throws(() => P.claim(s, n.id));
  s.rules.battleBase = null; assert.equal(P.reward(s, npc('battle3', { colors: ['red', 'blue', 'yellow'] })).known, false);
});
test('import rejects invalid numeric, shape, duplicate id, broken snapshot chain', () => {
  for (const mutate of [s => { s.stock.red = -1; }, s => { s.rules.boosts.A = Infinity; }, s => { s.rules.special.rocket = [60]; }, s => { s.round = 13; }, s => { const n = npc('blue'); s.candidates.push(n, { ...n }); }]) {
    const s = P.defaults(); mutate(s); assert.throws(() => P.validate(s));
  }
  const s = P.defaults(), n = npc('kukui'); s.candidates.push(n); P.claim(s, n.id); s.stock.blue = 1; assert.throws(() => P.validate(s));
});
test('export/import roundtrip preserves rules, stock, history and unresolved values', () => {
  const s = P.defaults(), n = npc('special'); s.candidates.push(n); P.claim(s, n.id); s.rules.special.wally[0] = 70;
  assert.deepEqual(P.validate(JSON.parse(JSON.stringify(s))), s);
});
test('confirmation books once, advances one round, undo returns to receipt round', () => {
  const s = P.defaults(), n = npc('kukui'); s.candidates.push(n);
  P.claim(s, n.id); assert.equal(s.stock.blue, 315); assert.equal(s.round, 2);
  assert.equal(s.ledger[0].roundBefore, 1); assert.equal(s.ledger[0].roundAfter, 2);
  const saved = structuredClone(s); assert.throws(() => P.claim(s, n.id)); assert.deepEqual(s, saved);
  s.round = 8; P.undo(s); assert.equal(s.stock.blue, 0); assert.equal(s.round, 1); assert.equal(n.status, 'available');
});
test('twelfth round ends at12; undo reopens same round', () => {
  const s = P.defaults(), n = npc('final', { round: 12 }); s.round = 12; s.candidates.push(n);
  P.claim(s, n.id); assert.equal(s.round, 12); assert.equal(n.status, 'claimed'); P.validate(s);
  assert.throws(() => P.claim(s, n.id)); P.undo(s); assert.equal(s.round, 12); assert.equal(n.status, 'available'); assert.equal(P.sum(s.stock), 0);
});
test('undoing calibration does not rewind round; undoing confirmation does', () => {
  const s = P.defaults(), n = npc('kukui'); s.candidates.push(n); P.claim(s, n.id);
  P.calibrate(s, { ...P.vector(), blue: 50 }); P.undo(s); assert.equal(s.round, 2); assert.equal(s.stock.blue, 315);
  P.undo(s); assert.equal(s.round, 1); assert.equal(s.stock.blue, 0);
});
test('old records without round snapshot still import and undo correctly', () => {
  const s = P.defaults(), n = npc('kukui'); s.candidates.push(n); P.claim(s, n.id);
  delete s.ledger[0].roundBefore; delete s.ledger[0].roundAfter; s.round = 5;
  const imported = P.validate(JSON.parse(JSON.stringify(s))); P.undo(imported); assert.equal(imported.round, 1); assert.equal(imported.stock.blue, 0);
});
test('round snapshots validate pairs and reject impossible progression', () => {
  for (const edit of [row => { delete row.roundAfter; }, row => { row.roundBefore = 0; }, row => { row.roundBefore = 2; }, row => { row.roundAfter = 13; }, row => { row.roundAfter = 3; }]) {
    const s = P.defaults(), n = npc('kukui'); s.candidates.push(n); P.claim(s, n.id); edit(s.ledger[0]); assert.throws(() => P.validate(s));
  }
});
test('dialogue reference covers8 events and4 rest groups with valid local data', () => {
  assert.equal(D.events.length, 12); assert.equal(new Set(D.events.map(e => e.id)).size, 12);
  for (const event of [...D.events, D.oak]) {
    assert.ok(event.name && event.title && event.when && event.note);
    assert.ok(event.rounds.every(r => Number.isInteger(r) && r >= 3 && r <= 11 && r !== 6));
    assert.ok(event.choices.length && event.choices.every(pair => pair.length === 2 && pair.every(v => typeof v === 'string' && v.length)));
  }
});
test('dialogue filtering excludes early/exam rounds and showall reveals catalogue', () => {
  for (const round of [1, 2, 6, 12]) assert.equal(D.forRound(round).length, 0);
  assert.equal(D.forRound(3).length, 9); assert.equal(D.forRound(7).length, 12);
  assert.equal(D.forRound(1, true).length, 12);
  assert.equal(D.forRound(3).some(e => e.id === 'n'), false);
});
test('reference preserves box colors and random single versus simultaneous four', () => {
  const box = D.events.find(e => e.id === 'sycamore');
  assert.deepEqual(box.choices[1], ['红色箱子', '黄色随机150／300／450／600']);
  assert.equal(D.events.find(e => e.id === 'n').choices[0][1], '红色随机150／300／450／600');
  assert.match(D.events.find(e => e.id === 'ball-guy').choices[0][1], /随机一种，420/);
  assert.match(D.oak.choices[0][1], /四色同时各30，或四色同时各400/);
});
test('reference choices do not create known rewards until actual values are entered', () => {
  const s = P.defaults(), n = npc('dialogue', { label: '越橘 · 正面？反面？', round: 3 });
  s.round = 3; s.candidates.push(n); const before = structuredClone(s);
  assert.equal(P.rank(s).length, 0); assert.throws(() => P.claim(s, n.id)); assert.deepEqual(s, before);
  n.values = { ...P.vector(), yellow: 450 }; assert.equal(P.rank(s)[0].gain.yellow, 450);
  P.claim(s, n.id); assert.equal(s.stock.yellow, 450); assert.equal(s.round, 4); P.validate(s);
});
test('reference does not prohibit actual results outside the old table', () => {
  const s = P.defaults(), n = npc('dialogue', { values: { ...P.vector(), blue: 37 } });
  s.candidates.push(n); P.claim(s, n.id); assert.equal(s.stock.blue, 37); P.validate(s);
});
test('catalogue contains only five common stories, with correct rounds', () => {
  assert.equal(N.events.length, 5); assert.ok(N.events.every(e => e.kind === 'story' && e.period === '通用'));
  assert.deepEqual(N.events.map(e => e.name), ['婉龙', '赤焰松', '嘉德丽雅', '查克洛', '克拉拉']);
  assert.equal(new Set(N.events.map(e => e.id)).size, 5);
  for (const e of N.events) { assert.ok(e.name && e.title && e.place); assert.ok(e.rounds.every(r => r >= 3 && r <= 11 && r !== 6)); assert.equal(e.base, 300); }
  assert.equal(N.forRound('story', 3).length, 2); assert.equal(N.forRound('story', 8).length, 3);
  for (const r of [1, 2, 6, 12]) assert.equal(N.forRound('story', r).length, 0);
  assert.equal(N.forRound('story', 1, true).length, 5);
  assert.deepEqual(new Set(D.events.map(e => e.id)), new Set(['ball-guy','grimsley','brock','iono','lance','gloria','n','sycamore','break1','break2','break3','break4']));
});
test('ordinary battles use three groups, keeping both single-color tiers', () => {
  assert.deepEqual(N.battles.map(b => b.id), ['single', 'double', 'triple']);
  assert.deepEqual(N.battles.map(b => b.amounts), [[30, 60], [45], [40]]);
  const s = P.defaults();
  for (const b of N.battles) for (const amount of b.amounts) {
    const values = P.vector(); for (const c of P.colors.slice(0, b.count)) values[c] = amount;
    const r = P.reward(s, npc('battle', { values, scaled: true }));
    assert.equal(P.sum(r.gain), Math.ceil(amount * 3.5) * b.count);
  }
  for (const e of N.events) assert.equal(P.sum(P.reward(s, npc('story', { values: { ...P.vector(), [e.colors[0]]: e.base } })).gain), 300);
});
test('random outcome lists are finite, keep color models, and have no guessed probabilities', () => {
  assert.deepEqual(D.outcomes('gloria'), [{ red: 0, green: 0, blue: 30, yellow: 0 }, { red: 0, green: 0, blue: 450, yellow: 0 }]);
  assert.equal(D.outcomes('brock').length, 24); assert.equal(D.outcomes('n').length, 8); assert.equal(D.outcomes('sycamore').length, 8);
  assert.equal(D.outcomes('ball-guy').length, 4); assert.deepEqual(D.outcomes('oak'), [P.vector(30), P.vector(400)]);
  assert.deepEqual(D.outcomes('not-listed'), []);
});
test('only confirmed choice enters saved state; undo removes it and restores round', () => {
  const s = P.defaults(), draft = npc('battle', { values: { red: 40, green: 0, blue: 40, yellow: 40 }, scaled: true });
  assert.equal(s.candidates.length, 0); P.recordChoice(s, draft);
  assert.equal(s.candidates.length, 1); assert.equal(s.candidates[0].status, 'claimed'); assert.equal(s.ledger.length, 1); assert.equal(s.round, 2);
  assert.deepEqual(s.stock, { red: 140, green: 0, blue: 140, yellow: 140 });
  P.undo(s); assert.equal(s.candidates.length, 0); assert.equal(s.round, 1); assert.equal(P.sum(s.stock), 0);
});
test('failed or duplicate confirmation leaves all data unchanged', () => {
  const s = P.defaults(), unknown = npc('dialogue'), initial = structuredClone(s);
  assert.throws(() => P.recordChoice(s, unknown)); assert.deepEqual(s, initial);
  const known = npc('dialogue', { values: D.outcomes('gloria')[1] }); P.recordChoice(s, known); const after = structuredClone(s);
  assert.throws(() => P.recordChoice(s, known)); assert.deepEqual(s, after);
});
test('exam rounds are exclusive, highest bases multiply only the exam bonus', () => {
  const s = P.defaults(); s.round = 6; const before = structuredClone(s);
  assert.throws(() => P.recordChoice(s, npc('battle', { values: P.vector(40), scaled: true }))); assert.deepEqual(s, before);
  assert.equal(P.reward(s, npc('midterm')).gain.yellow, 450); s.boost = 'C'; assert.equal(P.reward(s, npc('midterm')).gain.yellow, 450);
  s.examMultiplier = 2; P.recordChoice(s, npc('midterm')); assert.equal(s.stock.yellow, 450); assert.equal(s.round, 7);
  const nonExam = structuredClone(s); assert.throws(() => P.recordChoice(s, npc('final'))); assert.deepEqual(s, nonExam);
  s.round = 12; P.recordChoice(s, npc('final')); assert.deepEqual(s.stock, { red: 300, green: 300, blue: 300, yellow: 450 }); assert.equal(s.round, 12);
});
test('failed exam still advances without granting resources', () => {
  const s = P.defaults(); s.round = 6; P.recordChoice(s, npc('midterm', { examPassed: false })); assert.equal(s.round, 7); assert.equal(P.sum(s.stock), 0); P.undo(s); assert.equal(s.round, 6);
});
test('old rules upgrade without recalculating actual inventory or old receipt snapshots', () => {
  const old = P.defaults(); delete old.ruleRevision; delete old.examMultiplier;
  old.rules.midterm = 450; old.rules.final = 300; old.rules.scaled.midterm = false; old.rules.scaled.final = false; old.rules.special.wally = [null, null, null];
  old.round = 6; const n = npc('midterm', { round: 6 }); old.candidates.push(n); P.claim(old, n.id);
  const receipts = structuredClone(old.ledger), stock = structuredClone(old.stock), upgraded = P.upgrade(JSON.parse(JSON.stringify(old)));
  assert.deepEqual(upgraded.ledger, receipts); assert.deepEqual(upgraded.stock, stock); assert.equal(upgraded.rules.midterm, 300); assert.equal(upgraded.rules.final, 200); assert.equal(upgraded.examMultiplier, 1.5);
  assert.equal(upgraded.ruleRevision, 2); assert.deepEqual(upgraded.rules.special.wally, [60, 120, 180]); P.validate(upgraded);
});
test('special stages advance on confirmation independently and undo restores stage', () => {
  const s = P.defaults(); s.round = 2;
  s.candidates.push(npc('special', { status: 'seen', round: 2 }));
  assert.equal(P.nextStage(s, 'rocket'), 1);
  P.recordChoice(s, npc('special', { stage: 3 }));
  assert.equal(s.candidates.at(-1).stage, 1); assert.equal(s.stock.blue, 210);
  assert.equal(P.nextStage(s, 'rocket'), 2); assert.equal(P.nextStage(s, 'wally'), 1);
  P.recordChoice(s, npc('special', { chain: 'wally' })); assert.equal(s.stock.red, 210);
  P.recordChoice(s, npc('special')); assert.equal(s.candidates.at(-1).stage, 2); assert.equal(s.stock.blue, 630);
  const saved = P.upgrade(JSON.parse(JSON.stringify(s))); assert.equal(P.nextStage(saved, 'rocket'), 3);
  P.undo(saved); assert.equal(P.nextStage(saved, 'rocket'), 2); assert.equal(saved.stock.blue, 210); assert.equal(saved.round, 4); P.validate(saved);
});
test('castle has four automatic stages, changing colors and refusing a fifth claim', () => {
  const s = P.defaults(); s.round = 2;
  for (let stage = 1; stage <= 4; stage++) {
    assert.equal(P.nextStage(s, 'castle'), stage); P.recordChoice(s, npc('special', { chain: 'castle' }));
    const row = s.ledger.at(-1); assert.equal(P.sum(row.gain), 3 * 20 * stage * 3.5);
    assert.deepEqual(P.colors.filter(c => row.gain[c]), P.specialDefs.castle.colors[stage - 1]);
  }
  assert.equal(P.nextStage(s, 'castle'), 5); s.round = 7; const before = structuredClone(s);
  assert.throws(() => P.recordChoice(s, npc('special', { chain: 'castle' }))); assert.deepEqual(s, before);
  P.undo(s); assert.equal(P.nextStage(s, 'castle'), 4); P.validate(s);
  const legacy = P.defaults();
  P.recordChoice(legacy, npc('battle', { label: '夕丝 · 对战女城主活动', values: { ...P.vector(), red: 20, green: 20, blue: 20 }, scaled: true }));
  assert.equal(P.nextStage(legacy, 'castle'), 2);
});
test('three-stage chains complete at three without sharing advancement', () => {
  for (const chain of ['rocket', 'wally', 'nemona', 'leon']) {
    const s = P.defaults(); s.round = 2;
    for (let stage = 1; stage <= 3; stage++) P.recordChoice(s, npc('special', { chain }));
    assert.equal(P.nextStage(s, chain), 4); const before = structuredClone(s);
    assert.throws(() => P.recordChoice(s, npc('special', { chain }))); assert.deepEqual(s, before);
    for (const other of Object.keys(P.specialDefs).filter(c => c !== chain)) assert.equal(P.nextStage(s, other), 1);
  }
});
test('silver is fixed one from teachers and passed midterm, never scaled', () => {
  const s = P.defaults(); s.boost = 'custom'; s.customMultiplier = 9.9999; s.examMultiplier = 2;
  for (const type of ['kukui', 'principal', 'midterm']) assert.equal(P.reward(s, npc(type)).tmGain, 1);
  for (const type of ['final', 'blue', 'red', 'dialogue', 'special']) assert.equal(P.reward(s, npc(type)).tmGain, 0);
  assert.equal(P.reward(s, npc('midterm', { examPassed: false })).tmGain, 0);
  P.recordChoice(s, npc('kukui')); assert.equal(s.tmStock, 1); assert.equal(s.ledger[0].tmGain, 1);
  s.round = 6; P.recordChoice(s, npc('midterm')); assert.equal(s.tmStock, 2);
  P.recordChoice(s, npc('principal')); assert.equal(s.tmStock, 3); P.validate(s);
  P.undo(s); assert.equal(s.tmStock, 2); P.validate(s);
});
test('silver progress stays separate from inventory calibration and four-color totals', () => {
  const s = P.defaults(); s.tmTarget = 3;
  const teacher = npc('kukui'), battle = npc('battle3', { colors: ['red', 'blue', 'yellow'] });
  s.candidates.push(battle, teacher); assert.equal(P.rank(s)[0].npc.id, teacher.id);
  assert.equal(P.sum(P.totals(s).gap), 5500); assert.equal(P.totals(s).tm.gap, 3);
  P.calibrate(s, s.stock, undefined, 2); P.validate(s); assert.equal(P.totals(s).tm.gap, 3);
  P.undo(s); assert.equal(s.tmStock, 0); assert.equal(P.sum(s.stock), 0);
  P.claim(s, teacher.id); P.calibrate(s, s.stock, undefined, 7);
  P.undo(s); assert.equal(s.tmStock, 1); P.undo(s); assert.equal(s.tmStock, 0); P.validate(s);
});
test('old records keep receipts, start unrecorded silver at zero and retain stage progress', () => {
  const old = P.defaults(); P.recordChoice(old, npc('kukui')); P.recordChoice(old, npc('special'));
  delete old.tmStock; delete old.tmTarget;
  for (const row of old.ledger) { delete row.tmBefore; delete row.tmAfter; delete row.tmGain; }
  const stock = structuredClone(old.stock), ledger = structuredClone(old.ledger), upgraded = P.upgrade(JSON.parse(JSON.stringify(old)));
  assert.deepEqual(upgraded.stock, stock); assert.deepEqual(upgraded.ledger, ledger);
  assert.equal(upgraded.tmStock, 0); assert.equal(upgraded.tmTarget, 3); assert.equal(P.totals(upgraded).tm.current, 1); assert.equal(P.nextStage(upgraded, 'rocket'), 2);
  P.undo(upgraded); P.undo(upgraded); assert.equal(upgraded.tmStock, 0); P.validate(upgraded);
});
test('silver import rejects bad quantities, broken snapshots and missing paired fields', () => {
  for (const edit of [s => s.tmStock = -1, s => s.tmTarget = 0.5, s => s.tmStock = '1', s => s.tmTarget = null]) {
    const s = P.defaults(); edit(s); assert.throws(() => P.validate(s));
  }
  for (const edit of [s => delete s.ledger[0].tmAfter, s => s.ledger[0].tmGain = 2, s => s.tmStock = 20, s => s.ledger[1].tmBefore = 9]) {
    const s = P.defaults(); P.recordChoice(s, npc('kukui')); P.calibrate(s, s.stock, undefined, 4); edit(s); assert.throws(() => P.validate(s));
  }
  const s = P.defaults(); P.recordChoice(s, npc('kukui')); assert.deepEqual(P.validate(JSON.parse(JSON.stringify(s))), s);
});
test('silver progress is automatic zero through three, survives reload and follows undo', () => {
  const s = P.defaults(); assert.equal(P.totals(s).tm.current, 0); assert.equal(P.totals(s).tm.target, 3);
  P.recordChoice(s, npc('kukui')); assert.equal(P.totals(s).tm.current, 1);
  s.round = 6; P.recordChoice(s, npc('midterm')); assert.equal(P.totals(s).tm.current, 2);
  P.recordChoice(s, npc('principal')); assert.equal(P.totals(s).tm.current, 3);
  P.calibrate(s, s.stock, undefined, 100); assert.equal(P.totals(s).tm.current, 3);
  const loaded = P.upgrade(JSON.parse(JSON.stringify(s))); assert.equal(P.totals(loaded).tm.current, 3);
  P.undo(loaded); assert.equal(P.totals(loaded).tm.current, 3);
  P.undo(loaded); assert.equal(P.totals(loaded).tm.current, 2);
  const failed = P.defaults(); failed.round = 6; P.recordChoice(failed, npc('midterm', { examPassed: false })); assert.equal(P.totals(failed).tm.current, 0);
});
test('tricolor story supports all four combinations at fixed140, with claim and undo', () => {
  for (const excluded of P.colors) for (const boost of ['A', 'B', 'C', 'D', 'custom']) {
    const s = P.defaults(); s.round = 3; s.boost = boost; s.customMultiplier = 8;
    const colors = P.colors.filter(c => c !== excluded), n = npc('story3', { colors, label: '三色剧情' });
    const r = P.reward(s, n); assert.equal(r.factor, 1); assert.equal(r.tmGain, 0); assert.equal(P.sum(r.gain), 420);
    for (const c of P.colors) assert.equal(r.gain[c], c === excluded ? 0 : 140);
    P.recordChoice(s, n); assert.deepEqual(s.stock, r.gain); assert.equal(s.round, 4);
    const restored = P.upgrade(JSON.parse(JSON.stringify(s))); P.undo(restored);
    assert.deepEqual(restored.stock, P.vector()); assert.equal(restored.round, 3);
  }
  const s = P.defaults(); for (const colors of [['red','blue'], P.colors]) {
    assert.throws(() => P.recordChoice(s, npc('story3', { colors }))); assert.equal(s.ledger.length, 0);
  }
});
test('all new rewards ceil per color even when an old rounding preference remains', () => {
  const s = P.defaults(), n = npc('battle', { values: { ...P.vector(), red: 45, blue: 45 }, scaled: true });
  assert.equal(s.rules.rounding, 'ceil');
  assert.equal(Object.is(P.reward(s, n).gain.green, -0), false);
  for (const mode of ['floor', 'round', 'ceil']) {
    s.rules.rounding = mode; s.boost = 'A'; assert.equal(P.reward(s, n).gain.red, 158);
    s.boost = 'C'; assert.equal(P.reward(s, n).gain.blue, 95);
  }
  s.boost = 'custom'; s.customMultiplier = 2.1;
  assert.equal(P.reward(s, npc('battle3', { colors: ['red', 'blue', 'yellow'] })).gain.red, 84);
  s.customMultiplier = 1.0001; assert.equal(P.reward(s, n).gain.red, 46);
  P.recordChoice(s, n); assert.equal(s.ledger[0].rounding, 'ceil');
});
test('exams force1.5 regardless of team and stale exam controls, with automatic midterm silver', () => {
  const s = P.defaults(); s.examMultiplier = 9; s.rules.scaled.midterm = false; s.rules.scaled.final = false;
  for (const boost of ['A', 'B', 'C', 'D', 'custom']) {
    s.boost = boost; s.customMultiplier = 8;
    assert.equal(P.reward(s, npc('midterm')).gain.yellow, 450); assert.equal(P.reward(s, npc('midterm')).factor, 1.5);
    assert.equal(P.reward(s, npc('midterm')).tmGain, 1);
    assert.deepEqual(P.reward(s, npc('final')).gain, { red: 300, green: 300, blue: 300, yellow: 0 });
  }
  s.round = 6; P.recordChoice(s, npc('midterm')); assert.equal(P.totals(s).tm.current, 1); assert.equal(s.ledger[0].factor, 1.5);
});
test('new rounding and fixed exam migration never recalculate old floor receipts or inventory', () => {
  const old = P.defaults();
  P.recordChoice(old, npc('battle', { values: { ...P.vector(), red: 45, blue: 45 }, scaled: true }));
  const row = old.ledger[0]; row.gain.red = row.gain.blue = 157; row.after.red = row.after.blue = 157;
  row.rounding = 'floor'; old.stock.red = old.stock.blue = 157; old.rules.rounding = 'floor'; old.examMultiplier = 2;
  const receipts = structuredClone(old.ledger), stock = structuredClone(old.stock), upgraded = P.upgrade(JSON.parse(JSON.stringify(old)));
  assert.equal(upgraded.rules.rounding, 'ceil'); assert.equal(upgraded.examMultiplier, 1.5);
  assert.deepEqual(upgraded.ledger, receipts); assert.deepEqual(upgraded.stock, stock);
  P.recordChoice(upgraded, npc('battle', { values: { ...P.vector(), red: 45, blue: 45 }, scaled: true }));
  assert.equal(upgraded.ledger[1].gain.red, 158); assert.deepEqual(upgraded.ledger[0], receipts[0]);
  P.undo(upgraded); assert.deepEqual(upgraded.stock, stock); P.validate(upgraded);
});
const Share = require('./dist/share.js');
test('harvest rating uses user-confirmed grid cutoffs from D through S+', () => {
  assert.deepEqual(Share.tiers.map(({ grade, min }) => [grade, min]), [['D', 0], ['C', 500], ['B', 1000], ['A', 2500], ['S', 4000], ['S+', 5000]]);
  assert.equal(Share.rating(0).grade, 'D');
  assert.equal(new Set(Share.tiers.map(t => t.color)).size, Share.tiers.length);
  Share.tiers.forEach((tier, i) => {
    assert.equal(Share.rating(tier.min).grade, tier.grade);
    if (i) assert.equal(Share.rating(tier.min - 1).grade, Share.tiers[i - 1].grade);
  });
  assert.equal(Share.rating(4073).grade, 'S');
  assert.equal(Share.rating(1e10).grade, 'S+');
});
test('share counts frozen claims, excludes calibrated stock and silver from score', () => {
  const s = P.defaults();
  P.calibrate(s, P.vector(10000));
  assert.equal(Share.summary(s).total, 0); assert.equal(Share.summary(s).rounds, 0);
  P.recordChoice(s, npc('kukui')); s.round = 6; P.recordChoice(s, npc('midterm'));
  const result = Share.summary(s);
  assert.deepEqual(result.earned, { red: 0, green: 0, blue: 315, yellow: 450 });
  assert.equal(result.total, 765); assert.equal(result.silver, 2); assert.equal(result.rounds, 2);
  s.boost = 'D'; P.calibrate(s, P.vector());
  assert.deepEqual(Share.summary(s), result);
  P.undo(s); P.undo(s);
  assert.equal(Share.summary(s).total, 315); assert.equal(Share.summary(s).silver, 1); assert.equal(Share.summary(s).rounds, 1);
});
test('share preserves old claim amounts and recognizes legacy silver receipts', () => {
  const s = P.defaults(); P.recordChoice(s, npc('kukui'));
  delete s.tmStock; delete s.tmTarget;
  delete s.ledger[0].tmGain; delete s.ledger[0].tmBefore; delete s.ledger[0].tmAfter;
  const old = P.upgrade(JSON.parse(JSON.stringify(s)));
  assert.equal(Share.summary(old).silver, 1);
  assert.equal(Share.summary(old).total, 315);
  old.round = 12; P.recordChoice(old, npc('final'));
  assert.equal(Share.summary(old).total, 1215); assert.equal(Share.summary(old).rounds, 2);
});
test('reported4073 harvest ranks S and inventory changes do not turn it into spent-resource scoring', () => {
  const s = P.defaults();
  P.recordChoice(s, npc('custom', { values: { red: 842, green: 832, blue: 1491, yellow: 908 } }));
  const earned = Share.summary(s);
  assert.equal(earned.total, 4073); assert.equal(earned.rating.grade, 'S');
  P.calibrate(s, P.vector()); s.boost = 'D'; s.target = P.vector(1);
  assert.deepEqual(Share.summary(s), earned);
  const loaded = P.upgrade(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(Share.summary(loaded), earned);
  P.undo(loaded); P.undo(loaded);
  assert.equal(Share.summary(loaded).total, 0); assert.equal(Share.summary(loaded).rating.grade, 'D');
});
console.log(`${count} tests passed`);
