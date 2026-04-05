// map.js — walk all rooms in a generated world, show the topology
const path = require('path');
const { generateWorld } = require('./src/engine/world-generator');
const { createZoneGenerator } = require('./src/engine/zone-generator');
const { createDescriptionGenerator } = require('./src/engine/description-generator');
const { bold, dim, colorize } = require('./src/interfaces/render');

const zoneGenerator = createZoneGenerator();
const descriptionGenerator = createDescriptionGenerator('stub');

async function mapWorld() {
  const world = generateWorld(zoneGenerator);
  const primaryGenre = world.genres[0]?.name;
  const genreNames = world.genres.map(g => g.name).join(', ');

  // Fill descriptions (will use stubs)
  const zone = world.zones.act1;
  await Promise.all(zone.rooms.map(async room => {
    const desc = await descriptionGenerator.generateDescription(room, world);
    room.description = desc;
  }));

  console.log('\n' + colorize(bold(world.name), primaryGenre));
  console.log(dim('genres: ' + genreNames));
  console.log(dim('act1: ' + zone.rooms.length + ' rooms') + '\n');

  // Find bounds
  const xs = zone.rooms.map(r => r.position.x);
  const ys = zone.rooms.map(r => r.position.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  // Build grid
  const grid = {};
  for (const room of zone.rooms) {
    grid[`${room.position.x},${room.position.y}`] = room;
  }

  // Render ASCII map
  console.log('Map (start = [S], gate = [G], other = [ ]):');
  for (let y = minY; y <= maxY; y++) {
    let row = '';
    let connRow = '';
    for (let x = minX; x <= maxX; x++) {
      const room = grid[`${x},${y}`];
      if (room) {
        const label = room.id === zone.startRoomId ? 'S' : room.isGate ? 'G' : room.type[0].toUpperCase();
        row += `[${label}]`;
        // East connection?
        const eastRoom = grid[`${x+1},${y}`];
        if (eastRoom && (room.exits.east || eastRoom.exits.west)) row += '---';
        else row += '   ';
        // South connection?
        const southRoom = grid[`${x},${y+1}`];
        if (southRoom && (room.exits.south || southRoom.exits.north)) connRow += ' |     ';
        else connRow += '       ';
      } else {
        row += '       ';
        connRow += '       ';
      }
    }
    console.log(row);
    if (y < maxY) console.log(connRow);
  }

  // Room list
  console.log('\nRooms:');
  for (const room of zone.rooms) {
    const tags = [];
    if (room.id === zone.startRoomId) tags.push('START');
    if (room.isGate) tags.push('GATE ' + room.gateMechanic);
    const exitDirs = Object.keys(room.exits).join('/');
    const latentCount = room.latents.length;
    console.log(`  ${room.id.padEnd(12)} ${room.type.padEnd(16)} exits:[${exitDirs}]  latents:${latentCount}  ${tags.join(' ')}`);
  }

  // Walk from start, show all reachable rooms
  console.log('\nWalk from start:');
  const visited = new Set();
  const queue = [{ roomId: zone.startRoomId, path: [] }];
  while (queue.length) {
    const { roomId, path } = queue.shift();
    if (visited.has(roomId)) continue;
    visited.add(roomId);
    const room = zone.rooms.find(r => r.id === roomId);
    if (!room) continue;
    const indent = '  '.repeat(path.length);
    const pathStr = path.length ? dim(path.join(' > ') + ' > ') : '';
    console.log(`${indent}${pathStr}${room.type} (${room.id})`);
    for (const [dir, target] of Object.entries(room.exits)) {
      if (!visited.has(target) && !target.startsWith('__')) {
        queue.push({ roomId: target, path: [...path, dir] });
      }
    }
  }
}

mapWorld().catch(console.error);
