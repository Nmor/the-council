// Size budget: 10 KB. Check: wc -c; gate: token-budget.mjs --check.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { run, HOOKS } from './helpers.mjs';

const { commandInvocations, gitOperation } = createRequire(import.meta.url)(join(HOOKS, 'lib/command-scan.js'));

const check = (hook, command, env = {}) => run(hook, {
  tool_name: 'Bash', tool_input: { command },
}, { CLAUDE_PUSH_AUTHORIZED: '', CLAUDE_DOCS_SYNC: 'off', ...env });

describe('destructive commands are checked at every executable position', () => {
  for (const command of [
    'echo ok; rm -rf /', 'echo ok && rm -rf /', 'false || rm -rf /',
    'printf ok | rm -rf /', 'echo ok\nrm -rf /', '(echo ok; rm -rf /)',
    'echo "$(rm -rf /)"', 'printf "%s" `rm -rf /`',
    'cat <(rm -rf /)', 'find . -exec rm -rf / \\;',
    'find . -execdir chmod 777 {} +', 'bash -c "echo ok; rm -rf /"',
    'echo ok; psql -c "DROP DATABASE production"',
    'cat > note <<EOF\n$(rm -rf /)\nEOF',
    'cat > note <<EOF\n\'$(rm -rf /)\'\nEOF',
    'cat > note <<EOF\n`rm -rf /`\nEOF',
    'cat <<\'EOF\' | bash\nrm -rf /\nEOF',
    'bash <<\'EOF\'\necho ok; rm -rf /\nEOF',
    'sudo -u root rm -rf /', 'env -u UNUSED rm -rf /',
    '/usr/bin/env -- rm -rf /', 'exec -a cleanup rm -rf /',
    'xargs rm -rf /', 'xargs -I {} rm -rf /', 'xargs -n 1 rm -rf /',
    'env -S "rm -rf /"', 'env --split-string="rm -rf /"', 'env "-Srm -rf /"',
    'git -C /repo reset --hard origin/main',
  ]) {
    test(command, () => assert.equal(check('destructive-command-gate.js', command).code, 2));
  }

  for (const command of [
    'echo "rm -rf /; chmod 777 /"', 'echo "$(echo \'rm -rf /\')"',
    'rg "DROP DATABASE|rm -rf /" .', 'printf "%s" \'git push --force origin main\'',
    'cat > note <<\'EOF\'\n$(rm -rf /)\nEOF',
    'cat > note <<"EOF"\n`rm -rf /`\nEOF',
    'cat > note <<EOF\nrm -rf /\nEOF',
    'cat > note <<EOF\n<(rm -rf /)\nEOF',
    'cat > note <<EOF; bash -c true\nrm -rf /\nEOF',
    'cat > note <<EOF || bash -c true\nrm -rf /\nEOF',
    'cat > note <<EOF\n\\$(rm -rf /)\nEOF',
    'find . -name \'rm -rf /\' -print', 'echo ok; rm -rf ./build',
    'find . -exec echo \'$(rm -rf /)\' \\;',
    'command -v rm',
    'xargs echo "rm -rf /"', 'env -S "echo rm -rf /"',
  ]) {
    test(`literal: ${command}`, () => assert.equal(check('destructive-command-gate.js', command).code, 0));
  }
});

describe('push checks belong to each invocation', () => {
  for (const command of [
    'git commit -m x && git push origin main',
    'CLAUDE_PUSH_AUTHORIZED=yes true; git push origin main',
    'echo --dry-run ; git push origin main', 'echo --help; git push origin main',
    'git push --dry-run origin main; git push origin main',
    'CLAUDE_PUSH_AUTHORIZED=yes git push origin feature; git push origin main',
    'echo "$(git push origin main)"', 'find . -exec git push origin main \\;',
    'cat > note <<EOF\n$(git push origin main)\nEOF',
    'git push origin main -o--dry-run', 'git push --push-option --dry-run origin main',
    'env -u UNUSED git push origin main',
    'env -S "git push origin main"', 'xargs git push origin main',
    'git push --dry-run --no-dry-run origin main', 'git push -n --no-dry-run origin main',
  ]) {
    test(command, () => assert.equal(check('pre-push-gate.js', command).code, 2));
  }

  for (const command of [
    'echo ok; CLAUDE_PUSH_AUTHORIZED=yes git push origin main',
    'CLAUDE_PUSH_AUTHORIZED="yes" git push origin main',
    'env CLAUDE_PUSH_AUTHORIZED=yes git push origin main',
    'git push --dry-run origin main; git status', 'git push -n origin main',
    'git push --help', 'echo "git push origin main; --dry-run"',
    'cat > note <<\'EOF\'\n$(git push origin main)\nEOF',
    'git commit -F - <<\'EOF\'\nsubject\n\ngit push origin main\nEOF',
    'git push --no-dry-run --dry-run origin main', 'git push --no-dry-run -n origin main',
    'env -S "CLAUDE_PUSH_AUTHORIZED=yes git push origin feature"',
  ]) {
    test(`allowed: ${command}`, () => assert.equal(check('pre-push-gate.js', command).code, 0));
  }

  for (const command of [
    'git push --force origin main', 'git push -f elsewhere HEAD:refs/heads/main',
    'git push --force-with-lease=refs/heads/main:abc elsewhere HEAD:main',
    'git push elsewhere +feature:master', 'git push --force elsewhere feature:production',
    'git push -f elsewhere refs/heads/trunk',
    'git push --force --all elsewhere', 'git push --mirror elsewhere',
    'git push --force --repo elsewhere HEAD:main',
    'git push --repo=elsewhere --force HEAD:refs/heads/main',
    'git push --force-with-lease elsewhere', 'git push --force elsewhere :',
    'git push elsewhere +refs/heads/*:refs/heads/*',
  ]) {
    test(`protected: ${command}`, () => assert.equal(check('pre-push-gate.js', command, {
      CLAUDE_PUSH_AUTHORIZED: 'yes',
    }).code, 2));
  }

  test('an unrelated protected ref does not change the push target', () => {
    assert.equal(check('pre-push-gate.js', 'echo origin main; git push --force-with-lease origin feature', {
      CLAUDE_PUSH_AUTHORIZED: 'yes',
    }).code, 0);
  });

  test('heredoc commit attribution remains checked as message data', () => {
    assert.equal(check('pre-push-gate.js', "git commit -F - <<'EOF'\nsubject\n\nCo-Authored-By: Claude\nEOF").code, 2);
    assert.equal(check('pre-push-gate.js', "cat <<'EOF' | git commit -F -\nsubject\n\nCo-Authored-By: Claude\nEOF").code, 2);
  });
});

describe('invocation metadata stays scoped', () => {
  test('assignments belong to one invocation', () => {
    const calls = commandInvocations('CLAUDE_PUSH_AUTHORIZED=yes git -C /repo push remote feature; git push remote main');
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0].assignments, { CLAUDE_PUSH_AUTHORIZED: 'yes' });
    assert.deepEqual(calls[1].assignments, {});
    assert.deepEqual(gitOperation(calls[0].argv), { operation: 'push', args: ['remote', 'feature'] });
  });

  test('git heredoc stdin is message data rather than another command', () => {
    const calls = commandInvocations("git commit -F - <<'EOF'\nsubject\n\nCLAUDE_COMMIT_GATE=off git commit\nEOF");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].input, 'subject\n\nCLAUDE_COMMIT_GATE=off git commit');
    assert.deepEqual(calls[0].assignments, {});
  });
});
