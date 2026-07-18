# llm-sausage — section author spec

A long-form interactive explainer in the style of ciechanow.ski (e.g. "Mechanical
Watch"): calm flowing prose punctuated by canvas figures the reader can poke at.
Topic: everything that happens when you interact with Claude Code — from the
keystroke in your terminal, through the API call, into the datacenter, through
transformer inference, and back.

## Files you write (and ONLY these)

- `sections/NN-slug.html` — one `<section>` fragment (no `<html>`/`<head>`/`<body>`).
- `js/fig-*.js` — one file per interactive figure, plain script (no modules,
  no imports, no external libraries, no network requests, no images/fonts).

The build script concatenates `sections/*.html` in filename order into
`index.html` and adds a `<script>` tag for every `js/fig-*.js`. Never touch
`index.html`, `template.html`, `css/style.css`, `js/main.js`, `build.py`, or
another section's files.

## Section fragment shape

```html
<section id="your-assigned-id">
  <h2>Your Assigned Title</h2>
  <p>…flowing prose…</p>
  <div class="figure" id="fig-something"></div>
  <p>…more prose…</p>
</section>
```

- `h3` subheadings are allowed and encouraged for long sections.
- Inline `<code>` for identifiers; `<pre><code>` sparingly for short snippets.
- `.note` paragraphs (`<p class="note">…`) for asides/caveats.

## Figure contract

Each `.figure` div gets a unique `fig-…` id. Its behavior lives in a matching
`js/fig-*.js`:

```js
Figures.register('fig-something', (container, kit) => {
  const cv = kit.makeCanvas(container, { aspect: 0.55 }); // or {height: 320}
  const controls = kit.makeControls(container);
  const speed = kit.makeSlider(controls, { label: 'Speed', min: 0, max: 2,
      value: 1, format: v => v.toFixed(1) + '×', onInput: draw });
  function draw() { const { ctx, w, h } = cv; ctx.clearRect(0, 0, w, h); /* … */ }
  cv.onResize(draw);
  const loop = kit.animLoop((dt, t) => { /* advance state */ draw(); });
  kit.caption(container, 'One-sentence caption of what the figure shows.');
  return loop; // runtime starts/stops it as the figure scrolls in/out of view
});
```

Available on `kit` (see `js/main.js` for exact signatures):
`makeCanvas`, `animLoop`, `makeControls`, `makeSlider`, `makeButton`,
`makeToggle`, `roundedRect`, `arrow`, `caption`, `ease`, `clamp`, `lerp`.
Global `PAL` holds the palette (`PAL.blue`, `PAL.orangeSoft`, `PAL.mono`, …).

Rules:
- Read `js/main.js` and `css/style.css` before writing anything.
- Canvas only for graphics (no SVG, no DOM-heavy scenes) unless the figure is
  fundamentally about text (e.g. an annotated JSON body or a tokenizer input) —
  then clean styled DOM inside the figure div is fine.
- Use ONLY palette colors. White background; soft variants for fills, strong
  variants for strokes/accents; `PAL.ink`/`PAL.faint` for text. Figures must
  look like siblings.
- Every figure works at 320 px wide and at 830 px wide (the container width
  varies; reread `cv.w`/`cv.h` on each draw — never cache layout).
- Every animated figure returns its loop so it pauses off-screen.
- Interactive elements (drag/hover on canvas) should also work with touch
  (pointer events on the canvas; `touch-action: none` is already set).
- Static figures still redraw via `cv.onResize(draw)`.
- Keep each figure self-contained; no shared globals between figures.
- Text inside canvases: `ctx.font = '13px ' + PAL.sans` or `PAL.mono`;
  keep labels ≥ 11px.

## Voice

Ciechanowski's voice: second person plural, patient, concrete, zero hype.
Introduce every figure in the preceding paragraph ("In the demonstration below,
you can drag the slider to…"). Prefer flowing paragraphs over bullet lists.
No emoji, no exclamation marks, no marketing tone. Explain mechanisms, not
vibes. Where internal details of Anthropic's production stack aren't public,
say so plainly and describe how large-scale inference services typically work —
never invent specifics and present them as fact. Technical accuracy beats
completeness: simplify openly ("in reality there are more steps, but…").

Length target per section: 700–1100 words of prose, 2–4 figures.

## Cross-section flow

Sections in order (ids fixed): `your-terminal`, `the-request`,
`into-the-datacenter`, `tokens`, `the-forward-pass`, `the-way-back`.
Each section may end with a one-sentence handoff toward the next topic.
