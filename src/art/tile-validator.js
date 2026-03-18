function stripAnsi(str) {
  return str
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
    .replace(/\x1b[^[]/g, '');
}

function validateTile(content) {
  const lines = content.split('\n');
  const rows = lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines;

  if (rows.length !== 12) {
    return { valid: false, error: `Expected 12 rows, got ${rows.length}` };
  }

  for (let i = 0; i < rows.length; i++) {
    const visible = stripAnsi(rows[i]);
    if (visible.length !== 40) {
      return { valid: false, error: `Row ${i + 1}: expected 40 cols, got ${visible.length}` };
    }
  }

  return { valid: true };
}

module.exports = { validateTile, stripAnsi };
