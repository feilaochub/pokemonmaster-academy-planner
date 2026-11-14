(function (root) {
  'use strict';
  const regular = [3, 4, 5, 7, 8, 9, 10, 11], late = [7, 8, 9, 10, 11];
  const regularText = '第3–5、7–11回合', lateText = '第7–11回合';
  const sources = [
    ['攻略原文与早期附表', 'https://www.bilibili.com/opus/1270413835442847744'],
    ['百科对话转录', 'https://wiki.52poke.com/zh-hans/%E5%B8%95%E5%B8%8C%E6%AD%90%E5%AD%B8%E9%99%A2']
  ];
  const events = [
    { id: 'ball-guy', name: '阿球', title: '阿球的礼物', rounds: late, when: lateText,
      question: '从精灵球中挑选礼物。', choices: [['选择一颗精灵球', '红色／绿色／蓝色／黄色随机一种，420']],
      note: '只给随机一种颜色，并非四色各420。精灵球与奖励颜色的固定对应关系未核实。' },
    { id: 'grimsley', name: '越橘', title: '正面？反面？', rounds: regular, when: regularText,
      question: '猜投币的结果。', choices: [['正面／反面', '黄色随机30或450']],
      note: '未核实选项能否影响中奖率，不能把某个选项标成必出450。' },
    { id: 'brock', name: '小刚', title: '小刚的碎石修行', rounds: regular, when: regularText,
      question: '参加碎石修行。', choices: [['破坏岩石／什么都不做', '红色／绿色／蓝色随机一种；30／90／150／210／270／330／390／450']],
      note: '早期表写随机30–450；离散数量据百科转录补充。具体操作机制与各档概率未核实。' },
    { id: 'iono', name: '奇树', title: '下次的直播是奇树奇述？', rounds: regular, when: regularText,
      question: '为下次直播提供主题建议。', choices: [['品尝世上的珍奇美食／所有学科拿满分', '红色随机30或450']],
      note: '未核实哪个主题会改变奖励或中奖率。' },
    { id: 'lance', name: '阿渡', title: '阿渡的修行地点', rounds: regular, when: regularText,
      question: '为修行选择地点。', choices: [['山上／海边', '绿色随机30或450']],
      note: '未核实哪个地点会改变奖励或中奖率。' },
    { id: 'gloria', name: '小优', title: '喜欢什么口味的咖喱？', rounds: regular, when: regularText,
      question: '选择咖喱口味。', choices: [['甜的／辣的', '蓝色随机30或450']],
      note: '未核实哪个口味会改变奖励或中奖率。' },
    { id: 'n', name: 'N', title: 'N的提问', rounds: late, when: lateText,
      question: '你喜欢黑色，还是白色？', choices: [['黑色', '红色随机150／300／450／600'], ['白色', '绿色随机150／300／450／600']],
      note: '黑／白是对话选项，实际奖励从红／绿滴晶选项中选择。' },
    { id: 'sycamore', name: '布拉塔诺', title: '布拉塔诺博士的问题', rounds: late, when: lateText,
      question: '在两个箱子中选择一个。', choices: [['蓝色箱子', '蓝色随机150／300／450／600'], ['红色箱子', '黄色随机150／300／450／600']],
      note: '注意：红色箱子对应黄色滴晶，并非红色滴晶。' },
    { id: 'break1', name: '休息交流1（莉莉艾）', title: '休息时间的交流', rounds: regular, when: regularText,
      question: '休息时选择和谁搭话。', choices: [['莉莉艾', '红色随机150／300／400'], ['米依', '绿色随机150／300／400'], ['刚石', '蓝色随机150／300／400'], ['阿笔', '黄色随机150／300／400']],
      note: '莉莉艾是这一组的入口人物；进入后可选择表内其他人物。' },
    { id: 'break2', name: '休息交流2（哈乌）', title: '休息时间的交流2', rounds: regular, when: regularText,
      question: '休息时选择和谁搭话。', choices: [['哈乌', '红色随机150／300／400'], ['亚堤', '绿色随机150／300／400'], ['小茜', '蓝色随机150／300／400'], ['索妮亚', '黄色随机150／300／400']],
      note: '哈乌是这一组的入口人物；进入后可选择表内其他人物。' },
    { id: 'break3', name: '休息交流3（默丹）', title: '休息时间的交流3', rounds: regular, when: regularText,
      question: '休息时选择和谁搭话。', choices: [['默丹', '红色随机150／300／400'], ['斗也', '绿色随机150／300／400'], ['奇巴纳', '蓝色随机150／300／400']],
      note: '本组没有表内黄色选项。' },
    { id: 'break4', name: '休息交流4（梅洛可）', title: '休息时间的交流4', rounds: regular, when: regularText,
      question: '休息时选择和谁搭话。', choices: [['梅洛可', '红色随机150／300／400'], ['阿蜜', '绿色随机150／300／400'], ['阿塞萝拉', '蓝色随机150／300／400']],
      note: '本组没有表内黄色选项。' }
  ];
  const oak = { id: 'oak', name: '大木', title: '大木博士的宝可梦讲座', rounds: late, when: lateText,
    question: '参加宝可梦讲座。', choices: [['本次随机结果', '四色同时各30，或四色同时各400']],
    note: '不是随机单色。出400的5%仅为攻略作者说法，未独立核实；按实际所得选择30或400。' };
  const prizes = {
    'ball-guy': { colors: ['red', 'green', 'blue', 'yellow'], amounts: [420] },
    grimsley: { colors: ['yellow'], amounts: [30, 450] }, brock: { colors: ['red', 'green', 'blue'], amounts: [30, 90, 150, 210, 270, 330, 390, 450] },
    iono: { colors: ['red'], amounts: [30, 450] }, lance: { colors: ['green'], amounts: [30, 450] }, gloria: { colors: ['blue'], amounts: [30, 450] },
    n: { colors: ['red', 'green'], amounts: [150, 300, 450, 600] }, sycamore: { colors: ['blue', 'yellow'], amounts: [150, 300, 450, 600] },
    break1: { colors: ['red', 'green', 'blue', 'yellow'], amounts: [150, 300, 400] }, break2: { colors: ['red', 'green', 'blue', 'yellow'], amounts: [150, 300, 400] },
    break3: { colors: ['red', 'green', 'blue'], amounts: [150, 300, 400] }, break4: { colors: ['red', 'green', 'blue'], amounts: [150, 300, 400] },
    oak: { colors: ['red', 'green', 'blue', 'yellow'], amounts: [30, 400], simultaneous: true }
  };
  function outcomes(id) {
    const prize = prizes[id]; if (!prize) return [];
    if (prize.simultaneous) return prize.amounts.map(n => ({ red: n, green: n, blue: n, yellow: n }));
    return prize.colors.flatMap(c => prize.amounts.map(n => ({ red: 0, green: 0, blue: 0, yellow: 0, [c]: n })));
  }
  root.PasioDialogues = { events, oak, sources, prizes, outcomes, forRound: (round, all = false) => events.filter(event => all || event.rounds.includes(round)) };
  if (typeof module !== 'undefined') module.exports = root.PasioDialogues;
})(typeof window === 'undefined' ? globalThis : window);
