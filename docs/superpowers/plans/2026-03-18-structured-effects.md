# Structured Effects Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hidden `latents` layer to each scene so free-form player commands that don't match any authored command are interpreted by Claude against latent facts, returning narrative responses and optional structured effects (add item, unlock exit, NPC flavor).

**Architecture:** `command-processor.js` already returns `{ type: 'unknown' }` on no match — session.js detects this and calls a new `latents-processor.js` which sends scene + latent facts + scene conversation history to Claude haiku and parses a constrained JSON response. Effects mutate session state (inventory, exits); all exchanges are appended to a per-scene conversation log so Claude tracks multi-step arcs.

**Tech Stack:** Node.js, `@anthropic-ai/sdk` (claude-haiku-4-5-20251001), jest

---

## File Map

| File | Status | Role |
|------|--------|------|
| `data/scenes/*.json` (10 files) | Modify | Add `latents` array to each scene template |
| `src/engine/scene-manager.js` | Modify | Extend `fillScene` to fill slot tokens in latent string fields |
| `src/engine/latents-processor.js` | Create | Build Claude prompt, call API, parse + validate JSON response, return `{ text, effect }` |
| `src/engine/session.js` | Modify | Add `inventory`, `latentConversation` state; detect `{ type: 'unknown' }`; call latents processor; apply effects; reset history on scene change; accept `latentsProcessor` dep |
| `src/interfaces/render.js` | Modify | Add `renderInventory(inventory)` helper |
| `index.js` | Modify | Create `latentsProcessor` and pass to `createSession` |
| `tests/engine/latents-processor.test.js` | Create | Unit tests with mocked Anthropic SDK |
| `tests/engine/scene-manager.test.js` | Modify | Add test that latents are filled (no raw tokens) |
| `tests/engine/session.test.js` | Modify | Add tests for inventory state, latent routing, effect application |

---

## Task 1: Add latent facts to all 10 scene JSON files

No tests — this is authored data. Add a `latents` array to each scene file. Slot tokens (`{ADJ}`, `{CHARACTER}`, etc.) are valid and will be filled at world-generation time. Each scene gets 3 latents mixing `add_item`, `unlock_exit`, and `npc_note` hints.

**Files:**
- Modify: `data/scenes/act1-scene1.json`
- Modify: `data/scenes/act1-scene2.json`
- Modify: `data/scenes/act1-scene3.json`
- Modify: `data/scenes/act2a-scene4.json`
- Modify: `data/scenes/act2a-scene5.json`
- Modify: `data/scenes/act2b-scene4.json`
- Modify: `data/scenes/act2b-scene5.json`
- Modify: `data/scenes/act3-scene6.json`
- Modify: `data/scenes/act3-scene7.json`
- Modify: `data/scenes/act3-scene8.json`

- [ ] **Step 1: Add latents to act1-scene1.json**

Add after the `"pivot_skipped_scene": null` line:

```json
"latents": [
  {
    "fact": "a tarnished coin half-buried in the dust near the entrance — someone dropped it in a hurry",
    "hint": "add_item",
    "item": "tarnished coin",
    "item_desc": "A worn coin with a face you don't recognise. One side has been filed smooth."
  },
  {
    "fact": "the {CHARACTER} has been scratching marks into the wall behind them — a count, or a warning",
    "hint": "npc_note"
  },
  {
    "fact": "there is a gap between the baseboard and the floor where something flat has been pushed through",
    "hint": "npc_note"
  }
]
```

- [ ] **Step 2: Add latents to act1-scene2.json**

```json
"latents": [
  {
    "fact": "a loose board in the floor conceals a shallow cache — someone hid something here recently",
    "hint": "add_item",
    "item": "folded note",
    "item_desc": "A handwritten note, ink smeared but legible: 'Don't go back. It already knows you're here.'"
  },
  {
    "fact": "the smell of {NOUN} is much stronger near the north wall — something was stored there and moved",
    "hint": "npc_note"
  },
  {
    "fact": "a rusted grate in the ceiling is held by a single bolt — it wobbles when the air shifts",
    "hint": "npc_note"
  }
]
```

