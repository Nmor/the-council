// Size budget: 3 KB. Check: token-budget.mjs --check.
'use strict';
const { execFileSync } = require('node:child_process');
const { devNull } = require('node:os');
const path = require('node:path');

// The push destination's default branch is accepted history: reviewed
// merges only, provided the host protects it.
// A join bringing its commits into another branch then publishes nothing new.
// Cached tracking refs are never consulted. Anything unexpected excludes nothing.
function acceptedTip(root, url, { git, OID }) {
  if (typeof url !== 'string' || !url || url.startsWith('-')) return [];
  const env = { ...process.env, GIT_NO_REPLACE_OBJECTS: '1', GIT_GRAFT_FILE: devNull,
    GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: '', SSH_ASKPASS: '', GCM_INTERACTIVE: 'never' };
  const ask = args => execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'], env });
  try {
    // Git reads a URL as a local path when it has no colon or a slash comes first. A
    // relative one names a repository from where git push ran, not from the root.
    const colon = url.indexOf(':'), slash = url.indexOf('/');
    const local = colon < 0 || (slash >= 0 && slash < colon);
    if (local && !path.isAbsolute(url)) throw new Error('the push URL is a relative path');
    // No prompt may hold the push; a configured SSH command is left as it is.
    if (!env.GIT_SSH_COMMAND && !env.GIT_SSH && !ask(['config', '--default', '', '--get', 'core.sshCommand']).trim())
      env.GIT_SSH_COMMAND = 'ssh -o BatchMode=yes';
    // Git already applied insteadOf to the URL it gave the hook; a second rewrite
    // would read a different repository from the one being pushed to.
    if (ask(['ls-remote', '--get-url', url]).trim() !== url) throw new Error('the push URL is rewritten again by insteadOf');
    const lines = ask(['ls-remote', '--symref', url, 'HEAD']).split('\n').filter(Boolean);
    // ls-remote matches HEAD by the end of a ref's name (wip/HEAD), so only an exact
    // HEAD that is a branch symref counts; a detached or unborn HEAD is not one.
    const branch = lines.filter(line => /^ref: refs\/heads\/[^\t]+\tHEAD$/.test(line));
    const tips = lines.map(line => line.split('\t')).filter(([oid, ref]) => ref === 'HEAD' && OID.test(oid));
    if (branch.length !== 1 || tips.length !== 1) throw new Error('the remote HEAD is not one branch with a commit');
    const [[tip]] = tips;
    git(root, ['cat-file', '-e', `${tip}^{commit}`]);
    return [tip];
  } catch (error) {
    // git's first fatal line is the cause; the lines after it are generic advice.
    const lines = String(error.stderr || '').split('\n').filter(Boolean);
    const said = lines.find(line => line.startsWith('fatal:')) || lines.pop();
    const reason = (said || error.code || error.message).toString().replace(/\/\/[^/@\s]*@/g, '//<redacted>@');
    process.stderr.write(`[council-push] the destination's default branch is not excluded: ${reason}\n`);
    return [];
  }
}

module.exports = { acceptedTip };
