'use strict';
/* fig-kvcache — the KV cache growing one column per decode step,
   versus the naive world that recomputes every column every step. */
Figures.register('fig-kvcache', (container, kit) => {
  const cv = kit.makeCanvas(container, { height: 232 });
  const ctx = cv.ctx;

  const PROMPT = ['Explain', 'why', 'the', 'test', 'fails', ':'];
  const GEN = ('The failing case builds a parser with no input , so the first token read is null '
    + 'and the assertion trips .').split(' ');
  const MAXN = 26;                 /* columns before the run resets */
  const GROUPS = ['L 1–20', 'L 21–40', 'L 41–60', 'L 61–80'];
  const MB_PER_TOKEN = 0.3;        /* illustrative: K+V across ~80 layers */

  let n = PROMPT.length;           /* tokens (columns) so far */
  let acc = 0;                     /* time toward next step */
  let cacheCols = 0;               /* K/V columns computed, cached run */
  let naiveCols = 0;               /* K/V columns computed, naive run */
  let lastStep = 1;                /* columns computed on the latest step */
  let playing = true;
  let useCache = true;

  function rgba(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  const controls = kit.makeControls(container);
  const playBtn = kit.makeButton(controls, 'Pause', () => {
    playing = !playing;
    playBtn.textContent = playing ? 'Pause' : 'Play';
  });
  const speedSl = kit.makeSlider(controls, {
    label: 'Speed', min: 0.5, max: 4, step: 0.1, value: 1.4,
    format: v => v.toFixed(1) + ' tok/s',
  });
  kit.makeToggle(controls, 'use KV cache', true, v => {
    useCache = v;
    draw();
  });

  function resetRun() {
    n = PROMPT.length;
    cacheCols = 0;
    naiveCols = 0;
    lastStep = 1;
  }

  function doStep() {
    if (n >= MAXN) { resetRun(); return; }
    n += 1;
    cacheCols += 1;
    naiveCols += n;
    lastStep = useCache ? 1 : n;
  }

  function draw() {
    const w = cv.w, h = cv.h;
    ctx.clearRect(0, 0, w, h);
    const phase = kit.clamp(acc * speedSl.value, 0, 1);  /* progress to next step */
    const left = 64;
    const gridW = w - left - 12;
    const colW = gridW / MAXN;
    const rowH = 11;
    const groupGap = 5;
    const gridTop = 44;
    const gridBottom = gridTop + GROUPS.length * 2 * rowH + (GROUPS.length - 1) * groupGap;

    /* token strip: prompt + generated so far, tail-trimmed to fit */
    const words = PROMPT.concat(GEN).slice(0, n);
    ctx.font = '11px ' + PAL.mono;
    ctx.textBaseline = 'alphabetic';
    let start = 0;
    const widthOf = arr => ctx.measureText(arr.join(' ')).width;
    while (start < words.length - 1 && widthOf(words.slice(start)) > gridW - 14) start++;
    let sx = left;
    if (start > 0) {
      ctx.fillStyle = PAL.faint;
      ctx.fillText('… ', sx, 26);
      sx += ctx.measureText('… ').width;
    }
    for (let i = start; i < words.length; i++) {
      const isNew = i === words.length - 1 && n > PROMPT.length;
      if (isNew) {
        const tw = ctx.measureText(words[i]).width;
        ctx.fillStyle = rgba(PAL.green, 0.30 * (1 - phase) + 0.12);
        ctx.fillRect(sx - 2, 14, tw + 4, 16);
      }
      ctx.fillStyle = i < PROMPT.length ? PAL.faint : PAL.inkStrong;
      ctx.fillText(words[i], sx, 26);
      sx += ctx.measureText(words[i] + ' ').width;
    }

    /* the K/V grid */
    ctx.textBaseline = 'middle';
    for (let g = 0; g < GROUPS.length; g++) {
      const gy = gridTop + g * (2 * rowH + groupGap);
      ctx.font = '11px ' + PAL.sans;
      ctx.fillStyle = PAL.faint;
      ctx.textAlign = 'right';
      ctx.fillText(GROUPS[g], left - 22, gy + rowH);
      for (let r = 0; r < 2; r++) {
        const ry = gy + r * rowH;
        ctx.fillStyle = PAL.faint;
        ctx.font = '10px ' + PAL.mono;
        ctx.fillText(r === 0 ? 'K' : 'V', left - 8, ry + rowH / 2);
        for (let i = 0; i < n; i++) {
          const gx = left + i * colW;
          const cw = Math.max(1, colW - 1.5);
          if (!useCache) {
            /* naive: every column recomputed every step */
            ctx.fillStyle = PAL.greenSoft;
            ctx.fillRect(gx + 0.5, ry + 1, cw, rowH - 2);
            ctx.fillStyle = rgba(PAL.green, 0.7 * (1 - phase));
            ctx.fillRect(gx + 0.5, ry + 1, cw, rowH - 2);
            continue;
          }
          ctx.fillStyle = PAL.blueSoft;
          ctx.fillRect(gx + 0.5, ry + 1, cw, rowH - 2);
          if (i === n - 1) {
            ctx.fillStyle = rgba(PAL.green, 0.9 * (1 - phase));
            ctx.fillRect(gx + 0.5, ry + 1, cw, rowH - 2);
          }
        }
      }
    }
    /* read sweep across the cached columns early in each step */
    if (useCache && phase < 0.5 && n > 1) {
      const sweep = Math.floor((phase / 0.5) * (n - 1));
      const gx = left + sweep * colW;
      ctx.fillStyle = rgba(PAL.yellow, 0.35);
      ctx.fillRect(gx, gridTop - 2, Math.max(1.5, colW - 1), gridBottom - gridTop + 4);
    }
    /* frame + empty remainder */
    ctx.strokeStyle = PAL.grid;
    ctx.lineWidth = 1;
    ctx.strokeRect(left, gridTop - 2, gridW, gridBottom - gridTop + 4);

    /* prompt bracket */
    if (PROMPT.length * colW > 52) {
      const bx2 = left + PROMPT.length * colW;
      ctx.beginPath();
      ctx.moveTo(left + 1, gridBottom + 6.5);
      ctx.lineTo(bx2 - 1, gridBottom + 6.5);
      ctx.strokeStyle = PAL.faint;
      ctx.stroke();
      ctx.font = '10px ' + PAL.sans;
      ctx.fillStyle = PAL.faint;
      ctx.textAlign = 'center';
      ctx.fillText('prompt (prefill)', (left + bx2) / 2, gridBottom + 15);
    }

    /* readouts */
    const ry0 = gridBottom + 30;
    ctx.font = '11px ' + PAL.mono;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = PAL.ink;
    ctx.fillText('KV cache: ' + n + ' tok × ' + MB_PER_TOKEN.toFixed(1) + ' MB ≈ '
      + (n * MB_PER_TOKEN).toFixed(1) + ' MB', left, ry0);
    if (useCache) {
      ctx.fillStyle = PAL.green;
      ctx.fillText('computed this step: 1 column', left, ry0 + 17);
      ctx.fillStyle = PAL.faint;
      ctx.fillText('columns so far: ' + cacheCols + ' · naive: ' + naiveCols, left, ry0 + 34);
    } else {
      ctx.fillStyle = PAL.red;
      ctx.fillText('this step: ' + lastStep + ' columns recomputed', left, ry0 + 17);
      ctx.fillStyle = PAL.faint;
      ctx.fillText('columns so far: ' + naiveCols + ' · cached: ' + cacheCols, left, ry0 + 34);
    }
  }

  const loop = kit.animLoop(dt => {
    if (playing) {
      acc += dt;
      const interval = 1 / speedSl.value;
      if (acc >= interval) {
        acc -= interval;
        doStep();
      }
    }
    draw();
  });

  cv.onResize(draw);
  draw();
  kit.caption(container,
    'Each decode step computes keys and values for one new column (green flash) and merely reads ' +
    'the cached rest (yellow sweep), so the cache and its memory footprint grow linearly. ' +
    'Untick “use KV cache” to watch every column get recomputed on every step. Sizes are illustrative.');
  return loop;
});
