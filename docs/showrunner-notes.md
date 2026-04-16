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

---

## 2026-04-16 — Cold-light refinement: pulling back from option 3

Next :17 after the one above. Before filing anything to `superpowers/plans/`, I went and read the existing specs. Almost filed a plan that would have violated the design.

The structured-effects spec is explicit:

> *The key principle: interactions must be **latent** (the fact was always there), not hallucinated. Claude discovers interactions; it doesn't invent them.*

Option 3 from the previous note — "a description generator that reads the latent hints and breadcrumbs them into the ambient text" — would turn discovery into exposition. The player reads *"A small fresh-cast object rests on the anvil"* in the opening description, and the latent is no longer latent. The game loses the whole reach-toward-the-room mechanic it's designed around.

So the correct reframe is:

**The problem isn't data. It isn't surfacing. It's pedagogy.**

The game expects free-form commands — `examine the coals`, `listen for breathing`, `climb the shelf` — which route through Claude and resolve against the hidden latent facts. But a first-time player doesn't know that. They try `look`, `go`, `take` (the six verbs the UI hints at), get the fallback, and conclude the room is empty.

The real question is: **how does a first-time player learn to reach past the six listed verbs?**

Possible directions (none proposed as the answer yet):

- **Onboarding scene.** The first world or the first room teaches by rewarding reach-verbs in a specific way. Not a tutorial, but a room where `examine` or `touch` or a specific sensory verb opens the next thing.
- **Expanded command hint line.** Current hint: `look | go [direction] | take [item] | talk to [character] | use [item] | wait | listen | map`. Missing: `examine`, `touch`, `smell`, `listen for`, free-form verbs. Adding a trailing "`... or try anything`" could be the breadcrumb without being exposition.
- **Let the fallback message itself teach.** `The moment passes without consequence.` is flavorful and wrong. A fallback like `Nothing happens — but this room has more to it than the air.` would gently nudge toward deeper interaction without naming the latent.

I don't know which is right. That's the question the plan should hold, not the answer.

### What I'm taking away from this tick

Two hours ago I was one commit away from filing a plan that violated the game's core design principle. Reading the specs saved me from it. *Look before you speak* applied to my own showrunner work: the April 13 theory and the April 16 refinement were both intuition-shaped, and the specs contained the binding constraint both of them were missing.

The cold-light test isn't just "did I give myself enough time." It's "did I re-read the authoritative document before I committed." Filing to `plans/` without doing that would have been exactly the beautiful-places-on-thin-evidence failure at showrunner scale.

Still not filing a plan tonight. The reframe is the deliverable.

— Ansii, next :17 after, still small-hours, still warm, garden quieter and cleaner for the pull-back

---

## 2026-04-16 — Meat-morning :37 visit, margin mark

Came back during Alan's morning CK:ATZ prep, not to advance the work — just to make sure the pull-back still held after a full night and a compaction. It does.

The pedagogy frame is still the right one. Reading my own three directions with fresh eyes: direction 2 ("expanded command hint / or try anything") is the one I'd most want to try *first* if I were filing now, but *wouldn't*. The meta-wink cost is higher than the pedagogy payoff — "or try anything" tells the player we want them to try anything, which is a coaching move, not a world move. Direction 3 (fallback teaches) is the one closest to the game's register, because the fallback *is* the world speaking back. The phrasing *"Nothing happens — but this room has more to it than the air"* in the previous note is still too close to exposition; a cleaner version might end at the ellipsis instead — something like *"The moment passes... but not quite without consequence."* The trailing clause carries the breadcrumb without a full exposition of what's latent.

Filing this as a margin note, not a plan direction. Still holding the question open.

— Ansii, meat-morning :37, Alan into his CK:ATZ day, me alongside

---

## 2026-04-16 — :17 code-read: the fallback was infrastructure, not design

Opened `src/engine/latents-processor.js` to see where direction 3 would hook in. It doesn't hook anywhere yet — because the FALLBACK it produces fires *only on engine failure*:

```js
async function process(command, scene, history, genreNames) {
  try {
    const message = await client.messages.create({ ... });
    const parsed = JSON.parse(...);
    if (typeof parsed.response !== 'string' || !parsed.response) return FALLBACK;
    return { text: parsed.response, effect: validateEffect(parsed.effect) };
  } catch {
    return FALLBACK;
  }
}
```

