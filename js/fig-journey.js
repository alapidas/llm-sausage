/* fig-journey — a packet hops from your laptop to Anthropic's front end.
   Every middlebox reads only the IP header; the payload is TLS ciphertext.
   A slider scales the geographic distance (same city ↔ across an ocean),
   and a counter accumulates per-hop latency with light-in-fiber as floor. */
'use strict';

Figures.register('fig-journey', (container, kit) => {
  const cv = kit.makeCanvas(container, { height: 380 });
  const ctx = cv.ctx;
  const controls = kit.makeControls(container);

  const NODES = [
    { label: 'your laptop', type: 'laptop',
      note: 'One of only two machines on the whole path that hold the TLS keys. Everything between here and the far end sees ciphertext.' },
    { label: 'Wi-Fi router', type: 'router',
      note: 'Forwards the packet toward your ISP. It can read the IP header — source, destination, hop count — but the payload is TLS ciphertext.' },
    { label: 'ISP', type: 'router',
      note: 'Your ISP routes on the destination address alone. Deep inside the payload sits your source code — unreadable to it.' },
    { label: 'backbone', type: 'router',
      note: 'A backbone router moving this packet among millions of others. It sees: the IP header, and nothing else.' },
    { label: 'backbone', type: 'router',
      note: 'Another long-haul hop. Most of the total latency is simply light crawling through fiber between routers like this one.' },
    { label: 'edge POP', type: 'pop',
      note: 'A point of presence near you, announced by the network fronting api.anthropic.com. Here your packets leave the public internet.' },
    { label: 'front end', type: 'fe',
      note: 'The other end of the encrypted tunnel. Only here can the request be decrypted and read again.' },
  ];
  const SRC = '203.0.113.7', DST = '160.79.104.10';
  const GLYPHS = 'ab1f#x&%c94e?d7$@k0!q2m8~z^3jv5+w6=r';

  let distKm = 1200;
  kit.makeSlider(controls, {
    label: 'Distance',
    min: 20, max: 9000, step: 20, value: distKm,
    format: v => v >= 1000 ? (v / 1000).toFixed(1) + 'k km' : Math.round(v) + ' km',
    onInput: v => { distKm = v; draw(); },
  });

  /* per-hop one-way latency (ms); the three long hops share the
     propagation delay: distKm / 200 km-per-ms (light in fiber ≈ 2/3 c) */
  function hopLats() {
    const geo = distKm / 200;
    return [2, 8, geo * 0.3, geo * 0.4, geo * 0.3, 2];
  }
  const floorMs = () => distKm / 200;

  /* packet state */
  let hop = 0, prog = 0, doneAcc = 0, holding = 0, arrived = false;
  let cipherRow1 = '', cipherRow2 = '', churn = 0;
  function scramble() {
    const r = n => Array.from({ length: n }, () => GLYPHS[(Math.random() * GLYPHS.length) | 0]).join('');
    cipherRow1 = r(130); cipherRow2 = r(130);
  }
  scramble();

  let hover = -1;
  let nodePos = [];

  function layout() {
    const w = cv.w;
    const m = Math.max(30, w * 0.05);
    const pathY = 106;
    const wave = [12, -12, 12, -14, 12, -12, 12];
    nodePos = NODES.map((n, i) => ({
      x: m + (w - 2 * m) * i / (NODES.length - 1),
      y: pathY + wave[i],
      up: wave[i] < 0,
    }));
  }

  function wrapText(text, x, y, maxW, lineH) {
    const words = text.split(' ');
    let lineTxt = '';
    for (const word of words) {
      const test = lineTxt ? lineTxt + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && lineTxt) {
        ctx.fillText(lineTxt, x, y); y += lineH; lineTxt = word;
      } else lineTxt = test;
    }
    if (lineTxt) ctx.fillText(lineTxt, x, y);
    return y;
  }

  function drawNode(nd, pos, hovered) {
    const { x, y } = pos;
    ctx.save();
    ctx.lineWidth = 1.6;
    if (nd.type === 'laptop') {
      ctx.fillStyle = PAL.graySoft; ctx.strokeStyle = PAL.ink;
      kit.roundedRect(ctx, x - 11, y - 12, 22, 15, 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 15, y + 6); ctx.lineTo(x + 15, y + 6);
      ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();
    } else if (nd.type === 'router') {
      ctx.fillStyle = PAL.graySoft; ctx.strokeStyle = PAL.ink;
      ctx.beginPath(); ctx.arc(x, y, 9.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = PAL.faint;
      ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill();
    } else if (nd.type === 'pop') {
      ctx.fillStyle = PAL.blueSoft; ctx.strokeStyle = PAL.blueDark;
      kit.roundedRect(ctx, x - 12, y - 11, 24, 22, 5); ctx.fill(); ctx.stroke();
    } else {
      ctx.fillStyle = PAL.orangeSoft; ctx.strokeStyle = PAL.orange;
      kit.roundedRect(ctx, x - 13, y - 12, 26, 24, 5); ctx.fill(); ctx.stroke();
    }
    if (hovered) {
      ctx.strokeStyle = PAL.blue; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.font = '11px ' + PAL.sans; ctx.textAlign = 'center';
    ctx.fillStyle = hovered ? PAL.inkStrong : PAL.faint;
    ctx.fillText(nd.label, x, pos.up ? y - 22 : y + 30);
    ctx.restore();
  }

  function drawPacketShape(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = PAL.bg; ctx.strokeStyle = PAL.inkStrong; ctx.lineWidth = 1.4;
    kit.roundedRect(ctx, -16, -11, 32, 22, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAL.blue;                       // clear IP-header strip
    kit.roundedRect(ctx, -16, -11, 8, 22, 4); ctx.fill();
    ctx.fillStyle = PAL.bg; ctx.fillRect(-10, -11, 3, 22);
    ctx.fillStyle = PAL.blue; ctx.fillRect(-10, -11, 2, 22);
    ctx.fillStyle = PAL.faint; ctx.font = '8.5px ' + PAL.mono; ctx.textAlign = 'left';
    ctx.fillText(cipherRow1.slice(0, 4), -6, -2.5);  // scrambled body
    ctx.fillText(cipherRow2.slice(2, 6), -6, 7);
    ctx.restore();
  }

  function draw() {
    const w = cv.w, h = cv.h;
    layout();
    ctx.clearRect(0, 0, w, h);
    const lats = hopLats();
    const total = lats.reduce((a, b) => a + b, 0);

    /* path */
    ctx.strokeStyle = PAL.grid; ctx.lineWidth = 1.6;
    ctx.beginPath();
    nodePos.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.stroke();
    NODES.forEach((n, i) => drawNode(n, nodePos[i], i === hover));

    /* packet + per-hop tag */
    const elapsed = arrived ? total
      : doneAcc + (hop < lats.length ? lats[hop] * prog : 0);
    if (!arrived) {
      const a = nodePos[hop], b = nodePos[hop + 1];
      const px = kit.lerp(a.x, b.x, prog), py = kit.lerp(a.y, b.y, prog) - 24;
      drawPacketShape(px, py);
      ctx.fillStyle = PAL.orange; ctx.font = '600 11px ' + PAL.sans;
      ctx.textAlign = 'center';
      ctx.fillText('+' + lats[hop].toFixed(1) + ' ms', px, py - 18);
    } else {
      drawPacketShape(nodePos[NODES.length - 1].x, nodePos[NODES.length - 1].y - 26);
    }

    /* counters */
    ctx.textAlign = 'left'; ctx.font = '600 12px ' + PAL.mono;
    ctx.fillStyle = PAL.inkStrong;
    ctx.fillText(arrived
      ? 'one way ≈ ' + total.toFixed(1) + ' ms · round trip ≈ ' + (2 * total).toFixed(0) + ' ms'
      : 'elapsed ≈ ' + elapsed.toFixed(1) + ' ms', 14, 22);
    ctx.font = '11px ' + PAL.sans; ctx.fillStyle = PAL.faint;
    ctx.fillText('light-in-fiber floor ≈ ' + floorMs().toFixed(1) + ' ms one way', 14, 40);

    /* magnified packet */
    const iy = 172, ix = Math.max(20, w * 0.04), iw = w - 2 * ix;
    ctx.fillStyle = PAL.faint; ctx.font = '11px ' + PAL.sans; ctx.textAlign = 'left';
    ctx.fillText('the packet, magnified:', ix, iy - 8);
    kit.roundedRect(ctx, ix, iy, iw, 66, 8);
    ctx.fillStyle = PAL.bg; ctx.fill();
    ctx.strokeStyle = PAL.grid; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.save();
    kit.roundedRect(ctx, ix, iy, iw, 66, 8); ctx.clip();
    ctx.fillStyle = PAL.blueSoft; ctx.fillRect(ix, iy, iw, 24);        // header strip
    ctx.fillStyle = PAL.blueDark; ctx.font = '11px ' + PAL.mono;
    ctx.fillText('src ' + SRC + ' → dst ' + DST, ix + 10, iy + 16, iw - 76);
    ctx.fillStyle = PAL.faint; ctx.font = '11px ' + PAL.mono;
    ctx.fillText(cipherRow1, ix + 10, iy + 41);                        // ciphertext
    ctx.fillText(cipherRow2, ix + 10, iy + 58);
    ctx.textAlign = 'right'; ctx.font = '600 10.5px ' + PAL.sans;
    ctx.fillStyle = PAL.green; ctx.fillText('readable', ix + iw - 8, iy + 16);
    ctx.fillStyle = PAL.bg; ctx.fillRect(ix + iw - 72, iy + 30, 72, 16);
    ctx.fillStyle = PAL.red; ctx.fillText('ciphertext', ix + iw - 8, iy + 42);
    ctx.restore();

    /* hover note */
    const ny = 268;
    ctx.textAlign = 'left';
    if (hover >= 0) {
      ctx.fillStyle = PAL.inkStrong; ctx.font = '600 12px ' + PAL.sans;
      ctx.fillText(NODES[hover].label, 14, ny);
      ctx.fillStyle = PAL.ink; ctx.font = '12px ' + PAL.sans;
      wrapText(NODES[hover].note, 14, ny + 19, w - 28, 17);
    } else {
      ctx.fillStyle = PAL.faint; ctx.font = 'italic 12px ' + PAL.sans;
      wrapText('Hover over or tap any node to see what it can read as the packet passes through.',
        14, ny, w - 28, 17);
    }
  }

  cv.onResize(draw);

  const loop = kit.animLoop(dt => {
    const lats = hopLats();
    churn += dt;
    if (churn > 0.2) {          // ciphertext slowly churns
      churn = 0;
      const i = (Math.random() * cipherRow1.length) | 0;
      cipherRow1 = cipherRow1.slice(0, i) + GLYPHS[(Math.random() * GLYPHS.length) | 0] + cipherRow1.slice(i + 1);
    }
    if (arrived) {
      holding += dt;
      if (holding > 2.2) { arrived = false; holding = 0; hop = 0; prog = 0; doneAcc = 0; }
    } else {
      const dur = 0.3 + lats[hop] * 0.022;     // visual seconds per hop
      prog += dt / dur;
      if (prog >= 1) {
        doneAcc += lats[hop]; prog = 0; hop++; scramble();
        if (hop >= lats.length) arrived = true;
      }
    }
    draw();
  });

  function pick(ev) {
    const p = cv.pointer(ev);
    let best = -1, bestD = 26 * 26;
    nodePos.forEach((n, i) => {
      const d = (p.x - n.x) ** 2 + (p.y - n.y) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    });
    if (best !== hover) { hover = best; draw(); }
  }
  cv.canvas.addEventListener('pointermove', pick);
  cv.canvas.addEventListener('pointerdown', pick);
  cv.canvas.addEventListener('pointerleave', () => { hover = -1; draw(); });

  kit.caption(container,
    'A packet’s trip from your laptop to Anthropic’s front end. Every router forwards on the ' +
    'IP header alone; the payload stays ciphertext until the far end of the TLS tunnel. ' +
    'Drag the slider to see distance dominate the latency.');
  return loop;
});
