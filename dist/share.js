(function (root) {
  'use strict';
  const P = root.Pasio;
  const tiers = [
    { grade: 'D', min: 0, color: '#a8b1b4' },
    { grade: 'C', min: 500, color: '#73b6e6' },
    { grade: 'B', min: 1000, color: '#bb9aeb' },
    { grade: 'A', min: 2500, color: '#f1847c' },
    { grade: 'S', min: 4000, color: '#efc45e' },
    { grade: 'S+', min: 5000, color: '#ffe7a1' }
  ];
  // User-requested harvest rating borrows grid-rank cutoffs but counts earned four-color orbs only.
  function rating(total) { return [...tiers].reverse().find(t => total >= t.min) || tiers[0]; }
  function summary(s) {
    const { earned, tm } = P.totals(s), claims = s.candidates.filter(n => n.status === 'claimed');
    const total = P.sum(earned);
    return { earned, silver: tm.current, total, rating: rating(total), rounds: new Set(claims.map(n => n.round)).size };
  }
  function draw(canvas, data, qr) {
    canvas.width = 1080; canvas.height = 1600;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw Error('此浏览器无法生成分享图片。');
    const ink = '#173c34', muted = '#aac3b5', white = '#f0f5e7', lime = '#dcedb9';
    const palette = { red: '#de7c78', green: '#50b38b', blue: '#74abd2', yellow: '#d5ad49' };
    const names = { red: '红色', green: '绿色', blue: '蓝色', yellow: '黄色' };
    const fmt = n => n.toLocaleString('zh-CN');
    function text(value, x, y, size, color = white, weight = '400', align = 'left', maxWidth = 0) {
      ctx.textAlign = align; ctx.fillStyle = color;
      do { ctx.font = `${weight} ${size}px "Microsoft YaHei", "Segoe UI", sans-serif`; if (!maxWidth || ctx.measureText(value).width <= maxWidth || size <= 20) break; size--; } while (true);
      ctx.fillText(value, x, y);
    }
    function rect(x, y, w, h, color, radius = 0) { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill(); }
    function gem(x, y, color) {
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x + 17, y); ctx.lineTo(x + 34, y + 20); ctx.lineTo(x + 28, y + 46); ctx.lineTo(x + 17, y + 58); ctx.lineTo(x + 6, y + 46); ctx.lineTo(x, y + 20); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff38'; ctx.beginPath(); ctx.moveTo(x + 17, y); ctx.lineTo(x + 34, y + 20); ctx.lineTo(x + 28, y + 46); ctx.lineTo(x + 17, y + 58); ctx.closePath(); ctx.fill();
    }
    rect(0, 0, 1080, 1600, ink);
    text('帕希欧学院 · 武道熊师', 72, 100, 35, white, '600');
    text(`本轮已记录获得 · ${data.rounds} / 12 回合`, 72, 155, 26, muted);
    text('四色累计', 72, 242, 29, muted);
    text(fmt(data.total), 72, 355, 112, lime, '600', 'left', 660);
    text('学院评级', 1008, 242, 26, muted, '400', 'right');
    text(data.rating.grade, 1008, 352, 91, data.rating.color, '700', 'right', 238);
    rect(72, 398, 936, 2, '#3b5e50');
    const maximum = Math.max(1, ...Object.values(data.earned));
    P.colors.forEach((c, i) => {
      const y = 480 + i * 145;
      gem(72, y - 41, palette[c]);
      text(names[c], 130, y, 35, palette[c], '600');
      text(fmt(data.earned[c]), 1008, y, 38, white, '500', 'right', 600);
      rect(72, y + 32, 936, 12, '#31554a', 6);
      const width = 936 * data.earned[c] / maximum;
      if (width) rect(72, y + 32, width, 12, palette[c], Math.min(6, width / 2));
    });
    rect(72, 1020, 936, 2, '#3b5e50');
    gem(72, 1060, '#a7b6bc');
    text('银色 · 招式学习器滴晶', 130, 1102, 31, '#c7d3d7', '500');
    text(`${data.silver} / 3`, 1008, 1102, 38, white, '500', 'right');
    rect(72, 1134, 936, 12, '#31554a', 6);
    if (data.silver) rect(72, 1134, 936 * Math.min(1, data.silver / 3), 12, '#a7b6bc', 6);
    rect(72, 1200, 936, 2, '#3b5e50');
    rect(72, 1260, 80, 80, lime, 20);
    text('肥', 112, 1317, 46, ink, '700', 'center');
    text('肥佬出品', 174, 1316, 44, lime, '600');
    text('每一滴，都用在需要的地方。', 72, 1395, 26, muted);
    // shortcut: QR encodes the current canonical URL; regenerate share-qr.js if the site address changes.
    const moduleSize = 6, size = (qr.rows.length + 8) * moduleSize, qx = 1008 - size, qy = 1240;
    rect(qx, qy, size, size, '#ffffff');
    ctx.fillStyle = '#102c26';
    qr.rows.forEach((row, y) => [...row].forEach((bit, x) => { if (bit === '1') ctx.fillRect(qx + (x + 4) * moduleSize, qy + (y + 4) * moduleSize, moduleSize, moduleSize); }));
    return canvas;
  }
  root.PasioShare = { tiers, rating, summary, draw };
  if (typeof module !== 'undefined') module.exports = root.PasioShare;
})(typeof window === 'undefined' ? globalThis : window);
