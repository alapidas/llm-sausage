'use strict';
/* fig-terminal — a miniature terminal that types a prompt to itself.
   Below the dark panel, an annotation lane tracks each keystroke:
   key event -> raw-mode byte to the CLI process -> screen redraw count. */
Figures.register('fig-terminal', (container, kit) => {
  const cv = kit.makeCanvas(container, { aspect: 0.62, maxHeight: 400,
    ariaLabel: 'A miniature terminal types a prompt to itself while a lane below counts each keystroke as a key event, a raw byte handed to the CLI process, and a running total of screen redraws that keeps climbing even while the spinner turns.' });
  const controls = kit.makeControls(container);

  const PROMPT = 'fix the failing test in auth.spec.ts';
  const TYPE_DT = 0.13;      // seconds per typed character
  const THINK_REDRAWS = 9;   // repaints per second while the spinner turns

  let phase, typed, redraws, redrawAcc, timer, blink, spin, lastKey, annotAge;

  function reset() {
    phase = 'idle';          // idle -> typing -> pause -> thinking -> done
    typed = 0;
    redraws = 0;
    redrawAcc = 0;
    timer = 0;
    blink = 0;
    spin = 0;
    lastKey = null;
    annotAge = 10;
  }
  reset();

  function keyByte(ch) {
    return '0x' + ch.charCodeAt(0).toString(16).padStart(2, '0');
  }

  function advance(dt) {
    blink += dt;
    spin += dt;
    timer += dt;
    annotAge += dt;
    if (phase === 'idle') {
      if (timer > 0.7) { phase = 'typing'; timer = 0; }
    } else if (phase === 'typing') {
      if (timer > TYPE_DT) {
        timer = 0;
        const ch = PROMPT[typed];
        typed += 1;
        redraws += 1;
        lastKey = { label: ch === ' ' ? 'space' : '‘' + ch + '’', byte: keyByte(ch) };
        annotAge = 0;
        if (typed >= PROMPT.length) phase = 'pause';
      }
    } else if (phase === 'pause') {
      if (timer > 0.8) {
        phase = 'thinking';
        timer = 0;
        redraws += 1;
        lastKey = { label: 'Enter', byte: '0x0d' };
        annotAge = 0;
      }
    } else if (phase === 'thinking') {
      redrawAcc += dt * THINK_REDRAWS;
      while (redrawAcc >= 1) { redrawAcc -= 1; redraws += 1; }
      if (timer > 3.4) { phase = 'done'; timer = 0; }
    } else if (phase === 'done') {
      if (timer > 2.2) reset();
    }
  }

  function draw() {
    const { ctx, w, h } = cv;
    ctx.clearRect(0, 0, w, h);

    const laneH = 66;
    const panelH = h - laneH;
    const fs = w < 400 ? 11 : 13;
    const lineH = fs + 8;

    /* ---- dark terminal panel (the one sanctioned dark surface) ---- */
    ctx.fillStyle = PAL.inkStrong;
    kit.roundedRect(ctx, 0, 0, w, panelH, 12);
    ctx.fill();

    /* traffic-light dots + window title */
    [PAL.red, PAL.yellow, PAL.green].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(18 + i * 17, 17, 5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = PAL.faint;
    ctx.font = '11px ' + PAL.mono;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('claude — ~/project', w / 2, 21);
    ctx.textAlign = 'left';

    const mx = 16;                    // panel inner margin
    let y = 34 + lineH;               // first content baseline
    ctx.font = fs + 'px ' + PAL.mono;

    if (phase === 'idle' || phase === 'typing' || phase === 'pause') {
      /* greeting line, then the bordered input box */
      ctx.fillStyle = PAL.faint;
      ctx.fillText('Claude Code — describe what you want to change', mx, y);
      const boxY = y + 10;
      const boxH = fs + 18;
      ctx.strokeStyle = PAL.faint;
      ctx.lineWidth = 1;
      kit.roundedRect(ctx, mx, boxY, w - 2 * mx, boxH, 7);
      ctx.stroke();
      const textY = boxY + boxH / 2 + fs * 0.35;
      const line = '> ' + PROMPT.slice(0, typed);
      ctx.fillStyle = PAL.graySoft;
      ctx.fillText(line, mx + 10, textY);
      /* blinking block cursor */
      if (blink % 1.1 < 0.6) {
        const cx = mx + 10 + ctx.measureText(line).width + 2;
        ctx.fillRect(cx, textY - fs, fs * 0.55, fs + 3);
      }
    } else {
      /* after Enter: submitted line, then spinner or first reply line */
      ctx.fillStyle = PAL.faint;
      ctx.fillText('> ' + PROMPT, mx, y);
      const rowY = y + lineH * 1.5;
      if (phase === 'thinking') {
        /* small rotating arc spinner */
        ctx.strokeStyle = PAL.orange;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(mx + 7, rowY - fs * 0.35, 6, spin * 6, spin * 6 + 4.2);
        ctx.stroke();
        ctx.fillStyle = PAL.orange;
        ctx.fillText('Thinking…', mx + 22, rowY);
        ctx.fillStyle = PAL.faint;
        ctx.fillText('(esc to interrupt)', mx + 22 + ctx.measureText('Thinking… ').width, rowY);
      } else {
        ctx.fillStyle = PAL.green;
        ctx.beginPath();
        ctx.arc(mx + 5, rowY - fs * 0.35, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PAL.graySoft;
        const reply = w < 420 ? 'I’ll start by reading auth.spec.ts…'
                             : 'I’ll start by reading auth.spec.ts and running the suite…';
        ctx.fillText(reply, mx + 16, rowY);
      }
    }

    /* ---- annotation lane: key event -> raw byte -> redraw counter ---- */
    const flash = Math.max(0, 1 - annotAge / 0.4);       // 1 right after a keystroke
    const laneTop = panelH + 6;
    const aw = 24;                                       // arrow zone width
    const bw = (w - 2 * aw - 4) / 3;
    const boxH = 26;
    const boxY = laneTop + 16;
    const boxes = [
      { head: 'key event', val: lastKey ? lastKey.label : '—', fill: PAL.blueSoft,   stroke: PAL.blue },
      { head: 'byte to CLI', val: lastKey ? lastKey.byte : '—', fill: PAL.purpleSoft, stroke: PAL.purple },
      { head: 'screen redraws', val: String(redraws),               fill: PAL.orangeSoft, stroke: PAL.orange },
    ];
    ctx.textAlign = 'center';
    boxes.forEach((b, i) => {
      const x = 2 + i * (bw + aw);
      ctx.font = '11px ' + PAL.sans;
      ctx.fillStyle = PAL.faint;
      ctx.fillText(b.head, x + bw / 2, laneTop + 10);
      ctx.fillStyle = b.fill;
      kit.roundedRect(ctx, x, boxY, bw, boxH, 7);
      ctx.fill();
      ctx.strokeStyle = b.stroke;
      ctx.lineWidth = 1 + flash * 1.5;
      ctx.stroke();
      ctx.font = '12px ' + PAL.mono;
      ctx.fillStyle = PAL.inkStrong;
      ctx.fillText(b.val, x + bw / 2, boxY + boxH / 2 + 4);
      if (i < 2) {
        const ax = x + bw + 4;
        kit.arrow(ctx, ax, boxY + boxH / 2, ax + aw - 8, boxY + boxH / 2,
                  { color: PAL.faint, width: 1.4, head: 6 });
      }
    });
    ctx.textAlign = 'left';
  }

  kit.makeButton(controls, 'Replay', () => { reset(); draw(); });

  const loop = kit.animLoop(dt => { advance(dt); draw(); });
  cv.onResize(draw);
  draw();

  kit.caption(container,
    'In raw mode the terminal delivers each keystroke to the CLI process as a byte, ' +
    'and every character you see is the program repainting the screen with ANSI escape ' +
    'sequences — note how the redraw counter keeps climbing while the spinner turns.');

  return loop;
});
