#!/usr/bin/env python3
"""Assemble index.html from template.html + sections/*.html + js/fig-*.js."""
import pathlib

root = pathlib.Path(__file__).parent
template = (root / "template.html").read_text()

sections = "\n\n".join(
    p.read_text().strip() for p in sorted((root / "sections").glob("*.html"))
)
scripts = "\n".join(
    f'<script src="js/{p.name}"></script>'
    for p in sorted((root / "js").glob("fig-*.js"))
)

out = template.replace("<!--SECTIONS-->", sections).replace("<!--FIGSCRIPTS-->", scripts)
(root / "index.html").write_text(out)
print(f"index.html: {len(out):,} bytes, "
      f"{len(list((root / 'sections').glob('*.html')))} sections, "
      f"{len(list((root / 'js').glob('fig-*.js')))} figure scripts")
