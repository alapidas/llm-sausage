/* fig-sse — SSE event frames sliding down a wire (left) while a mini
   terminal (right) accumulates their fragments into visible text. */
'use strict';

Figures.register('fig-sse', (container, kit) => {
  const cv = kit.makeCanvas(container, { height: 350,
    ariaLabel: 'Server-sent event frames descend a wire on the left while a terminal on the right accumulates their fragments into streaming text.' });
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

  function draw() {
    const { ctx, w, h } = cv;
    ctx.clearRect(0, 0, w, h);
    const m = 10;
    const laneW = kit.clamp(w * 0.45, 150, 250);
    const wireX = m + laneW / 2;
    const topY = 40;
    const arrY = h - 58;
    const termX = m + laneW + 16;
    const termW = w - m - termX;
    const termY = 30;
    const termH = h - termY - 16;

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
    ctx.fillStyle = PAL.inkStrong;
    ctx.fill();
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
      ctx.fillStyle = PAL.bg;
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
      ctx.fillStyle = PAL.bg;
      ctx.fillRect(cursor.x + 2, cursor.y - 10, charW, 13);
    }
    ctx.restore();
    ctx.textAlign = 'left';
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

  kit.caption(container, 'Each server-sent event carries one small fragment; the moment ' +
    'it arrives, Claude Code appends it and repaints. The final block is a ' +
    '<code>tool_use</code> whose JSON input streams in as <code>input_json_delta</code> pieces.');
  return loop;
});
