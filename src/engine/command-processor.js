// Verb prefixes that can be fuzzy-matched when the noun is slot-filled
const FUZZY_VERBS = ['talk to', 'take', 'use', 'look at'];

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
        const dir = Object.keys(scene.exits).find(d =>
          `go ${d}`.toLowerCase() === cmd.toLowerCase()
        ) || cmd.replace(/^go\s+/, '');
        return { type: 'exit', direction: dir, pivotTaken };
      }
    }
  }

  // Fuzzy verb match: "talk to researcher" hits "talk to forsaken gibbering researcher"
  for (const verb of FUZZY_VERBS) {
    if (trimmed.startsWith(verb)) {
      for (const [cmd, val] of Object.entries(scene.commands)) {
        if (cmd.toLowerCase().startsWith(verb)) {
          if (typeof val === 'string') {
            return { type: 'response', text: val, pivotTaken };
          }
        }
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
