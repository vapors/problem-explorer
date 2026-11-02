/** Format plain-language graph tooltips without modifying stored node names.
 * Preserves paragraph breaks and prefers word boundaries near the target width.
 */
export function wrapGraphTooltip(value: string, width = 50): string {
  const limit = Math.max(24, Math.min(90, Math.floor(width)));
  return value.replace(/\r\n?/g, '\n').split('\n').map(paragraph => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '';
    const lines: string[] = [];
    let line = '';
    const put = () => { if (line) { lines.push(line); line = ''; } };
    for (const word of words) {
      if (!line) { line = word; continue; }
      if (line.length + 1 + word.length <= limit + 8) {
        line += ` ${word}`;
      } else {
        put(); line = word;
      }
    }
    put();
    return lines.join('\n');
  }).join('\n');
}
