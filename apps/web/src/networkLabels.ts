/** Chart-only presentation. Never change stored names, statements, IDs or search content. */
<<<<<<< HEAD
export type GraphRole = 'target' | 'stream' | 'category' | 'problem' | 'concept';
=======
export type GraphRole = 'target' | 'stream' | 'category' | 'problem';
>>>>>>> 6c0aac51258ec106193708714498633b89a454c8

export function removeSeedCatalogPrefix(name: string, role: GraphRole): string {
  const raw = name.trim();
  if (role === 'stream') {
    // Seed example: "Stream 4 — Aging Infrastructure".
    return raw.replace(/^Stream\s+\d+\s*(?:[—–:\-]\s*)/i, '').trim() || raw;
  }
  if (role === 'category') {
    // Seed example: "4A. Access to essential services".
    return raw.replace(/^\d{1,3}[A-Z]{1,3}\s*[.:—–-]\s*/i, '').trim() || raw;
  }
  if (role === 'problem') {
    // Remove only explicit catalog-shaped codes, not dates, numbered findings,
    // or meaningful numbers at the start of an ordinary problem statement.
    return raw.replace(/^(?:P\d{2,5}|\d{1,3}[A-Z]{1,3}\.\d{1,4})\s*[.:—–-]\s*/i, '').trim() || raw;
  }
  return raw;
}

type Rule = {radius: number; fontSize: number; chars: number; lines: number};
const baseRules: Record<GraphRole, Rule> = {
  target:   {radius: 69, fontSize: 13.0, chars: 16, lines: 3},
  stream:   {radius: 57, fontSize: 12.0, chars: 15, lines: 3},
  category: {radius: 48, fontSize: 11.0, chars: 14, lines: 3},
  problem:  {radius: 42, fontSize: 10.5, chars: 13, lines: 3},
<<<<<<< HEAD
  concept:  {radius: 34, fontSize: 10.0, chars: 12, lines: 3},
=======
>>>>>>> 6c0aac51258ec106193708714498633b89a454c8
};

/** Make a readable three-line *preview*; the tooltip always shows full source text. */
export function layoutGraphLabel(name: string, role: GraphRole) {
  const cleaned = removeSeedCatalogPrefix(name, role).replace(/\s+/g, ' ');
  const rule = baseRules[role];
  // A modest semantic size increase for longer names, bounded to avoid crowding.
  const extra = Math.min(9, Math.max(0, Math.ceil((cleaned.length - rule.chars * 2) / 13)));
  const radius = rule.radius + extra;
  const charsPerLine = rule.chars + Math.floor(extra / 3);
  const tokens = cleaned.split(' ');
  const lines: string[] = [];
  let current = '';
  let consumed = 0;
  for (const token of tokens) {
    const proposed = current ? `${current} ${token}` : token;
    if (proposed.length > charsPerLine && current) {
      lines.push(current);
      if (lines.length === rule.lines) break;
      current = token;
    } else {
      current = proposed;
    }
    consumed++;
  }
  if (lines.length < rule.lines && current) lines.push(current);
  const truncated = consumed < tokens.length || lines.some(line => line.length > charsPerLine + 2);
  if (truncated && lines.length) {
    const last = lines.length - 1;
    lines[last] = lines[last].slice(0, Math.max(1, charsPerLine - 1)).trimEnd() + '…';
  }
  return {
    text: lines.join('\n'),
    fullText: name,
    radius,
    fontSize: rule.fontSize,
    maxWidth: Math.round(radius * 1.75),
  };
}
