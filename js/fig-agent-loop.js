'use strict';
/* fig-agent-loop — the agent cycle: model -> tool_use -> local execution
   -> tool_result -> model, with a pulse lapping the loop and an API-call
   counter. After a few laps the pulse exits to a "final answer" node.
   Level-aware:
     novice — plain-language nodes, a "round" counter, self-running (no
              controls).
     mid    — model (API) / tool_use / your machine / tool_result, Speed slider.
     deep   — the mid figure plus edge block-type labels (tool_use /
              tool_result), a live stop_reason readout, and an iteration
              ceiling. */
Figures.register('fig-agent-loop', (container, kit) => {
  const level = kit.level();

  const ariaLabel = level === 'novice'
    ? 'A four-step loop — the model, asking to do something, your computer doing it, and the result going back — repeats until the model gives the final answer in the middle.'
    : level === 'deep'
    ? 'A four-node agent cycle — model, tool_use request, your machine running the tool, tool_result — with a lapping pulse, an API-call and iteration counter, and a stop_reason readout that reads tool_use while looping and end_turn when it exits to the final answer.'
    : 'A four-node cycle — model, tool-use request, your machine running the tool, and tool result — with a pulse lapping the loop and an API-call counter until it exits to a final answer.';

  const cv = kit.makeCanvas(container, { aspect: 0.78, maxHeight: 420, ariaLabel });

  let speed = null;
  if (level !== 'novice') {
    const controls = kit.makeControls(container);
    speed = kit.makeSlider(controls, {
      label: 'Speed', min: 0.4, max: 2.5, step: 0.1, value: 1,
      format: v => v.toFixed(1) + '×',
    });
  }
  const spd = () => speed ? speed.value : 1;

  const SEG_T = 0.9, DWELL_T = 0.45, LAPS = 4;

  const NODES = level === 'novice'
    ? [
        { lines: ['the model'],                fill: PAL.blueSoft,   stroke: PAL.blue,   mono: false },
        { lines: ['asks to do', 'something'],  fill: PAL.purpleSoft, stroke: PAL.purple, mono: false },
        { lines: ['your computer', 'does it'], fill: PAL.orangeSoft, stroke: PAL.orange, mono: false },
        { lines: ['sends the', 'result back'], fill: PAL.bg,         stroke: PAL.teal,   mono: false },
      ]
    : [
        { lines: ['model (API)'],                 fill: PAL.blueSoft,   stroke: PAL.blue,   mono: false },
        { lines: ['tool_use', 'request'],         fill: PAL.purpleSoft, stroke: PAL.purple, mono: true  },
        { lines: ['your machine', 'runs the tool'], fill: PAL.orangeSoft, stroke: PAL.orange, mono: false },
        { lines: ['tool_result'],                 fill: PAL.bg,         stroke: PAL.teal,   mono: true  },
      ];
  /* what travels on each segment (0: model->right, 1: right->bottom, ...) */
  const PULSE_COLOR = [PAL.purple, PAL.purple, PAL.teal, PAL.teal];

  let st;
  function reset() {
    st = { phase: 'dwell', node: 0, seg: 0, t: 0, apiCalls: 1 };
  }
  reset();

  function advance(dt) {
    st.t += dt * spd();
    if (st.phase === 'dwell' && st.t > DWELL_T) {
      st.t = 0;
      if (st.node === 0 && st.apiCalls >= LAPS) st.phase = 'exit';
      else { st.phase = 'move'; st.seg = st.node; }
    } else if (st.phase === 'move' && st.t > SEG_T) {
      st.t = 0;
      st.node = (st.seg + 1) % 4;
      if (st.node === 0) st.apiCalls += 1;
      st.phase = 'dwell';
    } else if (st.phase === 'exit' && st.t > SEG_T) {
      st.t = 0; st.phase = 'hold';
    } else if (st.phase === 'hold' && st.t > 2.2) {
      st.t = 0; st.phase = 'fade';
    } else if (st.phase === 'fade' && st.t > 0.6) {
      reset();
    }
  }

  function nodeBox(ctx, spec, cx, cy) {
    ctx.font = (spec.mono ? '12px ' + PAL.mono : '12px ' + PAL.sans);
    let tw = 0;
    spec.lines.forEach(s => { tw = Math.max(tw, ctx.measureText(s).width); });
    const bw = tw + 20, bh = spec.lines.length * 15 + 11;
    return { cx, cy, bw, bh, x: cx - bw / 2, y: cy - bh / 2 };
  }

  /* point on the edge of box b along the ray from its center toward (tx,ty) */
  function edgePoint(b, tx, ty) {
    const dx = tx - b.cx, dy = ty - b.cy;
    const s = Math.max(Math.abs(dx) / (b.bw / 2 + 7), Math.abs(dy) / (b.bh / 2 + 7));
    return { x: b.cx + dx / s, y: b.cy + dy / s };
  }

  function drawBox(ctx, spec, b, hot, alpha) {
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = spec.fill;
    kit.roundedRect(ctx, b.x, b.y, b.bw, b.bh, 8);
    ctx.fill();
    ctx.strokeStyle = spec.stroke;
    ctx.lineWidth = hot ? 2.6 : 1.4;
    ctx.stroke();
    ctx.fillStyle = PAL.inkStrong;
    ctx.font = (spec.mono ? '12px ' + PAL.mono : '12px ' + PAL.sans);
    ctx.textAlign = 'center';
    spec.lines.forEach((s, i) => {
      ctx.fillText(s, b.cx, b.y + 15 + i * 15 + (spec.lines.length === 1 ? 2 : 0));
    });
    ctx.globalAlpha = 1;
  }

  function draw() {
    const { ctx, w, h } = cv;
    ctx.clearRect(0, 0, w, h);
    ctx.textBaseline = 'alphabetic';

    const cx = w / 2, cy = h * 0.52;
    /* keep side boxes inside the canvas at 320 px */
    const rx = kit.clamp(w / 2 - 66, 90, 215);
    const ry = kit.clamp(h * 0.36, 68, 130);
    const centers = [
      [cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy],
    ];
    const boxes = NODES.map((n, i) => nodeBox(ctx, n, centers[i][0], centers[i][1]));

    /* arrows around the cycle */
    for (let i = 0; i < 4; i++) {
      const a = boxes[i], b = boxes[(i + 1) % 4];
      const p = edgePoint(a, b.cx, b.cy), q = edgePoint(b, a.cx, a.cy);
      kit.arrow(ctx, p.x, p.y, q.x, q.y, { color: PAL.faint, width: 1.4, head: 7 });
    }

    /* nodes */
    NODES.forEach((n, i) => {
      drawBox(ctx, n, boxes[i], st.phase === 'dwell' && st.node === i);
    });

    /* deep: label what rides each half of the loop */
    if (level === 'deep') {
      const labels = [
        { seg: 0, t: 'tool_use',    c: PAL.purple },
        { seg: 2, t: 'tool_result', c: PAL.teal },
      ];
      ctx.font = '11px ' + PAL.mono;
      ctx.textAlign = 'center';
      labels.forEach(L => {
        const a = boxes[L.seg], b = boxes[(L.seg + 1) % 4];
        const p = edgePoint(a, b.cx, b.cy), q = edgePoint(b, a.cx, a.cy);
        const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
        const tw = ctx.measureText(L.t).width;
        ctx.fillStyle = PAL.bg;                    /* halo for legibility */
        ctx.fillRect(mx - tw / 2 - 3, my - 8, tw + 6, 15);
        ctx.fillStyle = L.c;
        ctx.fillText(L.t, mx, my + 3);
      });
    }

    /* final-answer node in the middle of the loop */
    const finalSpec = {
      lines: [level === 'novice' ? 'the answer' : 'final answer'],
      fill: PAL.greenSoft, stroke: PAL.green, mono: false,
    };
    const fb = nodeBox(ctx, finalSpec, cx, cy);
    let fAlpha = 0;
    if (st.phase === 'hold') fAlpha = Math.min(1, st.t * 3);
    else if (st.phase === 'fade') fAlpha = 1 - st.t / 0.6;
    if (fAlpha > 0) drawBox(ctx, finalSpec, fb, st.phase === 'hold', fAlpha);

    /* traveling pulse */
    if (st.phase === 'move' || st.phase === 'exit') {
      const e = kit.ease.inOut(kit.clamp(st.t / SEG_T, 0, 1));
      let p, q, col;
      if (st.phase === 'move') {
        const a = boxes[st.seg], b = boxes[(st.seg + 1) % 4];
        p = edgePoint(a, b.cx, b.cy); q = edgePoint(b, a.cx, a.cy);
        col = PULSE_COLOR[st.seg];
      } else {
        p = edgePoint(boxes[0], cx, cy);
        q = { x: cx, y: fb.y - 6 };
        col = PAL.green;
      }
      const x = kit.lerp(p.x, q.x, e), y = kit.lerp(p.y, q.y, e);
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI * 2); ctx.fill();
    }

    /* counter */
    ctx.textAlign = 'left';
    if (level === 'novice') {
      ctx.font = '12px ' + PAL.sans;
      ctx.fillStyle = PAL.ink;
      ctx.fillText('round ' + st.apiCalls, 8, 20);
      ctx.font = '11px ' + PAL.sans;
      ctx.fillStyle = PAL.faint;
      ctx.fillText('one question', 8, 36);
    } else if (level === 'deep') {
      ctx.font = '12px ' + PAL.mono;
      ctx.fillStyle = PAL.ink;
      ctx.fillText('API calls: ' + st.apiCalls, 8, 20);
      const stopping = st.phase === 'exit' || st.phase === 'hold' || st.phase === 'fade';
      ctx.fillStyle = stopping ? PAL.greenDark : PAL.purple;
      ctx.fillText('stop_reason: ' + (stopping ? 'end_turn' : 'tool_use'), 8, 38);
      ctx.font = '11px ' + PAL.sans;
      ctx.fillStyle = PAL.faint;
      ctx.fillText('one user prompt · max_iterations 25', 8, 54);
    } else {
      ctx.font = '12px ' + PAL.mono;
      ctx.fillStyle = PAL.ink;
      ctx.fillText('API calls: ' + st.apiCalls, 8, 20);
      ctx.font = '11px ' + PAL.sans;
      ctx.fillStyle = PAL.faint;
      ctx.fillText('one user prompt', 8, 36);
    }
  }

  const loop = kit.animLoop(dt => { advance(dt); draw(); });
  cv.onResize(draw);
  draw();

  const caption = level === 'novice'
    ? 'One question can take several rounds: the model keeps asking your computer to ' +
      'do things and reading the results, and only stops to answer once it has what it needs.'
    : level === 'deep'
    ? 'One prompt, many round trips. Each lap the model returns stop_reason: tool_use, ' +
      'your machine runs the tool and returns a tool_result, and the whole context is ' +
      'resent — until a turn comes back as end_turn, the plain-text final answer.'
    : 'One prompt, many round trips: the model answers with tool_use requests, your ' +
      'machine executes them and returns tool_result blocks, and the context is resent ' +
      'each lap — until the model finally replies with plain text.';
  kit.caption(container, caption);

  return loop;
});
