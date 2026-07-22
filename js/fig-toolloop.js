/* fig-toolloop — sequence diagram of one multi-step exchange between
   you, Claude Code, and the API, with API-call and token counters.

   Level-aware:
   - novice: the same back-and-forth in plain language (no tokens, no
     protocol names), self-running, no controls.
   - mid: the standard figure (unchanged).
   - deep: adds stop_reason tags on each return and a cache-read vs
     freshly-prefilled token breakdown on each re-entry. */
'use strict';

Figures.register('fig-toolloop', (container, kit) => {
  const level = kit.level();
  const deep = level === 'deep';

  const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const k = n => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n));

  /* ================================================================
     NOVICE — one idea: a single question can loop several times; the
     model asks to use a tool, your computer does it, the result goes
     back. No tokens, no protocol names, no controls.
     ================================================================ */
  if (level === 'novice') {
    const cv = kit.makeCanvas(container, { height: 400,
      ariaLabel: 'A step-by-step exchange between you, Claude Code, and Claude: Claude asks to open a file, you approve, your computer opens it, and the result goes back for Claude to finish the answer.' });

    const SN = [
      { kind: 'msg',    a: 0, b: 1, l: '"fix the test"',       c: PAL.green,  d: 1.0 },
      { kind: 'msg',    a: 1, b: 2, l: 'sends your question',  c: PAL.blue,   d: 1.0 },
      { kind: 'stream', a: 2, b: 1, l: 'asks to open a file',  c: PAL.purple, d: 1.4 },
      { kind: 'msg',    a: 1, b: 0, l: 'OK to open it?',       c: PAL.red,    d: 0.9 },
      { kind: 'wait',   a: 0,       l: 'you say yes',          c: PAL.orange, d: 1.3 },
      { kind: 'self',   a: 1,       l: 'opens the file',       c: PAL.teal,   d: 1.0 },
      { kind: 'msg',    a: 1, b: 2, l: 'sends what it found',  c: PAL.blue,   d: 1.0 },
      { kind: 'stream', a: 2, b: 1, l: '"all fixed"',          c: PAL.orange, d: 1.4 },
      { kind: 'msg',    a: 1, b: 0, l: 'shows you the answer', c: PAL.green,  d: 1.0 },
    ];
    const startsN = [];
    let TOT = 0.5;
    for (const s of SN) { startsN.push(TOT); TOT += s.d; }
    const END = TOT + 1.6;

    let time = 0;

    function drawN() {
      const { ctx, w, h } = cv;
      ctx.clearRect(0, 0, w, h);
      const laneX = [0.15, 0.5, 0.85].map(f => Math.round(f * w));
      const names = ['You', 'Claude Code', 'Claude'];
      const laneFill = [PAL.greenSoft, PAL.blueSoft, PAL.orangeSoft];
      const laneEdge = [PAL.green, PAL.blue, PAL.orange];
      const topY = 60;
      const botY = h - 22;
      const rowH = (botY - topY) / SN.length;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = PAL.grid;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(laneX[i], 46);
        ctx.lineTo(laneX[i], botY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '13px ' + PAL.sans;
        const bw = Math.min(ctx.measureText(names[i]).width + 22, w / 3 - 6);
        kit.roundedRect(ctx, laneX[i] - bw / 2, 8, bw, 28, 8);
        ctx.fillStyle = laneFill[i];
        ctx.fill();
        ctx.strokeStyle = laneEdge[i];
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.fillStyle = PAL.inkStrong;
        ctx.fillText(names[i], laneX[i], 22);
      }

      ctx.font = '12px ' + PAL.sans;
      for (let i = 0; i < SN.length; i++) {
        const s = SN[i];
        if (time < startsN[i]) break;
        const p = kit.clamp((time - startsN[i]) / s.d, 0, 1);
        const y = topY + (i + 0.55) * rowH;

        if (s.kind === 'msg' || s.kind === 'stream') {
          const x1 = laneX[s.a], x2 = laneX[s.b];
          const xe = kit.lerp(x1, x2, kit.ease.inOut(p));
          ctx.save();
          if (s.kind === 'stream') ctx.setLineDash([5, 4]);
          if (Math.abs(xe - x1) > 12) kit.arrow(ctx, x1, y, xe, y, { color: s.c, width: 1.8, head: 8 });
          ctx.restore();
          const mid = (x1 + x2) / 2;
          const lw = ctx.measureText(s.l).width;
          const lx = kit.clamp(mid, 8 + lw / 2, w - 8 - lw / 2);
          ctx.globalAlpha = kit.clamp(p * 2.5, 0, 1);
          ctx.fillStyle = PAL.bg;
          ctx.fillRect(lx - lw / 2 - 3, y - 22, lw + 6, 16);
          ctx.fillStyle = s.c;
          ctx.fillText(s.l, lx, y - 14);
          ctx.globalAlpha = 1;
        } else if (s.kind === 'self') {
          const bw = Math.min(ctx.measureText(s.l).width + 20, w * 0.44);
          kit.roundedRect(ctx, laneX[s.a] - bw / 2, y - 13, bw, 26, 7);
          ctx.globalAlpha = kit.clamp(p * 2.5, 0, 1);
          ctx.fillStyle = PAL.graySoft;
          ctx.fill();
          ctx.strokeStyle = s.c;
          ctx.lineWidth = 1.3;
          ctx.stroke();
          ctx.fillStyle = PAL.inkStrong;
          ctx.fillText(s.l, laneX[s.a], y + 1);
          ctx.globalAlpha = 1;
        } else if (s.kind === 'wait') {
          const active = p < 1;
          const r = active ? 9 + 3 * Math.sin(time * 5) : 7;
          ctx.beginPath();
          ctx.arc(laneX[s.a], y, r, 0, Math.PI * 2);
          ctx.fillStyle = PAL.orangeSoft;
          ctx.fill();
          ctx.strokeStyle = s.c;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.globalAlpha = active ? 1 : 0.45;
          ctx.fillStyle = s.c;
          ctx.textAlign = 'left';
          ctx.fillText(s.l, laneX[s.a] + r + 8, y + 1);
          ctx.textAlign = 'center';
          ctx.globalAlpha = 1;
        }
      }
      ctx.textBaseline = 'alphabetic';
    }

    cv.onResize(drawN);
    const loop = kit.animLoop(dt => {
      time += dt;
      if (time >= END) time = 0;
      drawN();
    });
    drawN();

    kit.caption(container, 'A single question can go back and forth several times. The model can ' +
      'only ask to use a tool; your own computer does the real work, and the result is handed ' +
      'back for the model to carry on.');
    return loop;
  }

  /* ================================================================
     MID + DEEP
     ================================================================ */
  const cv = kit.makeCanvas(container, { height: deep ? 560 : 480,
    ariaLabel: deep
      ? 'A sequence diagram of one conversational turn as several API round trips between you, the Claude Code CLI, and the model, tagged with each return’s stop_reason and with each POST’s prompt tokens split into cache-read and freshly prefilled.'
      : 'A sequence diagram of one conversational turn as several API round trips between you, the Claude Code CLI, and the model, with running API-call and token counts.' });
  const controls = kit.makeControls(container);

  /* lanes: 0 = You, 1 = Claude Code, 2 = API/model */
  /* kinds: msg (solid arrow), stream (dashed arrow + ticking tokens),
     self (activity box on a lane), wait (pulsing "waiting for you") */
  /* deep-only extra fields (ignored by mid): stop (stop_reason on a
     return), cache/fresh (cache-read vs newly-prefilled prompt tokens). */
  const S = [
    { kind: 'msg',    a: 0, b: 1, l: '"fix the failing login test"', sl: '"fix the test"', c: PAL.green,    d: 1.0 },
    { kind: 'msg',    a: 1, b: 2, l: 'POST /v1/messages · 12,400 tok', sl: 'POST · 12.4k tok', c: PAL.blueDark, d: 1.0, call: true, ptok: 12400, cache: 0, fresh: 12400 },
    { kind: 'stream', a: 2, b: 1, l: 'tool_use: Read(auth.spec.ts)', sl: 'tool_use: Read', c: PAL.purple,   d: 1.5, otok: 90, stop: 'tool_use' },
    { kind: 'msg',    a: 1, b: 0, l: 'allow Read auth.spec.ts?', sl: 'allow Read?', c: PAL.red,      d: 0.8 },
    { kind: 'wait',   a: 0,       l: 'waiting for you…',            c: PAL.orange,   d: 1.5 },
    { kind: 'msg',    a: 0, b: 1, l: 'approve', sl: 'approve',      c: PAL.green,    d: 0.7 },
    { kind: 'self',   a: 1,       l: 'runs Read — a real process', sl: 'runs Read', c: PAL.teal,     d: 1.0 },
    { kind: 'msg',    a: 1, b: 2, l: 'POST + tool_result · 13,600 tok', sl: 'POST · 13.6k tok', c: PAL.blueDark, d: 1.0, call: true, ptok: 13600, cache: 12400, fresh: 1200 },
    { kind: 'stream', a: 2, b: 1, l: 'tool_use: Edit(auth.spec.ts)', sl: 'tool_use: Edit', c: PAL.purple,   d: 1.5, otok: 210, stop: 'tool_use' },
    { kind: 'msg',    a: 1, b: 0, l: 'allow Edit?', sl: 'allow Edit?', c: PAL.red,   d: 0.7 },
    { kind: 'msg',    a: 0, b: 1, l: 'approve', sl: 'approve',      c: PAL.green,    d: 0.7 },
    { kind: 'self',   a: 1,       l: 'runs Edit', sl: 'runs Edit',  c: PAL.teal,     d: 0.9 },
    { kind: 'msg',    a: 1, b: 2, l: 'POST + tool_result · 14,100 tok', sl: 'POST · 14.1k tok', c: PAL.blueDark, d: 1.0, call: true, ptok: 14100, cache: 13600, fresh: 500 },
    { kind: 'stream', a: 2, b: 1, l: 'text: "the mock was stale — fixed"', sl: 'text answer', c: PAL.orange, d: 1.7, otok: 160, stop: 'end_turn' },
    { kind: 'msg',    a: 1, b: 0, l: 'rendered answer, prompt returns', sl: 'answer', c: PAL.green,  d: 1.0 },
  ];
  const starts = [];
  let TOTAL = 0.4;
  for (const s of S) { starts.push(TOTAL); TOTAL += s.d; }
  const END_T = TOTAL + 0.8;

  let time = 0;
  let playing = true;

  const speed = kit.makeSlider(controls, {
    label: 'Speed', min: 0.3, max: 2.5, value: 1,
    format: v => v.toFixed(1) + '×',
  });
  const btn = kit.makeButton(controls, 'Pause', () => {
    if (time >= END_T) { time = 0; playing = true; }
    else playing = !playing;
    syncBtn();
  });
  function syncBtn() {
    btn.textContent = time >= END_T ? 'Replay' : (playing ? 'Pause' : 'Play');
  }

  function draw() {
    const { ctx, w, h } = cv;
    ctx.clearRect(0, 0, w, h);
    const narrow = w < 560;
    const laneX = [0.13, 0.5, 0.87].map(f => Math.round(f * w));
    const laneNames = narrow ? ['You', 'Claude Code', 'API'] : ['You', 'Claude Code (CLI)', 'API / model'];
    const laneFill = [PAL.greenSoft, PAL.blueSoft, PAL.orangeSoft];
    const laneEdge = [PAL.green, PAL.blue, PAL.orange];
    const topY = 58;
    const botY = h - (deep ? 58 : 46);
    const rowH = (botY - topY) / S.length;

    /* lifelines + headers */
    ctx.font = '12px ' + PAL.sans;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = PAL.grid;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(laneX[i], 44);
      ctx.lineTo(laneX[i], botY);
      ctx.stroke();
      ctx.setLineDash([]);
      const bw = Math.min(ctx.measureText(laneNames[i]).width + 20, w / 3 - 8);
      kit.roundedRect(ctx, laneX[i] - bw / 2, 8, bw, 26, 7);
      ctx.fillStyle = laneFill[i];
      ctx.fill();
      ctx.strokeStyle = laneEdge[i];
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = PAL.inkStrong;
      ctx.fillText(laneNames[i], laneX[i], 21);
    }

    /* events */
    let apiCalls = 0, ptok = 0, otok = 0, cached = 0, fresh = 0;
    ctx.font = '11px ' + PAL.mono;
    for (let i = 0; i < S.length; i++) {
      const s = S[i];
      const st = starts[i];
      if (time < st) break;
      const p = kit.clamp((time - st) / s.d, 0, 1);
      const y = topY + (i + 0.55) * rowH;
      const label = (narrow && s.sl) ? s.sl : s.l;

      if (s.call) { apiCalls++; ptok += s.ptok; cached += s.cache; fresh += s.fresh; }
      if (s.otok) otok += s.otok * kit.ease.out(p);

      if (s.kind === 'msg' || s.kind === 'stream') {
        const x1 = laneX[s.a], x2 = laneX[s.b];
        const xe = kit.lerp(x1, x2, kit.ease.inOut(p));
        ctx.save();
        if (s.kind === 'stream') ctx.setLineDash([5, 4]);
        if (Math.abs(xe - x1) > 12) kit.arrow(ctx, x1, y, xe, y, { color: s.c, width: 1.6, head: 7 });
        ctx.restore();
        /* label above the arrow, kept inside the canvas */
        const mid = (x1 + x2) / 2;
        const lw = ctx.measureText(label).width;
        const lx = kit.clamp(mid, 8 + lw / 2, w - 8 - lw / 2);
        ctx.globalAlpha = kit.clamp(p * 2.5, 0, 1);
        ctx.fillStyle = PAL.bg;
        ctx.fillRect(lx - lw / 2 - 3, y - 20, lw + 6, 14);
        ctx.fillStyle = s.c;
        ctx.fillText(label, lx, y - 13);
        ctx.globalAlpha = 1;

        /* deep: sublabel below the arrow — stop_reason on a return,
           cache-read vs newly-prefilled split on a POST */
        if (deep && p > 0.35) {
          let sub = null, subCol = PAL.faint;
          if (s.stop) { sub = 'stop_reason: ' + s.stop; subCol = s.stop === 'end_turn' ? PAL.greenDark : PAL.purple; }
          else if (s.call) { sub = (s.cache > 0 ? k(s.cache) + ' cache-read · +' + k(s.fresh) + ' new' : 'cold · ' + k(s.fresh) + ' prefill'); subCol = PAL.blueDark; }
          if (sub) {
            const sw = ctx.measureText(sub).width;
            const sx = kit.clamp(mid, 8 + sw / 2, w - 8 - sw / 2);
            ctx.globalAlpha = kit.clamp((p - 0.35) * 4, 0, 1);
            ctx.fillStyle = PAL.bg;
            ctx.fillRect(sx - sw / 2 - 3, y + 4, sw + 6, 14);
            ctx.fillStyle = subCol;
            ctx.fillText(sub, sx, y + 12);
            ctx.globalAlpha = 1;
          }
        }
      } else if (s.kind === 'self') {
        const bw = Math.min(ctx.measureText(label).width + 18, w * 0.42);
        kit.roundedRect(ctx, laneX[s.a] - bw / 2, y - 11, bw, 22, 6);
        ctx.globalAlpha = kit.clamp(p * 2.5, 0, 1);
        ctx.fillStyle = PAL.graySoft;
        ctx.fill();
        ctx.strokeStyle = s.c;
        ctx.lineWidth = 1.3;
        ctx.stroke();
        ctx.fillStyle = PAL.inkStrong;
        ctx.fillText(label, laneX[s.a], y + 1);
        ctx.globalAlpha = 1;
      } else if (s.kind === 'wait') {
        const active = p < 1;
        const r = active ? 8 + 3 * Math.sin(time * 5) : 6;
        ctx.beginPath();
        ctx.arc(laneX[s.a], y, r, 0, Math.PI * 2);
        ctx.fillStyle = PAL.orangeSoft;
        ctx.fill();
        ctx.strokeStyle = s.c;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.globalAlpha = active ? 1 : 0.45;
        ctx.fillStyle = s.c;
        ctx.textAlign = 'left';
        ctx.fillText(label, laneX[s.a] + r + 8, y + 1);
        ctx.textAlign = 'center';
        ctx.globalAlpha = 1;
      }
    }

    /* counters */
    ctx.font = '11px ' + PAL.mono;
    ctx.fillStyle = PAL.faint;
    if (deep) {
      const l1 = 'API calls ' + apiCalls + '  ·  generated ' + fmt(otok) + ' tok';
      const l2 = 'prompt ' + fmt(ptok) + ' tok  =  ' + fmt(cached) + ' cache-read  +  ' + fmt(fresh) + ' prefilled';
      ctx.fillText(l1, w / 2, h - 32);
      ctx.fillStyle = PAL.ink;
      ctx.fillText(l2, w / 2, h - 16);
    } else {
      const line = 'API calls ' + apiCalls +
        '  ·  prompt tok ' + fmt(ptok) +
        '  ·  generated ' + fmt(otok);
      ctx.fillText(line, w / 2, h - 18);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  cv.onResize(draw);
  const loop = kit.animLoop(dt => {
    if (playing) {
      time += dt * speed.value;
      if (time >= END_T) { time = END_T; playing = false; }
      syncBtn();
    }
    draw();
  });
  draw();

  kit.caption(container, deep
    ? 'One turn is several stateless round trips. Each return is tagged with its ' +
      '<code>stop_reason</code>; each re-entry POSTs the grown transcript, but the unchanged prefix ' +
      'is a cache-read, so only the handful of new tokens is freshly prefilled — the split under each ' +
      'POST, and the totals below.'
    : 'One conversational turn is several API round trips. The server ' +
      'goes quiet after each <code>stop_reason: "tool_use"</code> — the CLI runs the tool on ' +
      'your machine, appends the <code>tool_result</code>, and posts the grown context again.');
  return loop;
});
