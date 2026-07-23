# llm-sausage 🌭

**How the Sausage Gets Made** — an interactive, [ciechanow.ski](https://ciechanow.ski/mechanical-watch/)-style
explainer of everything that happens when you talk to Claude Code: from the
keystroke in your terminal, through the HTTPS request, into a datacenter,
through tokenization and transformer inference, and back out one streamed
token at a time.

Every figure is hand-built with HTML canvas and DOM. No frameworks, and no
build tooling beyond a tiny concatenation script. The only third-party
resource on the page is a cookie-less Cloudflare Web Analytics beacon that
counts visits; nothing else is loaded from off-site.

## Viewing

The live site is at **<https://alapidas.github.io/llm-sausage/>**.

To run it locally, open `index.html` in a browser, or serve the directory:

```sh
python3 -m http.server 8000
# → http://localhost:8000
```

## Structure

```
index.html        built page (do not edit by hand)
template.html     page shell: hero, table of contents, footer
sections/*.html   one fragment per chapter, concatenated in filename order
js/main.js        figure runtime + shared canvas/control helpers (FigKit)
js/fig-*.js       one file per interactive figure
css/style.css     the entire design system
build.py          assembles index.html (and sitemap.xml) from the above
sitemap.xml       generated sitemap (do not edit by hand)
robots.txt        crawler directives + sitemap pointer
og.png            1200×630 social-share card
favicon.png       browser-tab icon (PNG fallback; an inline SVG is primary)
SPEC.md           the contract each section/figure was written against
LICENSE           MIT
```

## Rebuilding

```sh
python3 build.py
```

`build.py` also regenerates `sitemap.xml`, deriving its `<lastmod>` from the
date of the last commit touching page content (`template.html`, `sections/`,
`js/`, `css/`). Re-running the build on an unchanged tree therefore produces
no diff.

Figures register themselves via `Figures.register(id, setup)` and are
started/stopped by an `IntersectionObserver`, so off-screen animations
cost nothing.

## Design

The page is set as a printed feature: a serif text face on warm paper, roman
chapter numerals, a drop cap opening each chapter, and figures numbered as
plates (`Fig. 4 — …`). Controls stay in a sans face so they read as apparatus
beside a plate rather than as part of the article. Nothing is fetched — the
serif stack in `--serif` is whatever system font the reader already has.

Color lives in exactly one place. `css/style.css` declares every hue as a
custom property, and `js/main.js` reads those properties into `PAL` at draw
time, so the canvases follow the stylesheet automatically and a color only
ever needs changing once. The `PAL_LIGHT` / `PAL_DARK` objects in `main.js`
are fallbacks for the case where a property is missing, and should be kept in
sync when the palette changes.

Both themes are complete: light is the default, dark follows the system until
the reader clicks the toggle in the byline, and printing forces the light
palette (`js/main.js` repaints the canvases to match on `beforeprint`).
