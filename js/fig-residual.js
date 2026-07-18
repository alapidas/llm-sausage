'use strict';
/* fig-residual — three tokens riding their residual streams through an
   eight-layer stack; each sublayer reads the vector and adds a delta. */
Figures.register('fig-residual', (container, kit) => {
  const cv = kit.makeCanvas(container, { height: 470 });
  const ctx = cv.ctx;

  const L = 8;                 /* layers */
  const SUB = L * 2;           /* sublayers: attention + MLP per layer */
  const CELLS = 7;             /* components shown of each vector */
  const LANES = 3;
  const NAMES = ['fixed', 'test', 'it'];
  const CELLCOL = [PAL.blue, PAL.teal, PAL.purple, PAL.orange, PAL.green, PAL.red, PAL.yellow];

  function rgba(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }
  /* deterministic pseudo-random in [0,1) */
  function rnd(a, b, c) {
    const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
    return x - Math.floor(x);
  }

  /* fixed base vectors and per-sublayer deltas for each lane */
  const base = [], delta = [];
  for (let l = 0; l < LANES; l++) {
    const bs = [];
    for (let c = 0; c < CELLS; c++) bs.push((rnd(l, 0, c) - 0.5) * 1.1);
    base.push(bs);
    const ds = [];
    for (let s = 0; s < SUB; s++) {
      const row = [];
      for (let c = 0; c < CELLS; c++) row.push((rnd(l, s + 1, c + 1) - 0.5) * 0.5);
      ds.push(row);
    }
    delta.push(ds);
  }

  const controls = kit.makeControls(container);
  const laneSl = kit.makeSlider(controls, {
    label: 'Follow token', min: 1, max: 3, step: 1, value: 3,
    format: v => '“' + NAMES[v - 1] + '”',
    onInput: () => draw(),
  });

  let p = 0;   /* pulse progress, 0 bottom -> 1 top */

  function geometry() {
    const w = cv.w, h = cv.h;
    const left = 58;
    const right = 16;
    const top = 44;
    const bottom = h - 42;
    const blockW = w - left - right;
    const gap = 6;
    const blockH = (bottom - top - gap * (L - 1)) / L;
    const blocks = [];
    for (let li = 0; li < L; li++) {
      const y1 = bottom - li * (blockH + gap);   /* block bottom */
      const y0 = y1 - blockH;                     /* block top */
      const pad = 4, inner = 3;
      const bandH = (blockH - pad * 2 - inner) / 2;
      const attn = { y1: y1 - pad, y0: y1 - pad - bandH, type: 'attn', s: li * 2 };
      const mlp = { y1: attn.y0 - inner, y0: attn.y0 - inner - bandH, type: 'mlp', s: li * 2 + 1 };
      blocks.push({ y0: y0, y1: y1, bands: [attn, mlp] });
    }
    const laneX = [];
    for (let i = 0; i < LANES; i++) laneX.push(left + blockW * (i + 1) / (LANES + 1));
    return {
      w: w, h: h, left: left, top: top, bottom: bottom, blockW: blockW,
      blocks: blocks, laneX: laneX,
      yStart: bottom + 16, yEnd: top - 14,
    };
  }

  function passedAmount(band, pulseY) {
    return kit.clamp((band.y1 - pulseY) / (band.y1 - band.y0), 0, 1);
  }

  function drawStrip(x, y, vals, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const cw = 6;
    const sw = CELLS * cw + 8;
    const sh = 30;
    kit.roundedRect(ctx, x - sw / 2, y - sh / 2, sw, sh, 4);
    ctx.fillStyle = PAL.bg;
    ctx.fill();
    ctx.strokeStyle = PAL.faint;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = PAL.grid;
    ctx.beginPath();
    ctx.moveTo(x - sw / 2 + 3, y + 0.5);
    ctx.lineTo(x + sw / 2 - 3, y + 0.5);
    ctx.stroke();
    for (let c = 0; c < CELLS; c++) {
      const vx = x - sw / 2 + 4 + c * cw;
      const v = kit.clamp(vals[c], -1, 1);
      ctx.fillStyle = CELLCOL[c];
      if (v >= 0) ctx.fillRect(vx, y - v * 11, cw - 1.5, Math.max(1, v * 11));
      else ctx.fillRect(vx, y, cw - 1.5, -v * 11);
    }
    ctx.restore();
  }

  function draw() {
    const g = geometry();
    ctx.clearRect(0, 0, g.w, g.h);
    const selLane = Math.round(laneSl.value) - 1;
    const pulseY = kit.lerp(g.yStart, g.yEnd, p);

    /* layer blocks with their two sublayer bands */
    ctx.textBaseline = 'middle';
    for (let li = 0; li < L; li++) {
      const bl = g.blocks[li];
      kit.roundedRect(ctx, g.left, bl.y0, g.blockW, bl.y1 - bl.y0, 5);
      ctx.fillStyle = PAL.graySoft;
      ctx.fill();
      ctx.strokeStyle = PAL.grid;
      ctx.lineWidth = 1;
      ctx.stroke();
      for (const band of bl.bands) {
        ctx.fillStyle = band.type === 'attn' ? PAL.blueSoft : PAL.purpleSoft;
        ctx.fillRect(g.left + 4, band.y0, g.blockW - 8, band.y1 - band.y0);
        const pa = passedAmount(band, pulseY);
        if (pa > 0 && pa < 1) {
          ctx.fillStyle = rgba(band.type === 'attn' ? PAL.blue : PAL.purple,
                               0.25 * Math.sin(Math.PI * pa));
          ctx.fillRect(g.left + 4, band.y0, g.blockW - 8, band.y1 - band.y0);
        }
      }
      ctx.font = '11px ' + PAL.sans;
      ctx.fillStyle = PAL.faint;
      ctx.textAlign = 'right';
      ctx.fillText('layer ' + (li + 1), g.left - 8, (bl.y0 + bl.y1) / 2);
      if (li === 0) {
        ctx.textAlign = 'left';
        ctx.fillStyle = PAL.blueDark;
        ctx.fillText('attention', g.left + 9, (bl.bands[0].y0 + bl.bands[0].y1) / 2);
        ctx.fillStyle = PAL.purple;
        ctx.fillText('MLP', g.left + 9, (bl.bands[1].y0 + bl.bands[1].y1) / 2);
      }
    }

    /* residual stream lanes */
    for (let i = 0; i < LANES; i++) {
      ctx.strokeStyle = i === selLane ? rgba(PAL.blueDark, 0.8) : rgba(PAL.ink, 0.22);
      ctx.lineWidth = i === selLane ? 1.6 : 1;
      ctx.beginPath();
      ctx.moveTo(g.laneX[i], g.yStart + 14);
      ctx.lineTo(g.laneX[i], g.yEnd - 4);
      ctx.stroke();
      kit.arrow(ctx, g.laneX[i], g.top - 2, g.laneX[i], g.yEnd - 6,
        { color: i === selLane ? PAL.blueDark : rgba(PAL.ink, 0.3), width: i === selLane ? 1.6 : 1, head: 6 });
    }

    /* labels top and bottom */
    ctx.font = '11px ' + PAL.sans;
    ctx.fillStyle = PAL.faint;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('to the unembedding', g.left + g.blockW / 2, 14);
    ctx.fillText('embeddings enter', g.left + g.blockW / 2, g.h - 6);

    /* side branch + merge on the selected lane's current band */
    for (const bl of g.blocks) {
      for (const band of bl.bands) {
        const pa = passedAmount(band, pulseY);
        if (pa > 0 && pa < 1) {
          const bx = g.laneX[selLane];
          const yb = band.y1 - 1, yt = band.y0 + 1;
          ctx.strokeStyle = PAL.green;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(bx, yb);
          ctx.bezierCurveTo(bx + 22, yb, bx + 22, yt, bx + 8, yt);
          ctx.stroke();
          kit.arrow(ctx, bx + 8, yt, bx + 1, yt, { color: PAL.green, width: 1.5, head: 5 });
          ctx.beginPath();
          ctx.arc(bx, yt, 6, 0, Math.PI * 2);
          ctx.fillStyle = PAL.bg;
          ctx.fill();
          ctx.strokeStyle = PAL.green;
          ctx.stroke();
          ctx.fillStyle = PAL.green;
          ctx.font = '600 11px ' + PAL.sans;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('+', bx, yt + 0.5);
          ctx.textBaseline = 'alphabetic';
        }
      }
    }

    /* the vector strips (one per lane) at the pulse height */
    for (let i = 0; i < LANES; i++) {
      const vals = [];
      for (let c = 0; c < CELLS; c++) {
        let v = base[i][c];
        for (const bl of g.blocks) {
          for (const band of bl.bands) v += delta[i][band.s][c] * passedAmount(band, pulseY);
        }
        vals.push(v);
      }
      drawStrip(g.laneX[i], pulseY, vals, i === selLane ? 1 : 0.35);
    }
    /* token names under the lanes */
    ctx.font = '11px ' + PAL.mono;
    ctx.textAlign = 'center';
    for (let i = 0; i < LANES; i++) {
      ctx.fillStyle = i === selLane ? PAL.inkStrong : PAL.faint;
      ctx.fillText('“' + NAMES[i] + '”', g.laneX[i], g.h - 22);
    }
  }

  const loop = kit.animLoop(dt => {
    p += dt * 0.09;
    if (p >= 1) p -= 1;
    draw();
  });

  cv.onResize(draw);
  draw();
  kit.caption(container,
    'Three tokens rise through the stack at once. Each sublayer branches off the residual stream, ' +
    'reads the vector, and adds a small correction back in (the “+”); the vector itself is never replaced. ' +
    'The slider picks which stream to highlight.');
  return loop;
});
