'use strict';
/* fig-context-assembly — the context window as a horizontal stacked bar.
   A slider grows the conversation-history segment; hovering a segment
   shows its label and token count. The punchline is the near-invisible
   sliver that is your actual new message. */
Figures.register('fig-context-assembly', (container, kit) => {
  const cv = kit.makeCanvas(container, { height: 224,
    ariaLabel: 'A horizontal bar representing the model’s 200,000-token context window, stacked from the system prompt, tool definitions, project memory, and an ever-growing conversation history, with your new message as a barely visible green sliver at the end.' });
  const controls = kit.makeControls(container);

  const CAP = 200000;
  let turns = 6;
  let hover = -1;

  function fmt(n) { return n.toLocaleString('en-US'); }

  function segments() {
    let hist = 0;
    for (let i = 1; i <= turns; i++) hist += 2200 + 120 * i;
    return [
      { name: 'system prompt',        tokens: 11500, fill: PAL.blueSoft,   stroke: PAL.blue,   alpha: 1 },
      { name: 'tool definitions',     tokens: 16000, fill: PAL.purpleSoft, stroke: PAL.purple, alpha: 1 },
      { name: 'CLAUDE.md',            tokens: 1800,  fill: PAL.teal,       stroke: PAL.teal,   alpha: 0.3 },
      { name: 'conversation history', tokens: hist,  fill: PAL.orangeSoft, stroke: PAL.orange, alpha: 1 },
      { name: 'your new message',     tokens: 45,    fill: PAL.green,      stroke: PAL.green,  alpha: 1 },
      { name: 'free space',           tokens: 0,     fill: PAL.graySoft,   stroke: PAL.grid,   alpha: 1, free: true },
    ];
  }

  /* Segment pixel spans for the current width; the "new message" sliver is
     clamped to a visible minimum, borrowed from free space. */
  function layout(w) {
    const segs = segments();
    const used = segs.reduce((s, g) => s + g.tokens, 0);
    segs[segs.length - 1].tokens = Math.max(0, CAP - used);
    const barX = 4, barW = w - 8;
    let x = barX;
    segs.forEach(g => {
      g.x = x;
      g.w = barW * g.tokens / CAP;
      if (g.name === 'your new message') g.w = Math.max(g.w, 3);
      x += g.w;
    });
    /* keep the bar exactly barW wide by absorbing rounding in free space */
    const last = segs[segs.length - 1];
    last.w += (barX + barW) - (last.x + last.w);
    return { segs, used, barX, barW };
  }

  const BAR_Y = 66, BAR_H = 60;

  function draw() {
    const { ctx, w, h } = cv;
    ctx.clearRect(0, 0, w, h);
    const { segs, used, barX, barW } = layout(w);

    /* readout */
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '600 13px ' + PAL.sans;
    ctx.fillStyle = PAL.inkStrong;
    const pct = Math.round(100 * used / CAP);
    ctx.fillText(fmt(used) + ' / ' + fmt(CAP) + ' tokens — ' + pct + '% of the window', w / 2, 24);

    /* hover line */
    ctx.font = '12px ' + PAL.sans;
    if (hover >= 0 && hover < segs.length) {
      const g = segs[hover];
      ctx.fillStyle = g.free ? PAL.faint : g.stroke;
      ctx.fillText(g.name + ' — ' + fmt(g.tokens) + ' tokens', w / 2, 48);
    } else {
      ctx.fillStyle = PAL.faint;
      ctx.fillText('hover or touch a segment to inspect it', w / 2, 48);
    }

    /* stacked bar, clipped to a rounded outline */
    ctx.save();
    kit.roundedRect(ctx, barX, BAR_Y, barW, BAR_H, 9);
    ctx.clip();
    segs.forEach((g, i) => {
      ctx.globalAlpha = g.alpha;
      ctx.fillStyle = g.free ? PAL.bg : g.fill;
      ctx.fillRect(g.x, BAR_Y, g.w, BAR_H);
      ctx.globalAlpha = 1;
      if (i === hover && !g.free) {
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = g.stroke;
        ctx.fillRect(g.x, BAR_Y, g.w, BAR_H);
        ctx.globalAlpha = 1;
      }
      if (i > 0) {                      /* divider */
        ctx.strokeStyle = PAL.bg;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(g.x, BAR_Y);
        ctx.lineTo(g.x, BAR_Y + BAR_H);
        ctx.stroke();
      }
    });
    ctx.restore();
    ctx.strokeStyle = hover >= 0 && !segs[hover].free ? segs[hover].stroke : PAL.grid;
    ctx.lineWidth = 1.4;
    kit.roundedRect(ctx, barX, BAR_Y, barW, BAR_H, 9);
    ctx.stroke();

    /* legend, wrapping to fit the width */
    ctx.font = '12px ' + PAL.sans;
    ctx.textAlign = 'left';
    const chip = 11, gapX = 18, rowH = 22;
    let lx = barX, ly = BAR_Y + BAR_H + 28;
    segs.forEach((g, i) => {
      const tw = chip + 6 + ctx.measureText(g.name).width;
      if (lx + tw > w - 4 && lx > barX) { lx = barX; ly += rowH; }
      ctx.globalAlpha = g.alpha;
      ctx.fillStyle = g.free ? PAL.bg : g.fill;
      kit.roundedRect(ctx, lx, ly - chip + 1, chip, chip, 3);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = g.stroke;
      ctx.lineWidth = i === hover ? 1.8 : 1;
      ctx.stroke();
      ctx.fillStyle = i === hover ? PAL.inkStrong : PAL.ink;
      ctx.fillText(g.name, lx + chip + 6, ly);
      lx += tw + gapX;
    });
  }

  function hitTest(p) {
    if (p.y < BAR_Y - 8 || p.y > BAR_Y + BAR_H + 8) return -1;
    const { segs } = layout(cv.w);
    for (let i = 0; i < segs.length; i++) {
      if (p.x >= segs[i].x && p.x < segs[i].x + segs[i].w) return i;
    }
    return -1;
  }

  cv.canvas.addEventListener('pointermove', ev => {
    const next = hitTest(cv.pointer(ev));
    cv.canvas.style.cursor = next >= 0 ? 'pointer' : 'default';
    if (next !== hover) { hover = next; draw(); }
  });
  cv.canvas.addEventListener('pointerdown', ev => {
    const next = hitTest(cv.pointer(ev));
    if (next !== hover) { hover = next; draw(); }
  });
  cv.canvas.addEventListener('pointerleave', () => {
    if (hover !== -1) { hover = -1; draw(); }
  });

  /* keyboard: step the inspected segment with the arrow keys */
  cv.canvas.tabIndex = 0;
  cv.canvas.addEventListener('keydown', ev => {
    const n = segments().length;
    let next = hover;
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') next = hover < 0 ? 0 : Math.min(n - 1, hover + 1);
    else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') next = hover < 0 ? n - 1 : Math.max(0, hover - 1);
    else if (ev.key === 'Home') next = 0;
    else if (ev.key === 'End') next = n - 1;
    else return;
    ev.preventDefault();
    if (next !== hover) { hover = next; draw(); }
  });
  cv.canvas.addEventListener('blur', () => {
    if (hover !== -1) { hover = -1; draw(); }
  });

  kit.makeSlider(controls, {
    label: 'Turns of conversation', min: 0, max: 30, step: 1, value: turns,
    format: v => String(v),
    onInput: v => { turns = v; draw(); },
  });

  cv.onResize(draw);
  draw();

  kit.caption(container,
    'Everything sent to the model on one request. The conversation history swells with ' +
    'every turn because tool results ride along too — while your new message, the green ' +
    'sliver, is typically just a few dozen tokens.');
});
