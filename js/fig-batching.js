/* fig-batching — continuous batching on one model server: rows are batch
   slots, columns are forward passes; requests join and leave at token
   granularity. */
'use strict';

Figures.register('fig-batching', (container, kit) => {
  const level = kit.level();
  const NOVICE = level === 'novice';
  const DEEP = level === 'deep';

  const ARIA = NOVICE
    ? 'A timeline where each row is a seat and each order is a bar; finished orders leave and new ones slip in without the line stopping.'
    : (DEEP
      ? 'A timeline of continuous batching on one model server, requests joining and leaving the batch at single-token granularity, with a readout comparing continuous batching against static batching and the average wait.'
      : 'A timeline of continuous batching on one model server, where requests join and leave the batch at the granularity of a single token.');

  const cv = kit.makeCanvas(container, { aspect: 0.6, maxHeight: 400,
    ariaLabel: ARIA });
  const controls = kit.makeControls(container);

  let arrival = 2.0; // requests per second (animation time)
  kit.makeSlider(controls, {
    label: NOVICE ? 'Orders arriving' : 'Arrival rate', min: 0.3, max: 4.5, step: 0.1, value: arrival,
    format: v => v.toFixed(1) + '/s',
    onInput: v => { arrival = v; },
  });

  const SLOTS = NOVICE ? 4 : 8;
  const STEPS_PER_SEC = 3;   // forward passes per second, slowed for legibility
  const NOMINAL = 50;        // tokens/sec a real server might emit per slot
  const COLORS = [PAL.blue, PAL.green, PAL.purple, PAL.teal, PAL.yellow, PAL.blueDark];

  let step = 0;              // continuous forward-pass clock
  let lastInt = 0;           // last integer boundary handled
  let acc = 0;               // arrival accumulator
  let colorIdx = 0;
  let mineWaiting = false, mineActive = false, mineTimer = 3;
  let emaOcc = 0;
  let emaWait = 0;           // deep: mean wait (in forward passes) before admission
  const recentLens = [];     // deep: token counts of recently admitted requests

  const slots = new Array(SLOTS).fill(null);
  const reqs = [];           // every request still on screen
  const queue = [];

  function newSpec(mine) {
    return {
      tokens: 4 + Math.floor(Math.random() * 22),
      color: mine ? PAL.orange : COLORS[colorIdx++ % COLORS.length],
      mine: !!mine,
      slot: -1, start: 0, end: 0, enq: step,
    };
  }

  function boundary(s) {
    // requests leave the batch...
    for (let i = 0; i < SLOTS; i++) {
      const r = slots[i];
      if (r && s >= r.end) {
        slots[i] = null;
        if (r.mine) { mineActive = false; mineTimer = 8; }
      }
    }
    // ...and waiting requests immediately take the freed slots
    for (let i = 0; i < SLOTS && queue.length; i++) {
      if (slots[i]) continue;
      const r = queue.shift();
      r.slot = i; r.start = s; r.end = s + 1 + r.tokens;
      if (r.mine) { mineWaiting = false; mineActive = true; }
      slots[i] = r;
      reqs.push(r);
      if (DEEP) {
        emaWait += ((s - r.enq) - emaWait) * 0.2;
        recentLens.push(r.tokens);
        if (recentLens.length > 24) recentLens.shift();
      }
    }
  }

  function advance(dt) {
    acc += dt * arrival;
    while (acc >= 1) {
      acc -= 1;
      if (queue.length < 12) queue.push(newSpec(false));
    }
    if (!mineWaiting && !mineActive) {
      mineTimer -= dt;
      if (mineTimer <= 0 && queue.length < 12) { queue.push(newSpec(true)); mineWaiting = true; }
    }
    step += dt * STEPS_PER_SEC;
    while (lastInt < Math.floor(step)) { lastInt++; boundary(lastInt); }
    // prune bars that scrolled far off the left edge
    for (let i = reqs.length - 1; i >= 0; i--) {
      if (step - reqs[i].end > 60) reqs.splice(i, 1);
    }
    const occ = slots.reduce((n, r) => n + (r ? 1 : 0), 0);
    emaOcc += (occ - emaOcc) * Math.min(1, dt * 1.5);
  }

  // warm-up so the figure isn't empty when it scrolls into view
  for (let i = 0; i < 90; i++) advance(0.1);

  function draw() {
    const { ctx, w, h } = cv;
    ctx.clearRect(0, 0, w, h);

    const left = 26, topBar = DEEP ? 56 : 40, bottom = 20, right = 6;
    const plotW = w - left - right;
    const plotH = h - topBar - bottom;
    const cellW = plotW / Math.max(12, Math.floor(plotW / (w < 480 ? 16 : 21)));
    const rowH = plotH / SLOTS;
    const nowX = left + plotW * 0.86;
    const xOf = s => nowX - (step - s) * cellW;

    // readout
    const occ = slots.reduce((n, r) => n + (r ? 1 : 0), 0);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = PAL.inkStrong;
    ctx.font = '600 13px ' + PAL.mono;
    ctx.fillText((NOVICE ? 'seats ' : 'batch ') + occ + '/' + SLOTS, left, 16);
    ctx.fillStyle = PAL.faint;
    ctx.font = '11px ' + PAL.mono;
    const combined = Math.round(emaOcc * NOMINAL);
    if (NOVICE) {
      ctx.fillText('≈' + combined + ' words out per second', left, 32);
    } else {
      // long form only if it clears the "now" marker above the plot
      let sub = '≈' + combined + ' tok/s combined · one user alone: ' + NOMINAL + ' tok/s';
      if (left + ctx.measureText(sub).width > nowX - ctx.measureText('now').width - 10) {
        sub = '≈' + combined + ' tok/s combined';
      }
      ctx.fillText(sub, left, 32);
      if (DEEP) {
        // static-vs-continuous comparison: static batching stalls the whole
        // batch on its slowest member, so utilization ~ mean/max length
        let mean = 0, mx = 1;
        for (const t of recentLens) { mean += t; if (t > mx) mx = t; }
        mean = recentLens.length ? mean / recentLens.length : 0;
        const contPct = Math.round((emaOcc / SLOTS) * 100);
        const staticPct = Math.round((mean / mx) * (emaOcc / SLOTS) * 100);
        let d = 'continuous ' + contPct + '% vs static ' + staticPct + '% slot use · avg wait ' +
          emaWait.toFixed(1) + ' passes';
        if (left + ctx.measureText(d).width > w - 6) {
          d = 'cont ' + contPct + '% vs static ' + staticPct + '% · wait ' + emaWait.toFixed(1);
        }
        ctx.fillText(d, left, 48);
      }
    }

    // clip to plot area (extended slightly above so the top slot's
    // "you" label, drawn just above its bar, is not clipped)
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, topBar - 14, plotW, plotH + 14);
    ctx.clip();

    // gridlines: one per forward pass, labels every 10
    const firstS = Math.floor(step - nowX / cellW);
    const lastS = Math.ceil(step + (w - nowX) / cellW);
    for (let s = firstS; s <= lastS; s++) {
      const x = xOf(s);
      ctx.strokeStyle = PAL.grid;
      ctx.lineWidth = s % 10 === 0 ? 1.4 : 0.7;
      ctx.beginPath();
      ctx.moveTo(x, topBar);
      ctx.lineTo(x, topBar + plotH);
      ctx.stroke();
    }

    // row separators
    ctx.strokeStyle = PAL.grid;
    ctx.lineWidth = 0.7;
    for (let i = 0; i <= SLOTS; i++) {
      ctx.beginPath();
      ctx.moveTo(left, topBar + i * rowH);
      ctx.lineTo(left + plotW, topBar + i * rowH);
      ctx.stroke();
    }

    // request bars
    for (const r of reqs) {
      const x0 = xOf(r.start);
      const cur = Math.min(step, r.end);
      const x1 = xOf(cur);
      if (x1 < left - 20) continue;
      const y = topBar + r.slot * rowH + rowH * 0.16;
      const bh = rowH * 0.68;
      // body (decode region), translucent fill of the request's color
      kit.roundedRect(ctx, x0, y, Math.max(x1 - x0, 3), bh, 4);
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = r.color;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.mine ? 1.8 : 1.1;
      ctx.stroke();
      // prefill chunk: first pass, solid
      const px1 = Math.min(xOf(r.start + 1), x1);
      if (px1 > x0) {
        kit.roundedRect(ctx, x0, y, px1 - x0, bh, 4);
        ctx.fillStyle = r.color;
        ctx.fill();
      }
      // token cell separators
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 0.6;
      ctx.globalAlpha = 0.55;
      for (let s = r.start + 2; s < cur; s++) {
        const x = xOf(s);
        if (x <= px1) continue;
        ctx.beginPath();
        ctx.moveTo(x, y + 1.5);
        ctx.lineTo(x, y + bh - 1.5);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (r.mine) {
        ctx.fillStyle = PAL.orange;
        ctx.font = '600 11px ' + PAL.sans;
        ctx.fillText('you', Math.max(x0 + 3, left + 3), y - 2);
      }
    }
    ctx.restore();

    // the "now" line: the forward pass currently executing
    ctx.strokeStyle = PAL.inkStrong;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(nowX, topBar - 4);
    ctx.lineTo(nowX, topBar + plotH);
    ctx.stroke();
    ctx.fillStyle = PAL.inkStrong;
    ctx.font = '600 11px ' + PAL.sans;
    ctx.textAlign = 'center';
    ctx.fillText('now', nowX, topBar - 8);

    // slot labels
    ctx.fillStyle = PAL.faint;
    ctx.font = '11px ' + PAL.mono;
    ctx.textAlign = 'right';
    for (let i = 0; i < SLOTS; i++) {
      ctx.fillText(String(i + 1), left - 6, topBar + (i + 0.5) * rowH + 4);
    }

    // axis: forward-pass numbers every 10 steps (skip any that would
    // land under the axis label at the left edge)
    const axisLabel = NOVICE ? 'time →' : 'forward passes →';
    const axisLabelW = ctx.measureText(axisLabel).width;
    ctx.textAlign = 'center';
    for (let s = Math.ceil(firstS / 10) * 10; s <= lastS; s += 10) {
      const x = xOf(s);
      if (x > left + axisLabelW + 16 && x < w - 14) ctx.fillText(String(s), x, h - 5);
    }
    ctx.textAlign = 'left';
    ctx.fillText(axisLabel, left, h - 5);
  }

  cv.onResize(draw);
  const loop = kit.animLoop(dt => { advance(dt); draw(); });
  const CAP = NOVICE
    ? 'One line, many orders at once: each row is a seat and each bar an order, with yours in ' +
      'orange. A finished order leaves and a waiting one slips into the empty seat, so the line ' +
      'never pauses. Turn up the arrivals to fill the seats.'
    : (DEEP
      ? 'Continuous batching, slowed down enormously: each column is one forward pass, each row a ' +
        'slot, each bar a request (bright prefill, then one cell per token; yours in orange). ' +
        'The readout compares slot utilization against static batching &mdash; which would stall the ' +
        'whole batch on its slowest member &mdash; and shows the average wait before admission. ' +
        'The tok/s figures assume a nominal 50 tokens per second per slot.'
      : 'Continuous batching, slowed down enormously: each column is one forward pass through the ' +
        'whole model, each row one batch slot. A request occupies a slot with a bright prefill pass ' +
        'and then one cell per generated token; freed slots are refilled mid-stream. ' +
        'The tok/s figures assume a nominal 50 tokens per second per slot.');
  kit.caption(container, CAP);
  return loop;
});
