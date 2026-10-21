#!/usr/bin/env python3
"""Checks that every sibling site this site links actually answers.

Run by hand: python3 admin/build/check_siblings.py

Deliberately NOT part of the pre-release gate. This site links hosts it does not
control, so wiring their availability into CI would mean a sibling's outage — or a
runner with no egress — turns this repository's build red for a reason nobody
here can fix. A gate should fail for defects its own repository can correct;
everything else is a report.

So this is a report. Run it before a release, paste the result onto the comms
board with its date, and treat a 404 as information about the network rather than
as a defect in this site: a link to a correct hostname that is not yet deployed is
right and early, and removing it would make this site less useful, not more.
"""
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SKIP = {"user.sgit.ai"}
PATTERN = re.compile(r'https://((?:[a-z0-9-]+\.)?sgit\.ai)')


def hosts():
    found = set()
    for p in list(ROOT.rglob("*.html")) + list(ROOT.rglob("*.txt")) + list(ROOT.rglob("*.md")):
        if ".git" in p.parts:
            continue
        found |= set(PATTERN.findall(p.read_text(errors="replace")))
    return sorted(found - SKIP)


def probe(host):
    req = urllib.request.Request(f"https://{host}/", method="HEAD",
                                 headers={"User-Agent": "user.sgit.ai link check"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception as e:                       # DNS, TLS, timeout
        return type(e).__name__


def main():
    bad = 0
    for h in hosts():
        s = probe(h)
        ok = s == 200
        bad += not ok
        print(f"  {'ok ' if ok else '!! '} {h:<26} {s}")
    print(f"check_siblings: {len(hosts()) - bad} of {len(hosts())} answering")
    # exit 0 regardless: this is a report, not a gate. See the docstring.
    return 0


if __name__ == "__main__":
    sys.exit(main())
