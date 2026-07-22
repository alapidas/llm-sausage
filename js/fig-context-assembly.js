'use strict';
/* fig-context-assembly — the context window as a horizontal stacked bar.
   A slider grows the conversation-history segment; the punchline is the
   near-invisible sliver that is your actual new message.
   Level-aware:
     novice — fewer, plainly named bands, no token numbers, one slider, no
              hover; a callout points to your tiny message.
     mid    — hover/keyboard inspection, token counts, 200k readout.
     deep   — the mid figure plus exact send order, byte estimates and a
              "show bytes" toggle. */
Figures.register('fig-context-assembly', (container, kit) => {
  const level = kit.level();

  const ariaLabel = level === 'novice'
    ? 'A horizontal bar showing the whole page sent to the model: standing instructions, a list of tools, and the entire conversation so far fill almost all of it, while your own message is a tiny green sliver at the end.'
    : level === 'deep'
    ? 'A horizontal bar for the 200,000-token context window, stacked in send order from system prompt, tool definitions, project memory, and a growing conversation history, with your new message as a thin green sliver; a readout gives exact token counts, byte estimates, and each part’s position in the request.'
    : 'A horizontal bar representing the model’s 200,000-token context window, stacked from the system prompt, tool definitions, project memory, and an ever-growing conversation history, with your new message as a barely visible green sliver at the end.';

  const cv = kit.makeCanvas(container, { height: 224, ariaLabel });
  const controls = kit.makeControls(container);

  const CAP = 200000;
  const BYTES_PER_TOK = 4;
  let turns = 6;
  let hover = -1;
  let showBytes = false;

  function fmt(n) { return n.toLocaleString('en-US'); }
  function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function segments() {
    let hist = 0;
    for (let i = 1; i <= turns; i++) hist += 2200 + 120 * i;
    if (level === 'novice') {
      return [
        { name: 'instructions',          tokens: 11500, fill: PAL.blueSoft,   stroke: PAL.blue,   alpha: 1 },
        { name: 'list of tools',         tokens: 16000, fill: PAL.purpleSoft, stroke: PAL.purple, alpha: 1 },
        { name: 'the conversation so far', tokens: hist, fill: PAL.orangeSoft, stroke: PAL.orange, alpha: 1 },
        { name: 'your message',          tokens: 45,    fill: PAL.green,      stroke: PAL.green,  alpha: 1 },
        { name: 'free space',            tokens: 0,     fill: PAL.graySoft,   stroke: PAL.grid,   alpha: 1, free: true },
      ];
    }
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
      if (g.name === 'your new message' || g.name === 'your message') g.w = Math.max(g.w, 3);
      x += g.w;
    });
    /* keep the bar exactly barW wide by absorbing rounding in free space */
    const last = segs[segs.length - 1];
    last.w += (barX + barW) - (last.x + last.w);
    return { segs, used, barX, barW };
  }

  const BAR_Y = level === 'novice' ? 80 : 66;
  const BAR_H = 60;

  /* ---- novice: plain bands, a callout to your message, no numbers ---- */
  function drawNovice(ctx, w, segs, barX, barW) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '600 14px ' + PAL.sans;
    ctx.fillStyle = PAL.inkStrong;
    ctx.fillText('The whole page the model receives', w / 2, 26);
    ctx.font = '12px ' + PAL.sans;
    ctx.fillStyle = PAL.faint;
    ctx.fillText('drag to add messages — your own note stays a tiny green sliver', w / 2, 46);

    /* callout to the green sliver */
    const msg = segs.find(g => g.name === 'your message');
    if (msg) {
      const sx = kit.clamp(msg.x + msg.w / 2, barX + 8, barX + barW - 8);
      kit.arrow(ctx, sx, BAR_Y - 14, sx, BAR_Y - 3, { color: PAL.greenDark, width: 1.6, head: 6 });
      ctx.font = '600 12px ' + PAL.sans;
      ctx.fillStyle = PAL.greenDark;
      const near = sx > w - 74;
      ctx.textAlign = near ? 'right' : 'center';
      ctx.fillText('your message', near ? w - 6 : kit.clamp(sx, 46, w - 46), BAR_Y - 20);
      ctx.textAlign = 'center';
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
      if (i > 0) {
        ctx.strokeStyle = PAL.bg;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(g.x, BAR_Y);
        ctx.lineTo(g.x, BAR_Y + BAR_H);
        ctx.stroke();
      }
    });
    ctx.restore();
    ctx.strokeStyle = PAL.grid;
    ctx.lineWidth = 1.4;
    kit.roundedRect(ctx, barX, BAR_Y, barW, BAR_H, 9);
    ctx.stroke();

    /* plain legend */
    ctx.font = '12px ' + PAL.sans;
    ctx.textAlign = 'left';
    const chip = 12, gapX = 18, rowH = 24;
    let lx = barX, ly = BAR_Y + BAR_H + 30;
    segs.forEach(g => {
      const tw = chip + 6 + ctx.measureText(g.name).width;
      if (lx + tw > w - 4 && lx > barX) { lx = barX; ly += rowH; }
      ctx.globalAlpha = g.alpha;
      ctx.fillStyle = g.free ? PAL.bg : g.fill;
      kit.roundedRect(ctx, lx, ly - chip + 1, chip, chip, 3);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = g.stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = PAL.ink;
      ctx.fillText(g.name, lx + chip + 6, ly);
      lx += tw + gapX;
    });
  }

  function draw() {
    const { ctx, w } = cv;
    ctx.clearRect(0, 0, w, cv.h);
    const { segs, used, barX, barW } = layout(w);

    if (level === 'novice') { drawNovice(ctx, w, segs, barX, barW); return; }

    /* readout */
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '600 13px ' + PAL.sans;
    ctx.fillStyle = PAL.inkStrong;
    const pct = Math.round(100 * used / CAP);
    let readout = fmt(used) + ' / ' + fmt(CAP) + ' tokens — ' + pct + '% of the window';
    if (level === 'deep' && showBytes) {
      readout = fmt(used) + ' / ' + fmt(CAP) + ' tokens — ' + pct +
        '% — ≈' + fmt(Math.round(used * BYTES_PER_TOK / 1024)) + ' KB on the wire';
    }
    ctx.fillText(readout, w / 2, 24);

    /* hover line */
    ctx.font = '12px ' + PAL.sans;
    if (hover >= 0 && hover < segs.length) {
      const g = segs[hover];
      ctx.fillStyle = g.free ? PAL.faint : g.stroke;
      let line = g.name + ' — ' + fmt(g.tokens) + ' tokens';
      if (level === 'deep') {
        if (w >= 470) line += ' · ≈' + fmt(Math.round(g.tokens * BYTES_PER_TOK / 1024)) + ' KB';
        if (!g.free) line += ' · sent ' + ordinal(hover + 1) + ' of ' + segs.length;
      }
      ctx.fillText(line, w / 2, 48);
    } else {
      ctx.fillStyle = PAL.faint;
      ctx.fillText(level === 'deep'
        ? 'hover or touch a segment for tokens, bytes, and send order'
        : 'hover or touch a segment to inspect it', w / 2, 48);
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
      const label = level === 'deep' ? g.name + '  ' + fmt(g.tokens) : g.name;
      const tw = chip + 6 + ctx.measureText(label).width;
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
      ctx.fillText(label, lx + chip + 6, ly);
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

  if (level !== 'novice') {
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
  }

  kit.makeSlider(controls, {
    label: level === 'novice' ? 'Messages so far' : 'Turns of conversation',
    min: 0, max: 30, step: 1, value: turns,
    format: v => String(v),
    onInput: v => { turns = v; draw(); },
  });

  if (level === 'deep') {
    kit.makeToggle(controls, 'Show bytes (≈4 B/token)', false, v => { showBytes = v; draw(); });
  }

  cv.onResize(draw);
  draw();

  const caption = level === 'novice'
    ? 'Every time you press Enter, your short message is added to the end of a huge ' +
      'page — standing instructions, the list of tools, and the whole conversation so ' +
      'far — and the entire page is sent to the model again.'
    : level === 'deep'
    ? 'Everything sent on one request, in order: system prompt, tool schemas, memory, ' +
      'then the full history (tool results and all), then your new message. History ' +
      'dominates and is resent verbatim every call; toggle bytes to read the request in kilobytes.'
    : 'Everything sent to the model on one request. The conversation history swells with ' +
      'every turn because tool results ride along too — while your new message, the green ' +
      'sliver, is typically just a few dozen tokens.';
  kit.caption(container, caption);
});
