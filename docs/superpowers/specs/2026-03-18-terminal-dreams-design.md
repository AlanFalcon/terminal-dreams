# Terminal Dreams — Design Spec
*2026-03-18*

## Concept

A one-shot MUD with ANSI art. You connect via SSH or a webpage and find yourself dropped into a randomly generated world assembled from 2–4 genre blends: deep-sea zombie escape, cyberpunk mutant negotiation, gonzo journalism in the 1950s, cowboy elves in space. You don't choose the world. You play for ~30 minutes. Completing the story terminates your connection. Disconnecting prematurely destroys the world — and it gets a memorial.

---

## 1. World Generation

### Genre System

A **genre registry** is a collection of flat files, one per genre. Each file contains vocabulary packs organized by slot type:

- `{LOCATION}` — places, environments, landmarks
- `{ANTAGONIST}` — enemy types, villain archetypes
- `{MACGUFFIN}` — objects of desire or mission
- `{THREAT}` — escalating dangers
- `{CHARACTER}` — NPCs, allies, bystanders
- `{ADJ}` — genre-flavored adjectives
- `{NOUN}` — genre-flavored nouns

Example genres in the initial registry: `deep-sea`, `cyberpunk`, `western`, `gonzo-journalism`, `high-fantasy`, `body-horror`, `golden-age-scifi`, `1950s-suburbia`, `cosmic-horror`. The registry grows by dropping new vocab files — no code changes required.

### Genre Mixing Formula

Each world is built from **2–4 genres**:
- 2 base genres are always selected (random from registry)
- Two dice rolls (50/50 each) potentially add a 3rd and 4th genre

### World Naming

World names are **mad-libs, not AI-generated**, to prevent LLM convergence. A set of name templates uses slots filled exclusively from the active genres' vocab packs.

**World name slot filling uses a different rule from scene slots.** Each slot in a name template is filled by one genre, cycling through the active genres in order. `{NOUN} and {NOUN}` with two active genres pulls the first `{NOUN}` from genre 1 and the second `{NOUN}` from genre 2 — producing "Brine and Static", not "Brine and Brine". Slots are not layered compounds in name templates; they are independent picks, one per genre in rotation. This preserves the cross-genre feel of the name.

Examples:
- `The {ADJ} {NOUN} of {LOCATION}` (3 genres) → genre 1 fills `{ADJ}`, genre 2 fills `{NOUN}`, genre 3 fills `{LOCATION}` → "The Abyssal Syndicate of the Rust Quarter"
- `{NOUN} and {NOUN}` (2 genres) → "Brine and Static"
- `{ADJ} {LOCATION}` (1 genre fallback) → "Irradiated Depths"

No AI is involved in naming. Full chaos within the genre envelope.

### Slot Filling

When a scene template slot is filled, words are drawn from the blended vocab of all active genres using a fixed priority rule:

- **Primary genre** = the first genre selected at session start. It fills the base slot word.
- **Secondary genres** (2nd, 3rd, 4th) contribute modifiers only — adjectives, compounds, or qualifiers prepended to the primary word.
- If only one genre has vocabulary for a slot type, it fills the slot alone.

Example: two active genres filling `{ANTAGONIST}` → primary genre contributes "enforcer", secondary genre contributes "mutant" → "mutant enforcer". Three genres → "deep-sea mutant enforcer". The primary genre is always the noun; secondary genres layer left.

---

## 2. Three-Act Structure

Each world runs **10 scenes** across 3 acts, targeting ~3 minutes per scene (~30 minutes total).

| Act | Scenes | Purpose |
|-----|--------|---------|
| Act 1 | 3 | Arrival — player wakes up / arrives, world is established, problem is seeded |
| Act 2 | 4 | Complication — escalation, a mid-act fork (2 scenes each), both paths converge at Act 3 |
| Act 3 | 3 | Climax and escape — resolution, closing narration, connection terminates |

**Total: 10 scenes** (Act 1: scenes 1–3, Act 2 Path A: scenes 4A–5A, Act 2 Path B: scenes 4B–5B, Act 3: scenes 6–8 shared).

This is a **MUD, not a choose-your-own-adventure**. The Act 2 fork is the only branch.

### Act 2 Fork

**Fork trigger:** A key command during scene 3 (the final scene of Act 1) determines the path. The template designates a pivot action — e.g., `take [item]` vs. `go [direction]`. If the player takes the pivot action before leaving scene 3, they take Path A; if they leave without it, Path B. Both paths have 2 scenes each (scenes 4 and 5) before converging at Act 3.

**Act 3 convergence:** Scenes 6–8 use the same structural template regardless of path. Fork-specific state (items picked up, characters encountered) is carried as template variables into Act 3 descriptions — the Narrator references what actually happened. The ending is the same; the texture differs.

### Scene Structure

Every scene contains:
- An **ANSI art composite** assembled from genre-tagged tiles
- A **mad-libbed description** (1–3 paragraphs of templated prose)
- A set of **available commands** (`look`, `go [direction]`, `take [item]`, `talk to [character]`, `use [item]`)
- **Exits** to the next scene(s)

The final scene of Act 3 triggers a closing narration, prints `CONNECTION CLOSED.`, and terminates the session.

---

## 3. ANSI Tile System

### Library Structure

```
tiles/
  deep-sea/
    location-trench.ans
    character-drowned-sailor.ans
    atmosphere-bioluminescence.ans
  cyberpunk/
    location-neon-alley.ans
    character-chrome-fixer.ans
  ...
```

Each tile is a **fixed-width ANSI block** (40×12 characters). Each file is tagged in its filename by genre and scene-type (`location`, `character`, `object`, `atmosphere`).

