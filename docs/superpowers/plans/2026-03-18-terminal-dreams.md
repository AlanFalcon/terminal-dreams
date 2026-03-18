# Terminal Dreams Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable end-to-end one-shot MUD (10 scenes, 3-act structure, ANSI art, fork) playable via SSH and a web terminal, running inside GitHub Codespaces.

**Architecture:** A single Node.js process hosts an SSH server (`ssh2`) and an HTTP/WebSocket server (`express` + `ws`). Each connection spawns a `Session` — a pure state machine that receives player commands and emits ANSI text. The game engine is interface-agnostic. Genre vocab, scene templates, and ANSI tiles live as flat files; a serial write queue handles all git-committed writes (tiles + memorials). The Anthropic SDK generates tiles (until library hits 200) and graveyard memorials.

**Tech Stack:** Node.js 20, ssh2, express, ws, xterm.js (CDN), @anthropic-ai/sdk, jest

---

## File Map

```
data/
  genres/
    deep-sea.json
    cyberpunk.json
    western.json
    gonzo-journalism.json
    high-fantasy.json
    cosmic-horror.json
  scenes/
    act1-scene1.json  act1-scene2.json  act1-scene3.json
    act2a-scene4.json act2a-scene5.json
    act2b-scene4.json act2b-scene5.json
    act3-scene6.json  act3-scene7.json  act3-scene8.json

tiles/
  deep-sea/
    location-trench.ans
    atmosphere-bioluminescence.ans
    character-drowned.ans
  cyberpunk/
    location-neon-alley.ans
    character-chrome-fixer.ans
  western/
    location-saloon.ans
    atmosphere-desert.ans

graveyard/        (runtime-written, gitignored initially but auto-committed)
completed.log     (runtime-written)

src/
  engine/
    world-generator.js
    scene-manager.js
    command-processor.js
    session.js
  art/
    tile-validator.js
    tile-library.js
    tile-compositor.js
    tile-generator.js
  storage/
    write-queue.js
    graveyard-store.js
  api/
    memorial-generator.js
  interfaces/
    render.js
    ssh-server.js
    web-server.js

public/
  index.html

.devcontainer/
  devcontainer.json

tests/
  engine/
    world-generator.test.js
    scene-manager.test.js
    command-processor.test.js
    session.test.js
  art/
    tile-validator.test.js
    tile-library.test.js
    tile-compositor.test.js
  storage/
    write-queue.test.js
    graveyard-store.test.js

index.js
package.json
jest.config.js
.env.example
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `jest.config.js`
- Create: `.env.example`
- Create: `.gitignore` (additions)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "terminal-dreams",
  "version": "1.0.0",
  "type": "commonjs",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "test": "jest --runInBand",
    "test:watch": "jest --watch"
  },
  "dependencies": {
    "ssh2": "^1.16.0",
    "express": "^4.18.0",
    "ws": "^8.17.0",
    "@anthropic-ai/sdk": "^0.24.0",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "jest": "^29.0.0"
  }
}
```

- [ ] **Step 2: Create jest.config.js**

```js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
};
```

- [ ] **Step 3: Create .env.example**

```
ANTHROPIC_API_KEY=your_key_here
SSH_PORT=2222
WEB_PORT=3000
```

- [ ] **Step 4: Add to .gitignore**

```
node_modules/
.env
.ssh/
*.log
```

- [ ] **Step 5: Create required directories**

```bash
mkdir -p data/genres data/scenes tiles graveyard src/engine src/art src/storage src/api src/interfaces public .devcontainer tests/engine tests/art tests/storage
```

- [ ] **Step 6: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` populated, no errors.

- [ ] **Step 7: Verify Jest runs**

```bash
npm test
```

Expected: "Test Suites: 0 passed, 0 total" (no tests yet).

- [ ] **Step 8: Commit**

```bash
git add package.json jest.config.js .env.example .gitignore
git commit -m "feat: project scaffold"
```

---

## Task 2: Genre Registry Data Files

**Files:**
- Create: `data/genres/deep-sea.json`
- Create: `data/genres/cyberpunk.json`
- Create: `data/genres/western.json`
- Create: `data/genres/gonzo-journalism.json`
- Create: `data/genres/high-fantasy.json`
- Create: `data/genres/cosmic-horror.json`

Each file follows this schema: `{ LOCATION, ANTAGONIST, MACGUFFIN, THREAT, CHARACTER, ADJ, NOUN }` — each key holds an array of strings.

- [ ] **Step 1: Create data/genres/deep-sea.json**

```json
{
  "LOCATION": ["abyssal trench", "flooded research dome", "the pressure shelf", "sunken vessel corridor", "bioluminescent forest"],
  "ANTAGONIST": ["the brine-touched", "pressure wraith", "leviathan", "the drowned crew"],
  "MACGUFFIN": ["dive manifest", "pressure capsule", "sonar recording", "hull cipher"],
  "THREAT": ["hull breach", "the depth pressure", "oxygen depletion", "the hunger below"],
  "CHARACTER": ["surface liaison", "dive doc", "the trapped researcher", "vent tender"],
  "ADJ": ["abyssal", "bioluminescent", "pressure-warped", "drowned", "pelagic"],
  "NOUN": ["brine", "trench", "tide", "depth", "abyss"]
}
```

- [ ] **Step 2: Create data/genres/cyberpunk.json**

```json
{
  "LOCATION": ["neon alley", "chrome district", "the data sink", "corporate arcology sublevel", "black-market exchange"],
  "ANTAGONIST": ["corp enforcer", "rogue ICE", "the syndicate", "augmented bounty hunter"],
  "MACGUFFIN": ["data shard", "neural key", "corporate override code", "black ledger chip"],
  "THREAT": ["network lockdown", "killswitch signal", "the surveillance grid", "flatline protocol"],
  "CHARACTER": ["street fixer", "rogue archivist", "chrome runner", "signal ghost"],
  "ADJ": ["neon-soaked", "chrome-plated", "augmented", "encrypted", "static-laced"],
  "NOUN": ["signal", "wire", "static", "syndicate", "glitch"]
}
```

- [ ] **Step 3: Create data/genres/western.json**

```json
{
  "LOCATION": ["the last saloon", "dry canyon pass", "the railhead", "cursed homestead", "boot hill"],
  "ANTAGONIST": ["the Outfit", "iron deputy", "the cattlemen's cartel", "outlaw preacher"],
  "MACGUFFIN": ["land deed", "stolen payroll", "sheriff's manifest", "cursed coin"],
  "THREAT": ["the posse", "the drought", "sundown law", "the hanging judge"],
  "CHARACTER": ["drifter", "prairie doc", "telegraph operator", "wanted man"],
  "ADJ": ["sun-bleached", "dust-choked", "outlawed", "iron-willed", "drifting"],
  "NOUN": ["dust", "iron", "trail", "gulch", "brand"]
}
```

- [ ] **Step 4: Create data/genres/gonzo-journalism.json**

```json
{
  "LOCATION": ["press room floor", "convention hotel bar", "the governor's suite", "a rented convertible", "the press pool"],
  "ANTAGONIST": ["the editor", "party chairman", "the PR handler", "campaign security"],
  "MACGUFFIN": ["press credentials", "taped interview", "leaked memo", "campaign receipts"],
  "THREAT": ["publication deadline", "defamation suit", "the blackout", "credential revocation"],
  "CHARACTER": ["photographer", "campaign aide", "the source", "hotel bartender"],
  "ADJ": ["frantic", "ink-stained", "half-crazed", "unaccredited", "libellous"],
  "NOUN": ["deadline", "scoop", "headline", "lead", "byline"]
}
```

- [ ] **Step 5: Create data/genres/high-fantasy.json**

```json
{
  "LOCATION": ["the Shattered Keep", "Thornwood Forest", "the Mage Quarter", "bone cathedral", "the Undercroft"],
  "ANTAGONIST": ["the Lich Regent", "corrupted paladin", "the Hollow Court", "blood merchant"],
  "MACGUFFIN": ["the Sealed Tome", "shattered crown shard", "binding rune", "the Oath Stone"],
  "THREAT": ["the Unravelling", "curse propagation", "elder ward collapse", "the Tide of Ash"],
  "CHARACTER": ["hedge witch", "disgraced knight", "archive keeper", "reluctant oracle"],
  "ADJ": ["accursed", "crumbling", "spell-scarred", "eldritch", "forsaken"],
  "NOUN": ["rune", "shard", "curse", "oath", "wraith"]
}
```

- [ ] **Step 6: Create data/genres/cosmic-horror.json**

```json
{
  "LOCATION": ["the non-Euclidean library", "the observatory dome", "the drowned city", "the mirror threshold", "the humming site"],
  "ANTAGONIST": ["the Pale Congregation", "star-spawn", "the Custodian", "the dreaming thing"],
  "MACGUFFIN": ["the Forbidden Calculation", "star chart fragment", "bound idol", "the inverted key"],
  "THREAT": ["sanity dissolution", "the calling", "geometric impossibility", "the slow remembering"],
  "CHARACTER": ["the last researcher", "cultist defector", "the lighthouse keeper", "unnamed correspondent"],
  "ADJ": ["cyclopean", "non-Euclidean", "pale", "gibbering", "star-touched"],
  "NOUN": ["void", "angle", "dream", "signal", "threshold"]
}
```

- [ ] **Step 7: Commit**

```bash
git add data/genres/
git commit -m "feat: genre registry data files"
```

---

## Task 3: World Generator

**Files:**
- Create: `src/engine/world-generator.js`
- Create: `tests/engine/world-generator.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// tests/engine/world-generator.test.js
const path = require('path');
const { loadGenres, selectGenres, generateWorldName, fillSlot, generateWorld } = require('../../src/engine/world-generator');