- [ ] **Step 3: Add latents to act1-scene3.json**

```json
"latents": [
  {
    "fact": "a {ADJ} cracked lens from some kind of optical device is wedged in a crack in the east wall",
    "hint": "add_item",
    "item": "cracked lens",
    "item_desc": "A {ADJ} lens, cracked diagonally. When you hold it up, shapes look wrong through it."
  },
  {
    "fact": "there is a second door behind the {ADJ} tapestry on the east wall — it is unlocked",
    "hint": "unlock_exit",
    "exit": "east",
    "exit_desc": "A narrow passage behind the tapestry, leading somewhere quieter.",
    "target_scene": "act2a-scene4"
  },
  {
    "fact": "the floor here is slightly warmer than the rest of the room — something runs beneath it",
    "hint": "npc_note"
  }
]
```

- [ ] **Step 4: Add latents to act2a-scene4.json**

```json
"latents": [
  {
    "fact": "a small iron key hangs on a nail behind the door, painted the same colour as the wall",
    "hint": "add_item",
    "item": "iron key",
    "item_desc": "A small iron key, still cold. No markings. Fits nothing visible in this room."
  },
  {
    "fact": "the {CHARACTER} keeps glancing at a specific panel in the floor — they stop whenever they notice you watching",
    "hint": "npc_note"
  },
  {
    "fact": "a faint scratching sound comes from inside the west wall, rhythmic, like something counting",
    "hint": "npc_note"
  }
]
```

- [ ] **Step 5: Add latents to act2a-scene5.json**

```json
"latents": [
  {
    "fact": "a glass vial has rolled under the {ADJ} furniture — still sealed, contents unclear",
    "hint": "add_item",
    "item": "sealed vial",
    "item_desc": "A small glass vial, sealed with wax. The liquid inside shifts colour when tilted."
  },
  {
    "fact": "the window in this room doesn't show the outside — it shows a different room entirely",
    "hint": "npc_note"
  },
  {
    "fact": "one of the {ADJ} marks on the wall is actually a door seam — it opens inward with enough pressure",
    "hint": "unlock_exit",
    "exit": "west",
    "exit_desc": "A concealed door in the wall, leading to a dim passage.",
    "target_scene": "act3-scene6"
  }
]
```

- [ ] **Step 6: Add latents to act2b-scene4.json**

```json
"latents": [
  {
    "fact": "a torn page from a ledger is pinned beneath a heavy object — the numbers on it are unusual",
    "hint": "add_item",
    "item": "torn ledger page",
    "item_desc": "A page of numbers in two columns. The totals don't match. Someone circled three entries."
  },
  {
    "fact": "the {CHARACTER} has something in their left hand they haven't shown you — they keep it pressed to their side",
    "hint": "npc_note"
  },
  {
    "fact": "the shadow in the corner doesn't match any object in the room",
    "hint": "npc_note"
  }
]
```

- [ ] **Step 7: Add latents to act2b-scene5.json**

```json
"latents": [
  {
    "fact": "a {ADJ} token — the kind used for passage or barter — has been slid under the door from outside",
    "hint": "add_item",
    "item": "{ADJ} token",
    "item_desc": "A {ADJ} token, edge-worn. Someone pushed it under the door but didn't knock."
  },
  {
    "fact": "the {ANTAGONIST} left something behind when they passed through — a mark on the doorframe that glows faintly",
    "hint": "npc_note"
  },
  {
    "fact": "there is a second set of footprints in the dust that do not belong to anyone currently in the room",
    "hint": "npc_note"
  }
]
```

- [ ] **Step 8: Add latents to act3-scene6.json**

