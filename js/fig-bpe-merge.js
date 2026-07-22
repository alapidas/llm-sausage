/* fig-bpe-merge — canvas animation of byte-pair-encoding training on a
   tiny corpus: the most frequent adjacent pair repeatedly fuses into a
   new vocabulary entry until nothing repeats any more. */
'use strict';

Figures.register('fig-bpe-merge', (container, kit) => {
  var level = kit.level();
  var PHRASE = 'the theater is there and the weather is better there';

  /* ---------- precompute the whole merge history ---------- */
  /* states[k]   : symbol array before merge k
     steps[k]    : { a, b, count, pairsAt (old indices), map (old->new) } */
  var states = [], steps = [];
  (function precompute() {
    var syms = PHRASE.split('');
    states.push(syms.slice());
    for (;;) {
      var freq = new Map(), order = [];
      for (var i = 0; i < syms.length - 1; i++) {
        var key = syms[i] + '\u0000' + syms[i + 1];
        if (!freq.has(key)) { freq.set(key, 0); order.push(key); }
        freq.set(key, freq.get(key) + 1);
      }
      var best = null, bestF = 1;
      for (var o = 0; o < order.length; o++) {
        if (freq.get(order[o]) > bestF) { bestF = freq.get(order[o]); best = order[o]; }
      }
      if (!best) break;
      var ab = best.split('\u0000'), a = ab[0], b = ab[1];
      var next = [], map = [], pairsAt = [];
      for (i = 0; i < syms.length; i++) {
        if (i < syms.length - 1 && syms[i] === a && syms[i + 1] === b) {
          pairsAt.push(i);
          map[i] = next.length; map[i + 1] = next.length;
          next.push(a + b);
          i++;
        } else {
          map[i] = next.length;
          next.push(syms[i]);
        }
      }
      steps.push({ a: a, b: b, count: bestF, pairsAt: pairsAt, map: map });
      syms = next;
      states.push(syms.slice());
    }
  })();

  /* ---------- state ---------- */
  var k = 0;            // merges completed
  var trans = -1;       // -1 = idle, else progress 0..1 of merge k
  var playing = false;
  var waitT = 0;        // pause between merges while autoplaying

  /* Base vocabulary size (distinct starting symbols) — a readout for deep. */
  var baseVocab = new Set(PHRASE.split('')).size;

  var H = level === 'novice' ? 250 : level === 'deep' ? 360 : 280;
  var cv = kit.makeCanvas(container, { height: H });
  var ctx = cv.ctx;

  var controls = kit.makeControls(container);
  var stepBtn, playBtn, speed;
  if (level === 'novice') {
    /* Self-running merge story: one Replay control, gentle fixed pacing. */
    kit.makeButton(controls, 'Replay', function () {
      k = 0; trans = -1; waitT = 0; playing = true; draw();
    });
    playing = true;
  } else {
    stepBtn = kit.makeButton(controls, 'Step', function () {
      if (trans < 0 && k < steps.length) trans = 0;
    });
    playBtn = kit.makeButton(controls, 'Play', function () {
      if (k >= steps.length) { reset(); }
      playing = !playing;
      playBtn.textContent = playing ? 'Pause' : 'Play';
    });
    kit.makeButton(controls, 'Reset', reset);
    speed = kit.makeSlider(controls, {
      label: 'Speed', min: 0.3, max: 3, value: 1,
      format: function (v) { return v.toFixed(1) + '×'; },
    });
  }

  function reset() {
    k = 0; trans = -1; waitT = 0; playing = false;
    if (playBtn) playBtn.textContent = 'Play';
    draw();
  }

  /* ---------- layout ---------- */
  function disp(sym) { return sym.replace(/ /g, '␣'); }

  function layout(syms, w) {
    ctx.font = '13px ' + PAL.mono;
    var margin = 12, gap = 4, rowGap = 11, boxH = 26;
    var x = margin, y = 56, boxes = [];
    for (var i = 0; i < syms.length; i++) {
      var text = disp(syms[i]);
      var bw = Math.max(18, Math.ceil(ctx.measureText(text).width) + 11);
      if (x + bw > w - margin && x > margin) { x = margin; y += boxH + rowGap; }
      boxes.push({ x: x, y: y, w: bw, h: boxH, text: text, sym: syms[i] });
      x += bw + gap;
    }
    return boxes;
  }

  function drawBox(b, x, y, highlight) {
    var multi = b.sym.length > 1;
    ctx.fillStyle = multi ? PAL.blueSoft : PAL.graySoft;
    kit.roundedRect(ctx, x, y, b.w, b.h, 6);
    ctx.fill();
    ctx.strokeStyle = highlight ? PAL.orange : PAL.grid;
    ctx.lineWidth = highlight ? 2 : 1;
    ctx.stroke();
    ctx.fillStyle = b.sym.trim() === '' ? PAL.faint : PAL.inkStrong;
    ctx.font = '13px ' + PAL.mono;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.text, x + b.w / 2, y + b.h / 2 + 0.5);
  }

  /* ---------- drawing ---------- */
  function draw() {
    var w = cv.w, h = cv.h;
    ctx.clearRect(0, 0, w, h);

    /* header */
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '12px ' + PAL.sans;
    ctx.fillStyle = PAL.faint;
    var header;
    if (level === 'novice') {
      if (k >= steps.length && trans < 0) {
        header = 'done — every common pair is glued';
      } else if (trans < 0 && k === 0) {
        header = 'watch the most common pairs glue together';
      } else {
        header = 'gluing the most common pair:';
      }
    } else if (k >= steps.length && trans < 0) {
      header = 'merges: ' + steps.length + ' — no pair repeats any more';
    } else if (trans < 0 && k === 0) {
      header = 'merge 0 of ' + steps.length + ' — press Step or Play';
    } else {
      header = 'merge ' + (trans >= 0 ? k + 1 : k) + ' of ' + steps.length;
      if (level === 'deep') header += ' · learned rank ' + (trans >= 0 ? k + 1 : k);
      header += ':';
    }
    ctx.fillText(header, 12, 22);
    if (trans >= 0 || k > 0) {
      var st = trans >= 0 ? steps[k] : steps[k - 1];
      if (st) {
        ctx.font = '13px ' + PAL.mono;
        ctx.fillStyle = PAL.inkStrong;
        var rule = disp(st.a) + ' + ' + disp(st.b) + ' → ' + disp(st.a + st.b);
        var rw = ctx.measureText(rule).width;
        ctx.fillText(rule, 12, 40);
        ctx.font = '12px ' + PAL.sans;
        ctx.fillStyle = PAL.faint;
        var cntTxt = level === 'novice' ? 'appears ' + st.count + ' times'
                                        : '× ' + st.count + ' occurrences';
        ctx.fillText(cntTxt, 12 + rw + 12, 40);
      }
    }

    /* boxes */
    if (trans < 0) {
      var boxes = layout(states[k], w);
      for (var i = 0; i < boxes.length; i++) drawBox(boxes[i], boxes[i].x, boxes[i].y, false);
    } else {
      var st2 = steps[k];
      var oldB = layout(states[k], w);
      var newB = layout(states[k + 1], w);
      if (trans < 0.4) {
        /* phase A: highlight every occurrence of the pair */
        var pulse = 0.5 + 0.5 * Math.sin(trans * 28);
        for (var j = 0; j < oldB.length; j++) {
          var isPair = st2.pairsAt.indexOf(j) >= 0 || st2.pairsAt.indexOf(j - 1) >= 0;
          drawBox(oldB[j], oldB[j].x, oldB[j].y, isPair && pulse > 0.35);
        }
      } else {
        /* phase B: slide each old box toward its merged position */
        var t = kit.ease.inOut((trans - 0.4) / 0.6);
        for (var m = 0; m < oldB.length; m++) {
          var target = newB[st2.map[m]];
          var isRight = st2.pairsAt.indexOf(m - 1) >= 0;
          var tx = isRight ? target.x + target.w - oldB[m].w : target.x;
          var x = kit.lerp(oldB[m].x, tx, t);
          var y = kit.lerp(oldB[m].y, target.y, t);
          var merging = isRight || st2.pairsAt.indexOf(m) >= 0;
          drawBox(oldB[m], x, y, merging && t < 0.9);
        }
      }
    }

    /* deep: the running list of learned merges, numbered by rank */
    if (level === 'deep') drawRankList(w, h);

    /* footer */
    ctx.font = '12px ' + PAL.sans;
    ctx.fillStyle = PAL.faint;
    ctx.textAlign = 'left';
    var msg;
    if (level === 'novice') {
      msg = states[k].length + ' pieces';
      if (k >= steps.length && trans < 0) {
        msg += ' — real models repeat this thousands of times';
      }
    } else if (level === 'deep') {
      msg = 'vocabulary: ' + (baseVocab + k) + ' entries · ' +
        states[k].length + ' symbols';
      if (k >= steps.length && trans < 0) {
        msg += ' — real corpora merge on the order of 100,000 times';
      }
    } else {
      msg = states[k].length + ' symbols';
      if (k >= steps.length && trans < 0) {
        msg += ' — a real tokenizer keeps merging over a huge corpus, ~100,000 times';
      }
    }
    ctx.fillText(msg, 12, h - 12);
  }

  /* Compact ranked chips of every merge learned so far (deep only). */
  function drawRankList(w, h) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '12px ' + PAL.sans;
    ctx.fillStyle = PAL.faint;
    var top = h - 108;
    ctx.fillText('learned merges (rank order):', 12, top);
    ctx.font = '12px ' + PAL.mono;
    var x = 12, y = top + 20, gap = 7, lineH = 22, maxX = w - 12;
    for (var i = 0; i < k; i++) {
      var st3 = steps[i];
      var label = (i + 1) + '. ' + disp(st3.a + st3.b);
      var cw = Math.ceil(ctx.measureText(label).width) + 14;
      if (x + cw > maxX && x > 12) { x = 12; y += lineH; }
      if (y > h - 26) { ctx.fillStyle = PAL.faint; ctx.fillText('…', x, y); break; }
      kit.roundedRect(ctx, x, y - 13, cw, 18, 5);
      ctx.fillStyle = PAL.blueSoft;
      ctx.fill();
      ctx.strokeStyle = PAL.grid;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = PAL.inkStrong;
      ctx.fillText(label, x + 7, y);
      x += cw + gap;
    }
  }

  /* ---------- animation ---------- */
  var loop = kit.animLoop(function (dt) {
    var sp = level === 'novice' ? 0.9 : speed.value;
    if (trans >= 0) {
      trans += dt * sp * 1.15;
      if (trans >= 1) {
        trans = -1;
        k++;
        waitT = 0;
        if (k >= steps.length && level !== 'novice') {
          playing = false;
          playBtn.textContent = 'Play';
        }
      }
    } else if (playing) {
      waitT += dt * sp;
      if (level === 'novice') {
        /* loop the story: pause on the finished state, then restart */
        if (k >= steps.length) { if (waitT > 1.8) { k = 0; waitT = 0; } }
        else if (waitT > 0.45) { trans = 0; waitT = 0; }
      } else if (waitT > 0.45 && k < steps.length) {
        trans = 0; waitT = 0;
      }
    }
    draw();
  });

  cv.onResize(draw);
  draw();

  if (level === 'novice') {
    kit.caption(container,
      'Byte-pair encoding on a tiny sentence, playing by itself: at each step ' +
      'the pair of neighboring pieces that appears most often glues into one ' +
      'new piece, over and over, until nothing repeats. Because spaces count ' +
      'as pieces too, ␣the emerges with its leading space attached.');
  } else if (level === 'deep') {
    kit.caption(container,
      'Byte-pair encoding on a tiny corpus: at every step the most frequent ' +
      'adjacent pair fuses into a new vocabulary entry, numbered by the rank ' +
      'in which it was learned. The list tracks the growing vocabulary, and ' +
      'entries like ␣the emerge with their leading space attached because ' +
      'spaces are symbols too.');
  } else {
    kit.caption(container,
      'Byte-pair encoding on a tiny corpus: at every step the most ' +
      'frequent adjacent pair of symbols fuses into a new vocabulary entry. ' +
      'Because spaces are symbols too, entries like ␣the emerge with ' +
      'their leading space attached.');
  }

  return loop;
});