describe('loadGenres', () => {
  it('loads at least 2 genres from data/genres/', () => {
    const genres = loadGenres();
    expect(genres.length).toBeGreaterThanOrEqual(2);
    expect(genres[0]).toHaveProperty('name');
    expect(genres[0]).toHaveProperty('vocab');
  });
});

describe('selectGenres', () => {
  it('selects 2–4 genres', () => {
    const genres = loadGenres();
    const results = Array.from({ length: 100 }, () => selectGenres(genres));
    const counts = results.map(r => r.length);
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...counts)).toBeLessThanOrEqual(4);
  });
});

describe('generateWorldName', () => {
  it('returns a non-empty string', () => {
    const genres = loadGenres().slice(0, 2);
    const name = generateWorldName(genres);
    expect(typeof name).toBe('string');
    expect(name.length).toBeGreaterThan(0);
  });

  it('does not contain raw slot tokens', () => {
    const genres = loadGenres().slice(0, 3);
    const name = generateWorldName(genres);
    expect(name).not.toMatch(/\{[A-Z]+\}/);
  });
});

describe('fillSlot', () => {
  it('returns primary genre noun with secondary adjective prepended', () => {
    const genres = loadGenres();
    const [primary, secondary] = genres.slice(0, 2);
    const result = fillSlot('ANTAGONIST', [primary, secondary]);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('generateWorld', () => {
  it('returns world with name and genres array', () => {
    const world = generateWorld();
    expect(world).toHaveProperty('name');
    expect(world).toHaveProperty('genres');
    expect(world.genres.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test tests/engine/world-generator.test.js
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Implement world-generator.js**

```js
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
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test tests/engine/world-generator.test.js
```

Expected: PASS (5 suites)

- [ ] **Step 5: Commit**

```bash
git add src/engine/world-generator.js tests/engine/world-generator.test.js
git commit -m "feat: world generator — genre selection, naming, slot filling"
```

---

## Task 4: Scene Template Data Files

**Files:** `data/scenes/act1-scene1.json` through `act3-scene8.json` (10 files + 2 fork variants = 12 total, but scenes 4–5 are fork-specific so 10 canonical scenes across 12 files)

Each file schema:
```json
{
  "id": "string",
  "act": 1|2|3,
  "descriptions": ["template string with {SLOT} tokens"],
  "commands": {
    "look": "response template",
    "go north": { "exit": "next-scene-id" },
    "take {MACGUFFIN}": "pickup response"
  },
  "exits": { "direction": "scene-id" },
  "tiles": ["location", "atmosphere"],
  "pivot_action": null | "take",
  "pivot_target_slot": null | "MACGUFFIN",
  "pivot_taken_scene": null | "scene-id",
  "pivot_skipped_scene": null | "scene-id"
}
```

- [ ] **Step 1: Create data/scenes/act1-scene1.json**

```json
{
  "id": "act1-scene1",
  "act": 1,
  "descriptions": [
    "You wake in {LOCATION}. The smell of {NOUN} is everywhere. Somewhere ahead, something stirs.",
    "A {ADJ} light reveals a {CHARACTER} watching you from the far end of the room. They don't speak."
  ],
  "commands": {
    "look": "The {ADJ} space stretches in all directions. A {CHARACTER} lingers near the exit. The path north is open.",
    "talk to {CHARACTER}": "The {CHARACTER} says only: 'Move. While you still can.'",
    "go north": { "exit": "act1-scene2" }
  },
  "exits": { "north": "act1-scene2" },
  "tiles": ["location", "character"],
  "pivot_action": null,
  "pivot_target_slot": null,
  "pivot_taken_scene": null,
  "pivot_skipped_scene": null
}
```

- [ ] **Step 2: Create data/scenes/act1-scene2.json**

```json
{
  "id": "act1-scene2",
  "act": 1,
  "descriptions": [
    "The corridor opens into a {LOCATION}. The walls are {ADJ}. An abandoned {MACGUFFIN} sits on a cracked surface nearby.",
    "Something about this place feels wrong. A distant sound — {THREAT} — echoes from the darkness ahead."
  ],
  "commands": {
    "look": "The {LOCATION} is {ADJ} and unsettling. The {MACGUFFIN} catches your eye. North leads deeper in.",
    "take {MACGUFFIN}": "You pocket the {MACGUFFIN}. It may matter later.",
    "go north": { "exit": "act1-scene3" },
    "go south": { "exit": "act1-scene1" }
  },
  "exits": { "north": "act1-scene3", "south": "act1-scene1" },
  "tiles": ["location", "atmosphere"],
  "pivot_action": null,
  "pivot_target_slot": null,
  "pivot_taken_scene": null,
  "pivot_skipped_scene": null
}
```

- [ ] **Step 3: Create data/scenes/act1-scene3.json** *(fork trigger)*

```json
{
  "id": "act1-scene3",
  "act": 1,
  "descriptions": [
    "You reach the threshold of {LOCATION}. The {ANTAGONIST} is close — you can feel it.",
    "On the ground near the exit: a {MACGUFFIN}. Do you take it, or keep moving?"
  ],
  "commands": {
    "look": "The exit is north. A {MACGUFFIN} lies at your feet. The {ANTAGONIST} is getting closer.",
    "take {MACGUFFIN}": "You snatch the {MACGUFFIN} and press north. Good call.",
    "go north": { "exit": "__fork__" }
  },
  "exits": { "north": "__fork__" },
  "tiles": ["location", "atmosphere"],
  "pivot_action": "take",
  "pivot_target_slot": "MACGUFFIN",
  "pivot_taken_scene": "act2a-scene4",
  "pivot_skipped_scene": "act2b-scene4"
}
```

- [ ] **Step 4: Create data/scenes/act2a-scene4.json** *(Path A — took the macguffin)*

```json
{
  "id": "act2a-scene4",
  "act": 2,
  "path": "A",
  "descriptions": [
    "The {MACGUFFIN} pulses in your hand as you enter {LOCATION}. It unlocked something.",
    "A {CHARACTER} steps out of the shadows. 'You have it,' they say. 'That changes things.'"
  ],
  "commands": {
    "look": "The {MACGUFFIN} glows faintly. The {CHARACTER} watches. North leads on.",
    "talk to {CHARACTER}": "'{MACGUFFIN}... I thought it was lost. We may have a chance.' They step aside.",
    "use {MACGUFFIN}": "You activate the {MACGUFFIN}. A passage opens to the east.",
    "go north": { "exit": "act2a-scene5" },
    "go east": { "exit": "act2a-scene5" }
  },
  "exits": { "north": "act2a-scene5", "east": "act2a-scene5" },
  "tiles": ["character", "atmosphere"],
  "pivot_action": null,
  "pivot_target_slot": null,
  "pivot_taken_scene": null,
  "pivot_skipped_scene": null
}
```

- [ ] **Step 5: Create data/scenes/act2a-scene5.json**

```json
{
  "id": "act2a-scene5",
  "act": 2,
  "path": "A",
  "descriptions": [
    "The {LOCATION} is {ADJ} with tension. The {ANTAGONIST} has caught your trail.",
    "The {CHARACTER} from before appears at your side. 'Through here. The {MACGUFFIN} will open the door.'"
  ],
  "commands": {
    "look": "The {ANTAGONIST} is visible at the far end. The ally holds the line. North is your escape.",
    "talk to {CHARACTER}": "'I'll hold them. Go north. Don't stop.'",
    "go north": { "exit": "act3-scene6" }
  },
  "exits": { "north": "act3-scene6" },
  "tiles": ["location", "character"],
  "pivot_action": null,
  "pivot_target_slot": null,
  "pivot_taken_scene": null,
  "pivot_skipped_scene": null
}
```

- [ ] **Step 6: Create data/scenes/act2b-scene4.json** *(Path B — left the macguffin)*

```json
{
  "id": "act2b-scene4",
  "act": 2,
  "path": "B",
  "descriptions": [
    "You move fast into {LOCATION}. No time to look back.",
    "But the {MACGUFFIN} — you feel its absence. The {ANTAGONIST} has it now."
  ],
  "commands": {
    "look": "The {ANTAGONIST} is somewhere behind you with the {MACGUFFIN}. Ahead is {LOCATION}. Keep moving.",
    "go north": { "exit": "act2b-scene5" }
  },
  "exits": { "north": "act2b-scene5" },
  "tiles": ["location", "atmosphere"],
  "pivot_action": null,
  "pivot_target_slot": null,
  "pivot_taken_scene": null,
  "pivot_skipped_scene": null
}
```

- [ ] **Step 7: Create data/scenes/act2b-scene5.json**

```json
{
  "id": "act2b-scene5",
  "act": 2,
  "path": "B",
  "descriptions": [
    "{LOCATION}. The {ANTAGONIST} is using the {MACGUFFIN} against you — you can feel it.",
    "A {CHARACTER} blocks your path. 'You should have taken it,' they say. 'Now we improvise.'"
  ],
  "commands": {
    "look": "The {CHARACTER} looks grim. The {ANTAGONIST} is closing in. North is the only option.",
    "talk to {CHARACTER}": "'I know another way. But it will cost us. Go north — now.'",
    "go north": { "exit": "act3-scene6" }
  },
  "exits": { "north": "act3-scene6" },
  "tiles": ["location", "character"],
  "pivot_action": null,
  "pivot_target_slot": null,
  "pivot_taken_scene": null,
  "pivot_skipped_scene": null
}
```

- [ ] **Step 8: Create data/scenes/act3-scene6.json**

```json
{
  "id": "act3-scene6",
  "act": 3,
  "descriptions": [
    "The final {LOCATION} opens before you. This is it.",
    "The {THREAT} has reached its peak. Whatever happens next happens here."
  ],
  "commands": {
    "look": "The {ANTAGONIST} is close. The {LOCATION} offers one last option. Go north.",
    "go north": { "exit": "act3-scene7" }
  },
  "exits": { "north": "act3-scene7" },
  "tiles": ["location", "atmosphere"],
  "pivot_action": null,
  "pivot_target_slot": null,
  "pivot_taken_scene": null,
  "pivot_skipped_scene": null
}
```

- [ ] **Step 9: Create data/scenes/act3-scene7.json**

```json
{
  "id": "act3-scene7",
  "act": 3,
  "descriptions": [
    "The confrontation. The {ANTAGONIST} stands between you and the exit.",
    "The {THREAT} is everywhere now. The only way out is through."
  ],
  "commands": {
    "look": "The {ANTAGONIST} is here. The exit is north. There is no going back.",
    "go north": { "exit": "act3-scene8" }
  },
  "exits": { "north": "act3-scene8" },
  "tiles": ["character", "atmosphere"],
  "pivot_action": null,
  "pivot_target_slot": null,
  "pivot_taken_scene": null,
  "pivot_skipped_scene": null
}
```

- [ ] **Step 10: Create data/scenes/act3-scene8.json** *(final scene — triggers completion)*

```json
{
  "id": "act3-scene8",
  "act": 3,
  "descriptions": [
    "You made it through.",
    "The {LOCATION} fades. The {THREAT} recedes. You stand at the edge of the world — and it was enough."
  ],
  "commands": {
    "look": "There is nothing left to look at. The story is over.",
    "go north": { "exit": "__complete__" }
  },
  "exits": { "north": "__complete__" },
  "tiles": ["atmosphere"],
  "is_final": true,
  "pivot_action": null,
  "pivot_target_slot": null,
  "pivot_taken_scene": null,
  "pivot_skipped_scene": null
}
```

- [ ] **Step 11: Commit**

```bash
git add data/scenes/
git commit -m "feat: scene template data files — 3-act structure, fork"
```

---

## Task 5: Tile Validator

**Files:**
- Create: `src/art/tile-validator.js`
- Create: `tests/art/tile-validator.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/art/tile-validator.test.js
const { validateTile, stripAnsi } = require('../../src/art/tile-validator');

const makeRow = (len) => ' '.repeat(len);
const makeValidTile = () => Array.from({ length: 12 }, () => makeRow(40)).join('\n');

describe('stripAnsi', () => {
  it('removes colour escape codes', () => {
    expect(stripAnsi('\x1b[31mred\x1b[0m')).toBe('red');
  });
  it('removes cursor movement codes', () => {
    expect(stripAnsi('\x1b[2Jtext')).toBe('text');
  });
});

describe('validateTile', () => {
  it('passes a 40x12 plain tile', () => {
    expect(validateTile(makeValidTile())).toEqual({ valid: true });
  });

  it('fails if row count is not 12', () => {
    const tile = Array.from({ length: 10 }, () => makeRow(40)).join('\n');
    const result = validateTile(tile);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/12/);
  });

  it('fails if a row is not 40 columns wide', () => {
    const rows = Array.from({ length: 12 }, () => makeRow(40));
    rows[3] = makeRow(35);
    const result = validateTile(rows.join('\n'));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/40/);
  });

  it('passes a tile with ANSI colour where stripped width is 40', () => {
    const ansiRow = '\x1b[32m' + ' '.repeat(40) + '\x1b[0m';
    const tile = Array.from({ length: 12 }, () => ansiRow).join('\n');
    expect(validateTile(tile)).toEqual({ valid: true });
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npm test tests/art/tile-validator.test.js
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Implement tile-validator.js**

```js
// src/art/tile-validator.js
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
```

- [ ] **Step 4: Run — verify passes**

```bash
npm test tests/art/tile-validator.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/art/tile-validator.js tests/art/tile-validator.test.js
git commit -m "feat: tile validator — 40x12 ANSI constraint"
```

---

## Task 6: Seed ANSI Tile Files

Create the minimum hand-crafted tiles to bootstrap the library (3 per genre, 2 genres minimum = 6 tiles). Tiles must be exactly 40 columns × 12 rows.

**Files:** `tiles/deep-sea/location-trench.ans`, `tiles/deep-sea/atmosphere-bioluminescence.ans`, `tiles/deep-sea/character-drowned.ans`, `tiles/cyberpunk/location-neon-alley.ans`, `tiles/cyberpunk/character-chrome-fixer.ans`, `tiles/western/location-saloon.ans`, `tiles/western/atmosphere-desert.ans`

- [ ] **Step 1: Create tiles/deep-sea/location-trench.ans**

Exactly 40 columns × 12 rows. Use ANSI colour codes. Every visible character count per row must equal 40.

```
\x1b[34m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\x1b[0m
\x1b[34m~~ \x1b[36m.  .  .  .  .\x1b[34m               ~~~\x1b[0m
\x1b[34m~   \x1b[36m*        *\x1b[34m      .           ~\x1b[0m
\x1b[34m     \x1b[36m.   ____   .\x1b[34m    .            \x1b[0m
\x1b[34m      \x1b[36m__|    |__\x1b[34m                  \x1b[0m
\x1b[34m     \x1b[36m|  TRENCH  |\x1b[34m                 \x1b[0m
\x1b[34m     \x1b[36m|__      __|\x1b[34m    .            \x1b[0m
\x1b[34m        \x1b[36m|    |\x1b[34m        .           \x1b[0m
\x1b[34m   .    \x1b[36m|    |\x1b[34m   .                \x1b[0m
\x1b[34m        \x1b[36m|    |\x1b[34m                    \x1b[0m
\x1b[30m########################################\x1b[0m
\x1b[30m########################################\x1b[0m
```

**Important:** Write each `.ans` file as raw text where each row is exactly 40 visible characters wide. Use a simple script to verify:

```bash
node -e "
const fs = require('fs');
const { validateTile } = require('./src/art/tile-validator');
const files = require('fs').readdirSync('./tiles', {recursive:true})
  .filter(f=>f.endsWith('.ans'));
files.forEach(f => {
  const r = validateTile(fs.readFileSync('./tiles/'+f,'utf8'));
  console.log(f, r.valid ? 'OK' : r.error);
});
"
```

Because hand-writing correct ANSI tiles is error-prone, use this simpler format for all seed tiles — plain ASCII art, no colour escapes, exactly 40 chars per row padded with spaces:

```
# tiles/deep-sea/location-trench.ans — plain ASCII, no colour
```

Create each tile as 12 lines of exactly 40 characters (pad with spaces to reach 40). Here are all 7 seed tiles in plain ASCII — pad each line to exactly 40 chars:

- [ ] **Step 2: Create tiles/deep-sea/location-trench.ans** (12 rows × 40 cols, plain ASCII)

```
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~ .  .  .  .  .             ~~~
~   *        *      .           ~
     .  [TRENCH WALL]  .
      __|              |__
     |    ABYSSAL DEPTH   |
     |__                __|
        |              |
   .    |              |   .
        |              |
########################################
########################################
```

Run the verify script above after each tile creation. Fix any rows that aren't exactly 40 chars.

- [ ] **Step 3: Create remaining 6 seed tiles** following the same approach

Filenames:
- `tiles/deep-sea/atmosphere-bioluminescence.ans`
- `tiles/deep-sea/character-drowned.ans`
- `tiles/cyberpunk/location-neon-alley.ans`
- `tiles/cyberpunk/character-chrome-fixer.ans`
- `tiles/western/location-saloon.ans`
- `tiles/western/atmosphere-desert.ans`

Each: 12 rows, 40 visible chars per row, ASCII art themed to the filename.

- [ ] **Step 4: Run tile validator on all seed files**

```bash
node -e "
const fs = require('fs');
const path = require('path');
const { validateTile } = require('./src/art/tile-validator');
function walk(dir) {
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(e =>
    e.isDirectory() ? walk(path.join(dir,e.name)) : [path.join(dir,e.name)]
  );
}
walk('./tiles').filter(f=>f.endsWith('.ans')).forEach(f => {
  const r = validateTile(fs.readFileSync(f,'utf8'));
  console.log(path.relative('.',f), r.valid ? 'OK' : r.error);
});
"
```

Expected: all tiles print "OK".

- [ ] **Step 5: Commit**

```bash
git add tiles/
git commit -m "feat: seed ANSI tile library"
```

---

## Task 7: Tile Library

**Files:**
- Create: `src/art/tile-library.js`
- Create: `tests/art/tile-library.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/art/tile-library.test.js
const path = require('path');
const { loadTile, findTile, tileCount } = require('../../src/art/tile-library');

describe('tileCount', () => {
  it('returns a number >= 0', () => {
    expect(typeof tileCount()).toBe('number');
    expect(tileCount()).toBeGreaterThanOrEqual(0);
  });
});

describe('findTile', () => {
  it('returns a tile path for an existing genre', () => {
    const result = findTile({ genres: ['deep-sea'], sceneType: 'location' });
    expect(result).toBeTruthy();
    expect(result).toMatch(/\.ans$/);
  });

  it('falls back to any same-type tile when genre has none', () => {
    const result = findTile({ genres: ['nonexistent-genre'], sceneType: 'location' });
    expect(result).toBeTruthy();
  });

  it('falls back to any tile when nothing else matches', () => {
    const result = findTile({ genres: ['nonexistent'], sceneType: 'nonexistent' });
    expect(result).toBeTruthy();
  });
});

describe('loadTile', () => {
  it('returns file content as a string', () => {
    const tilePath = findTile({ genres: ['deep-sea'], sceneType: 'location' });
    const content = loadTile(tilePath);
    expect(typeof content).toBe('string');
    expect(content.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npm test tests/art/tile-library.test.js
```

Expected: FAIL

- [ ] **Step 3: Implement tile-library.js**

```js
// src/art/tile-library.js
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

// Resolution: (1) matching genre+type, (2) matching type any genre, (3) any tile
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
```

- [ ] **Step 4: Run — verify passes**

```bash
npm test tests/art/tile-library.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/art/tile-library.js tests/art/tile-library.test.js
git commit -m "feat: tile library — load and fallback resolution"
```

---

## Task 8: Tile Compositor

**Files:**
- Create: `src/art/tile-compositor.js`
- Create: `tests/art/tile-compositor.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/art/tile-compositor.test.js
const { compositeTiles } = require('../../src/art/tile-compositor');
const { validateTile } = require('../../src/art/tile-validator');

const makeTile = () => Array.from({ length: 12 }, () => ' '.repeat(40)).join('\n');

describe('compositeTiles', () => {
  it('returns single tile unchanged', () => {
    const tile = makeTile();
    expect(compositeTiles([tile])).toBe(tile);
  });

  it('composites 2 tiles side by side (80 cols wide)', () => {
    const result = compositeTiles([makeTile(), makeTile()]);
    const rows = result.split('\n').filter(Boolean);
    expect(rows).toHaveLength(12);
    rows.forEach(row => expect(row.length).toBe(80));
  });

  it('composites 3 tiles side by side (120 cols wide)', () => {
    const result = compositeTiles([makeTile(), makeTile(), makeTile()]);
    const rows = result.split('\n').filter(Boolean);
    expect(rows).toHaveLength(12);
    rows.forEach(row => expect(row.length).toBe(120));
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npm test tests/art/tile-compositor.test.js
```

Expected: FAIL

- [ ] **Step 3: Implement tile-compositor.js**

```js
// src/art/tile-compositor.js
function tileRows(content) {
  const lines = content.split('\n');
  return lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines;
}

function compositeTiles(tileContents) {
  if (tileContents.length === 1) return tileContents[0];
  const parsed = tileContents.map(tileRows);
  const result = [];
  for (let row = 0; row < 12; row++) {
    result.push(parsed.map(t => t[row] ?? ' '.repeat(40)).join(''));
  }
  return result.join('\n');
}

module.exports = { compositeTiles };
```

- [ ] **Step 4: Run — verify passes**

```bash
npm test tests/art/tile-compositor.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/art/tile-compositor.js tests/art/tile-compositor.test.js
git commit -m "feat: tile compositor — side-by-side ANSI tile assembly"
```

---

## Task 9: Write Queue

**Files:**
- Create: `src/storage/write-queue.js`
- Create: `tests/storage/write-queue.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/storage/write-queue.test.js
const { createWriteQueue } = require('../../src/storage/write-queue');

describe('createWriteQueue', () => {
  it('executes tasks in order', async () => {
    const queue = createWriteQueue();
    const order = [];
    await Promise.all([
      queue.enqueue(async () => { order.push(1); }),
      queue.enqueue(async () => { order.push(2); }),
      queue.enqueue(async () => { order.push(3); }),
    ]);
    expect(order).toEqual([1, 2, 3]);
  });

  it('runs only one task at a time', async () => {
    const queue = createWriteQueue();
    let concurrent = 0;
    let maxConcurrent = 0;
    const task = () => new Promise(resolve => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      setImmediate(() => { concurrent--; resolve(); });
    });
    await Promise.all([queue.enqueue(task), queue.enqueue(task), queue.enqueue(task)]);
    expect(maxConcurrent).toBe(1);
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npm test tests/storage/write-queue.test.js
```

Expected: FAIL

- [ ] **Step 3: Implement write-queue.js**

```js
// src/storage/write-queue.js
function createWriteQueue() {
  let tail = Promise.resolve();

  function enqueue(task) {
    tail = tail.then(() => task()).catch(() => {});
    return tail;
  }

  return { enqueue };
}

module.exports = { createWriteQueue };
```

- [ ] **Step 4: Run — verify passes**

```bash
npm test tests/storage/write-queue.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/storage/write-queue.js tests/storage/write-queue.test.js
git commit -m "feat: serial write queue for safe concurrent tile commits"
```

---

## Task 10: Graveyard Store

**Files:**
- Create: `src/storage/graveyard-store.js`
- Create: `tests/storage/graveyard-store.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/storage/graveyard-store.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createGraveyardStore } = require('../../src/storage/graveyard-store');

let tmpDir;
let store;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graveyard-test-'));
  store = createGraveyardStore(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

describe('writeMemorial', () => {
  it('creates a markdown file in the graveyard dir', async () => {
    await store.writeMemorial({
      worldName: 'Test World',
      genres: ['deep-sea', 'cyberpunk'],
      act: 1, scene: 2,
      memorial: 'It was a short journey.\n\nYou left too soon.',
      timestamp: '2026-03-18T12:00:00Z',
    });
    const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.md'));
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/test-world/);
  });
});

describe('writeCompleted', () => {
  it('appends a line to completed.log', async () => {
    await store.writeCompleted({
      worldName: 'Done World',
      genres: ['western'],
      scenes: 10,
      timestamp: '2026-03-18T13:00:00Z',
    });
    const log = path.join(path.dirname(tmpDir), 'completed.log');
    // completed.log is one level up, passed via option or relative path
    // For test simplicity, check the file exists in tmpDir
    const files = fs.readdirSync(tmpDir);
    expect(files.some(f => f === 'completed.log')).toBe(true);
  });
});

describe('listMemorials', () => {
  it('returns an array of memorial summaries', async () => {
    await store.writeMemorial({
      worldName: 'Lost World',
      genres: ['high-fantasy'],
      act: 2, scene: 1,
      memorial: 'You vanished in the Shattered Keep.\n\nForgettable.',
      timestamp: '2026-03-18T14:00:00Z',
    });
    const list = store.listMemorials();
    expect(list.length).toBe(1);
    expect(list[0]).toHaveProperty('worldName');
    expect(list[0]).toHaveProperty('slug');
    expect(list[0]).toHaveProperty('firstLine');
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npm test tests/storage/graveyard-store.test.js
```

Expected: FAIL

- [ ] **Step 3: Implement graveyard-store.js**

```js
// src/storage/graveyard-store.js
const fs = require('fs');
const path = require('path');

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function createGraveyardStore(graveyardDir) {
  if (!fs.existsSync(graveyardDir)) fs.mkdirSync(graveyardDir, { recursive: true });
  const completedLog = path.join(graveyardDir, 'completed.log');

  // Deduplicate slugs
  function uniqueSlug(base) {
    const existing = fs.readdirSync(graveyardDir).map(f => f.replace(/^\d{4}-\d{2}-\d{2}T[\d-]+-/, '').replace('.md', ''));
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
```

- [ ] **Step 4: Fix test — `writeCompleted` uses `graveyardDir` for the log path**

Update the test's assertion for `writeCompleted`:

```js
it('appends a line to completed.log', async () => {
  await store.writeCompleted({
    worldName: 'Done World',
    genres: ['western'],
    scenes: 10,
    timestamp: '2026-03-18T13:00:00Z',
  });
  const logPath = path.join(tmpDir, 'completed.log');
  expect(fs.existsSync(logPath)).toBe(true);
  expect(fs.readFileSync(logPath, 'utf8')).toMatch('Done World');
});
```

- [ ] **Step 5: Run — verify passes**

```bash
npm test tests/storage/graveyard-store.test.js
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/storage/graveyard-store.js tests/storage/graveyard-store.test.js
git commit -m "feat: graveyard store — memorials, completed log, index"
```

---

## Task 11: Scene Manager

**Files:**
- Create: `src/engine/scene-manager.js`
- Create: `tests/engine/scene-manager.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/engine/scene-manager.test.js
const { createSceneManager } = require('../../src/engine/scene-manager');
const { generateWorld } = require('../../src/engine/world-generator');

let manager;
let world;

beforeEach(() => {
  world = generateWorld();
  manager = createSceneManager(world);
});

describe('loadScene', () => {
  it('loads act1-scene1', () => {
    const scene = manager.loadScene('act1-scene1');
    expect(scene).toHaveProperty('id', 'act1-scene1');
    expect(scene).toHaveProperty('description');
    expect(typeof scene.description).toBe('string');
    expect(scene.description).not.toMatch(/\{[A-Z]+\}/);
  });

  it('fills slot tokens with genre vocab', () => {
    const scene = manager.loadScene('act1-scene1');
    expect(scene.description.length).toBeGreaterThan(10);
  });
});

describe('resolveExit', () => {
  it('returns next scene id for a normal exit', () => {
    const scene = manager.loadScene('act1-scene1');
    const next = manager.resolveExit(scene, 'north');
    expect(next).toBe('act1-scene2');
  });
});

describe('fork resolution', () => {
  it('returns pivot_taken_scene when pivot was taken', () => {
    manager.setPivotTaken(true);
    const scene = manager.loadScene('act1-scene3');
    const next = manager.resolveExit(scene, 'north');
    expect(next).toBe('act2a-scene4');
  });

  it('returns pivot_skipped_scene when pivot was not taken', () => {
    manager.setPivotTaken(false);
    const scene = manager.loadScene('act1-scene3');
    const next = manager.resolveExit(scene, 'north');
    expect(next).toBe('act2b-scene4');
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npm test tests/engine/scene-manager.test.js
```

Expected: FAIL

- [ ] **Step 3: Implement scene-manager.js**

```js
// src/engine/scene-manager.js
const fs = require('fs');
const path = require('path');
const { fillSlot } = require('./world-generator');

const SCENES_DIR = path.join(__dirname, '../../data/scenes');

function loadSceneTemplate(sceneId) {
  const filePath = path.join(SCENES_DIR, `${sceneId}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function fillTemplate(text, world) {
  return text.replace(/\{([A-Z]+)\}/g, (_, slot) => fillSlot(slot, world.genres));
}

function fillScene(template, world) {
  const descIndex = Math.min(
    Math.floor(Math.random() * template.descriptions.length),
    template.descriptions.length - 1
  );
  const description = template.descriptions
    .slice(0, Math.min(3, template.descriptions.length))
    .map(d => fillTemplate(d, world))
    .join('\n\n');

  const commands = {};
  for (const [cmd, val] of Object.entries(template.commands)) {
    const filledCmd = fillTemplate(cmd, world);
    if (typeof val === 'string') {
      commands[filledCmd] = fillTemplate(val, world);
    } else {
      commands[filledCmd] = val;
    }
  }

  return {
    id: template.id,
    act: template.act,
    description,
    commands,
    exits: template.exits,
    tiles: template.tiles,
    is_final: template.is_final || false,
    pivot_action: template.pivot_action,
    pivot_target_slot: template.pivot_target_slot,
    pivot_taken_scene: template.pivot_taken_scene,
    pivot_skipped_scene: template.pivot_skipped_scene,
  };
}

function createSceneManager(world) {
  let pivotTaken = false;

  function loadScene(sceneId) {
    const template = loadSceneTemplate(sceneId);
    return fillScene(template, world);
  }

  function setPivotTaken(value) {
    pivotTaken = value;
  }

  function isPivotTaken() {
    return pivotTaken;
  }

  function resolveExit(scene, direction) {
    const rawExit = scene.exits[direction];
    if (!rawExit) return null;
    if (rawExit !== '__fork__') return rawExit;
    return pivotTaken ? scene.pivot_taken_scene : scene.pivot_skipped_scene;
  }

  return { loadScene, setPivotTaken, isPivotTaken, resolveExit };
}

module.exports = { createSceneManager };
```

- [ ] **Step 4: Run — verify passes**

```bash
npm test tests/engine/scene-manager.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/scene-manager.js tests/engine/scene-manager.test.js
git commit -m "feat: scene manager — template filling, fork resolution"
```

---

## Task 12: Command Processor

**Files:**
- Create: `src/engine/command-processor.js`
- Create: `tests/engine/command-processor.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/engine/command-processor.test.js
const { processCommand } = require('../../src/engine/command-processor');

const scene = {
  commands: {
    'look': 'You see a drowned enforcer.',
    'go north': { exit: 'act1-scene2' },
    'take pressure capsule': 'You pick it up.',
  },
  exits: { north: 'act1-scene2' },
  pivot_action: 'take',
  pivot_target_slot: 'MACGUFFIN',
};

describe('processCommand', () => {
  it('matches exact command and returns response text', () => {
    const result = processCommand('look', scene);
    expect(result.type).toBe('response');
    expect(result.text).toBe('You see a drowned enforcer.');
  });

  it('matches go command and returns exit', () => {
    const result = processCommand('go north', scene);
    expect(result.type).toBe('exit');
    expect(result.direction).toBe('north');
  });

  it('detects pivot action taken', () => {
    const result = processCommand('take pressure capsule', scene);
    expect(result.pivotTaken).toBe(true);
  });

  it('returns unknown for unrecognized command', () => {
    const result = processCommand('dance', scene);
    expect(result.type).toBe('unknown');
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npm test tests/engine/command-processor.test.js
```

Expected: FAIL

- [ ] **Step 3: Implement command-processor.js**

```js
// src/engine/command-processor.js
function processCommand(input, scene) {
  const trimmed = input.trim().toLowerCase();

  // Check for pivot action (e.g. "take <anything>")
  const pivotTaken = scene.pivot_action && trimmed.startsWith(scene.pivot_action + ' ');

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
```

- [ ] **Step 4: Run — verify passes**

```bash
npm test tests/engine/command-processor.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/command-processor.js tests/engine/command-processor.test.js
git commit -m "feat: command processor — parse commands, detect pivot"
```

---

## Task 13: Session State Machine

**Files:**
- Create: `src/engine/session.js`
- Create: `tests/engine/session.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/engine/session.test.js
const { createSession } = require('../../src/engine/session');

function makeSession(onOutput) {
  return createSession({
    id: 'test-session',
    onOutput: onOutput || jest.fn(),
    onComplete: jest.fn(),
    onLost: jest.fn(),
    graveyardStore: { writeMemorial: jest.fn(), writeCompleted: jest.fn() },
    memorialGenerator: { generate: jest.fn().mockResolvedValue('A sad tale.') },
    tileLibrary: { findTile: jest.fn().mockReturnValue('tiles/deep-sea/location-trench.ans'), loadTile: jest.fn().mockReturnValue(' '.repeat(40)+'\n'.repeat(11) + ' '.repeat(40)) },
    tileCompositor: { compositeTiles: jest.fn().mockReturnValue(' '.repeat(40)) },
    tileGenerator: { maybeGenerateTile: jest.fn().mockResolvedValue(null) },
  });
}

describe('createSession', () => {
  it('starts in loading state', () => {
    const session = makeSession();
    expect(session.state).toBe('loading');
  });
});

describe('session.start()', () => {
  it('transitions to playing and emits output', async () => {
    const output = jest.fn();
    const session = makeSession(output);
    await session.start();
    expect(session.state).toBe('playing');
    expect(output).toHaveBeenCalled();
  });
});

describe('session.command()', () => {
  it('emits a response for known command', async () => {
    const output = jest.fn();
    const session = makeSession(output);
    await session.start();
    output.mockClear();
    await session.command('look');
    expect(output).toHaveBeenCalled();
  });

  it('records commands in history (capped at 20)', async () => {
    const session = makeSession();
    await session.start();
    for (let i = 0; i < 25; i++) await session.command('look');
    expect(session.commandHistory.length).toBeLessThanOrEqual(20);
  });
});

describe('session.disconnect()', () => {
  it('transitions to lost state and calls onLost', async () => {
    const onLost = jest.fn();
    const session = createSession({
      id: 'x',
      onOutput: jest.fn(),
      onComplete: jest.fn(),
      onLost,
      graveyardStore: { writeMemorial: jest.fn(), writeCompleted: jest.fn() },
      memorialGenerator: { generate: jest.fn().mockResolvedValue('Gone.') },
      tileLibrary: { findTile: jest.fn().mockReturnValue('f.ans'), loadTile: jest.fn().mockReturnValue(' '.repeat(40)+('\n'+' '.repeat(40)).repeat(11)) },
      tileCompositor: { compositeTiles: jest.fn().mockReturnValue('') },
      tileGenerator: { maybeGenerateTile: jest.fn().mockResolvedValue(null) },
    });
    await session.start();
    await session.disconnect();
    expect(session.state).toBe('lost');
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npm test tests/engine/session.test.js
```

Expected: FAIL

- [ ] **Step 3: Implement session.js**

```js
// src/engine/session.js
const { createSceneManager } = require('./scene-manager');
const { processCommand } = require('./command-processor');
const { generateWorld } = require('./world-generator');

const STATES = { LOADING: 'loading', PLAYING: 'playing', COMPLETE: 'complete', LOST: 'lost' };

const HELP_TEXT = 'Commands: look | go [direction] | take [item] | talk to [character] | use [item]';

function createSession({ id, onOutput, onComplete, onLost, graveyardStore, memorialGenerator, tileLibrary, tileCompositor, tileGenerator }) {
  const world = generateWorld();
  const sceneManager = createSceneManager(world);

  let state = STATES.LOADING;
  let currentScene = null;
  let commandHistory = [];

  async function renderScene(scene) {
    // Composite tiles
    const genreNames = world.genres.map(g => g.name);
    const tilePaths = scene.tiles.map(type => tileLibrary.findTile({ genres: genreNames, sceneType: type }));
    const tileContents = tilePaths.map(p => tileLibrary.loadTile(p));
    const art = tileCompositor.compositeTiles(tileContents);

    onOutput('\x1b[2J\x1b[H'); // clear screen
    onOutput(art + '\n\n');
    onOutput('\x1b[1m' + world.name + '\x1b[0m\n\n');
    onOutput(scene.description + '\n\n');
    onOutput('\x1b[2m' + HELP_TEXT + '\x1b[0m\n');
    onOutput('> ');

    // Background: maybe generate new tile
    tileGenerator.maybeGenerateTile({ genres: genreNames, sceneType: scene.tiles[0] }).catch(() => {});
  }

  async function start() {
    state = STATES.PLAYING;
    onOutput('\x1b[2J\x1b[H');
    onOutput('A world is being assembled for you.\nDo not disconnect until the story ends.\n\n');
    currentScene = sceneManager.loadScene('act1-scene1');
    await renderScene(currentScene);
  }

  async function command(input) {
    if (state !== STATES.PLAYING) return;
    const trimmed = input.trim();
    if (!trimmed) { onOutput('> '); return; }

    commandHistory = [...commandHistory.slice(-19), trimmed];

    const result = processCommand(trimmed.toLowerCase(), currentScene);

    if (result.pivotTaken) {
      sceneManager.setPivotTaken(true);
    }

    if (result.type === 'response') {
      onOutput('\n' + result.text + '\n\n> ');
      return;
    }

    if (result.type === 'exit') {
      const nextId = sceneManager.resolveExit(currentScene, result.direction);
      if (!nextId) { onOutput('\nYou cannot go that way.\n\n> '); return; }
      if (nextId === '__complete__') { await complete(); return; }
      currentScene = sceneManager.loadScene(nextId);
      await renderScene(currentScene);
      if (currentScene.is_final) {
        // final scene renders, then next 'go' exits — handled above
      }
      return;
    }

    onOutput('\nUnknown command. ' + HELP_TEXT + '\n\n> ');
  }

  async function complete() {
    state = STATES.COMPLETE;
    onOutput('\n\n\x1b[1mThe story ends.\x1b[0m\n\nCONNECTION CLOSED.\n');
    await graveyardStore.writeCompleted({
      worldName: world.name,
      genres: world.genres.map(g => g.name),
      scenes: 10,
      timestamp: new Date().toISOString(),
    });
    onComplete(id);
  }

  async function disconnect() {
    if (state !== STATES.PLAYING) return;
    state = STATES.LOST;
    const act = currentScene ? currentScene.act : 1;
    const sceneNum = currentScene ? currentScene.id : 'unknown';
    const memorial = await memorialGenerator.generate({
      worldName: world.name,
      genres: world.genres.map(g => g.name),
      act, scene: sceneNum,
      commands: commandHistory,
    });
    await graveyardStore.writeMemorial({
      worldName: world.name,
      genres: world.genres.map(g => g.name),
      act, scene: sceneNum,
      memorial,
      timestamp: new Date().toISOString(),
    });
    onLost(id);
  }

  return {
    get state() { return state; },
    get commandHistory() { return commandHistory; },
    start, command, disconnect,
  };
}

module.exports = { createSession };
```

- [ ] **Step 4: Run — verify passes**

```bash
npm test tests/engine/session.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/session.js tests/engine/session.test.js
git commit -m "feat: session state machine — play, complete, disconnect"
```

---

## Task 14: Memorial Generator

**Files:**
- Create: `src/api/memorial-generator.js`

No unit test (wraps external API). The session test already mocks it.

- [ ] **Step 1: Create src/api/memorial-generator.js**

```js
// src/api/memorial-generator.js
const Anthropic = require('@anthropic-ai/sdk');

const VOICE = `You are a Love Island host having a very bad personal day, and not afraid to let it show. Passive-aggressive. Slightly bereaved. Personally affronted by the disconnection. Cannot believe the player did this to you. Write a 2–3 paragraph memorial.`;

function createMemorialGenerator(apiKey) {
  const client = new Anthropic({ apiKey });

  async function generate({ worldName, genres, act, scene, commands }) {
    const prompt = `The player was exploring "${worldName}" (genres: ${genres.join(', ')}). They reached Act ${act}, scene ${scene}. Their last commands were: ${commands.slice(-10).join(', ') || 'none'}. They then disconnected prematurely. Write a memorial.`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: VOICE,
      messages: [{ role: 'user', content: prompt }],
    });

    return message.content[0].text;
  }

  return { generate };
}

module.exports = { createMemorialGenerator };
```

- [ ] **Step 2: Commit**

```bash
git add src/api/memorial-generator.js
git commit -m "feat: memorial generator — Love Island host voice via Claude"
```

---

## Task 15: Tile Generator

**Files:**
- Create: `src/art/tile-generator.js`

- [ ] **Step 1: Create src/art/tile-generator.js**

```js
// src/art/tile-generator.js
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { validateTile } = require('./tile-validator');

const TILES_DIR = path.join(__dirname, '../../tiles');
const TILE_BUDGET_MAX = 200;
const TILE_BUDGET_PER_SESSION_FULL = 10;
const TILE_BUDGET_PER_SESSION_STABLE = 2;
const MAX_RETRIES = 2;

const TILE_PROMPT = (genres, sceneType) =>
  `Generate a 40-column × 12-row ASCII art tile.
Genre tags: ${genres.join(', ')}
Scene type: ${sceneType}
Use plain ASCII characters (no ANSI colour). Every row must be exactly 40 characters wide (pad with spaces). Output only the 12 rows, no commentary, no blank lines before or after.`;

function createTileGenerator(apiKey, writeQueue, tileLibrary) {
  const client = new Anthropic({ apiKey });
  let sessionGenerated = 0;

  async function generateOneTile(genres, sceneType) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: TILE_PROMPT(genres, sceneType) }],
      });
      const content = message.content[0].text.trim();
      const result = validateTile(content);
      if (result.valid) return content;
    }
    return null;
  }

  async function maybeGenerateTile({ genres, sceneType }) {
    const count = tileLibrary.tileCount ? tileLibrary.tileCount() : 999;
    const budget = count < TILE_BUDGET_MAX ? TILE_BUDGET_PER_SESSION_FULL : TILE_BUDGET_PER_SESSION_STABLE;
    if (sessionGenerated >= budget) return null;

    return writeQueue.enqueue(async () => {
      // Re-check count inside queue (serial, so no race)
      const currentCount = tileLibrary.getAllTilePaths ? tileLibrary.getAllTilePaths().length : 999;
      const currentBudget = currentCount < TILE_BUDGET_MAX ? TILE_BUDGET_PER_SESSION_FULL : TILE_BUDGET_PER_SESSION_STABLE;
      if (sessionGenerated >= currentBudget) return;

      const content = await generateOneTile(genres, sceneType);
      if (!content) return;

      const genre = genres[0];
      const tileName = `${sceneType}-generated-${Date.now()}.ans`;
      const tileDir = path.join(TILES_DIR, genre);
      fs.mkdirSync(tileDir, { recursive: true });
      fs.writeFileSync(path.join(tileDir, tileName), content, 'utf8');
      sessionGenerated++;
    });
  }

  return { maybeGenerateTile };
}

module.exports = { createTileGenerator };
```

- [ ] **Step 2: Commit**

```bash
git add src/art/tile-generator.js
git commit -m "feat: tile generator — Claude-generated tiles with budget and retry"
```

---

## Task 16: Render Utilities

**Files:**
- Create: `src/interfaces/render.js`

- [ ] **Step 1: Create src/interfaces/render.js**

```js
// src/interfaces/render.js
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CLEAR = '\x1b[2J\x1b[H';

function bold(text) { return `${BOLD}${text}${RESET}`; }
function dim(text) { return `${DIM}${text}${RESET}`; }
function clear() { return CLEAR; }

function divider(width = 40) { return '─'.repeat(width); }

function formatScene(worldName, art, description, helpText) {
  return [
    clear(),
    art,
    '',
    bold(worldName),
    '',
    description,
    '',
    dim(helpText),
    '> ',
  ].join('\n');
}

module.exports = { bold, dim, clear, divider, formatScene };
```

- [ ] **Step 2: Commit**

```bash
git add src/interfaces/render.js
git commit -m "feat: render utilities — ANSI formatting helpers"
```

---

## Task 17: SSH Server

**Files:**
- Create: `src/interfaces/ssh-server.js`

- [ ] **Step 1: Create src/interfaces/ssh-server.js**

```js
// src/interfaces/ssh-server.js
const { Server } = require('ssh2');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createSession } = require('../engine/session');

const KEY_PATH = path.join(__dirname, '../../.ssh/host_key');

function ensureHostKey() {
  const keyDir = path.dirname(KEY_PATH);
  if (!fs.existsSync(keyDir)) fs.mkdirSync(keyDir, { recursive: true });
  if (!fs.existsSync(KEY_PATH)) {
    const { privateKey } = crypto.generateKeyPairSync('ed25519');
    fs.writeFileSync(KEY_PATH, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  }
  return fs.readFileSync(KEY_PATH);
}

function createSSHServer({ port, deps }) {
  const hostKey = ensureHostKey();

  const server = new Server({ hostKeys: [hostKey] }, (client) => {
    let session = null;

    client.on('authentication', ctx => ctx.accept());
    client.on('ready', () => {
      client.once('session', (accept) => {
        const sshSession = accept();

        // Handle graveyard SSH command: `ssh host graveyard` or `ssh host graveyard 1`
        sshSession.once('exec', (accept, reject, info) => {
          const parts = info.command.trim().split(/\s+/);
          if (parts[0] !== 'graveyard') { reject(); return; }
          const stream = accept();
          const memorials = deps.graveyardStore.listMemorials();
          const lost = memorials.length;

          if (parts[1]) {
            // Read individual memorial by 1-based index
            const idx = parseInt(parts[1], 10) - 1;
            if (isNaN(idx) || idx < 0 || idx >= memorials.length) {
              stream.write(`No memorial at index ${parts[1]}. There are ${lost} worlds lost.\n`);
            } else {
              const content = deps.graveyardStore.getMemorial(memorials[idx].slug);
              stream.write((content || 'Memorial not found.') + '\n');
            }
          } else {
            // List index
            stream.write(`${lost} world${lost !== 1 ? 's' : ''} have been lost.\n\n`);
            memorials.forEach((m, i) => {
              stream.write(`[${i + 1}] ${m.worldName} — ${m.firstLine}\n`);
            });
            stream.write('\nRead a memorial: ssh [host] graveyard [number]\n');
          }

          stream.exit(0);
          stream.end();
          client.end();
        });

        sshSession.once('pty', (accept) => { accept(); });
        sshSession.once('shell', (accept) => {
          const stream = accept();

          const id = `ssh-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          session = createSession({
            id,
            onOutput: (text) => stream.write(text),
            onComplete: () => { stream.end(); client.end(); },
            onLost: () => {},
            ...deps,
          });

          session.start().catch(err => stream.write('\nError: ' + err.message + '\n'));

          let inputBuf = '';
          stream.on('data', (data) => {
            const str = data.toString();
            for (const ch of str) {
              if (ch === '\r' || ch === '\n') {
                stream.write('\r\n');
                session.command(inputBuf);
                inputBuf = '';
              } else if (ch === '\x7f' || ch === '\b') {
                if (inputBuf.length > 0) {
                  inputBuf = inputBuf.slice(0, -1);
                  stream.write('\b \b');
                }
              } else {
                inputBuf += ch;
                stream.write(ch);
              }
            }
          });

          stream.on('close', () => {
            if (session) session.disconnect();
          });
        });
      });
    });

    client.on('close', () => {
      if (session) session.disconnect();
    });
  });

  return {
    listen() {
      server.listen(port, '0.0.0.0', () => {
        console.log(`SSH server listening on port ${port}`);
      });
    },
  };
}

module.exports = { createSSHServer };
```

- [ ] **Step 2: Commit**

```bash
git add src/interfaces/ssh-server.js
git commit -m "feat: SSH server — PTY, line editing, graveyard command"
```

---

## Task 18: Web Server

**Files:**
- Create: `src/interfaces/web-server.js`

- [ ] **Step 1: Create src/interfaces/web-server.js**

```js
// src/interfaces/web-server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { createSession } = require('../engine/session');

const GRACE_PERIOD_MS = 5000;

function createWebServer({ port, deps }) {
  const app = express();
  const httpServer = http.createServer(app);
  const wss = new WebSocket.Server({ server: httpServer });

  app.use(express.static(path.join(__dirname, '../../public')));

  // Graveyard index
  app.get('/graveyard', (req, res) => {
    const memorials = deps.graveyardStore.listMemorials();
    const lost = memorials.length;
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Graveyard</title>
<style>body{background:#111;color:#ccc;font-family:monospace;padding:2em}a{color:#888}h1{color:#fff}</style>
</head><body><h1>The Graveyard</h1><p>${lost} world${lost !== 1 ? 's' : ''} have been lost.</p><ul>`;
    memorials.forEach(m => {
      html += `<li><a href="/graveyard/${m.slug}">${m.worldName}</a> — ${m.firstLine}</li>`;
    });
    html += '</ul></body></html>';
    res.send(html);
  });

  app.get('/graveyard/:slug', (req, res) => {
    const content = deps.graveyardStore.getMemorial(req.params.slug);
    if (!content) return res.status(404).send('Not found');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Memorial</title>
<style>body{background:#111;color:#ccc;font-family:monospace;padding:2em;max-width:60em}pre{white-space:pre-wrap}</style>
</head><body><pre>${content.replace(/</g, '&lt;')}</pre><p><a href="/graveyard">← Back</a></p></body></html>`;
    res.send(html);
  });

  // Active sessions map for reconnection grace period
  const activeSessions = new Map(); // id → { session, timer }

  wss.on('connection', (ws) => {
    let sessionId = null;
    let session = null;
    let firstMessage = true;

    ws.on('message', async (data) => {
      const text = data.toString().trim();

      // First message: check for reconnect token
      if (firstMessage) {
        firstMessage = false;
        if (activeSessions.has(text)) {
          // Reconnect
          const entry = activeSessions.get(text);
          clearTimeout(entry.timer);
          sessionId = text;
          session = entry.session;
          entry.ws = ws;
          activeSessions.set(sessionId, { session, ws, timer: null });
          ws.send('Reconnected.\n');
          return;
        }
        // New session — generate ID and send to client
        sessionId = `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        ws.send(JSON.stringify({ type: 'session', token: sessionId }));

        session = createSession({
          id: sessionId,
          onOutput: (text) => { if (ws.readyState === WebSocket.OPEN) ws.send(text); },
          onComplete: () => { ws.close(); activeSessions.delete(sessionId); },
          onLost: () => { activeSessions.delete(sessionId); },
          ...deps,
        });
        activeSessions.set(sessionId, { session, ws, timer: null });
        await session.start().catch(err => ws.send('\nError: ' + err.message + '\n'));
        return;
      }

      if (session) {
        await session.command(text).catch(() => {});
      }
    });

    ws.on('close', () => {
      if (!sessionId || !activeSessions.has(sessionId)) return;
      const entry = activeSessions.get(sessionId);
      // Grace period
      entry.timer = setTimeout(async () => {
        if (activeSessions.get(sessionId)?.timer) {
          await entry.session.disconnect();
          activeSessions.delete(sessionId);
        }
      }, GRACE_PERIOD_MS);
      activeSessions.set(sessionId, entry);
    });
  });

  return {
    listen() {
      httpServer.listen(port, '0.0.0.0', () => {
        console.log(`Web server listening on port ${port}`);
      });
    },
  };
}

module.exports = { createWebServer };
```

- [ ] **Step 2: Commit**

```bash
git add src/interfaces/web-server.js
git commit -m "feat: web server — WebSocket game, 5s reconnection grace, graveyard routes"
```

---

## Task 19: Web Frontend

**Files:**
- Create: `public/index.html`

- [ ] **Step 1: Create public/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terminal Dreams</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #000; display: flex; flex-direction: column; height: 100vh; }
    #terminal { flex: 1; }
    #input-row { display: flex; background: #111; padding: 4px 8px; }
    #cmd { flex: 1; background: transparent; border: none; color: #ccc; font-family: monospace; font-size: 14px; outline: none; }
    #send { background: #333; color: #ccc; border: none; padding: 4px 12px; cursor: pointer; font-family: monospace; }
  </style>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css" />
</head>
<body>
  <div id="terminal"></div>
  <div id="input-row">
    <input id="cmd" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="enter command..." />
    <button id="send">send</button>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js"></script>
  <script>
    const term = new Terminal({ cursorBlink: true, theme: { background: '#000000' }, convertEol: true });
    term.open(document.getElementById('terminal'));

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}`);
    let sessionToken = sessionStorage.getItem('terminal-dreams-token');
    let firstMessage = true;

    ws.onopen = () => {
      if (sessionToken) {
        ws.send(sessionToken);
      } else {
        ws.send('');
      }
    };

    ws.onmessage = (e) => {
      if (firstMessage) {
        firstMessage = false;
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'session') {
            sessionToken = msg.token;
            sessionStorage.setItem('terminal-dreams-token', sessionToken);
            return;
          }
        } catch (_) {}
      }
      term.write(e.data);
    };

    ws.onclose = () => term.write('\r\n\r\n[Connection closed]\r\n');

    function sendCmd() {
      const val = document.getElementById('cmd').value.trim();
      if (!val || ws.readyState !== WebSocket.OPEN) return;
      term.write(val + '\r\n');
      ws.send(val);
      document.getElementById('cmd').value = '';
    }

    document.getElementById('send').addEventListener('click', sendCmd);
    document.getElementById('cmd').addEventListener('keydown', e => {
      if (e.key === 'Enter') sendCmd();
    });

    term.onKey(({ key, domEvent }) => {
      if (domEvent.key === 'Enter') sendCmd();
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add public/index.html
git commit -m "feat: xterm.js web frontend with session reconnect"
```

---

## Task 20: Entry Point

**Files:**
- Create: `index.js`

- [ ] **Step 1: Create index.js**

```js
// index.js
require('dotenv').config({ path: '.env' });
const path = require('path');
const { createSSHServer } = require('./src/interfaces/ssh-server');
const { createWebServer } = require('./src/interfaces/web-server');
const { createGraveyardStore } = require('./src/storage/graveyard-store');
const { createMemorialGenerator } = require('./src/api/memorial-generator');
const { createTileGenerator } = require('./src/art/tile-generator');
const { createWriteQueue } = require('./src/storage/write-queue');
const tileLibrary = require('./src/art/tile-library');
const tileCompositor = require('./src/art/tile-compositor');

const SSH_PORT = parseInt(process.env.SSH_PORT || '2222');
const WEB_PORT = parseInt(process.env.WEB_PORT || '3000');
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is required. Copy .env.example to .env and set your key.');
  process.exit(1);
}

const graveyardStore = createGraveyardStore(path.join(__dirname, 'graveyard'));
const writeQueue = createWriteQueue();
const memorialGenerator = createMemorialGenerator(ANTHROPIC_API_KEY);
const tileGenerator = createTileGenerator(ANTHROPIC_API_KEY, writeQueue, tileLibrary);

const deps = {
  graveyardStore,
  memorialGenerator,
  tileLibrary,
  tileCompositor,
  tileGenerator,
};

const sshServer = createSSHServer({ port: SSH_PORT, deps });
const webServer = createWebServer({ port: WEB_PORT, deps });

sshServer.listen();
webServer.listen();

console.log(`Terminal Dreams running.`);
console.log(`  Web: http://localhost:${WEB_PORT}`);
console.log(`  SSH: ssh -p ${SSH_PORT} localhost`);
console.log(`  Graveyard: http://localhost:${WEB_PORT}/graveyard`);
```

- [ ] **Step 2: Commit**

```bash
git add index.js
git commit -m "feat: entry point — wires SSH, web, and game deps"
```

---

## Task 21: Devcontainer Config

**Files:**
- Create: `.devcontainer/devcontainer.json`

- [ ] **Step 1: Create .devcontainer/devcontainer.json**

```json
{
  "name": "Terminal Dreams",
  "image": "mcr.microsoft.com/devcontainers/javascript-node:20",
  "forwardPorts": [2222, 3000],
  "portsAttributes": {
    "2222": {
      "label": "SSH Game Server",
      "onAutoForward": "notify"
    },
    "3000": {
      "label": "Web Terminal",
      "onAutoForward": "openBrowser"
    }
  },
  "postCreateCommand": "npm install",
  "remoteEnv": {
    "ANTHROPIC_API_KEY": "${localEnv:ANTHROPIC_API_KEY}"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add .devcontainer/devcontainer.json
git commit -m "feat: GitHub Codespaces devcontainer — auto-open web terminal on port 3000"
```

---

## Task 22: Run Full Test Suite

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: All tests PASS. Note any failures and fix before proceeding.

- [ ] **Step 2: Smoke test — start the server**

```bash
ANTHROPIC_API_KEY=your_key_here node index.js
```

Expected output:
```
SSH server listening on port 2222
Web server listening on port 3000
Terminal Dreams running.
```

- [ ] **Step 3: Smoke test — web terminal**

Open `http://localhost:3000` in a browser. Verify:
- xterm.js terminal renders
- "A world is being assembled for you." appears
- ANSI art tile renders
- `look` command responds
- `go north` advances to the next scene

- [ ] **Step 4: Smoke test — full playthrough**

Navigate through all 10 scenes using `go north` at each. Verify:
- Fork at scene 3 works (try both paths across two sessions)
- Act 3 scene 8 prints `CONNECTION CLOSED.` and closes the connection
- `completed.log` has one entry

- [ ] **Step 5: Smoke test — graveyard**

Start a session, issue a few commands, then close the browser tab. Wait 6 seconds. Verify:
- `graveyard/` contains a `.md` file
- `/graveyard` shows the memorial

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: terminal-dreams PoC complete"
```

---

## Running in Codespaces

1. Push the repo to GitHub
2. Go to the repo → **Code** → **Codespaces** → **Create codespace on main**
3. Set the `ANTHROPIC_API_KEY` secret in repo settings (Settings → Secrets → Codespaces)
4. After Codespaces opens, the web terminal auto-opens at port 3000
5. SSH access via Codespaces port forwarding is available on port 2222