```json
"latents": [
  {
    "fact": "a fragment of the {MACGUFFIN} has broken off and lies in the corner — still faintly active",
    "hint": "add_item",
    "item": "{MACGUFFIN} fragment",
    "item_desc": "A shard of the {MACGUFFIN}. It hums against your palm."
  },
  {
    "fact": "the {ANTAGONIST} has already been in this room — there is a fresh mark where they stood",
    "hint": "npc_note"
  },
  {
    "fact": "the ceiling here is lower than it should be — something has been built above this room",
    "hint": "npc_note"
  }
]
```

- [ ] **Step 9: Add latents to act3-scene7.json**

```json
"latents": [
  {
    "fact": "a small mirror is face-down on the floor — when flipped, it doesn't reflect the current room",
    "hint": "add_item",
    "item": "strange mirror",
    "item_desc": "A palm-sized mirror. It shows a room you haven't visited. Or haven't visited yet."
  },
  {
    "fact": "there is a loose stone near the base of the east wall — behind it, a short passage leads forward",
    "hint": "unlock_exit",
    "exit": "east",
    "exit_desc": "A low crawlspace behind the loose stone. It leads somewhere ahead.",
    "target_scene": "act3-scene8"
  },
  {
    "fact": "the {THREAT} is closer here than it has been — you can feel it in the change in air pressure",
    "hint": "npc_note"
  }
]
```

- [ ] **Step 10: Add latents to act3-scene8.json**

```json
"latents": [
  {
    "fact": "something the {CHARACTER} dropped earlier is here — it must have arrived before you did",
    "hint": "add_item",
    "item": "lost keepsake",
    "item_desc": "Something familiar. You didn't carry it here. You're not sure how it got here first."
  },
  {
    "fact": "the {ANTAGONIST} is not gone — they are waiting in the place you least expect",
    "hint": "npc_note"
  },
  {
    "fact": "the final exit looks permanent — but there is a second way out, hidden behind the {THREAT}",
    "hint": "npc_note"
  }
]
```

- [ ] **Step 11: Commit**

```bash
git add data/scenes/
git commit -m "feat: add latents layer to all 10 scene templates"
```

---

## Task 2: Extend fillScene to fill slot tokens in latents

**Files:**
- Modify: `src/engine/scene-manager.js:17-46`
- Modify: `tests/engine/scene-manager.test.js`

- [ ] **Step 1: Write the failing test**

Add to `tests/engine/scene-manager.test.js`:

```js
describe('latents slot filling', () => {
  it('fills slot tokens in latent fact strings', () => {
    const scene = manager.loadScene('act1-scene1');
    expect(scene.latents).toBeDefined();
    expect(Array.isArray(scene.latents)).toBe(true);
    scene.latents.forEach(latent => {
      Object.values(latent).forEach(val => {
        if (typeof val === 'string') {
          expect(val).not.toMatch(/\{[A-Z]+\}/);
        }
      });
    });
  });

  it('preserves non-string latent fields unchanged', () => {
    const scene = manager.loadScene('act1-scene1');
    scene.latents.forEach(latent => {
      expect(typeof latent.hint).toBe('string');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tests/engine/scene-manager.test.js --no-coverage
```

