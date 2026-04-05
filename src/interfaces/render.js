// src/interfaces/render.js
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CLEAR = '\x1b[2J\x1b[H';

// Genre color palettes — muted, atmospheric, not garish.
// 256-color ANSI: \x1b[38;5;Nm
const GENRE_COLORS = {
  'night-market':     '\x1b[38;5;178m',  // warm amber
  'cosmic-horror':    '\x1b[38;5;141m',  // dim lavender
  'deep-sea':         '\x1b[38;5;74m',   // steel blue
  'cyberpunk':        '\x1b[38;5;45m',   // electric cyan
  'high-fantasy':     '\x1b[38;5;186m',  // pale gold
  'gonzo-journalism': '\x1b[38;5;166m',  // burnt orange
  'western':          '\x1b[38;5;143m',  // dusty yellow
};

function bold(text) { return `${BOLD}${text}${RESET}`; }
function dim(text) { return `${DIM}${text}${RESET}`; }
function clear() { return CLEAR; }
function divider(width = 40) { return '─'.repeat(width); }

// Colorize text by primary genre name. Falls back to plain text if genre unknown.
function colorize(text, primaryGenre) {
  const code = GENRE_COLORS[primaryGenre];
  if (!code) return text;
  return `${code}${text}${RESET}`;
}

function renderInventory(inventory) {
  if (!inventory.length) return '';
  return dim('Carrying: ' + inventory.map(i => i.item).join(', ')) + '\n';
}

module.exports = { bold, dim, clear, divider, colorize, renderInventory };
