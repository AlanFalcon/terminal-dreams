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

// Render a visited-rooms map for a zone.
// zone: { rooms: [{id, type, position: {x,y}, exits, isGate}] }
// visitedRoomIds: Set of room id strings
// currentRoomId: string
function renderMap(zone, visitedRoomIds, currentRoomId, primaryGenre) {
  const rooms = zone.rooms;
  const xs = rooms.map(r => r.position.x);
  const ys = rooms.map(r => r.position.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  const grid = {};
  for (const room of rooms) grid[`${room.position.x},${room.position.y}`] = room;

  const lines = [];
  for (let y = minY; y <= maxY; y++) {
    let row = '';
    let connRow = '';
    for (let x = minX; x <= maxX; x++) {
      const room = grid[`${x},${y}`];
      const eastRoom = grid[`${x + 1},${y}`];
      const southRoom = grid[`${x},${y + 1}`];

      if (room) {
        const visited = visitedRoomIds.has(room.id);
        const isCurrent = room.id === currentRoomId;
        let label;
        if (isCurrent) label = '*';
        else if (!visited) label = '?';
        else if (room.isGate) label = 'G';
        else label = room.type[0].toUpperCase();

        const cell = visited || isCurrent ? `[${label}]` : `[${label}]`;
        row += cell;

        const hasEastConn = eastRoom && (room.exits.east || eastRoom.exits.west);
        const bothVisited = (visited || isCurrent) && (visitedRoomIds.has(eastRoom?.id) || eastRoom?.id === currentRoomId);
        row += hasEastConn ? (bothVisited ? '───' : dim('───')) : '   ';

        const hasSouthConn = southRoom && (room.exits.south || southRoom.exits.north);
        const southVisited = visitedRoomIds.has(southRoom?.id) || southRoom?.id === currentRoomId;
        if (hasSouthConn) {
          connRow += (visited || isCurrent) && southVisited ? ' │ ' : dim(' │ ');
        } else {
          connRow += '   ';
        }
        connRow += '    ';
      } else {
        row += '       ';
        connRow += '       ';
      }
    }
    lines.push(row);
    if (y < maxY) lines.push(connRow);
  }

  const title = colorize('map', primaryGenre) + dim(' · [*] here  [G] gate  [?] unseen');
  return title + '\n' + lines.join('\n');
}

module.exports = { bold, dim, clear, divider, colorize, renderInventory, renderMap };
