/* fig-tls — sequence diagram of everything that must happen before the
   request's first byte arrives: DNS, TCP handshake, TLS 1.3 handshake,
   then the encrypted POST. A clock accumulates ~30 ms per round trip.
   Toggle "Reuse warm connection" to replay with the handshakes skipped.

   Level-aware: novice replaces DNS/TCP/TLS jargon with a plain "quick
   greeting" that seals the channel; mid is the standard sequence diagram;
   deep adds a panel naming what a passive observer can still see (the
   destination IP, the cleartext SNI, and each record's size and timing). */
'use strict';

Figures.register('fig-tls', (container, kit) => {
  const level = kit.level();

  /* ---------------- novice: a plain-language greeting ---------------- */
  if (level === 'novice') {
    const cv = kit.makeCanvas(container, { height: 300 });
    const ctx = cv.ctx;
    const controls = kit.makeControls(container);
    const HALF = 15, SPEED = 22;
    let skip = false, T = 0, playing = true, hold = 0;

    function rows() {
      if (skip) {
        return { list: [
          { gap: 'you are already introduced' },
          { msg: { dir: 1, t0: 0, t1: HALF, label: 'your sealed message', color: PAL.orange, thick: true, lock: true } },
        ], total: HALF };
      }
      return { list: [
        { gap: 'first, a quick greeting' },
        { msg: { dir: 1, t0: 0, t1: HALF, label: 'Hello — here is my half of a secret', color: PAL.blue } },
        { msg: { dir: -1, t0: HALF, t1: 2 * HALF, label: 'Hello back — here is mine, and proof it is me', color: PAL.blue } },
        { gap: 'now both sides share a secret code' },
        { msg: { dir: 1, t0: 2 * HALF, t1: 3 * HALF, label: 'your sealed message', color: PAL.orange, thick: true, lock: true } },
      ], total: 3 * HALF };
    }
    let tl = rows();

    function restart() { tl = rows(); T = 0; playing = true; hold = 0; }
    kit.makeToggle(controls, 'Skip the greeting (already connected)', false, v => { skip = v; restart(); });

    function drawLock(x, y, color) {
      ctx.save();
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(x, y - 2.5, 3.2, Math.PI, 0); ctx.stroke();
      kit.roundedRect(ctx, x - 4.5, y - 2.5, 9, 7.5, 1.5); ctx.fill();
      ctx.restore();
    }

    function draw() {
      const w = cv.w, h = cv.h;
      ctx.clearRect(0, 0, w, h);
      const cx = Math.max(56, w * 0.16);
      const sx = w - Math.max(56, w * 0.16);
      const top = 58, bottom = h - 58;
      const rowH = (bottom - top) / 5;

      ctx.textAlign = 'center'; ctx.fillStyle = PAL.inkStrong;
      ctx.font = '600 13px ' + PAL.sans;
      ctx.fillText('your computer', cx, 26);
      ctx.fillText('Anthropic', sx, 26);

      ctx.strokeStyle = PAL.grid; ctx.lineWidth = 2;
      for (const x of [cx, sx]) {
        ctx.beginPath(); ctx.moveTo(x, top - 14); ctx.lineTo(x, bottom); ctx.stroke();
      }

      const mid = (cx + sx) / 2;
      tl.list.forEach((row, i) => {
        const y = top + i * rowH;
        if (row.gap) {
          ctx.fillStyle = PAL.faint; ctx.font = 'italic 12px ' + PAL.sans;
          ctx.textAlign = 'center';
          ctx.fillText(row.gap, mid, y + rowH * 0.6, sx - cx - 8);
          return;
        }
        const m = row.msg;
        const p = kit.clamp((T - m.t0) / (m.t1 - m.t0), 0, 1);
        if (p <= 0) return;
        const x0 = m.dir === 1 ? cx : sx, x1 = m.dir === 1 ? sx : cx;
        const y0 = y + rowH * 0.3, slant = rowH * 0.5;
        const tipX = kit.lerp(x0, x1, p), tipY = y0 + slant * p;
        ctx.save();
        kit.arrow(ctx, x0, y0, tipX, tipY, {
          color: m.color, width: m.thick ? 3.4 : 1.8, head: m.thick ? 9 : 7 });
        if (p > 0.1) {
          ctx.font = (m.thick ? '600 ' : '') + '12px ' + PAL.sans;
          ctx.fillStyle = m.color; ctx.textAlign = 'center';
          const lx = mid, ly = y0 - 6;
          if (m.lock) {
            const lw2 = ctx.measureText(m.label).width / 2;
            ctx.fillText(m.label, lx + 7, ly, sx - cx - 20);
            drawLock(lx - lw2 - 2, ly - 4, m.color);
          } else {
            ctx.fillText(m.label, lx, ly, sx - cx - 8);
          }
        }
        ctx.restore();
      });

      ctx.textAlign = 'center';
      ctx.font = '12px ' + PAL.sans; ctx.fillStyle = PAL.faint;
      if (T >= tl.total) {
        ctx.fillText(skip
          ? 'no greeting needed — the sealed message goes straight out'
          : 'the greeting adds a small delay, once, before the first sealed message',
          w / 2, h - 22, w - 20);
      } else {
        ctx.fillText('delay so far: about ' + Math.round(Math.min(T, tl.total)) + ' ms',
          w / 2, h - 22, w - 20);
      }
    }

    cv.onResize(draw);
    const loop = kit.animLoop(dt => {
      if (playing) {
        T += dt * SPEED;
        if (T >= tl.total) { T = tl.total; playing = false; hold = 0; }
      } else {
        hold += dt;
        if (hold > 2.4) restart();
      }
      draw();
    });

    kit.caption(container,
      'Before your first message can go out, the two computers trade a quick greeting and ' +
      'agree on a secret code, so everything after is sealed. A follow-up message skips the ' +
      'greeting, because they are already on speaking terms.');
    return loop;
  }

  /* ---------------- mid + deep ---------------- */
  const deep = level === 'deep';
  const cv = kit.makeCanvas(container, { height: deep ? 500 : 440 });
  const ctx = cv.ctx;
  const controls = kit.makeControls(container);

  const HALF = 15;              // one-way trip, ms (≈30 ms RTT)
  const SPEED = 32;             // simulated ms per real second
  const ROWS = 12;              // fixed row grid (cold timeline)

  /* row: { msg:{f,t,t0,t1,label,short,color,faded,thick,lock} } or { gap:'…' }
     lanes: 0 = your machine, 1 = edge, 2 = DNS resolver */
  function buildRows(warm) {
    if (warm) {
      return {
        rows: [
          { gap: 'connection already warm:' },
          { gap: 'DNS cached · TCP open · TLS keys live' },
          { msg: { f: 0, t: 1, t0: 0, t1: HALF, label: 'POST /v1/messages  (encrypted)', short: 'POST  (encrypted)', color: PAL.orange, thick: true, lock: true } },
        ],
        total: HALF, dns: false, offset: 4,
      };
    }
    return {
      rows: [
        { msg: { f: 0, t: 2, t0: 0, t1: 4, label: 'DNS: api.anthropic.com ?', short: 'api.anthropic.com ?', faded: true } },
        { msg: { f: 2, t: 0, t0: 4, t1: 8, label: '160.79.104.10', faded: true } },
        { gap: 'TCP handshake — one round trip' },
        { msg: { f: 0, t: 1, t0: 8, t1: 23, label: 'SYN', color: PAL.blue } },
        { msg: { f: 1, t: 0, t0: 23, t1: 38, label: 'SYN-ACK', color: PAL.blue } },
        { msg: { f: 0, t: 1, t0: 38, t1: 53, label: 'ACK', color: PAL.blue } },
        { gap: 'TLS 1.3 — one round trip, keys established' },
        { msg: { f: 0, t: 1, t0: 40, t1: 55, label: 'ClientHello + key share', short: 'ClientHello + key share', color: PAL.purple } },
        { msg: { f: 1, t: 0, t0: 55, t1: 70, label: 'ServerHello · certificate · Finished', short: 'ServerHello · cert · Finished', color: PAL.purple } },
        { msg: { f: 0, t: 1, t0: 70, t1: 85, label: 'Finished', color: PAL.purple } },
        { gap: 'everything from here on is ciphertext' },
        { msg: { f: 0, t: 1, t0: 72, t1: 87, label: 'POST /v1/messages  (encrypted)', short: 'POST  (encrypted)', color: PAL.orange, thick: true, lock: true } },
      ],
      total: 87, dns: true, offset: 0,
    };
  }

  let warm = false;
  let tl = buildRows(false);
  let T = 0;                    // simulated clock, ms
  let playing = true;

  function restart() { tl = buildRows(warm); T = 0; playing = true; draw(); }

  kit.makeToggle(controls, 'Reuse warm connection', false, v => { warm = v; restart(); });
  kit.makeButton(controls, 'Replay', restart);

  function drawLock(x, y, color) {
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(x, y - 2.5, 3.2, Math.PI, 0); ctx.stroke();  // shackle
    kit.roundedRect(ctx, x - 4.5, y - 2.5, 9, 7.5, 1.5); ctx.fill();      // body
    ctx.restore();
  }

  function draw() {
    const w = cv.w, h = cv.h;
    ctx.clearRect(0, 0, w, h);

    const cvisible = Math.min(T, tl.total);
    const cx = Math.max(58, w * 0.16);       // your machine lane
    const sx = w - Math.max(64, w * 0.16);   // edge lane
    const rx = kit.lerp(cx, sx, 0.42);       // DNS resolver mini-lane
    const top = 58, bottom = h - (deep ? 150 : 76);
    const rowH = (bottom - top) / ROWS;
    const laneX = i => i === 0 ? cx : i === 1 ? sx : rx;

    /* lane titles */
    ctx.textAlign = 'center'; ctx.fillStyle = PAL.inkStrong;
    ctx.font = '600 12px ' + PAL.sans;
    ctx.fillText('your machine', cx, 22);
    ctx.fillText('api.anthropic.com', sx, 22);
    ctx.fillStyle = PAL.faint; ctx.font = '11px ' + PAL.sans;
    ctx.fillText('edge', sx, 37);

    /* lifelines */
    ctx.strokeStyle = PAL.grid; ctx.lineWidth = 2;
    for (const x of [cx, sx]) {
      ctx.beginPath(); ctx.moveTo(x, top - 12); ctx.lineTo(x, bottom); ctx.stroke();
    }
    if (tl.dns) {
      ctx.save();
      ctx.setLineDash([3, 4]); ctx.strokeStyle = PAL.grid; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(rx, top - 4); ctx.lineTo(rx, top + 2.2 * rowH); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = PAL.faint; ctx.font = '11px ' + PAL.sans;
      ctx.fillText('DNS resolver', rx, top - 10);
    }

    /* rows */
    const mid = (cx + sx) / 2;
    tl.rows.forEach((row, i) => {
      const y = top + (i + tl.offset) * rowH;
      if (row.gap) {
        ctx.fillStyle = PAL.faint; ctx.font = 'italic 11px ' + PAL.sans;
        ctx.textAlign = 'center';
        ctx.fillText(row.gap, mid, y + rowH * 0.62, sx - cx - 8);
        return;
      }
      const m = row.msg;
      const p = kit.clamp((T - m.t0) / (m.t1 - m.t0), 0, 1);
      if (p <= 0) return;
      const x0 = laneX(m.f), x1 = laneX(m.t);
      const y0 = y + rowH * 0.28, slant = rowH * 0.55;
      const tipX = kit.lerp(x0, x1, p), tipY = y0 + slant * p;
      const color = m.faded ? PAL.faint : (m.color || PAL.ink);
      ctx.save();
      if (m.faded) ctx.globalAlpha = 0.6;
      kit.arrow(ctx, x0, y0, tipX, tipY, {
        color, width: m.thick ? 3.4 : 1.6, head: m.thick ? 9 : 7 });
      if (p > 0.12) {
        ctx.font = (m.thick ? '600 ' : '') + '11px ' + PAL.sans;
        let label = m.label;
        const span = Math.abs(x1 - x0) - (m.f === 2 || m.t === 2 ? 30 : 14);
        if (m.short && ctx.measureText(label).width > span) label = m.short;
        const lx = (x0 + laneX(m.t)) / 2, ly = y0 - 5;
        ctx.fillStyle = color; ctx.textAlign = 'center';
        if (m.lock) {
          const lw2 = ctx.measureText(label).width / 2;
          ctx.fillText(label, lx + 7, ly, span);
          drawLock(lx - lw2 - 2, ly - 4, color);
        } else {
          ctx.fillText(label, (m.f === 2 || m.t === 2) ? (x0 + x1) / 2 : lx, ly, span);
        }
      }
      ctx.restore();
    });

    /* deep: what a passive observer can still read off the wire */
    if (deep) {
      const bx = Math.max(14, w * 0.05), bw = w - 2 * bx;
      const by = bottom + 16, bh = 82;
      kit.roundedRect(ctx, bx, by, bw, bh, 8);
      ctx.fillStyle = PAL.graySoft; ctx.fill();
      ctx.strokeStyle = PAL.grid; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.textAlign = 'left';
      ctx.fillStyle = PAL.inkStrong; ctx.font = '600 11px ' + PAL.sans;
      ctx.fillText('even encrypted, a passive observer still sees:', bx + 12, by + 19);
      ctx.fillStyle = PAL.ink; ctx.font = '11px ' + PAL.sans;
      ctx.fillText('· destination IP  160.79.104.10', bx + 12, by + 37, bw - 24);
      ctx.fillText('· SNI hostname  api.anthropic.com  — cleartext in the ClientHello', bx + 12, by + 53, bw - 24);
      ctx.fillText('· the size and timing of every TLS record (never the contents)', bx + 12, by + 69, bw - 24);
    }

    /* clock + status */
    ctx.textAlign = 'center';
    ctx.font = '600 16px ' + PAL.mono;
    ctx.fillStyle = PAL.inkStrong;
    ctx.fillText('t = ' + Math.round(cvisible) + ' ms', w / 2, h - 42);
    ctx.font = '12px ' + PAL.sans; ctx.fillStyle = PAL.faint;
    if (T >= tl.total) {
      ctx.fillText(warm
        ? 'first byte arrives after ~15 ms — reusing the connection saved ~72 ms'
        : '~87 ms of lookups, handshakes and travel before the first byte arrives',
        w / 2, h - 20, w - 20);
    } else {
      ctx.fillText(warm ? 'replaying with a kept-alive connection…' : 'replaying a cold connection…',
        w / 2, h - 20, w - 20);
    }
  }

  cv.onResize(draw);

  const loop = kit.animLoop(dt => {
    if (!playing) return;
    T += dt * SPEED;
    if (T >= tl.total + 18) { T = tl.total; playing = false; }
    draw();
  });

  if (deep) {
    kit.caption(container,
      'Before the request can leave: DNS, a TCP handshake, and a TLS 1.3 handshake — about ' +
      'two round trips at ~30 ms each. The panel beneath names what stays visible on the wire ' +
      'even so; a kept-alive connection skips straight to the encrypted POST.');
  } else {
    kit.caption(container,
      'Before the request can leave: DNS, a TCP handshake, and a TLS 1.3 handshake — ' +
      'about two round trips at ~30 ms each. A kept-alive connection skips straight to the encrypted POST.');
  }
  return loop;
});
