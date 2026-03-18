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
    "fact": "a loose floor panel near the east wall",
    "hint": "unlock_exit",
    "exit": "east",
    "exit_desc": "A gap in the floor leading down into darkness."
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
- `exit` / `exit_desc` — pre-authored for `unlock_exit` hints.

Slot tokens (`{ADJ}`, `{CHARACTER}`, etc.) work in latent fields exactly as they do in scene descriptions — filled at world-generation time.

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
| `add_item` | `item`, `item_desc` | Item added to `session.inventory` |
| `unlock_exit` | `exit`, `exit_desc` | Exit added to current scene's available exits |
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
- `unlock_exit` effect must include `exit` and `exit_desc`
- On parse failure: fall back to `{ text: "The moment passes without consequence.", effect: null }`

---

## 4. Command Flow

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
        │ no
        ▼
latents-processor: call Claude
        │
        ▼
session: apply effect (if any)
append to latentConversation
show response to player
```

---

## 5. Session State Changes

`session.js` gains:

- `inventory: []` — initialized on session start
- `latentConversation: []` — initialized on session start, reset on scene transition

**Effect application:**
- `add_item` → push `{ name, desc }` to `inventory`
- `unlock_exit` → merge exit into current scene's exits object
- `npc_note` / `nothing` → no state change

---

## 6. Display

`render.js` gains an inventory renderer. If `inventory` is non-empty, it appears below the scene description in dim text:

```
Carrying: pressure capsule, copper coin
```

Empty inventory: nothing shown.

---

## 7. Files Changed

| File | Change |
|------|--------|
| `data/scenes/*.json` (10 files) | Add `latents` array to each scene |
| `src/engine/latents-processor.js` | New — Claude call, effect parsing |
| `src/engine/command-processor.js` | Fall-through to latents processor on no match |
| `src/engine/session.js` | `inventory`, `latentConversation` state; apply effects; reset history on scene change |
| `src/interfaces/render.js` | Show inventory if non-empty |
| `tests/engine/latents-processor.test.js` | New — unit tests with mocked Claude |

---

## 8. Out of Scope (this iteration)

- Player dropping or using items on scene objects
- Latent-to-latent interactions (monkey steals the land deed)
- Persistent latent state across scenes
- Item display in graveyard memorials (future nice-to-have)