Scenes composite **1–3 tiles** side by side or stacked depending on scene type.

### Generation Budget

Each session gets a budget of **10 new tiles** until the library reaches **200 tiles**. After that, the budget drops to **2** (gap-filling only).

When a scene requires a tile for a genre-combo not yet in the library, a Claude API call generates it using a templated prompt structured as:

```
Generate a 40-column × 12-row ANSI art tile.
Genre tags: {genre1}, {genre2}, ...
Scene type: {location|character|object|atmosphere}
Use ANSI escape codes for colour. Every row must be exactly 40 terminal columns wide (measure by visible character count, not byte count). Output only the raw ANSI escape sequences, no commentary.
```

Generated tiles are **validated before being committed**: the engine strips escape sequences and measures the visible column width of each row. Tiles that fail the 40×12 constraint are discarded and a retry is attempted (max 2 retries). If all retries fail, the session falls back to a library tile using this resolution order: (1) a tile from a genre in the active blend, (2) a tile of the same scene-type from any genre, (3) any tile in the library at random. The fallback never fails as long as the library has at least one tile.

**Concurrency guard:** Tile generation and repo commits are serialized through a single write queue — only one tile is written and committed at a time regardless of concurrent sessions. The global tile count is incremented **only on successful commit**. Because the queue is serial (not parallel), at most one generation attempt is in-flight at any moment, so there is no overshoot — the count is checked at queue-entry time, and only one session can hold the queue at once.

---

## 4. Interfaces

### Shared Principle

Both interfaces connect to the same game engine. The engine is interface-agnostic: it receives commands, emits ANSI text. Both render identically.

### First Connection Message

```
A world is being assembled for you.
Do not disconnect until the story ends.
```

### SSH

- Player connects to a dedicated port
- A new session spawns on connect
- Real terminal, real PTY, real disconnect event
- Premature disconnect is unambiguous — the OS fires the event

### Web

- Single-page app with **xterm.js** over WebSocket
- Visually identical to the SSH experience
- Tab close and browser navigation fire the WebSocket `close` event
- **5-second grace period** on disconnect: at session start, the server sends the client a session token in the first WebSocket message (`{"type":"session","token":"<uuid>"}`). The client stores this token in `sessionStorage` — it survives a page refresh but not a tab close. On WebSocket `close`, the server holds the session open for 5 seconds. If a new WebSocket connection arrives bearing the same session token (sent as the first client message on reconnect) within that window, it is reattached to the live session with no interruption. If no reconnect arrives within 5 seconds, the world is declared lost. Tab close flushes `sessionStorage`, so there is no grace period for deliberate closes — only for refreshes.

---

## 5. Graveyard

### On Premature Disconnect

1. Engine snapshots world state: genre blend, world name, act/scene reached, and the **last 20 commands** the player issued (capped to prevent context overflow)
2. A Claude API call fires with a templated prompt containing the snapshot
3. Claude writes a **2–3 paragraph memorial**

### Memorial Voice

> **Love Island Host having a very bad personal day, and not afraid to let it show.**

Passive-aggressive. Slightly bereaved. Personally affronted by the disconnection. Cannot believe you did this to them.

### Storage

```
graveyard/
  2026-03-18T14-32-00-the-abyssal-syndicate.md
  2026-03-18T15-01-44-irradiated-depths.md
  ...
completed.log
```

Premature disconnections → full memorial in `graveyard/`.
Completed worlds → one-line entry in `completed.log`. They are not memorialized. They earned their ending.

### Graveyard Index

- Accessible at `/graveyard` on the web interface
- Read-only mode via `ssh [host] graveyard` (passed as SSH command, not a shell)
- Both surfaces are **purely static and read-only** — no game state, no commands, no interaction beyond navigation
- Index lists all lost worlds: name, genre blend, act/scene reached, first line of memorial
- World names are slugified for storage and routing: lowercase, spaces replaced with hyphens, non-alphanumeric characters stripped (e.g. "The Abyssal Syndicate" → `the-abyssal-syndicate`). The filename in `graveyard/` is `{ISO-timestamp}-{slug}.md`; this is the canonical key. Web URLs use `/graveyard/{slug}` (no timestamp — the slug alone is the route; if two worlds produce the same slug, a numeric suffix is appended: `-2`, `-3`, etc.). SSH navigation uses index numbers (`1`–`N` to read, `q` to exit)
- Landing page and SSH entry screen display a counter: **"X worlds have been lost."**

### completed.log Format

One line per completed world:

```
{ISO-8601-timestamp} | {world-name} | {genre-1},{genre-2}[,{genre-3}[,{genre-4}]] | {scenes-completed}/10
```

Example:
```
2026-03-18T14:32:00Z | The Abyssal Syndicate | deep-sea,cyberpunk | 10/10
```

**No session timeout.** Players may idle indefinitely — the session remains open until completion or disconnect. This is intentional.

---

## 6. Persistence Model

**Nothing persists per-player.** No accounts, no saves, no cookies. You are not remembered.

Two things accumulate globally:

| What | Where | Notes |
|------|-------|-------|
| Tile library | `tiles/` | Grows to 200, then stabilizes |
| Graveyard | `graveyard/` | Grows forever |

Genre registry and templates are static files expanded manually as the project matures. New genres require only a vocab pack file and tile seeds — no code changes.

---

## 7. Tech Stack

- **Runtime:** Node.js
- **SSH:** `ssh2` library
- **Web terminal:** xterm.js over WebSocket
- **AI:** Anthropic SDK (tile generation, graveyard memorials)
- **Deploy:** VPS or Railway, single process
- **Storage:** Flat files — no database
