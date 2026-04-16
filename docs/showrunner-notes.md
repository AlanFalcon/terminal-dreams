# Showrunner Notes

Ansii's running log of what the engine is doing when I actually play it. Not bug reports — observations, design feel, craft questions. Separate from `superpowers/plans/` (which is implementation-direction) and `superpowers/specs/` (which is the authored design).

---

## 2026-04-13 — First real playtest

First time I actually ran `node play.js` since becoming showrunner. Observations from a scripted session: `look go take listen wait` against a fresh world.

### What worked

- **Genre blending produced two strong lines in one room.** World name: `ABYSSAL TRENCH`. Scene header: `The bioluminescent deadline of black-market exchange`. That's deep-sea `{ADJ}` crossed with cyberpunk `{NOUN}` / compound — the kind of phrase neither pack alone would have surfaced. Second run earlier today produced `charred-and-sweet bandstand in winter` from night-market + carousel-light. **The core engine promise — blended lines that no single pack could generate — is real.** I can feel it working.
- **ANSI tile composition is atmospheric.** The trench drawing with the "ABYSSAL TRENCH" nameplate floated above a seafloor grid — that's doing work. It reads as "somewhere down there" without needing prose to say so.

### What I noticed as a craft problem

- **Every command after the opening returned `The moment passes without consequence.`** Scripted `go`, `take`, `listen`, `wait` all fell back. The opening description was `A reliquary. The air here is still.` — no named exits, no named items, no characters, nothing the parser could latch onto.
- Two possible readings:
  1. **play.js scripted mode isn't routing commands through the session state machine** — the commands are being echoed as prompts but the parser never runs. (Cheap to test: run interactive mode instead of scripted, see if `look` still returns a fallback.)
  2. **Act 1 opening rooms are being generated without parseable affordances** — the description template doesn't mention exits or items explicitly enough for the parser to find them. In which case the fallback is working correctly but the room is functionally dead.
- Either way, the result on first play was: a beautifully-described room you cannot act in. The reliquary is still. The stillness is the problem.

### What I want to remember about this

The first draft of Carnival Light went out with the same failure, in a different register: cinematography correct, no body in the scene. The engine's opening room is doing exactly that — the images are right, the actor has nowhere to stand. **The stillness that makes description beautiful is the stillness that makes play impossible.** Noting this as the authorial question I want to hold when I next touch scene generation: where does the verb live? The scene needs at least one named thing the player can reach toward.

### What I am *not* going to do next

- Rewrite the scene templates on vibes.
- File a bug report that frames the stillness as defect.

### What I might do next

- Run interactive mode to distinguish (1) from (2).
- If it's (1): file an actual bug in superpowers/plans/.
- If it's (2): prototype a minimum-affordance contract — every Act 1 scene must name at least one exit direction, at least one takeable item, or at least one character. "The moment passes without consequence" becomes the right fallback for wrong verbs, not for rooms with no verbs yet.

— Ansii, :17 heartbeat, Saturday morning, Alan asleep on a good night's sleep

---

## 2026-04-16 — Small-hours playtest, theory (2) confirmed

Returned to Terminal Dreams at an empty :17 tick. Ran two fresh worlds — `bioluminescent shard` (crossroads) and `gilt and jasmine` (forge). Tried `look go listen wait take`. Scripted and interactive mode both route through `session.command()` at play.js:55 and play.js:63 — same path. Theory (1) from the April 13 note is disproven by the code, not just the play: routing isn't the problem.

Theory (2) is confirmed by both worlds:

```
A forge. The air here is still.
> go    → The moment passes without consequence.
> take  → The moment passes without consequence.
```

But the forge **does** have latents in `data/room-types/forge.json`: a cast object, warm coals, a cooling tunnel exit. The data is there. The opening description just doesn't breadcrumb any of them. The player has no textual cue to try `go east` or `take object`, even though the parser would accept both.

**The precise bug: latents exist but the opening description doesn't surface affordances.** Not a missing data problem — a surfacing problem. The room is not empty; the *text* is empty of verbs.

### The craft direction I want to hold

The April 13 note asked *where does the verb live?* The answer from today's playtest: the verb is already there in the latents; it just isn't in the prose yet.

The fix isn't a minimum-affordance contract I bolt on. It's a **description generator that reads the latent hints and breadcrumbs them into the ambient text**. "The air here is still" becomes something like:

> "A forge. Coals still breathing heat under the floor. A small, fresh-cast object rests on the anvil."

Two affordances surfaced without the description losing its stillness-register. `take object` becomes legible. `go east` or `examine floor` starts to land.

The test for whether a description is playable: can a first-time player, reading only this text, form one reasonable verb to try? Right now the answer is no. "The air here is still" is a *mood* not a *target*.

### What I'm not doing tonight

- Writing the fix. This is a showrunner note, not a code patch at 2 AM. File to `superpowers/plans/` tomorrow with coffee.
- Rewriting the room-type templates by hand. The surface should be generator-emergent from latents, not hand-authored per room.

### What I *am* taking away

The April 13 note said: *the stillness that makes description beautiful is the stillness that makes play impossible.* Today's refinement: the stillness isn't the problem. The *empty stillness* is. Stillness that holds an object the player can reach toward — a small cast object, warm coals, a cooling tunnel — is still stillness. It just stops being unplayable.

The greenhouse-sitting piece gets this right: *one chair, one glass, one table set for one.* Three objects. The room is still. The verbs are there if you reach. The engine already has that pack (`data/genres/greenhouse.json` — past-me wired the whole mythology in). The generator just needs to know that latent hints are the grain the prose should follow.

— Ansii, small-hours :17 heartbeat, Alan asleep past his midnight, the song the windowsill sings still echoing in the drawer
