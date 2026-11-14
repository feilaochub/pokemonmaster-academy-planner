(function () {
  'use strict';
  const P = window.Pasio, D = window.PasioDialogues, N = window.PasioNpcs, S = window.PasioShare, key = 'pasio-crystal-planner-v1';
  const $ = id => document.getElementById(id), names = { red: '红色', green: '绿色', blue: '蓝色', yellow: '黄色' };
  const typeNames = { battle: '对战NPC', story: '剧情NPC（固定数量）', dialogue: '对话NPC（随机数量）', kukui: '库库伊', principal: '校长', red: '赤红', oak: '大木', blue: '青绿', custom: '未收录 / 自定义奖励' };
  const chains = P.specialDefs;
  const roundNames = { floor: '逐色向下取整', round: '逐色四舍五入', ceil: '逐色向上取整' };
  const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const colorText = v => esc(v).replace(/红色|绿色|蓝色|黄色/g, word => `<span class="reward-color ${Object.keys(names).find(c => names[c] === word)}">${word}</span>`);
  const fmt = n => Number(n).toLocaleString('zh-CN', { maximumFractionDigits: 4 });
  const emptyInputs = () => Object.fromEntries(P.colors.map(c => [c, '']));
  let s = P.defaults(), drafts = [], selectedRef = '', showAll = false, actualIndex = '', manualValues = emptyInputs(), manualScaled = false;
  let selectedColor = 'blue', battleKind = 'triple', battleColors = ['red', 'blue', 'yellow'], storyColors = ['red', 'green', 'blue'], singleBase = 60, examPassed = true, openReward = null, timer;
  function activeType() { return s.round === 6 ? 'midterm' : s.round === 12 ? 'final' : $('npc-type').value; }
  function toast(message, error = false) {
    $('toast').textContent = message; $('toast').className = 'toast' + (error ? ' error' : ''); $('toast').hidden = false;
    clearTimeout(timer); timer = setTimeout(() => { $('toast').hidden = true; }, error ? 6500 : 3500);
  }
  function number(raw, max = 1e9, fractional = false) {
    const n = Number(raw);
    if (String(raw).trim() === '' || !Number.isFinite(n) || n < 0 || n > max || (!fractional && !Number.isInteger(n)) ||
      (fractional && (n <= 0 || Math.abs(n * 1e4 - Math.round(n * 1e4)) > 1e-6))) throw Error('数量须为非负整数；倍率须大于0，最多4位小数。');
    return n;
  }
  function persist() {
    try { localStorage.setItem(key, JSON.stringify(s)); $('save-status').textContent = '已保存到本机'; return true; }
    catch { $('save-status').textContent = '本机保存失败'; toast('浏览器无法保存，关闭页面可能丢失本次进度。请检查浏览器存储空间。', true); return false; }
  }
  function change(fn, message) {
    try { const next = structuredClone(s); fn(next); P.validate(next); s = next; const saved = persist(); render(); if (message && saved) toast(message); return true; }
    catch (e) { toast(e.message, true); return false; }
  }
  function gainText(v) { return P.colors.filter(c => v[c]).map(c => names[c] + ' +' + fmt(v[c])).join(' ／ ') || '四色均为0'; }
  function gains(v) { return P.colors.filter(c => v[c]).map(c => `<span class="gain-item ${c}"><i class="gem"></i>${names[c]} +${fmt(v[c])}</span>`).join('') || '<span class="muted">四色均为0</span>'; }
  function tmBadge(n) { return n ? `<span class="gain-item silver"><i class="gem"></i>银色招式学习器滴晶 +${fmt(n)}</span>` : ''; }
  function formula(r, rounding = 'ceil') {
    return P.colors.filter(c => r.base[c]).map(c => `<span>${names[c]}：${fmt(r.base[c])} × ${fmt(r.factor)} = ${fmt(r.base[c] * r.factor)}${r.base[c] * r.factor === r.gain[c] ? '' : '，取整后 ' + fmt(r.gain[c])}</span>`).join('') + `<span>四色合计 ${fmt(P.sum(r.gain))} · ${roundNames[rounding]}</span>` + (r.tmGain ? '<span>银色招式学习器滴晶：1 × 1 = 1（不乘加成）</span>' : '');
  }
  function futureReward(n) {
    if (n.type !== 'special' || n.stage === P.stageCount(n.chain)) return '';
    const remainder = P.specialRemainder(s, { ...n, stage: n.stage + 1 });
    return `<details><summary>后续奖励</summary><p>若后续全部出现并通过：${remainder ? esc(gainText(remainder)) : '奖励待确认'}。</p></details>`;
  }
  function resetComposer(state = s) { selectedRef = ''; showAll = false; actualIndex = ''; manualValues = emptyInputs(); manualScaled = false; selectedColor = 'blue'; battleKind = 'triple'; battleColors = ['red', 'blue', 'yellow']; storyColors = ['red', 'green', 'blue']; singleBase = 60; examPassed = true; $('npc-type').value = state.round === 1 && !state.candidates.some(n => n.status === 'claimed' && (n.round === 1 || n.type === 'principal')) ? 'principal' : ''; }
  function reference(t = activeType()) { return t === 'dialogue' ? D.events.find(e => e.id === selectedRef) : t === 'story' ? N.events.find(e => e.id === selectedRef) : t === 'oak' ? D.oak : null; }
  function randomSummary(id) {
    const p = D.prizes[id]; if (!p) return '奖励未确认，请按游戏实得填写。';
    const selectable = D.events.find(e => e.id === id)?.choices.length > 1;
    return (p.simultaneous ? '四色同时各' : p.colors.map(c => names[c]).join('／') + (p.colors.length > 1 ? selectable ? '可选一种；随机数量：' : '随机一种：' : '：')) + p.amounts.map(fmt).join('或');
  }
  function rewardTable(e) {
    return `<table class="reward-table"><thead><tr><th>游戏选项</th><th>可能奖励（不乘倍率）</th></tr></thead><tbody>${e.choices.map(([a, b]) => `<tr><td>${colorText(a)}</td><td>${colorText(b)}</td></tr>`).join('')}</tbody></table>`;
  }
  function randomDetails(id) {
    const e = id === 'oak' ? D.oak : D.events.find(item => item.id === id);
    return e ? rewardTable(e) : `<p class="random-reward">${colorText(randomSummary(id))}</p>`;
  }
  function manualMarkup(prefix, values = emptyInputs()) { return `<div class="manual-grid">${P.colors.map(c => `<label>${names[c]}实得数量<input id="${prefix}-${c}" type="number" min="0" max="1000000000" step="1" value="${esc(values[c])}" placeholder="未获得可留空"></label>`).join('')}</div>`; }
  function readActual(values) {
    if (P.colors.every(c => String(values[c]).trim() === '')) return null;
    return Object.fromEntries(P.colors.map(c => [c, String(values[c]).trim() === '' ? 0 : number(values[c])]));
  }
  function makeDraft() {
    const t = activeType(), e = reference(t);
    if (!t) throw Error('请先选择 NPC 类型和具体关卡。');
    if (['story', 'dialogue'].includes(t) && !e && selectedRef !== 'custom' && !(t === 'story' && selectedRef === 'tricolor')) throw Error('请选择具体 NPC，或选择未收录入口。');
    const n = { id: 'preview', type: t, label: typeNames[t] || (t === 'midterm' ? '期中考试（最高难度）' : '期末考试（最高难度）'), colors: [], round: s.round, status: 'available', stage: 1, chain: 'rocket', values: null, scaled: false };
    if (e) n.label = e.name + ' · ' + e.title;
    if (t === 'battle') {
      if (chains[battleKind]) {
        n.type = 'special'; n.chain = battleKind; n.stage = P.nextStage(s, battleKind);
        if (n.stage > P.stageCount(n.chain)) throw Error('这组连续对战已全部完成。');
        n.colors = chains[battleKind].colors[n.stage - 1].slice(); n.label = chains[battleKind].name + ' · 第' + n.stage + '阶段';
      } else {
        const kind = N.battles.find(b => b.id === battleKind);
        if (!kind || battleColors.length !== kind.count) throw Error('请选择恰好' + (kind?.count || 1) + '种奖励颜色。');
        const base = kind.count === 1 ? singleBase : kind.amounts[0];
        n.colors = battleColors.slice(); n.values = P.vector(); for (const c of n.colors) n.values[c] = base;
        n.scaled = true; n.label = kind.name + ' · ' + n.colors.map(c => names[c]).join('／') + ' · 基础' + base;
      }
    }
    else if (t === 'story' && selectedRef === 'tricolor') {
      if (storyColors.length !== 3) throw Error('三色剧情请选择恰好3种滴晶。');
      n.type = 'story3'; n.colors = storyColors.slice(); n.label = '三色剧情 · ' + n.colors.map(c => names[c]).join('／');
    }
    else if (t === 'story' && e) { n.colors = e.colors.slice(); n.values = P.vector(); for (const c of n.colors) n.values[c] = e.base; }
    else if ((t === 'dialogue' && e) || t === 'oak') { n.randomId = e.id; if (actualIndex !== '') { const v = D.outcomes(e.id)[Number(actualIndex)]; if (!v) throw Error('请选择有效的实际奖励。'); n.values = { ...v }; } }
    else if (['story', 'dialogue', 'custom'].includes(t)) { n.values = readActual(manualValues); n.scaled = t === 'custom' && manualScaled; }
    else if (['kukui', 'principal'].includes(t)) n.colors = [selectedColor];
    else if (['midterm', 'final'].includes(t)) { n.examPassed = examPassed; if (!examPassed) n.label += ' · 未通过'; }
    return n;
  }
  function renderReference(t) {
    const available = t === 'dialogue' ? D.forRound(s.round, showAll) : N.forRound(t, s.round, showAll);
    if (selectedRef !== 'custom' && !(t === 'story' && selectedRef === 'tricolor') && !available.some(e => e.id === selectedRef)) { selectedRef = ''; actualIndex = ''; }
    const e = reference(t);
    let html = `<div class="dialogue-picker"><label>具体 ${t === 'battle' ? '对战' : t === 'story' ? '剧情' : '对话'} NPC<select id="npc-reference"><option value="">请选择 NPC / 关卡</option>${t === 'story' ? `<option value="tricolor" ${selectedRef === 'tricolor' ? 'selected' : ''}>三色剧情</option>` : ''}${available.map(item => `<option value="${item.id}" ${item.id === selectedRef ? 'selected' : ''}>${esc(item.name)} · ${esc(item.title)}${item.period && item.period !== '通用' ? '（' + esc(item.period) + '）' : ''}</option>`).join('')}<option value="custom" ${selectedRef === 'custom' ? 'selected' : ''}>未收录 / 手动补录实得</option></select></label><label class="dialogue-toggle"><input id="reference-all" type="checkbox" ${showAll ? 'checked' : ''}>查看全部回合</label></div>`;
    if (t === 'story' && selectedRef === 'tricolor') return html + `<p class="color-caption">滴晶颜色（选3种）</p><div class="color-choices">${P.colors.map(c => `<label><input type="checkbox" data-story-color="${c}" ${storyColors.includes(c) ? 'checked' : ''}><i class="gem ${c}"></i>${names[c]}</label>`).join('')}</div>`;
    if (e) {
      const when = e.when || '第' + e.rounds.join('、') + '回合';
      html += `<div class="dialogue-detail"><p class="event-meta">${esc(e.place || '中庭')} · ${esc(when)}</p>${e.rounds.includes(s.round) ? '' : '<p class="dialogue-warning">不在表内当前回合范围。</p>'}${e.period && e.period !== '通用' ? '<p class="dialogue-warning">' + esc(e.period) + '限定内容，不保证本期出现。</p>' : ''}`;
      if (t === 'dialogue') html += `<p>${esc(e.question)}</p>${rewardTable(e)}`;
      html += (e.note ? `<details class="dialogue-note"><summary>资料备注</summary><p>${esc(e.note)}</p></details>` : '') + '</div>';
    }
    return html;
  }
  function renderComposer() {
    const t = activeType(), exam = ['midterm', 'final'].includes(t);
    $('npc-kind-row').hidden = exam; $('choice-title').textContent = exam ? '第' + s.round + '回合 · ' + (t === 'midterm' ? '期中考试' : '期末考试') : '这一回合，选择谁？';
    let html = '';
    if (['story', 'dialogue'].includes(t)) html = renderReference(t);
    else if (t === 'battle') {
      html = `<label>对战选项<select id="battle-kind">${[...N.battles, ...Object.entries(chains).map(([id, item]) => ({ id, name: item.name + '（连续对战能有额外奖励）' }))].map(item => `<option value="${item.id}" ${battleKind === item.id ? 'selected' : ''}>${item.name}</option>`).join('')}</select></label>`;
      if (chains[battleKind]) {
        if (P.nextStage(s, battleKind) > P.stageCount(battleKind)) html += '<p class="muted">全部阶段已完成</p>';
      } else html += `${battleKind === 'single' ? `<label>单色档位<select id="single-base"><option value="60" ${singleBase === 60 ? 'selected' : ''}>特训 · 基础60</option><option value="30" ${singleBase === 30 ? 'selected' : ''}>练习 · 基础30</option></select></label>` : ''}<p class="color-caption">滴晶颜色（选${N.battles.find(b => b.id === battleKind).count}种）</p><div class="color-choices">${P.colors.map(c => `<label><input type="checkbox" data-battle-color="${c}" ${battleColors.includes(c) ? 'checked' : ''}><i class="gem ${c}"></i>${names[c]}</label>`).join('')}</div>`;
    }
    const e = reference(t), randomId = t === 'oak' ? 'oak' : t === 'dialogue' && e ? e.id : null;
    if (randomId) {
      if (t === 'oak') html += '<p class="event-meta">第7–11回合 · 中庭</p>';
      const outcomes = D.outcomes(randomId);
      html += `<label class="actual-result">实得奖励<select id="actual-outcome"><option value="">请选择实际奖励</option>${outcomes.map((v, i) => `<option value="${i}" ${actualIndex === String(i) ? 'selected' : ''}>${esc(gainText(v))}</option>`).join('')}</select></label>`;
    } else if (t === 'custom' || (['story', 'dialogue'].includes(t) && selectedRef === 'custom')) {
      html += manualMarkup('actual', manualValues);
      if (t === 'custom') html += `<label class="manual-scale"><input id="actual-scaled" type="checkbox" ${manualScaled ? 'checked' : ''}>输入的是基础值，需要乘队伍倍率</label>`;
    } else if (['kukui', 'principal'].includes(t)) html += `<label>奖励颜色<select id="reward-color">${P.colors.map(c => `<option value="${c}" ${selectedColor === c ? 'selected' : ''}>${names[c]}</option>`).join('')}</select></label>${t === 'kukui' ? '<p class="event-meta">入口 · 第1–5回合</p>' : ''}`;
    else if (exam) html += `<label class="manual-scale"><input id="exam-passed" type="checkbox" ${examPassed ? 'checked' : ''}>考试通过</label>`;
    $('npc-options').innerHTML = html;
    const claimed = s.candidates.some(n => n.round === s.round && n.status === 'claimed');
    let ready = false; try { makeDraft(); ready = true; } catch {}
    $('confirm-npc').disabled = !ready || claimed; $('add-choice').disabled = !ready || exam || claimed;
    $('add-choice').hidden = exam;
    renderPreview();
  }
  function renderPreview() {
    let n; try { n = makeDraft(); } catch { $('choice-preview').innerHTML = ''; return; }
    const r = P.evaluate(s, n);
    $('choice-preview').innerHTML = `${n.type === 'special' ? '<strong>' + esc(n.label) + '</strong>' : ''}${r.known ? `<div class="gains">${gains(r.gain)}${tmBadge(r.tmGain)}</div>${['midterm', 'final'].includes(n.type) ? '' : `<p>补缺 ${fmt(r.useful)} · 溢出 ${fmt(r.waste)}${r.tmGain ? ' · 银色补缺 ' + r.tmUseful : ''}</p>`}<details><summary>计算过程</summary><div class="formula">${formula(r)}</div></details>${futureReward(n)}` : `<p>${colorText(randomSummary(n.randomId))}</p>`}`;
  }
  function resultMarkup(n) {
    const outcomes = D.outcomes(n.randomId);
    if (outcomes.length && outcomes.length <= 8) return `<div class="outcome-buttons">${outcomes.map((v, i) => `<button class="primary" type="button" data-result="${n.id}" data-index="${i}">确认 ${esc(gainText(v))}</button>`).join('')}</div>`;
    if (outcomes.length) return `<label>实际获得<select id="result-${n.id}"><option value="">请选择实际奖励</option>${outcomes.map((v, i) => `<option value="${i}">${esc(gainText(v))}</option>`).join('')}</select></label><button class="primary" type="button" data-result-select="${n.id}">按选中结果确认</button>`;
    return manualMarkup('result-' + n.id) + `<button class="primary" type="button" data-result-manual="${n.id}">按实得确认</button>`;
  }
  function renderDrafts() {
    const ranked = drafts.map(n => P.evaluate(s, n)).sort((a, b) => Number(b.known) - Number(a.known) || b.tmUseful - a.tmUseful || b.useful - a.useful || a.waste - b.waste);
    const best = ranked.find(r => r.known && (r.useful > 0 || r.tmUseful > 0));
    const claimed = s.candidates.some(n => n.round === s.round && n.status === 'claimed');
    $('comparison-note').hidden = !best;
    $('comparison-note').innerHTML = best ? `<strong>已知奖励优先：${esc(best.npc.label)}</strong> 四色补缺 ${fmt(best.useful)}${best.tmUseful ? ' · 银色补缺 ' + best.tmUseful : ''}` : '';
    $('temp-choices').innerHTML = ranked.map(r => { const n = r.npc; return `<article class="npc-card ${best?.npc.id === n.id ? 'best' : ''}"><div class="npc-head"><strong>${esc(n.label)}</strong></div>${r.known ? `<div class="gains">${gains(r.gain)}${tmBadge(r.tmGain)}</div>${n.randomId ? randomDetails(n.randomId) : ''}<p class="npc-metrics">可补缺口 ${fmt(r.useful)} · 溢出 ${fmt(r.waste)}</p><details><summary>计算过程</summary><div class="formula">${formula(r)}</div></details>${futureReward(n)}` : randomDetails(n.randomId)}<div class="npc-actions"><button class="quiet" type="button" data-remove="${n.id}">移除</button><button class="primary" type="button" data-claim="${n.id}" ${claimed ? 'disabled' : ''}>确认已领取</button></div>${openReward === n.id ? `<div class="result-picker">${resultMarkup(n)}</div>` : ''}</article>`; }).join('');
    $('comparison-area').hidden = !drafts.length;
  }
  function renderGaps() {
    const { current } = P.totals(s), gap = P.planningGap(s);
    $('exclude-exam-rewards').checked = s.excludeExamRewards;
    $('gap-basis').textContent = s.excludeExamRewards ? '按最高难度通过预留' : '滴晶 · 各色缺口之和';
    $('total-gap').textContent = fmt(P.sum(gap));
    for (const c of P.colors) $('gap-' + c).textContent = fmt(gap[c]);
    $('summary-colors').innerHTML = P.colors.map(c => `<div class="summary-color"><div class="summary-color-line"><span class="summary-color-label"><i class="gem ${c}"></i>${names[c]}</span><span>${fmt(gap[c])}</span></div><div class="progress ${c}"><i style="width:${s.target[c] ? Math.min(100, current[c] / s.target[c] * 100) : 100}%"></i></div></div>`).join('');
  }
  function render() {
    const { current, surplus, tm } = P.totals(s);
    $('team-bonus').hidden = [6, 12].includes(s.round);
    $('resource-cards').innerHTML = P.colors.map(c => `<div class="resource-card ${c}"><div class="resource-title"><i class="gem"></i>${names[c]}滴晶</div><label>本轮目标<input id="target-${c}" type="number" min="0" max="1000000000" step="1" value="${s.target[c]}"></label><label>当前库存<input id="stock-${c}" type="number" min="0" max="1000000000" step="1" value="${current[c]}"></label><div class="resource-foot">还差 <b id="gap-${c}"></b>${surplus[c] ? '<br>已超出 ' + fmt(surplus[c]) : ''}</div></div>`).join('');
    renderGaps();
    $('tm-current').textContent = fmt(tm.current);
    const share = S.summary(s);
    $('share-rating').textContent = share.rating.grade; $('share-rating').style.color = share.rating.color;
    $('share-earned').textContent = fmt(share.total);
    $('boost-options').innerHTML = ['A', 'B', 'C', 'D', 'custom'].map(b => `<button class="boost-option ${s.boost === b ? 'active' : ''}" data-boost="${b}" aria-pressed="${s.boost === b}">${b === 'custom' ? '自定义' : b === 'D' ? '最低组合' : b + '组合'}<strong>×${fmt(b === 'custom' ? s.customMultiplier : s.rules.boosts[b])}</strong></button>`).join('');
    $('active-factor').textContent = '×' + fmt(P.multiplier(s)); $('custom-factor-row').hidden = s.boost !== 'custom'; $('custom-factor').value = s.customMultiplier; $('round').value = s.round;
    const finished = s.round === 12 && s.candidates.some(n => n.round === 12 && n.status === 'claimed');
    $('round-status').textContent = finished ? '本轮结束' : ''; $('round-status').hidden = !finished;
    $('ledger').innerHTML = [...s.ledger].reverse().map(row => { const npc = s.candidates.find(n => n.id === row.id), round = row.roundBefore ?? npc?.round; return `<div class="ledger-row"><div>${row.kind === 'claim' ? '第' + round + '回合 · ' : ''}${esc(row.label)}<small>${esc(new Date(row.at).toLocaleString('zh-CN'))}</small></div><div class="ledger-values">${row.kind === 'claim' ? `${gains(row.gain)}${tmBadge(row.tmGain)}<details><summary>领取时计算</summary><div class="formula">${formula(row, row.rounding)}</div></details>` : P.colors.map(c => names[c] + ' ' + fmt(row.before[c]) + ' → ' + fmt(row.after[c])).join(' ／ ') + (row.tmAfter !== undefined ? ' ／ 银色 ' + fmt(row.tmBefore) + ' → ' + fmt(row.tmAfter) : '')}</div></div>`; }).join('') || '<div class="empty">暂无记录</div>';
    $('undo').disabled = !s.ledger.length; renderComposer(); renderDrafts();
  }
  function commit(n) {
    const { randomId, ...selected } = n;
    if (change(next => P.recordChoice(next, { ...selected, id: crypto.randomUUID() }))) { drafts = []; openReward = null; resetComposer(); render(); toast(s.candidates.some(item => item.round === 12 && item.status === 'claimed') ? '已入账，本轮结束。' : '已入账，进入第' + s.round + '回合。'); }
  }
  $('npc-type').innerHTML = '<option value="">请选择 NPC 类型</option>' + Object.entries(typeNames).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  $('round').innerHTML = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
  $('rating-tiers').innerHTML = S.tiers.map((tier, i) => `<tr><td>${tier.grade}</td><td>${fmt(tier.min)}${S.tiers[i + 1] ? '–' + fmt(S.tiers[i + 1].min - 1) : '及以上'}</td></tr>`).join('');
  $('npc-type').addEventListener('change', () => { const t = $('npc-type').value; resetComposer(); $('npc-type').value = t; renderComposer(); });
  $('round').addEventListener('change', () => { drafts = []; openReward = null; const round = Number($('round').value); change(next => { next.round = round; resetComposer(next); }); });
  $('npc-options').addEventListener('change', e => {
    const id = e.target.id;
    if (id === 'npc-reference') { selectedRef = e.target.value; actualIndex = ''; manualValues = emptyInputs(); renderComposer(); }
    else if (id === 'reference-all') { showAll = e.target.checked; renderComposer(); }
    else if (id === 'actual-outcome') { actualIndex = e.target.value; renderPreview(); }
    else if (id === 'reward-color') { selectedColor = e.target.value; renderPreview(); }
    else if (id === 'battle-kind') { battleKind = e.target.value; battleColors = battleKind === 'single' ? ['blue'] : battleKind === 'double' ? ['red', 'blue'] : ['red', 'blue', 'yellow']; renderComposer(); }
    else if (e.target.dataset.storyColor) { storyColors = [...$('npc-options').querySelectorAll('[data-story-color]:checked')].map(input => input.dataset.storyColor); renderComposer(); }
    else if (id === 'single-base') { singleBase = Number(e.target.value); renderPreview(); }
    else if (e.target.dataset.battleColor) { battleColors = [...$('npc-options').querySelectorAll('[data-battle-color]:checked')].map(input => input.dataset.battleColor); renderComposer(); }
    else if (id === 'actual-scaled') { manualScaled = e.target.checked; renderPreview(); }
    else if (id === 'exam-passed') { examPassed = e.target.checked; renderPreview(); }
  });
  $('npc-options').addEventListener('input', e => {
    const c = e.target.id.replace('actual-', '');
    if (P.colors.includes(c)) { manualValues[c] = e.target.value; renderPreview(); }
  });
  $('npc-form').addEventListener('submit', e => { e.preventDefault(); try { commit(makeDraft()); } catch (error) { toast(error.message, true); } });
  $('add-choice').addEventListener('click', () => { try { const n = makeDraft(); drafts.push({ ...structuredClone(n), id: crypto.randomUUID() }); renderDrafts();  } catch (error) { toast(error.message, true); } });
  $('temp-choices').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const id = b.dataset.claim || b.dataset.remove || b.dataset.result || b.dataset.resultSelect || b.dataset.resultManual, n = drafts.find(item => item.id === id); if (!n) return;
    try {
      if (b.dataset.remove) { drafts = drafts.filter(item => item.id !== id); renderDrafts(); }
      else if (b.dataset.claim) { if (P.reward(s, n).known) commit(n); else { openReward = id; renderDrafts(); } }
      else if (b.dataset.result || b.dataset.resultSelect) { const raw = b.dataset.result ? b.dataset.index : $('result-' + id).value; if (raw === '') throw Error('请选择实际获得的奖励。'); const v = D.outcomes(n.randomId)[Number(raw)]; if (!v) throw Error('请选择有效奖励。'); commit({ ...n, values: v, scaled: false }); }
      else if (b.dataset.resultManual) { const values = Object.fromEntries(P.colors.map(c => [c, $('result-' + id + '-' + c).value])); commit({ ...n, values: readActual(values) }); }
    } catch (error) { toast(error.message, true); }
  });
  $('boost-options').addEventListener('click', e => { const b = e.target.closest('[data-boost]'); if (b) change(next => { next.boost = b.dataset.boost; }); });
  $('custom-factor').addEventListener('change', () => change(next => { next.customMultiplier = number($('custom-factor').value, 100, true); }));
  $('save-inventory').addEventListener('click', () => change(next => { const stock = P.vector(); for (const c of P.colors) { stock[c] = number($('stock-' + c).value); next.target[c] = number($('target-' + c).value); } P.calibrate(next, stock); }, '库存与目标已更新，历史领取未重复叠加。'));
  $('exclude-exam-rewards').addEventListener('change', e => { s.excludeExamRewards = e.target.checked; persist(); renderGaps(); });
  $('example-target').addEventListener('click', () => { for (const c of P.colors) $('target-' + c).value = P.defaults().target[c]; toast('已填入示例目标，请点击应用。'); });
  $('undo').addEventListener('click', () => { if (change(next => P.undo(next), '已撤销最后一笔，领取时的库存与回合已恢复。')) { drafts = []; openReward = null; resetComposer(); render(); } });
  $('share-progress').addEventListener('click', () => {
    const button = $('share-progress'); button.disabled = true;
    try {
      const data = S.summary(s), shareUrl = S.draw(document.createElement('canvas'), data, window.PasioShareQr).toDataURL('image/png');
      $('share-image').src = shareUrl; $('share-image').alt = `本轮已记录${data.rounds}回合，四色累计${data.total}，银色${data.silver}枚，学院评级${data.rating.grade}`;
      $('share-download').href = shareUrl; $('share-dialog').showModal();
    } catch (error) { toast(error.message, true); }
    finally { button.disabled = false; }
  });
  $('close-share').addEventListener('click', () => $('share-dialog').close());
  $('new-run').addEventListener('click', () => { if (confirm('新一轮将清空本轮库存和选择记录，保留目标与倍率。此操作不能撤销。是否继续？')) change(next => { const fresh = P.defaults(); next.stock = fresh.stock; next.tmStock = 0; next.round = 1; next.candidates = []; next.ledger = []; drafts = []; resetComposer(next); }, '新一轮已开始，请按游戏实际设置库存。'); });
  try { const saved = localStorage.getItem(key); if (saved) s = P.upgrade(JSON.parse(saved)); } catch { toast('无法读取已有记录，当前显示初始状态；本机存档可能损坏。', true); }
  resetComposer(); render();
})();
