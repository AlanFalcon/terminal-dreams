const fs = require('fs');
const path = require('path');

const TILES_DIR = path.join(__dirname, '../../tiles');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]
  );
}

function getAllTilePaths() {
  return walk(TILES_DIR).filter(f => f.endsWith('.ans'));
}

function tileCount() {
  return getAllTilePaths().length;
}

// Resolution order: (1) matching genre+type, (2) matching type any genre, (3) any tile
function findTile({ genres, sceneType }) {
  const all = getAllTilePaths();
  if (all.length === 0) throw new Error('Tile library is empty');

  // (1) genre match + type match
  for (const genre of genres) {
    const match = all.find(p => p.includes(`/${genre}/`) && path.basename(p).startsWith(sceneType + '-'));
    if (match) return match;
  }

  // (2) type match any genre
  const typeMatch = all.find(p => path.basename(p).startsWith(sceneType + '-'));
  if (typeMatch) return typeMatch;

  // (3) any tile
  return all[Math.floor(Math.random() * all.length)];
}

function loadTile(tilePath) {
  return fs.readFileSync(tilePath, 'utf8');
}

module.exports = { getAllTilePaths, tileCount, findTile, loadTile };
