/* fig-sharding — one logical model server's weight block, sliced across chips. */
'use strict';

Figures.register('fig-sharding', (container, kit) => {
  const level = kit.level();
  const NOVICE = level === 'novice';
  const DEEP = level === 'deep';

  const ARIA = NOVICE
    ? 'One large thing split into three slices, each slice held on its own chip, the chips wired together and working as one.'
    : (DEEP
      ? 'One logical model server whose weight matrices are sliced across four chips by tensor parallelism, chips within a node joined by an all-reduce every layer and the two nodes joined along the pipeline dimension.'
      : 'One logical model server whose weight block is sliced into four horizontal shards, each shard resident on its own chip, the chips wired together to act as a single server.');

  const cv = kit.makeCanvas(container, { aspect: 0.52, maxHeight: 300,
    ariaLabel: ARIA });

  const NCHIP = NOVICE ? 3 : 4;
  const SOFT = [PAL.blueSoft, PAL.greenSoft, PAL.orangeSoft, PAL.purpleSoft];
  const STRONG = [PAL.blue, PAL.green, PAL.orange, PAL.purple];
  const NODE_SPLIT = 2;   // deep: chips 0..1 = node A, 2..3 = node B

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
    const chipGap = DEEP ? (narrow ? 16 : 22) : 8;
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
      let label;
      if (NOVICE) label = 'chip ' + (i + 1);
      else if (DEEP) label = narrow ? 'chip ' + (i + 1) : 'chip ' + (i + 1) + ' · TP shard ' + (i + 1);
      else label = narrow ? 'chip ' + (i + 1) : 'chip ' + (i + 1) + ' · shard ' + (i + 1);
      ctx.fillText(label, chipX + 10, cy + chipH / 2);
    }

    // deep: all-reduce hops within a node, pipeline hop across nodes
    if (DEEP) {
      const xc = chipX + chipW / 2;
      ctx.textBaseline = 'middle';
      ctx.font = '11px ' + PAL.sans;
      for (let i = 0; i < NCHIP - 1; i++) {
        const gapTop = top + i * (chipH + chipGap) + chipH;
        const gapBot = top + (i + 1) * (chipH + chipGap);
        const gy = (gapTop + gapBot) / 2;
        const pipeline = ((i + 1) % NODE_SPLIT) === 0;   // boundary between nodes
        if (pipeline) {
          kit.arrow(ctx, xc, gapTop + 1, xc, gapBot - 1, { color: PAL.faint, width: 1.4, head: 6 });
          if (!narrow) {
            ctx.fillStyle = PAL.faint;
            ctx.textAlign = 'left';
            ctx.fillText('pipeline →', xc + 8, gy);
          }
        } else {
          // double-headed: partials exchanged and combined
          kit.arrow(ctx, xc, gy, xc, gapTop + 1, { color: PAL.faint, width: 1.4, head: 6 });
          kit.arrow(ctx, xc, gy, xc, gapBot - 1, { color: PAL.faint, width: 1.4, head: 6 });
          if (!narrow) {
            ctx.fillStyle = PAL.faint;
            ctx.textAlign = 'left';
            ctx.fillText('all-reduce', xc + 8, gy);
          }
        }
      }
    }

    // titles
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = PAL.ink;
    ctx.font = '600 12px ' + PAL.sans;
    let leftTitle, rightTitle;
    if (NOVICE) { leftTitle = narrow ? 'the thing' : 'the whole thing'; rightTitle = narrow ? 'chips' : 'chips working as one'; }
    else if (DEEP) { leftTitle = narrow ? 'weights' : 'weight matrices'; rightTitle = narrow ? 'chips' : 'wired as one server'; }
    else { leftTitle = narrow ? 'weights' : 'the weights'; rightTitle = narrow ? 'chips' : 'wired as one server'; }
    ctx.fillText(leftTitle, blockX + blockW / 2, 18);
    ctx.fillText(rightTitle, chipX + chipW / 2, 18);

    // note in the gap between block and chips
    if (!narrow) {
      ctx.fillStyle = PAL.faint;
      ctx.font = '11px ' + PAL.sans;
      const midX = (blockX + blockW + chipX) / 2;
      const l1 = NOVICE ? 'split' : (DEEP ? 'tensor-' : 'sharded');
      const l2 = NOVICE ? 'across' : (DEEP ? 'parallel' : 'across');
      ctx.fillText(l1, midX, top + innerH / 2 - 4);
      ctx.fillText(l2, midX, top + innerH / 2 + 12);
    }
  }

  cv.onResize(draw);
  draw();
  const CAP = NOVICE
    ? 'One thing too big for a single chip: the whole block on the left is split into slices, ' +
      'each slice living on its own chip. The chips are wired together and work as one, every ' +
      'chip helping on every word.'
    : (DEEP
      ? 'One logical model server. The weight matrices on the left are sliced across chips by ' +
        '<em>tensor parallelism</em>; chips within a node combine their partial results with an ' +
        '<em>all-reduce</em> every layer (double arrows), while the model is also split by depth ' +
        'across the two nodes along the <em>pipeline</em> dimension (single arrow). Every chip ' +
        'contributes on every token.'
      : 'One logical model server: the weight block on the left is sliced into shards, each ' +
        'resident on a separate chip. The chips are wired together and act as a single server, ' +
        'every one of them contributing on every token.');
  kit.caption(container, CAP);
});
