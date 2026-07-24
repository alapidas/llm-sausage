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

/* ---------------- palette ----------------
   Two themes. Figures read PAL at draw time and are rebuilt on a theme
   change, so swapping these values in place repaints every canvas.
   The `*Dark` entries mean "the stronger stroke version of this hue": on a
   white page that is a darker shade, on a dark page a lighter one.
   Keep in sync with the CSS custom properties in css/style.css. */
const PAL_LIGHT = {
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
  /* Terminal/screen slab. Stays dark in BOTH themes — a terminal is dark
     even on a dark page — so accents drawn on it keep their contrast.
     `panelEdge` matches the slab in light (invisible) and outlines it in
     dark, where the slab alone would blend into the page. */
  panel:     '#24272c',
  panelInk:  '#f2f3f5',
  panelEdge: '#24272c',
};

const PAL_DARK = {
  ink:      '#c3c9d1',
  inkStrong:'#e9edf2',
  faint:    '#8d959f',
  grid:     '#2f343b',
  bg:       '#181b1f',
  blue:     '#6aa9e8',
  blueDark: '#9ecbf5',
  orange:   '#efa066',
  orangeDark: '#f5c091',
  green:    '#6fbf85',
  greenDark: '#98d5a9',
  red:      '#e08381',
  redDark:  '#eda3a2',
  purple:   '#a598d1',
  yellow:   '#e5c163',
  teal:     '#5ec8be',
  blueSoft:   '#1d2f42',
  orangeSoft: '#382a1d',
  greenSoft:  '#1e3326',
  redSoft:    '#392426',
  purpleSoft: '#2b2740',
  graySoft:   '#23272d',
  panel:     '#101216',
  panelInk:  '#e9edf2',
  panelEdge: '#343b44',
};

window.PAL = {
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

/* Mutate PAL in place so figures holding a reference see the new colors. */
window.applyPalette = theme => {
  Object.assign(window.PAL, theme === 'dark' ? PAL_DARK : PAL_LIGHT);
};

/* Effective theme: an explicit choice wins, otherwise follow the system. */
window.currentTheme = () => {
  const t = document.documentElement.getAttribute('data-theme');
  if (t === 'dark' || t === 'light') return t;
  return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
    ? 'dark' : 'light';
};

window.applyPalette(window.currentTheme());

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

  /* Current reading level ('novice' | 'mid' | 'deep'). Figures read this at
     setup and render a tier-appropriate version of themselves; the runtime
     re-runs every figure's setup when the reader switches levels. */
  kit.level = () => {
    const l = document.documentElement.getAttribute('data-level');
    return (l === 'novice' || l === 'deep') ? l : 'mid';
  };

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

  let io = null;
  let reduceMotion = false;

  function initOne(id, setup) {
    const el = document.getElementById(id);
    if (!el) { console.warn('missing figure container:', id); return; }

    /* Teardown a previous instance (re-init on reading-level switch). */
    if (el.__figInstance) {
      try { el.__figInstance.stop && el.__figInstance.stop(); }
      catch (err) { console.error(err); }
      io.unobserve(el);
      el.__figInstance = null;
      el.innerHTML = '';
    }

    let inst = null;
    try { inst = setup(el, window.FigKit) || {}; }
    catch (err) { console.error('figure "' + id + '" failed to init:', err); return; }
    el.__figInstance = inst;

    const isLoop = inst && typeof inst.start === 'function' && typeof inst.stop === 'function';
    if (reduceMotion && isLoop) {
      /* Do not auto-start. Render exactly one frame so the figure is not
         blank, then pause and expose a manual Play/Pause affordance. */
      injectPlayPause(el, inst);
      inst.start();
      requestAnimationFrame(() => inst.stop());
    } else {
      /* observe() always delivers a fresh entry, so a currently-visible
         figure starts again immediately after a re-init. */
      io.observe(el);
    }
  }

  function initAll() {
    reduceMotion = window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    io = new IntersectionObserver(entries => {
      for (const e of entries) {
        const inst = e.target.__figInstance;
        if (!inst) continue;
        try {
          if (e.isIntersecting) inst.start && inst.start();
          else inst.stop && inst.stop();
        } catch (err) { console.error(err); }
      }
    }, { rootMargin: '150px 0px' });

    for (const [id, setup] of registry) initOne(id, setup);
  }

  /* Rebuild every figure for the current reading level. */
  function reinit() {
    if (!io) return;
    for (const [id, setup] of registry) initOne(id, setup);
  }

  document.addEventListener('DOMContentLoaded', initAll);
  return { register, reinit };
})();

