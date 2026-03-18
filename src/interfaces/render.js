// src/interfaces/render.js
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CLEAR = '\x1b[2J\x1b[H';

function bold(text) { return `${BOLD}${text}${RESET}`; }
function dim(text) { return `${DIM}${text}${RESET}`; }
function clear() { return CLEAR; }
function divider(width = 40) { return '─'.repeat(width); }

module.exports = { bold, dim, clear, divider };
