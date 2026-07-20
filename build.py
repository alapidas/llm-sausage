#!/usr/bin/env python3
"""Assemble index.html from template.html + sections/*.html + js/fig-*.js."""
import datetime
import pathlib
import re
import subprocess

SITE_URL = "https://alapidas.github.io/llm-sausage/"

root = pathlib.Path(__file__).parent
template = (root / "template.html").read_text()

section_paths = sorted((root / "sections").glob("*.html"))
if not section_paths:
    raise SystemExit("build.py: no sections/*.html found — nothing to build")

script_paths = sorted((root / "js").glob("fig-*.js"))

sections = "\n\n".join(p.read_text().strip() for p in section_paths)
scripts = "\n".join(
    f'<script defer src="js/{p.name}"></script>' for p in script_paths
)

# Cross-check figure scripts against figure divs so an orphan fails the build.
fig_ids = set(re.findall(r'id="(fig-[\w-]+)"', sections))
fig_js = {p.stem for p in script_paths}
missing_js = fig_ids - fig_js
missing_div = fig_js - fig_ids
if missing_js or missing_div:
    problems = []
    if missing_js:
        problems.append(f"figure divs with no js/*.js: {sorted(missing_js)}")
    if missing_div:
        problems.append(f"js/fig-*.js with no matching div: {sorted(missing_div)}")
    raise SystemExit("build.py: figure mismatch — " + "; ".join(problems))

# Each template marker must occur exactly once, or replace() would silently
# no-op and ship a hollow page.
for marker in ("<!--SECTIONS-->", "<!--FIGSCRIPTS-->"):
    n = template.count(marker)
    if n != 1:
        raise SystemExit(f"build.py: marker {marker} occurs {n} times (expected 1)")

out = template.replace("<!--SECTIONS-->", sections).replace("<!--FIGSCRIPTS-->", scripts)
(root / "index.html").write_text(out)
print(f"index.html: {len(out):,} bytes, "
      f"{len(section_paths)} sections, {len(script_paths)} figure scripts")


def content_lastmod():
    """Date of the last commit touching page content, so re-running build.py
    on an unchanged tree does not churn sitemap.xml. Falls back to today."""
    try:
        out = subprocess.run(
            ["git", "log", "-1", "--format=%cs", "--",
             "template.html", "sections", "js", "css"],
            cwd=root, capture_output=True, text=True, check=True,
        ).stdout.strip()
        if out:
            return out
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
    return datetime.date.today().isoformat()


lastmod = content_lastmod()
sitemap = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    f'  <url><loc>{SITE_URL}</loc><lastmod>{lastmod}</lastmod></url>\n'
    '</urlset>\n'
)
(root / "sitemap.xml").write_text(sitemap)
print(f"sitemap.xml: 1 url, lastmod {lastmod}")
