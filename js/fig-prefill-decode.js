/* fig-prefill-decode — one parallel pass absorbs the whole prompt (prefill),
   then every generated token needs its own full pass (decode). */
'use strict';

Figures.register('fig-prefill-decode', (container, kit) => {
  const level = kit.level();
  const NOVICE = level === 'novice';
  const DEEP = level === 'deep';

  const ARIA = NOVICE
    ? 'A read-then-write diagram: the whole request is read in one pass (a short pause), then the answer is written one piece per pass at a steady rate.'
    : (DEEP
      ? 'Diagram contrasting prefill, one parallel compute-bound pass over the whole prompt, with decode, one memory-bound pass per generated token, annotated with a tokens-per-second bandwidth ceiling.'
      : 'Diagram contrasting prefill, one parallel pass over the whole prompt, with decode, one full pass per generated token.');

  const cv = kit.makeCanvas(container, { height: 340,
    ariaLabel: ARIA });
  const controls = kit.makeControls(container);

  const NL = 8;            // layer bars in the stack
  const GEN = 10;          // tokens to generate
  const DECODE_MS = 35;    // simulated per-token pass time
  const WEIGHTS_GB = 150;  // deep: weights streamed per decode pass
  const HBM_TBS = 5;       // deep: aggregate HBM bandwidth (TB/s)
  const CEIL = Math.round(HBM_TBS * 1000 / WEIGHTS_GB); // B/N tok/s ceiling
  let nPrompt = 24;
  let speed = 1;
  let simT = 0;            // simulated milliseconds
  let holdT = 0;           // pause after finishing before auto-replay

  const prefillMs = () => 30 + 2.5 * nPrompt;
  const totalMs = () => prefillMs() + (GEN - 1) * DECODE_MS;

  kit.makeSlider(controls, {
    label: NOVICE ? 'Request length' : 'Prompt length', min: 8, max: 48, step: 4, value: nPrompt,
    format: v => v.toFixed(0) + (NOVICE ? ' words' : ' tok'),
    onInput: v => { nPrompt = v; simT = 0; holdT = 0; },
  });
  if (!NOVICE) {
    kit.makeSlider(controls, {
      label: 'Speed', min: 0.25, max: 3, step: 0.05, value: speed,
      format: v => v.toFixed(2) + '×',
      onInput: v => { speed = v; },
    });
    kit.makeButton(controls, 'Replay', () => { simT = 0; holdT = 0; });
  }

  function draw() {
    const { ctx, w, h } = cv;
    ctx.clearRect(0, 0, w, h);
    const m = 12;
    const narrow = w < 480;
    const pf = prefillMs(), total = totalMs();
    const finished = simT >= total;
    const inPrefill = simT < pf;

    // ---- phase bookkeeping ----
    let emitted = 0, pulseFrac = -1;
    if (inPrefill) {
      pulseFrac = simT / pf;                       // one pass for the whole prompt
    } else {
      const dT = simT - pf;
      emitted = Math.min(1 + Math.floor(dT / DECODE_MS), GEN);
      if (!finished) pulseFrac = (dT % DECODE_MS) / DECODE_MS; // one pass per token
    }

    // ---- prompt grid ----
    const sq = narrow ? 12 : 17, gap = narrow ? 3 : 4;
    const cols = Math.max(4, Math.floor((w - 2 * m) / (sq + gap)));
    const rows = Math.ceil(nPrompt / cols);
    const gridW = Math.min(nPrompt, cols) * (sq + gap) - gap;
    const gridX = (w - gridW) / 2;
    const gridY = 26;
    ctx.font = '11px ' + PAL.sans;
    ctx.fillStyle = PAL.faint;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(NOVICE ? 'your request — ' + nPrompt + ' words'
                        : 'prompt — ' + nPrompt + ' tokens', gridX, gridY - 8);
    const lit = inPrefill ? kit.ease.inOut(pulseFrac) : 1;
    for (let i = 0; i < nPrompt; i++) {
      const x = gridX + (i % cols) * (sq + gap);
      const y = gridY + Math.floor(i / cols) * (sq + gap);
      kit.roundedRect(ctx, x, y, sq, sq, 3);
      ctx.fillStyle = PAL.blueSoft;
      ctx.fill();
      if (lit > 0) {
        ctx.globalAlpha = lit;                     // all squares light together
        ctx.fillStyle = PAL.blue;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    // sweep line: the single prefill pass moving across the prompt
    if (inPrefill) {
      const sx = gridX + pulseFrac * gridW;
      ctx.strokeStyle = PAL.blueDark;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(sx, gridY - 3);
      ctx.lineTo(sx, gridY + rows * (sq + gap) - gap + 3);
      ctx.stroke();
    }
    const gridBottom = gridY + rows * (sq + gap) - gap;

    // ---- generated-token row (bottom) ----
    const genSq = narrow ? 14 : 17;
    const genY = h - genSq - 14;
    const genX = (w - GEN * (genSq + gap) + gap) / 2;
    ctx.fillStyle = PAL.faint;
    ctx.fillText(NOVICE ? 'the reply, one piece per pass' : 'generated, one per pass', genX, genY - 6);
    for (let i = 0; i < GEN; i++) {
      const x = genX + i * (genSq + gap);
      kit.roundedRect(ctx, x, genY, genSq, genSq, 3);
      if (i < emitted) {
        ctx.fillStyle = PAL.orange; ctx.fill();
      } else {
        ctx.strokeStyle = PAL.grid; ctx.lineWidth = 1; ctx.stroke();
      }
    }

    // ---- layer stack (middle left) ----
    const stackTop = gridBottom + 34;
    const stackBottom = genY - 50;
    const stackH = Math.max(60, stackBottom - stackTop);
    const barW = narrow ? Math.min(120, w * 0.4) : 150;
    const barX = m + 4;
    const slotH = stackH / NL;
    const activeLayer = pulseFrac >= 0 ? Math.min(NL - 1, Math.floor(pulseFrac * NL)) : -1;
    ctx.fillStyle = PAL.faint;
    ctx.fillText(NOVICE ? 'the model' : 'model layers', barX, stackTop - 7);
    for (let i = 0; i < NL; i++) {
      const y = stackTop + (NL - 1 - i) * slotH;    // pulse travels bottom→top
      kit.roundedRect(ctx, barX, y + slotH * 0.12, barW, slotH * 0.76, 3);
      if (i === activeLayer) {
        ctx.fillStyle = inPrefill ? PAL.blue : PAL.orange;
        ctx.fill();
      } else {
        ctx.fillStyle = PAL.graySoft;
        ctx.fill();
        ctx.strokeStyle = PAL.grid;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // ---- phase label under the stack ----
    ctx.font = '600 11px ' + PAL.sans;
    if (inPrefill) {
      ctx.fillStyle = PAL.blueDark;
      if (NOVICE) {
        ctx.fillText('reading your', barX, stackTop + stackH + 15);
        ctx.fillText('whole request at once', barX, stackTop + stackH + 28);
      } else {
        ctx.fillText('prefill: 1 pass, whole prompt', barX, stackTop + stackH + 15);
        ctx.fillText('in parallel — compute-bound', barX, stackTop + stackH + 28);
      }
    } else if (!finished) {
      ctx.fillStyle = PAL.orangeDark;
      if (NOVICE) {
        ctx.fillText('writing the answer', barX, stackTop + stackH + 15);
        ctx.fillText('one piece at a time', barX, stackTop + stackH + 28);
      } else {
        ctx.fillText('decode: 1 pass per token', barX, stackTop + stackH + 15);
        ctx.fillText('— memory-bound', barX, stackTop + stackH + 28);
      }
    } else {
      ctx.fillStyle = PAL.faint;
      ctx.fillText('done — replaying shortly', barX, stackTop + stackH + 15);
    }

    // ---- timers (right of the stack) ----
    const tx = barX + barW + (narrow ? 14 : 30);
    let ty = stackTop + 10;
    ctx.font = '11px ' + PAL.mono;
    ctx.fillStyle = PAL.faint;
    ctx.fillText(NOVICE ? 'time (slowed)' : 'clock (slowed)', tx, ty);
    ctx.font = '600 13px ' + PAL.mono;
    ctx.fillStyle = PAL.inkStrong;
    ctx.fillText(Math.round(Math.min(simT, total)) + ' ms', tx, ty + 17);
    ty += 44;
    ctx.font = '11px ' + PAL.mono;
    if (simT >= pf) {
      ctx.fillStyle = PAL.blueDark;
      ctx.fillText((NOVICE ? 'first word after ' : 'first token at ') + Math.round(pf) + ' ms', tx, ty);
      ty += 17;
    } else {
      ctx.fillStyle = PAL.faint;
      ctx.fillText(NOVICE ? 'waiting for first word…' : 'waiting for first token…', tx, ty);
      ty += 17;
    }
    if (emitted > 1) {
      if (NOVICE) {
        ctx.fillStyle = PAL.orangeDark;
        ctx.fillText('then steady, one word per pass', tx, ty);
        ty += 17;
      } else {
        ctx.fillStyle = PAL.orangeDark;
        ctx.fillText('then ' + DECODE_MS + ' ms per token', tx, ty);
        ty += 17;
        if (DEEP) {
          ctx.fillStyle = PAL.faint;
          ctx.fillText('≈' + Math.round(1000 / DECODE_MS) + ' tok/s decode', tx, ty);
          ty += 15;
          ctx.fillText(WEIGHTS_GB + ' GB ÷ ' + HBM_TBS + ' TB/s', tx, ty);
          ty += 15;
          ctx.fillText('= ceiling ≈' + CEIL + ' tok/s', tx, ty);
        } else if (finished) {
          ctx.fillStyle = PAL.faint;
          ctx.fillText('≈' + Math.round(1000 / DECODE_MS) + ' tok/s', tx, ty);
        }
      }
    }
  }

  cv.onResize(draw);
  const loop = kit.animLoop(dt => {
    if (simT >= totalMs()) {
      holdT += dt;
      if (holdT > 2.2) { simT = 0; holdT = 0; }
    } else {
      simT += dt * 1000 * 0.13 * speed;   // ~7.7× slower than the simulated clock
    }
    draw();
  });
  const CAP = NOVICE
    ? 'Your reply is made in two steps: first the whole request is read in one pass — a longer ' +
      'request makes a longer opening pause — then the answer is written one piece per pass at a ' +
      'steady rate. Stretch the request to watch the opening pause grow while the writing pace holds.'
    : (DEEP
      ? 'Prefill absorbs the whole prompt in one parallel, compute-bound pass — your time to first ' +
        'token, growing with prompt length. Decode then makes one memory-bound pass per token: each ' +
        'token requires streaming the full weights out of HBM once, giving a hard ceiling of about ' +
        'bandwidth ÷ weight-bytes tokens per second per stream (the arithmetic is shown at right). ' +
        'Times are illustrative and the clock is slowed for visibility.'
      : 'Prefill absorbs the whole prompt in a single parallel pass — that pass is your time to ' +
        'first token, and it grows with prompt length. Decode then makes one full pass through ' +
        'every layer for each token, at a roughly steady rate — in reality it slows gradually as ' +
        'the context and its cache grow. Times shown are illustrative and the clock is slowed for visibility.');
  kit.caption(container, CAP);
  return loop;
});
