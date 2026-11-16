// Size budget: 6 KB. Check: token-budget.mjs --check.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { gitBytes } = require('./committed-proof.js');

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

function validateLinks(source, links) {
  const targets = new Map();
  for (const link of links) {
    const target = link.bytes.toString('utf8');
    if (!Buffer.from(target).equals(link.bytes) || target.includes('\\') || path.isAbsolute(target) ||
        path.win32.parse(target).root) throw new Error('unsupported absolute or nonportable symlink');
    // Parent traversal after a case/Unicode-aliased link depends on filesystem
    // lookup semantics. Refuse it rather than certify a lexical approximation.
    if (target.split('/').some(part => /^\.\.[ .]*$/.test(part.trim())))
      throw new Error('unsupported parent-traversing symlink target');
    targets.set(path.relative(source, link.target).split(path.sep).join('/'), target);
  }
  for (const link of links) {
    const parts = path.relative(source, path.dirname(link.target)).split(path.sep).filter(Boolean);
    let pending = link.bytes.toString('utf8').split('/'), expansions = 0;
    while (pending.length) {
      const part = pending.shift();
      if (!part || part === '.') continue;
      if (part === '..') {
        if (!parts.length) throw new Error('symlink target escapes the committed snapshot');
        parts.pop(); continue;
      }
      parts.push(part);
      const nested = targets.get(parts.join('/'));
      if (nested !== undefined) {
        if (++expansions > 40) throw new Error('cyclic or excessive committed symlink chain');
        parts.pop(); pending = nested.split('/').concat(pending);
      }
    }
  }
}

// Archive attributes and checkout filters must not change the tested tree.
function materialize(root, commit, source) {
  const sourceRoot = path.resolve(source);
  const listing = gitBytes(root, ['ls-tree', '-rz', '--full-tree', commit]);
  const text = listing.toString('utf8');
  if (!Buffer.from(text).equals(listing)) throw new Error('unsupported non-UTF8 committed paths');
  const entries = text.split('\0').filter(Boolean).map(record => {
    const tab = record.indexOf('\t');
    const [mode, type, oid] = record.slice(0, tab).split(' ');
    const name = record.slice(tab + 1);
    if (tab < 0 || type !== 'blob' || !['100644', '100755', '120000'].includes(mode))
      throw new Error('unsupported committed entry; submodules require an explicit verified snapshot');
    if (name.includes('\\') || path.isAbsolute(name) || path.win32.parse(name).root ||
        name.split('/').some(part => !part || ['.', '..', '.git'].includes(part)))
      throw new Error('unsafe committed path');
    const target = path.resolve(sourceRoot, ...name.split('/'));
    if (!inside(sourceRoot, target)) throw new Error('unsafe committed path');
    return { mode, oid, target };
  });
  const links = [];
  for (let start = 0; start < entries.length; start += 32) {
    const batch = entries.slice(start, start + 32);
    const data = gitBytes(root, ['cat-file', '--batch'], batch.map(entry => entry.oid).join('\n') + '\n');
    let cursor = 0;
    for (const entry of batch) {
      const end = data.indexOf(10, cursor);
      const [oid, type, sizeText] = data.subarray(cursor, end).toString('ascii').split(' ');
      const size = Number(sizeText), offset = end + 1;
      if (end < 0 || oid !== entry.oid || type !== 'blob' || !Number.isSafeInteger(size) || size < 0 ||
          offset + size >= data.length || data[offset + size] !== 10) throw new Error('invalid raw blob response');
      const bytes = data.subarray(offset, offset + size); cursor = offset + size + 1;
      if (entry.mode === '120000') { links.push({ ...entry, bytes: Buffer.from(bytes) }); continue; }
      fs.mkdirSync(path.dirname(entry.target), { recursive: true, mode: 0o700 });
      fs.writeFileSync(entry.target, bytes, { flag: 'wx', mode: 0o600 });
      fs.chmodSync(entry.target, entry.mode === '100755' ? 0o755 : 0o644);
    }
    if (cursor !== data.length) throw new Error('unexpected raw blob response');
  }
  // Creating links last prevents a tree entry from redirecting subsequent writes.
  validateLinks(sourceRoot, links);
  for (const link of links) {
    const target = link.bytes.toString('utf8');
    if (!Buffer.from(target).equals(link.bytes)) throw new Error('unsupported non-UTF8 symlink');
    if (path.win32.parse(target).root || !inside(sourceRoot, path.resolve(path.dirname(link.target), target)))
      throw new Error('symlink target escapes the committed snapshot');
    fs.mkdirSync(path.dirname(link.target), { recursive: true, mode: 0o700 });
    fs.symlinkSync(target, link.target);
  }
}
module.exports = { materialize };