Expected: FAIL — `scene.latents` is undefined (fillScene doesn't include it yet)

- [ ] **Step 3: Extend fillScene in scene-manager.js**

In `src/engine/scene-manager.js`, update `fillScene` to add latents filling. Add after the `commands` block and before the `return`:

```js
function fillScene(template, world) {
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

  const latents = (template.latents || []).map(latent => {
    const filled = {};
    for (const [key, val] of Object.entries(latent)) {
      filled[key] = typeof val === 'string' ? fillTemplate(val, world) : val;
    }
    return filled;
  });

  return {
    id: template.id,
    act: template.act,
    description,
    commands,
    exits: { ...template.exits },
    tiles: template.tiles,
    is_final: template.is_final || false,
    pivot_action: template.pivot_action,
    pivot_target_slot: template.pivot_target_slot,
    pivot_taken_scene: template.pivot_taken_scene,
    pivot_skipped_scene: template.pivot_skipped_scene,
    latents,
  };
}
```

Note: `exits` is now spread (`{ ...template.exits }`) so that `unlock_exit` effects can mutate the live scene object without affecting the template.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/engine/scene-manager.test.js --no-coverage
```

Expected: PASS (all existing tests + new latents tests)

- [ ] **Step 5: Run full suite to check nothing broke**

```bash
npx jest --no-coverage
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/engine/scene-manager.js tests/engine/scene-manager.test.js
git commit -m "feat: fill slot tokens in latents layer during scene load"
```

---

## Task 3: Build latents-processor module

**Files:**
- Create: `src/engine/latents-processor.js`
- Create: `tests/engine/latents-processor.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/latents-processor.test.js`:

```js
// tests/engine/latents-processor.test.js
jest.mock('@anthropic-ai/sdk');
const Anthropic = require('@anthropic-ai/sdk');
const { createLatentsProcessor } = require('../../src/engine/latents-processor');

const SCENE = {
  description: 'A dim room. Something watches from the corner.',
  latents: [
    { fact: 'a tarnished coin half-buried in the dust', hint: 'add_item', item: 'tarnished coin', item_desc: 'A worn coin.' },
    { fact: 'the character keeps glancing at the floor panel', hint: 'npc_note' },
  ],
};
const HISTORY = [];

function mockClaude(responseObj) {
  const mockCreate = jest.fn().mockResolvedValue({
    content: [{ text: JSON.stringify(responseObj) }],
  });
  Anthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));
  return mockCreate;
}

