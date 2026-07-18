/* fig-toolloop — sequence diagram of one multi-step exchange between
   you, Claude Code, and the API, with API-call and token counters. */
'use strict';

Figures.register('fig-toolloop', (container, kit) => {
  const cv = kit.makeCanvas(container, { height: 480 });
  const controls = kit.makeControls(container);

  /* lanes: 0 = You, 1 = Claude Code, 2 = API/model */
  /* kinds: msg (solid arrow), stream (dashed arrow + ticking tokens),
     self (activity box on a lane), wait (pulsing "waiting for you") */
  const S = [
    { kind: 'msg',    a: 0, b: 1, l: '"fix the failing login test"', sl: '"fix the test"', c: PAL.green,    d: 1.0 },
    { kind: 'msg',    a: 1, b: 2, l: 'POST /v1/messages · 12,400 tok', sl: 'POST · 12.4k tok', c: PAL.blueDark, d: 1.0, call: true, ptok: 12400 },
    { kind: 'stream', a: 2, b: 1, l: 'tool_use: Read(auth.spec.ts)', sl: 'tool_use: Read', c: PAL.purple,   d: 1.5, otok: 90 },
    { kind: 'msg',    a: 1, b: 0, l: 'allow Read auth.spec.ts?', sl: 'allow Read?', c: PAL.red,      d: 0.8 },
    { kind: 'wait',   a: 0,       l: 'waiting for you…',            c: PAL.orange,   d: 1.5 },
    { kind: 'msg',    a: 0, b: 1, l: 'approve', sl: 'approve',      c: PAL.green,    d: 0.7 },
    { kind: 'self',   a: 1,       l: 'runs Read — a real process', sl: 'runs Read', c: PAL.teal,     d: 1.0 },
    { kind: 'msg',    a: 1, b: 2, l: 'POST + tool_result · 13,600 tok', sl: 'POST · 13.6k tok', c: PAL.blueDark, d: 1.0, call: true, ptok: 13600 },
    { kind: 'stream', a: 2, b: 1, l: 'tool_use: Edit(auth.spec.ts)', sl: 'tool_use: Edit', c: PAL.purple,   d: 1.5, otok: 210 },
    { kind: 'msg',    a: 1, b: 0, l: 'allow Edit?', sl: 'allow Edit?', c: PAL.red,   d: 0.7 },
    { kind: 'msg',    a: 0, b: 1, l: 'approve', sl: 'approve',      c: PAL.green,    d: 0.7 },
    { kind: 'self',   a: 1,       l: 'runs Edit', sl: 'runs Edit',  c: PAL.teal,     d: 0.9 },
    { kind: 'msg',    a: 1, b: 2, l: 'POST + tool_result · 14,100 tok', sl: 'POST · 14.1k tok', c: PAL.blueDark, d: 1.0, call: true, ptok: 14100 },
    { kind: 'stream', a: 2, b: 1, l: 'text: "the mock was stale — fixed"', sl: 'text answer', c: PAL.orange, d: 1.7, otok: 160 },
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

  const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  function draw() {
    const { ctx, w, h } = cv;
    ctx.clearRect(0, 0, w, h);
    const narrow = w < 560;
    const laneX = [0.13, 0.5, 0.87].map(f => Math.round(f * w));
    const laneNames = narrow ? ['You', 'Claude Code', 'API'] : ['You', 'Claude Code (CLI)', 'API / model'];
    const laneFill = [PAL.greenSoft, PAL.blueSoft, PAL.orangeSoft];
    const laneEdge = [PAL.green, PAL.blue, PAL.orange];
    const topY = 58;
    const botY = h - 46;
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
    let apiCalls = 0, ptok = 0, otok = 0;
    ctx.font = '11px ' + PAL.mono;
    for (let i = 0; i < S.length; i++) {
      const s = S[i];
      const st = starts[i];
      if (time < st) break;
      const p = kit.clamp((time - st) / s.d, 0, 1);
      const y = topY + (i + 0.55) * rowH;
      const label = (narrow && s.sl) ? s.sl : s.l;

      if (s.call) { apiCalls++; ptok += s.ptok; }
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
    const line = 'API calls ' + apiCalls +
      '  ·  prompt tok ' + fmt(ptok) +
      '  ·  generated ' + fmt(otok);
    ctx.fillText(line, w / 2, h - 18);
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

  kit.caption(container, 'One conversational turn is several API round trips. The server ' +
    'goes quiet after each <code>stop_reason: "tool_use"</code> — the CLI runs the tool on ' +
    'your machine, appends the <code>tool_result</code>, and posts the grown context again.');
  return loop;
});
