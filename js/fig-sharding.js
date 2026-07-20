/* fig-sharding — one logical model server's weight block, sliced across chips. */
'use strict';

Figures.register('fig-sharding', (container, kit) => {
  const cv = kit.makeCanvas(container, { aspect: 0.52, maxHeight: 300,
    ariaLabel: 'One logical model server whose weight block is sliced into four horizontal shards, each shard resident on its own chip, the chips wired together to act as a single server.' });

  const NCHIP = 4;
  const SOFT = [PAL.blueSoft, PAL.greenSoft, PAL.orangeSoft, PAL.purpleSoft];
  const STRONG = [PAL.blue, PAL.green, PAL.orange, PAL.purple];

  function draw() {
    const { ctx, w, h } = cv;
    ctx.clearRect(0, 0, w, h);
    const narrow = w < 460;

    const padX = narrow ? 8 : 12;
    const top = 30, bot = 14;
    const innerH = h - top - bot;

    // left: the weight block, drawn as one unit divided into NCHIP bands
    const blockW = Math.min(narrow ? 88 : 132, w * 0.30);
    const blockX = padX;
    const bandH = innerH / NCHIP;

    // right: one chip per band
    const chipW = Math.min(narrow ? 104 : 168, w * 0.36);
    const chipX = w - chipW - padX;
    const chipGap = 8;
    const chipH = (innerH - (NCHIP - 1) * chipGap) / NCHIP;

    // connectors band -> chip (draw first, behind boxes)
    for (let i = 0; i < NCHIP; i++) {
      const y0 = top + (i + 0.5) * bandH;
      const y1 = top + i * (chipH + chipGap) + chipH / 2;
      const x0 = blockX + blockW, x1 = chipX;
      const mx = (x0 + x1) / 2;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.bezierCurveTo(mx, y0, mx, y1, x1, y1);
      ctx.strokeStyle = STRONG[i];
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // weight block: filled bands, then one outer border to read as a single block
    for (let i = 0; i < NCHIP; i++) {
      const by = top + i * bandH;
      ctx.fillStyle = SOFT[i];
      ctx.fillRect(blockX, by, blockW, bandH);
    }
    ctx.strokeStyle = PAL.grid;
    ctx.lineWidth = 1;
    for (let i = 1; i < NCHIP; i++) {
      const by = top + i * bandH;
      ctx.beginPath();
      ctx.moveTo(blockX, by);
      ctx.lineTo(blockX + blockW, by);
      ctx.stroke();
    }
    kit.roundedRect(ctx, blockX, top, blockW, innerH, 7);
    ctx.strokeStyle = PAL.faint;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // chips
    for (let i = 0; i < NCHIP; i++) {
      const cy = top + i * (chipH + chipGap);
      kit.roundedRect(ctx, chipX, cy, chipW, chipH, 6);
      ctx.fillStyle = SOFT[i];
      ctx.fill();
      ctx.strokeStyle = STRONG[i];
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = PAL.ink;
      ctx.font = '11px ' + PAL.sans;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const label = narrow ? 'chip ' + (i + 1) : 'chip ' + (i + 1) + ' · shard ' + (i + 1);
      ctx.fillText(label, chipX + 10, cy + chipH / 2);
    }

    // titles
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = PAL.ink;
    ctx.font = '600 12px ' + PAL.sans;
    ctx.fillText(narrow ? 'weights' : 'the weights', blockX + blockW / 2, 18);
    ctx.fillText(narrow ? 'chips' : 'wired as one server', chipX + chipW / 2, 18);

    // "sharded across" note in the gap
    if (!narrow) {
      ctx.fillStyle = PAL.faint;
      ctx.font = '11px ' + PAL.sans;
      const midX = (blockX + blockW + chipX) / 2;
      ctx.fillText('sharded', midX, top + innerH / 2 - 4);
      ctx.fillText('across', midX, top + innerH / 2 + 12);
    }
  }

  cv.onResize(draw);
  draw();
  kit.caption(container,
    'One logical model server: the weight block on the left is sliced into shards, each ' +
    'resident on a separate chip. The chips are wired together and act as a single server, ' +
    'every one of them contributing on every token.');
});
