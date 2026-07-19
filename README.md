# llm-sausage 🌭

**How the Sausage Gets Made** — an interactive, [ciechanow.ski](https://ciechanow.ski/mechanical-watch/)-style
explainer of everything that happens when you talk to Claude Code: from the
keystroke in your terminal, through the HTTPS request, into a datacenter,
through tokenization and transformer inference, and back out one streamed
token at a time.

All graphics are hand-drawn HTML canvas. No frameworks, no build tooling
beyond a tiny concatenation script, no external resources of any kind.

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
build.py          assembles index.html from the above
SPEC.md           the contract each section/figure was written against
```

## Rebuilding

```sh
python3 build.py
```

Figures register themselves via `Figures.register(id, setup)` and are
started/stopped by an `IntersectionObserver`, so off-screen animations
cost nothing.
