#!/usr/bin/env python3
"""The single definition of this site's nav and footer, and the tool that applies it.

Run from anywhere: python3 admin/build/chrome.py

Every page is hand-written static HTML, and that stays true: a human should be able
to open any file and edit it. What is NOT hand-maintained is the chrome: the nav row
(including the version badge that validate.js requires to agree everywhere) and the
footer columns. Those are defined once here and rewritten in place across the tree,
which is what stops a many-page site from drifting.

Adding a page: add it to NAV or FOOTER if it belongs there, write the file with an
empty <nav class="site"></nav> and <footer class="site"></footer>, then run this.
The block contents are replaced; the `here` state is set from the page's own path.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VERSION = (ROOT / "admin/build/version.txt").read_text().strip()
GH = "https://github.com/SGit-AI/SGit-AI__Website__User"
PARENT = "https://sgit.ai"
PARENT_TITLE = ("sgit.ai, the parent project: the vault layer and CLI every workflow on "
                "this site runs on, and the network this site is a member of")

# The nav, two levels. Each entry is (label, own page, [(sub-label, href), ...], prefixes).
#   · A group label is always a link to a real page, never a menu-only stub.
#   · `prefixes` decides the "here" state, so a page that is not itself in the nav
#     still lights up the group it belongs to.
NAV = [
    ("The account", "account/index.html", [
        ("&#9679; The model: door, master, vaults", "account/index.html"),
        ("The derivation", "account/index.html#derivation"),
        ("Keys and parties", "account/index.html#parties"),
        ("Security, said plainly", "account/index.html#security"),
    ], ("account/",)),
    ("The workflows", "workflows/index.html", [
        ("&#9679; Ten client-side workflows", "workflows/index.html"),
        ("Sign in where you already are", "workflows/index.html#w1"),
        ("Open, or connect", "workflows/index.html#w3"),
        ("Credit now, validated later", "workflows/index.html#w7"),
        ("Across sites", "workflows/index.html#w9"),
    ], ("workflows/",)),
    ("Billing", "billing/index.html", [
        ("&#9679; The user keeps the meter", "billing/index.html"),
        ("Two writers, two keys", "billing/index.html#writers"),
        ("The one server left", "billing/index.html#server"),
        ("Open questions", "billing/index.html#open"),
    ], ("billing/",)),
    ("The lab", "lab/index.html", [
        ("&#9679; Passkey to door, on this origin", "lab/index.html"),
        ("What it does not do", "lab/index.html#not"),
    ], ("lab/",)),
    ("Site", "shipped/index.html", [
        ("What this site ships", "shipped/index.html"),
        ("The sources", "sources/index.html"),
        ("The network", "network/index.html"),
        ("Comms: tasks &amp; requests", "admin/comms.html"),
        ("Release history", "admin/versions.html"),
        ("Admin &amp; engineering", "admin/index.html"),
    ], ("shipped/", "sources/", "network/", "admin/")),
]

FOOTER = [
    ("The account", [
        ("&#9679; The model", "account/index.html"),
        ("The derivation", "account/index.html#derivation"),
        ("Keys and parties", "account/index.html#parties"),
    ]),
    ("The workflows", [
        ("Ten client-side workflows", "workflows/index.html"),
        ("Billing: the user keeps the meter", "billing/index.html"),
        ("The lab", "lab/index.html"),
    ]),
    ("Evidence", [
        ("What this site ships", "shipped/index.html"),
        ("The sources", "sources/index.html"),
        ("The network", "network/index.html"),
    ]),
    ("Site", [
        ("Comms: tasks &amp; requests", "admin/comms.html"),
        ("Release history", "admin/versions.html"),
        ("Admin &amp; engineering", "admin/index.html"),
        ("llms.txt", "llms.txt"),
        ("llms-full.txt", "llms-full.txt"),
    ]),
]

BLURB = ("The account is a vault, and the user holds it: a passkey opens a door, the door "
         "opens a master, the master holds the keys, and the user's browser keeps the record "
         "and the meter. No sign-in to the site, no account database, no server of ours that "
         "can read a thing. CC BY 4.0, part of the "
         "<a href=\"https://sgit.ai\" style=\"display:inline;padding:0\"><b>sgit.ai</b></a> "
         "network.")
PARTNOTE = ('&#9888; Nothing on this site runs on a server of ours, and nothing here is a '
            'live account. The workflows that run today run on newsroom.sgit.ai; the billing '
            'design is a proposal. <a href="{up}shipped/index.html" '
            'style="display:inline;padding:0">What is built, and what is still proposed</a>.')
PARTNOTE_SELF = ('&#9888; Nothing on this site runs on a server of ours. You are on the page '
                 'that states what is built versus proposed.')
NETLINE = ('<a href="https://sgit.ai"><b>&#8599; sgit.ai</b></a>, the parent project · '
           '<a href="https://newsroom.sgit.ai">&#8599; newsroom.sgit.ai</a>, where the workflows run · '
           '<a href="https://pki.sgit.ai">&#8599; pki.sgit.ai</a>, the key register · '
           '<a href="https://secrets.sgit.ai">&#8599; secrets.sgit.ai</a>, secrets on public keys · '
           '<a href="https://sgit.ai/network/index.html">&#8599; the network</a>')


def nav_html(rel, up):
    groups = []
    for label, own, subs, prefixes in NAV:
        active = rel == own or any(rel.startswith(pre) for pre in prefixes)
        links = "\n".join(
            f'      <a class="sl{" here" if href.split("#")[0] == rel else ""}" href="{up}{href}">{text}</a>'
            for text, href in subs)
        groups.append(
            f'    <div class="ni ni-has">\n'
            f'      <a class="nl{" here" if active else ""}" href="{up}{own}">{label}'
            f'<span class="caret">&#9662;</span></a>\n'
            f'      <div class="sub">\n{links}\n      </div>\n'
            f'    </div>')
    rows = "\n".join(groups)
    return (f'<nav class="site"><div class="row">\n'
            f'  <a class="brand" href="{up}index.html">user<span>.sgit.ai</span></a>\n'
            f'  <a class="parent" href="{PARENT}" title="{PARENT_TITLE}">&#8599; part of <b>sgit.ai</b></a>\n'
            f'  <span class="stage-pill">client side, by design</span>\n'
            f'  <a class="ver" href="{up}admin/versions.html" title="Site release history">{VERSION}</a>\n'
            f'  <button class="nav-toggle" type="button" aria-expanded="false" aria-label="Menu">Menu</button>\n'
            f'  <div class="nav-items">\n{rows}\n  </div>\n'
            f'  <a class="gh" href="{GH}">&#9733; GitHub</a>\n'
            f'  <script src="{up}assets/nav.js" defer></script>\n'
            f'</div></nav>')


def footer_html(rel, up):
    partnote = PARTNOTE_SELF if rel == "shipped/index.html" else PARTNOTE.format(up=up)
    md_twin = f' · <a href="{up}index.md">this page as markdown</a>' if rel == "index.html" else ""
    cols = "\n".join(
        "  <div>\n"
        f"    <h4>{head}</h4>\n"
        + "\n".join(f'    <a href="{l if l.startswith("http") else up + l}">{t}</a>' for t, l in links)
        + "\n  </div>"
        for head, links in FOOTER)
    return (f'<footer class="site"><div class="cols">\n'
            f'  <div>\n'
            f'    <div class="brandline">user<span>.sgit.ai</span></div>\n'
            f'    <p>{BLURB}</p>\n'
            f'    <p class="netline">{NETLINE}</p>\n'
            f'    <p class="partnote">{partnote}</p>\n'
            f'    <p class="verline">site <a href="{up}admin/versions.html">{VERSION}</a> · '
            f'<a href="{up}admin/index.html">engineering</a>{md_twin}</p>\n'
            f'  </div>\n{cols}\n</div></footer>')


def stamp_text_twins():
    """The version also appears in llms.txt, llms-full.txt and index.md, and
    validate.js enforces that it agrees. Own it here rather than by hand."""
    out = []
    for name, pattern, repl in (
            ("llms.txt", r"Site version: v\d+\.\d+\.\d+", f"Site version: {VERSION}"),
            ("llms-full.txt", r"Site version: v\d+\.\d+\.\d+", f"Site version: {VERSION}"),
            ("index.md", r"· site v\d+\.\d+\.\d+ ·", f"· site {VERSION} ·")):
        p = ROOT / name
        if not p.exists():
            continue
        t = p.read_text()
        t2, n = re.subn(pattern, repl, t, count=1)
        if n and t2 != t:
            p.write_text(t2)
            out.append(name)
    return out


def main():
    changed = []
    for path in sorted(ROOT.rglob("*.html")):
        if ".git" in path.parts:
            continue
        rel = path.relative_to(ROOT).as_posix()
        up = "../" * (len(path.relative_to(ROOT).parts) - 1)
        text = path.read_text()
        before = text
        text, n_nav = re.subn(r'<nav class="site">.*?</nav>', lambda _: nav_html(rel, up),
                              text, count=1, flags=re.S)
        text, n_foot = re.subn(r'<footer class="site">.*?</footer>', lambda _: footer_html(rel, up),
                               text, count=1, flags=re.S)
        if not n_nav or not n_foot:
            print(f"  ! {rel}: missing {'nav' if not n_nav else ''}"
                  f"{' and ' if not n_nav and not n_foot else ''}"
                  f"{'footer' if not n_foot else ''} block", file=sys.stderr)
        if text != before:
            path.write_text(text)
            changed.append(rel)
    changed += stamp_text_twins()
    print(f"chrome: {VERSION} applied, {len(changed)} file(s) updated")
    for c in changed:
        print(f"  · {c}")


if __name__ == "__main__":
    try:
        main()
    except BrokenPipeError:
        sys.stdout = None
