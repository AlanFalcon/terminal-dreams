// src/engine/world-generator.js
const fs = require('fs');
const path = require('path');

const GENRE_DIR = path.join(__dirname, '../../data/genres');

const NAME_TEMPLATES = [
  'The {ADJ} {NOUN} of {LOCATION}',
  '{NOUN} and {NOUN}',
  '{ADJ} {LOCATION}',
  'The {MACGUFFIN} of {LOCATION}',
  '{ADJ} {NOUN}',
];

function loadGenres() {
  return fs.readdirSync(GENRE_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => ({
      name: f.replace('.json', ''),
      vocab: JSON.parse(fs.readFileSync(path.join(GENRE_DIR, f), 'utf8')),
    }));
}

function selectGenres(genres) {
  const shuffled = [...genres].sort(() => Math.random() - 0.5);
  const count = 2 + (Math.random() < 0.5 ? 1 : 0) + (Math.random() < 0.5 ? 1 : 0);
  return shuffled.slice(0, count);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateWorldName(activeGenres) {
  const template = pick(NAME_TEMPLATES);
  const slots = [...template.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
  let result = template;
  slots.forEach((slot, i) => {
    const genre = activeGenres[i % activeGenres.length];
    const options = genre.vocab[slot] || [];
    const word = options.length > 0 ? pick(options) : slot.toLowerCase();
    result = result.replace(`{${slot}}`, word);
  });
  return result;
}

function fillSlot(slotType, activeGenres) {
  const primaryOptions = activeGenres[0].vocab[slotType] || [];
  const base = primaryOptions.length > 0 ? pick(primaryOptions) : slotType.toLowerCase();
  const modifiers = activeGenres.slice(1).map(g => {
    const adjs = g.vocab['ADJ'] || [];
    return adjs.length > 0 ? pick(adjs) : null;
  }).filter(Boolean);
  return [...modifiers, base].join(' ');
}

function generateWorld() {
  const genres = loadGenres();
  const activeGenres = selectGenres(genres);
  const name = generateWorldName(activeGenres);
  return { name, genres: activeGenres };
}

module.exports = { loadGenres, selectGenres, generateWorldName, fillSlot, generateWorld };
