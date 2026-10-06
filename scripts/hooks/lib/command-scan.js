// Size budget: 13 KB. Check: wc -c; gate: token-budget.mjs --check.
// Shell text is inspected, never executed. This is a bounded lexer, not a shell sandbox.
"use strict";

// Commands whose heredoc body is executed or carried rather than merely written to a file.
const INTERPRETER =
  /\b(bash|sh|zsh|ksh|dash|python3?|perl|ruby|node|git|env|eval|xargs|ssh|sudo|psql|mysql|sqlite3)\b/;

const SHELL = /^(?:bash|sh|zsh|ksh|dash)$/;
const ASSIGNMENT = /^([A-Za-z_]\w*)=(.*)$/s;
const MAX_DEPTH = 24;

function quoteEnd(source, start) {
  const quote = source.charAt(start);
  for (let i = start + 1; i < source.length; i++) {
    if (quote !== "'" && source.charAt(i) === "\\") { i++; continue; }
    if (source.charAt(i) === quote) return i + 1;
  }
  return source.length;
}

function parenEnd(source, start) {
  let level = 1;
  let i = start + 2;
  while (i < source.length) {
    const c = source.charAt(i);
    if (c === "\\") { i += 2; continue; }
    if (c === "'" || c === '"' || c === "`") { i = quoteEnd(source, i); continue; }
    if (c === "(") level++;
    if (c === ")" && --level === 0) return i + 1;
    i++;
  }
  return source.length;
}

function expansion(source, start) {
  const tick = source.charAt(start) === "`";
  const end = tick ? quoteEnd(source, start) : parenEnd(source, start);
  return { body: source.slice(start + (tick ? 1 : 2), end - 1), end };
}

function isExpansion(source, index, quote) {
  return quote !== "'" && (source.charAt(index) === "`" ||
    ("$<>".includes(source.charAt(index)) && source.charAt(index + 1) === "("));
}

function wordPart(source, i, quote, heredoc) {
  const c = source.charAt(i);
  if (c === "\\" && quote !== "'") {
    const next = source.charAt(i + 1);
    if ((quote === '"' || heredoc) && !"$`\\\"\n".includes(next))
      return { text: c, end: i + 1, quote };
    return { text: next === "\n" ? "" : next, end: i + 2, quote };
  }
  if (isExpansion(source, i, quote) && (!heredoc || !"<>".includes(c))) {
    const part = expansion(source, i);
    return { text: "__expansion__", end: part.end, quote, body: part.body };
  }
  if (!heredoc && (c === "'" || c === '"') && (!quote || quote === c)) {
    return { text: "", end: i + 1, quote: quote ? "" : c };
  }
  return { text: c, end: i + 1, quote };
}

function word(source, start, heredoc = false) {
  let value = "";
  let quote = "";
  let i = start;
  const nested = [];
  while (i < source.length) {
    if (!heredoc && !quote && /[\s;&|()<>]/.test(source.charAt(i)) && !isExpansion(source, i, quote)) break;
    const part = wordPart(source, i, quote, heredoc);
    value += part.text;
    quote = part.quote;
    i = part.end;
    if (part.body !== undefined) nested.push(part.body);
  }
  return { value, end: i, nested };
}

