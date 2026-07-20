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
SPEC.md           the contract each section/figure was written against
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