describe('createLatentsProcessor', () => {
  it('returns text and null effect when Claude returns no effect', async () => {
    mockClaude({ response: 'The air shifts. Nothing more.', effect: null });
    const processor = createLatentsProcessor('fake-key');
    const result = await processor.process('shout at the sky', SCENE, HISTORY);
    expect(result.text).toBe('The air shifts. Nothing more.');
    expect(result.effect).toBeNull();
  });

  it('returns text and add_item effect when Claude fires one', async () => {
    mockClaude({ response: 'The coin rolls out.', effect: { type: 'add_item', item: 'tarnished coin', item_desc: 'A worn coin.' } });
    const processor = createLatentsProcessor('fake-key');
    const result = await processor.process('dig in the dust', SCENE, HISTORY);
    expect(result.text).toBe('The coin rolls out.');
    expect(result.effect).toEqual({ type: 'add_item', item: 'tarnished coin', item_desc: 'A worn coin.' });
  });

  it('returns text and strips effect if add_item is missing item field', async () => {
    mockClaude({ response: 'Something falls.', effect: { type: 'add_item', item_desc: 'A worn coin.' } });
    const processor = createLatentsProcessor('fake-key');
    const result = await processor.process('reach down', SCENE, HISTORY);
    expect(result.text).toBe('Something falls.');
    expect(result.effect).toBeNull();
  });

  it('returns text and strips effect if effect type is invalid', async () => {
    mockClaude({ response: 'Strange.', effect: { type: 'explode_world' } });
    const processor = createLatentsProcessor('fake-key');
    const result = await processor.process('do something weird', SCENE, HISTORY);
    expect(result.text).toBe('Strange.');
    expect(result.effect).toBeNull();
  });

  it('returns fallback when Claude response is not valid JSON', async () => {
    const mockCreate = jest.fn().mockResolvedValue({ content: [{ text: 'oops not json' }] });
    Anthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));
    const processor = createLatentsProcessor('fake-key');
    const result = await processor.process('anything', SCENE, HISTORY);
    expect(result.text).toBe('The moment passes without consequence.');
    expect(result.effect).toBeNull();
  });

  it('returns fallback when API call throws', async () => {
    const mockCreate = jest.fn().mockRejectedValue(new Error('network error'));
    Anthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));
    const processor = createLatentsProcessor('fake-key');
    const result = await processor.process('anything', SCENE, HISTORY);
    expect(result.text).toBe('The moment passes without consequence.');
    expect(result.effect).toBeNull();
  });

  it('includes conversation history in the prompt', async () => {
    const mockCreate = mockClaude({ response: 'The coin falls.', effect: null });
    const processor = createLatentsProcessor('fake-key');
    const history = [{ command: 'look at dust', response: 'You see something glinting.' }];
    await processor.process('reach for it', SCENE, history);
    const promptSent = mockCreate.mock.calls[0][0].messages[0].content;
    expect(promptSent).toContain('look at dust');
    expect(promptSent).toContain('You see something glinting.');
  });

  it('returns text and unlock_exit effect when Claude fires one', async () => {
    mockClaude({ response: 'A door reveals itself.', effect: { type: 'unlock_exit', exit: 'east', target_scene: 'act2a-scene4' } });
    const processor = createLatentsProcessor('fake-key');
    const result = await processor.process('push the tapestry', SCENE, HISTORY);
    expect(result.effect).toEqual({ type: 'unlock_exit', exit: 'east', target_scene: 'act2a-scene4' });
  });

  it('strips unlock_exit effect if target_scene is missing', async () => {
    mockClaude({ response: 'A gap appears.', effect: { type: 'unlock_exit', exit: 'east' } });
    const processor = createLatentsProcessor('fake-key');
    const result = await processor.process('push the wall', SCENE, HISTORY);
    expect(result.effect).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/engine/latents-processor.test.js --no-coverage
```

Expected: FAIL — module does not exist yet

- [ ] **Step 3: Create src/engine/latents-processor.js**

```js
// src/engine/latents-processor.js
const Anthropic = require('@anthropic-ai/sdk');

const VALID_EFFECT_TYPES = ['add_item', 'unlock_exit', 'npc_note', 'nothing'];
const FALLBACK = { text: 'The moment passes without consequence.', effect: null };

function buildPrompt(command, scene, history) {
  const factsText = scene.latents.map((l, i) => `${i + 1}. ${l.fact}`).join('\n');
  const historyText = history.length
    ? history.map(h => `> ${h.command}\n${h.response}`).join('\n\n')
    : 'None yet.';

  return `You are the hidden layer of a text adventure world.

SCENE: ${scene.description}

LATENT FACTS (the player cannot see these):
${factsText}

CONVERSATION SO FAR IN THIS SCENE:
${historyText}

PLAYER COMMAND: ${command}

Decide: does this action interact with any latent fact?
- If yes: write a response that naturally reveals or develops it. If the interaction reaches a natural conclusion, include an effect.
- If no: write a brief atmospheric response. No effect.

Respond in JSON only:
{"response": "narrative text shown to player", "effect": {"type": "add_item|unlock_exit|npc_note|nothing", ...payload} | null}`;
}

function validateEffect(effect) {
  if (!effect) return null;
  if (!VALID_EFFECT_TYPES.includes(effect.type)) return null;
  if (effect.type === 'add_item' && (!effect.item || !effect.item_desc)) return null;
  if (effect.type === 'unlock_exit' && (!effect.exit || !effect.target_scene)) return null;
  return effect;
}

function createLatentsProcessor(apiKey) {
  const client = new Anthropic({ apiKey });

  async function process(command, scene, history) {
    try {
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: buildPrompt(command, scene, history) }],
      });
      const raw = message.content[0].text.trim();
      const parsed = JSON.parse(raw);
      if (typeof parsed.response !== 'string' || !parsed.response) return FALLBACK;
      return { text: parsed.response, effect: validateEffect(parsed.effect) };
    } catch {
      return FALLBACK;
    }
  }

  return { process };
}

module.exports = { createLatentsProcessor };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/engine/latents-processor.test.js --no-coverage
```

Expected: PASS (all 8 tests)

- [ ] **Step 5: Run full suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/engine/latents-processor.js tests/engine/latents-processor.test.js
git commit -m "feat: add latents-processor with Claude adjudication and effect validation"
```

---

## Task 4: Add inventory and latentConversation to session state

**Files:**
- Modify: `src/engine/session.js:11-114`
- Modify: `tests/engine/session.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `tests/engine/session.test.js`:

```js
describe('session inventory', () => {
  it('starts with empty inventory', async () => {
    const session = makeSession();
    expect(session.inventory).toEqual([]);
  });
});

