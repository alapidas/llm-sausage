/* ===================================================================
   Figure runtime + shared helpers (FigKit).

   Every interactive figure lives in a `.figure` div with a unique id
   and registers itself:

       Figures.register('fig-something', (container, kit) => {
         const cv = kit.makeCanvas(container, { aspect: 0.55 });
         function draw() { ... }
         const loop = kit.animLoop((dt, t) => { ...; draw(); });
         cv.onResize(draw);
         draw();
         return loop;          // {start, stop} — driven by visibility
       });

   Figures scroll on/off screen: the runtime starts/stops whatever the
   setup function returns via an IntersectionObserver, so off-screen
   animations cost nothing.
   =================================================================== */
'use strict';

/* ---------------- palette ---------------- */
window.PAL = {
  ink:      '#3d4148',
  inkStrong:'#24272c',
  faint:    '#6b727a',
  grid:     '#e3e6ea',
  bg:       '#ffffff',
  blue:     '#4a90d9',
  blueDark: '#2f6bb0',
  orange:   '#e8833a',
  orangeDark: '#b25e15',
  green:    '#55a868',
  greenDark: '#3f7d51',
  red:      '#d1605e',
  redDark:  '#b23b39',
  purple:   '#8172b3',
  yellow:   '#e0b13e',
  teal:     '#4db6ac',
  blueSoft:   '#dcecfa',
  orangeSoft: '#fbe8d8',
  greenSoft:  '#def0e2',
  redSoft:    '#f8e0df',
  purpleSoft: '#e8e3f3',
  graySoft:   '#f2f3f5',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

/* ---------------- FigKit helpers ---------------- */
window.FigKit = (() => {
  const kit = {};
  let uid = 0;

  /* Easing */
  kit.ease = {
    inOut: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    out:   t => 1 - Math.pow(1 - t, 3),
    in:    t => t * t * t,
  };
  kit.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  kit.lerp = (a, b, t) => a + (b - a) * t;

  /* DPR-aware canvas that tracks its container's width.
     opts: { aspect: h/w ratio (default 0.6), maxHeight, height (fixed CSS px),
             ariaLabel: accessible name (falls back to caption text) } */
  kit.makeCanvas = (container, opts = {}) => {
    const aspect = opts.aspect ?? 0.6;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    if (opts.ariaLabel) canvas.setAttribute('aria-label', opts.ariaLabel);
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const cv = { canvas, ctx, w: 0, h: 0 };
    const resizeCbs = [];
    cv.onResize = cb => resizeCbs.push(cb);

    function size() {
      const w = container.clientWidth;
      if (!w) {
        /* container hidden / zero-width at init: clear the bitmap so the
           default 300x150 canvas never paints garbled; ResizeObserver
           re-runs size() once the container gains width. */
        canvas.width = 0; canvas.height = 0;
        cv.w = 0; cv.h = 0;
        return;
      }
      let h = opts.height ?? Math.round(w * aspect);
      if (opts.maxHeight) h = Math.min(h, opts.maxHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.height = h + 'px';
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cv.w = w; cv.h = h;
      resizeCbs.forEach(cb => { try { cb(); } catch (e) { console.error(e); } });
    }
    const ro = new ResizeObserver(() => size());
    ro.observe(container);
    size();

    /* pointer position in CSS px relative to canvas */
    cv.pointer = ev => {
      const r = canvas.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    };
    return cv;
  };

  /* requestAnimationFrame loop with dt in seconds (clamped). */
  kit.animLoop = fn => {
    let raf = null, last = 0, t = 0, running = false;
    function frame(now) {
      if (!last) last = now;
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.1) dt = 0.1;
      t += dt;
      try { fn(dt, t); }
      catch (e) { console.error(e); running = false; raf = null; return; }
      /* re-arm only after the callback succeeds, and only if still running
         (the callback may have called stop()). */
      if (running) raf = requestAnimationFrame(frame);
    }
    return {
      start() { if (!running) { running = true; last = 0; raf = requestAnimationFrame(frame); } },
      stop()  { running = false; if (raf != null) { cancelAnimationFrame(raf); raf = null; } },
      get running() { return running; },
    };
  };

  /* Controls row */
  kit.makeControls = container => {
    const div = document.createElement('div');
    div.className = 'controls';
    container.appendChild(div);
    return div;
  };

  /* Slider: { label, min, max, step, value, format, onInput } */
  kit.makeSlider = (parent, opts) => {
    const wrap = document.createElement('div');
    wrap.className = 'control';
    const input = document.createElement('input');
    input.type = 'range';
    input.id = 'fig-slider-' + (++uid);
    input.min = opts.min ?? 0;
    input.max = opts.max ?? 1;
    input.step = opts.step ?? 'any';
    input.value = opts.value ?? opts.min ?? 0;
    const labelText = opts.label ?? '';
    const lab = document.createElement('label');
    lab.className = 'control-label';
    lab.htmlFor = input.id;
    lab.textContent = labelText;
    if (labelText) input.setAttribute('aria-label', labelText);
    const val = document.createElement('span');
    val.className = 'control-value';
    const fmt = opts.format ?? (v => String(v));
    const update = () => {
      const text = fmt(parseFloat(input.value));
      val.textContent = text;
      input.setAttribute('aria-valuetext', text);
    };
    input.addEventListener('input', () => { update(); opts.onInput && opts.onInput(parseFloat(input.value)); });
    update();
    wrap.append(lab, input, val);
    parent.appendChild(wrap);
    return {
      get value() { return parseFloat(input.value); },
      set value(v) { input.value = v; update(); },
      input,
    };
  };

  kit.makeButton = (parent, label, onClick) => {
    const b = document.createElement('button');
    b.className = 'fig-btn';
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', onClick);
    parent.appendChild(b);
    return b;
  };

  kit.makeToggle = (parent, label, checked, onChange) => {
    const lab = document.createElement('label');
    lab.className = 'fig-toggle';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!checked;
    input.addEventListener('change', () => onChange && onChange(input.checked));
    lab.append(input, document.createTextNode(label));
    parent.appendChild(lab);
    return { get value() { return input.checked; }, set value(v) { input.checked = v; }, input };
  };

  /* Canvas drawing helpers */
  kit.roundedRect = (ctx, x, y, w, h, r) => {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  /* Arrow from (x1,y1) to (x2,y2). opts: { color, width, head } */
  kit.arrow = (ctx, x1, y1, x2, y2, opts = {}) => {
    const color = opts.color ?? PAL.ink;
    const lw = opts.width ?? 1.5;
    const head = opts.head ?? 7;
    const a = Math.atan2(y2 - y1, x2 - x1);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2 - head * 0.6 * Math.cos(a), y2 - head * 0.6 * Math.sin(a));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(a - 0.44), y2 - head * Math.sin(a - 0.44));
    ctx.lineTo(x2 - head * Math.cos(a + 0.44), y2 - head * Math.sin(a + 0.44));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  /* Caption under a figure */
  kit.caption = (container, html) => {
    const p = document.createElement('p');
    p.className = 'fig-caption';
    p.innerHTML = html;
    container.appendChild(p);
    /* Give any canvas an accessible name/description from the caption.
       If the figure passed an ariaLabel, keep it as the name and let the
       caption describe; otherwise use the caption text as the name. */
    const cnv = container.querySelector('canvas[role="img"]');
    if (cnv) {
      if (!cnv.getAttribute('aria-label')) {
        cnv.setAttribute('aria-label', p.textContent);
      } else if (!cnv.getAttribute('aria-describedby')) {
        if (!p.id) p.id = 'fig-caption-' + (++uid);
        cnv.setAttribute('aria-describedby', p.id);
      }
    }
    return p;
  };

  return kit;
})();

/* ---------------- registry ---------------- */
window.Figures = (() => {
  const registry = new Map();

  function register(id, setup) {
    if (registry.has(id)) { console.warn('duplicate figure id (keeping first):', id); return; }
    registry.set(id, setup);
  }

  /* Inject a runtime Play/Pause control for a loop-returning figure.
     Used under prefers-reduced-motion, where loops are not auto-started. */
  function injectPlayPause(el, inst) {
    const bar = document.createElement('div');
    bar.className = 'controls fig-motion';
    const btn = document.createElement('button');
    btn.className = 'fig-btn';
    btn.type = 'button';
    btn.textContent = 'Play';
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => {
      if (inst.running) {
        inst.stop();
        btn.textContent = 'Play';
        btn.setAttribute('aria-pressed', 'false');
      } else {
        inst.start();
        btn.textContent = 'Pause';
        btn.setAttribute('aria-pressed', 'true');
      }
    });
    bar.appendChild(btn);
    el.appendChild(bar);
  }

  function initAll() {
    const reduceMotion = window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        const inst = e.target.__figInstance;
        if (!inst) continue;
        try {
          if (e.isIntersecting) inst.start && inst.start();
          else inst.stop && inst.stop();
        } catch (err) { console.error(err); }
      }
    }, { rootMargin: '150px 0px' });

    for (const [id, setup] of registry) {
      const el = document.getElementById(id);
      if (!el) { console.warn('missing figure container:', id); continue; }
      let inst = null;
      try { inst = setup(el, window.FigKit) || {}; }
      catch (err) { console.error('figure "' + id + '" failed to init:', err); continue; }
      el.__figInstance = inst;

      const isLoop = inst && typeof inst.start === 'function' && typeof inst.stop === 'function';
      if (reduceMotion && isLoop) {
        /* Do not auto-start. Render exactly one frame so the figure is not
           blank, then pause and expose a manual Play/Pause affordance. */
        injectPlayPause(el, inst);
        inst.start();
        requestAnimationFrame(() => inst.stop());
      } else {
        io.observe(el);
      }
    }
  }

  document.addEventListener('DOMContentLoaded', initAll);
  return { register };
})();
