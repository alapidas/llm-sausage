'use strict';
/* fig-attention — one attention head at a time, over a fixed sentence.
   Hover/tap a token: arcs to every earlier token, thickness = weight.
   Three hand-designed pseudo-heads; weights are illustrative only. */
Figures.register('fig-attention', (container, kit) => {
  const cv = kit.makeCanvas(container, { height: 340,
    ariaLabel: 'Diagram of one attention head over a fixed sentence, showing which earlier words each token draws from as weighted arcs and bars.' });
  const ctx = cv.ctx;
  const canvas = cv.canvas;
  canvas.tabIndex = 0;   /* keyboard-focusable so tokens can be stepped with arrows */

  const TOKENS = ['The', 'engineer', 'fixed', 'the', 'test', 'because', 'it', 'was', 'failing'];
  const N = TOKENS.length;

  function rgba(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  /* Build a normalized causal weight matrix from a sparse spec.
     raw[i] = {j: rawWeight}; rows without a spec get a mild default. */
  function buildHead(raw) {
    const W = [];
    for (let i = 0; i < N; i++) {
      const row = new Array(N).fill(0);
      const spec = raw[i];
      if (spec) {
        for (const k in spec) { if (+k <= i) row[+k] = spec[k]; }
      } else {
        row[i] = 3;
        for (let j = 0; j < i; j++) row[j] = 0.5;
      }
      let s = 0;
      for (let j = 0; j <= i; j++) s += row[j];
      if (s <= 0) { row[i] = 1; s = 1; }
      for (let j = 0; j <= i; j++) row[j] /= s;
      W.push(row);
    }
    return W;
  }

  const prevRaw = { 0: { 0: 1 } };
  for (let i = 1; i < N; i++) {
    const o = {};
    o[i - 1] = 10;
    if (i > 1) o[i - 2] = 2;
    o[i] = 1;
    prevRaw[i] = o;
  }
  const synRaw = {
    0: { 0: 1 },
    1: { 0: 8, 1: 2 },
    2: { 1: 9, 0: 1, 2: 2 },
    3: { 2: 6, 3: 2, 1: 1 },
    4: { 2: 6, 3: 5, 4: 2, 1: 1 },
    5: { 2: 6, 4: 3, 5: 2 },
    6: { 5: 5, 6: 2, 2: 2, 4: 2 },
    7: { 6: 8, 7: 2, 5: 1 },
    8: { 7: 6, 6: 4, 4: 2, 8: 1 },
  };
  const corefRaw = {
    6: { 4: 12, 1: 3, 6: 1.5, 0: 0.5, 2: 0.5, 5: 0.5 },
    8: { 6: 5, 4: 4, 8: 2, 7: 1 },
  };
  const HEADS = [
    { name: 'previous-word head', W: buildHead(prevRaw) },
    { name: 'syntax head', W: buildHead(synRaw) },
    { name: 'coreference head', W: buildHead(corefRaw) },
  ];

  let head = 2;          /* start on the coreference head */
  let sel = 6;           /* start on "it" */
  let hover = -1;
  let kbFocus = false;   /* true while the canvas has keyboard focus */
  let cycleT = 0;
  const disp = HEADS[head].W[sel].slice();

  /* --- controls: head selector buttons --- */
  const controls = kit.makeControls(container);
  const btnWrap = document.createElement('div');
  btnWrap.style.display = 'flex';
  btnWrap.style.flexWrap = 'wrap';
  btnWrap.style.justifyContent = 'center';
  btnWrap.style.gap = '0.5rem';
  controls.appendChild(btnWrap);
  const btns = HEADS.map((hd, i) => kit.makeButton(btnWrap, hd.name, () => {
    head = i;
    syncBtns();
  }));
  function syncBtns() {
    btns.forEach((b, i) => {
      b.style.background = i === head ? PAL.blueSoft : '';
      b.style.borderColor = i === head ? PAL.blue : '';
    });
  }
  syncBtns();

  /* --- layout: one row of token boxes, font shrinks to fit --- */
  let boxes = [];
  let fontSize = 13;
  function layout() {
    const w = cv.w;
    for (const s of [14, 13, 12, 11]) {
      ctx.font = '600 ' + s + 'px ' + PAL.sans;
      const pad = Math.max(4, s * 0.42);
      const gap = Math.max(3, s * 0.3);
      const widths = TOKENS.map(t => ctx.measureText(t).width + pad * 2);
      const total = widths.reduce((a, b) => a + b, 0) + gap * (N - 1);
      if (total <= w - 12 || s === 11) {
        fontSize = s;
        let scale = 1;
        if (total > w - 8) scale = (w - 8 - gap * (N - 1)) / (total - gap * (N - 1));
        const boxH = s + 14;
        const ty = cv.h - 84 - boxH - 12;
        let x = Math.max(4, (w - Math.min(total, w - 8)) / 2);
        boxes = widths.map(bw => {
          const b = { x: x, w: bw * scale, y: ty, h: boxH };
          x += bw * scale + gap;
          return b;
        });
        return;
      }
    }
  }

  /* ellipsize a token label to fit a shrunken chip (font stays >= 11px) */
  function fitLabel(str, maxW) {
    if (ctx.measureText(str).width <= maxW) return str;
    let s = str;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
  }

  function draw() {
    const w = cv.w, h = cv.h;
    ctx.clearRect(0, 0, w, h);
    layout();

    /* header line */
    ctx.font = '11px ' + PAL.sans;
    ctx.fillStyle = PAL.faint;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(HEADS[head].name + ' — where “' + TOKENS[sel] + '” looks', 10, 16);

    /* arcs from the selected token to earlier ones */
    for (let j = 0; j < sel; j++) {
      const v = disp[j];
      if (v < 0.02) continue;
      const a = boxes[sel], b = boxes[j];
      const x1 = a.x + a.w / 2;
      const x2 = b.x + b.w / 2;
      const y0 = a.y - 4;
      const lift = Math.min(a.y - 28, 16 + Math.abs(x1 - x2) * 0.34);
      ctx.strokeStyle = rgba(PAL.blueDark, 0.14 + 0.8 * Math.min(1, v));
      ctx.lineWidth = 1 + 6 * v;
      ctx.beginPath();
      ctx.moveTo(x1, y0);
      ctx.quadraticCurveTo((x1 + x2) / 2, y0 - lift, x2, y0);
      ctx.stroke();
      ctx.fillStyle = rgba(PAL.blueDark, 0.3 + 0.7 * Math.min(1, v));
      ctx.beginPath();
      ctx.arc(x2, y0, 1.5 + 3.5 * v, 0, Math.PI * 2);
      ctx.fill();
    }

    /* token boxes */
    ctx.font = '600 ' + fontSize + 'px ' + PAL.sans;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let j = 0; j < N; j++) {
      const b = boxes[j];
      kit.roundedRect(ctx, b.x, b.y, b.w, b.h, 5);
      if (j === sel) {
        ctx.fillStyle = PAL.orangeSoft;
        ctx.fill();
        ctx.strokeStyle = PAL.orange;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.fillStyle = PAL.graySoft;
        ctx.fill();
        if (j < sel && disp[j] > 0.02) {
          ctx.fillStyle = rgba(PAL.blue, 0.55 * Math.min(1, disp[j]));
          ctx.fill();
        }
        ctx.strokeStyle = PAL.grid;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.fillStyle = j > sel ? PAL.faint : PAL.inkStrong;
      ctx.fillText(fitLabel(TOKENS[j], b.w - 6), b.x + b.w / 2, b.y + b.h / 2 + 0.5);
    }

    /* bar chart of weights below */
    const yB = h - 18;
    const barMax = 58;
    ctx.strokeStyle = PAL.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(boxes[0].x, yB + 0.5);
    ctx.lineTo(boxes[N - 1].x + boxes[N - 1].w, yB + 0.5);
    ctx.stroke();
    ctx.font = '11px ' + PAL.sans;
    for (let j = 0; j <= sel; j++) {
      const v = disp[j];
      const b = boxes[j];
      const bw = kit.clamp(b.w * 0.6, 6, 22);
      const bx = b.x + b.w / 2 - bw / 2;
      const bh = Math.max(1, v * barMax);
      ctx.fillStyle = j === sel ? PAL.orange : PAL.blue;
      ctx.fillRect(bx, yB - bh, bw, bh);
      if (v > 0.12 && b.w > 32) {
        ctx.fillStyle = PAL.faint;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(Math.round(v * 100) + '%', b.x + b.w / 2, yB - bh - 4);
      }
    }
    ctx.fillStyle = PAL.faint;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('softmax weights', 10, h - 5);
  }

  /* --- pointer interaction --- */
  function hitTest(p) {
    if (!boxes.length) return -1;
    const b0 = boxes[0];
    if (p.y < b0.y - 16 || p.y > b0.y + b0.h + 8) return -1;   /* keep the bar chart out of selection */
    for (let i = 0; i < N; i++) {
      const b = boxes[i];
      if (p.x >= b.x - 2 && p.x <= b.x + b.w + 2) return i;
    }
    return -1;
  }
  function onPointer(ev) {
    const i = hitTest(cv.pointer(ev));
    hover = i;
    canvas.style.cursor = i >= 0 ? 'pointer' : 'default';
    if (i >= 0) { sel = i; cycleT = 0; }
  }
  canvas.addEventListener('pointermove', onPointer);
  canvas.addEventListener('pointerdown', onPointer);
  canvas.addEventListener('pointerleave', () => { hover = -1; cycleT = 0; canvas.style.cursor = 'default'; });

  /* keyboard: arrows step the selected token, pausing the auto-cycle while focused */
  canvas.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
      ev.preventDefault();
      kbFocus = true;
      sel = kit.clamp(sel + (ev.key === 'ArrowRight' ? 1 : -1), 0, N - 1);
      cycleT = 0;
    }
  });
  canvas.addEventListener('focus', () => { kbFocus = true; });
  canvas.addEventListener('blur', () => { kbFocus = false; });

  const loop = kit.animLoop(dt => {
    if (hover < 0 && !kbFocus) {
      cycleT += dt;
      if (cycleT > 2.6) {
        cycleT = 0;
        sel = sel >= N - 1 ? 1 : sel + 1;
      }
    }
    const target = HEADS[head].W[sel];
    const k = Math.min(1, dt * 9);
    for (let j = 0; j < N; j++) disp[j] += (target[j] - disp[j]) * k;
    draw();
  });

  cv.onResize(draw);
  draw();
  kit.caption(container,
    'One attention head at a time: hover or tap a word to see which earlier tokens it draws from ' +
    '(arc thickness and the bars show the softmax weights; grayed words lie in the masked future). ' +
    'The weights are hand-made, but note the coreference head sending “it” back to “test”.');
  return loop;
});
