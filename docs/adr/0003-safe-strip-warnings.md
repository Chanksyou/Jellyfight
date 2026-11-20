---
status: accepted
---

# A Warning over a whole area can spare a white strip behind cover

The Encore's duet, the Wall of sound (act 4, `src/encore-wall.js`), hits the whole floor at any height, so there is nowhere to step and nothing to jump.
Its Warning is the floor strip and slab of ADR 0001 over the whole floor, in its hostile colour (`--hostile-encore-wall`), and on top of it a white strip (`--safe-spot`, the same white as the Kettle's Boil dry circle and the Singing Bowl's Hum circle) behind each record the silver DJ has left standing.
The strips are the only safe ground, are drawn above the Warning and are full from the start (they don't fill: only the danger counts down), so the player reads "go here" rather than "don't go here".
The hit test is the same shape in 2D (x and z only): the jelly's centre inside a strip whose record was still standing when the wall reached it.

## Considered Options

- **Cut holes out of the Warning**: harder to read than a bright shape on top, and a hole in a hot floor looks like a gap in the attack rather than shelter.
- **A volume for each strip**: the space is safe at any height under the wall, so a column adds nothing a player needs and costs draws.
- **Shelter by a collision shadow off the record (a ray to the wall)**: honest in 3D but invisible until the hit; the strip says it before.

## Consequences

A safe shape is always white, never a hostile or friendly colour, and never fills.
The cover it depends on must stand when the Warning starts: if none does, the attack is called off rather than played with no safe ground.
