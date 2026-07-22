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
- Every figure is **level-aware**: call `kit.level()` at setup — it returns
  `'novice'`, `'mid'`, or `'deep'` — and render a tier-appropriate figure.
  The runtime re-runs the whole setup function whenever the reader switches
  levels, so branch freely at setup time; there is no need to react to
  changes mid-flight.
  - `novice`: the one core idea only. Fewer elements and lanes, larger and
    plainer labels (no jargon), at most one control, gentler pacing, a
    plain-language caption. Prefer a self-running story over knobs.
  - `mid`: the standard figure (this is the default and must keep the
    original behavior exactly).
  - `deep`: the mid figure plus real added fidelity — precise labels,
    numeric readouts, an extra control or toggle where it earns its place.
    Deep is more specific, not merely busier.
  - Captions may differ per level; each level's caption must describe what
    that level's figure actually shows.
- Canvas only for graphics (no SVG, no DOM-heavy scenes) unless the figure is
  fundamentally about text (e.g. an annotated JSON body or a tokenizer input) —
  then clean styled DOM inside the figure div is fine.
- Use ONLY palette colors. Soft variants for fills, strong variants for
  strokes/accents; `PAL.ink`/`PAL.faint` for text. Figures must look like
  siblings.
- The page has a light and a dark theme. Never test the theme in a figure and
  never hardcode a color: `PAL` is swapped in place and every figure is
  rebuilt when the theme changes, so anything expressed via `PAL` follows
  automatically. In particular:
  - `PAL.bg` is the page/canvas background — white in light, near-black in
    dark. Use it for halos and knockouts, never as a text color on a light
    fill.
  - `PAL.ink`/`inkStrong`/`faint` are TEXT colors and invert between themes.
    Never use them as a large slab fill: `inkStrong` is near-black in light
    but near-white in dark, which inverts the whole element.
  - Text sitting ON a strong accent fill should be `PAL.bg`; text on the
    background or on a soft fill should be `PAL.ink`/`inkStrong`.
  - For a terminal/screen slab — dark in BOTH themes — use `PAL.panel` with
    `PAL.panelInk` text and a `PAL.panelEdge` hairline. Accent colors keep
    their contrast on it in either theme.
- Every figure works at 320 px wide and at 830 px wide (the container width
  varies; reread `cv.w`/`cv.h` on each draw — never cache layout).
- Every animated figure returns its loop so it pauses off-screen.
- Interactive elements (drag/hover on canvas) should also work with touch
  (pointer events on the canvas; `touch-action: none` is already set).
- Static figures still redraw via `cv.onResize(draw)`.
- Keep each figure self-contained; no shared globals between figures.
- Text inside canvases: `ctx.font = '13px ' + PAL.sans` or `PAL.mono`;
  keep labels ≥ 11px.

## Reading levels

The page opens with a three-way reading-level chooser (Newcomer /
Practitioner / Deep dive). Every section provides all three tiers of prose;
the runtime shows exactly one tier at a time.

- The `h2` stays outside the tier wrappers — it is shared by all tiers.
- All other prose (including `h3` subheadings and `.note` asides) lives
  inside tier wrapper divs, in this order at each slot:
  `<div class="lv lv-novice">…</div>`, `<div class="lv lv-mid">…</div>`,
  `<div class="lv lv-deep">…</div>`.
- Figure divs are shared: each `.figure` appears exactly once, outside the
  wrappers, at the same story beat for every tier. A section is therefore a
  sequence of slots — three sibling wrapper divs, then a shared figure —
  repeated, with a final prose slot after the last figure.
- A reader only ever sees their own tier, so every tier must introduce every
  figure in its own paragraph immediately before the figure, and every tier
  must read as a complete, self-contained piece (including its own
  one-sentence handoff to the next section).
- Figures are level-aware (see the figure contract above): the same figure
  div renders a simpler figure for `lv-novice` readers and a richer one for
  `lv-deep` readers. Each tier's prose must describe its own tier's figure —
  never mention a control or element the figure doesn't show at that level.
- Tier audiences and prose length per section:
  - `lv-novice` — has never used a terminal or an LLM beyond chat. Plain
    language, every concept built from scratch, no unexplained jargon.
    ~200–350 words.
  - `lv-mid` — uses Claude Code daily but the internals are a black box.
    ~450–700 words.
  - `lv-deep` — wants the machinery: named protocols and flags, real math,
    memory arithmetic. ~650–950 words. Simplifications the other tiers make
    silently should here be made explicitly and then unpacked.
- Economy over completeness: every sentence must either advance the
  mechanism or introduce a figure. No throat-clearing, no restating what a
  figure shows, no saying a thing twice in different words. The figures do
  the talking; prose connects them.

## Voice

Ciechanowski's voice: second person plural, patient, concrete, zero hype.
Introduce every figure in the preceding paragraph ("In the demonstration below,
you can drag the slider to…"). Prefer flowing paragraphs over bullet lists.
No emoji, no exclamation marks, no marketing tone. Explain mechanisms, not
vibes. Where internal details of Anthropic's production stack aren't public,
say so plainly and describe how large-scale inference services typically work —
never invent specifics and present them as fact. Technical accuracy beats
completeness: simplify openly ("in reality there are more steps, but…").

Length target per section: see the per-tier bands under Reading levels;
2–4 figures.

## Cross-section flow

Sections in order (ids fixed): `your-terminal`, `the-request`,
`into-the-datacenter`, `tokens`, `the-forward-pass`, `the-way-back`.
Each section may end with a one-sentence handoff toward the next topic.
