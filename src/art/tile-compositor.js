function tileRows(content) {
  const lines = content.split('\n');
  return lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines;
}

function compositeTiles(tileContents) {
  if (tileContents.length === 1) return tileContents[0];
  const parsed = tileContents.map(tileRows);
  const result = [];
  for (let row = 0; row < 12; row++) {
    result.push(parsed.map(t => t[row] ?? ' '.repeat(40)).join(''));
  }
  return result.join('\n');
}

module.exports = { compositeTiles };
