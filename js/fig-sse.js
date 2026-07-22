/* fig-sse — SSE event frames sliding down a wire (left) while a mini
   terminal (right) accumulates their fragments into visible text.

   Level-aware:
   - novice: plain pieces of the answer arriving one at a time, no protocol
     names, self-running, no controls.
   - mid: the standard figure (unchanged).
   - deep: adds a raw-frame readout (actual event: / data: lines) and live
     input/output token usage. */
'use strict';

Figures.register('fig-sse', (container, kit) => {
  const level = kit.level();
  const deep = level === 'deep';

  /* line-wrap used by every level (hoisted; safe to call anywhere here) */
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
     NOVICE — one idea: the answer comes back in small pieces, and
     each piece appears the instant it arrives. No jargon, no knobs.
     ================================================================ */
  if (level === 'novice') {
    const cv = kit.makeCanvas(container, { height: 300,
      ariaLabel: 'Small pieces of the answer arrive one at a time on the left and gather into readable text on the right, so the reply seems to type itself out.' });

    const FRAGS = ['Fix', 'ed', ' the', ' fail', 'ing', ' test', '.'];
    const TRAVEL = 1.2;
    const GAP = 0.62;
    const arrT = [];
    { let t = TRAVEL + 0.3; for (let i = 0; i < FRAGS.length; i++) { t += GAP; arrT.push(t); } }
    const END_T = arrT[arrT.length - 1] + 1.6;
    const LOOP_T = END_T + 1.3;

    let time = 0;

    function drawN() {
      const { ctx, w, h } = cv;
      ctx.clearRect(0, 0, w, h);
      const m = 12;
      const laneW = kit.clamp(w * 0.42, 128, 230);
      const wireX = m + laneW / 2;
      const topY = 44;
      const arrY = h - 40;
      const panelX = m + laneW + 18;
      const panelW = w - m - panelX;
      const panelY = 30;
      const panelH = h - panelY - 14;

      /* headers */
      ctx.font = '12px ' + PAL.sans;
      ctx.fillStyle = PAL.faint;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('the answer, in pieces', wireX, 20);
      ctx.fillText('what you see', panelX + panelW / 2, 20);

      /* the wire */
      ctx.strokeStyle = PAL.grid;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wireX, topY - 6);
      ctx.lineTo(wireX, arrY + 4);
      ctx.stroke();
      kit.arrow(ctx, wireX, arrY + 4, panelX - 6, arrY + 4, { color: PAL.grid, width: 2, head: 7 });

      /* how many pieces have arrived */
      let arrived = 0;
      while (arrived < FRAGS.length && arrT[arrived] <= time) arrived++;

      /* a piece in flight */
      const chipW = laneW - 10;
      for (let i = 0; i < FRAGS.length; i++) {
        const born = arrT[i] - TRAVEL;
        if (time < born || time > arrT[i] + 0.3) continue;
        let y, alpha = 1;
        if (time <= arrT[i]) {
          const p = (time - born) / TRAVEL;
          y = kit.lerp(topY, arrY - 20, p);
        } else { y = arrY - 20; alpha = 1 - (time - arrT[i]) / 0.3; }
        const chipH = 30;
        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        kit.roundedRect(ctx, wireX - chipW / 2, y - chipH / 2, chipW, chipH, 8);
        ctx.fillStyle = PAL.blueSoft;
        ctx.fill();
        ctx.strokeStyle = PAL.blue;
        ctx.lineWidth = 1.3;
        ctx.stroke();
        ctx.font = '14px ' + PAL.mono;
        ctx.fillStyle = PAL.blueDark;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const shown = FRAGS[i].replace(/ /g, '␣');
        ctx.fillText('"' + shown + '"', wireX, y + 1);
        ctx.restore();
      }

      /* screen panel */
      kit.roundedRect(ctx, panelX, panelY, panelW, panelH, 9);
      ctx.fillStyle = PAL.panel;
      ctx.fill();
      ctx.strokeStyle = PAL.panelEdge;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.save();
      ctx.beginPath();
      ctx.rect(panelX + 2, panelY + 2, panelW - 4, panelH - 4);
      ctx.clip();
      ctx.font = '14px ' + PAL.mono;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      const charW = ctx.measureText('M').width;
      const maxChars = Math.max(6, Math.floor((panelW - 26) / charW));
      const lh = 20;
      let ty = panelY + 40;
      ctx.fillStyle = PAL.green;
      for (const line of wrap('> fix the failing test', maxChars)) { ctx.fillText(line, panelX + 14, ty); ty += lh; }
      ty += 8;
      const text = FRAGS.slice(0, arrived).join('');
      ctx.fillStyle = PAL.panelInk;
      const lines = wrap(text, maxChars);
      for (const line of lines) { ctx.fillText(line, panelX + 14, ty); ty += lh; }
      /* blinking cursor while still arriving */
      if (arrived < FRAGS.length && time % 0.9 < 0.6) {
        const cx = panelX + 14 + lines[lines.length - 1].length * charW;
        ctx.fillStyle = PAL.panelInk;
        ctx.fillRect(cx + 2, ty - lh - 12, charW, 15);
      }
      ctx.restore();
      ctx.textAlign = 'left';
    }

    cv.onResize(drawN);
    const loop = kit.animLoop(dt => {
      time += dt;
      if (time >= LOOP_T) time = 0;
      drawN();
    });
    drawN();

    kit.caption(container, 'The answer comes back in small pieces, one at a time. Each piece ' +
      'appears the instant it arrives, which is why the reply seems to type itself out in front of you.');
    return loop;
  }

  /* ================================================================
     MID + DEEP
     ================================================================ */
  const cv = kit.makeCanvas(container, { height: deep ? 432 : 350,
    ariaLabel: deep
      ? 'Server-sent event frames descend a wire on the left while a terminal on the right accumulates their fragments; a readout below shows the actual event and JSON payload of the latest frame and the running token usage.'
      : 'Server-sent event frames descend a wire on the left while a terminal on the right accumulates their fragments into streaming text.' });
  const controls = kit.makeControls(container);

  /* --- the event script -------------------------------------------- */
  /* kind: ctl (protocol frame), txt (text delta), tool (tool_use start),
     json (input_json_delta), meta (message_delta) */
  const EVENTS = [
    { t: 'message_start',       kind: 'ctl',  gap: 0.0 },
    { t: 'content_block_start', kind: 'ctl',  note: 'type: text', gap: 0.55 },
    { t: 'content_block_delta', kind: 'txt',  frag: 'Fix',    gap: 0.55 },
    { t: 'content_block_delta', kind: 'txt',  frag: 'ed',     gap: 0.42 },
    { t: 'content_block_delta', kind: 'txt',  frag: ' the',   gap: 0.5 },
    { t: 'content_block_delta', kind: 'txt',  frag: ' fail',  gap: 0.44 },
    { t: 'content_block_delta', kind: 'txt',  frag: 'ing',    gap: 0.38 },
    { t: 'content_block_delta', kind: 'txt',  frag: ' test',  gap: 0.52 },
    { t: 'content_block_delta', kind: 'txt',  frag: '.',      gap: 0.4 },
    { t: 'content_block_stop',  kind: 'ctl',  gap: 0.55 },
    { t: 'content_block_start', kind: 'tool', note: 'tool_use: Read', gap: 0.7 },
    { t: 'content_block_delta', kind: 'json', frag: '{"file_path"', gap: 0.6 },
    { t: 'content_block_delta', kind: 'json', frag: ': "auth',      gap: 0.5 },
    { t: 'content_block_delta', kind: 'json', frag: '.spec.ts"}',   gap: 0.5 },
    { t: 'content_block_stop',  kind: 'ctl',  gap: 0.55 },
    { t: 'message_delta',       kind: 'meta', note: 'stop_reason: "tool_use"', gap: 0.65 },
    { t: 'message_stop',        kind: 'ctl',  gap: 0.6 },
  ];

  /* deep only: the actual JSON that rides each event's `data:` line */
  const dataFor = e => {
    switch (e.kind) {
      case 'txt':  return '{"type":"content_block_delta","index":0,"delta":' +
                          '{"type":"text_delta","text":"' + e.frag + '"}}';
      case 'json': return '{"type":"content_block_delta","index":1,"delta":' +
                          '{"type":"input_json_delta","partial_json":"' + e.frag.replace(/"/g, '\\"') + '"}}';
      case 'tool': return '{"type":"content_block_start","index":1,"content_block":' +
                          '{"type":"tool_use","id":"toolu_01…","name":"Read","input":{}}}';
      case 'meta': return '{"type":"message_delta","delta":{"stop_reason":"tool_use"},' +
                          '"usage":{"output_tokens":47}}';
      default:
        if (e.t === 'message_start') return '{"type":"message_start","message":{"id":"msg_01…",' +
          '"model":"claude-…","usage":{"input_tokens":12400,"output_tokens":1}}}';
        if (e.t === 'content_block_start') return '{"type":"content_block_start","index":0,' +
          '"content_block":{"type":"text","text":""}}';
        if (e.t === 'content_block_stop') return '{"type":"content_block_stop","index":0}';
        return '{"type":"message_stop"}';
    }
  };

  const TRAVEL = 1.15;              /* seconds a chip spends on the wire */
  const arrT = [];
  {
    let t = TRAVEL + 0.2;
    for (const e of EVENTS) { t += e.gap; arrT.push(t); }
  }
  const END_T = arrT[arrT.length - 1] + 1.4;

  const STYLE = {
    ctl:  { fill: PAL.graySoft,   edge: PAL.faint,  fragCol: PAL.ink },
    txt:  { fill: PAL.blueSoft,   edge: PAL.blue,   fragCol: PAL.blueDark },
    tool: { fill: PAL.purpleSoft, edge: PAL.purple, fragCol: PAL.purple },
    json: { fill: PAL.purpleSoft, edge: PAL.purple, fragCol: PAL.purple },
    meta: { fill: PAL.orangeSoft, edge: PAL.orange, fragCol: PAL.orange },
  };

  let time = 0;
  let playing = true;

  const speed = kit.makeSlider(controls, {
    label: 'Speed', min: 0.3, max: 2.5, value: 1,
    format: v => v.toFixed(1) + '×',
  });
  kit.makeButton(controls, 'Replay', () => { time = 0; playing = true; });

  /* --- terminal state derived from the clock ------------------------ */
  function state() {
    let text = '', json = '', toolStarted = false, metaSeen = false, stopped = false;
    let lastKind = null;
    for (let i = 0; i < EVENTS.length; i++) {
      if (arrT[i] > time) break;
      const e = EVENTS[i];
      if (e.kind === 'txt') text += e.frag;
      if (e.kind === 'tool') toolStarted = true;
      if (e.kind === 'json') json += e.frag;
      if (e.kind === 'meta') metaSeen = true;
      if (e.t === 'message_stop') stopped = true;
      lastKind = e.kind;
    }
    return { text, json, toolStarted, metaSeen, stopped, lastKind };
  }

  function draw() {
    const { ctx, w, h } = cv;
    ctx.clearRect(0, 0, w, h);
    const panel = deep ? 88 : 0;      /* deep raw-frame readout strip */
    const hb = h - panel;             /* height available to wire + terminal */
    const m = 10;
    const laneW = kit.clamp(w * 0.45, 150, 250);
    const wireX = m + laneW / 2;
    const topY = 40;
    const arrY = hb - 58;
    const termX = m + laneW + 16;
    const termW = w - m - termX;
    const termY = 30;
    const termH = hb - termY - 16;

    /* headers */
    ctx.font = '11px ' + PAL.sans;
    ctx.fillStyle = PAL.faint;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('events on the wire', wireX, 20);
    ctx.fillText('your terminal', termX + termW / 2, 20);

    /* the wire */
    ctx.strokeStyle = PAL.grid;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wireX, topY - 6);
    ctx.lineTo(wireX, arrY + 4);
    ctx.stroke();
    kit.arrow(ctx, wireX, arrY + 4, termX - 6, arrY + 4, { color: PAL.grid, width: 2, head: 7 });

    /* chips in flight */
    const chipW = laneW - 8;
    for (let i = 0; i < EVENTS.length; i++) {
      const born = arrT[i] - TRAVEL;
      if (time < born || time > arrT[i] + 0.35) continue;
      const e = EVENTS[i];
      const st = STYLE[e.kind];
      let y, alpha = 1;
      if (time <= arrT[i]) {
        const p = (time - born) / TRAVEL;
        y = kit.lerp(topY, arrY - 18, p);        /* steady descent — the wire's pace */
      } else {
        y = arrY - 18;
        alpha = 1 - (time - arrT[i]) / 0.35;      /* brief flash on arrival */
      }
      const sub = e.frag !== undefined || e.note !== undefined;
      const chipH = sub ? 34 : 21;
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      kit.roundedRect(ctx, wireX - chipW / 2, y - chipH / 2, chipW, chipH, 6);
      ctx.fillStyle = st.fill;
      ctx.fill();
      ctx.strokeStyle = st.edge;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.font = '11px ' + PAL.mono;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const tx = wireX - chipW / 2 + 7;
      if (sub) {
        ctx.fillStyle = PAL.inkStrong;
        ctx.fillText(e.t, tx, y - 8);
        ctx.fillStyle = st.fragCol;
        ctx.fillText(e.frag !== undefined ? '"' + e.frag + '"' : e.note, tx, y + 9);
      } else {
        ctx.fillStyle = PAL.inkStrong;
        ctx.fillText(e.t, tx, y + 1);
      }
      ctx.restore();
    }

    /* terminal panel */
    kit.roundedRect(ctx, termX, termY, termW, termH, 9);
    ctx.fillStyle = PAL.panel;
    ctx.fill();
    ctx.strokeStyle = PAL.panelEdge;
    ctx.lineWidth = 1;
    ctx.stroke();
    for (let d = 0; d < 3; d++) {
      ctx.beginPath();
      ctx.arc(termX + 14 + d * 13, termY + 13, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = [PAL.red, PAL.yellow, PAL.green][d];
      ctx.fill();
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(termX + 2, termY + 2, termW - 4, termH - 4);
    ctx.clip();
    ctx.font = '11px ' + PAL.mono;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const charW = ctx.measureText('M').width;
    const maxChars = Math.max(6, Math.floor((termW - 24) / charW));
    const lh = 16;
    let ty = termY + 38;
    const s = state();

    ctx.fillStyle = PAL.green;
    for (const line of wrap('> fix the failing test', maxChars)) {
      ctx.fillText(line, termX + 12, ty); ty += lh;
    }
    ty += 5;

    let cursor = null;
    if (time >= arrT[0]) {
      ctx.fillStyle = PAL.panelInk;
      const lines = wrap(s.text, maxChars);
      for (const line of lines) { ctx.fillText(line, termX + 12, ty); ty += lh; }
      cursor = { x: termX + 12 + lines[lines.length - 1].length * charW, y: ty - lh };
    }
    if (s.toolStarted) {
      ty += 5;
      ctx.fillStyle = PAL.teal;
      const lines = wrap('Read ' + s.json, maxChars);
      for (const line of lines) { ctx.fillText(line, termX + 12, ty); ty += lh; }
      cursor = { x: termX + 12 + lines[lines.length - 1].length * charW, y: ty - lh };
    }
    if (s.metaSeen) {
      ty += 5;
      ctx.fillStyle = PAL.faint;
      for (const line of wrap('stop_reason: tool_use', maxChars)) {
        ctx.fillText(line, termX + 12, ty); ty += lh;
      }
    }
    if (cursor && !s.stopped && time % 0.9 < 0.6) {
      ctx.fillStyle = PAL.panelInk;
      ctx.fillRect(cursor.x + 2, cursor.y - 10, charW, 13);
    }
    ctx.restore();
    ctx.textAlign = 'left';

    /* ---- deep: raw-frame + usage readout strip ---- */
    if (deep) {
      const py = hb + 6, ph = panel - 12;
      kit.roundedRect(ctx, m, py, w - 2 * m, ph, 8);
      ctx.fillStyle = PAL.graySoft;
      ctx.fill();
      ctx.strokeStyle = PAL.grid;
      ctx.lineWidth = 1;
      ctx.stroke();

      /* latest frame that has arrived */
      let li = -1;
      for (let i = 0; i < EVENTS.length; i++) { if (arrT[i] <= time) li = i; else break; }

      /* running usage */
      let inTok = li >= 0 ? 12400 : 0;
      let outTok = 0, metaSeen = false;
      for (let i = 0; i <= li; i++) {
        if (EVENTS[i].kind === 'txt' || EVENTS[i].kind === 'json') outTok++;
        if (EVENTS[i].kind === 'meta') metaSeen = true;
      }
      if (metaSeen) outTok = 47;

      ctx.save();
      ctx.beginPath();
      ctx.rect(m + 2, py + 2, w - 2 * m - 4, ph - 4);
      ctx.clip();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';

      /* header row: label + usage */
      ctx.font = '11px ' + PAL.sans;
      ctx.fillStyle = PAL.faint;
      ctx.fillText('latest frame on the wire', m + 12, py + 16);
      const usage = 'input_tokens ' + inTok.toLocaleString('en-US') + '  ·  output_tokens ' + outTok;
      const uw = ctx.measureText(usage).width;
      ctx.fillStyle = PAL.ink;
      ctx.fillText(usage, w - m - 12 - uw, py + 16);

      /* the actual event: / data: lines */
      ctx.font = '11px ' + PAL.mono;
      const cw = ctx.measureText('M').width;
      const maxChars = Math.max(10, Math.floor((w - 2 * m - 24) / cw));
      let dy = py + 34;
      if (li < 0) {
        ctx.fillStyle = PAL.faint;
        ctx.fillText('awaiting message_start…', m + 12, dy);
      } else {
        const e = EVENTS[li];
        ctx.fillStyle = STYLE[e.kind].fragCol;
        ctx.fillText('event: ' + e.t, m + 12, dy);
        dy += 15;
        ctx.fillStyle = PAL.ink;
        const dataLines = wrap('data: ' + dataFor(e), maxChars);
        for (let k = 0; k < dataLines.length && dy < py + ph - 4; k++) {
          ctx.fillText(dataLines[k], m + 12, dy); dy += 15;
        }
      }
      ctx.restore();
    }
  }

  cv.onResize(draw);
  const loop = kit.animLoop(dt => {
    if (playing) {
      time += dt * speed.value;
      if (time >= END_T) { time = END_T; playing = false; }
    }
    draw();
  });
  draw();

  kit.caption(container, deep
    ? 'Each server-sent event is an <code>event:</code> line and a <code>data:</code> JSON object; ' +
      'the readout below shows the latest frame verbatim, and the counters track ' +
      '<code>input_tokens</code> (fixed by the prompt) against <code>output_tokens</code> as deltas land. ' +
      'The final block streams a <code>tool_use</code> input as <code>input_json_delta</code> pieces.'
    : 'Each server-sent event carries one small fragment; the moment ' +
      'it arrives, Claude Code appends it and repaints. The final block is a ' +
      '<code>tool_use</code> whose JSON input streams in as <code>input_json_delta</code> pieces.');
  return loop;
});
