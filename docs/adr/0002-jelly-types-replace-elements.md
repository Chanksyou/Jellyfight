---
status: accepted
---

# Jelly types replace Elements

A run now starts by picking one of eight jelly types (Normal, Fire, Lightning, Ice, Poison, Wind, Glitter, Tentacle). The type sets the base stats and the one attack for the whole run. Before this, every jelly blew bubbles and lashed a tentacle, and picked up Elements as Legendary treasures that fired a second attack beside the bubbles. That made every run start the same and left the Elements as add-ons with thin upgrade trees. With types, the opening choice changes how the whole run plays, each type has its own pool of twelve Attack upgrades, and the tentacle becomes a type of its own instead of a free guard on every build.

Decided by the owner on Nov 10 2026. The full spec and build plan are in `docs/jelly-types/`.

## What goes with it

- Player text says "attack" where it said "bubble" (Attack damage, Attack size, Attacks), so every level-up card and Treasure works for every type. Attack damage and Fire rate drive tentacles too.
- After each act's boss there are two picks: a Legendary-only pick, then 1 of 3 Attack upgrades from the type's pool. Element upgrades no longer come from chests.
- Evolutions become Legendary treasures in the same pool, can be taken more than once a run, and stack.
- Acid becomes Poison: a blob whose burst adds stacking damage over time and weakens bugs, with no puddles.
- A first-time player plays Normal. The other types unlock through easy achievements.

## Considered Options

- **Keep Elements as treasures and add more of them**: the least work, but the start of every run stays the same, and owning several Elements blurs each one.
- **Types that only change stats, with Elements still collected**: two systems to balance against each other, and no clear identity per type.
- **Elemental types with the tentacle kept as a free default**: easier on ranged builds, but it leaves no room for a melee type.

## Consequences

- Every type's attack is tuned as a main attack, not a second one, so its damage is set again against Normal's.
- Without the default tentacle, bugs that get close are more dangerous for the seven ranged types. This is the main balance risk and is checked with the balance bot before release.
- Scores from before the change are not comparable with scores after it.
- CLAUDE.md's table rows for Treasures, Evolutions and Player stats are rewritten when the switch comes off (P11).
