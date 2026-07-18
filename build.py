#!/usr/bin/env python3
"""Assemble index.html from template.html + sections/*.html + js/fig-*.js."""
import datetime
import pathlib

SITE_URL = "https://alapidas.github.io/llm-sausage/"

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

lastmod = datetime.date.today().isoformat()
sitemap = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    f'  <url><loc>{SITE_URL}</loc><lastmod>{lastmod}</lastmod></url>\n'
    '</urlset>\n'
)
(root / "sitemap.xml").write_text(sitemap)
print(f"sitemap.xml: 1 url, lastmod {lastmod}")