function tokens(source) {
  const result = [];
  const nested = [];
  let i = 0;
  while (i < source.length) {
    const c = source.charAt(i);
    if (c === "#") { const end = source.indexOf("\n", i); i = end < 0 ? source.length : end; continue; }
    if (/\s/.test(c)) {
      if (c === "\n") result.push({ op: ";" });
      i++; continue;
    }
    if (/[;&|()]/.test(c)) { result.push({ op: c }); i++; continue; }
    const redirect = /^(?:\d*)(?:<<<|<<-?|>>?|<)(?!\()/.exec(source.slice(i));
    if (redirect) { result.push({ redirect: redirect[0] }); i += redirect[0].length; continue; }
    const part = word(source, i);
    result.push({ value: part.value, raw: source.slice(i, part.end), start: i, end: part.end });
    nested.push(...part.nested);
    i = part.end;
  }
  return { result, nested };
}

function splitEnvironment(argv, index) {
  const arg = argv.at(index);
  const attached = arg.includes("=") || (arg.startsWith("-S") && arg.length > 2);
  let value = argv.at(index + 1) || "";
  if (attached) value = arg.slice(arg.startsWith("-S") ? 2 : arg.indexOf("=") + 1);
  const split = tokens(value).result;
  if (split.some(part => part.value === undefined)) return [];
  return [...split.map(part => part.value), ...argv.slice(index + (attached ? 1 : 2))];
}

const WRAPPER_VALUES = new Map([
  ["env", /^(?:-u|--unset|-C|--chdir)$/],
  ["sudo", /^(?:-[ughpCrtTD]|--user|--group|--host|--prompt|--chdir)$/],
  ["exec", /^-a$/], ["time", /^(?:-f|-o|--format|--output)$/],
]);

function wrapperArguments(argv, name) {
  let i = 1;
  let changesDirectory = false;
  while (argv.at(i)?.startsWith("-")) {
    const arg = argv.at(i);
    if (arg === "--") { i++; break; }
    if (name === "command" && /[vV]/.test(arg)) return { argv: [], changesDirectory };
    if ((name === "env" && /^(?:-[^-]*C|--chdir(?:=|$))/.test(arg)) ||
        (name === "sudo" && /^(?:-[^-]*D|--chdir(?:=|$))/.test(arg))) changesDirectory = true;
    if (name === "env" && /^(?:-S|--split-string(?:=|$))/.test(arg))
      return { argv: splitEnvironment(argv, i), changesDirectory };
    const takesValue = WRAPPER_VALUES.get(name)?.test(arg);
    i += takesValue ? 2 : 1;
  }
  return { argv: argv.slice(i), changesDirectory };
}

function invocation(words, input) {
  let argv = [...words];
  let assignments = {};
  let changesDirectory = false;
  if (/^(?:for|select|case)$/.test(argv[0] || "")) return null;
  while (/^(?:if|then|elif|else|do|while|until|!|\{|\})$/.test(argv[0] || "")) argv = argv.slice(1);
  while (argv.length) {
    const match = ASSIGNMENT.exec(argv[0]);
    if (match) { assignments = { ...assignments, [match[1]]: match[2] }; argv = argv.slice(1); continue; }
    const name = argv[0].replace(/^.*\//, "");
    if (/^(?:sudo|env|command|exec|nohup|time)$/.test(name)) {
      const wrapper = wrapperArguments(argv, name);
      argv = wrapper.argv;
      changesDirectory ||= wrapper.changesDirectory;
      continue;
    }
    if (argv[0] === "--") { argv = argv.slice(1); continue; }
    break;
  }
  if (!argv.length) return null;
  argv = [argv[0].replace(/^.*\//, ""), ...argv.slice(1)];
  return { argv, assignments, text: argv.join(" "), ...(changesDirectory ? { changesDirectory } : {}),
    ...(input === undefined ? {} : { input }) };
}

function pipeInputs(pipelines) {
  for (const calls of pipelines) {
    let input;
    for (const call of calls) {
      input = call.input ?? input;
      if (input !== undefined) call.input = input;
    }
  }
}

function directInvocations(source) {
  const lexed = tokens(source);
  const calls = [];
  const pipelines = [[]];
  let words = [];
  let redirect = "";
  let input;
  let previousOp = "";
  for (const token of [...lexed.result, { op: ";" }]) {
    if (token.op) {
      const call = invocation(words, input);
      if (call) { calls.push(call); pipelines.at(-1).push(call); }
      if (token.op !== "|" || previousOp === "|") pipelines.push([]);
      previousOp = token.op;
      words = []; redirect = ""; input = undefined;
    }
    else if (token.redirect) redirect = token.redirect;
    else if (redirect) {
      if (/^(?:\d*)<<-?$/.test(redirect)) input = token.value;
      redirect = "";
    }
    else { words.push(token.value); previousOp = ""; }
  }
  pipeInputs(pipelines);
  return { calls, nested: lexed.nested, pipelines };
}

// Unquoted heredocs expand even when their body contains quote characters. Quoted
// delimiters disable those expansions; bodies passed to interpreters still execute.
function heredocBody(lines, start, declaration) {
  const body = [];
  let end = start;
  while (end + 1 < lines.length) {
    end++;
    const line = lines.at(end);
    const check = declaration.strip ? line.replace(/^\t+/, "") : line;
    if (check === declaration.delimiter.value) break;
    body.push(line);
  }
  return { body: body.join("\n"), end };
}

function heredocDeclarations(header) {
  const lexed = tokens(header).result;
  return lexed.flatMap((token, index) => {
    if (!/^(?:\d*)<<-?$/.test(token.redirect || "")) return [];
    const delimiter = lexed.at(index + 1);
    return delimiter?.value ? [{ delimiter, strip: token.redirect.endsWith("-") }] : [];
  });
}

function shellLiteral(value) {
  return "'" + value.replaceAll("'", "'\\''") + "'";
}

function heredocHeader(header, replacements, legacy) {
  if (legacy) return header;
  let result = header;
  for (const part of replacements.reverse())
    result = result.slice(0, part.start) + shellLiteral(part.body) + result.slice(part.end);
  return result;
}

function interpretedHeredoc(pipelines, delimiter, legacy) {
  return pipelines.some((calls) => calls.some((call) => call.input === delimiter) &&
    calls.some((call) => INTERPRETER.test(call.argv[0]) && (legacy || call.argv[0] !== "git")));
}

function commandSource(cmd, legacy = false) {
  const lines = String(cmd ?? "").split("\n");
  const output = [];
  let i = 0;
  while (i < lines.length) {
    const header = lines.at(i);
    const { pipelines } = directInvocations(header);
    const replacements = [];
    const bodies = [];
    for (const declaration of heredocDeclarations(header)) {
      const part = heredocBody(lines, i, declaration);
      i = part.end;
      replacements.push({ ...declaration.delimiter, body: part.body });
      if (interpretedHeredoc(pipelines, declaration.delimiter.value, legacy))
        bodies.push(part.body, ...(legacy ? [lines.at(i)] : []));
      else if (declaration.delimiter.raw === declaration.delimiter.value)
        bodies.push(...word(part.body, 0, true).nested.map((body) => `$( ${body} )`));
    }
    output.push(heredocHeader(header, replacements, legacy), ...bodies);
    i++;
  }
  return output.join("\n");
}

function executablePart(cmd) { return commandSource(cmd, true); }

function carriedCommands(call) {
  const { argv } = call;
  if (SHELL.test(argv[0])) {
    const index = argv.findIndex((arg) => arg.startsWith("-") && !arg.startsWith("--") && arg.includes("c"));
    return index < 0 ? [] : [argv.at(index + 1) || ""];
  }
  if (argv[0] === "eval") return [argv.slice(1).join(" ")];
  if (argv[0] === "xargs") return xargsCommand(argv);
  if (argv[0] !== "find") return [];
  const commands = [];
  for (let i = 1; i < argv.length; i++) {
    if (!/^-exec(?:dir)?$/.test(argv.at(i))) continue;
    const end = argv.findIndex((arg, index) => index > i && (arg === ";" || arg === "+"));
    commands.push(argv.slice(i + 1, end < 0 ? argv.length : end).map(shellLiteral).join(" "));
  }
  return commands;
}

function xargsCommand(argv) {
  let i = 1;
  while (argv.at(i)?.startsWith("-")) {
    const arg = argv.at(i);
    if (arg === "--") { i++; break; }
    const valueOption = /^(?:-[IJLnPsdE]|--replace|--max-lines|--max-args|--max-procs|--max-chars|--delimiter|--eof)$/.test(arg);
    i += valueOption ? 2 : 1;
  }
  return i < argv.length ? [argv.slice(i).map(shellLiteral).join(" ")] : [];
}

/** Returns decoded argv and assignments for each static invocation, including expansions. */
function commandInvocations(cmd, depth = 0) {
  if (depth > MAX_DEPTH) return [];
  const { calls, nested } = directInvocations(commandSource(cmd));
  return [...calls, ...[...nested, ...calls.flatMap(carriedCommands)]
    .flatMap((part) => commandInvocations(part, depth + 1))];
}

function gitOperation(argv) {
  if (argv[0] !== "git") return { operation: "", args: [] };
  let i = 1;
  while (argv.at(i)?.startsWith("-")) {
    if (argv.at(i) === "--") { i++; break; }
    i += /^(?:-C|-c|--git-dir|--work-tree|--namespace|--config-env)$/.test(argv.at(i)) ? 2 : 1;
  }
  return { operation: argv.at(i) || "", args: argv.slice(i + 1) };
}

function atCommandPosition(cmd, needle) {
  return commandInvocations(cmd).some((call) => {
    if (typeof needle === "string") return call.text === needle || call.text.startsWith(needle + " ");
    const match = needle.exec(call.text);
    return match?.index === 0 && !/\w/.test(call.text.charAt(match[0].length));
  });
}

// Verification commands, including infra validation. Rendering alone is not verification.
const VERIFICATION_PATTERNS = [
  /go\s+(?:test|vet|build)|gofmt|staticcheck|golangci-lint|govulncheck|gosec/,
  /npx\s+tsc|tsc|npx\s+eslint|eslint|pytest|ruff|mypy|vitest|jest/,
  /cargo\s+(?:test|build|clippy)|markdownlint|make\s+(?:test|lint|build|check)/,
  /npm\s+(?:test|run\s+\S+)/,
  /(?:pnpm|yarn)\s+(?:test|build|lint)/,
  /bundle\s+exec\s+(?:rspec|rubocop)|dotnet\s+(?:test|build)/,
  /^python3?\s+validate-manifests(?:-selftest)?\.py/,
  /^python3?\s+\S+\/validate-manifests(?:-selftest)?\.py/,
  /^validate-manifests(?:-selftest)?\.py/,
  /^\S+\/validate-manifests(?:-selftest)?\.py/,
  /promtool\s+(?:check|test)|actionlint|terraform\s+validate|kubeconform/,
  /helm\s+lint|shellcheck|node\s+--test/,
];
const VERIFICATION_GATE = {
  exec: (text) => VERIFICATION_PATTERNS.map((pattern) => pattern.exec(text)).find((match) => match?.index === 0) || null,
  test: (text) => VERIFICATION_PATTERNS.some((pattern) => pattern.test(text)),
};

module.exports = {
  commandInvocations,
  gitOperation,
  executablePart,
  atCommandPosition,
  INTERPRETER,
  VERIFICATION_GATE,
};
