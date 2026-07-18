/* fig-grand-tour — the whole journey on one canvas: terminal → TLS tunnel
   → internet → gateway → GPU pod, and back as a stream of tokens; then a
   tool_use branch sends a second, faster lap around. Loops continuously. */
'use strict';

Figures.register('fig-grand-tour', (container, kit) => {
  const cv = kit.makeCanvas(container, { height: 330 });
  const controls = kit.makeControls(container);
  const speed = kit.makeSlider(controls, {
    label: 'Speed', min: 0.3, max: 2.5, value: 1,
    format: v => v.toFixed(1) + '×',
  });

  const STAGES = [
    { id: 'send',     lap: 1, label: 'you press Enter',                          ms: '',             d: 0.7 },
    { id: 'tls',      lap: 1, label: 'TLS handshake — new connection',           ms: '~40 ms',       d: 1.6 },
    { id: 'net',      lap: 1, label: 'internet transit',                         ms: '~30 ms',       d: 1.1 },
    { id: 'gw',       lap: 1, label: 'gateway — route & queue',                  ms: '~10 ms',       d: 0.9 },
    { id: 'prefill',  lap: 1, label: 'prefill — whole prompt, one pass',         ms: '~300 ms',      d: 1.9 },
    { id: 'decode',   lap: 1, label: 'decode — one full pass per token',         ms: '~30 ms each',  d: 4.6 },
    { id: 'tool',     lap: 1, label: 'stop_reason: tool_use — CLI runs the tool', ms: '',            d: 1.9 },
    { id: 'send2',    lap: 2, label: 'POST again — connection still open',       ms: 'no handshake', d: 0.8 },
    { id: 'net2',     lap: 2, label: 'same tunnel, same route',                  ms: '~30 ms',       d: 0.9 },
    { id: 'gw2',      lap: 2, label: 'gateway',                                  ms: '~10 ms',       d: 0.5 },
    { id: 'prefill2', lap: 2, label: 'prefill — prompt cache hit',               ms: '~80 ms',       d: 1.1 },
    { id: 'decode2',  lap: 2, label: 'decode',                                   ms: '~30 ms each',  d: 4.0 },
    { id: 'rest',     lap: 2, label: 'one turn: several laps, under a minute',   ms: '',             d: 2.4 },
  ];
  const starts = [];
  let TOTAL = 0;
  for (const s of STAGES) { starts.push(TOTAL); TOTAL += s.d; }

  /* decode token streams */
  const TR = 1.1;                       /* travel time pod → terminal */
  const FULL = 'Fixed the flaky test. The mock was stale, so I updated it.';
  const SPLIT = 21;                     /* chars typed on lap 1 */
  const D1 = { n: 12, gap: (4.6 - TR - 0.25) / 12, cpt: SPLIT / 12 };
  const D2 = { n: 14, gap: (4.0 - TR - 0.25) / 14, cpt: (FULL.length - SPLIT) / 14 };

  let clock = 0;

  function arrivals(sp, dd) {
    if (sp < TR) return 0;
    return Math.min(dd.n, Math.floor((sp - TR) / dd.gap) + 1);
  }

  function wrap(str, maxChars) {
    const lines = [];
    let cur = '';
    for (const word of str.split(' ')) {
      const cand = cur ? cur + ' ' + word : word;
      if (cand.length <= maxChars || !cur) {
        cur = cand;
        while (cur.length > maxChars) { lines.push(cur.slice(0, maxChars)); cur = cur.slice(maxChars); }
      } else { lines.push(cur); cur = word; }
    }
    lines.push(cur);
    return lines;
  }

  function draw() {
    const { ctx, w, h } = cv;
    ctx.clearRect(0, 0, w, h);
    const m = 12;
    const time = clock % TOTAL;
    let si = 0;
    while (si < STAGES.length - 1 && time >= starts[si] + STAGES[si].d) si++;
    const stage = STAGES[si];
    const sp = time - starts[si];             /* stage-local seconds */
    const p = kit.clamp(sp / stage.d, 0, 1);  /* stage progress */

    /* ------- layout ------- */
    const yMid = h * 0.44;
    const yFwd = yMid + 16;
    const yRet = yMid - 26;
    const termW = kit.clamp(w * 0.17, 82, 136), termH = 92;
    const podW = kit.clamp(w * 0.21, 92, 156), podH = 104;
    const xA = m + termW;                      /* terminal right edge */
    const xB = w - m - podW;                   /* pod left edge */
    const span = xB - xA;
    const tunC = xA + span * 0.17, tunW = kit.clamp(span * 0.17, 34, 74), tunH = 24;
    const hopX = [0.4, 0.51, 0.62].map(f => xA + span * f);
    const hopY = [yFwd - 7, yFwd + 6, yFwd - 4];
    const gwC = xA + span * 0.83, gwW = kit.clamp(span * 0.15, 34, 66), gwH = 30;
    const nodes = [
      [xA, yFwd], [tunC - tunW / 2, yFwd], [tunC + tunW / 2, yFwd],
      [hopX[0], hopY[0]], [hopX[1], hopY[1]], [hopX[2], hopY[2]],
      [gwC - gwW / 2, yFwd], [gwC + gwW / 2, yFwd], [xB, yFwd],
    ];
    const pathPos = f => {
      f = kit.clamp(f, 0, 8);
      const i = Math.min(7, Math.floor(f)), u = f - i;
      return [kit.lerp(nodes[i][0], nodes[i + 1][0], u),
              kit.lerp(nodes[i][1], nodes[i + 1][1], u)];
    };

    /* ------- quiet scenery ------- */
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = PAL.grid;
    ctx.beginPath();
    ctx.moveTo(nodes[0][0], nodes[0][1]);
    for (let i = 1; i < nodes.length; i++) ctx.lineTo(nodes[i][0], nodes[i][1]);
    ctx.stroke();
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    ctx.moveTo(xB, yRet);
    ctx.lineTo(xA, yRet);
    ctx.stroke();
    ctx.setLineDash([]);

    /* tunnel */
    kit.roundedRect(ctx, tunC - tunW / 2, yFwd - tunH / 2, tunW, tunH, tunH / 2);
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = PAL.blueSoft;
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = PAL.blue;
    ctx.lineWidth = 1.3;
    ctx.stroke();

    /* internet hops */
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(hopX[i], hopY[i], 4, 0, Math.PI * 2);
      ctx.fillStyle = PAL.bg;
      ctx.fill();
      ctx.strokeStyle = PAL.faint;
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }

    /* gateway */
    kit.roundedRect(ctx, gwC - gwW / 2, yFwd - gwH / 2, gwW, gwH, 5);
    ctx.fillStyle = PAL.graySoft;
    ctx.fill();
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    /* ------- GPU pod with batching grid ------- */
    kit.roundedRect(ctx, xB, yMid - podH / 2, podW, podH, 8);
    ctx.fillStyle = PAL.graySoft;
    ctx.fill();
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    const rows = 5, cols = 8;
    const cs = Math.min(Math.floor((podW - 22) / cols) - 2, 9);
    const gw0 = cols * (cs + 2) - 2;
    const gx = xB + (podW - gw0) / 2;
    const gy = yMid - podH / 2 + 12;
    const inPod = stage.id.indexOf('prefill') === 0 || stage.id.indexOf('decode') === 0;
    let litCols = 0;
    if (stage.id.indexOf('prefill') === 0) litCols = Math.floor(p * cols) + 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ours = r === 2;
        let fill = ours ? PAL.orangeSoft : PAL.blueSoft;
        if (stage.id.indexOf('prefill') === 0 && c < litCols) fill = ours ? PAL.orange : PAL.blue;
        if (stage.id.indexOf('decode') === 0) {
          const cur = Math.floor(sp / 0.14) % cols;
          if (c === cur) fill = ours ? PAL.orange : PAL.blue;
        }
        if (!inPod) fill = ours ? PAL.orangeSoft : PAL.grid;
        ctx.fillStyle = fill;
        ctx.fillRect(gx + c * (cs + 2), gy + r * (cs + 2), cs, cs);
      }
    }
    /* token readout */
    ctx.font = '11px ' + PAL.mono;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = PAL.ink;
    let tokN = 0;
    if (stage.id === 'decode') tokN = arrivals(sp + TR, D1);
    else if (stage.id === 'decode2') tokN = arrivals(sp + TR, D2);
    else if (si > 5) tokN = si > 10 ? 0 : D1.n;
    ctx.fillText(inPod ? (stage.id.indexOf('prefill') === 0 ? 'reading prompt' : 'tok ' + tokN)
                       : 'idle', xB + podW / 2, yMid + podH / 2 - 10);

    /* ------- typed text so far ------- */
    let chars = 0;
    if (si > 5) chars = SPLIT;
    if (stage.id === 'decode') chars = Math.round(arrivals(sp, D1) * D1.cpt);
    if (stage.id === 'decode2') chars = SPLIT + Math.round(arrivals(sp, D2) * D2.cpt);
    if (si > 11) chars = FULL.length;
    chars = Math.min(chars, FULL.length);

    /* ------- terminal ------- */
    kit.roundedRect(ctx, m, yMid - termH / 2, termW, termH, 8);
    ctx.fillStyle = PAL.inkStrong;
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(m + 2, yMid - termH / 2 + 2, termW - 4, termH - 4);
    ctx.clip();
    ctx.font = '11px ' + PAL.mono;
    ctx.textAlign = 'left';
    const charW = ctx.measureText('M').width;
    const maxChars = Math.max(6, Math.floor((termW - 16) / charW));
    const allLines = [{ s: '> fix the test', c: PAL.green }]
      .concat(wrap(FULL.slice(0, chars), maxChars).map(s => ({ s, c: PAL.bg })));
    const maxLines = 5;
    const vis = allLines.slice(-maxLines);
    let ty = yMid - termH / 2 + 18;
    for (const ln of vis) {
      ctx.fillStyle = ln.c;
      ctx.fillText(ln.s, m + 8, ty);
      ty += 14;
    }
    if (stage.id.indexOf('decode') === 0 && clock % 0.8 < 0.55) {
      const last = vis[vis.length - 1];
      ctx.fillStyle = PAL.bg;
      ctx.fillRect(m + 8 + last.s.length * charW + 1, ty - 14 - 9, charW, 11);
    }
    ctx.restore();

    /* ------- station labels ------- */
    ctx.font = '11px ' + PAL.sans;
    ctx.textAlign = 'center';
    ctx.fillStyle = PAL.faint;
    const labY = yMid + termH / 2 + 16;
    ctx.fillText('terminal', m + termW / 2, labY);
    ctx.fillText('TLS', tunC, labY);
    ctx.fillText('internet', hopX[1], labY);
    ctx.fillText('gateway', gwC, labY);
    ctx.fillText('GPU pod', xB + podW / 2, labY);

    /* ------- the request pulse ------- */
    let pf = null, palpha = 1;
    if (stage.id === 'send') pf = 0;
    else if (stage.id === 'tls') {
      pf = p < 0.62 ? 1 + 0.9 * Math.sin((p / 0.62) * Math.PI * 2.5 - Math.PI / 2)
                    : kit.lerp(1, 2, (p - 0.62) / 0.38);
    }
    else if (stage.id === 'net') pf = kit.lerp(2, 6, kit.ease.inOut(p));
    else if (stage.id === 'gw') pf = kit.lerp(6, 8, kit.ease.inOut(p));
    else if (stage.id === 'prefill' || stage.id === 'prefill2') { pf = 8; palpha = 1 - p; }
    else if (stage.id === 'send2') pf = kit.lerp(0, 2, kit.ease.in(p));
    else if (stage.id === 'net2') pf = kit.lerp(2, 6, kit.ease.inOut(p));
    else if (stage.id === 'gw2') pf = kit.lerp(6, 8, kit.ease.inOut(p));
    if (pf !== null && palpha > 0) {
      const [px, py] = pathPos(pf);
      ctx.save();
      ctx.globalAlpha = 0.25 * palpha;
      ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.fillStyle = PAL.blue; ctx.fill();
      ctx.globalAlpha = palpha;
      ctx.beginPath(); ctx.arc(px, py, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = PAL.blueDark; ctx.fill();
      ctx.restore();
    }

    /* ------- the token stream coming home ------- */
    if (stage.id.indexOf('decode') === 0) {
      const dd = stage.id === 'decode' ? D1 : D2;
      for (let i = 0; i < dd.n; i++) {
        const born = i * dd.gap;
        const q = (sp - born) / TR;
        if (q < 0 || q >= 1) continue;
        const tx = kit.lerp(xB, xA, q);
        ctx.fillStyle = PAL.orange;
        ctx.fillRect(tx - 2.5, yRet - 2.5, 5, 5);
      }
    }

    /* ------- tool_use interlude ------- */
    if (stage.id === 'tool') {
      const a = kit.clamp(p * 4, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = '11px ' + PAL.mono;
      const label = 'tool_use: Edit';
      const lw = ctx.measureText(label).width + 16;
      const cx = kit.clamp(m + termW / 2, m + lw / 2, w - m - lw / 2);
      const cy = yMid - termH / 2 - 22;
      kit.roundedRect(ctx, cx - lw / 2, cy - 11, lw, 22, 6);
      ctx.fillStyle = PAL.purpleSoft; ctx.fill();
      ctx.strokeStyle = PAL.purple; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = PAL.purple;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cx, cy + 1);
      ctx.restore();
      ctx.textBaseline = 'alphabetic';
    }

    /* ------- lap-2 annotation ------- */
    if (stage.lap === 2 && stage.id !== 'rest') {
      ctx.font = '11px ' + PAL.sans;
      ctx.textAlign = 'center';
      ctx.fillStyle = PAL.blueDark;
      ctx.fillText('second lap — warm connection + prompt cache', w / 2, 20);
    }

    /* ------- stage readout ------- */
    kit.roundedRect(ctx, m, h - 36, w - 2 * m, 26, 7);
    ctx.fillStyle = PAL.graySoft;
    ctx.fill();
    ctx.font = '11.5px ' + PAL.sans;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PAL.inkStrong;
    let text = stage.label + (stage.ms ? '  ·  ' + stage.ms : '');
    if (ctx.measureText(text).width > w - 2 * m - 12) ctx.font = '11px ' + PAL.sans;
    ctx.fillText(text, w / 2, h - 23);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  cv.onResize(draw);
  const loop = kit.animLoop(dt => {
    clock += dt * speed.value;
    draw();
  });
  draw();

  kit.caption(container, 'The full round trip, then a <code>tool_use</code> lap: the second ' +
    'request reuses the open connection and hits the prompt cache, so almost all of its ' +
    'time is spent in decode — one forward pass per token, streamed home as it happens.');
  return loop;
});