describe('session latentConversation', () => {
  it('starts with empty latentConversation', async () => {
    const session = makeSession();
    expect(session.latentConversation).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/engine/session.test.js --no-coverage
```

Expected: FAIL — `session.inventory` and `session.latentConversation` are undefined

- [ ] **Step 3: Add state to session.js**

In `src/engine/session.js`, after `let commandHistory = [];` (line 17), add:

```js
let inventory = [];
let latentConversation = [];
```

At the bottom of `createSession`, update the returned object to expose them:

```js
return {
  get state() { return state; },
  get commandHistory() { return commandHistory; },
  get inventory() { return inventory; },
  get latentConversation() { return latentConversation; },
  start, command, disconnect,
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/engine/session.test.js --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/session.js tests/engine/session.test.js
git commit -m "feat: add inventory and latentConversation state to session"
```

---

## Task 5: Handle unknown commands via latents processor

**Files:**
- Modify: `src/engine/session.js`
- Modify: `tests/engine/session.test.js`

- [ ] **Step 1: Write the failing tests**

Add to the `makeSession` helper in `tests/engine/session.test.js` — add a default `latentsProcessor` mock:

```js
function makeSession(overrides = {}) {
  const onOutput = overrides.onOutput || jest.fn();
  const onComplete = overrides.onComplete || jest.fn();
  const onLost = overrides.onLost || jest.fn();
  return createSession({
    id: 'test-session',
    onOutput,
    onComplete,
    onLost,
    graveyardStore: { writeMemorial: jest.fn().mockResolvedValue(), writeCompleted: jest.fn().mockResolvedValue() },
    memorialGenerator: { generate: jest.fn().mockResolvedValue('A sad tale.') },
    tileLibrary: {
      findTile: jest.fn().mockReturnValue('tiles/deep-sea/location-trench.ans'),
      loadTile: jest.fn().mockReturnValue(Array.from({ length: 12 }, () => ' '.repeat(40)).join('\n')),
    },
    tileCompositor: { compositeTiles: jest.fn().mockReturnValue(Array.from({ length: 12 }, () => ' '.repeat(40)).join('\n')) },
    tileGenerator: { maybeGenerateTile: jest.fn().mockResolvedValue(null) },
    latentsProcessor: { process: jest.fn().mockResolvedValue({ text: 'The moment passes.', effect: null }) },
    ...overrides,
  });
}
```

Then add new test cases:

```js
describe('unknown command routing', () => {
  it('calls latentsProcessor.process on unknown command', async () => {
    const mockProcess = jest.fn().mockResolvedValue({ text: 'Nothing happens.', effect: null });
    const session = makeSession({ latentsProcessor: { process: mockProcess } });
    await session.start();
    await session.command('shout at the ceiling');
    expect(mockProcess).toHaveBeenCalledWith('shout at the ceiling', expect.any(Object), expect.any(Array));
  });

  it('appends to latentConversation after latents response', async () => {
    const mockProcess = jest.fn().mockResolvedValue({ text: 'The coin glints.', effect: null });
    const session = makeSession({ latentsProcessor: { process: mockProcess } });
    await session.start();
    await session.command('look at the dust');
    expect(session.latentConversation).toHaveLength(1);
    expect(session.latentConversation[0]).toEqual({ command: 'look at the dust', response: 'The coin glints.' });
  });

  it('applies add_item effect to inventory', async () => {
    const mockProcess = jest.fn().mockResolvedValue({
      text: 'You find a coin.',
      effect: { type: 'add_item', item: 'tarnished coin', item_desc: 'A worn coin.' },
    });
    const session = makeSession({ latentsProcessor: { process: mockProcess } });
    await session.start();
    await session.command('dig in the dust');
    expect(session.inventory).toHaveLength(1);
    expect(session.inventory[0]).toEqual({ item: 'tarnished coin', item_desc: 'A worn coin.' });
  });

  it('applies unlock_exit effect so go <direction> works afterwards', async () => {
    let callCount = 0;
    const mockProcess = jest.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { text: 'A door appears in the east wall.', effect: { type: 'unlock_exit', exit: 'east', target_scene: 'act1-scene2' } };
      }
      return { text: 'Nothing more happens.', effect: null };
    });
    const onOutput = jest.fn();
    const session = makeSession({ latentsProcessor: { process: mockProcess }, onOutput });
    await session.start();
    onOutput.mockClear();
    await session.command('push the tapestry'); // fires unlock_exit
    onOutput.mockClear();
    await session.command('go east'); // should now route to act1-scene2, not "cannot go that way"
    const outputCalls = onOutput.mock.calls.map(c => c[0]).join('');
    expect(outputCalls).not.toContain('cannot go that way');
  });

  it('resets latentConversation when moving to a new scene', async () => {
    const mockProcess = jest.fn().mockResolvedValue({ text: 'Something stirs.', effect: null });
    const session = makeSession({ latentsProcessor: { process: mockProcess } });
    await session.start();
    await session.command('do something weird'); // adds to latentConversation
    expect(session.latentConversation).toHaveLength(1);
    await session.command('go north'); // moves to next scene
    expect(session.latentConversation).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/engine/session.test.js --no-coverage
```

Expected: FAIL — session doesn't call latentsProcessor yet

- [ ] **Step 3: Update session.js**

Update the function signature to accept `latentsProcessor`:

```js
function createSession({ id, onOutput, onComplete, onLost, graveyardStore, memorialGenerator, tileLibrary, tileCompositor, tileGenerator, latentsProcessor }) {
```

Add an `applyEffect` helper inside `createSession`, after the state variable declarations:

```js
function applyEffect(effect) {
  if (!effect) return;
  if (effect.type === 'add_item') {
    inventory = [...inventory, { item: effect.item, item_desc: effect.item_desc }];
  } else if (effect.type === 'unlock_exit') {
    currentScene.exits[effect.exit] = effect.target_scene;
  }
  // npc_note and nothing: no state change
}
```

In the `command` function, replace the final `onOutput('\nUnknown command...')` block with:

```js
if (result.type === 'unknown') {
  if (latentsProcessor && currentScene.latents && currentScene.latents.length > 0) {
    const { text, effect } = await latentsProcessor.process(trimmed, currentScene, latentConversation);
    applyEffect(effect);
    latentConversation = [...latentConversation, { command: trimmed, response: text }];
    onOutput('\n' + text + '\n\n> ');
  } else {
    onOutput('\nUnknown command. ' + HELP_TEXT + '\n\n> ');
  }
  return;
}
```

In the exit-handling block, reset `latentConversation` on scene change:

```js
if (result.type === 'exit') {
  const nextId = sceneManager.resolveExit(currentScene, result.direction);
  if (!nextId) { onOutput('\nYou cannot go that way.\n\n> '); return; }
  if (nextId === '__complete__') { await complete(); return; }
  currentScene = sceneManager.loadScene(nextId);
  latentConversation = [];
  await renderScene(currentScene);
  return;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/engine/session.test.js --no-coverage
```

Expected: PASS

- [ ] **Step 5: Run full suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/engine/session.js tests/engine/session.test.js
git commit -m "feat: route unknown commands through latents processor, apply effects to session state"
```

---

## Task 6: Render inventory in scene display

**Files:**
- Modify: `src/interfaces/render.js`
- Modify: `src/engine/session.js` (renderScene function)

- [ ] **Step 1: Write the failing test**

There are no existing render.js tests. Add a new file `tests/interfaces/render.test.js`:

```js
// tests/interfaces/render.test.js
const { renderInventory } = require('../../src/interfaces/render');

describe('renderInventory', () => {
  it('returns empty string for empty inventory', () => {
    expect(renderInventory([])).toBe('');
  });

  it('returns dim carrying line for one item', () => {
    const result = renderInventory([{ item: 'tarnished coin', item_desc: 'A worn coin.' }]);
    expect(result).toContain('tarnished coin');
    expect(result).toContain('Carrying:');
  });

  it('joins multiple items with comma', () => {
    const result = renderInventory([
      { item: 'tarnished coin', item_desc: 'A worn coin.' },
      { item: 'folded note', item_desc: 'A note.' },
    ]);
    expect(result).toContain('tarnished coin');
    expect(result).toContain('folded note');
    expect(result).toContain(',');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tests/interfaces/render.test.js --no-coverage
```

Expected: FAIL — `renderInventory` is not exported

- [ ] **Step 3: Add renderInventory to render.js**

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
function renderInventory(inventory) {
  if (!inventory.length) return '';
  return dim('Carrying: ' + inventory.map(i => i.item).join(', ')) + '\n';
}

module.exports = { bold, dim, clear, divider, renderInventory };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/interfaces/render.test.js --no-coverage
```

Expected: PASS

- [ ] **Step 5: Wire renderInventory into session.js renderScene**

In `src/engine/session.js`, update the `require` at the top:

```js
const { bold, dim, clear, renderInventory } = require('../interfaces/render');
```

In `renderScene`, add the inventory line after the scene description:

```js
async function renderScene(scene) {
  const genreNames = world.genres.map(g => g.name);
  const tilePaths = scene.tiles.map(type => tileLibrary.findTile({ genres: genreNames, sceneType: type }));
  const tileContents = tilePaths.map(p => tileLibrary.loadTile(p));
  const art = tileCompositor.compositeTiles(tileContents);

  onOutput(clear());
  onOutput(art + '\n\n');
  onOutput(bold(world.name) + '\n\n');
  onOutput(scene.description + '\n\n');
  const inv = renderInventory(inventory);
  if (inv) onOutput(inv + '\n');
  onOutput(dim(HELP_TEXT) + '\n');
  onOutput('> ');

  tileGenerator.maybeGenerateTile({ genres: genreNames, sceneType: scene.tiles[0] }).catch(() => {});
}
```

- [ ] **Step 6: Run full suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/interfaces/render.js src/engine/session.js tests/interfaces/render.test.js
git commit -m "feat: render inventory below scene description when carrying items"
```

---

## Task 7: Wire latentsProcessor into index.js

**Files:**
- Modify: `index.js`

No new tests — this is wiring. The session tests already cover the behavior with mocked latentsProcessor.

- [ ] **Step 1: Read index.js to understand current wiring**

Open `index.js` and find where `createSession` is called. It will look something like:

```js
const session = createSession({
  id, onOutput, onComplete, onLost,
  graveyardStore, memorialGenerator,
  tileLibrary, tileCompositor, tileGenerator,
});
```

- [ ] **Step 2: Add latentsProcessor creation and injection**

Add the require near the other engine requires at the top of `index.js`:

```js
const { createLatentsProcessor } = require('./src/engine/latents-processor');
```

Before creating sessions, create a single shared latentsProcessor (one per server, not per session — it's stateless):

```js
const latentsProcessor = createLatentsProcessor(process.env.ANTHROPIC_API_KEY);
```

Pass it into every `createSession` call:

```js
const session = createSession({
  id, onOutput, onComplete, onLost,
  graveyardStore, memorialGenerator,
  tileLibrary, tileCompositor, tileGenerator,
  latentsProcessor,
});
```

- [ ] **Step 3: Start the server and smoke test**

```bash
node index.js
```

Connect via the web terminal or SSH. Try a free-form command that doesn't match any authored command (e.g., `shout at the walls`, `examine the floor`, `smell the air`). Verify:
- A narrative response appears (not "Unknown command")
- After multiple related commands in the same scene, responses build on each other
- Moving to a new scene and repeating a free-form command gets a fresh response

- [ ] **Step 4: Run full test suite one final time**

```bash
npx jest --no-coverage
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add index.js
git commit -m "feat: wire latents processor into server entry point"
```
