/* fig-grand-tour — the whole journey on one canvas: terminal → TLS tunnel
   → internet → gateway → GPU pod, and back as a stream of tokens; then a
   tool_use branch sends a second, faster lap around. Loops continuously.

   Level-aware:
   - novice: the whole trip in plain language — your computer, the
     internet, Anthropic's computers — with the answer streaming home and
     a quick second lap when a tool is used. No jargon, no controls.
   - mid: the standard figure (unchanged).
   - deep: adds a running elapsed-latency readout, a time-to-first-token
     marker, per-token decode cadence, and a latency-class tag per stage. */
'use strict';

Figures.register('fig-grand-tour', (container, kit) => {
  const level = kit.level();
  const deep = level === 'deep';

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

  /* ================================================================
     NOVICE — the whole trip at a glance: your computer → the internet →
     Anthropic's computers → back as words, then a quick second lap when
     a tool is used. Self-running, no controls.
     ================================================================ */
  if (level === 'novice') {
    const cv = kit.makeCanvas(container, { height: 320,
      ariaLabel: 'The whole trip: your question travels across the internet to Anthropic’s computers and the answer comes back word by word, then makes a quick second lap when a tool is used.' });

    const FULL = 'Fixed the flaky test. The mock was stale, so I updated it.';
    const SPLIT = 21;
    const SN = [
      { id: 'send',   label: 'you send your question',              lap: 1, d: 1.0 },
      { id: 'out',    label: 'across the internet',                 lap: 1, d: 1.3 },
      { id: 'think',  label: 'the computers work it out',           lap: 1, d: 1.8 },
      { id: 'back',   label: 'the answer comes back, word by word', lap: 1, d: 3.0 },
      { id: 'tool',   label: 'a tool is used — going around again', lap: 2, d: 1.6 },
      { id: 'out2',   label: 'across the internet again',           lap: 2, d: 1.0 },
      { id: 'think2', label: 'the computers work again',            lap: 2, d: 1.3 },
      { id: 'back2',  label: 'the rest of the answer comes back',   lap: 2, d: 2.6 },
      { id: 'done',   label: 'all done — usually within a minute', lap: 2, d: 2.0 },
    ];
    const starts = [];
    let TOTAL = 0;
    for (const s of SN) { starts.push(TOTAL); TOTAL += s.d; }

    let clock = 0;
    const TR = 1.0;                       /* token travel time home */

    function drawN() {
      const { ctx, w, h } = cv;
      ctx.clearRect(0, 0, w, h);
      const m = 12;
      const time = clock % TOTAL;
      let si = 0;
      while (si < SN.length - 1 && time >= starts[si] + SN[si].d) si++;
      const stage = SN[si];
      const sp = time - starts[si];
      const p = kit.clamp(sp / stage.d, 0, 1);

      const yMid = h * 0.4;
      const yFwd = yMid + 14;
      const yRet = yMid - 22;
      const termW = kit.clamp(w * 0.2, 92, 150), termH = 96;
      const boxW = kit.clamp(w * 0.26, 110, 190), boxH = 108;
      const xA = m + termW;
      const xB = w - m - boxW;
      const span = xB - xA;
      const hopX = [0.32, 0.5, 0.68].map(f => xA + span * f);

      /* path line + return line */
      ctx.strokeStyle = PAL.grid;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(xA, yFwd);
      ctx.lineTo(xB, yFwd);
      ctx.stroke();
      ctx.setLineDash([2, 5]);
      ctx.beginPath();
      ctx.moveTo(xB, yRet);
      ctx.lineTo(xA, yRet);
      ctx.stroke();
      ctx.setLineDash([]);

      /* internet hops */
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(hopX[i], yFwd, 5, 0, Math.PI * 2);
        ctx.fillStyle = PAL.bg;
        ctx.fill();
        ctx.strokeStyle = PAL.faint;
        ctx.lineWidth = 1.3;
        ctx.stroke();
      }

      /* the big box: Anthropic's computers */
      const busy = stage.id === 'think' || stage.id === 'think2';
      kit.roundedRect(ctx, xB, yMid - boxH / 2, boxW, boxH, 10);
      ctx.fillStyle = busy ? PAL.blueSoft : PAL.graySoft;
      ctx.fill();
      ctx.strokeStyle = busy ? PAL.blue : PAL.ink;
      ctx.lineWidth = 1.3;
      ctx.stroke();
      /* a little grid of workers, lit while thinking */
      const rows = 4, cols = 5, cs = Math.min(Math.floor((boxW - 28) / cols) - 3, 12);
      const gw0 = cols * (cs + 3) - 3;
      const gx = xB + (boxW - gw0) / 2, gy = yMid - boxH / 2 + 14;
      const lit = busy ? Math.floor(p * cols * rows) + 1 : 0;
      let n = 0;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (busy && n < lit) ? PAL.blue : PAL.blueSoft;
        ctx.fillRect(gx + c * (cs + 3), gy + r * (cs + 3), cs, cs);
        n++;
      }

      /* how much of the answer has arrived */
      let chars = 0;
      if (si > 3) chars = SPLIT;
      if (stage.id === 'back') chars = Math.round(kit.clamp((sp) / stage.d, 0, 1) * SPLIT);
      if (stage.id === 'back2') chars = SPLIT + Math.round(p * (FULL.length - SPLIT));
      if (si > 7) chars = FULL.length;
      chars = Math.min(chars, FULL.length);

      /* terminal */
      kit.roundedRect(ctx, m, yMid - termH / 2, termW, termH, 8);
      ctx.fillStyle = PAL.panel;
      ctx.fill();
      ctx.strokeStyle = PAL.panelEdge;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.save();
      ctx.beginPath();
      ctx.rect(m + 2, yMid - termH / 2 + 2, termW - 4, termH - 4);
      ctx.clip();
      ctx.font = '12px ' + PAL.mono;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      const charW = ctx.measureText('M').width;
      const maxChars = Math.max(6, Math.floor((termW - 18) / charW));
      const allLines = [{ s: '> fix the test', c: PAL.green }]
        .concat(wrap(FULL.slice(0, chars), maxChars).map(s => ({ s, c: PAL.panelInk })));
      const vis = allLines.slice(-5);
      let ty = yMid - termH / 2 + 20;
      for (const ln of vis) { ctx.fillStyle = ln.c; ctx.fillText(ln.s, m + 8, ty); ty += 16; }
      ctx.restore();

      /* station labels */
      ctx.font = '12px ' + PAL.sans;
      ctx.textAlign = 'center';
      ctx.fillStyle = PAL.faint;
      const labY = yMid + Math.max(termH, boxH) / 2 + 20;
      ctx.fillText('your computer', m + termW / 2, labY);
      ctx.fillText('the internet', hopX[1], labY);
      ctx.fillText('Anthropic’s computers', xB + boxW / 2, labY);

      /* the request travelling out */
      const outgoing = stage.id === 'send' || stage.id === 'out' || stage.id === 'out2' ||
                       stage.id === 'tool';
      if (outgoing) {
        let f = p;
        if (stage.id === 'tool') f = kit.clamp(p * 1.5, 0, 1);
        const px = kit.lerp(xA, xB, kit.ease.inOut(f));
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.beginPath(); ctx.arc(px, yFwd, 10, 0, Math.PI * 2);
        ctx.fillStyle = PAL.blue; ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(px, yFwd, 5, 0, Math.PI * 2);
        ctx.fillStyle = PAL.blueDark; ctx.fill();
        ctx.restore();
      }

      /* words streaming home */
      if (stage.id === 'back' || stage.id === 'back2') {
        const nTok = stage.id === 'back' ? 6 : 8;
        const gap = (stage.d - TR - 0.2) / nTok;
        for (let i = 0; i < nTok; i++) {
          const q = (sp - i * gap) / TR;
          if (q < 0 || q >= 1) continue;
          const tx = kit.lerp(xB, xA, q);
          ctx.fillStyle = PAL.orange;
          ctx.fillRect(tx - 3, yRet - 3, 6, 6);
        }
      }

      /* narration bar */
      kit.roundedRect(ctx, m, h - 34, w - 2 * m, 26, 7);
      ctx.fillStyle = stage.lap === 2 ? PAL.orangeSoft : PAL.graySoft;
      ctx.fill();
      ctx.font = '12.5px ' + PAL.sans;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = PAL.inkStrong;
      let text = stage.label;
      if (ctx.measureText(text).width > w - 2 * m - 12) ctx.font = '11px ' + PAL.sans;
      ctx.fillText(text, w / 2, h - 21);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    cv.onResize(drawN);
    const loop = kit.animLoop(dt => { clock += dt; drawN(); });
    drawN();

    kit.caption(container, 'The whole trip at a glance: your question crosses the internet to ' +
      'Anthropic’s computers, and the answer comes back word by word — then makes a quick ' +
      'second lap when a tool is used, all of it usually within a minute.');
    return loop;
  }

  /* ================================================================
     MID + DEEP
     ================================================================ */
  const cv = kit.makeCanvas(container, { height: deep ? 356 : 330,
    ariaLabel: deep
      ? 'The full round trip from terminal through TLS tunnel, internet, gateway, and GPU pod and back as streamed tokens, with a running elapsed-latency readout, a time-to-first-token marker, and a per-token decode cadence; then a faster second lap on a tool call.'
      : 'The full round trip from terminal through TLS tunnel, internet, gateway, and GPU pod and back as streamed tokens, then a faster second lap triggered by a tool call.' });
  const controls = kit.makeControls(container);
  const speed = kit.makeSlider(controls, {
    label: 'Speed', min: 0.3, max: 2.5, value: 1,
    format: v => v.toFixed(1) + '×',
  });

  /* deep-only fields lat (ms) and cls (latency class) are ignored by mid */
  const STAGES = [
    { id: 'send',     lap: 1, label: 'you press Enter',                          ms: '',             d: 0.7, lat: 0,   cls: 'local' },
    { id: 'tls',      lap: 1, label: 'TLS handshake — new connection',           ms: '~40 ms',       d: 1.6, lat: 40,  cls: 'network' },
    { id: 'net',      lap: 1, label: 'internet transit',                         ms: '~30 ms',       d: 1.1, lat: 30,  cls: 'network' },
    { id: 'gw',       lap: 1, label: 'gateway — route & queue',                  ms: '~10 ms',       d: 0.9, lat: 10,  cls: 'queue' },
    { id: 'prefill',  lap: 1, label: 'prefill — whole prompt, one pass',         ms: '~300 ms',      d: 1.9, lat: 300, cls: 'prefill' },
    { id: 'decode',   lap: 1, label: 'decode — one full pass per token',         ms: '~30 ms each',  d: 4.6, lat: 360, cls: 'decode' },
    { id: 'tool',     lap: 1, label: 'stop_reason: tool_use — CLI runs the tool', ms: '',            d: 1.9, lat: 0,   cls: 'local' },
    { id: 'send2',    lap: 2, label: 'POST again — connection still open',       ms: 'no handshake', d: 0.8, lat: 0,   cls: 'network' },
    { id: 'net2',     lap: 2, label: 'same tunnel, same route',                  ms: '~30 ms',       d: 0.9, lat: 30,  cls: 'network' },
    { id: 'gw2',      lap: 2, label: 'gateway',                                  ms: '~10 ms',       d: 0.5, lat: 10,  cls: 'queue' },
    { id: 'prefill2', lap: 2, label: 'prefill — prompt cache hit',               ms: '~80 ms',       d: 1.1, lat: 80,  cls: 'prefill' },
    { id: 'decode2',  lap: 2, label: 'decode',                                   ms: '~30 ms each',  d: 4.0, lat: 420, cls: 'decode' },
    { id: 'rest',     lap: 2, label: 'one turn: several laps, under a minute',   ms: '',             d: 2.4, lat: 0,   cls: 'local' },
  ];
  const starts = [];
  let TOTAL = 0;
  for (const s of STAGES) { starts.push(TOTAL); TOTAL += s.d; }

  /* time-to-first-token (lap 1): network + queue + prefill + one decode step */
  let TTFT = 30;
  for (let i = 0; i < 5; i++) TTFT += STAGES[i].lat;

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
    let podLabel;
    if (!inPod) podLabel = 'idle';
    else if (stage.id.indexOf('prefill') === 0) podLabel = 'reading prompt';
    else podLabel = 'tok ' + tokN + (deep ? '  ·  ~33 tok/s' : '');
    ctx.fillText(podLabel, xB + podW / 2, yMid + podH / 2 - 10);

    /* ------- typed text so far ------- */
    let chars = 0;
    if (si > 5) chars = SPLIT;
    if (stage.id === 'decode') chars = Math.round(arrivals(sp, D1) * D1.cpt);
    if (stage.id === 'decode2') chars = SPLIT + Math.round(arrivals(sp, D2) * D2.cpt);
    if (si > 11) chars = FULL.length;
    chars = Math.min(chars, FULL.length);

    /* ------- terminal ------- */
    kit.roundedRect(ctx, m, yMid - termH / 2, termW, termH, 8);
    ctx.fillStyle = PAL.panel;
    ctx.fill();
    ctx.strokeStyle = PAL.panelEdge;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.rect(m + 2, yMid - termH / 2 + 2, termW - 4, termH - 4);
    ctx.clip();
    ctx.font = '11px ' + PAL.mono;
    ctx.textAlign = 'left';
    const charW = ctx.measureText('M').width;
    const maxChars = Math.max(6, Math.floor((termW - 16) / charW));
    const allLines = [{ s: '> fix the test', c: PAL.green }]
      .concat(wrap(FULL.slice(0, chars), maxChars).map(s => ({ s, c: PAL.panelInk })));
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
      ctx.fillStyle = PAL.panelInk;
      ctx.fillRect(m + 8 + last.s.length * charW + 1, ty - 14 - 9, charW, 11);
    }
    ctx.restore();

    /* ------- station labels ------- */
    ctx.font = '11px ' + PAL.sans;
    ctx.textAlign = 'center';
    ctx.fillStyle = PAL.faint;
    const labY = yMid + termH / 2 + 16;
    const narrow = w < 560;
    ctx.fillText('terminal', m + termW / 2, labY);
    ctx.fillText('TLS', tunC, labY);
    ctx.fillText('internet', hopX[1], labY);
    ctx.fillText(narrow ? 'gw' : 'gateway', gwC, labY);
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
      ctx.fillText(deep ? 'lap 2 — warm connection + prompt cache'
                        : 'second lap — warm connection + prompt cache', w / 2, 20);
    }

    /* ------- deep: latency HUD ------- */
    if (deep) {
      /* running elapsed latency, accumulated across the laps so far */
      let base = 0;
      for (let i = 0; i < si; i++) base += STAGES[i].lat;
      const elapsed = Math.round(base + stage.lat * p);
      ctx.font = '11px ' + PAL.sans;
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'right';
      ctx.fillStyle = PAL.faint;
      ctx.fillText('elapsed ≈ ' + elapsed.toLocaleString('en-US') + ' ms', w - m, 20);
      /* time-to-first-token, once decoding starts on lap 1 (no lap-2 banner then) */
      if (stage.lap === 1 && si >= 5) {
        ctx.textAlign = 'left';
        ctx.fillStyle = PAL.orangeDark;
        ctx.fillText('first token ≈ ' + TTFT + ' ms', m, 20);
      }
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
    if (deep) text = '[' + stage.cls + ']  ' + text;
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

  kit.caption(container, deep
    ? 'The full round trip with its latency budget: a class tag and duration on each stage, a ' +
      'running <code>elapsed</code> total, the time-to-first-token once decode begins, and the ~33 tok/s ' +
      'decode cadence. The second lap skips the handshake and hits the prompt cache, so almost all its ' +
      'time is per-token decode.'
    : 'The full round trip, then a <code>tool_use</code> lap: the second ' +
      'request reuses the open connection and hits the prompt cache, so almost all of its ' +
      'time is spent in decode — one forward pass per token, streamed home as it happens.');
  return loop;
});