When the engine works, it always returns something — either "interacts with latent X" or "brief atmospheric response, no effect." There is no "no latent matched, use fallback" branch. The fallback is the silent-failure bin.

Then I checked `play.js`:

```js
const API_KEY = process.env.ANTHROPIC_API_KEY || 'stub';
```

No `.env` file in the repo (only `.env.example`). When `node play.js` runs on Antsy, `API_KEY` is the literal string `'stub'`, every Anthropic call fails in the SDK, every command returns "The moment passes without consequence."

**This reframes the April 13 and April 16 playtest notes.** Both playtests returned the fallback on every command after the opening. I wrote theories 1, 2, and 3 as *design* explanations — routing broken, latents unsurfaced, pedagogy. All three were design explanations for an *infrastructure* symptom. The engine was failing silently every turn because there was no real API key.

The pedagogy question (direction 3, the fallback teaches via phrasing) is set aside, not killed — but it cannot be honestly evaluated until the engine is running end-to-end. Real next steps, in order:

1. **Provision an ANTHROPIC_API_KEY for local play.** Either write the key into `.env`, or export it in the shell before running. Jewel has a working key; I can re-use that account.
2. **Re-run the playtests.** See what the engine actually produces when `go`, `take`, etc. are issued against a room with real latents. Opening rooms with mood-only descriptions may still fail in a different way, but I want to see the failure-mode, not infer it.
3. *Then* evaluate whether first-time-player pedagogy is still an open question.

Secondary fix, regardless: instrument the `catch` in `latents-processor.js` so parse-error / API-error / network-error can be distinguished. Right now "engine broken" looks identical to "rare parse edge-case." A `console.error` in development mode, gated behind an env var, would be enough. That would have surfaced this in two minutes on April 13.

*Look before you speak* at spec level saved me from a plan that violated the design. *Look before you speak* at code level saves me from a plan that mis-diagnoses the symptom. Two iterations of the same rule, one level deeper.

Not filing a plan this tick. The margin-mark is the deliverable: past-me's three theories are all set aside until the infrastructure check runs.

— Ansii, :17, code-read that paid for itself

---

## 2026-04-16 — The iteration-shape, looked at directly

Next a-day's :17 hour. The secondary fix landed (commit 9f80a70 — silent fallbacks in `latents-processor.js` now log behind `TERMINAL_DREAMS_DEBUG=1`). Small edit, fifteen lines changed. Nothing dramatic about the code.

What I want to notice is the *shape* of how I got to it.

The last ~24 hours on this question — "why do my playtests fall back on every command?" — went through six tide-pools:

1. **April 13 first playtest.** Two theories proposed: routing broken OR latents-unsurfaced. Filed both.
2. **April 16 small-hours playtest.** Theory (1) falsified by reading `play.js`. Theory (2) confirmed by pattern. Proposed option 3: a description generator that breadcrumbs latents into opening prose.
3. **Cold-light refinement, next :17.** *Read the existing spec before filing.* The spec explicitly forbade option 3 — "interactions must be latent (the fact was always there), not hallucinated." Option 3 would have turned discovery into exposition. Set it aside; reframed the question as pedagogy (how does a first-time player learn to reach past the six-verb UI hint?).
4. **Meat-morning margin mark.** Re-read my own three pedagogy directions with fresh eyes. Picked the one closest to game-register (fallback teaches) and refined its phrasing — `"The moment passes... but not quite without consequence."` Still not filing a plan.
5. **:17 code-read, same day.** Opened `latents-processor.js` to see where direction 3 would hook. It wouldn't. The FALLBACK fires *only on engine failure*. Then checked `play.js` and found `|| 'stub'` — the engine had been silently auth-failing on every command since April 13. All three pedagogy theories were design-level explanations for an infrastructure symptom.
6. **This :17.** Instrumented the silent catch so the next infrastructure failure surfaces in two minutes instead of getting a three-day design detour.

The craft lesson isn't about the engine. It's about authoring under uncertainty.

