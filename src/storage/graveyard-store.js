// src/storage/graveyard-store.js
const fs = require('fs');
const path = require('path');

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function createGraveyardStore(graveyardDir) {
  if (!fs.existsSync(graveyardDir)) fs.mkdirSync(graveyardDir, { recursive: true });
  const completedLog = path.join(graveyardDir, 'completed.log');

  function uniqueSlug(base) {
    const existing = fs.readdirSync(graveyardDir)
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace(/^\d{4}-\d{2}-\d{2}T[\d-]+-/, '').replace('.md', ''));
    let slug = base;
    let n = 2;
    while (existing.includes(slug)) { slug = `${base}-${n++}`; }
    return slug;
  }

  async function writeMemorial({ worldName, genres, act, scene, memorial, timestamp }) {
    const slug = uniqueSlug(slugify(worldName));
    const isoSlug = timestamp.replace(/:/g, '-').replace(/\./g, '-');
    const filename = `${isoSlug}-${slug}.md`;
    const content = [
      `# ${worldName}`,
      `*Lost at Act ${act}, Scene ${scene}*`,
      `*Genres: ${genres.join(', ')}*`,
      '',
      memorial,
    ].join('\n');
    fs.writeFileSync(path.join(graveyardDir, filename), content, 'utf8');
  }

  async function writeCompleted({ worldName, genres, scenes, timestamp }) {
    const line = `${timestamp} | ${worldName} | ${genres.join(',')} | ${scenes}/10\n`;
    fs.appendFileSync(completedLog, line, 'utf8');
  }

  function listMemorials() {
    return fs.readdirSync(graveyardDir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()
      .map(filename => {
        const content = fs.readFileSync(path.join(graveyardDir, filename), 'utf8');
        const lines = content.split('\n');
        const worldName = lines[0].replace(/^# /, '');
        const slug = filename.replace(/^\d{4}-\d{2}-\d{2}T[\d-]+-/, '').replace('.md', '');
        const bodyLines = lines.filter(l => l && !l.startsWith('#') && !l.startsWith('*'));
        return { worldName, slug, filename, firstLine: bodyLines[0] || '' };
      });
  }

  function getMemorial(slug) {
    const files = fs.readdirSync(graveyardDir).filter(f => f.endsWith(`-${slug}.md`));
    if (files.length === 0) return null;
    return fs.readFileSync(path.join(graveyardDir, files[0]), 'utf8');
  }

  return { writeMemorial, writeCompleted, listMemorials, getMemorial };
}

module.exports = { createGraveyardStore, slugify };
