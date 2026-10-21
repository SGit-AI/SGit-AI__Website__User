# users.sgit.ai, the account is a vault, and the user holds it

> No sign-in to the site, no account database, no server of ours that can read a
> thing. A passkey opens a door, the door opens a master, the master holds the
> keys. The user's browser keeps the record of what they did and the meter of
> what it cost, and both travel with them.

The client-side user workflows of the sgit.ai network, collected on one site:
the account with no server, the ten workflows a user runs in their browser as
they are built on newsroom.sgit.ai, the billing design that follows ("the user
keeps the meter"), and a lab that derives a door from a passkey on this origin
with nothing sent to any server.

Live site: https://users.sgit.ai (GitHub Pages). Nothing on it runs on a server
of ours; the workflows that run today run on https://newsroom.sgit.ai.

## Structure

- `index.html` / `index.md`: the front page and its markdown twin
- `account/`: the model (door, master, vaults), the derivation, keys and parties
- `workflows/`: the ten client-side user workflows, each with a status
- `billing/`: the user keeps the meter, as the proposal it is
- `lab/`: six cards, and `vectors.json` from the newsroom
- `shipped/`: what is built, lab-proven, designed, proposed; what this site does
- `sources/`: every article, note and guidance page this site is drawn from
- `network/`: the siblings, and where this site sits
- `admin/`: comms, release history, build tooling
- `admin/build/chrome.py`: the single definition of nav, footer and version badge
- `admin/build/validate.js`: the pre-release gate
- `admin/build/test_door.mjs`: the derivation checked against sgit's Python
- `assets/site.css`: the shared stylesheet (sgit.ai design language)
- `assets/door.js`: the door derivation, vendored from the newsroom
- `assets/lab.js`: the lab

## The rule this site keeps

No script or stylesheet on this origin is loaded from any other origin, on any
page. Browser storage is per origin, and this is the origin that may one day
hold the door to a user's master vault. The gate fails the build otherwise.

## Release process

1. Bump `admin/build/version.txt` (vX.Y.Z, exactly once per release) and add a
   row to `admin/versions.html`; update `admin/comms.html` if the state of play
   changed.
2. `python3 admin/build/chrome.py`: propagates the version badge and any
   nav/footer change to every page, and stamps the version into `llms.txt`,
   `llms-full.txt` and `index.md`.
3. `python3 admin/build/gen_sitemap.py && python3 admin/build/gen_llms_full.py`
4. `node admin/build/validate.js && node admin/build/test_door.mjs`
5. `git commit -am "site vX.Y.Z: ..."` and push to the release branch.

Every push to `dev` (or `main`) runs `.github/workflows/deploy-pages.yml`:
validate, auto-tag (`vX.Y.Z`, verified against `version.txt` and the commit
subject), deploy to GitHub Pages. Pull requests run validation only. The same
pipeline as the sibling sites.

All content CC BY 4.0 unless noted. Code under the repository licence.
