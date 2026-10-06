// Size budget: 3 KB. Check: token-budget.mjs --check.
// Unsupported YAML stays eager so malformed scope cannot reduce the context estimate.
function nonemptyPath(value) {
  if (value.startsWith('"')) {
    try {
      const decoded = JSON.parse(value);
      return typeof decoded === 'string' && decoded.trim().length > 0;
    } catch {
      return false;
    }
  }
  if (value.startsWith("'")) return /^'(?:[^']|'')+'$/.test(value) && value.slice(1, -1).trim().length > 0;
  return /^[A-Za-z_/.][\w./*?{}!-]*$/.test(value) && !/^(?:null|true|false|yes|no|on|off)$/i.test(value);
}

export function ruleIsScoped(source) {
  const front = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (!front) return false;
  const lines = front.split(/\r?\n/);
  const index = lines.findIndex(line => line.startsWith('paths:'));
  if (index < 0 || lines.filter(line => line.startsWith('paths:')).length !== 1) return false;
  const value = lines.at(index).slice('paths:'.length).trim();
  if (value.startsWith('[') && value.endsWith(']')) {
    const paths = value.slice(1, -1).split(',').map(part => part.trim());
    return paths.every(nonemptyPath);
  }
  if (value && !value.startsWith('#')) return false;
  const paths = [];
  for (const line of lines.slice(index + 1)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (!line.startsWith(' ')) break;
    if (!trimmed.startsWith('- ')) return false;
    paths.push(trimmed.slice(2).trim());
  }
  return paths.length > 0 && paths.every(nonemptyPath);
}
