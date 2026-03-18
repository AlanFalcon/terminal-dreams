# Structured Effects — Design Spec
*2026-03-18*

## Concept

Free-form player commands that don't match any authored scene command are routed to Claude, which interprets them against a hidden layer of **latent facts** authored into each scene. Most random actions do nothing. But if there's a monkey in a tree holding a pressure capsule, and the player shouts at the sky, Claude decides whether the monkey notices — and what happens next.

The key principle: interactions must be **latent** (the fact was always there), not hallucinated. Claude discovers interactions; it doesn't invent them.

---

## 1. Data Model

### Latents in Scene Templates

Each scene template (`data/scenes/*.json`) gains a `latents` array. Each entry is a structured object:

```json
"latents": [
  {
    "fact": "a monkey in the upper branches holding a pressure capsule",
    "hint": "add_item",
    "item": "pressure capsule",
    "item_desc": "A sealed capsule, still warm from the monkey's grip."
  },
  {
    "fact": "a loose floor panel near the east wall leading to the undercroft",
    "hint": "unlock_exit",
    "exit": "east",
    "exit_desc": "A gap in the floor leading down into darkness.",
    "target_scene": "act2a-scene3"
  },
  {
    "fact": "the bartender is deeply superstitious about whistling",
    "hint": "npc_note"
  }
]
```

**Field definitions:**
- `fact` — the hidden truth. Claude knows it; the player doesn't (until they discover it).
- `hint` — soft guidance on what kind of effect *could* fire. Claude may choose differently if the action warrants it.
- `item` / `item_desc` — pre-authored for `add_item` hints, so Claude doesn't invent names.
- `exit` — the direction key (e.g. `"east"`) for `unlock_exit` hints.
- `exit_desc` — narrative flavor only; shown in Claude's response text, not stored in exits state.
- `target_scene` — the scene ID to navigate to when this exit is taken. Required for `unlock_exit` hints.

**Slot token filling:** `scene-manager.js` must extend `fillScene` to also iterate over the `latents` array and call `fillTemplate` on all string fields (`fact`, `item`, `item_desc`, `exit_desc`). Without this, slot tokens in latent fields would arrive raw.

### Scene Conversation History

Session state gains two new fields:

```js
inventory: []           // items the player is carrying
latentConversation: []  // { command, response } log for the current scene
```

`latentConversation` is reset each time the player moves to a new scene. It gives Claude the full arc of prior free-form exchanges so it can track multi-step discoveries (player leans on tree → hears chittering → looks up → sees monkey → talks to monkey → throws coin → monkey throws capsule).

---

## 2. Effects Menu

Claude returns a constrained effect type. Valid types:

| Type | Payload | Result |
|------|---------|--------|
| `add_item` | `item`, `item_desc` | Item added to `session.inventory` as `{ item, item_desc }` |
| `unlock_exit` | `exit`, `target_scene` | `scene.exits[exit] = target_scene` added to current scene exits |
| `npc_note` | — | Pure narrative flavor; no state change |
| `nothing` | — | World shrugs: *"The words dissolve into the static."* |

Claude decides **when** to fire an effect. For `add_item`, this might be after a multi-step arc — the effect fires at the moment Claude judges the player has earned the item, narrated however Claude sees fit. Claude also decides outcomes: aim, reflexes, luck. A coin throw might result in a perfect catch or a scramble on the floor — Claude chooses, then fires the effect at the resolution point it writes.

If Claude returns no effect or `nothing`, only the narrative response is shown.

---

## 3. Latents Processor

**New file:** `src/engine/latents-processor.js`

Responsible for:
1. Building the Claude prompt (scene + latents + history + command)
2. Calling Claude (haiku model, cheap + fast)
3. Parsing and validating the JSON response
4. Returning `{ text, effect | null }`

### Prompt Structure

```
You are the hidden layer of a text adventure world.

SCENE: {scene description}

LATENT FACTS (the player cannot see these):
{latents as numbered list of facts}

CONVERSATION SO FAR IN THIS SCENE:
{latentConversation as command/response pairs, or "None yet."}

PLAYER COMMAND: {command}

Decide: does this action interact with any latent fact?
- If yes: write a response that naturally reveals or develops it. If the interaction reaches a natural conclusion, include an effect.
- If no: write a brief atmospheric response. No effect.

Respond in JSON only:
{
  "response": "narrative text shown to player",
  "effect": { "type": "add_item|unlock_exit|npc_note|nothing", ...payload } | null
}
```

### Validation

The processor validates Claude's JSON output:
- `response` must be a non-empty string
- `effect.type` must be one of the four valid types
- `add_item` effect must include `item` and `item_desc`
- `unlock_exit` effect must include `exit` and `target_scene`
- On parse failure: fall back to `{ text: "The moment passes without consequence.", effect: null }`

---

## 4. Command Flow

`command-processor.js` remains synchronous and unchanged beyond its existing exact + fuzzy match logic. When it returns no match, `session.js` is responsible for detecting this and calling `latentsProcessor.process()`.

```
player types command
        │
        ▼
command-processor: exact match?
        │ yes → return authored response
        │ no
        ▼
command-processor: fuzzy verb match?
        │ yes → return authored response
        │ no → return { type: 'unknown' }
        ▼
session.js detects { type: 'unknown' }
calls latentsProcessor.process(command, scene, latentConversation)
        │
        ▼
session: apply effect (if any)
append { command, response } to latentConversation
show response to player
```

---

## 5. Session State Changes

`session.js` gains:

- `inventory: []` — initialized on session start
- `latentConversation: []` — initialized on session start, reset on scene transition

**Effect application:**
- `add_item` → push `{ item, item_desc }` to `inventory`
- `unlock_exit` → `scene.exits[effect.exit] = effect.target_scene`
- `npc_note` / `nothing` → no state change

---

## 6. Display

`render.js` gains an inventory renderer. If `inventory` is non-empty, it appears below the scene description in dim text:

```
Carrying: pressure capsule, copper coin
```

Inventory items are displayed by their `item` field (name only). `item_desc` is for Claude context and initial pickup narration only.

Empty inventory: nothing shown.

---

## 7. Files Changed

| File | Change |
|------|--------|
| `data/scenes/*.json` (10 files) | Add `latents` array to each scene |
| `src/engine/scene-manager.js` | Extend `fillScene` to fill slot tokens in latents array |
| `src/engine/latents-processor.js` | New — Claude call, effect parsing |
| `src/engine/command-processor.js` | No change — already returns `{ type: 'unknown' }` on no match |
| `src/engine/session.js` | Detect `{ type: 'unknown' }`, call latents processor; `inventory` + `latentConversation` state; apply effects; reset history on scene change |
| `src/interfaces/render.js` | Show inventory if non-empty |
| `tests/engine/latents-processor.test.js` | New — unit tests with mocked Claude |

---

## 8. Out of Scope (this iteration)

- Player dropping or using items on scene objects
- Latent-to-latent interactions (monkey steals the land deed)
- Persistent latent state across scenes
- Item display in graveyard memorials (future nice-to-have)
