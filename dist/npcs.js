(function (root) {
  'use strict';
  const early = [3, 4, 5, 7], late = [8, 9, 10, 11];
  const battles = [
    { id: 'single', name: '单色对战', count: 1, amounts: [30, 60] },
    { id: 'double', name: '双色对战', count: 2, amounts: [45] },
    { id: 'triple', name: '三色对战', count: 3, amounts: [40] }
  ];
  const events = [
    ['婉龙', '来读书吧！', '图书馆', 'red', early],
    ['赤焰松', '聊些有意义的事吧', '大礼堂', 'green', early],
    ['嘉德丽雅', '大小姐的优雅喜好', '学院餐厅', 'blue', late],
    ['查克洛', '放松一下……', '屋顶', 'yellow', late],
    ['克拉拉', '课前准备……？', '操场', 'red', late]
  ].map(([name, title, place, color, rounds], i) => ({ kind: 'story', id: 'story-common-' + i, name, title, place, colors: [color], base: 300, rounds, period: '通用', note: i < 2 ? '地点按原表通用区展示；百科地点与原表相反，实际位置以游戏为准。奖励和回合一致。' : '' }));
  root.PasioNpcs = { battles, events, forRound: (kind, round, all = false) => events.filter(e => e.kind === kind && (all || e.rounds.includes(round))) };
  if (typeof module !== 'undefined') module.exports = root.PasioNpcs;
})(typeof window === 'undefined' ? globalThis : window);
