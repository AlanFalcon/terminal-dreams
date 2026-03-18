function processCommand(input, scene) {
  const trimmed = input.trim().toLowerCase();

  // Check for pivot action (e.g. "take <anything>")
  const pivotTaken = scene.pivot_action ? trimmed.startsWith(scene.pivot_action + ' ') : false;

  // Exact command match
  for (const [cmd, val] of Object.entries(scene.commands)) {
    if (trimmed === cmd.toLowerCase()) {
      if (typeof val === 'string') {
        return { type: 'response', text: val, pivotTaken };
      }
      if (val.exit) {
        const dir = cmd.replace(/^go\s+/, '');
        return { type: 'exit', direction: dir, pivotTaken };
      }
    }
  }

  // Prefix match for "go <direction>"
  if (trimmed.startsWith('go ')) {
    const dir = trimmed.slice(3);
    if (scene.exits[dir]) {
      return { type: 'exit', direction: dir, pivotTaken };
    }
  }

  return { type: 'unknown', pivotTaken: false };
}

module.exports = { processCommand };
