'use strict';
/* fig-sampling — real softmax over hand-designed logits.
   Temperature reshapes the bars; Sample draws from the distribution,
   appends the token, and moves to the next hand-made step.
   Level-aware: novice keeps only the temperature slider and draws on its
   own; deep exposes the temperature-scaled logits and the top-p cutoff. */
Figures.register('fig-sampling', (container, kit) => {
  const level = kit.level();
  const isNovice = level === 'novice';
  const isDeep = level === 'deep';

  const cv = kit.makeCanvas(container, { height: 348,
    ariaLabel: 'Bar chart of a softmax probability distribution over candidate next tokens, reshaped by a temperature slider and sampled by a random draw.' });
  const ctx = cv.ctx;

  /* hand-designed logits for four consecutive positions */
  const STEPS = [
    [[' Paris', 9.0], [' the', 6.5], [' a', 6.0], [' located', 5.5], [' one', 5.2],
     [' also', 5.0], ['Paris', 4.8], [' famous', 4.4], [' known', 4.2], [' home', 4.0]],
    [[',', 8.0], ['.', 7.2], [' and', 5.0], [' which', 4.6], [' —', 4.2],
     [' but', 4.0], [' in', 3.8], [' itself', 3.4], [' today', 3.2], [' of', 3.0]],
    [[' home', 7.4], [' a', 7.0], [' the', 6.4], [' which', 6.0], [' known', 5.4],
     [' one', 5.0], [' famous', 4.8], [' and', 4.4], [' where', 4.2], [' France', 3.6]],
    [[' to', 7.8], [' of', 6.6], [' city', 6.2], [' capital', 5.2], [' and', 4.8],
     [' known', 4.4], [' for', 4.0], [' with', 3.8], [' in', 3.4], [' that', 3.0]],
  ];
  const BASE_CONTEXT = 'The capital of France is';
  const TOP_P = 0.9;
  const N_CAND = isNovice ? 6 : 10;   /* candidate rows shown */
  function candsFor(idx) { return STEPS[idx].slice(0, N_CAND); }

  let stepIdx = 0;
  let appended = [];          /* sampled tokens so far */
  let done = false;
  let autoT = 0;              /* novice: time toward the next self-run draw */
  /* anim: null | {phase:'drop'|'reveal', t, u, chosen} */
  let anim = null;

  function rgba(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  const controls = kit.makeControls(container);
  const tempSl = kit.makeSlider(controls, {
    label: 'Temperature', min: 0.1, max: 2, step: 0.05, value: 1,
    format: v => v.toFixed(2),
    onInput: () => draw(),
  });
  let topToggle = null;
  let sampleBtn = null;
  if (!isNovice) {
    topToggle = kit.makeToggle(controls, 'top-p = 0.9', false, () => draw());
    sampleBtn = kit.makeButton(controls, 'Sample', () => {
      if (anim) return;
      if (done) {
        stepIdx = 0;
        appended = [];
        done = false;
        sampleBtn.textContent = 'Sample';
        draw();
        return;
      }
      drawSample();
    });
  }

  /* draw one token from the current distribution and start the fall animation.
     Freeze the distribution with the sample so dragging Temperature mid-animation
     cannot move the bars out from under the marker. */
  function drawSample() {
    const d = dist();
    const u = Math.random();
    let cum = 0, chosen = 0;
    for (let i = 0; i < d.sp.length; i++) {
      cum += d.sp[i];
      if (u <= cum) { chosen = i; break; }
      chosen = i;
    }
    anim = { phase: 'drop', t: 0, u: u, chosen: chosen, d: d };
  }

  /* softmax at current temperature, plus the top-p mask */
  function dist() {
    const T = tempSl.value;
    const logits = candsFor(stepIdx).map(c => c[1]);
    let m = -Infinity;
    for (const l of logits) m = Math.max(m, l / T);
    const e = logits.map(l => Math.exp(l / T - m));
    let s = 0;
    for (const x of e) s += x;
    const p = e.map(x => x / s);
    let keep = p.map(() => true);
    if (topToggle && topToggle.value) {
      const idx = p.map((v, i) => i).sort((a, b) => p[b] - p[a]);
      const kept = new Set();
      let cum = 0;
      for (const i of idx) {
        kept.add(i);
        cum += p[i];
        if (cum >= TOP_P) break;
      }
      keep = p.map((v, i) => kept.has(i));
    }
    let ks = 0;
    p.forEach((v, i) => { if (keep[i]) ks += v; });
    const sp = p.map((v, i) => (keep[i] ? v / ks : 0));  /* sampling probs */
    return { p: p, keep: keep, sp: sp };
  }

  function label(tok) {
    return tok.replace(/^ /, '␣');   /* make the leading space visible */
  }

  function draw() {
    const w = cv.w, h = cv.h;
    ctx.clearRect(0, 0, w, h);

    /* context line */
    let text = BASE_CONTEXT + appended.join('');
    ctx.textBaseline = 'alphabetic';
    let cf = 12;
    ctx.font = cf + 'px ' + PAL.mono;
    if (ctx.measureText(text + ' _').width > w - 20) { cf = 11; ctx.font = cf + 'px ' + PAL.mono; }
    while (ctx.measureText('…' + text + ' _').width > w - 20 && text.length > 8) {
      text = text.slice(2);
    }
    const shown = text === BASE_CONTEXT + appended.join('') ? text : '…' + text;
    ctx.textAlign = 'left';
    ctx.fillStyle = PAL.inkStrong;
    ctx.fillText(shown, 10, 22);
    const tw = ctx.measureText(shown).width;
    ctx.fillStyle = PAL.orange;
    ctx.fillText('_', 12 + tw, 22);

    if (done) {
      ctx.font = '13px ' + PAL.sans;
      ctx.fillStyle = PAL.faint;
      ctx.textAlign = 'center';
      ctx.fillText('…and each new token restarts the whole forward pass.', w / 2, h / 2);
      ctx.fillText(isNovice ? 'starting over…' : 'Press Reset to start over.', w / 2, h / 2 + 22);
      return;
    }

    const d = anim ? anim.d : dist();
    const cands = candsFor(stepIdx);
    const n = cands.length;

    /* rows of horizontal bars */
    ctx.font = '11px ' + PAL.mono;
    let labW = 0;
    for (const c of cands) labW = Math.max(labW, ctx.measureText(label(c[0])).width);
    const x0 = Math.min(14 + labW, 96) + (isDeep ? 26 : 0);
    const rowTop = 40;
    const rowH = (h - rowTop - 62) / n;
    const plotW = w - x0 - 48;
    if (isDeep) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = PAL.faint;
      ctx.fillText('logit÷T', 8, rowTop - 5);
    }
    for (let i = 0; i < n; i++) {
      const y = rowTop + i * rowH;
      const cy = y + rowH / 2;
      const excluded = !d.keep[i];
      const isChosen = anim && anim.phase === 'reveal' && anim.chosen === i;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = excluded ? rgba(PAL.faint, 0.55) : (isChosen ? PAL.orange : PAL.ink);
      ctx.fillText(label(cands[i][0]), x0 - 6, cy);
      const bw = Math.max(1, d.p[i] * plotW);
      ctx.fillStyle = excluded ? PAL.graySoft : (isChosen ? PAL.orange : PAL.blue);
      ctx.fillRect(x0, cy - Math.min(9, rowH * 0.36), bw, Math.min(18, rowH * 0.72));
      if (excluded) {
        ctx.strokeStyle = PAL.grid;
        ctx.lineWidth = 1;
        ctx.strokeRect(x0, cy - Math.min(9, rowH * 0.36), bw, Math.min(18, rowH * 0.72));
      }
      ctx.textAlign = 'left';
      ctx.fillStyle = excluded ? rgba(PAL.faint, 0.55) : PAL.faint;
      const pct = d.p[i] * 100;
      ctx.fillText((pct >= 9.5 ? pct.toFixed(0) : pct.toFixed(1)) + '%', x0 + bw + 5, cy);
      if (isDeep) {
        const z = cands[i][1] / tempSl.value;
        ctx.textAlign = 'left';
        ctx.fillStyle = excluded ? rgba(PAL.faint, 0.55) : PAL.faint;
        ctx.fillText(z >= 10 ? z.toFixed(0) : z.toFixed(1), 8, cy);
      }
    }

    /* cumulative bar */
    const cbY = h - 34;
    const cbH = 15;
    ctx.font = '11px ' + PAL.sans;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = PAL.faint;
    ctx.fillText(isNovice ? 'the weighted die lands somewhere along here'
      : 'cumulative probability — the random draw lands here', x0, cbY - 7);
    if (isDeep && topToggle && topToggle.value) {
      let k = 0, sm = 0;
      for (let i = 0; i < n; i++) { if (d.keep[i]) { k++; sm += d.p[i]; } }
      ctx.textAlign = 'right';
      ctx.fillText('top-p 0.90 keeps ' + k + ' (Σ' + sm.toFixed(2) + ')', x0 + plotW, cbY - 7);
      ctx.textAlign = 'left';
    }
    let cx = x0;
    for (let i = 0; i < n; i++) {
      const segW = d.sp[i] * plotW;
      if (segW <= 0) continue;
      const isChosen = anim && anim.phase === 'reveal' && anim.chosen === i;
      ctx.fillStyle = isChosen ? PAL.orange : (i % 2 === 0 ? PAL.blue : PAL.blueSoft);
      ctx.fillRect(cx, cbY, segW, cbH);
      cx += segW;
    }
    ctx.strokeStyle = PAL.grid;
    ctx.lineWidth = 1;
    ctx.strokeRect(x0, cbY, plotW, cbH);

    /* falling marker */
    if (anim) {
      const mx = x0 + anim.u * plotW;
      let my;
      if (anim.phase === 'drop') {
        my = kit.lerp(rowTop - 6, cbY - 7, kit.ease.out(Math.min(1, anim.t / 0.55)));
      } else {
        my = cbY - 7;
      }
      ctx.fillStyle = PAL.red;
      ctx.beginPath();
      ctx.moveTo(mx, my + 6);
      ctx.lineTo(mx - 5, my - 3);
      ctx.lineTo(mx + 5, my - 3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba(PAL.red, 0.5);
      ctx.beginPath();
      ctx.moveTo(mx, my + 6);
      ctx.lineTo(mx, cbY + cbH);
      ctx.stroke();
    }
  }

  const loop = kit.animLoop(dt => {
    if (isNovice && !anim) {
      autoT += dt;
      if (done) {
        if (autoT > 1.8) { stepIdx = 0; appended = []; done = false; autoT = 0; }
      } else if (autoT > 1.1) {
        autoT = 0;
        drawSample();
      }
    }
    if (anim) {
      anim.t += dt;
      if (anim.phase === 'drop' && anim.t >= 0.55) {
        anim.phase = 'reveal';
        anim.t = 0;
      } else if (anim.phase === 'reveal' && anim.t >= 0.9) {
        appended.push(candsFor(stepIdx)[anim.chosen][0]);
        stepIdx += 1;
        anim = null;
        if (stepIdx >= STEPS.length) {
          done = true;
          if (sampleBtn) sampleBtn.textContent = 'Reset';
        }
      }
    }
    draw();
  });

  cv.onResize(draw);
  draw();
  const cap = isNovice
    ? 'The model’s scores for the next word, turned into odds. Low temperature funnels almost all the odds onto one word (“␣Paris”); high temperature spreads them out. Drag the slider and the figure keeps rolling its weighted die on its own, adding one word at a time.'
    : isDeep
      ? 'A genuine softmax over invented logits. The left column shows each logit divided by the temperature (logit÷T) — the values the softmax actually exponentiates — and the bars are the resulting probabilities. Toggle top-p to grey out the tail and read the cutoff (how many tokens it keeps and their mass); press Sample to draw one token and continue on the longer context.'
      : 'A genuine softmax over invented logits. Low temperature funnels nearly all probability to ' +
        '“␣Paris”; high temperature spreads it thin. Top-p removes the grayed-out tail before sampling. ' +
        'Each Sample press draws one token and the process starts over on the longer context.';
  kit.caption(container, cap);
  return loop;
});