/* ---------------- reading level ---------------- */
/* The inline head script has already set html[data-level] from localStorage,
   or html.gate when nothing is saved (first visit — chooser cards shown,
   article hidden). This wires the cards and the "Reading as … change" line. */
(() => {
  const NAMES = { novice: 'Newcomer', mid: 'Practitioner', deep: 'Deep dive' };

  function init() {
    const html = document.documentElement;
    const gate = document.getElementById('level-gate');
    const nameEl = document.getElementById('level-status-name');
    const changeBtn = document.getElementById('level-change');
    if (!gate || !nameEl || !changeBtn) return;

    function apply(level) {
      const prev = html.getAttribute('data-level');
      html.setAttribute('data-level', level);
      html.classList.remove('gate');
      nameEl.textContent = NAMES[level];
      try { localStorage.setItem('sausage-level', level); } catch (e) { /* private mode etc. */ }
      /* Figures render differently per level; rebuild them on a real change
         (and on the first pick, when setup ran behind the hidden gate). */
      if (prev !== level && window.Figures && window.Figures.reinit) {
        window.Figures.reinit();
      }
    }

    gate.querySelectorAll('.level-card').forEach(btn => {
      btn.addEventListener('click', () => apply(btn.dataset.level));
    });

    changeBtn.addEventListener('click', () => {
      html.classList.add('gate');
      const first = gate.querySelector('.level-card');
      if (first) first.focus();
    });

    const cur = html.getAttribute('data-level');
    if (cur && NAMES[cur]) nameEl.textContent = NAMES[cur];
  }

  document.addEventListener('DOMContentLoaded', init);
})();

/* ---------------- reading length ---------------- */
/* The inline head script has already set html[data-length] (default 'long').
   This wires the segmented Short / Medium / Long control and rebuilds figures,
   whose visibility — and level-appropriate layout — depends on the length. */
(() => {
  function init() {
    const html = document.documentElement;
    const btns = document.querySelectorAll('.len-btn');
    if (!btns.length) return;

    function apply(length) {
      if (length !== 'short' && length !== 'medium' && length !== 'long') return;
      const prev = html.getAttribute('data-length');
      html.setAttribute('data-length', length);
      try { localStorage.setItem('sausage-length', length); } catch (e) { /* private mode etc. */ }
      btns.forEach(b => b.setAttribute('aria-pressed', b.dataset.length === length ? 'true' : 'false'));
      /* Which figures are shown, and their level-aware layout, both depend on
         length, so rebuild the figures on a real change. */
      if (prev !== length && window.Figures && window.Figures.reinit) {
        window.Figures.reinit();
      }
    }

    btns.forEach(b => b.addEventListener('click', () => apply(b.dataset.length)));

    const cur = html.getAttribute('data-length') || 'long';
    btns.forEach(b => b.setAttribute('aria-pressed', b.dataset.length === cur ? 'true' : 'false'));
  }

  document.addEventListener('DOMContentLoaded', init);
})();

/* ---------------- theme ---------------- */
/* The inline head script has already set html[data-theme] from localStorage
   when the reader made an explicit choice; with no choice stored, the CSS
   media query follows the system. This wires the toggle and repaints the
   figures, whose colors are baked in at draw time. */
(() => {
  function init() {
    const html = document.documentElement;
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

    function repaint() {
      const theme = window.currentTheme();
      window.applyPalette(theme);
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      btn.title = theme === 'dark' ? 'Switch to light' : 'Switch to dark';
      if (window.Figures && window.Figures.reinit) window.Figures.reinit();
    }

    btn.addEventListener('click', () => {
      const next = window.currentTheme() === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      try { localStorage.setItem('sausage-theme', next); } catch (e) { /* private mode etc. */ }
      repaint();
    });

    /* Follow the system while the reader has not chosen explicitly. */
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => { if (!html.hasAttribute('data-theme')) repaint(); };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }

    /* Print stylesheet forces light; repaint the canvases to match. */
    window.addEventListener('beforeprint', () => {
      window.applyPalette('light');
      if (window.Figures && window.Figures.reinit) window.Figures.reinit();
    });
    window.addEventListener('afterprint', repaint);

    const theme = window.currentTheme();
    btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    btn.title = theme === 'dark' ? 'Switch to light' : 'Switch to dark';
  }

  document.addEventListener('DOMContentLoaded', init);
})();
