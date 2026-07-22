/* fig-embedding — from token id to vector: a schematic embedding-row
   readout on the left, and a 2-D "map of meaning" on the right with
   hand-placed semantic clusters. Hover or tap a word to select it. */
'use strict';

Figures.register('fig-embedding', (container, kit) => {
  var level = kit.level();
  /* Deep exposes a wider slice of the vector; novice hides the slice entirely. */
  var DIMS = level === 'deep' ? 48 : 24;

  var CLUSTERS = [
    { name: 'code', color: PAL.blue, soft: PAL.blueSoft, words: [
      ['function', 0.13, 0.10], ['return', 0.25, 0.17], ['var', 0.07, 0.19],
      ['def', 0.17, 0.25], ['const', 0.28, 0.07], ['class', 0.05, 0.28]] },
    { name: 'weather', color: PAL.yellow, soft: PAL.graySoft, words: [
      ['rain', 0.44, 0.11], ['snow', 0.53, 0.17], ['sun', 0.38, 0.17],
      ['cloud', 0.48, 0.05], ['storm', 0.58, 0.09]] },
    { name: 'animals', color: PAL.orange, soft: PAL.orangeSoft, words: [
      ['cat', 0.78, 0.11], ['dog', 0.87, 0.16], ['kitten', 0.72, 0.17],
      ['puppy', 0.80, 0.23], ['horse', 0.93, 0.09], ['bird', 0.69, 0.05],
      ['fish', 0.91, 0.25]] },
    { name: 'emotions', color: PAL.purple, soft: PAL.purpleSoft, words: [
      ['happy', 0.40, 0.40], ['sad', 0.50, 0.47], ['angry', 0.58, 0.41],
      ['calm', 0.43, 0.53], ['joy', 0.34, 0.46], ['fear', 0.54, 0.33]] },
    { name: 'numbers', color: PAL.green, soft: PAL.greenSoft, words: [
      ['one', 0.10, 0.77], ['two', 0.18, 0.84], ['three', 0.08, 0.90],
      ['seven', 0.21, 0.71], ['hundred', 0.28, 0.88], ['zero', 0.13, 0.65]] },
    { name: 'motion', color: PAL.teal, soft: PAL.graySoft, words: [
      ['run', 0.43, 0.72], ['walk', 0.52, 0.79], ['jump', 0.38, 0.85],
      ['swim', 0.50, 0.66]] },
    { name: 'food', color: PAL.red, soft: PAL.redSoft, words: [
      ['bread', 0.76, 0.80], ['cheese', 0.86, 0.87], ['apple', 0.70, 0.89],
      ['coffee', 0.91, 0.73], ['soup', 0.78, 0.69], ['butter', 0.67, 0.76]] },
  ];

  /* ---------- deterministic pseudo-values ---------- */
  function hash(s) {
    var x = 2166136261;
    for (var i = 0; i < s.length; i++) {
      x ^= s.charCodeAt(i);
      x = Math.imul(x, 16777619);
    }
    return x >>> 0;
  }
  function rng(seed) {
    var a = seed;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1; // [-1, 1)
    };
  }

  /* Flatten; give each word a vector that is mostly its cluster's base
     vector plus word-specific noise, so neighbors look alike. */
  var POINTS = [];
  CLUSTERS.forEach(function (c) {
    var base = [], rb = rng(hash('cluster:' + c.name));
    for (var d = 0; d < DIMS; d++) base.push(rb());
    c.words.forEach(function (wd) {
      var rw = rng(hash('word:' + wd[0])), vec = [];
      for (var d2 = 0; d2 < DIMS; d2++) {
        vec.push(kit.clamp(0.72 * base[d2] + 0.55 * rw(), -1, 1));
      }
      POINTS.push({
        word: wd[0], x: wd[1], y: wd[2],
        color: c.color, soft: c.soft,
        id: 1000 + hash('id:' + wd[0]) % 99000,
        vec: vec,
      });
    });
  });

  var sel = 0;
  for (var p0 = 0; p0 < POINTS.length; p0++) {
    if (POINTS[p0].word === 'cat') { sel = p0; break; }
  }

  /* Cosine similarity between two equal-length vectors (deep readout). */
  function cosine(a, b) {
    var dot = 0, na = 0, nb = 0;
    for (var i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
  }

  var ariaLabel = level === 'novice'
    ? 'A two-dimensional map of words where related words cluster together; ' +
      'use the arrow keys or tap to move the selection between words.'
    : 'A two-dimensional map of word embeddings where related words ' +
      'cluster together, beside a schematic readout of the selected token\'s ' +
      'vector' + (level === 'deep' ? ' and its cosine similarity to nearby tokens' : '') +
      '; use the arrow keys to move the selection between words.';
  var cv = kit.makeCanvas(container, { aspect: 0.78, maxHeight: 430,
    ariaLabel: ariaLabel });
  var ctx = cv.ctx;

  function neighbors(i, n) {
    var d = [];
    for (var j = 0; j < POINTS.length; j++) {
      if (j === i) continue;
      var dx = POINTS[j].x - POINTS[i].x, dy = POINTS[j].y - POINTS[i].y;
      d.push([dx * dx + dy * dy, j]);
    }
    d.sort(function (a, b) { return a[0] - b[0]; });
    return d.slice(0, n).map(function (e) { return e[1]; });
  }

  function draw() {
    var w = cv.w, h = cv.h;
    var narrow = w < 460;
    ctx.clearRect(0, 0, w, h);
    var p = POINTS[sel];
    /* Novice drops the left vector-slice inspector: the map fills the width. */
    var panelW = level === 'novice' ? 0 : kit.clamp(w * 0.26, 92, 138);

    if (level !== 'novice') {
    /* ----- left panel: token pill + id ----- */
    ctx.font = '13px ' + PAL.mono;
    var pillW = Math.min(panelW - 12, ctx.measureText(p.word).width + 18);
    var pillX = (panelW - pillW) / 2, pillY = 12;
    ctx.fillStyle = p.soft;
    kit.roundedRect(ctx, pillX, pillY, pillW, 24, 6);
    ctx.fill();
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = PAL.inkStrong;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.word, panelW / 2, pillY + 12.5);

    ctx.font = '11px ' + PAL.sans;
    ctx.fillStyle = PAL.faint;
    ctx.fillText('id ' + p.id, panelW / 2, pillY + 36);

    /* ----- vector column: row `id` of the embedding matrix ----- */
    var colW = 24;
    var colX = (panelW - colW) / 2;
    var colTop = pillY + 50, colBot = h - 30;
    var cellH = (colBot - colTop) / DIMS;
    kit.arrow(ctx, panelW / 2, pillY + 42, panelW / 2, colTop - 2,
              { color: PAL.faint, width: 1, head: 5 });
    for (var d = 0; d < DIMS; d++) {
      var v = p.vec[d];
      ctx.globalAlpha = 0.15 + 0.85 * Math.abs(v);
      ctx.fillStyle = v >= 0 ? PAL.blue : PAL.orange;
      ctx.fillRect(colX, colTop + d * cellH, colW, cellH - 1);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = PAL.grid;
    ctx.lineWidth = 1;
    ctx.strokeRect(colX - 0.5, colTop - 0.5, colW + 1, colBot - colTop + 1);
    ctx.font = '11px ' + PAL.sans;
    ctx.fillStyle = PAL.faint;
    ctx.textAlign = 'center';
    ctx.fillText(DIMS + ' of a few', panelW / 2, colBot + 12);
    ctx.fillText('thousand cells', panelW / 2, colBot + 24);

    /* ----- divider ----- */
    ctx.strokeStyle = PAL.grid;
    ctx.beginPath();
    ctx.moveTo(panelW + 6.5, 12);
    ctx.lineTo(panelW + 6.5, h - 12);
    ctx.stroke();
    } /* end left panel (mid/deep only) */

    /* ----- scatter map ----- */
    var sx0 = panelW > 0 ? panelW + 20 : 14, sx1 = w - 14;
    var sy0 = 18, sy1 = h - 42;
    function px(pt) { return sx0 + pt.x * (sx1 - sx0); }
    function py(pt) { return sy0 + pt.y * (sy1 - sy0); }

    var near = neighbors(sel, 3);

    /* connecting lines to nearest neighbors */
    ctx.strokeStyle = p.color;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1.2;
    near.forEach(function (j) {
      ctx.beginPath();
      ctx.moveTo(px(p), py(p));
      ctx.lineTo(px(POINTS[j]), py(POINTS[j]));
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    /* points and labels */
    ctx.font = '11px ' + PAL.sans;
    for (var i = 0; i < POINTS.length; i++) {
      var pt = POINTS[i], x = px(pt), y = py(pt);
      var isSel = i === sel, isNear = near.indexOf(i) >= 0;
      ctx.beginPath();
      ctx.arc(x, y, isSel ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = pt.color;
      ctx.fill();
      if (isSel) {
        ctx.beginPath();
        ctx.arc(x, y, 8.5, 0, Math.PI * 2);
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      /* Narrow: the map is too cramped for 40 labels, so only the selected
         word and its nearest neighbors are named; the rest stay as dots. */
      if (!narrow || isSel || isNear) {
        ctx.fillStyle = isSel ? PAL.inkStrong : (isNear ? PAL.ink : PAL.faint);
        ctx.textBaseline = 'middle';
        var lw = ctx.measureText(pt.word).width;
        if (x + 7 + lw > w - 4) {
          ctx.textAlign = 'right';
          ctx.fillText(pt.word, x - 7, y);
        } else {
          ctx.textAlign = 'left';
          ctx.fillText(pt.word, x + 7, y);
        }
      }
    }

    /* nearest-neighbor note */
    ctx.font = '12px ' + PAL.sans;
    ctx.fillStyle = PAL.faint;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    if (level === 'deep') {
      /* cosine similarity between the selected vector and each neighbor */
      var parts = near.map(function (j) {
        return POINTS[j].word + ' ' + cosine(p.vec, POINTS[j].vec).toFixed(2);
      }).join('  ·  ');
      ctx.fillText('cosine to nearest: ' + parts, sx0, h - 16);
    } else {
      var names = near.map(function (j) { return POINTS[j].word; }).join(', ');
      var lbl = level === 'novice' ? 'closest words: ' : 'nearby: ';
      ctx.fillText(lbl + names, sx0, h - 16);
    }
  }

  /* ---------- interaction ---------- */
  function pick(ev) {
    var pos = cv.pointer(ev);
    var w = cv.w, h = cv.h;
    var panelW = level === 'novice' ? 0 : kit.clamp(w * 0.26, 92, 138);
    var sx0 = panelW > 0 ? panelW + 20 : 14, sx1 = w - 14;
    var sy0 = 18, sy1 = h - 42;
    var best = -1, bestD = 28 * 28;
    for (var i = 0; i < POINTS.length; i++) {
      var x = sx0 + POINTS[i].x * (sx1 - sx0);
      var y = sy0 + POINTS[i].y * (sy1 - sy0);
      var dx = pos.x - x, dy = pos.y - y;
      var dd = dx * dx + dy * dy;
      if (dd < bestD) { bestD = dd; best = i; }
    }
    return best;
  }
  function onPointer(ev) {
    var i = pick(ev);
    cv.canvas.style.cursor = i >= 0 ? 'pointer' : 'default';
    if (i >= 0 && i !== sel) { sel = i; draw(); }
  }
  cv.canvas.addEventListener('pointermove', onPointer);
  cv.canvas.addEventListener('pointerdown', onPointer);

  /* Keyboard: move the selection to the nearest word in the pressed
     direction, so the map is operable without a pointer. */
  function moveSel(dirx, diry) {
    var cur = POINTS[sel], best = -1, bestScore = Infinity;
    for (var i = 0; i < POINTS.length; i++) {
      if (i === sel) continue;
      var dx = POINTS[i].x - cur.x, dy = POINTS[i].y - cur.y;
      var along = dx * dirx + dy * diry;
      if (along <= 0.001) continue;                 // must move that way
      var perp = dx * diry - dy * dirx;             // sideways deviation
      var score = along + 2 * Math.abs(perp);       // prefer aligned, near words
      if (score < bestScore) { bestScore = score; best = i; }
    }
    if (best >= 0 && best !== sel) { sel = best; draw(); }
  }
  var ARROWS = { ArrowRight: [1, 0], ArrowLeft: [-1, 0],
                 ArrowUp: [0, -1], ArrowDown: [0, 1] };
  cv.canvas.setAttribute('tabindex', '0');
  cv.canvas.addEventListener('keydown', function (ev) {
    var d = ARROWS[ev.key];
    if (!d) return;
    ev.preventDefault();
    moveSel(d[0], d[1]);
  });

  cv.onResize(draw);
  draw();

  if (level === 'novice') {
    kit.caption(container,
      'A map of meaning: related words sit near each other. Tap a word to ' +
      'select it and see its closest neighbors. The exact positions are ' +
      'illustrative, but the idea that related words sit together is the ' +
      'real mechanism.');
  } else if (level === 'deep') {
    kit.caption(container,
      'Row lookup in the embedding matrix, and a 2-D cartoon of where the ' +
      'resulting vectors live. Real embeddings have thousands of dimensions, ' +
      'not two, and the values here are illustrative — but the idea that ' +
      'related tokens sit near each other is the real mechanism. Hover or ' +
      'tap a word to inspect it; the readout gives the cosine similarity to ' +
      'its nearest neighbors, and the column shows ' + DIMS + ' cells of the row.');
  } else {
    kit.caption(container,
      'Row lookup in the embedding matrix, and a 2-D cartoon of where the ' +
      'resulting vectors live. Real embeddings have thousands of dimensions, ' +
      'not two, and the values here are illustrative — but the idea that ' +
      'related tokens sit near each other is the real mechanism. Hover or ' +
      'tap a word to inspect it.');
  }

  return {};
});
