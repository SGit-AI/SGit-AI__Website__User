#!/usr/bin/env node
// user.sgit.ai pre-release gate. Run from anywhere: node admin/build/validate.js
// Checks, in order:
//   1. version agreement: admin/build/version.txt vs every page's version badge,
//      the versions table, llms.txt, llms-full.txt and index.md
//   2. internal links: every relative href/src in every .html file resolves to a
//      file in the tree (fragments stripped; external and mailto links skipped)
//   3. canonical host: every <link rel="canonical"> and og:url points at the host
//      in CNAME
//   4. key-leak tripwire: nothing in the tree may look like an sgit vault key or
//      an sgit access key
//   5. this site's own constitution, from the passkey design it publishes: THE
//      ORIGIN LOADS NO THIRD-PARTY SCRIPT ON ANY PAGE. Browser storage is per
//      origin, so a script on one page can read what another page kept, and this
//      is the origin that will one day hold the door to a user's master vault.
//      No <script src> to another origin, no dynamic import() of another origin,
//      no stylesheet from another origin either.
// Any failure exits 1: no tag, no publish.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const errors = [];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === '.git' || name === '.github' || name === 'node_modules' || name === '.sg_vault') continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(ROOT);
const htmlFiles = files.filter(f => f.endsWith('.html'));

// --- 1. version agreement -------------------------------------------------
const VERSION = fs.readFileSync(path.join(ROOT, 'admin/build/version.txt'), 'utf8').trim();
if (!/^v\d+\.\d+\.\d+$/.test(VERSION)) {
  errors.push(`version.txt does not carry a vX.Y.Z version: "${VERSION}"`);
}
for (const f of htmlFiles) {
  const t = fs.readFileSync(f, 'utf8');
  const badges = [...t.matchAll(/class="ver"[^>]*>(v\d+\.\d+\.\d+)</g)].map(m => m[1]);
  for (const b of badges) if (b !== VERSION) {
    errors.push(`${path.relative(ROOT, f)}: version badge ${b} != ${VERSION}`);
  }
}
for (const extra of ['llms.txt', 'llms-full.txt', 'index.md']) {
  const t = fs.readFileSync(path.join(ROOT, extra), 'utf8');
  if (!t.includes(VERSION)) errors.push(`${extra} does not mention ${VERSION}`);
}
const versTable = fs.readFileSync(path.join(ROOT, 'admin/versions.html'), 'utf8');
if (!versTable.includes(`class="vnum">${VERSION}<`)) {
  errors.push(`admin/versions.html has no row for ${VERSION}`);
}
const rows = [...versTable.matchAll(/class="vnum">(v\d+\.\d+\.\d+)</g)].map(m => m[1]);
for (const v of rows) if (rows.filter(x => x === v).length > 1) {
  errors.push(`admin/versions.html lists ${v} more than once`);
  break;
}

// --- 2. internal links ----------------------------------------------------
for (const f of htmlFiles) {
  const t = fs.readFileSync(f, 'utf8');
  const dir = path.dirname(f);
  for (const m of t.matchAll(/(?:href|src)="([^"#]+)(?:#[^"]*)?"/g)) {
    const target = m[1];
    if (/^(https?:|mailto:|data:|\/\/)/.test(target) || target === '') continue;
    const resolved = path.resolve(dir, target);
    if (!fs.existsSync(resolved)) {
      errors.push(`${path.relative(ROOT, f)}: broken link -> ${target}`);
    }
  }
}

// --- 3. canonical host ----------------------------------------------------
const HOST = fs.readFileSync(path.join(ROOT, 'CNAME'), 'utf8').trim();
if (!/^[a-z0-9.-]+$/.test(HOST)) errors.push(`CNAME does not carry a hostname: "${HOST}"`);
for (const f of htmlFiles) {
  const t = fs.readFileSync(f, 'utf8');
  const claimed = [
    ...[...t.matchAll(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/g)].map(m => m[1]),
    ...[...t.matchAll(/<meta[^>]+property="og:url"[^>]+content="([^"]+)"/g)].map(m => m[1]),
  ];
  for (const url of claimed) if (!url.startsWith(`https://${HOST}/`)) {
    errors.push(`${path.relative(ROOT, f)}: canonical/og:url is not on ${HOST} -> ${url}`);
  }
  if (!/rel="canonical"/.test(t)) {
    errors.push(`${path.relative(ROOT, f)}: no canonical link`);
  }
}

// --- 4. key-leak tripwire -------------------------------------------------
// Three shapes. The house one (a long passphrase joined by a colon to a uuid-shaped
// id); sgit's own vault key (a 24-character [a-z0-9] passphrase, or the door's
// 64-hex one, joined by a colon to an 8-character vault id) with its prefix; and the
// prefix of an sgit access key. A read key is publishable and is not matched.
const KEY_SHAPES = [
  /[A-Za-z0-9_-]{20,}:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
  /sgit_private_vault_[a-z0-9]+:[a-z0-9]{4,24}/,
  /\b[a-z0-9]{24}:[a-z0-9]{8}\b/,
  /\b[0-9a-f]{64}:[a-z0-9]{8}\b/,
  /sgit_access_[a-z0-9_]*[0-9a-f]{16,}/,
];
for (const f of files) {
  if (/\.(png|jpg|jpeg|gif|webp|ico|woff2?|zip)$/.test(f)) continue;
  const t = fs.readFileSync(f, 'utf8');
  for (const re of KEY_SHAPES) if (re.test(t)) {
    errors.push(`${path.relative(ROOT, f)}: contains a key-shaped string (${re})`);
    break;
  }
}

// --- 5. no third-party script on any page ---------------------------------
for (const f of htmlFiles) {
  const t = fs.readFileSync(f, 'utf8');
  for (const m of t.matchAll(/<script[^>]+src="([^"]+)"/g)) {
    if (/^(https?:)?\/\//.test(m[1])) errors.push(`${path.relative(ROOT, f)}: loads a script from another origin -> ${m[1]}`);
  }
  for (const m of t.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)) {
    if (/^(https?:)?\/\//.test(m[1])) errors.push(`${path.relative(ROOT, f)}: loads a stylesheet from another origin -> ${m[1]}`);
  }
}
for (const f of files.filter(x => x.endsWith('.js'))) {
  const t = fs.readFileSync(f, 'utf8');
  if (/import\s*\(\s*['"`]https?:/.test(t) || /^\s*import\b[^'"]*['"]https?:/m.test(t)) {
    errors.push(`${path.relative(ROOT, f)}: imports code from another origin`);
  }
}

// --- report ---------------------------------------------------------------
if (errors.length) {
  console.error(`validate: ${errors.length} error(s)`);
  for (const e of errors) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`validate: OK, ${VERSION} on ${HOST}, ${htmlFiles.length} pages, links resolve, no key-shaped strings, no third-party script`);
