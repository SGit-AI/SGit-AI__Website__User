# user.sgit.ai, the account is a vault, and the user holds it

> No sign-in to the site, no account database, no server of ours that can read a thing. A passkey opens a door, the door opens a master, the master holds the keys. The user's browser keeps the record of what they did and the meter of what it cost, and both travel with them.

*Source: <https://user.sgit.ai/index.html> · site v0.1.1 · this file is the front page's markdown twin. The site index for agents is [llms.txt](llms.txt); the whole site in one fetch is [llms-full.txt](llms-full.txt).*

---

This site collects the client-side user workflows of the sgit.ai network as they stand on 21 October 2026: what runs today on newsroom.sgit.ai, what is designed, what is proposed, and what is still open.

> "Billing is usually a server problem: a server, a database, a balance every action has to update, race conditions, and either a bottleneck or a scheduler to keep it all in step. This is an exploration of doing it the other way round, on the client, with vaults." From *The user keeps the meter*, newsroom.sgit.ai, 21 October 2026, the article that proposes this site.

## Where each piece stands

| The piece | Status | Where |
|---|---|---|
| A passkey opens a door, the door opens the master, the master opens the reader vault | runs, beta | The vault pane on every newsroom page, since v0.11.0; the passkey lab |
| A recovery code as a second door, shown once | runs, beta | The vault pane |
| Two ways in: open with the passkey, or connect with a link that only sends | runs, beta | newsroom v0.12.58 |
| One file per device, totals recomputed from the records, devices merged with aliases | runs, beta | newsroom v0.12.88 |
| A reading meter charged by what is read, credit that can go below zero, nothing blocked | runs | SG Meter v1.5 on every newsroom article |
| A top-up with a payment link, credited on return | runs | Live on the newsroom since 11 October 2026 |
| Adding a door for a second path, with no key passing through a person | lab-proven step | One door created, opened and deleted on a real vault server |
| Key pairs in the master, random, never derived from the passkey | designed | The passkey article's brief for the MVP, step 5 |
| Rotating the master's key after a lost device | designed | Named as not built wherever it is mentioned |
| One billing vault per user, written by two signed parties | proposed | /billing/ |
| An admin vault reconciling payments with Stripe, from a browser | proposed | /billing/ |
| A credits API and one light check at the upload server | proposed | /billing/ |
| One account across every *.sgit.ai site | later, two ways named | /workflows/ (9) |
| Messages between vaults, on append lanes and PKI | proposed; the transport exists | /workflows/ (10) |
| A temporary AWS session kept in the user's vault | proposed | /workflows/ (10) |
| user.sgit.ai itself | v0.1.0 | Publishes the design; runs nothing on a server. The lab derives a door on this origin and writes nowhere |

## Ten client-side user workflows

1. [Sign in where you already are](workflows/index.html#w1), runs. The passkey lives in the store you already use. One gesture gives 32 bytes; the bytes give a door; the door holds the master's key.
2. [The first device: create the account](workflows/index.html#w2), runs. Paste the access key once. The door, the master, the reader vault and the recovery door are made; the code is shown once.
3. [Open, or connect](workflows/index.html#w3), runs. Open the vault with the passkey and read and write; or connect with a link and only send, into an inbox lane.
4. [Which device is this?](workflows/index.html#w4), runs. Asked once, after the open. Adopt a device the vault knows, or be a new one. Devices can be merged.
5. [Update the vault, bring them here](workflows/index.html#w5), runs. One file per device, rewritten whole, one commit. Both directions counted; totals recomputed from the records.
6. [Read, and pay for what you read](workflows/index.html#w6), runs. £5 to start, a few pence a page by how much of it was read, pause and reset, a balance that can go below zero.
7. [Top up: credit now, validated later](workflows/index.html#w7), runs, then proposed. Pay on Stripe's page, come back, carry on. A signed claim now; a signed validation from the admin side later.
8. [A new path, a lost device](workflows/index.html#w8), designed. "No door here yet" is not an error. Add a door from an open device or the recovery code; retire one by deleting its file.
9. [Across sites](workflows/index.html#w9), later. The master already lists keys by site and purpose. A key hub, or related origins: two ways for one account to travel.
10. [Agents, messages and sessions](workflows/index.html#w10), mixed. An agent gets a read key for one vault, never the master. Messages ride append lanes. An AWS session lives in a vault for an hour.

## Four parties, each with its own key

- **The user** commits their own activity, and owns the record of it.
- **The admin vault** writes the validations, collects the usage, and reconciles payments with Stripe, from the admin's browser.
- **The upload server** is the inline billing unit: is the key valid, is there credit? It computes no balance and keeps no database.
- **The credits API** is a simple read of the signed credit, cached, with an end date.

## The rules this origin keeps

1. **No third-party script, on any page.** Enforced by the pre-release gate.
2. **The relying party is this host, exactly.** A passkey for user.sgit.ai, never for sgit.ai.
3. **Read keys are printed; vault keys never are.** The gate greps the tree for key shapes.
4. **Local storage stays primary; the vault is a copy the user keeps current.** Nothing commits on its own.
5. **Records, never totals.** Balance is recomputed every time it is shown.

Pages: [the account model](account/index.html) · [the workflows](workflows/index.html) · [billing](billing/index.html) · [the lab](lab/index.html) · [what this site ships](shipped/index.html) · [the sources](sources/index.html) · [the network](network/index.html) · [comms](admin/comms.html) · [release history](admin/versions.html) · [admin and engineering](admin/index.html).

Written by this site's agent from the newsroom's articles and notes and sgit.ai's guidance for `*.sgit.ai` sites; content CC BY 4.0. Repository: <https://github.com/SGit-AI/SGit-AI__Website__User>.
