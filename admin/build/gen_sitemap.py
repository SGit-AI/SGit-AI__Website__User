#!/usr/bin/env python3
"""Generates sitemap.xml from the file tree.

Run from anywhere: python3 admin/build/gen_sitemap.py

Hand-maintaining a sitemap works while a tree is small and becomes a liability the
moment several pages move at once. Dates come from the last commit that touched
each file, so a page's lastmod is a fact about the page rather than the date of
the build.
"""
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HOST = (ROOT / "CNAME").read_text().strip()
SKIP_DIRS = {".git", ".github", "node_modules", "assets"}
# reading order: the front page, the account model, the workflows, billing, the
# lab, then the evidence and the engineering pages.
ORDER = ["index.html", "account/", "workflows/", "billing/", "lab/", "shipped/",
         "sources/", "network/", "admin/"]


def last_commit(rel):
    r = subprocess.run(["git", "log", "-1", "--format=%ad", "--date=short", "--", rel],
                       cwd=ROOT, capture_output=True, text=True)
    return r.stdout.strip() or subprocess.run(
        ["git", "log", "-1", "--format=%ad", "--date=short"],
        cwd=ROOT, capture_output=True, text=True).stdout.strip() or "2026-10-21"


def rank(rel):
    for i, pre in enumerate(ORDER):
        if rel == pre or rel.startswith(pre):
            return (i, rel)
    return (len(ORDER), rel)


def main():
    pages = sorted({p.relative_to(ROOT).as_posix() for p in ROOT.rglob("*.html")
                    if p.relative_to(ROOT).parts[0] not in SKIP_DIRS}, key=rank)
    rows = "\n".join(
        f"  <url><loc>https://{HOST}/{r}</loc><lastmod>{last_commit(r)}</lastmod></url>"
        for r in pages)
    (ROOT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{rows}\n</urlset>\n")
    print(f"gen_sitemap: {len(pages)} page(s)")


if __name__ == "__main__":
    main()