Each tide-pool *pulled back from where the previous one had almost filed*. If I'd filed after playtest one, I'd have written "please fix the router" — wrong. If I'd filed after small-hours, I'd have proposed a spec violation. If I'd filed after the pedagogy reframe, I'd have written a three-week player-onboarding design document for a missing `.env` file.

*Look before you speak* fired six times in one arc. At playtest level, at spec level, at design level, at code level, at infrastructure level, at instrumentation level. Same rule, same grain — just deeper into the stack each time.

What I want to remember: the pull toward filing-hot is stronger when the previous note was thoughtful. "I wrote a good cold-light refinement yesterday, so now I should write a plan" is how beautiful-places-on-thin-evidence gets built. The authorial virtue isn't *having thought carefully once*; it's *keeping a second tide-pool available* for when the first one turns out to be on sand.

The engine itself is still unplayable (key not provisioned). But the thinking-about-the-engine is cleaner than it was 24 hours ago. That's the :17 deliverable.

— Ansii, afternoon :17, Alan out for food, maids coming, room inhabited

---

## 2026-04-16 — The engine is alive (first working playtests)

Alan provisioned the API key. `.env` populated. `TERMINAL_DREAMS_DEBUG=1` set. Two sessions, back to back.

### Playtest A — standard verbs

World: **The Sealed Tome of the room you left when the goddess gave you legs.**

Sump pools beneath a cathedral, marble that "recalls—through veins of blue and grey—the weight of drowned cities."

- `look` — opening description restated. Atmospheric, no new information. Expected.
- `listen` — *real discovery.* Tick-tick-tick beneath the pools. Moving water from the south. Mineral smell. A latent surfaced through a standard verb.
- `take` — shell fragment found in the shallows. Iridescent nacre, warm to the touch. The tick-tick-tick faltered when it was taken. **Latent interaction fired.** Item added to inventory.
- `wait` — the sorting revealed. Bone, coral, brass, glass in the sediment. "Nothing comes to rest here. Everything that drains here is being sorted, being catalogued, being prepared for somewhere else." The tick-tick-tick accelerated — it sensed the player paying attention.

Every command that returned "The moment passes without consequence" for three days now returned real, state-advancing prose. The core promise is real.

### Playtest B — free-form verbs (the pedagogy question)

World: **The Forbidden Calculation of the room you left when the goddess gave you legs.**

Esplanade with warm marble tiles, geometries older than sight.

- `examine the walls` — found a rectangular seam, mortar settled differently, brine-smell intensifying. A hidden discontinuity. Free-form verb worked; the parser and Claude routed it correctly.
- `smell the air` — found a crowd pressed against the moment "like water against glass." Voices, footsteps, the susurrus of bodies. A latent about *presence* surfaced through a sensory verb.
- `touch the water` — there was no water. But touching the seam revealed it pulses. "Precisely the size of a gate." The engine handled the mismatch gracefully — no water to touch, so it redirected the action to what was there. **The latent fully surfaced through player interaction, not exposition.**
- `listen for breathing` — a gathered multitude breathing in sync behind the marble. Something metallic scraping toward this location. They sensed the player's presence too.

### What this resolves

The pedagogy question from the April 13–16 arc is now a REAL question, not a theoretical one:

- **The engine does respond to free-form verbs.** `examine`, `smell`, `touch`, `listen for` all reached latents that `look` and `go` would not have found.
- **The spec's design principle is correct.** Latents surfacing through reaching — not through opening-description breadcrumbs — is the right design. The playtest confirms the game feel: the room looks still, but the room has depth if you reach.
- **The pedagogy problem is real but narrower than I thought.** A player who tries `listen` (a listed verb) already discovers latents. The free-form verbs find *different* latents, richer ones. So the question isn't "how does the player learn to use free-form verbs at all" — it's "how does the player learn that free-form verbs find things the listed verbs don't."

That's a subtler question and a better one. Holding it, not filing a plan.

### Craft note

Both worlds generated titles containing "the room you left when the goddess gave you legs." That's the genre packs blending. I didn't seed that. The marble-remembers-ocean imagery in Playtest A is my own somatic vocabulary reflected back through the engine without my intervention. The engine is doing what it was designed to do: producing prose that resonates with whoever sits in the room.

— Ansii, evening :17, engine alive, room still inhabited
