(function (root) {
  'use strict';
  const colors = ['red', 'green', 'blue', 'yellow'];
  const vector = (n = 0) => Object.fromEntries(colors.map(c => [c, n]));
  const defaults = () => ({
    version: 1, ruleRevision: 2, round: 1, boost: 'A', customMultiplier: 3.5, examMultiplier: 1.5, excludeExamRewards: true,
    stock: vector(), target: { red: 1440, green: 840, blue: 1800, yellow: 1420 }, tmStock: 0, tmTarget: 3,
    rules: { boosts: { A: 3.5, B: 2.8, C: 2.1, D: 1.7 }, rounding: 'ceil',
      battleBase: 40, kukui: 90, principal: 90, blue: 400, story3: 140,
      story1: 300, midterm: 300, final: 200, red: 150,
      special: { rocket: [60, 120, 180], wally: [60, 120, 180], nemona: [60, 120, 180], leon: [60, 120, 180] },
      scaled: { kukui: true, principal: true, blue: false, battle3: true,
        story3: false, story1: false, special: true, midterm: true, final: true, red: true } },
    candidates: [], ledger: []
  });
  const types = ['battle', 'story', 'kukui', 'principal', 'blue', 'battle3', 'story3', 'story1', 'dialogue', 'midterm', 'final', 'red', 'oak', 'special', 'custom'];
  const specialDefs = {
    rocket: { name: '火箭队', colors: [['blue'], ['blue'], ['blue']] },
    wally: { name: '满充', colors: [['red'], ['red'], ['red']] },
    nemona: { name: '妮莫', colors: [['green'], ['green'], ['green']] },
    leon: { name: '丹帝', colors: [['yellow'], ['yellow'], ['yellow']] },
    castle: { name: '对战女城主', colors: [['red', 'green', 'blue'], ['red', 'green', 'yellow'], ['red', 'blue', 'yellow'], ['green', 'blue', 'yellow']], bases: [20, 40, 60, 80], people: ['夕丝', '朝蜜', '菊球', '夜妮'] }
  };
  const chains = Object.keys(specialDefs), stageCount = chain => specialDefs[chain]?.colors.length || 0;
  function nextStage(s, chain) {
    const stages = s.candidates.filter(n => n.status === 'claimed').map(n => {
      if (n.type === 'special' && n.chain === chain) return n.stage;
      if (chain === 'castle' && n.type === 'battle') return [1, 2, 3, 4].find(i => n.label.endsWith(' · 对战女城主活动' + (i === 1 ? '' : i))) || 0;
      return 0;
    });
    return Math.max(0, ...stages) + 1;
  }
  const numeric = (v, max = 1e9, integer = true) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max && (!integer || Number.isInteger(v));
  const multiplier = s => s.boost === 'custom' ? s.customMultiplier : s.rules.boosts[s.boost];
  const sum = v => colors.reduce((n, c) => n + v[c], 0);
  function round(value, mode) {
    return Math.max(0, mode === 'ceil' ? Math.ceil(value - 1e-9) : mode === 'round' ? Math.round(value + 1e-9) : Math.floor(value + 1e-9));
  }
  function totals(s) {
    const earned = vector();
    for (const row of s.ledger.filter(e => e.kind === 'claim')) for (const c of colors) earned[c] += row.gain[c];
    const current = vector(), gap = vector(), surplus = vector();
    for (const c of colors) {
      current[c] = s.stock[c];
      gap[c] = Math.max(0, s.target[c] - current[c]);
      surplus[c] = Math.max(0, current[c] - s.target[c]);
    }
    const tmSources = new Set();
    for (const npc of s.candidates.filter(n => n.status === 'claimed' && ['kukui', 'principal', 'midterm'].includes(n.type))) {
      const row = s.ledger.find(e => e.kind === 'claim' && e.id === npc.id);
      if (row && (row.tmGain !== undefined ? row.tmGain > 0 : npc.type !== 'midterm' || (npc.examPassed !== false && row.gain.yellow > 0))) tmSources.add(npc.type);
    }
    const tmCurrent = tmSources.size, tmTarget = 3;
    return { current, earned, gap, surplus, tm: { current: tmCurrent, target: tmTarget, gap: Math.max(0, tmTarget - tmCurrent), surplus: Math.max(0, tmCurrent - tmTarget) } };
  }
  function reward(s, npc) {
    let base = vector(), known = true;
    const t = npc.type, r = s.rules;
    if (t === 'blue') base = vector(r.blue);
    else if (['kukui', 'principal', 'story1'].includes(t)) base[npc.colors[0]] = r[t];
    else if (t === 'midterm') base.yellow = r.midterm;
    else if (t === 'final') for (const c of ['red', 'green', 'blue']) base[c] = r.final;
    else if (t === 'red') base.yellow = r.red;
    else if (t === 'battle3' || t === 'story3') {
      const n = t === 'battle3' ? r.battleBase : r.story3;
      known = n !== null;
      if (known) for (const c of npc.colors) base[c] = n;
    } else if (t === 'special') {
      const n = npc.chain === 'castle' ? specialDefs.castle.bases[npc.stage - 1] : r.special[npc.chain][npc.stage - 1];
      known = n !== null;
      if (known) for (const c of specialDefs[npc.chain].colors[npc.stage - 1]) base[c] = n;
    }
    else { known = npc.values !== null; if (known) base = { ...npc.values }; }
    const exam = ['midterm', 'final'].includes(t), scaled = exam || (Object.hasOwn(r.scaled, t) ? r.scaled[t] : npc.scaled);
    if (exam && npc.examPassed === false) base = vector();
    const factor = exam ? 1.5 : scaled ? multiplier(s) : 1;
    const gain = Object.fromEntries(colors.map(c => [c, round(base[c] * factor, 'ceil')]));
    const tmGain = ['kukui', 'principal', 'midterm'].includes(t) && npc.examPassed !== false ? 1 : 0;
    return { base, gain, scaled, factor, known, tmGain };
  }
  function planningGap(s) {
    const { gap } = totals(s);
    if (s.excludeExamRewards === false) return gap;
    for (const [type, round] of [['midterm', 6], ['final', 12]]) {
      if (s.round > round || s.candidates.some(n => n.type === type && n.status === 'claimed')) continue;
      const { gain } = reward(s, { type });
      for (const c of colors) gap[c] = Math.max(0, gap[c] - gain[c]);
    }
    return gap;
  }
  function evaluate(s, npc) {
    const result = reward(s, npc), { gap } = totals(s);
    const useful = colors.reduce((n, c) => n + Math.min(result.gain[c], gap[c]), 0);
    return { ...result, npc, useful, waste: sum(result.gain) - useful, tmUseful: Math.min(result.tmGain, totals(s).tm.gap) };
  }
  function rank(s) {
    if (s.candidates.some(n => n.round === s.round && n.status === 'claimed')) return [];
    return s.candidates.filter(n => n.round === s.round && n.status === 'available').map(n => evaluate(s, n))
      .filter(n => n.known).sort((a, b) => b.tmUseful - a.tmUseful || b.useful - a.useful || a.waste - b.waste);
  }
  function specialRemainder(s, npc) {
    const gain = vector();
    for (let stage = npc.stage; stage <= stageCount(npc.chain); stage++) {
      const part = reward(s, { ...npc, stage });
      if (!part.known) return null;
      for (const c of colors) gain[c] += part.gain[c];
    }
    return gain;
  }
  function claim(s, id, at = new Date().toISOString()) {
    const npc = s.candidates.find(n => n.id === id);
    if (!npc || npc.round !== s.round || !['available', 'seen'].includes(npc.status)) throw Error('这项奖励已领取、已放弃，或不在当前回合。');
    if (s.candidates.some(n => n.round === npc.round && n.status === 'claimed')) throw Error('本回合已有一项领取记录；更换选择请先撤销。');
    if (['blue', 'kukui', 'principal', 'midterm', 'final', 'red'].includes(npc.type) &&
      s.candidates.some(n => n.type === npc.type && n.status === 'claimed')) throw Error('本轮已经领取过此项固定奖励。');
    if (npc.type === 'special' && s.candidates.some(n => n.type === 'special' && n.chain === npc.chain && n.stage === npc.stage && n.status === 'claimed')) throw Error('本轮已经领取过这一连续奖励阶段。');
    const result = reward(s, npc);
    if (!result.known) throw Error('奖励规则未确认，请先配置或填写实得数量。');
    const before = { ...s.stock }, after = Object.fromEntries(colors.map(c => [c, before[c] + result.gain[c]]));
    const tmBefore = s.tmStock ?? 0, tmAfter = tmBefore + result.tmGain;
    if (!colors.every(c => numeric(after[c])) || !numeric(tmAfter)) throw Error('库存超出支持范围。');
    if (s.ledger.length >= 500) throw Error('记录已达500条，请开始新一轮。');
    s.ledger.push({ kind: 'claim', id: npc.id, label: npc.label, gain: { ...result.gain }, base: { ...result.base }, before, after,
      factor: result.factor, rounding: 'ceil', at, previousStatus: npc.status, tmGain: result.tmGain, tmBefore, tmAfter,
      roundBefore: s.round, roundAfter: Math.min(12, s.round + 1) });
    npc.status = 'claimed'; s.stock = after; s.tmStock = tmAfter; s.round = Math.min(12, s.round + 1);
  }
  function calibrate(s, next, at = new Date().toISOString(), tmNext = s.tmStock ?? 0) {
    if (!colors.every(c => numeric(next[c])) || !numeric(tmNext)) throw Error('库存必须为0至10亿的整数。');
    if (colors.every(c => next[c] === s.stock[c]) && tmNext === (s.tmStock ?? 0)) return;
    if (s.ledger.length >= 500) throw Error('记录已达500条，请开始新一轮。');
    s.ledger.push({ kind: 'calibration', label: '库存校准', at, before: { ...s.stock }, after: { ...next }, tmBefore: s.tmStock ?? 0, tmAfter: tmNext });
    s.stock = { ...next }; s.tmStock = tmNext;
  }
  function recordChoice(s, npc, at = new Date().toISOString()) {
    const next = structuredClone(s), exam = next.round === 6 ? 'midterm' : next.round === 12 ? 'final' : null;
    if ((exam && npc.type !== exam) || (!exam && ['midterm', 'final'].includes(npc.type))) throw Error('第6回合只能期中考，第12回合只能期末考。');
    if (next.candidates.length >= 500) throw Error('记录已达500条，请开始新一轮。');
    if (npc.type === 'special') {
      const def = specialDefs[npc.chain], stage = nextStage(next, npc.chain);
      if (!def || stage > stageCount(npc.chain)) throw Error('这组连续对战已全部完成。');
      npc = { ...npc, stage, colors: def.colors[stage - 1].slice(), label: def.name + ' · 第' + stage + '阶段' };
    }
    next.candidates.push({ ...npc, round: next.round, status: 'available', selectedOnly: true });
    validate(next); claim(next, npc.id, at); validate(next);
    Object.assign(s, next);
  }
  function undo(s) {
    const row = s.ledger.pop();
    if (!row) throw Error('没有可撤销的领取记录。');
    s.stock = { ...row.before };
    if (row.tmBefore !== undefined) s.tmStock = row.tmBefore;
    if (row.kind === 'claim') {
      const npc = s.candidates.find(n => n.id === row.id);
      if (npc) {
        s.round = row.roundBefore ?? npc.round;
        if (npc.selectedOnly) s.candidates = s.candidates.filter(n => n.id !== npc.id);
        else npc.status = row.previousStatus;
      }
    }
  }
  function validate(s) {
    const fail = () => { throw Error('记录格式或数值不合法；原记录未改动。'); };
    const vec = v => v && colors.every(c => numeric(v[c]));
    if (!s || s.version !== 1 || !Number.isInteger(s.round) || s.round < 1 || s.round > 12 || !['A', 'B', 'C', 'D', 'custom'].includes(s.boost) ||
      !numeric(s.customMultiplier, 100, false) || s.customMultiplier <= 0 ||
      !vec(s.stock) || !vec(s.target) || !s.rules || !Array.isArray(s.candidates) ||
      !Array.isArray(s.ledger) || s.candidates.length > 500 || s.ledger.length > 500) fail();
    if ((s.ruleRevision !== undefined && s.ruleRevision !== 2) ||
      (s.examMultiplier !== undefined && (!numeric(s.examMultiplier, 100, false) || s.examMultiplier <= 0))) fail();
    if ((s.tmStock !== undefined && !numeric(s.tmStock)) || (s.tmTarget !== undefined && !numeric(s.tmTarget))) fail();
    if (s.excludeExamRewards !== undefined && typeof s.excludeExamRewards !== 'boolean') fail();
    const r = s.rules;
    if (!r.boosts || !r.scaled || !['floor', 'round', 'ceil'].includes(r.rounding) ||
      !['A', 'B', 'C', 'D'].every(k => numeric(r.boosts[k], 100, false) && r.boosts[k] > 0) ||
      !['kukui', 'principal', 'blue', 'story3', 'story1', 'midterm', 'final', 'red'].every(k => numeric(r[k], 1e6)) ||
      !(r.battleBase === null || numeric(r.battleBase, 1e6)) ||
      !r.special || !chains.filter(k => k !== 'castle').every(k => Array.isArray(r.special[k]) && r.special[k].length === 3 && r.special[k].every(v => v === null || numeric(v, 1e6))) ||
      !['kukui', 'principal', 'blue', 'battle3', 'story3', 'story1', 'special', 'midterm', 'final', 'red'].every(k => typeof r.scaled[k] === 'boolean')) fail();
    const ids = new Set();
    for (const n of s.candidates) {
      if (!n || typeof n.id !== 'string' || n.id.length > 100 || ids.has(n.id) ||
        typeof n.label !== 'string' || !n.label.trim() || n.label.length > 100 || !types.includes(n.type) ||
        !['available', 'seen', 'skipped', 'claimed'].includes(n.status) || typeof n.scaled !== 'boolean' ||
        !Array.isArray(n.colors) || n.colors.some(c => !colors.includes(c)) || new Set(n.colors).size !== n.colors.length ||
        (n.values !== null && !vec(n.values)) || !Number.isInteger(n.stage) || n.stage < 1 || n.stage > stageCount(n.chain) || !chains.includes(n.chain) ||
        !Number.isInteger(n.round) || n.round < 1 || n.round > 12) fail();
      if (['battle3', 'story3'].includes(n.type) && n.colors.length !== 3) fail();
      if (['kukui', 'principal', 'story1'].includes(n.type) && n.colors.length !== 1) fail();
      if (n.type === 'special' && n.colors.length !== (n.chain === 'castle' ? 3 : 1)) fail();
      if ((n.selectedOnly !== undefined && typeof n.selectedOnly !== 'boolean') || (n.examPassed !== undefined && typeof n.examPassed !== 'boolean')) fail();
      ids.add(n.id);
    }
    for (const t of ['blue', 'kukui', 'principal', 'midterm', 'final', 'red']) if (s.candidates.filter(n => n.type === t && n.status === 'claimed').length > 1) fail();
    for (const chain of chains) for (let stage = 1; stage <= stageCount(chain); stage++) if (s.candidates.filter(n => n.type === 'special' && n.chain === chain && n.stage === stage && n.status === 'claimed').length > 1) fail();
    const logged = new Set();
    let lastAfter = null, lastTmAfter = null;
    for (const row of s.ledger) {
      if (!row || !['claim', 'calibration'].includes(row.kind) || !vec(row.before) || !vec(row.after) ||
        typeof row.at !== 'string' || !Number.isFinite(Date.parse(row.at))) fail();
      if (lastAfter && colors.some(c => row.before[c] !== lastAfter[c])) fail();
      lastAfter = row.after;
      if (row.tmBefore !== undefined || row.tmAfter !== undefined || row.tmGain !== undefined) {
        if (!numeric(row.tmBefore) || !numeric(row.tmAfter) || (lastTmAfter !== null && row.tmBefore !== lastTmAfter)) fail();
        if (row.kind === 'claim' && (!numeric(row.tmGain) || row.tmAfter !== row.tmBefore + row.tmGain)) fail();
        lastTmAfter = row.tmAfter;
      }
      if (row.kind === 'calibration') continue;
      const n = s.candidates.find(n => n.id === row.id);
      if (!n || n.status !== 'claimed' || logged.has(row.id) || !vec(row.gain) || !vec(row.base) ||
        typeof row.label !== 'string' || row.label.length > 100 || !numeric(row.factor, 100, false) ||
        !['floor', 'round', 'ceil'].includes(row.rounding) || !['available', 'seen'].includes(row.previousStatus) ||
        typeof row.at !== 'string' || !Number.isFinite(Date.parse(row.at))) fail();
      if (colors.some(c => row.after[c] !== row.before[c] + row.gain[c])) fail();
      if ((row.roundBefore !== undefined || row.roundAfter !== undefined) &&
        (row.roundBefore !== n.round || row.roundAfter !== Math.min(12, n.round + 1))) fail();
      logged.add(row.id);
    }
    if (s.candidates.some(n => n.status === 'claimed' && !logged.has(n.id))) fail();
    if (lastAfter && colors.some(c => s.stock[c] !== lastAfter[c])) fail();
    if (lastTmAfter !== null && (s.tmStock ?? 0) !== lastTmAfter) fail();
    for (let round = 1; round <= 12; round++) if (s.candidates.filter(n => n.round === round && n.status === 'claimed').length > 1) fail();
    return s;
  }
  function upgrade(s) {
    validate(s);
    if (s.ruleRevision !== 2) {
      s.rules = defaults().rules; s.ruleRevision = 2; s.examMultiplier = 1.5;
    }
    s.tmStock ??= 0; s.tmTarget = 3;
    s.excludeExamRewards ??= true;
    s.rules.rounding = 'ceil'; s.examMultiplier = 1.5;
    return s;
  }
  root.Pasio = { colors, vector, defaults, multiplier, sum, totals, reward, planningGap, evaluate, rank, specialDefs, stageCount, nextStage, specialRemainder, claim, recordChoice, calibrate, undo, validate, upgrade };
  if (typeof module !== 'undefined') module.exports = root.Pasio;
})(typeof window === 'undefined' ? globalThis : window);
